/**
 * Controller module error definitions
 *
 * Custom error classes for dependency graph analysis and prioritization operations.
 * All errors extend AppError for standardized error handling.
 *
 * @module controller/errors
 */

import { AppError, ErrorCodes, ErrorSeverity } from '../errors/index.js';
import type { AppErrorOptions } from '../errors/index.js';

/**
 * Base error class for controller errors
 */
export class ControllerError extends AppError {
  constructor(
    code: string,
    message: string,
    options: AppErrorOptions = {}
  ) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.HIGH,
      category: options.category ?? 'recoverable',
      ...options,
    });
    this.name = 'ControllerError';
  }
}

/**
 * Error thrown when dependency graph file is not found
 */
export class GraphNotFoundError extends ControllerError {
  /** The path that was not found */
  public readonly path: string;

  constructor(path: string) {
    super(ErrorCodes.CTL_GRAPH_NOT_FOUND, `Dependency graph file not found: ${path}`, {
      context: { path },
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
    });
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

  constructor(path: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { path },
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_GRAPH_PARSE_ERROR,
      `Failed to parse dependency graph at ${path}${causeMessage}`,
      options
    );
    this.name = 'GraphParseError';
    this.path = path;
  }
}

/**
 * Error thrown when dependency graph validation fails
 */
export class GraphValidationError extends ControllerError {
  /** Validation errors */
  public readonly errors: readonly string[];

  constructor(errors: readonly string[]) {
    super(
      ErrorCodes.CTL_GRAPH_VALIDATION_ERROR,
      `Dependency graph validation failed: ${errors.join('; ')}`,
      {
        context: { errors, errorCount: errors.length },
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
      }
    );
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
    super(
      ErrorCodes.CTL_CIRCULAR_DEPENDENCY,
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      {
        context: { cycle, cycleLength: cycle.length },
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
      }
    );
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
  public readonly referenceContext: string | undefined;

  constructor(issueId: string, referenceContext?: string) {
    const contextMessage = referenceContext !== undefined ? ` (referenced in ${referenceContext})` : '';
    const options: AppErrorOptions = {
      context: { issueId },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (referenceContext !== undefined) {
      options.context = { ...options.context, referenceContext };
    }
    super(
      ErrorCodes.CTL_ISSUE_NOT_FOUND,
      `Issue not found: ${issueId}${contextMessage}`,
      options
    );
    this.name = 'IssueNotFoundError';
    this.issueId = issueId;
    this.referenceContext = referenceContext;
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
    const options: AppErrorOptions = {
      context: {},
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (issueId !== undefined) {
      options.context = { issueId };
    }
    super(
      ErrorCodes.CTL_PRIORITY_ANALYSIS_ERROR,
      `Priority analysis failed${issueMessage}: ${message}`,
      options
    );
    this.name = 'PriorityAnalysisError';
    this.issueId = issueId;
  }
}

/**
 * Error thrown when there are no issues to process
 */
export class EmptyGraphError extends ControllerError {
  constructor() {
    super(ErrorCodes.CTL_EMPTY_GRAPH, 'Dependency graph contains no issues', {
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    });
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
    super(ErrorCodes.CTL_NO_AVAILABLE_WORKER, 'No available worker in the pool', {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
    });
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
    super(ErrorCodes.CTL_WORKER_NOT_FOUND, `Worker not found: ${workerId}`, {
      context: { workerId },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    });
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
    super(
      ErrorCodes.CTL_WORKER_NOT_AVAILABLE,
      `Worker ${workerId} is not available (current status: ${currentStatus})`,
      {
        context: { workerId, currentStatus },
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
      }
    );
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
    super(ErrorCodes.CTL_WORK_ORDER_NOT_FOUND, `Work order not found: ${orderId}`, {
      context: { orderId },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    });
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

  constructor(issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { issueId },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_WORK_ORDER_CREATION_ERROR,
      `Failed to create work order for issue ${issueId}${causeMessage}`,
      options
    );
    this.name = 'WorkOrderCreationError';
    this.issueId = issueId;
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

  constructor(workerId: string, issueId: string, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { workerId, issueId },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_WORKER_ASSIGNMENT_ERROR,
      `Failed to assign issue ${issueId} to worker ${workerId}${causeMessage}`,
      options
    );
    this.name = 'WorkerAssignmentError';
    this.workerId = workerId;
    this.issueId = issueId;
  }
}

/**
 * Error thrown when worker pool state persistence fails
 */
export class ControllerStatePersistenceError extends ControllerError {
  /** The operation that failed */
  public readonly operation: 'save' | 'load';

  constructor(operation: 'save' | 'load', cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { operation },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_STATE_PERSISTENCE_ERROR,
      `Failed to ${operation} controller state${causeMessage}`,
      options
    );
    this.name = 'ControllerStatePersistenceError';
    this.operation = operation;
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
    super(
      ErrorCodes.CTL_DEPENDENCIES_NOT_RESOLVED,
      `Issue ${issueId} has unresolved dependencies: ${unresolvedDependencies.join(', ')}`,
      {
        context: { issueId, unresolvedDependencies, count: unresolvedDependencies.length },
        severity: ErrorSeverity.MEDIUM,
        category: 'recoverable',
      }
    );
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
    super(ErrorCodes.CTL_PROGRESS_MONITOR_RUNNING, 'Progress monitor is already running', {
      severity: ErrorSeverity.LOW,
      category: 'recoverable',
    });
    this.name = 'ProgressMonitorAlreadyRunningError';
  }
}

/**
 * Error thrown when progress monitor is not running
 */
export class ProgressMonitorNotRunningError extends ControllerError {
  constructor() {
    super(ErrorCodes.CTL_PROGRESS_MONITOR_NOT_RUNNING, 'Progress monitor is not running', {
      severity: ErrorSeverity.LOW,
      category: 'recoverable',
    });
    this.name = 'ProgressMonitorNotRunningError';
  }
}

/**
 * Error thrown when progress report generation fails
 */
export class ProgressReportGenerationError extends ControllerError {
  constructor(cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_PROGRESS_REPORT_ERROR,
      `Failed to generate progress report${causeMessage}`,
      options
    );
    this.name = 'ProgressReportGenerationError';
  }
}

/**
 * Error thrown when progress report persistence fails
 */
export class ProgressReportPersistenceError extends ControllerError {
  /** The operation that failed */
  public readonly operation: 'save' | 'load';

  constructor(operation: 'save' | 'load', cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { operation },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_PROGRESS_PERSISTENCE_ERROR,
      `Failed to ${operation} progress report${causeMessage}`,
      options
    );
    this.name = 'ProgressReportPersistenceError';
    this.operation = operation;
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
    super(ErrorCodes.CTL_HEALTH_MONITOR_RUNNING, 'Health monitor is already running', {
      severity: ErrorSeverity.LOW,
      category: 'recoverable',
    });
    this.name = 'HealthMonitorAlreadyRunningError';
  }
}

/**
 * Error thrown when health monitor is not running
 */
export class HealthMonitorNotRunningError extends ControllerError {
  constructor() {
    super(ErrorCodes.CTL_HEALTH_MONITOR_NOT_RUNNING, 'Health monitor is not running', {
      severity: ErrorSeverity.LOW,
      category: 'recoverable',
    });
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
    const options: AppErrorOptions = {
      context: { workerId, missedHeartbeats },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (currentTask !== undefined) {
      options.context = { ...options.context, currentTask };
    }
    super(
      ErrorCodes.CTL_ZOMBIE_WORKER,
      `Worker ${workerId} became zombie after ${String(missedHeartbeats)} missed heartbeats${taskMessage}`,
      options
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

  constructor(workerId: string, attemptCount: number, cause?: Error) {
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { workerId, attemptCount },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_WORKER_RESTART_ERROR,
      `Failed to restart worker ${workerId} after ${String(attemptCount)} attempts${causeMessage}`,
      options
    );
    this.name = 'WorkerRestartError';
    this.workerId = workerId;
    this.attemptCount = attemptCount;
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
    super(
      ErrorCodes.CTL_MAX_RESTARTS_EXCEEDED,
      `Worker ${workerId} exceeded maximum restart limit of ${String(maxRestarts)}`,
      {
        context: { workerId, maxRestarts },
        severity: ErrorSeverity.CRITICAL,
        category: 'fatal',
      }
    );
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
    super(
      ErrorCodes.CTL_TASK_REASSIGNMENT_ERROR,
      `Failed to reassign task ${taskId} from worker ${fromWorkerId}: ${reason}`,
      {
        context: { taskId, fromWorkerId, reason },
        severity: ErrorSeverity.HIGH,
        category: 'recoverable',
      }
    );
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

  constructor(workerId: string, issueId: string | null, attemptCount: number, cause?: Error) {
    const issueMessage = issueId !== null ? ` for task ${issueId}` : '';
    const causeMessage = cause !== undefined ? `: ${cause.message}` : '';
    const options: AppErrorOptions = {
      context: { workerId, attemptCount },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (issueId !== null) {
      options.context = { ...options.context, issueId };
    }
    if (cause !== undefined) {
      options.cause = cause;
    }
    super(
      ErrorCodes.CTL_STUCK_WORKER_RECOVERY_ERROR,
      `Failed to recover stuck worker ${workerId}${issueMessage} after ${String(attemptCount)} attempts${causeMessage}`,
      options
    );
    this.name = 'StuckWorkerRecoveryError';
    this.workerId = workerId;
    this.issueId = issueId;
    this.attemptCount = attemptCount;
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
    const options: AppErrorOptions = {
      context: { workerId, durationMs, attemptCount, minutes },
      severity: ErrorSeverity.CRITICAL,
      category: 'fatal',
    };
    if (issueId !== null) {
      options.context = { ...options.context, issueId };
    }
    super(
      ErrorCodes.CTL_STUCK_WORKER_CRITICAL,
      `Worker ${workerId}${issueMessage} stuck for ${String(minutes)} minutes after ${String(attemptCount)} recovery attempts - manual intervention required`,
      options
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
    super(
      ErrorCodes.CTL_MAX_RECOVERY_EXCEEDED,
      `Worker ${workerId} exceeded maximum recovery attempts of ${String(maxAttempts)}`,
      {
        context: { workerId, maxAttempts },
        severity: ErrorSeverity.CRITICAL,
        category: 'fatal',
      }
    );
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
      ErrorCodes.CTL_QUEUE_FULL,
      `Queue is full: cannot enqueue task ${taskId} (current: ${String(currentSize)}, max: ${String(maxSize)})`,
      {
        context: { taskId, currentSize, maxSize },
        severity: ErrorSeverity.HIGH,
        category: 'transient',
      }
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
      ErrorCodes.CTL_QUEUE_MEMORY_LIMIT,
      `Queue memory limit exceeded: ${String(Math.round(currentMemory / 1048576))}MB / ${String(Math.round(maxMemory / 1048576))}MB`,
      {
        context: { currentMemory, maxMemory, currentMB: Math.round(currentMemory / 1048576), maxMB: Math.round(maxMemory / 1048576) },
        severity: ErrorSeverity.HIGH,
        category: 'transient',
      }
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
      ErrorCodes.CTL_QUEUE_BACKPRESSURE,
      `Queue backpressure active: utilization ${String(Math.round(utilizationRatio * 100))}% exceeds threshold ${String(Math.round(threshold * 100))}%`,
      {
        context: { utilizationRatio, threshold, utilizationPercent: Math.round(utilizationRatio * 100), thresholdPercent: Math.round(threshold * 100) },
        severity: ErrorSeverity.MEDIUM,
        category: 'transient',
      }
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
      ErrorCodes.CTL_TASK_PRIORITY_LOW,
      `Task ${taskId} priority ${String(taskPriority)} is below queue minimum ${String(minPriority)}`,
      {
        context: { taskId, taskPriority, minPriority },
        severity: ErrorSeverity.LOW,
        category: 'recoverable',
      }
    );
    this.name = 'TaskPriorityTooLowError';
    this.taskId = taskId;
    this.taskPriority = taskPriority;
    this.minPriority = minPriority;
  }
}
