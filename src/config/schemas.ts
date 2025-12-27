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
const ApprovalGatesSchema = z.object({
  after_collection: z.boolean().optional().default(true),
  after_prd: z.boolean().optional().default(true),
  after_srs: z.boolean().optional().default(true),
  after_sds: z.boolean().optional().default(true),
  after_issues: z.boolean().optional().default(true),
  before_merge: z.boolean().optional().default(false),
});

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
 * Global settings
 */
const GlobalSettingsSchema = z.object({
  project_root: z.string().optional().default('${PWD}'),
  scratchpad_dir: z.string().optional().default('.ad-sdlc/scratchpad'),
  output_docs_dir: z.string().optional().default('docs'),
  log_level: LogLevelSchema.optional().default('INFO'),
  approval_gates: ApprovalGatesSchema.optional(),
  retry_policy: RetryPolicySchema.optional(),
  timeouts: TimeoutsSchema.optional(),
});

/**
 * Pipeline stage input/output
 */
const StageIOSchema = z.array(z.string());

/**
 * Pipeline stage definition
 */
const PipelineStageSchema = z.object({
  name: z.string().min(1, 'Stage name is required'),
  agent: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  inputs: StageIOSchema.optional(),
  outputs: StageIOSchema.optional(),
  next: z.string().nullable().optional(),
  approval_required: z.boolean().optional().default(false),
  parallel: z.boolean().optional().default(false),
  max_parallel: z.number().int().min(1).max(10).optional(),
});

/**
 * Pipeline configuration
 */
const PipelineSchema = z.object({
  stages: z.array(PipelineStageSchema).min(1, 'At least one stage is required'),
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
const WorkflowAgentConfigSchema = z.object({
  model: ModelSchema.optional().default('sonnet'),
  tools: z.array(ToolSchema).optional(),
  template: z.string().optional(),
  max_questions: z.number().int().min(1).optional(),
  github: AgentGitHubSettingsSchema.optional(),
  scheduling: AgentSchedulingSchema.optional(),
  coding: AgentCodingSchema.optional(),
  verification: AgentVerificationSchema.optional(),
  review: AgentReviewSchema.optional(),
});

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
  document_quality: z.object({
    prd: DocumentQualitySchema.optional(),
    srs: DocumentQualitySchema.optional(),
    sds: DocumentQualitySchema.optional(),
  }).optional(),
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
  events: z.array(z.enum(['stage_complete', 'approval_required', 'error', 'pipeline_complete'])).optional(),
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
const AgentDefinitionSchema = z.object({
  id: z.string().min(1, 'Agent ID is required'),
  name: z.string().min(1, 'Agent name is required'),
  korean_name: z.string().optional(),
  description: z.string().optional(),
  definition_file: z.string().optional(),
  category: z.enum(['document_pipeline', 'issue_management', 'execution']).optional(),
  order: z.number().int().min(1).optional(),
  capabilities: z.array(z.string()).optional(),
  io: AgentIOSchema.optional(),
  parallelizable: z.boolean().optional(),
  max_instances: z.number().int().min(1).max(10).optional(),
  metrics: AgentMetricsSchema.optional(),
});

/**
 * Agent category definition
 */
const AgentCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  agents: z.array(z.string()),
  execution_mode: z.enum(['sequential', 'parallel']).optional().default('sequential'),
});

/**
 * Agent dependency
 */
const AgentDependencySchema = z.object({
  requires: z.array(z.string()),
});

/**
 * Data flow definition
 */
const DataFlowSchema = z.object({
  from: z.string().min(1, 'Source agent is required'),
  to: z.string().min(1, 'Target agent is required'),
  data: z.union([z.string(), z.array(z.string())]),
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
