/**
 * Error Handler module error definitions
 *
 * Custom error classes for retry operations, timeout handling,
 * and error categorization.
 *
 * @module error-handler/errors
 */

import type { RetryAttemptResult } from './types.js';

/**
 * Base class for error handler errors
 */
export class ErrorHandlerError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;

  constructor(message: string, code: string = 'ERROR_HANDLER_ERROR') {
    super(message);
    this.name = 'ErrorHandlerError';
    this.code = code;
    Object.setPrototypeOf(this, ErrorHandlerError.prototype);
  }
}

/**
 * Error thrown when maximum retry attempts are exceeded
 */
export class MaxRetriesExceededError extends ErrorHandlerError {
  /** Number of attempts made */
  public readonly attempts: number;
  /** Maximum attempts allowed */
  public readonly maxAttempts: number;
  /** The last error encountered */
  public readonly lastError: Error | undefined;
  /** Results of all retry attempts */
  public readonly attemptResults: readonly RetryAttemptResult[];
  /** Name of the operation that failed */
  public readonly operationName: string | undefined;

  constructor(
    attempts: number,
    maxAttempts: number,
    lastError?: Error,
    attemptResults: readonly RetryAttemptResult[] = [],
    operationName?: string
  ) {
    const opName = operationName !== undefined ? ` for '${operationName}'` : '';
    const lastErrorMsg = lastError !== undefined ? `: ${lastError.message}` : '';
    super(
      `Max retries exceeded${opName} after ${String(attempts)} of ${String(maxAttempts)} attempts${lastErrorMsg}`,
      'MAX_RETRIES_EXCEEDED'
    );
    this.name = 'MaxRetriesExceededError';
    this.attempts = attempts;
    this.maxAttempts = maxAttempts;
    this.lastError = lastError;
    this.attemptResults = attemptResults;
    this.operationName = operationName;
    Object.setPrototypeOf(this, MaxRetriesExceededError.prototype);
  }
}

/**
 * Error thrown when an operation times out
 */
export class OperationTimeoutError extends ErrorHandlerError {
  /** Timeout duration in milliseconds */
  public readonly timeoutMs: number;
  /** Name of the operation that timed out */
  public readonly operationName: string | undefined;

  constructor(timeoutMs: number, operationName?: string) {
    const opName = operationName !== undefined ? ` '${operationName}'` : '';
    super(`Operation${opName} timed out after ${String(timeoutMs)}ms`, 'OPERATION_TIMEOUT');
    this.name = 'OperationTimeoutError';
    this.timeoutMs = timeoutMs;
    this.operationName = operationName;
    Object.setPrototypeOf(this, OperationTimeoutError.prototype);
  }
}

/**
 * Error thrown when an operation is aborted
 */
export class OperationAbortedError extends ErrorHandlerError {
  /** Reason for abortion */
  public readonly reason: string | undefined;
  /** Name of the operation that was aborted */
  public readonly operationName: string | undefined;

  constructor(operationName?: string, reason?: string) {
    const opName = operationName !== undefined ? ` '${operationName}'` : '';
    const reasonMsg = reason !== undefined ? `: ${reason}` : '';
    super(`Operation${opName} was aborted${reasonMsg}`, 'OPERATION_ABORTED');
    this.name = 'OperationAbortedError';
    this.reason = reason;
    this.operationName = operationName;
    Object.setPrototypeOf(this, OperationAbortedError.prototype);
  }
}

/**
 * Error thrown when an error is categorized as non-retryable
 */
export class NonRetryableError extends ErrorHandlerError {
  /** The original non-retryable error */
  public readonly originalError: Error;
  /** Category determined for the error */
  public readonly category: string;

  constructor(originalError: Error, category: string = 'non-retryable') {
    super(`Non-retryable error encountered: ${originalError.message}`, 'NON_RETRYABLE_ERROR');
    this.name = 'NonRetryableError';
    this.originalError = originalError;
    this.category = category;
    Object.setPrototypeOf(this, NonRetryableError.prototype);
  }
}

/**
 * Error thrown when retry policy validation fails
 */
export class InvalidRetryPolicyError extends ErrorHandlerError {
  /** The invalid policy field */
  public readonly field: string;
  /** The invalid value */
  public readonly value: unknown;
  /** Expected constraint */
  public readonly constraint: string;

  constructor(field: string, value: unknown, constraint: string) {
    super(
      `Invalid retry policy: ${field} (${String(value)}) ${constraint}`,
      'INVALID_RETRY_POLICY'
    );
    this.name = 'InvalidRetryPolicyError';
    this.field = field;
    this.value = value;
    this.constraint = constraint;
    Object.setPrototypeOf(this, InvalidRetryPolicyError.prototype);
  }
}

/**
 * Wrapper error that preserves the original error while adding retry context
 */
export class RetryContextError extends ErrorHandlerError {
  /** The original error */
  public readonly originalError: Error;
  /** Current attempt number */
  public readonly attempt: number;
  /** Maximum attempts allowed */
  public readonly maxAttempts: number;
  /** Whether this was the final attempt */
  public readonly isFinalAttempt: boolean;

  constructor(originalError: Error, attempt: number, maxAttempts: number) {
    super(
      `Retry attempt ${String(attempt)}/${String(maxAttempts)} failed: ${originalError.message}`,
      'RETRY_CONTEXT_ERROR'
    );
    this.name = 'RetryContextError';
    this.originalError = originalError;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
    this.isFinalAttempt = attempt >= maxAttempts;
    Object.setPrototypeOf(this, RetryContextError.prototype);
  }
}
