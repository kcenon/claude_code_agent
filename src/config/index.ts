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
  SCHEMA_METADATA,
} from './schemas.js';

// Types
export type {
  FieldError,
  ValidationResult,
  WorkflowConfig,
  AgentsConfig,
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
} from './loader.js';

// Watcher
export { ConfigWatcher, watchConfigFiles, watchConfigWithLogging } from './watcher.js';
