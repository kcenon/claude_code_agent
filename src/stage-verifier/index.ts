/**
 * Stage Verifier Module
 *
 * Provides stage-level verification for the AD-SDLC pipeline.
 * Validates artifacts produced by each pipeline stage against
 * structure, content, traceability, and quality rules.
 *
 * @module stage-verifier
 */

// Types
export type {
  VerificationCheck,
  StageVerificationResult,
  ConsistencyViolation,
  ConsistencyCheckResult,
  VerificationRule,
  VerificationRuleContext,
  SkippedVerificationRule,
} from './types.js';

// Schemas
export {
  VerificationCategorySchema,
  CheckSeveritySchema,
  VnvRigorSchema,
  ConsistencyViolationSeveritySchema,
  VerificationCheckSchema,
  StageVerificationResultSchema,
  ConsistencyViolationSchema,
  ConsistencyCheckResultSchema,
  VerificationRuleMetadataSchema,
  type VerificationCheckData,
  type StageVerificationResultData,
  type ConsistencyViolationData,
  type ConsistencyCheckResultData,
  type VerificationRuleMetadata,
} from './schemas.js';

// Errors
export { StageVerificationError } from './errors.js';

// Rules
export {
  VERIFICATION_RULES,
  VERIFICATION_CHECK_SETS,
  shouldRunRule,
  type VerificationCheckSetId,
} from './rules.js';

// Applicability inventory
export {
  VERIFICATION_APPLICABILITY,
  CANONICAL_STAGE_GRAPHS,
  verificationDisposition,
  verificationCheckSet,
  checkVerificationInventory,
  verificationCoverage,
  renderVerificationCoverageBlock,
  type StageVerificationDisposition,
  type CheckSetDisposition,
  type NotApplicableDisposition,
  type VerificationApplicabilityTable,
  type VerificationInventoryViolation,
  type VerificationCoverage,
} from './applicability.js';

// Agent
export { StageVerifierAgent, STAGE_VERIFIER_AGENT_ID } from './StageVerifierAgent.js';
