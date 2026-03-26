/**
 * Stage Verifier Type Definitions
 *
 * Types for stage verification checks, results, cross-document
 * consistency, and verification rules.
 *
 * @module stage-verifier/types
 */

import type { StageName } from '../ad-sdlc-orchestrator/types.js';
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
  /** Whether the check passed */
  readonly passed: boolean;
  /** Check severity determining failure handling */
  readonly severity: CheckSeverity;
  /** Descriptive message explaining the result */
  readonly message: string;
  /** Additional structured details about the check result */
  readonly details?: Record<string, unknown>;
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
   * @param artifacts - File paths from the stage result
   * @param projectDir - Absolute path to the project root
   * @returns Verification check result
   */
  check(artifacts: readonly string[], projectDir: string): Promise<VerificationCheck>;
}
