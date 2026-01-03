/**
 * Controller module error definitions
 *
 * Custom error classes for dependency graph analysis and prioritization operations.
 */

/**
 * Base error class for controller errors
 */
export class ControllerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ControllerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when dependency graph file is not found
 */
export class GraphNotFoundError extends ControllerError {
  /** The path that was not found */
  public readonly path: string;

  constructor(path: string) {
    super(`Dependency graph file not found: ${path}`);
    this.name = 'GraphNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when dependency graph parsing fails
 */
export class GraphParseError extends ControllerError {
  /** The path of the file that failed to parse */
  public readonly path: string;
  /** The underlying parse error */
  public readonly cause: Error | undefined;

  constructor(path: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to parse dependency graph at ${path}${causeMessage}`);
    this.name = 'GraphParseError';
    this.path = path;
    this.cause = cause;
  }
}

/**
 * Error thrown when dependency graph validation fails
 */
export class GraphValidationError extends ControllerError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(`Dependency graph validation failed: ${errors.join('; ')}`);
    this.name = 'GraphValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends ControllerError {
  /** The cycle path */
  public readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Error thrown when a referenced issue is not found
 */
export class IssueNotFoundError extends ControllerError {
  /** The issue ID that was not found */
  public readonly issueId: string;
  /** Context where the issue was referenced */
  public readonly context: string | undefined;

  constructor(issueId: string, context?: string) {
    const contextMessage = context !== undefined ? ` (referenced in ${context})` : '';
    super(`Issue not found: ${issueId}${contextMessage}`);
    this.name = 'IssueNotFoundError';
    this.issueId = issueId;
    this.context = context;
  }
}

/**
 * Error thrown when priority analysis fails
 */
export class PriorityAnalysisError extends ControllerError {
  /** The issue ID that caused the failure */
  public readonly issueId: string | undefined;

  constructor(message: string, issueId?: string) {
    const issueMessage = issueId !== undefined ? ` for issue ${issueId}` : '';
    super(`Priority analysis failed${issueMessage}: ${message}`);
    this.name = 'PriorityAnalysisError';
    this.issueId = issueId;
  }
}

/**
 * Error thrown when there are no issues to process
 */
export class EmptyGraphError extends ControllerError {
  constructor() {
    super('Dependency graph contains no issues');
    this.name = 'EmptyGraphError';
  }
}

// ============================================================================
// Worker Pool Errors
// ============================================================================

/**
 * Error thrown when no worker is available
 */
export class NoAvailableWorkerError extends ControllerError {
  constructor() {
    super('No available worker in the pool');
    this.name = 'NoAvailableWorkerError';
  }
}

/**
 * Error thrown when a worker is not found
 */
export class WorkerNotFoundError extends ControllerError {
  /** The worker ID that was not found */
  public readonly workerId: string;

  constructor(workerId: string) {
    super(`Worker not found: ${workerId}`);
    this.name = 'WorkerNotFoundError';
    this.workerId = workerId;
  }
}

/**
 * Error thrown when a worker is not available for assignment
 */
export class WorkerNotAvailableError extends ControllerError {
  /** The worker ID that is not available */
  public readonly workerId: string;
  /** The current status of the worker */
  public readonly currentStatus: string;

  constructor(workerId: string, currentStatus: string) {
    super(`Worker ${workerId} is not available (current status: ${currentStatus})`);
    this.name = 'WorkerNotAvailableError';
    this.workerId = workerId;
    this.currentStatus = currentStatus;
  }
}

/**
 * Error thrown when a work order is not found
 */
export class WorkOrderNotFoundError extends ControllerError {
  /** The work order ID that was not found */
  public readonly orderId: string;

  constructor(orderId: string) {
    super(`Work order not found: ${orderId}`);
    this.name = 'WorkOrderNotFoundError';
    this.orderId = orderId;
  }
}

/**
 * Error thrown when work order creation fails
 */
export class WorkOrderCreationError extends ControllerError {
  /** The issue ID for which work order creation failed */
  public readonly issueId: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to create work order for issue ${issueId}${causeMessage}`);
    this.name = 'WorkOrderCreationError';
    this.issueId = issueId;
    this.cause = cause;
  }
}

/**
 * Error thrown when worker assignment fails
 */
export class WorkerAssignmentError extends ControllerError {
  /** The worker ID involved in the failed assignment */
  public readonly workerId: string;
  /** The issue ID that failed to be assigned */
  public readonly issueId: string;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(workerId: string, issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to assign issue ${issueId} to worker ${workerId}${causeMessage}`);
    this.name = 'WorkerAssignmentError';
    this.workerId = workerId;
    this.issueId = issueId;
    this.cause = cause;
  }
}

/**
 * Error thrown when worker pool state persistence fails
 */
export class ControllerStatePersistenceError extends ControllerError {
  /** The operation that failed */
  public readonly operation: 'save' | 'load';
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(operation: 'save' | 'load', cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to ${operation} controller state${causeMessage}`);
    this.name = 'ControllerStatePersistenceError';
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Error thrown when dependencies are not resolved
 */
export class DependenciesNotResolvedError extends ControllerError {
  /** The issue ID with unresolved dependencies */
  public readonly issueId: string;
  /** The unresolved dependency issue IDs */
  public readonly unresolvedDependencies: readonly string[];

  constructor(issueId: string, unresolvedDependencies: readonly string[]) {
    super(`Issue ${issueId} has unresolved dependencies: ${unresolvedDependencies.join(', ')}`);
    this.name = 'DependenciesNotResolvedError';
    this.issueId = issueId;
    this.unresolvedDependencies = unresolvedDependencies;
  }
}

// ============================================================================
// Progress Monitor Errors
// ============================================================================

/**
 * Error thrown when progress monitor is already running
 */
export class ProgressMonitorAlreadyRunningError extends ControllerError {
  constructor() {
    super('Progress monitor is already running');
    this.name = 'ProgressMonitorAlreadyRunningError';
  }
}

/**
 * Error thrown when progress monitor is not running
 */
export class ProgressMonitorNotRunningError extends ControllerError {
  constructor() {
    super('Progress monitor is not running');
    this.name = 'ProgressMonitorNotRunningError';
  }
}

/**
 * Error thrown when progress report generation fails
 */
export class ProgressReportGenerationError extends ControllerError {
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to generate progress report${causeMessage}`);
    this.name = 'ProgressReportGenerationError';
    this.cause = cause;
  }
}

/**
 * Error thrown when progress report persistence fails
 */
export class ProgressReportPersistenceError extends ControllerError {
  /** The operation that failed */
  public readonly operation: 'save' | 'load';
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(operation: 'save' | 'load', cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(`Failed to ${operation} progress report${causeMessage}`);
    this.name = 'ProgressReportPersistenceError';
    this.operation = operation;
    this.cause = cause;
  }
}

// ============================================================================
// Worker Health Check Errors
// ============================================================================

/**
 * Error thrown when health monitor is already running
 */
export class HealthMonitorAlreadyRunningError extends ControllerError {
  constructor() {
    super('Health monitor is already running');
    this.name = 'HealthMonitorAlreadyRunningError';
  }
}

/**
 * Error thrown when health monitor is not running
 */
export class HealthMonitorNotRunningError extends ControllerError {
  constructor() {
    super('Health monitor is not running');
    this.name = 'HealthMonitorNotRunningError';
  }
}

/**
 * Error thrown when a zombie worker is detected
 */
export class ZombieWorkerError extends ControllerError {
  /** The worker ID that became zombie */
  public readonly workerId: string;
  /** Number of missed heartbeats */
  public readonly missedHeartbeats: number;
  /** The task that was being processed */
  public readonly currentTask: string | undefined;

  constructor(workerId: string, missedHeartbeats: number, currentTask?: string) {
    const taskMessage = currentTask !== undefined ? ` (processing ${currentTask})` : '';
    super(
      `Worker ${workerId} became zombie after ${String(missedHeartbeats)} missed heartbeats${taskMessage}`
    );
    this.name = 'ZombieWorkerError';
    this.workerId = workerId;
    this.missedHeartbeats = missedHeartbeats;
    this.currentTask = currentTask;
  }
}

/**
 * Error thrown when worker restart fails
 */
export class WorkerRestartError extends ControllerError {
  /** The worker ID that failed to restart */
  public readonly workerId: string;
  /** Number of restart attempts */
  public readonly attemptCount: number;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(workerId: string, attemptCount: number, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(
      `Failed to restart worker ${workerId} after ${String(attemptCount)} attempts${causeMessage}`
    );
    this.name = 'WorkerRestartError';
    this.workerId = workerId;
    this.attemptCount = attemptCount;
    this.cause = cause;
  }
}

/**
 * Error thrown when max restarts exceeded
 */
export class MaxRestartsExceededError extends ControllerError {
  /** The worker ID */
  public readonly workerId: string;
  /** Maximum restart limit */
  public readonly maxRestarts: number;

  constructor(workerId: string, maxRestarts: number) {
    super(`Worker ${workerId} exceeded maximum restart limit of ${String(maxRestarts)}`);
    this.name = 'MaxRestartsExceededError';
    this.workerId = workerId;
    this.maxRestarts = maxRestarts;
  }
}

/**
 * Error thrown when task reassignment fails
 */
export class TaskReassignmentError extends ControllerError {
  /** The task/issue ID that failed to reassign */
  public readonly taskId: string;
  /** The original worker ID */
  public readonly fromWorkerId: string;
  /** Reason for failure */
  public readonly reason: string;

  constructor(taskId: string, fromWorkerId: string, reason: string) {
    super(`Failed to reassign task ${taskId} from worker ${fromWorkerId}: ${reason}`);
    this.name = 'TaskReassignmentError';
    this.taskId = taskId;
    this.fromWorkerId = fromWorkerId;
    this.reason = reason;
  }
}

// ============================================================================
// Stuck Worker Recovery Errors
// ============================================================================

/**
 * Error thrown when stuck worker recovery fails
 */
export class StuckWorkerRecoveryError extends ControllerError {
  /** The worker ID */
  public readonly workerId: string;
  /** The issue/task ID */
  public readonly issueId: string | null;
  /** Number of recovery attempts made */
  public readonly attemptCount: number;
  /** The underlying error */
  public readonly cause: Error | undefined;

  constructor(workerId: string, issueId: string | null, attemptCount: number, cause?: Error) {
    const issueMessage = issueId !== null ? ` for task ${issueId}` : '';
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    super(
      `Failed to recover stuck worker ${workerId}${issueMessage} after ${String(attemptCount)} attempts${causeMessage}`
    );
    this.name = 'StuckWorkerRecoveryError';
    this.workerId = workerId;
    this.issueId = issueId;
    this.attemptCount = attemptCount;
    this.cause = cause;
  }
}

/**
 * Error thrown when stuck worker escalation reaches critical level
 */
export class StuckWorkerCriticalError extends ControllerError {
  /** The worker ID */
  public readonly workerId: string;
  /** The issue/task ID */
  public readonly issueId: string | null;
  /** Duration the worker has been stuck (in milliseconds) */
  public readonly durationMs: number;
  /** Number of recovery attempts made */
  public readonly attemptCount: number;

  constructor(workerId: string, issueId: string | null, durationMs: number, attemptCount: number) {
    const issueMessage = issueId !== null ? ` on task ${issueId}` : '';
    const minutes = Math.round(durationMs / 60000);
    super(
      `Worker ${workerId}${issueMessage} stuck for ${String(minutes)} minutes after ${String(attemptCount)} recovery attempts - manual intervention required`
    );
    this.name = 'StuckWorkerCriticalError';
    this.workerId = workerId;
    this.issueId = issueId;
    this.durationMs = durationMs;
    this.attemptCount = attemptCount;
  }
}

/**
 * Error thrown when max recovery attempts exceeded
 */
export class MaxRecoveryAttemptsExceededError extends ControllerError {
  /** The worker ID */
  public readonly workerId: string;
  /** Maximum recovery attempts allowed */
  public readonly maxAttempts: number;

  constructor(workerId: string, maxAttempts: number) {
    super(`Worker ${workerId} exceeded maximum recovery attempts of ${String(maxAttempts)}`);
    this.name = 'MaxRecoveryAttemptsExceededError';
    this.workerId = workerId;
    this.maxAttempts = maxAttempts;
  }
}

// ============================================================================
// Bounded Work Queue Errors
// ============================================================================

/**
 * Error thrown when queue is full and cannot accept new tasks
 */
export class QueueFullError extends ControllerError {
  /** The task ID that was rejected */
  public readonly taskId: string;
  /** Current queue size */
  public readonly currentSize: number;
  /** Maximum queue size */
  public readonly maxSize: number;

  constructor(taskId: string, currentSize: number, maxSize: number) {
    super(
      `Queue is full: cannot enqueue task ${taskId} (current: ${String(currentSize)}, max: ${String(maxSize)})`
    );
    this.name = 'QueueFullError';
    this.taskId = taskId;
    this.currentSize = currentSize;
    this.maxSize = maxSize;
  }
}

/**
 * Error thrown when queue memory limit is exceeded
 */
export class QueueMemoryLimitError extends ControllerError {
  /** Current memory usage in bytes */
  public readonly currentMemory: number;
  /** Maximum memory limit in bytes */
  public readonly maxMemory: number;

  constructor(currentMemory: number, maxMemory: number) {
    super(
      `Queue memory limit exceeded: ${String(Math.round(currentMemory / 1048576))}MB / ${String(Math.round(maxMemory / 1048576))}MB`
    );
    this.name = 'QueueMemoryLimitError';
    this.currentMemory = currentMemory;
    this.maxMemory = maxMemory;
  }
}

/**
 * Error thrown when backpressure is active and blocking operations
 */
export class QueueBackpressureActiveError extends ControllerError {
  /** Queue utilization ratio */
  public readonly utilizationRatio: number;
  /** Backpressure threshold */
  public readonly threshold: number;

  constructor(utilizationRatio: number, threshold: number) {
    super(
      `Queue backpressure active: utilization ${String(Math.round(utilizationRatio * 100))}% exceeds threshold ${String(Math.round(threshold * 100))}%`
    );
    this.name = 'QueueBackpressureActiveError';
    this.utilizationRatio = utilizationRatio;
    this.threshold = threshold;
  }
}

/**
 * Error thrown when task priority is too low for queue acceptance
 */
export class TaskPriorityTooLowError extends ControllerError {
  /** The task ID that was rejected */
  public readonly taskId: string;
  /** The task's priority score */
  public readonly taskPriority: number;
  /** Minimum priority required */
  public readonly minPriority: number;

  constructor(taskId: string, taskPriority: number, minPriority: number) {
    super(
      `Task ${taskId} priority ${String(taskPriority)} is below queue minimum ${String(minPriority)}`
    );
    this.name = 'TaskPriorityTooLowError';
    this.taskId = taskId;
    this.taskPriority = taskPriority;
    this.minPriority = minPriority;
  }
}
