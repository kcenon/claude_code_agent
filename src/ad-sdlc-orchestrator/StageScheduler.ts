/**
 * Stage scheduling logic for the AD-SDLC orchestrator.
 *
 * Hosts the dependency-aware DAG executor (`runStages`), the
 * bounded-concurrency parallel-group runner, and the
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
import { RetryExecutor } from '../error-handler/RetryExecutor.js';
import type { StageVerificationResult } from '../stage-verifier/types.js';
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
  readonly maxParallelAgents: number;
  readonly haltOnVerificationFailure: boolean;
  readonly checkpointManager: PipelineCheckpointManager | null;
  getTimeoutForStage(name: StageName): number;
  createArtifactValidator(projectDir: string): ArtifactValidator;
  invokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession,
    signal: AbortSignal
  ): Promise<string>;
  verifyStage(
    stage: PipelineStageDefinition,
    result: StageResult,
    session: OrchestratorSession
  ): Promise<StageVerificationResult>;
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
    const attemptController = new AbortController();
    const pipelineSignal = host.abortController?.signal;
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timer);
      host.stageTimers.delete(stage.name);
      pipelineSignal?.removeEventListener('abort', abortFromPipeline);
    };
    const settle = (operation: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      operation();
    };
    const abortFromPipeline = (): void => {
      attemptController.abort(pipelineSignal?.reason);
    };
    const timer = setTimeout(() => {
      const error = new StageTimeoutError(stage.name, timeoutMs);
      attemptController.abort(error);
      settle(() => {
        reject(error);
      });
    }, timeoutMs);

    host.stageTimers.set(stage.name, timer);
    if (pipelineSignal?.aborted === true) {
      abortFromPipeline();
    } else {
      pipelineSignal?.addEventListener('abort', abortFromPipeline, { once: true });
    }

    host
      .invokeAgent(stage, session, attemptController.signal)
      .then((output) => {
        settle(() => {
          resolve(output);
        });
      })
      .catch((error: unknown) => {
        settle(() => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
      });
  });
}

/**
 * Extract artifact paths from the adapter's JSON stage summary.
 * @param output
 */
function extractArtifactPaths(output: string): string[] {
  try {
    const parsed = JSON.parse(output) as { artifacts?: unknown };
    if (!Array.isArray(parsed.artifacts)) return [];
    return parsed.artifacts.flatMap((artifact) => {
      if (typeof artifact !== 'object' || artifact === null || !('path' in artifact)) return [];
      const artifactPath = (artifact as { path?: unknown }).path;
      return typeof artifactPath === 'string' && artifactPath !== '' ? [artifactPath] : [];
    });
  } catch {
    return [];
  }
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
  let attempt = 0;
  let attemptStartTime = Date.now();
  const retryExecutor = new RetryExecutor({
    maxAttempts: maxRetries + 1,
    backoffStrategy: 'exponential',
    baseDelayMs: 5000,
    maxDelayMs: 60000,
    multiplier: 2,
    jitterRatio: 0,
  });
  const execution = await retryExecutor.executeWithResult(
    async () => {
      attempt++;
      attemptStartTime = Date.now();
      const remainingMs = stageDeadline - Date.now();
      if (remainingMs <= 0) {
        lastError = `Stage '${stage.name}' budget exhausted before attempt ${String(attempt)}`;
        throw new Error(lastError);
      }
      const attemptTimeoutMs = Math.min(remainingMs, stageTimeoutMs);

      const output = await runStageAgentWithTimeout(host, stage, session, attemptTimeoutMs);
      return output;
    },
    {
      operationName: `pipeline-stage:${stage.name}`,
      errorClassifier: () => 'retryable',
      shouldRetry: (error) => {
        lastError = error.message;
        return Date.now() < stageDeadline;
      },
      delay: (ms) => host.sleep(ms),
    }
  );

  if (execution.success && execution.value !== undefined) {
    return {
      name: stage.name,
      agentType: stage.agentType,
      status: 'completed',
      durationMs: Date.now() - attemptStartTime,
      output: execution.value,
      artifacts: extractArtifactPaths(execution.value),
      error: null,
      retryCount: Math.max(0, attempt - 1),
    };
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
 * Execute multiple stages with a bounded worker pool. A single stage failing
 * does not abort siblings — the failure is surfaced as a `failed`
 * `StageResult` instead of a rejection.
 * @param host
 * @param stages
 * @param session
 */
async function executeParallelStages(
  host: SchedulerHost,
  stages: readonly PipelineStageDefinition[],
  session: OrchestratorSession
): Promise<StageResult[]> {
  const results = new Array<StageResult>(stages.length);
  const concurrency = Math.min(stages.length, Math.max(1, host.maxParallelAgents));
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < stages.length) {
      const index = nextIndex++;
      const stage = stages[index];
      if (stage === undefined) return;

      try {
        results[index] = await executeStageWithRetry(host, stage, session);
      } catch (error: unknown) {
        results[index] = {
          name: stage.name,
          agentType: stage.agentType,
          status: 'failed',
          durationMs: 0,
          output: '',
          artifacts: [],
          error: error instanceof Error ? error.message : String(error),
          retryCount: 0,
        };
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
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
 * Apply content validation followed by the live V&V gate. In non-blocking
 * modes a failed verification is retained as a warning; strict mode with
 * `haltOnVerificationFailure` converts the stage into a hard failure.
 * @param host
 * @param stage
 * @param session
 * @param result
 */
async function finalizeStageResult(
  host: SchedulerHost,
  stage: PipelineStageDefinition,
  session: OrchestratorSession,
  result: StageResult
): Promise<{ result: StageResult; halt: boolean }> {
  const contentValidated = await applyContentValidation(host, stage, session, result);
  if (contentValidated.status !== 'completed' && contentValidated.status !== 'degraded') {
    return { result: contentValidated, halt: false };
  }

  const verification = await host.verifyStage(stage, contentValidated, session);
  if (verification.passed) {
    return { result: contentValidated, halt: false };
  }

  const details =
    verification.errors.length > 0
      ? verification.errors
      : [`Stage '${stage.name}' did not pass verification`];
  if (host.haltOnVerificationFailure) {
    return {
      result: {
        ...contentValidated,
        status: 'failed',
        error: `Verification failed: ${details.join('; ')}`,
        warnings: [...(contentValidated.warnings ?? []), ...verification.warnings],
      },
      halt: true,
    };
  }

  return {
    result: {
      ...contentValidated,
      warnings: [
        ...(contentValidated.warnings ?? []),
        ...details.map((message) => `Verification advisory: ${message}`),
      ],
    },
    halt: false,
  };
}

/**
 * Return a session snapshot containing every result available to this stage.
 * @param session
 * @param results
 */
function withStageResults(
  session: OrchestratorSession,
  results: readonly StageResult[]
): OrchestratorSession {
  return {
    ...session,
    stageResults: [...session.stageResults, ...results],
  };
}

/**
 * Append skipped results for every stage not already processed.
 * @param stages
 * @param results
 * @param completedStages
 * @param reason
 */
function skipUnprocessedStages(
  stages: readonly PipelineStageDefinition[],
  results: StageResult[],
  completedStages: ReadonlySet<StageName>,
  reason: string
): void {
  const processed = new Set<StageName>([
    ...completedStages,
    ...results.map((result) => result.name),
  ]);
  for (const stage of stages) {
    if (processed.has(stage.name)) continue;
    results.push({
      ...createSkippedResult(stage),
      error: reason,
    });
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
      const executionSession = withStageResults(session, results);
      const parallelResults = await executeParallelStages(host, parallelGroup, executionSession);
      let verificationHaltStage: StageName | null = null;
      for (let index = 0; index < parallelResults.length; index++) {
        const stage = parallelGroup[index];
        const rawResult = parallelResults[index];
        if (stage === undefined || rawResult === undefined) continue;

        const finalized = await finalizeStageResult(host, stage, executionSession, rawResult);
        results.push(finalized.result);
        if (finalized.result.status === 'completed' || finalized.result.status === 'degraded') {
          completedStages.add(finalized.result.name);
        }
        if (finalized.halt && verificationHaltStage === null) {
          verificationHaltStage = stage.name;
        }
      }
      await saveCheckpoint(host, session, results, [...completedStages]);

      if (verificationHaltStage !== null) {
        skipUnprocessedStages(
          stages,
          results,
          completedStages,
          `Skipped: verification gate failed after '${verificationHaltStage}'`
        );
        return results;
      }

      // Stop the pipeline if stopAfterStage was in the parallel group
      if (
        session.stopAfterStage !== undefined &&
        parallelGroup.some((s) => s.name === session.stopAfterStage)
      ) {
        skipUnprocessedStages(
          stages,
          results,
          completedStages,
          `Skipped: pipeline halted after '${session.stopAfterStage}'`
        );
        return results;
      }
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

      const executionSession = withStageResults(session, results);
      let result = await executeStageWithRetry(host, stage, executionSession);
      const finalized = await finalizeStageResult(host, stage, executionSession, result);
      result = finalized.result;
      results.push(result);

      if (result.status === 'completed' || result.status === 'degraded') {
        completedStages.add(stage.name);
      }

      await saveCheckpoint(host, session, results, [...completedStages]);

      if (finalized.halt) {
        skipUnprocessedStages(
          stages,
          results,
          completedStages,
          `Skipped: verification gate failed after '${stage.name}'`
        );
        return results;
      }

      // Stop the pipeline after this stage if stopAfterStage is set
      if (session.stopAfterStage !== undefined && stage.name === session.stopAfterStage) {
        skipUnprocessedStages(
          stages,
          results,
          completedStages,
          `Skipped: pipeline halted after '${session.stopAfterStage}'`
        );
        return results;
      }
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
