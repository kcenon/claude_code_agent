/**
 * Utilities - Shared Utilities and Infrastructure
 *
 * This module exports shared utilities for:
 * - Security utilities
 * - Common utilities
 * - Error handling
 * - Logging
 * - Configuration
 * - Telemetry
 * - Monitoring
 * - Completion
 * - Status display
 *
 * @packageDocumentation
 */

// Re-export security module (explicit exports to avoid conflicts)
export {
  // Errors
  CommandInjectionError,
  CommandNotAllowedError,
  InvalidUrlError,
  PathTraversalError,
  RateLimitExceededError,
  SecretNotFoundError,
  SecurityError,
  ValidationError as SecurityValidationError,
  WhitelistUpdateError,
  // SecretManager
  SecretManager,
  getSecretManager,
  resetSecretManager,
  // InputValidator
  InputValidator,
  // AuditLogger
  AuditLogger,
  getAuditLogger,
  resetAuditLogger,
  SECURITY_SENSITIVE_EVENTS,
  // SecureFileHandler
  SecureFileHandler,
  getSecureFileHandler,
  resetSecureFileHandler,
  // RateLimiter
  RateLimiter,
  RateLimiters,
  // CommandSanitizer
  CommandSanitizer,
  getCommandSanitizer,
  resetCommandSanitizer,
  // CommandWhitelist
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
  // PathResolver
  PathResolver,
  // SecureFileOps
  SecureFileOps,
  getSecureFileOps,
  createSecureFileOps,
  resetSecureFileOps,
} from '../security/index.js';

export type {
  AuditEvent,
  AuditEventResult,
  AuditEventType,
  AuditLogEntry as SecurityAuditLogEntry,
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
  ValidationResult as SecurityValidationResult,
  WhitelistSource,
  WhitelistSourceType,
  WhitelistUpdateOptions,
  WhitelistUpdateResult,
  WhitelistSnapshot,
  ArgPattern,
  CommandConfig,
  CommandWhitelistConfig,
  PathResolverOptions,
  ResolvedPath,
  SecureFileOpsConfig,
  WriteOptions as SecureWriteOptions,
  ReadOptions as SecureReadOptions,
  MkdirOptions,
} from '../security/index.js';

// Re-export utils module
export * from '../utils/index.js';

// Re-export errors module (explicit exports to avoid conflicts)
export {
  ErrorSeverity,
  ErrorCodes,
  ControllerErrorCodes,
  WorkerErrorCodes,
  StateManagerErrorCodes,
  PRReviewerErrorCodes,
  ErrorHandlerErrorCodes,
  ScratchpadErrorCodes,
  ConfigErrorCodes,
  SecurityErrorCodes,
  MonitoringErrorCodes,
  GenericErrorCodes,
  ErrorCodeDescriptions,
  AppError,
  ErrorHandler,
} from '../errors/index.js';

export type {
  ErrorCategory as ErrorsCategory,
  ErrorContext,
  SerializedError,
  AppErrorOptions,
  ErrorFormatStyle,
  ErrorHandleOptions,
  ErrorCode,
  ErrorInfo,
} from '../errors/index.js';

// Re-export error-handler module (explicit exports to avoid conflicts)
export {
  DEFAULT_RETRY_POLICY,
  RETRYABLE_ERROR_PATTERNS,
  NON_RETRYABLE_ERROR_PATTERNS,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  ErrorHandlerError,
  MaxRetriesExceededError,
  OperationTimeoutError,
  OperationAbortedError,
  NonRetryableError,
  InvalidRetryPolicyError,
  RetryContextError,
  CircuitOpenError,
  InvalidCircuitBreakerConfigError,
  withRetry,
  withRetryResult,
  createRetryableFunction,
  calculateDelay,
  defaultErrorClassifier,
  RetryHandler,
  CircuitBreaker,
  createCircuitBreakerFunction,
} from '../error-handler/index.js';

export type {
  BackoffStrategy,
  ErrorCategory as RetryErrorCategory,
  RetryPolicy,
  TimeoutConfig,
  RetryContext,
  RetryAttemptResult,
  RetryResult,
  ErrorClassifier,
  RetryEventCallback,
  WithRetryOptions,
  CircuitBreakerIntegration,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerEvent,
  CircuitBreakerEventType,
  CircuitBreakerEventCallback,
} from '../error-handler/index.js';

// Re-export logging module (explicit exports to avoid conflicts)
export {
  Logger,
  getLogger,
  getLoggerFromEnv,
  resetLogger,
  LogContext,
  getLogContext,
  runWithContext,
  withSpan,
  withAgent,
  getCurrentCorrelationId,
  getCurrentTraceContext,
  generateCorrelationId,
} from '../logging/index.js';

export type {
  LoggerConfig,
  EnvironmentConfig,
  LoggerState,
  LoggerHealth,
  LogContextData,
  TraceContext,
  AgentContext,
  CreateContextOptions,
  CreateSpanOptions,
} from '../logging/index.js';

// Re-export logging transports (using namespace to avoid conflicts)
export * as LoggingTransports from '../logging/transports/index.js';

// Re-export config module (explicit exports to avoid conflicts)
export {
  CONFIG_SCHEMA_VERSION,
  WorkflowConfigSchema,
  AgentsConfigSchema,
  TelemetryConfigSchema,
  OpenTelemetryConfigSchema,
  ObservabilityConfigSchema,
  SCHEMA_METADATA,
  ConfigParseError,
  ConfigValidationError,
  ConfigNotFoundError,
  ConfigWatchError,
  validateWorkflowConfig,
  validateAgentsConfig,
  assertWorkflowConfig,
  assertAgentsConfig,
  getConfigSchemaVersion,
  isCompatibleConfigVersion,
  getConfigDir,
  getConfigFilePath,
  getAllConfigFilePaths,
  loadWorkflowConfig,
  loadAgentsConfig,
  loadAllConfigs,
  validateConfigFile,
  validateAllConfigs,
  configFilesExist,
  getConfigFileType,
  clearConfigCache,
  invalidateConfigCache,
  getConfigCacheStats,
  ConfigWatcher,
  watchConfigFiles,
  watchConfigWithLogging,
  ConfigManager,
  getConfigManager,
  resetConfigManager,
  isConfigManagerInitialized,
  resolveEnvVars,
} from '../config/index.js';

export type {
  FieldError as ConfigFieldError,
  ValidationResult as ConfigValidationResult,
  WorkflowConfig,
  AgentsConfig,
  ScratchpadConfig,
  TelemetryConfigType,
  OpenTelemetryConfigType,
  ObservabilityConfigType,
  ConfigFileType,
  LoadConfigOptions,
  FileChangeCallback,
  WatchOptions,
  ValidateCommandOptions,
  ValidationReport,
  FileValidationResult,
  RetryPolicy as ConfigRetryPolicy,
  GlobalConfig,
  PipelineStage as ConfigPipelineStage,
  AgentWorkflowConfig,
  QualityGates,
  DocumentQualityGate,
  ConfigManagerOptions,
} from '../config/index.js';

// Re-export telemetry module
export {
  Telemetry,
  getTelemetry,
  resetTelemetry,
  isTelemetryInitialized,
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
  DEFAULT_TELEMETRY_CONFIG,
  TelemetryError,
  ConsentRequiredError,
  ConsentStorageError,
  InvalidEventError,
  FlushError,
  TelemetryDisabledError,
} from '../telemetry/index.js';

export type {
  ConsentStatus,
  ConsentRecord,
  TelemetryEventType,
  TelemetryEvent,
  CommandExecutedEvent,
  PipelineEvent,
  AgentInvokedEvent,
  FeatureUsedEvent,
  TelemetryConfig,
  TelemetryOptions,
  PrivacyPolicy,
  TelemetrySession,
  TelemetryStats,
} from '../telemetry/index.js';

// Re-export monitoring module (using namespace to avoid conflicts)
export * as Monitoring from '../monitoring/index.js';

// Re-export completion module
export * from '../completion/index.js';

// Re-export status module (explicit exports to avoid conflicts)
export { StatusService, getStatusService, resetStatusService } from '../status/index.js';

export type {
  StatusOptions,
  OutputFormat as StatusOutputFormat,
  StageStatus,
  StageInfo,
  IssueStatusCounts,
  WorkerStatus as StatusWorkerStatus,
  ActivityEntry,
  ProjectStatus,
  PipelineStatus as StatusPipelineStatus,
  StatusDisplayResult,
} from '../status/index.js';

// Re-export safe cleanup utilities
export { safeCleanup, safeCleanupSync, fireAndForgetCleanup } from './safeCleanup.js';

export type { CleanupLogger, SafeCleanupOptions, CleanupResult } from './safeCleanup.js';
