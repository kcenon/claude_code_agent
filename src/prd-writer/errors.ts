/**
 * PRD Writer Agent module error definitions
 *
 * Custom error classes for PRD generation and validation operations.
 */

/**
 * Base error class for PRD writer agent errors
 */
export class PRDWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PRDWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when collected info is not found
 */
export class CollectedInfoNotFoundError extends PRDWriterError {
  /** The project ID that was not found */
  public readonly projectId: string;
  /** The path that was searched */
  public readonly searchedPath: string;

  constructor(projectId: string, searchedPath: string) {
    super(`Collected info not found for project "${projectId}" at path: ${searchedPath}`);
    this.name = 'CollectedInfoNotFoundError';
    this.projectId = projectId;
    this.searchedPath = searchedPath;
  }
}

/**
 * Error thrown when the PRD template is not found
 */
export class TemplateNotFoundError extends PRDWriterError {
  /** The template path that was not found */
  public readonly templatePath: string;

  constructor(templatePath: string) {
    super(`PRD template not found at: ${templatePath}`);
    this.name = 'TemplateNotFoundError';
    this.templatePath = templatePath;
  }
}

/**
 * Error thrown when template processing fails
 */
export class TemplateProcessingError extends PRDWriterError {
  /** The phase where processing failed */
  public readonly phase: string;
  /** Missing variables if any */
  public readonly missingVariables: readonly string[] | undefined;

  constructor(phase: string, reason: string, missingVariables?: readonly string[] | undefined) {
    const varInfo =
      missingVariables !== undefined && missingVariables.length > 0
        ? ` Missing variables: ${missingVariables.join(', ')}`
        : '';
    super(`Template processing failed at "${phase}": ${reason}${varInfo}`);
    this.name = 'TemplateProcessingError';
    this.phase = phase;
    this.missingVariables = missingVariables;
  }
}

/**
 * Error thrown when gap analysis finds critical gaps
 */
export class CriticalGapsError extends PRDWriterError {
  /** Number of critical gaps found */
  public readonly criticalGapCount: number;
  /** Brief descriptions of critical gaps */
  public readonly gapDescriptions: readonly string[];

  constructor(criticalGapCount: number, gapDescriptions: readonly string[]) {
    super(
      `PRD generation blocked: ${String(criticalGapCount)} critical gaps found. ` +
        `Gaps: ${gapDescriptions.slice(0, 3).join('; ')}${criticalGapCount > 3 ? '...' : ''}`
    );
    this.name = 'CriticalGapsError';
    this.criticalGapCount = criticalGapCount;
    this.gapDescriptions = gapDescriptions;
  }
}

/**
 * Error thrown when consistency check finds critical issues
 */
export class ConsistencyError extends PRDWriterError {
  /** Number of consistency issues found */
  public readonly issueCount: number;
  /** Brief descriptions of issues */
  public readonly issueDescriptions: readonly string[];

  constructor(issueCount: number, issueDescriptions: readonly string[]) {
    super(
      `PRD consistency check failed: ${String(issueCount)} issues found. ` +
        `Issues: ${issueDescriptions.slice(0, 3).join('; ')}${issueCount > 3 ? '...' : ''}`
    );
    this.name = 'ConsistencyError';
    this.issueCount = issueCount;
    this.issueDescriptions = issueDescriptions;
  }
}

/**
 * Error thrown when a session is in an invalid state
 */
export class SessionStateError extends PRDWriterError {
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
 * Error thrown when collected info validation fails
 */
export class ValidationError extends PRDWriterError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Collected info validation failed: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when PRD generation fails
 */
export class GenerationError extends PRDWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`PRD generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when file write operation fails
 */
export class FileWriteError extends PRDWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write PRD to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}
