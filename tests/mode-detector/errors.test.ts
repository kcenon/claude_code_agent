/**
 * Mode Detector errors tests
 */

import { describe, it, expect } from 'vitest';

import {
  ModeDetectorError,
  ProjectNotFoundError,
  NoActiveSessionError,
  InvalidSessionStateError,
  DocumentAnalysisError,
  CodebaseAnalysisError,
  InvalidConfigurationError,
  OutputWriteError,
  DetectionTimeoutError,
} from '../../src/mode-detector/errors.js';

describe('ModeDetector Errors', () => {
  describe('ModeDetectorError', () => {
    it('should create base error with message and code', () => {
      const error = new ModeDetectorError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('ModeDetectorError');
    });

    it('should include details when provided', () => {
      const details = { key: 'value' };
      const error = new ModeDetectorError('Test error', 'TEST_CODE', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('ProjectNotFoundError', () => {
    it('should include path in message', () => {
      const error = new ProjectNotFoundError('/test/path');
      expect(error.message).toContain('/test/path');
      expect(error.code).toBe('PROJECT_NOT_FOUND');
      expect(error.name).toBe('ProjectNotFoundError');
    });

    it('should store path in details', () => {
      const error = new ProjectNotFoundError('/test/path');
      expect(error.details).toEqual({ path: '/test/path' });
    });
  });

  describe('NoActiveSessionError', () => {
    it('should have appropriate message', () => {
      const error = new NoActiveSessionError();
      expect(error.message).toContain('No active detection session');
      expect(error.code).toBe('NO_ACTIVE_SESSION');
      expect(error.name).toBe('NoActiveSessionError');
    });
  });

  describe('InvalidSessionStateError', () => {
    it('should include current and required status', () => {
      const error = new InvalidSessionStateError('completed', 'detecting');
      expect(error.message).toContain('completed');
      expect(error.message).toContain('detecting');
      expect(error.code).toBe('INVALID_SESSION_STATE');
      expect(error.name).toBe('InvalidSessionStateError');
    });

    it('should store statuses in details', () => {
      const error = new InvalidSessionStateError('completed', 'detecting');
      expect(error.details).toEqual({
        currentStatus: 'completed',
        requiredStatus: 'detecting',
      });
    });
  });

  describe('DocumentAnalysisError', () => {
    it('should include error message', () => {
      const error = new DocumentAnalysisError('Failed to parse');
      expect(error.message).toContain('Failed to parse');
      expect(error.code).toBe('DOCUMENT_ANALYSIS_ERROR');
      expect(error.name).toBe('DocumentAnalysisError');
    });
  });

  describe('CodebaseAnalysisError', () => {
    it('should include error message', () => {
      const error = new CodebaseAnalysisError('Cannot scan directory');
      expect(error.message).toContain('Cannot scan directory');
      expect(error.code).toBe('CODEBASE_ANALYSIS_ERROR');
      expect(error.name).toBe('CodebaseAnalysisError');
    });
  });

  describe('InvalidConfigurationError', () => {
    it('should include error message', () => {
      const error = new InvalidConfigurationError('Invalid threshold');
      expect(error.message).toContain('Invalid threshold');
      expect(error.code).toBe('INVALID_CONFIGURATION');
      expect(error.name).toBe('InvalidConfigurationError');
    });
  });

  describe('OutputWriteError', () => {
    it('should include path in message', () => {
      const error = new OutputWriteError('/output/path');
      expect(error.message).toContain('/output/path');
      expect(error.code).toBe('OUTPUT_WRITE_ERROR');
      expect(error.name).toBe('OutputWriteError');
    });

    it('should store cause error', () => {
      const cause = new Error('Permission denied');
      const error = new OutputWriteError('/output/path', cause);
      expect(error.details).toEqual({ path: '/output/path', cause });
    });
  });

  describe('DetectionTimeoutError', () => {
    it('should include timeout value in message', () => {
      const error = new DetectionTimeoutError(5000);
      expect(error.message).toContain('5000');
      expect(error.code).toBe('DETECTION_TIMEOUT');
      expect(error.name).toBe('DetectionTimeoutError');
    });

    it('should store timeout in details', () => {
      const error = new DetectionTimeoutError(5000);
      expect(error.details).toEqual({ timeoutMs: 5000 });
    });
  });

  describe('Error inheritance', () => {
    it('should be instance of Error', () => {
      const error = new ModeDetectorError('test', 'TEST');
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of ModeDetectorError for all subtypes', () => {
      expect(new ProjectNotFoundError('/path')).toBeInstanceOf(ModeDetectorError);
      expect(new NoActiveSessionError()).toBeInstanceOf(ModeDetectorError);
      expect(new InvalidSessionStateError('a', 'b')).toBeInstanceOf(ModeDetectorError);
      expect(new DocumentAnalysisError('msg')).toBeInstanceOf(ModeDetectorError);
      expect(new CodebaseAnalysisError('msg')).toBeInstanceOf(ModeDetectorError);
      expect(new InvalidConfigurationError('msg')).toBeInstanceOf(ModeDetectorError);
      expect(new OutputWriteError('/path')).toBeInstanceOf(ModeDetectorError);
      expect(new DetectionTimeoutError(1000)).toBeInstanceOf(ModeDetectorError);
    });
  });
});
