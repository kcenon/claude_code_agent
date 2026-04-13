/**
 * UI Specification Writer Agent module error definitions
 *
 * Custom error classes for UI spec generation and validation operations.
 */

/**
 * Base error class for UI spec writer agent errors
 */
export class UISpecWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UISpecWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when the SRS document is not found
 */
export class SRSNotFoundError extends UISpecWriterError {
  /** The project ID that was not found */
  public readonly projectId: string;
  /** The path that was searched */
  public readonly searchedPath: string;

  constructor(projectId: string, searchedPath: string) {
    super(`SRS document not found for project "${projectId}" at path: ${searchedPath}`);
    this.name = 'SRSNotFoundError';
    this.projectId = projectId;
    this.searchedPath = searchedPath;
  }
}

/**
 * Error thrown when a session is in an invalid state for an operation
 */
export class SessionStateError extends UISpecWriterError {
  /** Current session state */
  public readonly currentState: string;
  /** Expected state */
  public readonly expectedState: string;

  constructor(currentState: string, expectedState: string, action: string) {
    super(`Cannot ${action}: session is in "${currentState}" state, expected "${expectedState}"`);
    this.name = 'SessionStateError';
    this.currentState = currentState;
    this.expectedState = expectedState;
  }
}

/**
 * Error thrown when UI spec generation fails
 */
export class GenerationError extends UISpecWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`UI spec generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when a file write operation fails
 */
export class FileWriteError extends UISpecWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write UI spec to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}
