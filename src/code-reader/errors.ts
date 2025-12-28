/**
 * Code Reader Agent error classes
 *
 * Custom error types for source code analysis and processing operations.
 */

/**
 * Base error class for Code Reader Agent
 */
export class CodeReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodeReaderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when source file is not found
 */
export class SourceFileNotFoundError extends CodeReaderError {
  public readonly path: string;

  constructor(path: string) {
    super(`Source file not found: ${path}`);
    this.name = 'SourceFileNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when source directory is not found
 */
export class SourceDirectoryNotFoundError extends CodeReaderError {
  public readonly path: string;

  constructor(path: string) {
    super(`Source directory not found: ${path}`);
    this.name = 'SourceDirectoryNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when TypeScript parsing fails
 */
export class ParseError extends CodeReaderError {
  public readonly path: string;
  public readonly line: number | undefined;
  public readonly column: number | undefined;
  public readonly reason: string;

  constructor(path: string, reason: string, line?: number, column?: number) {
    const locationInfo =
      line !== undefined
        ? ` at line ${String(line)}${column !== undefined ? `:${String(column)}` : ''}`
        : '';
    super(`Failed to parse ${path}${locationInfo}: ${reason}`);
    this.name = 'ParseError';
    this.path = path;
    this.reason = reason;
    this.line = line;
    this.column = column;
  }
}

/**
 * Error thrown when there's no active session
 */
export class NoActiveSessionError extends CodeReaderError {
  constructor() {
    super('No active code reading session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when session is in an invalid state for the operation
 */
export class InvalidSessionStateError extends CodeReaderError {
  public readonly currentStatus: string;
  public readonly expectedStatus: string;
  public readonly operation: string;

  constructor(operation: string, currentStatus: string, expectedStatus: string) {
    super(
      `Cannot perform ${operation}: session status is '${currentStatus}', expected '${expectedStatus}'`
    );
    this.name = 'InvalidSessionStateError';
    this.currentStatus = currentStatus;
    this.expectedStatus = expectedStatus;
    this.operation = operation;
  }
}

/**
 * Error thrown when file size exceeds the limit
 */
export class FileSizeLimitError extends CodeReaderError {
  public readonly path: string;
  public readonly size: number;
  public readonly maxSize: number;

  constructor(path: string, size: number, maxSize: number) {
    super(
      `File ${path} exceeds size limit: ${(size / 1024 / 1024).toFixed(2)}MB > ${(maxSize / 1024 / 1024).toFixed(2)}MB`
    );
    this.name = 'FileSizeLimitError';
    this.path = path;
    this.size = size;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when output cannot be written
 */
export class OutputWriteError extends CodeReaderError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to write output to ${path}: ${reason}`);
    this.name = 'OutputWriteError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when circular dependency is detected at critical level
 */
export class CircularDependencyError extends CodeReaderError {
  public readonly modules: readonly string[];

  constructor(modules: readonly string[]) {
    super(`Critical circular dependency detected: ${modules.join(' -> ')}`);
    this.name = 'CircularDependencyError';
    this.modules = modules;
  }
}

/**
 * Error thrown when too many files fail to parse
 */
export class TooManyParseErrorsError extends CodeReaderError {
  public readonly failedCount: number;
  public readonly totalCount: number;
  public readonly threshold: number;

  constructor(failedCount: number, totalCount: number, threshold: number) {
    const percentage = ((failedCount / totalCount) * 100).toFixed(1);
    super(
      `Too many files failed to parse: ${String(failedCount)}/${String(totalCount)} (${percentage}%) exceeds threshold of ${String(threshold * 100)}%`
    );
    this.name = 'TooManyParseErrorsError';
    this.failedCount = failedCount;
    this.totalCount = totalCount;
    this.threshold = threshold;
  }
}

/**
 * Error thrown when TypeScript project configuration is invalid
 */
export class InvalidTsConfigError extends CodeReaderError {
  public readonly configPath: string;
  public readonly reason: string;

  constructor(configPath: string, reason: string) {
    super(`Invalid TypeScript configuration at ${configPath}: ${reason}`);
    this.name = 'InvalidTsConfigError';
    this.configPath = configPath;
    this.reason = reason;
  }
}
