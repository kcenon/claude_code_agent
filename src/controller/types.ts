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
