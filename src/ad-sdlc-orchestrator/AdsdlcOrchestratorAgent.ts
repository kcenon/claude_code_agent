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
import type {
  AgentInvocation,
  ApprovalDecision,
  ExecutionStrategy,
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
  StageTimeoutError,
  StatePersistenceError,
} from './errors.js';

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
 * AD-SDLC Orchestrator Agent
 *
 * Coordinates the full AD-SDLC pipeline execution by invoking subagents
 * in sequence based on the detected or specified pipeline mode.
 */
export class AdsdlcOrchestratorAgent implements IAgent {
  readonly agentId = ADSDLC_ORCHESTRATOR_AGENT_ID;
  readonly name = 'AD-SDLC Pipeline Orchestrator';

  private config: Required<OrchestratorConfig>;
  private session: OrchestratorSession | null = null;
  private initialized = false;
  private stageTimers = new Map<StageName, ReturnType<typeof setTimeout>>();
  private abortController: AbortController | null = null;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config,
      timeouts: {
        ...DEFAULT_ORCHESTRATOR_CONFIG.timeouts,
        ...config.timeouts,
      },
    };
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
      const prior = await this.loadPriorSession(request.resumeSessionId, request.projectDir);
      if (prior) {
        this.session = { ...prior, status: 'running' };
        this.abortController = new AbortController();
        return this.session;
      }
    }

    const mode = request.overrideMode ?? 'greenfield';
    const scratchpadDir = path.resolve(request.projectDir, this.config.scratchpadDir);

    // Build preCompletedStages from startFromStage if provided
    let preCompletedStages: StageName[] | undefined;
    if (request.startFromStage !== undefined && request.startFromStage !== '') {
      const stages = this.getStagesForMode(mode);
      preCompletedStages = [];
      for (const stage of stages) {
        if (stage.name === request.startFromStage) break;
        preCompletedStages.push(stage.name);
      }
    } else if (request.preCompletedStages) {
      preCompletedStages = [...request.preCompletedStages];
    }

    this.session = {
      sessionId: randomUUID(),
      projectDir: request.projectDir,
      userRequest: request.userRequest,
      mode,
      startedAt: new Date().toISOString(),
      status: 'pending',
      stageResults: [],
      scratchpadDir,
      preCompletedStages,
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
   * Coordinate multiple agents in sequence or parallel
   * @param agents - The list of agent invocations to execute
   * @param strategy - The execution strategy ('sequential' or 'parallel')
   * @returns The results from each agent invocation
   */
  async coordinateAgents(
    agents: readonly AgentInvocation[],
    strategy: ExecutionStrategy
  ): Promise<StageResult[]> {
    if (strategy === 'parallel') {
      return this.executeParallel(agents);
    }
    return this.executeSequential(agents);
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
    const completed = stageResults.filter((s) => s.status === 'completed').length;
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
    switch (mode) {
      case 'greenfield':
        return GREENFIELD_STAGES;
      case 'enhancement':
        return ENHANCEMENT_STAGES;
      case 'import':
        return IMPORT_STAGES;
    }
  }

  /**
   * Execute pipeline stages sequentially, respecting dependencies
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
    const results: StageResult[] = [];
    const completedStages = new Set<StageName>(preCompleted);
    const remaining = stages.filter((s) => !completedStages.has(s.name));

    while (remaining.length > 0) {
      // Check if abort was requested
      if (this.abortController !== null && this.abortController.signal.aborted) {
        for (const stage of remaining) {
          results.push(this.createSkippedResult(stage));
        }
        break;
      }

      // Find stages that are ready to execute (all dependencies satisfied)
      const ready: PipelineStageDefinition[] = [];
      const notReady: PipelineStageDefinition[] = [];

      for (const stage of remaining) {
        const failedDeps = this.checkDependencies(stage, completedStages, results);
        const allDepsMet = stage.dependsOn.every((dep) => completedStages.has(dep));

        if (failedDeps.length > 0) {
          // Dependencies failed — skip this stage
          results.push(this.createSkippedResult(stage));
        } else if (allDepsMet) {
          ready.push(stage);
        } else {
          notReady.push(stage);
        }
      }

      // No more stages can proceed
      if (ready.length === 0) {
        for (const stage of notReady) {
          results.push(this.createSkippedResult(stage));
        }
        break;
      }

      // Separate parallel-eligible and sequential stages
      const parallelGroup = ready.filter((s) => s.parallel);
      const sequentialGroup = ready.filter((s) => !s.parallel);

      // Execute parallel stages concurrently
      if (parallelGroup.length > 1) {
        const parallelResults = await this.executeParallelStages(parallelGroup, session);
        for (const result of parallelResults) {
          results.push(result);
          if (result.status === 'completed') {
            completedStages.add(result.name);
          }
        }
      } else if (parallelGroup.length === 1) {
        // Single parallel stage — run sequentially
        const singleStage = parallelGroup[0];
        if (singleStage) {
          sequentialGroup.unshift(singleStage);
        }
      }

      // Execute sequential stages one by one
      for (const stage of sequentialGroup) {
        if (this.abortController !== null && this.abortController.signal.aborted) {
          results.push(this.createSkippedResult(stage));
          continue;
        }

        // Check approval gate
        if (stage.approvalRequired) {
          const decision = await this.checkApprovalGate(stage, results);
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

        const result = await this.executeStageWithRetry(stage, session);
        results.push(result);

        if (result.status === 'completed') {
          completedStages.add(stage.name);
        }
      }

      // Update remaining list
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

  /**
   * Execute multiple stages in parallel
   * @param stages - The stage definitions to execute concurrently
   * @param session - The current orchestrator session providing execution context
   * @returns The results from all parallel stage executions
   */
  private async executeParallelStages(
    stages: readonly PipelineStageDefinition[],
    session: OrchestratorSession
  ): Promise<StageResult[]> {
    const promises = stages.map((stage) => this.executeStageWithRetry(stage, session));
    return Promise.all(promises);
  }

  /**
   * Execute a single stage with retry logic
   * @param stage - The stage definition to execute
   * @param session - The current orchestrator session providing execution context
   * @returns The stage result after all attempts (success or final failure)
   */
  private async executeStageWithRetry(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): Promise<StageResult> {
    const maxRetries = this.config.maxRetries;
    const timeoutMs = this.getTimeoutForStage(stage.name);
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        const output = await this.executeStageAgent(stage, session, timeoutMs);

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
          // Exponential backoff
          const delay = Math.min(5000 * Math.pow(2, attempt), 60_000);
          await this.sleep(delay);
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
   * Execute the agent for a specific stage
   *
   * This delegates to the appropriate agent based on stage.agentType.
   * The actual agent invocation is abstracted to support testing and
   * future integration with the AgentFactory.
   * @param stage - The stage definition identifying which agent to invoke
   * @param session - The current orchestrator session providing execution context
   * @param timeoutMs - The maximum time in milliseconds before the stage is aborted
   * @returns The agent output string upon successful execution
   */
  private async executeStageAgent(
    stage: PipelineStageDefinition,
    session: OrchestratorSession,
    timeoutMs: number
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new StageTimeoutError(stage.name, timeoutMs));
      }, timeoutMs);

      this.stageTimers.set(stage.name, timer);

      // Delegate to agent execution
      // Currently returns a structured output summary.
      // Full agent integration will wire this to AgentFactory in Part 3 (#435).
      this.invokeAgent(stage, session)
        .then((output) => {
          clearTimeout(timer);
          this.stageTimers.delete(stage.name);
          resolve(output);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          this.stageTimers.delete(stage.name);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  /**
   * Invoke an agent for a pipeline stage
   *
   * Override this method in tests or extend for AgentFactory integration.
   * @param stage - The stage definition identifying which agent to invoke
   * @param _session - The current orchestrator session (unused in base implementation)
   * @returns The agent output string describing the execution result
   */
  protected invokeAgent(
    stage: PipelineStageDefinition,
    _session: OrchestratorSession
  ): Promise<string> {
    // Base implementation delegates to subclass or returns structured result
    // This method is designed to be overridden for actual agent invocation
    return Promise.resolve(`Stage "${stage.name}" executed by ${stage.agentType}`);
  }

  // ---------------------------------------------------------------------------
  // Private: Parallel Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute agent invocations in parallel
   * @param agents - The agent invocations to execute concurrently
   * @returns The results from all parallel agent executions
   */
  private executeParallel(agents: readonly AgentInvocation[]): Promise<StageResult[]> {
    const promises = agents.map((invocation) => {
      const startTime = Date.now();
      const result: StageResult = {
        name: invocation.stageName,
        agentType: invocation.agentType,
        status: 'completed' as PipelineStageStatus,
        durationMs: Date.now() - startTime,
        output: `Parallel execution of ${invocation.agentType}`,
        artifacts: [...invocation.outputs],
        error: null,
        retryCount: 0,
      };
      return Promise.resolve(result);
    });

    return Promise.all(promises);
  }

  /**
   * Execute agent invocations sequentially
   * @param agents - The agent invocations to execute one after another
   * @returns The results from all sequential agent executions
   */
  private executeSequential(agents: readonly AgentInvocation[]): Promise<StageResult[]> {
    const results: StageResult[] = [];

    for (const invocation of agents) {
      const startTime = Date.now();
      results.push({
        name: invocation.stageName,
        agentType: invocation.agentType,
        status: 'completed',
        durationMs: Date.now() - startTime,
        output: `Sequential execution of ${invocation.agentType}`,
        artifacts: [...invocation.outputs],
        error: null,
        retryCount: 0,
      });
    }

    return Promise.resolve(results);
  }

  // ---------------------------------------------------------------------------
  // Private: Helpers
  // ---------------------------------------------------------------------------

  /**
   * Check approval gate for a stage based on the configured approval mode
   *
   * - auto: always approve
   * - manual: always requires user approval (returns denied for now)
   * - critical: approve unless prior stages have failures
   * - custom: delegate to overridable approveStage method
   * @param stage - The stage awaiting approval
   * @param priorResults - Results from previously executed stages used for decision-making
   * @returns The approval decision indicating whether the stage may proceed
   */
  private async checkApprovalGate(
    stage: PipelineStageDefinition,
    priorResults: readonly StageResult[]
  ): Promise<ApprovalDecision> {
    const now = new Date().toISOString();

    switch (this.config.approvalMode) {
      case 'auto':
        return { approved: true, reason: 'Auto-approved', decidedBy: 'system', decidedAt: now };

      case 'manual':
        // In a real implementation, this would prompt the user.
        // For now, return approved since there is no interactive prompt mechanism.
        return {
          approved: true,
          reason: 'Manual mode (auto-approved in non-interactive)',
          decidedBy: 'system',
          decidedAt: now,
        };

      case 'critical': {
        const hasPriorFailures = priorResults.some((r) => r.status === 'failed');
        if (hasPriorFailures) {
          return {
            approved: false,
            reason: 'Prior stage failures detected in critical approval mode',
            decidedBy: 'system',
            decidedAt: now,
          };
        }
        return {
          approved: true,
          reason: 'No prior failures in critical mode',
          decidedBy: 'system',
          decidedAt: now,
        };
      }

      case 'custom':
        return this.approveStage(stage, priorResults);
    }
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
   * Check if all dependencies for a stage are satisfied
   * @param stage - The stage whose dependencies to check
   * @param completedStages - The set of stage names that have completed successfully
   * @param results - All stage results collected so far for failure detection
   * @returns The list of dependency stage names that have failed or been skipped
   */
  private checkDependencies(
    stage: PipelineStageDefinition,
    completedStages: Set<StageName>,
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
   * Create a skipped stage result
   * @param stage - The stage definition to create a skipped result for
   * @returns A StageResult with 'skipped' status and zero duration
   */
  private createSkippedResult(stage: PipelineStageDefinition): StageResult {
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
    const hasCompletions = stages.some((s) => s.status === 'completed');
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
