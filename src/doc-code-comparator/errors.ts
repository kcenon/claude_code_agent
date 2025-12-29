/**
 * Doc-Code Comparator Agent error classes
 *
 * Custom error types for handling comparison-specific errors.
 */

/**
 * Base error class for Doc-Code Comparator Agent
 */
export class DocCodeComparatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocCodeComparatorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when no active session exists
 */
export class NoActiveSessionError extends DocCodeComparatorError {
  constructor() {
    super('No active comparison session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when document inventory is not found
 */
export class DocumentInventoryNotFoundError extends DocCodeComparatorError {
  public readonly path: string;

  constructor(path: string) {
    super(`Document inventory not found at: ${path}`);
    this.name = 'DocumentInventoryNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when code inventory is not found
 */
export class CodeInventoryNotFoundError extends DocCodeComparatorError {
  public readonly path: string;

  constructor(path: string) {
    super(`Code inventory not found at: ${path}`);
    this.name = 'CodeInventoryNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when inventory file is invalid
 */
export class InvalidInventoryError extends DocCodeComparatorError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Invalid inventory file at ${path}: ${reason}`);
    this.name = 'InvalidInventoryError';
    this.path = path;
    this.reason = reason;
  }
}

/**
 * Error thrown when output file cannot be written
 */
export class OutputWriteError extends DocCodeComparatorError {
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
 * Error thrown when comparison fails
 */
export class ComparisonError extends DocCodeComparatorError {
  public readonly stage: string;
  public readonly reason: string;

  constructor(stage: string, reason: string) {
    super(`Comparison failed at ${stage}: ${reason}`);
    this.name = 'ComparisonError';
    this.stage = stage;
    this.reason = reason;
  }
}

/**
 * Error thrown when gap analysis fails
 */
export class GapAnalysisError extends DocCodeComparatorError {
  public readonly itemId: string;
  public readonly reason: string;

  constructor(itemId: string, reason: string) {
    super(`Gap analysis failed for ${itemId}: ${reason}`);
    this.name = 'GapAnalysisError';
    this.itemId = itemId;
    this.reason = reason;
  }
}

/**
 * Error thrown when issue generation fails
 */
export class IssueGenerationError extends DocCodeComparatorError {
  public readonly gapId: string;
  public readonly reason: string;

  constructor(gapId: string, reason: string) {
    super(`Issue generation failed for gap ${gapId}: ${reason}`);
    this.name = 'IssueGenerationError';
    this.gapId = gapId;
    this.reason = reason;
  }
}
