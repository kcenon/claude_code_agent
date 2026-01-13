/**
 * Custom error classes for telemetry module
 *
 * @module telemetry/errors
 */

/**
 * Base error class for telemetry-related errors
 */
export class TelemetryError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'TelemetryError';
    this.code = code;
  }
}

/**
 * Error thrown when consent has not been granted
 */
export class ConsentRequiredError extends TelemetryError {
  constructor(message = 'Telemetry requires user consent before collecting data') {
    super(message, 'CONSENT_REQUIRED');
    this.name = 'ConsentRequiredError';
  }
}

/**
 * Error thrown when consent file operations fail
 */
export class ConsentStorageError extends TelemetryError {
  readonly cause: Error | undefined;

  constructor(message: string, cause?: Error) {
    super(message, 'CONSENT_STORAGE_ERROR');
    this.name = 'ConsentStorageError';
    this.cause = cause;
  }
}

/**
 * Error thrown when telemetry event validation fails
 */
export class InvalidEventError extends TelemetryError {
  readonly eventType: string | undefined;

  constructor(message: string, eventType?: string) {
    super(message, 'INVALID_EVENT');
    this.name = 'InvalidEventError';
    this.eventType = eventType;
  }
}

/**
 * Error thrown when telemetry flush operation fails
 */
export class FlushError extends TelemetryError {
  readonly pendingEvents: number;
  readonly cause: Error | undefined;

  constructor(message: string, pendingEvents: number, cause?: Error) {
    super(message, 'FLUSH_ERROR');
    this.name = 'FlushError';
    this.pendingEvents = pendingEvents;
    this.cause = cause;
  }
}

/**
 * Error thrown when telemetry is disabled
 */
export class TelemetryDisabledError extends TelemetryError {
  constructor(message = 'Telemetry is disabled') {
    super(message, 'TELEMETRY_DISABLED');
    this.name = 'TelemetryDisabledError';
  }
}
