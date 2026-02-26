/**
 * AD-SDLC Orchestrator Agent module type definitions
 *
 * Defines types for full pipeline orchestration across Greenfield,
 * Enhancement, and Import modes. Based on SDS-001 CMP-025 specification.
 */

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
  | 'repo_detection'
  | 'github_repo_setup'
  | 'sds_generation'
  | 'issue_generation'
  | 'orchestration'
  | 'implementation'
  | 'review';

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
  | 'review';

/**
 * Pipeline stage names for Import mode
 */
export type ImportStageName = 'issue_reading' | 'orchestration' | 'implementation' | 'review';

/**
 * Union of all stage names
 */
export type StageName = GreenfieldStageName | EnhancementStageName | ImportStageName;

/**
 * Pipeline stage status
 */
export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

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
}

/**
 * Per-stage timeout configuration
 */
export interface StageTimeoutConfig {
  /** Default timeout for all stages in milliseconds */
  readonly default: number;
  /** Per-stage timeout overrides */
  readonly overrides?: Readonly<Partial<Record<StageName, number>>>;
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
    name: 'repo_detection',
    agentType: 'repo-detector',
    description: 'Detect existing GitHub repository presence',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['srs_generation'],
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
    name: 'issue_generation',
    agentType: 'issue-generator',
    description: 'Generate GitHub issues from SDS',
    parallel: false,
    approvalRequired: true,
    dependsOn: ['sds_generation'],
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
    name: 'review',
    agentType: 'pr-reviewer',
    description: 'Create and review pull requests',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['implementation'],
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
    name: 'review',
    agentType: 'pr-reviewer',
    description: 'Create and review pull requests',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['regression_testing'],
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
    name: 'review',
    agentType: 'pr-reviewer',
    description: 'Create and review pull requests',
    parallel: false,
    approvalRequired: false,
    dependsOn: ['implementation'],
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
