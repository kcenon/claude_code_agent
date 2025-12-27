/**
 * Tests for configuration error classes
 */

import { describe, it, expect } from 'vitest';
import {
  ConfigParseError,
  ConfigValidationError,
  ConfigNotFoundError,
  ConfigWatchError,
} from '../../src/config/errors.js';

describe('Config Error Classes', () => {
  describe('ConfigParseError', () => {
    it('should create error with message and filePath', () => {
      const error = new ConfigParseError('Invalid YAML', '/path/to/config.yaml');

      expect(error.name).toBe('ConfigParseError');
      expect(error.message).toBe('Invalid YAML');
      expect(error.filePath).toBe('/path/to/config.yaml');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Parse failed');
      const error = new ConfigParseError('Invalid YAML', '/path/to/config.yaml', cause);

      expect(error.name).toBe('ConfigParseError');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of Error', () => {
      const error = new ConfigParseError('Test', '/path');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigParseError);
    });
  });

  describe('ConfigValidationError', () => {
    it('should create error with all properties', () => {
      const errors = [
        { path: 'name', message: 'Required field', code: 'REQUIRED', severity: 'error' as const },
      ];
      const error = new ConfigValidationError(
        'Validation failed',
        '/path/to/config.yaml',
        errors,
        '1.0.0'
      );

      expect(error.name).toBe('ConfigValidationError');
      expect(error.message).toBe('Validation failed');
      expect(error.filePath).toBe('/path/to/config.yaml');
      expect(error.errors).toEqual(errors);
      expect(error.schemaVersion).toBe('1.0.0');
    });

    it('should format errors correctly', () => {
      const errors = [
        {
          path: 'name',
          message: 'Required field',
          code: 'REQUIRED',
          severity: 'error' as const,
          suggestion: 'Add a name field',
        },
        {
          path: 'version',
          message: 'Invalid format',
          code: 'FORMAT',
          severity: 'error' as const,
        },
      ];
      const error = new ConfigValidationError('Failed', '/path', errors, '1.0.0');

      const formatted = error.formatErrors();

      expect(formatted).toContain('name');
      expect(formatted).toContain('Required field');
      expect(formatted).toContain('Add a name field');
      expect(formatted).toContain('version');
      expect(formatted).toContain('Invalid format');
    });

    it('should handle empty errors array', () => {
      const error = new ConfigValidationError('Failed', '/path', [], '1.0.0');

      const formatted = error.formatErrors();

      expect(formatted).toBe('  No detailed errors available');
    });

    it('should handle errors without suggestion', () => {
      const errors = [
        { path: 'field', message: 'Error', code: 'ERR', severity: 'error' as const },
      ];
      const error = new ConfigValidationError('Failed', '/path', errors, '1.0.0');

      const formatted = error.formatErrors();

      expect(formatted).toContain('field');
      expect(formatted).toContain('Error');
      expect(formatted).not.toContain('Suggestion');
    });

    it('should handle errors with empty suggestion', () => {
      const errors = [
        { path: 'field', message: 'Error', code: 'ERR', severity: 'error' as const, suggestion: '' },
      ];
      const error = new ConfigValidationError('Failed', '/path', errors, '1.0.0');

      const formatted = error.formatErrors();

      expect(formatted).not.toContain('Suggestion');
    });
  });

  describe('ConfigNotFoundError', () => {
    it('should create error with message and filePath', () => {
      const error = new ConfigNotFoundError('File not found', '/path/to/config.yaml');

      expect(error.name).toBe('ConfigNotFoundError');
      expect(error.message).toBe('File not found');
      expect(error.filePath).toBe('/path/to/config.yaml');
    });

    it('should be instance of Error', () => {
      const error = new ConfigNotFoundError('Test', '/path');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigNotFoundError);
    });
  });

  describe('ConfigWatchError', () => {
    it('should create error with message and filePath', () => {
      const error = new ConfigWatchError('Watch failed', '/path/to/config.yaml');

      expect(error.name).toBe('ConfigWatchError');
      expect(error.message).toBe('Watch failed');
      expect(error.filePath).toBe('/path/to/config.yaml');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('ENOENT');
      const error = new ConfigWatchError('Watch failed', '/path/to/config.yaml', cause);

      expect(error.name).toBe('ConfigWatchError');
      expect(error.cause).toBe(cause);
    });

    it('should be instance of Error', () => {
      const error = new ConfigWatchError('Test', '/path');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigWatchError);
    });
  });
});
