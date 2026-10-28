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
  type VerificationOptions,
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
  policySourceKind,
  verificationPolicySource,
  effectiveVerificationPolicy,
  classifyStageVerification,
  summarizePipelineVerification,
  hasFailedRequiredVerification,
  PIPELINE_EXIT_CODES,
  pipelineExitCode,
  parseStageVerificationRecord,
  type PipelineExitCode,
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

// Requirements traceability record and summary
export {
  TRACEABILITY_BOUNDARY_STAGE,
  TraceabilityRecordSchema,
  buildTraceabilityRecord,
  locateDocuments,
  parseTraceabilityRecord,
  renderTraceabilityFiles,
  runTraceabilityRecord,
  summarizeTraceability,
  traceabilitySources,
  uncoveredTraceIds,
  type PipelineTraceabilityStatus,
  type PipelineTraceabilitySummary,
  type TraceabilityInput,
  type TraceabilityRecord,
  type TraceabilityRoots,
  type TracedStageResult,
} from './traceability.js';

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
