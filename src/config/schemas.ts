/**
 * Zod schemas for configuration file validation
 *
 * Provides runtime validation and type inference for
 * workflow.yaml and agents.yaml configuration files.
 *
 * @module config/schemas
 */

import { z } from 'zod';

// ============================================================
// Schema Version
// ============================================================

/**
 * Current schema version for configuration files
 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

/**
 * Version pattern: semver format
 */
const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be in semver format (e.g., 1.0.0)');

// ============================================================
// Common Schemas
// ============================================================

/**
 * Log level options
 */
const LogLevelSchema = z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']);

/**
 * Model selection options
 */
const ModelSchema = z.enum(['sonnet', 'opus', 'haiku']);

/**
 * Available tools for agents
 */
const ToolSchema = z.enum([
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
]);

// ============================================================
// Workflow Config Schemas
// ============================================================

/**
 * Approval gates configuration
 */
const ApprovalGatesSchema = z.record(z.string(), z.boolean());

/**
 * Retry policy configuration
 */
const RetryPolicySchema = z.object({
  max_attempts: z.number().int().min(1).max(10).optional().default(3),
  backoff: z.enum(['linear', 'exponential']).optional().default('exponential'),
  base_delay_seconds: z.number().int().min(1).optional().default(5),
  max_delay_seconds: z.number().int().min(1).optional().default(60),
});

/**
 * Timeout settings
 */
const TimeoutsSchema = z.object({
  document_generation: z.number().int().min(60).optional().default(300),
  issue_creation: z.number().int().min(30).optional().default(60),
  implementation: z.number().int().min(300).optional().default(1800),
  pr_review: z.number().int().min(60).optional().default(300),
});

/**
 * Scratchpad backend type
 */
const BackendTypeSchema = z.enum(['file', 'sqlite', 'redis']);

/**
 * File backend configuration
 */
const FileBackendConfigSchema = z.object({
  base_path: z.string().optional(),
  file_mode: z.number().int().optional(),
  dir_mode: z.number().int().optional(),
  format: z.enum(['yaml', 'json', 'raw']).optional(),
});

/**
 * SQLite backend configuration
 */
const SQLiteBackendConfigSchema = z.object({
  db_path: z.string().optional(),
  wal_mode: z.boolean().optional(),
  busy_timeout: z.number().int().optional(),
});

/**
 * Redis lock configuration
 */
const RedisLockConfigSchema = z.object({
  lock_ttl: z.number().int().optional(),
  lock_timeout: z.number().int().optional(),
  lock_retry_interval: z.number().int().optional(),
});

/**
 * Redis fallback configuration
 */
const RedisFallbackConfigSchema = z.object({
  enabled: z.boolean().optional(),
  file_config: FileBackendConfigSchema.optional(),
});

/**
 * Redis backend configuration
 */
const RedisBackendConfigSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().optional(),
  password: z.string().optional(),
  db: z.number().int().optional(),
  prefix: z.string().optional(),
  ttl: z.number().int().optional(),
  connect_timeout: z.number().int().optional(),
  max_retries: z.number().int().optional(),
  lock: RedisLockConfigSchema.optional(),
  fallback: RedisFallbackConfigSchema.optional(),
});

/**
 * Scratchpad configuration
 */
const ScratchpadConfigSchema = z.object({
  backend: BackendTypeSchema.optional().default('file'),
  file: FileBackendConfigSchema.optional(),
  sqlite: SQLiteBackendConfigSchema.optional(),
  redis: RedisBackendConfigSchema.optional(),
});

/**
 * Global settings
 */
const GlobalSettingsSchema = z.object({
  project_root: z.string().optional().default('${PWD}'),
  scratchpad_dir: z.string().optional().default('.ad-sdlc/scratchpad'),
  output_docs_dir: z.string().optional().default('docs'),
  log_level: LogLevelSchema.optional().default('INFO'),
  approval_mode: z.enum(['auto', 'manual', 'critical', 'custom']).optional().default('auto'),
  approval_gates: ApprovalGatesSchema.optional(),
  retry_policy: RetryPolicySchema.optional(),
  timeouts: TimeoutsSchema.optional(),
});

/**
 * Scratchpad config schema export for use in loader
 */
export { ScratchpadConfigSchema };

/**
 * Telemetry config schema export for use in loader
 */
export { TelemetryConfigSchema };

/**
 * Pipeline stage input/output
 */
const StageIOSchema = z.array(z.union([z.string(), z.object({ type: z.string() }).loose()]));

/**
 * Pipeline stage definition
 */
const OnCiFailureSchema = z
  .object({
    agent: z.string(),
    description: z.string().optional(),
    max_attempts: z.number().int().min(1).optional(),
    inputs: z.array(z.string()).optional(),
    outputs: z.array(z.string()).optional(),
  })
  .optional();

const PipelineStageSchema: z.ZodType = z.lazy(() =>
  z
    .object({
      name: z.string().min(1, 'Stage name is required'),
      agent: z.string().optional(),
      description: z.string().optional(),
      inputs: StageIOSchema.optional(),
      outputs: z.array(z.string()).optional(),
      next: z.string().nullable().optional(),
      approval_required: z.boolean().optional().default(false),
      parallel: z.boolean().optional().default(false),
      max_parallel: z.number().int().min(1).max(10).optional(),
      conditional: z.boolean().optional(),
      on_ci_failure: OnCiFailureSchema,
      substages: z.array(z.lazy(() => PipelineStageSchema)).optional(),
    })
    .loose()
);

/**
 * Pipeline configuration
 */
const PipelineModeSchema = z.object({
  description: z.string().optional(),
  stages: z.array(PipelineStageSchema).min(1),
});

const PipelineSchema = z.object({
  default_mode: z.enum(['greenfield', 'enhancement', 'import']).optional(),
  modes: z
    .object({
      greenfield: PipelineModeSchema.optional(),
      enhancement: PipelineModeSchema.optional(),
      import: PipelineModeSchema.optional(),
    })
    .optional(),
  stages: z.array(PipelineStageSchema).optional(),
});

/**
 * Agent GitHub settings
 */
const AgentGitHubSettingsSchema = z.object({
  labels_prefix: z.string().optional(),
  auto_assign: z.boolean().optional(),
  merge_strategy: z.enum(['merge', 'squash', 'rebase']).optional(),
  delete_branch_after_merge: z.boolean().optional(),
});

/**
 * Agent scheduling settings
 */
const AgentSchedulingSchema = z.object({
  algorithm: z.enum(['priority_only', 'dependency_only', 'priority_dependency']).optional(),
  max_workers: z.number().int().min(1).max(10).optional(),
  check_interval_seconds: z.number().int().min(10).optional(),
});

/**
 * Agent coding settings
 */
const AgentCodingSchema = z.object({
  language: z.string().optional(),
  test_framework: z.string().optional(),
  lint_command: z.string().optional(),
  test_command: z.string().optional(),
  build_command: z.string().optional(),
});

/**
 * Agent verification settings
 */
const AgentVerificationSchema = z.object({
  run_tests: z.boolean().optional().default(true),
  run_lint: z.boolean().optional().default(true),
  run_build: z.boolean().optional().default(true),
  coverage_threshold: z.number().min(0).max(100).optional().default(80),
});

/**
 * Agent review settings
 */
const AgentReviewSchema = z.object({
  auto_merge: z.boolean().optional().default(false),
  require_all_checks: z.boolean().optional().default(true),
  coverage_threshold: z.number().min(0).max(100).optional().default(80),
  max_complexity: z.number().int().min(1).optional().default(10),
});

/**
 * Individual agent configuration in workflow
 */
const WorkflowAgentConfigSchema = z
  .object({
    model: ModelSchema.optional().default('sonnet'),
    tools: z.array(ToolSchema).optional(),
    template: z.string().optional(),
    max_questions: z.number().int().min(1).optional(),
    github: AgentGitHubSettingsSchema.optional(),
    scheduling: AgentSchedulingSchema.optional(),
    coding: AgentCodingSchema.optional(),
    verification: AgentVerificationSchema.optional(),
    review: AgentReviewSchema.optional(),
  })
  .loose();

/**
 * All agents configuration in workflow
 */
const WorkflowAgentsSchema = z.record(z.string(), WorkflowAgentConfigSchema);

/**
 * Document quality gate - required sections
 */
const DocumentQualitySchema = z.object({
  required_sections: z.array(z.string()).optional(),
  min_requirements: z.number().int().min(1).optional(),
  min_features: z.number().int().min(1).optional(),
  min_use_cases_per_feature: z.number().int().min(1).optional(),
  min_components: z.number().int().min(1).optional(),
});

/**
 * Code quality gate
 */
const CodeQualitySchema = z.object({
  coverage_threshold: z.number().min(0).max(100).optional().default(80),
  max_complexity: z.number().int().min(1).optional().default(10),
  max_line_length: z.number().int().min(80).optional().default(100),
  no_todos_in_code: z.boolean().optional().default(false),
  no_console_logs: z.boolean().optional().default(true),
});

/**
 * Security quality gate
 */
const SecurityQualitySchema = z.object({
  no_hardcoded_secrets: z.boolean().optional().default(true),
  require_input_validation: z.boolean().optional().default(true),
  require_authentication: z.boolean().optional().default(true),
});

/**
 * Quality gates configuration
 */
const QualityGatesSchema = z.object({
  document_quality: z
    .object({
      prd: DocumentQualitySchema.optional(),
      srs: DocumentQualitySchema.optional(),
      sds: DocumentQualitySchema.optional(),
    })
    .optional(),
  code_quality: CodeQualitySchema.optional(),
  security: SecurityQualitySchema.optional(),
});

/**
 * Notification channel
 */
const NotificationChannelSchema = z.object({
  type: z.enum(['slack', 'email']),
  webhook: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  events: z
    .array(z.enum(['stage_complete', 'approval_required', 'error', 'pipeline_complete']))
    .optional(),
});

/**
 * Notifications configuration
 */
const NotificationsSchema = z.object({
  enabled: z.boolean().optional().default(false),
  channels: z.array(NotificationChannelSchema).optional(),
  templates: z.record(z.string(), z.string()).optional(),
});

/**
 * GitHub integration settings
 */
const GitHubSettingsSchema = z.object({
  repo: z.string().optional(),
  default_branch: z.string().optional().default('main'),
  issue_labels: z.array(z.string()).optional(),
  pr_labels: z.array(z.string()).optional(),
  milestone_prefix: z.string().optional(),
});

/**
 * Logging output configuration
 */
const LoggingOutputSchema = z.object({
  type: z.enum(['file', 'console']),
  path: z.string().optional(),
  rotate: z.boolean().optional(),
  max_size: z.string().optional(),
  max_files: z.number().int().min(1).optional(),
  format: z.enum(['json', 'pretty']).optional(),
});

/**
 * Logging configuration
 */
const LoggingSchema = z.object({
  level: LogLevelSchema.optional().default('INFO'),
  format: z.enum(['json', 'text']).optional().default('json'),
  output: z.array(LoggingOutputSchema).optional(),
  include: z.array(z.string()).optional(),
});

/**
 * Monitoring configuration
 */
const MonitoringSchema = z.object({
  enabled: z.boolean().optional().default(false),
  metrics: z.array(z.string()).optional(),
});

/**
 * Telemetry configuration (opt-in only)
 */
const TelemetryConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  flush_interval_ms: z.number().int().min(1000).optional().default(60000),
  max_buffer_size: z.number().int().min(1).max(1000).optional().default(100),
  include_debug_events: z.boolean().optional().default(false),
});

// ============================================================
// OpenTelemetry Configuration Schemas
// ============================================================

/**
 * OpenTelemetry exporter types
 */
const OpenTelemetryExporterTypeSchema = z.enum(['console', 'otlp', 'jaeger']);

/**
 * OpenTelemetry sampling types
 */
const OpenTelemetrySamplingTypeSchema = z.enum([
  'always_on',
  'always_off',
  'probability',
  'rate_limiting',
]);

/**
 * OpenTelemetry exporter configuration
 */
const OpenTelemetryExporterConfigSchema = z.object({
  type: OpenTelemetryExporterTypeSchema,
  enabled: z.boolean().optional().default(true),
  endpoint: z.url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional().default(30000),
});

/**
 * OpenTelemetry sampling configuration
 */
const OpenTelemetrySamplingConfigSchema = z.object({
  type: OpenTelemetrySamplingTypeSchema,
  probability: z.number().min(0).max(1).optional(),
  rateLimit: z.number().int().min(1).optional(),
});

/**
 * OpenTelemetry resource attributes
 */
const OpenTelemetryResourceAttributesSchema = z.object({
  serviceName: z.string().optional(),
  serviceVersion: z.string().optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  custom: z.record(z.string(), z.string()).optional(),
});

/**
 * Complete OpenTelemetry configuration schema
 */
export const OpenTelemetryConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    serviceName: z.string().min(1, 'Service name is required').default('ad-sdlc-pipeline'),
    exporters: z
      .array(OpenTelemetryExporterConfigSchema)
      .min(1)
      .default([{ type: 'console' as const, enabled: false, timeoutMs: 30000 }]),
    sampling: OpenTelemetrySamplingConfigSchema.optional(),
    resourceAttributes: OpenTelemetryResourceAttributesSchema.optional(),
  })
  .refine(
    (config) => {
      // Validate probability is set when sampling type is 'probability'
      if (config.sampling?.type === 'probability' && config.sampling.probability === undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'probability is required when sampling type is "probability"',
      path: ['sampling', 'probability'],
    }
  )
  .refine(
    (config) => {
      // Validate rateLimit is set when sampling type is 'rate_limiting'
      if (config.sampling?.type === 'rate_limiting' && config.sampling.rateLimit === undefined) {
        return false;
      }
      return true;
    },
    {
      message: 'rateLimit is required when sampling type is "rate_limiting"',
      path: ['sampling', 'rateLimit'],
    }
  )
  .refine(
    (config) => {
      // Validate endpoint is set for OTLP and Jaeger exporters
      for (const exporter of config.exporters) {
        if ((exporter.type === 'otlp' || exporter.type === 'jaeger') && exporter.enabled) {
          if (exporter.endpoint === undefined) {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: 'endpoint is required for enabled OTLP and Jaeger exporters',
      path: ['exporters'],
    }
  );

/**
 * Observability configuration schema (wrapper for observability.yaml)
 */
export const ObservabilityConfigSchema = z.object({
  opentelemetry: OpenTelemetryConfigSchema.optional(),
});

/**
 * Token budget entry for an agent or default
 */
const TokenBudgetEntrySchema = z
  .object({
    max_tokens: z.number().int().optional(),
    max_cost_usd: z.number().optional(),
  })
  .loose();

/**
 * Token budgets configuration
 */
const TokenBudgetsSchema = z
  .object({
    default_model: ModelSchema.optional(),
    pipeline: z
      .object({
        max_tokens: z.number().int().optional(),
        max_cost_usd: z.number().optional(),
        warning_threshold: z.number().min(0).max(1).optional(),
      })
      .optional(),
    defaults: z.record(z.string(), TokenBudgetEntrySchema).optional(),
    agents: z.record(z.string(), TokenBudgetEntrySchema).optional(),
  })
  .optional();

/**
 * Complete workflow configuration schema
 */
export const WorkflowConfigSchema = z.object({
  version: VersionSchema,
  name: z.string().optional(),
  global: GlobalSettingsSchema.optional(),
  pipeline: PipelineSchema,
  agents: WorkflowAgentsSchema.optional(),
  quality_gates: QualityGatesSchema.optional(),
  notifications: NotificationsSchema.optional(),
  github: GitHubSettingsSchema.optional(),
  logging: LoggingSchema.optional(),
  monitoring: MonitoringSchema.optional(),
  scratchpad: ScratchpadConfigSchema.optional(),
  telemetry: TelemetryConfigSchema.optional(),
  token_budgets: TokenBudgetsSchema,
});

// ============================================================
// Agents Config Schemas
// ============================================================

/**
 * Agent I/O configuration
 */
const AgentIOSchema = z.object({
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
});

/**
 * Agent metrics
 */
const AgentMetricsSchema = z.object({
  avg_duration_seconds: z.number().min(0).optional(),
  success_rate: z.number().min(0).max(1).optional(),
  retry_rate: z.number().min(0).max(1).optional(),
  approval_rate: z.number().min(0).max(1).optional(),
  avg_issues_per_project: z.number().int().min(0).optional(),
});

/**
 * Individual agent definition
 */
const AgentDefinitionSchema = z
  .object({
    id: z.string().min(1, 'Agent ID is required'),
    name: z.string().min(1, 'Agent name is required'),
    korean_name: z.string().optional(),
    description: z.string().optional(),
    definition_file: z.string().optional(),
    category: z
      .enum([
        'orchestration',
        'infrastructure',
        'document_pipeline',
        'project_setup',
        'document_update',
        'issue_management',
        'execution',
        'analysis_pipeline',
        'enhancement_pipeline',
      ])
      .optional(),
    order: z.number().optional(),
    capabilities: z.array(z.string()).optional(),
    io: AgentIOSchema.optional(),
    parallelizable: z.boolean().optional(),
    max_instances: z.number().int().min(1).max(10).optional(),
    metrics: AgentMetricsSchema.optional(),
    token_budget: z
      .object({
        default_limit: z.number().int().optional(),
        cost_limit_usd: z.number().optional(),
        model_preference: ModelSchema.optional(),
      })
      .optional(),
    model_preference: ModelSchema.optional(),
  })
  .loose();

/**
 * Agent category definition
 */
const AgentCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  agents: z.array(z.string()),
  execution_mode: z
    .enum(['sequential', 'parallel', 'on_demand', 'mixed'])
    .optional()
    .default('sequential'),
});

/**
 * Agent dependency
 */
const AgentDependencySchema = z.object({
  requires: z.array(z.string()),
  blocks: z.array(z.string()).optional(),
  alternative_to: z.array(z.string()).optional(),
  alternative_inputs: z.array(z.string()).optional(),
  orchestrates: z.array(z.string()).optional(),
});

/**
 * Data flow definition
 */
const DataFlowSchema = z.object({
  from: z.string().min(1, 'Source agent is required'),
  to: z.string().min(1, 'Target agent is required'),
  data: z.union([z.string(), z.array(z.string())]),
  mode: z.string().optional(),
});

/**
 * Agent relationships
 */
const RelationshipsSchema = z.object({
  dependencies: z.record(z.string(), AgentDependencySchema).optional(),
  data_flow: z.array(DataFlowSchema).optional(),
});

/**
 * Model configuration
 */
const ModelConfigSchema = z.object({
  id: z.string().min(1, 'Model ID is required'),
  context_window: z.number().int().min(1000).optional(),
  max_output: z.number().int().min(100).optional(),
  cost_per_1k_input: z.number().min(0).optional(),
  cost_per_1k_output: z.number().min(0).optional(),
  best_for: z.array(z.string()).optional(),
});

/**
 * Complete agents configuration schema
 */
export const AgentsConfigSchema = z.object({
  version: VersionSchema,
  agents: z.record(z.string(), AgentDefinitionSchema),
  categories: z.record(z.string(), AgentCategorySchema).optional(),
  relationships: RelationshipsSchema.optional(),
  models: z.record(z.string(), ModelConfigSchema).optional(),
});

// ============================================================
// Schema Metadata
// ============================================================

/**
 * Schema information for documentation
 */
export const SCHEMA_METADATA = {
  workflow: {
    version: CONFIG_SCHEMA_VERSION,
    fileName: 'workflow.yaml',
    description: 'AD-SDLC pipeline and agent workflow configuration',
  },
  agents: {
    version: CONFIG_SCHEMA_VERSION,
    fileName: 'agents.yaml',
    description: 'Agent definitions, categories, and relationships',
  },
} as const;
