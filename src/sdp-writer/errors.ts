/**
 * SDP Writer Agent module error definitions
 *
 * Custom error classes for SDP generation and validation operations.
 */

/**
 * Base error class for SDP writer agent errors
 */
export class SDPWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SDPWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when the PRD document is not found
 */
export class PRDNotFoundError extends SDPWriterError {
  /** The project ID that was not found */
  public readonly projectId: string;
  /** The path that was searched */
  public readonly searchedPath: string;

  constructor(projectId: string, searchedPath: string) {
    super(`PRD document not found for project "${projectId}" at path: ${searchedPath}`);
    this.name = 'PRDNotFoundError';
    this.projectId = projectId;
    this.searchedPath = searchedPath;
  }
}

/**
 * Error thrown when the SRS document is not found
 */
export class SRSNotFoundError extends SDPWriterError {
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
export class SessionStateError extends SDPWriterError {
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
 * Error thrown when SDP generation fails
 */
export class GenerationError extends SDPWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`SDP generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when a file write operation fails
 */
export class FileWriteError extends SDPWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write SDP to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}
