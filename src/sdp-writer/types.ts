/**
 * SDP Writer Agent module type definitions
 *
 * Defines types for Software Development Plan (SDP) generation from PRD and
 * SRS documents. The SDP captures lifecycle, tools, team, V&V strategy, and
 * delivery milestones for a project.
 */

/**
 * SDP generation status
 */
export type SDPGenerationStatus = 'pending' | 'parsing' | 'generating' | 'completed' | 'failed';

/**
 * Document status
 */
export type SDPDocumentStatus = 'Draft' | 'Review' | 'Approved';

// ============================================================================
// Parsed Input Types (lightweight extracts from PRD/SRS markdown)
// ============================================================================

/**
 * Lightweight PRD extract used by the SDP Writer.
 *
 * The SDP only needs high-level product context — no need to fully parse the
 * PRD into features and use cases.
 */
export interface ParsedPRDExtract {
  /** PRD document ID, e.g., "PRD-my-project" */
  readonly documentId: string;
  /** Product name */
  readonly productName: string;
  /** Short product description (one paragraph or empty) */
  readonly productDescription: string;
  /** Timeline entries extracted from the PRD timeline section (empty if absent) */
  readonly timelineEntries: readonly PRDTimelineEntry[];
}

/**
 * A single timeline entry extracted from the PRD timeline section.
 *
 * The PRD writer typically renders timelines as either a markdown table
 * (`| Phase | Date | ... |`) or a bullet list (`- Phase: description`).
 * Both formats are normalized into this shape.
 */
export interface PRDTimelineEntry {
  /** Phase or milestone label as written in the PRD */
  readonly phase: string;
  /** Optional description / deliverables text */
  readonly description: string;
}

/**
 * Lightweight SRS extract used by the SDP Writer.
 *
 * Captures only the SRS metadata, feature count, NFR count, and source PRD
 * reference needed to scope the development plan.
 */
export interface ParsedSRSExtract {
  /** SRS document ID, e.g., "SRS-my-project" */
  readonly documentId: string;
  /** Source PRD document ID */
  readonly sourcePRD: string;
  /** Product name (mirrored from PRD) */
  readonly productName: string;
  /** Number of features detected in the SRS */
  readonly featureCount: number;
  /** Number of non-functional requirements detected in the SRS */
  readonly nfrCount: number;
}

// ============================================================================
// SDP Output Types
// ============================================================================

/**
 * SDP document metadata
 */
export interface SDPMetadata {
  /** Document ID, e.g., "SDP-my-project" */
  readonly documentId: string;
  /** Source PRD document reference */
  readonly sourcePRD: string;
  /** Source SRS document reference */
  readonly sourceSRS: string;
  /** Document version */
  readonly version: string;
  /** Document status */
  readonly status: SDPDocumentStatus;
  /** ISO date (YYYY-MM-DD) */
  readonly createdDate: string;
  /** ISO date (YYYY-MM-DD) */
  readonly updatedDate: string;
}

/**
 * A single milestone in the project schedule
 */
export interface SDPMilestone {
  /** Milestone identifier, e.g., "M1" */
  readonly id: string;
  /** Milestone name */
  readonly name: string;
  /** Description of deliverables */
  readonly description: string;
  /** Phase the milestone belongs to */
  readonly phase: string;
}

/**
 * A risk entry in the risk management section
 */
export interface SDPRisk {
  /** Risk identifier, e.g., "R1" */
  readonly id: string;
  /** Risk description */
  readonly description: string;
  /** Likelihood (Low/Medium/High) */
  readonly likelihood: 'Low' | 'Medium' | 'High';
  /** Impact (Low/Medium/High) */
  readonly impact: 'Low' | 'Medium' | 'High';
  /** Mitigation strategy */
  readonly mitigation: string;
}

/**
 * Generated SDP document
 */
export interface GeneratedSDP {
  /** SDP metadata */
  readonly metadata: SDPMetadata;
  /** Raw markdown content (English) */
  readonly content: string;
  /** Raw markdown content (Korean variant) */
  readonly contentKorean: string;
  /** Milestones included in the schedule section */
  readonly milestones: readonly SDPMilestone[];
  /** Risks included in the risk management section */
  readonly risks: readonly SDPRisk[];
}

// ============================================================================
// Agent Configuration and Session Types
// ============================================================================

/**
 * SDP Writer Agent configuration options
 */
export interface SDPWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Path to the SDP template (defaults to .ad-sdlc/templates/sdp-template.md) */
  readonly templatePath?: string;
  /** Output directory for public SDP docs (defaults to docs/sdp) */
  readonly publicDocsPath?: string;
  /** Lifecycle model name (defaults to "Iterative / Agile") */
  readonly lifecycleModel?: string;
}

/**
 * SDP generation session
 */
export interface SDPGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: SDPGenerationStatus;
  /** Parsed PRD extract */
  readonly parsedPRD: ParsedPRDExtract;
  /** Parsed SRS extract */
  readonly parsedSRS: ParsedSRSExtract;
  /** Generated SDP (when completed) */
  readonly generatedSDP?: GeneratedSDP;
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
 * SDP generation result
 */
export interface SDPGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project identifier */
  readonly projectId: string;
  /** Path to the generated SDP in scratchpad (English) */
  readonly scratchpadPath: string;
  /** Path to the public SDP document (English) */
  readonly publicPath: string;
  /** Path to the generated SDP in scratchpad (Korean) */
  readonly scratchpadPathKorean: string;
  /** Path to the public SDP document (Korean) */
  readonly publicPathKorean: string;
  /** Generated SDP content */
  readonly generatedSDP: GeneratedSDP;
  /** Generation statistics */
  readonly stats: SDPGenerationStats;
  /** Non-fatal warnings from generation */
  readonly warnings?: readonly string[];
}

/**
 * Statistics about the SDP generation process
 */
export interface SDPGenerationStats {
  /** Number of SRS features considered when sizing the plan */
  readonly srsFeatureCount: number;
  /** Number of NFRs considered when sizing the plan */
  readonly nfrCount: number;
  /** Number of milestones generated */
  readonly milestonesGenerated: number;
  /** Number of risks listed */
  readonly risksGenerated: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
