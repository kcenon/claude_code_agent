import { describe, it, expect } from 'vitest';
import {
  SRSWriterError,
  PRDNotFoundError,
  PRDParseError,
  TemplateNotFoundError,
  TemplateProcessingError,
  FeatureDecompositionError,
  UseCaseGenerationError,
  LowCoverageError,
  SessionStateError,
  ValidationError,
  GenerationError,
  FileWriteError,
} from '../../src/srs-writer/errors.js';

describe('SRS Writer Errors', () => {
  describe('SRSWriterError', () => {
    it('should create error with message', () => {
      const error = new SRSWriterError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('SRSWriterError');
    });

    it('should be instanceof Error', () => {
      const error = new SRSWriterError('Test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('PRDNotFoundError', () => {
    it('should include projectId and searchedPath', () => {
      const error = new PRDNotFoundError('001', '/path/to/prd.md');
      expect(error.projectId).toBe('001');
      expect(error.searchedPath).toBe('/path/to/prd.md');
      expect(error.name).toBe('PRDNotFoundError');
      expect(error.message).toContain('001');
      expect(error.message).toContain('/path/to/prd.md');
    });

    it('should be instanceof SRSWriterError', () => {
      const error = new PRDNotFoundError('001', '/path');
      expect(error).toBeInstanceOf(SRSWriterError);
    });
  });

  describe('PRDParseError', () => {
    it('should include section and optional line number', () => {
      const error = new PRDParseError('requirements', 'Invalid format', 42);
      expect(error.section).toBe('requirements');
      expect(error.lineNumber).toBe(42);
      expect(error.name).toBe('PRDParseError');
      expect(error.message).toContain('requirements');
      expect(error.message).toContain('line 42');
    });

    it('should work without line number', () => {
      const error = new PRDParseError('metadata', 'Missing field');
      expect(error.lineNumber).toBeUndefined();
      expect(error.message).not.toContain('line');
    });
  });

  describe('TemplateNotFoundError', () => {
    it('should include template path', () => {
      const error = new TemplateNotFoundError('/templates/srs.md');
      expect(error.templatePath).toBe('/templates/srs.md');
      expect(error.name).toBe('TemplateNotFoundError');
    });
  });

  describe('TemplateProcessingError', () => {
    it('should include phase and missing variables', () => {
      const error = new TemplateProcessingError('substitution', 'Failed', [
        'var1',
        'var2',
      ]);
      expect(error.phase).toBe('substitution');
      expect(error.missingVariables).toEqual(['var1', 'var2']);
      expect(error.name).toBe('TemplateProcessingError');
      expect(error.message).toContain('var1');
    });

    it('should work without missing variables', () => {
      const error = new TemplateProcessingError('parsing', 'Syntax error');
      expect(error.missingVariables).toBeUndefined();
    });
  });

  describe('FeatureDecompositionError', () => {
    it('should include requirement ID', () => {
      const error = new FeatureDecompositionError('FR-001', 'Too complex');
      expect(error.requirementId).toBe('FR-001');
      expect(error.name).toBe('FeatureDecompositionError');
      expect(error.message).toContain('FR-001');
    });
  });

  describe('UseCaseGenerationError', () => {
    it('should include feature ID', () => {
      const error = new UseCaseGenerationError('SF-001', 'No actors');
      expect(error.featureId).toBe('SF-001');
      expect(error.name).toBe('UseCaseGenerationError');
      expect(error.message).toContain('SF-001');
    });
  });

  describe('LowCoverageError', () => {
    it('should include coverage details', () => {
      const error = new LowCoverageError(75.5, 80, ['FR-001', 'FR-002']);
      expect(error.actualCoverage).toBe(75.5);
      expect(error.threshold).toBe(80);
      expect(error.uncoveredRequirements).toEqual(['FR-001', 'FR-002']);
      expect(error.name).toBe('LowCoverageError');
      expect(error.message).toContain('75.5');
      expect(error.message).toContain('80');
    });

    it('should truncate long list of uncovered requirements', () => {
      const error = new LowCoverageError(50, 80, [
        'FR-001',
        'FR-002',
        'FR-003',
        'FR-004',
        'FR-005',
        'FR-006',
      ]);
      expect(error.message).toContain('...');
    });
  });

  describe('SessionStateError', () => {
    it('should include current and expected state', () => {
      const error = new SessionStateError('pending', 'generating', 'finalize');
      expect(error.currentState).toBe('pending');
      expect(error.expectedState).toBe('generating');
      expect(error.name).toBe('SessionStateError');
      expect(error.message).toContain('pending');
      expect(error.message).toContain('generating');
    });
  });

  describe('ValidationError', () => {
    it('should include list of errors', () => {
      const error = new ValidationError(['Error 1', 'Error 2']);
      expect(error.errors).toEqual(['Error 1', 'Error 2']);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toContain('Error 1');
      expect(error.message).toContain('Error 2');
    });
  });

  describe('GenerationError', () => {
    it('should include project ID and phase', () => {
      const error = new GenerationError('001', 'decomposition', 'Failed');
      expect(error.projectId).toBe('001');
      expect(error.phase).toBe('decomposition');
      expect(error.name).toBe('GenerationError');
      expect(error.message).toContain('001');
      expect(error.message).toContain('decomposition');
    });
  });

  describe('FileWriteError', () => {
    it('should include file path', () => {
      const error = new FileWriteError('/output/srs.md', 'Permission denied');
      expect(error.filePath).toBe('/output/srs.md');
      expect(error.name).toBe('FileWriteError');
      expect(error.message).toContain('/output/srs.md');
    });
  });

  describe('error inheritance', () => {
    it('all errors should be instanceof SRSWriterError', () => {
      const errors = [
        new PRDNotFoundError('001', '/path'),
        new PRDParseError('section', 'reason'),
        new TemplateNotFoundError('/path'),
        new TemplateProcessingError('phase', 'reason'),
        new FeatureDecompositionError('FR-001', 'reason'),
        new UseCaseGenerationError('SF-001', 'reason'),
        new LowCoverageError(50, 80, []),
        new SessionStateError('current', 'expected', 'action'),
        new ValidationError([]),
        new GenerationError('001', 'phase', 'reason'),
        new FileWriteError('/path', 'reason'),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(SRSWriterError);
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
