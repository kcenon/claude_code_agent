/**
 * Tech Decision Writer Agent module type definitions
 *
 * Defines types for Technology Decision (TD) document generation from SDS
 * (Software Design Specification) input. Each major technology decision
 * identified in the SDS produces one comparison document that evaluates
 * candidate technologies against weighted criteria and records the rationale
 * for the chosen option.
 */

/**
 * Tech Decision generation status
 */
export type TechDecisionGenerationStatus =
  | 'pending'
  | 'parsing'
  | 'generating'
  | 'completed'
  | 'failed';

/**
 * Document status (mirrors other writer agents)
 */
export type TechDecisionDocumentStatus = 'Draft' | 'Review' | 'Approved';

// ============================================================================
// Decision domain types
// ============================================================================

/**
 * A single candidate technology considered for a decision.
 */
export interface Candidate {
  /** Candidate display name, e.g., "PostgreSQL" */
  readonly name: string;
  /** High-level category such as "Database", "Language", "Framework" */
  readonly category: string;
  /** License of the candidate, e.g., "PostgreSQL License", "MIT", "Proprietary" */
  readonly license: string;
  /** Maturity level (Mature / Stable / Emerging / Experimental) */
  readonly maturity: 'Mature' | 'Stable' | 'Emerging' | 'Experimental';
  /** Short description of the candidate */
  readonly description: string;
}

/**
 * Criterion used to evaluate technology candidates.
 *
 * The default criteria set (defined in ComparisonGenerator) totals 100%
 * weight across Performance, Ecosystem, Learning, Maintenance, Cost, and
 * Security. Custom criteria can be supplied at the agent level.
 */
export interface EvaluationCriterion {
  /** Criterion name, e.g., "Performance" */
  readonly name: string;
  /** Normalized weight, 0-1. All criteria should sum to 1.0 */
  readonly weight: number;
  /** Short description of how the criterion is measured */
  readonly description: string;
}

/**
 * A single row of the evaluation matrix: one candidate's scores per
 * criterion along with the weighted total.
 */
export interface EvaluationMatrixRow {
  /** Candidate name the row applies to */
  readonly candidate: string;
  /** Raw scores keyed by criterion name, each in 1-10 */
  readonly scores: Readonly<Record<string, number>>;
  /** Weighted total score (sum of score * weight) */
  readonly weightedTotal: number;
}

/**
 * Full evaluation matrix: criteria and one row per candidate.
 */
export interface EvaluationMatrix {
  /** Criteria used for the evaluation */
  readonly criteria: readonly EvaluationCriterion[];
  /** One row per candidate */
  readonly rows: readonly EvaluationMatrixRow[];
}

/**
 * The recorded decision for a technology question.
 */
export interface Decision {
  /** Name of the selected candidate */
  readonly selected: string;
  /** Rationale explaining why this candidate won */
  readonly rationale: string;
  /** ISO date of the decision (YYYY-MM-DD) */
  readonly decidedAt: string;
}

/**
 * Expected consequences of a decision.
 */
export interface Consequences {
  /** Positive outcomes expected from the decision */
  readonly positive: readonly string[];
  /** Negative trade-offs accepted by the decision */
  readonly negative: readonly string[];
  /** Risks that should be monitored or mitigated */
  readonly risks: readonly string[];
}

/**
 * A single technology decision document.
 */
export interface TechDecision {
  /** Sequential decision number (1-based) */
  readonly number: number;
  /** URL-safe topic slug used in the filename */
  readonly topicSlug: string;
  /** Human-readable topic title, e.g., "Database Selection" */
  readonly topic: string;
  /** Short context explaining why the decision is needed */
  readonly context: string;
  /** Candidate technologies considered */
  readonly candidates: readonly Candidate[];
  /** Evaluation matrix */
  readonly matrix: EvaluationMatrix;
  /** Final decision */
  readonly decision: Decision;
  /** Consequences of the decision */
  readonly consequences: Consequences;
  /** Cross-references to related SDS components and SRS NFRs */
  readonly references: readonly string[];
}

// ============================================================================
// Parsed input types (lightweight extracts)
// ============================================================================

/**
 * Technology stack row parsed from the SDS `### 2.3 Technology Stack` table.
 */
export interface ParsedTechStackRow {
  /** Architecture layer, e.g., "Runtime", "Database" */
  readonly layer: string;
  /** Technology name */
  readonly technology: string;
  /** Declared version */
  readonly version: string;
  /** Rationale text from the SDS */
  readonly rationale: string;
}

/**
 * Component reference extracted from the SDS for cross-linking.
 */
export interface ParsedSDSComponentRef {
  /** Component identifier, e.g., "CMP-001" */
  readonly id: string;
  /** Component name */
  readonly name: string;
}

/**
 * Lightweight SDS extract consumed by the Tech Decision Writer.
 */
export interface ParsedSDSForDecisions {
  /** SDS document ID, e.g., "SDS-my-project" */
  readonly documentId: string;
  /** Product or project title from the SDS */
  readonly productName: string;
  /** Technology stack rows from section 2.3 */
  readonly technologyStack: readonly ParsedTechStackRow[];
  /** Component references used for cross-linking */
  readonly components: readonly ParsedSDSComponentRef[];
  /** NFR IDs mentioned in the SDS for cross-linking */
  readonly nfrIds: readonly string[];
}

// ============================================================================
// Output types
// ============================================================================

/**
 * Metadata for a single tech decision document.
 */
export interface TechDecisionMetadata {
  /** Document ID, e.g., "TD-001-database-selection" */
  readonly documentId: string;
  /** Source SDS document reference */
  readonly sourceSDS: string;
  /** Version of the document */
  readonly version: string;
  /** Document status */
  readonly status: TechDecisionDocumentStatus;
  /** ISO date (YYYY-MM-DD) */
  readonly createdDate: string;
  /** ISO date (YYYY-MM-DD) */
  readonly updatedDate: string;
}

/**
 * A rendered tech decision document paired with its metadata.
 */
export interface GeneratedTechDecision {
  /** Underlying decision data */
  readonly decision: TechDecision;
  /** Metadata for the output document */
  readonly metadata: TechDecisionMetadata;
  /** Rendered markdown content (English) */
  readonly content: string;
}

// ============================================================================
// Agent configuration and session types
// ============================================================================

/**
 * Tech Decision Writer Agent configuration options
 */
export interface TechDecisionWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Output directory for public decision docs (defaults to docs/decisions) */
  readonly publicDocsPath?: string;
  /** Override default evaluation criteria */
  readonly criteria?: readonly EvaluationCriterion[];
}

/**
 * Tech Decision generation session
 */
export interface TechDecisionGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: TechDecisionGenerationStatus;
  /** Parsed SDS extract */
  readonly parsedSDS: ParsedSDSForDecisions;
  /** Generated documents (populated once generation completes) */
  readonly generatedDocuments?: readonly GeneratedTechDecision[];
  /** Session start time (ISO timestamp) */
  readonly startedAt: string;
  /** Session last update time (ISO timestamp) */
  readonly updatedAt: string;
  /** Error message if failed */
  readonly errorMessage?: string;
  /** Non-fatal warnings accumulated during generation */
  readonly warnings?: readonly string[];
}

/**
 * Tech Decision generation result
 */
export interface TechDecisionGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project identifier */
  readonly projectId: string;
  /** Paths written under the scratchpad, one per decision */
  readonly scratchpadPaths: readonly string[];
  /** Paths written under the public docs directory, one per decision */
  readonly publicPaths: readonly string[];
  /** Generated decision documents */
  readonly generatedDocuments: readonly GeneratedTechDecision[];
  /** Generation statistics */
  readonly stats: TechDecisionGenerationStats;
  /** Non-fatal warnings from generation */
  readonly warnings?: readonly string[];
}

/**
 * Statistics about the Tech Decision generation process
 */
export interface TechDecisionGenerationStats {
  /** Number of decisions detected and documented */
  readonly decisionCount: number;
  /** Number of technology stack rows parsed from the SDS */
  readonly techStackRowCount: number;
  /** Total number of candidates across all decisions */
  readonly candidateCount: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
