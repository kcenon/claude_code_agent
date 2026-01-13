/**
 * RetryHandler - Robust retry logic with exponential backoff
 *
 * Features:
 * - Configurable retry policy with exponential backoff
 * - Jitter support to prevent thundering herd
 * - Error categorization (retryable vs non-retryable)
 * - Timeout handling for long-running operations
 * - Detailed logging and monitoring callbacks
 * - Abort signal support for cancellation
 *
 * @module error-handler/RetryHandler
 */

import type {
  RetryPolicy,
  RetryContext,
  RetryAttemptResult,
  RetryResult,
  ErrorClassifier,
  ErrorCategory,
  WithRetryOptions,
  TimeoutConfig,
} from './types.js';

import {
  DEFAULT_RETRY_POLICY,
  RETRYABLE_ERROR_PATTERNS,
  NON_RETRYABLE_ERROR_PATTERNS,
} from './types.js';

import {
  MaxRetriesExceededError,
  OperationTimeoutError,
  OperationAbortedError,
  NonRetryableError,
  InvalidRetryPolicyError,
  CircuitOpenError,
} from './errors.js';

import { getLogger } from '../monitoring/Logger.js';

import { CircuitBreaker } from './CircuitBreaker.js';

/**
 * Validates a retry policy configuration
 * @throws InvalidRetryPolicyError if policy is invalid
 */
function validatePolicy(policy: RetryPolicy): void {
  if (policy.maxAttempts < 1) {
    throw new InvalidRetryPolicyError('maxAttempts', policy.maxAttempts, 'must be >= 1');
  }
  if (policy.baseDelayMs < 0) {
    throw new InvalidRetryPolicyError('baseDelayMs', policy.baseDelayMs, 'must be >= 0');
  }
  if (policy.maxDelayMs < policy.baseDelayMs) {
    throw new InvalidRetryPolicyError(
      'maxDelayMs',
      policy.maxDelayMs,
      `must be >= baseDelayMs (${String(policy.baseDelayMs)})`
    );
  }
  if (policy.backoffMultiplier < 1) {
    throw new InvalidRetryPolicyError(
      'backoffMultiplier',
      policy.backoffMultiplier,
      'must be >= 1'
    );
  }
  if (policy.jitterFactor < 0 || policy.jitterFactor > 1) {
    throw new InvalidRetryPolicyError(
      'jitterFactor',
      policy.jitterFactor,
      'must be between 0 and 1'
    );
  }
}

/**
 * Merges partial policy with defaults
 */
function mergePolicy(partial?: Partial<RetryPolicy>): RetryPolicy {
  const policy: RetryPolicy = {
    maxAttempts: partial?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    baseDelayMs: partial?.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
    maxDelayMs: partial?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
    backoffMultiplier: partial?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier,
    backoff: partial?.backoff ?? DEFAULT_RETRY_POLICY.backoff,
    enableJitter: partial?.enableJitter ?? DEFAULT_RETRY_POLICY.enableJitter,
    jitterFactor: partial?.jitterFactor ?? DEFAULT_RETRY_POLICY.jitterFactor,
  };
  validatePolicy(policy);
  return policy;
}

/**
 * Default error classifier using pattern matching
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

  // Default to retryable for unknown errors
  return 'unknown';
}

/**
 * Calculate delay for a retry attempt using the configured backoff strategy
 */
export function calculateDelay(attempt: number, policy: RetryPolicy): number {
  let delay: number;

  switch (policy.backoff) {
    case 'fixed':
      delay = policy.baseDelayMs;
      break;
    case 'linear':
      delay = policy.baseDelayMs * attempt;
      break;
    case 'exponential':
    default:
      // Exponential: baseDelay * multiplier^(attempt-1)
      delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
      break;
  }

  // Apply jitter if enabled
  if (policy.enableJitter && policy.jitterFactor > 0) {
    // Random jitter: delay * (1 ± jitterFactor/2)
    const jitterRange = delay * policy.jitterFactor;
    const jitter = (Math.random() - 0.5) * jitterRange;
    delay = delay + jitter;
  }

  // Cap at maxDelay
  delay = Math.min(delay, policy.maxDelayMs);

  // Ensure non-negative
  return Math.max(0, Math.floor(delay));
}

/**
 * Sleep for a specified duration with abort signal support
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

      // Clean up listener when timeout completes
      const originalResolve = resolve;
      (resolve as unknown) = (): void => {
        signal.removeEventListener('abort', abortHandler);
        originalResolve();
      };
    }
  });
}

/**
 * Wrap an operation with a timeout
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  config: TimeoutConfig,
  operationName?: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new OperationTimeoutError(config.timeoutMs, operationName));
      }
    }, config.timeoutMs);

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
 * Execute an async operation with retry support
 *
 * @template T - Return type of the operation
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws MaxRetriesExceededError if all retries fail
 * @throws NonRetryableError if a non-retryable error is encountered
 * @throws OperationAbortedError if the operation is aborted
 *
 * @example
 * ```typescript
 * // Basic usage with default policy
 * const result = await withRetry(
 *   async () => await fetch('https://api.example.com/data'),
 *   { operationName: 'fetchData' }
 * );
 *
 * // Custom policy
 * const result = await withRetry(
 *   async () => await riskyOperation(),
 *   {
 *     policy: { maxAttempts: 5, baseDelayMs: 1000 },
 *     timeout: { timeoutMs: 30000 },
 *     operationName: 'riskyOperation'
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: WithRetryOptions<T> = {}
): Promise<T> {
  const policy = mergePolicy(options.policy);
  const errorClassifier = options.errorClassifier ?? defaultErrorClassifier;
  const logger = getLogger();
  const operationName = options.operationName ?? 'unknown';

  // Extract circuit breaker if provided
  const circuitBreaker = options.circuitBreaker?.breaker as CircuitBreaker | undefined;
  const countRetryableFailures = options.circuitBreaker?.countRetryableFailures ?? true;

  const attemptResults: RetryAttemptResult[] = [];
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    const attemptStartTime = Date.now();
    const isFinalAttempt = attempt === policy.maxAttempts;

    // Check abort signal before each attempt
    if (options.signal?.aborted === true) {
      throw new OperationAbortedError(operationName, 'Aborted before attempt');
    }

    // Check circuit breaker before each attempt
    if (circuitBreaker !== undefined && !circuitBreaker.isAcceptingRequests()) {
      const remainingMs = circuitBreaker.getRemainingTimeout();
      logger.warn(`Circuit breaker blocking retry for '${operationName}'`, {
        attempt,
        remainingTimeoutMs: remainingMs,
        circuitState: circuitBreaker.getState(),
      });
      throw new CircuitOpenError(remainingMs, circuitBreaker.getFailureCount(), operationName);
    }

    const context: RetryContext = {
      attempt,
      maxAttempts: policy.maxAttempts,
      elapsedMs: Date.now() - startTime,
      lastError,
      isFinalAttempt,
    };

    try {
      // Execute operation with optional timeout
      let result: T;
      if (options.timeout !== undefined) {
        result = await withTimeout(operation, options.timeout, operationName);
      } else {
        result = await operation();
      }

      // Apply result transformation if provided
      if (options.transformResult !== undefined) {
        result = options.transformResult(result);
      }

      const attemptResult: RetryAttemptResult = {
        attempt,
        success: true,
        durationMs: Date.now() - attemptStartTime,
      };

      attemptResults.push(attemptResult);

      // Log success
      logger.info(`Retry succeeded for '${operationName}'`, {
        attempt,
        totalAttempts: policy.maxAttempts,
        durationMs: attemptResult.durationMs,
      });

      // Fire callback if provided
      options.onAttempt?.(context, attemptResult);

      // Notify circuit breaker of success
      if (circuitBreaker !== undefined) {
        circuitBreaker.recordSuccess();
      }

      return result;
    } catch (error) {
      const caughtError = error instanceof Error ? error : new Error(String(error));
      lastError = caughtError;

      // Categorize the error
      const category = errorClassifier(caughtError);
      const isRetryable = category !== 'non-retryable';

      // Calculate next delay (for logging)
      const nextRetryDelayMs =
        !isFinalAttempt && isRetryable ? calculateDelay(attempt, policy) : undefined;

      const attemptResult: RetryAttemptResult = {
        attempt,
        success: false,
        durationMs: Date.now() - attemptStartTime,
        error: caughtError,
        nextRetryDelayMs,
        isRetryable,
      };

      attemptResults.push(attemptResult);

      // Log the failure
      logger.warn(
        `Retry attempt ${String(attempt)}/${String(policy.maxAttempts)} failed for '${operationName}'`,
        {
          attempt,
          maxAttempts: policy.maxAttempts,
          errorMessage: caughtError.message,
          errorName: caughtError.name,
          category,
          isRetryable,
          nextRetryDelayMs,
          isFinalAttempt,
        }
      );

      // Fire callback if provided
      options.onAttempt?.(context, attemptResult);

      // Notify circuit breaker of failure (for non-retryable or when counting retryable)
      if (circuitBreaker !== undefined && (!isRetryable || countRetryableFailures)) {
        circuitBreaker.recordFailure(caughtError);
      }

      // If non-retryable, throw immediately
      if (!isRetryable) {
        logger.error(`Non-retryable error for '${operationName}'`, caughtError, {
          attempt,
          category,
        });
        throw new NonRetryableError(caughtError, category);
      }

      // If this was the final attempt, throw max retries exceeded
      if (isFinalAttempt) {
        throw new MaxRetriesExceededError(
          attempt,
          policy.maxAttempts,
          caughtError,
          attemptResults,
          operationName
        );
      }

      // Wait before next retry
      if (nextRetryDelayMs !== undefined) {
        logger.debug(`Waiting ${String(nextRetryDelayMs)}ms before retry for '${operationName}'`, {
          attempt,
          nextRetryDelayMs,
        });
        await sleep(nextRetryDelayMs, options.signal);
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new MaxRetriesExceededError(
    policy.maxAttempts,
    policy.maxAttempts,
    lastError,
    attemptResults,
    operationName
  );
}

/**
 * Execute an async operation with retry support and return detailed result
 *
 * Unlike withRetry, this function never throws and instead returns a result object
 * containing success/failure status and all attempt details.
 *
 * Tracks actual retry attempts:
 * - Collects all attempt results via onAttempt callback
 * - Propagates attempt details for both success and failure cases
 *
 * @template T - Return type of the operation
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to detailed retry result
 *
 * @example
 * ```typescript
 * const result = await withRetryResult(
 *   async () => await fetch('https://api.example.com/data'),
 *   { operationName: 'fetchData' }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.value);
 *   console.log('Attempts:', result.totalAttempts);
 * } else {
 *   console.error('Failed after', result.totalAttempts, 'attempts');
 * }
 * ```
 */
export async function withRetryResult<T>(
  operation: () => Promise<T>,
  options: WithRetryOptions<T> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  const collectedAttempts: RetryAttemptResult[] = [];

  // Create a wrapped onAttempt callback to collect all attempts
  const originalOnAttempt = options.onAttempt;
  const wrappedOptions: WithRetryOptions<T> = {
    ...options,
    onAttempt: (context, result) => {
      collectedAttempts.push(result);
      originalOnAttempt?.(context, result);
    },
  };

  try {
    const value = await withRetry(operation, wrappedOptions);

    // Calculate total attempts from collected results
    const totalAttempts = collectedAttempts.length > 0 ? collectedAttempts.length : 1;

    return {
      success: true,
      value,
      totalAttempts,
      totalDurationMs: Date.now() - startTime,
      attempts: collectedAttempts,
    };
  } catch (error) {
    const caughtError = error instanceof Error ? error : new Error(String(error));

    // Use collected attempts, or extract from MaxRetriesExceededError as fallback
    let attempts: readonly RetryAttemptResult[] = collectedAttempts;
    let totalAttempts = collectedAttempts.length;

    if (collectedAttempts.length === 0 && error instanceof MaxRetriesExceededError) {
      attempts = error.attemptResults;
      totalAttempts = error.attempts;
    }

    // Ensure totalAttempts is at least 1
    totalAttempts = totalAttempts > 0 ? totalAttempts : 1;

    return {
      success: false,
      error: caughtError,
      totalAttempts,
      totalDurationMs: Date.now() - startTime,
      attempts,
    };
  }
}

/**
 * Create a retry-wrapped version of an async function
 *
 * @template TArgs - Function argument types
 * @template TResult - Function return type
 * @param fn - The async function to wrap
 * @param options - Retry configuration options
 * @returns A new function that will retry on failure
 *
 * @example
 * ```typescript
 * const fetchWithRetry = createRetryableFunction(
 *   async (url: string) => await fetch(url),
 *   { policy: { maxAttempts: 3 }, operationName: 'fetch' }
 * );
 *
 * const response = await fetchWithRetry('https://api.example.com/data');
 * ```
 */
export function createRetryableFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: WithRetryOptions<TResult> = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withRetry(() => fn(...args), options);
  };
}

/**
 * Retry handler class for more complex retry scenarios
 */
export class RetryHandler {
  private readonly policy: RetryPolicy;
  private readonly errorClassifier: ErrorClassifier;

  constructor(policyOverride?: Partial<RetryPolicy>, errorClassifier?: ErrorClassifier) {
    this.policy = mergePolicy(policyOverride);
    this.errorClassifier = errorClassifier ?? defaultErrorClassifier;
  }

  /**
   * Get the configured retry policy
   */
  public getPolicy(): RetryPolicy {
    return this.policy;
  }

  /**
   * Execute an operation with this handler's retry policy
   */
  public async execute<T>(
    operation: () => Promise<T>,
    options: Omit<WithRetryOptions<T>, 'policy' | 'errorClassifier'> = {}
  ): Promise<T> {
    return withRetry(operation, {
      ...options,
      policy: this.policy,
      errorClassifier: this.errorClassifier,
    });
  }

  /**
   * Execute an operation and return detailed result
   */
  public async executeWithResult<T>(
    operation: () => Promise<T>,
    options: Omit<WithRetryOptions<T>, 'policy' | 'errorClassifier'> = {}
  ): Promise<RetryResult<T>> {
    return withRetryResult(operation, {
      ...options,
      policy: this.policy,
      errorClassifier: this.errorClassifier,
    });
  }

  /**
   * Classify an error using this handler's classifier
   */
  public classifyError(error: Error): ErrorCategory {
    return this.errorClassifier(error);
  }

  /**
   * Calculate delay for a specific attempt
   */
  public calculateDelayForAttempt(attempt: number): number {
    return calculateDelay(attempt, this.policy);
  }
}
