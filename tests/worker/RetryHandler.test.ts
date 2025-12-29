import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RetryHandler } from '../../src/worker/RetryHandler.js';
import type { RetryPolicy, EscalationReport, ProgressCheckpoint } from '../../src/worker/types.js';
import {
  VerificationError,
  ImplementationBlockedError,
  OperationTimeoutError,
  categorizeError,
  createWorkerErrorInfo,
  isRetryableError,
  requiresEscalation,
  getSuggestedAction,
} from '../../src/worker/errors.js';

describe('RetryHandler', () => {
  let testDir: string;
  let handler: RetryHandler;

  beforeEach(async () => {
    testDir = join(tmpdir(), `retry-handler-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    handler = new RetryHandler({
      workerId: 'test-worker',
      projectRoot: testDir,
    });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = handler.getConfig();
      expect(config.workerId).toBe('test-worker');
      expect(config.projectRoot).toBe(testDir);
      expect(config.retryPolicy.maxAttempts).toBe(3);
      expect(config.retryPolicy.backoff).toBe('exponential');
    });

    it('should accept custom retry policy', () => {
      const customPolicy: RetryPolicy = {
        maxAttempts: 5,
        baseDelayMs: 500,
        backoff: 'linear',
        maxDelayMs: 10000,
      };
      const customHandler = new RetryHandler({
        workerId: 'custom-worker',
        projectRoot: testDir,
        retryPolicy: customPolicy,
      });
      const config = customHandler.getConfig();
      expect(config.retryPolicy.maxAttempts).toBe(5);
      expect(config.retryPolicy.baseDelayMs).toBe(500);
      expect(config.retryPolicy.backoff).toBe('linear');
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await handler.executeWithRetry(operation, {
        taskId: 'task-1',
        step: 'code_generation',
        workOrder: { id: 'WO-001' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce('success');

      const result = await handler.executeWithRetry(operation, {
        taskId: 'task-1',
        step: 'code_generation',
        workOrder: { id: 'WO-001' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on fatal error', async () => {
      const fatalError = new ImplementationBlockedError('ISS-001', ['Dependency missing']);
      const operation = vi.fn().mockRejectedValue(fatalError);

      const result = await handler.executeWithRetry(operation, {
        taskId: 'task-1',
        step: 'code_generation',
        workOrder: { id: 'WO-001' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('fatal');
      expect(result.attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw MaxRetriesExceededError after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Transient error'));

      await expect(
        handler.executeWithRetry(operation, {
          taskId: 'task-1',
          step: 'code_generation',
          workOrder: { id: 'WO-001' },
        })
      ).rejects.toThrow('Max retries');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should record retry attempts', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValue('success');

      const result = await handler.executeWithRetry(operation, {
        taskId: 'task-1',
        step: 'code_generation',
        workOrder: { id: 'WO-001' },
      });

      expect(result.success).toBe(true);
      expect(result.retryAttempts).toHaveLength(2);
      expect(result.retryAttempts[0]?.attempt).toBe(1);
      expect(result.retryAttempts[1]?.attempt).toBe(2);
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running operations', async () => {
      const shortTimeoutHandler = new RetryHandler({
        workerId: 'test-worker',
        projectRoot: testDir,
        retryPolicy: {
          maxAttempts: 1,
          baseDelayMs: 100,
          backoff: 'fixed',
          maxDelayMs: 1000,
          timeoutMs: 100, // Very short timeout
        },
      });

      const slowOperation = async (): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'done';
      };

      await expect(
        shortTimeoutHandler.executeWithRetry(slowOperation, {
          taskId: 'task-1',
          step: 'code_generation',
          workOrder: { id: 'WO-001' },
        })
      ).rejects.toThrow('Max retries');
    });
  });

  describe('checkpoint management', () => {
    it('should create checkpoint before operation', async () => {
      await handler.createCheckpoint('task-1', 'code_generation', 1, { progress: 50 });

      const checkpoint = handler.getCurrentCheckpoint();
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.taskId).toBe('task-1');
      expect(checkpoint?.currentStep).toBe('code_generation');
      expect(checkpoint?.attemptNumber).toBe(1);
    });

    it('should save checkpoint to disk', async () => {
      await handler.createCheckpoint('task-1', 'code_generation', 1, { progress: 50 });

      const checkpointPath = join(
        testDir,
        '.ad-sdlc/scratchpad/checkpoints',
        'task-1-checkpoint.json'
      );
      expect(existsSync(checkpointPath)).toBe(true);

      const content = await readFile(checkpointPath, 'utf-8');
      const saved = JSON.parse(content) as ProgressCheckpoint;
      expect(saved.taskId).toBe('task-1');
    });

    it('should load checkpoint from disk', async () => {
      await handler.createCheckpoint('task-1', 'verification', 2, { step: 'lint' });

      const loaded = await handler.loadCheckpoint('task-1');
      expect(loaded).not.toBeNull();
      expect(loaded?.currentStep).toBe('verification');
      expect(loaded?.attemptNumber).toBe(2);
    });

    it('should clear checkpoint on success', async () => {
      await handler.createCheckpoint('task-1', 'code_generation', 1, {});
      await handler.clearCheckpoint('task-1');

      const checkpoint = handler.getCurrentCheckpoint();
      expect(checkpoint).toBeNull();
    });
  });

  describe('escalation', () => {
    it('should call escalation callback', async () => {
      const onEscalation = vi.fn();
      const handlerWithCallback = new RetryHandler({
        workerId: 'test-worker',
        projectRoot: testDir,
        onEscalation,
      });

      const errorInfo = createWorkerErrorInfo(new Error('Fatal error'));
      await handlerWithCallback.escalate('task-1', { id: 'WO-001' }, errorInfo);

      expect(onEscalation).toHaveBeenCalledTimes(1);
      const report: EscalationReport = onEscalation.mock.calls[0][0];
      expect(report.taskId).toBe('task-1');
      expect(report.workerId).toBe('test-worker');
    });

    it('should save escalation report to disk', async () => {
      const errorInfo = createWorkerErrorInfo(new Error('Test error'));
      await handler.escalate('task-1', { id: 'WO-001' }, errorInfo);

      const reportPath = join(
        testDir,
        '.ad-sdlc/scratchpad/escalations',
        'task-1-escalation.json'
      );
      expect(existsSync(reportPath)).toBe(true);

      const content = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(content) as EscalationReport;
      expect(report.taskId).toBe('task-1');
      expect(report.recommendation).toBeDefined();
    });
  });
});

describe('Error Categorization', () => {
  describe('categorizeError', () => {
    it('should categorize transient errors', () => {
      const networkError = new Error('ECONNRESET');
      networkError.name = 'ECONNRESET';
      expect(categorizeError(networkError)).toBe('transient');

      const timeoutError = new Error('Connection timeout');
      expect(categorizeError(timeoutError)).toBe('transient');
    });

    it('should categorize recoverable errors', () => {
      const verificationError = new VerificationError('test', 'Test failed');
      expect(categorizeError(verificationError)).toBe('recoverable');

      const testFailedError = new Error('Test failed at line 10');
      expect(categorizeError(testFailedError)).toBe('recoverable');
    });

    it('should categorize fatal errors', () => {
      const blockedError = new ImplementationBlockedError('ISS-001', ['Blocker']);
      expect(categorizeError(blockedError)).toBe('fatal');

      const permissionError = new Error('Permission denied');
      expect(categorizeError(permissionError)).toBe('fatal');
    });

    it('should use error code for categorization', () => {
      const enoentError = new Error('File not found');
      (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
      expect(categorizeError(enoentError)).toBe('fatal');

      const econnError = new Error('Connection refused');
      (econnError as NodeJS.ErrnoException).code = 'ECONNREFUSED';
      expect(categorizeError(econnError)).toBe('transient');
    });
  });

  describe('createWorkerErrorInfo', () => {
    it('should create error info with correct category', () => {
      const verificationError = new VerificationError('lint', 'Lint errors');
      const info = createWorkerErrorInfo(verificationError);

      expect(info.category).toBe('recoverable');
      expect(info.code).toBe('VerificationError');
      expect(info.message).toContain('lint verification failed');
      expect(info.retryable).toBe(true);
    });

    it('should include additional context', () => {
      const error = new Error('Test error');
      const info = createWorkerErrorInfo(error, { customField: 'value' });

      expect(info.context.customField).toBe('value');
    });

    it('should extract context from specific error types', () => {
      const blockedError = new ImplementationBlockedError('ISS-001', ['Blocker 1']);
      const info = createWorkerErrorInfo(blockedError);

      expect(info.context.issueId).toBe('ISS-001');
      expect(info.context.blockers).toEqual(['Blocker 1']);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for transient errors', () => {
      const error = new Error('Network error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for recoverable errors', () => {
      const error = new VerificationError('test', 'Failed');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for fatal errors', () => {
      const error = new ImplementationBlockedError('ISS-001', ['Blocker']);
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('requiresEscalation', () => {
    it('should return true for fatal errors', () => {
      const error = new ImplementationBlockedError('ISS-001', ['Blocker']);
      expect(requiresEscalation(error)).toBe(true);
    });

    it('should return false for transient errors', () => {
      const error = new Error('Connection timeout');
      expect(requiresEscalation(error)).toBe(false);
    });

    it('should return false for recoverable errors', () => {
      const error = new VerificationError('lint', 'Errors');
      expect(requiresEscalation(error)).toBe(false);
    });
  });

  describe('getSuggestedAction', () => {
    it('should suggest retry for transient errors', () => {
      const error = new Error('Network error');
      const suggestion = getSuggestedAction(error, 'transient');
      expect(suggestion).toContain('Retry');
    });

    it('should suggest fix for verification errors', () => {
      const testError = new VerificationError('test', 'Failed');
      const suggestion = getSuggestedAction(testError, 'recoverable');
      expect(suggestion).toContain('test');

      const lintError = new VerificationError('lint', 'Errors');
      const lintSuggestion = getSuggestedAction(lintError, 'recoverable');
      expect(lintSuggestion).toContain('lint');
    });

    it('should suggest escalation for fatal errors', () => {
      const error = new ImplementationBlockedError('ISS-001', ['Blocker']);
      const suggestion = getSuggestedAction(error, 'fatal');
      expect(suggestion).toContain('Escalate');
    });
  });
});

describe('OperationTimeoutError', () => {
  it('should create error with task ID, operation and timeout', () => {
    const error = new OperationTimeoutError('task-1', 'code_generation', 60000);
    expect(error.message).toContain('task-1');
    expect(error.message).toContain('code_generation');
    expect(error.message).toContain('60000');
    expect(error.name).toBe('OperationTimeoutError');
    expect(error.taskId).toBe('task-1');
    expect(error.operation).toBe('code_generation');
    expect(error.timeoutMs).toBe(60000);
  });

  it('should be categorized as transient', () => {
    const error = new OperationTimeoutError('task-1', 'verification', 30000);
    expect(categorizeError(error)).toBe('transient');
  });
});
