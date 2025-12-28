import { describe, it, expect } from 'vitest';
import {
  SDSWriterError,
  SRSNotFoundError,
  SRSParseError,
  TemplateNotFoundError,
  TemplateProcessingError,
  ComponentDesignError,
  APISpecificationError,
  DataModelDesignError,
  SecuritySpecificationError,
  LowCoverageError,
  SessionStateError,
  ValidationError,
  GenerationError,
  FileWriteError,
  CircularDependencyError,
  InterfaceGenerationError,
} from '../../src/sds-writer/errors.js';

describe('SDSWriterError', () => {
  it('should create base error with message', () => {
    const error = new SDSWriterError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('SDSWriterError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SDSWriterError);
  });
});

describe('SRSNotFoundError', () => {
  it('should create error with project ID and path', () => {
    const error = new SRSNotFoundError('my-project', '/path/to/srs.md');
    expect(error.message).toContain('my-project');
    expect(error.message).toContain('/path/to/srs.md');
    expect(error.name).toBe('SRSNotFoundError');
    expect(error.projectId).toBe('my-project');
    expect(error.searchedPath).toBe('/path/to/srs.md');
  });
});

describe('SRSParseError', () => {
  it('should create error with section and reason', () => {
    const error = new SRSParseError('Features', 'Invalid format');
    expect(error.message).toContain('Features');
    expect(error.message).toContain('Invalid format');
    expect(error.name).toBe('SRSParseError');
    expect(error.section).toBe('Features');
    expect(error.lineNumber).toBeUndefined();
  });

  it('should include line number when provided', () => {
    const error = new SRSParseError('Features', 'Invalid format', 42);
    expect(error.message).toContain('line 42');
    expect(error.lineNumber).toBe(42);
  });
});

describe('TemplateNotFoundError', () => {
  it('should create error with template path', () => {
    const error = new TemplateNotFoundError('/path/to/template.md');
    expect(error.message).toContain('/path/to/template.md');
    expect(error.name).toBe('TemplateNotFoundError');
    expect(error.templatePath).toBe('/path/to/template.md');
  });
});

describe('TemplateProcessingError', () => {
  it('should create error with phase and reason', () => {
    const error = new TemplateProcessingError('substitution', 'Variable not found');
    expect(error.message).toContain('substitution');
    expect(error.message).toContain('Variable not found');
    expect(error.name).toBe('TemplateProcessingError');
    expect(error.phase).toBe('substitution');
  });

  it('should include missing variables when provided', () => {
    const error = new TemplateProcessingError('substitution', 'Missing vars', [
      'var1',
      'var2',
    ]);
    expect(error.message).toContain('var1');
    expect(error.message).toContain('var2');
    expect(error.missingVariables).toEqual(['var1', 'var2']);
  });
});

describe('ComponentDesignError', () => {
  it('should create error with feature ID and reason', () => {
    const error = new ComponentDesignError('SF-001', 'No acceptance criteria');
    expect(error.message).toContain('SF-001');
    expect(error.message).toContain('No acceptance criteria');
    expect(error.name).toBe('ComponentDesignError');
    expect(error.featureId).toBe('SF-001');
  });
});

describe('APISpecificationError', () => {
  it('should create error with component ID', () => {
    const error = new APISpecificationError('CMP-001', 'No use cases');
    expect(error.message).toContain('CMP-001');
    expect(error.name).toBe('APISpecificationError');
    expect(error.componentId).toBe('CMP-001');
    expect(error.useCaseId).toBeUndefined();
  });

  it('should include use case ID when provided', () => {
    const error = new APISpecificationError('CMP-001', 'Invalid scenario', 'UC-001');
    expect(error.message).toContain('UC-001');
    expect(error.useCaseId).toBe('UC-001');
  });
});

describe('DataModelDesignError', () => {
  it('should create error with component ID', () => {
    const error = new DataModelDesignError('CMP-001', 'No properties');
    expect(error.message).toContain('CMP-001');
    expect(error.name).toBe('DataModelDesignError');
    expect(error.componentId).toBe('CMP-001');
  });
});

describe('SecuritySpecificationError', () => {
  it('should create error with aspect', () => {
    const error = new SecuritySpecificationError('authentication', 'Invalid type');
    expect(error.message).toContain('authentication');
    expect(error.name).toBe('SecuritySpecificationError');
    expect(error.aspect).toBe('authentication');
  });
});

describe('LowCoverageError', () => {
  it('should create error with coverage info', () => {
    const error = new LowCoverageError(60, 80, ['SF-001', 'SF-002']);
    expect(error.message).toContain('60');
    expect(error.message).toContain('80');
    expect(error.message).toContain('SF-001');
    expect(error.name).toBe('LowCoverageError');
    expect(error.actualCoverage).toBe(60);
    expect(error.threshold).toBe(80);
    expect(error.uncoveredFeatures).toEqual(['SF-001', 'SF-002']);
  });

  it('should truncate long list of uncovered features', () => {
    const features = ['SF-001', 'SF-002', 'SF-003', 'SF-004', 'SF-005', 'SF-006'];
    const error = new LowCoverageError(50, 80, features);
    expect(error.message).toContain('...');
    expect(error.uncoveredFeatures).toHaveLength(6);
  });
});

describe('SessionStateError', () => {
  it('should create error with state info', () => {
    const error = new SessionStateError('pending', 'completed', 'finalize');
    expect(error.message).toContain('pending');
    expect(error.message).toContain('completed');
    expect(error.message).toContain('finalize');
    expect(error.name).toBe('SessionStateError');
    expect(error.currentState).toBe('pending');
    expect(error.expectedState).toBe('completed');
  });
});

describe('ValidationError', () => {
  it('should create error with validation errors', () => {
    const errors = ['Missing ID', 'Invalid priority'];
    const error = new ValidationError(errors);
    expect(error.message).toContain('Missing ID');
    expect(error.message).toContain('Invalid priority');
    expect(error.name).toBe('ValidationError');
    expect(error.errors).toEqual(errors);
  });
});

describe('GenerationError', () => {
  it('should create error with project ID and phase', () => {
    const error = new GenerationError('my-project', 'designing', 'Component failed');
    expect(error.message).toContain('my-project');
    expect(error.message).toContain('designing');
    expect(error.message).toContain('Component failed');
    expect(error.name).toBe('GenerationError');
    expect(error.projectId).toBe('my-project');
    expect(error.phase).toBe('designing');
  });
});

describe('FileWriteError', () => {
  it('should create error with file path', () => {
    const error = new FileWriteError('/path/to/file.md', 'Permission denied');
    expect(error.message).toContain('/path/to/file.md');
    expect(error.message).toContain('Permission denied');
    expect(error.name).toBe('FileWriteError');
    expect(error.filePath).toBe('/path/to/file.md');
  });
});

describe('CircularDependencyError', () => {
  it('should create error with cycle', () => {
    const cycle = ['CMP-001', 'CMP-002', 'CMP-003', 'CMP-001'];
    const error = new CircularDependencyError(cycle);
    expect(error.message).toContain('CMP-001 → CMP-002 → CMP-003 → CMP-001');
    expect(error.name).toBe('CircularDependencyError');
    expect(error.cycle).toEqual(cycle);
  });
});

describe('InterfaceGenerationError', () => {
  it('should create error with component ID', () => {
    const error = new InterfaceGenerationError('CMP-001', 'No methods');
    expect(error.message).toContain('CMP-001');
    expect(error.message).toContain('No methods');
    expect(error.name).toBe('InterfaceGenerationError');
    expect(error.componentId).toBe('CMP-001');
  });
});
