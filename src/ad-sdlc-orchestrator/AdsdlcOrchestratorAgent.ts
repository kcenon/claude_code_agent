/**
 * AD-SDLC Orchestrator Agent
 *
 * Top-level pipeline orchestrator that coordinates the entire AD-SDLC workflow.
 * Delegates to specialized agents based on detected project mode (Greenfield,
 * Enhancement, Import). Implements SDS-001 CMP-025.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { IAgent } from '../agents/types.js';
import {
  buildHookPipeline,
  type ArtifactCaptureEntry,
  type ArtifactSink,
  type ExecutionAdapter,
  type StageExecutionRequest,
  type StageExecutionResult,
} from '../execution/index.js';
import { SdkExecutionAdapter } from '../execution/index.js';
import { getLogger } from '../logging/index.js';
import { ENV_USE_SDK_FOR_WORKER } from '../config/featureFlags.js';
import { PipelineCheckpointManager } from './PipelineCheckpointManager.js';
import type {
  ApprovalDecision,
  CheckpointConfig,
  OrchestratorConfig,
  OrchestratorSession,
  PipelineMode,
  PipelineMonitorSnapshot,
  PipelineRequest,
  PipelineResult,
  PipelineStageDefinition,
  PipelineStageStatus,
  PipelineStatus,
  StageName,
  StageResult,
  StageSummary,
} from './types.js';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
} from './types.js';
import {
  InvalidProjectDirError,
  PipelineFailedError,
  PipelineInProgressError,
  SessionCorruptedError,
  StatePersistenceError,
} from './errors.js';
import { ArtifactValidator } from './ArtifactValidator.js';
import { checkApprovalGate as evaluateApprovalGate } from './ApprovalGate.js';
import { runStages as schedulerRunStages, type SchedulerHost } from './StageScheduler.js';

// YAML parser (dynamically loaded)
let yaml: { dump: (obj: unknown) => string; load: (str: string) => unknown } | null = null;

async function loadYaml(): Promise<void> {
  if (yaml === null) {
    const jsYaml = await import('js-yaml');
    yaml = { dump: jsYaml.dump, load: jsYaml.load };
  }
}

/**
 * Agent identifier constant
 */
export const ADSDLC_ORCHESTRATOR_AGENT_ID = 'ad-sdlc-orchestrator-agent';

/**
 * Re-export of the worker-pilot env flag (#793). Kept as an alias of
 * {@link ENV_USE_SDK_FOR_WORKER} so existing imports keep compiling
 * after the AD-13 cutover (#797) removed the orchestrator's dependency
 * on the flag.
 */
export const WORKER_PILOT_ENV_FLAG = ENV_USE_SDK_FOR_WORKER;

/**
 * AD-SDLC Orchestrator Agent. Coordinates the full pipeline by invoking
 * subagents in sequence based on the detected pipeline mode. After the
 * AD-13 cutover (#797) every stage routes through {@link ExecutionAdapter};
 * tests that previously stubbed the bridge path should override
 * {@link invokeAgent} or {@link executeViaAdapter} instead.
 */
export class AdsdlcOrchestratorAgent implements IAgent {
  readonly agentId = ADSDLC_ORCHESTRATOR_AGENT_ID;
  readonly name = 'AD-SDLC Pipeline Orchestrator';

  private config: Required<OrchestratorConfig>;
  private session: OrchestratorSession | null = null;
  private initialized = false;
  private stageTimers = new Map<StageName, ReturnType<typeof setTimeout>>();
  private abortController: AbortController | null = null;
  private readonly checkpointManager: PipelineCheckpointManager | null;
  /**
   * One-shot SDK session id used to resume the FIRST stage of a session
   * recovered from a v2 checkpoint. Cleared on consumption so subsequent
   * stages run as fresh SDK sessions (each stage is a different agent).
   */
  private pendingResumeSdkSessionId: string | undefined = undefined;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config,
      timeouts: {
        ...DEFAULT_ORCHESTRATOR_CONFIG.timeouts,
        ...config.timeouts,
      },
    };
    const ckptConfig: CheckpointConfig = this.config.checkpoint;
    this.checkpointManager = ckptConfig.enabled ? new PipelineCheckpointManager(ckptConfig) : null;
  }

  /**
   * Initialize the orchestrator agent
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await loadYaml();
    this.initialized = true;
  }

  /**
   * Dispose of the orchestrator and release resources
   * @returns A promise that resolves when all resources are released
   */
  dispose(): Promise<void> {
    for (const timer of this.stageTimers.values()) {
      clearTimeout(timer);
    }
    this.stageTimers.clear();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.session = null;
    this.initialized = false;
    return Promise.resolve();
  }

  /**
   * Get the current active session
   * @returns The active orchestrator session, or null if none exists
   */
  getSession(): OrchestratorSession | null {
    return this.session;
  }

  /**
   * Start a new orchestrator session
   * @param request - The pipeline request containing project directory and user intent
   * @returns The newly created orchestrator session
   */
  async startSession(request: PipelineRequest): Promise<OrchestratorSession> {
    if (this.session?.status === 'running') {
      throw new PipelineInProgressError(this.session.sessionId);
    }

    await this.validateProjectDir(request.projectDir);

    // Resume from prior session if requested
    if (request.resumeSessionId !== undefined && request.resumeSessionId !== '') {
      // Try checkpoint-based resume first (more recent than session YAML)
      if (this.checkpointManager !== null && this.checkpointManager.isEnabled()) {
        const scratchpadDir = path.resolve(request.projectDir, this.config.scratchpadDir);
        const checkpoint = await this.checkpointManager.loadLatestCheckpoint(
          request.resumeSessionId,
          scratchpadDir
        );
        if (checkpoint && checkpoint.completedStageNames.length > 0) {
          getLogger().info('Resuming from pipeline checkpoint', {
            agent: 'AdsdlcOrchestratorAgent',
            sessionId: request.resumeSessionId,
            completedStages: checkpoint.completedStageNames.length,
            hasSdkSession: checkpoint.sdkSessionId !== undefined,
          });
          // Feed checkpoint's completed stages into the existing resume path
          // by overriding preCompletedStages after loadPriorSession resolves
          const prior = await this.loadPriorSession(request.resumeSessionId, request.projectDir);
          if (prior) {
            this.session = {
              ...prior,
              status: 'running',
              localMode: request.localMode ?? prior.localMode,
              preCompletedStages: checkpoint.completedStageNames,
              stageResults: checkpoint.completedStageResults,
              ...(checkpoint.sdkSessionId !== undefined && checkpoint.sdkSessionId !== ''
                ? { resumeSdkSessionId: checkpoint.sdkSessionId }
                : {}),
            };
            this.pendingResumeSdkSessionId =
              checkpoint.sdkSessionId !== undefined && checkpoint.sdkSessionId !== ''
                ? checkpoint.sdkSessionId
                : undefined;
            this.abortController = new AbortController();
            return this.session;
          }
        }
      }

      const prior = await this.loadPriorSession(request.resumeSessionId, request.projectDir);
      if (prior) {
        this.session = {
          ...prior,
          status: 'running',
          localMode: request.localMode ?? prior.localMode,
        };
        // No checkpoint => no SDK session id to resume from.
        this.pendingResumeSdkSessionId = undefined;
        this.abortController = new AbortController();
        return this.session;
      }
    }

    // Cold-start session: ensure no stale resume id leaks across runs.
    this.pendingResumeSdkSessionId = undefined;

    const mode = request.overrideMode ?? 'greenfield';
    const scratchpadDir = path.resolve(request.projectDir, this.config.scratchpadDir);

    // Build preCompletedStages from startFromStage if provided
    let preCompletedStages: StageName[] | null = null;
    if (request.startFromStage !== undefined) {
      const stages = this.getStagesForMode(mode);
      preCompletedStages = [];
      for (const stage of stages) {
        if (stage.name === request.startFromStage) break;
        preCompletedStages.push(stage.name);
      }
    } else if (request.preCompletedStages) {
      preCompletedStages = [...request.preCompletedStages];
    }

    const localMode = request.localMode ?? this.config.localMode;

    this.session = {
      sessionId: randomUUID(),
      projectDir: request.projectDir,
      userRequest: request.userRequest,
      mode,
      startedAt: new Date().toISOString(),
      status: 'pending',
      stageResults: [],
      scratchpadDir,
      localMode,
      ...(preCompletedStages !== null ? { preCompletedStages } : {}),
    };

    this.abortController = new AbortController();
    return this.session;
  }

  /**
   * Execute the full AD-SDLC pipeline based on the current session mode
   *
   * This is the main entry point. It detects the mode and delegates
   * to the appropriate pipeline execution method.
   * @param projectDir - The root directory of the target project
   * @param userRequest - The user's natural language request describing the desired outcome
   * @returns The pipeline execution result including stage outcomes and artifacts
   */
  async executePipeline(projectDir: string, userRequest: string): Promise<PipelineResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const session =
      this.session ??
      (await this.startSession({
        projectDir,
        userRequest,
      }));

    const startTime = Date.now();
    this.session = { ...session, status: 'running' };

    try {
      const stages = this.getStagesForMode(session.mode);

      // Build pre-completed set from session state
      const preCompleted = new Set<StageName>();
      if (session.preCompletedStages) {
        for (const name of session.preCompletedStages) {
          preCompleted.add(name);
        }
      }

      // Validate artifacts for pre-completed stages (graceful degradation)
      if (preCompleted.size > 0) {
        const validator = this.createArtifactValidator(session.projectDir);
        const validations = await validator.validatePreCompletedStages(preCompleted, session.mode);
        const invalid = validations.filter((v) => !v.valid);
        for (const v of invalid) {
          preCompleted.delete(v.stage);
        }
      }

      // Collect prior results for final aggregation
      const priorResults: StageResult[] =
        preCompleted.size > 0
          ? session.stageResults.filter((r) => r.status === 'completed' && preCompleted.has(r.name))
          : [];

      const newResults = await this.executeStages(stages, session, preCompleted);

      // Merge prior + new results
      const stageResults = [...priorResults, ...newResults];
      const failedStages = stageResults.filter((s) => s.status === 'failed');
      const overallStatus = this.determineOverallStatus(stageResults);

      // Add warnings for partial completion (graceful degradation)
      const warnings: string[] = [];
      if (overallStatus === 'partial') {
        warnings.push(
          `Pipeline completed partially: ${String(failedStages.length)} stage(s) failed, ` +
            `${String(stageResults.filter((s) => s.status === 'completed').length)} completed`
        );
      }

      const result: PipelineResult = {
        pipelineId: session.sessionId,
        projectId: path.basename(session.projectDir),
        mode: session.mode,
        stages: stageResults,
        overallStatus,
        durationMs: Date.now() - startTime,
        artifacts: stageResults.flatMap((s) => s.artifacts),
        warnings,
      };

      this.session = { ...this.session, status: overallStatus, stageResults };

      await this.persistState(session, result);

      // Clean up checkpoints after successful persistence
      if (this.checkpointManager !== null && this.checkpointManager.isEnabled()) {
        try {
          await this.checkpointManager.deleteSessionCheckpoints(
            session.sessionId,
            session.scratchpadDir
          );
        } catch {
          // Best-effort cleanup
        }
      }

      if (overallStatus === 'failed') {
        throw new PipelineFailedError(
          session.sessionId,
          session.mode,
          failedStages.map((s) => s.name)
        );
      }

      return result;
    } catch (error) {
      if (error instanceof PipelineFailedError) {
        throw error;
      }
      this.session = { ...this.session, status: 'failed' };
      throw error;
    }
  }

  /**
   * Get the current pipeline status for monitoring
   * @returns The current pipeline status and completed stage results
   */
  getStatus(): { status: PipelineStatus; stages: readonly StageResult[] } {
    if (!this.session) {
      return { status: 'pending', stages: [] };
    }
    return {
      status: this.session.status,
      stages: this.session.stageResults,
    };
  }

  /**
   * Get a monitoring snapshot of the current pipeline execution
   * @returns A snapshot of pipeline progress including stage counts and summaries
   */
  monitorPipeline(): PipelineMonitorSnapshot {
    if (!this.session) {
      return {
        sessionId: '',
        mode: 'greenfield',
        status: 'pending',
        totalStages: 0,
        completedStages: 0,
        failedStages: 0,
        skippedStages: 0,
        currentStage: null,
        elapsedMs: 0,
        stageSummaries: [],
      };
    }

    const stageResults = this.session.stageResults;
    const completed = stageResults.filter(
      (s) => s.status === 'completed' || s.status === 'degraded'
    ).length;
    const failed = stageResults.filter((s) => s.status === 'failed').length;
    const skipped = stageResults.filter((s) => s.status === 'skipped').length;
    const running = stageResults.find((s) => s.status === ('running' as PipelineStageStatus));
    const stages = this.getStagesForMode(this.session.mode);

    const stageSummaries: StageSummary[] = stageResults.map((s) => ({
      name: s.name,
      status: s.status,
      durationMs: s.durationMs,
      retryCount: s.retryCount,
    }));

    return {
      sessionId: this.session.sessionId,
      mode: this.session.mode,
      status: this.session.status,
      totalStages: stages.length,
      completedStages: completed,
      failedStages: failed,
      skippedStages: skipped,
      currentStage: running?.name ?? null,
      elapsedMs: Date.now() - new Date(this.session.startedAt).getTime(),
      stageSummaries,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Stage Execution
  // ---------------------------------------------------------------------------

  /**
   * Get stage definitions for the given pipeline mode
   * @param mode - The pipeline mode (greenfield, enhancement, or import)
   * @returns The ordered list of stage definitions for the specified mode
   */
  private getStagesForMode(mode: PipelineMode): readonly PipelineStageDefinition[] {
    let stages: readonly PipelineStageDefinition[];
    switch (mode) {
      case 'greenfield':
        stages = GREENFIELD_STAGES;
        break;
      case 'enhancement':
        stages = ENHANCEMENT_STAGES;
        break;
      case 'import':
        stages = IMPORT_STAGES;
        break;
    }

    return this.session?.localMode === true ? this.adaptStagesForLocalMode(stages) : stages;
  }

  /**
   * Adapt pipeline stages for local mode (no GitHub dependency).
   *
   * - Removes github_repo_setup stage entirely
   * - Replaces pr-reviewer with local-reviewer
   * - Replaces issue-reader with local-issue-reader
   * - Rewires dependencies that pointed to removed stages
   * @param stages
   */
  private adaptStagesForLocalMode(
    stages: readonly PipelineStageDefinition[]
  ): PipelineStageDefinition[] {
    return stages
      .filter((s) => s.name !== 'github_repo_setup')
      .map((s) => {
        // Rewire dependencies from github_repo_setup to repo_detection
        const filtered = s.dependsOn.filter((d) => d !== 'github_repo_setup');
        const needsRewire =
          s.dependsOn.includes('github_repo_setup') && !s.dependsOn.includes('repo_detection');
        const dependsOn = (
          needsRewire ? [...filtered, 'repo_detection'] : [...filtered]
        ) as typeof s.dependsOn;

        // Substitute GitHub-dependent agent types with local alternatives
        let { agentType } = s;
        if (agentType === 'pr-reviewer') agentType = 'local-reviewer';
        if (agentType === 'issue-reader') agentType = 'local-issue-reader';

        return { ...s, agentType, dependsOn };
      });
  }

  /**
   * Execute pipeline stages, honouring dependencies, parallelism,
   * approvals, retries, content-quality validation, and checkpoint
   * persistence. Thin delegate to {@link schedulerRunStages}
   * (`StageScheduler.ts`); this class supplies the {@link SchedulerHost}
   * facade so the scheduler can call back into private helpers.
   *
   * @param stages - The stage definitions to execute in dependency order
   * @param session - The current orchestrator session providing execution context
   * @param preCompleted - Optional set of stage names to treat as already completed
   * @returns The results from all executed, skipped, or failed stages
   */
  private async executeStages(
    stages: readonly PipelineStageDefinition[],
    session: OrchestratorSession,
    preCompleted?: ReadonlySet<StageName>
  ): Promise<StageResult[]> {
    return schedulerRunStages(this.schedulerHost(), stages, session, preCompleted);
  }

  /**
   * Build the {@link SchedulerHost} facade exposing the orchestrator's
   * private helpers to the {@link schedulerRunStages} loop. Constructed
   * lazily per call so abort-controller swaps and config tweaks are
   * picked up without caching stale references.
   */
  private schedulerHost(): SchedulerHost {
    return {
      abortController: this.abortController,
      stageTimers: this.stageTimers,
      maxRetries: this.config.maxRetries,
      checkpointManager: this.checkpointManager,
      getTimeoutForStage: (name) => this.getTimeoutForStage(name),
      createArtifactValidator: (projectDir) => this.createArtifactValidator(projectDir),
      invokeAgent: (stage, session) => this.invokeAgent(stage, session),
      checkApprovalGate: (stage, prior) => this.checkApprovalGate(stage, prior),
      sleep: (ms) => this.sleep(ms),
    };
  }

  /**
   * Invoke an agent for a pipeline stage. Every stage routes through
   * {@link executeViaAdapter} after the AD-13 cutover (#797) — the
   * legacy bridge path was removed in #799. Override this method (or
   * {@link executeViaAdapter} itself) in tests to bypass real agent
   * execution.
   * @param stage
   * @param session
   */
  protected async invokeAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    return this.executeViaAdapter(stage, session);
  }

  /**
   * Execute a stage through the {@link ExecutionAdapter} (SDK path).
   * Builds a {@link StageExecutionRequest} from the session, runs it,
   * and returns the JSON-serialised summary so the orchestrator's
   * string-based stage output contract is preserved.
   *
   * @param stage
   * @param session
   * @throws Error when the adapter reports a non-success status.
   */
  protected async executeViaAdapter(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<string> {
    const adapter = this.createExecutionAdapter(session);
    try {
      const request = this.buildStageExecutionRequest(stage, session);
      const result = await adapter.execute(request);
      return this.toStageOutput(stage, result);
    } finally {
      await adapter.dispose().catch((error: unknown) => {
        getLogger().debug('ExecutionAdapter dispose failed', {
          agent: 'AdsdlcOrchestratorAgent',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  /**
   * Construct the {@link ExecutionAdapter} used by {@link executeViaAdapter}.
   * Returns an {@link SdkExecutionAdapter} wired with the AD-07 hook
   * pipeline that funnels `Edit`/`Write` artifacts into a session-scoped
   * {@link ArtifactSink}. Tests override this method to inject a mock.
   * @param session
   */
  protected createExecutionAdapter(session: OrchestratorSession): ExecutionAdapter {
    const sink: ArtifactSink = {
      recordArtifact: (entry: ArtifactCaptureEntry): void => {
        getLogger().debug('Adapter captured artifact', {
          agent: 'AdsdlcOrchestratorAgent',
          sessionId: session.sessionId,
          filePath: entry.filePath,
          toolName: entry.toolName,
          capturedAt: entry.capturedAt,
        });
      },
    };
    const hooks = buildHookPipeline(sink);
    return new SdkExecutionAdapter({ hooks });
  }

  /**
   * Translate orchestrator state into a {@link StageExecutionRequest}.
   * Maps `session.userRequest` to `workOrder` and accumulated completed
   * stage outputs to `priorOutputs`. The system prompt is sourced by
   * the SDK from `.claude/agents/<agentType>.md`.
   * @param stage
   * @param session
   */
  protected buildStageExecutionRequest(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): StageExecutionRequest {
    const priorOutputs: Record<string, string> = {};
    for (const result of session.stageResults) {
      if (result.status === 'completed' && result.output) {
        priorOutputs[result.name] = result.output;
      }
    }

    // Consume the one-shot resume id: only the FIRST stage executed in
    // a checkpoint-resumed session forwards `resume: sessionId` to the
    // SDK. Subsequent stages run as fresh sessions because each stage
    // is a different agent persona.
    let resumeId: string | undefined;
    if (this.pendingResumeSdkSessionId !== undefined && this.pendingResumeSdkSessionId !== '') {
      resumeId = this.pendingResumeSdkSessionId;
      this.pendingResumeSdkSessionId = undefined;
      getLogger().info('Resuming stage with SDK session id', {
        agent: 'AdsdlcOrchestratorAgent',
        stage: stage.name,
        sdkSessionId: resumeId,
      });
    }

    const request: StageExecutionRequest = {
      agentType: stage.agentType,
      workOrder: session.userRequest,
      priorOutputs,
      ...(resumeId !== undefined ? { resume: resumeId } : {}),
      ...(this.abortController !== null ? { signal: this.abortController.signal } : {}),
    };
    return request;
  }

  /**
   * Convert a {@link StageExecutionResult} into the string output the
   * orchestrator's stage contract expects. Non-success statuses become
   * thrown errors so the scheduler's retry / failure handling kicks in.
   *
   * @param stage
   * @param result
   * @throws Error when `result.status !== 'success'`.
   */
  protected toStageOutput(stage: PipelineStageDefinition, result: StageExecutionResult): string {
    if (result.status !== 'success') {
      const message = result.error?.message ?? `ExecutionAdapter status=${result.status}`;
      throw new Error(`ExecutionAdapter failed: ${message}`);
    }
    return JSON.stringify({
      stage: stage.name,
      via: 'execution-adapter',
      sessionId: result.sessionId,
      toolCallCount: result.toolCallCount,
      tokenUsage: result.tokenUsage,
      artifacts: result.artifacts.map((a) => ({
        path: a.path,
        ...(a.description !== undefined ? { description: a.description } : {}),
      })),
    });
  }

  // ---------------------------------------------------------------------------
  // Private: Helpers
  // ---------------------------------------------------------------------------

  /**
   * Evaluate the approval gate for a stage. Thin delegate to
   * {@link evaluateApprovalGate} (`ApprovalGate.ts`) — the actual
   * mode-specific logic lives in that module so this class stays focused
   * on pipeline coordination.
   *
   * @param stage - The stage awaiting approval
   * @param priorResults - Results from previously executed stages used for decision-making
   * @returns The approval decision indicating whether the stage may proceed
   */
  private async checkApprovalGate(
    stage: PipelineStageDefinition,
    priorResults: readonly StageResult[]
  ): Promise<ApprovalDecision> {
    return evaluateApprovalGate(this.config.approvalMode, stage, priorResults, (s, prior) =>
      this.approveStage(s, prior)
    );
  }

  /**
   * Custom approval logic for 'custom' approval mode.
   *
   * Override this method to implement project-specific approval logic.
   * @param _stage - The stage awaiting approval (unused in default implementation)
   * @param _priorResults - Results from previously executed stages (unused in default implementation)
   * @returns The approval decision (default: always approved)
   */
  protected approveStage(
    _stage: PipelineStageDefinition,
    _priorResults: readonly StageResult[]
  ): Promise<ApprovalDecision> {
    return Promise.resolve({
      approved: true,
      reason: 'Custom approval (default: approved)',
      decidedBy: 'system',
      decidedAt: new Date().toISOString(),
    });
  }

  /**
   * Create an ArtifactValidator for the given project directory.
   *
   * Override this method in tests to provide a no-op or mock validator.
   * @param projectDir - The project root directory to validate artifacts against
   * @returns A new ArtifactValidator instance
   */
  protected createArtifactValidator(projectDir: string): ArtifactValidator {
    return new ArtifactValidator(projectDir);
  }

  /**
   * Validate that a project directory exists and is accessible
   * @param dir - The filesystem path to validate as a project directory
   */
  private async validateProjectDir(dir: string): Promise<void> {
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        throw new InvalidProjectDirError(dir, 'Path is not a directory');
      }
    } catch (error) {
      if (error instanceof InvalidProjectDirError) throw error;
      throw new InvalidProjectDirError(
        dir,
        error instanceof Error ? error.message : 'Cannot access directory'
      );
    }
  }

  /**
   * Determine overall pipeline status from stage results.
   *
   * Uses graceful degradation: if some stages fail but others succeed,
   * the pipeline reports 'partial' instead of 'failed', allowing
   * downstream consumers to inspect individual stage results.
   * @param stages - The stage results to evaluate for overall status
   * @returns The aggregated pipeline status ('completed', 'partial', or 'failed')
   */
  private determineOverallStatus(stages: readonly StageResult[]): PipelineStatus {
    if (stages.length === 0) return 'completed';

    const hasFailures = stages.some((s) => s.status === 'failed');
    const hasCompletions = stages.some((s) => s.status === 'completed' || s.status === 'degraded');
    const allSkipped = stages.every((s) => s.status === 'skipped');

    if (allSkipped) return 'failed';
    if (hasFailures && hasCompletions) return 'partial';
    if (hasFailures) return 'failed';
    return 'completed';
  }

  /**
   * Get the timeout for a specific stage
   * @param stageName - The name of the stage to look up the timeout for
   * @returns The timeout in milliseconds, using stage override or default
   */
  private getTimeoutForStage(stageName: StageName): number {
    const overrides = this.config.timeouts.overrides;
    if (overrides && stageName in overrides) {
      return overrides[stageName] ?? this.config.timeouts.default;
    }
    return this.config.timeouts.default;
  }

  /**
   * Persist pipeline state to the scratchpad directory
   * @param session - The orchestrator session containing scratchpad path and session ID
   * @param result - The pipeline result to serialize and persist as YAML
   */
  private async persistState(session: OrchestratorSession, result: PipelineResult): Promise<void> {
    if (!yaml) return;

    try {
      const stateDir = path.join(session.scratchpadDir, 'pipeline');
      await fs.mkdir(stateDir, { recursive: true });

      const statePath = path.join(stateDir, `${session.sessionId}.yaml`);
      const content = yaml.dump({
        pipelineId: result.pipelineId,
        projectId: result.projectId,
        projectDir: session.projectDir,
        userRequest: session.userRequest,
        startedAt: session.startedAt,
        mode: result.mode,
        overallStatus: result.overallStatus,
        durationMs: result.durationMs,
        stageCount: result.stages.length,
        completedStages: result.stages.filter((s) => s.status === 'completed').length,
        failedStages: result.stages.filter((s) => s.status === 'failed').length,
        artifacts: result.artifacts,
        stages: result.stages.map((s) => ({
          name: s.name,
          agentType: s.agentType,
          status: s.status,
          durationMs: s.durationMs,
          output: s.output,
          artifacts: s.artifacts,
          error: s.error,
          retryCount: s.retryCount,
        })),
      });

      await fs.writeFile(statePath, content, 'utf-8');
    } catch (error) {
      throw new StatePersistenceError(
        session.scratchpadDir,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Load a prior session from persisted YAML state
   * @param sessionId - The session ID to load
   * @param projectDir - The project root directory for resolving scratchpad path
   * @returns The reconstructed session, or null if not found
   */
  async loadPriorSession(
    sessionId: string,
    projectDir: string
  ): Promise<OrchestratorSession | null> {
    if (!yaml) {
      await loadYaml();
    }

    const stateDir = path.join(path.resolve(projectDir, this.config.scratchpadDir), 'pipeline');
    const statePath = path.join(stateDir, `${sessionId}.yaml`);

    let content: string;
    try {
      content = await fs.readFile(statePath, 'utf-8');
    } catch {
      return null;
    }

    let data: Record<string, unknown>;
    try {
      if (yaml === null) {
        throw new SessionCorruptedError(sessionId, 'YAML parser not loaded');
      }
      const parsed = yaml.load(content);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new SessionCorruptedError(sessionId, 'YAML did not parse to an object');
      }
      data = parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof SessionCorruptedError) throw error;
      throw new SessionCorruptedError(
        sessionId,
        error instanceof Error ? error.message : 'Failed to parse YAML'
      );
    }

    if (typeof data['mode'] !== 'string') {
      throw new SessionCorruptedError(sessionId, 'Missing or invalid "mode" field');
    }

    const stages = Array.isArray(data['stages']) ? data['stages'] : [];
    const stageResults: StageResult[] = stages.map((s: Record<string, unknown>) => ({
      name: (s['name'] ?? '') as StageName,
      agentType: (s['agentType'] ?? '') as string,
      status: (s['status'] ?? 'failed') as PipelineStageStatus,
      durationMs: (s['durationMs'] ?? 0) as number,
      output: (s['output'] ?? '') as string,
      artifacts: Array.isArray(s['artifacts']) ? (s['artifacts'] as string[]) : [],
      error: (s['error'] ?? null) as string | null,
      retryCount: (s['retryCount'] ?? 0) as number,
    }));

    const completedStageNames = stageResults
      .filter((s) => s.status === 'completed')
      .map((s) => s.name);

    return {
      sessionId: (data['pipelineId'] ?? sessionId) as string,
      projectDir: (data['projectDir'] ?? projectDir) as string,
      userRequest: (data['userRequest'] ?? '') as string,
      mode: data['mode'] as PipelineMode,
      startedAt: (data['startedAt'] ?? new Date().toISOString()) as string,
      status: (data['overallStatus'] ?? 'partial') as PipelineStatus,
      stageResults,
      scratchpadDir: path.resolve(projectDir, this.config.scratchpadDir),
      localMode: (data['localMode'] as boolean | undefined) ?? false,
      resumedFrom: sessionId,
      preCompletedStages: completedStageNames,
    };
  }

  /**
   * Find the most recent session for a project directory
   * @param projectDir - The project root directory
   * @returns The most recent session ID, or null if none found
   */
  async findLatestSession(projectDir: string): Promise<string | null> {
    if (!yaml) {
      await loadYaml();
    }

    const stateDir = path.join(path.resolve(projectDir, this.config.scratchpadDir), 'pipeline');

    let files: string[];
    try {
      files = await fs.readdir(stateDir);
    } catch {
      return null;
    }

    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));
    if (yamlFiles.length === 0) return null;

    // Find the most recently modified YAML file
    let latestFile: string | null = null;
    let latestMtime = 0;

    for (const file of yamlFiles) {
      try {
        const stat = await fs.stat(path.join(stateDir, file));
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs;
          latestFile = file;
        }
      } catch {
        continue;
      }
    }

    if (latestFile === null) return null;
    return latestFile.replace(/\.yaml$/, '');
  }

  /**
   * Sleep for the specified duration
   *
   * Protected to allow test subclasses to override for fast execution.
   * @param ms - The number of milliseconds to sleep
   * @returns A promise that resolves after the specified delay
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let agentInstance: AdsdlcOrchestratorAgent | null = null;

/**
 * Get or create the singleton AD-SDLC Orchestrator Agent instance
 * @param config - Optional configuration to use when creating a new instance
 * @returns The singleton orchestrator agent instance
 */
export function getAdsdlcOrchestratorAgent(config?: OrchestratorConfig): AdsdlcOrchestratorAgent {
  if (agentInstance === null) {
    agentInstance = new AdsdlcOrchestratorAgent(config);
  }
  return agentInstance;
}

/**
 * Reset the singleton AD-SDLC Orchestrator Agent instance
 */
export function resetAdsdlcOrchestratorAgent(): void {
  if (agentInstance !== null) {
    void agentInstance.dispose();
    agentInstance = null;
  }
}
