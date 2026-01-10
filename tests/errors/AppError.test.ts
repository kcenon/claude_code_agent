/**
 * Tests for AppError base class
 */

import { describe, it, expect } from 'vitest';
import { AppError, ErrorCodes, ErrorSeverity, ErrorHandler } from '../../src/errors/index.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error');

      expect(error.code).toBe(ErrorCodes.GEN_UNKNOWN);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should set default severity and category', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error');

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe('transient');
    });

    it('should accept custom severity and category', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error', {
        severity: ErrorSeverity.CRITICAL,
        category: 'fatal',
      });

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.category).toBe('fatal');
    });

    it('should accept context', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error', {
        context: { key: 'value', count: 42 },
      });

      expect(error.context).toEqual({ key: 'value', count: 42 });
    });

    it('should set timestamp', () => {
      const before = new Date();
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error');
      const after = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should accept cause', () => {
      const cause = new Error('Original error');
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Wrapped error', { cause });

      expect(error.cause).toBe(cause);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const error = new AppError(ErrorCodes.CTL_GRAPH_NOT_FOUND, 'Graph not found', {
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
        context: { path: '/test' },
      });

      const json = error.toJSON();

      expect(json.code).toBe(ErrorCodes.CTL_GRAPH_NOT_FOUND);
      expect(json.message).toBe('Graph not found');
      expect(json.severity).toBe(ErrorSeverity.HIGH);
      expect(json.category).toBe('fatal');
      expect(json.context).toEqual({ path: '/test' });
      expect(json.timestamp).toBeDefined();
    });

    it('should include stack trace', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test');
      const json = error.toJSON();

      expect(json.stack).toBeDefined();
      expect(json.stack).toContain('AppError');
    });

    it('should serialize cause', () => {
      const cause = new AppError(ErrorCodes.GEN_INTERNAL, 'Inner error');
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Outer error', { cause });

      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.code).toBe(ErrorCodes.GEN_INTERNAL);
      expect(json.cause?.message).toBe('Inner error');
    });
  });

  describe('fromJSON', () => {
    it('should deserialize from JSON', () => {
      const original = new AppError(ErrorCodes.CTL_GRAPH_NOT_FOUND, 'Test', {
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
        context: { key: 'value' },
      });

      const json = original.toJSON();
      const restored = AppError.fromJSON(json);

      expect(restored.code).toBe(original.code);
      expect(restored.message).toBe(original.message);
      expect(restored.severity).toBe(original.severity);
      expect(restored.category).toBe(original.category);
      expect(restored.context).toEqual(original.context);
    });

    it('should restore cause chain', () => {
      const cause = new AppError(ErrorCodes.GEN_INTERNAL, 'Inner');
      const original = new AppError(ErrorCodes.GEN_UNKNOWN, 'Outer', { cause });

      const json = original.toJSON();
      const restored = AppError.fromJSON(json);

      expect(restored.cause).toBeDefined();
      expect((restored.cause as AppError).code).toBe(ErrorCodes.GEN_INTERNAL);
    });
  });

  describe('format', () => {
    it('should format for log output', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error');
      const formatted = error.format('log');

      expect(formatted).toBe('[GEN-001] Test error');
    });

    it('should format for CLI output', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test error');
      const formatted = error.format('cli');

      expect(formatted).toBe('Error GEN-001: Test error');
    });

    it('should format critical errors with prefix', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Critical', {
        severity: ErrorSeverity.CRITICAL,
      });
      const formatted = error.format('cli');

      expect(formatted).toBe('!!!Error GEN-001: Critical');
    });

    it('should format as JSON', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test');
      const formatted = error.format('json');

      const parsed = JSON.parse(formatted);
      expect(parsed.code).toBe(ErrorCodes.GEN_UNKNOWN);
    });
  });

  describe('isRetryable', () => {
    it('should return true for transient errors', () => {
      const error = new AppError(ErrorCodes.GEN_TIMEOUT, 'Timeout', {
        category: 'transient',
      });

      expect(error.isRetryable()).toBe(true);
    });

    it('should return true for recoverable errors', () => {
      const error = new AppError(ErrorCodes.WRK_VERIFICATION_ERROR, 'Test failed', {
        category: 'recoverable',
      });

      expect(error.isRetryable()).toBe(true);
    });

    it('should return false for fatal errors', () => {
      const error = new AppError(ErrorCodes.CTL_GRAPH_NOT_FOUND, 'Not found', {
        category: 'fatal',
      });

      expect(error.isRetryable()).toBe(false);
    });
  });

  describe('requiresEscalation', () => {
    it('should return true for fatal errors', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Fatal', {
        category: 'fatal',
      });

      expect(error.requiresEscalation()).toBe(true);
    });

    it('should return true for critical severity', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Critical', {
        severity: ErrorSeverity.CRITICAL,
        category: 'recoverable',
      });

      expect(error.requiresEscalation()).toBe(true);
    });

    it('should return false for recoverable non-critical errors', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Recoverable', {
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
      });

      expect(error.requiresEscalation()).toBe(false);
    });
  });

  describe('withContext', () => {
    it('should create new error with additional context', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test', {
        context: { key1: 'value1' },
      });

      const newError = error.withContext({ key2: 'value2' });

      expect(newError.context).toEqual({ key1: 'value1', key2: 'value2' });
      expect(error.context).toEqual({ key1: 'value1' }); // Original unchanged
    });
  });

  describe('wrap', () => {
    it('should wrap Error with AppError', () => {
      const original = new Error('Original error');
      const wrapped = AppError.wrap(original, ErrorCodes.GEN_INTERNAL);

      expect(wrapped).toBeInstanceOf(AppError);
      expect(wrapped.code).toBe(ErrorCodes.GEN_INTERNAL);
      expect(wrapped.message).toBe('Original error');
      expect(wrapped.cause).toBe(original);
    });

    it('should add context when wrapping AppError', () => {
      const original = new AppError(ErrorCodes.GEN_UNKNOWN, 'Original');
      const wrapped = AppError.wrap(original, ErrorCodes.GEN_INTERNAL, {
        context: { added: true },
      });

      expect(wrapped.context.added).toBe(true);
    });

    it('should wrap non-Error values', () => {
      const wrapped = AppError.wrap('string error', ErrorCodes.GEN_UNKNOWN);

      expect(wrapped).toBeInstanceOf(AppError);
      expect(wrapped.message).toBe('string error');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test');

      expect(AppError.isAppError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test');

      expect(AppError.isAppError(error)).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should return AppError unchanged', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test');

      expect(AppError.normalize(error)).toBe(error);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('Test error');
      const normalized = AppError.normalize(error);

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.code).toBe(ErrorCodes.GEN_UNKNOWN);
      expect(normalized.message).toBe('Test error');
    });

    it('should convert string to AppError', () => {
      const normalized = AppError.normalize('string error');

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe('string error');
    });
  });
});

describe('ErrorHandler', () => {
  describe('categorize', () => {
    it('should return category from AppError', () => {
      const error = new AppError(ErrorCodes.GEN_UNKNOWN, 'Test', {
        category: 'fatal',
      });

      expect(ErrorHandler.categorize(error)).toBe('fatal');
    });

    it('should categorize timeout errors as transient', () => {
      const error = new Error('Operation timed out');

      expect(ErrorHandler.categorize(error)).toBe('transient');
    });

    it('should categorize connection errors as transient', () => {
      const error = new Error('Connection refused');

      expect(ErrorHandler.categorize(error)).toBe('transient');
    });

    it('should categorize test failures as recoverable', () => {
      const error = new Error('test failed');

      expect(ErrorHandler.categorize(error)).toBe('recoverable');
    });

    it('should categorize permission errors as fatal', () => {
      const error = new Error('permission denied');

      expect(ErrorHandler.categorize(error)).toBe('fatal');
    });
  });

  describe('isRetryable', () => {
    it('should check AppError retryability', () => {
      const fatalError = new AppError(ErrorCodes.GEN_UNKNOWN, 'Fatal', {
        category: 'fatal',
      });
      const transientError = new AppError(ErrorCodes.GEN_TIMEOUT, 'Timeout', {
        category: 'transient',
      });

      expect(ErrorHandler.isRetryable(fatalError)).toBe(false);
      expect(ErrorHandler.isRetryable(transientError)).toBe(true);
    });
  });

  describe('createErrorInfo', () => {
    it('should create extended error info', () => {
      const error = new AppError(ErrorCodes.CTL_GRAPH_NOT_FOUND, 'Not found', {
        category: 'fatal',
        context: { path: '/test' },
      });

      const info = ErrorHandler.createErrorInfo(error, { additional: 'data' });

      expect(info.code).toBe(ErrorCodes.CTL_GRAPH_NOT_FOUND);
      expect(info.category).toBe('fatal');
      expect(info.retryable).toBe(false);
      expect(info.context.path).toBe('/test');
      expect(info.context.additional).toBe('data');
      expect(info.suggestedAction).toBeDefined();
    });
  });

  describe('assert', () => {
    it('should not throw for true condition', () => {
      expect(() => {
        ErrorHandler.assert(true, ErrorCodes.GEN_INVALID_ARGUMENT, 'Should not throw');
      }).not.toThrow();
    });

    it('should throw AppError for false condition', () => {
      expect(() => {
        ErrorHandler.assert(false, ErrorCodes.GEN_INVALID_ARGUMENT, 'Assertion failed');
      }).toThrow(AppError);
    });
  });
});
