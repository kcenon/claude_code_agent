/**
 * Intelligent CI Poller module
 *
 * Implements intelligent polling for CI/CD status with:
 * - Exponential backoff with jitter
 * - Circuit breaker integration
 * - Failure classification (transient, persistent, terminal)
 * - Maximum poll limits
 * - Fast-fail on terminal errors
 *
 * @module pr-reviewer/IntelligentCIPoller
 */

import type {
  IntelligentPollerConfig,
  CIPollResult,
  FailureType,
  CICheckFailure,
  GitHubStatusCheck,
} from './types.js';
import { DEFAULT_INTELLIGENT_POLLER_CONFIG } from './types.js';
import { CICircuitBreaker } from './CICircuitBreaker.js';
import { CircuitOpenError } from './errors.js';

/**
 * CI status from GitHub check
 */
interface CIStatus {
  /** Overall state */
  readonly state: 'pending' | 'running' | 'success' | 'failure';
  /** Individual check results */
  readonly checks: readonly GitHubStatusCheck[];
  /** Failed checks with details */
  readonly failedChecks: readonly CICheckFailure[];
  /** Error message if any */
  readonly error?: string;
}

/**
 * Status check callback type
 */
export type CIStatusChecker = (prNumber: number) => Promise<CIStatus>;

/**
 * Event types emitted by the poller
 */
export type PollerEvent =
  | { type: 'poll_start'; prNumber: number; pollCount: number; interval: number }
  | { type: 'poll_complete'; prNumber: number; pollCount: number; state: string }
  | { type: 'backoff'; prNumber: number; newInterval: number; reason: string }
  | { type: 'failure_classified'; prNumber: number; failure: CICheckFailure }
  | { type: 'terminal_failure'; prNumber: number; failure: CICheckFailure }
  | { type: 'circuit_opened'; prNumber: number; failures: number };

/**
 * Event listener callback type
 */
export type PollerEventListener = (event: PollerEvent) => void;

/**
 * Intelligent CI Poller
 *
 * Polls CI status with exponential backoff, circuit breaker protection,
 * and intelligent failure classification.
 */
export class IntelligentCIPoller {
  private readonly config: IntelligentPollerConfig;
  private readonly circuitBreaker: CICircuitBreaker;
  private readonly listeners: PollerEventListener[] = [];

  constructor(config: Partial<IntelligentPollerConfig> = {}, circuitBreaker?: CICircuitBreaker) {
    this.config = {
      initialIntervalMs:
        config.initialIntervalMs ?? DEFAULT_INTELLIGENT_POLLER_CONFIG.initialIntervalMs,
      maxIntervalMs: config.maxIntervalMs ?? DEFAULT_INTELLIGENT_POLLER_CONFIG.maxIntervalMs,
      backoffMultiplier:
        config.backoffMultiplier ?? DEFAULT_INTELLIGENT_POLLER_CONFIG.backoffMultiplier,
      maxJitterMs: config.maxJitterMs ?? DEFAULT_INTELLIGENT_POLLER_CONFIG.maxJitterMs,
      maxPolls: config.maxPolls ?? DEFAULT_INTELLIGENT_POLLER_CONFIG.maxPolls,
      failFastOnTerminal:
        config.failFastOnTerminal ?? DEFAULT_INTELLIGENT_POLLER_CONFIG.failFastOnTerminal,
    };

    this.circuitBreaker = circuitBreaker ?? new CICircuitBreaker();
  }

  /**
   * Poll CI status until completion or failure
   *
   * @param prNumber - PR number to poll
   * @param statusChecker - Function to check CI status
   * @returns Poll result with success/failure details
   */
  public async pollUntilComplete(
    prNumber: number,
    statusChecker: CIStatusChecker
  ): Promise<CIPollResult> {
    const startTime = Date.now();
    let pollCount = 0;
    let interval = this.config.initialIntervalMs;

    while (pollCount < this.config.maxPolls) {
      // Check circuit breaker
      if (!this.circuitBreaker.canAttempt()) {
        const status = this.circuitBreaker.getStatus();
        this.emit({
          type: 'circuit_opened',
          prNumber,
          failures: status.failures,
        });

        return {
          success: false,
          reason: 'circuit_open',
          pollCount,
          elapsedMs: Date.now() - startTime,
        };
      }

      // Prepare for attempt (may throw CircuitOpenError)
      try {
        this.circuitBreaker.prepareForAttempt();
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          return {
            success: false,
            reason: 'circuit_open',
            pollCount,
            elapsedMs: Date.now() - startTime,
          };
        }
        throw error;
      }

      pollCount++;

      this.emit({
        type: 'poll_start',
        prNumber,
        pollCount,
        interval,
      });

      try {
        const status = await statusChecker(prNumber);

        this.emit({
          type: 'poll_complete',
          prNumber,
          pollCount,
          state: status.state,
        });

        // Handle different states
        if (status.state === 'success') {
          this.circuitBreaker.recordSuccess();
          return {
            success: true,
            pollCount,
            elapsedMs: Date.now() - startTime,
          };
        }

        if (status.state === 'failure') {
          // Classify failures
          for (const failure of status.failedChecks) {
            this.emit({
              type: 'failure_classified',
              prNumber,
              failure,
            });

            // Terminal failures should stop immediately
            if (failure.failureType === 'terminal' && this.config.failFastOnTerminal) {
              this.emit({
                type: 'terminal_failure',
                prNumber,
                failure,
              });

              this.circuitBreaker.recordFailure('terminal');

              return {
                success: false,
                reason: 'terminal_failure',
                failureDetails: failure,
                pollCount,
                elapsedMs: Date.now() - startTime,
              };
            }
          }

          // Record failure for circuit breaker
          const firstFailure = status.failedChecks[0];
          this.circuitBreaker.recordFailure(firstFailure?.failureType);
        }

        // Still pending or running - continue polling with backoff
        interval = this.calculateNextInterval(interval, status.state);

        this.emit({
          type: 'backoff',
          prNumber,
          newInterval: interval,
          reason: status.state === 'failure' ? 'failure' : 'pending',
        });

        await this.delay(interval);
      } catch {
        // Network or API errors
        this.circuitBreaker.recordFailure('transient');

        // Apply backoff and continue
        interval = this.calculateNextInterval(interval, 'error');
        await this.delay(interval);
      }
    }

    // Exceeded max polls
    return {
      success: false,
      reason: 'max_polls_exceeded',
      pollCount,
      elapsedMs: Date.now() - startTime,
    };
  }

  /**
   * Classify a CI check failure
   *
   * @param check - The failed check
   * @param errorMessage - Optional error message
   * @returns Classified failure details
   */
  public classifyFailure(check: GitHubStatusCheck, errorMessage?: string): CICheckFailure {
    const failureType = this.determineFailureType(check.name, errorMessage);

    const result: CICheckFailure = {
      name: check.name,
      failureType,
      recoverable: failureType !== 'terminal',
    };

    // Only include errorMessage if it's defined
    if (errorMessage !== undefined) {
      return { ...result, errorMessage };
    }

    return result;
  }

  /**
   * Determine the type of failure based on check name and error
   */
  public determineFailureType(checkName: string, errorMessage?: string): FailureType {
    const lowerName = checkName.toLowerCase();
    const lowerError = errorMessage?.toLowerCase() ?? '';

    // Terminal failures - cannot be fixed automatically
    const terminalPatterns = [
      'configuration',
      'config-validation',
      'config error',
      'config_error',
      'unauthorized',
      'forbidden',
      'invalid token',
      'permission denied',
      'access denied',
      'syntax error',
      'syntax-error',
      'syntax-check',
      'parse error',
      'parse-error',
      'invalid yaml',
      'invalid json',
      'missing required',
      'dependency not found',
      'module not found',
    ];

    for (const pattern of terminalPatterns) {
      if (lowerName.includes(pattern) || lowerError.includes(pattern)) {
        return 'terminal';
      }
    }

    // Transient failures - can potentially be fixed or retry
    const transientPatterns = [
      'test',
      'lint',
      'build',
      'compile',
      'type-check',
      'format',
      'coverage',
    ];

    for (const pattern of transientPatterns) {
      if (lowerName.includes(pattern)) {
        return 'transient';
      }
    }

    // Check for specific transient error patterns
    const transientErrorPatterns = [
      'timeout',
      'rate limit',
      'network error',
      'connection refused',
      'temporary',
      'retry',
      'flaky',
    ];

    for (const pattern of transientErrorPatterns) {
      if (lowerError.includes(pattern)) {
        return 'transient';
      }
    }

    // Default to persistent - needs investigation
    return 'persistent';
  }

  /**
   * Get the circuit breaker instance
   */
  public getCircuitBreaker(): CICircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Get configuration
   */
  public getConfig(): IntelligentPollerConfig {
    return { ...this.config };
  }

  /**
   * Register an event listener
   */
  public onEvent(listener: PollerEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Reset the poller state (including circuit breaker)
   */
  public reset(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Calculate the next polling interval with exponential backoff and jitter
   */
  private calculateNextInterval(currentInterval: number, state: string): number {
    // Apply different backoff based on state
    let multiplier = this.config.backoffMultiplier;

    if (state === 'failure' || state === 'error') {
      // Faster backoff on failures
      multiplier = multiplier * 1.5;
    }

    // Calculate base interval with backoff
    let nextInterval = currentInterval * multiplier;

    // Cap at maximum
    nextInterval = Math.min(nextInterval, this.config.maxIntervalMs);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.maxJitterMs;
    nextInterval += jitter;

    return Math.floor(nextInterval);
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: PollerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create a status checker from GitHub PR info
 *
 * @param getPRInfo - Function to get PR info from GitHub
 * @returns Status checker function
 */
export function createStatusChecker(
  getPRInfo: (prNumber: number) => Promise<{
    statusCheckRollup: readonly GitHubStatusCheck[];
  }>
): CIStatusChecker {
  return async (prNumber: number): Promise<CIStatus> => {
    const prInfo = await getPRInfo(prNumber);
    const checks = prInfo.statusCheckRollup;

    // Determine overall state
    const hasPending = checks.some((c) => c.status === 'pending' || c.status === 'running');
    const hasFailure = checks.some((c) => c.status === 'failed' || c.conclusion === 'failure');
    const allPassed = checks.every(
      (c) => c.status === 'passed' || c.status === 'skipped' || c.conclusion === 'success'
    );

    let state: 'pending' | 'running' | 'success' | 'failure';
    if (allPassed && checks.length > 0) {
      state = 'success';
    } else if (hasFailure) {
      state = 'failure';
    } else if (hasPending) {
      state = 'pending';
    } else {
      state = 'pending';
    }

    // Classify failed checks
    const failedChecks: CICheckFailure[] = checks
      .filter((c) => c.status === 'failed' || c.conclusion === 'failure')
      .map((c) => {
        const poller = new IntelligentCIPoller();
        return poller.classifyFailure(c);
      });

    return {
      state,
      checks,
      failedChecks,
    };
  };
}
