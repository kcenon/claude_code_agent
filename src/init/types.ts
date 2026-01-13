/**
 * Types for the project initialization module
 *
 * @packageDocumentation
 */

/**
 * Supported technology stacks for project initialization
 */
export type TechStack = 'typescript' | 'python' | 'java' | 'go' | 'rust' | 'other';

/**
 * Project template variants
 */
export type TemplateType = 'minimal' | 'standard' | 'enterprise';

/**
 * Quality gate configuration levels
 */
export type QualityGateLevel = 'basic' | 'standard' | 'strict';

/**
 * Configuration options for project initialization
 */
export interface InitOptions {
  /** Project name (defaults to current directory name) */
  readonly projectName: string;

  /** Project description */
  readonly description?: string | undefined;

  /** GitHub repository URL (optional) */
  readonly githubRepo?: string | undefined;

  /** Primary technology stack */
  readonly techStack: TechStack;

  /** Project template variant */
  readonly template: TemplateType;

  /** Target directory for initialization (defaults to cwd) */
  readonly targetDir?: string | undefined;

  /** Skip interactive prompts and use defaults */
  readonly quick?: boolean | undefined;

  /** Skip prerequisite validation */
  readonly skipValidation?: boolean | undefined;
}

/**
 * Semantic version for templates
 */
export interface TemplateVersion {
  /** Major version (breaking changes) */
  readonly major: number;
  /** Minor version (new features, backward compatible) */
  readonly minor: number;
  /** Patch version (bug fixes) */
  readonly patch: number;
}

/**
 * Template configuration for different project variants
 */
export interface TemplateConfig {
  /** Template version */
  readonly version: TemplateVersion;

  /** Agent configuration set */
  readonly agents: 'default';

  /** Quality gate level */
  readonly qualityGates: QualityGateLevel;

  /** Number of parallel workers */
  readonly parallelWorkers: number;

  /** Additional features enabled */
  readonly extraFeatures: readonly string[];
}

/**
 * Template configurations by type
 */
/**
 * Current template version constant
 */
export const CURRENT_TEMPLATE_VERSION: TemplateVersion = {
  major: 1,
  minor: 0,
  patch: 0,
};

export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  minimal: {
    version: CURRENT_TEMPLATE_VERSION,
    agents: 'default',
    qualityGates: 'basic',
    parallelWorkers: 2,
    extraFeatures: [],
  },
  standard: {
    version: CURRENT_TEMPLATE_VERSION,
    agents: 'default',
    qualityGates: 'standard',
    parallelWorkers: 3,
    extraFeatures: ['token_tracking', 'progress_dashboard'],
  },
  enterprise: {
    version: CURRENT_TEMPLATE_VERSION,
    agents: 'default',
    qualityGates: 'strict',
    parallelWorkers: 5,
    extraFeatures: ['token_tracking', 'progress_dashboard', 'audit_logging', 'security_scanning'],
  },
};

/**
 * Prerequisite check definition
 */
export interface PrerequisiteCheck {
  /** Display name for the check */
  readonly name: string;

  /** Function to perform the check */
  readonly check: () => Promise<boolean>;

  /** Instructions to fix if check fails */
  readonly fix: string;

  /** Whether this check is required (fails init) or optional (warning only) */
  readonly required: boolean;
}

/**
 * Result of prerequisite validation
 */
export interface PrerequisiteResult {
  /** Name of the prerequisite */
  readonly name: string;

  /** Whether the check passed */
  readonly passed: boolean;

  /** Fix instruction if check failed */
  readonly fix?: string | undefined;

  /** Whether this was a required check */
  readonly required: boolean;
}

/**
 * Overall validation result for prerequisites
 */
export interface PrerequisiteValidationResult {
  /** All prerequisite check results */
  readonly checks: readonly PrerequisiteResult[];

  /** Whether all required checks passed */
  readonly valid: boolean;

  /** Number of warnings (optional checks that failed) */
  readonly warnings: number;
}

/**
 * Result of project initialization
 */
export interface InitResult {
  /** Whether initialization succeeded */
  readonly success: boolean;

  /** Path to the initialized project */
  readonly projectPath: string;

  /** List of created files and directories */
  readonly createdFiles: readonly string[];

  /** Any warnings generated during initialization */
  readonly warnings: readonly string[];

  /** Error message if initialization failed */
  readonly error?: string;
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  /** Minimum test coverage percentage */
  readonly coverage: number;

  /** Maximum cyclomatic complexity */
  readonly complexity: number;

  /** Require PR reviews */
  readonly requireReview: boolean;

  /** Require all tests to pass */
  readonly requireTests: boolean;
}

/**
 * Quality gate configurations by level
 */
export const QUALITY_GATE_CONFIGS: Record<QualityGateLevel, QualityGateConfig> = {
  basic: {
    coverage: 50,
    complexity: 20,
    requireReview: false,
    requireTests: true,
  },
  standard: {
    coverage: 70,
    complexity: 15,
    requireReview: true,
    requireTests: true,
  },
  strict: {
    coverage: 80,
    complexity: 10,
    requireReview: true,
    requireTests: true,
  },
};

/**
 * Workflow configuration structure
 */
export interface WorkflowConfig {
  /** Workflow version */
  readonly version: string;

  /** Pipeline configuration */
  readonly pipeline: {
    readonly stages: readonly {
      readonly name: string;
      readonly agent: string;
      readonly timeout_ms: number;
    }[];
  };

  /** Quality gates configuration */
  readonly quality_gates: QualityGateConfig;

  /** Execution configuration */
  readonly execution: {
    readonly max_parallel_workers: number;
    readonly retry_attempts: number;
    readonly retry_delay_ms: number;
  };
}

/**
 * Template compatibility check result
 */
export interface TemplateCompatibilityResult {
  /** Whether templates are compatible */
  readonly compatible: boolean;

  /** Source version being checked */
  readonly sourceVersion: TemplateVersion;

  /** Target version being checked against */
  readonly targetVersion: TemplateVersion;

  /** Compatibility issues found */
  readonly issues: readonly string[];

  /** Whether migration is possible */
  readonly canMigrate: boolean;

  /** Required migrations if applicable */
  readonly requiredMigrations: readonly string[];
}

/**
 * Template migration step definition
 */
export interface TemplateMigrationStep {
  /** Source version this migration starts from */
  readonly fromVersion: TemplateVersion;

  /** Target version this migration produces */
  readonly toVersion: TemplateVersion;

  /** Description of what this migration does */
  readonly description: string;

  /** Migration function */
  readonly migrate: (config: TemplateConfig) => TemplateConfig;
}

/**
 * Result of template migration
 */
export interface TemplateMigrationResult {
  /** Whether migration was successful */
  readonly success: boolean;

  /** Original template configuration */
  readonly original: TemplateConfig;

  /** Migrated template configuration */
  readonly migrated: TemplateConfig | null;

  /** Migration steps applied */
  readonly appliedSteps: readonly string[];

  /** Error message if migration failed */
  readonly error?: string;
}
