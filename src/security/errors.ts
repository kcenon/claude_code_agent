/**
 * Security-related error classes
 */

/**
 * Base class for security-related errors
 */
export class SecurityError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

/**
 * Error thrown when a required secret is missing
 */
export class SecretNotFoundError extends SecurityError {
  public readonly secretKey: string;

  constructor(key: string) {
    super(`Secret not found: ${key}`, 'SECRET_NOT_FOUND');
    this.name = 'SecretNotFoundError';
    this.secretKey = key;
    Object.setPrototypeOf(this, SecretNotFoundError.prototype);
  }
}

/**
 * Error thrown when path traversal is detected
 */
export class PathTraversalError extends SecurityError {
  public readonly attemptedPath: string;

  constructor(path: string) {
    super('Path traversal detected', 'PATH_TRAVERSAL');
    this.name = 'PathTraversalError';
    this.attemptedPath = path;
    Object.setPrototypeOf(this, PathTraversalError.prototype);
  }
}

/**
 * Error thrown when URL validation fails
 */
export class InvalidUrlError extends SecurityError {
  public readonly url: string;
  public readonly reason: string;

  constructor(url: string, reason: string) {
    super(`Invalid URL: ${reason}`, 'INVALID_URL');
    this.name = 'InvalidUrlError';
    this.url = url;
    this.reason = reason;
    Object.setPrototypeOf(this, InvalidUrlError.prototype);
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends SecurityError {
  public readonly field: string;
  public readonly constraint: string;

  constructor(field: string, constraint: string) {
    super(`Validation failed for ${field}: ${constraint}`, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
    this.constraint = constraint;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitExceededError extends SecurityError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limit exceeded. Retry after ${String(retryAfterMs)}ms`, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitExceededError';
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}
