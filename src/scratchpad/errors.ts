/**
 * Scratchpad error classes
 *
 * Custom error types for file locking operations
 */

/**
 * Base class for lock-related errors
 */
export class LockError extends Error {
  /** File path that the lock operation was attempted on */
  public readonly filePath: string;

  constructor(message: string, filePath: string) {
    super(message);
    this.name = 'LockError';
    this.filePath = filePath;
    // Maintains proper stack trace for where error was thrown (only available on V8)
    /* v8 ignore next 3 */
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when lock acquisition fails after max retries
 *
 * This indicates that the lock is heavily contended and the
 * operation could not acquire it within the configured retry limits.
 */
export class LockContentionError extends LockError {
  /** Number of retry attempts that were made */
  public readonly attempts: number;

  constructor(filePath: string, attempts: number) {
    super(
      `Failed to acquire lock for "${filePath}" after ${String(attempts)} attempts. ` +
        'The lock is heavily contended.',
      filePath
    );
    this.name = 'LockContentionError';
    this.attempts = attempts;
  }
}

/**
 * Error thrown when a held lock is stolen by another process
 *
 * This can happen when:
 * - The lock expired while the holder was still using it
 * - Another process forcibly stole the lock
 * - There was a system clock skew
 */
export class LockStolenError extends LockError {
  /** ID of the original lock holder */
  public readonly originalHolderId: string;
  /** ID of the new lock holder (if known) */
  public readonly newHolderId: string | undefined;

  constructor(filePath: string, originalHolderId: string, newHolderId?: string) {
    const newHolderInfo = newHolderId !== undefined ? ` by holder "${newHolderId}"` : '';
    super(
      `Lock for "${filePath}" was stolen from holder "${originalHolderId}"${newHolderInfo}. ` +
        'The lock may have expired or been forcibly taken.',
      filePath
    );
    this.name = 'LockStolenError';
    this.originalHolderId = originalHolderId;
    this.newHolderId = newHolderId;
  }
}

/**
 * Error thrown when lock operation times out
 */
export class LockTimeoutError extends LockError {
  /** Timeout duration in milliseconds */
  public readonly timeoutMs: number;

  constructor(filePath: string, timeoutMs: number) {
    super(`Lock operation for "${filePath}" timed out after ${String(timeoutMs)}ms.`, filePath);
    this.name = 'LockTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Base class for Redis-related errors
 */
export class RedisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisError';
    /* v8 ignore next 3 */
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when Redis connection fails
 */
export class RedisConnectionError extends RedisError {
  /** Host that failed to connect */
  public readonly host: string;
  /** Port that failed to connect */
  public readonly port: number;

  constructor(host: string, port: number, cause?: Error) {
    const causeMsg = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to connect to Redis at ${host}:${String(port)}${causeMsg}`);
    this.name = 'RedisConnectionError';
    this.host = host;
    this.port = port;
    this.cause = cause;
  }
}

/**
 * Error thrown when Redis distributed lock acquisition fails
 */
export class RedisLockError extends RedisError {
  /** Lock key that failed */
  public readonly lockKey: string;

  constructor(lockKey: string, message: string) {
    super(message);
    this.name = 'RedisLockError';
    this.lockKey = lockKey;
  }
}

/**
 * Error thrown when Redis lock acquisition times out
 */
export class RedisLockTimeoutError extends RedisLockError {
  /** Timeout duration in milliseconds */
  public readonly timeoutMs: number;

  constructor(lockKey: string, timeoutMs: number) {
    super(
      lockKey,
      `Failed to acquire Redis lock "${lockKey}" within ${String(timeoutMs)}ms timeout.`
    );
    this.name = 'RedisLockTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}
