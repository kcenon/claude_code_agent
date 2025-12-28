/**
 * Impact Analyzer Agent error classes
 *
 * Custom error types for impact analysis operations.
 */

/**
 * Base error class for Impact Analyzer Agent
 */
export class ImpactAnalyzerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImpactAnalyzerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when required input file is not found
 */
export class InputNotFoundError extends ImpactAnalyzerError {
  public readonly inputType: string;
  public readonly path: string;

  constructor(inputType: string, path: string) {
    super(`Required input not found: ${inputType} at ${path}`);
    this.name = 'InputNotFoundError';
    this.inputType = inputType;
    this.path = path;
  }
}

/**
 * Error thrown when no inputs are available
 */
export class NoInputsAvailableError extends ImpactAnalyzerError {
  public readonly projectId: string;
  public readonly checkedPaths: readonly string[];

  constructor(projectId: string, checkedPaths: readonly string[]) {
    super(
      `No inputs available for project ${projectId}. Checked: ${checkedPaths.join(', ')}`
    );
    this.name = 'NoInputsAvailableError';
    this.projectId = projectId;
    this.checkedPaths = checkedPaths;
  }
}

/**
 * Error thrown when change request cannot be parsed
 */
export class ChangeRequestParseError extends ImpactAnalyzerError {
  public readonly reason: string;
  public readonly rawInput: string | undefined;

  constructor(reason: string, rawInput?: string) {
    super(`Failed to parse change request: ${reason}`);
    this.name = 'ChangeRequestParseError';
    this.reason = reason;
    this.rawInput = rawInput ?? undefined;
  }
}

/**
 * Error thrown when change request is empty or invalid
 */
export class InvalidChangeRequestError extends ImpactAnalyzerError {
  public readonly validationErrors: readonly string[];

  constructor(validationErrors: readonly string[]) {
    super(`Invalid change request: ${validationErrors.join('; ')}`);
    this.name = 'InvalidChangeRequestError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown when dependency resolution fails
 */
export class DependencyResolutionError extends ImpactAnalyzerError {
  public readonly componentId: string;
  public readonly reason: string;

  constructor(componentId: string, reason: string) {
    super(`Failed to resolve dependencies for ${componentId}: ${reason}`);
    this.name = 'DependencyResolutionError';
    this.componentId = componentId;
    this.reason = reason;
  }
}

/**
 * Error thrown when traceability cannot be resolved
 */
export class TraceabilityGapError extends ImpactAnalyzerError {
  public readonly fromId: string;
  public readonly toType: string;

  constructor(fromId: string, toType: string) {
    super(`Cannot trace from ${fromId} to ${toType}: no traceability link found`);
    this.name = 'TraceabilityGapError';
    this.fromId = fromId;
    this.toType = toType;
  }
}

/**
 * Error thrown when there's no active analysis session
 */
export class NoActiveSessionError extends ImpactAnalyzerError {
  constructor() {
    super('No active analysis session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when session is in invalid state
 */
export class InvalidSessionStateError extends ImpactAnalyzerError {
  public readonly currentStatus: string;
  public readonly expectedStatus: string;
  public readonly operation: string;

  constructor(operation: string, currentStatus: string, expectedStatus: string) {
    super(
      `Cannot perform ${operation}: session status is '${currentStatus}', expected '${expectedStatus}'`
    );
    this.name = 'InvalidSessionStateError';
    this.currentStatus = currentStatus;
    this.expectedStatus = expectedStatus;
    this.operation = operation;
  }
}

/**
 * Error thrown when output cannot be written
 */
export class OutputWriteError extends ImpactAnalyzerError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to write output to ${path}: ${reason}`);
    this.name = 'OutputWriteError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when input file parsing fails
 */
export class InputParseError extends ImpactAnalyzerError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to parse input file ${path}: ${reason}`);
    this.name = 'InputParseError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when file read fails
 */
export class FileReadError extends ImpactAnalyzerError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to read file ${path}: ${reason}`);
    this.name = 'FileReadError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when risk calculation fails
 */
export class RiskCalculationError extends ImpactAnalyzerError {
  public readonly reason: string;

  constructor(reason: string) {
    super(`Risk calculation failed: ${reason}`);
    this.name = 'RiskCalculationError';
    this.reason = reason;
  }
}

/**
 * Error thrown when maximum dependency depth is exceeded
 */
export class MaxDependencyDepthExceededError extends ImpactAnalyzerError {
  public readonly componentId: string;
  public readonly depth: number;
  public readonly maxDepth: number;

  constructor(componentId: string, depth: number, maxDepth: number) {
    super(
      `Maximum dependency depth exceeded for ${componentId}: depth ${String(depth)} > max ${String(maxDepth)}`
    );
    this.name = 'MaxDependencyDepthExceededError';
    this.componentId = componentId;
    this.depth = depth;
    this.maxDepth = maxDepth;
  }
}
