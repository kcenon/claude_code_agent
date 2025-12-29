/**
 * Regression Tester Agent error classes tests
 */

import { describe, it, expect } from 'vitest';

import {
  RegressionTesterError,
  NoTestsFoundError,
  TestExecutionFailedError,
  TestFrameworkNotDetectedError,
  CoverageCalculationError,
  DependencyGraphNotFoundError,
  NoChangedFilesError,
  TestTimeoutError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
  FileReadError,
  InvalidProjectPathError,
  TestMappingError,
  MaxTestsExceededError,
} from '../../src/regression-tester/index.js';

describe('RegressionTesterError', () => {
  it('should be an instance of Error', () => {
    const error = new RegressionTesterError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RegressionTesterError);
  });

  it('should have correct name', () => {
    const error = new RegressionTesterError('Test error');
    expect(error.name).toBe('RegressionTesterError');
  });

  it('should have correct message', () => {
    const error = new RegressionTesterError('Test error message');
    expect(error.message).toBe('Test error message');
  });
});

describe('NoTestsFoundError', () => {
  it('should extend RegressionTesterError', () => {
    const error = new NoTestsFoundError('/project', ['tests/**/*']);
    expect(error).toBeInstanceOf(RegressionTesterError);
  });

  it('should have correct name', () => {
    const error = new NoTestsFoundError('/project', ['tests/**/*']);
    expect(error.name).toBe('NoTestsFoundError');
  });

  it('should include project path in message', () => {
    const error = new NoTestsFoundError('/my/project', ['tests/**/*', '**/*.test.ts']);
    expect(error.message).toContain('/my/project');
    expect(error.projectPath).toBe('/my/project');
  });

  it('should include patterns in message', () => {
    const patterns = ['tests/**/*', '**/*.test.ts'];
    const error = new NoTestsFoundError('/project', patterns);
    expect(error.message).toContain('tests/**/*');
    expect(error.patterns).toEqual(patterns);
  });
});

describe('TestExecutionFailedError', () => {
  it('should extend RegressionTesterError', () => {
    const error = new TestExecutionFailedError('test.ts', 'assertion failed');
    expect(error).toBeInstanceOf(RegressionTesterError);
  });

  it('should have correct properties', () => {
    const error = new TestExecutionFailedError('test.ts', 'assertion failed', 1);
    expect(error.name).toBe('TestExecutionFailedError');
    expect(error.testFile).toBe('test.ts');
    expect(error.reason).toBe('assertion failed');
    expect(error.exitCode).toBe(1);
  });

  it('should include exit code in message when provided', () => {
    const error = new TestExecutionFailedError('test.ts', 'assertion failed', 1);
    expect(error.message).toContain('exit code: 1');
  });

  it('should work without exit code', () => {
    const error = new TestExecutionFailedError('test.ts', 'assertion failed');
    expect(error.exitCode).toBeUndefined();
    expect(error.message).not.toContain('exit code');
  });
});

describe('TestFrameworkNotDetectedError', () => {
  it('should have correct properties', () => {
    const checkedFiles = ['package.json', 'jest.config.js'];
    const error = new TestFrameworkNotDetectedError('/project', checkedFiles);
    expect(error.name).toBe('TestFrameworkNotDetectedError');
    expect(error.projectPath).toBe('/project');
    expect(error.checkedFiles).toEqual(checkedFiles);
  });
});

describe('CoverageCalculationError', () => {
  it('should have correct properties', () => {
    const error = new CoverageCalculationError('/project', 'nyc not found');
    expect(error.name).toBe('CoverageCalculationError');
    expect(error.projectPath).toBe('/project');
    expect(error.reason).toBe('nyc not found');
  });
});

describe('DependencyGraphNotFoundError', () => {
  it('should have correct properties', () => {
    const error = new DependencyGraphNotFoundError('/path/to/graph.json');
    expect(error.name).toBe('DependencyGraphNotFoundError');
    expect(error.expectedPath).toBe('/path/to/graph.json');
    expect(error.message).toContain('Run Codebase Analyzer first');
  });
});

describe('NoChangedFilesError', () => {
  it('should have correct name and message', () => {
    const error = new NoChangedFilesError();
    expect(error.name).toBe('NoChangedFilesError');
    expect(error.message).toContain('No changed files');
  });
});

describe('TestTimeoutError', () => {
  it('should have correct properties', () => {
    const error = new TestTimeoutError('slow.test.ts', 30000);
    expect(error.name).toBe('TestTimeoutError');
    expect(error.testFile).toBe('slow.test.ts');
    expect(error.timeout).toBe(30000);
    expect(error.message).toContain('30000ms');
  });
});

describe('NoActiveSessionError', () => {
  it('should have correct name and message', () => {
    const error = new NoActiveSessionError();
    expect(error.name).toBe('NoActiveSessionError');
    expect(error.message).toContain('startSession()');
  });
});

describe('InvalidSessionStateError', () => {
  it('should have correct properties', () => {
    const error = new InvalidSessionStateError('analyze', 'mapping', 'completed');
    expect(error.name).toBe('InvalidSessionStateError');
    expect(error.operation).toBe('analyze');
    expect(error.currentStatus).toBe('mapping');
    expect(error.expectedStatus).toBe('completed');
    expect(error.message).toContain('analyze');
    expect(error.message).toContain('mapping');
    expect(error.message).toContain('completed');
  });
});

describe('OutputWriteError', () => {
  it('should have correct properties', () => {
    const error = new OutputWriteError('/output/path.yaml', 'permission denied');
    expect(error.name).toBe('OutputWriteError');
    expect(error.path).toBe('/output/path.yaml');
    expect(error.reason).toBe('permission denied');
  });
});

describe('FileReadError', () => {
  it('should have correct properties', () => {
    const error = new FileReadError('/file/path.ts', 'file not found');
    expect(error.name).toBe('FileReadError');
    expect(error.path).toBe('/file/path.ts');
    expect(error.reason).toBe('file not found');
  });
});

describe('InvalidProjectPathError', () => {
  it('should have correct properties', () => {
    const error = new InvalidProjectPathError('/invalid/path');
    expect(error.name).toBe('InvalidProjectPathError');
    expect(error.path).toBe('/invalid/path');
    expect(error.message).toContain('/invalid/path');
  });
});

describe('TestMappingError', () => {
  it('should have correct properties', () => {
    const error = new TestMappingError('src/service.ts', 'no matching test found');
    expect(error.name).toBe('TestMappingError');
    expect(error.sourceFile).toBe('src/service.ts');
    expect(error.reason).toBe('no matching test found');
  });
});

describe('MaxTestsExceededError', () => {
  it('should have correct properties', () => {
    const error = new MaxTestsExceededError(1500, 1000);
    expect(error.name).toBe('MaxTestsExceededError');
    expect(error.found).toBe(1500);
    expect(error.limit).toBe(1000);
    expect(error.message).toContain('1,500');
    expect(error.message).toContain('1,000');
  });
});

describe('Error inheritance', () => {
  it('all errors should be catchable as RegressionTesterError', () => {
    const errors = [
      new NoTestsFoundError('/project', []),
      new TestExecutionFailedError('test.ts', 'failed'),
      new TestFrameworkNotDetectedError('/project', []),
      new CoverageCalculationError('/project', 'failed'),
      new DependencyGraphNotFoundError('/path'),
      new NoChangedFilesError(),
      new TestTimeoutError('test.ts', 1000),
      new NoActiveSessionError(),
      new InvalidSessionStateError('op', 'current', 'expected'),
      new OutputWriteError('/path', 'reason'),
      new FileReadError('/path', 'reason'),
      new InvalidProjectPathError('/path'),
      new TestMappingError('file', 'reason'),
      new MaxTestsExceededError(100, 50),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(RegressionTesterError);
      expect(error).toBeInstanceOf(Error);
    }
  });
});
