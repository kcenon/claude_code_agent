/**
 * Issue Generator module error definitions
 *
 * Custom error classes for SDS parsing and issue generation operations.
 */

/**
 * Base error class for issue generator errors
 */
export class IssueGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IssueGeneratorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when SDS parsing fails
 */
export class SDSParseError extends IssueGeneratorError {
  /** Line number where the error occurred */
  public readonly lineNumber: number | undefined;
  /** Section where the error occurred */
  public readonly section: string | undefined;

  constructor(message: string, lineNumber?: number, section?: string) {
    const locationInfo = lineNumber ? ` at line ${lineNumber}` : '';
    const sectionInfo = section ? ` in section "${section}"` : '';
    super(`SDS parse error${locationInfo}${sectionInfo}: ${message}`);
    this.name = 'SDSParseError';
    this.lineNumber = lineNumber;
    this.section = section;
  }
}

/**
 * Error thrown when a required component is missing
 */
export class ComponentNotFoundError extends IssueGeneratorError {
  /** The component ID that was not found */
  public readonly componentId: string;

  constructor(componentId: string) {
    super(`Component not found: ${componentId}`);
    this.name = 'ComponentNotFoundError';
    this.componentId = componentId;
  }
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends IssueGeneratorError {
  /** The cycle path */
  public readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Error thrown when issue generation fails
 */
export class IssueTransformError extends IssueGeneratorError {
  /** The component ID that failed to transform */
  public readonly componentId: string;

  constructor(componentId: string, reason: string) {
    super(`Failed to transform component ${componentId}: ${reason}`);
    this.name = 'IssueTransformError';
    this.componentId = componentId;
  }
}

/**
 * Error thrown when effort estimation fails
 */
export class EstimationError extends IssueGeneratorError {
  /** The component ID that failed estimation */
  public readonly componentId: string;

  constructor(componentId: string, reason: string) {
    super(`Failed to estimate effort for ${componentId}: ${reason}`);
    this.name = 'EstimationError';
    this.componentId = componentId;
  }
}

/**
 * Error thrown when SDS file is not found
 */
export class SDSNotFoundError extends IssueGeneratorError {
  /** The path that was not found */
  public readonly path: string;

  constructor(path: string) {
    super(`SDS file not found: ${path}`);
    this.name = 'SDSNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when SDS validation fails
 */
export class SDSValidationError extends IssueGeneratorError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`SDS validation failed: ${errors.join('; ')}`);
    this.name = 'SDSValidationError';
    this.errors = errors;
  }
}
