/**
 * PR Reviewer module error classes
 *
 * Defines error hierarchy for PR creation, review, and quality gate failures.
 */

/**
 * Base error class for PR Reviewer operations
 */
export class PRReviewerError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'PRReviewerError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Input/Parse Errors
// ============================================================================

/**
 * Error when implementation result file is not found
 */
export class ImplementationResultNotFoundError extends PRReviewerError {
  public readonly workOrderId: string;

  constructor(workOrderId: string, path: string) {
    super(
      `Implementation result not found for work order "${workOrderId}" at path: ${path}`,
      'IMPLEMENTATION_RESULT_NOT_FOUND'
    );
    this.name = 'ImplementationResultNotFoundError';
    this.workOrderId = workOrderId;
  }
}

/**
 * Error when implementation result cannot be parsed
 */
export class ImplementationResultParseError extends PRReviewerError {
  public readonly filePath: string;

  constructor(filePath: string, cause?: Error) {
    super(
      `Failed to parse implementation result at: ${filePath}`,
      'IMPLEMENTATION_RESULT_PARSE_ERROR',
      cause
    );
    this.name = 'ImplementationResultParseError';
    this.filePath = filePath;
  }
}

// ============================================================================
// PR Operation Errors
// ============================================================================

/**
 * Error when PR creation fails
 */
export class PRCreationError extends PRReviewerError {
  public readonly branch: string;

  constructor(branch: string, cause?: Error) {
    super(
      `Failed to create pull request for branch: ${branch}`,
      'PR_CREATION_ERROR',
      cause
    );
    this.name = 'PRCreationError';
    this.branch = branch;
  }
}

/**
 * Error when PR already exists for the branch
 */
export class PRAlreadyExistsError extends PRReviewerError {
  public readonly branch: string;
  public readonly existingPRNumber: number;

  constructor(branch: string, existingPRNumber: number) {
    super(
      `Pull request already exists for branch "${branch}": PR #${String(existingPRNumber)}`,
      'PR_ALREADY_EXISTS'
    );
    this.name = 'PRAlreadyExistsError';
    this.branch = branch;
    this.existingPRNumber = existingPRNumber;
  }
}

/**
 * Error when PR cannot be found
 */
export class PRNotFoundError extends PRReviewerError {
  public readonly prNumber: number;

  constructor(prNumber: number) {
    super(
      `Pull request #${String(prNumber)} not found`,
      'PR_NOT_FOUND'
    );
    this.name = 'PRNotFoundError';
    this.prNumber = prNumber;
  }
}

/**
 * Error when PR merge fails
 */
export class PRMergeError extends PRReviewerError {
  public readonly prNumber: number;

  constructor(prNumber: number, reason: string, cause?: Error) {
    super(
      `Failed to merge PR #${String(prNumber)}: ${reason}`,
      'PR_MERGE_ERROR',
      cause
    );
    this.name = 'PRMergeError';
    this.prNumber = prNumber;
  }
}

/**
 * Error when PR close fails
 */
export class PRCloseError extends PRReviewerError {
  public readonly prNumber: number;

  constructor(prNumber: number, cause?: Error) {
    super(
      `Failed to close PR #${String(prNumber)}`,
      'PR_CLOSE_ERROR',
      cause
    );
    this.name = 'PRCloseError';
    this.prNumber = prNumber;
  }
}

// ============================================================================
// Review Errors
// ============================================================================

/**
 * Error when review submission fails
 */
export class ReviewSubmissionError extends PRReviewerError {
  public readonly prNumber: number;

  constructor(prNumber: number, cause?: Error) {
    super(
      `Failed to submit review for PR #${String(prNumber)}`,
      'REVIEW_SUBMISSION_ERROR',
      cause
    );
    this.name = 'ReviewSubmissionError';
    this.prNumber = prNumber;
  }
}

/**
 * Error when adding review comment fails
 */
export class ReviewCommentError extends PRReviewerError {
  public readonly prNumber: number;
  public readonly file: string;
  public readonly line: number;

  constructor(prNumber: number, file: string, line: number, cause?: Error) {
    super(
      `Failed to add review comment on PR #${String(prNumber)} at ${file}:${String(line)}`,
      'REVIEW_COMMENT_ERROR',
      cause
    );
    this.name = 'ReviewCommentError';
    this.prNumber = prNumber;
    this.file = file;
    this.line = line;
  }
}

// ============================================================================
// CI/CD Errors
// ============================================================================

/**
 * Error when CI checks timeout
 */
export class CITimeoutError extends PRReviewerError {
  public readonly prNumber: number;
  public readonly timeoutMs: number;

  constructor(prNumber: number, timeoutMs: number) {
    super(
      `CI checks timed out for PR #${String(prNumber)} after ${String(timeoutMs)}ms`,
      'CI_TIMEOUT'
    );
    this.name = 'CITimeoutError';
    this.prNumber = prNumber;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error when CI checks fail
 */
export class CICheckFailedError extends PRReviewerError {
  public readonly prNumber: number;
  public readonly failedChecks: readonly string[];

  constructor(prNumber: number, failedChecks: readonly string[]) {
    super(
      `CI checks failed for PR #${String(prNumber)}: ${failedChecks.join(', ')}`,
      'CI_CHECK_FAILED'
    );
    this.name = 'CICheckFailedError';
    this.prNumber = prNumber;
    this.failedChecks = failedChecks;
  }
}

// ============================================================================
// Quality Gate Errors
// ============================================================================

/**
 * Error when quality gates fail
 */
export class QualityGateFailedError extends PRReviewerError {
  public readonly prNumber: number;
  public readonly failedGates: readonly string[];

  constructor(prNumber: number, failedGates: readonly string[]) {
    super(
      `Quality gates failed for PR #${String(prNumber)}: ${failedGates.join(', ')}`,
      'QUALITY_GATE_FAILED'
    );
    this.name = 'QualityGateFailedError';
    this.prNumber = prNumber;
    this.failedGates = failedGates;
  }
}

/**
 * Error when coverage is below threshold
 */
export class CoverageBelowThresholdError extends PRReviewerError {
  public readonly actual: number;
  public readonly required: number;

  constructor(actual: number, required: number) {
    super(
      `Code coverage ${String(actual)}% is below required threshold ${String(required)}%`,
      'COVERAGE_BELOW_THRESHOLD'
    );
    this.name = 'CoverageBelowThresholdError';
    this.actual = actual;
    this.required = required;
  }
}

/**
 * Error when security vulnerabilities are found
 */
export class SecurityVulnerabilityError extends PRReviewerError {
  public readonly criticalCount: number;
  public readonly highCount: number;

  constructor(criticalCount: number, highCount: number) {
    super(
      `Security vulnerabilities found: ${String(criticalCount)} critical, ${String(highCount)} high`,
      'SECURITY_VULNERABILITY'
    );
    this.name = 'SecurityVulnerabilityError';
    this.criticalCount = criticalCount;
    this.highCount = highCount;
  }
}

// ============================================================================
// Git Errors
// ============================================================================

/**
 * Error when git operation fails
 */
export class GitOperationError extends PRReviewerError {
  public readonly operation: string;

  constructor(operation: string, cause?: Error) {
    super(
      `Git operation failed: ${operation}`,
      'GIT_OPERATION_ERROR',
      cause
    );
    this.name = 'GitOperationError';
    this.operation = operation;
  }
}

/**
 * Error when branch does not exist
 */
export class BranchNotFoundError extends PRReviewerError {
  public readonly branch: string;

  constructor(branch: string) {
    super(
      `Branch not found: ${branch}`,
      'BRANCH_NOT_FOUND'
    );
    this.name = 'BranchNotFoundError';
    this.branch = branch;
  }
}

// ============================================================================
// Command Execution Errors
// ============================================================================

/**
 * Error when command execution fails
 */
export class CommandExecutionError extends PRReviewerError {
  public readonly command: string;
  public readonly exitCode: number;
  public readonly stderr: string;

  constructor(command: string, exitCode: number, stderr: string) {
    super(
      `Command failed with exit code ${String(exitCode)}: ${command}`,
      'COMMAND_EXECUTION_ERROR'
    );
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

// ============================================================================
// Persistence Errors
// ============================================================================

/**
 * Error when result persistence fails
 */
export class ResultPersistenceError extends PRReviewerError {
  public readonly resultPath: string;

  constructor(resultPath: string, cause?: Error) {
    super(
      `Failed to persist review result to: ${resultPath}`,
      'RESULT_PERSISTENCE_ERROR',
      cause
    );
    this.name = 'ResultPersistenceError';
    this.resultPath = resultPath;
  }
}
