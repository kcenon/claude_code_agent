import { describe, it, expect } from 'vitest';
import {
  PRDWriterError,
  CollectedInfoNotFoundError,
  TemplateNotFoundError,
  CriticalGapsError,
  ConsistencyError,
  GenerationError,
  FileWriteError,
  SessionStateError,
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
