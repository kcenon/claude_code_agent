/**
 * Architecture Generator module error definitions
 *
 * Custom error classes for SRS parsing and architecture generation operations.
 */

/**
 * Base error class for architecture generator errors
 */
export class ArchitectureGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchitectureGeneratorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when SRS parsing fails
 */
export class SRSParseError extends ArchitectureGeneratorError {
  /** Line number where the error occurred */
  public readonly lineNumber: number | undefined;
  /** Section where the error occurred */
  public readonly section: string | undefined;

  constructor(message: string, lineNumber?: number, section?: string) {
    const locationInfo = lineNumber !== undefined ? ` at line ${String(lineNumber)}` : '';
    const sectionInfo = section !== undefined && section !== '' ? ` in section "${section}"` : '';
    super(`SRS parse error${locationInfo}${sectionInfo}: ${message}`);
    this.name = 'SRSParseError';
    this.lineNumber = lineNumber;
    this.section = section;
  }
}

/**
 * Error thrown when SRS file is not found
 */
export class SRSNotFoundError extends ArchitectureGeneratorError {
  /** The path that was not found */
  public readonly path: string;

  constructor(path: string) {
    super(`SRS file not found: ${path}`);
    this.name = 'SRSNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when SRS validation fails
 */
export class SRSValidationError extends ArchitectureGeneratorError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`SRS validation failed: ${errors.join('; ')}`);
    this.name = 'SRSValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when architecture analysis fails
 */
export class ArchitectureAnalysisError extends ArchitectureGeneratorError {
  /** The phase where analysis failed */
  public readonly phase: string;

  constructor(phase: string, reason: string) {
    super(`Architecture analysis failed in ${phase}: ${reason}`);
    this.name = 'ArchitectureAnalysisError';
    this.phase = phase;
  }
}

/**
 * Error thrown when pattern detection fails
 */
export class PatternDetectionError extends ArchitectureGeneratorError {
  /** Requirements that couldn't be analyzed */
  public readonly failedRequirements: readonly string[];

  constructor(failedRequirements: readonly string[], reason: string) {
    super(`Pattern detection failed: ${reason}`);
    this.name = 'PatternDetectionError';
    this.failedRequirements = failedRequirements;
  }
}

/**
 * Error thrown when diagram generation fails
 */
export class DiagramGenerationError extends ArchitectureGeneratorError {
  /** The diagram type that failed */
  public readonly diagramType: string;

  constructor(diagramType: string, reason: string) {
    super(`Failed to generate ${diagramType} diagram: ${reason}`);
    this.name = 'DiagramGenerationError';
    this.diagramType = diagramType;
  }
}

/**
 * Error thrown when technology stack generation fails
 */
export class TechnologyStackError extends ArchitectureGeneratorError {
  /** The layer that failed */
  public readonly layer: string;

  constructor(layer: string, reason: string) {
    super(`Failed to generate technology stack for ${layer}: ${reason}`);
    this.name = 'TechnologyStackError';
    this.layer = layer;
  }
}

/**
 * Error thrown when directory structure generation fails
 */
export class DirectoryStructureError extends ArchitectureGeneratorError {
  /** The pattern that failed */
  public readonly pattern: string;

  constructor(pattern: string, reason: string) {
    super(`Failed to generate directory structure for ${pattern}: ${reason}`);
    this.name = 'DirectoryStructureError';
    this.pattern = pattern;
  }
}

/**
 * Error thrown when a required feature is missing
 */
export class FeatureNotFoundError extends ArchitectureGeneratorError {
  /** The feature ID that was not found */
  public readonly featureId: string;

  constructor(featureId: string) {
    super(`Feature not found: ${featureId}`);
    this.name = 'FeatureNotFoundError';
    this.featureId = featureId;
  }
}

/**
 * Error thrown when output write fails
 */
export class OutputWriteError extends ArchitectureGeneratorError {
  /** The path that failed to write */
  public readonly path: string;

  constructor(path: string, reason: string) {
    super(`Failed to write output to ${path}: ${reason}`);
    this.name = 'OutputWriteError';
    this.path = path;
  }
}
