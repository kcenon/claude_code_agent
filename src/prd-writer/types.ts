/**
 * PRD Writer Agent module type definitions
 *
 * Defines types for PRD generation, gap analysis, and consistency checking.
 */

import type { CollectedInfo } from '../scratchpad/index.js';

/**
 * PRD generation status
 */
export type PRDGenerationStatus = 'pending' | 'analyzing' | 'generating' | 'completed' | 'failed';

/**
 * Gap severity levels
 */
export type GapSeverity = 'critical' | 'major' | 'minor' | 'info';

/**
 * Gap categories
 */
export type GapCategory =
  | 'missing_requirement'
  | 'incomplete_requirement'
  | 'missing_acceptance_criteria'
  | 'missing_priority'
  | 'missing_description'
  | 'missing_user_story'
  | 'missing_metric'
  | 'missing_dependency';

/**
 * Consistency issue types
 */
export type ConsistencyIssueType =
  | 'priority_conflict'
  | 'duplicate_requirement'
  | 'circular_dependency'
  | 'unbalanced_priorities'
  | 'missing_bidirectional_dependency'
  | 'conflicting_requirements';

/**
 * PRD section identifiers
 */
export type PRDSection =
  | 'executive_summary'
  | 'problem_statement'
  | 'goals_metrics'
  | 'user_personas'
  | 'functional_requirements'
  | 'non_functional_requirements'
  | 'constraints_assumptions'
  | 'dependencies'
  | 'timeline'
  | 'risks'
  | 'out_of_scope'
  | 'appendix';

/**
 * Gap analysis result item
 */
export interface GapItem {
  /** Unique identifier for the gap */
  readonly id: string;
  /** Category of the gap */
  readonly category: GapCategory;
  /** Severity level */
  readonly severity: GapSeverity;
  /** PRD section affected */
  readonly section: PRDSection;
  /** Description of the gap */
  readonly description: string;
  /** Suggested action to resolve */
  readonly suggestion: string;
  /** Related requirement ID if applicable */
  readonly relatedId?: string | undefined;
}

/**
 * Gap analysis result
 */
export interface GapAnalysisResult {
  /** Total number of gaps found */
  readonly totalGaps: number;
  /** Critical gaps that must be addressed */
  readonly criticalGaps: readonly GapItem[];
  /** Major gaps that should be addressed */
  readonly majorGaps: readonly GapItem[];
  /** Minor gaps that are nice to address */
  readonly minorGaps: readonly GapItem[];
  /** Informational gaps for improvement */
  readonly infoGaps: readonly GapItem[];
  /** Overall completeness score (0.0 - 1.0) */
  readonly completenessScore: number;
  /** Sections with gaps */
  readonly sectionsWithGaps: readonly PRDSection[];
}

/**
 * Consistency issue item
 */
export interface ConsistencyIssue {
  /** Unique identifier for the issue */
  readonly id: string;
  /** Type of consistency issue */
  readonly type: ConsistencyIssueType;
  /** Severity level */
  readonly severity: GapSeverity;
  /** Description of the issue */
  readonly description: string;
  /** Related requirement IDs */
  readonly relatedIds: readonly string[];
  /** Suggested resolution */
  readonly suggestion: string;
}

/**
 * Consistency check result
 */
export interface ConsistencyCheckResult {
  /** Whether the requirements are consistent */
  readonly isConsistent: boolean;
  /** List of consistency issues found */
  readonly issues: readonly ConsistencyIssue[];
  /** Priority distribution analysis */
  readonly priorityDistribution: PriorityDistribution;
  /** Dependency analysis */
  readonly dependencyAnalysis: DependencyAnalysis;
}

/**
 * Priority distribution across requirements
 */
export interface PriorityDistribution {
  /** Count of P0 requirements */
  readonly p0Count: number;
  /** Count of P1 requirements */
  readonly p1Count: number;
  /** Count of P2 requirements */
  readonly p2Count: number;
  /** Count of P3 requirements */
  readonly p3Count: number;
  /** Whether distribution is balanced */
  readonly isBalanced: boolean;
  /** Recommendation if unbalanced */
  readonly recommendation?: string | undefined;
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysis {
  /** Total number of dependencies */
  readonly totalDependencies: number;
  /** Dependencies that are missing reverse reference */
  readonly missingBidirectional: readonly string[];
  /** Circular dependency chains found */
  readonly circularChains: readonly string[][];
}

/**
 * PRD document metadata
 */
export interface PRDMetadata {
  /** Document ID */
  readonly documentId: string;
  /** Document version */
  readonly version: string;
  /** Document status */
  readonly status: 'Draft' | 'Review' | 'Approved';
  /** Creation date (ISO 8601) */
  readonly createdAt: string;
  /** Last update date (ISO 8601) */
  readonly updatedAt: string;
  /** Project ID */
  readonly projectId: string;
  /** Product name */
  readonly productName: string;
}

/**
 * Generated PRD content
 */
export interface GeneratedPRD {
  /** PRD metadata */
  readonly metadata: PRDMetadata;
  /** Raw markdown content */
  readonly content: string;
  /** Gap analysis result */
  readonly gapAnalysis: GapAnalysisResult;
  /** Consistency check result */
  readonly consistencyCheck: ConsistencyCheckResult;
}

/**
 * PRD Writer Agent configuration options
 */
export interface PRDWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Path to PRD template (defaults to .ad-sdlc/templates/prd-template.md) */
  readonly templatePath?: string;
  /** Whether to fail on critical gaps */
  readonly failOnCriticalGaps?: boolean;
  /** Whether to auto-suggest priorities */
  readonly autoSuggestPriorities?: boolean;
  /** Output directory for public PRD docs */
  readonly publicDocsPath?: string;
  /** Whether to include gap analysis in output */
  readonly includeGapAnalysis?: boolean;
}

/**
 * PRD generation session
 */
export interface PRDGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: PRDGenerationStatus;
  /** Collected info input */
  readonly collectedInfo: CollectedInfo;
  /** Gap analysis result */
  readonly gapAnalysis?: GapAnalysisResult;
  /** Consistency check result */
  readonly consistencyCheck?: ConsistencyCheckResult;
  /** Generated PRD (when completed) */
  readonly generatedPRD?: GeneratedPRD;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Error message if failed */
  readonly errorMessage?: string;
}

/**
 * PRD generation result
 */
export interface PRDGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to the generated PRD in scratchpad */
  readonly scratchpadPath: string;
  /** Path to the public PRD document */
  readonly publicPath: string;
  /** Generated PRD content */
  readonly generatedPRD: GeneratedPRD;
  /** Generation statistics */
  readonly stats: PRDGenerationStats;
}

/**
 * Statistics about the PRD generation process
 */
export interface PRDGenerationStats {
  /** Number of functional requirements */
  readonly functionalRequirements: number;
  /** Number of non-functional requirements */
  readonly nonFunctionalRequirements: number;
  /** Number of constraints */
  readonly constraints: number;
  /** Number of assumptions */
  readonly assumptions: number;
  /** Number of dependencies */
  readonly dependencies: number;
  /** Number of gaps found */
  readonly gapsFound: number;
  /** Number of consistency issues found */
  readonly consistencyIssues: number;
  /** Completeness score */
  readonly completenessScore: number;
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

// ============================================================
// Approval Workflow Types
// ============================================================

/**
 * Approval decision options
 */
export type ApprovalDecision = 'approve' | 'request_changes' | 'reject';

/**
 * Document types that can be approved
 */
export type ApprovableDocument = 'prd' | 'srs' | 'sds';

/**
 * Approval request structure
 */
export interface ApprovalRequest {
  /** Project identifier */
  readonly projectId: string;
  /** Document type being approved */
  readonly documentType: ApprovableDocument;
  /** Path to the document */
  readonly documentPath: string;
  /** Document content for review */
  readonly content: string;
  /** Document metadata */
  readonly metadata: PRDMetadata;
  /** Request timestamp */
  readonly requestedAt: string;
}

/**
 * Approval result structure
 */
export interface ApprovalResult {
  /** Whether the document was approved */
  readonly approved: boolean;
  /** The decision made */
  readonly decision: ApprovalDecision;
  /** Feedback provided (for request_changes or reject) */
  readonly feedback?: string;
  /** Timestamp of the decision */
  readonly timestamp: string;
  /** Identifier of who approved (optional) */
  readonly approver?: string;
}

/**
 * Approval history entry
 */
export interface ApprovalHistoryEntry {
  /** Entry identifier */
  readonly id: string;
  /** Project identifier */
  readonly projectId: string;
  /** Document type */
  readonly documentType: ApprovableDocument;
  /** Document version at time of review */
  readonly documentVersion: string;
  /** Decision made */
  readonly decision: ApprovalDecision;
  /** Feedback provided */
  readonly feedback?: string;
  /** Timestamp */
  readonly timestamp: string;
  /** Approver identifier */
  readonly approver?: string;
}

/**
 * Approval workflow configuration
 */
export interface ApprovalWorkflowConfig {
  /** Base path for scratchpad */
  readonly scratchpadBasePath?: string;
  /** Path for approved documents */
  readonly approvedDocsPath?: string;
  /** Whether to require feedback on rejection */
  readonly requireFeedbackOnReject?: boolean;
  /** Whether to require feedback on request_changes */
  readonly requireFeedbackOnChanges?: boolean;
}

/**
 * PRD revision entry for tracking changes
 */
export interface PRDRevision {
  /** Revision version */
  readonly version: string;
  /** Revision timestamp */
  readonly timestamp: string;
  /** List of changes made */
  readonly changes: readonly string[];
  /** Feedback that prompted the revision */
  readonly feedback: string;
}

/**
 * Approval status for a project
 */
export interface ApprovalStatus {
  /** Project identifier */
  readonly projectId: string;
  /** Document type */
  readonly documentType: ApprovableDocument;
  /** Current approval state */
  readonly state: 'pending' | 'approved' | 'changes_requested' | 'rejected';
  /** Latest approval history entry */
  readonly latestEntry?: ApprovalHistoryEntry;
  /** Total number of approval attempts */
  readonly attemptCount: number;
  /** Revision history */
  readonly revisions: readonly PRDRevision[];
}
