/**
 * Collector Agent module error definitions
 *
 * Custom error classes for input parsing and information collection operations.
 */

/**
 * Base error class for collector agent errors
 */
export class CollectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectorError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when input parsing fails
 */
export class InputParseError extends CollectorError {
  /** The source that failed to parse */
  public readonly source: string;
  /** The type of input that failed */
  public readonly inputType: string;

  constructor(source: string, inputType: string, reason: string) {
    super(`Failed to parse ${inputType} input from "${source}": ${reason}`);
    this.name = 'InputParseError';
    this.source = source;
    this.inputType = inputType;
  }
}

/**
 * Error thrown when a file cannot be read or parsed
 */
export class FileParseError extends CollectorError {
  /** The file path that failed */
  public readonly filePath: string;
  /** The file type */
  public readonly fileType: string;

  constructor(filePath: string, fileType: string, reason: string) {
    super(`Failed to parse file "${filePath}" (${fileType}): ${reason}`);
    this.name = 'FileParseError';
    this.filePath = filePath;
    this.fileType = fileType;
  }
}

/**
 * Error thrown when a URL cannot be fetched or processed
 */
export class UrlFetchError extends CollectorError {
  /** The URL that failed */
  public readonly url: string;
  /** HTTP status code if available */
  public readonly statusCode: number | undefined;

  constructor(url: string, reason: string, statusCode?: number) {
    const statusInfo = statusCode !== undefined ? ` (status: ${String(statusCode)})` : '';
    super(`Failed to fetch URL "${url}"${statusInfo}: ${reason}`);
    this.name = 'UrlFetchError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when information extraction fails
 */
export class ExtractionError extends CollectorError {
  /** The phase where extraction failed */
  public readonly phase: string;

  constructor(phase: string, reason: string) {
    super(`Information extraction failed at "${phase}": ${reason}`);
    this.name = 'ExtractionError';
    this.phase = phase;
  }
}

/**
 * Error thrown when required information is missing
 */
export class MissingInformationError extends CollectorError {
  /** The fields that are missing */
  public readonly missingFields: readonly string[];

  constructor(missingFields: readonly string[]) {
    super(`Required information missing: ${missingFields.join(', ')}`);
    this.name = 'MissingInformationError';
    this.missingFields = missingFields;
  }
}

/**
 * Error thrown when validation of collected info fails
 */
export class ValidationError extends CollectorError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Validation failed: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when a collection session is in an invalid state
 */
export class SessionStateError extends CollectorError {
  /** Current session state */
  public readonly currentState: string;
  /** Expected state */
  public readonly expectedState: string;

  constructor(currentState: string, expectedState: string, action: string) {
    super(
      `Cannot ${action}: session is in "${currentState}" state, expected "${expectedState}"`
    );
    this.name = 'SessionStateError';
    this.currentState = currentState;
    this.expectedState = expectedState;
  }
}

/**
 * Error thrown when an unsupported file type is encountered
 */
export class UnsupportedFileTypeError extends CollectorError {
  /** The file extension that was not supported */
  public readonly extension: string;
  /** Supported file types */
  public readonly supportedTypes: readonly string[];

  constructor(extension: string, supportedTypes: readonly string[]) {
    super(
      `Unsupported file type ".${extension}". Supported types: ${supportedTypes.join(', ')}`
    );
    this.name = 'UnsupportedFileTypeError';
    this.extension = extension;
    this.supportedTypes = supportedTypes;
  }
}

/**
 * Error thrown when project initialization fails
 */
export class ProjectInitError extends CollectorError {
  /** The project ID */
  public readonly projectId: string;

  constructor(projectId: string, reason: string) {
    super(`Failed to initialize project "${projectId}": ${reason}`);
    this.name = 'ProjectInitError';
    this.projectId = projectId;
  }
}
