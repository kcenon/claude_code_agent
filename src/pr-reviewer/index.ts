/**
 * PR Reviewer Agent module exports
 *
 * Provides functionality to create PRs, perform automated code reviews,
 * enforce quality gates, and manage feedback loops.
 *
 * @example
 * ```typescript
 * import { PRReviewerAgent } from './pr-reviewer';
 *
 * const reviewer = new PRReviewerAgent();
 * const result = await reviewer.review('WO-001');
 * console.log(result.decision.action);
 * ```
 */

// Main classes
export { PRReviewerAgent, getPRReviewerAgent, resetPRReviewerAgent } from './PRReviewerAgent.js';

export { PRCreator, DEFAULT_PR_CREATOR_CONFIG } from './PRCreator.js';

export { QualityGate } from './QualityGate.js';
export type { QualityGateOptions } from './QualityGate.js';

export { ReviewChecks } from './ReviewChecks.js';
export type { ReviewChecksOptions } from './ReviewChecks.js';

// Error classes
export {
  PRReviewerError,
  ImplementationResultNotFoundError,
  ImplementationResultParseError,
  PRCreationError,
  PRAlreadyExistsError,
  PRNotFoundError,
  PRMergeError,
  PRCloseError,
  ReviewSubmissionError,
  ReviewCommentError,
  CITimeoutError,
  CICheckFailedError,
  QualityGateFailedError,
  CoverageBelowThresholdError,
  SecurityVulnerabilityError,
  GitOperationError,
  BranchNotFoundError,
  BranchNamingError,
  CommandExecutionError,
  ResultPersistenceError,
} from './errors.js';

// Type exports
export type {
  // Status types
  ReviewStatus,
  ReviewDecision,
  CommentSeverity,
  CheckStatus,

  // Configuration types
  PRReviewerAgentConfig,
  QualityGateConfig,
  QualityGateRules,
  PRCreatorConfig,

  // PR types
  PullRequest,
  PRCreateOptions,
  PRCreateResult,

  // Branch validation types
  BranchValidationResult,
  LabelInferenceResult,

  // Review types
  ReviewComment,
  Review,
  ReviewChecklist,
  SecurityCheckItem,

  // Metrics types
  QualityMetrics,
  SecurityIssues,
  CheckResults,
  QualityGateResult,

  // Decision types
  Decision,
  WorkerFeedback,

  // Result types
  PRReviewResult,
  PRReviewOptions,

  // GitHub API types
  GitHubStatusCheck,
  GitHubPRInfo,

  // Re-exported
  ImplementationResult,
} from './types.js';

// Default configurations
export { DEFAULT_PR_REVIEWER_CONFIG, DEFAULT_QUALITY_GATE_CONFIG } from './types.js';
