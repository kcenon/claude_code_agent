import { describe, it, expect } from 'vitest';
import {
  ErrorHandlerError,
  MaxRetriesExceededError,
  OperationTimeoutError,
  OperationAbortedError,
  NonRetryableError,
  InvalidRetryPolicyError,
  RetryContextError,
} from '../../src/error-handler/index.js';
import type { RetryAttemptResult } from '../../src/error-handler/index.js';

describe('Error Handler Errors', () => {
  describe('ErrorHandlerError', () => {
    it('should create error with message and default code', () => {
      const error = new ErrorHandlerError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ErrorHandlerError');
      expect(error.code).toBe('ERROR_HANDLER_ERROR');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ErrorHandlerError);
    });

    it('should create error with custom code', () => {
      const error = new ErrorHandlerError('Test error', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });
  });

  describe('MaxRetriesExceededError', () => {
    it('should create error with attempt details', () => {
      const lastError = new Error('Connection failed');
      const attemptResults: RetryAttemptResult[] = [
        { attempt: 1, success: false, durationMs: 100, error: lastError },
        { attempt: 2, success: false, durationMs: 150, error: lastError },
        { attempt: 3, success: false, durationMs: 200, error: lastError },
      ];

      const error = new MaxRetriesExceededError(3, 3, lastError, attemptResults, 'fetchData');

      expect(error.name).toBe('MaxRetriesExceededError');
      expect(error.code).toBe('MAX_RETRIES_EXCEEDED');
      expect(error.attempts).toBe(3);
      expect(error.maxAttempts).toBe(3);
      expect(error.lastError).toBe(lastError);
      expect(error.attemptResults).toEqual(attemptResults);
      expect(error.operationName).toBe('fetchData');
      expect(error.message).toContain("for 'fetchData'");
      expect(error.message).toContain('3 of 3 attempts');
      expect(error.message).toContain('Connection failed');
    });

    it('should create error without operation name', () => {
      const error = new MaxRetriesExceededError(2, 3);

      expect(error.message).toBe('Max retries exceeded after 2 of 3 attempts');
      expect(error.operationName).toBeUndefined();
      expect(error.lastError).toBeUndefined();
    });
  });

  describe('OperationTimeoutError', () => {
    it('should create error with timeout details', () => {
      const error = new OperationTimeoutError(30000, 'fetchData');

      expect(error.name).toBe('OperationTimeoutError');
      expect(error.code).toBe('OPERATION_TIMEOUT');
      expect(error.timeoutMs).toBe(30000);
      expect(error.operationName).toBe('fetchData');
      expect(error.message).toContain("'fetchData'");
      expect(error.message).toContain('30000ms');
    });

    it('should create error without operation name', () => {
      const error = new OperationTimeoutError(5000);

      expect(error.message).toBe('Operation timed out after 5000ms');
      expect(error.operationName).toBeUndefined();
    });
  });

  describe('OperationAbortedError', () => {
    it('should create error with abort details', () => {
      const error = new OperationAbortedError('fetchData', 'User cancelled');

      expect(error.name).toBe('OperationAbortedError');
      expect(error.code).toBe('OPERATION_ABORTED');
      expect(error.operationName).toBe('fetchData');
      expect(error.reason).toBe('User cancelled');
      expect(error.message).toContain("'fetchData'");
      expect(error.message).toContain('User cancelled');
    });

    it('should create error without details', () => {
      const error = new OperationAbortedError();

      expect(error.message).toBe('Operation was aborted');
      expect(error.operationName).toBeUndefined();
      expect(error.reason).toBeUndefined();
    });
  });

  describe('NonRetryableError', () => {
    it('should wrap original error', () => {
      const originalError = new Error('Validation failed');
      const error = new NonRetryableError(originalError, 'validation');

      expect(error.name).toBe('NonRetryableError');
      expect(error.code).toBe('NON_RETRYABLE_ERROR');
      expect(error.originalError).toBe(originalError);
      expect(error.category).toBe('validation');
      expect(error.message).toContain('Validation failed');
    });

    it('should use default category', () => {
      const originalError = new Error('Auth error');
      const error = new NonRetryableError(originalError);

      expect(error.category).toBe('non-retryable');
    });
  });

  describe('InvalidRetryPolicyError', () => {
    it('should create error with policy validation details', () => {
      const error = new InvalidRetryPolicyError('maxAttempts', 0, 'must be >= 1');

      expect(error.name).toBe('InvalidRetryPolicyError');
      expect(error.code).toBe('INVALID_RETRY_POLICY');
      expect(error.field).toBe('maxAttempts');
      expect(error.value).toBe(0);
      expect(error.constraint).toBe('must be >= 1');
      expect(error.message).toContain('maxAttempts');
      expect(error.message).toContain('must be >= 1');
    });
  });

  describe('RetryContextError', () => {
    it('should create error with retry context', () => {
      const originalError = new Error('Network error');
      const error = new RetryContextError(originalError, 2, 3);

      expect(error.name).toBe('RetryContextError');
      expect(error.code).toBe('RETRY_CONTEXT_ERROR');
      expect(error.originalError).toBe(originalError);
      expect(error.attempt).toBe(2);
      expect(error.maxAttempts).toBe(3);
      expect(error.isFinalAttempt).toBe(false);
      expect(error.message).toContain('2/3');
      expect(error.message).toContain('Network error');
    });

    it('should mark final attempt correctly', () => {
      const originalError = new Error('Network error');
      const error = new RetryContextError(originalError, 3, 3);

      expect(error.isFinalAttempt).toBe(true);
    });
  });

  describe('Error inheritance', () => {
    it('all errors should extend Error', () => {
      expect(new ErrorHandlerError('test')).toBeInstanceOf(Error);
      expect(new MaxRetriesExceededError(1, 1)).toBeInstanceOf(Error);
      expect(new OperationTimeoutError(1000)).toBeInstanceOf(Error);
      expect(new OperationAbortedError()).toBeInstanceOf(Error);
      expect(new NonRetryableError(new Error('test'))).toBeInstanceOf(Error);
      expect(new InvalidRetryPolicyError('field', 'value', 'constraint')).toBeInstanceOf(Error);
      expect(new RetryContextError(new Error('test'), 1, 1)).toBeInstanceOf(Error);
    });

    it('all errors should extend ErrorHandlerError', () => {
      expect(new MaxRetriesExceededError(1, 1)).toBeInstanceOf(ErrorHandlerError);
      expect(new OperationTimeoutError(1000)).toBeInstanceOf(ErrorHandlerError);
      expect(new OperationAbortedError()).toBeInstanceOf(ErrorHandlerError);
      expect(new NonRetryableError(new Error('test'))).toBeInstanceOf(ErrorHandlerError);
      expect(new InvalidRetryPolicyError('field', 'value', 'constraint')).toBeInstanceOf(ErrorHandlerError);
      expect(new RetryContextError(new Error('test'), 1, 1)).toBeInstanceOf(ErrorHandlerError);
    });
  });
});
