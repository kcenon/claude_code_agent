/**
 * Component Generator module error definitions
 *
 * Custom error classes for component generation and API specification operations.
 */

/**
 * Base error class for component generator errors
 */
export class ComponentGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentGeneratorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a feature is not found
 */
export class FeatureNotFoundError extends ComponentGeneratorError {
  /** The feature ID that was not found */
  public readonly featureId: string;

  constructor(featureId: string) {
    super(`Feature not found: ${featureId}`);
    this.name = 'FeatureNotFoundError';
    this.featureId = featureId;
  }
}

/**
 * Error thrown when component generation fails
 */
export class ComponentGenerationError extends ComponentGeneratorError {
  /** The component ID that failed */
  public readonly componentId: string;
  /** The phase where generation failed */
  public readonly phase: string;

  constructor(componentId: string, phase: string, reason: string) {
    super(`Failed to generate component ${componentId} in ${phase}: ${reason}`);
    this.name = 'ComponentGenerationError';
    this.componentId = componentId;
    this.phase = phase;
  }
}

/**
 * Error thrown when interface generation fails
 */
export class InterfaceGenerationError extends ComponentGeneratorError {
  /** The interface ID that failed */
  public readonly interfaceId: string;
  /** The interface type */
  public readonly interfaceType: string;

  constructor(interfaceId: string, interfaceType: string, reason: string) {
    super(`Failed to generate ${interfaceType} interface ${interfaceId}: ${reason}`);
    this.name = 'InterfaceGenerationError';
    this.interfaceId = interfaceId;
    this.interfaceType = interfaceType;
  }
}

/**
 * Error thrown when API specification generation fails
 */
export class APISpecificationError extends ComponentGeneratorError {
  /** The endpoint that failed */
  public readonly endpoint: string;
  /** The HTTP method */
  public readonly method: string;

  constructor(endpoint: string, method: string, reason: string) {
    super(`Failed to generate API specification for ${method} ${endpoint}: ${reason}`);
    this.name = 'APISpecificationError';
    this.endpoint = endpoint;
    this.method = method;
  }
}

/**
 * Error thrown when dependency analysis fails
 */
export class DependencyAnalysisError extends ComponentGeneratorError {
  /** Components involved in the analysis */
  public readonly components: readonly string[];

  constructor(components: readonly string[], reason: string) {
    super(`Failed to analyze dependencies for components [${components.join(', ')}]: ${reason}`);
    this.name = 'DependencyAnalysisError';
    this.components = components;
  }
}

/**
 * Error thrown when circular dependency is detected
 */
export class CircularDependencyError extends ComponentGeneratorError {
  /** The circular dependency path */
  public readonly dependencyPath: readonly string[];

  constructor(dependencyPath: readonly string[]) {
    super(`Circular dependency detected: ${dependencyPath.join(' -> ')}`);
    this.name = 'CircularDependencyError';
    this.dependencyPath = dependencyPath;
  }
}

/**
 * Error thrown when traceability mapping fails
 */
export class TraceabilityError extends ComponentGeneratorError {
  /** The source ID */
  public readonly sourceId: string;
  /** The target type */
  public readonly targetType: string;

  constructor(sourceId: string, targetType: string, reason: string) {
    super(`Failed to create traceability from ${sourceId} to ${targetType}: ${reason}`);
    this.name = 'TraceabilityError';
    this.sourceId = sourceId;
    this.targetType = targetType;
  }
}

/**
 * Error thrown when TypeScript generation fails
 */
export class TypeScriptGenerationError extends ComponentGeneratorError {
  /** The interface name that failed */
  public readonly interfaceName: string;

  constructor(interfaceName: string, reason: string) {
    super(`Failed to generate TypeScript interface ${interfaceName}: ${reason}`);
    this.name = 'TypeScriptGenerationError';
    this.interfaceName = interfaceName;
  }
}

/**
 * Error thrown when output write fails
 */
export class OutputWriteError extends ComponentGeneratorError {
  /** The path that failed to write */
  public readonly path: string;

  constructor(path: string, reason: string) {
    super(`Failed to write output to ${path}: ${reason}`);
    this.name = 'OutputWriteError';
    this.path = path;
  }
}

/**
 * Error thrown when SRS input is invalid
 */
export class InvalidSRSError extends ComponentGeneratorError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Invalid SRS input: ${errors.join('; ')}`);
    this.name = 'InvalidSRSError';
    this.errors = errors;
  }
}
