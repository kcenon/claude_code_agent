import { afterEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from '../../src/error-handler/CircuitBreaker.js';
import { MaxRetriesExceededError, NonRetryableError } from '../../src/error-handler/errors.js';
import { RetryExecutor } from '../../src/error-handler/RetryExecutor.js';
import type { BackoffStrategy } from '../../src/error-handler/types.js';

const RETRY_BACKOFF_MATRIX: ReadonlyArray<{
  readonly strategy: BackoffStrategy;
  readonly expected: readonly number[];
}> = [
  { strategy: 'fixed', expected: [100, 100, 100, 100, 100] },
  { strategy: 'linear', expected: [100, 200, 300, 400, 500] },
  { strategy: 'exponential', expected: [100, 200, 400, 800, 1000] },
  { strategy: 'fibonacci', expected: [100, 100, 200, 300, 500] },
];

const CIRCUIT_PROFILE_MATRIX = [
  { name: 'CI polling', failureThreshold: 3, recoverySuccesses: 2 },
  { name: 'analysis pipeline stage', failureThreshold: 3, recoverySuccesses: 1 },
  { name: 'secret provider', failureThreshold: 5, recoverySuccesses: 3 },
] as const;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('canonical retry behavior parity matrix', () => {
  it.each([
    [{ maxAttempts: 0 }, 'maxAttempts'],
    [{ baseDelayMs: -1 }, 'baseDelayMs'],
    [{ baseDelayMs: 100, maxDelayMs: 99 }, 'maxDelayMs'],
    [{ multiplier: 0 }, 'multiplier'],
    [{ jitterRatio: 1.1 }, 'jitterRatio'],
  ] as const)('rejects an invalid %s policy', (policy, field) => {
    expect(() => new RetryExecutor(policy)).toThrow(field);
  });

  it.each(RETRY_BACKOFF_MATRIX)(
    'preserves $strategy backoff and the maximum-delay cap',
    ({ strategy, expected }) => {
      const executor = new RetryExecutor({
        backoffStrategy: strategy,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        multiplier: 2,
        jitterRatio: 0,
      });

      expect(expected.map((_, index) => executor.calculateDelay(index + 1))).toEqual(expected);
    }
  );

  it('keeps jitter inside the configured symmetric bounds', () => {
    const executor = new RetryExecutor({
      baseDelayMs: 1000,
      jitterRatio: 0.2,
    });
    const random = vi.spyOn(Math, 'random');

    random.mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(1);

    expect([
      executor.calculateDelay(1),
      executor.calculateDelay(1),
      executor.calculateDelay(1),
    ]).toEqual([900, 1000, 1100]);
  });

  it('makes exactly maxAttempts calls before giving up', async () => {
    const executor = new RetryExecutor({ maxAttempts: 3, baseDelayMs: 0, jitterRatio: 0 });
    const operation = vi.fn().mockRejectedValue(new Error('temporary timeout'));

    const result = await executor.executeWithResult(operation);

    expect(operation).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ success: false, attempts: 3 });
    expect(result.error).toBeInstanceOf(MaxRetriesExceededError);
  });

  it('gives up immediately when the classifier marks an error non-retryable', async () => {
    const executor = new RetryExecutor({ maxAttempts: 3, baseDelayMs: 0, jitterRatio: 0 });
    const operation = vi.fn().mockRejectedValue(new Error('invalid input'));

    const result = await executor.executeWithResult(operation);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: false, attempts: 1 });
    expect(result.error).toBeInstanceOf(NonRetryableError);
  });
});

describe('canonical circuit-breaker behavior parity matrix', () => {
  it.each(CIRCUIT_PROFILE_MATRIX)(
    '$name profile opens, probes half-open, and closes at its thresholds',
    ({ failureThreshold, recoverySuccesses }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const breaker = new CircuitBreaker({
        failureThreshold,
        resetTimeoutMs: 1000,
        halfOpenMaxAttempts: recoverySuccesses,
        successThreshold: recoverySuccesses,
      });

      for (let index = 0; index < failureThreshold; index++) {
        breaker.recordFailure(new Error(`failure ${String(index + 1)}`));
      }
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.isAcceptingRequests()).toBe(false);

      vi.advanceTimersByTime(1000);
      for (let index = 0; index < recoverySuccesses; index++) {
        breaker.prepareForAttempt();
        expect(breaker.getState()).toBe('HALF_OPEN');
        breaker.recordSuccess();
      }

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);
    }
  );

  it('resets consecutive failures after a successful closed-state call', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    breaker.recordFailure(new Error('first'));
    breaker.recordFailure(new Error('second'));

    breaker.recordSuccess();

    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('counts only failures inside an optional rolling window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const breaker = new CircuitBreaker({ failureThreshold: 3, failureWindowMs: 100 });

    breaker.recordFailure(new Error('first'));
    vi.advanceTimersByTime(60);
    breaker.recordFailure(new Error('second'));
    vi.advanceTimersByTime(60);
    breaker.recordFailure(new Error('third'));

    expect(breaker.getFailureCount()).toBe(2);
    expect(breaker.getState()).toBe('CLOSED');

    breaker.recordFailure(new Error('fourth'));
    expect(breaker.getState()).toBe('OPEN');
  });

  it('reopens immediately when a half-open probe fails', () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 100,
      halfOpenMaxAttempts: 1,
    });
    breaker.recordFailure(new Error('down'));
    vi.advanceTimersByTime(100);
    breaker.prepareForAttempt();

    breaker.recordFailure(new Error('still down'));

    expect(breaker.getState()).toBe('OPEN');
  });

  it('releases a neutral half-open probe without changing recovery counters', () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 100,
      halfOpenMaxAttempts: 1,
    });
    breaker.recordFailure(new Error('down'));
    vi.advanceTimersByTime(100);
    breaker.prepareForAttempt();

    breaker.releaseAttempt();

    expect(breaker.getState()).toBe('HALF_OPEN');
    expect(breaker.isAcceptingRequests()).toBe(true);
  });
});
