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
    super(`Max retries (${attempts}) exceeded for issue ${issueId}${lastErrorMessage}`);
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
    const exitCodeMessage = exitCode !== undefined ? ` (exit code: ${exitCode})` : '';
    super(`Command failed: ${command}${exitCodeMessage}`);
    this.name = 'CommandExecutionError';
    this.command = command;
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.cause = cause;
  }
}
