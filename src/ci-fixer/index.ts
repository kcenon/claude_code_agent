/**
 * CI Fixer module
 *
 * Provides automated CI/CD failure diagnosis and fix capabilities.
 * Receives handoffs from PR Reviewer Agent and attempts to fix failures.
 *
 * @module ci-fixer
 */

// Main agent
export {
  CIFixAgent,
  getCIFixAgent,
  resetCIFixAgent,
  CI_FIX_AGENT_ID,
} from './CIFixAgent.js';

// Log analyzer
export { CILogAnalyzer, getCILogAnalyzer, resetCILogAnalyzer } from './CILogAnalyzer.js';

// Fix strategies
export { FixStrategies } from './FixStrategies.js';
export type { FixStrategyOptions } from './FixStrategies.js';

// Types
export type {
  // Status and category types
  CICheckStatus,
  CIFailureCategory,
  FixOutcome,
  NextActionType,
  EscalationReason,

  // Configuration
  CIFixerAgentConfig,

  // CI check types
  CICheck,
  CIFailure,
  CIAnalysisResult,

  // Fix types
  AppliedFix,
  VerificationResult,

  // Handoff types
  CIFixAttempt,
  CIFixHandoff,

  // Result types
  NextAction,
  CIFixResult,

  // Escalation types
  EscalationInfo,

  // Pattern types
  CILogPattern,

  // Progress tracking
  ProgressComparison,
} from './types.js';

export { DEFAULT_CI_FIXER_CONFIG } from './types.js';

// Errors
export {
  CIFixerError,
  HandoffNotFoundError,
  HandoffParseError,
  HandoffValidationError,
  CILogFetchError,
  CILogParseError,
  CILogsNotAvailableError,
  FixApplicationError,
  LintFixError,
  TypeFixError,
  TestFixError,
  BuildFixError,
  VerificationError,
  VerificationTimeoutError,
  MaxDelegationsExceededError,
  HandoffCreationError,
  EscalationRequiredError,
  EscalationError,
  GitOperationError,
  CommitError,
  PushError,
  CIWaitTimeoutError,
  CIStillFailingError,
  SecurityVulnerabilityError,
  ResultPersistenceError,
} from './errors.js';
