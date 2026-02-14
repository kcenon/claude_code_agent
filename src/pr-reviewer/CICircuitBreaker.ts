/**
 * CI Circuit Breaker module
 *
 * Implements the circuit breaker pattern for CI/CD polling operations.
 * Prevents continuous polling when CI is consistently failing, saving
 * resources and providing faster feedback on unrecoverable failures.
 *
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail immediately
 * - HALF-OPEN: Testing recovery, limited requests allowed
 *
 * @module pr-reviewer/CICircuitBreaker
 */

import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  FailureType,
} from './types.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './types.js';
import { CircuitOpenError } from './errors.js';

/**
 * Event types emitted by the circuit breaker
 */
export type CircuitBreakerEvent =
  | { type: 'state_change'; from: CircuitState; to: CircuitState; timestamp: number }
  | { type: 'failure_recorded'; failures: number; threshold: number; timestamp: number }
  | { type: 'success_recorded'; successes: number; threshold: number; timestamp: number }
  | { type: 'reset'; timestamp: number };

/**
 * Event listener callback type
 */
export type CircuitBreakerEventListener = (event: CircuitBreakerEvent) => void;

/**
 * CI Circuit Breaker
 *
 * Monitors CI operations and opens the circuit when failures exceed
 * the configured threshold, preventing further attempts until recovery.
 */
export class CICircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private lastStateChangeTime = Date.now();
  private failureTimestamps: number[] = [];
  private readonly config: CircuitBreakerConfig;
  private readonly listeners: CircuitBreakerEventListener[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
      successThreshold: config.successThreshold ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold,
      resetTimeoutMs: config.resetTimeoutMs ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs,
      failureWindowMs: config.failureWindowMs ?? DEFAULT_CIRCUIT_BREAKER_CONFIG.failureWindowMs,
    };
  }

  /**
   * Execute an operation through the circuit breaker
   *
   * @param operation - Async function to execute if the circuit allows it
   * @returns Resolved value from the operation
   * @throws CircuitOpenError if circuit is open and not ready to recover
   */
  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitOpenError(this.failures, this.lastFailureTime);
      }
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Check if an operation can be attempted
   * Returns true if circuit is closed or ready to attempt recovery
   * @returns True if the circuit is closed, half-open, or the reset timeout has elapsed
   */
  public canAttempt(): boolean {
    if (this.state === 'closed' || this.state === 'half-open') {
      return true;
    }

    // Check if we should try to recover
    return this.shouldAttemptReset();
  }

  /**
   * Prepare for an attempt (transitions open to half-open if ready)
   * @throws CircuitOpenError if circuit is open and not ready
   */
  public prepareForAttempt(): void {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitOpenError(this.failures, this.lastFailureTime);
      }
    }
  }

  /**
   * Record a successful operation
   */
  public recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      this.emit({
        type: 'success_recorded',
        successes: this.successes,
        threshold: this.config.successThreshold,
        timestamp: Date.now(),
      });

      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success in closed state
      this.failures = 0;
      this.failureTimestamps = [];
    }
  }

  /**
   * Record a failed operation
   * @param failureType - Classification of the failure (transient, persistent, or terminal)
   */
  public recordFailure(failureType?: FailureType): void {
    const now = Date.now();

    // Terminal failures should immediately open the circuit
    if (failureType === 'terminal') {
      this.failures = this.config.failureThreshold;
      this.lastFailureTime = now;
      this.transitionTo('open');
      return;
    }

    // Clean up old failures outside the window
    this.failureTimestamps = this.failureTimestamps.filter(
      (ts) => now - ts < this.config.failureWindowMs
    );

    this.failureTimestamps.push(now);
    this.failures++;
    this.lastFailureTime = now;

    this.emit({
      type: 'failure_recorded',
      failures: this.failures,
      threshold: this.config.failureThreshold,
      timestamp: now,
    });

    if (this.failures >= this.config.failureThreshold) {
      this.transitionTo('open');
    }

    // Reset success count in half-open state on failure
    if (this.state === 'half-open') {
      this.successes = 0;
      this.transitionTo('open');
    }
  }

  /**
   * Force reset the circuit breaker to closed state
   */
  public reset(): void {
    const previousState = this.state;
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    this.lastStateChangeTime = Date.now();

    this.emit({ type: 'reset', timestamp: Date.now() });

    if (previousState !== 'closed') {
      this.emit({
        type: 'state_change',
        from: previousState,
        to: 'closed',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Force open the circuit breaker
   */
  public forceOpen(): void {
    this.transitionTo('open');
  }

  /**
   * Get current circuit breaker status
   * @returns Snapshot of state, failure/success counts, and timestamps
   */
  public getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastStateChangeTime: this.lastStateChangeTime,
    };
  }

  /**
   * Get current state
   * @returns Current circuit state: closed, open, or half-open
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get configuration
   * @returns Copy of the circuit breaker configuration
   */
  public getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Check if circuit is open
   * @returns True if the circuit is in the open state
   */
  public isOpen(): boolean {
    return this.state === 'open';
  }

  /**
   * Check if circuit is closed
   * @returns True if the circuit is in the closed (normal) state
   */
  public isClosed(): boolean {
    return this.state === 'closed';
  }

  /**
   * Check if circuit is half-open
   * @returns True if the circuit is in the half-open (recovery testing) state
   */
  public isHalfOpen(): boolean {
    return this.state === 'half-open';
  }

  /**
   * Get time until next reset attempt in ms
   * Returns 0 if circuit is not open or ready to attempt reset
   * @returns Milliseconds remaining until a recovery attempt is allowed
   */
  public getTimeUntilReset(): number {
    if (this.state !== 'open') {
      return 0;
    }

    const elapsed = Date.now() - this.lastFailureTime;
    const remaining = this.config.resetTimeoutMs - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Register an event listener
   * @param listener - Callback invoked on state changes, failures, successes, and resets
   * @returns Unsubscribe function that removes the listener when called
   */
  public onEvent(listener: CircuitBreakerEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if enough time has passed to attempt reset
   * @returns True if the reset timeout has elapsed since the last failure
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }

  /**
   * Transition to a new state
   * @param newState - Target circuit state to transition to
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) {
      return;
    }

    const previousState = this.state;
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    // Reset successes when transitioning to half-open
    if (newState === 'half-open') {
      this.successes = 0;
    }

    this.emit({
      type: 'state_change',
      from: previousState,
      to: newState,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit an event to all listeners
   * @param event - Circuit breaker event to broadcast to registered listeners
   */
  private emit(event: CircuitBreakerEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}
