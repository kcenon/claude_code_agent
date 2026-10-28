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
 * Named verification policy profile.
 *
 * - `advisory`: checks run at the configured rigor; failures are retained as
 *   findings and never stop the pipeline.
 * - `delivery`: a failed required (error-severity) check fails its stage,
 *   skips every stage not yet run, and fails the run.
 *
 * See `src/vnv/policy.ts` and docs/guides/verification-policy.md.
 */
export type VerificationProfile = 'advisory' | 'delivery';

/**
 * V&V configuration controlling which checks and reports are enabled.
 */
export interface VnvConfig {
  /** Rigor level for verification checks */
  readonly rigor: VnvRigor;
  /**
   * If true, halt pipeline when a verification gate fails (effective only in strict mode).
   * Legacy mapping: without `profile`, strict + true selects the `delivery` profile.
   */
  readonly haltOnVerificationFailure: boolean;
  /**
   * Explicit verification profile. When absent, the profile is derived from
   * `rigor` and `haltOnVerificationFailure` (strict + true is `delivery`,
   * anything else is `advisory`), so existing configurations keep their behavior.
   */
  readonly profile?: VerificationProfile;
  /**
   * @deprecated Not supported. No pipeline stage or orchestrator step generates
   * a V&V plan; setting this to true only adds a deprecation warning to the run
   * result. See docs/guides/verification-policy.md.
   */
  readonly generateVnvPlan?: boolean;
  /**
   * @deprecated Not supported. The run result's `verification` and
   * `traceability` summaries replace a generated V&V report; setting this to
   * true only adds a deprecation warning to the run result.
   */
  readonly generateVnvReport?: boolean;
  /** Write the run's requirements traceability matrix (JSON and Markdown) */
  readonly generateRtm: boolean;
  /** Run the cross-document consistency check (VR-XDOC-001) after document-producing stages */
  readonly crossDocumentConsistency: boolean;
  /** Check at final validation that every acceptance criterion is implemented and tested (VR-VAL-004) */
  readonly acceptanceCriteriaValidation: boolean;
}

/**
 * The supported V&V output and check toggles passed to stage verification.
 */
export type VerificationOptions = Pick<
  VnvConfig,
  'generateRtm' | 'crossDocumentConsistency' | 'acceptanceCriteriaValidation'
>;

/**
 * Default V&V configuration.
 *
 * Standard rigor with traceability, consistency, and acceptance checks enabled.
 */
export const DEFAULT_VNV_CONFIG: Readonly<VnvConfig> = {
  rigor: 'standard',
  haltOnVerificationFailure: false,
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
  /**
   * Effective V&V options. Without them the consistency and traceability
   * checks are skipped and no traceability record is built.
   */
  readonly options?: VerificationOptions;
  /** Artifact locations of the run's earlier completed stages (manifest-derived) */
  readonly upstreamArtifacts?: readonly string[];
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
  'content' | 'structure' | 'traceability' | 'quality' | 'consistency';

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
