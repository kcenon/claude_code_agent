/**
 * RetryExecutor - Unified retry execution service
 *
 * Provides a centralized retry mechanism that integrates:
 * - Pluggable backoff strategies (fixed, linear, exponential, fibonacci)
 * - Jitter support to prevent thundering herd
 * - Error categorization and classification
 * - Circuit breaker integration
 * - Comprehensive metrics collection
 *
 * @module error-handler/RetryExecutor
 */

import type { RetryPolicy, BackoffStrategy, ErrorClassifier, ErrorCategory } from './types.js';

import { RETRYABLE_ERROR_PATTERNS, NON_RETRYABLE_ERROR_PATTERNS } from './types.js';

import {
  MaxRetriesExceededError,
  OperationTimeoutError,
  OperationAbortedError,
  NonRetryableError,
  CircuitOpenError,
} from './errors.js';

import {
  calculateBackoffDelay,
  createBackoffConfig,
  type BackoffConfig,
} from './BackoffStrategies.js';

import { RetryMetrics, getGlobalRetryMetrics } from './RetryMetrics.js';

import { CircuitBreaker } from './CircuitBreaker.js';

import { getLogger } from '../logging/Logger.js';

/**
 * Retry execution options
 */
export interface RetryExecutionOptions {
  /** Operation name for logging and metrics */
  readonly operationName?: string;
  /** Abort signal for cancellation */
  readonly signal?: AbortSignal;
  /** Timeout in milliseconds for each attempt */
  readonly timeoutMs?: number;
  /** Custom error classifier */
  readonly errorClassifier?: ErrorClassifier;
  /** Circuit breaker for fault tolerance */
  readonly circuitBreaker?: CircuitBreaker;
  /** Whether retryable failures count toward circuit breaker (default: true) */
  readonly countRetryableFailures?: boolean;
  /** Metrics collector (uses global if not provided) */
  readonly metrics?: RetryMetrics;
}

/**
 * Retry execution result
 */
export interface RetryExecutionResult<T> {
  /** Whether the operation succeeded */
  readonly success: boolean;
  /** Result value if successful */
  readonly value?: T;
  /** Error if failed */
  readonly error?: Error;
  /** Number of attempts made */
  readonly attempts: number;
  /** Total duration in milliseconds */
  readonly totalDurationMs: number;
  /** Delays between attempts in milliseconds */
  readonly delays: readonly number[];
}

/**
 * Unified retry policy configuration
 */
export interface UnifiedRetryPolicy {
  /** Maximum number of retry attempts (default: 3) */
  readonly maxAttempts: number;
  /** Backoff strategy name (default: 'exponential') */
  readonly backoffStrategy: BackoffStrategy;
  /** Base delay in milliseconds (default: 1000) */
  readonly baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 60000) */
  readonly maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  readonly multiplier: number;
  /** Jitter ratio (0-1) to randomize delay (default: 0.25) */
  readonly jitterRatio: number;
}

/**
 * Default unified retry policy
 */
export const DEFAULT_UNIFIED_RETRY_POLICY: Readonly<UnifiedRetryPolicy> = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  multiplier: 2,
  jitterRatio: 0.25,
} as const;

/**
 * Predefined retry policies for common scenarios
 */
export const RETRY_POLICIES = {
  /** Default policy for general operations */
  default: DEFAULT_UNIFIED_RETRY_POLICY,

  /** Aggressive retry for critical operations */
  aggressive: {
    maxAttempts: 5,
    backoffStrategy: 'exponential' as const,
    baseDelayMs: 500,
    maxDelayMs: 30000,
    multiplier: 2,
    jitterRatio: 0.2,
  },

  /** Conservative retry for non-critical operations */
  conservative: {
    maxAttempts: 2,
    backoffStrategy: 'linear' as const,
    baseDelayMs: 2000,
    maxDelayMs: 10000,
    multiplier: 1,
    jitterRatio: 0.1,
  },

  /** Fast retry for quick operations */
  fast: {
    maxAttempts: 3,
    backoffStrategy: 'fixed' as const,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    multiplier: 1,
    jitterRatio: 0.5,
  },

  /** API call retry policy */
  apiCall: {
    maxAttempts: 3,
    backoffStrategy: 'exponential' as const,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
    jitterRatio: 0.25,
  },

  /** File I/O retry policy */
  fileIO: {
    maxAttempts: 3,
    backoffStrategy: 'fibonacci' as const,
    baseDelayMs: 500,
    maxDelayMs: 10000,
    multiplier: 1,
    jitterRatio: 0.1,
  },

  /** Database operation retry policy */
  database: {
    maxAttempts: 4,
    backoffStrategy: 'exponential' as const,
    baseDelayMs: 200,
    maxDelayMs: 5000,
    multiplier: 2,
    jitterRatio: 0.3,
  },
} as const;

/**
 * Default error classifier using pattern matching
 * @param error - The error to classify
 * @returns The error category indicating retryability
 */
export function defaultErrorClassifier(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  const code = (error as { code?: string }).code?.toLowerCase() ?? '';

  const searchText = `${message} ${name} ${code}`;

  // Check for non-retryable patterns first (more specific)
  for (const pattern of NON_RETRYABLE_ERROR_PATTERNS) {
    if (searchText.includes(pattern.toLowerCase())) {
      return 'non-retryable';
    }
  }

  // Check for retryable patterns
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (searchText.includes(pattern.toLowerCase())) {
      return 'retryable';
    }
  }

  // Default to unknown for ambiguous errors
  return 'unknown';
}

/**
 * Sleep for a specified duration with abort signal support
 * @param ms - Duration to sleep in milliseconds
 * @param signal - Optional abort signal to cancel the sleep
 * @returns A promise that resolves after the specified duration
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);

    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        reject(new OperationAbortedError(undefined, 'Aborted during delay'));
        return;
      }

      const abortHandler = (): void => {
        clearTimeout(timeoutId);
        reject(new OperationAbortedError(undefined, 'Aborted during delay'));
      };

      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}

/**
 * Wrap an operation with a timeout
 * @param operation - The async operation to execute with a timeout
 * @param timeoutMs - Timeout duration in milliseconds
 * @param operationName - Optional name of the operation for error messages
 * @returns A promise resolving to the operation result
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new OperationTimeoutError(timeoutMs, operationName));
      }
    }, timeoutMs);

    operation()
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch((error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
  });
}

/**
 * RetryExecutor - Centralized retry execution service
 *
 * @example
 * ```typescript
 * const executor = new RetryExecutor({
 *   maxAttempts: 3,
 *   backoffStrategy: 'exponential',
 *   jitterRatio: 0.25
 * });
 *
 * const result = await executor.execute(
 *   async () => await fetch('https://api.example.com/data'),
 *   { operationName: 'fetchData' }
 * );
 *
 * // Use predefined policy
 * const apiExecutor = RetryExecutor.withPolicy('apiCall');
 * ```
 */
export class RetryExecutor {
  private readonly policy: UnifiedRetryPolicy;
  private readonly backoffConfig: BackoffConfig;

  constructor(policyOverride?: Partial<UnifiedRetryPolicy>) {
    this.policy = {
      maxAttempts: policyOverride?.maxAttempts ?? DEFAULT_UNIFIED_RETRY_POLICY.maxAttempts,
      backoffStrategy:
        policyOverride?.backoffStrategy ?? DEFAULT_UNIFIED_RETRY_POLICY.backoffStrategy,
      baseDelayMs: policyOverride?.baseDelayMs ?? DEFAULT_UNIFIED_RETRY_POLICY.baseDelayMs,
      maxDelayMs: policyOverride?.maxDelayMs ?? DEFAULT_UNIFIED_RETRY_POLICY.maxDelayMs,
      multiplier: policyOverride?.multiplier ?? DEFAULT_UNIFIED_RETRY_POLICY.multiplier,
      jitterRatio: policyOverride?.jitterRatio ?? DEFAULT_UNIFIED_RETRY_POLICY.jitterRatio,
    };

    this.backoffConfig = createBackoffConfig({
      baseDelayMs: this.policy.baseDelayMs,
      maxDelayMs: this.policy.maxDelayMs,
      multiplier: this.policy.multiplier,
      jitterRatio: this.policy.jitterRatio,
    });
  }

  /**
   * Create a RetryExecutor with a predefined policy
   *
   * @param policyName - Name of the predefined policy
   * @returns RetryExecutor configured with the policy
   */
  public static withPolicy(policyName: keyof typeof RETRY_POLICIES): RetryExecutor {
    return new RetryExecutor(RETRY_POLICIES[policyName]);
  }

  /**
   * Get the configured policy
   * @returns The current unified retry policy configuration
   */
  public getPolicy(): UnifiedRetryPolicy {
    return this.policy;
  }

  /**
   * Execute an async operation with retry support
   *
   * @template T - Return type of the operation
   * @param operation - The async operation to execute
   * @param options - Execution options
   * @returns Promise resolving to the operation result
   * @throws MaxRetriesExceededError if all retries fail
   * @throws NonRetryableError if a non-retryable error is encountered
   * @throws OperationAbortedError if the operation is aborted
   */
  public async execute<T>(
    operation: () => Promise<T>,
    options: RetryExecutionOptions = {}
  ): Promise<T> {
    const result = await this.executeWithResult(operation, options);

    if (!result.success) {
      throw result.error ?? new Error('Unknown error during retry execution');
    }

    return result.value as T;
  }

  /**
   * Execute an async operation and return detailed result (never throws)
   *
   * @template T - Return type of the operation
   * @param operation - The async operation to execute
   * @param options - Execution options
   * @returns Promise resolving to detailed execution result
   */
  public async executeWithResult<T>(
    operation: () => Promise<T>,
    options: RetryExecutionOptions = {}
  ): Promise<RetryExecutionResult<T>> {
    const logger = getLogger();
    const operationName = options.operationName ?? 'unknown';
    const errorClassifier = options.errorClassifier ?? defaultErrorClassifier;
    const metrics = options.metrics ?? getGlobalRetryMetrics();
    const countRetryableFailures = options.countRetryableFailures ?? true;

    const metricsBuilder = metrics.createRecordBuilder(operationName, this.policy.backoffStrategy);
    const startTime = Date.now();
    const delays: number[] = [];
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
      const isFinalAttempt = attempt === this.policy.maxAttempts;

      // Check abort signal before each attempt
      if (options.signal?.aborted === true) {
        const error = new OperationAbortedError(operationName, 'Aborted before attempt');
        metricsBuilder.failure(error.message);
        return {
          success: false,
          error,
          attempts: attempt,
          totalDurationMs: Date.now() - startTime,
          delays,
        };
      }

      // Check circuit breaker before each attempt
      if (options.circuitBreaker !== undefined && !options.circuitBreaker.isAcceptingRequests()) {
        const remainingMs = options.circuitBreaker.getRemainingTimeout();
        const error = new CircuitOpenError(
          remainingMs,
          options.circuitBreaker.getFailureCount(),
          operationName
        );
        metricsBuilder.failure(error.message);
        return {
          success: false,
          error,
          attempts: attempt,
          totalDurationMs: Date.now() - startTime,
          delays,
        };
      }

      // Calculate delay for this attempt (0 for first attempt)
      const delayMs = attempt === 1 ? 0 : this.calculateDelay(attempt - 1);
      metricsBuilder.recordAttempt(delayMs);

      // Wait before retry (if not first attempt)
      if (delayMs > 0) {
        delays.push(delayMs);
        logger.debug(`Waiting ${String(delayMs)}ms before retry for '${operationName}'`, {
          attempt,
          delayMs,
        });

        try {
          await sleep(delayMs, options.signal);
        } catch (error) {
          if (error instanceof OperationAbortedError) {
            metricsBuilder.failure(error.message);
            return {
              success: false,
              error,
              attempts: attempt,
              totalDurationMs: Date.now() - startTime,
              delays,
            };
          }
          throw error;
        }
      }

      try {
        // Execute operation with optional timeout
        let result: T;
        if (options.timeoutMs !== undefined) {
          result = await withTimeout(operation, options.timeoutMs, operationName);
        } else {
          result = await operation();
        }

        // Success
        logger.info(`Retry succeeded for '${operationName}'`, {
          attempt,
          totalAttempts: this.policy.maxAttempts,
        });

        // Notify circuit breaker of success
        options.circuitBreaker?.recordSuccess();

        metricsBuilder.success();

        return {
          success: true,
          value: result,
          attempts: attempt,
          totalDurationMs: Date.now() - startTime,
          delays,
        };
      } catch (error) {
        const caughtError = error instanceof Error ? error : new Error(String(error));
        lastError = caughtError;

        // Categorize the error
        const category = errorClassifier(caughtError);
        const isRetryable = category !== 'non-retryable';

        logger.warn(
          `Retry attempt ${String(attempt)}/${String(this.policy.maxAttempts)} failed for '${operationName}'`,
          {
            attempt,
            maxAttempts: this.policy.maxAttempts,
            errorMessage: caughtError.message,
            category,
            isRetryable,
            isFinalAttempt,
          }
        );

        // Notify circuit breaker of failure
        if (options.circuitBreaker !== undefined && (!isRetryable || countRetryableFailures)) {
          options.circuitBreaker.recordFailure(caughtError);
        }

        // If non-retryable, stop immediately
        if (!isRetryable) {
          const wrappedError = new NonRetryableError(caughtError, category);
          metricsBuilder.failure(wrappedError.message);
          return {
            success: false,
            error: wrappedError,
            attempts: attempt,
            totalDurationMs: Date.now() - startTime,
            delays,
          };
        }

        // If final attempt, stop
        if (isFinalAttempt) {
          const wrappedError = new MaxRetriesExceededError(
            attempt,
            this.policy.maxAttempts,
            caughtError,
            [],
            operationName
          );
          metricsBuilder.failure(wrappedError.message);
          return {
            success: false,
            error: wrappedError,
            attempts: attempt,
            totalDurationMs: Date.now() - startTime,
            delays,
          };
        }
      }
    }

    // Should never reach here
    const error = new MaxRetriesExceededError(
      this.policy.maxAttempts,
      this.policy.maxAttempts,
      lastError,
      [],
      operationName
    );
    metricsBuilder.failure(error.message);
    return {
      success: false,
      error,
      attempts: this.policy.maxAttempts,
      totalDurationMs: Date.now() - startTime,
      delays,
    };
  }

  /**
   * Calculate delay for a retry attempt using the configured strategy
   *
   * @param attempt - Retry attempt number (1-based, after first attempt)
   * @returns Delay in milliseconds
   */
  public calculateDelay(attempt: number): number {
    return calculateBackoffDelay(this.policy.backoffStrategy, attempt, this.backoffConfig);
  }
}

/**
 * Execute an operation with retry using default policy
 *
 * @template T - Return type of the operation
 * @param operation - The async operation to execute
 * @param options - Execution options
 * @returns Promise resolving to the operation result
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options?: RetryExecutionOptions & { policy?: Partial<UnifiedRetryPolicy> }
): Promise<T> {
  const executor = new RetryExecutor(options?.policy);
  return executor.execute(operation, options);
}

/**
 * Create a retry-wrapped version of an async function
 *
 * @template TArgs - Function argument types
 * @template TResult - Function return type
 * @param fn - The async function to wrap
 * @param policy - Retry policy to use
 * @param defaultOptions - Default execution options
 * @returns A new function that will retry on failure
 */
export function createRetryableFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  policy?: Partial<UnifiedRetryPolicy>,
  defaultOptions?: RetryExecutionOptions
): (...args: TArgs) => Promise<TResult> {
  const executor = new RetryExecutor(policy);

  return async (...args: TArgs): Promise<TResult> => {
    return executor.execute(() => fn(...args), defaultOptions);
  };
}

/**
 * Convert legacy RetryPolicy to UnifiedRetryPolicy
 *
 * @param legacyPolicy - Legacy RetryPolicy
 * @returns UnifiedRetryPolicy
 */
export function fromLegacyPolicy(legacyPolicy: Partial<RetryPolicy>): UnifiedRetryPolicy {
  return {
    maxAttempts: legacyPolicy.maxAttempts ?? DEFAULT_UNIFIED_RETRY_POLICY.maxAttempts,
    backoffStrategy: legacyPolicy.backoff ?? DEFAULT_UNIFIED_RETRY_POLICY.backoffStrategy,
    baseDelayMs: legacyPolicy.baseDelayMs ?? DEFAULT_UNIFIED_RETRY_POLICY.baseDelayMs,
    maxDelayMs: legacyPolicy.maxDelayMs ?? DEFAULT_UNIFIED_RETRY_POLICY.maxDelayMs,
    multiplier: legacyPolicy.backoffMultiplier ?? DEFAULT_UNIFIED_RETRY_POLICY.multiplier,
    jitterRatio:
      legacyPolicy.enableJitter === true
        ? (legacyPolicy.jitterFactor ?? DEFAULT_UNIFIED_RETRY_POLICY.jitterRatio)
        : 0,
  };
}
