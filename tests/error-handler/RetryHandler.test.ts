import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Logger, resetLogger } from '../../src/monitoring/index.js';
import {
  withRetry,
  withRetryResult,
  createRetryableFunction,
  calculateDelay,
  defaultErrorClassifier,
  RetryHandler,
  DEFAULT_RETRY_POLICY,
  MaxRetriesExceededError,
  OperationTimeoutError,
  OperationAbortedError,
  NonRetryableError,
  InvalidRetryPolicyError,
} from '../../src/error-handler/index.js';
import type { RetryPolicy, RetryContext, RetryAttemptResult } from '../../src/error-handler/index.js';

describe('RetryHandler', () => {
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retry-handler-test-'));
    resetLogger();
    // Initialize logger with test directory
    new Logger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetLogger();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('DEFAULT_RETRY_POLICY', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
      expect(DEFAULT_RETRY_POLICY.baseDelayMs).toBe(5000);
      expect(DEFAULT_RETRY_POLICY.maxDelayMs).toBe(60000);
      expect(DEFAULT_RETRY_POLICY.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_POLICY.backoff).toBe('exponential');
      expect(DEFAULT_RETRY_POLICY.enableJitter).toBe(true);
      expect(DEFAULT_RETRY_POLICY.jitterFactor).toBe(0.25);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate fixed delay correctly', () => {
      const policy: RetryPolicy = {
        ...DEFAULT_RETRY_POLICY,
        backoff: 'fixed',
        baseDelayMs: 1000,
        enableJitter: false,
      };

      expect(calculateDelay(1, policy)).toBe(1000);
      expect(calculateDelay(2, policy)).toBe(1000);
      expect(calculateDelay(3, policy)).toBe(1000);
    });

    it('should calculate linear delay correctly', () => {
      const policy: RetryPolicy = {
        ...DEFAULT_RETRY_POLICY,
        backoff: 'linear',
        baseDelayMs: 1000,
        enableJitter: false,
      };

      expect(calculateDelay(1, policy)).toBe(1000);
      expect(calculateDelay(2, policy)).toBe(2000);
      expect(calculateDelay(3, policy)).toBe(3000);
    });

    it('should calculate exponential delay correctly', () => {
      const policy: RetryPolicy = {
        ...DEFAULT_RETRY_POLICY,
        backoff: 'exponential',
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        enableJitter: false,
      };

      expect(calculateDelay(1, policy)).toBe(1000);
      expect(calculateDelay(2, policy)).toBe(2000);
      expect(calculateDelay(3, policy)).toBe(4000);
    });

    it('should cap delay at maxDelayMs', () => {
      const policy: RetryPolicy = {
        ...DEFAULT_RETRY_POLICY,
        backoff: 'exponential',
        baseDelayMs: 10000,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        enableJitter: false,
      };

      expect(calculateDelay(1, policy)).toBe(10000);
      expect(calculateDelay(2, policy)).toBe(15000); // Capped
      expect(calculateDelay(3, policy)).toBe(15000); // Capped
    });

    it('should apply jitter when enabled', () => {
      const policy: RetryPolicy = {
        ...DEFAULT_RETRY_POLICY,
        backoff: 'fixed',
        baseDelayMs: 1000,
        enableJitter: true,
        jitterFactor: 0.5,
      };

      // Run multiple times to verify jitter variance
      const delays = Array.from({ length: 100 }, () => calculateDelay(1, policy));
      const uniqueDelays = new Set(delays);

      // Should have multiple unique values due to jitter
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within expected range (750 to 1250 with 0.5 jitter)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(750);
        expect(delay).toBeLessThanOrEqual(1250);
      });
    });
  });

  describe('defaultErrorClassifier', () => {
    it('should classify network errors as retryable', () => {
      expect(defaultErrorClassifier(new Error('ECONNRESET'))).toBe('retryable');
      expect(defaultErrorClassifier(new Error('Connection timeout'))).toBe('retryable');
      expect(defaultErrorClassifier(new Error('ETIMEDOUT'))).toBe('retryable');
      expect(defaultErrorClassifier(new Error('rate limit exceeded'))).toBe('retryable');
    });

    it('should classify HTTP 5xx errors as retryable', () => {
      expect(defaultErrorClassifier(new Error('502 Bad Gateway'))).toBe('retryable');
      expect(defaultErrorClassifier(new Error('503 Service Unavailable'))).toBe('retryable');
      expect(defaultErrorClassifier(new Error('504 Gateway Timeout'))).toBe('retryable');
    });

    it('should classify validation errors as non-retryable', () => {
      expect(defaultErrorClassifier(new Error('Validation failed'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('Invalid request'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('Schema error'))).toBe('non-retryable');
    });

    it('should classify auth errors as non-retryable', () => {
      expect(defaultErrorClassifier(new Error('Unauthorized'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('Authentication failed'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('Forbidden'))).toBe('non-retryable');
    });

    it('should classify HTTP 4xx errors as non-retryable', () => {
      expect(defaultErrorClassifier(new Error('400 Bad Request'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('401 Unauthorized'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('403 Forbidden'))).toBe('non-retryable');
      expect(defaultErrorClassifier(new Error('404 Not Found'))).toBe('non-retryable');
    });

    it('should classify unknown errors as unknown', () => {
      expect(defaultErrorClassifier(new Error('Some random error'))).toBe('unknown');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt if operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 100 },
        operationName: 'testOp',
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed on subsequent attempt', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 10, enableJitter: false },
        operationName: 'testOp',
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw MaxRetriesExceededError after all attempts fail', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        withRetry(operation, {
          policy: { maxAttempts: 3, baseDelayMs: 10, enableJitter: false },
          operationName: 'testOp',
        })
      ).rejects.toThrow(MaxRetriesExceededError);

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw NonRetryableError immediately for non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

      await expect(
        withRetry(operation, {
          policy: { maxAttempts: 3, baseDelayMs: 10 },
          operationName: 'testOp',
        })
      ).rejects.toThrow(NonRetryableError);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should call onAttempt callback after each attempt', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const onAttempt = vi.fn();

      await withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 10, enableJitter: false },
        onAttempt,
        operationName: 'testOp',
      });

      expect(onAttempt).toHaveBeenCalledTimes(2);

      // First call should indicate failure
      const firstCall = onAttempt.mock.calls[0] as [RetryContext, RetryAttemptResult];
      expect(firstCall[0].attempt).toBe(1);
      expect(firstCall[1].success).toBe(false);

      // Second call should indicate success
      const secondCall = onAttempt.mock.calls[1] as [RetryContext, RetryAttemptResult];
      expect(secondCall[0].attempt).toBe(2);
      expect(secondCall[1].success).toBe(true);
    });

    it('should respect custom error classifier', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Custom error'));

      // Custom classifier that treats all errors as non-retryable
      const errorClassifier = vi.fn().mockReturnValue('non-retryable');

      await expect(
        withRetry(operation, {
          policy: { maxAttempts: 3, baseDelayMs: 10 },
          errorClassifier,
          operationName: 'testOp',
        })
      ).rejects.toThrow(NonRetryableError);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(errorClassifier).toHaveBeenCalled();
    });

    it('should apply result transformation', async () => {
      const operation = vi.fn().mockResolvedValue(5);
      const transformResult = (value: number): number => value * 2;

      const result = await withRetry(operation, {
        transformResult,
        operationName: 'testOp',
      });

      expect(result).toBe(10);
    });
  });

  describe('withRetry timeout handling', () => {
    it('should throw MaxRetriesExceededError with OperationTimeoutError as lastError', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'success';
      });

      try {
        await withRetry(operation, {
          policy: { maxAttempts: 1, baseDelayMs: 10 },
          timeout: { timeoutMs: 50 },
          operationName: 'slowOp',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MaxRetriesExceededError);
        const maxRetriesError = error as MaxRetriesExceededError;
        expect(maxRetriesError.lastError).toBeInstanceOf(OperationTimeoutError);
        expect((maxRetriesError.lastError as OperationTimeoutError).timeoutMs).toBe(50);
      }
    });

    it('should succeed if operation completes within timeout', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      });

      const result = await withRetry(operation, {
        policy: { maxAttempts: 1, baseDelayMs: 10 },
        timeout: { timeoutMs: 1000 },
        operationName: 'fastOp',
      });

      expect(result).toBe('success');
    });

    it('should retry timeout errors', async () => {
      let callCount = 0;
      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'slow';
        }
        return 'success';
      });

      const result = await withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 10, enableJitter: false },
        timeout: { timeoutMs: 50 },
        operationName: 'timeoutRetryOp',
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('withRetry abort signal', () => {
    it('should throw OperationAbortedError when signal is aborted before start', async () => {
      const controller = new AbortController();
      controller.abort();

      const operation = vi.fn().mockResolvedValue('success');

      await expect(
        withRetry(operation, {
          signal: controller.signal,
          operationName: 'abortedOp',
        })
      ).rejects.toThrow(OperationAbortedError);

      expect(operation).not.toHaveBeenCalled();
    });

    it('should throw OperationAbortedError when signal is aborted during delay', async () => {
      const controller = new AbortController();

      const operation = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      const promise = withRetry(operation, {
        policy: { maxAttempts: 3, baseDelayMs: 1000, enableJitter: false },
        signal: controller.signal,
        operationName: 'abortDuringDelay',
      });

      // Abort after first failure, during delay
      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow(OperationAbortedError);
    });
  });

  describe('withRetryResult', () => {
    it('should return success result on successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withRetryResult(operation, {
        operationName: 'testOp',
      });

      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return failure result when all attempts fail', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      const result = await withRetryResult(operation, {
        policy: { maxAttempts: 2, baseDelayMs: 10, enableJitter: false },
        operationName: 'testOp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(MaxRetriesExceededError);
      expect(result.totalAttempts).toBe(2);
    });

    it('should return failure result for non-retryable error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Validation failed'));

      const result = await withRetryResult(operation, {
        operationName: 'testOp',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(NonRetryableError);
    });
  });

  describe('createRetryableFunction', () => {
    it('should create a function that retries on failure', async () => {
      let callCount = 0;
      const originalFn = async (x: number): Promise<number> => {
        callCount++;
        if (callCount < 2) {
          throw new Error('ECONNRESET');
        }
        return x * 2;
      };

      const retryableFn = createRetryableFunction(originalFn, {
        policy: { maxAttempts: 3, baseDelayMs: 10, enableJitter: false },
        operationName: 'multiply',
      });

      const result = await retryableFn(5);
      expect(result).toBe(10);
      expect(callCount).toBe(2);
    });

    it('should pass arguments correctly', async () => {
      const originalFn = async (a: string, b: number): Promise<string> => {
        return `${a}-${String(b)}`;
      };

      const retryableFn = createRetryableFunction(originalFn, {
        operationName: 'concat',
      });

      const result = await retryableFn('test', 42);
      expect(result).toBe('test-42');
    });
  });

  describe('RetryHandler class', () => {
    it('should create handler with custom policy', () => {
      const handler = new RetryHandler({ maxAttempts: 5, baseDelayMs: 2000 });
      const policy = handler.getPolicy();

      expect(policy.maxAttempts).toBe(5);
      expect(policy.baseDelayMs).toBe(2000);
      expect(policy.backoff).toBe('exponential'); // Default
    });

    it('should throw InvalidRetryPolicyError for invalid policy', () => {
      expect(() => new RetryHandler({ maxAttempts: 0 })).toThrow(InvalidRetryPolicyError);
      expect(() => new RetryHandler({ baseDelayMs: -100 })).toThrow(InvalidRetryPolicyError);
      expect(() => new RetryHandler({ jitterFactor: 2 })).toThrow(InvalidRetryPolicyError);
    });

    it('should execute operation with configured policy', async () => {
      const handler = new RetryHandler({
        maxAttempts: 2,
        baseDelayMs: 10,
        enableJitter: false,
      });

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const result = await handler.execute(operation, { operationName: 'handlerOp' });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should execute with result', async () => {
      const handler = new RetryHandler({
        maxAttempts: 2,
        baseDelayMs: 10,
        enableJitter: false,
      });

      const operation = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

      const result = await handler.executeWithResult(operation, { operationName: 'handlerOp' });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(MaxRetriesExceededError);
    });

    it('should classify errors using configured classifier', () => {
      const customClassifier = vi.fn().mockReturnValue('retryable');
      const handler = new RetryHandler({}, customClassifier);

      const result = handler.classifyError(new Error('test'));

      expect(result).toBe('retryable');
      expect(customClassifier).toHaveBeenCalled();
    });

    it('should calculate delay for specific attempt', () => {
      const handler = new RetryHandler({
        baseDelayMs: 1000,
        backoffMultiplier: 2,
        backoff: 'exponential',
        enableJitter: false,
      });

      expect(handler.calculateDelayForAttempt(1)).toBe(1000);
      expect(handler.calculateDelayForAttempt(2)).toBe(2000);
      expect(handler.calculateDelayForAttempt(3)).toBe(4000);
    });
  });
});
