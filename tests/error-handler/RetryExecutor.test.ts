import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Logger, resetLogger } from '../../src/monitoring/index.js';
import {
  RetryExecutor,
  DEFAULT_UNIFIED_RETRY_POLICY,
  RETRY_POLICIES,
  executeWithRetry,
  createRetryableFunction as createUnifiedRetryableFunction,
  fromLegacyPolicy,
} from '../../src/error-handler/RetryExecutor.js';
import {
  MaxRetriesExceededError,
  NonRetryableError,
  OperationAbortedError,
  CircuitOpenError,
} from '../../src/error-handler/errors.js';
import { CircuitBreaker } from '../../src/error-handler/CircuitBreaker.js';
import { RetryMetrics, resetGlobalRetryMetrics } from '../../src/error-handler/RetryMetrics.js';
import type { UnifiedRetryPolicy } from '../../src/error-handler/RetryExecutor.js';

describe('RetryExecutor', () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retry-executor-test-'));
    resetLogger();
    resetGlobalRetryMetrics();
    new Logger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetLogger();
    resetGlobalRetryMetrics();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('DEFAULT_UNIFIED_RETRY_POLICY', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_UNIFIED_RETRY_POLICY.maxAttempts).toBe(3);
      expect(DEFAULT_UNIFIED_RETRY_POLICY.backoffStrategy).toBe('exponential');
      expect(DEFAULT_UNIFIED_RETRY_POLICY.baseDelayMs).toBe(1000);
      expect(DEFAULT_UNIFIED_RETRY_POLICY.maxDelayMs).toBe(60000);
      expect(DEFAULT_UNIFIED_RETRY_POLICY.multiplier).toBe(2);
      expect(DEFAULT_UNIFIED_RETRY_POLICY.jitterRatio).toBe(0.25);
    });
  });

  describe('RETRY_POLICIES', () => {
    it('should have predefined policies', () => {
      expect(RETRY_POLICIES.default).toBeDefined();
      expect(RETRY_POLICIES.aggressive).toBeDefined();
      expect(RETRY_POLICIES.conservative).toBeDefined();
      expect(RETRY_POLICIES.fast).toBeDefined();
      expect(RETRY_POLICIES.apiCall).toBeDefined();
      expect(RETRY_POLICIES.fileIO).toBeDefined();
      expect(RETRY_POLICIES.database).toBeDefined();
    });

    it('should have valid configurations', () => {
      expect(RETRY_POLICIES.aggressive.maxAttempts).toBe(5);
      expect(RETRY_POLICIES.conservative.maxAttempts).toBe(2);
      expect(RETRY_POLICIES.fast.backoffStrategy).toBe('fixed');
      expect(RETRY_POLICIES.fileIO.backoffStrategy).toBe('fibonacci');
    });
  });

  describe('RetryExecutor class', () => {
    describe('constructor', () => {
      it('should use default policy when no override', () => {
        const executor = new RetryExecutor();
        const policy = executor.getPolicy();
        expect(policy).toEqual(DEFAULT_UNIFIED_RETRY_POLICY);
      });

      it('should merge partial policy with defaults', () => {
        const executor = new RetryExecutor({ maxAttempts: 5, jitterRatio: 0.5 });
        const policy = executor.getPolicy();
        expect(policy.maxAttempts).toBe(5);
        expect(policy.jitterRatio).toBe(0.5);
        expect(policy.backoffStrategy).toBe(DEFAULT_UNIFIED_RETRY_POLICY.backoffStrategy);
      });
    });

    describe('withPolicy', () => {
      it('should create executor with predefined policy', () => {
        const executor = RetryExecutor.withPolicy('aggressive');
        const policy = executor.getPolicy();
        expect(policy.maxAttempts).toBe(5);
      });
    });

    describe('execute', () => {
      it('should succeed on first attempt', async () => {
        const executor = new RetryExecutor();
        const operation = vi.fn().mockResolvedValue('success');

        const result = await executor.execute(operation);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and succeed', async () => {
        const executor = new RetryExecutor({ baseDelayMs: 10, jitterRatio: 0 });
        const operation = vi
          .fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValue('success');

        const result = await executor.execute(operation, { operationName: 'test' });

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(2);
      });

      it('should throw MaxRetriesExceededError when all attempts fail', async () => {
        const executor = new RetryExecutor({ maxAttempts: 2, baseDelayMs: 10, jitterRatio: 0 });
        const operation = vi.fn().mockRejectedValue(new Error('timeout'));

        await expect(
          executor.execute(operation, { operationName: 'failing' })
        ).rejects.toThrow(MaxRetriesExceededError);

        expect(operation).toHaveBeenCalledTimes(2);
      });

      it('should throw NonRetryableError for non-retryable errors', async () => {
        const executor = new RetryExecutor();
        const operation = vi.fn().mockRejectedValue(new Error('validation failed'));

        await expect(executor.execute(operation)).rejects.toThrow(NonRetryableError);

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should respect abort signal', async () => {
        const executor = new RetryExecutor({ baseDelayMs: 1000 });
        const controller = new AbortController();
        const operation = vi
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValue('success');

        // Abort before retry delay completes
        setTimeout(() => controller.abort(), 50);

        await expect(
          executor.execute(operation, { signal: controller.signal })
        ).rejects.toThrow(OperationAbortedError);
      });

      it('should integrate with circuit breaker', async () => {
        const circuitBreaker = new CircuitBreaker({
          failureThreshold: 2,
          resetTimeoutMs: 1000,
        });

        const executor = new RetryExecutor({ maxAttempts: 5, baseDelayMs: 10, jitterRatio: 0 });
        const operation = vi.fn().mockRejectedValue(new Error('timeout'));

        // First call should fail and open circuit
        await expect(
          executor.execute(operation, { circuitBreaker })
        ).rejects.toThrow();

        // Second call should fail and open circuit
        await expect(
          executor.execute(operation, { circuitBreaker })
        ).rejects.toThrow();

        // Circuit should now be open
        expect(circuitBreaker.getState()).toBe('OPEN');

        // Third call should be blocked by circuit breaker
        await expect(
          executor.execute(operation, { circuitBreaker })
        ).rejects.toThrow(CircuitOpenError);
      });
    });

    describe('executeWithResult', () => {
      it('should return success result', async () => {
        const executor = new RetryExecutor();
        const operation = vi.fn().mockResolvedValue('data');

        const result = await executor.executeWithResult(operation);

        expect(result.success).toBe(true);
        expect(result.value).toBe('data');
        expect(result.attempts).toBe(1);
        expect(result.error).toBeUndefined();
      });

      it('should return failure result without throwing', async () => {
        const executor = new RetryExecutor({ maxAttempts: 2, baseDelayMs: 10, jitterRatio: 0 });
        const operation = vi.fn().mockRejectedValue(new Error('timeout'));

        const result = await executor.executeWithResult(operation);

        expect(result.success).toBe(false);
        expect(result.value).toBeUndefined();
        expect(result.attempts).toBe(2);
        expect(result.error).toBeInstanceOf(MaxRetriesExceededError);
      });

      it('should track delays between attempts', async () => {
        const executor = new RetryExecutor({
          maxAttempts: 3,
          backoffStrategy: 'fixed',
          baseDelayMs: 50,
          jitterRatio: 0,
        });

        const operation = vi
          .fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValue('success');

        const result = await executor.executeWithResult(operation);

        expect(result.success).toBe(true);
        expect(result.delays).toHaveLength(2);
        expect(result.delays[0]).toBe(50);
        expect(result.delays[1]).toBe(50);
      });
    });

    describe('calculateDelay', () => {
      it('should calculate exponential delay', () => {
        const executor = new RetryExecutor({
          backoffStrategy: 'exponential',
          baseDelayMs: 1000,
          multiplier: 2,
          jitterRatio: 0,
        });

        expect(executor.calculateDelay(1)).toBe(1000);
        expect(executor.calculateDelay(2)).toBe(2000);
        expect(executor.calculateDelay(3)).toBe(4000);
      });

      it('should calculate fibonacci delay', () => {
        const executor = new RetryExecutor({
          backoffStrategy: 'fibonacci',
          baseDelayMs: 1000,
          jitterRatio: 0,
        });

        expect(executor.calculateDelay(1)).toBe(1000);
        expect(executor.calculateDelay(2)).toBe(1000);
        expect(executor.calculateDelay(3)).toBe(2000);
        expect(executor.calculateDelay(4)).toBe(3000);
        expect(executor.calculateDelay(5)).toBe(5000);
      });
    });
  });

  describe('executeWithRetry function', () => {
    it('should execute with default policy', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      const result = await executeWithRetry(operation);

      expect(result).toBe('result');
    });

    it('should accept custom policy', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('result');

      const result = await executeWithRetry(operation, {
        policy: { maxAttempts: 2, baseDelayMs: 10, jitterRatio: 0 },
      });

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('createUnifiedRetryableFunction', () => {
    it('should create a retryable function', async () => {
      const fn = vi.fn().mockResolvedValue('data');
      const retryableFn = createUnifiedRetryableFunction(fn);

      const result = await retryableFn();

      expect(result).toBe('data');
    });

    it('should pass arguments to wrapped function', async () => {
      const fn = vi.fn().mockImplementation((a: number, b: string) => Promise.resolve(`${String(a)}-${b}`));
      const retryableFn = createUnifiedRetryableFunction(fn);

      const result = await retryableFn(42, 'test');

      expect(result).toBe('42-test');
      expect(fn).toHaveBeenCalledWith(42, 'test');
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const retryableFn = createUnifiedRetryableFunction(fn, { baseDelayMs: 10, jitterRatio: 0 });

      const result = await retryableFn();

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('fromLegacyPolicy', () => {
    it('should convert legacy policy to unified policy', () => {
      const legacyPolicy = {
        maxAttempts: 5,
        baseDelayMs: 2000,
        maxDelayMs: 30000,
        backoffMultiplier: 3,
        backoff: 'linear' as const,
        enableJitter: true,
        jitterFactor: 0.3,
      };

      const unified = fromLegacyPolicy(legacyPolicy);

      expect(unified.maxAttempts).toBe(5);
      expect(unified.baseDelayMs).toBe(2000);
      expect(unified.maxDelayMs).toBe(30000);
      expect(unified.multiplier).toBe(3);
      expect(unified.backoffStrategy).toBe('linear');
      expect(unified.jitterRatio).toBe(0.3);
    });

    it('should handle disabled jitter', () => {
      const legacyPolicy = {
        enableJitter: false,
        jitterFactor: 0.5,
      };

      const unified = fromLegacyPolicy(legacyPolicy);

      expect(unified.jitterRatio).toBe(0);
    });

    it('should use defaults for missing values', () => {
      const unified = fromLegacyPolicy({});

      expect(unified.maxAttempts).toBe(DEFAULT_UNIFIED_RETRY_POLICY.maxAttempts);
      expect(unified.backoffStrategy).toBe(DEFAULT_UNIFIED_RETRY_POLICY.backoffStrategy);
    });
  });

  describe('metrics integration', () => {
    it('should record metrics on success', async () => {
      const metrics = new RetryMetrics();
      const executor = new RetryExecutor();
      const operation = vi.fn().mockResolvedValue('success');

      await executor.execute(operation, { metrics, operationName: 'testOp' });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.successfulOperations).toBe(1);
    });

    it('should record metrics on failure', async () => {
      const metrics = new RetryMetrics();
      const executor = new RetryExecutor({ maxAttempts: 2, baseDelayMs: 10, jitterRatio: 0 });
      const operation = vi.fn().mockRejectedValue(new Error('timeout'));

      await executor.executeWithResult(operation, { metrics, operationName: 'failOp' });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.failedOperations).toBe(1);
    });

    it('should track strategy in metrics', async () => {
      const metrics = new RetryMetrics();
      const executor = new RetryExecutor({ backoffStrategy: 'fibonacci' });
      const operation = vi.fn().mockResolvedValue('success');

      await executor.execute(operation, { metrics });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.byStrategy['fibonacci']?.operationCount).toBe(1);
    });
  });
});
