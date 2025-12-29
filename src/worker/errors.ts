/**
 * Worker module error definitions
 *
 * Custom error classes for Worker Agent operations including
 * code generation, testing, and verification.
 */

/**
 * Base error class for worker errors
 */
export class WorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when work order parsing fails
 */
export class WorkOrderParseError extends WorkerError {
  /** The work order ID that failed to parse */
  public readonly orderId: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(orderId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to parse work order ${orderId}${causeMessage}`);
    this.name = 'WorkOrderParseError';
    this.orderId = orderId;
    this.cause = cause;
  }
}

/**
 * Error thrown when context analysis fails
 */
export class ContextAnalysisError extends WorkerError {
  /** The issue ID being analyzed */
  public readonly issueId: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to analyze context for issue ${issueId}${causeMessage}`);
    this.name = 'ContextAnalysisError';
    this.issueId = issueId;
    this.cause = cause;
  }
}

/**
 * Error thrown when file reading fails
 */
export class FileReadError extends WorkerError {
  /** The file path that failed to read */
  public readonly filePath: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(filePath: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to read file ${filePath}${causeMessage}`);
    this.name = 'FileReadError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

/**
 * Error thrown when file writing fails
 */
export class FileWriteError extends WorkerError {
  /** The file path that failed to write */
  public readonly filePath: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(filePath: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to write file ${filePath}${causeMessage}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

/**
 * Error thrown when branch creation fails
 */
export class BranchCreationError extends WorkerError {
  /** The branch name that failed to create */
  public readonly branchName: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(branchName: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to create branch ${branchName}${causeMessage}`);
    this.name = 'BranchCreationError';
    this.branchName = branchName;
    this.cause = cause;
  }
}

/**
 * Error thrown when branch already exists
 */
export class BranchExistsError extends WorkerError {
  /** The branch name that already exists */
  public readonly branchName: string;

  constructor(branchName: string) {
    super(`Branch already exists: ${branchName}`);
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(commitMessage: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to commit changes${causeMessage}`);
    this.name = 'CommitError';
    this.commitMessage = commitMessage;
    this.cause = cause;
  }
}

/**
 * Error thrown when code generation fails
 */
export class CodeGenerationError extends WorkerError {
  /** The issue ID that failed */
  public readonly issueId: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to generate code for issue ${issueId}${causeMessage}`);
    this.name = 'CodeGenerationError';
    this.issueId = issueId;
    this.cause = cause;
  }
}

/**
 * Error thrown when test generation fails
 */
export class TestGenerationError extends WorkerError {
  /** The issue ID that failed */
  public readonly issueId: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to generate tests for issue ${issueId}${causeMessage}`);
    this.name = 'TestGenerationError';
    this.issueId = issueId;
    this.cause = cause;
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(verificationType: 'test' | 'lint' | 'build', output: string, cause?: Error) {
    super(`${verificationType} verification failed: ${output.slice(0, 200)}`);
    this.name = 'VerificationError';
    this.verificationType = verificationType;
    this.output = output;
    this.cause = cause;
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
    super(`Max retries (${String(attempts)}) exceeded for issue ${issueId}${lastErrorMessage}`);
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
    super(`Implementation blocked for issue ${issueId}: ${blockers.join(', ')}`);
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(orderId: string, operation: 'save' | 'load', cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to ${operation} result for work order ${orderId}${causeMessage}`);
    this.name = 'ResultPersistenceError';
    this.orderId = orderId;
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Error thrown when git operation fails
 */
export class GitOperationError extends WorkerError {
  /** The git operation that failed */
  public readonly operation: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(operation: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Git operation failed: ${operation}${causeMessage}`);
    this.name = 'GitOperationError';
    this.operation = operation;
    this.cause = cause;
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(command: string, exitCode: number | undefined, stderr: string, cause?: Error) {
    const exitCodeMessage = exitCode !== undefined ? ` (exit code: ${String(exitCode)})` : '';
    super(`Command failed: ${command}${exitCodeMessage}`);
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.cause = cause;
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(errorCount: number, output: string, cause?: Error) {
    super(`Type check failed with ${String(errorCount)} error(s)`);
    this.name = 'TypeCheckError';
    this.errorCount = errorCount;
    this.output = output;
    this.cause = cause;
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(step: string, iteration: number, attemptedFix: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Self-fix failed for ${step} on iteration ${String(iteration)}${causeMessage}`);
    this.name = 'SelfFixError';
    this.step = step;
    this.iteration = iteration;
    this.attemptedFix = attemptedFix;
    this.cause = cause;
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
      `Escalation required for task ${taskId}: ` +
        `${String(failedSteps.length)} step(s) failed after ${String(totalAttempts)} fix attempt(s)`
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
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(failedStep: string, exitCode: number, output: string, cause?: Error) {
    super(`Verification pipeline failed at ${failedStep} (exit code: ${String(exitCode)})`);
    this.name = 'VerificationPipelineError';
    this.failedStep = failedStep;
    this.exitCode = exitCode;
    this.output = output;
    this.cause = cause;
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
    super(`Command timed out after ${String(timeoutMs)}ms: ${command}`);
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
    super(`Operation "${operation}" timed out after ${String(timeoutMs)}ms for task ${taskId}`);
    this.name = 'OperationTimeoutError';
    this.taskId = taskId;
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

// ============================================================================
// Error Categorization (Issue #48)
// ============================================================================

import type { ErrorCategory, WorkerErrorInfo } from './types.js';

/**
 * Error code mappings for categorization
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
  const category = categorizeError(error);
  const categoryPolicy = getCategoryRetryPolicy(category);

  const result: WorkerErrorInfo = {
    category,
    code: getErrorCode(error),
    message: error.message,
    context: {
      ...extractErrorContext(error),
      ...additionalContext,
    },
    retryable: categoryPolicy.retry,
    suggestedAction: getSuggestedAction(error, category),
  };

  // Only set stackTrace if it exists (exactOptionalPropertyTypes)
  if (error.stack !== undefined) {
    return { ...result, stackTrace: error.stack };
  }

  return result;
}

/**
 * Get error code from error
 * @param error - The error to get code from
 * @returns Error code string
 */
function getErrorCode(error: Error): string {
  // Check for explicit error code
  const nodeError = error as { code?: string };
  if (typeof nodeError.code === 'string') {
    return nodeError.code;
  }

  // Use error name as code
  return error.name;
}

/**
 * Extract context from specific error types
 * @param error - The error to extract context from
 * @returns Context object
 */
function extractErrorContext(error: Error): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  if (error instanceof WorkOrderParseError) {
    context.orderId = error.orderId;
  } else if (error instanceof ContextAnalysisError) {
    context.issueId = error.issueId;
  } else if (error instanceof FileReadError || error instanceof FileWriteError) {
    context.filePath = error.filePath;
  } else if (error instanceof BranchCreationError || error instanceof BranchExistsError) {
    context.branchName = error.branchName;
  } else if (error instanceof CommitError) {
    context.commitMessage = error.commitMessage;
  } else if (error instanceof VerificationError) {
    context.verificationType = error.verificationType;
    context.output = error.output.slice(0, 500); // Truncate for context
  } else if (error instanceof MaxRetriesExceededError) {
    context.issueId = error.issueId;
    context.attempts = error.attempts;
  } else if (error instanceof ImplementationBlockedError) {
    context.issueId = error.issueId;
    context.blockers = error.blockers;
  } else if (error instanceof CommandExecutionError) {
    context.command = error.command;
    context.exitCode = error.exitCode;
  } else if (error instanceof TypeCheckError) {
    context.errorCount = error.errorCount;
  } else if (error instanceof EscalationRequiredError) {
    context.taskId = error.taskId;
    context.failedSteps = error.failedSteps;
    context.totalAttempts = error.totalAttempts;
  } else if (error instanceof OperationTimeoutError) {
    context.taskId = error.taskId;
    context.operation = error.operation;
    context.timeoutMs = error.timeoutMs;
  }

  return context;
}

/**
 * Get default retry policy for a category
 * @param category - The error category
 * @returns Category retry policy
 */
function getCategoryRetryPolicy(category: ErrorCategory): { retry: boolean; maxAttempts: number } {
  switch (category) {
    case 'transient':
      return { retry: true, maxAttempts: 3 };
    case 'recoverable':
      return { retry: true, maxAttempts: 3 };
    case 'fatal':
      return { retry: false, maxAttempts: 0 };
    default:
      return { retry: true, maxAttempts: 3 };
  }
}

/**
 * Check if an error is retryable based on its category
 * @param error - The error to check
 * @returns Whether the error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const category = categorizeError(error);
  return category !== 'fatal';
}

/**
 * Check if an error requires immediate escalation
 * @param error - The error to check
 * @returns Whether escalation is required
 */
export function requiresEscalation(error: Error): boolean {
  return categorizeError(error) === 'fatal';
}
