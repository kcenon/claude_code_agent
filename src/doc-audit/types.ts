/**
 * Doc Audit module type definitions.
 *
 * Defines the shared types used by the document audit CLI and its checks.
 * The auditor validates generated documents (PRD, SRS, SDS, SDP, TM, SVP, TD, DBS)
 * for integrity, completeness, and cross-reference consistency.
 */

/**
 * Severity levels for audit findings.
 *
 * - `error`: Violations that should fail the audit (missing required sections,
 *   invalid frontmatter, broken cross-references).
 * - `warning`: Issues that may indicate a problem but don't block the audit.
 * - `info`: Informational observations and statistics.
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Document types that the auditor recognizes.
 *
 * These correspond to the artifacts produced by the AD-SDLC pipeline stages:
 * PRD, SRS, SDS, SDP (development plan), TM (threat model), SVP (verification
 * plan), TD (tech decisions), and DBS (database schema spec).
 */
export type DocumentKind = 'PRD' | 'SRS' | 'SDS' | 'SDP' | 'TM' | 'SVP' | 'TD' | 'DBS';

/**
 * A single audit finding emitted by a check.
 */
export interface AuditFinding {
  /** Stable identifier, e.g. `frontmatter.missing-field`. */
  readonly id: string;
  /** Severity of the finding. */
  readonly severity: Severity;
  /** Name of the check that produced this finding. */
  readonly check: string;
  /** Document path (relative to project dir) where the issue was found. */
  readonly document: string;
  /** 1-based line number, when available. */
  readonly line?: number;
  /** Human-readable description of the problem. */
  readonly message: string;
  /** Optional suggestion describing how to fix the issue. */
  readonly suggestion?: string;
}

/**
 * Traceability coverage statistics.
 */
export interface CoverageStats {
  /** Forward traceability: PRD requirements referenced from SRS. */
  readonly prdToSrs: CoverageRatio;
  /** Forward traceability: SRS features referenced from SDS. */
  readonly srsToSds: CoverageRatio;
  /** Backward traceability: SDS components referencing SRS features. */
  readonly sdsToSrs: CoverageRatio;
  /** Overall coverage as a simple average percentage (0-100). */
  readonly overallPercent: number;
}

/**
 * A covered / total ratio used in coverage stats.
 */
export interface CoverageRatio {
  /** Number of items covered. */
  readonly covered: number;
  /** Total number of items considered. */
  readonly total: number;
  /** Coverage percentage, rounded to an integer 0-100. */
  readonly percent: number;
}

/**
 * Counts of findings by severity.
 */
export interface FindingCounts {
  readonly error: number;
  readonly warning: number;
  readonly info: number;
  readonly total: number;
}

/**
 * Summary of documents the auditor scanned.
 */
export interface DocumentSummary {
  /** Path to the document relative to the project dir. */
  readonly path: string;
  /** Detected document kind, or `null` if it could not be classified. */
  readonly kind: DocumentKind | null;
  /** Whether the file was successfully read. */
  readonly present: boolean;
}

/**
 * Full audit report produced by the DocAuditor.
 */
export interface AuditReport {
  /** ISO 8601 timestamp when the audit ran. */
  readonly generatedAt: string;
  /** Absolute path of the project directory that was audited. */
  readonly projectDir: string;
  /** Documents that were discovered during the audit. */
  readonly documents: readonly DocumentSummary[];
  /** All findings produced by the checks. */
  readonly findings: readonly AuditFinding[];
  /** Counts of findings by severity. */
  readonly counts: FindingCounts;
  /** Traceability coverage statistics. */
  readonly coverage: CoverageStats;
  /** Overall pass/fail — `true` when there are zero `error` findings. */
  readonly pass: boolean;
}

/**
 * Metadata for a successfully loaded document.
 */
export interface LoadedDocument {
  /** Path relative to the project directory. */
  readonly relativePath: string;
  /** Absolute path on disk. */
  readonly absolutePath: string;
  /** Document kind inferred from filename and contents. */
  readonly kind: DocumentKind;
  /** Raw file contents. */
  readonly content: string;
  /** Content split into lines (1-based indexing handled by callers). */
  readonly lines: readonly string[];
}

/**
 * Result returned by an individual audit check.
 */
export interface CheckResult {
  /** Findings emitted by this check. */
  readonly findings: readonly AuditFinding[];
}

/**
 * Interface implemented by all audit checks.
 */
export interface AuditCheck {
  /** Stable name of the check (used in findings and logs). */
  readonly name: string;
  /**
   * Run the check against the loaded document set.
   *
   * @param documents - Documents loaded from the project directory.
   * @returns Findings emitted by the check.
   */
  run(documents: readonly LoadedDocument[]): CheckResult;
}

/**
 * Configuration for the DocAuditor orchestrator.
 */
export interface DocAuditorConfig {
  /** Absolute path to the project root that contains generated docs. */
  readonly projectDir: string;
  /** Optional override for the set of checks to run. */
  readonly checks?: readonly AuditCheck[];
}
