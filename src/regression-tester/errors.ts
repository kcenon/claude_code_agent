/**
 * Regression Tester Agent error classes
 *
 * Custom error types for regression testing operations.
 */

/**
 * Base error class for Regression Tester Agent
 */
export class RegressionTesterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegressionTesterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when no tests are found in the project
 */
export class NoTestsFoundError extends RegressionTesterError {
  public readonly projectPath: string;
  public readonly patterns: readonly string[];

  constructor(projectPath: string, patterns: readonly string[]) {
    super(`No test files found in ${projectPath}. Searched patterns: ${patterns.join(', ')}`);
    this.name = 'NoTestsFoundError';
    this.projectPath = projectPath;
    this.patterns = patterns;
  }
}

/**
 * Error thrown when test execution fails
 */
export class TestExecutionFailedError extends RegressionTesterError {
  public readonly testFile: string;
  public readonly reason: string;
  public readonly exitCode: number | undefined;

  constructor(testFile: string, reason: string, exitCode?: number) {
    const exitInfo = exitCode !== undefined ? ` (exit code: ${String(exitCode)})` : '';
    super(`Test execution failed for ${testFile}: ${reason}${exitInfo}`);
    this.name = 'TestExecutionFailedError';
    this.testFile = testFile;
    this.reason = reason;
    this.exitCode = exitCode;
  }
}

/**
 * Error thrown when test framework is not detected
 */
export class TestFrameworkNotDetectedError extends RegressionTesterError {
  public readonly projectPath: string;
  public readonly checkedFiles: readonly string[];

  constructor(projectPath: string, checkedFiles: readonly string[]) {
    super(`No test framework detected in ${projectPath}. Checked: ${checkedFiles.join(', ')}`);
    this.name = 'TestFrameworkNotDetectedError';
    this.projectPath = projectPath;
    this.checkedFiles = checkedFiles;
  }
}

/**
 * Error thrown when coverage calculation fails
 */
export class CoverageCalculationError extends RegressionTesterError {
  public readonly projectPath: string;
  public readonly reason: string;

  constructor(projectPath: string, reason: string) {
    super(`Coverage calculation failed for ${projectPath}: ${reason}`);
    this.name = 'CoverageCalculationError';
    this.projectPath = projectPath;
    this.reason = reason;
  }
}

/**
 * Error thrown when dependency graph is not found
 */
export class DependencyGraphNotFoundError extends RegressionTesterError {
  public readonly expectedPath: string;

  constructor(expectedPath: string) {
    super(`Dependency graph not found at ${expectedPath}. Run Codebase Analyzer first.`);
    this.name = 'DependencyGraphNotFoundError';
    this.expectedPath = expectedPath;
  }
}

/**
 * Error thrown when no changed files are provided
 */
export class NoChangedFilesError extends RegressionTesterError {
  constructor() {
    super('No changed files provided for regression analysis');
    this.name = 'NoChangedFilesError';
  }
}

/**
 * Error thrown when test times out
 */
export class TestTimeoutError extends RegressionTesterError {
  public readonly testFile: string;
  public readonly timeout: number;

  constructor(testFile: string, timeout: number) {
    super(`Test execution timed out for ${testFile} after ${String(timeout)}ms`);
    this.name = 'TestTimeoutError';
    this.testFile = testFile;
    this.timeout = timeout;
  }
}

/**
 * Error thrown when there's no active session
 */
export class NoActiveSessionError extends RegressionTesterError {
  constructor() {
    super('No active regression testing session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when session is in invalid state
 */
export class InvalidSessionStateError extends RegressionTesterError {
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
export class OutputWriteError extends RegressionTesterError {
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
export class FileReadError extends RegressionTesterError {
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
 * Error thrown when project path is invalid
 */
export class InvalidProjectPathError extends RegressionTesterError {
  public readonly path: string;

  constructor(path: string) {
    super(`Invalid project path: ${path}`);
    this.name = 'InvalidProjectPathError';
    this.path = path;
  }
}

/**
 * Error thrown when test mapping fails
 */
export class TestMappingError extends RegressionTesterError {
  public readonly sourceFile: string;
  public readonly reason: string;

  constructor(sourceFile: string, reason: string) {
    super(`Failed to create test mapping for ${sourceFile}: ${reason}`);
    this.name = 'TestMappingError';
    this.sourceFile = sourceFile;
    this.reason = reason;
  }
}

/**
 * Error thrown when max tests limit is exceeded
 */
export class MaxTestsExceededError extends RegressionTesterError {
  public readonly found: number;
  public readonly limit: number;

  constructor(found: number, limit: number) {
    super(
      `Maximum test limit exceeded: found ${found.toLocaleString()} tests, limit is ${limit.toLocaleString()}`
    );
    this.name = 'MaxTestsExceededError';
    this.found = found;
    this.limit = limit;
  }
}
