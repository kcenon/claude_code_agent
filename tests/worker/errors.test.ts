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
} from '../../src/worker/errors.js';

describe('WorkerError', () => {
  it('should create base error with message', () => {
    const error = new WorkerError('test error');
    expect(error.message).toBe('test error');
    expect(error.name).toBe('WorkerError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkerError);
  });
});

describe('WorkOrderParseError', () => {
  it('should create error with order ID', () => {
    const error = new WorkOrderParseError('WO-001');
    expect(error.message).toBe('Failed to parse work order WO-001');
    expect(error.name).toBe('WorkOrderParseError');
    expect(error.orderId).toBe('WO-001');
    expect(error.cause).toBeUndefined();
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
    const error = new BranchExistsError('feature/test');
    expect(error.message).toBe('Branch already exists: feature/test');
    expect(error.name).toBe('BranchExistsError');
    expect(error.branchName).toBe('feature/test');
  });
});

describe('CommitError', () => {
  it('should create error with commit message', () => {
    const error = new CommitError('feat: add feature');
    expect(error.message).toBe('Failed to commit changes');
    expect(error.name).toBe('CommitError');
    expect(error.commitMessage).toBe('feat: add feature');
  });

  it('should include cause in message', () => {
    const cause = new Error('Nothing to commit');
    const error = new CommitError('feat: add feature', cause);
    expect(error.message).toContain('Nothing to commit');
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

  it('should include cause in message', () => {
    const cause = new Error('Test framework error');
    const error = new TestGenerationError('ISS-001', cause);
    expect(error.message).toContain('Test framework error');
    expect(error.cause).toBe(cause);
  });
});

describe('VerificationError', () => {
  it('should create error with verification type and output', () => {
    const error = new VerificationError('test', 'Test failed: assertion error');
    expect(error.message).toContain('test verification failed');
    expect(error.name).toBe('VerificationError');
    expect(error.verificationType).toBe('test');
    expect(error.output).toBe('Test failed: assertion error');
  });

  it('should handle lint verification type', () => {
    const error = new VerificationError('lint', 'Lint error: missing semicolon');
    expect(error.message).toContain('lint verification failed');
    expect(error.verificationType).toBe('lint');
  });

  it('should handle build verification type', () => {
    const error = new VerificationError('build', 'Build error: type error');
    expect(error.message).toContain('build verification failed');
    expect(error.verificationType).toBe('build');
  });

  it('should truncate long output in message', () => {
    const longOutput = 'A'.repeat(500);
    const error = new VerificationError('test', longOutput);
    expect(error.message.length).toBeLessThan(300);
    expect(error.output).toBe(longOutput);
  });
});

describe('MaxRetriesExceededError', () => {
  it('should create error with issue ID and attempts', () => {
    const error = new MaxRetriesExceededError('ISS-001', 3);
    expect(error.message).toBe('Max retries (3) exceeded for issue ISS-001');
    expect(error.name).toBe('MaxRetriesExceededError');
    expect(error.issueId).toBe('ISS-001');
    expect(error.attempts).toBe(3);
    expect(error.lastError).toBeUndefined();
  });

  it('should include last error in message', () => {
    const lastError = new Error('Verification failed');
    const error = new MaxRetriesExceededError('ISS-001', 3, lastError);
    expect(error.message).toContain('Verification failed');
    expect(error.lastError).toBe(lastError);
  });
});

describe('ImplementationBlockedError', () => {
  it('should create error with issue ID and blockers', () => {
    const blockers = ['Dependency ISS-002 not completed', 'API not available'];
    const error = new ImplementationBlockedError('ISS-001', blockers);
    expect(error.message).toContain('ISS-001');
    expect(error.message).toContain('Dependency ISS-002 not completed');
    expect(error.message).toContain('API not available');
    expect(error.name).toBe('ImplementationBlockedError');
    expect(error.issueId).toBe('ISS-001');
    expect(error.blockers).toEqual(blockers);
  });

  it('should handle single blocker', () => {
    const blockers = ['Missing dependency'];
    const error = new ImplementationBlockedError('ISS-001', blockers);
    expect(error.message).toContain('Missing dependency');
    expect(error.blockers).toHaveLength(1);
  });
});

describe('ResultPersistenceError', () => {
  it('should create error for save operation', () => {
    const error = new ResultPersistenceError('WO-001', 'save');
    expect(error.message).toBe('Failed to save result for work order WO-001');
    expect(error.name).toBe('ResultPersistenceError');
    expect(error.orderId).toBe('WO-001');
    expect(error.operation).toBe('save');
  });

  it('should create error for load operation', () => {
    const error = new ResultPersistenceError('WO-001', 'load');
    expect(error.message).toBe('Failed to load result for work order WO-001');
    expect(error.operation).toBe('load');
  });

  it('should include cause in message', () => {
    const cause = new Error('File not found');
    const error = new ResultPersistenceError('WO-001', 'load', cause);
    expect(error.message).toContain('File not found');
    expect(error.cause).toBe(cause);
  });
});

describe('GitOperationError', () => {
  it('should create error with operation', () => {
    const error = new GitOperationError('checkout main');
    expect(error.message).toBe('Git operation failed: checkout main');
    expect(error.name).toBe('GitOperationError');
    expect(error.operation).toBe('checkout main');
  });

  it('should include cause in message', () => {
    const cause = new Error('Branch not found');
    const error = new GitOperationError('checkout feature/test', cause);
    expect(error.message).toContain('Branch not found');
    expect(error.cause).toBe(cause);
  });
});

describe('CommandExecutionError', () => {
  it('should create error with command and exit code', () => {
    const error = new CommandExecutionError('npm test', 1, 'Tests failed');
    expect(error.message).toBe('Command failed: npm test (exit code: 1)');
    expect(error.name).toBe('CommandExecutionError');
    expect(error.command).toBe('npm test');
    expect(error.exitCode).toBe(1);
    expect(error.stderr).toBe('Tests failed');
  });

  it('should handle undefined exit code', () => {
    const error = new CommandExecutionError('npm test', undefined, 'Error');
    expect(error.message).toBe('Command failed: npm test');
    expect(error.exitCode).toBeUndefined();
  });

  it('should include cause', () => {
    const cause = new Error('Process killed');
    const error = new CommandExecutionError('npm test', 137, 'Killed', cause);
    expect(error.cause).toBe(cause);
  });
});
