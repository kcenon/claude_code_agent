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
export type ImportStageName =
  | 'issue_reading'
  | 'orchestration'
  | 'implementation'
  | 'review';

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
