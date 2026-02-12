/**
 * AD-SDLC Orchestrator Agent error classes tests
 */

import { describe, it, expect } from 'vitest';

import {
  OrchestratorError,
  NoActiveSessionError,
  PipelineInProgressError,
  InvalidProjectDirError,
  StageExecutionError,
  StageTimeoutError,
  StageDependencyError,
  UnsupportedModeError,
  PipelineFailedError,
  StatePersistenceError,
  InvalidPipelineStatusError,
} from '../../src/ad-sdlc-orchestrator/errors.js';

describe('OrchestratorError', () => {
  it('should create base error with message', () => {
    const error = new OrchestratorError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('OrchestratorError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OrchestratorError);
  });
});

describe('NoActiveSessionError', () => {
  it('should create with default message', () => {
    const error = new NoActiveSessionError();
    expect(error.message).toContain('No active orchestrator session');
    expect(error.name).toBe('NoActiveSessionError');
  });
});

describe('PipelineInProgressError', () => {
  it('should include pipeline ID', () => {
    const error = new PipelineInProgressError('pipeline-123');
    expect(error.message).toContain('pipeline-123');
    expect(error.pipelineId).toBe('pipeline-123');
  });
});

describe('InvalidProjectDirError', () => {
  it('should include dir and reason', () => {
    const error = new InvalidProjectDirError('/bad/path', 'not found');
    expect(error.message).toContain('/bad/path');
    expect(error.message).toContain('not found');
    expect(error.dir).toBe('/bad/path');
    expect(error.reason).toBe('not found');
  });
});

describe('StageExecutionError', () => {
  it('should include stage name, reason, and retry count', () => {
    const error = new StageExecutionError('collection', 'timeout', 2);
    expect(error.message).toContain('collection');
    expect(error.message).toContain('timeout');
    expect(error.stage).toBe('collection');
    expect(error.reason).toBe('timeout');
    expect(error.retryCount).toBe(2);
  });

  it('should default retry count to 0', () => {
    const error = new StageExecutionError('collection', 'failure');
    expect(error.retryCount).toBe(0);
  });
});

describe('StageTimeoutError', () => {
  it('should include stage name and timeout', () => {
    const error = new StageTimeoutError('prd_generation', 60000);
    expect(error.message).toContain('prd_generation');
    expect(error.message).toContain('60000');
    expect(error.stage).toBe('prd_generation');
    expect(error.timeoutMs).toBe(60000);
  });
});

describe('StageDependencyError', () => {
  it('should include stage name and failed dependencies', () => {
    const error = new StageDependencyError('srs_generation', ['collection', 'prd_generation']);
    expect(error.message).toContain('srs_generation');
    expect(error.message).toContain('collection');
    expect(error.stage).toBe('srs_generation');
    expect(error.failedDependencies).toEqual(['collection', 'prd_generation']);
  });
});

describe('UnsupportedModeError', () => {
  it('should include mode name', () => {
    const error = new UnsupportedModeError('unknown_mode');
    expect(error.message).toContain('unknown_mode');
    expect(error.mode).toBe('unknown_mode');
  });
});

describe('PipelineFailedError', () => {
  it('should include pipeline ID, mode, and failed stages', () => {
    const error = new PipelineFailedError('pipe-1', 'greenfield', ['collection', 'review']);
    expect(error.message).toContain('pipe-1');
    expect(error.message).toContain('greenfield');
    expect(error.pipelineId).toBe('pipe-1');
    expect(error.mode).toBe('greenfield');
    expect(error.failedStages).toEqual(['collection', 'review']);
  });
});

describe('StatePersistenceError', () => {
  it('should include path and reason', () => {
    const error = new StatePersistenceError('/state/dir', 'disk full');
    expect(error.message).toContain('/state/dir');
    expect(error.message).toContain('disk full');
    expect(error.path).toBe('/state/dir');
    expect(error.reason).toBe('disk full');
  });
});

describe('InvalidPipelineStatusError', () => {
  it('should include operation and current status', () => {
    const error = new InvalidPipelineStatusError('resume', 'running');
    expect(error.message).toContain('resume');
    expect(error.message).toContain('running');
    expect(error.currentStatus).toBe('running');
    expect(error.operation).toBe('resume');
  });
});

describe('error inheritance', () => {
  it('all errors should extend OrchestratorError', () => {
    expect(new NoActiveSessionError()).toBeInstanceOf(OrchestratorError);
    expect(new PipelineInProgressError('id')).toBeInstanceOf(OrchestratorError);
    expect(new InvalidProjectDirError('dir', 'reason')).toBeInstanceOf(OrchestratorError);
    expect(new StageExecutionError('collection', 'reason')).toBeInstanceOf(OrchestratorError);
    expect(new StageTimeoutError('collection', 1000)).toBeInstanceOf(OrchestratorError);
    expect(new StageDependencyError('collection', [])).toBeInstanceOf(OrchestratorError);
    expect(new UnsupportedModeError('bad')).toBeInstanceOf(OrchestratorError);
    expect(new PipelineFailedError('id', 'greenfield', [])).toBeInstanceOf(OrchestratorError);
    expect(new StatePersistenceError('path', 'reason')).toBeInstanceOf(OrchestratorError);
    expect(new InvalidPipelineStatusError('op', 'failed')).toBeInstanceOf(OrchestratorError);
  });

  it('all errors should extend Error', () => {
    expect(new NoActiveSessionError()).toBeInstanceOf(Error);
    expect(new PipelineFailedError('id', 'greenfield', [])).toBeInstanceOf(Error);
  });
});
