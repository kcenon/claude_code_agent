/**
 * RTM Builder Type Definitions
 *
 * Types for the Requirements Traceability Matrix (RTM) builder agent,
 * which assembles end-to-end traceability from PRD requirements through
 * implementation and validation.
 *
 * @module rtm-builder/types
 */

import type { PipelineMode } from '../ad-sdlc-orchestrator/types.js';

// =============================================================================
// Acceptance Criteria
// =============================================================================

/**
 * Single acceptance criterion tracked within the RTM
 */
export interface RtmAcceptanceCriterion {
  /** Acceptance criterion identifier (e.g., AC-001) */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Whether this criterion has been validated */
  readonly validated: boolean;
  /** Method used for validation (e.g., unit-test, integration-test, manual) */
  readonly validationMethod?: string;
}

// =============================================================================
// Implementation Status
// =============================================================================

/**
 * Implementation status for a single work order
 */
export interface RtmImplStatus {
  /** Work order identifier */
  readonly workOrderId: string;
  /** Current implementation status */
  readonly status: 'completed' | 'failed' | 'blocked';
  /** Whether associated tests passed */
  readonly testsPassed: boolean;
  /** Whether the build passed */
  readonly buildPassed: boolean;
}

// =============================================================================
// RTM Entry
// =============================================================================

/**
 * Single row in the Requirements Traceability Matrix.
 *
 * Tracks one functional requirement (FR-XXX) from PRD through SRS features,
 * SDS components, issues, work orders, implementations, and PRs.
 */
export interface RtmEntry {
  /** Functional requirement identifier (FR-XXX) */
  readonly requirementId: string;
  /** Human-readable requirement title */
  readonly requirementTitle: string;
  /** Requirement priority (P0-P3) */
  readonly priority: string;
  /** SRS features implementing this requirement (SF-XXX) */
  readonly features: readonly string[];
  /** SRS use cases for this requirement (UC-XXX) */
  readonly useCases: readonly string[];
  /** SDS components implementing the features (CMP-XXX) */
  readonly components: readonly string[];
  /** GitHub issues or internal issue identifiers (ISS-XXX or number) */
  readonly issues: readonly string[];
  /** Work order identifiers */
  readonly workOrders: readonly string[];
  /** Implementation results per work order */
  readonly implementations: readonly RtmImplStatus[];
  /** Pull request identifiers or URLs */
  readonly pullRequests: readonly string[];
  /** Acceptance criteria and their validation status */
  readonly acceptanceCriteria: readonly RtmAcceptanceCriterion[];
  /** Overall status for this requirement chain */
  readonly status: 'not_started' | 'in_progress' | 'implemented' | 'verified';
}

// =============================================================================
// RTM Gap Analysis
// =============================================================================

/**
 * Type of gap identified in the traceability chain
 */
export type RtmGapType =
  | 'uncovered_requirement'
  | 'orphan_component'
  | 'missing_test'
  | 'unvalidated_acceptance_criteria'
  | 'broken_chain';

/**
 * A gap or issue identified during RTM analysis
 */
export interface RtmGap {
  /** Gap classification */
  readonly type: RtmGapType;
  /** Severity: error blocks verification, warning is informational */
  readonly severity: 'error' | 'warning';
  /** IDs of artifacts affected by this gap */
  readonly affectedIds: readonly string[];
  /** Human-readable description of the gap */
  readonly message: string;
}

// =============================================================================
// Coverage Metrics
// =============================================================================

/**
 * Coverage metrics summarising RTM completeness
 */
export interface RtmCoverageMetrics {
  /** Total number of functional requirements in PRD */
  readonly totalRequirements: number;
  /** Requirements with at least one SRS feature */
  readonly requirementsWithFeatures: number;
  /** Requirements with at least one SDS component */
  readonly requirementsWithComponents: number;
  /** Requirements with at least one issue */
  readonly requirementsWithIssues: number;
  /** Requirements with at least one implementation result */
  readonly requirementsWithImplementations: number;
  /** Requirements with at least one pull request */
  readonly requirementsWithPRs: number;
  /** Forward coverage: % of requirements traced to components */
  readonly forwardCoveragePercent: number;
  /** Backward coverage: % of components traced back to requirements */
  readonly backwardCoveragePercent: number;
  /** Total acceptance criteria across all requirements */
  readonly acceptanceCriteriaTotal: number;
  /** Number of acceptance criteria that have been validated */
  readonly acceptanceCriteriaValidated: number;
}

// =============================================================================
// Requirements Traceability Matrix
// =============================================================================

/**
 * Complete Requirements Traceability Matrix document
 */
export interface RequirementsTraceabilityMatrix {
  /** RTM schema version */
  readonly version: string;
  /** Project identifier */
  readonly projectId: string;
  /** ISO timestamp of generation */
  readonly generatedAt: string;
  /** Pipeline mode that produced the traced artifacts */
  readonly pipelineMode: PipelineMode;
  /** All traceability entries (one per FR) */
  readonly entries: readonly RtmEntry[];
  /** Aggregated coverage metrics */
  readonly coverageMetrics: RtmCoverageMetrics;
  /** Identified gaps in the traceability chain */
  readonly gaps: readonly RtmGap[];
}

// =============================================================================
// Validation Result
// =============================================================================

/**
 * Result of RTM completeness validation
 */
export interface RtmValidationResult {
  /** Whether the RTM passes completeness checks */
  readonly valid: boolean;
  /** Identified gaps */
  readonly gaps: readonly RtmGap[];
  /** Coverage metrics at validation time */
  readonly coverageMetrics: RtmCoverageMetrics;
}

// =============================================================================
// Build Context
// =============================================================================

/**
 * Context required to build an RTM
 */
export interface RtmBuildContext {
  /** Absolute path to the project root directory */
  readonly projectDir: string;
  /** Unique project identifier */
  readonly projectId: string;
  /** Active pipeline mode */
  readonly pipelineMode: PipelineMode;
}
