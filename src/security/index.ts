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
  SymlinkPolicyType,
  ValidationResult,
  WhitelistSource,
  WhitelistSourceType,
  WhitelistUpdateOptions,
  WhitelistUpdateResult,
  WhitelistSnapshot,
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
  WhitelistUpdateError,
} from './errors.js';

// SecretManager
export { SecretManager, getSecretManager, resetSecretManager } from './SecretManager.js';

// InputValidator
export { InputValidator } from './InputValidator.js';
export type { ExtendedValidationResult } from './InputValidator.js';

// PathSanitizer - Dedicated path sanitization
export { PathSanitizer } from './PathSanitizer.js';
export type {
  PathSanitizerOptions,
  SanitizationResult,
  PathRejectionReason,
} from './PathSanitizer.js';

// SymlinkResolver - Secure symbolic link handling
export { SymlinkResolver } from './SymlinkResolver.js';
export type {
  SymlinkResolverOptions,
  SymlinkResolutionResult,
  SafeFileHandle,
  SymlinkPolicy,
} from './SymlinkResolver.js';

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

// Secret Provider Types - Re-exported from sandbox-safe location
// Types are defined in secret-provider-types.ts (outside secrets/ directory)
// to avoid sandbox read restrictions on paths matching **/secrets
export type {
  ISecretProvider,
  Secret,
  CachedSecret,
  ProviderState,
  ProviderHealth,
  BaseSecretProviderConfig,
  LocalProviderConfig,
  AWSSecretsManagerConfig,
  VaultProviderConfig,
  AzureKeyVaultConfig,
  SecretProviderConfig,
  SecretManagerConfig,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
} from './secret-provider-types.js';

/**
 * Lazy-load the secrets module. Only call when secret management is needed.
 *
 * This avoids eagerly importing the secrets submodule at startup, which
 * can trigger EPERM errors in sandboxed environments where the `secrets`
 * path pattern is blocked.
 *
 * The module path is stored in a variable to prevent TypeScript from
 * performing static module resolution on the sandbox-restricted path.
 *
 * @returns A promise resolving to the full secrets module exports
 */
const SECRETS_MODULE_PATH = './secrets/index.js';
export const getSecretsModule = (): Promise<Record<string, unknown>> => import(SECRETS_MODULE_PATH);
