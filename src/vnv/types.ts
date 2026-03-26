/**
 * V&V (Verification & Validation) Shared Type Definitions
 *
 * Core types used across all V&V modules: stage-verifier, rtm-builder,
 * validation-agent, and vnv-report.
 *
 * @module vnv/types
 */

import type { PipelineMode, StageName } from '../ad-sdlc-orchestrator/types.js';

/**
 * V&V rigor level controlling the depth and strictness of checks.
 *
 * - `strict`:   All checks run. Pipeline halts on any verification failure.
 *               Traceability coverage must be 100%.
 * - `standard`: Content and traceability checks run. Failures are logged as
 *               warnings but the pipeline continues. Coverage threshold ≥ 80%.
 * - `minimal`:  Only Zod schema and file-existence checks. No content,
 *               traceability, or consistency checks.
 */
export type VnvRigor = 'strict' | 'standard' | 'minimal';

/**
 * V&V configuration controlling which checks and reports are enabled.
 */
export interface VnvConfig {
  /** Rigor level for verification checks */
  readonly rigor: VnvRigor;
  /** If true, halt pipeline when a verification gate fails (effective only in strict mode) */
  readonly haltOnVerificationFailure: boolean;
  /** Generate V&V Plan document at pipeline start */
  readonly generateVnvPlan: boolean;
  /** Generate V&V Report document at pipeline end */
  readonly generateVnvReport: boolean;
  /** Generate standalone RTM artifact */
  readonly generateRtm: boolean;
  /** Run cross-document consistency checks after document-producing stages */
  readonly crossDocumentConsistency: boolean;
  /** Validate acceptance criteria against implementation results */
  readonly acceptanceCriteriaValidation: boolean;
}

/**
 * Default V&V configuration.
 *
 * Standard rigor with all documentation features enabled.
 */
export const DEFAULT_VNV_CONFIG: Readonly<VnvConfig> = {
  rigor: 'standard',
  haltOnVerificationFailure: false,
  generateVnvPlan: true,
  generateVnvReport: true,
  generateRtm: true,
  crossDocumentConsistency: true,
  acceptanceCriteriaValidation: true,
} as const;

/**
 * Runtime context passed to all V&V operations within a pipeline execution.
 */
export interface VerificationContext {
  /** Absolute path to the project root directory */
  readonly projectDir: string;
  /** Unique project identifier */
  readonly projectId: string;
  /** Active pipeline mode */
  readonly pipelineMode: PipelineMode;
  /** Rigor level for this pipeline run */
  readonly rigor: VnvRigor;
  /** Unique pipeline execution identifier */
  readonly pipelineId: string;
}

/**
 * Verification check category.
 *
 * - `content`:       Validates output completeness (e.g., required sections present)
 * - `structure`:     Validates schema conformance and ID formatting
 * - `traceability`:  Validates cross-artifact linkage (FR→SF→UC→CMP)
 * - `quality`:       Validates quality metrics (test pass, coverage, lint)
 * - `consistency`:   Validates cross-document sync-point alignment
 */
export type VerificationCategory =
  | 'content'
  | 'structure'
  | 'traceability'
  | 'quality'
  | 'consistency';

/**
 * Check severity determining how failures are treated.
 *
 * - `error`:   Hard failure. Blocks pipeline in strict mode.
 * - `warning`: Soft failure. Logged but does not block.
 * - `info`:    Informational. Always logged, never blocks.
 */
export type CheckSeverity = 'error' | 'warning' | 'info';

/**
 * Overall validation result for a pipeline run.
 */
export type OverallResult = 'pass' | 'pass_with_warnings' | 'fail';

/**
 * Stage names that produce documents requiring cross-document consistency checks.
 */
export type DocumentStageName =
  | 'prd_generation'
  | 'srs_generation'
  | 'sds_generation'
  | 'prd_update'
  | 'srs_update'
  | 'sds_update';

/**
 * Document type identifier for cross-document consistency checks.
 */
export type DocumentType = 'prd' | 'srs' | 'sds';

/**
 * Map a document-producing stage to its document type.
 * @param stage
 */
export function getDocTypeForStage(stage: StageName): DocumentType | null {
  switch (stage) {
    case 'prd_generation':
    case 'prd_update':
      return 'prd';
    case 'srs_generation':
    case 'srs_update':
      return 'srs';
    case 'sds_generation':
    case 'sds_update':
      return 'sds';
    default:
      return null;
  }
}

/**
 * Check if a stage is a document-producing stage.
 * @param stage
 */
export function isDocumentStage(stage: StageName): stage is DocumentStageName {
  return getDocTypeForStage(stage) !== null;
}
