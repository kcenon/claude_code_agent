/**
 * Validation Agent Type Definitions
 *
 * Types for the Validation Agent that validates pipeline outputs against
 * requirements, acceptance criteria, traceability chains, and quality gates.
 *
 * @module validation-agent/types
 */

import type { VnvRigor, OverallResult } from '../vnv/types.js';
import type { PipelineMode } from '../ad-sdlc-orchestrator/types.js';
import type { RequirementsTraceabilityMatrix } from '../rtm-builder/types.js';

// =============================================================================
// Validation Context
// =============================================================================

/**
 * Context required to run validation against a completed pipeline
 */
export interface ValidationContext {
  /** Absolute path to the project root directory */
  readonly projectDir: string;
  /** Unique project identifier */
  readonly projectId: string;
  /** Active pipeline mode */
  readonly pipelineMode: PipelineMode;
  /** Rigor level for this validation run */
  readonly rigor: VnvRigor;
  /** Unique pipeline execution identifier */
  readonly pipelineId: string;
  /** The RTM built from pipeline artifacts */
  readonly rtm: RequirementsTraceabilityMatrix;
}

// =============================================================================
// Requirement Validation
// =============================================================================

/**
 * Summary of requirement implementation coverage
 */
export interface RequirementValidationSummary {
  /** Total number of functional requirements in RTM */
  readonly totalRequirements: number;
  /** Number of requirements with at least one implementation */
  readonly implementedRequirements: number;
  /** Number of requirements with verified status */
  readonly verifiedRequirements: number;
  /** IDs of requirements that have no implementations */
  readonly unimplementedRequirements: readonly string[];
  /** Percentage of requirements that are implemented (0-100) */
  readonly coveragePercent: number;
}

// =============================================================================
// Acceptance Criteria Validation
// =============================================================================

/**
 * Validation result for a single acceptance criterion
 */
export interface AcceptanceCriterionResult {
  /** Acceptance criterion identifier (e.g., AC-001) */
  readonly criterionId: string;
  /** Parent requirement identifier (e.g., FR-001) */
  readonly requirementId: string;
  /** Human-readable description of the criterion */
  readonly description: string;
  /** Validation result */
  readonly result: 'pass' | 'fail' | 'untested';
  /** Evidence supporting the result */
  readonly evidence?: string;
}

/**
 * Summary of acceptance criteria validation across all requirements
 */
export interface AcceptanceCriteriaValidationSummary {
  /** Total number of acceptance criteria across all requirements */
  readonly totalCriteria: number;
  /** Number of criteria that passed validation */
  readonly validatedCriteria: number;
  /** Criteria that failed validation */
  readonly failedCriteria: readonly AcceptanceCriterionResult[];
  /** IDs of criteria that were not tested */
  readonly untestedCriteria: readonly string[];
  /** Percentage of criteria that passed (0-100) */
  readonly passRate: number;
}

// =============================================================================
// Traceability Validation
// =============================================================================

/**
 * Summary of traceability chain completeness
 */
export interface TraceabilityValidationSummary {
  /** Whether all traceability chains are complete (FR → SF → CMP → impl) */
  readonly chainComplete: boolean;
  /** Descriptions of broken links in traceability chains */
  readonly brokenLinks: readonly string[];
  /** IDs of artifacts not traced to any requirement */
  readonly orphanArtifacts: readonly string[];
  /** Forward coverage: % of requirements traced to components (0-100) */
  readonly forwardCoverage: number;
  /** Backward coverage: % of components traced back to requirements (0-100) */
  readonly backwardCoverage: number;
}

// =============================================================================
// Quality Gate Validation
// =============================================================================

/**
 * Result of a single quality gate check
 */
export interface QualityGateResult {
  /** Name of the quality gate */
  readonly gateName: string;
  /** Whether the gate passed */
  readonly passed: boolean;
  /** Human-readable details about the gate result */
  readonly details: string;
}

/**
 * Summary of all quality gate validations
 */
export interface QualityGateValidationSummary {
  /** Whether all quality gates passed */
  readonly allGatesPassed: boolean;
  /** Individual gate results */
  readonly gateResults: readonly QualityGateResult[];
}

// =============================================================================
// Validation Report
// =============================================================================

/**
 * Complete validation report for a pipeline run
 */
export interface ValidationReport {
  /** Unique report identifier */
  readonly reportId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Pipeline execution identifier */
  readonly pipelineId: string;
  /** ISO timestamp of report generation */
  readonly generatedAt: string;
  /** Overall validation result */
  readonly overallResult: OverallResult;
  /** Rigor level used for this validation */
  readonly rigor: VnvRigor;
  /** Requirement implementation coverage */
  readonly requirementValidation: RequirementValidationSummary;
  /** Acceptance criteria validation results */
  readonly acceptanceCriteriaValidation: AcceptanceCriteriaValidationSummary;
  /** Traceability chain completeness */
  readonly traceabilityValidation: TraceabilityValidationSummary;
  /** Quality gate results */
  readonly qualityGateResults: QualityGateValidationSummary;
  /** Actionable recommendations based on findings */
  readonly recommendations: readonly string[];
}
