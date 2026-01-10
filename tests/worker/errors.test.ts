import { describe, it, expect } from 'vitest';
import {
  WorkerError,
  WorkOrderParseError,
  ContextAnalysisError,
  FileReadError,
  FileWriteError,
  BranchCreationError,
  BranchExistsError,
  CommitError,
  CodeGenerationError,
  TestGenerationError,
  VerificationError,
  MaxRetriesExceededError,
  ImplementationBlockedError,
  ResultPersistenceError,
  GitOperationError,
  CommandExecutionError,
  CommandTimeoutError,
  OperationTimeoutError,
  TypeCheckError,
  EscalationRequiredError,
  categorizeError,
  isRetryableError,
  requiresEscalation,
  getSuggestedAction,
  createWorkerErrorInfo,
} from '../../src/worker/errors.js';
import { AppError, ErrorCodes, ErrorSeverity } from '../../src/errors/index.js';

describe('WorkerError', () => {
  it('should create base error extending AppError', () => {
    const error = new WorkerError(ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR, 'test error');
    expect(error.message).toBe('test error');
    expect(error.name).toBe('WorkerError');
    expect(error.code).toBe(ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(WorkerError);
  });

  it('should have default severity and category', () => {
    const error = new WorkerError(ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR, 'test');
    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    expect(error.category).toBe('recoverable');
  });
});

describe('WorkOrderParseError', () => {
  it('should create error with order ID', () => {
    const error = new WorkOrderParseError('WO-001');
    expect(error.message).toBe('Failed to parse work order WO-001');
    expect(error.name).toBe('WorkOrderParseError');
    expect(error.orderId).toBe('WO-001');
    expect(error.cause).toBeUndefined();
    expect(error.code).toBe(ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR);
  });

  it('should include cause in message', () => {
    const cause = new Error('JSON parse error');
    const error = new WorkOrderParseError('WO-001', cause);
    expect(error.message).toBe('Failed to parse work order WO-001: JSON parse error');
    expect(error.cause).toBe(cause);
  });
});

describe('ContextAnalysisError', () => {
  it('should create error with issue ID', () => {
    const error = new ContextAnalysisError('ISS-001');
    expect(error.message).toBe('Failed to analyze context for issue ISS-001');
    expect(error.name).toBe('ContextAnalysisError');
    expect(error.issueId).toBe('ISS-001');
  });

  it('should include cause in message', () => {
    const cause = new Error('File not found');
    const error = new ContextAnalysisError('ISS-001', cause);
    expect(error.message).toContain('File not found');
    expect(error.cause).toBe(cause);
  });
});

describe('FileReadError', () => {
  it('should create error with file path', () => {
    const error = new FileReadError('/path/to/file.ts');
    expect(error.message).toBe('Failed to read file /path/to/file.ts');
    expect(error.name).toBe('FileReadError');
    expect(error.filePath).toBe('/path/to/file.ts');
  });

  it('should include cause in message', () => {
    const cause = new Error('Permission denied');
    const error = new FileReadError('/path/to/file.ts', cause);
    expect(error.message).toContain('Permission denied');
    expect(error.cause).toBe(cause);
  });
});

describe('FileWriteError', () => {
  it('should create error with file path', () => {
    const error = new FileWriteError('/path/to/file.ts');
    expect(error.message).toBe('Failed to write file /path/to/file.ts');
    expect(error.name).toBe('FileWriteError');
    expect(error.filePath).toBe('/path/to/file.ts');
  });

  it('should include cause in message', () => {
    const cause = new Error('Disk full');
    const error = new FileWriteError('/path/to/file.ts', cause);
    expect(error.message).toContain('Disk full');
    expect(error.cause).toBe(cause);
  });
});

describe('BranchCreationError', () => {
  it('should create error with branch name', () => {
    const error = new BranchCreationError('feature/test');
    expect(error.message).toBe('Failed to create branch feature/test');
    expect(error.name).toBe('BranchCreationError');
    expect(error.branchName).toBe('feature/test');
  });

  it('should include cause in message', () => {
    const cause = new Error('Git error');
    const error = new BranchCreationError('feature/test', cause);
    expect(error.message).toContain('Git error');
    expect(error.cause).toBe(cause);
  });
});

describe('BranchExistsError', () => {
  it('should create error with branch name', () => {
    const error = new BranchExistsError('feature/existing');
    expect(error.message).toBe('Branch already exists: feature/existing');
    expect(error.name).toBe('BranchExistsError');
    expect(error.branchName).toBe('feature/existing');
  });
});

describe('CommitError', () => {
  it('should create error with commit message', () => {
    const error = new CommitError('feat: add feature');
    expect(error.message).toContain('Failed to commit');
    expect(error.name).toBe('CommitError');
    expect(error.commitMessage).toBe('feat: add feature');
  });

  it('should include cause in message', () => {
    const cause = new Error('Pre-commit hook failed');
    const error = new CommitError('feat: add feature', cause);
    expect(error.message).toContain('Pre-commit hook failed');
    expect(error.cause).toBe(cause);
  });
});

describe('CodeGenerationError', () => {
  it('should create error with issue ID', () => {
    const error = new CodeGenerationError('ISS-001');
    expect(error.message).toBe('Failed to generate code for issue ISS-001');
    expect(error.name).toBe('CodeGenerationError');
    expect(error.issueId).toBe('ISS-001');
  });

  it('should include cause in message', () => {
    const cause = new Error('Template error');
    const error = new CodeGenerationError('ISS-001', cause);
    expect(error.message).toContain('Template error');
    expect(error.cause).toBe(cause);
  });
});

describe('TestGenerationError', () => {
  it('should create error with issue ID', () => {
    const error = new TestGenerationError('ISS-001');
    expect(error.message).toBe('Failed to generate tests for issue ISS-001');
    expect(error.name).toBe('TestGenerationError');
    expect(error.issueId).toBe('ISS-001');
  });
});

describe('VerificationError', () => {
  it('should create error with verification type and output', () => {
    const error = new VerificationError('test', 'Test failed: assertions did not pass');
    expect(error.message).toContain('test verification failed');
    expect(error.name).toBe('VerificationError');
    expect(error.verificationType).toBe('test');
    expect(error.output).toBe('Test failed: assertions did not pass');
    expect(error.category).toBe('recoverable');
  });

  it('should create lint verification error', () => {
    const error = new VerificationError('lint', 'ESLint errors found');
    expect(error.verificationType).toBe('lint');
    expect(error.message).toContain('lint');
  });

  it('should create build verification error', () => {
    const error = new VerificationError('build', 'TypeScript compilation failed');
    expect(error.verificationType).toBe('build');
    expect(error.message).toContain('build');
  });
});

describe('MaxRetriesExceededError', () => {
  it('should create error with issue ID and attempts', () => {
    const error = new MaxRetriesExceededError('ISS-001', 3);
    expect(error.message).toContain('Max retries');
    expect(error.message).toContain('3');
    expect(error.message).toContain('ISS-001');
    expect(error.name).toBe('MaxRetriesExceededError');
    expect(error.issueId).toBe('ISS-001');
    expect(error.attempts).toBe(3);
    expect(error.category).toBe('fatal');
  });

  it('should include last error in message', () => {
    const lastError = new Error('Connection timeout');
    const error = new MaxRetriesExceededError('ISS-001', 3, lastError);
    expect(error.message).toContain('Connection timeout');
    expect(error.lastError).toBe(lastError);
    expect(error.cause).toBe(lastError);
  });
});

describe('ImplementationBlockedError', () => {
  it('should create error with issue ID and blockers', () => {
    const blockers = ['ISS-002', 'ISS-003'];
    const error = new ImplementationBlockedError('ISS-001', blockers);
    expect(error.message).toContain('ISS-001');
    expect(error.message).toContain('ISS-002');
    expect(error.message).toContain('ISS-003');
    expect(error.name).toBe('ImplementationBlockedError');
    expect(error.issueId).toBe('ISS-001');
    expect(error.blockers).toEqual(blockers);
    expect(error.category).toBe('fatal');
  });
});

describe('ResultPersistenceError', () => {
  it('should create error with order ID and save operation', () => {
    const error = new ResultPersistenceError('WO-001', 'save');
    expect(error.message).toContain('save');
    expect(error.message).toContain('WO-001');
    expect(error.name).toBe('ResultPersistenceError');
    expect(error.orderId).toBe('WO-001');
    expect(error.operation).toBe('save');
  });

  it('should create error with load operation', () => {
    const error = new ResultPersistenceError('WO-001', 'load');
    expect(error.message).toContain('load');
    expect(error.operation).toBe('load');
  });

  it('should include cause in message', () => {
    const cause = new Error('Disk full');
    const error = new ResultPersistenceError('WO-001', 'save', cause);
    expect(error.message).toContain('Disk full');
    expect(error.cause).toBe(cause);
  });
});

describe('GitOperationError', () => {
  it('should create error with operation', () => {
    const error = new GitOperationError('checkout');
    expect(error.message).toContain('checkout');
    expect(error.name).toBe('GitOperationError');
    expect(error.operation).toBe('checkout');
  });

  it('should include cause in message', () => {
    const cause = new Error('Branch not found');
    const error = new GitOperationError('checkout', cause);
    expect(error.message).toContain('Branch not found');
    expect(error.cause).toBe(cause);
  });
});

describe('CommandExecutionError', () => {
  it('should create error with command, exit code, and stderr', () => {
    const error = new CommandExecutionError('npm test', 1, 'Error: test failed');
    expect(error.message).toContain('npm test');
    expect(error.message).toContain('exit code: 1');
    expect(error.name).toBe('CommandExecutionError');
    expect(error.command).toBe('npm test');
    expect(error.exitCode).toBe(1);
    expect(error.stderr).toBe('Error: test failed');
  });
});

describe('Error Serialization', () => {
  it('should serialize to JSON', () => {
    const error = new VerificationError('test', 'Test failed');
    const json = error.toJSON();

    expect(json.code).toBe(ErrorCodes.WRK_VERIFICATION_ERROR);
    expect(json.message).toContain('test');
    expect(json.severity).toBeDefined();
    expect(json.category).toBe('recoverable');
    expect(json.context.verificationType).toBe('test');
  });

  it('should check retryability', () => {
    const recoverableError = new VerificationError('test', 'Failed');
    const fatalError = new ImplementationBlockedError('ISS-001', ['ISS-002']);

    expect(recoverableError.isRetryable()).toBe(true);
    expect(fatalError.isRetryable()).toBe(false);
  });
});

describe('Error Classification (Issue #252)', () => {
  describe('categorizeError', () => {
    it('should categorize transient errors correctly', () => {
      const timeoutError = new CommandTimeoutError('npm test', 30000);
      expect(categorizeError(timeoutError)).toBe('transient');

      const operationTimeout = new OperationTimeoutError('task-1', 'build', 60000);
      expect(categorizeError(operationTimeout)).toBe('transient');
    });

    it('should categorize recoverable errors correctly', () => {
      const verificationError = new VerificationError('test', 'Test failed');
      expect(categorizeError(verificationError)).toBe('recoverable');

      const typeCheckError = new TypeCheckError(5, 'Type errors found');
      expect(categorizeError(typeCheckError)).toBe('recoverable');

      const testGenError = new TestGenerationError('ISS-001');
      expect(categorizeError(testGenError)).toBe('recoverable');
    });

    it('should categorize fatal errors correctly', () => {
      const blockedError = new ImplementationBlockedError('ISS-001', ['ISS-002']);
      expect(categorizeError(blockedError)).toBe('fatal');

      const escalationError = new EscalationRequiredError(
        'task-1',
        ['test', 'build'],
        3,
        ['error1', 'error2'],
        'Analysis failed'
      );
      expect(categorizeError(escalationError)).toBe('fatal');
    });

    it('should categorize Node.js system errors by code', () => {
      const econnreset = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
      expect(categorizeError(econnreset)).toBe('transient');

      const enoent = Object.assign(new Error('File not found'), { code: 'ENOENT' });
      expect(categorizeError(enoent)).toBe('fatal');

      const eacces = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      expect(categorizeError(eacces)).toBe('fatal');
    });

    it('should categorize errors by message patterns', () => {
      const networkError = new Error('Network connection failed');
      expect(categorizeError(networkError)).toBe('transient');

      const timeoutError = new Error('Request timeout after 30s');
      expect(categorizeError(timeoutError)).toBe('transient');

      const permissionError = new Error('Permission denied for file access');
      expect(categorizeError(permissionError)).toBe('fatal');

      const testFailError = new Error('Test failed: assertions not met');
      expect(categorizeError(testFailError)).toBe('recoverable');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for transient errors', () => {
      const timeoutError = new CommandTimeoutError('npm test', 30000);
      expect(isRetryableError(timeoutError)).toBe(true);
    });

    it('should return true for recoverable errors', () => {
      const verificationError = new VerificationError('test', 'Test failed');
      expect(isRetryableError(verificationError)).toBe(true);
    });

    it('should return false for fatal errors', () => {
      const blockedError = new ImplementationBlockedError('ISS-001', ['ISS-002']);
      expect(isRetryableError(blockedError)).toBe(false);
    });
  });

  describe('requiresEscalation', () => {
    it('should return true for fatal errors', () => {
      const blockedError = new ImplementationBlockedError('ISS-001', ['ISS-002']);
      expect(requiresEscalation(blockedError)).toBe(true);
    });

    it('should return true for critical severity errors', () => {
      const escalationError = new EscalationRequiredError(
        'task-1',
        ['test'],
        3,
        ['error1'],
        'Analysis'
      );
      expect(requiresEscalation(escalationError)).toBe(true);
    });

    it('should return false for recoverable errors', () => {
      const verificationError = new VerificationError('test', 'Test failed');
      expect(requiresEscalation(verificationError)).toBe(false);
    });

    it('should return false for transient errors', () => {
      const timeoutError = new CommandTimeoutError('npm test', 30000);
      expect(requiresEscalation(timeoutError)).toBe(false);
    });
  });

  describe('getSuggestedAction', () => {
    it('should suggest retry for transient errors', () => {
      const timeoutError = new CommandTimeoutError('npm test', 30000);
      const action = getSuggestedAction(timeoutError, 'transient');
      expect(action).toContain('Retry');
      expect(action).toContain('backoff');
    });

    it('should suggest fix for recoverable verification errors', () => {
      const lintError = new VerificationError('lint', 'ESLint errors');
      const action = getSuggestedAction(lintError, 'recoverable');
      expect(action).toContain('lint');
      expect(action).toContain('fix');
    });

    it('should suggest escalation for fatal errors', () => {
      const blockedError = new ImplementationBlockedError('ISS-001', ['ISS-002']);
      const action = getSuggestedAction(blockedError, 'fatal');
      expect(action).toContain('Escalate');
      expect(action).toContain('ISS-002');
    });
  });

  describe('createWorkerErrorInfo', () => {
    it('should create complete error info for recoverable error', () => {
      const error = new VerificationError('test', 'Test assertions failed');
      const info = createWorkerErrorInfo(error, { taskId: 'task-123' });

      expect(info.category).toBe('recoverable');
      expect(info.code).toBe(ErrorCodes.WRK_VERIFICATION_ERROR);
      expect(info.retryable).toBe(true);
      expect(info.suggestedAction).toBeDefined();
      expect(info.context).toHaveProperty('taskId', 'task-123');
    });

    it('should create complete error info for fatal error', () => {
      const error = new ImplementationBlockedError('ISS-001', ['ISS-002']);
      const info = createWorkerErrorInfo(error);

      expect(info.category).toBe('fatal');
      expect(info.retryable).toBe(false);
      expect(info.suggestedAction).toContain('Escalate');
    });
  });
});
