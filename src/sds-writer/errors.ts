/**
 * SDS Writer Agent module error definitions
 *
 * Custom error classes for SDS generation and validation operations.
 */

/**
 * Base error class for SDS writer agent errors
 */
export class SDSWriterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SDSWriterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when SRS document is not found
 */
export class SRSNotFoundError extends SDSWriterError {
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
 * Error thrown when SRS parsing fails
 */
export class SRSParseError extends SDSWriterError {
  /** The section where parsing failed */
  public readonly section: string;
  /** Line number if available */
  public readonly lineNumber: number | undefined;

  constructor(section: string, reason: string, lineNumber?: number) {
    const lineInfo = lineNumber !== undefined ? ` at line ${String(lineNumber)}` : '';
    super(`Failed to parse SRS section "${section}"${lineInfo}: ${reason}`);
    this.name = 'SRSParseError';
    this.section = section;
    this.lineNumber = lineNumber;
  }
}

/**
 * Error thrown when the SDS template is not found
 */
export class TemplateNotFoundError extends SDSWriterError {
  /** The template path that was not found */
  public readonly templatePath: string;

  constructor(templatePath: string) {
    super(`SDS template not found at: ${templatePath}`);
    this.name = 'TemplateNotFoundError';
    this.templatePath = templatePath;
  }
}

/**
 * Error thrown when template processing fails
 */
export class TemplateProcessingError extends SDSWriterError {
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
 * Error thrown when component design fails
 */
export class ComponentDesignError extends SDSWriterError {
  /** The feature that failed component design */
  public readonly featureId: string;

  constructor(featureId: string, reason: string) {
    super(`Failed to design component for feature "${featureId}": ${reason}`);
    this.name = 'ComponentDesignError';
    this.featureId = featureId;
  }
}

/**
 * Error thrown when API specification fails
 */
export class APISpecificationError extends SDSWriterError {
  /** The component for which API specification failed */
  public readonly componentId: string;
  /** The use case that failed */
  public readonly useCaseId: string | undefined;

  constructor(componentId: string, reason: string, useCaseId?: string) {
    const ucInfo = useCaseId !== undefined ? ` for use case "${useCaseId}"` : '';
    super(`Failed to specify API for component "${componentId}"${ucInfo}: ${reason}`);
    this.name = 'APISpecificationError';
    this.componentId = componentId;
    this.useCaseId = useCaseId;
  }
}

/**
 * Error thrown when data model design fails
 */
export class DataModelDesignError extends SDSWriterError {
  /** The component for which data model design failed */
  public readonly componentId: string;

  constructor(componentId: string, reason: string) {
    super(`Failed to design data model for component "${componentId}": ${reason}`);
    this.name = 'DataModelDesignError';
    this.componentId = componentId;
  }
}

/**
 * Error thrown when security specification fails
 */
export class SecuritySpecificationError extends SDSWriterError {
  /** The aspect that failed */
  public readonly aspect: string;

  constructor(aspect: string, reason: string) {
    super(`Failed to specify security for "${aspect}": ${reason}`);
    this.name = 'SecuritySpecificationError';
    this.aspect = aspect;
  }
}

/**
 * Error thrown when traceability coverage is below threshold
 */
export class LowCoverageError extends SDSWriterError {
  /** Actual coverage percentage */
  public readonly actualCoverage: number;
  /** Required coverage threshold */
  public readonly threshold: number;
  /** Uncovered features */
  public readonly uncoveredFeatures: readonly string[];

  constructor(actualCoverage: number, threshold: number, uncoveredFeatures: readonly string[]) {
    super(
      `Traceability coverage ${actualCoverage.toFixed(1)}% is below threshold ${String(threshold)}%. ` +
        `Uncovered: ${uncoveredFeatures.slice(0, 5).join(', ')}${uncoveredFeatures.length > 5 ? '...' : ''}`
    );
    this.name = 'LowCoverageError';
    this.actualCoverage = actualCoverage;
    this.threshold = threshold;
    this.uncoveredFeatures = uncoveredFeatures;
  }
}

/**
 * Error thrown when a session is in an invalid state
 */
export class SessionStateError extends SDSWriterError {
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
 * Error thrown when SDS validation fails
 */
export class ValidationError extends SDSWriterError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`SDS validation failed: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when SDS generation fails
 */
export class GenerationError extends SDSWriterError {
  /** The phase where generation failed */
  public readonly phase: string;
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, phase: string, reason: string) {
    super(`SDS generation failed for project "${projectId}" at "${phase}": ${reason}`);
    this.name = 'GenerationError';
    this.projectId = projectId;
    this.phase = phase;
  }
}

/**
 * Error thrown when file write operation fails
 */
export class FileWriteError extends SDSWriterError {
  /** The file path that failed */
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write SDS to "${filePath}": ${reason}`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
  }
}

/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends SDSWriterError {
  /** The components involved in the cycle */
  public readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Error thrown when interface generation fails
 */
export class InterfaceGenerationError extends SDSWriterError {
  /** The component for which interface generation failed */
  public readonly componentId: string;

  constructor(componentId: string, reason: string) {
    super(`Failed to generate interface for component "${componentId}": ${reason}`);
    this.name = 'InterfaceGenerationError';
    this.componentId = componentId;
  }
}
