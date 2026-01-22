/**
 * Backoff Strategies Module
 *
 * Provides pluggable backoff strategy implementations for retry mechanisms.
 * Each strategy calculates the delay between retry attempts based on the attempt number.
 *
 * Available strategies:
 * - Fixed: Constant delay between attempts
 * - Linear: Delay increases linearly with attempt number
 * - Exponential: Delay doubles (or multiplies) with each attempt
 * - Fibonacci: Delay follows fibonacci sequence for gradual increase
 *
 * All strategies support:
 * - Jitter to prevent thundering herd
 * - Maximum delay cap
 * - Configuration via BackoffConfig
 *
 * @module error-handler/BackoffStrategies
 */

import type { BackoffStrategy as BackoffStrategyType } from './types.js';

/**
 * Configuration for backoff strategies
 */
export interface BackoffConfig {
  /** Base delay in milliseconds (default: 1000) */
  readonly baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 60000) */
  readonly maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  readonly multiplier: number;
  /** Jitter ratio (0-1) to randomize delay (default: 0) */
  readonly jitterRatio: number;
}

/**
 * Default backoff configuration
 */
export const DEFAULT_BACKOFF_CONFIG: Readonly<BackoffConfig> = {
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  multiplier: 2,
  jitterRatio: 0,
} as const;

/**
 * Interface for backoff strategy implementations
 */
export interface BackoffStrategy {
  /** Strategy name */
  readonly name: BackoffStrategyType | 'fibonacci';
  /**
   * Calculate delay for a given attempt
   * @param attempt - Attempt number (1-based)
   * @param config - Backoff configuration
   * @returns Delay in milliseconds
   */
  calculateDelay(attempt: number, config: BackoffConfig): number;
}

/**
 * Apply jitter to a delay value
 * Jitter helps prevent thundering herd problem by randomizing delays
 *
 * @param delay - Base delay in milliseconds
 * @param jitterRatio - Ratio of delay to use as jitter range (0-1)
 * @returns Delay with jitter applied
 */
export function applyJitter(delay: number, jitterRatio: number): number {
  if (jitterRatio <= 0 || jitterRatio > 1) {
    return delay;
  }
  // Random jitter: delay * (1 ± jitterRatio/2)
  const jitterRange = delay * jitterRatio;
  const jitter = (Math.random() - 0.5) * jitterRange;
  return Math.max(0, delay + jitter);
}

/**
 * Cap delay at maximum value
 *
 * @param delay - Calculated delay
 * @param maxDelayMs - Maximum allowed delay
 * @returns Capped delay value
 */
export function capDelay(delay: number, maxDelayMs: number): number {
  return Math.min(Math.max(0, delay), maxDelayMs);
}

/**
 * Fixed backoff strategy
 * Returns constant delay regardless of attempt number
 */
export class FixedBackoff implements BackoffStrategy {
  public readonly name: BackoffStrategyType = 'fixed';

  public calculateDelay(attempt: number, config: BackoffConfig): number {
    void attempt; // Unused - fixed delay doesn't vary by attempt
    const delay = config.baseDelayMs;
    const withJitter = applyJitter(delay, config.jitterRatio);
    return capDelay(withJitter, config.maxDelayMs);
  }
}

/**
 * Linear backoff strategy
 * Delay increases linearly with attempt number: baseDelay * attempt
 */
export class LinearBackoff implements BackoffStrategy {
  public readonly name: BackoffStrategyType = 'linear';

  public calculateDelay(attempt: number, config: BackoffConfig): number {
    const delay = config.baseDelayMs * attempt;
    const withJitter = applyJitter(delay, config.jitterRatio);
    return capDelay(withJitter, config.maxDelayMs);
  }
}

/**
 * Exponential backoff strategy
 * Delay grows exponentially: baseDelay * multiplier^(attempt-1)
 */
export class ExponentialBackoff implements BackoffStrategy {
  public readonly name: BackoffStrategyType = 'exponential';

  public calculateDelay(attempt: number, config: BackoffConfig): number {
    const delay = config.baseDelayMs * Math.pow(config.multiplier, attempt - 1);
    const withJitter = applyJitter(delay, config.jitterRatio);
    return capDelay(withJitter, config.maxDelayMs);
  }
}

/**
 * Fibonacci backoff strategy
 * Delay follows fibonacci sequence for gradual increase
 * Sequence: 1, 1, 2, 3, 5, 8, 13, 21, ...
 * Delay = baseDelay * fibonacci(attempt)
 */
export class FibonacciBackoff implements BackoffStrategy {
  public readonly name = 'fibonacci' as const;

  /**
   * Calculate fibonacci number iteratively (efficient for small n)
   * fib(1)=1, fib(2)=1, fib(3)=2, fib(4)=3, fib(5)=5, fib(6)=8, fib(7)=13...
   */
  private fibonacci(n: number): number {
    if (n <= 2) return 1;
    let prev = 1;
    let current = 1;
    for (let i = 3; i <= n; i++) {
      const next = prev + current;
      prev = current;
      current = next;
    }
    return current;
  }

  public calculateDelay(attempt: number, config: BackoffConfig): number {
    const fibValue = this.fibonacci(attempt);
    const delay = config.baseDelayMs * fibValue;
    const withJitter = applyJitter(delay, config.jitterRatio);
    return capDelay(withJitter, config.maxDelayMs);
  }
}

/**
 * Registry of available backoff strategies
 */
const strategyRegistry = new Map<string, BackoffStrategy>([
  ['fixed', new FixedBackoff()],
  ['linear', new LinearBackoff()],
  ['exponential', new ExponentialBackoff()],
  ['fibonacci', new FibonacciBackoff()],
]);

/**
 * Get a backoff strategy by name
 *
 * @param name - Strategy name
 * @returns BackoffStrategy instance
 * @throws Error if strategy not found
 */
export function getBackoffStrategy(name: string): BackoffStrategy {
  const strategy = strategyRegistry.get(name);
  if (strategy === undefined) {
    throw new Error(
      `Unknown backoff strategy: ${name}. Available: ${Array.from(strategyRegistry.keys()).join(', ')}`
    );
  }
  return strategy;
}

/**
 * Register a custom backoff strategy
 *
 * @param name - Strategy name
 * @param strategy - Strategy implementation
 */
export function registerBackoffStrategy(name: string, strategy: BackoffStrategy): void {
  strategyRegistry.set(name, strategy);
}

/**
 * Get all available strategy names
 *
 * @returns Array of strategy names
 */
export function getAvailableStrategies(): readonly string[] {
  return Array.from(strategyRegistry.keys());
}

/**
 * Create a backoff configuration from partial input
 *
 * @param partial - Partial configuration
 * @returns Complete backoff configuration
 */
export function createBackoffConfig(partial?: Partial<BackoffConfig>): BackoffConfig {
  return {
    baseDelayMs: partial?.baseDelayMs ?? DEFAULT_BACKOFF_CONFIG.baseDelayMs,
    maxDelayMs: partial?.maxDelayMs ?? DEFAULT_BACKOFF_CONFIG.maxDelayMs,
    multiplier: partial?.multiplier ?? DEFAULT_BACKOFF_CONFIG.multiplier,
    jitterRatio: partial?.jitterRatio ?? DEFAULT_BACKOFF_CONFIG.jitterRatio,
  };
}

/**
 * Calculate delay using a named strategy
 *
 * @param strategyName - Name of the backoff strategy
 * @param attempt - Attempt number (1-based)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  strategyName: string,
  attempt: number,
  config?: Partial<BackoffConfig>
): number {
  const strategy = getBackoffStrategy(strategyName);
  const fullConfig = createBackoffConfig(config);
  return Math.floor(strategy.calculateDelay(attempt, fullConfig));
}
