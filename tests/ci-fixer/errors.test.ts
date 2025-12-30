import { describe, it, expect } from 'vitest';
import {
  CIFixerError,
  HandoffNotFoundError,
  HandoffParseError,
  HandoffValidationError,
  CILogFetchError,
  CILogParseError,
  CILogsNotAvailableError,
  FixApplicationError,
  LintFixError,
  TypeFixError,
  TestFixError,
  BuildFixError,
  VerificationError,
  VerificationTimeoutError,
  MaxDelegationsExceededError,
  HandoffCreationError,
  EscalationRequiredError,
  EscalationError,
  GitOperationError,
  CommitError,
  PushError,
  CIWaitTimeoutError,
  CIStillFailingError,
  SecurityVulnerabilityError,
  ResultPersistenceError,
} from '../../src/ci-fixer/errors.js';

describe('CI Fixer Errors', () => {
  describe('CIFixerError', () => {
    it('should create error with message and code', () => {
      const error = new CIFixerError('Test error', 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('CIFixerError');
    });

    it('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = new CIFixerError('Test error', 'TEST_ERROR', cause);
      expect(error.cause).toBe(cause);
    });

    it('should be instanceof Error', () => {
      const error = new CIFixerError('Test error', 'TEST_ERROR');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof CIFixerError).toBe(true);
    });
  });

  describe('HandoffNotFoundError', () => {
    it('should create error with handoff path', () => {
      const error = new HandoffNotFoundError('/path/to/handoff.yaml');
      expect(error.handoffPath).toBe('/path/to/handoff.yaml');
      expect(error.code).toBe('HANDOFF_NOT_FOUND');
      expect(error.message).toContain('/path/to/handoff.yaml');
    });
  });

  describe('HandoffParseError', () => {
    it('should create error with handoff path and cause', () => {
      const cause = new Error('YAML parse error');
      const error = new HandoffParseError('/path/to/handoff.yaml', cause);
      expect(error.handoffPath).toBe('/path/to/handoff.yaml');
      expect(error.code).toBe('HANDOFF_PARSE_ERROR');
      expect(error.cause).toBe(cause);
    });
  });

  describe('HandoffValidationError', () => {
    it('should create error with field and reason', () => {
      const error = new HandoffValidationError('prNumber', 'must be positive');
      expect(error.field).toBe('prNumber');
      expect(error.code).toBe('HANDOFF_VALIDATION_ERROR');
      expect(error.message).toContain('prNumber');
      expect(error.message).toContain('must be positive');
    });
  });

  describe('CILogFetchError', () => {
    it('should create error with run ID', () => {
      const error = new CILogFetchError(12345);
      expect(error.runId).toBe(12345);
      expect(error.code).toBe('CI_LOG_FETCH_ERROR');
      expect(error.message).toContain('12345');
    });
  });

  describe('CILogParseError', () => {
    it('should create error with reason', () => {
      const error = new CILogParseError('Invalid log format');
      expect(error.code).toBe('CI_LOG_PARSE_ERROR');
      expect(error.message).toContain('Invalid log format');
    });
  });

  describe('CILogsNotAvailableError', () => {
    it('should create error with PR number', () => {
      const error = new CILogsNotAvailableError(123);
      expect(error.prNumber).toBe(123);
      expect(error.code).toBe('CI_LOGS_NOT_AVAILABLE');
      expect(error.message).toContain('#123');
    });
  });

  describe('FixApplicationError', () => {
    it('should create error with fix type and file', () => {
      const error = new FixApplicationError('lint', 'src/index.ts');
      expect(error.fixType).toBe('lint');
      expect(error.file).toBe('src/index.ts');
      expect(error.code).toBe('FIX_APPLICATION_ERROR');
    });
  });

  describe('LintFixError', () => {
    it('should create error with exit code and output', () => {
      const error = new LintFixError(1, 'ESLint failed');
      expect(error.exitCode).toBe(1);
      expect(error.output).toBe('ESLint failed');
      expect(error.code).toBe('LINT_FIX_ERROR');
    });
  });

  describe('TypeFixError', () => {
    it('should create error with file and line', () => {
      const error = new TypeFixError('src/index.ts', 42, 'Type mismatch');
      expect(error.file).toBe('src/index.ts');
      expect(error.line).toBe(42);
      expect(error.code).toBe('TYPE_FIX_ERROR');
    });
  });

  describe('TestFixError', () => {
    it('should create error with test file and name', () => {
      const error = new TestFixError('src/index.test.ts', 'should work', 'Assertion failed');
      expect(error.testFile).toBe('src/index.test.ts');
      expect(error.testName).toBe('should work');
      expect(error.code).toBe('TEST_FIX_ERROR');
    });
  });

  describe('BuildFixError', () => {
    it('should create error with build error message', () => {
      const error = new BuildFixError('Module not found');
      expect(error.buildError).toBe('Module not found');
      expect(error.code).toBe('BUILD_FIX_ERROR');
    });
  });

  describe('VerificationError', () => {
    it('should create error with failed checks', () => {
      const error = new VerificationError(['lint', 'test']);
      expect(error.failedChecks).toEqual(['lint', 'test']);
      expect(error.code).toBe('VERIFICATION_ERROR');
    });
  });

  describe('VerificationTimeoutError', () => {
    it('should create error with check name and timeout', () => {
      const error = new VerificationTimeoutError('test', 60000);
      expect(error.check).toBe('test');
      expect(error.timeoutMs).toBe(60000);
      expect(error.code).toBe('VERIFICATION_TIMEOUT');
    });
  });

  describe('MaxDelegationsExceededError', () => {
    it('should create error with delegation counts', () => {
      const error = new MaxDelegationsExceededError(3, 4);
      expect(error.maxDelegations).toBe(3);
      expect(error.currentDelegation).toBe(4);
      expect(error.code).toBe('MAX_DELEGATIONS_EXCEEDED');
    });
  });

  describe('HandoffCreationError', () => {
    it('should create error with PR number', () => {
      const error = new HandoffCreationError(123);
      expect(error.prNumber).toBe(123);
      expect(error.code).toBe('HANDOFF_CREATION_ERROR');
    });
  });

  describe('EscalationRequiredError', () => {
    it('should create error with PR number and reason', () => {
      const error = new EscalationRequiredError(123, 'max_attempts_reached', 'Too many attempts');
      expect(error.prNumber).toBe(123);
      expect(error.reason).toBe('max_attempts_reached');
      expect(error.code).toBe('ESCALATION_REQUIRED');
    });
  });

  describe('EscalationError', () => {
    it('should create error with PR number', () => {
      const error = new EscalationError(123);
      expect(error.prNumber).toBe(123);
      expect(error.code).toBe('ESCALATION_ERROR');
    });
  });

  describe('GitOperationError', () => {
    it('should create error with operation name', () => {
      const error = new GitOperationError('checkout');
      expect(error.operation).toBe('checkout');
      expect(error.code).toBe('GIT_OPERATION_ERROR');
    });
  });

  describe('CommitError', () => {
    it('should create error with branch name', () => {
      const error = new CommitError('feature/test');
      expect(error.branch).toBe('feature/test');
      expect(error.code).toBe('COMMIT_ERROR');
    });
  });

  describe('PushError', () => {
    it('should create error with branch name', () => {
      const error = new PushError('feature/test');
      expect(error.branch).toBe('feature/test');
      expect(error.code).toBe('PUSH_ERROR');
    });
  });

  describe('CIWaitTimeoutError', () => {
    it('should create error with PR number and timeout', () => {
      const error = new CIWaitTimeoutError(123, 600000);
      expect(error.prNumber).toBe(123);
      expect(error.timeoutMs).toBe(600000);
      expect(error.code).toBe('CI_WAIT_TIMEOUT');
    });
  });

  describe('CIStillFailingError', () => {
    it('should create error with PR number and failed checks', () => {
      const error = new CIStillFailingError(123, ['build', 'test']);
      expect(error.prNumber).toBe(123);
      expect(error.failedChecks).toEqual(['build', 'test']);
      expect(error.code).toBe('CI_STILL_FAILING');
    });
  });

  describe('SecurityVulnerabilityError', () => {
    it('should create error with vulnerability type and severity', () => {
      const error = new SecurityVulnerabilityError('SQL Injection', 'critical');
      expect(error.vulnerabilityType).toBe('SQL Injection');
      expect(error.severity).toBe('critical');
      expect(error.code).toBe('SECURITY_VULNERABILITY');
    });
  });

  describe('ResultPersistenceError', () => {
    it('should create error with result path', () => {
      const error = new ResultPersistenceError('/path/to/result.yaml');
      expect(error.resultPath).toBe('/path/to/result.yaml');
      expect(error.code).toBe('RESULT_PERSISTENCE_ERROR');
    });
  });
});
