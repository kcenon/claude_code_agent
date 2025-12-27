/**
 * Controller module
 *
 * Provides dependency graph analysis, prioritization, and worker pool management
 * for the Controller Agent orchestration.
 *
 * @module controller
 */

export { PriorityAnalyzer } from './PriorityAnalyzer.js';
export { WorkerPoolManager } from './WorkerPoolManager.js';

export type {
  // Priority Analyzer types
  Priority,
  IssueStatus,
  PriorityWeights,
  IssueNode,
  DependencyEdge,
  RawDependencyGraph,
  AnalyzedIssue,
  ParallelGroup,
  CriticalPath,
  PrioritizedQueue,
  GraphAnalysisResult,
  GraphStatistics,
  PriorityAnalyzerConfig,
  // Worker Pool types
  WorkerStatus,
  WorkerInfo,
  WorkerPoolConfig,
  WorkerPoolStatus,
  DependencyStatus,
  RelatedFile,
  WorkOrderContext,
  WorkOrder,
  WorkOrderResult,
  WorkQueueEntry,
  ControllerState,
  WorkerCompletionCallback,
  WorkerFailureCallback,
} from './types.js';

export {
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_ANALYZER_CONFIG,
  DEFAULT_WORKER_POOL_CONFIG,
} from './types.js';

export {
  // Base error
  ControllerError,
  // Priority Analyzer errors
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  CircularDependencyError,
  IssueNotFoundError,
  PriorityAnalysisError,
  EmptyGraphError,
  // Worker Pool errors
  NoAvailableWorkerError,
  WorkerNotFoundError,
  WorkerNotAvailableError,
  WorkOrderNotFoundError,
  WorkOrderCreationError,
  WorkerAssignmentError,
  ControllerStatePersistenceError,
  DependenciesNotResolvedError,
} from './errors.js';
