/**
 * Init module - Project scaffolding and initialization
 *
 * @packageDocumentation
 */

// Types
export type {
  InitOptions,
  InitResult,
  PrerequisiteCheck,
  PrerequisiteResult,
  PrerequisiteValidationResult,
  QualityGateConfig,
  QualityGateLevel,
  TechStack,
  TemplateCompatibilityResult,
  TemplateConfig,
  TemplateMigrationResult,
  TemplateMigrationStep,
  TemplateType,
  TemplateVersion,
  WorkflowConfig,
} from './types.js';

export { CURRENT_TEMPLATE_VERSION, QUALITY_GATE_CONFIGS, TEMPLATE_CONFIGS } from './types.js';

// Errors
export {
  ConfigurationError,
  FileSystemError,
  GitHubError,
  InitError,
  PrerequisiteError,
  ProjectExistsError,
  TemplateMigrationError,
  TemplateNotFoundError,
  TemplateVersionError,
} from './errors.js';

// PrerequisiteValidator
export {
  getPrerequisiteValidator,
  PrerequisiteValidator,
  resetPrerequisiteValidator,
} from './PrerequisiteValidator.js';

// ProjectInitializer
export {
  cleanupEmptyScaffolds,
  createProjectInitializer,
  isEmptyDirectory,
  ProjectInitializer,
  resetProjectInitializer,
} from './ProjectInitializer.js';

// ProjectInitializerAgentAdapter
export {
  ProjectInitializerAgentAdapter,
  PROJECT_INITIALIZER_AGENT_ID,
} from './ProjectInitializerAgentAdapter.js';

// InteractiveWizard
export { createInteractiveWizard, InteractiveWizard } from './InteractiveWizard.js';

// TemplateVersioning
export {
  clearMigrations,
  compareVersions,
  findMigrationPath,
  formatVersion,
  getCurrentVersion,
  getMigrations,
  isVersionCompatible,
  migrateTemplate,
  needsMigration,
  parseVersion,
  registerMigration,
  validateTemplateCompatibility,
  versionsEqual,
} from './TemplateVersioning.js';

export { loadAssetBundle } from './AgentAssets.js';
export type { AssetBundle, AssetManifest, ValidatedAsset } from './AgentAssets.js';
export { updateAssets } from './AssetUpdater.js';
export type {
  AssetUpdateOptions,
  AssetUpdateResult,
  AssetUpdateChange,
  AssetLock,
} from './AssetUpdater.js';
