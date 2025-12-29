/**
 * Error Handler Module
 *
 * Provides robust retry logic with exponential backoff, jitter support,
 * error categorization, and timeout handling for agent operations.
 *
 * @module error-handler
 *
 * @example
 * ```typescript
 * import { withRetry, RetryHandler, DEFAULT_RETRY_POLICY } from './error-handler';
 *
 * // Simple usage with withRetry function
 * const result = await withRetry(
 *   async () => await fetchData(),
 *   {
 *     policy: { maxAttempts: 3, baseDelayMs: 1000 },
 *     timeout: { timeoutMs: 30000 },
 *     operationName: 'fetchData'
 *   }
 * );
 *
 * // Class-based usage for complex scenarios
 * const handler = new RetryHandler({ maxAttempts: 5 });
 * const data = await handler.execute(async () => await riskyOperation());
 * ```
 */

// Types
export type {
  BackoffStrategy,
  ErrorCategory,
  RetryPolicy,
  TimeoutConfig,
  RetryContext,
  RetryAttemptResult,
  RetryResult,
  ErrorClassifier,
  RetryEventCallback,
  WithRetryOptions,
} from './types.js';

export {
  DEFAULT_RETRY_POLICY,
  RETRYABLE_ERROR_PATTERNS,
  NON_RETRYABLE_ERROR_PATTERNS,
} from './types.js';

// Errors
export {
  ErrorHandlerError,
  MaxRetriesExceededError,
  OperationTimeoutError,
  OperationAbortedError,
  NonRetryableError,
  InvalidRetryPolicyError,
  RetryContextError,
} from './errors.js';

// Core functionality
export {
  withRetry,
  withRetryResult,
  createRetryableFunction,
  calculateDelay,
  defaultErrorClassifier,
  RetryHandler,
} from './RetryHandler.js';
