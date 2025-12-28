/**
 * Document Reader Agent error classes
 *
 * Custom error types for document parsing and processing operations.
 */

/**
 * Base error class for Document Reader Agent
 */
export class DocumentReaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentReaderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a document file is not found
 */
export class DocumentNotFoundError extends DocumentReaderError {
  public readonly path: string;
  public readonly documentType: string;

  constructor(path: string, documentType: string) {
    super(`${documentType.toUpperCase()} document not found: ${path}`);
    this.name = 'DocumentNotFoundError';
    this.path = path;
    this.documentType = documentType;
  }
}

/**
 * Error thrown when document parsing fails
 */
export class DocumentParseError extends DocumentReaderError {
  public readonly path: string;
  public readonly line: number | undefined;
  public readonly reason: string;

  constructor(path: string, reason: string, line?: number) {
    const lineInfo = line !== undefined ? ` at line ${line}` : '';
    super(`Failed to parse document ${path}${lineInfo}: ${reason}`);
    this.name = 'DocumentParseError';
    this.path = path;
    this.reason = reason;
    this.line = line;
  }
}

/**
 * Error thrown when a requirement ID is invalid
 */
export class InvalidRequirementIdError extends DocumentReaderError {
  public readonly id: string;
  public readonly expectedPattern: string;

  constructor(id: string, expectedPattern: string) {
    super(`Invalid requirement ID '${id}'. Expected pattern: ${expectedPattern}`);
    this.name = 'InvalidRequirementIdError';
    this.id = id;
    this.expectedPattern = expectedPattern;
  }
}

/**
 * Error thrown when document format is not supported
 */
export class UnsupportedFormatError extends DocumentReaderError {
  public readonly format: string;
  public readonly supportedFormats: readonly string[];

  constructor(format: string, supportedFormats: readonly string[]) {
    super(
      `Unsupported document format '${format}'. Supported formats: ${supportedFormats.join(', ')}`
    );
    this.name = 'UnsupportedFormatError';
    this.format = format;
    this.supportedFormats = supportedFormats;
  }
}

/**
 * Error thrown when extraction fails
 */
export class ExtractionError extends DocumentReaderError {
  public readonly documentPath: string;
  public readonly extractionType: string;
  public readonly reason: string;

  constructor(documentPath: string, extractionType: string, reason: string) {
    super(`Failed to extract ${extractionType} from ${documentPath}: ${reason}`);
    this.name = 'ExtractionError';
    this.documentPath = documentPath;
    this.extractionType = extractionType;
    this.reason = reason;
  }
}

/**
 * Error thrown when traceability mapping fails
 */
export class TraceabilityError extends DocumentReaderError {
  public readonly sourceId: string;
  public readonly targetType: string;
  public readonly reason: string;

  constructor(sourceId: string, targetType: string, reason: string) {
    super(`Traceability error for ${sourceId} -> ${targetType}: ${reason}`);
    this.name = 'TraceabilityError';
    this.sourceId = sourceId;
    this.targetType = targetType;
    this.reason = reason;
  }
}

/**
 * Error thrown when there's no active session
 */
export class NoActiveSessionError extends DocumentReaderError {
  constructor() {
    super('No active document reading session. Call startSession() first.');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error thrown when session is in an invalid state for the operation
 */
export class InvalidSessionStateError extends DocumentReaderError {
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
 * Error thrown when file size exceeds the limit
 */
export class FileSizeLimitError extends DocumentReaderError {
  public readonly path: string;
  public readonly size: number;
  public readonly maxSize: number;

  constructor(path: string, size: number, maxSize: number) {
    super(
      `File ${path} exceeds size limit: ${(size / 1024 / 1024).toFixed(2)}MB > ${(maxSize / 1024 / 1024).toFixed(2)}MB`
    );
    this.name = 'FileSizeLimitError';
    this.path = path;
    this.size = size;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when output cannot be written
 */
export class OutputWriteError extends DocumentReaderError {
  public readonly path: string;
  public readonly reason: string;

  constructor(path: string, reason: string) {
    super(`Failed to write output to ${path}: ${reason}`);
    this.name = 'OutputWriteError';
    this.path = path;
    this.reason = reason;
  }
}
