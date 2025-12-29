/**
 * CircuitBreaker - Prevents cascading failures by halting operations after consecutive failures
 *
 * The circuit breaker pattern protects systems from repeated failed operations by:
 * - Tracking consecutive failures
 * - Temporarily blocking requests when failure threshold is reached
 * - Allowing limited test requests after a reset timeout
 * - Automatically recovering when operations succeed
 *
 * State Machine:
 * - CLOSED: Normal operation, requests pass through, failures are counted
 * - OPEN: Requests immediately fail without attempting the operation
 * - HALF_OPEN: Limited test requests allowed to check if service has recovered
 *
 * @module error-handler/CircuitBreaker
 */

import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerEvent,
  CircuitBreakerEventCallback,
} from './types.js';

import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './types.js';

import { CircuitOpenError, InvalidCircuitBreakerConfigError } from './errors.js';

import { getLogger } from '../monitoring/Logger.js';

/**
 * Validates circuit breaker configuration
 * @throws InvalidCircuitBreakerConfigError if config is invalid
 */
function validateConfig(config: CircuitBreakerConfig): void {
  if (config.failureThreshold < 1) {
    throw new InvalidCircuitBreakerConfigError(
      'failureThreshold',
      config.failureThreshold,
      'must be >= 1'
    );
  }
  if (config.resetTimeoutMs < 0) {
    throw new InvalidCircuitBreakerConfigError(
      'resetTimeoutMs',
      config.resetTimeoutMs,
      'must be >= 0'
    );
  }
  if (config.halfOpenMaxAttempts < 1) {
    throw new InvalidCircuitBreakerConfigError(
      'halfOpenMaxAttempts',
      config.halfOpenMaxAttempts,
      'must be >= 1'
    );
  }
}

/**
 * Merges partial config with defaults
 */
function mergeConfig(partial?: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  const config: CircuitBreakerConfig = {
    failureThreshold: partial?.failureThreshold ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
    resetTimeoutMs: partial?.resetTimeoutMs ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs,
    halfOpenMaxAttempts:
      partial?.halfOpenMaxAttempts ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts,
    name: partial?.name,
  };
  validateConfig(config);
  return config;
}

/**
 * Circuit Breaker implementation for fault tolerance
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeoutMs: 60000,
 *   halfOpenMaxAttempts: 3,
 *   name: 'api-service'
 * });
 *
 * // Execute operation with circuit breaker protection
 * const result = await breaker.execute(async () => {
 *   return await fetch('https://api.example.com/data');
 * });
 *
 * // Check circuit status
 * const status = breaker.getStatus();
 * console.log(`Circuit is ${status.state}`);
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private halfOpenSuccessCount: number = 0;
  private halfOpenAttemptCount: number = 0;
  private lastFailureTime: number | undefined;
  private blockedRequestCount: number = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly eventCallbacks: CircuitBreakerEventCallback[] = [];

  constructor(configOverride?: Partial<CircuitBreakerConfig>) {
    this.config = mergeConfig(configOverride);
  }

  /**
   * Get the circuit breaker configuration
   */
  public getConfig(): CircuitBreakerConfig {
    return this.config;
  }

  /**
   * Get current circuit breaker status for monitoring
   */
  public getStatus(): CircuitBreakerStatus {
    const now = Date.now();
    let timeUntilResetMs: number | undefined;

    if (this.state === 'OPEN' && this.lastFailureTime !== undefined) {
      const elapsed = now - this.lastFailureTime;
      const remaining = this.config.resetTimeoutMs - elapsed;
      timeUntilResetMs = Math.max(0, remaining);
    }

    return {
      state: this.state,
      failureCount: this.failureCount,
      halfOpenSuccessCount: this.halfOpenSuccessCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilResetMs,
      isAcceptingRequests: this.isAcceptingRequests(),
      blockedRequestCount: this.blockedRequestCount,
    };
  }

  /**
   * Get current circuit state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  public getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Check if circuit is accepting requests
   */
  public isAcceptingRequests(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      if (this.shouldAttemptReset()) {
        return true;
      }
      return false;
    }

    // HALF_OPEN state - limited requests allowed
    return this.halfOpenAttemptCount < this.config.halfOpenMaxAttempts;
  }

  /**
   * Check if circuit should transition from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    if (this.state !== 'OPEN' || this.lastFailureTime === undefined) {
      return false;
    }

    const elapsed = Date.now() - this.lastFailureTime;
    return elapsed >= this.config.resetTimeoutMs;
  }

  /**
   * Get remaining time until circuit can attempt reset
   */
  public getRemainingTimeout(): number {
    if (this.state !== 'OPEN' || this.lastFailureTime === undefined) {
      return 0;
    }

    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.config.resetTimeoutMs - elapsed);
  }

  /**
   * Execute an async operation with circuit breaker protection
   *
   * @template T - Return type of the operation
   * @param operation - The async operation to execute
   * @returns Promise resolving to the operation result
   * @throws CircuitOpenError if the circuit is open and not accepting requests
   * @throws The original error if the operation fails
   *
   * @example
   * ```typescript
   * const breaker = new CircuitBreaker({ failureThreshold: 3 });
   *
   * try {
   *   const data = await breaker.execute(async () => {
   *     return await fetchData();
   *   });
   *   console.log('Data:', data);
   * } catch (error) {
   *   if (error instanceof CircuitOpenError) {
   *     console.log(`Circuit open, retry in ${error.remainingTimeoutMs}ms`);
   *   }
   * }
   * ```
   */
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    const logger = getLogger();

    // Check if we need to transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.transitionTo('HALF_OPEN');
    }

    // Check if circuit is accepting requests
    if (!this.isAcceptingRequests()) {
      const remainingMs = this.getRemainingTimeout();
      this.blockedRequestCount++;

      this.emitEvent({
        type: 'request_blocked',
        failureCount: this.failureCount,
        timestamp: Date.now(),
      });

      logger.warn(`Circuit breaker '${this.config.name ?? 'unnamed'}' blocked request`, {
        state: this.state,
        remainingTimeoutMs: remainingMs,
        failureCount: this.failureCount,
        blockedRequestCount: this.blockedRequestCount,
      });

      throw new CircuitOpenError(remainingMs, this.failureCount, this.config.name);
    }

    // Track HALF_OPEN attempts
    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttemptCount++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    const logger = getLogger();

    this.emitEvent({
      type: 'success_recorded',
      failureCount: this.failureCount,
      timestamp: Date.now(),
    });

    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccessCount++;

      logger.debug(`Circuit breaker '${this.config.name ?? 'unnamed'}' success in HALF_OPEN`, {
        halfOpenSuccessCount: this.halfOpenSuccessCount,
        halfOpenMaxAttempts: this.config.halfOpenMaxAttempts,
      });

      // Require successful completion of all half-open attempts to close
      if (this.halfOpenSuccessCount >= this.config.halfOpenMaxAttempts) {
        this.transitionTo('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in CLOSED state
      if (this.failureCount > 0) {
        logger.debug(`Circuit breaker '${this.config.name ?? 'unnamed'}' reset failure count`, {
          previousFailureCount: this.failureCount,
        });
        this.failureCount = 0;
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    const logger = getLogger();

    this.failureCount++;
    this.lastFailureTime = Date.now();

    this.emitEvent({
      type: 'failure_recorded',
      failureCount: this.failureCount,
      timestamp: this.lastFailureTime,
      error,
    });

    logger.warn(`Circuit breaker '${this.config.name ?? 'unnamed'}' recorded failure`, {
      failureCount: this.failureCount,
      failureThreshold: this.config.failureThreshold,
      state: this.state,
      errorMessage: error.message,
    });

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      // Check if threshold is reached
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const logger = getLogger();
    const previousState = this.state;

    if (previousState === newState) {
      return;
    }

    this.state = newState;

    // Reset counters based on new state
    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.halfOpenSuccessCount = 0;
      this.halfOpenAttemptCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenSuccessCount = 0;
      this.halfOpenAttemptCount = 0;
    }

    this.emitEvent({
      type: 'state_change',
      previousState,
      newState,
      failureCount: this.failureCount,
      timestamp: Date.now(),
    });

    logger.info(`Circuit breaker '${this.config.name ?? 'unnamed'}' state changed`, {
      previousState,
      newState,
      failureCount: this.failureCount,
    });
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  public reset(): void {
    const logger = getLogger();

    this.emitEvent({
      type: 'reset',
      failureCount: this.failureCount,
      timestamp: Date.now(),
    });

    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
    this.halfOpenAttemptCount = 0;
    this.lastFailureTime = undefined;
    this.blockedRequestCount = 0;

    logger.info(`Circuit breaker '${this.config.name ?? 'unnamed'}' manually reset`);
  }

  /**
   * Register an event callback for monitoring
   *
   * @param callback - Function to call when circuit breaker events occur
   * @returns Function to unregister the callback
   */
  public onEvent(callback: CircuitBreakerEventCallback): () => void {
    this.eventCallbacks.push(callback);

    return (): void => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index !== -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to all registered callbacks
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors to prevent disrupting circuit breaker operation
      }
    }
  }

  /**
   * Record a successful operation result (for external integration)
   * Use this when the operation is managed externally (e.g., by RetryHandler)
   */
  public recordSuccess(): void {
    this.onSuccess();
  }

  /**
   * Record a failed operation result (for external integration)
   * Use this when the operation is managed externally (e.g., by RetryHandler)
   */
  public recordFailure(error: Error): void {
    this.onFailure(error);
  }

  /**
   * Check if the circuit is currently healthy (CLOSED state with no recent failures)
   */
  public isHealthy(): boolean {
    return this.state === 'CLOSED' && this.failureCount === 0;
  }

  /**
   * Get a health check result for monitoring systems
   */
  public getHealthCheck(): { healthy: boolean; details: CircuitBreakerStatus } {
    return {
      healthy: this.isHealthy(),
      details: this.getStatus(),
    };
  }
}

/**
 * Create a circuit breaker wrapped function
 *
 * @template TArgs - Function argument types
 * @template TResult - Function return type
 * @param fn - The async function to wrap
 * @param config - Circuit breaker configuration
 * @returns A new function protected by circuit breaker
 *
 * @example
 * ```typescript
 * const protectedFetch = createCircuitBreakerFunction(
 *   async (url: string) => await fetch(url),
 *   { failureThreshold: 5, name: 'http-client' }
 * );
 *
 * const response = await protectedFetch('https://api.example.com/data');
 * ```
 */
export function createCircuitBreakerFunction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config?: Partial<CircuitBreakerConfig>
): {
  (...args: TArgs): Promise<TResult>;
  getBreaker: () => CircuitBreaker;
} {
  const breaker = new CircuitBreaker(config);

  const wrapped = async (...args: TArgs): Promise<TResult> => {
    return breaker.execute(() => fn(...args));
  };

  wrapped.getBreaker = (): CircuitBreaker => breaker;

  return wrapped;
}
