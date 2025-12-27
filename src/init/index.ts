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
  TemplateConfig,
  TemplateType,
  WorkflowConfig,
} from './types.js';

export { QUALITY_GATE_CONFIGS, TEMPLATE_CONFIGS } from './types.js';

// Errors
export {
  ConfigurationError,
  FileSystemError,
  GitHubError,
  InitError,
  PrerequisiteError,
  ProjectExistsError,
  TemplateNotFoundError,
} from './errors.js';

// PrerequisiteValidator
export {
  getPrerequisiteValidator,
  PrerequisiteValidator,
  resetPrerequisiteValidator,
} from './PrerequisiteValidator.js';

// ProjectInitializer
export {
  createProjectInitializer,
  ProjectInitializer,
  resetProjectInitializer,
} from './ProjectInitializer.js';

// InteractiveWizard
export { createInteractiveWizard, InteractiveWizard } from './InteractiveWizard.js';
