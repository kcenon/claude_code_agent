/**
 * Codebase Analyzer Agent error classes
 *
 * Custom error types for codebase analysis operations.
 */

/**
 * Base error class for Codebase Analyzer Agent
 */
export class CodebaseAnalyzerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodebaseAnalyzerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when project directory is not found
 */
export class ProjectNotFoundError extends CodebaseAnalyzerError {
  public readonly path: string;

  constructor(path: string) {
    super(`Project directory not found: ${path}`);
    this.name = 'ProjectNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when no source files are found
 */
export class NoSourceFilesError extends CodebaseAnalyzerError {
  public readonly projectPath: string;
  public readonly patterns: readonly string[];

  constructor(projectPath: string, patterns: readonly string[]) {
    super(
      `No source files found in ${projectPath}. Searched patterns: ${patterns.join(', ')}`
    );
    this.name = 'NoSourceFilesError';
    this.projectPath = projectPath;
    this.patterns = patterns;
  }
}

/**
 * Error thrown when a language is not supported for import analysis
 */
export class UnsupportedLanguageError extends CodebaseAnalyzerError {
  public readonly language: string;
  public readonly operation: string;

  constructor(language: string, operation: string) {
    super(`Language '${language}' is not supported for ${operation}`);
    this.name = 'UnsupportedLanguageError';
    this.language = language;
    this.operation = operation;
  }
}

/**
 * Error thrown when build system cannot be detected
 */
export class BuildSystemNotDetectedError extends CodebaseAnalyzerError {
  public readonly projectPath: string;
  public readonly checkedFiles: readonly string[];

  constructor(projectPath: string, checkedFiles: readonly string[]) {
    super(
      `No build system detected in ${projectPath}. Checked: ${checkedFiles.join(', ')}`
    );
    this.name = 'BuildSystemNotDetectedError';
    this.projectPath = projectPath;
    this.checkedFiles = checkedFiles;
  }
}

/**
 * Error thrown when circular dependency is detected
 */
export class CircularDependencyError extends CodebaseAnalyzerError {
  public readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Error thrown when file cannot be parsed for imports
 */
export class ImportParseError extends CodebaseAnalyzerError {
  public readonly filePath: string;
  public readonly line: number | undefined;
  public readonly reason: string;

  constructor(filePath: string, reason: string, line?: number) {
    const lineInfo = line !== undefined ? ` at line ${String(line)}` : '';
    super(`Failed to parse imports in ${filePath}${lineInfo}: ${reason}`);
    this.name = 'ImportParseError';
    this.filePath = filePath;
    this.reason = reason;
    this.line = line;
  }
}

/**
 * Error thrown when file size exceeds limit
 */
export class FileSizeLimitError extends CodebaseAnalyzerError {
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
 * Error thrown when there's no active analysis session
 */
export class NoActiveSessionError extends CodebaseAnalyzerError {
  constructor() {
    super('No active analysis session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when session is in invalid state
 */
export class InvalidSessionStateError extends CodebaseAnalyzerError {
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
 * Error thrown when output cannot be written
 */
export class OutputWriteError extends CodebaseAnalyzerError {
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
 * Error thrown when file read fails
 */
export class FileReadError extends CodebaseAnalyzerError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to read file ${path}: ${reason}`);
    this.name = 'FileReadError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when directory scan fails
 */
export class DirectoryScanError extends CodebaseAnalyzerError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to scan directory ${path}: ${reason}`);
    this.name = 'DirectoryScanError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when maximum file limit is reached
 */
export class MaxFilesExceededError extends CodebaseAnalyzerError {
  public readonly scanned: number;
  public readonly limit: number;

  constructor(scanned: number, limit: number) {
    super(
      `Maximum file limit exceeded: scanned ${scanned.toLocaleString()} files, limit is ${limit.toLocaleString()}`
    );
    this.name = 'MaxFilesExceededError';
    this.scanned = scanned;
    this.limit = limit;
  }
}
