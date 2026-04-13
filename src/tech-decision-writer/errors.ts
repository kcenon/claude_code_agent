/**
 * Tech Decision Writer Agent module error definitions
 *
 * Custom error classes for Tech Decision document generation and validation.
 */

/**
 * Base error class for Tech Decision writer agent errors
 */
export class TechDecisionWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TechDecisionWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when the SDS document is not found.
 *
 * The Tech Decision Writer relies on the SDS for both the technology stack
 * table and component cross-references, so this error is fatal for the
 * generation flow.
 */
export class SDSNotFoundError extends TechDecisionWriterError {
  /** The project ID that was not found */
  public readonly projectId: string;
  /** The path that was searched */
  public readonly searchedPath: string;

  constructor(projectId: string, searchedPath: string) {
    super(`SDS document not found for project "${projectId}" at path: ${searchedPath}`);
    this.name = 'SDSNotFoundError';
    this.projectId = projectId;
    this.searchedPath = searchedPath;
  }
}

/**
 * Error thrown when a session is in an invalid state for an operation.
 */
export class SessionStateError extends TechDecisionWriterError {
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
 * Error thrown when Tech Decision generation fails.
 */
export class GenerationError extends TechDecisionWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`Tech Decision generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when a file write operation fails.
 */
export class FileWriteError extends TechDecisionWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write Tech Decision document to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}

/**
 * Error thrown when the configured evaluation criteria are invalid.
 *
 * Criteria weights must sum to approximately 1.0 so the weighted totals
 * remain comparable across decisions. The constructor accepts the observed
 * weight sum to provide a helpful diagnostic.
 */
export class InvalidCriteriaError extends TechDecisionWriterError {
  /** Observed total weight across criteria */
  public readonly weightSum: number;

  constructor(weightSum: number) {
    super(
      `Invalid evaluation criteria: weights must sum to 1.0 (observed: ${weightSum.toFixed(3)})`
    );
    this.name = 'InvalidCriteriaError';
    this.weightSum = weightSum;
  }
}
