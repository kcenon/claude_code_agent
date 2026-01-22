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
 * // New unified API with RetryExecutor
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
 * // Legacy API still supported
 * import { withRetry, RetryHandler, DEFAULT_RETRY_POLICY } from './error-handler';
 *
 * const result = await withRetry(
 *   async () => await fetchData(),
 *   {
 *     policy: { maxAttempts: 3, baseDelayMs: 1000 },
 *     timeout: { timeoutMs: 30000 },
 *     operationName: 'fetchData'
 *   }
 * );
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
  RetryPolicy,
  TimeoutConfig,
  RetryContext,
  RetryAttemptResult,
  RetryResult,
  ErrorClassifier,
  RetryEventCallback,
  WithRetryOptions,
  CircuitBreakerIntegration,
  // Circuit breaker types
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerEvent,
  CircuitBreakerEventType,
  CircuitBreakerEventCallback,
} from './types.js';

export {
  DEFAULT_RETRY_POLICY,
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

// Core functionality
export {
  withRetry,
  withRetryResult,
  createRetryableFunction,
  calculateDelay,
  defaultErrorClassifier,
  RetryHandler,
} from './RetryHandler.js';

// Circuit breaker
export { CircuitBreaker, createCircuitBreakerFunction } from './CircuitBreaker.js';

// Backoff strategies
export type { BackoffConfig, BackoffStrategy as BackoffStrategyInterface } from './BackoffStrategies.js';
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

// Unified retry executor
export type {
  RetryExecutionOptions,
  RetryExecutionResult,
  UnifiedRetryPolicy,
} from './RetryExecutor.js';
export {
  RetryExecutor,
  DEFAULT_UNIFIED_RETRY_POLICY,
  RETRY_POLICIES,
  defaultErrorClassifier as unifiedDefaultErrorClassifier,
  executeWithRetry,
  createRetryableFunction as createUnifiedRetryableFunction,
  fromLegacyPolicy,
} from './RetryExecutor.js';
