/**
 * Collector Agent module type definitions
 *
 * Defines types for input processing, information extraction, and clarification handling.
 */

import type { Priority, CollectedInfo } from '../scratchpad/index.js';

/**
 * Input source types supported by the Collector Agent
 */
export type InputSourceType = 'text' | 'file' | 'url' | 'conversation';

/**
 * Supported file types for parsing
 */
export type SupportedFileType = 'md' | 'txt' | 'pdf' | 'docx' | 'json' | 'yaml';

/**
 * Clarification question categories
 */
export type ClarificationCategory =
  | 'requirement'
  | 'constraint'
  | 'assumption'
  | 'priority'
  | 'scope';

/**
 * Input source metadata
 */
export interface InputSource {
  /** Unique identifier for the source */
  readonly id: string;
  /** Type of input source */
  readonly type: InputSourceType;
  /** Reference to the source (file path, URL, or description) */
  readonly reference: string;
  /** Raw content from the source */
  readonly content: string;
  /** When the content was extracted */
  readonly extractedAt: string;
  /** Optional summary of the content */
  readonly summary?: string;
}

/**
 * Parsed input from various sources
 */
export interface ParsedInput {
  /** Original input sources */
  readonly sources: readonly InputSource[];
  /** Combined text content */
  readonly combinedContent: string;
  /** Detected language (e.g., 'en', 'ko') */
  readonly detectedLanguage?: string;
  /** Word count of combined content */
  readonly wordCount: number;
}

/**
 * Extracted requirement from input
 */
export interface ExtractedRequirement {
  /** Generated requirement ID (e.g., FR-001) */
  readonly id: string;
  /** Requirement title */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Inferred priority */
  readonly priority: Priority;
  /** Source reference where this was found */
  readonly source: string;
  /** Confidence score (0.0 - 1.0) */
  readonly confidence: number;
  /** Whether this is a functional requirement */
  readonly isFunctional: boolean;
  /** Category for non-functional requirements */
  readonly nfrCategory?:
    | 'performance'
    | 'security'
    | 'scalability'
    | 'usability'
    | 'reliability'
    | 'maintainability';
  /** Extracted acceptance criteria for this requirement */
  readonly acceptanceCriteria?: readonly string[];
}

/**
 * Extracted constraint from input
 */
export interface ExtractedConstraint {
  /** Generated constraint ID (e.g., CON-001) */
  readonly id: string;
  /** Constraint description */
  readonly description: string;
  /** Reason for the constraint */
  readonly reason?: string;
  /** Type of constraint */
  readonly type: 'technical' | 'business' | 'regulatory' | 'resource';
  /** Source reference */
  readonly source: string;
  /** Confidence score (0.0 - 1.0) */
  readonly confidence: number;
}

/**
 * Extracted assumption from input
 */
export interface ExtractedAssumption {
  /** Generated assumption ID (e.g., ASM-001) */
  readonly id: string;
  /** Assumption description */
  readonly description: string;
  /** Risk if the assumption is wrong */
  readonly riskIfWrong?: string;
  /** Source reference */
  readonly source: string;
  /** Confidence score (0.0 - 1.0) */
  readonly confidence: number;
}

/**
 * Extracted dependency from input
 */
export interface ExtractedDependency {
  /** Dependency name */
  readonly name: string;
  /** Type of dependency */
  readonly type: 'api' | 'library' | 'service' | 'tool';
  /** Version if specified */
  readonly version?: string;
  /** Purpose of the dependency */
  readonly purpose?: string;
  /** Whether it's required or optional */
  readonly required: boolean;
  /** Source reference */
  readonly source: string;
}

/**
 * Clarification question for unclear information
 */
export interface ClarificationQuestion {
  /** Generated question ID (e.g., Q-001) */
  readonly id: string;
  /** Category of the question */
  readonly category: ClarificationCategory;
  /** The question to ask */
  readonly question: string;
  /** Context explaining why this question is needed */
  readonly context: string;
  /** Optional predefined answer choices */
  readonly options?: readonly string[];
  /** Whether this question is blocking */
  readonly required: boolean;
  /** Related extraction that triggered this question */
  readonly relatedTo?: string;
}

/**
 * Answer to a clarification question
 */
export interface ClarificationAnswer {
  /** Question ID being answered */
  readonly questionId: string;
  /** The answer provided */
  readonly answer: string;
  /** When the answer was provided */
  readonly answeredAt: string;
}

/**
 * Result of information extraction
 */
export interface ExtractionResult {
  /** Project name (if detected) */
  readonly projectName?: string | undefined;
  /** Project description (if detected) */
  readonly projectDescription?: string | undefined;
  /** Extracted functional requirements */
  readonly functionalRequirements: readonly ExtractedRequirement[];
  /** Extracted non-functional requirements */
  readonly nonFunctionalRequirements: readonly ExtractedRequirement[];
  /** Extracted constraints */
  readonly constraints: readonly ExtractedConstraint[];
  /** Extracted assumptions */
  readonly assumptions: readonly ExtractedAssumption[];
  /** Extracted dependencies */
  readonly dependencies: readonly ExtractedDependency[];
  /** Questions for unclear information */
  readonly clarificationQuestions: readonly ClarificationQuestion[];
  /** Overall extraction confidence */
  readonly overallConfidence: number;
  /** Warnings during extraction */
  readonly warnings: readonly string[];
}

/**
 * Collection session state
 */
export interface CollectionSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current collection status */
  readonly status: 'collecting' | 'clarifying' | 'completed';
  /** All input sources processed */
  readonly sources: readonly InputSource[];
  /** Current extraction result */
  readonly extraction: ExtractionResult;
  /** Pending clarification questions */
  readonly pendingQuestions: readonly ClarificationQuestion[];
  /** Answered clarification questions */
  readonly answeredQuestions: readonly ClarificationAnswer[];
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
}

/**
 * Collector Agent configuration options
 */
export interface CollectorAgentConfig {
  /** Minimum confidence threshold for auto-accepting extractions */
  readonly confidenceThreshold?: number;
  /** Maximum number of clarification questions to ask at once */
  readonly maxQuestionsPerRound?: number;
  /** Whether to skip clarification for high-confidence extractions */
  readonly skipClarificationIfConfident?: boolean;
  /** Default priority for requirements without explicit priority */
  readonly defaultPriority?: Priority;
  /** Enable automatic language detection */
  readonly detectLanguage?: boolean;
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
}

/**
 * Result of a collection operation
 */
export interface CollectionResult {
  /** Whether collection was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to the collected_info.yaml file */
  readonly outputPath: string;
  /** The collected information */
  readonly collectedInfo: CollectedInfo;
  /** Any remaining questions that weren't answered */
  readonly remainingQuestions: readonly ClarificationQuestion[];
  /** Collection statistics */
  readonly stats: CollectionStats;
}

/**
 * Statistics about the collection process
 */
export interface CollectionStats {
  /** Number of sources processed */
  readonly sourcesProcessed: number;
  /** Number of functional requirements extracted */
  readonly functionalRequirements: number;
  /** Number of non-functional requirements extracted */
  readonly nonFunctionalRequirements: number;
  /** Number of constraints extracted */
  readonly constraints: number;
  /** Number of assumptions extracted */
  readonly assumptions: number;
  /** Number of dependencies extracted */
  readonly dependencies: number;
  /** Number of questions asked */
  readonly questionsAsked: number;
  /** Number of questions answered */
  readonly questionsAnswered: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}

/**
 * File parsing result
 */
export interface FileParseResult {
  /** Whether parsing was successful */
  readonly success: boolean;
  /** Parsed content */
  readonly content: string;
  /** File type that was parsed */
  readonly fileType: SupportedFileType;
  /** Any errors during parsing */
  readonly error?: string;
  /** Metadata extracted from the file */
  readonly metadata?: Record<string, unknown>;
}

/**
 * URL fetch result
 */
export interface UrlFetchResult {
  /** Whether fetch was successful */
  readonly success: boolean;
  /** Fetched and processed content */
  readonly content: string;
  /** Original URL */
  readonly url: string;
  /** Final URL after redirects */
  readonly finalUrl?: string | undefined;
  /** Page title if available */
  readonly title?: string | undefined;
  /** Any errors during fetch */
  readonly error?: string | undefined;
}
