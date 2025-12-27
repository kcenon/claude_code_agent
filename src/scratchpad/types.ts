/**
 * Scratchpad module type definitions
 *
 * Defines types for file-based state sharing between agents
 * using the Scratchpad pattern.
 */

/**
 * Scratchpad section identifiers
 */
export type ScratchpadSection = 'info' | 'documents' | 'issues' | 'progress';

/**
 * Progress subsection identifiers
 */
export type ProgressSubsection = 'work_orders' | 'results' | 'reviews';

/**
 * Document type identifiers
 */
export type DocumentType = 'prd' | 'srs' | 'sds';

/**
 * Supported file formats for scratchpad files
 */
export type FileFormat = 'yaml' | 'json' | 'markdown';

/**
 * Scratchpad configuration options
 */
export interface ScratchpadOptions {
  /** Base directory for scratchpad (default: '.ad-sdlc/scratchpad') */
  readonly basePath?: string;
  /** File permission mode for created files (default: 0o600) */
  readonly fileMode?: number;
  /** Directory permission mode for created directories (default: 0o700) */
  readonly dirMode?: number;
  /** Enable file locking for concurrent access (default: true) */
  readonly enableLocking?: boolean;
  /** Lock timeout in milliseconds (default: 5000) */
  readonly lockTimeout?: number;
}

/**
 * Project information stored in scratchpad
 */
export interface ProjectInfo {
  /** Unique project identifier */
  readonly projectId: string;
  /** Project name */
  readonly name: string;
  /** Project creation timestamp */
  readonly createdAt: string;
  /** Last update timestamp */
  readonly updatedAt: string;
  /** Project status */
  readonly status: 'active' | 'completed' | 'archived';
}

/**
 * Collected information structure
 */
export interface CollectedInfo {
  /** Associated project ID */
  readonly projectId: string;
  /** Collection timestamp */
  readonly collectedAt: string;
  /** Natural language input */
  readonly naturalLanguageInput?: string;
  /** Referenced files */
  readonly referencedFiles?: readonly string[];
  /** Clarification Q&A history */
  readonly clarifications?: readonly ClarificationEntry[];
  /** Final approved requirements */
  readonly approvedRequirements?: string;
}

/**
 * Clarification question and answer entry
 */
export interface ClarificationEntry {
  /** Question asked */
  readonly question: string;
  /** User's answer */
  readonly answer: string;
  /** Timestamp */
  readonly timestamp: string;
}

/**
 * Work order structure for Worker Agent
 */
export interface WorkOrder {
  /** Unique order identifier */
  readonly orderId: string;
  /** Associated issue ID */
  readonly issueId: string;
  /** Issue URL */
  readonly issueUrl: string;
  /** Creation timestamp */
  readonly createdAt: string;
  /** Priority level */
  readonly priority: number;
  /** Context information */
  readonly context: WorkOrderContext;
  /** Acceptance criteria */
  readonly acceptanceCriteria: readonly string[];
}

/**
 * Work order context information
 */
export interface WorkOrderContext {
  /** SDS component reference */
  readonly sdsComponent?: string;
  /** SRS feature reference */
  readonly srsFeature?: string;
  /** PRD requirement reference */
  readonly prdRequirement?: string;
  /** Related files with reasons */
  readonly relatedFiles: readonly RelatedFile[];
  /** Dependencies status */
  readonly dependenciesStatus: readonly DependencyStatus[];
}

/**
 * Related file with reason for inclusion
 */
export interface RelatedFile {
  /** File path */
  readonly path: string;
  /** Reason for inclusion */
  readonly reason: string;
}

/**
 * Dependency status information
 */
export interface DependencyStatus {
  /** Issue ID */
  readonly issueId: string;
  /** Current status */
  readonly status: 'open' | 'closed' | 'in_progress';
}

/**
 * Implementation result from Worker Agent
 */
export interface ImplementationResult {
  /** Order ID reference */
  readonly orderId: string;
  /** Issue ID reference */
  readonly issueId: string;
  /** Completion status */
  readonly status: 'completed' | 'failed' | 'blocked';
  /** Branch name created */
  readonly branchName: string;
  /** File changes made */
  readonly changes: readonly FileChange[];
  /** Tests added */
  readonly testsAdded: readonly TestInfo[];
  /** Completion timestamp */
  readonly completedAt: string;
  /** Error message if failed */
  readonly errorMessage?: string;
}

/**
 * File change information
 */
export interface FileChange {
  /** File path */
  readonly filePath: string;
  /** Type of change */
  readonly changeType: 'create' | 'modify' | 'delete';
  /** Lines added */
  readonly linesAdded: number;
  /** Lines removed */
  readonly linesRemoved: number;
}

/**
 * Test information
 */
export interface TestInfo {
  /** Test file path */
  readonly filePath: string;
  /** Number of test cases */
  readonly testCount: number;
}

/**
 * Controller state for orchestration
 */
export interface ControllerState {
  /** Session identifier */
  readonly sessionId: string;
  /** Project ID */
  readonly projectId: string;
  /** Current phase */
  readonly currentPhase: string;
  /** Start timestamp */
  readonly startedAt: string;
  /** Last update timestamp */
  readonly updatedAt: string;
  /** Issue queue */
  readonly queue: IssueQueue;
  /** Worker status */
  readonly workers: readonly WorkerStatus[];
  /** Total issues count */
  readonly totalIssues: number;
}

/**
 * Issue queue structure
 */
export interface IssueQueue {
  /** Pending issues */
  readonly pending: readonly string[];
  /** In-progress issues */
  readonly inProgress: readonly string[];
  /** Completed issues */
  readonly completed: readonly string[];
  /** Blocked issues */
  readonly blocked: readonly string[];
}

/**
 * Worker status information
 */
export interface WorkerStatus {
  /** Worker identifier */
  readonly id: string;
  /** Current status */
  readonly status: 'idle' | 'working' | 'error';
  /** Current issue being worked on */
  readonly currentIssue: string | null;
  /** Work start timestamp */
  readonly startedAt: string | null;
  /** Completed tasks count */
  readonly completedTasks: number;
}

/**
 * File lock information
 */
export interface FileLock {
  /** Locked file path */
  readonly filePath: string;
  /** Lock holder ID */
  readonly holderId: string;
  /** Lock acquisition timestamp */
  readonly acquiredAt: string;
  /** Lock expiration timestamp */
  readonly expiresAt: string;
}

/**
 * Atomic write options
 */
export interface AtomicWriteOptions {
  /** Create parent directories if needed (default: true) */
  readonly createDirs?: boolean;
  /** File permission mode */
  readonly mode?: number;
  /** Encoding (default: 'utf8') */
  readonly encoding?: BufferEncoding;
}

/**
 * Read options for scratchpad files
 */
export interface ReadOptions {
  /** Encoding (default: 'utf8') */
  readonly encoding?: BufferEncoding;
  /** Return null instead of throwing on missing file */
  readonly allowMissing?: boolean;
}
