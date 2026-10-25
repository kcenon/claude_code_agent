/**
 * V&V (Verification & Validation) Shared Module
 *
 * Re-exports shared types, error classes, and utilities used across
 * all V&V subsystems.
 *
 * @module vnv
 */

// Types
export {
  type VnvRigor,
  type VerificationProfile,
  type VnvConfig,
  type VerificationContext,
  type VerificationCategory,
  type CheckSeverity,
  type OverallResult,
  type DocumentStageName,
  type DocumentType,
  DEFAULT_VNV_CONFIG,
  getDocTypeForStage,
  isDocumentStage,
} from './types.js';

// Verification policy profiles and result vocabulary
export {
  VERIFICATION_PROFILES,
  VERIFICATION_PROFILE_DEFINITIONS,
  REQUIRED_CHECK_SEVERITY,
  STAGE_VERIFICATION_STATES,
  StageVerificationRecordSchema,
  resolveVerificationProfile,
  verificationPolicySource,
  effectiveVerificationPolicy,
  classifyStageVerification,
  summarizePipelineVerification,
  pipelineExitCode,
  parseStageVerificationRecord,
  type VerificationProfileDefinition,
  type StageVerificationState,
  type VerificationCheckOutcome,
  type PipelineVerificationStatus,
  type VerificationCheckRecord,
  type StageVerificationRecord,
  type VerificationPolicySourceKind,
  type VerificationPolicySource,
  type EffectiveVerificationPolicy,
  type PipelineVerificationSummary,
  type VerifiedStageResult,
} from './policy.js';

// Errors
export {
  VnvError,
  stageVerificationFailedError,
  contentValidationError,
  traceabilityGapError,
  consistencyViolationError,
  rtmBuildError,
  validationFailedError,
  acceptanceCriteriaFailedError,
  reportGenerationError,
  vnvConfigError,
} from './errors.js';
