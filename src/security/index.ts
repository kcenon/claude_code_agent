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
  CommandExecResult,
  CommandSanitizerOptions,
  FileWatchCallback,
  FileWatcherConfig,
  FileWatcherHandle,
  FileWatchEvent,
  FileWatchEventType,
  FileWatchPatternFilter,
  InputValidatorOptions,
  RateLimitConfig,
  RateLimitStatus,
  SanitizedCommand,
  SecretManagerOptions,
  SecureFileHandlerOptions,
  ValidationResult,
} from './types.js';

// Errors
export {
  CommandInjectionError,
  CommandNotAllowedError,
  InvalidUrlError,
  PathTraversalError,
  RateLimitExceededError,
  SecretNotFoundError,
  SecurityError,
  ValidationError,
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

// CommandSanitizer
export {
  CommandSanitizer,
  getCommandSanitizer,
  resetCommandSanitizer,
} from './CommandSanitizer.js';

// CommandWhitelist
export {
  BRANCH_NAME_PATTERN,
  containsShellMetacharacters,
  DEFAULT_COMMAND_WHITELIST,
  ESCAPE_CHARS,
  getCommandConfig,
  isAllowedCommand,
  isAllowedSubcommand,
  PACKAGE_NAME_PATTERN,
  SAFE_PATH_PATTERN,
  SHELL_METACHARACTERS,
} from './CommandWhitelist.js';

export type { ArgPattern, CommandConfig, CommandWhitelistConfig } from './CommandWhitelist.js';

// PathResolver - Project-aware path resolution with security validation
export { PathResolver } from './PathResolver.js';
export type { PathResolverOptions, ResolvedPath } from './PathResolver.js';

// SecureFileOps - Centralized secure file operations wrapper
export {
  SecureFileOps,
  getSecureFileOps,
  createSecureFileOps,
  resetSecureFileOps,
} from './SecureFileOps.js';
export type {
  SecureFileOpsConfig,
  WriteOptions,
  ReadOptions,
  MkdirOptions,
} from './SecureFileOps.js';

// Secret Providers - Pluggable secret management with multiple backends
export * from './secrets/index.js';
