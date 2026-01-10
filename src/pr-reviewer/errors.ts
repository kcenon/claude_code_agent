/**
 * PR Reviewer module error classes
 *
 * Defines error hierarchy for PR creation, review, and quality gate failures.
 * All errors extend AppError for standardized error handling.
 *
 * @module pr-reviewer/errors
 */

import { AppError, ErrorCodes, ErrorSeverity } from '../errors/index.js';
import type { AppErrorOptions } from '../errors/index.js';

/**
 * Base error class for PR Reviewer operations
 */
export class PRReviewerError extends AppError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.MEDIUM,
      category: options.category ?? 'recoverable',
      ...options,
    });
    this.name = 'PRReviewerError';
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
      ErrorCodes.PRR_IMPLEMENTATION_NOT_FOUND,
      `Implementation result not found for work order "${workOrderId}" at path: ${path}`,
      {
        context: { workOrderId, path },
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
      }
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { filePath },
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_IMPLEMENTATION_PARSE_ERROR,
      `Failed to parse implementation result at: ${filePath}${causeMessage}`,
      options
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { branch },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_CREATION_ERROR,
      `Failed to create pull request for branch: ${branch}${causeMessage}`,
      options
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
      ErrorCodes.PRR_ALREADY_EXISTS,
      `Pull request already exists for branch "${branch}": PR #${String(existingPRNumber)}`,
      {
        context: { branch, existingPRNumber },
        severity: ErrorSeverity.LOW,
        category: 'recoverable',
      }
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
    super(ErrorCodes.PRR_NOT_FOUND, `Pull request #${String(prNumber)} not found`, {
      context: { prNumber },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    });
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
    const options: AppErrorOptions = {
      context: { prNumber, reason },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_MERGE_ERROR,
      `Failed to merge PR #${String(prNumber)}: ${reason}`,
      options
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { prNumber },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_CLOSE_ERROR,
      `Failed to close PR #${String(prNumber)}${causeMessage}`,
      options
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { prNumber },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_SUBMISSION_ERROR,
      `Failed to submit review for PR #${String(prNumber)}${causeMessage}`,
      options
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { prNumber, file, line },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_COMMENT_ERROR,
      `Failed to add review comment on PR #${String(prNumber)} at ${file}:${String(line)}${causeMessage}`,
      options
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
      ErrorCodes.PRR_CI_TIMEOUT,
      `CI checks timed out for PR #${String(prNumber)} after ${String(timeoutMs)}ms`,
      {
        context: { prNumber, timeoutMs },
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
      }
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
      ErrorCodes.PRR_CI_CHECK_FAILED,
      `CI checks failed for PR #${String(prNumber)}: ${failedChecks.join(', ')}`,
      {
        context: { prNumber, failedChecks, checkCount: failedChecks.length },
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
      }
    );
    this.name = 'CICheckFailedError';
    this.prNumber = prNumber;
    this.failedChecks = failedChecks;
  }
}

/**
 * Error when circuit breaker is open and blocking operations
 */
export class CircuitOpenError extends PRReviewerError {
  public readonly lastFailureTime: number;
  public readonly failures: number;

  constructor(failures: number, lastFailureTime: number) {
    super(
      ErrorCodes.PRR_CIRCUIT_OPEN,
      `CI circuit breaker is open after ${String(failures)} consecutive failures`,
      {
        context: { failures, lastFailureTime },
        severity: ErrorSeverity.HIGH,
        category: 'transient',
      }
    );
    this.name = 'CircuitOpenError';
    this.failures = failures;
    this.lastFailureTime = lastFailureTime;
  }
}

/**
 * Error when CI polling exceeds maximum attempts
 */
export class CIMaxPollsExceededError extends PRReviewerError {
  public readonly prNumber: number;
  public readonly pollCount: number;

  constructor(prNumber: number, pollCount: number) {
    super(
      ErrorCodes.PRR_CI_MAX_POLLS,
      `CI polling exceeded maximum attempts (${String(pollCount)}) for PR #${String(prNumber)}`,
      {
        context: { prNumber, pollCount },
        severity: ErrorSeverity.HIGH,
        category: 'transient',
      }
    );
    this.name = 'CIMaxPollsExceededError';
    this.prNumber = prNumber;
    this.pollCount = pollCount;
  }
}

/**
 * Error when a terminal CI failure is detected
 */
export class CITerminalFailureError extends PRReviewerError {
  public readonly prNumber: number;
  public readonly checkName: string;
  public readonly errorMessage?: string;

  constructor(prNumber: number, checkName: string, errorMessage?: string) {
    const messageSuffix =
      errorMessage !== undefined && errorMessage !== '' ? ` - ${errorMessage}` : '';
    const options: AppErrorOptions = {
      context: { prNumber, checkName },
      severity: ErrorSeverity.CRITICAL,
      category: 'fatal',
    };
    if (errorMessage !== undefined) {
      options.context = { ...options.context, errorMessage };
    }
    super(
      ErrorCodes.PRR_CI_TERMINAL_FAILURE,
      `Terminal CI failure detected for PR #${String(prNumber)}: ${checkName}${messageSuffix}`,
      options
    );
    this.name = 'CITerminalFailureError';
    this.prNumber = prNumber;
    this.checkName = checkName;
    if (errorMessage !== undefined) {
      this.errorMessage = errorMessage;
    }
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
      ErrorCodes.PRR_QUALITY_GATE_FAILED,
      `Quality gates failed for PR #${String(prNumber)}: ${failedGates.join(', ')}`,
      {
        context: { prNumber, failedGates, gateCount: failedGates.length },
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
      }
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
      ErrorCodes.PRR_COVERAGE_BELOW_THRESHOLD,
      `Code coverage ${String(actual)}% is below required threshold ${String(required)}%`,
      {
        context: { actual, required, delta: required - actual },
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
      }
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
      ErrorCodes.PRR_SECURITY_VULNERABILITY,
      `Security vulnerabilities found: ${String(criticalCount)} critical, ${String(highCount)} high`,
      {
        context: { criticalCount, highCount, totalCount: criticalCount + highCount },
        severity: ErrorSeverity.CRITICAL,
        category: 'fatal',
      }
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { operation },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_GIT_OPERATION_ERROR,
      `Git operation failed: ${operation}${causeMessage}`,
      options
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
    super(ErrorCodes.PRR_BRANCH_NOT_FOUND, `Branch not found: ${branch}`, {
      context: { branch },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    });
    this.name = 'BranchNotFoundError';
    this.branch = branch;
  }
}

/**
 * Error when branch naming convention is invalid
 */
export class BranchNamingError extends PRReviewerError {
  public readonly branch: string;

  constructor(branch: string, reason: string) {
    super(ErrorCodes.PRR_BRANCH_NAMING_ERROR, `Invalid branch naming: ${branch}. ${reason}`, {
      context: { branch, reason },
      severity: ErrorSeverity.LOW,
      category: 'fatal',
    });
    this.name = 'BranchNamingError';
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
      ErrorCodes.PRR_COMMAND_EXECUTION_ERROR,
      `Command failed with exit code ${String(exitCode)}: ${command}`,
      {
        context: { command, exitCode, stderr: stderr.slice(0, 500) },
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
      }
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
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { resultPath },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.PRR_RESULT_PERSISTENCE_ERROR,
      `Failed to persist review result to: ${resultPath}${causeMessage}`,
      options
    );
    this.name = 'ResultPersistenceError';
    this.resultPath = resultPath;
  }
}
