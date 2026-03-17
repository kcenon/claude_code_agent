/**
 * Error Handler module error definitions
 *
 * Custom error classes for retry operations, timeout handling,
 * and error categorization. All errors extend AppError for unified
 * error handling with standardized codes, severity, and context.
 *
 * @module error-handler/errors
 */

import { AppError } from '../errors/AppError.js';
import { ErrorHandlerErrorCodes } from '../errors/codes.js';
import { ErrorSeverity } from '../errors/types.js';
import type { AppErrorOptions } from '../errors/types.js';
import type { RetryAttemptResult } from './types.js';

/**
 * Base class for error handler errors
 */
export class ErrorHandlerError extends AppError {
  constructor(message: string, code: string = ErrorHandlerErrorCodes.ERH_MAX_RETRIES_EXCEEDED, options: AppErrorOptions = {}) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.MEDIUM,
      category: options.category ?? 'transient',
      context: options.context ?? {},
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.name = 'ErrorHandlerError';
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
      ErrorHandlerErrorCodes.ERH_MAX_RETRIES_EXCEEDED,
      {
        severity: ErrorSeverity.HIGH,
        category: 'recoverable',
        context: { attempts, maxAttempts, operationName },
        ...(lastError !== undefined ? { cause: lastError } : {}),
      }
    );
    this.name = 'MaxRetriesExceededError';
    this.attempts = attempts;
    this.maxAttempts = maxAttempts;
    this.lastError = lastError;
    this.attemptResults = attemptResults;
    this.operationName = operationName;
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
    super(
      `Operation${opName} timed out after ${String(timeoutMs)}ms`,
      ErrorHandlerErrorCodes.ERH_OPERATION_TIMEOUT,
      {
        severity: ErrorSeverity.HIGH,
        category: 'transient',
        context: { timeoutMs, operationName },
      }
    );
    this.name = 'OperationTimeoutError';
    this.timeoutMs = timeoutMs;
    this.operationName = operationName;
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
    super(
      `Operation${opName} was aborted${reasonMsg}`,
      ErrorHandlerErrorCodes.ERH_OPERATION_ABORTED,
      {
        severity: ErrorSeverity.MEDIUM,
        category: 'fatal',
        context: { operationName, reason },
      }
    );
    this.name = 'OperationAbortedError';
    this.reason = reason;
    this.operationName = operationName;
  }
}

/**
 * Error thrown when an error is categorized as non-retryable
 */
export class NonRetryableError extends ErrorHandlerError {
  /** The original non-retryable error */
  public readonly originalError: Error;
  /** Classification category determined for the error (e.g., 'validation', 'authentication') */
  public readonly errorKind: string;

  constructor(originalError: Error, errorKind: string = 'non-retryable') {
    super(
      `Non-retryable error encountered: ${originalError.message}`,
      ErrorHandlerErrorCodes.ERH_NON_RETRYABLE,
      {
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
        context: { errorKind },
        cause: originalError,
      }
    );
    this.name = 'NonRetryableError';
    this.originalError = originalError;
    this.errorKind = errorKind;
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
      ErrorHandlerErrorCodes.ERH_INVALID_RETRY_POLICY,
      {
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
        context: { field, value: String(value), constraint },
      }
    );
    this.name = 'InvalidRetryPolicyError';
    this.field = field;
    this.value = value;
    this.constraint = constraint;
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
      ErrorHandlerErrorCodes.ERH_RETRY_CONTEXT,
      {
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
        context: { attempt, maxAttempts, isFinalAttempt: attempt >= maxAttempts },
        cause: originalError,
      }
    );
    this.name = 'RetryContextError';
    this.originalError = originalError;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
    this.isFinalAttempt = attempt >= maxAttempts;
  }
}

/**
 * Error thrown when the circuit breaker is open and rejecting requests
 */
export class CircuitOpenError extends ErrorHandlerError {
  /** Time remaining until the circuit may transition to HALF_OPEN */
  public readonly remainingTimeoutMs: number;
  /** Name of the circuit breaker */
  public readonly circuitName: string | undefined;
  /** Current failure count that triggered the open state */
  public readonly failureCount: number;

  constructor(remainingTimeoutMs: number, failureCount: number, circuitName?: string) {
    const name = circuitName !== undefined ? ` '${circuitName}'` : '';
    super(
      `Circuit breaker${name} is open. Retry after ${String(remainingTimeoutMs)}ms`,
      ErrorHandlerErrorCodes.ERH_CIRCUIT_OPEN,
      {
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
        context: { remainingTimeoutMs, failureCount, circuitName },
      }
    );
    this.name = 'CircuitOpenError';
    this.remainingTimeoutMs = remainingTimeoutMs;
    this.circuitName = circuitName;
    this.failureCount = failureCount;
  }
}

/**
 * Error thrown when circuit breaker configuration is invalid
 */
export class InvalidCircuitBreakerConfigError extends ErrorHandlerError {
  /** The invalid config field */
  public readonly field: string;
  /** The invalid value */
  public readonly value: unknown;
  /** Expected constraint */
  public readonly constraint: string;

  constructor(field: string, value: unknown, constraint: string) {
    super(
      `Invalid circuit breaker config: ${field} (${String(value)}) ${constraint}`,
      ErrorHandlerErrorCodes.ERH_INVALID_CIRCUIT_BREAKER,
      {
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
        context: { field, value: String(value), constraint },
      }
    );
    this.name = 'InvalidCircuitBreakerConfigError';
    this.field = field;
    this.value = value;
    this.constraint = constraint;
  }
}
