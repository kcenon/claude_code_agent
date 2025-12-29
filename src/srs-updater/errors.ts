/**
 * Custom error classes for SRS Updater Agent
 */

/**
 * Base error for SRS Updater operations
 */
export class SRSUpdaterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SRSUpdaterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when no active session exists
 */
export class NoActiveSRSSessionError extends SRSUpdaterError {
  constructor() {
    super('No active SRS update session. Call startSession() first.');
    this.name = 'NoActiveSRSSessionError';
  }
}

/**
 * Error thrown when SRS document is not found
 */
export class SRSNotFoundError extends SRSUpdaterError {
  public readonly path: string;

  constructor(path: string) {
    super(`SRS document not found at: ${path}`);
    this.name = 'SRSNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when feature is not found
 */
export class FeatureNotFoundError extends SRSUpdaterError {
  public readonly featureId: string;
  public readonly srsPath: string;

  constructor(featureId: string, srsPath: string) {
    super(`Feature ${featureId} not found in SRS: ${srsPath}`);
    this.name = 'FeatureNotFoundError';
    this.featureId = featureId;
    this.srsPath = srsPath;
  }
}

/**
 * Error thrown when use case is not found
 */
export class UseCaseNotFoundError extends SRSUpdaterError {
  public readonly useCaseId: string;
  public readonly srsPath: string;

  constructor(useCaseId: string, srsPath: string) {
    super(`Use case ${useCaseId} not found in SRS: ${srsPath}`);
    this.name = 'UseCaseNotFoundError';
    this.useCaseId = useCaseId;
    this.srsPath = srsPath;
  }
}

/**
 * Error thrown when feature ID already exists
 */
export class DuplicateFeatureError extends SRSUpdaterError {
  public readonly featureId: string;

  constructor(featureId: string) {
    super(`Feature ID ${featureId} already exists in the SRS`);
    this.name = 'DuplicateFeatureError';
    this.featureId = featureId;
  }
}

/**
 * Error thrown when use case ID already exists
 */
export class DuplicateUseCaseError extends SRSUpdaterError {
  public readonly useCaseId: string;

  constructor(useCaseId: string) {
    super(`Use case ID ${useCaseId} already exists in the SRS`);
    this.name = 'DuplicateUseCaseError';
    this.useCaseId = useCaseId;
  }
}

/**
 * Error thrown when PRD reference is invalid
 */
export class InvalidTraceabilityError extends SRSUpdaterError {
  public readonly prdId: string;
  public readonly reason: string;

  constructor(prdId: string, reason: string) {
    super(`Invalid traceability reference for ${prdId}: ${reason}`);
    this.name = 'InvalidTraceabilityError';
    this.prdId = prdId;
    this.reason = reason;
  }
}

/**
 * Error thrown when change request is invalid
 */
export class InvalidSRSChangeRequestError extends SRSUpdaterError {
  public readonly field: string;
  public readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Invalid SRS change request: ${field} - ${reason}`);
    this.name = 'InvalidSRSChangeRequestError';
    this.field = field;
    this.reason = reason;
  }
}

/**
 * Error thrown when document parse fails
 */
export class SRSDocumentParseError extends SRSUpdaterError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to parse SRS document at ${path}: ${reason}`);
    this.name = 'SRSDocumentParseError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when output write fails
 */
export class SRSOutputWriteError extends SRSUpdaterError {
  public readonly outputPath: string;
  public readonly reason: string;

  constructor(outputPath: string, reason: string) {
    super(`Failed to write SRS output to ${outputPath}: ${reason}`);
    this.name = 'SRSOutputWriteError';
    this.outputPath = outputPath;
    this.reason = reason;
  }
}

/**
 * Error thrown when version format is invalid
 */
export class InvalidSRSVersionError extends SRSUpdaterError {
  public readonly version: string;

  constructor(version: string) {
    super(`Invalid SRS version format: ${version}. Expected semantic versioning (x.y.z)`);
    this.name = 'InvalidSRSVersionError';
    this.version = version;
  }
}

/**
 * Error thrown when file exceeds size limit
 */
export class SRSFileSizeLimitError extends SRSUpdaterError {
  public readonly path: string;
  public readonly actualSize: number;
  public readonly maxSize: number;

  constructor(path: string, actualSize: number, maxSize: number) {
    super(
      `SRS file ${path} exceeds size limit: ${String(actualSize)} bytes > ${String(maxSize)} bytes`
    );
    this.name = 'SRSFileSizeLimitError';
    this.path = path;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when SRS has not been loaded
 */
export class SRSNotLoadedError extends SRSUpdaterError {
  constructor() {
    super('SRS document has not been loaded. Call loadSRS() first.');
    this.name = 'SRSNotLoadedError';
  }
}
