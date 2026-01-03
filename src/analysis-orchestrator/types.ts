/**
 * Analysis Orchestrator Agent module type definitions
 *
 * Defines types for pipeline orchestration, stage management,
 * session tracking, and analysis coordination.
 */

/**
 * Analysis scope options
 */
export type AnalysisScope = 'full' | 'documents_only' | 'code_only' | 'comparison';

/**
 * Pipeline stage names
 */
export type PipelineStageName =
  | 'document_reader'
  | 'code_reader'
  | 'comparator'
  | 'issue_generator';

/**
 * Pipeline stage status
 */
export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Overall pipeline status
 */
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Analysis result status
 */
export type AnalysisResultStatus = 'success' | 'partial' | 'failed';

/**
 * Output format options
 */
export type OutputFormat = 'yaml' | 'json';

/**
 * Pipeline stage configuration
 */
export interface PipelineStage {
  /** Stage name identifier */
  readonly name: PipelineStageName;
  /** Current stage status */
  readonly status: PipelineStageStatus;
  /** Stage start timestamp */
  readonly startedAt: string | null;
  /** Stage completion timestamp */
  readonly completedAt: string | null;
  /** Output file path if completed */
  readonly outputPath: string | null;
  /** Error message if failed */
  readonly error: string | null;
  /** Retry count for this stage */
  readonly retryCount: number;
}

/**
 * Pipeline execution statistics
 */
export interface PipelineStatistics {
  /** Total number of stages */
  readonly totalStages: number;
  /** Number of completed stages */
  readonly completedStages: number;
  /** Number of failed stages */
  readonly failedStages: number;
  /** Number of skipped stages */
  readonly skippedStages: number;
  /** Total execution duration in milliseconds */
  readonly totalDurationMs: number;
}

/**
 * Pipeline state for tracking progress
 */
export interface PipelineState {
  /** Unique analysis identifier */
  readonly analysisId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Project root path */
  readonly projectPath: string;
  /** Pipeline start timestamp */
  readonly startedAt: string;
  /** Last update timestamp */
  readonly updatedAt: string;
  /** Overall pipeline status */
  readonly overallStatus: PipelineStatus;
  /** Analysis scope */
  readonly scope: AnalysisScope;
  /** Whether to generate issues */
  readonly generateIssues: boolean;
  /** Individual stage statuses */
  readonly stages: readonly PipelineStage[];
  /** Execution statistics */
  readonly statistics: PipelineStatistics;
  /** Warnings during execution */
  readonly warnings: readonly string[];
  /** Errors during execution */
  readonly errors: readonly string[];
}

/**
 * Document analysis summary
 */
export interface DocumentAnalysisSummary {
  /** Whether document analysis is available */
  readonly available: boolean;
  /** Summary description */
  readonly summary: string | null;
  /** Path to output file */
  readonly outputPath: string | null;
  /** Number of documents parsed */
  readonly documentCount: number;
  /** Number of requirements extracted */
  readonly requirementCount: number;
}

/**
 * Code analysis summary
 */
export interface CodeAnalysisSummary {
  /** Whether code analysis is available */
  readonly available: boolean;
  /** Summary description */
  readonly summary: string | null;
  /** Path to output file */
  readonly outputPath: string | null;
  /** Number of modules analyzed */
  readonly moduleCount: number;
  /** Number of files analyzed */
  readonly fileCount: number;
  /** Total lines of code */
  readonly totalLines: number;
}

/**
 * Comparison summary
 */
export interface ComparisonSummary {
  /** Whether comparison is available */
  readonly available: boolean;
  /** Total number of gaps found */
  readonly totalGaps: number;
  /** Number of critical gaps (P0) */
  readonly criticalGaps: number;
  /** Number of high priority gaps (P1) */
  readonly highGaps: number;
  /** Path to output file */
  readonly outputPath: string | null;
}

/**
 * Issue generation summary
 */
export interface IssuesSummary {
  /** Whether issues were generated */
  readonly generated: boolean;
  /** Total number of issues created */
  readonly totalIssues: number;
  /** Path to output file */
  readonly outputPath: string | null;
}

/**
 * Analysis recommendation
 */
export interface AnalysisRecommendation {
  /** Priority level (1-5, 1 being highest) */
  readonly priority: number;
  /** Recommendation message */
  readonly message: string;
  /** Suggested action */
  readonly action: string;
}

/**
 * Final analysis report
 */
export interface AnalysisReport {
  /** Analysis identifier */
  readonly analysisId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Report generation timestamp */
  readonly generatedAt: string;
  /** Analysis version */
  readonly analysisVersion: string;
  /** Overall result status */
  readonly overallStatus: AnalysisResultStatus;
  /** Analysis scope used */
  readonly scope: AnalysisScope;
  /** Total stages executed */
  readonly totalStages: number;
  /** Stages completed successfully */
  readonly completedStages: number;
  /** Document analysis summary */
  readonly documentAnalysis: DocumentAnalysisSummary;
  /** Code analysis summary */
  readonly codeAnalysis: CodeAnalysisSummary;
  /** Comparison summary */
  readonly comparison: ComparisonSummary;
  /** Issue generation summary */
  readonly issues: IssuesSummary;
  /** Recommendations for follow-up */
  readonly recommendations: readonly AnalysisRecommendation[];
  /** Total execution duration in milliseconds */
  readonly totalDurationMs: number;
}

/**
 * Per-stage timeout configuration
 */
export interface StageTimeoutConfig {
  /** Timeout for document_reader stage in milliseconds */
  readonly document_reader?: number;
  /** Timeout for code_reader stage in milliseconds */
  readonly code_reader?: number;
  /** Timeout for comparator stage in milliseconds */
  readonly comparator?: number;
  /** Timeout for issue_generator stage in milliseconds */
  readonly issue_generator?: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit (default: 3) */
  readonly failureThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 60000) */
  readonly resetTimeoutMs?: number;
  /** Whether circuit breaker is enabled (default: true) */
  readonly enabled?: boolean;
}

/**
 * Analysis orchestrator configuration
 */
export interface AnalysisOrchestratorConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Whether to run document and code readers in parallel */
  readonly parallelExecution?: boolean;
  /** Whether to continue on stage failure */
  readonly continueOnError?: boolean;
  /** Maximum retry attempts per stage */
  readonly maxRetries?: number;
  /** Retry delay in milliseconds */
  readonly retryDelayMs?: number;
  /** Default timeout per stage in milliseconds */
  readonly stageTimeoutMs?: number;
  /** Per-stage timeout overrides */
  readonly stageTimeouts?: StageTimeoutConfig;
  /** Circuit breaker configuration */
  readonly circuitBreaker?: CircuitBreakerConfig;
  /** Output format for reports */
  readonly outputFormat?: OutputFormat;
}

/**
 * Default per-stage timeout values
 */
export const DEFAULT_STAGE_TIMEOUTS: Required<StageTimeoutConfig> = {
  document_reader: 600000, // 10 minutes for large docs
  code_reader: 900000, // 15 minutes for large codebases
  comparator: 300000, // 5 minutes
  issue_generator: 300000, // 5 minutes
} as const;

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 3,
  resetTimeoutMs: 60000, // 1 minute
  enabled: true,
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: Required<AnalysisOrchestratorConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  parallelExecution: true,
  continueOnError: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  stageTimeoutMs: 300000, // 5 minutes (default fallback)
  stageTimeouts: DEFAULT_STAGE_TIMEOUTS,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  outputFormat: 'yaml',
} as const;

/**
 * Analysis input options
 */
export interface AnalysisInput {
  /** Path to project root */
  readonly projectPath: string;
  /** Custom project ID (auto-generated if not provided) */
  readonly projectId?: string;
  /** Analysis scope */
  readonly scope?: AnalysisScope;
  /** Whether to generate GitHub issues from gaps */
  readonly generateIssues?: boolean;
}

/**
 * Analysis session for tracking active analysis
 */
export interface AnalysisSession {
  /** Unique session identifier */
  readonly sessionId: string;
  /** Analysis identifier */
  readonly analysisId: string;
  /** Current pipeline state */
  readonly pipelineState: PipelineState;
  /** Session start timestamp */
  readonly startedAt: string;
  /** Last update timestamp */
  readonly updatedAt: string;
}

/**
 * Analysis result returned by orchestrator
 */
export interface AnalysisResult {
  /** Whether analysis was successful */
  readonly success: boolean;
  /** Analysis identifier */
  readonly analysisId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Final pipeline state */
  readonly pipelineState: PipelineState;
  /** Analysis report */
  readonly report: AnalysisReport;
  /** Paths to all output files */
  readonly outputPaths: {
    readonly pipelineState: string;
    readonly analysisReport: string;
    readonly documentInventory?: string;
    readonly codeInventory?: string;
    readonly comparisonResult?: string;
    readonly generatedIssues?: string;
  };
  /** Warnings during analysis */
  readonly warnings: readonly string[];
}

/**
 * Stage result for individual stage execution
 */
export interface StageResult {
  /** Stage name */
  readonly stage: PipelineStageName;
  /** Whether stage succeeded */
  readonly success: boolean;
  /** Output file path if successful */
  readonly outputPath: string | null;
  /** Error message if failed */
  readonly error: string | null;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Retry count */
  readonly retryCount: number;
}

/**
 * Stage executor function type
 */
export type StageExecutor = (
  projectPath: string,
  projectId: string,
  inputPaths: Record<string, string>
) => Promise<StageResult>;

/**
 * Resume options for continuing a failed analysis
 */
export interface ResumeOptions {
  /** Analysis ID to resume */
  readonly analysisId: string;
  /** Whether to skip failed stages */
  readonly skipFailed?: boolean;
  /** Whether to retry failed stages */
  readonly retryFailed?: boolean;
}
