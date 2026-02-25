/**
 * Controller module
 *
 * Provides dependency graph analysis, prioritization, worker pool management,
 * and progress monitoring for the Controller Agent orchestration.
 *
 * @module controller
 */

export { PriorityAnalyzer } from './PriorityAnalyzer.js';
export { WorkerPoolManager } from './WorkerPoolManager.js';
export { ProgressMonitor } from './ProgressMonitor.js';
export { ControllerAgentAdapter, CONTROLLER_AGENT_ID } from './ControllerAgentAdapter.js';
export type { ControllerAgentConfig } from './ControllerAgentAdapter.js';
export { WorkerHealthMonitor } from './WorkerHealthMonitor.js';
export { StuckWorkerHandler } from './StuckWorkerHandler.js';
export { BoundedWorkQueue } from './BoundedWorkQueue.js';
export { WorkerPoolMetrics } from './WorkerPoolMetrics.js';
export type {
  ZombieWorkerHandler,
  WorkerRestartHandler,
  TaskReassignmentHandler,
} from './WorkerHealthMonitor.js';
export type {
  TaskReassignHandler,
  WorkerRestartHandler as StuckWorkerRestartHandler,
  DeadlineExtendHandler,
  CriticalEscalationHandler,
  PipelinePauseHandler,
} from './StuckWorkerHandler.js';

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
  CycleInfo,
  CycleStatus,
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
  // Progress Monitor types
  BottleneckType,
  Bottleneck,
  ProgressMetrics,
  RecentActivity,
  ProgressReport,
  ProgressMonitorConfig,
  ProgressEventType,
  ProgressEvent,
  ProgressEventCallback,
  // Stuck Worker types
  StuckWorkerEscalationLevel,
  StuckWorkerRecoveryAction,
  TaskTypeThreshold,
  StuckWorkerConfig,
  StuckWorkerRecoveryAttempt,
  StuckWorkerEscalation,
  // Worker Health Check types
  WorkerHealthStatus,
  WorkerHeartbeat,
  HealthCheckConfig,
  WorkerHealthInfo,
  HealthMonitorStatus,
  HealthEventType,
  HealthEvent,
  HealthEventCallback,
  // Bounded Work Queue types
  QueueRejectionPolicy,
  BoundedQueueConfig,
  QueueRejectionReason,
  EnqueueResult,
  DeadLetterEntry,
  QueueStatus,
  QueueEventType,
  QueueEvent,
  QueueEventCallback,
  // Distributed Lock types
  DistributedLockOptions,
  // Worker Pool Metrics types
  PoolUtilizationMetrics,
  QueueDepthMetrics,
  TaskCompletionRecord,
  TaskCompletionStats,
  WorkerPoolMetricsSnapshot,
  PrometheusMetricType,
  PrometheusMetric,
  PrometheusHistogramBucket,
  PrometheusHistogram,
  MetricsExportFormat,
  WorkerPoolMetricsConfig,
  MetricsEventType,
  MetricsEvent,
  MetricsEventCallback,
} from './types.js';

export {
  DEFAULT_PRIORITY_WEIGHTS,
  DEFAULT_ANALYZER_CONFIG,
  DEFAULT_WORKER_POOL_CONFIG,
  DEFAULT_PROGRESS_MONITOR_CONFIG,
  DEFAULT_STUCK_WORKER_CONFIG,
  DEFAULT_HEALTH_CHECK_CONFIG,
  DEFAULT_BOUNDED_QUEUE_CONFIG,
  DEFAULT_DISTRIBUTED_LOCK_OPTIONS,
  DEFAULT_WORKER_POOL_METRICS_CONFIG,
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
  // Progress Monitor errors
  ProgressMonitorAlreadyRunningError,
  ProgressMonitorNotRunningError,
  ProgressReportGenerationError,
  ProgressReportPersistenceError,
  // Worker Health Check errors
  HealthMonitorAlreadyRunningError,
  HealthMonitorNotRunningError,
  ZombieWorkerError,
  WorkerRestartError,
  MaxRestartsExceededError,
  TaskReassignmentError,
  // Stuck Worker Recovery errors
  StuckWorkerRecoveryError,
  StuckWorkerCriticalError,
  MaxRecoveryAttemptsExceededError,
  // Bounded Work Queue errors
  QueueFullError,
  QueueMemoryLimitError,
  QueueBackpressureActiveError,
  TaskPriorityTooLowError,
} from './errors.js';
