/**
 * Impact Analyzer Agent error classes tests
 */

import { describe, it, expect } from 'vitest';

import {
  ImpactAnalyzerError,
  InputNotFoundError,
  NoInputsAvailableError,
  ChangeRequestParseError,
  InvalidChangeRequestError,
  DependencyResolutionError,
  TraceabilityGapError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
  InputParseError,
  FileReadError,
  RiskCalculationError,
  MaxDependencyDepthExceededError,
} from '../../src/impact-analyzer/errors.js';

describe('Impact Analyzer Errors', () => {
  describe('ImpactAnalyzerError', () => {
    it('should create with message', () => {
      const error = new ImpactAnalyzerError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ImpactAnalyzerError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImpactAnalyzerError);
    });

    it('should have correct prototype chain', () => {
      const error = new ImpactAnalyzerError('Test');
      expect(Object.getPrototypeOf(error)).toBe(ImpactAnalyzerError.prototype);
    });
  });

  describe('InputNotFoundError', () => {
    it('should create with input type and path', () => {
      const error = new InputNotFoundError('current_state.yaml', '/some/path');
      expect(error.message).toBe('Required input not found: current_state.yaml at /some/path');
      expect(error.name).toBe('InputNotFoundError');
      expect(error.inputType).toBe('current_state.yaml');
      expect(error.path).toBe('/some/path');
      expect(error).toBeInstanceOf(ImpactAnalyzerError);
    });
  });

  describe('NoInputsAvailableError', () => {
    it('should create with project ID and checked paths', () => {
      const checkedPaths = ['state/project1/current_state.yaml', 'analysis/project1/architecture.yaml'] as const;
      const error = new NoInputsAvailableError('project1', checkedPaths);
      expect(error.message).toBe(
        'No inputs available for project project1. Checked: state/project1/current_state.yaml, analysis/project1/architecture.yaml'
      );
      expect(error.name).toBe('NoInputsAvailableError');
      expect(error.projectId).toBe('project1');
      expect(error.checkedPaths).toEqual(checkedPaths);
    });
  });

  describe('ChangeRequestParseError', () => {
    it('should create with reason', () => {
      const error = new ChangeRequestParseError('Invalid format');
      expect(error.message).toBe('Failed to parse change request: Invalid format');
      expect(error.name).toBe('ChangeRequestParseError');
      expect(error.reason).toBe('Invalid format');
      expect(error.rawInput).toBeUndefined();
    });

    it('should create with reason and raw input', () => {
      const error = new ChangeRequestParseError('Invalid YAML', 'some: invalid: yaml');
      expect(error.reason).toBe('Invalid YAML');
      expect(error.rawInput).toBe('some: invalid: yaml');
    });
  });

  describe('InvalidChangeRequestError', () => {
    it('should create with validation errors', () => {
      const errors = ['Description is required', 'Context too long'] as const;
      const error = new InvalidChangeRequestError(errors);
      expect(error.message).toBe('Invalid change request: Description is required; Context too long');
      expect(error.name).toBe('InvalidChangeRequestError');
      expect(error.validationErrors).toEqual(errors);
    });

    it('should handle single validation error', () => {
      const error = new InvalidChangeRequestError(['Empty description']);
      expect(error.message).toBe('Invalid change request: Empty description');
    });
  });

  describe('DependencyResolutionError', () => {
    it('should create with component ID and reason', () => {
      const error = new DependencyResolutionError('CMP-001', 'Circular reference detected');
      expect(error.message).toBe('Failed to resolve dependencies for CMP-001: Circular reference detected');
      expect(error.name).toBe('DependencyResolutionError');
      expect(error.componentId).toBe('CMP-001');
      expect(error.reason).toBe('Circular reference detected');
    });
  });

  describe('TraceabilityGapError', () => {
    it('should create with from ID and to type', () => {
      const error = new TraceabilityGapError('FR-001', 'SRS feature');
      expect(error.message).toBe('Cannot trace from FR-001 to SRS feature: no traceability link found');
      expect(error.name).toBe('TraceabilityGapError');
      expect(error.fromId).toBe('FR-001');
      expect(error.toType).toBe('SRS feature');
    });
  });

  describe('NoActiveSessionError', () => {
    it('should create with default message', () => {
      const error = new NoActiveSessionError();
      expect(error.message).toBe('No active analysis session. Call startSession() first.');
      expect(error.name).toBe('NoActiveSessionError');
    });
  });

  describe('InvalidSessionStateError', () => {
    it('should create with operation and states', () => {
      const error = new InvalidSessionStateError('analyze', 'loading', 'analyzing');
      expect(error.message).toBe(
        "Cannot perform analyze: session status is 'loading', expected 'analyzing'"
      );
      expect(error.name).toBe('InvalidSessionStateError');
      expect(error.operation).toBe('analyze');
      expect(error.currentStatus).toBe('loading');
      expect(error.expectedStatus).toBe('analyzing');
    });
  });

  describe('OutputWriteError', () => {
    it('should create with path and reason', () => {
      const error = new OutputWriteError('/output/path', 'Permission denied');
      expect(error.message).toBe('Failed to write output to /output/path: Permission denied');
      expect(error.name).toBe('OutputWriteError');
      expect(error.path).toBe('/output/path');
      expect(error.reason).toBe('Permission denied');
    });
  });

  describe('InputParseError', () => {
    it('should create with path and reason', () => {
      const error = new InputParseError('/input/file.yaml', 'Invalid YAML syntax');
      expect(error.message).toBe('Failed to parse input file /input/file.yaml: Invalid YAML syntax');
      expect(error.name).toBe('InputParseError');
      expect(error.path).toBe('/input/file.yaml');
      expect(error.reason).toBe('Invalid YAML syntax');
    });
  });

  describe('FileReadError', () => {
    it('should create with path and reason', () => {
      const error = new FileReadError('/some/file.txt', 'File not found');
      expect(error.message).toBe('Failed to read file /some/file.txt: File not found');
      expect(error.name).toBe('FileReadError');
      expect(error.path).toBe('/some/file.txt');
      expect(error.reason).toBe('File not found');
    });
  });

  describe('RiskCalculationError', () => {
    it('should create with reason', () => {
      const error = new RiskCalculationError('Invalid weight configuration');
      expect(error.message).toBe('Risk calculation failed: Invalid weight configuration');
      expect(error.name).toBe('RiskCalculationError');
      expect(error.reason).toBe('Invalid weight configuration');
    });
  });

  describe('MaxDependencyDepthExceededError', () => {
    it('should create with component ID, depth, and max depth', () => {
      const error = new MaxDependencyDepthExceededError('CMP-002', 10, 5);
      expect(error.message).toBe('Maximum dependency depth exceeded for CMP-002: depth 10 > max 5');
      expect(error.name).toBe('MaxDependencyDepthExceededError');
      expect(error.componentId).toBe('CMP-002');
      expect(error.depth).toBe(10);
      expect(error.maxDepth).toBe(5);
    });
  });

  describe('Error inheritance', () => {
    it('all errors should be instances of ImpactAnalyzerError', () => {
      const errors = [
        new InputNotFoundError('type', 'path'),
        new NoInputsAvailableError('project', ['path']),
        new ChangeRequestParseError('reason'),
        new InvalidChangeRequestError(['error']),
        new DependencyResolutionError('id', 'reason'),
        new TraceabilityGapError('from', 'to'),
        new NoActiveSessionError(),
        new InvalidSessionStateError('op', 'curr', 'exp'),
        new OutputWriteError('path', 'reason'),
        new InputParseError('path', 'reason'),
        new FileReadError('path', 'reason'),
        new RiskCalculationError('reason'),
        new MaxDependencyDepthExceededError('id', 10, 5),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(ImpactAnalyzerError);
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
