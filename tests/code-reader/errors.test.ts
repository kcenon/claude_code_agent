import { describe, it, expect } from 'vitest';
import {
  CodeReaderError,
  SourceFileNotFoundError,
  SourceDirectoryNotFoundError,
  ParseError,
  NoActiveSessionError,
  InvalidSessionStateError,
  FileSizeLimitError,
  OutputWriteError,
  CircularDependencyError,
  TooManyParseErrorsError,
  InvalidTsConfigError,
} from '../../src/code-reader/errors.js';

describe('CodeReaderError', () => {
  it('should create base error with message', () => {
    const error = new CodeReaderError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('CodeReaderError');
    expect(error instanceof Error).toBe(true);
  });

  it('should maintain prototype chain', () => {
    const error = new CodeReaderError('Test');
    expect(error instanceof CodeReaderError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('SourceFileNotFoundError', () => {
  it('should create error with path', () => {
    const error = new SourceFileNotFoundError('/src/index.ts');
    expect(error.message).toContain('/src/index.ts');
    expect(error.message).toContain('not found');
    expect(error.name).toBe('SourceFileNotFoundError');
    expect(error.path).toBe('/src/index.ts');
  });

  it('should inherit from CodeReaderError', () => {
    const error = new SourceFileNotFoundError('/path');
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('SourceDirectoryNotFoundError', () => {
  it('should create error with path', () => {
    const error = new SourceDirectoryNotFoundError('/src');
    expect(error.message).toContain('/src');
    expect(error.message).toContain('not found');
    expect(error.name).toBe('SourceDirectoryNotFoundError');
    expect(error.path).toBe('/src');
  });

  it('should inherit from CodeReaderError', () => {
    const error = new SourceDirectoryNotFoundError('/path');
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('ParseError', () => {
  it('should create error with path and reason only', () => {
    const error = new ParseError('/src/index.ts', 'Unexpected token');
    expect(error.message).toContain('/src/index.ts');
    expect(error.message).toContain('Unexpected token');
    expect(error.message).not.toContain('at line');
    expect(error.name).toBe('ParseError');
    expect(error.path).toBe('/src/index.ts');
    expect(error.reason).toBe('Unexpected token');
    expect(error.line).toBeUndefined();
    expect(error.column).toBeUndefined();
  });

  it('should create error with line number', () => {
    const error = new ParseError('/src/index.ts', 'Unexpected token', 10);
    expect(error.message).toContain('at line 10:');
    // When column is not specified, format is "at line 10: reason" (no column number before colon)
    expect(error.message).not.toMatch(/at line 10:\d/);
    expect(error.line).toBe(10);
    expect(error.column).toBeUndefined();
  });

  it('should create error with line and column', () => {
    const error = new ParseError('/src/index.ts', 'Unexpected token', 10, 5);
    expect(error.message).toContain('at line 10:5');
    expect(error.line).toBe(10);
    expect(error.column).toBe(5);
  });

  it('should inherit from CodeReaderError', () => {
    const error = new ParseError('/path', 'reason');
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('NoActiveSessionError', () => {
  it('should create error with default message', () => {
    const error = new NoActiveSessionError();
    expect(error.message).toContain('No active code reading session');
    expect(error.message).toContain('startSession()');
    expect(error.name).toBe('NoActiveSessionError');
  });

  it('should inherit from CodeReaderError', () => {
    const error = new NoActiveSessionError();
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('InvalidSessionStateError', () => {
  it('should create error with operation and status info', () => {
    const error = new InvalidSessionStateError('analyze', 'idle', 'scanning');
    expect(error.message).toContain('analyze');
    expect(error.message).toContain('idle');
    expect(error.message).toContain('scanning');
    expect(error.name).toBe('InvalidSessionStateError');
    expect(error.operation).toBe('analyze');
    expect(error.currentStatus).toBe('idle');
    expect(error.expectedStatus).toBe('scanning');
  });

  it('should inherit from CodeReaderError', () => {
    const error = new InvalidSessionStateError('op', 'curr', 'exp');
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('FileSizeLimitError', () => {
  it('should create error with size information', () => {
    const error = new FileSizeLimitError('/large-file.ts', 2097152, 1048576);
    expect(error.message).toContain('/large-file.ts');
    expect(error.message).toContain('2.00MB');
    expect(error.message).toContain('1.00MB');
    expect(error.name).toBe('FileSizeLimitError');
    expect(error.path).toBe('/large-file.ts');
    expect(error.size).toBe(2097152);
    expect(error.maxSize).toBe(1048576);
  });

  it('should inherit from CodeReaderError', () => {
    const error = new FileSizeLimitError('/path', 100, 50);
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('OutputWriteError', () => {
  it('should create error with path and reason', () => {
    const error = new OutputWriteError('/output/result.yaml', 'Permission denied');
    expect(error.message).toContain('/output/result.yaml');
    expect(error.message).toContain('Permission denied');
    expect(error.name).toBe('OutputWriteError');
    expect(error.path).toBe('/output/result.yaml');
    expect(error.reason).toBe('Permission denied');
  });

  it('should inherit from CodeReaderError', () => {
    const error = new OutputWriteError('/path', 'reason');
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('CircularDependencyError', () => {
  it('should create error with module chain', () => {
    const modules = ['moduleA', 'moduleB', 'moduleC', 'moduleA'] as const;
    const error = new CircularDependencyError(modules);
    expect(error.message).toContain('moduleA -> moduleB -> moduleC -> moduleA');
    expect(error.message).toContain('circular dependency');
    expect(error.name).toBe('CircularDependencyError');
    expect(error.modules).toEqual(modules);
  });

  it('should inherit from CodeReaderError', () => {
    const error = new CircularDependencyError(['a', 'b']);
    expect(error instanceof CodeReaderError).toBe(true);
  });
});

describe('TooManyParseErrorsError', () => {
  it('should create error with counts and threshold', () => {
    const error = new TooManyParseErrorsError(15, 100, 0.1);
    expect(error.message).toContain('15');
    expect(error.message).toContain('100');
    expect(error.message).toContain('15.0%');
    expect(error.message).toContain('10%');
    expect(error.name).toBe('TooManyParseErrorsError');
    expect(error.failedCount).toBe(15);
    expect(error.totalCount).toBe(100);
    expect(error.threshold).toBe(0.1);
  });

  it('should inherit from CodeReaderError', () => {
    const error = new TooManyParseErrorsError(1, 10, 0.05);
    expect(error instanceof CodeReaderError).toBe(true);
  });

  it('should include per-file error details when provided', () => {
    const fileErrors = [
      { filePath: '/src/a.ts', message: 'Cannot find name X', line: 5 },
      { filePath: '/src/b.ts', message: 'Type error' },
    ];
    const error = new TooManyParseErrorsError(2, 3, 0.5, fileErrors);
    expect(error.fileErrors).toHaveLength(2);
    expect(error.message).toContain('Failed files:');
    expect(error.message).toContain('/src/a.ts:5');
    expect(error.message).toContain('Cannot find name X');
    expect(error.message).toContain('/src/b.ts');
  });

  it('should default to empty fileErrors array', () => {
    const error = new TooManyParseErrorsError(5, 10, 0.3);
    expect(error.fileErrors).toHaveLength(0);
    expect(error.message).not.toContain('Failed files:');
  });
});

describe('InvalidTsConfigError', () => {
  it('should create error with config path and reason', () => {
    const error = new InvalidTsConfigError('/tsconfig.json', 'Invalid compilerOptions');
    expect(error.message).toContain('/tsconfig.json');
    expect(error.message).toContain('Invalid compilerOptions');
    expect(error.name).toBe('InvalidTsConfigError');
    expect(error.configPath).toBe('/tsconfig.json');
    expect(error.reason).toBe('Invalid compilerOptions');
  });

  it('should inherit from CodeReaderError', () => {
    const error = new InvalidTsConfigError('/path', 'reason');
    expect(error instanceof CodeReaderError).toBe(true);
  });
});
