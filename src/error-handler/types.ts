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
export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';

/**
 * Error categories for retry decision making
 */
export type ErrorCategory = 'retryable' | 'non-retryable' | 'unknown';

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts (default: 3) */
  readonly maxAttempts: number;
  /** Base delay in milliseconds (default: 5000) */
  readonly baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 60000) */
  readonly maxDelayMs: number;
  /** Backoff multiplier for exponential strategy (default: 2) */
  readonly backoffMultiplier: number;
  /** Backoff strategy (default: 'exponential') */
  readonly backoff: BackoffStrategy;
  /** Enable jitter to prevent thundering herd (default: true) */
  readonly enableJitter: boolean;
  /** Jitter range as percentage of delay (0-1, default: 0.25) */
  readonly jitterFactor: number;
}

/**
 * Timeout configuration for operations
 */
export interface TimeoutConfig {
  /** Operation timeout in milliseconds */
  readonly timeoutMs: number;
  /** Custom timeout error message */
  readonly message?: string;
}

/**
 * Retry context passed to callbacks
 */
export interface RetryContext {
  /** Current attempt number (1-based) */
  readonly attempt: number;
  /** Total allowed attempts */
  readonly maxAttempts: number;
  /** Time elapsed since first attempt in milliseconds */
  readonly elapsedMs: number;
  /** Last error encountered (undefined for first attempt) */
  readonly lastError?: Error | undefined;
  /** Whether this is the final attempt */
  readonly isFinalAttempt: boolean;
}

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
 * Complete retry result with all attempts
 */
export interface RetryResult<T> {
  /** Whether the operation ultimately succeeded */
  readonly success: boolean;
  /** Result value if successful */
  readonly value?: T;
  /** Final error if all attempts failed */
  readonly error?: Error;
  /** Total number of attempts made */
  readonly totalAttempts: number;
  /** Total duration across all attempts in milliseconds */
  readonly totalDurationMs: number;
  /** Results of each attempt */
  readonly attempts: readonly RetryAttemptResult[];
}

/**
 * Error classifier function type
 */
export type ErrorClassifier = (error: Error) => ErrorCategory;

/**
 * Retry event callback for monitoring
 */
export type RetryEventCallback = (context: RetryContext, result: RetryAttemptResult) => void;

/**
 * Circuit breaker integration mode for retry operations
 */
export type CircuitBreakerIntegration = {
  /** The circuit breaker instance to use */
  readonly breaker: unknown; // Use unknown to avoid circular import, actual type is CircuitBreaker
  /** Whether to count retryable failures toward circuit breaker threshold (default: true) */
  readonly countRetryableFailures?: boolean;
};

/**
 * Options for the withRetry function
 */
export interface WithRetryOptions<T> {
  /** Retry policy configuration */
  readonly policy?: Partial<RetryPolicy>;
  /** Custom error classifier */
  readonly errorClassifier?: ErrorClassifier;
  /** Operation timeout configuration */
  readonly timeout?: TimeoutConfig;
  /** Callback fired after each attempt */
  readonly onAttempt?: RetryEventCallback;
  /** Abort signal for cancellation */
  readonly signal?: AbortSignal;
  /** Operation name for logging */
  readonly operationName?: string;
  /** Callback to transform the result before returning */
  readonly transformResult?: (result: T) => T;
  /** Circuit breaker integration for fault tolerance */
  readonly circuitBreaker?: CircuitBreakerIntegration;
}

/**
 * Default retry policy values
 */
export const DEFAULT_RETRY_POLICY: Readonly<RetryPolicy> = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  backoff: 'exponential',
  enableJitter: true,
  jitterFactor: 0.25,
} as const;

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
  | 'state_change'
  | 'failure_recorded'
  | 'success_recorded'
  | 'request_blocked'
  | 'reset';

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
} as const;
