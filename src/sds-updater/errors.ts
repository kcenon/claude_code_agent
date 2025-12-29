/**
 * Custom error classes for SDS Updater Agent
 */

/**
 * Base error for SDS Updater operations
 */
export class SDSUpdaterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SDSUpdaterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when no active session exists
 */
export class NoActiveSDSSessionError extends SDSUpdaterError {
  constructor() {
    super('No active SDS update session. Call startSession() first.');
    this.name = 'NoActiveSDSSessionError';
  }
}

/**
 * Error thrown when SDS document is not found
 */
export class SDSNotFoundError extends SDSUpdaterError {
  public readonly path: string;

  constructor(path: string) {
    super(`SDS document not found at: ${path}`);
    this.name = 'SDSNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when component is not found
 */
export class ComponentNotFoundError extends SDSUpdaterError {
  public readonly componentId: string;
  public readonly sdsPath: string;

  constructor(componentId: string, sdsPath: string) {
    super(`Component ${componentId} not found in SDS: ${sdsPath}`);
    this.name = 'ComponentNotFoundError';
    this.componentId = componentId;
    this.sdsPath = sdsPath;
  }
}

/**
 * Error thrown when API endpoint is not found
 */
export class APINotFoundError extends SDSUpdaterError {
  public readonly endpoint: string;
  public readonly sdsPath: string;

  constructor(endpoint: string, sdsPath: string) {
    super(`API endpoint ${endpoint} not found in SDS: ${sdsPath}`);
    this.name = 'APINotFoundError';
    this.endpoint = endpoint;
    this.sdsPath = sdsPath;
  }
}

/**
 * Error thrown when component ID already exists
 */
export class DuplicateComponentError extends SDSUpdaterError {
  public readonly componentId: string;

  constructor(componentId: string) {
    super(`Component ID ${componentId} already exists in the SDS`);
    this.name = 'DuplicateComponentError';
    this.componentId = componentId;
  }
}

/**
 * Error thrown when API endpoint already exists
 */
export class DuplicateAPIError extends SDSUpdaterError {
  public readonly endpoint: string;

  constructor(endpoint: string) {
    super(`API endpoint ${endpoint} already exists in the SDS`);
    this.name = 'DuplicateAPIError';
    this.endpoint = endpoint;
  }
}

/**
 * Error thrown when SRS reference is invalid
 */
export class InvalidSDSTraceabilityError extends SDSUpdaterError {
  public readonly srsId: string;
  public readonly reason: string;

  constructor(srsId: string, reason: string) {
    super(`Invalid traceability reference for ${srsId}: ${reason}`);
    this.name = 'InvalidSDSTraceabilityError';
    this.srsId = srsId;
    this.reason = reason;
  }
}

/**
 * Error thrown when change request is invalid
 */
export class InvalidSDSChangeRequestError extends SDSUpdaterError {
  public readonly field: string;
  public readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Invalid SDS change request: ${field} - ${reason}`);
    this.name = 'InvalidSDSChangeRequestError';
    this.field = field;
    this.reason = reason;
  }
}

/**
 * Error thrown when document parse fails
 */
export class SDSDocumentParseError extends SDSUpdaterError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to parse SDS document at ${path}: ${reason}`);
    this.name = 'SDSDocumentParseError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when output write fails
 */
export class SDSOutputWriteError extends SDSUpdaterError {
  public readonly outputPath: string;
  public readonly reason: string;

  constructor(outputPath: string, reason: string) {
    super(`Failed to write SDS output to ${outputPath}: ${reason}`);
    this.name = 'SDSOutputWriteError';
    this.outputPath = outputPath;
    this.reason = reason;
  }
}

/**
 * Error thrown when version format is invalid
 */
export class InvalidSDSVersionError extends SDSUpdaterError {
  public readonly version: string;

  constructor(version: string) {
    super(`Invalid SDS version format: ${version}. Expected semantic versioning (x.y.z)`);
    this.name = 'InvalidSDSVersionError';
    this.version = version;
  }
}

/**
 * Error thrown when file exceeds size limit
 */
export class SDSFileSizeLimitError extends SDSUpdaterError {
  public readonly path: string;
  public readonly actualSize: number;
  public readonly maxSize: number;

  constructor(path: string, actualSize: number, maxSize: number) {
    super(
      `SDS file ${path} exceeds size limit: ${String(actualSize)} bytes > ${String(maxSize)} bytes`
    );
    this.name = 'SDSFileSizeLimitError';
    this.path = path;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when SDS has not been loaded
 */
export class SDSNotLoadedError extends SDSUpdaterError {
  constructor() {
    super('SDS document has not been loaded. Call loadSDS() first.');
    this.name = 'SDSNotLoadedError';
  }
}

/**
 * Error thrown when interface is incompatible with existing dependencies
 */
export class InterfaceIncompatibilityError extends SDSUpdaterError {
  public readonly componentId: string;
  public readonly reason: string;

  constructor(componentId: string, reason: string) {
    super(`Interface incompatibility for ${componentId}: ${reason}`);
    this.name = 'InterfaceIncompatibilityError';
    this.componentId = componentId;
    this.reason = reason;
  }
}

/**
 * Error thrown when architecture change conflicts with existing patterns
 */
export class ArchitecturalConflictError extends SDSUpdaterError {
  public readonly changeType: string;
  public readonly reason: string;

  constructor(changeType: string, reason: string) {
    super(`Architectural conflict for ${changeType}: ${reason}`);
    this.name = 'ArchitecturalConflictError';
    this.changeType = changeType;
    this.reason = reason;
  }
}
