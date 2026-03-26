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
