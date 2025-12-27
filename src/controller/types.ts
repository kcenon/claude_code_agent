/**
 * Controller module type definitions
 *
 * Defines types for dependency graph analysis, prioritization,
 * and work queue management in the Controller Agent.
 */

/**
 * Priority levels for issues
 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Issue status for queue management
 */
export type IssueStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'blocked' | 'failed';

/**
 * Priority weight configuration
 */
export interface PriorityWeights {
  /** Weight for P0 (Critical) issues */
  readonly P0: number;
  /** Weight for P1 (High) issues */
  readonly P1: number;
  /** Weight for P2 (Medium) issues */
  readonly P2: number;
  /** Weight for P3 (Low) issues */
  readonly P3: number;
}

/**
 * Default priority weights as specified in requirements
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  P0: 100,
  P1: 75,
  P2: 50,
  P3: 25,
} as const;

/**
 * Issue node in the dependency graph
 */
export interface IssueNode {
  /** Unique issue identifier */
  readonly id: string;
  /** Issue title */
  readonly title: string;
  /** Priority level */
  readonly priority: Priority;
  /** Estimated effort in hours */
  readonly effort: number;
  /** Issue status */
  readonly status: IssueStatus;
  /** GitHub issue URL (optional) */
  readonly url?: string;
  /** Component ID reference */
  readonly componentId?: string;
}

/**
 * Dependency edge in the graph
 */
export interface DependencyEdge {
  /** Source issue ID (the issue that depends on another) */
  readonly from: string;
  /** Target issue ID (the issue being depended on) */
  readonly to: string;
}

/**
 * Raw dependency graph structure (loaded from file)
 */
export interface RawDependencyGraph {
  /** Graph nodes */
  readonly nodes: readonly IssueNode[];
  /** Graph edges */
  readonly edges: readonly DependencyEdge[];
}

/**
 * Analyzed issue with computed metrics
 */
export interface AnalyzedIssue {
  /** Issue node data */
  readonly node: IssueNode;
  /** Direct dependencies (issues this issue depends on) */
  readonly dependencies: readonly string[];
  /** Direct dependents (issues that depend on this issue) */
  readonly dependents: readonly string[];
  /** All transitive dependencies */
  readonly transitiveDependencies: readonly string[];
  /** Depth in dependency tree (0 = root) */
  readonly depth: number;
  /** Computed priority score */
  readonly priorityScore: number;
  /** Whether this issue is on the critical path */
  readonly isOnCriticalPath: boolean;
  /** Whether all dependencies are resolved */
  readonly dependenciesResolved: boolean;
}

/**
 * Group of issues that can be executed in parallel
 */
export interface ParallelGroup {
  /** Group index (execution order) */
  readonly groupIndex: number;
  /** Issue IDs in this group */
  readonly issueIds: readonly string[];
  /** Total estimated effort for this group */
  readonly totalEffort: number;
}

/**
 * Critical path information
 */
export interface CriticalPath {
  /** Ordered list of issue IDs on the critical path */
  readonly path: readonly string[];
  /** Total duration of the critical path */
  readonly totalDuration: number;
  /** Bottleneck issue (highest effort on path) */
  readonly bottleneck: string | null;
}

/**
 * Prioritized work queue
 */
export interface PrioritizedQueue {
  /** Ordered list of issue IDs (highest priority first) */
  readonly queue: readonly string[];
  /** Issues ready for execution (no pending dependencies) */
  readonly readyForExecution: readonly string[];
  /** Issues blocked by dependencies */
  readonly blocked: readonly string[];
}

/**
 * Graph analysis result
 */
export interface GraphAnalysisResult {
  /** Analyzed issues map */
  readonly issues: ReadonlyMap<string, AnalyzedIssue>;
  /** Topologically sorted execution order */
  readonly executionOrder: readonly string[];
  /** Parallel execution groups */
  readonly parallelGroups: readonly ParallelGroup[];
  /** Critical path information */
  readonly criticalPath: CriticalPath;
  /** Prioritized work queue */
  readonly prioritizedQueue: PrioritizedQueue;
  /** Graph statistics */
  readonly statistics: GraphStatistics;
}

/**
 * Graph statistics
 */
export interface GraphStatistics {
  /** Total number of issues */
  readonly totalIssues: number;
  /** Total number of dependencies */
  readonly totalDependencies: number;
  /** Maximum depth in the graph */
  readonly maxDepth: number;
  /** Number of root issues (no dependencies) */
  readonly rootIssues: number;
  /** Number of leaf issues (no dependents) */
  readonly leafIssues: number;
  /** Number of issues on critical path */
  readonly criticalPathLength: number;
  /** Issues by priority */
  readonly byPriority: Record<Priority, number>;
  /** Issues by status */
  readonly byStatus: Record<IssueStatus, number>;
}

/**
 * Priority analyzer configuration
 */
export interface PriorityAnalyzerConfig {
  /** Priority weights */
  readonly weights?: PriorityWeights;
  /** Bonus score for issues on critical path */
  readonly criticalPathBonus?: number;
  /** Score multiplier per dependent issue */
  readonly dependentMultiplier?: number;
  /** Bonus for smaller effort (quick wins) */
  readonly quickWinBonus?: number;
  /** Threshold hours for quick win bonus */
  readonly quickWinThreshold?: number;
}

/**
 * Default priority analyzer configuration
 */
export const DEFAULT_ANALYZER_CONFIG: Required<PriorityAnalyzerConfig> = {
  weights: DEFAULT_PRIORITY_WEIGHTS,
  criticalPathBonus: 50,
  dependentMultiplier: 10,
  quickWinBonus: 15,
  quickWinThreshold: 4,
} as const;

// ============================================================================
// Worker Pool Types
// ============================================================================

/**
 * Worker status states
 */
export type WorkerStatus = 'idle' | 'working' | 'error';

/**
 * Information about a single worker
 */
export interface WorkerInfo {
  /** Unique worker identifier */
  readonly id: string;
  /** Current worker status */
  readonly status: WorkerStatus;
  /** Currently assigned issue ID (null if idle) */
  readonly currentIssue: string | null;
  /** Timestamp when work started (null if idle) */
  readonly startedAt: string | null;
  /** Total number of completed tasks */
  readonly completedTasks: number;
  /** Last error message (if status is error) */
  readonly lastError?: string;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Maximum number of concurrent workers (default: 5) */
  readonly maxWorkers?: number;
  /** Worker timeout in milliseconds (default: 600000 = 10 minutes) */
  readonly workerTimeout?: number;
  /** Path to store work orders (default: '.ad-sdlc/scratchpad/progress') */
  readonly workOrdersPath?: string;
}

/**
 * Default worker pool configuration
 */
export const DEFAULT_WORKER_POOL_CONFIG: Required<WorkerPoolConfig> = {
  maxWorkers: 5,
  workerTimeout: 600000, // 10 minutes
  workOrdersPath: '.ad-sdlc/scratchpad/progress',
} as const;

/**
 * Dependency status in a work order
 */
export interface DependencyStatus {
  /** Issue ID of the dependency */
  readonly issueId: string;
  /** Status of the dependency */
  readonly status: 'completed' | 'in_progress' | 'pending';
}

/**
 * Related file reference in a work order
 */
export interface RelatedFile {
  /** File path relative to project root */
  readonly path: string;
  /** Reason for including this file */
  readonly reason: string;
}

/**
 * Work order context information
 */
export interface WorkOrderContext {
  /** SDS component ID reference */
  readonly sdsComponent?: string;
  /** SRS feature ID reference */
  readonly srsFeature?: string;
  /** PRD requirement ID reference */
  readonly prdRequirement?: string;
  /** Related files for this work */
  readonly relatedFiles: readonly RelatedFile[];
  /** Status of dependencies */
  readonly dependenciesStatus: readonly DependencyStatus[];
}

/**
 * Work order for a worker assignment
 */
export interface WorkOrder {
  /** Unique work order ID */
  readonly orderId: string;
  /** Assigned issue ID */
  readonly issueId: string;
  /** GitHub issue URL (if available) */
  readonly issueUrl?: string;
  /** When the work order was created */
  readonly createdAt: string;
  /** Priority level of the work */
  readonly priority: number;
  /** Context information for the worker */
  readonly context: WorkOrderContext;
  /** Acceptance criteria to satisfy */
  readonly acceptanceCriteria: readonly string[];
}

/**
 * Work order completion result
 */
export interface WorkOrderResult {
  /** Work order ID */
  readonly orderId: string;
  /** Whether work was completed successfully */
  readonly success: boolean;
  /** Completion timestamp */
  readonly completedAt: string;
  /** Files created or modified */
  readonly filesModified: readonly string[];
  /** Error message if failed */
  readonly error?: string;
  /** Output artifacts (e.g., test results, lint output) */
  readonly artifacts?: Record<string, unknown>;
}

/**
 * Worker pool status snapshot
 */
export interface WorkerPoolStatus {
  /** Total number of workers */
  readonly totalWorkers: number;
  /** Number of idle workers */
  readonly idleWorkers: number;
  /** Number of working workers */
  readonly workingWorkers: number;
  /** Number of workers in error state */
  readonly errorWorkers: number;
  /** List of all workers and their status */
  readonly workers: readonly WorkerInfo[];
  /** Currently processing work orders */
  readonly activeWorkOrders: readonly string[];
}

/**
 * Work queue entry
 */
export interface WorkQueueEntry {
  /** Issue ID */
  readonly issueId: string;
  /** Issue priority score */
  readonly priorityScore: number;
  /** Timestamp when added to queue */
  readonly queuedAt: string;
  /** Number of times this has been attempted */
  readonly attempts: number;
}

/**
 * Controller state for persistence
 */
export interface ControllerState {
  /** Project ID */
  readonly projectId: string;
  /** Timestamp of last update */
  readonly lastUpdated: string;
  /** Worker pool status */
  readonly workerPool: WorkerPoolStatus;
  /** Work queue */
  readonly workQueue: readonly WorkQueueEntry[];
  /** Completed work orders */
  readonly completedOrders: readonly string[];
  /** Failed work orders */
  readonly failedOrders: readonly string[];
}

/**
 * Worker completion callback
 */
export type WorkerCompletionCallback = (
  workerId: string,
  result: WorkOrderResult
) => void | Promise<void>;

/**
 * Worker failure callback
 */
export type WorkerFailureCallback = (
  workerId: string,
  orderId: string,
  error: Error
) => void | Promise<void>;
