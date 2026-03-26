/**
 * V&V Report Generator Type Definitions
 *
 * Additional types used by the VnvReportGenerator that are not already
 * defined in shared V&V modules. Most types are imported from vnv/types,
 * stage-verifier/types, rtm-builder/types, and ad-sdlc-orchestrator/types.
 *
 * @module vnv-report/types
 */

import type { VnvRigor } from '../vnv/types.js';

// =============================================================================
// Validation Report Summary
// =============================================================================

/** Single failed acceptance criterion entry */
export interface FailedCriterionEntry {
  readonly criterionId: string;
  readonly requirementId: string;
  readonly description: string;
  readonly result: string;
}

/** Single quality gate result entry */
export interface QualityGateResultEntry {
  readonly gateName: string;
  readonly passed: boolean;
  readonly details: string;
}

/**
 * Minimal validation report shape used by the report generator.
 *
 * This mirrors the output of the validation-agent module (being built
 * in parallel) and contains the information needed for V&V reporting.
 */
export interface ValidationReportSummary {
  readonly reportId: string;
  readonly projectId: string;
  readonly pipelineId: string;
  readonly generatedAt: string;
  readonly overallResult: 'pass' | 'pass_with_warnings' | 'fail';
  readonly rigor: VnvRigor;
  readonly requirementValidation: {
    readonly totalRequirements: number;
    readonly implementedRequirements: number;
    readonly verifiedRequirements: number;
    readonly unimplementedRequirements: readonly string[];
    readonly coveragePercent: number;
  };
  readonly acceptanceCriteriaValidation: {
    readonly totalCriteria: number;
    readonly validatedCriteria: number;
    readonly failedCriteria: readonly FailedCriterionEntry[];
    readonly untestedCriteria: readonly string[];
    readonly passRate: number;
  };
  readonly traceabilityValidation: {
    readonly chainComplete: boolean;
    readonly brokenLinks: readonly string[];
    readonly orphanArtifacts: readonly string[];
    readonly forwardCoverage: number;
    readonly backwardCoverage: number;
  };
  readonly qualityGateResults: {
    readonly allGatesPassed: boolean;
    readonly gateResults: readonly QualityGateResultEntry[];
  };
  readonly recommendations: readonly string[];
}

// =============================================================================
// Stage Verification Summary
// =============================================================================

/** Single verification check summary entry */
export interface VerificationCheckSummary {
  readonly checkId: string;
  readonly name: string;
  readonly category: string;
  readonly passed: boolean;
  readonly severity: string;
  readonly message: string;
}

/**
 * Stage verification result shape used by the report generator.
 *
 * A simplified view of StageVerificationResult from stage-verifier/types,
 * using string-typed fields for serialisation flexibility.
 */
export interface StageVerificationSummary {
  readonly stageName: string;
  readonly passed: boolean;
  readonly rigor: VnvRigor;
  readonly checks: readonly VerificationCheckSummary[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly timestamp: string;
  readonly durationMs: number;
}

// =============================================================================
// Quality Gates Configuration
// =============================================================================

/** Document quality gate config for a specific document type */
export interface DocumentQualityGateConfig {
  readonly required_sections?: readonly string[];
  readonly min_requirements?: number;
}

/** Code quality gate configuration */
export interface CodeQualityGateConfig {
  readonly coverage_threshold?: number;
  readonly max_complexity?: number;
}

/** Security quality gate configuration */
export interface SecurityQualityGateConfig {
  readonly no_hardcoded_secrets?: boolean;
  readonly require_input_validation?: boolean;
}

/**
 * Quality gates configuration controlling acceptance thresholds
 * for documents, code, and security.
 */
export interface QualityGatesConfig {
  readonly document_quality?: {
    readonly prd?: DocumentQualityGateConfig;
    readonly srs?: DocumentQualityGateConfig;
    readonly sds?: DocumentQualityGateConfig;
  };
  readonly code_quality?: CodeQualityGateConfig;
  readonly security?: SecurityQualityGateConfig;
}

// =============================================================================
// Report Generator Input Types
// =============================================================================

/** RTM data subset consumed by the report generator */
export interface RtmReportData {
  readonly entries: readonly {
    readonly requirementId: string;
    readonly requirementTitle: string;
    readonly features: readonly string[];
    readonly useCases: readonly string[];
    readonly components: readonly string[];
    readonly issues: readonly string[];
    readonly status: string;
  }[];
  readonly coverageMetrics: {
    readonly totalRequirements: number;
    readonly requirementsWithFeatures: number;
    readonly requirementsWithComponents: number;
    readonly requirementsWithIssues: number;
    readonly requirementsWithImplementations: number;
    readonly requirementsWithPRs: number;
    readonly forwardCoveragePercent: number;
    readonly backwardCoveragePercent: number;
    readonly acceptanceCriteriaTotal: number;
    readonly acceptanceCriteriaValidated: number;
  };
  readonly gaps: readonly {
    readonly type: string;
    readonly severity: string;
    readonly affectedIds: readonly string[];
    readonly message: string;
  }[];
}

/** Pipeline result subset consumed by the report generator */
export interface PipelineReportData {
  readonly pipelineId: string;
  readonly mode: string;
  readonly overallStatus: string;
  readonly durationMs: number;
}
