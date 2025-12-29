/**
 * Doc-Code Comparator Agent error tests
 */

import { describe, it, expect } from 'vitest';

import {
  DocCodeComparatorError,
  NoActiveSessionError,
  DocumentInventoryNotFoundError,
  CodeInventoryNotFoundError,
  InvalidInventoryError,
  OutputWriteError,
  ComparisonError,
  GapAnalysisError,
  IssueGenerationError,
} from '../../src/doc-code-comparator/errors.js';

describe('DocCodeComparatorError', () => {
  it('should create base error with message', () => {
    const error = new DocCodeComparatorError('Test error message');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.message).toBe('Test error message');
    expect(error.name).toBe('DocCodeComparatorError');
  });

  it('should have proper prototype chain', () => {
    const error = new DocCodeComparatorError('Test');
    expect(error instanceof DocCodeComparatorError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('NoActiveSessionError', () => {
  it('should create error with default message', () => {
    const error = new NoActiveSessionError();
    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('NoActiveSessionError');
    expect(error.message).toContain('No active comparison session');
    expect(error.message).toContain('startSession()');
  });
});

describe('DocumentInventoryNotFoundError', () => {
  it('should create error with path', () => {
    const path = '/path/to/current_state.yaml';
    const error = new DocumentInventoryNotFoundError(path);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('DocumentInventoryNotFoundError');
    expect(error.path).toBe(path);
    expect(error.message).toContain('Document inventory not found');
    expect(error.message).toContain(path);
  });
});

describe('CodeInventoryNotFoundError', () => {
  it('should create error with path', () => {
    const path = '/path/to/code_inventory.yaml';
    const error = new CodeInventoryNotFoundError(path);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('CodeInventoryNotFoundError');
    expect(error.path).toBe(path);
    expect(error.message).toContain('Code inventory not found');
    expect(error.message).toContain(path);
  });
});

describe('InvalidInventoryError', () => {
  it('should create error with path and reason', () => {
    const path = '/path/to/inventory.yaml';
    const reason = 'Invalid YAML syntax';
    const error = new InvalidInventoryError(path, reason);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('InvalidInventoryError');
    expect(error.path).toBe(path);
    expect(error.reason).toBe(reason);
    expect(error.message).toContain('Invalid inventory file');
    expect(error.message).toContain(path);
    expect(error.message).toContain(reason);
  });
});

describe('OutputWriteError', () => {
  it('should create error with path and reason', () => {
    const path = '/path/to/output.yaml';
    const reason = 'Permission denied';
    const error = new OutputWriteError(path, reason);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('OutputWriteError');
    expect(error.path).toBe(path);
    expect(error.reason).toBe(reason);
    expect(error.message).toContain('Failed to write output');
    expect(error.message).toContain(path);
    expect(error.message).toContain(reason);
  });
});

describe('ComparisonError', () => {
  it('should create error with stage and reason', () => {
    const stage = 'mapping';
    const reason = 'Failed to match components';
    const error = new ComparisonError(stage, reason);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('ComparisonError');
    expect(error.stage).toBe(stage);
    expect(error.reason).toBe(reason);
    expect(error.message).toContain('Comparison failed');
    expect(error.message).toContain(stage);
    expect(error.message).toContain(reason);
  });
});

describe('GapAnalysisError', () => {
  it('should create error with item ID and reason', () => {
    const itemId = 'CMP-001';
    const reason = 'Unable to determine match score';
    const error = new GapAnalysisError(itemId, reason);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('GapAnalysisError');
    expect(error.itemId).toBe(itemId);
    expect(error.reason).toBe(reason);
    expect(error.message).toContain('Gap analysis failed');
    expect(error.message).toContain(itemId);
    expect(error.message).toContain(reason);
  });
});

describe('IssueGenerationError', () => {
  it('should create error with gap ID and reason', () => {
    const gapId = 'GAP-001';
    const reason = 'Failed to format issue body';
    const error = new IssueGenerationError(gapId, reason);

    expect(error).toBeInstanceOf(DocCodeComparatorError);
    expect(error.name).toBe('IssueGenerationError');
    expect(error.gapId).toBe(gapId);
    expect(error.reason).toBe(reason);
    expect(error.message).toContain('Issue generation failed');
    expect(error.message).toContain(gapId);
    expect(error.message).toContain(reason);
  });
});

describe('Error inheritance', () => {
  it('all specific errors should extend DocCodeComparatorError', () => {
    const errors = [
      new NoActiveSessionError(),
      new DocumentInventoryNotFoundError('/path'),
      new CodeInventoryNotFoundError('/path'),
      new InvalidInventoryError('/path', 'reason'),
      new OutputWriteError('/path', 'reason'),
      new ComparisonError('stage', 'reason'),
      new GapAnalysisError('item', 'reason'),
      new IssueGenerationError('gap', 'reason'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(DocCodeComparatorError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('errors should be catchable as DocCodeComparatorError', () => {
    const throwAndCatch = (error: Error): string => {
      try {
        throw error;
      } catch (e) {
        if (e instanceof DocCodeComparatorError) {
          return 'caught as DocCodeComparatorError';
        }
        return 'caught as other';
      }
    };

    expect(throwAndCatch(new NoActiveSessionError())).toBe('caught as DocCodeComparatorError');
    expect(throwAndCatch(new DocumentInventoryNotFoundError('/path'))).toBe(
      'caught as DocCodeComparatorError'
    );
    expect(throwAndCatch(new CodeInventoryNotFoundError('/path'))).toBe(
      'caught as DocCodeComparatorError'
    );
  });
});
