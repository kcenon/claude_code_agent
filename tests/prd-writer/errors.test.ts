import { describe, it, expect } from 'vitest';
import {
  PRDWriterError,
  CollectedInfoNotFoundError,
  TemplateNotFoundError,
  TemplateProcessingError,
  CriticalGapsError,
  ConsistencyError,
  GenerationError,
  FileWriteError,
  SessionStateError,
  ValidationError,
} from '../../src/prd-writer/errors.js';

describe('PRDWriterError', () => {
  it('should create base error with message', () => {
    const error = new PRDWriterError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('PRDWriterError');
    expect(error instanceof Error).toBe(true);
  });
});

describe('CollectedInfoNotFoundError', () => {
  it('should create error with project ID and path', () => {
    const error = new CollectedInfoNotFoundError('001', '/path/to/file.yaml');
    expect(error.message).toContain('001');
    expect(error.message).toContain('/path/to/file.yaml');
    expect(error.name).toBe('CollectedInfoNotFoundError');
    expect(error.projectId).toBe('001');
    expect(error.searchedPath).toBe('/path/to/file.yaml');
  });
});

describe('TemplateNotFoundError', () => {
  it('should create error with template path', () => {
    const error = new TemplateNotFoundError('/templates/prd.md');
    expect(error.message).toContain('/templates/prd.md');
    expect(error.name).toBe('TemplateNotFoundError');
    expect(error.templatePath).toBe('/templates/prd.md');
  });
});

describe('TemplateProcessingError', () => {
  it('should create error without missing variables', () => {
    const error = new TemplateProcessingError('parsing', 'Invalid syntax');
    expect(error.message).toContain('parsing');
    expect(error.message).toContain('Invalid syntax');
    expect(error.name).toBe('TemplateProcessingError');
    expect(error.phase).toBe('parsing');
    expect(error.missingVariables).toBeUndefined();
  });

  it('should create error with missing variables', () => {
    const missingVars = ['project_name', 'description'];
    const error = new TemplateProcessingError('substitution', 'Variables not found', missingVars);
    expect(error.message).toContain('substitution');
    expect(error.message).toContain('project_name');
    expect(error.message).toContain('description');
    expect(error.name).toBe('TemplateProcessingError');
    expect(error.phase).toBe('substitution');
    expect(error.missingVariables).toEqual(missingVars);
  });

  it('should handle empty missing variables array', () => {
    const error = new TemplateProcessingError('processing', 'Error', []);
    expect(error.phase).toBe('processing');
    expect(error.missingVariables).toEqual([]);
  });
});

describe('ValidationError', () => {
  it('should create error with validation errors', () => {
    const errors = ['Missing project name', 'Invalid ID format'];
    const error = new ValidationError(errors);
    expect(error.message).toContain('Missing project name');
    expect(error.message).toContain('Invalid ID format');
    expect(error.name).toBe('ValidationError');
    expect(error.errors).toEqual(errors);
  });

  it('should handle single validation error', () => {
    const error = new ValidationError(['Schema validation failed']);
    expect(error.errors.length).toBe(1);
  });
});

describe('CriticalGapsError', () => {
  it('should create error with gap count and descriptions', () => {
    const gaps = ['Missing FR', 'Missing description'];
    const error = new CriticalGapsError(2, gaps);
    expect(error.message).toContain('2');
    expect(error.name).toBe('CriticalGapsError');
    expect(error.criticalGapCount).toBe(2);
    expect(error.gapDescriptions).toEqual(gaps);
  });

  it('should handle empty gap descriptions', () => {
    const error = new CriticalGapsError(0, []);
    expect(error.criticalGapCount).toBe(0);
    expect(error.gapDescriptions).toEqual([]);
  });

  it('should truncate descriptions when more than 3', () => {
    const gaps = ['Gap 1', 'Gap 2', 'Gap 3', 'Gap 4', 'Gap 5'];
    const error = new CriticalGapsError(5, gaps);
    expect(error.message).toContain('5');
    expect(error.message).toContain('...');
    expect(error.criticalGapCount).toBe(5);
    expect(error.gapDescriptions).toEqual(gaps);
  });
});

describe('ConsistencyError', () => {
  it('should create error with issue count and descriptions', () => {
    const issues = ['Circular dependency', 'Duplicate requirement'];
    const error = new ConsistencyError(2, issues);
    expect(error.message).toContain('2');
    expect(error.name).toBe('ConsistencyError');
    expect(error.issueCount).toBe(2);
    expect(error.issueDescriptions).toEqual(issues);
  });

  it('should truncate descriptions when more than 3', () => {
    const issues = ['Issue 1', 'Issue 2', 'Issue 3', 'Issue 4'];
    const error = new ConsistencyError(4, issues);
    expect(error.message).toContain('4');
    expect(error.message).toContain('...');
    expect(error.issueCount).toBe(4);
  });
});

describe('GenerationError', () => {
  it('should create error with project ID, phase, and reason', () => {
    const error = new GenerationError('001', 'template', 'Template parsing failed');
    expect(error.message).toContain('001');
    expect(error.message).toContain('template');
    expect(error.name).toBe('GenerationError');
    expect(error.projectId).toBe('001');
    expect(error.phase).toBe('template');
  });
});

describe('FileWriteError', () => {
  it('should create error with path and reason', () => {
    const error = new FileWriteError('/output/prd.md', 'Permission denied');
    expect(error.message).toContain('/output/prd.md');
    expect(error.message).toContain('Permission denied');
    expect(error.name).toBe('FileWriteError');
    expect(error.filePath).toBe('/output/prd.md');
  });
});

describe('SessionStateError', () => {
  it('should create error with current, expected, and action', () => {
    const error = new SessionStateError('pending', 'analyzing', 'generate PRD');
    expect(error.message).toContain('pending');
    expect(error.message).toContain('analyzing');
    expect(error.message).toContain('generate PRD');
    expect(error.name).toBe('SessionStateError');
    expect(error.currentState).toBe('pending');
    expect(error.expectedState).toBe('analyzing');
  });
});
