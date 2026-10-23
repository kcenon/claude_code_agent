/**
 * Stage Verifier Type Definitions
 *
 * Types for stage verification checks, results, cross-document
 * consistency, and verification rules.
 *
 * @module stage-verifier/types
 */

import type { PipelineMode, StageName } from '../ad-sdlc-orchestrator/types.js';
import type { VnvRigor, VerificationCategory, CheckSeverity } from '../vnv/types.js';

/**
 * Single verification check result.
 *
 * Each check validates one aspect of a stage's output artifacts
 * (e.g., required sections present, ID format correct, references valid).
 */
export interface VerificationCheck {
  /** Unique check identifier (e.g., 'VR-COL-001') */
  readonly checkId: string;
  /** Human-readable check name */
  readonly name: string;
  /** Verification category */
  readonly category: VerificationCategory;
  /** Whether the check passed (true for skipped checks; see `skipReason`) */
  readonly passed: boolean;
  /** Check severity determining failure handling */
  readonly severity: CheckSeverity;
  /** Descriptive message explaining the result */
  readonly message: string;
  /** Additional structured details about the check result */
  readonly details?: Record<string, unknown>;
  /**
   * Set when the rule could not evaluate its condition (for example, the
   * artifact does not report the field it inspects). Such a check is
   * reported as `skipped`, never as a verified pass.
   */
  readonly skipReason?: string;
}

/**
 * A rule in the stage's check set that did not run because the effective
 * rigor is below the rule's minimum.
 */
export interface SkippedVerificationRule {
  readonly checkId: string;
  readonly name: string;
  readonly severity: CheckSeverity;
  /** Minimum rigor the rule requires */
  readonly minRigor: VnvRigor;
}

/**
 * Stage identity passed to rules that depend on the producing agent
 * (for example, a local review report versus a GitHub pull request review).
 */
export interface VerificationRuleContext {
  readonly stageName: StageName;
  readonly agentType: string;
  readonly pipelineMode: PipelineMode;
}

/**
 * Aggregated verification result for a single pipeline stage.
 *
 * Collects all individual check results, determines overall pass/fail,
 * and records timing metadata.
 */
export interface StageVerificationResult {
  /** Stage that was verified */
  readonly stageName: StageName;
  /** Whether all required checks passed */
  readonly passed: boolean;
  /** Rigor level used for this verification */
  readonly rigor: VnvRigor;
  /** Individual check results */
  readonly checks: readonly VerificationCheck[];
  /** Warning messages from checks with 'warning' severity */
  readonly warnings: readonly string[];
  /** Error messages from checks with 'error' severity that failed */
  readonly errors: readonly string[];
  /** ISO timestamp of verification completion */
  readonly timestamp: string;
  /** Duration of verification in milliseconds */
  readonly durationMs: number;
  /** Named check set applied to the stage (from the applicability inventory) */
  readonly checkSet?: string;
  /** Present when the stage's disposition is `not_applicable` */
  readonly notApplicableReason?: string;
  /** Rules of the check set filtered out by the rigor level */
  readonly skippedRules?: readonly SkippedVerificationRule[];
}

/**
 * A single cross-document consistency violation.
 *
 * Detected when a sync point value differs between two documents
 * that should remain in sync (e.g., PRD and SRS).
 */
export interface ConsistencyViolation {
  /** Name of the sync point that was violated */
  readonly syncPointName: string;
  /** Violation severity */
  readonly severity: 'critical' | 'high' | 'medium';
  /** Source document where the value was expected */
  readonly sourceDoc: string;
  /** Target document where the value diverged */
  readonly targetDoc: string;
  /** Description of the inconsistency */
  readonly description: string;
}

/**
 * Result of cross-document consistency checking.
 *
 * Reports how many sync points were validated and any violations found.
 */
export interface ConsistencyCheckResult {
  /** Whether all sync points are consistent */
  readonly passed: boolean;
  /** Number of sync points that were checked */
  readonly syncPointsChecked: number;
  /** Detected consistency violations */
  readonly violations: readonly ConsistencyViolation[];
}

/**
 * Verification rule definition.
 *
 * Rules are associated with pipeline stages and filtered by rigor level.
 * Each rule implements a `check` function that reads artifacts and
 * returns a verification result.
 */
export interface VerificationRule {
  /** Unique check identifier (e.g., 'VR-COL-001') */
  readonly checkId: string;
  /** Human-readable rule name */
  readonly name: string;
  /** Verification category */
  readonly category: VerificationCategory;
  /** Minimum rigor level required for this rule to execute */
  readonly minRigor: VnvRigor;
  /** Check severity determining how failures are treated */
  readonly severity: CheckSeverity;
  /**
   * Execute the verification check against stage artifacts.
   *
   * @param artifacts - File paths from the stage result (project-relative manifest locations)
   * @param projectDir - Absolute path to the project root
   * @param context - Producing stage identity, when the caller knows it
   * @returns Verification check result
   */
  check(
    artifacts: readonly string[],
    projectDir: string,
    context?: VerificationRuleContext
  ): Promise<VerificationCheck>;
}
