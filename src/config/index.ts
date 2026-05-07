/**
 * Configuration validation module
 *
 * Provides validation, loading, and watching for AD-SDLC
 * configuration files (workflow.yaml, agents.yaml).
 *
 * @module config
 */

// ============================================================
// Re-exports
// ============================================================

// Schemas
export {
  CONFIG_SCHEMA_VERSION,
  WorkflowConfigSchema,
  AgentsConfigSchema,
  TelemetryConfigSchema,
  OpenTelemetryConfigSchema,
  ObservabilityConfigSchema,
  SCHEMA_METADATA,
} from './schemas.js';

// Types
export type {
  FieldError,
  ValidationResult,
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
} from './types.js';

// Errors
export {
  ConfigParseError,
  ConfigValidationError,
  ConfigNotFoundError,
  ConfigWatchError,
} from './errors.js';

// Validation
export {
  validateWorkflowConfig,
  validateAgentsConfig,
  assertWorkflowConfig,
  assertAgentsConfig,
  getConfigSchemaVersion,
  isCompatibleConfigVersion,
} from './validation.js';

// Loader
export {
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
  // Cache management (Issue #256)
  clearConfigCache,
  invalidateConfigCache,
  getConfigCacheStats,
  // Cache snapshot/restore (Issue #595)
  snapshotConfigCache,
  restoreConfigCache,
} from './loader.js';

// Watcher
export { ConfigWatcher, watchConfigFiles, watchConfigWithLogging } from './watcher.js';

// ConfigManager
export {
  ConfigManager,
  getConfigManager,
  resetConfigManager,
  isConfigManagerInitialized,
  resolveEnvVars,
} from './ConfigManager.js';
export type {
  RetryPolicy,
  GlobalConfig,
  PipelineStage,
  AgentWorkflowConfig,
  QualityGates,
  DocumentQualityGate,
  ConfigManagerOptions,
} from './ConfigManager.js';

// Feature flags resolver (Issue #795)
export {
  FeatureFlagsResolver,
  ENV_USE_SDK_FOR_WORKER,
  FEATURE_FLAGS_FILE_NAME,
  DEFAULT_FEATURE_FLAGS,
  FeatureFlagsBlockSchema,
  FeatureFlagsFileSchema,
  parseBooleanEnv,
  getFeatureFlagsFilePath,
  loadFeatureFlagsFile,
} from './featureFlags.js';
export type {
  FeatureFlagsFile,
  FeatureFlagsConfig,
  CliFeatureFlags,
  FeatureFlagsResolverOptions,
} from './featureFlags.js';

// Paths
export {
  getProjectPaths,
  getPaths,
  resetPaths,
  getPath,
  resolvePath,
  getPathsForProject,
  getAdSdlcDir,
  getScratchpadDirs,
  getTemplatePath,
  getConfigFilePath as getConfigPath,
  PATH_ENV_VARS,
  DEFAULT_PATHS,
} from './paths.js';
export type { ProjectPaths } from './paths.js';
