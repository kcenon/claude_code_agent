/**
 * SVP Writer Agent module error definitions
 *
 * Custom error classes for Software Verification Plan generation
 * and validation operations.
 */

/**
 * Base error class for SVP writer agent errors
 */
export class SVPWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SVPWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when the SRS document is not found.
 *
 * The SVP cannot be generated without an SRS to derive test cases from,
 * so this error is fatal for the generation flow.
 */
export class SRSNotFoundError extends SVPWriterError {
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
 * Error thrown when a session is in an invalid state for an operation.
 */
export class SessionStateError extends SVPWriterError {
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
 * Error thrown when SVP generation fails.
 */
export class GenerationError extends SVPWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`SVP generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when a file write operation fails.
 */
export class FileWriteError extends SVPWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write SVP to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}
