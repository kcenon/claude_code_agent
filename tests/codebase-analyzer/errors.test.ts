/**
 * Codebase Analyzer Agent error classes tests
 */

import { describe, it, expect } from 'vitest';

import {
  CodebaseAnalyzerError,
  ProjectNotFoundError,
  NoSourceFilesError,
  UnsupportedLanguageError,
  BuildSystemNotDetectedError,
  CircularDependencyError,
  ImportParseError,
  FileSizeLimitError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
  FileReadError,
  DirectoryScanError,
  MaxFilesExceededError,
} from '../../src/codebase-analyzer/errors.js';

describe('Codebase Analyzer Errors', () => {
  describe('CodebaseAnalyzerError', () => {
    it('should create with message', () => {
      const error = new CodebaseAnalyzerError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('CodebaseAnalyzerError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CodebaseAnalyzerError);
    });

    it('should have correct prototype chain', () => {
      const error = new CodebaseAnalyzerError('Test');
      expect(Object.getPrototypeOf(error)).toBe(CodebaseAnalyzerError.prototype);
    });
  });

  describe('ProjectNotFoundError', () => {
    it('should create with path', () => {
      const error = new ProjectNotFoundError('/some/path');
      expect(error.message).toBe('Project directory not found: /some/path');
      expect(error.name).toBe('ProjectNotFoundError');
      expect(error.path).toBe('/some/path');
      expect(error).toBeInstanceOf(CodebaseAnalyzerError);
    });

    it('should store the path property', () => {
      const error = new ProjectNotFoundError('/another/path');
      expect(error.path).toBe('/another/path');
    });
  });

  describe('NoSourceFilesError', () => {
    it('should create with project path and patterns', () => {
      const patterns = ['*.ts', '*.js'] as const;
      const error = new NoSourceFilesError('/project', patterns);
      expect(error.message).toBe(
        'No source files found in /project. Searched patterns: *.ts, *.js'
      );
      expect(error.name).toBe('NoSourceFilesError');
      expect(error.projectPath).toBe('/project');
      expect(error.patterns).toEqual(patterns);
    });

    it('should handle empty patterns array', () => {
      const error = new NoSourceFilesError('/project', []);
      expect(error.message).toBe('No source files found in /project. Searched patterns: ');
    });
  });

  describe('UnsupportedLanguageError', () => {
    it('should create with language and operation', () => {
      const error = new UnsupportedLanguageError('Rust', 'import analysis');
      expect(error.message).toBe("Language 'Rust' is not supported for import analysis");
      expect(error.name).toBe('UnsupportedLanguageError');
      expect(error.language).toBe('Rust');
      expect(error.operation).toBe('import analysis');
    });

    it('should store language and operation properties', () => {
      const error = new UnsupportedLanguageError('Go', 'dependency parsing');
      expect(error.language).toBe('Go');
      expect(error.operation).toBe('dependency parsing');
    });
  });

  describe('BuildSystemNotDetectedError', () => {
    it('should create with project path and checked files', () => {
      const checkedFiles = ['package.json', 'Cargo.toml'] as const;
      const error = new BuildSystemNotDetectedError('/project', checkedFiles);
      expect(error.message).toBe(
        'No build system detected in /project. Checked: package.json, Cargo.toml'
      );
      expect(error.name).toBe('BuildSystemNotDetectedError');
      expect(error.projectPath).toBe('/project');
      expect(error.checkedFiles).toEqual(checkedFiles);
    });

    it('should handle empty checked files array', () => {
      const error = new BuildSystemNotDetectedError('/project', []);
      expect(error.message).toBe('No build system detected in /project. Checked: ');
    });
  });

  describe('CircularDependencyError', () => {
    it('should create with cycle array', () => {
      const cycle = ['a.ts', 'b.ts', 'a.ts'] as const;
      const error = new CircularDependencyError(cycle);
      expect(error.message).toBe('Circular dependency detected: a.ts -> b.ts -> a.ts');
      expect(error.name).toBe('CircularDependencyError');
      expect(error.cycle).toEqual(cycle);
    });

    it('should handle single item cycle', () => {
      const cycle = ['self.ts'] as const;
      const error = new CircularDependencyError(cycle);
      expect(error.message).toBe('Circular dependency detected: self.ts');
    });

    it('should handle longer cycles', () => {
      const cycle = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'a.ts'] as const;
      const error = new CircularDependencyError(cycle);
      expect(error.cycle).toHaveLength(5);
    });
  });

  describe('ImportParseError', () => {
    it('should create with file path and reason', () => {
      const error = new ImportParseError('/file.ts', 'syntax error');
      expect(error.message).toBe('Failed to parse imports in /file.ts: syntax error');
      expect(error.name).toBe('ImportParseError');
      expect(error.filePath).toBe('/file.ts');
      expect(error.reason).toBe('syntax error');
      expect(error.line).toBeUndefined();
    });

    it('should include line number when provided', () => {
      const error = new ImportParseError('/file.ts', 'unexpected token', 42);
      expect(error.message).toBe(
        'Failed to parse imports in /file.ts at line 42: unexpected token'
      );
      expect(error.line).toBe(42);
    });

    it('should handle line number 0', () => {
      const error = new ImportParseError('/file.ts', 'error', 0);
      expect(error.line).toBe(0);
    });
  });

  describe('FileSizeLimitError', () => {
    it('should create with path, size, and max size', () => {
      const error = new FileSizeLimitError('/large.ts', 10 * 1024 * 1024, 5 * 1024 * 1024);
      expect(error.message).toBe('File /large.ts exceeds size limit: 10.00MB > 5.00MB');
      expect(error.name).toBe('FileSizeLimitError');
      expect(error.path).toBe('/large.ts');
      expect(error.size).toBe(10 * 1024 * 1024);
      expect(error.maxSize).toBe(5 * 1024 * 1024);
    });

    it('should format small sizes correctly', () => {
      const error = new FileSizeLimitError('/file.ts', 1024 * 1024, 512 * 1024);
      expect(error.message).toContain('1.00MB');
      expect(error.message).toContain('0.50MB');
    });
  });

  describe('NoActiveSessionError', () => {
    it('should create with default message', () => {
      const error = new NoActiveSessionError();
      expect(error.message).toBe('No active analysis session. Call startSession() first.');
      expect(error.name).toBe('NoActiveSessionError');
    });

    it('should be instanceof CodebaseAnalyzerError', () => {
      const error = new NoActiveSessionError();
      expect(error).toBeInstanceOf(CodebaseAnalyzerError);
    });
  });

  describe('InvalidSessionStateError', () => {
    it('should create with operation and statuses', () => {
      const error = new InvalidSessionStateError('analyze', 'idle', 'scanning');
      expect(error.message).toBe(
        "Cannot perform analyze: session status is 'idle', expected 'scanning'"
      );
      expect(error.name).toBe('InvalidSessionStateError');
      expect(error.operation).toBe('analyze');
      expect(error.currentStatus).toBe('idle');
      expect(error.expectedStatus).toBe('scanning');
    });

    it('should store all properties', () => {
      const error = new InvalidSessionStateError('complete', 'failed', 'analyzing');
      expect(error.operation).toBe('complete');
      expect(error.currentStatus).toBe('failed');
      expect(error.expectedStatus).toBe('analyzing');
    });
  });

  describe('OutputWriteError', () => {
    it('should create with path and reason', () => {
      const error = new OutputWriteError('/output/file.json', 'permission denied');
      expect(error.message).toBe(
        'Failed to write output to /output/file.json: permission denied'
      );
      expect(error.name).toBe('OutputWriteError');
      expect(error.path).toBe('/output/file.json');
      expect(error.reason).toBe('permission denied');
    });

    it('should store path and reason properties', () => {
      const error = new OutputWriteError('/path', 'disk full');
      expect(error.path).toBe('/path');
      expect(error.reason).toBe('disk full');
    });
  });

  describe('FileReadError', () => {
    it('should create with path and reason', () => {
      const error = new FileReadError('/source/file.ts', 'file not found');
      expect(error.message).toBe('Failed to read file /source/file.ts: file not found');
      expect(error.name).toBe('FileReadError');
      expect(error.path).toBe('/source/file.ts');
      expect(error.reason).toBe('file not found');
    });

    it('should store path and reason properties', () => {
      const error = new FileReadError('/another/file', 'access denied');
      expect(error.path).toBe('/another/file');
      expect(error.reason).toBe('access denied');
    });
  });

  describe('DirectoryScanError', () => {
    it('should create with path and reason', () => {
      const error = new DirectoryScanError('/src', 'too many files');
      expect(error.message).toBe('Failed to scan directory /src: too many files');
      expect(error.name).toBe('DirectoryScanError');
      expect(error.path).toBe('/src');
      expect(error.reason).toBe('too many files');
    });

    it('should store path and reason properties', () => {
      const error = new DirectoryScanError('/deep/nested/path', 'timeout');
      expect(error.path).toBe('/deep/nested/path');
      expect(error.reason).toBe('timeout');
    });
  });

  describe('MaxFilesExceededError', () => {
    it('should create with scanned and limit values', () => {
      const error = new MaxFilesExceededError(15000, 10000);
      expect(error.message).toBe(
        'Maximum file limit exceeded: scanned 15,000 files, limit is 10,000'
      );
      expect(error.name).toBe('MaxFilesExceededError');
      expect(error.scanned).toBe(15000);
      expect(error.limit).toBe(10000);
    });

    it('should format numbers with locale separators', () => {
      const error = new MaxFilesExceededError(1000000, 500000);
      expect(error.scanned).toBe(1000000);
      expect(error.limit).toBe(500000);
      // Message should contain formatted numbers
      expect(error.message).toContain('1,000,000');
      expect(error.message).toContain('500,000');
    });

    it('should handle small numbers', () => {
      const error = new MaxFilesExceededError(100, 50);
      expect(error.scanned).toBe(100);
      expect(error.limit).toBe(50);
    });
  });

  describe('error inheritance', () => {
    it('all errors should be instances of CodebaseAnalyzerError', () => {
      const errors = [
        new ProjectNotFoundError('/path'),
        new NoSourceFilesError('/path', []),
        new UnsupportedLanguageError('lang', 'op'),
        new BuildSystemNotDetectedError('/path', []),
        new CircularDependencyError([]),
        new ImportParseError('/path', 'reason'),
        new FileSizeLimitError('/path', 100, 50),
        new NoActiveSessionError(),
        new InvalidSessionStateError('op', 'current', 'expected'),
        new OutputWriteError('/path', 'reason'),
        new FileReadError('/path', 'reason'),
        new DirectoryScanError('/path', 'reason'),
        new MaxFilesExceededError(100, 50),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(CodebaseAnalyzerError);
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('all errors should have correct name property', () => {
      const errorClasses = [
        { ErrorClass: ProjectNotFoundError, name: 'ProjectNotFoundError', args: ['/path'] },
        { ErrorClass: NoSourceFilesError, name: 'NoSourceFilesError', args: ['/path', []] },
        { ErrorClass: UnsupportedLanguageError, name: 'UnsupportedLanguageError', args: ['lang', 'op'] },
        { ErrorClass: BuildSystemNotDetectedError, name: 'BuildSystemNotDetectedError', args: ['/path', []] },
        { ErrorClass: CircularDependencyError, name: 'CircularDependencyError', args: [[]] },
        { ErrorClass: ImportParseError, name: 'ImportParseError', args: ['/path', 'reason'] },
        { ErrorClass: FileSizeLimitError, name: 'FileSizeLimitError', args: ['/path', 100, 50] },
        { ErrorClass: NoActiveSessionError, name: 'NoActiveSessionError', args: [] },
        { ErrorClass: InvalidSessionStateError, name: 'InvalidSessionStateError', args: ['op', 'cur', 'exp'] },
        { ErrorClass: OutputWriteError, name: 'OutputWriteError', args: ['/path', 'reason'] },
        { ErrorClass: FileReadError, name: 'FileReadError', args: ['/path', 'reason'] },
        { ErrorClass: DirectoryScanError, name: 'DirectoryScanError', args: ['/path', 'reason'] },
        { ErrorClass: MaxFilesExceededError, name: 'MaxFilesExceededError', args: [100, 50] },
      ];

      for (const { ErrorClass, name, args } of errorClasses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = new (ErrorClass as any)(...args);
        expect(error.name).toBe(name);
      }
    });
  });
});
