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
export { VERIFICATION_RULES, shouldRunRule } from './rules.js';

// Agent
export { StageVerifierAgent, STAGE_VERIFIER_AGENT_ID } from './StageVerifierAgent.js';
