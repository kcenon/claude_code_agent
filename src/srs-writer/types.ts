/**
 * SRS Writer Agent module type definitions
 *
 * Defines types for SRS generation from PRD documents,
 * feature decomposition, use case generation, and traceability.
 */

import type {
  SRSFeature,
  SRSUseCase,
  SRSMetadata,
  NonFunctionalRequirement,
  Constraint,
} from '../architecture-generator/types.js';

/**
 * SRS generation status
 */
export type SRSGenerationStatus =
  | 'pending'
  | 'parsing'
  | 'decomposing'
  | 'generating'
  | 'completed'
  | 'failed';

/**
 * Priority level for requirements and features
 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Parsed PRD requirement
 */
export interface ParsedPRDRequirement {
  /** Requirement ID (e.g., FR-001) */
  readonly id: string;
  /** Requirement title */
  readonly title: string;
  /** Requirement description */
  readonly description: string;
  /** Priority level */
  readonly priority: Priority;
  /** Acceptance criteria */
  readonly acceptanceCriteria: readonly string[];
  /** Dependencies on other requirements */
  readonly dependencies: readonly string[];
  /** User story if available */
  readonly userStory?: string;
}

/**
 * Parsed PRD document structure
 */
export interface ParsedPRD {
  /** Document metadata */
  readonly metadata: PRDDocumentMetadata;
  /** Product name */
  readonly productName: string;
  /** Product description */
  readonly productDescription: string;
  /** Functional requirements */
  readonly functionalRequirements: readonly ParsedPRDRequirement[];
  /** Non-functional requirements */
  readonly nonFunctionalRequirements: readonly ParsedNFR[];
  /** Constraints */
  readonly constraints: readonly ParsedConstraint[];
  /** Assumptions */
  readonly assumptions: readonly string[];
  /** User personas */
  readonly userPersonas: readonly UserPersona[];
  /** Goals and metrics */
  readonly goals: readonly Goal[];
}

/**
 * PRD document metadata
 */
export interface PRDDocumentMetadata {
  /** Document ID (e.g., PRD-001) */
  readonly documentId: string;
  /** Version */
  readonly version: string;
  /** Status */
  readonly status: string;
  /** Project ID */
  readonly projectId: string;
}

/**
 * Parsed NFR from PRD
 */
export interface ParsedNFR {
  /** NFR ID */
  readonly id: string;
  /** Category */
  readonly category: string;
  /** Description */
  readonly description: string;
  /** Metric/target */
  readonly metric?: string;
  /** Priority */
  readonly priority: Priority;
}

/**
 * Parsed constraint from PRD
 */
export interface ParsedConstraint {
  /** Constraint ID */
  readonly id: string;
  /** Type */
  readonly type: string;
  /** Description */
  readonly description: string;
}

/**
 * User persona from PRD
 */
export interface UserPersona {
  /** Persona name */
  readonly name: string;
  /** Role or type */
  readonly role: string;
  /** Description */
  readonly description: string;
  /** Goals */
  readonly goals: readonly string[];
}

/**
 * Goal from PRD
 */
export interface Goal {
  /** Goal description */
  readonly description: string;
  /** Metric */
  readonly metric?: string;
  /** Target value */
  readonly target?: string;
}

/**
 * Feature decomposition result
 */
export interface FeatureDecompositionResult {
  /** Generated features */
  readonly features: readonly SRSFeature[];
  /** Traceability map (FR-XXX -> SF-XXX[]) */
  readonly traceabilityMap: ReadonlyMap<string, readonly string[]>;
  /** Coverage percentage (0-100) */
  readonly coverage: number;
  /** Any unmapped requirements */
  readonly unmappedRequirements: readonly string[];
}

/**
 * Use case generation input
 */
export interface UseCaseInput {
  /** Feature this use case belongs to */
  readonly feature: SRSFeature;
  /** Requirement it traces to */
  readonly requirement: ParsedPRDRequirement;
  /** Available actors from personas */
  readonly actors: readonly string[];
}

/**
 * Generated use case with additional metadata
 */
export interface GeneratedUseCase extends SRSUseCase {
  /** Source feature ID */
  readonly sourceFeatureId: string;
  /** Source requirement ID */
  readonly sourceRequirementId: string;
}

/**
 * Traceability entry
 */
export interface TraceabilityEntry {
  /** PRD requirement ID */
  readonly requirementId: string;
  /** SRS feature IDs */
  readonly featureIds: readonly string[];
  /** Use case IDs */
  readonly useCaseIds: readonly string[];
  /** NFR IDs if applicable */
  readonly nfrIds: readonly string[];
}

/**
 * Traceability matrix
 */
export interface TraceabilityMatrix {
  /** All entries */
  readonly entries: readonly TraceabilityEntry[];
  /** Forward coverage (PRD -> SRS) */
  readonly forwardCoverage: number;
  /** Orphan features (not traced to any requirement) */
  readonly orphanFeatures: readonly string[];
  /** Uncovered requirements */
  readonly uncoveredRequirements: readonly string[];
}

/**
 * SRS Writer Agent configuration options
 */
export interface SRSWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Path to SRS template (defaults to .ad-sdlc/templates/srs-template.md) */
  readonly templatePath?: string;
  /** Output directory for public SRS docs */
  readonly publicDocsPath?: string;
  /** Minimum use cases per feature */
  readonly minUseCasesPerFeature?: number;
  /** Whether to fail on coverage below threshold */
  readonly failOnLowCoverage?: boolean;
  /** Minimum coverage threshold (0-100) */
  readonly coverageThreshold?: number;
  /** Include traceability matrix in output */
  readonly includeTraceability?: boolean;
}

/**
 * SRS generation session
 */
export interface SRSGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: SRSGenerationStatus;
  /** Parsed PRD input */
  readonly parsedPRD: ParsedPRD;
  /** Feature decomposition result */
  readonly decompositionResult?: FeatureDecompositionResult;
  /** Traceability matrix */
  readonly traceabilityMatrix?: TraceabilityMatrix;
  /** Generated SRS (when completed) */
  readonly generatedSRS?: GeneratedSRS;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Error message if failed */
  readonly errorMessage?: string;
}

/**
 * Generated SRS document
 */
export interface GeneratedSRS {
  /** SRS metadata */
  readonly metadata: SRSMetadata;
  /** Raw markdown content */
  readonly content: string;
  /** Features in the SRS */
  readonly features: readonly SRSFeature[];
  /** NFRs in the SRS */
  readonly nfrs: readonly NonFunctionalRequirement[];
  /** Constraints in the SRS */
  readonly constraints: readonly Constraint[];
  /** Assumptions */
  readonly assumptions: readonly string[];
  /** Traceability matrix */
  readonly traceabilityMatrix: TraceabilityMatrix;
}

/**
 * SRS generation result
 */
export interface SRSGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to the generated SRS in scratchpad */
  readonly scratchpadPath: string;
  /** Path to the public SRS document */
  readonly publicPath: string;
  /** Generated SRS content */
  readonly generatedSRS: GeneratedSRS;
  /** Generation statistics */
  readonly stats: SRSGenerationStats;
}

/**
 * Statistics about the SRS generation process
 */
export interface SRSGenerationStats {
  /** Number of PRD requirements processed */
  readonly prdRequirementsCount: number;
  /** Number of SRS features generated */
  readonly featuresGenerated: number;
  /** Number of use cases generated */
  readonly useCasesGenerated: number;
  /** Number of NFRs */
  readonly nfrsCount: number;
  /** Number of constraints */
  readonly constraintsCount: number;
  /** Traceability coverage percentage */
  readonly traceabilityCoverage: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}

/**
 * Template variable for substitution
 */
export interface TemplateVariable {
  /** Variable name (without ${}) */
  readonly name: string;
  /** Variable value */
  readonly value: string;
  /** Whether this variable is required */
  readonly required: boolean;
}

/**
 * Template processing result
 */
export interface TemplateProcessingResult {
  /** Processed content */
  readonly content: string;
  /** Variables that were substituted */
  readonly substitutedVariables: readonly string[];
  /** Variables that were missing */
  readonly missingVariables: readonly string[];
  /** Warnings during processing */
  readonly warnings: readonly string[];
}

// Re-export types from architecture-generator for convenience
export type { SRSFeature, SRSUseCase, SRSMetadata, NonFunctionalRequirement, Constraint };
