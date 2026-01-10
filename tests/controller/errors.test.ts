/**
 * Tests for controller error classes
 */

import { describe, it, expect } from 'vitest';
import {
  ControllerError,
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  CircularDependencyError,
  IssueNotFoundError,
  PriorityAnalysisError,
  EmptyGraphError,
  StuckWorkerRecoveryError,
  StuckWorkerCriticalError,
  MaxRecoveryAttemptsExceededError,
} from '../../src/controller/errors.js';
import { AppError, ErrorCodes, ErrorSeverity } from '../../src/errors/index.js';

describe('Controller Error Classes', () => {
  describe('ControllerError', () => {
    it('should create base error extending AppError', () => {
      const error = new ControllerError(ErrorCodes.CTL_GRAPH_NOT_FOUND, 'Test error');

      expect(error.name).toBe('ControllerError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.CTL_GRAPH_NOT_FOUND);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have default severity and category', () => {
      const error = new ControllerError(ErrorCodes.CTL_GRAPH_NOT_FOUND, 'Test error');

      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.category).toBe('recoverable');
    });
  });

  describe('GraphNotFoundError', () => {
    it('should create error with path', () => {
      const error = new GraphNotFoundError('/path/to/graph.json');

      expect(error.name).toBe('GraphNotFoundError');
      expect(error.path).toBe('/path/to/graph.json');
      expect(error.code).toBe(ErrorCodes.CTL_GRAPH_NOT_FOUND);
      expect(error.message).toContain('/path/to/graph.json');
      expect(error.category).toBe('fatal');
    });
  });

  describe('GraphParseError', () => {
    it('should create error with path and cause', () => {
      const cause = new Error('Parse failed');
      const error = new GraphParseError('/path/to/graph.json', cause);

      expect(error.name).toBe('GraphParseError');
      expect(error.path).toBe('/path/to/graph.json');
      expect(error.cause).toBe(cause);
      expect(error.message).toContain('Parse failed');
    });

    it('should create error without cause', () => {
      const error = new GraphParseError('/path/to/graph.json');

      expect(error.name).toBe('GraphParseError');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('GraphValidationError', () => {
    it('should create error with errors array', () => {
      const errors = ['Error 1', 'Error 2'];
      const error = new GraphValidationError(errors);

      expect(error.name).toBe('GraphValidationError');
      expect(error.errors).toEqual(errors);
      expect(error.message).toContain('Error 1');
      expect(error.message).toContain('Error 2');
    });
  });

  describe('CircularDependencyError', () => {
    it('should create error with cycle', () => {
      const cycle = ['A', 'B', 'C', 'A'];
      const error = new CircularDependencyError(cycle);

      expect(error.name).toBe('CircularDependencyError');
      expect(error.cycle).toEqual(cycle);
      expect(error.message).toContain('A -> B -> C -> A');
    });
  });

  describe('IssueNotFoundError', () => {
    it('should create error with issue ID', () => {
      const error = new IssueNotFoundError('ISSUE-123');

      expect(error.name).toBe('IssueNotFoundError');
      expect(error.issueId).toBe('ISSUE-123');
      expect(error.message).toContain('ISSUE-123');
    });

    it('should create error with reference context', () => {
      const error = new IssueNotFoundError('ISSUE-123', 'dependency list');

      expect(error.referenceContext).toBe('dependency list');
      expect(error.message).toContain('dependency list');
    });
  });

  describe('PriorityAnalysisError', () => {
    it('should create error with message', () => {
      const error = new PriorityAnalysisError('Analysis failed');

      expect(error.name).toBe('PriorityAnalysisError');
      expect(error.message).toContain('Analysis failed');
    });

    it('should create error with issue ID', () => {
      const error = new PriorityAnalysisError('Analysis failed', 'ISSUE-123');

      expect(error.issueId).toBe('ISSUE-123');
      expect(error.message).toContain('ISSUE-123');
    });
  });

  describe('EmptyGraphError', () => {
    it('should create error', () => {
      const error = new EmptyGraphError();

      expect(error.name).toBe('EmptyGraphError');
      expect(error.message).toContain('no issues');
    });
  });

  describe('StuckWorkerRecoveryError', () => {
    it('should create error with worker and issue ID', () => {
      const error = new StuckWorkerRecoveryError('worker-1', 'issue-123', 3);

      expect(error.name).toBe('StuckWorkerRecoveryError');
      expect(error.workerId).toBe('worker-1');
      expect(error.issueId).toBe('issue-123');
      expect(error.attemptCount).toBe(3);
      expect(error.message).toContain('worker-1');
    });

    it('should create error with cause', () => {
      const cause = new Error('Recovery failed');
      const error = new StuckWorkerRecoveryError('worker-1', 'issue-123', 3, cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toContain('Recovery failed');
    });
  });

  describe('StuckWorkerCriticalError', () => {
    it('should create critical error with duration', () => {
      const error = new StuckWorkerCriticalError('worker-1', 'issue-123', 300000, 5);

      expect(error.name).toBe('StuckWorkerCriticalError');
      expect(error.workerId).toBe('worker-1');
      expect(error.issueId).toBe('issue-123');
      expect(error.durationMs).toBe(300000);
      expect(error.attemptCount).toBe(5);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.category).toBe('fatal');
    });
  });

  describe('MaxRecoveryAttemptsExceededError', () => {
    it('should create error with worker ID and max attempts', () => {
      const error = new MaxRecoveryAttemptsExceededError('worker-1', 5);

      expect(error.name).toBe('MaxRecoveryAttemptsExceededError');
      expect(error.workerId).toBe('worker-1');
      expect(error.maxAttempts).toBe(5);
      expect(error.message).toContain('5');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const error = new GraphNotFoundError('/path/to/graph.json');
      const json = error.toJSON();

      expect(json.code).toBe(ErrorCodes.CTL_GRAPH_NOT_FOUND);
      expect(json.message).toContain('/path/to/graph.json');
      expect(json.severity).toBe(ErrorSeverity.HIGH);
      expect(json.context.path).toBe('/path/to/graph.json');
    });

    it('should check retryability', () => {
      const fatalError = new GraphNotFoundError('/path');
      const recoverableError = new IssueNotFoundError('123');

      expect(fatalError.isRetryable()).toBe(false);
      expect(recoverableError.isRetryable()).toBe(true);
    });
  });
});
