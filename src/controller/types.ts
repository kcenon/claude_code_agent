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
 * Cycle status for graceful cycle handling
 */
export type CycleStatus = 'detected' | 'breaking' | 'resolved' | 'escalated';

/**
 * Information about a detected circular dependency
 */
export interface CycleInfo {
  /** Node IDs forming the cycle (includes closing node) */
  readonly nodes: readonly string[];
  /** When the cycle was detected */
  readonly detectedAt: Date;
  /** Current status of cycle handling */
  readonly status: CycleStatus;
  /** If cycle was broken, which edge was removed */
  readonly breakpoint?: string;
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
  /** Detected cycles (empty if no cycles) */
  readonly cycles: readonly CycleInfo[];
  /** Issue IDs blocked by circular dependencies */
  readonly blockedByCycle: readonly string[];
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

// ============================================================================
// Progress Monitor Types
// ============================================================================

/**
 * Bottleneck type classification
 */
export type BottleneckType =
  | 'stuck_worker'
  | 'blocked_chain'
  | 'dependency_cycle'
  | 'resource_contention';

/**
 * Detected bottleneck information
 */
export interface Bottleneck {
  /** Type of bottleneck */
  readonly type: BottleneckType;
  /** Human-readable description */
  readonly description: string;
  /** Affected issue IDs */
  readonly affectedIssues: readonly string[];
  /** Suggested action to resolve */
  readonly suggestedAction: string;
  /** Severity level (1-5, 5 being most severe) */
  readonly severity: number;
  /** Timestamp when detected */
  readonly detectedAt: string;
}

/**
 * Progress metrics for tracking overall status
 */
export interface ProgressMetrics {
  /** Total number of issues */
  readonly totalIssues: number;
  /** Number of completed issues */
  readonly completed: number;
  /** Number of issues in progress */
  readonly inProgress: number;
  /** Number of pending issues */
  readonly pending: number;
  /** Number of blocked issues */
  readonly blocked: number;
  /** Number of failed issues */
  readonly failed: number;
  /** Completion percentage (0-100) */
  readonly percentage: number;
  /** Estimated time of completion (null if cannot estimate) */
  readonly eta: Date | null;
  /** Average completion time in milliseconds */
  readonly averageCompletionTime: number;
}

/**
 * Recent activity entry for progress report
 */
export interface RecentActivity {
  /** Timestamp of the activity */
  readonly timestamp: string;
  /** Type of activity */
  readonly type: 'completed' | 'started' | 'failed' | 'blocked';
  /** Issue ID involved */
  readonly issueId: string;
  /** Worker ID involved (if applicable) */
  readonly workerId?: string;
  /** Additional details */
  readonly details?: string;
}

/**
 * Complete progress report
 */
export interface ProgressReport {
  /** Session/project identifier */
  readonly sessionId: string;
  /** Report generation timestamp */
  readonly generatedAt: string;
  /** Progress metrics */
  readonly metrics: ProgressMetrics;
  /** Worker status summary */
  readonly workers: readonly WorkerInfo[];
  /** Detected bottlenecks */
  readonly bottlenecks: readonly Bottleneck[];
  /** Recent activity log */
  readonly recentActivity: readonly RecentActivity[];
  /** Worker health status (optional, from WorkerHealthMonitor) */
  readonly workerHealth?: HealthMonitorStatus;
}

/**
 * Escalation level for stuck worker handling
 */
export type StuckWorkerEscalationLevel = 'warning' | 'stuck' | 'critical';

/**
 * Recovery action types for stuck workers
 */
export type StuckWorkerRecoveryAction =
  | 'extend_deadline'
  | 'send_warning'
  | 'reassign_task'
  | 'restart_worker'
  | 'escalate_critical';

/**
 * Per-task-type threshold configuration
 */
export interface TaskTypeThreshold {
  /** Warning threshold in milliseconds */
  readonly warning: number;
  /** Stuck threshold in milliseconds */
  readonly stuck: number;
  /** Critical threshold in milliseconds */
  readonly critical: number;
}

/**
 * Stuck worker configuration
 */
export interface StuckWorkerConfig {
  /** Warning threshold in milliseconds (default: 180000 = 3 minutes) */
  readonly warningThresholdMs?: number;
  /** Stuck threshold in milliseconds (default: 300000 = 5 minutes) */
  readonly stuckThresholdMs?: number;
  /** Critical threshold in milliseconds (default: 600000 = 10 minutes) */
  readonly criticalThresholdMs?: number;
  /** Per-task-type threshold overrides */
  readonly taskThresholds?: Record<string, TaskTypeThreshold>;
  /** Enable automatic recovery (default: true) */
  readonly autoRecoveryEnabled?: boolean;
  /** Maximum automatic recovery attempts (default: 3) */
  readonly maxRecoveryAttempts?: number;
  /** Deadline extension in milliseconds (default: 60000 = 1 minute) */
  readonly deadlineExtensionMs?: number;
  /** Pause pipeline on critical escalation (default: false) */
  readonly pauseOnCritical?: boolean;
}

/**
 * Default stuck worker configuration
 */
export const DEFAULT_STUCK_WORKER_CONFIG: Required<Omit<StuckWorkerConfig, 'taskThresholds'>> & {
  taskThresholds: Record<string, TaskTypeThreshold>;
} = {
  warningThresholdMs: 180000, // 3 minutes
  stuckThresholdMs: 300000, // 5 minutes
  criticalThresholdMs: 600000, // 10 minutes
  taskThresholds: {},
  autoRecoveryEnabled: true,
  maxRecoveryAttempts: 3,
  deadlineExtensionMs: 60000, // 1 minute
  pauseOnCritical: false,
} as const;

/**
 * Stuck worker recovery attempt record
 */
export interface StuckWorkerRecoveryAttempt {
  /** Worker ID */
  readonly workerId: string;
  /** Issue/task ID */
  readonly issueId: string;
  /** Attempt number (1-based) */
  readonly attemptNumber: number;
  /** Action taken */
  readonly action: StuckWorkerRecoveryAction;
  /** Timestamp of the attempt */
  readonly timestamp: string;
  /** Whether the recovery was successful */
  readonly success: boolean;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * Stuck worker escalation event
 */
export interface StuckWorkerEscalation {
  /** Worker ID */
  readonly workerId: string;
  /** Issue/task ID */
  readonly issueId: string | null;
  /** Escalation level */
  readonly level: StuckWorkerEscalationLevel;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Recovery attempts made */
  readonly recoveryAttempts: number;
  /** Timestamp */
  readonly timestamp: string;
  /** Suggested action */
  readonly suggestedAction: string;
}

/**
 * Progress monitor configuration
 */
export interface ProgressMonitorConfig {
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  readonly pollingInterval?: number;
  /**
   * Threshold for stuck worker detection in milliseconds (default: 300000 = 5 minutes)
   * @deprecated Use stuckWorkerConfig.stuckThresholdMs instead
   */
  readonly stuckWorkerThreshold?: number;
  /** Maximum number of recent activities to track (default: 50) */
  readonly maxRecentActivities?: number;
  /** Path to store progress reports */
  readonly reportPath?: string;
  /** Enable notification hooks */
  readonly enableNotifications?: boolean;
  /** Stuck worker configuration */
  readonly stuckWorkerConfig?: StuckWorkerConfig;
}

/**
 * Default progress monitor configuration
 *
 * Note: The stuckWorkerThreshold has been reduced from 30 minutes to 5 minutes
 * for faster detection. For even faster zombie detection, use WorkerHealthMonitor
 * which provides heartbeat-based detection.
 */
export const DEFAULT_PROGRESS_MONITOR_CONFIG: Required<Omit<ProgressMonitorConfig, 'stuckWorkerConfig'>> & {
  stuckWorkerConfig: Required<Omit<StuckWorkerConfig, 'taskThresholds'>> & {
    taskThresholds: Record<string, TaskTypeThreshold>;
  };
} = {
  pollingInterval: 30000, // 30 seconds
  stuckWorkerThreshold: 300000, // 5 minutes (reduced from 30 minutes)
  maxRecentActivities: 50,
  reportPath: '.ad-sdlc/scratchpad/progress',
  enableNotifications: true,
  stuckWorkerConfig: DEFAULT_STUCK_WORKER_CONFIG,
} as const;

/**
 * Progress event types for notification hooks
 */
export type ProgressEventType =
  | 'progress_updated'
  | 'bottleneck_detected'
  | 'bottleneck_resolved'
  | 'milestone_reached'
  | 'worker_stuck'
  | 'worker_warning'
  | 'worker_critical'
  | 'recovery_attempted'
  | 'recovery_succeeded'
  | 'recovery_failed'
  | 'task_reassigned'
  | 'deadline_extended'
  | 'critical_escalation'
  | 'all_completed';

/**
 * Progress event for notification hooks
 */
export interface ProgressEvent {
  /** Event type */
  readonly type: ProgressEventType;
  /** Event timestamp */
  readonly timestamp: string;
  /** Event data */
  readonly data: Record<string, unknown>;
}

/**
 * Progress event callback
 */
export type ProgressEventCallback = (event: ProgressEvent) => void | Promise<void>;

// ============================================================================
// Worker Health Check Types
// ============================================================================

/**
 * Worker health status
 */
export type WorkerHealthStatus = 'healthy' | 'degraded' | 'zombie' | 'restarting';

/**
 * Worker heartbeat signal
 */
export interface WorkerHeartbeat {
  /** Worker unique identifier */
  readonly workerId: string;
  /** Timestamp of heartbeat */
  readonly timestamp: number;
  /** Current task being processed */
  readonly currentTask?: string;
  /** Task progress (0-100) */
  readonly progress?: number;
  /** Memory usage in bytes */
  readonly memoryUsage: number;
  /** CPU usage percentage (0-100) */
  readonly cpuUsage?: number;
  /** Worker status */
  readonly status: 'idle' | 'busy' | 'draining';
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Heartbeat interval in ms (default: 10000) */
  readonly heartbeatIntervalMs?: number;
  /** Health check interval in ms (default: 30000) */
  readonly healthCheckIntervalMs?: number;
  /** Missed heartbeats before zombie (default: 3) */
  readonly missedHeartbeatThreshold?: number;
  /** Memory threshold in bytes (default: 1GB) */
  readonly memoryThresholdBytes?: number;
  /** Max worker restarts (default: 3) */
  readonly maxRestarts?: number;
  /** Restart cooldown in ms (default: 60000) */
  readonly restartCooldownMs?: number;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: Required<HealthCheckConfig> = {
  heartbeatIntervalMs: 10000, // 10 seconds
  healthCheckIntervalMs: 30000, // 30 seconds
  missedHeartbeatThreshold: 3,
  memoryThresholdBytes: 1073741824, // 1GB
  maxRestarts: 3,
  restartCooldownMs: 60000, // 1 minute
} as const;

/**
 * Worker health information
 */
export interface WorkerHealthInfo {
  /** Worker ID */
  readonly workerId: string;
  /** Current health status */
  readonly healthStatus: WorkerHealthStatus;
  /** Last heartbeat timestamp */
  readonly lastHeartbeat: number | null;
  /** Number of missed heartbeats */
  readonly missedHeartbeats: number;
  /** Current memory usage in bytes */
  readonly memoryUsage: number;
  /** Restart count */
  readonly restartCount: number;
  /** Last restart timestamp */
  readonly lastRestartAt: number | null;
}

/**
 * Health monitor status snapshot
 */
export interface HealthMonitorStatus {
  /** Whether monitoring is active */
  readonly isActive: boolean;
  /** Total workers being monitored */
  readonly totalWorkers: number;
  /** Healthy worker count */
  readonly healthyCount: number;
  /** Degraded worker count */
  readonly degradedCount: number;
  /** Zombie worker count */
  readonly zombieCount: number;
  /** Workers in restart state */
  readonly restartingCount: number;
  /** Individual worker health info */
  readonly workers: readonly WorkerHealthInfo[];
}

/**
 * Health event types for notifications
 */
export type HealthEventType =
  | 'heartbeat_received'
  | 'heartbeat_missed'
  | 'zombie_detected'
  | 'worker_restarting'
  | 'worker_restarted'
  | 'worker_restart_failed'
  | 'task_reassigned'
  | 'memory_threshold_exceeded';

/**
 * Health event for notifications
 */
export interface HealthEvent {
  /** Event type */
  readonly type: HealthEventType;
  /** Event timestamp */
  readonly timestamp: string;
  /** Worker ID involved */
  readonly workerId: string;
  /** Additional event data */
  readonly data: Record<string, unknown>;
}

/**
 * Health event callback
 */
export type HealthEventCallback = (event: HealthEvent) => void | Promise<void>;
