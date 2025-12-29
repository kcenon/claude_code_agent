/**
 * Custom error classes for PRD Updater Agent
 */

/**
 * Base error for PRD Updater operations
 */
export class PRDUpdaterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PRDUpdaterError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when no active session exists
 */
export class NoActiveSessionError extends PRDUpdaterError {
  constructor() {
    super('No active PRD update session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when PRD document is not found
 */
export class PRDNotFoundError extends PRDUpdaterError {
  public readonly path: string;

  constructor(path: string) {
    super(`PRD document not found at: ${path}`);
    this.name = 'PRDNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when requirement is not found
 */
export class RequirementNotFoundError extends PRDUpdaterError {
  public readonly requirementId: string;
  public readonly prdPath: string;

  constructor(requirementId: string, prdPath: string) {
    super(`Requirement ${requirementId} not found in PRD: ${prdPath}`);
    this.name = 'RequirementNotFoundError';
    this.requirementId = requirementId;
    this.prdPath = prdPath;
  }
}

/**
 * Error thrown when requirement ID already exists
 */
export class DuplicateRequirementError extends PRDUpdaterError {
  public readonly requirementId: string;

  constructor(requirementId: string) {
    super(`Requirement ID ${requirementId} already exists in the PRD`);
    this.name = 'DuplicateRequirementError';
    this.requirementId = requirementId;
  }
}

/**
 * Error thrown when requirements conflict
 */
export class ConflictingRequirementError extends PRDUpdaterError {
  public readonly newRequirementTitle: string;
  public readonly conflictingIds: readonly string[];

  constructor(newRequirementTitle: string, conflictingIds: readonly string[]) {
    super(
      `New requirement "${newRequirementTitle}" conflicts with existing requirements: ${conflictingIds.join(', ')}`
    );
    this.name = 'ConflictingRequirementError';
    this.newRequirementTitle = newRequirementTitle;
    this.conflictingIds = conflictingIds;
  }
}

/**
 * Error thrown when change request is invalid
 */
export class InvalidChangeRequestError extends PRDUpdaterError {
  public readonly field: string;
  public readonly reason: string;

  constructor(field: string, reason: string) {
    super(`Invalid change request: ${field} - ${reason}`);
    this.name = 'InvalidChangeRequestError';
    this.field = field;
    this.reason = reason;
  }
}

/**
 * Error thrown when document parse fails
 */
export class DocumentParseError extends PRDUpdaterError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to parse PRD document at ${path}: ${reason}`);
    this.name = 'DocumentParseError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when output write fails
 */
export class OutputWriteError extends PRDUpdaterError {
  public readonly outputPath: string;
  public readonly reason: string;

  constructor(outputPath: string, reason: string) {
    super(`Failed to write output to ${outputPath}: ${reason}`);
    this.name = 'OutputWriteError';
    this.outputPath = outputPath;
    this.reason = reason;
  }
}

/**
 * Error thrown when version format is invalid
 */
export class InvalidVersionError extends PRDUpdaterError {
  public readonly version: string;

  constructor(version: string) {
    super(`Invalid version format: ${version}. Expected semantic versioning (x.y.z)`);
    this.name = 'InvalidVersionError';
    this.version = version;
  }
}

/**
 * Error thrown when file exceeds size limit
 */
export class FileSizeLimitError extends PRDUpdaterError {
  public readonly path: string;
  public readonly actualSize: number;
  public readonly maxSize: number;

  constructor(path: string, actualSize: number, maxSize: number) {
    super(
      `File ${path} exceeds size limit: ${String(actualSize)} bytes > ${String(maxSize)} bytes`
    );
    this.name = 'FileSizeLimitError';
    this.path = path;
    this.actualSize = actualSize;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when PRD has not been loaded
 */
export class PRDNotLoadedError extends PRDUpdaterError {
  constructor() {
    super('PRD document has not been loaded. Call loadPRD() first.');
    this.name = 'PRDNotLoadedError';
  }
}
