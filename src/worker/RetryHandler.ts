/**
 * Retry Handler module (Issue #48)
 *
 * Implements comprehensive retry mechanism with:
 * - Error categorization (transient, recoverable, fatal)
 * - Exponential backoff with jitter
 * - Progress checkpointing for resume capability
 * - Controller escalation for unresolvable issues
 * - Timeout handling (default 10 minutes per task)
 *
 * @module worker/RetryHandler
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  RetryPolicy,
  RetryAttempt,
  ProgressCheckpoint,
  EscalationReport,
  WorkerErrorInfo,
  WorkerStep,
  ErrorCategory,
} from './types.js';
import { DEFAULT_RETRY_POLICY } from './types.js';
import {
  categorizeError,
  createWorkerErrorInfo,
  isRetryableError,
  requiresEscalation,
  OperationTimeoutError,
  MaxRetriesExceededError,
} from './errors.js';

/**
 * Retry handler configuration
 */
export interface RetryHandlerConfig {
  /** Worker ID for identification */
  readonly workerId: string;
  /** Project root directory */
  readonly projectRoot: string;
  /** Checkpoint directory path */
  readonly checkpointPath: string;
  /** Retry policy */
  readonly retryPolicy: RetryPolicy;
  /** Escalation callback (optional) */
  readonly onEscalation: ((report: EscalationReport) => Promise<void>) | undefined;
  /** Progress callback (optional) */
  readonly onProgress: ((checkpoint: ProgressCheckpoint) => void) | undefined;
  /** Enable detailed logging */
  readonly verbose: boolean;
}

/**
 * Default retry handler configuration
 */
export const DEFAULT_RETRY_HANDLER_CONFIG: Omit<RetryHandlerConfig, 'workerId' | 'projectRoot'> = {
  checkpointPath: '.ad-sdlc/scratchpad/checkpoints',
  retryPolicy: DEFAULT_RETRY_POLICY,
  onEscalation: undefined,
  onProgress: undefined,
  verbose: false,
} as const;

/**
 * Operation result wrapper
 */
export interface OperationResult<T> {
  /** Whether the operation succeeded */
  readonly success: boolean;
  /** Result data if successful */
  readonly data?: T;
  /** Error information if failed */
  readonly error?: WorkerErrorInfo;
  /** Number of attempts made */
  readonly attempts: number;
  /** Total duration in milliseconds */
  readonly durationMs: number;
  /** All retry attempts */
  readonly retryAttempts: readonly RetryAttempt[];
}

/**
 * Retry Handler
 *
 * Manages retry logic for Worker Agent operations with comprehensive
 * error handling, timeout management, and escalation support.
 */
export class RetryHandler {
  private readonly config: Required<RetryHandlerConfig>;
  private readonly retryAttempts: RetryAttempt[];
  private currentCheckpoint: ProgressCheckpoint | null;

  constructor(config: Partial<RetryHandlerConfig> & { workerId: string; projectRoot: string }) {
    this.config = {
      workerId: config.workerId,
      projectRoot: config.projectRoot,
      checkpointPath: config.checkpointPath ?? DEFAULT_RETRY_HANDLER_CONFIG.checkpointPath,
      retryPolicy: config.retryPolicy ?? DEFAULT_RETRY_HANDLER_CONFIG.retryPolicy,
      onEscalation: config.onEscalation,
      onProgress: config.onProgress,
      verbose: config.verbose ?? DEFAULT_RETRY_HANDLER_CONFIG.verbose,
    };
    this.retryAttempts = [];
    this.currentCheckpoint = null;
  }

  /**
   * Execute an operation with retry mechanism
   * @param operation - The async operation to execute
   * @param context - Context information for the operation
   * @returns Operation result with success/failure information
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      readonly taskId: string;
      readonly step: WorkerStep;
      readonly workOrder: Record<string, unknown>;
    }
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempt = 0;
    const maxAttempts = this.config.retryPolicy.maxAttempts;
    const timeoutMs = this.config.retryPolicy.timeoutMs ?? 600000;

    // Reset retry attempts for new execution
    this.retryAttempts.length = 0;

    while (attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();

      try {
        // Create checkpoint before execution
        await this.createCheckpoint(context.taskId, context.step, attempt, {});

        // Execute with timeout
        const result = await this.withTimeout(operation(), timeoutMs, context.taskId, context.step);

        // Success - clear checkpoint
        await this.clearCheckpoint(context.taskId);

        return {
          success: true,
          data: result,
          attempts: attempt,
          durationMs: Date.now() - startTime,
          retryAttempts: [...this.retryAttempts],
        };
      } catch (error) {
        const actualError = error instanceof Error ? error : new Error(String(error));
        lastError = actualError;

        const errorInfo = createWorkerErrorInfo(actualError, {
          taskId: context.taskId,
          step: context.step,
          attempt,
        });

        // Record the attempt
        this.recordAttempt(attempt, errorInfo, attemptStart);

        // Log if verbose
        if (this.config.verbose) {
          this.log(
            `Attempt ${String(attempt)}/${String(maxAttempts)} failed: ${actualError.message}`
          );
        }

        // Check if error requires immediate escalation
        if (requiresEscalation(actualError)) {
          await this.escalate(context.taskId, context.workOrder, errorInfo);
          return this.createFailureResult(startTime, attempt, errorInfo);
        }

        // Check if error is retryable
        if (!isRetryableError(actualError)) {
          return this.createFailureResult(startTime, attempt, errorInfo);
        }

        // Handle recoverable errors with self-fix attempt
        const category = categorizeError(actualError);
        if (category === 'recoverable' && this.shouldAttemptFix(category)) {
          const lastAttemptIndex = this.retryAttempts.length - 1;
          const lastAttempt = this.retryAttempts[lastAttemptIndex];
          if (lastAttempt !== undefined) {
            this.retryAttempts[lastAttemptIndex] = {
              ...lastAttempt,
              fixAttempted: true,
            };
          }
          // Note: Actual fix logic would be called from WorkerAgent
        }

        // Wait before retry (if not last attempt)
        if (attempt < maxAttempts) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // Max retries exceeded
    const finalError = lastError ?? new Error('Unknown error');
    const errorInfo = createWorkerErrorInfo(finalError, {
      maxRetriesExceeded: true,
      totalAttempts: attempt,
    });

    // Escalate max retries exceeded
    await this.escalate(context.taskId, context.workOrder, errorInfo);

    throw new MaxRetriesExceededError(context.taskId, attempt, lastError);
  }

  /**
   * Execute operation with timeout
   * @param promise - The promise to wrap with timeout
   * @param timeoutMs - Timeout in milliseconds
   * @param taskId - Task ID for error context
   * @param operation - Operation name for error context
   * @returns The promise result
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    taskId: string,
    operation: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new OperationTimeoutError(taskId, operation, timeoutMs));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
      return result;
    } catch (error) {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
      throw error;
    }
  }

  /**
   * Calculate delay for retry attempt with exponential backoff and jitter
   * @param attempt - Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  private calculateDelay(attempt: number): number {
    const { baseDelayMs, backoff, maxDelayMs } = this.config.retryPolicy;
    let delay: number;

    switch (backoff) {
      case 'fixed':
        delay = baseDelayMs;
        break;
      case 'linear':
        delay = baseDelayMs * attempt;
        break;
      case 'exponential':
        delay = baseDelayMs * Math.pow(2, attempt - 1);
        break;
      default:
        delay = baseDelayMs;
    }

    // Add jitter (±10%) to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    delay = delay + jitter;

    return Math.min(Math.max(delay, 0), maxDelayMs);
  }

  /**
   * Check if fix should be attempted for the category
   * @param category - Error category
   * @returns Whether fix should be attempted
   */
  private shouldAttemptFix(category: ErrorCategory): boolean {
    const categoryPolicy = this.config.retryPolicy.byCategory?.[category];
    return categoryPolicy?.requireFixAttempt === true;
  }

  /**
   * Record a retry attempt
   * @param attempt - Attempt number
   * @param error - Error information
   * @param startTime - Attempt start time
   */
  private recordAttempt(attempt: number, error: WorkerErrorInfo, startTime: number): void {
    this.retryAttempts.push({
      attempt,
      timestamp: new Date().toISOString(),
      error,
      fixAttempted: false,
      durationMs: Date.now() - startTime,
    });
  }

  /**
   * Create a failure result
   * @param startTime - Operation start time
   * @param attempts - Number of attempts made
   * @param error - Error information
   * @returns Failure operation result
   */
  private createFailureResult<T>(
    startTime: number,
    attempts: number,
    error: WorkerErrorInfo
  ): OperationResult<T> {
    return {
      success: false,
      error,
      attempts,
      durationMs: Date.now() - startTime,
      retryAttempts: [...this.retryAttempts],
    };
  }

  /**
   * Create a progress checkpoint
   * @param taskId - Task ID
   * @param step - Current step
   * @param attemptNumber - Current attempt
   * @param snapshot - Progress snapshot
   */
  public async createCheckpoint(
    taskId: string,
    step: WorkerStep,
    attemptNumber: number,
    snapshot: Record<string, unknown>
  ): Promise<void> {
    const checkpoint: ProgressCheckpoint = {
      workOrderId: taskId,
      taskId,
      currentStep: step,
      timestamp: new Date().toISOString(),
      attemptNumber,
      progressSnapshot: snapshot,
      filesChanged: [],
      resumable: true,
    };

    this.currentCheckpoint = checkpoint;

    // Notify progress callback
    if (this.config.onProgress !== undefined) {
      this.config.onProgress(checkpoint);
    }

    // Persist checkpoint to disk
    try {
      const checkpointDir = join(this.config.projectRoot, this.config.checkpointPath);
      if (!existsSync(checkpointDir)) {
        await mkdir(checkpointDir, { recursive: true });
      }

      const filePath = join(checkpointDir, `${taskId}-checkpoint.json`);
      await writeFile(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
    } catch (error) {
      // Log but don't fail - checkpoint is optional
      if (this.config.verbose) {
        this.log(
          `Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Load a checkpoint for resume
   * @param taskId - Task ID to load checkpoint for
   * @returns Checkpoint if exists, null otherwise
   */
  public async loadCheckpoint(taskId: string): Promise<ProgressCheckpoint | null> {
    try {
      const filePath = join(
        this.config.projectRoot,
        this.config.checkpointPath,
        `${taskId}-checkpoint.json`
      );

      if (!existsSync(filePath)) {
        return null;
      }

      const content = await readFile(filePath, 'utf-8');
      // Internal data saved by this class - use direct parse with type assertion
      return JSON.parse(content) as ProgressCheckpoint;
    } catch {
      return null;
    }
  }

  /**
   * Clear a checkpoint (on success)
   * @param taskId - Task ID to clear checkpoint for
   */
  public async clearCheckpoint(taskId: string): Promise<void> {
    this.currentCheckpoint = null;

    try {
      const { unlink } = await import('node:fs/promises');
      const filePath = join(
        this.config.projectRoot,
        this.config.checkpointPath,
        `${taskId}-checkpoint.json`
      );

      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Ignore deletion errors
    }
  }

  /**
   * Escalate to Controller
   * @param taskId - Task ID
   * @param workOrder - Original work order
   * @param error - Error information
   */
  public async escalate(
    taskId: string,
    workOrder: Record<string, unknown>,
    error: WorkerErrorInfo
  ): Promise<void> {
    const report: EscalationReport = {
      taskId,
      workerId: this.config.workerId,
      error,
      attempts: [...this.retryAttempts],
      context: {
        workOrder,
        progressSnapshot: this.currentCheckpoint?.progressSnapshot ?? {},
      },
      recommendation: this.generateRecommendation(error),
      timestamp: new Date().toISOString(),
    };

    // Log escalation
    if (this.config.verbose) {
      this.log(`Escalating task ${taskId}: ${error.message}`);
    }

    // Persist escalation report
    try {
      const reportDir = join(this.config.projectRoot, '.ad-sdlc/scratchpad/escalations');
      if (!existsSync(reportDir)) {
        await mkdir(reportDir, { recursive: true });
      }

      const filePath = join(reportDir, `${taskId}-escalation.json`);
      await writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    } catch (writeError) {
      if (this.config.verbose) {
        this.log(
          `Failed to save escalation report: ${writeError instanceof Error ? writeError.message : String(writeError)}`
        );
      }
    }

    // Call escalation callback if provided
    if (this.config.onEscalation !== undefined) {
      await this.config.onEscalation(report);
    }
  }

  /**
   * Generate recommendation based on error
   * @param error - Error information
   * @returns Recommendation string
   */
  private generateRecommendation(error: WorkerErrorInfo): string {
    switch (error.category) {
      case 'fatal':
        return `Requires manual intervention. ${error.suggestedAction}`;
      case 'recoverable':
        return `Automatic fix attempts exhausted. ${error.suggestedAction}`;
      case 'transient':
        return `Max retries exceeded due to transient failures. ${error.suggestedAction}`;
      default:
        return error.suggestedAction;
    }
  }

  /**
   * Get current checkpoint
   * @returns Current checkpoint or null
   */
  public getCurrentCheckpoint(): ProgressCheckpoint | null {
    return this.currentCheckpoint;
  }

  /**
   * Get all retry attempts
   * @returns Array of retry attempts
   */
  public getRetryAttempts(): readonly RetryAttempt[] {
    return [...this.retryAttempts];
  }

  /**
   * Get configuration
   * @returns Handler configuration
   */
  public getConfig(): Required<RetryHandlerConfig> {
    return { ...this.config };
  }

  /**
   * Sleep for a given duration
   * @param ms - Duration in milliseconds
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log a message (if verbose enabled)
   * @param message - Message to log
   */
  private log(message: string): void {
    console.log(`[RetryHandler:${this.config.workerId}] ${message}`);
  }
}
