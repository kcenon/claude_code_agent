/**
 * Safe Cleanup Utilities
 *
 * Provides utilities for handling cleanup operations with proper error context
 * preservation. These utilities replace silent `.catch(() => {})` patterns
 * that lose error context and make debugging difficult.
 *
 * @module utilities/safeCleanup
 */

/**
 * Logger interface for cleanup operations
 * Matches the Logger class interface from src/logging
 */
export interface CleanupLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * Options for safe cleanup operations
 */
export interface SafeCleanupOptions {
  /**
   * Logger instance for recording cleanup failures
   */
  logger?: CleanupLogger;
  /**
   * Log level to use for cleanup errors (default: 'debug')
   */
  logLevel?: 'debug' | 'warn';
  /**
   * Additional context to include in log messages
   */
  context?: Record<string, unknown>;
}

/**
 * Result of a cleanup operation with error information
 */
export interface CleanupResult {
  /**
   * Whether the cleanup succeeded
   */
  success: boolean;
  /**
   * Error message if cleanup failed
   */
  error?: string;
  /**
   * Original error object if cleanup failed
   */
  originalError?: unknown;
}

/**
 * Safely execute a cleanup operation with error context preservation
 *
 * This function wraps cleanup operations (like file handle close, resource disposal)
 * and logs any errors that occur instead of silently swallowing them.
 *
 * @param operation - Description of the cleanup operation (for logging)
 * @param fn - The cleanup function to execute
 * @param options - Options for error handling and logging
 * @returns CleanupResult indicating success/failure
 *
 * @example
 * ```typescript
 * // Instead of: handle.close().catch(() => {})
 * await safeCleanup('close file handle', () => handle.close(), { logger });
 *
 * // With context
 * await safeCleanup(
 *   'release lock',
 *   () => releaseLock(filePath),
 *   { logger, context: { filePath, lockId } }
 * );
 * ```
 */
export async function safeCleanup(
  operation: string,
  fn: () => Promise<void>,
  options: SafeCleanupOptions = {}
): Promise<CleanupResult> {
  try {
    await fn();
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: CleanupResult = {
      success: false,
      error: errorMessage,
      originalError: error,
    };

    if (options.logger !== undefined) {
      const logContext = {
        operation,
        error: errorMessage,
        ...options.context,
      };

      const logLevel = options.logLevel ?? 'debug';
      if (logLevel === 'warn') {
        options.logger.warn(`Cleanup failed: ${operation}`, logContext);
      } else {
        options.logger.debug(`Cleanup failed: ${operation}`, logContext);
      }
    }

    return result;
  }
}

/**
 * Safely execute a synchronous cleanup operation
 *
 * Similar to safeCleanup but for synchronous operations.
 *
 * @param operation - Description of the cleanup operation
 * @param fn - The synchronous cleanup function to execute
 * @param options - Options for error handling and logging
 * @returns CleanupResult indicating success/failure
 */
export function safeCleanupSync(
  operation: string,
  fn: () => void,
  options: SafeCleanupOptions = {}
): CleanupResult {
  try {
    fn();
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: CleanupResult = {
      success: false,
      error: errorMessage,
      originalError: error,
    };

    if (options.logger !== undefined) {
      const logContext = {
        operation,
        error: errorMessage,
        ...options.context,
      };

      const logLevel = options.logLevel ?? 'debug';
      if (logLevel === 'warn') {
        options.logger.warn(`Cleanup failed: ${operation}`, logContext);
      } else {
        options.logger.debug(`Cleanup failed: ${operation}`, logContext);
      }
    }

    return result;
  }
}

/**
 * Create a cleanup function that ignores errors but preserves context
 *
 * This is useful for fire-and-forget cleanup operations where you don't
 * need to await the result but still want error logging.
 *
 * @param operation - Description of the cleanup operation
 * @param fn - The cleanup function to execute
 * @param options - Options for error handling and logging
 *
 * @example
 * ```typescript
 * // Instead of: this.flush().catch(() => {})
 * void fireAndForgetCleanup('flush writes', () => this.flush(), { logger });
 * ```
 */
export function fireAndForgetCleanup(
  operation: string,
  fn: () => Promise<void>,
  options: SafeCleanupOptions = {}
): void {
  void safeCleanup(operation, fn, options);
}
