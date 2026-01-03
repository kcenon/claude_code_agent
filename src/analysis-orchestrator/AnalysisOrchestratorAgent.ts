/**
 * Analysis Orchestrator Agent
 *
 * Coordinates the complete analysis pipeline from user input to issue generation.
 * Manages Document Reader, Code Reader, Comparator, and Issue Generator agents
 * to produce comprehensive project analysis.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  AnalysisInput,
  AnalysisOrchestratorConfig,
  AnalysisReport,
  AnalysisRecommendation,
  AnalysisResult,
  AnalysisResultStatus,
  AnalysisScope,
  AnalysisSession,
  CircuitBreakerConfig,
  CodeAnalysisSummary,
  ComparisonSummary,
  DocumentAnalysisSummary,
  IssuesSummary,
  ParallelExecutionConfig,
  ParallelExecutionResult,
  ParallelStageResult,
  PipelineStage,
  PipelineStageName,
  PipelineState,
  PipelineStatistics,
  PipelineStatus,
  StageResult,
  StageTimeoutConfig,
} from './types.js';
import {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_PARALLEL_EXECUTION_CONFIG,
  DEFAULT_STAGE_TIMEOUTS,
} from './types.js';
import {
  AnalysisInProgressError,
  AnalysisNotFoundError,
  CircuitOpenError,
  InvalidProjectPathError,
  NoActiveSessionError,
  OutputWriteError,
  PipelineFailedError,
  StageDependencyError,
  StageExecutionError,
  StageTimeoutError,
  StateReadError,
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
 * Safely converts an unknown value to a string.
 * Returns empty string for objects to avoid [object Object] output.
 */
function toSafeString(value: unknown, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return defaultValue;
}

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Stage Circuit Breaker for managing stage failure states
 *
 * Implements the circuit breaker pattern to prevent repeated calls
 * to failing stages and allow recovery time.
 */
class StageCircuitBreaker {
  private readonly failures = new Map<PipelineStageName, number>();
  private readonly openUntil = new Map<PipelineStageName, number>();
  private readonly lastSuccess = new Map<PipelineStageName, number>();
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config?: CircuitBreakerConfig) {
    this.config = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...config,
    };
  }

  /**
   * Record a failure for a stage
   */
  recordFailure(stageName: PipelineStageName): void {
    if (!this.config.enabled) return;

    const count = (this.failures.get(stageName) ?? 0) + 1;
    this.failures.set(stageName, count);

    if (count >= this.config.failureThreshold) {
      this.openUntil.set(stageName, Date.now() + this.config.resetTimeoutMs);
    }
  }

  /**
   * Record a success for a stage (resets failure count)
   */
  recordSuccess(stageName: PipelineStageName): void {
    if (!this.config.enabled) return;

    this.failures.delete(stageName);
    this.openUntil.delete(stageName);
    this.lastSuccess.set(stageName, Date.now());
  }

  /**
   * Check if the circuit is open for a stage
   */
  isOpen(stageName: PipelineStageName): boolean {
    if (!this.config.enabled) return false;

    const openTime = this.openUntil.get(stageName);
    if (openTime === undefined) return false;

    if (Date.now() > openTime) {
      // Half-open: allow one attempt
      this.openUntil.delete(stageName);
      return false;
    }
    return true;
  }

  /**
   * Get circuit state for a stage
   */
  getState(stageName: PipelineStageName): CircuitState {
    if (!this.config.enabled) return 'closed';

    const openTime = this.openUntil.get(stageName);
    if (openTime === undefined) return 'closed';

    if (Date.now() > openTime) {
      return 'half-open';
    }
    return 'open';
  }

  /**
   * Get failure count for a stage
   */
  getFailureCount(stageName: PipelineStageName): number {
    return this.failures.get(stageName) ?? 0;
  }

  /**
   * Get remaining time until circuit closes (in ms)
   */
  getRemainingResetTime(stageName: PipelineStageName): number {
    const openTime = this.openUntil.get(stageName);
    if (openTime === undefined) return 0;
    return Math.max(0, openTime - Date.now());
  }

  /**
   * Manually reset circuit for a stage
   */
  reset(stageName: PipelineStageName): void {
    this.failures.delete(stageName);
    this.openUntil.delete(stageName);
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.failures.clear();
    this.openUntil.clear();
    this.lastSuccess.clear();
  }
}

/**
 * Analysis Orchestrator Agent class
 *
 * Responsible for:
 * - Initializing and managing analysis sessions
 * - Coordinating sub-agent execution
 * - Managing pipeline state and progress
 * - Generating analysis reports
 * - Handling errors and retries
 */
export class AnalysisOrchestratorAgent {
  private readonly config: Required<AnalysisOrchestratorConfig>;
  private readonly circuitBreaker: StageCircuitBreaker;
  private readonly stageTimeouts: Required<StageTimeoutConfig>;
  private readonly parallelExecutionConfig: Required<ParallelExecutionConfig>;
  private readonly cleanupTimers = new Map<PipelineStageName, NodeJS.Timeout>();
  private readonly abortControllers = new Map<string, AbortController>();
  private session: AnalysisSession | null = null;

  constructor(config: AnalysisOrchestratorConfig = {}) {
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config,
    };
    this.circuitBreaker = new StageCircuitBreaker(config.circuitBreaker);
    this.stageTimeouts = {
      ...DEFAULT_STAGE_TIMEOUTS,
      ...config.stageTimeouts,
    };
    this.parallelExecutionConfig = {
      ...DEFAULT_PARALLEL_EXECUTION_CONFIG,
      ...config.parallelExecutionConfig,
    };
  }

  /**
   * Start a new analysis session
   */
  public async startAnalysis(input: AnalysisInput): Promise<AnalysisSession> {
    await loadYaml();

    // Check if analysis is already in progress
    if (this.session !== null && this.session.pipelineState.overallStatus === 'running') {
      throw new AnalysisInProgressError(this.session.analysisId);
    }

    // Validate project path
    await this.validateProjectPath(input.projectPath);

    // Generate IDs
    const analysisId = randomUUID();
    const projectId = input.projectId ?? this.generateProjectId(input.projectPath);
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    // Determine which stages to run based on scope
    const stages = this.createStages(input.scope ?? 'full', input.generateIssues ?? false);

    // Create initial pipeline state
    const pipelineState: PipelineState = {
      analysisId,
      projectId,
      projectPath: path.resolve(input.projectPath),
      startedAt: now,
      updatedAt: now,
      overallStatus: 'pending',
      scope: input.scope ?? 'full',
      generateIssues: input.generateIssues ?? false,
      stages,
      statistics: {
        totalStages: stages.length,
        completedStages: 0,
        failedStages: 0,
        skippedStages: 0,
        totalDurationMs: 0,
      },
      warnings: [],
      errors: [],
    };

    // Create session
    this.session = {
      sessionId,
      analysisId,
      pipelineState,
      startedAt: now,
      updatedAt: now,
    };

    // Create output directories
    await this.createOutputDirectories(projectId, input.projectPath);

    // Save initial state
    await this.savePipelineState(pipelineState, input.projectPath);

    return this.session;
  }

  /**
   * Execute the analysis pipeline
   */
  public async execute(): Promise<AnalysisResult> {
    const session = this.ensureSession();
    const startTime = Date.now();

    let pipelineState = session.pipelineState;
    const warnings: string[] = [];
    const outputPaths: {
      pipelineState: string;
      analysisReport: string;
      documentInventory?: string;
      codeInventory?: string;
      comparisonResult?: string;
      generatedIssues?: string;
    } = {
      pipelineState: '',
      analysisReport: '',
    };

    try {
      // Update status to running
      pipelineState = this.updatePipelineStatus(pipelineState, 'running');
      await this.savePipelineState(pipelineState, pipelineState.projectPath);

      // Execute stages based on scope
      const stageResults = await this.executeStages(pipelineState);

      // Update pipeline state with results
      pipelineState = this.applyStageResults(pipelineState, stageResults);

      // Collect output paths
      for (const result of stageResults) {
        if (result.outputPath !== null) {
          switch (result.stage) {
            case 'document_reader':
              outputPaths.documentInventory = result.outputPath;
              break;
            case 'code_reader':
              outputPaths.codeInventory = result.outputPath;
              break;
            case 'comparator':
              outputPaths.comparisonResult = result.outputPath;
              break;
            case 'issue_generator':
              outputPaths.generatedIssues = result.outputPath;
              break;
          }
        }
      }

      // Check if all required stages completed
      const failedStages = stageResults
        .filter((r) => !r.success && this.isRequiredStage(r.stage, pipelineState.scope))
        .map((r) => r.stage);

      const overallStatus: PipelineStatus =
        failedStages.length === 0
          ? 'completed'
          : this.config.continueOnError
            ? 'completed'
            : 'failed';

      // Calculate final statistics
      const endTime = Date.now();
      const statistics = this.calculateStatistics(stageResults, endTime - startTime);

      // Update final state
      pipelineState = {
        ...pipelineState,
        overallStatus,
        updatedAt: new Date().toISOString(),
        statistics,
        warnings: [...pipelineState.warnings, ...warnings],
      };

      // Save final state
      const statePath = await this.savePipelineState(pipelineState, pipelineState.projectPath);
      outputPaths.pipelineState = statePath;

      // Generate analysis report
      const report = this.generateReport(pipelineState, stageResults);
      const reportPath = await this.saveAnalysisReport(report, pipelineState.projectPath);
      outputPaths.analysisReport = reportPath;

      // Update session
      this.session = {
        ...session,
        pipelineState,
        updatedAt: new Date().toISOString(),
      };

      // Check for critical failures
      if (!this.config.continueOnError && failedStages.length > 0) {
        throw new PipelineFailedError(pipelineState.analysisId, failedStages);
      }

      return {
        success: overallStatus === 'completed',
        analysisId: pipelineState.analysisId,
        projectId: pipelineState.projectId,
        pipelineState,
        report,
        outputPaths,
        warnings,
      };
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      pipelineState = {
        ...pipelineState,
        overallStatus: 'failed',
        updatedAt: new Date().toISOString(),
        errors: [...pipelineState.errors, errorMessage],
      };

      await this.savePipelineState(pipelineState, pipelineState.projectPath);

      this.session = {
        ...session,
        pipelineState,
        updatedAt: new Date().toISOString(),
      };

      throw error;
    }
  }

  /**
   * Get current session
   */
  public getSession(): AnalysisSession | null {
    return this.session;
  }

  /**
   * Get analysis status by ID
   */
  public async getStatus(analysisId: string, rootPath: string): Promise<PipelineState> {
    const statePath = path.join(
      rootPath,
      this.config.scratchpadBasePath,
      'pipeline',
      analysisId,
      'state.yaml'
    );

    try {
      const content = await fs.readFile(statePath, 'utf-8');
      await loadYaml();
      const parsed = yaml?.load(content);
      if (parsed !== null && typeof parsed === 'object' && 'pipeline_state' in parsed) {
        return this.parsePipelineState((parsed as { pipeline_state: unknown }).pipeline_state);
      }
      throw new StateReadError(statePath, 'Invalid state format');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AnalysisNotFoundError(analysisId);
      }
      throw error;
    }
  }

  /**
   * Resume a failed analysis
   */
  public async resume(
    analysisId: string,
    rootPath: string,
    retryFailed: boolean = true
  ): Promise<AnalysisSession> {
    await loadYaml();

    // Load existing state
    const existingState = await this.getStatus(analysisId, rootPath);

    if (existingState.overallStatus === 'running') {
      throw new AnalysisInProgressError(analysisId);
    }

    // Reset failed stages if retry is enabled
    let stages = existingState.stages;
    if (retryFailed) {
      stages = stages.map((stage) =>
        stage.status === 'failed'
          ? { ...stage, status: 'pending' as const, error: null, retryCount: stage.retryCount }
          : stage
      );
    }

    // Create new session with updated state
    const now = new Date().toISOString();
    const sessionId = randomUUID();

    const pipelineState: PipelineState = {
      ...existingState,
      stages,
      overallStatus: 'pending',
      updatedAt: now,
    };

    this.session = {
      sessionId,
      analysisId,
      pipelineState,
      startedAt: now,
      updatedAt: now,
    };

    return this.session;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureSession(): AnalysisSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  private async validateProjectPath(projectPath: string): Promise<void> {
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new InvalidProjectPathError(projectPath, 'Not a directory');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new InvalidProjectPathError(projectPath, 'Directory does not exist');
      }
      throw error;
    }
  }

  private generateProjectId(projectPath: string): string {
    const baseName = path.basename(path.resolve(projectPath));
    const timestamp = Date.now().toString(36);
    return `${baseName}-${timestamp}`;
  }

  private createStages(scope: AnalysisScope, generateIssues: boolean): PipelineStage[] {
    const stages: PipelineStage[] = [];
    const now = null;

    const baseStage = {
      status: 'pending' as const,
      startedAt: now,
      completedAt: now,
      outputPath: now,
      error: now,
      retryCount: 0,
    };

    // Document Reader stage
    if (scope === 'full' || scope === 'documents_only' || scope === 'comparison') {
      stages.push({ ...baseStage, name: 'document_reader' });
    }

    // Code Reader stage
    if (scope === 'full' || scope === 'code_only' || scope === 'comparison') {
      stages.push({ ...baseStage, name: 'code_reader' });
    }

    // Comparator stage (requires both document and code reader)
    if (scope === 'full' || scope === 'comparison') {
      stages.push({ ...baseStage, name: 'comparator' });
    }

    // Issue Generator stage (optional)
    if (generateIssues && (scope === 'full' || scope === 'comparison')) {
      stages.push({ ...baseStage, name: 'issue_generator' });
    }

    return stages;
  }

  private async createOutputDirectories(projectId: string, rootPath: string): Promise<void> {
    const basePath = path.join(rootPath, this.config.scratchpadBasePath);
    const dirs = [
      path.join(basePath, 'pipeline', projectId),
      path.join(basePath, 'state', projectId),
      path.join(basePath, 'analysis', projectId),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async executeStages(pipelineState: PipelineState): Promise<StageResult[]> {
    const results: StageResult[] = [];
    const { scope } = pipelineState;

    // Determine execution order and parallelism
    const parallelStages: PipelineStageName[] = [];
    const sequentialStages: PipelineStageName[] = [];

    for (const stage of pipelineState.stages) {
      if (stage.status === 'completed' || stage.status === 'skipped') {
        // Already done, add placeholder result
        results.push({
          stage: stage.name,
          success: stage.status === 'completed',
          outputPath: stage.outputPath,
          error: stage.error,
          durationMs: 0,
          retryCount: stage.retryCount,
        });
        continue;
      }

      // Document and code readers can run in parallel
      if (
        this.config.parallelExecution &&
        (stage.name === 'document_reader' || stage.name === 'code_reader')
      ) {
        parallelStages.push(stage.name);
      } else {
        sequentialStages.push(stage.name);
      }
    }

    // Execute parallel stages with timeout and partial result handling
    if (parallelStages.length > 0) {
      const parallelExecutionResult = await this.executeParallelStages(
        parallelStages,
        pipelineState,
        results
      );

      // Convert parallel results to stage results
      for (const parallelResult of parallelExecutionResult.results) {
        if (parallelResult.result !== null) {
          results.push(parallelResult.result);
        } else {
          // Create failed result for stages that didn't complete
          results.push({
            stage: parallelResult.stage,
            success: false,
            outputPath: null,
            error: parallelResult.error ?? `Stage ${parallelResult.status}`,
            durationMs: parallelResult.durationMs,
            retryCount: 0,
          });
        }
      }

      // Check if we can continue with partial results
      if (!parallelExecutionResult.canContinue && !this.config.continueOnError) {
        return results;
      }
    }

    // Execute sequential stages
    for (const stageName of sequentialStages) {
      // Check dependencies
      const dependencyError = this.checkStageDependencies(stageName, scope, results);
      if (dependencyError !== null) {
        results.push({
          stage: stageName,
          success: false,
          outputPath: null,
          error: dependencyError,
          durationMs: 0,
          retryCount: 0,
        });
        continue;
      }

      const result = await this.executeStage(stageName, pipelineState, results);
      results.push(result);

      // Stop if critical stage fails and continueOnError is false
      if (!result.success && !this.config.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute parallel stages with timeout, fail-fast, and partial result handling
   */
  private async executeParallelStages(
    parallelStages: PipelineStageName[],
    pipelineState: PipelineState,
    existingResults: StageResult[]
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const timeout = this.parallelExecutionConfig.parallelExecutionTimeoutMs;
    const executionId = randomUUID();

    // Create abort controller for fail-fast support
    const abortController = new AbortController();
    this.abortControllers.set(executionId, abortController);

    // Track completed stages for timeout error reporting
    const completedStages: PipelineStageName[] = [];
    const stageStartTimes = new Map<PipelineStageName, number>();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        const timer = setTimeout(() => {
          abortController.abort();
          resolve('timeout');
        }, timeout);

        // Clean up timer on abort
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timer);
        });
      });

      // Create stage execution promises with abort signal support
      const stagePromises = parallelStages.map(async (stageName): Promise<ParallelStageResult> => {
        const stageStartTime = Date.now();
        stageStartTimes.set(stageName, stageStartTime);

        try {
          // Check if already aborted
          if (abortController.signal.aborted) {
            return {
              stage: stageName,
              status: 'aborted',
              result: null,
              error: 'Execution aborted due to fail-fast or timeout',
              durationMs: Date.now() - stageStartTime,
            };
          }

          const result = await this.executeStageWithAbort(
            stageName,
            pipelineState,
            existingResults,
            abortController.signal
          );

          completedStages.push(stageName);

          // Check for fail-fast on critical stage failure
          if (
            !result.success &&
            this.parallelExecutionConfig.failFast &&
            this.isCriticalParallelStage(stageName)
          ) {
            abortController.abort();
          }

          return {
            stage: stageName,
            status: result.success ? 'fulfilled' : 'rejected',
            result,
            error: result.error,
            durationMs: Date.now() - stageStartTime,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Check for abort error
          if (error instanceof Error && error.name === 'AbortError') {
            return {
              stage: stageName,
              status: 'aborted',
              result: null,
              error: 'Execution aborted',
              durationMs: Date.now() - stageStartTime,
            };
          }

          return {
            stage: stageName,
            status: 'rejected',
            result: null,
            error: errorMessage,
            durationMs: Date.now() - stageStartTime,
          };
        }
      });

      // Race between Promise.allSettled and timeout
      const raceResult = await Promise.race([
        Promise.allSettled(stagePromises).then((settled) => ({
          type: 'completed' as const,
          results: settled,
        })),
        timeoutPromise.then(() => ({
          type: 'timeout' as const,
          results: [] as PromiseSettledResult<ParallelStageResult>[],
        })),
      ]);

      const totalDurationMs = Date.now() - startTime;

      if (raceResult.type === 'timeout') {
        // Handle timeout - collect any results that completed
        const partialResults: ParallelStageResult[] = parallelStages.map((stageName) => {
          if (completedStages.includes(stageName)) {
            // This stage completed, but we don't have the result anymore
            // In practice, the promises might have completed by now
            return {
              stage: stageName,
              status: 'fulfilled' as const,
              result: null,
              error: null,
              durationMs: Date.now() - (stageStartTimes.get(stageName) ?? startTime),
            };
          }
          return {
            stage: stageName,
            status: 'timeout' as const,
            result: null,
            error: `Stage timed out after ${String(timeout)}ms`,
            durationMs: timeout,
          };
        });

        const timedOutCount = partialResults.filter((r) => r.status === 'timeout').length;
        const completedCount = partialResults.filter((r) => r.status === 'fulfilled').length;

        return {
          results: partialResults,
          completed: completedCount,
          failed: 0,
          timedOut: timedOutCount,
          aborted: 0,
          canContinue: this.checkPartialResultsSufficient(completedCount, parallelStages.length),
          totalDurationMs,
        };
      }

      // Process settled results
      const processedResults: ParallelStageResult[] = raceResult.results.map((settled, index) => {
        const stageName = parallelStages[index];
        if (stageName === undefined) {
          // This should never happen, but handle it gracefully
          return {
            stage: 'document_reader' as PipelineStageName,
            status: 'rejected' as const,
            result: null,
            error: 'Internal error: stage index out of bounds',
            durationMs: 0,
          };
        }

        if (settled.status === 'fulfilled') {
          return settled.value;
        }
        // Rejected promise (unexpected)
        return {
          stage: stageName,
          status: 'rejected' as const,
          result: null,
          error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
          durationMs: Date.now() - (stageStartTimes.get(stageName) ?? startTime),
        };
      });

      const completed = processedResults.filter(
        (r) => r.status === 'fulfilled' && r.result?.success === true
      ).length;
      const failed = processedResults.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.result?.success !== true)
      ).length;
      const timedOut = processedResults.filter((r) => r.status === 'timeout').length;
      const aborted = processedResults.filter((r) => r.status === 'aborted').length;

      return {
        results: processedResults,
        completed,
        failed,
        timedOut,
        aborted,
        canContinue: this.checkPartialResultsSufficient(completed, parallelStages.length),
        totalDurationMs,
      };
    } finally {
      // Clean up abort controller
      this.abortControllers.delete(executionId);
    }
  }

  /**
   * Execute a stage with abort signal support
   */
  private async executeStageWithAbort(
    stageName: PipelineStageName,
    pipelineState: PipelineState,
    previousResults: StageResult[],
    signal: AbortSignal
  ): Promise<StageResult> {
    // Check if already aborted
    if (signal.aborted) {
      return {
        stage: stageName,
        success: false,
        outputPath: null,
        error: 'Execution aborted before start',
        durationMs: 0,
        retryCount: 0,
      };
    }

    // Wrap the existing executeStage with abort signal check
    return new Promise((resolve, reject) => {
      const abortHandler = (): void => {
        const abortError = new Error('AbortError');
        abortError.name = 'AbortError';
        reject(abortError);
      };

      signal.addEventListener('abort', abortHandler, { once: true });

      this.executeStage(stageName, pipelineState, previousResults)
        .then((result) => {
          signal.removeEventListener('abort', abortHandler);
          resolve(result);
        })
        .catch((error: unknown) => {
          signal.removeEventListener('abort', abortHandler);
          if (error instanceof Error) {
            reject(error);
          } else {
            reject(new Error(String(error)));
          }
        });
    });
  }

  /**
   * Check if a stage is critical for fail-fast purposes
   */
  private isCriticalParallelStage(stageName: PipelineStageName): boolean {
    const requiredStages = this.parallelExecutionConfig.requiredStages;
    if (requiredStages.length === 0) {
      // If no required stages specified, all parallel stages are considered critical
      return true;
    }
    return requiredStages.includes(stageName);
  }

  /**
   * Check if partial results are sufficient to continue
   */
  private checkPartialResultsSufficient(successCount: number, totalCount: number): boolean {
    if (!this.parallelExecutionConfig.allowPartialResults) {
      return successCount === totalCount;
    }

    if (totalCount === 0) {
      return true;
    }

    const ratio = successCount / totalCount;
    return ratio >= this.parallelExecutionConfig.minSuccessRatio;
  }

  private async executeStage(
    stageName: PipelineStageName,
    pipelineState: PipelineState,
    previousResults: StageResult[]
  ): Promise<StageResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | null = null;

    // Check circuit breaker before attempting execution
    if (this.circuitBreaker.isOpen(stageName)) {
      const failureCount = this.circuitBreaker.getFailureCount(stageName);
      const resetTime = this.circuitBreaker.getRemainingResetTime(stageName);
      throw new CircuitOpenError(stageName, failureCount, resetTime);
    }

    while (retryCount <= this.config.maxRetries) {
      try {
        // Execute with timeout
        const result = await this.executeStageWithTimeout(
          stageName,
          pipelineState,
          previousResults
        );

        // Record success for circuit breaker
        this.circuitBreaker.recordSuccess(stageName);

        return {
          ...result,
          retryCount,
        };
      } catch (error) {
        // Record failure for circuit breaker
        this.circuitBreaker.recordFailure(stageName);

        // Check if circuit breaker opened during retries
        if (this.circuitBreaker.isOpen(stageName)) {
          const failureCount = this.circuitBreaker.getFailureCount(stageName);
          const resetTime = this.circuitBreaker.getRemainingResetTime(stageName);
          return {
            stage: stageName,
            success: false,
            outputPath: null,
            error: `Circuit breaker opened after ${String(failureCount)} failures. Reset in ${String(resetTime)}ms.`,
            durationMs: Date.now() - startTime,
            retryCount,
          };
        }

        // Handle timeout errors specifically
        if (error instanceof StageTimeoutError) {
          lastError = `Stage timed out after ${String(error.timeoutMs)}ms`;
        } else {
          lastError = error instanceof Error ? error.message : String(error);
        }

        retryCount++;

        if (retryCount <= this.config.maxRetries) {
          // Exponential backoff with cap at 30 seconds
          const delay = Math.min(this.config.retryDelayMs * Math.pow(2, retryCount - 1), 30000);
          await this.delay(delay);
        }
      }
    }

    return {
      stage: stageName,
      success: false,
      outputPath: null,
      error: lastError ?? 'Unknown error',
      durationMs: Date.now() - startTime,
      retryCount,
    };
  }

  /**
   * Execute a stage with timeout enforcement
   */
  private async executeStageWithTimeout(
    stageName: PipelineStageName,
    pipelineState: PipelineState,
    previousResults: StageResult[]
  ): Promise<StageResult> {
    const timeout = this.getStageTimeout(stageName);
    const startTime = new Date();

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new StageTimeoutError(stageName, timeout, startTime));
      }, timeout);

      // Store timer for cleanup
      this.cleanupTimers.set(stageName, timer);
    });

    try {
      // Race between execution and timeout
      const result = await Promise.race([
        this.runStageExecutor(stageName, pipelineState, previousResults),
        timeoutPromise,
      ]);
      return result;
    } finally {
      // Clean up timer
      const timer = this.cleanupTimers.get(stageName);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.cleanupTimers.delete(stageName);
      }
    }
  }

  /**
   * Get timeout for a specific stage
   */
  private getStageTimeout(stageName: PipelineStageName): number {
    return this.stageTimeouts[stageName];
  }

  private async runStageExecutor(
    stageName: PipelineStageName,
    pipelineState: PipelineState,
    previousResults: StageResult[]
  ): Promise<StageResult> {
    const startTime = Date.now();
    const { projectPath, projectId } = pipelineState;

    // Build input paths from previous results
    const inputPaths: Record<string, string> = {};
    for (const result of previousResults) {
      if (result.success && result.outputPath !== null) {
        inputPaths[result.stage] = result.outputPath;
      }
    }

    // Execute stage-specific logic
    // Note: In a full implementation, this would spawn sub-agents
    // For now, we create placeholder outputs
    const outputPath = await this.createStageOutput(stageName, projectPath, projectId, inputPaths);

    return {
      stage: stageName,
      success: true,
      outputPath,
      error: null,
      durationMs: Date.now() - startTime,
      retryCount: 0,
    };
  }

  private async createStageOutput(
    stageName: PipelineStageName,
    projectPath: string,
    projectId: string,
    inputPaths: Record<string, string>
  ): Promise<string> {
    const basePath = path.join(projectPath, this.config.scratchpadBasePath);
    let outputPath: string;
    let content: Record<string, unknown>;

    switch (stageName) {
      case 'document_reader':
        outputPath = path.join(basePath, 'state', projectId, 'document_inventory.yaml');
        content = {
          document_inventory: {
            project_id: projectId,
            generated_at: new Date().toISOString(),
            documents: [],
            requirements: { functional: [], non_functional: [] },
            note: 'Placeholder - Document Reader Agent not yet implemented',
          },
        };
        break;

      case 'code_reader':
        outputPath = path.join(basePath, 'analysis', projectId, 'code_inventory.yaml');
        content = {
          code_inventory: {
            project_id: projectId,
            generated_at: new Date().toISOString(),
            modules: [],
            statistics: { total_files: 0, total_lines: 0 },
            note: 'Placeholder - Code Reader Agent not yet implemented',
          },
        };
        break;

      case 'comparator':
        outputPath = path.join(basePath, 'analysis', projectId, 'comparison_result.yaml');
        content = {
          comparison_result: {
            project_id: projectId,
            generated_at: new Date().toISOString(),
            inputs: inputPaths,
            gaps: [],
            statistics: { total_gaps: 0, critical_gaps: 0, high_gaps: 0 },
            note: 'Placeholder - Doc-Code Comparator Agent not yet implemented',
          },
        };
        break;

      case 'issue_generator':
        outputPath = path.join(basePath, 'analysis', projectId, 'generated_issues.json');
        content = {
          generated_issues: {
            project_id: projectId,
            generated_at: new Date().toISOString(),
            issues: [],
            statistics: { total_issues: 0 },
            note: 'Placeholder - Issue Generator Agent not yet implemented',
          },
        };
        break;

      default:
        throw new StageExecutionError(stageName, 'Unknown stage', 0);
    }

    await this.writeOutput(outputPath, content);
    return outputPath;
  }

  private checkStageDependencies(
    stageName: PipelineStageName,
    scope: AnalysisScope,
    results: StageResult[]
  ): string | null {
    const dependencies = this.getStageDependencies(stageName, scope);
    const failedDeps = dependencies.filter((dep) => {
      const result = results.find((r) => r.stage === dep);
      return result !== undefined && !result.success;
    });

    if (failedDeps.length > 0) {
      throw new StageDependencyError(stageName, dependencies, failedDeps);
    }

    return null;
  }

  private getStageDependencies(
    stageName: PipelineStageName,
    scope: AnalysisScope
  ): PipelineStageName[] {
    switch (stageName) {
      case 'document_reader':
      case 'code_reader':
        return [];

      case 'comparator':
        if (scope === 'full' || scope === 'comparison') {
          return ['document_reader', 'code_reader'];
        }
        return [];

      case 'issue_generator':
        return ['comparator'];

      default:
        return [];
    }
  }

  private isRequiredStage(stageName: PipelineStageName, scope: AnalysisScope): boolean {
    switch (scope) {
      case 'full':
        return stageName !== 'issue_generator';
      case 'documents_only':
        return stageName === 'document_reader';
      case 'code_only':
        return stageName === 'code_reader';
      case 'comparison':
        return stageName !== 'issue_generator';
      default:
        return false;
    }
  }

  private updatePipelineStatus(state: PipelineState, status: PipelineStatus): PipelineState {
    return {
      ...state,
      overallStatus: status,
      updatedAt: new Date().toISOString(),
    };
  }

  private applyStageResults(state: PipelineState, results: StageResult[]): PipelineState {
    const updatedStages = state.stages.map((stage) => {
      const result = results.find((r) => r.stage === stage.name);
      if (result === undefined) {
        return stage;
      }

      return {
        ...stage,
        status: result.success ? ('completed' as const) : ('failed' as const),
        completedAt: new Date().toISOString(),
        outputPath: result.outputPath,
        error: result.error,
        retryCount: result.retryCount,
      };
    });

    return {
      ...state,
      stages: updatedStages,
      updatedAt: new Date().toISOString(),
    };
  }

  private calculateStatistics(results: StageResult[], totalDurationMs: number): PipelineStatistics {
    return {
      totalStages: results.length,
      completedStages: results.filter((r) => r.success).length,
      failedStages: results.filter((r) => !r.success && r.error !== null).length,
      skippedStages: 0,
      totalDurationMs,
    };
  }

  private generateReport(state: PipelineState, results: StageResult[]): AnalysisReport {
    const documentResult = results.find((r) => r.stage === 'document_reader');
    const codeResult = results.find((r) => r.stage === 'code_reader');
    const comparatorResult = results.find((r) => r.stage === 'comparator');
    const issueResult = results.find((r) => r.stage === 'issue_generator');

    const documentAnalysis: DocumentAnalysisSummary = {
      available: documentResult?.success ?? false,
      summary: documentResult?.success === true ? 'Document analysis completed' : null,
      outputPath: documentResult?.outputPath ?? null,
      documentCount: 0,
      requirementCount: 0,
    };

    const codeAnalysis: CodeAnalysisSummary = {
      available: codeResult?.success ?? false,
      summary: codeResult?.success === true ? 'Code analysis completed' : null,
      outputPath: codeResult?.outputPath ?? null,
      moduleCount: 0,
      fileCount: 0,
      totalLines: 0,
    };

    const comparison: ComparisonSummary = {
      available: comparatorResult?.success ?? false,
      totalGaps: 0,
      criticalGaps: 0,
      highGaps: 0,
      outputPath: comparatorResult?.outputPath ?? null,
    };

    const issues: IssuesSummary = {
      generated: issueResult?.success ?? false,
      totalIssues: 0,
      outputPath: issueResult?.outputPath ?? null,
    };

    const recommendations = this.generateRecommendations(state, results);

    const overallStatus: AnalysisResultStatus = this.determineOverallStatus(results, state.scope);

    return {
      analysisId: state.analysisId,
      projectId: state.projectId,
      generatedAt: new Date().toISOString(),
      analysisVersion: '1.0.0',
      overallStatus,
      scope: state.scope,
      totalStages: results.length,
      completedStages: results.filter((r) => r.success).length,
      documentAnalysis,
      codeAnalysis,
      comparison,
      issues,
      recommendations,
      totalDurationMs: state.statistics.totalDurationMs,
    };
  }

  private determineOverallStatus(
    results: StageResult[],
    scope: AnalysisScope
  ): AnalysisResultStatus {
    const requiredResults = results.filter((r) => this.isRequiredStage(r.stage, scope));
    const successCount = requiredResults.filter((r) => r.success).length;

    if (successCount === requiredResults.length) {
      return 'success';
    }
    if (successCount > 0) {
      return 'partial';
    }
    return 'failed';
  }

  private generateRecommendations(
    state: PipelineState,
    results: StageResult[]
  ): AnalysisRecommendation[] {
    const recommendations: AnalysisRecommendation[] = [];

    // Check for failed stages
    const failedStages = results.filter((r) => !r.success);
    if (failedStages.length > 0) {
      recommendations.push({
        priority: 1,
        message: `${String(failedStages.length)} stage(s) failed during analysis`,
        action: `Review errors and retry with: ad-sdlc analyze --resume ${state.analysisId}`,
      });
    }

    // Add scope-specific recommendations
    if (state.scope === 'documents_only') {
      recommendations.push({
        priority: 3,
        message: 'Only document analysis was performed',
        action: 'Run full analysis to include code analysis and gap detection',
      });
    }

    if (state.scope === 'code_only') {
      recommendations.push({
        priority: 3,
        message: 'Only code analysis was performed',
        action: 'Run full analysis to include document analysis and gap detection',
      });
    }

    if (!state.generateIssues && (state.scope === 'full' || state.scope === 'comparison')) {
      recommendations.push({
        priority: 2,
        message: 'Issue generation was not enabled',
        action: 'Re-run with --generate-issues to create GitHub issues from detected gaps',
      });
    }

    // Success recommendation
    if (failedStages.length === 0) {
      recommendations.push({
        priority: 4,
        message: 'Analysis completed successfully',
        action: 'Review the analysis report and generated outputs',
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private async savePipelineState(state: PipelineState, rootPath: string): Promise<string> {
    const outputPath = path.join(
      rootPath,
      this.config.scratchpadBasePath,
      'pipeline',
      state.projectId,
      'state.yaml'
    );

    const content = this.formatPipelineStateForYaml(state);
    await this.writeOutput(outputPath, content);
    return outputPath;
  }

  private async saveAnalysisReport(report: AnalysisReport, rootPath: string): Promise<string> {
    const outputPath = path.join(
      rootPath,
      this.config.scratchpadBasePath,
      'analysis',
      report.projectId,
      'analysis_report.yaml'
    );

    const content = this.formatAnalysisReportForYaml(report);
    await this.writeOutput(outputPath, content);
    return outputPath;
  }

  private async writeOutput(outputPath: string, content: Record<string, unknown>): Promise<void> {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      const yamlString = yaml?.dump(content);
      if (yamlString === undefined || yamlString === '') {
        throw new Error('YAML dump failed');
      }
      await fs.writeFile(outputPath, yamlString, 'utf-8');
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private formatPipelineStateForYaml(state: PipelineState): Record<string, unknown> {
    return {
      pipeline_state: {
        analysis_id: state.analysisId,
        project_id: state.projectId,
        project_path: state.projectPath,
        started_at: state.startedAt,
        updated_at: state.updatedAt,
        overall_status: state.overallStatus,
        scope: state.scope,
        generate_issues: state.generateIssues,
        stages: state.stages.map((s) => ({
          name: s.name,
          status: s.status,
          started_at: s.startedAt,
          completed_at: s.completedAt,
          output_path: s.outputPath,
          error: s.error,
          retry_count: s.retryCount,
        })),
        statistics: {
          total_stages: state.statistics.totalStages,
          completed_stages: state.statistics.completedStages,
          failed_stages: state.statistics.failedStages,
          skipped_stages: state.statistics.skippedStages,
          total_duration_ms: state.statistics.totalDurationMs,
        },
        warnings: state.warnings,
        errors: state.errors,
      },
    };
  }

  private formatAnalysisReportForYaml(report: AnalysisReport): Record<string, unknown> {
    return {
      analysis_report: {
        analysis_id: report.analysisId,
        project_id: report.projectId,
        generated_at: report.generatedAt,
        analysis_version: report.analysisVersion,
        overall_status: report.overallStatus,
        scope: report.scope,
        total_stages: report.totalStages,
        completed_stages: report.completedStages,
        document_analysis: {
          available: report.documentAnalysis.available,
          summary: report.documentAnalysis.summary,
          output_path: report.documentAnalysis.outputPath,
          document_count: report.documentAnalysis.documentCount,
          requirement_count: report.documentAnalysis.requirementCount,
        },
        code_analysis: {
          available: report.codeAnalysis.available,
          summary: report.codeAnalysis.summary,
          output_path: report.codeAnalysis.outputPath,
          module_count: report.codeAnalysis.moduleCount,
          file_count: report.codeAnalysis.fileCount,
          total_lines: report.codeAnalysis.totalLines,
        },
        comparison: {
          available: report.comparison.available,
          total_gaps: report.comparison.totalGaps,
          critical_gaps: report.comparison.criticalGaps,
          high_gaps: report.comparison.highGaps,
          output_path: report.comparison.outputPath,
        },
        issues: {
          generated: report.issues.generated,
          total_issues: report.issues.totalIssues,
          output_path: report.issues.outputPath,
        },
        recommendations: report.recommendations.map((r) => ({
          priority: r.priority,
          message: r.message,
          action: r.action,
        })),
        total_duration_ms: report.totalDurationMs,
      },
    };
  }

  private parsePipelineState(data: unknown): PipelineState {
    // Type guard for the parsed data
    const parsed = data as Record<string, unknown>;
    return {
      analysisId: toSafeString(parsed['analysis_id']),
      projectId: toSafeString(parsed['project_id']),
      projectPath: toSafeString(parsed['project_path']),
      startedAt: toSafeString(parsed['started_at']),
      updatedAt: toSafeString(parsed['updated_at']),
      overallStatus: toSafeString(parsed['overall_status'], 'pending') as PipelineStatus,
      scope: toSafeString(parsed['scope'], 'full') as AnalysisScope,
      generateIssues: Boolean(parsed['generate_issues']),
      stages: this.parseStages(parsed['stages']),
      statistics: this.parseStatistics(parsed['statistics']),
      warnings: Array.isArray(parsed['warnings'])
        ? parsed['warnings'].map((w) => toSafeString(w))
        : [],
      errors: Array.isArray(parsed['errors']) ? parsed['errors'].map((e) => toSafeString(e)) : [],
    };
  }

  private parseStages(data: unknown): PipelineStage[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((s: unknown) => {
      const stage = s as Record<string, unknown>;
      const startedAt = stage['started_at'];
      const completedAt = stage['completed_at'];
      const outputPath = stage['output_path'];
      const error = stage['error'];
      return {
        name: toSafeString(stage['name']) as PipelineStageName,
        status: toSafeString(stage['status'], 'pending') as PipelineStage['status'],
        startedAt: startedAt !== null && startedAt !== undefined ? toSafeString(startedAt) : null,
        completedAt:
          completedAt !== null && completedAt !== undefined ? toSafeString(completedAt) : null,
        outputPath:
          outputPath !== null && outputPath !== undefined ? toSafeString(outputPath) : null,
        error: error !== null && error !== undefined ? toSafeString(error) : null,
        retryCount: Number(stage['retry_count'] ?? 0),
      };
    });
  }

  private parseStatistics(data: unknown): PipelineStatistics {
    const stats = (data ?? {}) as Record<string, unknown>;
    return {
      totalStages: Number(stats['total_stages'] ?? 0),
      completedStages: Number(stats['completed_stages'] ?? 0),
      failedStages: Number(stats['failed_stages'] ?? 0),
      skippedStages: Number(stats['skipped_stages'] ?? 0),
      totalDurationMs: Number(stats['total_duration_ms'] ?? 0),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let agentInstance: AnalysisOrchestratorAgent | null = null;

/**
 * Get singleton instance of AnalysisOrchestratorAgent
 */
export function getAnalysisOrchestratorAgent(
  config?: AnalysisOrchestratorConfig
): AnalysisOrchestratorAgent {
  if (agentInstance === null) {
    agentInstance = new AnalysisOrchestratorAgent(config);
  }
  return agentInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetAnalysisOrchestratorAgent(): void {
  agentInstance = null;
}
