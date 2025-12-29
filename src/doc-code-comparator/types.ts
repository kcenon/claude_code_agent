/**
 * Doc-Code Comparator Agent module type definitions
 *
 * Defines types for comparing documentation specifications against code implementations
 * to identify gaps, inconsistencies, and improvement opportunities.
 */

/**
 * Gap type indicating the nature of the discrepancy
 */
export type GapType =
  | 'documented_not_implemented'
  | 'implemented_not_documented'
  | 'partial_implementation'
  | 'documentation_code_mismatch';

/**
 * Priority levels for gaps
 */
export type GapPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Session status for comparison
 */
export type SessionStatus = 'idle' | 'loading' | 'comparing' | 'completed' | 'failed';

/**
 * Match confidence level
 */
export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Agent mapping status
 */
export type MappingStatus = 'matched' | 'partial' | 'unmatched';

/**
 * Document inventory item (from document-reader output)
 */
export interface DocumentItem {
  /** Item ID (e.g., FR-001, SF-001, CMP-001) */
  readonly id: string;
  /** Item name/title */
  readonly name: string;
  /** Item description */
  readonly description: string;
  /** Item type */
  readonly type: 'requirement' | 'feature' | 'component' | 'api';
  /** Source location in document */
  readonly sourceLocation: string;
}

/**
 * Code inventory item (from code-reader output)
 */
export interface CodeItem {
  /** Module name */
  readonly moduleName: string;
  /** Module path */
  readonly modulePath: string;
  /** Class names in module */
  readonly classes: readonly string[];
  /** Function names in module */
  readonly functions: readonly string[];
  /** Interface names in module */
  readonly interfaces: readonly string[];
  /** Lines of code */
  readonly linesOfCode: number;
}

/**
 * Agent mapping configuration
 */
export interface AgentMapping {
  /** Agent ID from documentation */
  readonly agentId: string;
  /** Agent name */
  readonly agentName: string;
  /** Expected module path pattern */
  readonly expectedModulePath: string;
  /** Alternative module paths */
  readonly alternativePaths?: readonly string[];
}

/**
 * Mapping result between document and code
 */
export interface MappingResult {
  /** Document agent/component ID */
  readonly documentId: string;
  /** Document agent/component name */
  readonly documentName: string;
  /** Matched code module path (if found) */
  readonly codeModulePath: string | null;
  /** Match status */
  readonly status: MappingStatus;
  /** Match confidence score (0.0 - 1.0) */
  readonly confidence: number;
  /** Matching details */
  readonly matchDetails: string;
}

/**
 * Gap item representing a discrepancy
 */
export interface GapItem {
  /** Unique gap ID */
  readonly id: string;
  /** Gap type */
  readonly type: GapType;
  /** Priority level */
  readonly priority: GapPriority;
  /** Gap title */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Affected document reference */
  readonly documentReference?: string;
  /** Affected code reference */
  readonly codeReference?: string;
  /** Suggested action */
  readonly suggestedAction: string;
  /** Related IDs (FR-xxx, CMP-xxx, etc.) */
  readonly relatedIds: readonly string[];
}

/**
 * Generated issue from gap
 */
export interface GeneratedIssue {
  /** Issue title */
  readonly title: string;
  /** Issue body */
  readonly body: string;
  /** Labels */
  readonly labels: readonly string[];
  /** Priority */
  readonly priority: GapPriority;
  /** Source gap ID */
  readonly sourceGapId: string;
  /** Related document IDs */
  readonly relatedDocumentIds: readonly string[];
  /** Related code paths */
  readonly relatedCodePaths: readonly string[];
}

/**
 * Comparison statistics
 */
export interface ComparisonStatistics {
  /** Total items in documentation */
  readonly totalDocumentedItems: number;
  /** Total implemented modules */
  readonly totalImplementedModules: number;
  /** Number of fully matched items */
  readonly fullyMatched: number;
  /** Number of partially matched items */
  readonly partiallyMatched: number;
  /** Number of unmatched document items */
  readonly unmatchedDocumented: number;
  /** Number of undocumented code items */
  readonly undocumentedCode: number;
  /** Overall match score (0.0 - 1.0) */
  readonly overallMatchScore: number;
  /** Coverage statistics by category */
  readonly coverageByCategory: {
    readonly requirements: number;
    readonly features: number;
    readonly components: number;
    readonly apis: number;
  };
}

/**
 * Gap summary by type
 */
export interface GapSummary {
  /** Gaps by type */
  readonly byType: {
    readonly documentedNotImplemented: number;
    readonly implementedNotDocumented: number;
    readonly partialImplementation: number;
    readonly documentationCodeMismatch: number;
  };
  /** Gaps by priority */
  readonly byPriority: {
    readonly P0: number;
    readonly P1: number;
    readonly P2: number;
    readonly P3: number;
  };
  /** Total gaps */
  readonly totalGaps: number;
  /** Critical gaps count (P0 + P1) */
  readonly criticalGapsCount: number;
}

/**
 * Comparison result output
 */
export interface ComparisonResult {
  /** Project information */
  readonly project: {
    readonly name: string;
    readonly comparedAt: string;
  };
  /** Mapping results */
  readonly mappings: readonly MappingResult[];
  /** Detected gaps */
  readonly gaps: readonly GapItem[];
  /** Gap summary */
  readonly gapSummary: GapSummary;
  /** Comparison statistics */
  readonly statistics: ComparisonStatistics;
}

/**
 * Comparison session
 */
export interface ComparisonSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: SessionStatus;
  /** Document inventory path */
  readonly documentInventoryPath: string | null;
  /** Code inventory path */
  readonly codeInventoryPath: string | null;
  /** Comparison result */
  readonly result: ComparisonResult | null;
  /** Generated issues */
  readonly generatedIssues: readonly GeneratedIssue[];
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Warnings during processing */
  readonly warnings: readonly string[];
  /** Errors during processing */
  readonly errors: readonly string[];
}

/**
 * Doc-Code Comparator Agent configuration
 */
export interface DocCodeComparatorConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Source root path (defaults to src) */
  readonly sourceRoot?: string;
  /** Minimum confidence threshold for matching (0.0 - 1.0) */
  readonly minMatchConfidence?: number;
  /** Whether to generate issues for gaps */
  readonly generateIssues?: boolean;
  /** Whether to include undocumented code in gaps */
  readonly reportUndocumentedCode?: boolean;
  /** Custom agent to module mappings */
  readonly customMappings?: readonly AgentMapping[];
}

/**
 * Default configuration values
 */
export const DEFAULT_DOC_CODE_COMPARATOR_CONFIG: Required<DocCodeComparatorConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  sourceRoot: 'src',
  minMatchConfidence: 0.5,
  generateIssues: true,
  reportUndocumentedCode: true,
  customMappings: [],
} as const;

/**
 * Comparison result output type
 */
export interface DocCodeComparisonResult {
  /** Whether comparison was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to comparison_result.yaml */
  readonly comparisonResultPath: string;
  /** Path to gap_issues.json (if generated) */
  readonly gapIssuesPath: string | null;
  /** The comparison result */
  readonly result: ComparisonResult;
  /** Generated issues */
  readonly issues: readonly GeneratedIssue[];
  /** Comparison statistics */
  readonly stats: ComparisonStats;
  /** Warnings during comparison */
  readonly warnings: readonly string[];
}

/**
 * Statistics about the comparison process
 */
export interface ComparisonStats {
  /** Number of document items analyzed */
  readonly documentItemsAnalyzed: number;
  /** Number of code modules analyzed */
  readonly codeModulesAnalyzed: number;
  /** Number of mappings created */
  readonly mappingsCreated: number;
  /** Number of gaps detected */
  readonly gapsDetected: number;
  /** Number of issues generated */
  readonly issuesGenerated: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
