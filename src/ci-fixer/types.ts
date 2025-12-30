/**
 * CI Fixer module type definitions
 *
 * Defines types for CI failure analysis, automated fixes,
 * delegation handoffs, and escalation handling.
 *
 * @module ci-fixer/types
 */

// ============================================================================
// Status and Category Types
// ============================================================================

/**
 * CI check status
 */
export type CICheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'skipped';

/**
 * CI failure category
 */
export type CIFailureCategory =
  | 'test'
  | 'type'
  | 'lint'
  | 'build'
  | 'security'
  | 'dependency'
  | 'unknown';

/**
 * Fix outcome status
 */
export type FixOutcome = 'success' | 'partial' | 'failed' | 'escalated';

/**
 * Next action type after fix attempt
 */
export type NextActionType = 'none' | 'delegate' | 'escalate';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * CI Fixer Agent configuration
 */
export interface CIFixerAgentConfig {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Path to store results (default: '.ad-sdlc/scratchpad/ci-fix') */
  readonly resultsPath?: string;
  /** Maximum fix attempts before escalation (default: 3) */
  readonly maxFixAttempts?: number;
  /** Maximum delegation count (default: 3) */
  readonly maxDelegations?: number;
  /** Timeout per fix attempt in milliseconds (default: 1800000 = 30 min) */
  readonly fixTimeout?: number;
  /** CI poll interval in milliseconds (default: 10000 = 10 sec) */
  readonly ciPollInterval?: number;
  /** CI wait timeout in milliseconds (default: 600000 = 10 min) */
  readonly ciWaitTimeout?: number;
  /** Enable auto lint fix (default: true) */
  readonly enableLintFix?: boolean;
  /** Enable auto type fix (default: true) */
  readonly enableTypeFix?: boolean;
  /** Enable auto test fix (default: true) */
  readonly enableTestFix?: boolean;
  /** Enable auto build fix (default: true) */
  readonly enableBuildFix?: boolean;
}

/**
 * Default CI fixer agent configuration
 */
export const DEFAULT_CI_FIXER_CONFIG: Required<CIFixerAgentConfig> = {
  projectRoot: process.cwd(),
  resultsPath: '.ad-sdlc/scratchpad/ci-fix',
  maxFixAttempts: 3,
  maxDelegations: 3,
  fixTimeout: 1800000,
  ciPollInterval: 10000,
  ciWaitTimeout: 600000,
  enableLintFix: true,
  enableTypeFix: true,
  enableTestFix: true,
  enableBuildFix: true,
} as const;

// ============================================================================
// CI Check Types
// ============================================================================

/**
 * Individual CI check information
 */
export interface CICheck {
  /** Check name */
  readonly name: string;
  /** Check status */
  readonly status: CICheckStatus;
  /** Check conclusion (if completed) */
  readonly conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
  /** Logs URL (if available) */
  readonly logsUrl?: string;
  /** Run ID (for fetching logs) */
  readonly runId?: number;
}

/**
 * Parsed CI failure information
 */
export interface CIFailure {
  /** Failure category */
  readonly category: CIFailureCategory;
  /** Error message */
  readonly message: string;
  /** File path (if applicable) */
  readonly file?: string;
  /** Line number (if applicable) */
  readonly line?: number;
  /** Column number (if applicable) */
  readonly column?: number;
  /** Full error details */
  readonly details: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Whether this is auto-fixable */
  readonly autoFixable: boolean;
  /** Suggested fix (if available) */
  readonly suggestedFix?: string;
}

// ============================================================================
// CI Analysis Types
// ============================================================================

/**
 * CI log analysis result
 */
export interface CIAnalysisResult {
  /** Total number of failures detected */
  readonly totalFailures: number;
  /** Identified failure causes */
  readonly identifiedCauses: readonly CIFailure[];
  /** Unidentified causes (raw log excerpts) */
  readonly unidentifiedCauses: readonly string[];
  /** Failures grouped by category */
  readonly byCategory: ReadonlyMap<CIFailureCategory, readonly CIFailure[]>;
  /** Analysis timestamp */
  readonly analyzedAt: string;
  /** Raw logs (truncated) */
  readonly rawLogs: string;
}

// ============================================================================
// Fix Types
// ============================================================================

/**
 * Individual fix applied
 */
export interface AppliedFix {
  /** Fix type/category */
  readonly type: CIFailureCategory;
  /** File that was fixed */
  readonly file: string;
  /** Description of the fix */
  readonly description: string;
  /** Whether the fix was successful */
  readonly success: boolean;
  /** Error message if fix failed */
  readonly error?: string;
  /** Lines changed (added/removed) */
  readonly linesChanged?: {
    readonly added: number;
    readonly removed: number;
  };
}

/**
 * Fix verification result
 */
export interface VerificationResult {
  /** Lint check passed */
  readonly lintPassed: boolean;
  /** TypeScript check passed */
  readonly typecheckPassed: boolean;
  /** Tests passed */
  readonly testsPassed: boolean;
  /** Build passed */
  readonly buildPassed: boolean;
  /** Individual check outputs */
  readonly outputs: {
    readonly lint: string;
    readonly typecheck: string;
    readonly test: string;
    readonly build: string;
  };
}

// ============================================================================
// Handoff Types
// ============================================================================

/**
 * Single fix attempt record
 */
export interface CIFixAttempt {
  /** Attempt number */
  readonly attempt: number;
  /** Agent identifier (for tracking) */
  readonly agentId: string;
  /** Fixes that were attempted */
  readonly fixesAttempted: readonly string[];
  /** Fixes that succeeded */
  readonly fixesSucceeded: readonly string[];
  /** Issues that remain unresolved */
  readonly remainingIssues: readonly string[];
  /** Attempt timestamp */
  readonly timestamp: string;
  /** Time spent (ms) */
  readonly duration: number;
}

/**
 * CI Fix handoff document for delegation
 */
export interface CIFixHandoff {
  // PR Information
  /** PR number */
  readonly prNumber: number;
  /** PR URL */
  readonly prUrl: string;
  /** Branch name */
  readonly branch: string;
  /** Original issue reference */
  readonly originalIssue: string;

  // CI Failure Information
  /** Failed CI checks */
  readonly failedChecks: readonly CICheck[];
  /** Raw failure logs */
  readonly failureLogs: readonly string[];
  /** Previous attempt history */
  readonly attemptHistory: readonly CIFixAttempt[];

  // Context from Original Agent
  /** Summary of implementation */
  readonly implementationSummary: string;
  /** Files that were changed */
  readonly changedFiles: readonly string[];
  /** Test files in the change */
  readonly testFiles: readonly string[];

  // Delegation Limits
  /** Maximum fix attempts allowed */
  readonly maxFixAttempts: number;
  /** Current attempt number */
  readonly currentAttempt: number;
  /** Escalation threshold */
  readonly escalationThreshold: number;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Next action after fix attempt
 */
export interface NextAction {
  /** Action type */
  readonly type: NextActionType;
  /** Reason for the action */
  readonly reason: string;
  /** Path to handoff file (if delegating) */
  readonly handoffPath?: string;
}

/**
 * CI Fix result
 */
export interface CIFixResult {
  /** PR number */
  readonly prNumber: number;
  /** Attempt number */
  readonly attempt: number;

  /** Analysis results */
  readonly analysis: CIAnalysisResult;

  /** Fixes that were applied */
  readonly fixesApplied: readonly AppliedFix[];

  /** Local verification results */
  readonly verification: VerificationResult;

  /** Outcome of the fix attempt */
  readonly outcome: FixOutcome;

  /** Next action to take */
  readonly nextAction: NextAction;

  /** Timestamp when fix started */
  readonly startedAt: string;
  /** Timestamp when fix completed */
  readonly completedAt: string;
  /** Total duration (ms) */
  readonly duration: number;

  /** Git commit hash (if changes were committed) */
  readonly commitHash?: string;
  /** Commit message */
  readonly commitMessage?: string;
}

// ============================================================================
// Escalation Types
// ============================================================================

/**
 * Escalation trigger reason
 */
export type EscalationReason =
  | 'max_attempts_reached'
  | 'security_vulnerability'
  | 'no_progress'
  | 'unknown_error_pattern'
  | 'manual_escalation';

/**
 * Escalation information
 */
export interface EscalationInfo {
  /** Escalation reason */
  readonly reason: EscalationReason;
  /** Detailed description */
  readonly description: string;
  /** PR number */
  readonly prNumber: number;
  /** Attempt history */
  readonly attemptHistory: readonly CIFixAttempt[];
  /** Unresolved issues */
  readonly unresolvedIssues: readonly CIFailure[];
  /** Suggested actions for human reviewer */
  readonly suggestedActions: readonly string[];
  /** Timestamp */
  readonly escalatedAt: string;
}

// ============================================================================
// Log Pattern Types
// ============================================================================

/**
 * CI log pattern for failure detection
 */
export interface CILogPattern {
  /** Pattern name */
  readonly name: string;
  /** Regular expression pattern */
  readonly pattern: RegExp;
  /** Failure category */
  readonly category: CIFailureCategory;
  /** Whether this type is auto-fixable */
  readonly autoFixable: boolean;
  /** Extract file/line info from match */
  readonly extractLocation?: (match: RegExpMatchArray) => {
    file?: string;
    line?: number;
    column?: number;
  };
  /** Extract error message from match */
  readonly extractMessage?: (match: RegExpMatchArray) => string;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

/**
 * Progress comparison between attempts
 */
export interface ProgressComparison {
  /** Checks that now pass */
  readonly checksNowPassing: readonly string[];
  /** Checks that now fail */
  readonly checksNowFailing: readonly string[];
  /** Checks unchanged */
  readonly checksUnchanged: readonly string[];
  /** Overall progress made */
  readonly progressMade: boolean;
  /** Net change in passing checks */
  readonly netChange: number;
}
