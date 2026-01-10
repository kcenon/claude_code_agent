/**
 * ErrorHandler Utility
 *
 * Centralized error handling, logging, and reporting utility.
 *
 * @module errors/handler
 */

import { AppError } from './AppError.js';
import type { ErrorCategory, ErrorContext, ErrorHandleOptions } from './types.js';
import { ErrorSeverity as Severity } from './types.js';

/**
 * Extended error information for logging and analysis
 */
export interface ErrorInfo {
  /** Error category */
  category: ErrorCategory;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error context */
  context: ErrorContext;
  /** Whether error is retryable */
  retryable: boolean;
  /** Suggested action for handling */
  suggestedAction: string;
  /** Stack trace (if available) */
  stackTrace?: string;
}

/**
 * Error code to category mapping for non-AppError errors
 */
const ERROR_CATEGORY_MAP: Record<string, ErrorCategory> = {
  // Transient errors - retry with backoff
  ECONNRESET: 'transient',
  ECONNREFUSED: 'transient',
  ETIMEDOUT: 'transient',
  ENOTFOUND: 'transient',
  EAI_AGAIN: 'transient',
  RATE_LIMITED: 'transient',
  SERVICE_UNAVAILABLE: 'transient',
  GATEWAY_TIMEOUT: 'transient',

  // Fatal errors - immediate escalation
  EACCES: 'fatal',
  EPERM: 'fatal',
  ENOENT: 'fatal',
  MODULE_NOT_FOUND: 'fatal',
  MISSING_DEPENDENCY: 'fatal',
} as const;

/**
 * Centralized error handling utility
 */
export class ErrorHandler {
  /**
   * Handle an error with logging and optional output
   */
  static handle(error: unknown, options: ErrorHandleOptions = {}): AppError {
    const appError = AppError.normalize(error);

    // Log the error
    this.log(appError, options.logLevel);

    // Report if critical
    if (appError.severity === Severity.CRITICAL) {
      this.report(appError);
    }

    // Format for output if callback provided
    if (options.output !== undefined) {
      const formatted = appError.format(options.style ?? 'cli');
      options.output(formatted);

      if (options.includeStack === true && appError.stack !== undefined) {
        options.output(appError.stack);
      }
    }

    return appError;
  }

  /**
   * Normalize any error to AppError
   */
  static normalize(error: unknown): AppError {
    return AppError.normalize(error);
  }

  /**
   * Categorize an error for retry decision
   */
  static categorize(error: Error): ErrorCategory {
    if (error instanceof AppError) {
      return error.category;
    }

    // Check error name
    if (error.name in ERROR_CATEGORY_MAP) {
      const category = ERROR_CATEGORY_MAP[error.name];
      if (category !== undefined) {
        return category;
      }
    }

    // Check for Node.js system error codes
    const nodeError = error as { code?: string };
    if (typeof nodeError.code === 'string' && nodeError.code in ERROR_CATEGORY_MAP) {
      const category = ERROR_CATEGORY_MAP[nodeError.code];
      if (category !== undefined) {
        return category;
      }
    }

    // Check message patterns
    const message = error.message.toLowerCase();
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network')
    ) {
      return 'transient';
    }
    if (
      message.includes('permission denied') ||
      message.includes('not found') ||
      message.includes('missing dependency')
    ) {
      return 'fatal';
    }
    if (
      message.includes('test failed') ||
      message.includes('lint error') ||
      message.includes('build failed')
    ) {
      return 'recoverable';
    }

    // Default to transient for unknown errors
    return 'transient';
  }

  /**
   * Get suggested action based on error
   */
  static getSuggestedAction(error: Error): string {
    const appError =
      error instanceof AppError ? error : AppError.normalize(error);
    const category = appError.category;

    switch (category) {
      case 'transient':
        return 'Retry with exponential backoff. Check network connectivity if issue persists.';
      case 'recoverable':
        return 'Attempt automatic fix, then retry. If fix fails, escalate to Controller.';
      case 'fatal':
        return 'Escalate immediately. Manual intervention required.';
      default:
        return 'Unknown error. Review logs and escalate if necessary.';
    }
  }

  /**
   * Create extended error information
   */
  static createErrorInfo(
    error: Error,
    additionalContext: ErrorContext = {}
  ): ErrorInfo {
    const appError =
      error instanceof AppError ? error : AppError.normalize(error);

    const info: ErrorInfo = {
      category: appError.category,
      code: appError.code,
      message: appError.message,
      context: { ...appError.context, ...additionalContext },
      retryable: appError.isRetryable(),
      suggestedAction: this.getSuggestedAction(appError),
    };

    if (appError.stack !== undefined) {
      info.stackTrace = appError.stack;
    }

    return info;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isRetryable();
    }
    return this.categorize(error) !== 'fatal';
  }

  /**
   * Check if error requires escalation
   */
  static requiresEscalation(error: Error): boolean {
    if (error instanceof AppError) {
      return error.requiresEscalation();
    }
    return this.categorize(error) === 'fatal';
  }

  /**
   * Log error to console with appropriate level
   */
  private static log(
    error: AppError,
    level: 'debug' | 'info' | 'warn' | 'error' = 'error'
  ): void {
    const formatted = error.format('log');
    const logMethod = console[level] ?? console.error;
    logMethod(formatted);
  }

  /**
   * Report critical errors
   */
  private static report(error: AppError): void {
    // Log critical error details
    console.error('CRITICAL ERROR:', error.toJSON());

    // Could integrate with error reporting service here
    // e.g., Sentry, DataDog, etc.
  }

  /**
   * Create a function that wraps errors with a specific code
   */
  static createWrapper(
    code: string,
    defaultContext: ErrorContext = {}
  ): (error: unknown) => AppError {
    return (error: unknown) =>
      AppError.wrap(error, code, { context: defaultContext });
  }

  /**
   * Assert condition and throw AppError if false
   */
  static assert(
    condition: boolean,
    code: string,
    message: string,
    context: ErrorContext = {}
  ): asserts condition {
    if (!condition) {
      throw new AppError(code, message, {
        context,
        severity: Severity.HIGH,
        category: 'fatal',
      });
    }
  }

  /**
   * Execute a function and wrap any thrown error
   */
  static async wrapAsync<T>(
    fn: () => Promise<T>,
    code: string,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw AppError.wrap(error, code, { context });
    }
  }

  /**
   * Execute a function and wrap any thrown error (sync version)
   */
  static wrapSync<T>(
    fn: () => T,
    code: string,
    context: ErrorContext = {}
  ): T {
    try {
      return fn();
    } catch (error) {
      throw AppError.wrap(error, code, { context });
    }
  }
}
