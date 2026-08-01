/**
 * Error Handler Module
 *
 * Provides robust retry logic with pluggable backoff strategies, jitter support,
 * error categorization, timeout handling, and comprehensive metrics collection.
 *
 * @module error-handler
 *
 * @example
 * ```typescript
 * // Canonical retry API
 * import { RetryExecutor, RETRY_POLICIES } from './error-handler';
 *
 * const executor = new RetryExecutor(RETRY_POLICIES.apiCall);
 * const result = await executor.execute(
 *   async () => await fetch('https://api.example.com/data'),
 *   { operationName: 'fetchData' }
 * );
 *
 * // Using predefined policies
 * const dbExecutor = RetryExecutor.withPolicy('database');
 * await dbExecutor.execute(() => db.query('SELECT ...'));
 *
 * // Get retry metrics
 * import { getGlobalRetryMetrics } from './error-handler';
 * const metrics = getGlobalRetryMetrics().getSnapshot();
 * console.log('Success rate:', metrics.successRate);
 * ```
 */

// Types
export type {
  BackoffStrategy,
  ErrorCategory,
  RetryAttemptResult,
  ErrorClassifier,
  // Circuit breaker types
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerEvent,
  CircuitBreakerEventType,
  CircuitBreakerEventCallback,
} from './types.js';

export {
  RETRYABLE_ERROR_PATTERNS,
  NON_RETRYABLE_ERROR_PATTERNS,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
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
  CircuitOpenError,
  InvalidCircuitBreakerConfigError,
} from './errors.js';

// Circuit breaker
export { CircuitBreaker, createCircuitBreakerFunction } from './CircuitBreaker.js';

// Backoff strategies
export type {
  BackoffConfig,
  BackoffStrategy as BackoffStrategyInterface,
} from './BackoffStrategies.js';
export {
  DEFAULT_BACKOFF_CONFIG,
  FixedBackoff,
  LinearBackoff,
  ExponentialBackoff,
  FibonacciBackoff,
  getBackoffStrategy,
  registerBackoffStrategy,
  getAvailableStrategies,
  createBackoffConfig,
  calculateBackoffDelay,
  applyJitter,
  capDelay,
} from './BackoffStrategies.js';

// Retry metrics
export type {
  RetryOperationRecord,
  RetryMetricsSnapshot,
  OperationMetrics,
  StrategyMetrics,
} from './RetryMetrics.js';
export {
  RetryMetrics,
  RecordBuilder,
  getGlobalRetryMetrics,
  resetGlobalRetryMetrics,
} from './RetryMetrics.js';

// Canonical retry executor
export type {
  RetryExecutionOptions,
  RetryExecutionResult,
  RetryDecisionContext,
  RetryPolicy,
} from './RetryExecutor.js';
export {
  RetryExecutor,
  DEFAULT_RETRY_POLICY,
  RETRY_POLICIES,
  defaultErrorClassifier,
  executeWithRetry,
  createRetryableFunction,
} from './RetryExecutor.js';
