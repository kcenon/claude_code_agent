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
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ErrorHandler {
  /**
   * Handle an error with logging and optional output
   * @param error - The error to handle
   * @param options - Options controlling logging, output, and formatting
   * @returns The normalized AppError instance
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
   * @param error - The unknown error value to normalize
   * @returns The normalized AppError instance
   */
  static normalize(error: unknown): AppError {
    return AppError.normalize(error);
  }

  /**
   * Categorize an error for retry decision
   * @param error - The error to categorize
   * @returns The determined error category
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
   * @param error - The error to get a suggestion for
   * @returns A human-readable suggested action string
   */
  static getSuggestedAction(error: Error): string {
    const appError = error instanceof AppError ? error : AppError.normalize(error);
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
   * @param error - The source error to extract information from
   * @param additionalContext - Extra context to merge into the error info
   * @returns An ErrorInfo object with category, code, and suggested action
   */
  static createErrorInfo(error: Error, additionalContext: ErrorContext = {}): ErrorInfo {
    const appError = error instanceof AppError ? error : AppError.normalize(error);

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
   * @param error - The error to check for retryability
   * @returns True if the error can be retried
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isRetryable();
    }
    return this.categorize(error) !== 'fatal';
  }

  /**
   * Check if error requires escalation
   * @param error - The error to check for escalation requirement
   * @returns True if the error requires immediate escalation
   */
  static requiresEscalation(error: Error): boolean {
    if (error instanceof AppError) {
      return error.requiresEscalation();
    }
    return this.categorize(error) === 'fatal';
  }

  /**
   * Log error to console with appropriate level
   * @param error - The AppError to log
   * @param level - The console log level to use
   */
  private static log(error: AppError, level: 'debug' | 'info' | 'warn' | 'error' = 'error'): void {
    // Using console directly to avoid circular dependency with Logger
    // (Logger may depend on ErrorHandler for its own error handling)
    const formatted = error.format('log');
    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(formatted);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(formatted);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(formatted);
        break;
      case 'error':
      default:
        // eslint-disable-next-line no-console
        console.error(formatted);
        break;
    }
  }

  /**
   * Report critical errors
   * @param error - The critical AppError to report
   */
  private static report(error: AppError): void {
    // Using console directly to avoid circular dependency with Logger
    // (Logger may depend on ErrorHandler for its own error handling)
    // eslint-disable-next-line no-console
    console.error('CRITICAL ERROR:', error.toJSON());

    // Could integrate with error reporting service here
    // e.g., Sentry, DataDog, etc.
  }

  /**
   * Create a function that wraps errors with a specific code
   * @param code - The error code to assign to wrapped errors
   * @param defaultContext - Default context to attach to wrapped errors
   * @returns A function that wraps unknown errors into AppError instances
   */
  static createWrapper(
    code: string,
    defaultContext: ErrorContext = {}
  ): (error: unknown) => AppError {
    return (error: unknown) => AppError.wrap(error, code, { context: defaultContext });
  }

  /**
   * Assert condition and throw AppError if false
   * @param condition - The condition to assert as truthy
   * @param code - The error code to use if assertion fails
   * @param message - The error message if assertion fails
   * @param context - Additional context for the assertion error
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
   * @param fn - The async function to execute
   * @param code - The error code to assign if the function throws
   * @param context - Additional context for the wrapped error
   * @returns The result of the executed function
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
   * @param fn - The synchronous function to execute
   * @param code - The error code to assign if the function throws
   * @param context - Additional context for the wrapped error
   * @returns The result of the executed function
   */
  static wrapSync<T>(fn: () => T, code: string, context: ErrorContext = {}): T {
    try {
      return fn();
    } catch (error) {
      throw AppError.wrap(error, code, { context });
    }
  }
}
