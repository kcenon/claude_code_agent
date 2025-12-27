/**
 * Security module - Provides security utilities for the AD-SDLC system
 *
 * @packageDocumentation
 */

// Types
export type {
  AuditEvent,
  AuditEventResult,
  AuditEventType,
  AuditLogEntry,
  AuditLoggerOptions,
  InputValidatorOptions,
  RateLimitConfig,
  RateLimitStatus,
  SecretManagerOptions,
  SecureFileHandlerOptions,
  ValidationResult,
} from './types.js';

// Errors
export {
  SecurityError,
  SecretNotFoundError,
  PathTraversalError,
  InvalidUrlError,
  ValidationError,
  RateLimitExceededError,
} from './errors.js';

// SecretManager
export { SecretManager, getSecretManager, resetSecretManager } from './SecretManager.js';

// InputValidator
export { InputValidator } from './InputValidator.js';

// AuditLogger
export {
  AuditLogger,
  getAuditLogger,
  resetAuditLogger,
  SECURITY_SENSITIVE_EVENTS,
} from './AuditLogger.js';

// SecureFileHandler
export {
  SecureFileHandler,
  getSecureFileHandler,
  resetSecureFileHandler,
} from './SecureFileHandler.js';

// RateLimiter
export { RateLimiter, RateLimiters } from './RateLimiter.js';
