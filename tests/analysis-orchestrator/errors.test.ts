/**
 * Analysis Orchestrator Agent error tests
 */

import { describe, it, expect } from 'vitest';

import {
  AnalysisOrchestratorError,
  NoActiveSessionError,
  AnalysisInProgressError,
  InvalidProjectPathError,
  InvalidProjectStructureError,
  StageExecutionError,
  StageTimeoutError,
  CircuitOpenError,
  InvalidPipelineStateError,
  StageDependencyError,
  OutputWriteError,
  StateReadError,
  ResumeError,
  AnalysisNotFoundError,
  PipelineFailedError,
  InvalidConfigurationError,
  SubAgentSpawnError,
} from '../../src/analysis-orchestrator/errors.js';

describe('AnalysisOrchestratorError', () => {
  it('should create base error with message', () => {
    const error = new AnalysisOrchestratorError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('AnalysisOrchestratorError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AnalysisOrchestratorError);
  });
});

describe('NoActiveSessionError', () => {
  it('should create error with default message', () => {
    const error = new NoActiveSessionError();
    expect(error.message).toContain('No active analysis session');
    expect(error.name).toBe('NoActiveSessionError');
    expect(error).toBeInstanceOf(AnalysisOrchestratorError);
  });
});

describe('AnalysisInProgressError', () => {
  it('should include analysis ID in message', () => {
    const error = new AnalysisInProgressError('test-analysis-123');
    expect(error.message).toContain('test-analysis-123');
    expect(error.analysisId).toBe('test-analysis-123');
    expect(error.name).toBe('AnalysisInProgressError');
  });
});

describe('InvalidProjectPathError', () => {
  it('should include path and reason', () => {
    const error = new InvalidProjectPathError('/test/path', 'Does not exist');
    expect(error.message).toContain('/test/path');
    expect(error.message).toContain('Does not exist');
    expect(error.path).toBe('/test/path');
    expect(error.reason).toBe('Does not exist');
    expect(error.name).toBe('InvalidProjectPathError');
  });
});

describe('InvalidProjectStructureError', () => {
  it('should include path and missing items', () => {
    const missingItems = ['package.json', 'src/'];
    const error = new InvalidProjectStructureError('/test/path', missingItems);
    expect(error.message).toContain('/test/path');
    expect(error.message).toContain('package.json');
    expect(error.message).toContain('src/');
    expect(error.path).toBe('/test/path');
    expect(error.missingItems).toEqual(missingItems);
    expect(error.name).toBe('InvalidProjectStructureError');
  });
});

describe('StageExecutionError', () => {
  it('should include stage, reason, and retry count', () => {
    const error = new StageExecutionError('document_reader', 'Parse failed', 3);
    expect(error.message).toContain('document_reader');
    expect(error.message).toContain('Parse failed');
    expect(error.message).toContain('3');
    expect(error.stage).toBe('document_reader');
    expect(error.reason).toBe('Parse failed');
    expect(error.retryCount).toBe(3);
    expect(error.name).toBe('StageExecutionError');
  });

  it('should have default retry count of 0', () => {
    const error = new StageExecutionError('code_reader', 'Failed');
    expect(error.retryCount).toBe(0);
  });
});

describe('StageTimeoutError', () => {
  it('should include stage and timeout', () => {
    const error = new StageTimeoutError('comparator', 30000);
    expect(error.message).toContain('comparator');
    expect(error.message).toContain('30000');
    expect(error.stage).toBe('comparator');
    expect(error.timeoutMs).toBe(30000);
    expect(error.name).toBe('StageTimeoutError');
  });

  it('should use provided startTime', () => {
    const startTime = new Date('2024-01-01T00:00:00.000Z');
    const error = new StageTimeoutError('document_reader', 60000, startTime);
    expect(error.startTime).toBe(startTime);
  });

  it('should use current time as default startTime', () => {
    const before = new Date();
    const error = new StageTimeoutError('code_reader', 120000);
    const after = new Date();
    expect(error.startTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(error.startTime.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('CircuitOpenError', () => {
  it('should include stage, failure count, and reset time', () => {
    const error = new CircuitOpenError('document_reader', 3, 60000);
    expect(error.message).toContain('document_reader');
    expect(error.message).toContain('3');
    expect(error.message).toContain('60000');
    expect(error.stage).toBe('document_reader');
    expect(error.failureCount).toBe(3);
    expect(error.resetTimeMs).toBe(60000);
    expect(error.name).toBe('CircuitOpenError');
  });

  it('should be instance of AnalysisOrchestratorError', () => {
    const error = new CircuitOpenError('code_reader', 5, 30000);
    expect(error).toBeInstanceOf(AnalysisOrchestratorError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('InvalidPipelineStateError', () => {
  it('should include operation, current, and expected status', () => {
    const error = new InvalidPipelineStateError('execute', 'pending', 'running');
    expect(error.message).toContain('execute');
    expect(error.message).toContain('pending');
    expect(error.message).toContain('running');
    expect(error.operation).toBe('execute');
    expect(error.currentStatus).toBe('pending');
    expect(error.expectedStatus).toBe('running');
    expect(error.name).toBe('InvalidPipelineStateError');
  });
});

describe('StageDependencyError', () => {
  it('should include stage, required, and failed stages', () => {
    const requiredStages = ['document_reader', 'code_reader'] as const;
    const failedStages = ['document_reader'] as const;
    const error = new StageDependencyError('comparator', requiredStages, failedStages);
    expect(error.message).toContain('comparator');
    expect(error.message).toContain('document_reader');
    expect(error.stage).toBe('comparator');
    expect(error.requiredStages).toEqual(requiredStages);
    expect(error.failedStages).toEqual(failedStages);
    expect(error.name).toBe('StageDependencyError');
  });
});

describe('OutputWriteError', () => {
  it('should include path and reason', () => {
    const error = new OutputWriteError('/output/path', 'Permission denied');
    expect(error.message).toContain('/output/path');
    expect(error.message).toContain('Permission denied');
    expect(error.path).toBe('/output/path');
    expect(error.reason).toBe('Permission denied');
    expect(error.name).toBe('OutputWriteError');
  });
});

describe('StateReadError', () => {
  it('should include path and reason', () => {
    const error = new StateReadError('/state/path', 'File not found');
    expect(error.message).toContain('/state/path');
    expect(error.message).toContain('File not found');
    expect(error.path).toBe('/state/path');
    expect(error.reason).toBe('File not found');
    expect(error.name).toBe('StateReadError');
  });
});

describe('ResumeError', () => {
  it('should include analysis ID and reason', () => {
    const error = new ResumeError('analysis-123', 'State corrupted');
    expect(error.message).toContain('analysis-123');
    expect(error.message).toContain('State corrupted');
    expect(error.analysisId).toBe('analysis-123');
    expect(error.reason).toBe('State corrupted');
    expect(error.name).toBe('ResumeError');
  });
});

describe('AnalysisNotFoundError', () => {
  it('should include analysis ID', () => {
    const error = new AnalysisNotFoundError('analysis-456');
    expect(error.message).toContain('analysis-456');
    expect(error.analysisId).toBe('analysis-456');
    expect(error.name).toBe('AnalysisNotFoundError');
  });
});

describe('PipelineFailedError', () => {
  it('should include analysis ID and failed stages', () => {
    const failedStages = ['document_reader', 'comparator'] as const;
    const error = new PipelineFailedError('analysis-789', failedStages);
    expect(error.message).toContain('analysis-789');
    expect(error.message).toContain('document_reader');
    expect(error.message).toContain('comparator');
    expect(error.analysisId).toBe('analysis-789');
    expect(error.failedStages).toEqual(failedStages);
    expect(error.name).toBe('PipelineFailedError');
  });
});

describe('InvalidConfigurationError', () => {
  it('should include field, value, and reason', () => {
    const error = new InvalidConfigurationError('maxRetries', -1, 'Must be positive');
    expect(error.message).toContain('maxRetries');
    expect(error.message).toContain('Must be positive');
    expect(error.field).toBe('maxRetries');
    expect(error.value).toBe(-1);
    expect(error.reason).toBe('Must be positive');
    expect(error.name).toBe('InvalidConfigurationError');
  });
});

describe('SubAgentSpawnError', () => {
  it('should include agent type and reason', () => {
    const error = new SubAgentSpawnError('document-reader', 'Agent not available');
    expect(error.message).toContain('document-reader');
    expect(error.message).toContain('Agent not available');
    expect(error.agentType).toBe('document-reader');
    expect(error.reason).toBe('Agent not available');
    expect(error.name).toBe('SubAgentSpawnError');
  });
});

describe('Error inheritance', () => {
  it('all errors should be instances of Error', () => {
    const errors = [
      new NoActiveSessionError(),
      new AnalysisInProgressError('id'),
      new InvalidProjectPathError('path', 'reason'),
      new InvalidProjectStructureError('path', []),
      new StageExecutionError('document_reader', 'reason'),
      new StageTimeoutError('document_reader', 1000),
      new CircuitOpenError('document_reader', 3, 60000),
      new InvalidPipelineStateError('op', 'current', 'expected'),
      new StageDependencyError('comparator', [], []),
      new OutputWriteError('path', 'reason'),
      new StateReadError('path', 'reason'),
      new ResumeError('id', 'reason'),
      new AnalysisNotFoundError('id'),
      new PipelineFailedError('id', []),
      new InvalidConfigurationError('field', 'value', 'reason'),
      new SubAgentSpawnError('type', 'reason'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AnalysisOrchestratorError);
    }
  });
});
