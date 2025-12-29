import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Logger, resetLogger } from '../../src/monitoring/index.js';
import {
  CircuitBreaker,
  createCircuitBreakerFunction,
  CircuitOpenError,
  InvalidCircuitBreakerConfigError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  withRetry,
} from '../../src/error-handler/index.js';
import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerEvent,
} from '../../src/error-handler/index.js';

describe('CircuitBreaker', () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-breaker-test-'));
    resetLogger();
    new Logger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetLogger();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('DEFAULT_CIRCUIT_BREAKER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(5);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs).toBe(60000);
      expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenMaxAttempts).toBe(3);
    });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const breaker = new CircuitBreaker();
      const config = breaker.getConfig();

      expect(config.failureThreshold).toBe(5);
      expect(config.resetTimeoutMs).toBe(60000);
      expect(config.halfOpenMaxAttempts).toBe(3);
    });

    it('should create with custom config', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        halfOpenMaxAttempts: 2,
        name: 'test-breaker',
      });
      const config = breaker.getConfig();

      expect(config.failureThreshold).toBe(3);
      expect(config.resetTimeoutMs).toBe(30000);
      expect(config.halfOpenMaxAttempts).toBe(2);
      expect(config.name).toBe('test-breaker');
    });

    it('should throw InvalidCircuitBreakerConfigError for invalid failureThreshold', () => {
      expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow(
        InvalidCircuitBreakerConfigError
      );
      expect(() => new CircuitBreaker({ failureThreshold: -1 })).toThrow(
        InvalidCircuitBreakerConfigError
      );
    });

    it('should throw InvalidCircuitBreakerConfigError for invalid resetTimeoutMs', () => {
      expect(() => new CircuitBreaker({ resetTimeoutMs: -100 })).toThrow(
        InvalidCircuitBreakerConfigError
      );
    });

    it('should throw InvalidCircuitBreakerConfigError for invalid halfOpenMaxAttempts', () => {
      expect(() => new CircuitBreaker({ halfOpenMaxAttempts: 0 })).toThrow(
        InvalidCircuitBreakerConfigError
      );
    });
  });

  describe('state transitions', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should stay CLOSED after successful operations', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const operation = vi.fn().mockResolvedValue('success');

      await breaker.execute(operation);
      await breaker.execute(operation);
      await breaker.execute(operation);

      expect(breaker.getState()).toBe('CLOSED');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should transition to OPEN after reaching failure threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(operation)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.getFailureCount()).toBe(3);
    });

    it('should reject requests immediately when OPEN', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');

      // Next request should be immediately rejected
      await expect(breaker.execute(operation)).rejects.toThrow(CircuitOpenError);
      expect(operation).toHaveBeenCalledTimes(2); // Not called for the third attempt
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
      });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');

      // Advance time past reset timeout
      vi.advanceTimersByTime(1100);

      // Check if circuit is accepting requests (should transition to HALF_OPEN)
      expect(breaker.isAcceptingRequests()).toBe(true);

      vi.useRealTimers();
    });

    it('should transition from HALF_OPEN to CLOSED after successful attempts', async () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 100,
        halfOpenMaxAttempts: 2,
      });

      // Open the circuit with failures
      const failingOp = vi.fn().mockRejectedValue(new Error('test error'));
      await expect(breaker.execute(failingOp)).rejects.toThrow();
      await expect(breaker.execute(failingOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Advance time to allow HALF_OPEN transition
      vi.advanceTimersByTime(150);

      // Successful operations in HALF_OPEN state
      const successOp = vi.fn().mockResolvedValue('success');
      await breaker.execute(successOp);
      expect(breaker.getState()).toBe('HALF_OPEN');

      await breaker.execute(successOp);
      expect(breaker.getState()).toBe('CLOSED');

      vi.useRealTimers();
    });

    it('should transition from HALF_OPEN back to OPEN on failure', async () => {
      vi.useFakeTimers();

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 100,
        halfOpenMaxAttempts: 3,
      });

      // Open the circuit
      const failingOp = vi.fn().mockRejectedValue(new Error('test error'));
      await expect(breaker.execute(failingOp)).rejects.toThrow();
      await expect(breaker.execute(failingOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Advance time
      vi.advanceTimersByTime(150);

      // First attempt in HALF_OPEN succeeds
      const mixedOp = vi.fn().mockResolvedValueOnce('success').mockRejectedValue(new Error('fail'));
      await breaker.execute(mixedOp);
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Second attempt fails - should go back to OPEN
      await expect(breaker.execute(mixedOp)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      vi.useRealTimers();
    });
  });

  describe('reset failure count on success', () => {
    it('should reset failure count after successful operation in CLOSED state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      // Accumulate some failures (but not enough to open)
      const failingOp = vi.fn().mockRejectedValue(new Error('test error'));
      await expect(breaker.execute(failingOp)).rejects.toThrow();
      await expect(breaker.execute(failingOp)).rejects.toThrow();
      expect(breaker.getFailureCount()).toBe(2);

      // Successful operation should reset count
      const successOp = vi.fn().mockResolvedValue('success');
      await breaker.execute(successOp);
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('manual reset', () => {
    it('should reset circuit to CLOSED state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Manual reset
      breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.isAcceptingRequests()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return correct status for CLOSED circuit', () => {
      const breaker = new CircuitBreaker({ name: 'test' });
      const status = breaker.getStatus();

      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(0);
      expect(status.isAcceptingRequests).toBe(true);
      expect(status.blockedRequestCount).toBe(0);
    });

    it('should return correct status for OPEN circuit', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 60000,
      });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      const status = breaker.getStatus();

      expect(status.state).toBe('OPEN');
      expect(status.failureCount).toBe(2);
      expect(status.isAcceptingRequests).toBe(false);
      expect(status.timeUntilResetMs).toBeGreaterThan(0);
      expect(status.lastFailureTime).toBeDefined();
    });

    it('should track blocked request count', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      // Try to execute when open (should be blocked)
      await expect(breaker.execute(operation)).rejects.toThrow(CircuitOpenError);
      await expect(breaker.execute(operation)).rejects.toThrow(CircuitOpenError);

      const status = breaker.getStatus();
      expect(status.blockedRequestCount).toBe(2);
    });
  });

  describe('event callbacks', () => {
    it('should emit state_change events', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const events: CircuitBreakerEvent[] = [];

      breaker.onEvent((event) => {
        events.push(event);
      });

      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      const stateChangeEvents = events.filter((e) => e.type === 'state_change');
      expect(stateChangeEvents.length).toBe(1);
      expect(stateChangeEvents[0].previousState).toBe('CLOSED');
      expect(stateChangeEvents[0].newState).toBe('OPEN');
    });

    it('should emit failure_recorded events', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const events: CircuitBreakerEvent[] = [];

      breaker.onEvent((event) => {
        events.push(event);
      });

      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(breaker.execute(operation)).rejects.toThrow();

      const failureEvents = events.filter((e) => e.type === 'failure_recorded');
      expect(failureEvents.length).toBe(1);
      expect(failureEvents[0].failureCount).toBe(1);
      expect(failureEvents[0].error).toBeDefined();
    });

    it('should emit success_recorded events', async () => {
      const breaker = new CircuitBreaker();
      const events: CircuitBreakerEvent[] = [];

      breaker.onEvent((event) => {
        events.push(event);
      });

      const operation = vi.fn().mockResolvedValue('success');
      await breaker.execute(operation);

      const successEvents = events.filter((e) => e.type === 'success_recorded');
      expect(successEvents.length).toBe(1);
    });

    it('should allow unregistering event callback', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const events: CircuitBreakerEvent[] = [];

      const unregister = breaker.onEvent((event) => {
        events.push(event);
      });

      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(events.length).toBeGreaterThan(0);

      const countBefore = events.length;
      unregister();

      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(events.length).toBe(countBefore); // No new events after unregister
    });
  });

  describe('health check', () => {
    it('should report healthy when CLOSED with no failures', () => {
      const breaker = new CircuitBreaker();
      expect(breaker.isHealthy()).toBe(true);

      const healthCheck = breaker.getHealthCheck();
      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.details.state).toBe('CLOSED');
    });

    it('should report unhealthy when OPEN', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(breaker.execute(operation)).rejects.toThrow();
      await expect(breaker.execute(operation)).rejects.toThrow();

      expect(breaker.isHealthy()).toBe(false);

      const healthCheck = breaker.getHealthCheck();
      expect(healthCheck.healthy).toBe(false);
      expect(healthCheck.details.state).toBe('OPEN');
    });

    it('should report unhealthy when CLOSED but has failures', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(breaker.execute(operation)).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.isHealthy()).toBe(false);
    });
  });

  describe('recordSuccess and recordFailure', () => {
    it('should update state via recordSuccess', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      // Add some failures
      breaker.recordFailure(new Error('test'));
      breaker.recordFailure(new Error('test'));
      expect(breaker.getFailureCount()).toBe(2);

      // Record success should reset
      breaker.recordSuccess();
      expect(breaker.getFailureCount()).toBe(0);
    });

    it('should update state via recordFailure', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });

      breaker.recordFailure(new Error('test'));
      expect(breaker.getFailureCount()).toBe(1);
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure(new Error('test'));
      expect(breaker.getFailureCount()).toBe(2);
      expect(breaker.getState()).toBe('OPEN');
    });
  });
});

describe('createCircuitBreakerFunction', () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-fn-test-'));
    resetLogger();
    new Logger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetLogger();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  it('should create a wrapped function with circuit breaker', async () => {
    const originalFn = vi.fn().mockResolvedValue('success');
    const protectedFn = createCircuitBreakerFunction(originalFn, {
      failureThreshold: 3,
    });

    const result = await protectedFn();
    expect(result).toBe('success');
    expect(originalFn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to wrapped function', async () => {
    const originalFn = vi.fn().mockImplementation((a: number, b: string) => {
      return Promise.resolve(`${b}-${String(a)}`);
    });
    const protectedFn = createCircuitBreakerFunction(originalFn);

    const result = await protectedFn(42, 'test');
    expect(result).toBe('test-42');
  });

  it('should expose the underlying circuit breaker', () => {
    const originalFn = vi.fn().mockResolvedValue('success');
    const protectedFn = createCircuitBreakerFunction(originalFn, {
      failureThreshold: 5,
      name: 'test-fn',
    });

    const breaker = protectedFn.getBreaker();
    expect(breaker).toBeInstanceOf(CircuitBreaker);
    expect(breaker.getConfig().failureThreshold).toBe(5);
    expect(breaker.getConfig().name).toBe('test-fn');
  });

  it('should open circuit after failures', async () => {
    const originalFn = vi.fn().mockRejectedValue(new Error('fail'));
    const protectedFn = createCircuitBreakerFunction(originalFn, {
      failureThreshold: 2,
    });

    await expect(protectedFn()).rejects.toThrow();
    await expect(protectedFn()).rejects.toThrow();

    const breaker = protectedFn.getBreaker();
    expect(breaker.getState()).toBe('OPEN');

    await expect(protectedFn()).rejects.toThrow(CircuitOpenError);
  });
});

describe('CircuitBreaker integration with withRetry', () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-retry-test-'));
    resetLogger();
    new Logger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetLogger();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  it('should integrate circuit breaker with retry logic', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      name: 'retry-test',
    });

    const operation = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    // First retry - all attempts should fail and record failures to breaker
    await expect(
      withRetry(operation, {
        policy: { maxAttempts: 2, baseDelayMs: 10, enableJitter: false },
        circuitBreaker: { breaker },
        operationName: 'testOp',
      })
    ).rejects.toThrow();

    expect(breaker.getFailureCount()).toBe(2);
    expect(breaker.getState()).toBe('CLOSED');

    // Second retry - should trip the breaker
    await expect(
      withRetry(operation, {
        policy: { maxAttempts: 2, baseDelayMs: 10, enableJitter: false },
        circuitBreaker: { breaker },
        operationName: 'testOp',
      })
    ).rejects.toThrow();

    // Breaker should be open now (3 failures from first retry + 1 from second = 4, but it opens at 3)
    expect(breaker.getState()).toBe('OPEN');
  });

  it('should block retry when circuit is open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      name: 'block-test',
    });

    // Manually open the circuit
    breaker.recordFailure(new Error('test'));
    breaker.recordFailure(new Error('test'));
    expect(breaker.getState()).toBe('OPEN');

    const operation = vi.fn().mockResolvedValue('success');

    // Retry should be blocked immediately
    await expect(
      withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 10 },
        circuitBreaker: { breaker },
        operationName: 'blockedOp',
      })
    ).rejects.toThrow(CircuitOpenError);

    // Operation should never be called
    expect(operation).not.toHaveBeenCalled();
  });

  it('should reset circuit breaker on successful retry', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      name: 'success-test',
    });

    // Add some failures
    breaker.recordFailure(new Error('test'));
    breaker.recordFailure(new Error('test'));
    expect(breaker.getFailureCount()).toBe(2);

    const operation = vi.fn().mockResolvedValue('success');

    await withRetry(operation, {
      policy: { maxAttempts: 1 },
      circuitBreaker: { breaker },
      operationName: 'successOp',
    });

    // Success should reset failure count
    expect(breaker.getFailureCount()).toBe(0);
  });

  it('should not count retryable failures when countRetryableFailures is false', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      name: 'no-count-test',
    });

    const operation = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 10, enableJitter: false },
        circuitBreaker: { breaker, countRetryableFailures: false },
        operationName: 'noCountOp',
      })
    ).rejects.toThrow();

    // Retryable failures should not be counted
    expect(breaker.getFailureCount()).toBe(0);
    expect(breaker.getState()).toBe('CLOSED');
  });
});
