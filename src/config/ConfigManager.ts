/**
 * Configuration Manager
 *
 * Provides a unified interface for accessing workflow and agent configurations
 * with caching, environment variable substitution, and convenient accessor methods.
 *
 * @module config/ConfigManager
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { loadWorkflowConfig, loadAgentsConfig } from './loader.js';
import type { WorkflowConfig, AgentsConfig, LoadConfigOptions } from './types.js';

// ============================================================
// Types
// ============================================================

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoff: 'linear' | 'exponential';
  readonly baseDelaySeconds: number;
  readonly maxDelaySeconds: number;
}

/**
 * Global configuration settings
 */
export interface GlobalConfig {
  readonly projectRoot: string;
  readonly scratchpadDir: string;
  readonly outputDocsDir: string;
  readonly logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  readonly approvalGates: {
    readonly afterCollection: boolean;
    readonly afterPrd: boolean;
    readonly afterSrs: boolean;
    readonly afterSds: boolean;
    readonly afterIssues: boolean;
    readonly beforeMerge: boolean;
  };
  readonly retryPolicy: RetryPolicy;
  readonly timeouts: {
    readonly documentGeneration: number;
    readonly issueCreation: number;
    readonly implementation: number;
    readonly prReview: number;
  };
}

/**
 * Pipeline stage definition
 */
export interface PipelineStage {
  readonly name: string;
  readonly agent: string;
  readonly description: string | undefined;
  readonly inputs: readonly string[] | undefined;
  readonly outputs: readonly string[] | undefined;
  readonly next: string | null;
  readonly approvalRequired: boolean;
  readonly parallel: boolean;
  readonly maxParallel: number | undefined;
}

/**
 * Agent configuration in workflow
 */
export interface AgentWorkflowConfig {
  readonly model: 'sonnet' | 'opus' | 'haiku';
  readonly tools: readonly string[] | undefined;
  readonly template: string | undefined;
  readonly maxQuestions: number | undefined;
  readonly github:
    | {
        readonly labelsPrefix: string | undefined;
        readonly autoAssign: boolean | undefined;
        readonly mergeStrategy: 'merge' | 'squash' | 'rebase' | undefined;
        readonly deleteBranchAfterMerge: boolean | undefined;
      }
    | undefined;
  readonly scheduling:
    | {
        readonly algorithm: 'priority_only' | 'dependency_only' | 'priority_dependency' | undefined;
        readonly maxWorkers: number | undefined;
        readonly checkIntervalSeconds: number | undefined;
      }
    | undefined;
  readonly coding:
    | {
        readonly language: string | undefined;
        readonly testFramework: string | undefined;
        readonly lintCommand: string | undefined;
        readonly testCommand: string | undefined;
        readonly buildCommand: string | undefined;
      }
    | undefined;
  readonly verification:
    | {
        readonly runTests: boolean;
        readonly runLint: boolean;
        readonly runBuild: boolean;
        readonly coverageThreshold: number;
      }
    | undefined;
  readonly review:
    | {
        readonly autoMerge: boolean;
        readonly requireAllChecks: boolean;
        readonly coverageThreshold: number;
        readonly maxComplexity: number;
      }
    | undefined;
}

/**
 * Document quality gate settings
 */
export interface DocumentQualityGate {
  readonly requiredSections: readonly string[] | undefined;
  readonly minRequirements: number | undefined;
  readonly minFeatures: number | undefined;
  readonly minUseCasesPerFeature: number | undefined;
  readonly minComponents: number | undefined;
}

/**
 * Quality gates configuration
 */
export interface QualityGates {
  readonly documentQuality:
    | {
        readonly prd: DocumentQualityGate | undefined;
        readonly srs: DocumentQualityGate | undefined;
        readonly sds: DocumentQualityGate | undefined;
      }
    | undefined;
  readonly codeQuality:
    | {
        readonly coverageThreshold: number;
        readonly maxComplexity: number;
        readonly maxLineLength: number;
        readonly noTodosInCode: boolean;
        readonly noConsoleLogs: boolean;
      }
    | undefined;
  readonly security:
    | {
        readonly noHardcodedSecrets: boolean;
        readonly requireInputValidation: boolean;
        readonly requireAuthentication: boolean;
      }
    | undefined;
}

/**
 * Configuration manager options
 */
export interface ConfigManagerOptions extends LoadConfigOptions {
  /** Whether to resolve environment variables */
  readonly resolveEnvVars?: boolean;
}

// ============================================================
// Environment Variable Resolution
// ============================================================

/**
 * Resolve environment variables in a string
 *
 * @param value - String potentially containing ${VAR} patterns
 * @returns String with environment variables resolved
 */
export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (match, name: string) => {
    const envValue = process.env[name];
    return envValue !== undefined ? envValue : match;
  });
}

/**
 * Recursively resolve environment variables in an object
 *
 * @param obj - Object to process
 * @returns Object with all string values having env vars resolved
 */
function resolveEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => resolveEnvVarsInObject(item)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result as T;
  }
  return obj;
}

// ============================================================
// ConfigManager Class
// ============================================================

/**
 * Configuration Manager
 *
 * Provides centralized access to workflow and agent configurations
 * with caching and environment variable substitution.
 *
 * @example
 * ```typescript
 * const manager = await ConfigManager.create();
 * const global = manager.getGlobalConfig();
 * const stages = manager.getPipelineStages();
 * const agentConfig = manager.getAgentConfig('collector');
 * ```
 */
export class ConfigManager {
  private readonly workflowConfig: WorkflowConfig;
  private readonly agentsConfig: AgentsConfig;

  /**
   * Create a ConfigManager instance
   *
   * @param workflowConfig - Loaded workflow configuration
   * @param agentsConfig - Loaded agents configuration
   */
  private constructor(workflowConfig: WorkflowConfig, agentsConfig: AgentsConfig) {
    this.workflowConfig = workflowConfig;
    this.agentsConfig = agentsConfig;
  }

  /**
   * Create and initialize a ConfigManager
   *
   * @param options - Configuration options
   * @returns Initialized ConfigManager instance
   */
  static async create(options: ConfigManagerOptions = {}): Promise<ConfigManager> {
    const loadOptions: LoadConfigOptions =
      options.baseDir !== undefined && options.baseDir !== ''
        ? { baseDir: options.baseDir, validate: options.validate ?? true }
        : { validate: options.validate ?? true };

    const [workflowConfig, agentsConfig] = await Promise.all([
      loadWorkflowConfig(loadOptions),
      loadAgentsConfig(loadOptions),
    ]);

    const resolveEnv = options.resolveEnvVars ?? true;
    const resolvedWorkflow = resolveEnv ? resolveEnvVarsInObject(workflowConfig) : workflowConfig;
    const resolvedAgents = resolveEnv ? resolveEnvVarsInObject(agentsConfig) : agentsConfig;

    return new ConfigManager(resolvedWorkflow, resolvedAgents);
  }

  // ============================================================
  // Global Configuration
  // ============================================================

  /**
   * Get global configuration settings
   *
   * @returns Global configuration with defaults applied
   */
  getGlobalConfig(): GlobalConfig {
    const global = this.workflowConfig.global;
    const approvalGates = global?.approval_gates;
    const retryPolicy = global?.retry_policy;
    const timeouts = global?.timeouts;

    return {
      projectRoot: global?.project_root ?? '${PWD}',
      scratchpadDir: global?.scratchpad_dir ?? '.ad-sdlc/scratchpad',
      outputDocsDir: global?.output_docs_dir ?? 'docs',
      logLevel: global?.log_level ?? 'INFO',
      approvalGates: {
        afterCollection: approvalGates?.after_collection ?? true,
        afterPrd: approvalGates?.after_prd ?? true,
        afterSrs: approvalGates?.after_srs ?? true,
        afterSds: approvalGates?.after_sds ?? true,
        afterIssues: approvalGates?.after_issues ?? true,
        beforeMerge: approvalGates?.before_merge ?? false,
      },
      retryPolicy: {
        maxAttempts: retryPolicy?.max_attempts ?? 3,
        backoff: retryPolicy?.backoff ?? 'exponential',
        baseDelaySeconds: retryPolicy?.base_delay_seconds ?? 5,
        maxDelaySeconds: retryPolicy?.max_delay_seconds ?? 60,
      },
      timeouts: {
        documentGeneration: timeouts?.document_generation ?? 300,
        issueCreation: timeouts?.issue_creation ?? 60,
        implementation: timeouts?.implementation ?? 1800,
        prReview: timeouts?.pr_review ?? 300,
      },
    };
  }

  /**
   * Get retry policy configuration
   *
   * @returns Retry policy settings
   */
  getRetryPolicy(): RetryPolicy {
    return this.getGlobalConfig().retryPolicy;
  }

  // ============================================================
  // Pipeline Configuration
  // ============================================================

  /**
   * Get ordered pipeline stages
   *
   * @returns Array of pipeline stages in execution order
   */
  getPipelineStages(): readonly PipelineStage[] {
    const stages = this.workflowConfig.pipeline?.stages ?? [];

    return stages.map((raw) => {
      const stage = raw as Record<string, unknown>;
      return {
        name: stage.name as string,
        agent: (stage.agent as string | undefined) ?? '',
        description: stage.description as string | undefined,
        inputs: stage.inputs as readonly string[] | undefined,
        outputs: stage.outputs as readonly string[] | undefined,
        next: (stage.next as string | null) ?? null,
        approvalRequired: (stage.approval_required as boolean | undefined) ?? false,
        parallel: (stage.parallel as boolean | undefined) ?? false,
        maxParallel: stage.max_parallel as number | undefined,
      };
    });
  }

  /**
   * Get a specific pipeline stage by name
   *
   * @param stageName - Name of the stage
   * @returns Pipeline stage or undefined
   */
  getPipelineStage(stageName: string): PipelineStage | undefined {
    return this.getPipelineStages().find((stage) => stage.name === stageName);
  }

  // ============================================================
  // Agent Configuration
  // ============================================================

  /**
   * Get configuration for a specific agent
   *
   * @param agentId - Agent identifier
   * @returns Agent workflow configuration or undefined
   */
  getAgentConfig(agentId: string): AgentWorkflowConfig | undefined {
    const agents = this.workflowConfig.agents;
    const agentConfig = agents?.[agentId];

    if (!agentConfig) {
      return undefined;
    }

    return {
      model: agentConfig.model ?? 'sonnet',
      tools: agentConfig.tools,
      template: agentConfig.template,
      maxQuestions: agentConfig.max_questions,
      github: agentConfig.github
        ? {
            labelsPrefix: agentConfig.github.labels_prefix,
            autoAssign: agentConfig.github.auto_assign,
            mergeStrategy: agentConfig.github.merge_strategy,
            deleteBranchAfterMerge: agentConfig.github.delete_branch_after_merge,
          }
        : undefined,
      scheduling: agentConfig.scheduling
        ? {
            algorithm: agentConfig.scheduling.algorithm,
            maxWorkers: agentConfig.scheduling.max_workers,
            checkIntervalSeconds: agentConfig.scheduling.check_interval_seconds,
          }
        : undefined,
      coding: agentConfig.coding
        ? {
            language: agentConfig.coding.language,
            testFramework: agentConfig.coding.test_framework,
            lintCommand: agentConfig.coding.lint_command,
            testCommand: agentConfig.coding.test_command,
            buildCommand: agentConfig.coding.build_command,
          }
        : undefined,
      verification: agentConfig.verification
        ? {
            runTests: agentConfig.verification.run_tests ?? true,
            runLint: agentConfig.verification.run_lint ?? true,
            runBuild: agentConfig.verification.run_build ?? true,
            coverageThreshold: agentConfig.verification.coverage_threshold ?? 80,
          }
        : undefined,
      review: agentConfig.review
        ? {
            autoMerge: agentConfig.review.auto_merge ?? false,
            requireAllChecks: agentConfig.review.require_all_checks ?? true,
            coverageThreshold: agentConfig.review.coverage_threshold ?? 80,
            maxComplexity: agentConfig.review.max_complexity ?? 10,
          }
        : undefined,
    };
  }

  /**
   * Get all configured agent IDs
   *
   * @returns Array of agent identifiers
   */
  getConfiguredAgentIds(): readonly string[] {
    const agents = this.workflowConfig.agents;
    return agents ? Object.keys(agents) : [];
  }

  /**
   * Get agent definition from agents.yaml
   *
   * @param agentId - Agent identifier
   * @returns Agent definition or undefined
   */
  getAgentDefinition(agentId: string): AgentsConfig['agents'][string] | undefined {
    return this.agentsConfig.agents[agentId];
  }

  /**
   * Get all agent definitions
   *
   * @returns Record of agent definitions
   */
  getAllAgentDefinitions(): AgentsConfig['agents'] {
    return this.agentsConfig.agents;
  }

  // ============================================================
  // Quality Gates
  // ============================================================

  /**
   * Get quality gate rules
   *
   * @returns Quality gates configuration
   */
  getQualityGates(): QualityGates {
    const gates = this.workflowConfig.quality_gates;
    const docQuality = gates?.document_quality;
    const codeQuality = gates?.code_quality;
    const security = gates?.security;

    const mapDocQuality = (
      dq: NonNullable<typeof docQuality>['prd'] | undefined
    ): DocumentQualityGate | undefined => {
      if (!dq) return undefined;
      return {
        requiredSections: dq.required_sections,
        minRequirements: dq.min_requirements,
        minFeatures: dq.min_features,
        minUseCasesPerFeature: dq.min_use_cases_per_feature,
        minComponents: dq.min_components,
      };
    };

    return {
      documentQuality: docQuality
        ? {
            prd: mapDocQuality(docQuality.prd),
            srs: mapDocQuality(docQuality.srs),
            sds: mapDocQuality(docQuality.sds),
          }
        : undefined,
      codeQuality: codeQuality
        ? {
            coverageThreshold: codeQuality.coverage_threshold ?? 80,
            maxComplexity: codeQuality.max_complexity ?? 10,
            maxLineLength: codeQuality.max_line_length ?? 100,
            noTodosInCode: codeQuality.no_todos_in_code ?? false,
            noConsoleLogs: codeQuality.no_console_logs ?? true,
          }
        : undefined,
      security: security
        ? {
            noHardcodedSecrets: security.no_hardcoded_secrets ?? true,
            requireInputValidation: security.require_input_validation ?? true,
            requireAuthentication: security.require_authentication ?? true,
          }
        : undefined,
    };
  }

  // ============================================================
  // GitHub Configuration
  // ============================================================

  /**
   * Get GitHub integration settings
   *
   * @returns GitHub configuration
   */
  getGitHubConfig(): {
    readonly repo: string | undefined;
    readonly defaultBranch: string;
    readonly issueLabels: readonly string[] | undefined;
    readonly prLabels: readonly string[] | undefined;
    readonly milestonePrefix: string | undefined;
  } {
    const github = this.workflowConfig.github;
    return {
      repo: github?.repo,
      defaultBranch: github?.default_branch ?? 'main',
      issueLabels: github?.issue_labels,
      prLabels: github?.pr_labels,
      milestonePrefix: github?.milestone_prefix,
    };
  }

  // ============================================================
  // Logging Configuration
  // ============================================================

  /**
   * Get logging configuration
   *
   * @returns Logging settings
   */
  getLoggingConfig(): {
    readonly level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    readonly format: 'json' | 'text';
    readonly outputs:
      | readonly {
          readonly type: 'file' | 'console';
          readonly path: string | undefined;
          readonly rotate: boolean | undefined;
          readonly maxSize: string | undefined;
          readonly maxFiles: number | undefined;
          readonly format: 'json' | 'pretty' | undefined;
        }[]
      | undefined;
    readonly include: readonly string[] | undefined;
  } {
    const logging = this.workflowConfig.logging;
    return {
      level: logging?.level ?? 'INFO',
      format: logging?.format ?? 'json',
      outputs: logging?.output?.map((output) => ({
        type: output.type,
        path: output.path,
        rotate: output.rotate,
        maxSize: output.max_size,
        maxFiles: output.max_files,
        format: output.format,
      })),
      include: logging?.include,
    };
  }

  // ============================================================
  // Raw Access
  // ============================================================

  /**
   * Get raw workflow configuration
   *
   * @returns Full workflow configuration object
   */
  getRawWorkflowConfig(): WorkflowConfig {
    return this.workflowConfig;
  }

  /**
   * Get raw agents configuration
   *
   * @returns Full agents configuration object
   */
  getRawAgentsConfig(): AgentsConfig {
    return this.agentsConfig;
  }
}

// ============================================================
// Singleton Management
// ============================================================

let configManagerInstance: ConfigManager | undefined;

/**
 * Get or create the singleton ConfigManager instance
 *
 * @param options - Configuration options (only used on first call)
 * @returns ConfigManager instance
 */
export async function getConfigManager(options?: ConfigManagerOptions): Promise<ConfigManager> {
  if (!configManagerInstance) {
    configManagerInstance = await ConfigManager.create(options);
  }
  return configManagerInstance;
}

/**
 * Reset the singleton ConfigManager instance
 *
 * Useful for testing or when configuration needs to be reloaded.
 */
export function resetConfigManager(): void {
  configManagerInstance = undefined;
}

/**
 * Check if ConfigManager is initialized
 *
 * @returns Whether a ConfigManager instance exists
 */
export function isConfigManagerInitialized(): boolean {
  return configManagerInstance !== undefined;
}
