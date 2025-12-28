/**
 * PR Reviewer module type definitions
 *
 * Defines types for PR creation, code review, quality gate enforcement,
 * and feedback loop functionality.
 */

// ============================================================================
// Status and Severity Types
// ============================================================================

/**
 * PR review status
 */
export type ReviewStatus = 'approved' | 'changes_requested' | 'rejected';

/**
 * Review decision action
 */
export type ReviewDecision = 'merge' | 'revise' | 'reject';

/**
 * Comment severity levels
 */
export type CommentSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

/**
 * Check status
 */
export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * PR Reviewer Agent configuration
 */
export interface PRReviewerAgentConfig {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Path to store results (default: '.ad-sdlc/scratchpad/progress') */
  readonly resultsPath?: string;
  /** Enable auto-merge on approval (default: false) */
  readonly autoMerge?: boolean;
  /** Merge strategy (default: 'squash') */
  readonly mergeStrategy?: 'merge' | 'squash' | 'rebase';
  /** Delete branch after merge (default: true) */
  readonly deleteBranchOnMerge?: boolean;
  /** Minimum coverage threshold (default: 80) */
  readonly coverageThreshold?: number;
  /** Maximum complexity score (default: 10) */
  readonly maxComplexity?: number;
  /** Wait for CI timeout in milliseconds (default: 600000 = 10 min) */
  readonly ciTimeout?: number;
  /** CI poll interval in milliseconds (default: 10000 = 10 sec) */
  readonly ciPollInterval?: number;
}

/**
 * Default PR reviewer agent configuration
 */
export const DEFAULT_PR_REVIEWER_CONFIG: Required<PRReviewerAgentConfig> = {
  projectRoot: process.cwd(),
  resultsPath: '.ad-sdlc/scratchpad/progress',
  autoMerge: false,
  mergeStrategy: 'squash',
  deleteBranchOnMerge: true,
  coverageThreshold: 80,
  maxComplexity: 10,
  ciTimeout: 600000,
  ciPollInterval: 10000,
} as const;

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  /** Required gates (must pass to merge) */
  readonly required: QualityGateRules;
  /** Recommended gates (warning if not met) */
  readonly recommended: QualityGateRules;
}

/**
 * Quality gate rules
 */
export interface QualityGateRules {
  /** Tests must pass */
  readonly testsPass?: boolean;
  /** Build must pass */
  readonly buildPass?: boolean;
  /** Lint must pass */
  readonly lintPass?: boolean;
  /** No critical security issues */
  readonly noCriticalSecurity?: boolean;
  /** No critical review issues */
  readonly noCriticalIssues?: boolean;
  /** Minimum code coverage percentage */
  readonly codeCoverage?: number;
  /** Minimum new lines coverage percentage */
  readonly newLinesCoverage?: number;
  /** Maximum complexity score */
  readonly maxComplexity?: number;
  /** No style violations */
  readonly noStyleViolations?: boolean;
  /** No major issues */
  readonly noMajorIssues?: boolean;
}

/**
 * Default quality gate configuration
 */
export const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  required: {
    testsPass: true,
    buildPass: true,
    lintPass: true,
    noCriticalSecurity: true,
    noCriticalIssues: true,
    codeCoverage: 80,
  },
  recommended: {
    noMajorIssues: true,
    newLinesCoverage: 90,
    maxComplexity: 10,
    noStyleViolations: true,
  },
} as const;

// ============================================================================
// PR Types
// ============================================================================

/**
 * Pull request information
 */
export interface PullRequest {
  /** PR number */
  readonly number: number;
  /** PR URL */
  readonly url: string;
  /** PR title */
  readonly title: string;
  /** Source branch */
  readonly branch: string;
  /** Target branch */
  readonly base: string;
  /** Creation timestamp */
  readonly createdAt: string;
  /** PR state */
  readonly state: 'open' | 'closed' | 'merged';
}

/**
 * PR creation options
 */
export interface PRCreateOptions {
  /** PR title */
  readonly title: string;
  /** PR body/description */
  readonly body: string;
  /** Target branch (default: 'main') */
  readonly base?: string;
  /** Source branch */
  readonly head: string;
  /** Draft PR */
  readonly draft?: boolean;
  /** Reviewers to request */
  readonly reviewers?: readonly string[];
  /** Labels to add */
  readonly labels?: readonly string[];
}

// ============================================================================
// Review Types
// ============================================================================

/**
 * Review comment
 */
export interface ReviewComment {
  /** File path */
  readonly file: string;
  /** Line number */
  readonly line: number;
  /** Comment text */
  readonly comment: string;
  /** Comment severity */
  readonly severity: CommentSeverity;
  /** Whether the issue is resolved */
  readonly resolved: boolean;
  /** Suggested fix (optional) */
  readonly suggestedFix?: string;
}

/**
 * Review information
 */
export interface Review {
  /** Review status */
  readonly status: ReviewStatus;
  /** Review timestamp */
  readonly reviewedAt: string;
  /** Revision round (1 = first review) */
  readonly revisionRound: number;
  /** Review comments */
  readonly comments: readonly ReviewComment[];
  /** Review summary */
  readonly summary: string;
}

// ============================================================================
// Quality Metrics Types
// ============================================================================

/**
 * Security issues count by severity
 */
export interface SecurityIssues {
  /** Critical issues */
  readonly critical: number;
  /** High severity issues */
  readonly high: number;
  /** Medium severity issues */
  readonly medium: number;
  /** Low severity issues */
  readonly low: number;
}

/**
 * Quality metrics for the PR
 */
export interface QualityMetrics {
  /** Overall code coverage percentage */
  readonly codeCoverage: number;
  /** Coverage of newly added lines */
  readonly newLinesCoverage: number;
  /** Complexity score */
  readonly complexityScore: number;
  /** Security issues by severity */
  readonly securityIssues: SecurityIssues;
  /** Number of style violations */
  readonly styleViolations: number;
  /** Total test count */
  readonly testCount: number;
}

/**
 * CI/CD check results
 */
export interface CheckResults {
  /** CI pipeline passed */
  readonly ciPassed: boolean;
  /** Tests passed */
  readonly testsPassed: boolean;
  /** Lint passed */
  readonly lintPassed: boolean;
  /** Security scan passed */
  readonly securityScanPassed: boolean;
  /** Build passed */
  readonly buildPassed: boolean;
}

/**
 * Quality gate evaluation result
 */
export interface QualityGateResult {
  /** Overall pass status */
  readonly passed: boolean;
  /** Required gates results */
  readonly requiredGates: ReadonlyMap<string, boolean>;
  /** Recommended gates results */
  readonly recommendedGates: ReadonlyMap<string, boolean>;
  /** Failed gates */
  readonly failures: readonly string[];
  /** Warnings */
  readonly warnings: readonly string[];
}

// ============================================================================
// Decision Types
// ============================================================================

/**
 * Review decision with reasoning
 */
export interface Decision {
  /** Action to take */
  readonly action: ReviewDecision;
  /** Reason for the decision */
  readonly reason: string;
  /** Merge timestamp (if merged) */
  readonly mergedAt?: string;
  /** Merge commit hash (if merged) */
  readonly mergeCommit?: string;
}

/**
 * Feedback for the worker agent
 */
export interface WorkerFeedback {
  /** Positive notes about the implementation */
  readonly positiveNotes: readonly string[];
  /** Suggested improvements */
  readonly improvements: readonly string[];
  /** Learning resources (optional) */
  readonly learningResources?: readonly string[];
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Complete PR review result
 */
export interface PRReviewResult {
  /** Work order ID reference */
  readonly workOrderId: string;
  /** Issue ID reference */
  readonly issueId: string;
  /** GitHub issue number */
  readonly githubIssue?: number | undefined;
  /** Pull request information */
  readonly pullRequest: PullRequest;
  /** Review details */
  readonly review: Review;
  /** Quality metrics */
  readonly qualityMetrics: QualityMetrics;
  /** Check results */
  readonly checks: CheckResults;
  /** Quality gate evaluation */
  readonly qualityGate: QualityGateResult;
  /** Final decision */
  readonly decision: Decision;
  /** Feedback for worker */
  readonly feedbackForWorker: WorkerFeedback;
  /** Timestamp when review started */
  readonly startedAt: string;
  /** Timestamp when review completed */
  readonly completedAt: string;
}

/**
 * PR review execution options
 */
export interface PRReviewOptions {
  /** Skip CI wait */
  readonly skipCIWait?: boolean;
  /** Skip security scan */
  readonly skipSecurityScan?: boolean;
  /** Custom quality gate config */
  readonly qualityGate?: Partial<QualityGateConfig>;
  /** Force approve (bypass quality gates) */
  readonly forceApprove?: boolean;
  /** Dry run (don't actually merge/comment) */
  readonly dryRun?: boolean;
}

// ============================================================================
// Review Checklist Types
// ============================================================================

/**
 * Security checklist item
 */
export interface SecurityCheckItem {
  /** Check name */
  readonly name: string;
  /** Whether the check passed */
  readonly passed: boolean;
  /** Description of what was checked */
  readonly description: string;
  /** Details if failed */
  readonly details?: string | undefined;
}

/**
 * Complete review checklist
 */
export interface ReviewChecklist {
  /** Security checks */
  readonly security: readonly SecurityCheckItem[];
  /** Code quality checks */
  readonly quality: readonly SecurityCheckItem[];
  /** Testing checks */
  readonly testing: readonly SecurityCheckItem[];
  /** Performance checks */
  readonly performance: readonly SecurityCheckItem[];
  /** Documentation checks */
  readonly documentation: readonly SecurityCheckItem[];
}

// ============================================================================
// GitHub API Types
// ============================================================================

/**
 * GitHub PR status check
 */
export interface GitHubStatusCheck {
  /** Check name */
  readonly name: string;
  /** Check status */
  readonly status: CheckStatus;
  /** Conclusion */
  readonly conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
}

/**
 * GitHub PR info from API
 */
export interface GitHubPRInfo {
  /** PR number */
  readonly number: number;
  /** PR state */
  readonly state: 'open' | 'closed' | 'merged';
  /** Status checks */
  readonly statusCheckRollup: readonly GitHubStatusCheck[];
  /** Reviews */
  readonly reviews: readonly {
    readonly state: string;
    readonly author: string;
  }[];
}

// ============================================================================
// PR Creator Types (UC-014)
// ============================================================================

/**
 * PR Creator configuration
 */
export interface PRCreatorConfig {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Base branch for PRs (default: 'main') */
  readonly baseBranch?: string;
  /** Enable draft PR creation (default: true) */
  readonly enableDraftPR?: boolean;
  /** Coverage threshold below which PR is created as draft (default: 70) */
  readonly draftThreshold?: number;
  /** Automatically assign labels based on changes (default: true) */
  readonly autoAssignLabels?: boolean;
  /** Label mapping for branch prefixes */
  readonly labelMapping?: Record<string, readonly string[]>;
  /** Custom PR template path (null for default) */
  readonly prTemplate?: string | null;
}

/**
 * Branch validation result
 */
export interface BranchValidationResult {
  /** Whether the branch name is valid */
  readonly valid: boolean;
  /** Branch prefix (feature, fix, etc.) */
  readonly prefix?: string | undefined;
  /** Issue number if present */
  readonly issueNumber?: string | undefined;
  /** Description part of branch name */
  readonly description?: string | undefined;
  /** Validation failure reason */
  readonly reason?: string | undefined;
}

/**
 * Label inference result
 */
export interface LabelInferenceResult {
  /** Inferred labels */
  readonly labels: readonly string[];
  /** Reasons for each label */
  readonly reasons: readonly string[];
}

/**
 * PR creation result
 */
export interface PRCreateResult {
  /** Created pull request */
  readonly pullRequest: PullRequest;
  /** Whether PR was newly created (false if existing) */
  readonly created: boolean;
  /** Labels applied to PR */
  readonly labels: readonly string[];
  /** Whether PR was created as draft */
  readonly isDraft: boolean;
}

// ============================================================================
// Merge Readiness Types (UC-016)
// ============================================================================

/**
 * Merge conflict information
 */
export interface MergeConflictInfo {
  /** Whether the PR has merge conflicts */
  readonly hasConflicts: boolean;
  /** Conflicting files (if any) */
  readonly conflictingFiles: readonly string[];
  /** Whether the PR is mergeable */
  readonly mergeable: boolean;
  /** Merge state from GitHub */
  readonly mergeableState: 'clean' | 'dirty' | 'blocked' | 'behind' | 'unknown';
}

/**
 * Blocking review information from GitHub
 */
export interface BlockingReview {
  /** Reviewer username */
  readonly author: string;
  /** Review state */
  readonly state: 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  /** Review body/comment */
  readonly body: string;
  /** Review timestamp */
  readonly submittedAt: string;
}

/**
 * Individual gate result for detailed report
 */
export interface GateResult {
  /** Gate name */
  readonly gate: string;
  /** Whether gate passed */
  readonly passed: boolean;
  /** Threshold value */
  readonly threshold: number | string;
  /** Actual value */
  readonly actual: number | string;
  /** Unit (percentage, count, etc.) */
  readonly unit: string;
  /** Whether this gate is blocking */
  readonly blocking: boolean;
  /** Human-readable message */
  readonly message: string;
}

/**
 * Detailed gate failure report
 */
export interface DetailedGateReport {
  /** Report timestamp */
  readonly generatedAt: string;
  /** PR number */
  readonly prNumber: number;
  /** Overall pass status */
  readonly passed: boolean;
  /** Individual gate results */
  readonly gates: readonly GateResult[];
  /** Required actions to fix failures */
  readonly requiredActions: readonly string[];
  /** Recommendations for improvements */
  readonly recommendations: readonly string[];
  /** Markdown-formatted report */
  readonly markdown: string;
}

/**
 * Merge readiness check result
 */
export interface MergeReadinessResult {
  /** Whether PR is ready to merge */
  readonly canMerge: boolean;
  /** Quality gates result */
  readonly qualityGates: QualityGateResult;
  /** Merge conflict info */
  readonly conflicts: MergeConflictInfo;
  /** Blocking reviews */
  readonly blockingReviews: readonly BlockingReview[];
  /** CI status passed */
  readonly ciPassed: boolean;
  /** All blocking reasons (if any) */
  readonly blockingReasons: readonly string[];
  /** Detailed gate report */
  readonly detailedReport: DetailedGateReport;
}

/**
 * Squash merge commit message configuration
 */
export interface SquashMergeMessage {
  /** Commit title */
  readonly title: string;
  /** Commit body */
  readonly body: string;
  /** Issue references to close */
  readonly closesIssues: readonly number[];
}

// Re-export types from worker for convenience
export type { ImplementationResult, FileChange } from '../worker/types.js';
