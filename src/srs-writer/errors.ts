/**
 * SRS Writer Agent module error definitions
 *
 * Custom error classes for SRS generation and validation operations.
 */

/**
 * Base error class for SRS writer agent errors
 */
export class SRSWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SRSWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when PRD document is not found
 */
export class PRDNotFoundError extends SRSWriterError {
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
 * Error thrown when PRD parsing fails
 */
export class PRDParseError extends SRSWriterError {
  /** The section where parsing failed */
  public readonly section: string;
  /** Line number if available */
  public readonly lineNumber?: number;

  constructor(section: string, reason: string, lineNumber?: number) {
    const lineInfo = lineNumber !== undefined ? ` at line ${String(lineNumber)}` : '';
    super(`Failed to parse PRD section "${section}"${lineInfo}: ${reason}`);
    this.name = 'PRDParseError';
    this.section = section;
    this.lineNumber = lineNumber;
  }
}

/**
 * Error thrown when the SRS template is not found
 */
export class TemplateNotFoundError extends SRSWriterError {
  /** The template path that was not found */
  public readonly templatePath: string;

  constructor(templatePath: string) {
    super(`SRS template not found at: ${templatePath}`);
    this.name = 'TemplateNotFoundError';
    this.templatePath = templatePath;
  }
}

/**
 * Error thrown when template processing fails
 */
export class TemplateProcessingError extends SRSWriterError {
  /** The phase where processing failed */
  public readonly phase: string;
  /** Missing variables if any */
  public readonly missingVariables: readonly string[] | undefined;

  constructor(phase: string, reason: string, missingVariables?: readonly string[]) {
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
 * Error thrown when feature decomposition fails
 */
export class FeatureDecompositionError extends SRSWriterError {
  /** The requirement that failed decomposition */
  public readonly requirementId: string;

  constructor(requirementId: string, reason: string) {
    super(`Failed to decompose requirement "${requirementId}" into features: ${reason}`);
    this.name = 'FeatureDecompositionError';
    this.requirementId = requirementId;
  }
}

/**
 * Error thrown when use case generation fails
 */
export class UseCaseGenerationError extends SRSWriterError {
  /** The feature for which use case generation failed */
  public readonly featureId: string;

  constructor(featureId: string, reason: string) {
    super(`Failed to generate use cases for feature "${featureId}": ${reason}`);
    this.name = 'UseCaseGenerationError';
    this.featureId = featureId;
  }
}

/**
 * Error thrown when traceability coverage is below threshold
 */
export class LowCoverageError extends SRSWriterError {
  /** Actual coverage percentage */
  public readonly actualCoverage: number;
  /** Required coverage threshold */
  public readonly threshold: number;
  /** Uncovered requirements */
  public readonly uncoveredRequirements: readonly string[];

  constructor(actualCoverage: number, threshold: number, uncoveredRequirements: readonly string[]) {
    super(
      `Traceability coverage ${String(actualCoverage.toFixed(1))}% is below threshold ${String(threshold)}%. ` +
        `Uncovered: ${uncoveredRequirements.slice(0, 5).join(', ')}${uncoveredRequirements.length > 5 ? '...' : ''}`
    );
    this.name = 'LowCoverageError';
    this.actualCoverage = actualCoverage;
    this.threshold = threshold;
    this.uncoveredRequirements = uncoveredRequirements;
  }
}

/**
 * Error thrown when a session is in an invalid state
 */
export class SessionStateError extends SRSWriterError {
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
 * Error thrown when SRS validation fails
 */
export class ValidationError extends SRSWriterError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`SRS validation failed: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when SRS generation fails
 */
export class GenerationError extends SRSWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`SRS generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when file write operation fails
 */
export class FileWriteError extends SRSWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write SRS to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}
