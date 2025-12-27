/**
 * Architecture Generator module type definitions
 *
 * Defines types for SRS analysis, architecture pattern detection,
 * technology stack recommendations, and diagram generation.
 */

/**
 * Architecture pattern categories
 */
export type ArchitecturePattern =
  | 'hierarchical-multi-agent'
  | 'pipeline'
  | 'event-driven'
  | 'microservices'
  | 'layered'
  | 'hexagonal'
  | 'cqrs'
  | 'scratchpad';

/**
 * Technology layer categories
 */
export type TechnologyLayer =
  | 'runtime'
  | 'framework'
  | 'database'
  | 'caching'
  | 'messaging'
  | 'monitoring'
  | 'testing'
  | 'build';

/**
 * Diagram type categories
 */
export type DiagramType =
  | 'architecture-overview'
  | 'component-interaction'
  | 'deployment'
  | 'sequence'
  | 'data-flow';

/**
 * SRS system feature extracted from document
 */
export interface SRSFeature {
  /** Feature identifier (e.g., SF-001) */
  readonly id: string;
  /** Feature name */
  readonly name: string;
  /** Feature description */
  readonly description: string;
  /** Priority level */
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** Use cases associated with this feature */
  readonly useCases: readonly SRSUseCase[];
  /** Non-functional requirements */
  readonly nfrs: readonly string[];
}

/**
 * SRS use case definition
 */
export interface SRSUseCase {
  /** Use case identifier (e.g., UC-001) */
  readonly id: string;
  /** Use case name */
  readonly name: string;
  /** Use case description */
  readonly description: string;
  /** Primary actor */
  readonly actor: string;
  /** Preconditions */
  readonly preconditions: readonly string[];
  /** Main flow steps */
  readonly mainFlow: readonly string[];
  /** Alternative flows */
  readonly alternativeFlows: readonly string[];
  /** Postconditions */
  readonly postconditions: readonly string[];
}

/**
 * Parsed SRS document structure
 */
export interface ParsedSRS {
  /** Document metadata */
  readonly metadata: SRSMetadata;
  /** System features */
  readonly features: readonly SRSFeature[];
  /** Non-functional requirements */
  readonly nfrs: readonly NonFunctionalRequirement[];
  /** Constraints */
  readonly constraints: readonly Constraint[];
  /** Assumptions */
  readonly assumptions: readonly string[];
}

/**
 * SRS document metadata
 */
export interface SRSMetadata {
  /** Document ID */
  readonly documentId: string;
  /** Source PRD reference */
  readonly sourcePRD: string;
  /** Document version */
  readonly version: string;
  /** Document status */
  readonly status: string;
  /** Product name */
  readonly productName: string;
}

/**
 * Non-functional requirement definition
 */
export interface NonFunctionalRequirement {
  /** NFR identifier */
  readonly id: string;
  /** NFR category */
  readonly category: NFRCategory;
  /** Requirement description */
  readonly description: string;
  /** Measurable target */
  readonly target: string;
  /** Priority level */
  readonly priority: 'P0' | 'P1' | 'P2' | 'P3';
}

/**
 * NFR category types
 */
export type NFRCategory =
  | 'performance'
  | 'scalability'
  | 'reliability'
  | 'security'
  | 'maintainability'
  | 'usability'
  | 'availability';

/**
 * Constraint definition
 */
export interface Constraint {
  /** Constraint identifier */
  readonly id: string;
  /** Constraint type */
  readonly type: ConstraintType;
  /** Constraint description */
  readonly description: string;
  /** Impact on architecture */
  readonly architectureImpact: string;
}

/**
 * Constraint type categories
 */
export type ConstraintType = 'technical' | 'business' | 'regulatory' | 'resource' | 'timeline';

/**
 * Architecture analysis result
 */
export interface ArchitectureAnalysis {
  /** Recommended primary pattern */
  readonly primaryPattern: ArchitecturePattern;
  /** Additional supporting patterns */
  readonly supportingPatterns: readonly ArchitecturePattern[];
  /** Rationale for pattern selection */
  readonly rationale: string;
  /** Pattern recommendations based on requirements */
  readonly recommendations: readonly PatternRecommendation[];
  /** Identified architectural concerns */
  readonly concerns: readonly ArchitecturalConcern[];
}

/**
 * Pattern recommendation with rationale
 */
export interface PatternRecommendation {
  /** Pattern name */
  readonly pattern: ArchitecturePattern;
  /** Recommendation score (0-100) */
  readonly score: number;
  /** Reasons for recommendation */
  readonly reasons: readonly string[];
  /** Potential drawbacks */
  readonly drawbacks: readonly string[];
}

/**
 * Architectural concern identified during analysis
 */
export interface ArchitecturalConcern {
  /** Concern category */
  readonly category: NFRCategory;
  /** Concern description */
  readonly description: string;
  /** Suggested mitigation */
  readonly mitigation: string;
  /** Priority level */
  readonly priority: 'high' | 'medium' | 'low';
}

/**
 * Technology stack recommendation
 */
export interface TechnologyStack {
  /** Technology entries by layer */
  readonly layers: readonly TechnologyLayerEntry[];
  /** Overall stack rationale */
  readonly rationale: string;
  /** Compatibility notes */
  readonly compatibilityNotes: readonly string[];
}

/**
 * Technology layer entry
 */
export interface TechnologyLayerEntry {
  /** Layer name */
  readonly layer: TechnologyLayer;
  /** Recommended technology */
  readonly technology: string;
  /** Technology version */
  readonly version: string;
  /** Selection rationale */
  readonly rationale: string;
  /** Alternative options */
  readonly alternatives: readonly TechnologyAlternative[];
}

/**
 * Alternative technology option
 */
export interface TechnologyAlternative {
  /** Technology name */
  readonly name: string;
  /** Why not selected */
  readonly reason: string;
}

/**
 * Generated Mermaid diagram
 */
export interface MermaidDiagram {
  /** Diagram type */
  readonly type: DiagramType;
  /** Diagram title */
  readonly title: string;
  /** Mermaid diagram code */
  readonly code: string;
  /** Diagram description */
  readonly description: string;
}

/**
 * Component definition for diagrams
 */
export interface DiagramComponent {
  /** Component ID */
  readonly id: string;
  /** Component name */
  readonly name: string;
  /** Component layer */
  readonly layer: string;
  /** Component type */
  readonly type: 'service' | 'controller' | 'repository' | 'utility' | 'external';
  /** Connections to other components */
  readonly connections: readonly ComponentConnection[];
}

/**
 * Connection between components
 */
export interface ComponentConnection {
  /** Target component ID */
  readonly targetId: string;
  /** Connection label */
  readonly label: string;
  /** Connection type */
  readonly type: 'sync' | 'async' | 'event' | 'data';
}

/**
 * Directory structure specification
 */
export interface DirectoryStructure {
  /** Root directory name */
  readonly root: string;
  /** Directory entries */
  readonly entries: readonly DirectoryEntry[];
  /** Structure description */
  readonly description: string;
}

/**
 * Directory entry (file or folder)
 */
export interface DirectoryEntry {
  /** Entry name */
  readonly name: string;
  /** Entry type */
  readonly type: 'directory' | 'file';
  /** Entry description */
  readonly description: string;
  /** Child entries (for directories) */
  readonly children: readonly DirectoryEntry[];
}

/**
 * Complete architecture design result
 */
export interface ArchitectureDesign {
  /** Architecture analysis */
  readonly analysis: ArchitectureAnalysis;
  /** Technology stack recommendation */
  readonly technologyStack: TechnologyStack;
  /** Generated diagrams */
  readonly diagrams: readonly MermaidDiagram[];
  /** Directory structure */
  readonly directoryStructure: DirectoryStructure;
  /** Design metadata */
  readonly metadata: ArchitectureMetadata;
}

/**
 * Architecture design metadata
 */
export interface ArchitectureMetadata {
  /** Source SRS document ID */
  readonly sourceSRS: string;
  /** Generation timestamp */
  readonly generatedAt: string;
  /** Generator version */
  readonly version: string;
}

/**
 * Architecture generator options
 */
export interface ArchitectureGeneratorOptions {
  /** Default architecture pattern if none detected */
  readonly defaultPattern?: ArchitecturePattern;
  /** Include technology alternatives */
  readonly includeAlternatives?: boolean;
  /** Generate all diagram types */
  readonly generateAllDiagrams?: boolean;
  /** Custom directory structure template */
  readonly directoryTemplate?: string;
  /** Verbose output */
  readonly verbose?: boolean;
}

/**
 * SRS parser options
 */
export interface SRSParserOptions {
  /** Strict mode throws on parsing errors */
  readonly strict?: boolean;
  /** Extract use cases */
  readonly extractUseCases?: boolean;
  /** Parse NFRs */
  readonly parseNFRs?: boolean;
}
