/**
 * Worker module error definitions
 *
 * Custom error classes for Worker Agent operations including
 * code generation, testing, and verification.
 * All errors extend AppError for standardized error handling.
 *
 * @module worker/errors
 */

import { AppError, ErrorCodes, ErrorSeverity, ErrorHandler } from '../errors/index.js';
import type { ErrorCategory, AppErrorOptions } from '../errors/index.js';
import type { WorkerErrorInfo } from './types.js';

/**
 * Base error class for worker errors
 */
export class WorkerError extends AppError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.MEDIUM,
      category: options.category ?? 'recoverable',
      ...options,
    });
    this.name = 'WorkerError';
  }
}

/**
 * Error thrown when work order parsing fails
 */
export class WorkOrderParseError extends WorkerError {
  /** The work order ID that failed to parse */
  public readonly orderId: string;

  constructor(orderId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { orderId },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR,
      `Failed to parse work order ${orderId}${causeMessage}`,
      options
    );
    this.name = 'WorkOrderParseError';
    this.orderId = orderId;
  }
}

/**
 * Error thrown when context analysis fails
 */
export class ContextAnalysisError extends WorkerError {
  /** The issue ID being analyzed */
  public readonly issueId: string;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { issueId },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_CONTEXT_ANALYSIS_ERROR,
      `Failed to analyze context for issue ${issueId}${causeMessage}`,
      options
    );
    this.name = 'ContextAnalysisError';
    this.issueId = issueId;
  }
}

/**
 * Error thrown when file reading fails
 */
export class FileReadError extends WorkerError {
  /** The file path that failed to read */
  public readonly filePath: string;

  constructor(filePath: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { filePath },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_FILE_READ_ERROR,
      `Failed to read file ${filePath}${causeMessage}`,
      options
    );
    this.name = 'FileReadError';
    this.filePath = filePath;
  }
}

/**
 * Error thrown when file writing fails
 */
export class FileWriteError extends WorkerError {
  /** The file path that failed to write */
  public readonly filePath: string;

  constructor(filePath: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { filePath },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_FILE_WRITE_ERROR,
      `Failed to write file ${filePath}${causeMessage}`,
      options
    );
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}

/**
 * Error thrown when branch creation fails
 */
export class BranchCreationError extends WorkerError {
  /** The branch name that failed to create */
  public readonly branchName: string;

  constructor(branchName: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { branchName },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_BRANCH_CREATION_ERROR,
      `Failed to create branch ${branchName}${causeMessage}`,
      options
    );
    this.name = 'BranchCreationError';
    this.branchName = branchName;
  }
}

/**
 * Error thrown when branch already exists
 */
export class BranchExistsError extends WorkerError {
  /** The branch name that already exists */
  public readonly branchName: string;

  constructor(branchName: string) {
    super(ErrorCodes.WRK_BRANCH_EXISTS, `Branch already exists: ${branchName}`, {
      context: { branchName },
      severity: ErrorSeverity.LOW,
      category: 'recoverable',
    });
    this.name = 'BranchExistsError';
    this.branchName = branchName;
  }
}

/**
 * Error thrown when commit fails
 */
export class CommitError extends WorkerError {
  /** The commit message */
  public readonly commitMessage: string;

  constructor(commitMessage: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { commitMessage },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(ErrorCodes.WRK_COMMIT_ERROR, `Failed to commit changes${causeMessage}`, options);
    this.name = 'CommitError';
    this.commitMessage = commitMessage;
  }
}

/**
 * Error thrown when code generation fails
 */
export class CodeGenerationError extends WorkerError {
  /** The issue ID that failed */
  public readonly issueId: string;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { issueId },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_CODE_GENERATION_ERROR,
      `Failed to generate code for issue ${issueId}${causeMessage}`,
      options
    );
    this.name = 'CodeGenerationError';
    this.issueId = issueId;
  }
}

/**
 * Error thrown when test generation fails
 */
export class TestGenerationError extends WorkerError {
  /** The issue ID that failed */
  public readonly issueId: string;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { issueId },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_TEST_GENERATION_ERROR,
      `Failed to generate tests for issue ${issueId}${causeMessage}`,
      options
    );
    this.name = 'TestGenerationError';
    this.issueId = issueId;
  }
}

/**
 * Error thrown when verification fails
 */
export class VerificationError extends WorkerError {
  /** The verification type that failed */
  public readonly verificationType: 'test' | 'lint' | 'build';
  /** The verification output */
  public readonly output: string;

  constructor(verificationType: 'test' | 'lint' | 'build', output: string, cause?: Error) {
    const options: AppErrorOptions = {
      context: { verificationType, output: output.slice(0, 500) },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_VERIFICATION_ERROR,
      `${verificationType} verification failed: ${output.slice(0, 200)}`,
      options
    );
    this.name = 'VerificationError';
    this.verificationType = verificationType;
    this.output = output;
  }
}

/**
 * Error thrown when max retries exceeded
 */
export class MaxRetriesExceededError extends WorkerError {
  /** The issue ID that exceeded max retries */
  public readonly issueId: string;
  /** The number of attempts made */
  public readonly attempts: number;
  /** The last error encountered */
  public readonly lastError: Error | undefined;

  constructor(issueId: string, attempts: number, lastError?: Error) {
    const lastErrorMessage = lastError !== undefined ? `: ${lastError.message}` : '';
    const options: AppErrorOptions = {
      context: { issueId, attempts },
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
    };
    if (lastError !== undefined) {
      options.cause = lastError;
    }
    super(
      ErrorCodes.WRK_MAX_RETRIES_EXCEEDED,
      `Max retries (${String(attempts)}) exceeded for issue ${issueId}${lastErrorMessage}`,
      options
    );
    this.name = 'MaxRetriesExceededError';
    this.issueId = issueId;
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Error thrown when implementation is blocked
 */
export class ImplementationBlockedError extends WorkerError {
  /** The issue ID that is blocked */
  public readonly issueId: string;
  /** The blockers */
  public readonly blockers: readonly string[];

  constructor(issueId: string, blockers: readonly string[]) {
    super(
      ErrorCodes.WRK_IMPLEMENTATION_BLOCKED,
      `Implementation blocked for issue ${issueId}: ${blockers.join(', ')}`,
      {
        context: { issueId, blockers, blockerCount: blockers.length },
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
      }
    );
    this.name = 'ImplementationBlockedError';
    this.issueId = issueId;
    this.blockers = blockers;
  }
}

/**
 * Error thrown when result persistence fails
 */
export class ResultPersistenceError extends WorkerError {
  /** The work order ID */
  public readonly orderId: string;
  /** The operation that failed */
  public readonly operation: 'save' | 'load';

  constructor(orderId: string, operation: 'save' | 'load', cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { orderId, operation },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_RESULT_PERSISTENCE_ERROR,
      `Failed to ${operation} result for work order ${orderId}${causeMessage}`,
      options
    );
    this.name = 'ResultPersistenceError';
    this.orderId = orderId;
    this.operation = operation;
  }
}

/**
 * Error thrown when git operation fails
 */
export class GitOperationError extends WorkerError {
  /** The git operation that failed */
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
      ErrorCodes.WRK_GIT_OPERATION_ERROR,
      `Git operation failed: ${operation}${causeMessage}`,
      options
    );
    this.name = 'GitOperationError';
    this.operation = operation;
  }
}

/**
 * Error thrown when command execution fails
 */
export class CommandExecutionError extends WorkerError {
  /** The command that failed */
  public readonly command: string;
  /** The exit code */
  public readonly exitCode: number | undefined;
  /** The stderr output */
  public readonly stderr: string;

  constructor(command: string, exitCode: number | undefined, stderr: string, cause?: Error) {
    const exitCodeMessage = exitCode !== undefined ? ` (exit code: ${String(exitCode)})` : '';
    const options: AppErrorOptions = {
      context: { command, stderr: stderr.slice(0, 500) },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (exitCode !== undefined) {
      options.context = { ...options.context, exitCode };
    }
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_COMMAND_EXECUTION_ERROR,
      `Command failed: ${command}${exitCodeMessage}`,
      options
    );
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

// ============================================================================
// Self-Verification Errors (UC-013)
// ============================================================================

/**
 * Error thrown when type checking fails
 */
export class TypeCheckError extends WorkerError {
  /** Number of type errors found */
  public readonly errorCount: number;
  /** The type check output */
  public readonly output: string;

  constructor(errorCount: number, output: string, cause?: Error) {
    const options: AppErrorOptions = {
      context: { errorCount, output: output.slice(0, 500) },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_TYPE_CHECK_ERROR,
      `Type check failed with ${String(errorCount)} error(s)`,
      options
    );
    this.name = 'TypeCheckError';
    this.errorCount = errorCount;
    this.output = output;
  }
}

/**
 * Error thrown when self-fix attempt fails
 */
export class SelfFixError extends WorkerError {
  /** The step that was being fixed */
  public readonly step: string;
  /** The iteration number */
  public readonly iteration: number;
  /** The fix that was attempted */
  public readonly attemptedFix: string;

  constructor(step: string, iteration: number, attemptedFix: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { step, iteration, attemptedFix: attemptedFix.slice(0, 200) },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_SELF_FIX_ERROR,
      `Self-fix failed for ${step} on iteration ${String(iteration)}${causeMessage}`,
      options
    );
    this.name = 'SelfFixError';
    this.step = step;
    this.iteration = iteration;
    this.attemptedFix = attemptedFix;
  }
}

/**
 * Error thrown when escalation is required due to unresolvable issues
 */
export class EscalationRequiredError extends WorkerError {
  /** The task ID that requires escalation */
  public readonly taskId: string;
  /** Failed verification steps */
  public readonly failedSteps: readonly string[];
  /** Total fix attempts made */
  public readonly totalAttempts: number;
  /** Error logs from failed steps */
  public readonly errorLogs: readonly string[];
  /** Analysis of the failures */
  public readonly analysis: string;

  constructor(
    taskId: string,
    failedSteps: readonly string[],
    totalAttempts: number,
    errorLogs: readonly string[],
    analysis: string
  ) {
    super(
      ErrorCodes.WRK_ESCALATION_REQUIRED,
      `Escalation required for task ${taskId}: ` +
        `${String(failedSteps.length)} step(s) failed after ${String(totalAttempts)} fix attempt(s)`,
      {
        context: {
          taskId,
          failedSteps,
          totalAttempts,
          errorLogCount: errorLogs.length,
          analysis: analysis.slice(0, 500),
        },
        severity: ErrorSeverity.CRITICAL,
        category: 'fatal',
      }
    );
    this.name = 'EscalationRequiredError';
    this.taskId = taskId;
    this.failedSteps = failedSteps;
    this.totalAttempts = totalAttempts;
    this.errorLogs = errorLogs;
    this.analysis = analysis;
  }
}

/**
 * Error thrown when verification pipeline fails
 */
export class VerificationPipelineError extends WorkerError {
  /** The step that caused the failure */
  public readonly failedStep: string;
  /** Exit code from the failed step */
  public readonly exitCode: number;
  /** Output from the failed step */
  public readonly output: string;

  constructor(failedStep: string, exitCode: number, output: string, cause?: Error) {
    const options: AppErrorOptions = {
      context: { failedStep, exitCode, output: output.slice(0, 500) },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.WRK_VERIFICATION_PIPELINE_ERROR,
      `Verification pipeline failed at ${failedStep} (exit code: ${String(exitCode)})`,
      options
    );
    this.name = 'VerificationPipelineError';
    this.failedStep = failedStep;
    this.exitCode = exitCode;
    this.output = output;
  }
}

/**
 * Error thrown when command times out
 */
export class CommandTimeoutError extends WorkerError {
  /** The command that timed out */
  public readonly command: string;
  /** The timeout duration in milliseconds */
  public readonly timeoutMs: number;

  constructor(command: string, timeoutMs: number) {
    super(
      ErrorCodes.WRK_COMMAND_TIMEOUT,
      `Command timed out after ${String(timeoutMs)}ms: ${command}`,
      {
        context: { command, timeoutMs },
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
      }
    );
    this.name = 'CommandTimeoutError';
    this.command = command;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when operation times out
 */
export class OperationTimeoutError extends WorkerError {
  /** The operation that timed out */
  public readonly operation: string;
  /** The timeout duration in milliseconds */
  public readonly timeoutMs: number;
  /** The task ID */
  public readonly taskId: string;

  constructor(taskId: string, operation: string, timeoutMs: number) {
    super(
      ErrorCodes.WRK_OPERATION_TIMEOUT,
      `Operation "${operation}" timed out after ${String(timeoutMs)}ms for task ${taskId}`,
      {
        context: { taskId, operation, timeoutMs },
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
      }
    );
    this.name = 'OperationTimeoutError';
    this.taskId = taskId;
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

// ============================================================================
// Error Categorization (Issue #48)
// ============================================================================

/**
 * Error code mappings for categorization (for legacy non-AppError errors)
 */
const ERROR_CATEGORY_MAP: Record<string, ErrorCategory> = {
  // Transient errors - retry with backoff
  ECONNRESET: 'transient',
  ECONNREFUSED: 'transient',
  ETIMEDOUT: 'transient',
  ENOTFOUND: 'transient',
  EAI_AGAIN: 'transient',
  RATE_LIMITED: 'transient',
  SERVICE_UNAVAILABLE: 'transient',
  GATEWAY_TIMEOUT: 'transient',
  CommandTimeoutError: 'transient',

  // Recoverable errors - attempt self-fix then retry
  VerificationError: 'recoverable',
  TypeCheckError: 'recoverable',
  TestGenerationError: 'recoverable',
  SelfFixError: 'recoverable',

  // Fatal errors - immediate escalation
  ImplementationBlockedError: 'fatal',
  EscalationRequiredError: 'fatal',
  EACCES: 'fatal',
  EPERM: 'fatal',
  ENOENT: 'fatal',
  MODULE_NOT_FOUND: 'fatal',
  MISSING_DEPENDENCY: 'fatal',
} as const;

/**
 * Categorize an error for retry decision
 * @param error - The error to categorize
 * @returns The error category
 */
export function categorizeError(error: Error): ErrorCategory {
  // AppError already has category
  if (error instanceof AppError) {
    return error.category;
  }

  // Check error name first
  if (error.name in ERROR_CATEGORY_MAP) {
    const category = ERROR_CATEGORY_MAP[error.name];
    if (category !== undefined) {
      return category;
    }
  }

  // Check for specific error types
  if (error instanceof ImplementationBlockedError) {
    return 'fatal';
  }
  if (error instanceof EscalationRequiredError) {
    return 'fatal';
  }
  if (error instanceof VerificationError) {
    return 'recoverable';
  }
  if (error instanceof TypeCheckError) {
    return 'recoverable';
  }
  if (error instanceof CommandTimeoutError) {
    return 'transient';
  }
  if (error instanceof OperationTimeoutError) {
    return 'transient';
  }

  // Check for Node.js system error codes
  const nodeError = error as { code?: string };
  if (typeof nodeError.code === 'string' && nodeError.code in ERROR_CATEGORY_MAP) {
    const category = ERROR_CATEGORY_MAP[nodeError.code];
    if (category !== undefined) {
      return category;
    }
  }

  // Check message patterns for common errors
  const message = error.message.toLowerCase();
  if (
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('network')
  ) {
    return 'transient';
  }
  if (
    message.includes('permission denied') ||
    message.includes('not found') ||
    message.includes('missing dependency')
  ) {
    return 'fatal';
  }
  if (
    message.includes('test failed') ||
    message.includes('lint error') ||
    message.includes('build failed')
  ) {
    return 'recoverable';
  }

  // Default to transient for unknown errors (will retry)
  return 'transient';
}

/**
 * Generate suggested action based on error category and type
 * @param error - The error to analyze
 * @param category - The error category
 * @returns Suggested action string
 */
export function getSuggestedAction(error: Error, category: ErrorCategory): string {
  switch (category) {
    case 'transient':
      return 'Retry with exponential backoff. Check network connectivity if issue persists.';
    case 'recoverable':
      if (error instanceof VerificationError) {
        switch (error.verificationType) {
          case 'test':
            return 'Review test failures and fix implementation. Check test assertions and mock setup.';
          case 'lint':
            return 'Run lint --fix to auto-correct issues. Review remaining lint errors manually.';
          case 'build':
            return 'Check compilation errors. Ensure all dependencies are installed and types are correct.';
        }
      }
      if (error instanceof TypeCheckError) {
        return 'Review TypeScript errors. Check type definitions and imports.';
      }
      return 'Attempt automatic fix, then retry. If fix fails, escalate to Controller.';
    case 'fatal':
      if (error instanceof ImplementationBlockedError) {
        return `Resolve blockers: ${error.blockers.join(', ')}. Escalate to Controller for assistance.`;
      }
      return 'Escalate to Controller immediately. Manual intervention required.';
    default:
      return 'Unknown error. Review logs and escalate if necessary.';
  }
}

/**
 * Create extended worker error information from an error
 * @param error - The error to convert
 * @param additionalContext - Additional context to include
 * @returns WorkerErrorInfo object
 */
export function createWorkerErrorInfo(
  error: Error,
  additionalContext: Record<string, unknown> = {}
): WorkerErrorInfo {
  // Use ErrorHandler for consistent error info creation
  const errorInfo = ErrorHandler.createErrorInfo(error, additionalContext);

  const result: WorkerErrorInfo = {
    category: errorInfo.category,
    code: errorInfo.code,
    message: errorInfo.message,
    context: errorInfo.context as Record<string, unknown>,
    retryable: errorInfo.retryable,
    suggestedAction: errorInfo.suggestedAction,
  };

  if (errorInfo.stackTrace !== undefined) {
    return { ...result, stackTrace: errorInfo.stackTrace };
  }

  return result;
}

/**
 * Check if an error is retryable based on its category
 * @param error - The error to check
 * @returns Whether the error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isRetryable();
  }
  const category = categorizeError(error);
  return category !== 'fatal';
}

/**
 * Check if an error requires immediate escalation
 * @param error - The error to check
 * @returns Whether escalation is required
 */
export function requiresEscalation(error: Error): boolean {
  if (error instanceof AppError) {
    return error.requiresEscalation();
  }
  return categorizeError(error) === 'fatal';
}
