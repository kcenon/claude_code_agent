/**
 * SVP Writer Agent module type definitions
 *
 * Defines types for Software Verification Plan (SVP) document generation.
 * The SVP automatically derives test cases from the SRS use cases and
 * non-functional requirements, classifying them by verification level
 * (Unit / Integration / System) and providing a traceability matrix
 * back to source requirements.
 */

/**
 * SVP generation status
 */
export type SVPGenerationStatus =
  | 'pending'
  | 'parsing'
  | 'deriving'
  | 'generating'
  | 'completed'
  | 'failed';

/**
 * Document status (mirrors other writer agents)
 */
export type SVPDocumentStatus = 'Draft' | 'Review' | 'Approved';

// ============================================================================
// Test case domain types
// ============================================================================

/**
 * Verification level for a test case.
 *
 * - `Unit`:        Isolates a single function or module. Mocks dependencies.
 * - `Integration`: Exercises a use-case alternative flow across modules.
 * - `System`:      End-to-end happy-path validation against acceptance criteria.
 */
export enum TestLevel {
  Unit = 'Unit',
  Integration = 'Integration',
  System = 'System',
}

/**
 * Test case priority (mirrors SRS priority levels).
 */
export type TestCasePriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Test case category by source.
 *
 * - `happy_path`:           Derived from a UC main flow.
 * - `alternative`:          Derived from a UC alternative flow.
 * - `precondition_failure`: Derived from a UC precondition violation.
 * - `nfr_performance`:      Derived from a performance NFR.
 * - `nfr_security`:         Derived from a security NFR.
 * - `nfr_reliability`:      Derived from a reliability or availability NFR.
 */
export type TestCaseCategory =
  | 'happy_path'
  | 'alternative'
  | 'precondition_failure'
  | 'nfr_performance'
  | 'nfr_security'
  | 'nfr_reliability';

/**
 * A single test case derived from a use case or NFR.
 */
export interface TestCase {
  /** Test case identifier, e.g., "TC-001" */
  readonly id: string;
  /** Short human-readable title */
  readonly title: string;
  /** Source identifier (UC-XXX or NFR-XXX) */
  readonly source: string;
  /** Source category */
  readonly category: TestCaseCategory;
  /** Verification level */
  readonly level: TestLevel;
  /** Priority */
  readonly priority: TestCasePriority;
  /** Preconditions that must hold before executing the test */
  readonly preconditions: readonly string[];
  /** Ordered test steps */
  readonly steps: readonly string[];
  /** Expected outcome the test asserts */
  readonly expected: string;
}

/**
 * Traceability entry mapping a source requirement to one or more test cases.
 */
export interface TraceabilityEntry {
  /** Source ID (UC-XXX or NFR-XXX) */
  readonly sourceId: string;
  /** Source kind */
  readonly sourceKind: 'use_case' | 'nfr';
  /** IDs of derived test cases */
  readonly testCaseIds: readonly string[];
}

// ============================================================================
// Parsed input types (lightweight extracts from upstream documents)
// ============================================================================

/**
 * A use case extracted from the SRS.
 *
 * Mirrors the writer-side `SRSUseCase` shape but contains only the fields
 * the SVP needs to derive test cases. The fields use the same names as
 * the SRS template so heuristics can match cleanly.
 */
export interface ParsedUseCase {
  /** Use case identifier, e.g., "UC-001" */
  readonly id: string;
  /** Use case title */
  readonly title: string;
  /** Primary actor (or empty string if absent) */
  readonly actor: string;
  /** Preconditions parsed from the UC body */
  readonly preconditions: readonly string[];
  /** Main flow steps (one entry per step) */
  readonly mainFlow: readonly string[];
  /** Alternative flow descriptions */
  readonly alternativeFlows: readonly string[];
  /** Postconditions parsed from the UC body */
  readonly postconditions: readonly string[];
}

/**
 * Non-functional requirement category recognised by NFRTestGenerator.
 */
export type NFRCategory =
  | 'performance'
  | 'security'
  | 'reliability'
  | 'availability'
  | 'usability'
  | 'maintainability'
  | 'scalability'
  | 'other';

/**
 * A non-functional requirement extracted from the SRS.
 */
export interface ParsedNFR {
  /** NFR identifier, e.g., "NFR-001" */
  readonly id: string;
  /** Category as parsed from the SRS section heading */
  readonly category: NFRCategory;
  /** Human-readable description */
  readonly description: string;
  /** Quantitative target if available, e.g., "p95 < 200ms" */
  readonly target: string;
  /** Priority */
  readonly priority: TestCasePriority;
}

/**
 * Interface or endpoint extracted from the SDS for integration tests.
 */
export interface ParsedInterface {
  /** Stable interface identifier (e.g., HTTP method + path) */
  readonly id: string;
  /** Description if available */
  readonly description: string;
}

/**
 * Lightweight SRS extract consumed by the SVP Writer.
 */
export interface ParsedSRSExtract {
  /** SRS document ID, e.g., "SRS-my-project" */
  readonly documentId: string;
  /** Product name (mirrored from SRS title when present) */
  readonly productName: string;
  /** Use cases extracted from the SRS */
  readonly useCases: readonly ParsedUseCase[];
  /** Non-functional requirements extracted from the SRS */
  readonly nfrs: readonly ParsedNFR[];
}

/**
 * Lightweight SDS extract consumed by the SVP Writer.
 */
export interface ParsedSDSInterfaces {
  /** SDS document ID, e.g., "SDS-my-project" */
  readonly documentId: string;
  /** Interfaces or endpoints discovered in the SDS */
  readonly interfaces: readonly ParsedInterface[];
}

// ============================================================================
// SVP output types
// ============================================================================

/**
 * SVP document metadata
 */
export interface SVPMetadata {
  /** Document ID, e.g., "SVP-my-project" */
  readonly documentId: string;
  /** Source SRS document reference */
  readonly sourceSRS: string;
  /** Source SDS document reference (may be empty when SDS is absent) */
  readonly sourceSDS: string;
  /** Document version */
  readonly version: string;
  /** Document status */
  readonly status: SVPDocumentStatus;
  /** ISO date (YYYY-MM-DD) */
  readonly createdDate: string;
  /** ISO date (YYYY-MM-DD) */
  readonly updatedDate: string;
}

/**
 * Generated SVP document
 */
export interface GeneratedSVP {
  /** SVP metadata */
  readonly metadata: SVPMetadata;
  /** Raw markdown content (English) */
  readonly content: string;
  /** Raw markdown content (Korean variant) */
  readonly contentKorean: string;
  /** All derived test cases */
  readonly testCases: readonly TestCase[];
  /** Traceability matrix */
  readonly traceability: readonly TraceabilityEntry[];
}

// ============================================================================
// Agent configuration and session types
// ============================================================================

/**
 * SVP Writer Agent configuration options
 */
export interface SVPWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Output directory for public SVP docs (defaults to docs/svp) */
  readonly publicDocsPath?: string;
}

/**
 * SVP generation session
 */
export interface SVPGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: SVPGenerationStatus;
  /** Parsed SRS extract */
  readonly parsedSRS: ParsedSRSExtract;
  /** Parsed SDS interfaces (optional — empty when SDS is missing) */
  readonly parsedSDS: ParsedSDSInterfaces;
  /** Generated SVP (when completed) */
  readonly generatedSVP?: GeneratedSVP;
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
 * SVP generation result
 */
export interface SVPGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project identifier */
  readonly projectId: string;
  /** Path to the generated SVP in scratchpad (English) */
  readonly scratchpadPath: string;
  /** Path to the public SVP document (English) */
  readonly publicPath: string;
  /** Path to the generated SVP in scratchpad (Korean) */
  readonly scratchpadPathKorean: string;
  /** Path to the public SVP document (Korean) */
  readonly publicPathKorean: string;
  /** Generated SVP content */
  readonly generatedSVP: GeneratedSVP;
  /** Generation statistics */
  readonly stats: SVPGenerationStats;
  /** Non-fatal warnings from generation */
  readonly warnings?: readonly string[];
}

/**
 * Statistics about the SVP generation process
 */
export interface SVPGenerationStats {
  /** Number of use cases processed */
  readonly useCaseCount: number;
  /** Number of NFRs processed */
  readonly nfrCount: number;
  /** Total test cases generated */
  readonly totalTestCases: number;
  /** Test cases per verification level */
  readonly unitTestCases: number;
  /** Integration test cases */
  readonly integrationTestCases: number;
  /** System test cases */
  readonly systemTestCases: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
