import { describe, it, expect } from 'vitest';
import {
  PRReviewerError,
  ImplementationResultNotFoundError,
  ImplementationResultParseError,
  PRCreationError,
  PRAlreadyExistsError,
  PRNotFoundError,
  PRMergeError,
  PRCloseError,
  ReviewSubmissionError,
  ReviewCommentError,
  CITimeoutError,
  CICheckFailedError,
  QualityGateFailedError,
  CoverageBelowThresholdError,
  SecurityVulnerabilityError,
  GitOperationError,
  BranchNotFoundError,
  CommandExecutionError,
  ResultPersistenceError,
} from '../../src/pr-reviewer/errors.js';
import { AppError, ErrorCodes, ErrorSeverity } from '../../src/errors/index.js';

describe('errors', () => {
  describe('PRReviewerError', () => {
    it('should create error with message and code', () => {
      const error = new PRReviewerError(ErrorCodes.PRR_CREATION_ERROR, 'Test error');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCodes.PRR_CREATION_ERROR);
      expect(error.name).toBe('PRReviewerError');
    });

    it('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = new PRReviewerError(ErrorCodes.PRR_CREATION_ERROR, 'Test error', { cause });
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error', () => {
      const error = new PRReviewerError(ErrorCodes.PRR_CREATION_ERROR, 'Test error');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof PRReviewerError).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should have default severity and category', () => {
      const error = new PRReviewerError(ErrorCodes.PRR_CREATION_ERROR, 'Test error');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.category).toBe('recoverable');
    });
  });

  describe('ImplementationResultNotFoundError', () => {
    it('should create error with work order ID and path', () => {
      const error = new ImplementationResultNotFoundError('WO-001', '/path/to/result');
      expect(error.workOrderId).toBe('WO-001');
      expect(error.code).toBe(ErrorCodes.PRR_IMPLEMENTATION_NOT_FOUND);
      expect(error.message).toContain('WO-001');
      expect(error.message).toContain('/path/to/result');
      expect(error.category).toBe('fatal');
    });
  });

  describe('ImplementationResultParseError', () => {
    it('should create error with file path', () => {
      const cause = new Error('YAML parse error');
      const error = new ImplementationResultParseError('/path/to/file', cause);
      expect(error.filePath).toBe('/path/to/file');
      expect(error.code).toBe(ErrorCodes.PRR_IMPLEMENTATION_PARSE_ERROR);
      expect(error.cause).toBe(cause);
    });
  });

  describe('PRCreationError', () => {
    it('should create error with branch name', () => {
      const error = new PRCreationError('feature/test');
      expect(error.branch).toBe('feature/test');
      expect(error.code).toBe(ErrorCodes.PRR_CREATION_ERROR);
    });
  });

  describe('PRAlreadyExistsError', () => {
    it('should create error with branch and PR number', () => {
      const error = new PRAlreadyExistsError('feature/test', 123);
      expect(error.branch).toBe('feature/test');
      expect(error.existingPRNumber).toBe(123);
      expect(error.code).toBe(ErrorCodes.PRR_ALREADY_EXISTS);
      expect(error.message).toContain('#123');
    });
  });

  describe('PRNotFoundError', () => {
    it('should create error with PR number', () => {
      const error = new PRNotFoundError(456);
      expect(error.prNumber).toBe(456);
      expect(error.code).toBe(ErrorCodes.PRR_NOT_FOUND);
    });
  });

  describe('PRMergeError', () => {
    it('should create error with PR number and reason', () => {
      const error = new PRMergeError(789, 'Conflicts detected');
      expect(error.prNumber).toBe(789);
      expect(error.code).toBe(ErrorCodes.PRR_MERGE_ERROR);
      expect(error.message).toContain('Conflicts detected');
    });
  });

  describe('PRCloseError', () => {
    it('should create error with PR number', () => {
      const error = new PRCloseError(101);
      expect(error.prNumber).toBe(101);
      expect(error.code).toBe(ErrorCodes.PRR_CLOSE_ERROR);
    });
  });

  describe('ReviewSubmissionError', () => {
    it('should create error with PR number', () => {
      const error = new ReviewSubmissionError(202);
      expect(error.prNumber).toBe(202);
      expect(error.code).toBe(ErrorCodes.PRR_SUBMISSION_ERROR);
    });
  });

  describe('ReviewCommentError', () => {
    it('should create error with PR number, file, and line', () => {
      const error = new ReviewCommentError(303, 'src/file.ts', 42);
      expect(error.prNumber).toBe(303);
      expect(error.file).toBe('src/file.ts');
      expect(error.line).toBe(42);
      expect(error.code).toBe(ErrorCodes.PRR_COMMENT_ERROR);
    });
  });

  describe('CITimeoutError', () => {
    it('should create error with PR number and timeout', () => {
      const error = new CITimeoutError(404, 600000);
      expect(error.prNumber).toBe(404);
      expect(error.timeoutMs).toBe(600000);
      expect(error.code).toBe(ErrorCodes.PRR_CI_TIMEOUT);
    });
  });

  describe('CICheckFailedError', () => {
    it('should create error with PR number and failed checks', () => {
      const failedChecks = ['tests', 'lint'];
      const error = new CICheckFailedError(505, failedChecks);
      expect(error.prNumber).toBe(505);
      expect(error.failedChecks).toEqual(failedChecks);
      expect(error.code).toBe(ErrorCodes.PRR_CI_CHECK_FAILED);
    });
  });

  describe('QualityGateFailedError', () => {
    it('should create error with PR number and failed gates', () => {
      const failedGates = ['coverage', 'security'];
      const error = new QualityGateFailedError(606, failedGates);
      expect(error.prNumber).toBe(606);
      expect(error.failedGates).toEqual(failedGates);
      expect(error.code).toBe(ErrorCodes.PRR_QUALITY_GATE_FAILED);
    });
  });

  describe('CoverageBelowThresholdError', () => {
    it('should create error with actual and required coverage', () => {
      const error = new CoverageBelowThresholdError(65, 80);
      expect(error.actual).toBe(65);
      expect(error.required).toBe(80);
      expect(error.code).toBe(ErrorCodes.PRR_COVERAGE_BELOW_THRESHOLD);
      expect(error.message).toContain('65%');
      expect(error.message).toContain('80%');
    });
  });

  describe('SecurityVulnerabilityError', () => {
    it('should create error with vulnerability counts', () => {
      const error = new SecurityVulnerabilityError(2, 5);
      expect(error.criticalCount).toBe(2);
      expect(error.highCount).toBe(5);
      expect(error.code).toBe(ErrorCodes.PRR_SECURITY_VULNERABILITY);
    });
  });

  describe('GitOperationError', () => {
    it('should create error with operation name', () => {
      const error = new GitOperationError('checkout');
      expect(error.operation).toBe('checkout');
      expect(error.code).toBe(ErrorCodes.PRR_GIT_OPERATION_ERROR);
    });
  });

  describe('BranchNotFoundError', () => {
    it('should create error with branch name', () => {
      const error = new BranchNotFoundError('feature/missing');
      expect(error.branch).toBe('feature/missing');
      expect(error.code).toBe(ErrorCodes.PRR_BRANCH_NOT_FOUND);
    });
  });

  describe('CommandExecutionError', () => {
    it('should create error with command, exit code, and stderr', () => {
      const error = new CommandExecutionError('npm test', 1, 'Test failed');
      expect(error.command).toBe('npm test');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('Test failed');
      expect(error.code).toBe(ErrorCodes.PRR_COMMAND_EXECUTION_ERROR);
    });
  });

  describe('ResultPersistenceError', () => {
    it('should create error with result path', () => {
      const error = new ResultPersistenceError('/path/to/result');
      expect(error.resultPath).toBe('/path/to/result');
      expect(error.code).toBe(ErrorCodes.PRR_RESULT_PERSISTENCE_ERROR);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON', () => {
      const error = new PRCreationError('feature/test');
      const json = error.toJSON();

      expect(json.code).toBe(ErrorCodes.PRR_CREATION_ERROR);
      expect(json.message).toContain('feature/test');
      expect(json.severity).toBeDefined();
      expect(json.category).toBe('recoverable');
    });

    it('should check retryability', () => {
      const recoverableError = new PRCreationError('feature/test');
      const fatalError = new QualityGateFailedError(123, ['security']);

      expect(recoverableError.isRetryable()).toBe(true);
      expect(fatalError.isRetryable()).toBe(false);
    });
  });
});
