/**
 * Error Handler module type definitions
 *
 * Provides types for retry policies, error categorization,
 * timeout handling configurations, and circuit breaker settings.
 *
 * @module error-handler/types
 */

/**
 * Backoff strategy for retry delays
 */
export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'fibonacci';

/**
 * Error categories for retry decision making
 */
export type ErrorCategory = 'retryable' | 'non-retryable' | 'unknown';

/**
 * Retry attempt result for logging and monitoring
 */
export interface RetryAttemptResult {
  /** Attempt number (1-based) */
  readonly attempt: number;
  /** Whether the attempt was successful */
  readonly success: boolean;
  /** Duration of the attempt in milliseconds */
  readonly durationMs: number;
  /** Error if the attempt failed */
  readonly error?: Error | undefined;
  /** Delay before next retry (if applicable) */
  readonly nextRetryDelayMs?: number | undefined;
  /** Whether the error was categorized as retryable */
  readonly isRetryable?: boolean | undefined;
}

/**
 * Error classifier function type
 */
export type ErrorClassifier = (error: Error) => ErrorCategory;

/**
 * Retryable error patterns
 */
export const RETRYABLE_ERROR_PATTERNS: readonly string[] = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'rate limit',
  'rate_limit',
  'too many requests',
  'service unavailable',
  'temporarily unavailable',
  'timeout',
  'timed out',
  '429',
  '502',
  '503',
  '504',
] as const;

/**
 * Non-retryable error patterns
 */
export const NON_RETRYABLE_ERROR_PATTERNS: readonly string[] = [
  'validation',
  'invalid',
  'unauthorized',
  'forbidden',
  'not found',
  'permission denied',
  'authentication',
  'auth failed',
  'bad request',
  'schema',
  '400',
  '401',
  '403',
  '404',
  '422',
] as const;

/**
 * Circuit breaker state enumeration
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  readonly failureThreshold: number;
  /** Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN (default: 60000) */
  readonly resetTimeoutMs: number;
  /** Maximum number of test requests allowed in HALF_OPEN state (default: 3) */
  readonly halfOpenMaxAttempts: number;
  /** Number of successful HALF_OPEN requests required to close (defaults to halfOpenMaxAttempts) */
  readonly successThreshold?: number | undefined;
  /** Optional rolling window for counting failures; omitted means consecutive failures */
  readonly failureWindowMs?: number | undefined;
  /** Optional name for logging and monitoring */
  readonly name?: string | undefined;
}

/**
 * Circuit breaker status for monitoring
 */
export interface CircuitBreakerStatus {
  /** Current state of the circuit breaker */
  readonly state: CircuitState;
  /** Current failure count */
  readonly failureCount: number;
  /** Number of successful calls in HALF_OPEN state */
  readonly halfOpenSuccessCount: number;
  /** Timestamp of the last failure (undefined if no failures) */
  readonly lastFailureTime?: number | undefined;
  /** Time remaining until reset (only applicable in OPEN state) */
  readonly timeUntilResetMs?: number | undefined;
  /** Whether the circuit is currently accepting requests */
  readonly isAcceptingRequests: boolean;
  /** Total number of requests blocked due to open circuit */
  readonly blockedRequestCount: number;
}

/**
 * Circuit breaker event types for monitoring
 */
export type CircuitBreakerEventType =
  'state_change' | 'failure_recorded' | 'success_recorded' | 'request_blocked' | 'reset';

/**
 * Circuit breaker event data
 */
export interface CircuitBreakerEvent {
  /** Type of event */
  readonly type: CircuitBreakerEventType;
  /** Previous state (for state_change events) */
  readonly previousState?: CircuitState;
  /** New state (for state_change events) */
  readonly newState?: CircuitState;
  /** Current failure count */
  readonly failureCount: number;
  /** Timestamp of the event */
  readonly timestamp: number;
  /** Optional error that triggered the event */
  readonly error?: Error;
}

/**
 * Circuit breaker event callback
 */
export type CircuitBreakerEventCallback = (event: CircuitBreakerEvent) => void;

/**
 * Default circuit breaker configuration values
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Readonly<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxAttempts: 3,
  successThreshold: 3,
} as const;
