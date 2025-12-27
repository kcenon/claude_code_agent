import { describe, it, expect } from 'vitest';
import {
  SecurityError,
  SecretNotFoundError,
  PathTraversalError,
  InvalidUrlError,
  ValidationError,
  RateLimitExceededError,
} from '../../src/security/index.js';

describe('SecurityError', () => {
  it('should create with message and default code', () => {
    const error = new SecurityError('Test error');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('SECURITY_ERROR');
    expect(error.name).toBe('SecurityError');
  });

  it('should create with custom code', () => {
    const error = new SecurityError('Custom error', 'CUSTOM_CODE');

    expect(error.code).toBe('CUSTOM_CODE');
  });

  it('should be instanceof Error', () => {
    const error = new SecurityError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SecurityError);
  });
});

describe('SecretNotFoundError', () => {
  it('should create with secret key', () => {
    const error = new SecretNotFoundError('API_KEY');

    expect(error.message).toBe('Secret not found: API_KEY');
    expect(error.secretKey).toBe('API_KEY');
    expect(error.code).toBe('SECRET_NOT_FOUND');
    expect(error.name).toBe('SecretNotFoundError');
  });

  it('should be instanceof SecurityError', () => {
    const error = new SecretNotFoundError('KEY');

    expect(error).toBeInstanceOf(SecurityError);
  });
});

describe('PathTraversalError', () => {
  it('should create with attempted path', () => {
    const error = new PathTraversalError('../etc/passwd');

    expect(error.message).toBe('Path traversal detected');
    expect(error.attemptedPath).toBe('../etc/passwd');
    expect(error.code).toBe('PATH_TRAVERSAL');
    expect(error.name).toBe('PathTraversalError');
  });

  it('should be instanceof SecurityError', () => {
    const error = new PathTraversalError('/path');

    expect(error).toBeInstanceOf(SecurityError);
  });
});

describe('InvalidUrlError', () => {
  it('should create with URL and reason', () => {
    const error = new InvalidUrlError('http://localhost', 'Internal URLs not allowed');

    expect(error.message).toBe('Invalid URL: Internal URLs not allowed');
    expect(error.url).toBe('http://localhost');
    expect(error.reason).toBe('Internal URLs not allowed');
    expect(error.code).toBe('INVALID_URL');
    expect(error.name).toBe('InvalidUrlError');
  });

  it('should be instanceof SecurityError', () => {
    const error = new InvalidUrlError('url', 'reason');

    expect(error).toBeInstanceOf(SecurityError);
  });
});

describe('ValidationError', () => {
  it('should create with field and constraint', () => {
    const error = new ValidationError('email', 'must be valid email format');

    expect(error.message).toBe('Validation failed for email: must be valid email format');
    expect(error.field).toBe('email');
    expect(error.constraint).toBe('must be valid email format');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });

  it('should be instanceof SecurityError', () => {
    const error = new ValidationError('field', 'constraint');

    expect(error).toBeInstanceOf(SecurityError);
  });
});

describe('RateLimitExceededError', () => {
  it('should create with retry after time', () => {
    const error = new RateLimitExceededError(30000);

    expect(error.message).toBe('Rate limit exceeded. Retry after 30000ms');
    expect(error.retryAfterMs).toBe(30000);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.name).toBe('RateLimitExceededError');
  });

  it('should be instanceof SecurityError', () => {
    const error = new RateLimitExceededError(1000);

    expect(error).toBeInstanceOf(SecurityError);
  });
});
