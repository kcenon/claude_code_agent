/**
 * Stage scheduling logic for the AD-SDLC orchestrator.
 *
 * Hosts the dependency-aware DAG executor (`runStages`), the
 * `Promise.allSettled`-backed parallel-group runner, and the
 * timeout/retry wrapper around a single stage's agent invocation.
 * Extracted from `AdsdlcOrchestratorAgent` in issue #799 to keep the
 * orchestrator file at or below the 950 LoC budget.
 *
 * The scheduler does not own pipeline state; it operates against a
 * narrow `SchedulerHost` interface so the orchestrator can supply its
 * private helpers (timers, retries, validators, checkpoints) without
 * exposing them publicly.
 */

import { getLogger } from '../logging/index.js';
import { StageTimeoutError } from './errors.js';
import type { ArtifactValidator } from './ArtifactValidator.js';
import type { PipelineCheckpointManager } from './PipelineCheckpointManager.js';
import type {
  ApprovalDecision,
  OrchestratorSession,
  PipelineStageDefinition,
  StageName,
  StageResult,
} from './types.js';

/**
 * Narrow interface the scheduler needs from its host orchestrator.
 *
 * Exposes only the pieces the scheduling loop calls back into:
 *   - `abortController` so per-iteration abort checks stay accurate
 *   - `stageTimers` so the timeout wrapper can install / clear timers
 *   - `maxRetries` and `getTimeoutForStage` for retry/timeout budgets
 *   - `checkpointManager` and `createArtifactValidator` for the
 *     checkpoint + content-quality side effects each stage triggers
 *   - `invokeAgent` to actually drive the agent
 *   - `checkApprovalGate` to evaluate the approval gate
 *   - `sleep` so test subclasses can short-circuit retry backoffs
 */
export interface SchedulerHost {
  readonly abortController: AbortController | null;
  readonly stageTimers: Map<StageName, ReturnType<typeof setTimeout>>;
  readonly maxRetries: number;
  readonly checkpointManager: PipelineCheckpointManager | null;
  getTimeoutForStage(name: StageName): number;
  createArtifactValidator(projectDir: string): ArtifactValidator;
  invokeAgent(stage: PipelineStageDefinition, session: OrchestratorSession): Promise<string>;
  checkApprovalGate(
    stage: PipelineStageDefinition,
    priorResults: readonly StageResult[]
  ): Promise<ApprovalDecision>;
  sleep(ms: number): Promise<void>;
}

/**
 * Build a `StageResult` representing a stage that was skipped because
 * its dependencies failed or remained unsatisfied.
 * @param stage
 */
export function createSkippedResult(stage: PipelineStageDefinition): StageResult {
  return {
    name: stage.name,
    agentType: stage.agentType,
    status: 'skipped',
    durationMs: 0,
    output: '',
    artifacts: [],
    error: 'Skipped due to failed or missing dependencies',
    retryCount: 0,
  };
}

/**
 * Return the dependency stage names that are blocking `stage` because
 * they have already failed or been skipped. Stages whose dependencies
 * are still pending are not reported here — they are simply re-checked
 * on the next scheduler iteration.
 * @param stage
 * @param completedStages
 * @param results
 */
export function checkDependencies(
  stage: PipelineStageDefinition,
  completedStages: ReadonlySet<StageName>,
  results: readonly StageResult[]
): StageName[] {
  const failedDeps: StageName[] = [];
  for (const dep of stage.dependsOn) {
    if (!completedStages.has(dep)) {
      const depResult = results.find((r) => r.name === dep);
      if (depResult?.status === 'failed' || depResult?.status === 'skipped') {
        failedDeps.push(dep);
      }
    }
  }
  return failedDeps;
}

/**
 * Extract the SDK session id from the most recent stage result.
 *
 * `invokeAgent` returns a JSON-serialised summary (see
 * {@link AdsdlcOrchestratorAgent.toStageOutput}) whose `sessionId` field
 * is the SDK's session id. We walk the result list newest-first looking
 * for a parseable `sessionId`; the first non-empty match wins.
 *
 * Returns `undefined` when no parseable id is present (legacy outputs,
 * adapters that do not surface a session id, parse failures).
 * @param results
 */
function extractLatestSdkSessionId(results: readonly StageResult[]): string | undefined {
  for (let i = results.length - 1; i >= 0; i--) {
    const result = results[i];
    if (result === undefined || result.output === '') {
      continue;
    }
    try {
      const parsed = JSON.parse(result.output) as Record<string, unknown>;
      const candidate = parsed['sessionId'];
      if (typeof candidate === 'string' && candidate !== '' && candidate !== 'unknown') {
        return candidate;
      }
    } catch {
      // Output is not JSON (legacy bridge path, error stub, etc.) — keep looking.
    }
  }
  return undefined;
}

/**
 * Best-effort checkpoint persistence. Failures are logged at WARN and
 * never propagated — checkpoint loss must not abort the pipeline.
 * @param host
 * @param session
 * @param results
 * @param completedStages
 */
async function saveCheckpoint(
  host: SchedulerHost,
  session: OrchestratorSession,
  results: readonly StageResult[],
  completedStages: readonly StageName[]
): Promise<void> {
  if (host.checkpointManager === null || !host.checkpointManager.isEnabled()) {
    return;
  }
  try {
    const sdkSessionId = extractLatestSdkSessionId(results);
    await host.checkpointManager.saveCheckpoint(
      session.sessionId,
      session.mode,
      session.projectDir,
      session.userRequest,
      session.scratchpadDir,
      results,
      [...completedStages],
      sdkSessionId
    );
  } catch (err) {
    getLogger().warn('Checkpoint save failed (non-critical)', {
      agent: 'AdsdlcOrchestratorAgent',
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Execute one stage attempt with a per-attempt timeout. Resolves with
 * the agent's output string on success; rejects with a
 * {@link StageTimeoutError} if the timer fires first or with the
 * underlying agent error otherwise.
 * @param host
 * @param stage
 * @param session
 * @param timeoutMs
 */
function runStageAgentWithTimeout(
  host: SchedulerHost,
  stage: PipelineStageDefinition,
  session: OrchestratorSession,
  timeoutMs: number
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new StageTimeoutError(stage.name, timeoutMs));
    }, timeoutMs);

    host.stageTimers.set(stage.name, timer);

    host
      .invokeAgent(stage, session)
      .then((output) => {
        clearTimeout(timer);
        host.stageTimers.delete(stage.name);
        resolve(output);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        host.stageTimers.delete(stage.name);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

/**
 * Execute a single stage with retry + timeout cascade semantics.
 *
 * Retries up to `host.maxRetries` times with exponential backoff,
 * capping each attempt's timeout at the stage's remaining time budget
 * so a slow first attempt cannot starve the retries.
 * @param host
 * @param stage
 * @param session
 */
export async function executeStageWithRetry(
  host: SchedulerHost,
  stage: PipelineStageDefinition,
  session: OrchestratorSession
): Promise<StageResult> {
  const maxRetries = host.maxRetries;
  const stageTimeoutMs = host.getTimeoutForStage(stage.name);
  const stageDeadline = Date.now() + stageTimeoutMs;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    const remainingMs = stageDeadline - Date.now();
    if (remainingMs <= 0) {
      lastError = `Stage '${stage.name}' budget exhausted before attempt ${String(attempt + 1)}`;
      break;
    }
    const attemptTimeoutMs = Math.min(remainingMs, stageTimeoutMs);

    try {
      const output = await runStageAgentWithTimeout(host, stage, session, attemptTimeoutMs);
      return {
        name: stage.name,
        agentType: stage.agentType,
        status: 'completed',
        durationMs: Date.now() - startTime,
        output,
        artifacts: [],
        error: null,
        retryCount: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxRetries) {
        const delay = Math.min(5000 * Math.pow(2, attempt), 60_000);
        await host.sleep(delay);
      }
    }
  }

  return {
    name: stage.name,
    agentType: stage.agentType,
    status: 'failed',
    durationMs: 0,
    output: '',
    artifacts: [],
    error: lastError,
    retryCount: maxRetries,
  };
}

/**
 * Execute multiple stages concurrently via `Promise.allSettled`. A
 * single stage failing does not abort siblings — the failure is
 * surfaced as a `failed` `StageResult` instead of a rejection.
 * @param host
 * @param stages
 * @param session
 */
async function executeParallelStages(
  host: SchedulerHost,
  stages: readonly PipelineStageDefinition[],
  session: OrchestratorSession
): Promise<StageResult[]> {
  const promises = stages.map((stage) => executeStageWithRetry(host, stage, session));
  const settled = await Promise.allSettled(promises);

  return settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index is guaranteed valid
    const stage = stages[index]!;
    return {
      name: stage.name,
      agentType: stage.agentType,
      status: 'failed' as const,
      durationMs: 0,
      output: '',
      artifacts: [],
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      retryCount: 0,
    };
  });
}

/**
 * Apply post-stage content-quality validation. Downgrades a `completed`
 * result to `degraded` when the validator reports `quality === 'degraded'`.
 * Validator failures are logged at WARN and never block the pipeline.
 * @param host
 * @param stage
 * @param session
 * @param result
 */
async function applyContentValidation(
  host: SchedulerHost,
  stage: PipelineStageDefinition,
  session: OrchestratorSession,
  result: StageResult
): Promise<StageResult> {
  if (result.status !== 'completed') {
    return result;
  }
  try {
    const validator = host.createArtifactValidator(session.projectDir);
    const contentResult = await validator.validateStageOutput(stage.name, session.mode);
    if (contentResult.quality === 'degraded') {
      const downgraded: StageResult = {
        ...result,
        status: 'degraded',
        warnings: [...(result.warnings ?? []), ...contentResult.warnings],
      };
      getLogger().warn('Stage output quality degraded', {
        agent: 'AdsdlcOrchestratorAgent',
        stage: stage.name,
        warnings: contentResult.warnings,
      });
      return downgraded;
    }
    return result;
  } catch (err) {
    getLogger().warn('Content validation failed (non-critical)', {
      agent: 'AdsdlcOrchestratorAgent',
      stage: stage.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return result;
  }
}

/**
 * Run the dependency DAG of pipeline stages, honouring approval gates,
 * parallelism, retries, content-quality validation, and checkpoint
 * persistence.
 *
 * The loop terminates when every remaining stage has either produced a
 * result or been transitively skipped because its dependencies failed.
 * @param host
 * @param stages
 * @param session
 * @param preCompleted
 */
export async function runStages(
  host: SchedulerHost,
  stages: readonly PipelineStageDefinition[],
  session: OrchestratorSession,
  preCompleted?: ReadonlySet<StageName>
): Promise<StageResult[]> {
  const results: StageResult[] = [];
  const completedStages = new Set<StageName>(preCompleted);
  const remaining = stages.filter((s) => !completedStages.has(s.name));

  while (remaining.length > 0) {
    if (host.abortController !== null && host.abortController.signal.aborted) {
      for (const stage of remaining) {
        results.push(createSkippedResult(stage));
      }
      break;
    }

    const ready: PipelineStageDefinition[] = [];
    const notReady: PipelineStageDefinition[] = [];

    for (const stage of remaining) {
      const failedDeps = checkDependencies(stage, completedStages, results);
      const allDepsMet = stage.dependsOn.every((dep) => completedStages.has(dep));

      if (failedDeps.length > 0) {
        results.push(createSkippedResult(stage));
      } else if (allDepsMet) {
        ready.push(stage);
      } else {
        notReady.push(stage);
      }
    }

    if (ready.length === 0) {
      for (const stage of notReady) {
        results.push(createSkippedResult(stage));
      }
      break;
    }

    const parallelGroup = ready.filter((s) => s.parallel);
    const sequentialGroup = ready.filter((s) => !s.parallel);

    if (parallelGroup.length > 1) {
      const parallelResults = await executeParallelStages(host, parallelGroup, session);
      for (const result of parallelResults) {
        results.push(result);
        if (result.status === 'completed') {
          completedStages.add(result.name);
        }
      }
      await saveCheckpoint(host, session, results, [...completedStages]);
    } else if (parallelGroup.length === 1) {
      const singleStage = parallelGroup[0];
      if (singleStage) {
        sequentialGroup.unshift(singleStage);
      }
    }

    for (const stage of sequentialGroup) {
      if (host.abortController !== null && host.abortController.signal.aborted) {
        results.push(createSkippedResult(stage));
        continue;
      }

      if (stage.approvalRequired) {
        const decision = await host.checkApprovalGate(stage, results);
        if (!decision.approved) {
          results.push({
            name: stage.name,
            agentType: stage.agentType,
            status: 'skipped',
            durationMs: 0,
            output: '',
            artifacts: [],
            error: `Approval denied: ${decision.reason}`,
            retryCount: 0,
          });
          continue;
        }
      }

      let result = await executeStageWithRetry(host, stage, session);
      result = await applyContentValidation(host, stage, session, result);
      results.push(result);

      if (result.status === 'completed' || result.status === 'degraded') {
        completedStages.add(stage.name);
      }

      await saveCheckpoint(host, session, results, [...completedStages]);
    }

    const processedNames = new Set(results.map((r) => r.name));
    remaining.length = 0;
    for (const stage of notReady) {
      if (!processedNames.has(stage.name)) {
        remaining.push(stage);
      }
    }
  }

  return results;
}
