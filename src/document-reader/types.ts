/**
 * Document Reader Agent module type definitions
 *
 * Defines types for document parsing, requirement extraction, and traceability mapping.
 */

/**
 * Document types supported by the Document Reader Agent
 */
export type DocumentType = 'prd' | 'srs' | 'sds';

/**
 * Requirement status values
 */
export type RequirementStatus = 'active' | 'deprecated' | 'pending';

/**
 * Priority levels for requirements
 */
export type RequirementPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Non-functional requirement categories
 */
export type NFRCategory =
  | 'performance'
  | 'security'
  | 'scalability'
  | 'usability'
  | 'reliability'
  | 'maintainability';

/**
 * Component types in SDS
 */
export type ComponentType = 'service' | 'library' | 'module' | 'api';

/**
 * Document reading session status
 */
export type SessionStatus = 'reading' | 'processing' | 'completed' | 'failed';

/**
 * Document metadata extracted from frontmatter or headers
 */
export interface DocumentMetadata {
  /** Document ID (e.g., PRD-001) */
  readonly id?: string;
  /** Document title */
  readonly title: string;
  /** Document version */
  readonly version?: string;
  /** Document status (Draft, Review, Approved) */
  readonly status?: string;
  /** Creation date */
  readonly createdAt?: string;
  /** Last update date */
  readonly updatedAt?: string;
  /** Document author */
  readonly author?: string;
}

/**
 * Parsed document structure
 */
export interface ParsedDocument {
  /** Document type */
  readonly type: DocumentType;
  /** File path of the document */
  readonly path: string;
  /** Document metadata */
  readonly metadata: DocumentMetadata;
  /** Raw markdown content */
  readonly rawContent: string;
  /** Parsed sections */
  readonly sections: readonly DocumentSection[];
  /** File last modified timestamp */
  readonly lastModified: string;
}

/**
 * Document section structure
 */
export interface DocumentSection {
  /** Section title */
  readonly title: string;
  /** Section level (1-6) */
  readonly level: number;
  /** Section content */
  readonly content: string;
  /** Child sections */
  readonly children: readonly DocumentSection[];
  /** Line number where section starts */
  readonly startLine: number;
}

/**
 * Functional requirement extracted from PRD
 */
export interface FunctionalRequirement {
  /** Requirement ID (e.g., FR-001) */
  readonly id: string;
  /** Requirement title */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Priority level */
  readonly priority: RequirementPriority;
  /** Current status */
  readonly status: RequirementStatus;
  /** User story if available */
  readonly userStory?: string;
  /** Acceptance criteria */
  readonly acceptanceCriteria?: readonly string[];
  /** Dependencies on other requirements */
  readonly dependencies?: readonly string[];
  /** Source location (file:line) */
  readonly sourceLocation: string;
}

/**
 * Non-functional requirement extracted from PRD
 */
export interface NonFunctionalRequirement {
  /** Requirement ID (e.g., NFR-001) */
  readonly id: string;
  /** Requirement title */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** NFR category */
  readonly category: NFRCategory;
  /** Target metric (e.g., "Response time < 200ms") */
  readonly targetMetric?: string;
  /** Priority level */
  readonly priority: RequirementPriority;
  /** Current status */
  readonly status: RequirementStatus;
  /** Source location (file:line) */
  readonly sourceLocation: string;
}

/**
 * System feature extracted from SRS
 */
export interface SystemFeature {
  /** Feature ID (e.g., SF-001) */
  readonly id: string;
  /** Feature name */
  readonly name: string;
  /** Feature description */
  readonly description: string;
  /** Associated use cases */
  readonly useCases: readonly string[];
  /** Source requirement IDs (from PRD) */
  readonly sourceRequirements: readonly string[];
  /** Current status */
  readonly status: RequirementStatus;
  /** Source location (file:line) */
  readonly sourceLocation: string;
}

/**
 * Use case extracted from SRS
 */
export interface UseCase {
  /** Use case ID (e.g., UC-001) */
  readonly id: string;
  /** Use case name */
  readonly name: string;
  /** Primary actor */
  readonly primaryActor?: string;
  /** Preconditions */
  readonly preconditions?: readonly string[];
  /** Main flow steps */
  readonly mainFlow?: readonly string[];
  /** Alternative flows */
  readonly alternativeFlows?: readonly string[];
  /** Postconditions */
  readonly postconditions?: readonly string[];
  /** Source location (file:line) */
  readonly sourceLocation: string;
}

/**
 * Component extracted from SDS
 */
export interface SystemComponent {
  /** Component ID (e.g., CMP-001) */
  readonly id: string;
  /** Component name */
  readonly name: string;
  /** Component type */
  readonly type: ComponentType;
  /** Component description */
  readonly description: string;
  /** Component responsibilities */
  readonly responsibilities: readonly string[];
  /** Dependencies on other components */
  readonly dependencies: readonly string[];
  /** Source feature IDs (from SRS) */
  readonly sourceFeatures: readonly string[];
  /** Source location (file:line) */
  readonly sourceLocation: string;
}

/**
 * API specification extracted from SDS
 */
export interface APISpecification {
  /** API ID (e.g., API-001) */
  readonly id: string;
  /** API name */
  readonly name: string;
  /** HTTP method (for REST APIs) */
  readonly method?: string;
  /** Endpoint path */
  readonly endpoint?: string;
  /** Request schema */
  readonly requestSchema?: Record<string, unknown>;
  /** Response schema */
  readonly responseSchema?: Record<string, unknown>;
  /** Parent component ID */
  readonly componentId: string;
  /** Source location (file:line) */
  readonly sourceLocation: string;
}

/**
 * PRD to SRS traceability mapping
 */
export interface PRDToSRSTrace {
  /** PRD requirement ID */
  readonly prdId: string;
  /** Related SRS feature/use case IDs */
  readonly srsIds: readonly string[];
}

/**
 * SRS to SDS traceability mapping
 */
export interface SRSToSDSTrace {
  /** SRS feature/use case ID */
  readonly srsId: string;
  /** Related SDS component/API IDs */
  readonly sdsIds: readonly string[];
}

/**
 * Document information summary
 */
export interface DocumentInfo {
  /** Document file path */
  readonly path: string;
  /** Document version */
  readonly version: string;
  /** Number of items (requirements/features/components) */
  readonly itemCount: number;
  /** Last modification timestamp */
  readonly lastModified: string;
}

/**
 * Project current state
 */
export interface CurrentState {
  /** Project information */
  readonly project: {
    readonly name: string;
    readonly version: string;
    readonly lastUpdated: string;
  };

  /** Document information */
  readonly documents: {
    readonly prd?: DocumentInfo;
    readonly srs?: DocumentInfo;
    readonly sds?: DocumentInfo;
  };

  /** Extracted requirements */
  readonly requirements: {
    readonly functional: readonly FunctionalRequirement[];
    readonly nonFunctional: readonly NonFunctionalRequirement[];
  };

  /** Extracted features */
  readonly features: readonly SystemFeature[];

  /** Extracted use cases */
  readonly useCases: readonly UseCase[];

  /** Extracted components */
  readonly components: readonly SystemComponent[];

  /** Extracted APIs */
  readonly apis: readonly APISpecification[];

  /** Traceability mappings */
  readonly traceability: {
    readonly prdToSrs: readonly PRDToSRSTrace[];
    readonly srsToSds: readonly SRSToSDSTrace[];
  };

  /** Coverage statistics */
  readonly statistics: {
    readonly totalRequirements: number;
    readonly totalFeatures: number;
    readonly totalUseCases: number;
    readonly totalComponents: number;
    readonly totalApis: number;
    readonly coveragePrdToSrs: number;
    readonly coverageSrsToSds: number;
  };
}

/**
 * Document reading session
 */
export interface DocumentReadingSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: SessionStatus;
  /** Parsed documents */
  readonly documents: readonly ParsedDocument[];
  /** Current state result */
  readonly currentState: CurrentState | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Any warnings during processing */
  readonly warnings: readonly string[];
  /** Any errors during processing */
  readonly errors: readonly string[];
}

/**
 * Document Reader Agent configuration
 */
export interface DocumentReaderConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Documents base path (defaults to docs) */
  readonly docsBasePath?: string;
  /** PRD subdirectory (defaults to prd) */
  readonly prdSubdir?: string;
  /** SRS subdirectory (defaults to srs) */
  readonly srsSubdir?: string;
  /** SDS subdirectory (defaults to sds) */
  readonly sdsSubdir?: string;
  /** Whether to use strict parsing mode */
  readonly strictMode?: boolean;
  /** Whether to extract traceability mappings */
  readonly extractTraceability?: boolean;
  /** Whether to calculate coverage statistics */
  readonly calculateStatistics?: boolean;
  /** Maximum file size to process (in bytes) */
  readonly maxFileSize?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_DOCUMENT_READER_CONFIG: Required<DocumentReaderConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  docsBasePath: 'docs',
  prdSubdir: 'prd',
  srsSubdir: 'srs',
  sdsSubdir: 'sds',
  strictMode: false,
  extractTraceability: true,
  calculateStatistics: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Document reading result
 */
export interface DocumentReadingResult {
  /** Whether reading was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to the current_state.yaml file */
  readonly outputPath: string;
  /** The current state */
  readonly currentState: CurrentState;
  /** Reading statistics */
  readonly stats: DocumentReadingStats;
  /** Warnings during reading */
  readonly warnings: readonly string[];
}

/**
 * Statistics about the document reading process
 */
export interface DocumentReadingStats {
  /** Number of documents processed */
  readonly documentsProcessed: number;
  /** Number of PRD documents */
  readonly prdCount: number;
  /** Number of SRS documents */
  readonly srsCount: number;
  /** Number of SDS documents */
  readonly sdsCount: number;
  /** Number of requirements extracted */
  readonly requirementsExtracted: number;
  /** Number of features extracted */
  readonly featuresExtracted: number;
  /** Number of components extracted */
  readonly componentsExtracted: number;
  /** Number of traceability links found */
  readonly traceabilityLinks: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
