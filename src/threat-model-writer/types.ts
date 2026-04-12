/**
 * Threat Model Writer Agent module type definitions
 *
 * Defines types for Threat Model (TM) document generation from SDS
 * (Software Design Specification) input. The Threat Model identifies
 * security threats using STRIDE categorization and scores risks using
 * the DREAD model.
 */

/**
 * Threat Model generation status
 */
export type ThreatModelGenerationStatus =
  | 'pending'
  | 'parsing'
  | 'generating'
  | 'completed'
  | 'failed';

/**
 * Document status
 */
export type ThreatModelDocumentStatus = 'Draft' | 'Review' | 'Approved';

// ============================================================================
// STRIDE + DREAD domain types
// ============================================================================

/**
 * STRIDE threat categories.
 *
 * Each category represents one class of threat defined by Microsoft's
 * STRIDE threat modeling methodology.
 */
export enum StrideCategory {
  Spoofing = 'Spoofing',
  Tampering = 'Tampering',
  Repudiation = 'Repudiation',
  InformationDisclosure = 'Information Disclosure',
  DenialOfService = 'Denial of Service',
  ElevationOfPrivilege = 'Elevation of Privilege',
}

/**
 * DREAD risk score (each attribute is scored 1-10).
 *
 * DREAD breaks a threat's risk into five attributes:
 * - Damage potential: how bad would an attack be?
 * - Reproducibility: how easy is it to reproduce the attack?
 * - Exploitability: how much work is it to launch the attack?
 * - Affected users: how many people will be impacted?
 * - Discoverability: how easy is it to discover the threat?
 *
 * The overall score is the average of the five attributes.
 */
export interface DreadScore {
  /** Damage potential (1-10) */
  readonly damage: number;
  /** Reproducibility (1-10) */
  readonly reproducibility: number;
  /** Exploitability (1-10) */
  readonly exploitability: number;
  /** Affected users (1-10) */
  readonly affectedUsers: number;
  /** Discoverability (1-10) */
  readonly discoverability: number;
  /** Average of the five DREAD attributes (1-10) */
  readonly overall: number;
}

/**
 * A single threat entry identified during STRIDE analysis.
 */
export interface ThreatEntry {
  /** Threat identifier, e.g., "T1" */
  readonly id: string;
  /** STRIDE category */
  readonly category: StrideCategory;
  /** Short title of the threat */
  readonly title: string;
  /** Component, asset, or data flow the threat targets */
  readonly target: string;
  /** Description of the threat */
  readonly description: string;
  /** DREAD score for the threat */
  readonly dread: DreadScore;
  /** Mitigation strategy for the threat */
  readonly mitigation: string;
  /** Residual risk after mitigation (Low/Medium/High) */
  readonly residualRisk: 'Low' | 'Medium' | 'High';
}

// ============================================================================
// Parsed Input Types (lightweight extract from SDS markdown)
// ============================================================================

/**
 * A single component extracted from an SDS document.
 */
export interface ParsedSDSComponent {
  /** Component identifier, e.g., "CMP-001" */
  readonly id: string;
  /** Component name */
  readonly name: string;
  /** Short description if available */
  readonly description: string;
}

/**
 * Lightweight SDS extract consumed by the Threat Model Writer.
 *
 * Only the metadata and a flat list of components are required for
 * STRIDE threat identification. Deeper architectural details can be
 * added later if heuristics become more sophisticated.
 */
export interface ParsedSDSExtract {
  /** SDS document ID, e.g., "SDS-my-project" */
  readonly documentId: string;
  /** Product name (mirrored from SDS title when present) */
  readonly productName: string;
  /** Components extracted from the SDS component design section */
  readonly components: readonly ParsedSDSComponent[];
  /** Whether the SDS declares an API / network interface section */
  readonly hasApiSurface: boolean;
  /** Whether the SDS declares a data model / persistence section */
  readonly hasDataLayer: boolean;
}

// ============================================================================
// Threat Model Output Types
// ============================================================================

/**
 * Threat Model document metadata
 */
export interface ThreatModelMetadata {
  /** Document ID, e.g., "TM-my-project" */
  readonly documentId: string;
  /** Source SDS document reference */
  readonly sourceSDS: string;
  /** Document version */
  readonly version: string;
  /** Document status */
  readonly status: ThreatModelDocumentStatus;
  /** ISO date (YYYY-MM-DD) */
  readonly createdDate: string;
  /** ISO date (YYYY-MM-DD) */
  readonly updatedDate: string;
}

/**
 * Generated Threat Model document
 */
export interface GeneratedThreatModel {
  /** Threat Model metadata */
  readonly metadata: ThreatModelMetadata;
  /** Raw markdown content (English) */
  readonly content: string;
  /** Raw markdown content (Korean variant) */
  readonly contentKorean: string;
  /** Threats identified during analysis */
  readonly threats: readonly ThreatEntry[];
}

// ============================================================================
// Agent Configuration and Session Types
// ============================================================================

/**
 * Threat Model Writer Agent configuration options
 */
export interface ThreatModelWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Output directory for public TM docs (defaults to docs/tm) */
  readonly publicDocsPath?: string;
}

/**
 * Threat Model generation session
 */
export interface ThreatModelGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: ThreatModelGenerationStatus;
  /** Parsed SDS extract */
  readonly parsedSDS: ParsedSDSExtract;
  /** Generated Threat Model (when completed) */
  readonly generatedThreatModel?: GeneratedThreatModel;
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
 * Threat Model generation result
 */
export interface ThreatModelGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project identifier */
  readonly projectId: string;
  /** Path to the generated TM in scratchpad (English) */
  readonly scratchpadPath: string;
  /** Path to the public TM document (English) */
  readonly publicPath: string;
  /** Path to the generated TM in scratchpad (Korean) */
  readonly scratchpadPathKorean: string;
  /** Path to the public TM document (Korean) */
  readonly publicPathKorean: string;
  /** Generated Threat Model content */
  readonly generatedThreatModel: GeneratedThreatModel;
  /** Generation statistics */
  readonly stats: ThreatModelGenerationStats;
  /** Non-fatal warnings from generation */
  readonly warnings?: readonly string[];
}

/**
 * Statistics about the Threat Model generation process
 */
export interface ThreatModelGenerationStats {
  /** Number of SDS components considered when sizing the analysis */
  readonly sdsComponentCount: number;
  /** Number of threats identified */
  readonly threatsIdentified: number;
  /** Number of high-risk threats (DREAD overall >= 7) */
  readonly highRiskThreats: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
