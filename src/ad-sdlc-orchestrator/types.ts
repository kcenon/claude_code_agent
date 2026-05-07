/**
 * AD-SDLC Orchestrator Agent module type definitions
 *
 * Defines types for full pipeline orchestration across Greenfield,
 * Enhancement, and Import modes. Based on SDS-001 CMP-025 specification.
 */

import type { StageVerificationResult } from '../stage-verifier/types.js';

/**
 * Pipeline execution mode
 */
export type PipelineMode = 'greenfield' | 'enhancement' | 'import';

/**
 * Pipeline stage names for Greenfield mode
 */
export type GreenfieldStageName =
  | 'initialization'
  | 'mode_detection'
  | 'collection'
  | 'prd_generation'
  | 'srs_generation'
  | 'sdp_generation'
  | 'repo_detection'
  | 'github_repo_setup'
  | 'sds_generation'
  | 'ui_spec_generation'
  | 'threat_modeling'
  | 'tech_decisions'
  | 'issue_generation'
  | 'svp_generation'
  | 'orchestration'
  | 'implementation'
  | 'validation-agent'
  | 'review'
  | 'doc_indexing';

/**
 * Pipeline stage names for Enhancement mode
 */
export type EnhancementStageName =
  | 'document_reading'
  | 'codebase_analysis'
  | 'code_reading'
  | 'doc_code_comparison'
  | 'impact_analysis'
  | 'prd_update'
  | 'srs_update'
  | 'sds_update'
  | 'issue_generation'
  | 'orchestration'
  | 'implementation'
  | 'regression_testing'
  | 'validation-agent'
  | 'review'
  | 'doc_indexing';

/**
 * Pipeline stage names for Import mode
 */
export type ImportStageName =
  | 'issue_reading'
  | 'orchestration'
  | 'implementation'
  | 'validation-agent'
  | 'review';

/**
 * Union of all stage names
 */
export type StageName = GreenfieldStageName | EnhancementStageName | ImportStageName;

/**
 * Pipeline stage status
 */
export type PipelineStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'degraded'
  | 'failed'
  | 'skipped';

/**
 * Overall pipeline status
 */
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'partial';

/**
 * Approval mode for pipeline execution
 */
export type ApprovalMode = 'auto' | 'manual' | 'critical' | 'custom';

/**
 * Agent execution strategy
 */
export type ExecutionStrategy = 'sequential' | 'parallel';

/**
 * Resume mode for pipeline execution
 *
 * - 'fresh': Start a new pipeline from scratch (default behavior)
 * - 'resume': Continue from the last completed stage of a prior session
 * - 'start_from': Begin at a specific stage, marking earlier stages as pre-completed
 */
export type ResumeMode = 'fresh' | 'resume' | 'start_from';

/**
 * Pipeline stage definition
 */
export interface PipelineStageDefinition {
  /** Stage name identifier */
  readonly name: StageName;
  /** Agent type to execute */
  readonly agentType: string;
  /** Stage description */
  readonly description: string;
  /** Whether this stage can run in parallel with siblings */
  readonly parallel: boolean;
  /** Whether approval is required after this stage */
  readonly approvalRequired: boolean;
  /** Stages that must complete before this one */
  readonly dependsOn: readonly StageName[];
}

/**
 * Pipeline stage result
 */
export interface StageResult {
  /** Stage name */
  readonly name: StageName;
  /** Agent type that executed */
  readonly agentType: string;
  /** Execution status */
  readonly status: PipelineStageStatus;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Output summary */
  readonly output: string;
  /** Generated artifact file paths */
  readonly artifacts: readonly string[];
  /** Error message if failed */
  readonly error: string | null;
  /** Number of retry attempts */
  readonly retryCount: number;
  /** Warning messages (e.g., StubBridge detection) */
  readonly warnings?: readonly string[];
}

/**
 * Pipeline execution result (SDS-001 Section 3.25)
 */
export interface PipelineResult {
  /** Unique pipeline execution identifier */
  readonly pipelineId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Execution mode */
  readonly mode: PipelineMode;
  /** Individual stage results */
  readonly stages: readonly StageResult[];
  /** Overall execution status */
  readonly overallStatus: PipelineStatus;
  /** Total duration in milliseconds */
  readonly durationMs: number;
  /** Generated artifact file paths */
  readonly artifacts: readonly string[];
  /** Warnings during execution */
  readonly warnings: readonly string[];
  /** V&V stage verification results (one per verified stage) */
  readonly verificationResults?: readonly StageVerificationResult[];
  /** V&V validation report (from validation stage) */
  readonly validationReport?: {
    readonly reportId: string;
    readonly overallResult: 'pass' | 'pass_with_warnings' | 'fail';
    readonly generatedAt: string;
  };
}

/**
 * Agent invocation descriptor for coordinateAgents
 */
export interface AgentInvocation {
  /** Agent type identifier */
  readonly agentType: string;
  /** Input data paths or parameters */
  readonly inputs: readonly string[];
  /** Expected output paths */
  readonly outputs: readonly string[];
  /** Stage name for tracking */
  readonly stageName: StageName;
}

/**
 * Orchestrator session tracking
 */
export interface OrchestratorSession {
  /** Unique session identifier */
  readonly sessionId: string;
  /** Project root directory */
  readonly projectDir: string;
  /** User request text */
  readonly userRequest: string;
  /** Detected or overridden pipeline mode */
  readonly mode: PipelineMode;
  /** Session start timestamp */
  readonly startedAt: string;
  /** Current pipeline status */
  readonly status: PipelineStatus;
  /** Stage results accumulated during execution */
  readonly stageResults: readonly StageResult[];
  /** Scratchpad directory for intermediate files */
  readonly scratchpadDir: string;
  /** Session ID that this session was resumed from (if any) */
  readonly resumedFrom?: string;
  /** Stages treated as pre-completed when resuming */
  readonly preCompletedStages?: readonly StageName[];
  /** Whether the pipeline runs in local mode (no GitHub dependency) */
  readonly localMode: boolean;
}

/**
 * Pipeline execution request
 */
export interface PipelineRequest {
  /** Project root directory */
  readonly projectDir: string;
  /** User's project description or change request */
  readonly userRequest: string;
  /** Override mode detection (optional) */
  readonly overrideMode?: PipelineMode;
  /** Project identifier (optional, auto-generated if omitted) */
  readonly projectId?: string;
  /** Resume mode: fresh (default), resume from prior session, or start from specific stage */
  readonly resumeMode?: ResumeMode;
  /** Session ID to resume from (required when resumeMode is 'resume') */
  readonly resumeSessionId?: string;
  /** Stage to start from (required when resumeMode is 'start_from') */
  readonly startFromStage?: StageName;
  /** Stages to treat as already completed (auto-populated from prior session or computed from startFromStage) */
  readonly preCompletedStages?: readonly StageName[];
  /** Run pipeline without GitHub — use local issue files and local review */
  readonly localMode?: boolean;
}

/**
 * Per-stage timeout configuration.
 *
 * Timeout hierarchy invariant: API_CALL (120s) < STAGE (default 300s).
 * The orchestrator enforces this by capping per-attempt timeout to
 * the remaining stage budget, preventing retry cascades from exceeding
 * the stage deadline.
 */
export interface StageTimeoutConfig {
  /** Default timeout for all stages in milliseconds (must be > API call timeout) */
  readonly default: number;
  /** Per-stage timeout overrides */
  readonly overrides?: Readonly<Partial<Record<StageName, number>>>;
}

/**
 * CLI-supplied feature flag overrides (Issue #795).
 *
 * Mirrors the `CliFeatureFlags` shape from `src/config/featureFlags.ts`
 * but kept as a local interface so the orchestrator does not have to
 * import the resolver module just for the type.
 */
export interface OrchestratorFeatureFlagsCli {
  /** CLI override for `--use-sdk-for-worker` (`undefined` = not provided). */
  readonly useSdkForWorker?: boolean;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Scratchpad base directory */
  readonly scratchpadDir?: string;
  /** Output documents directory */
  readonly outputDocsDir?: string;
  /** Approval mode */
  readonly approvalMode?: ApprovalMode;
  /** Stage timeout configuration */
  readonly timeouts?: StageTimeoutConfig;
  /** Maximum retry attempts per stage */
  readonly maxRetries?: number;
  /** Maximum number of agents that can execute in parallel (default: 3) */
  readonly maxParallelAgents?: number;
  /** Log level */
  readonly logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  /** Checkpoint configuration for mid-stage persistence */
  readonly checkpoint?: CheckpointConfig;
  /** Enable local mode by default (no GitHub dependency) */
  readonly localMode?: boolean;
  /**
   * CLI-supplied feature flag values forwarded to FeatureFlagsResolver.
   * Issue #795: priority is env > CLI > YAML > default.
   */
  readonly featureFlagsCli?: OrchestratorFeatureFlagsCli;
  /**
   * Base directory used by FeatureFlagsResolver to locate
   * `.ad-sdlc/config/feature-flags.yaml`. Defaults to the detected
   * project root or `process.cwd()`.
   */
  readonly featureFlagsBaseDir?: string;
}

/**
 * Checkpoint configuration for the orchestrator
 */
export interface CheckpointConfig {
  /** Enable mid-stage checkpointing (default: true) */
  readonly enabled: boolean;
  /** Maximum number of checkpoints to retain per session (default: 5) */
  readonly maxCheckpoints: number;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: Required<OrchestratorConfig> = {
  scratchpadDir: '.ad-sdlc/scratchpad',
  outputDocsDir: 'docs',
  approvalMode: 'auto',
  timeouts: {
    default: 300_000, // 5 minutes
    overrides: {},
  },
  maxRetries: 3,
  maxParallelAgents: 3,
  logLevel: 'INFO',
  checkpoint: {
    enabled: true,
    maxCheckpoints: 5,
  },
  localMode: false,
  featureFlagsCli: {},
  featureFlagsBaseDir: '',
};

/**
 * Greenfield pipeline stage definitions
 */
export const GREENFIELD_STAGES: readonly PipelineStageDefinition[] = [
  {
    name: 'initialization',
    agentType: 'project-initializer',
    description: 'Initialize .ad-sdlc directory structure',
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
  },
  {
    name: 'mode_detection',
    agentType: 'mode-detector',
    description: 'Detect pipeline execution mode',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['initialization'],
  },
  {
    name: 'collection',
    agentType: 'collector',
    description: 'Collect and structure user requirements',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['mode_detection'],
  },
  {
    name: 'prd_generation',
    agentType: 'prd-writer',
    description: 'Generate PRD from collected information',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['collection'],
  },
  {
    name: 'srs_generation',
    agentType: 'srs-writer',
    description: 'Generate SRS from PRD',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['prd_generation'],
  },
  {
    name: 'sdp_generation',
    agentType: 'sdp-writer',
    description: 'Generate SDP from PRD and SRS',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['srs_generation'],
  },
  {
    name: 'repo_detection',
    agentType: 'repo-detector',
    description: 'Detect existing GitHub repository presence',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['sdp_generation'],
  },
  {
    name: 'github_repo_setup',
    agentType: 'github-repo-setup',
    description: 'Create and initialize GitHub repository',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['repo_detection'],
  },
  {
    name: 'sds_generation',
    agentType: 'sds-writer',
    description: 'Generate SDS from SRS',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['github_repo_setup'],
  },
  {
    name: 'ui_spec_generation',
    agentType: 'ui-spec-writer',
    description:
      'Generate UI screen specifications and user flow documents from SRS (skipped for CLI/API/library)',
    parallel: true,
    approvalRequired: true,
    dependsOn: ['sds_generation'],
  },
  {
    name: 'threat_modeling',
    agentType: 'threat-model-writer',
    description: 'Generate Threat Model (STRIDE + DREAD) from SDS',
    parallel: true,
    approvalRequired: true,
    dependsOn: ['sds_generation'],
  },
  {
    name: 'tech_decisions',
    agentType: 'tech-decision-writer',
    description: 'Generate Technology Decision comparison documents from SDS',
    parallel: true,
    approvalRequired: true,
    dependsOn: ['sds_generation'],
  },
  {
    name: 'issue_generation',
    agentType: 'issue-generator',
    description: 'Generate GitHub issues from SDS',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['ui_spec_generation', 'threat_modeling', 'tech_decisions'],
  },
  {
    name: 'svp_generation',
    agentType: 'svp-writer',
    description: 'Generate Software Verification Plan with derived test cases from SRS',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['issue_generation'],
  },
  {
    name: 'orchestration',
    agentType: 'controller',
    description: 'Orchestrate work distribution',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['svp_generation'],
  },
  {
    name: 'implementation',
    agentType: 'worker',
    description: 'Implement assigned issues',
    parallel: true,
    approvalRequired: false,
    dependsOn: ['orchestration'],
  },
  {
    name: 'validation-agent',
    agentType: 'validation-agent',
    description: 'Validate implementation against requirements and acceptance criteria',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['implementation'],
  },
  {
    name: 'review',
    agentType: 'pr-reviewer',
    description: 'Create and review pull requests',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['validation-agent'],
  },
  {
    name: 'doc_indexing',
    agentType: 'doc-index-generator',
    description: 'Generate searchable documentation index from pipeline artifacts',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['review'],
  },
];

/**
 * Enhancement pipeline stage definitions
 *
 * Stages for improving existing projects: analyze documents and code,
 * compare for gaps, assess impact, update documents, generate issues,
 * implement, run regression tests, and review.
 */
export const ENHANCEMENT_STAGES: readonly PipelineStageDefinition[] = [
  {
    name: 'document_reading',
    agentType: 'document-reader',
    description: 'Parse existing PRD/SRS/SDS documents',
    parallel: true,
    approvalRequired: false,
    dependsOn: [],
  },
  {
    name: 'codebase_analysis',
    agentType: 'codebase-analyzer',
    description: 'Analyze existing code structure and architecture',
    parallel: true,
    approvalRequired: false,
    dependsOn: [],
  },
  {
    name: 'code_reading',
    agentType: 'code-reader',
    description: 'Read and inventory source code modules',
    parallel: true,
    approvalRequired: false,
    dependsOn: [],
  },
  {
    name: 'doc_code_comparison',
    agentType: 'doc-code-comparator',
    description: 'Compare documentation state against codebase',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['document_reading', 'codebase_analysis', 'code_reading'],
  },
  {
    name: 'impact_analysis',
    agentType: 'impact-analyzer',
    description: 'Assess impact of proposed changes',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['doc_code_comparison'],
  },
  {
    name: 'prd_update',
    agentType: 'prd-updater',
    description: 'Incrementally update PRD with new requirements',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['impact_analysis'],
  },
  {
    name: 'srs_update',
    agentType: 'srs-updater',
    description: 'Incrementally update SRS with new features',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['prd_update'],
  },
  {
    name: 'sds_update',
    agentType: 'sds-updater',
    description: 'Incrementally update SDS with new components',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['srs_update'],
  },
  {
    name: 'issue_generation',
    agentType: 'issue-generator',
    description: 'Generate issues from updated SDS',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['sds_update'],
  },
  {
    name: 'orchestration',
    agentType: 'controller',
    description: 'Orchestrate work distribution',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['issue_generation'],
  },
  {
    name: 'implementation',
    agentType: 'worker',
    description: 'Implement assigned issues',
    parallel: true,
    approvalRequired: false,
    dependsOn: ['orchestration'],
  },
  {
    name: 'regression_testing',
    agentType: 'regression-tester',
    description: 'Validate existing functionality is not broken',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['implementation'],
  },
  {
    name: 'validation-agent',
    agentType: 'validation-agent',
    description: 'Validate implementation against requirements and acceptance criteria',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['regression_testing'],
  },
  {
    name: 'review',
    agentType: 'pr-reviewer',
    description: 'Create and review pull requests',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['validation-agent'],
  },
  {
    name: 'doc_indexing',
    agentType: 'doc-index-generator',
    description: 'Generate searchable documentation index from pipeline artifacts',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['review'],
  },
];

/**
 * Import pipeline stage definitions
 *
 * Lightweight pipeline that imports existing GitHub issues and
 * proceeds directly to orchestration, implementation, and review.
 */
export const IMPORT_STAGES: readonly PipelineStageDefinition[] = [
  {
    name: 'issue_reading',
    agentType: 'issue-reader',
    description: 'Import existing GitHub issues into AD-SDLC format',
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
  },
  {
    name: 'orchestration',
    agentType: 'controller',
    description: 'Orchestrate work distribution from imported issues',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['issue_reading'],
  },
  {
    name: 'implementation',
    agentType: 'worker',
    description: 'Implement assigned issues',
    parallel: true,
    approvalRequired: false,
    dependsOn: ['orchestration'],
  },
  {
    name: 'validation-agent',
    agentType: 'validation-agent',
    description: 'Validate implementation against requirements and acceptance criteria',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['implementation'],
  },
  {
    name: 'review',
    agentType: 'pr-reviewer',
    description: 'Create and review pull requests',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['validation-agent'],
  },
];

/**
 * Approval gate decision
 */
export interface ApprovalDecision {
  /** Whether to proceed */
  readonly approved: boolean;
  /** Reason for the decision */
  readonly reason: string;
  /** Who made the decision (system or user) */
  readonly decidedBy: 'system' | 'user';
  /** Timestamp of the decision */
  readonly decidedAt: string;
}

/**
 * Pipeline monitoring snapshot
 */
export interface PipelineMonitorSnapshot {
  /** Session identifier */
  readonly sessionId: string;
  /** Pipeline mode */
  readonly mode: PipelineMode;
  /** Overall status */
  readonly status: PipelineStatus;
  /** Total stages in the pipeline */
  readonly totalStages: number;
  /** Number of completed stages */
  readonly completedStages: number;
  /** Number of failed stages */
  readonly failedStages: number;
  /** Number of skipped stages */
  readonly skippedStages: number;
  /** Currently running stage name, if any */
  readonly currentStage: StageName | null;
  /** Elapsed time in milliseconds */
  readonly elapsedMs: number;
  /** Per-stage summaries */
  readonly stageSummaries: readonly StageSummary[];
}

/**
 * Summary of a single stage for monitoring
 */
export interface StageSummary {
  readonly name: StageName;
  readonly status: PipelineStageStatus;
  readonly durationMs: number;
  readonly retryCount: number;
}

/**
 * Pipeline checkpoint capturing progress between stages.
 * Written to disk after each stage completes for crash recovery.
 */
export interface PipelineCheckpoint {
  /** Checkpoint format version */
  readonly version: 1;
  /** Session ID this checkpoint belongs to */
  readonly sessionId: string;
  /** Pipeline mode */
  readonly mode: PipelineMode;
  /** Project directory */
  readonly projectDir: string;
  /** User request text */
  readonly userRequest: string;
  /** Checkpoint creation timestamp */
  readonly createdAt: string;
  /** Stage results accumulated so far */
  readonly completedStageResults: readonly StageResult[];
  /** Names of stages confirmed completed */
  readonly completedStageNames: readonly StageName[];
}
