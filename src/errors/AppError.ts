/**
 * AppError - Base Error Class
 *
 * Standardized base error class for the AD-SDLC system.
 * Provides consistent error handling with codes, severity, context, and serialization.
 *
 * @module errors/AppError
 */

import type {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  SerializedError,
  AppErrorOptions,
  ErrorFormatStyle,
} from './types.js';
import { ErrorSeverity as Severity } from './types.js';
import { ErrorCodes, ErrorCodeDescriptions, type ErrorCode } from './codes.js';

/**
 * Base error class for all AD-SDLC errors
 *
 * @example
 * ```typescript
 * throw new AppError(
 *   ErrorCodes.CTL_GRAPH_NOT_FOUND,
 *   'Dependency graph file not found: graph.json',
 *   {
 *     severity: ErrorSeverity.HIGH,
 *     context: { path: 'graph.json' },
 *     category: 'fatal'
 *   }
 * );
 * ```
 */
export class AppError extends Error {
  /** Error code (e.g., 'CTL-001') */
  public readonly code: string;

  /** Error severity level */
  public readonly severity: ErrorSeverity;

  /** Additional context data */
  public readonly context: ErrorContext;

  /** Timestamp when error occurred */
  public readonly timestamp: Date;

  /** Error category for retry decisions */
  public readonly category: ErrorCategory;

  /** Original error that caused this error */
  public override readonly cause?: Error;

  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.severity = options.severity ?? Severity.MEDIUM;
    this.context = options.context ?? {};
    this.timestamp = new Date();
    this.category = options.category ?? 'transient';

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    // Maintains proper stack trace
    Object.setPrototypeOf(this, new.target.prototype);
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error for logging or transmission
   */
  toJSON(): SerializedError {
    const result: SerializedError = {
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      category: this.category,
    };

    if (this.stack !== undefined) {
      result.stack = this.stack;
    }

    if (this.cause instanceof AppError) {
      result.cause = this.cause.toJSON();
    } else if (this.cause instanceof Error) {
      const causeResult: SerializedError = {
        code: ErrorCodes.GEN_UNKNOWN,
        message: this.cause.message,
        severity: Severity.MEDIUM,
        context: {},
        timestamp: this.timestamp.toISOString(),
      };
      if (this.cause.stack !== undefined) {
        causeResult.stack = this.cause.stack;
      }
      result.cause = causeResult;
    }

    return result;
  }

  /**
   * Create AppError from serialized JSON
   */
  static fromJSON(json: SerializedError): AppError {
    const options: AppErrorOptions = {
      severity: json.severity,
      context: json.context,
    };
    if (json.category !== undefined) {
      options.category = json.category;
    }
    if (json.cause !== undefined) {
      options.cause = AppError.fromJSON(json.cause);
    }
    const error = new AppError(json.code, json.message, options);

    if (json.stack !== undefined) {
      error.stack = json.stack;
    }

    return error;
  }

  /**
   * Format error for output
   */
  format(style: ErrorFormatStyle = 'log'): string {
    switch (style) {
      case 'log':
        return `[${this.code}] ${this.message}`;
      case 'cli': {
        const severityPrefix = this.severity === Severity.CRITICAL ? '!!!' : '';
        return `${severityPrefix}Error ${this.code}: ${this.message}`;
      }
      case 'json':
        return JSON.stringify(this.toJSON(), null, 2);
      default:
        return `[${this.code}] ${this.message}`;
    }
  }

  /**
   * Get description for this error code
   */
  getCodeDescription(): string {
    if (this.code in ErrorCodeDescriptions) {
      return ErrorCodeDescriptions[this.code as ErrorCode];
    }
    return 'Unknown error code';
  }

  /**
   * Check if error is retryable based on category
   */
  isRetryable(): boolean {
    return this.category !== 'fatal';
  }

  /**
   * Check if error requires immediate escalation
   */
  requiresEscalation(): boolean {
    return this.category === 'fatal' || this.severity === Severity.CRITICAL;
  }

  /**
   * Create a new error with additional context
   */
  withContext(additionalContext: ErrorContext): AppError {
    const options: AppErrorOptions = {
      severity: this.severity,
      context: { ...this.context, ...additionalContext },
      category: this.category,
    };
    if (this.cause !== undefined) {
      options.cause = this.cause;
    }
    return new AppError(this.code, this.message, options);
  }

  /**
   * Wrap an existing error with AppError
   */
  static wrap(error: unknown, code: string, options: AppErrorOptions = {}): AppError {
    if (error instanceof AppError) {
      return error.withContext(options.context ?? {});
    }

    const originalError = error instanceof Error ? error : new Error(String(error));
    const message = originalError.message;

    return new AppError(code, message, {
      ...options,
      cause: originalError,
    });
  }

  /**
   * Check if an error is an AppError
   */
  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  /**
   * Normalize any error to AppError
   */
  static normalize(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(ErrorCodes.GEN_UNKNOWN, error.message, {
        cause: error,
        context: { originalName: error.name },
      });
    }

    return new AppError(ErrorCodes.GEN_UNKNOWN, String(error));
  }
}
