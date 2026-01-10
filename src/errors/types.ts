/**
 * Error Library Type Definitions
 *
 * Shared types for the standardized error handling system.
 *
 * @module errors/types
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low impact, informational */
  LOW = 'low',
  /** Medium impact, may require attention */
  MEDIUM = 'medium',
  /** High impact, should be addressed promptly */
  HIGH = 'high',
  /** Critical impact, requires immediate attention */
  CRITICAL = 'critical',
}

/**
 * Error category for retry decisions
 */
export type ErrorCategory = 'transient' | 'recoverable' | 'fatal';

/**
 * Context data attached to errors
 */
export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Serialized error format for logging and transmission
 */
export interface SerializedError {
  /** Error code (e.g., 'CTL-001') */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Additional context data */
  context: ErrorContext;
  /** Stack trace (if available) */
  stack?: string;
  /** Serialized cause error (if any) */
  cause?: SerializedError;
  /** ISO timestamp of when error occurred */
  timestamp: string;
  /** Error category for retry decisions */
  category?: ErrorCategory;
}

/**
 * Options for creating AppError instances
 */
export interface AppErrorOptions {
  /** Error severity level */
  severity?: ErrorSeverity;
  /** Additional context data */
  context?: ErrorContext;
  /** Original error that caused this error */
  cause?: Error;
  /** Error category for retry decisions */
  category?: ErrorCategory;
}

/**
 * Error format style for output
 */
export type ErrorFormatStyle = 'log' | 'cli' | 'json';

/**
 * Error handler options
 */
export interface ErrorHandleOptions {
  /** Log level for error logging */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Output format style */
  style?: ErrorFormatStyle;
  /** Output callback function */
  output?: (formatted: string) => void;
  /** Whether to include stack trace */
  includeStack?: boolean;
}
