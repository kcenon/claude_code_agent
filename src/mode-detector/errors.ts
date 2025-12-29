/**
 * Mode Detector Agent error definitions
 *
 * Custom error classes for mode detection operations.
 */

/**
 * Base error class for Mode Detector operations
 */
export class ModeDetectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ModeDetectorError';
  }
}

/**
 * Error when project path is not found
 */
export class ProjectNotFoundError extends ModeDetectorError {
  constructor(path: string) {
    super(`Project path not found: ${path}`, 'PROJECT_NOT_FOUND', { path });
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Error when no active session exists
 */
export class NoActiveSessionError extends ModeDetectorError {
  constructor() {
    super('No active detection session. Call startSession() first.', 'NO_ACTIVE_SESSION');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error when session is in an invalid state for the requested operation
 */
export class InvalidSessionStateError extends ModeDetectorError {
  constructor(currentStatus: string, requiredStatus: string) {
    super(
      `Invalid session state: ${currentStatus}. Required: ${requiredStatus}`,
      'INVALID_SESSION_STATE',
      { currentStatus, requiredStatus }
    );
    this.name = 'InvalidSessionStateError';
  }
}

/**
 * Error when document analysis fails
 */
export class DocumentAnalysisError extends ModeDetectorError {
  constructor(message: string, details?: unknown) {
    super(`Document analysis failed: ${message}`, 'DOCUMENT_ANALYSIS_ERROR', details);
    this.name = 'DocumentAnalysisError';
  }
}

/**
 * Error when codebase analysis fails
 */
export class CodebaseAnalysisError extends ModeDetectorError {
  constructor(message: string, details?: unknown) {
    super(`Codebase analysis failed: ${message}`, 'CODEBASE_ANALYSIS_ERROR', details);
    this.name = 'CodebaseAnalysisError';
  }
}

/**
 * Error when configuration is invalid
 */
export class InvalidConfigurationError extends ModeDetectorError {
  constructor(message: string, details?: unknown) {
    super(`Invalid configuration: ${message}`, 'INVALID_CONFIGURATION', details);
    this.name = 'InvalidConfigurationError';
  }
}

/**
 * Error when output file cannot be written
 */
export class OutputWriteError extends ModeDetectorError {
  constructor(path: string, cause?: Error) {
    super(`Failed to write output file: ${path}`, 'OUTPUT_WRITE_ERROR', { path, cause });
    this.name = 'OutputWriteError';
  }
}

/**
 * Error when detection process times out
 */
export class DetectionTimeoutError extends ModeDetectorError {
  constructor(timeoutMs: number) {
    super(`Detection timed out after ${timeoutMs}ms`, 'DETECTION_TIMEOUT', { timeoutMs });
    this.name = 'DetectionTimeoutError';
  }
}
