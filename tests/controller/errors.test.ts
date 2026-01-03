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

describe('Controller Error Classes', () => {
  describe('ControllerError', () => {
    it('should create base error', () => {
      const error = new ControllerError('Test error');

      expect(error.name).toBe('ControllerError');
      expect(error.message).toBe('Test error');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('GraphNotFoundError', () => {
    it('should create error with path', () => {
      const error = new GraphNotFoundError('/path/to/graph.json');

      expect(error.name).toBe('GraphNotFoundError');
      expect(error.path).toBe('/path/to/graph.json');
      expect(error.message).toContain('/path/to/graph.json');
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
    it('should create error with issueId and context', () => {
      const error = new IssueNotFoundError('ISSUE-123', 'dependency check');

      expect(error.name).toBe('IssueNotFoundError');
      expect(error.issueId).toBe('ISSUE-123');
      expect(error.context).toBe('dependency check');
      expect(error.message).toContain('ISSUE-123');
      expect(error.message).toContain('dependency check');
    });

    it('should create error without context', () => {
      const error = new IssueNotFoundError('ISSUE-123');

      expect(error.name).toBe('IssueNotFoundError');
      expect(error.context).toBeUndefined();
    });
  });

  describe('PriorityAnalysisError', () => {
    it('should create error with message and issueId', () => {
      const error = new PriorityAnalysisError('Analysis failed', 'ISSUE-123');

      expect(error.name).toBe('PriorityAnalysisError');
      expect(error.issueId).toBe('ISSUE-123');
      expect(error.message).toContain('Analysis failed');
      expect(error.message).toContain('ISSUE-123');
    });

    it('should create error without issueId', () => {
      const error = new PriorityAnalysisError('Analysis failed');

      expect(error.name).toBe('PriorityAnalysisError');
      expect(error.issueId).toBeUndefined();
      expect(error.message).toContain('Analysis failed');
      expect(error.message).not.toContain('for issue');
    });
  });

  describe('EmptyGraphError', () => {
    it('should create error with default message', () => {
      const error = new EmptyGraphError();

      expect(error.name).toBe('EmptyGraphError');
      expect(error.message).toContain('no issues');
    });
  });

  describe('StuckWorkerRecoveryError', () => {
    it('should create error with workerId, issueId, and attemptCount', () => {
      const cause = new Error('Recovery failed');
      const error = new StuckWorkerRecoveryError('worker-1', 'issue-1', 3, cause);

      expect(error.name).toBe('StuckWorkerRecoveryError');
      expect(error.workerId).toBe('worker-1');
      expect(error.issueId).toBe('issue-1');
      expect(error.attemptCount).toBe(3);
      expect(error.cause).toBe(cause);
      expect(error.message).toContain('worker-1');
      expect(error.message).toContain('issue-1');
      expect(error.message).toContain('3');
    });

    it('should create error without issueId', () => {
      const error = new StuckWorkerRecoveryError('worker-1', null, 2);

      expect(error.name).toBe('StuckWorkerRecoveryError');
      expect(error.issueId).toBeNull();
      expect(error.message).not.toContain('for task');
    });

    it('should create error without cause', () => {
      const error = new StuckWorkerRecoveryError('worker-1', 'issue-1', 1);

      expect(error.cause).toBeUndefined();
    });
  });

  describe('StuckWorkerCriticalError', () => {
    it('should create error with all properties', () => {
      const error = new StuckWorkerCriticalError('worker-1', 'issue-1', 600000, 3);

      expect(error.name).toBe('StuckWorkerCriticalError');
      expect(error.workerId).toBe('worker-1');
      expect(error.issueId).toBe('issue-1');
      expect(error.durationMs).toBe(600000);
      expect(error.attemptCount).toBe(3);
      expect(error.message).toContain('worker-1');
      expect(error.message).toContain('issue-1');
      expect(error.message).toContain('10 minutes');
      expect(error.message).toContain('manual intervention');
    });

    it('should create error without issueId', () => {
      const error = new StuckWorkerCriticalError('worker-1', null, 300000, 2);

      expect(error.issueId).toBeNull();
      expect(error.message).not.toContain('on task');
    });
  });

  describe('MaxRecoveryAttemptsExceededError', () => {
    it('should create error with workerId and maxAttempts', () => {
      const error = new MaxRecoveryAttemptsExceededError('worker-1', 3);

      expect(error.name).toBe('MaxRecoveryAttemptsExceededError');
      expect(error.workerId).toBe('worker-1');
      expect(error.maxAttempts).toBe(3);
      expect(error.message).toContain('worker-1');
      expect(error.message).toContain('3');
    });
  });
});
