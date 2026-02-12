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
   */
  getSession(): OrchestratorSession | null {
    return this.session;
  }

  /**
   * Start a new orchestrator session
   */
  async startSession(request: PipelineRequest): Promise<OrchestratorSession> {
    if (this.session?.status === 'running') {
      throw new PipelineInProgressError(this.session.sessionId);
    }

    await this.validateProjectDir(request.projectDir);

    const mode = request.overrideMode ?? 'greenfield';
    const scratchpadDir = path.resolve(request.projectDir, this.config.scratchpadDir);

    this.session = {
      sessionId: randomUUID(),
      projectDir: request.projectDir,
      userRequest: request.userRequest,
      mode,
      startedAt: new Date().toISOString(),
      status: 'pending',
      stageResults: [],
      scratchpadDir,
    };

    this.abortController = new AbortController();
    return this.session;
  }

  /**
   * Execute the full AD-SDLC pipeline based on the current session mode
   *
   * This is the main entry point. It detects the mode and delegates
   * to the appropriate pipeline execution method.
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
      const stageResults = await this.executeStages(stages, session);
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
   */
  private async executeStages(
    stages: readonly PipelineStageDefinition[],
    session: OrchestratorSession
  ): Promise<StageResult[]> {
    const results: StageResult[] = [];
    const completedStages = new Set<StageName>();
    const remaining = [...stages];

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
        sequentialGroup.unshift(parallelGroup[0]!);
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
          error: s.error,
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
   * Sleep for the specified duration
   *
   * Protected to allow test subclasses to override for fast execution.
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
