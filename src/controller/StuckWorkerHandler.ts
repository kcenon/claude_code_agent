/**
 * Stuck Worker Handler module
 *
 * Provides automatic recovery, progressive actions, and escalation handling
 * for stuck workers in the Worker Pool.
 *
 * @module controller/StuckWorkerHandler
 */

import type {
  StuckWorkerConfig,
  StuckWorkerEscalationLevel,
  StuckWorkerRecoveryAction,
  StuckWorkerRecoveryAttempt,
  StuckWorkerEscalation,
  TaskTypeThreshold,
  WorkerInfo,
  ProgressEvent,
  ProgressEventType,
  ProgressEventCallback,
} from './types.js';
import { DEFAULT_STUCK_WORKER_CONFIG } from './types.js';
import { StuckWorkerRecoveryError } from './errors.js';

/**
 * Worker state tracked by the handler
 */
interface TrackedWorkerState {
  workerId: string;
  issueId: string | null;
  startedAt: number;
  lastEscalationLevel: StuckWorkerEscalationLevel | null;
  recoveryAttempts: number;
  deadlineExtensions: number;
  taskType: string | null;
}

/**
 * Callback type for task reassignment
 */
export type TaskReassignHandler = (taskId: string, fromWorkerId: string) => Promise<string | null>;

/**
 * Callback type for worker restart
 */
export type WorkerRestartHandler = (workerId: string) => Promise<void>;

/**
 * Callback type for deadline extension
 */
export type DeadlineExtendHandler = (
  workerId: string,
  issueId: string,
  extensionMs: number
) => Promise<void>;

/**
 * Callback type for critical escalation
 */
export type CriticalEscalationHandler = (escalation: StuckWorkerEscalation) => Promise<void>;

/**
 * Callback type for pipeline pause
 */
export type PipelinePauseHandler = (reason: string) => Promise<void>;

/**
 * Stuck Worker Handler
 *
 * Monitors worker durations and triggers progressive recovery actions
 * based on configurable thresholds.
 */
export class StuckWorkerHandler {
  private readonly config: Required<Omit<StuckWorkerConfig, 'taskThresholds'>> & {
    taskThresholds: Record<string, TaskTypeThreshold>;
  };
  private readonly trackedWorkers: Map<string, TrackedWorkerState>;
  private readonly recoveryHistory: StuckWorkerRecoveryAttempt[];
  private readonly escalationHistory: StuckWorkerEscalation[];
  private readonly eventListeners: ProgressEventCallback[];

  private onTaskReassign?: TaskReassignHandler;
  private onWorkerRestart?: WorkerRestartHandler;
  private onDeadlineExtend?: DeadlineExtendHandler;
  private onCriticalEscalation?: CriticalEscalationHandler;
  private onPipelinePause?: PipelinePauseHandler;

  constructor(config: StuckWorkerConfig = {}) {
    this.config = {
      warningThresholdMs:
        config.warningThresholdMs ?? DEFAULT_STUCK_WORKER_CONFIG.warningThresholdMs,
      stuckThresholdMs: config.stuckThresholdMs ?? DEFAULT_STUCK_WORKER_CONFIG.stuckThresholdMs,
      criticalThresholdMs:
        config.criticalThresholdMs ?? DEFAULT_STUCK_WORKER_CONFIG.criticalThresholdMs,
      taskThresholds: config.taskThresholds ?? DEFAULT_STUCK_WORKER_CONFIG.taskThresholds,
      autoRecoveryEnabled:
        config.autoRecoveryEnabled ?? DEFAULT_STUCK_WORKER_CONFIG.autoRecoveryEnabled,
      maxRecoveryAttempts:
        config.maxRecoveryAttempts ?? DEFAULT_STUCK_WORKER_CONFIG.maxRecoveryAttempts,
      deadlineExtensionMs:
        config.deadlineExtensionMs ?? DEFAULT_STUCK_WORKER_CONFIG.deadlineExtensionMs,
      pauseOnCritical: config.pauseOnCritical ?? DEFAULT_STUCK_WORKER_CONFIG.pauseOnCritical,
    };

    this.trackedWorkers = new Map();
    this.recoveryHistory = [];
    this.escalationHistory = [];
    this.eventListeners = [];
  }

  /**
   * Get threshold for a specific task type
   * @param taskType - Task type identifier, or null to use default thresholds
   * @returns Warning, stuck, and critical thresholds for the given task type
   */
  public getThresholdForTask(taskType: string | null): TaskTypeThreshold {
    if (taskType !== null && this.config.taskThresholds[taskType] !== undefined) {
      return this.config.taskThresholds[taskType];
    }

    return {
      warning: this.config.warningThresholdMs,
      stuck: this.config.stuckThresholdMs,
      critical: this.config.criticalThresholdMs,
    };
  }

  /**
   * Track a worker that started working
   * @param workerId - Unique identifier of the worker to monitor
   * @param issueId - Issue being processed, or null if not associated with an issue
   * @param startedAt - Epoch timestamp (ms) when the worker started the task
   * @param taskType - Category of the task for threshold lookup, or null for defaults
   */
  public trackWorker(
    workerId: string,
    issueId: string | null,
    startedAt: number,
    taskType: string | null = null
  ): void {
    this.trackedWorkers.set(workerId, {
      workerId,
      issueId,
      startedAt,
      lastEscalationLevel: null,
      recoveryAttempts: 0,
      deadlineExtensions: 0,
      taskType,
    });
  }

  /**
   * Stop tracking a worker (task completed or worker released)
   * @param workerId - Worker to remove from stuck-detection monitoring
   */
  public untrackWorker(workerId: string): void {
    this.trackedWorkers.delete(workerId);
  }

  /**
   * Check all tracked workers and handle stuck conditions
   * @param workers - Current worker pool state to evaluate for stuck conditions
   * @returns List of new escalations triggered during this check cycle
   */
  public async checkWorkers(workers: readonly WorkerInfo[]): Promise<StuckWorkerEscalation[]> {
    const now = Date.now();
    const escalations: StuckWorkerEscalation[] = [];

    for (const worker of workers) {
      if (worker.status === 'working' && worker.startedAt !== null) {
        let state = this.trackedWorkers.get(worker.id);

        if (state === undefined) {
          this.trackWorker(worker.id, worker.currentIssue, new Date(worker.startedAt).getTime());
          state = this.trackedWorkers.get(worker.id);
        }

        if (state !== undefined) {
          const duration = now - state.startedAt;
          const escalation = await this.handleWorkerDuration(state, duration);
          if (escalation !== null) {
            escalations.push(escalation);
          }
        }
      } else {
        this.untrackWorker(worker.id);
      }
    }

    return escalations;
  }

  /**
   * Handle worker duration and determine escalation level
   * @param state - Tracked state for the worker being evaluated
   * @param duration - Elapsed time in milliseconds since the worker started
   * @returns New escalation if a threshold was crossed, or null if no change
   */
  private async handleWorkerDuration(
    state: TrackedWorkerState,
    duration: number
  ): Promise<StuckWorkerEscalation | null> {
    const threshold = this.getThresholdForTask(state.taskType);

    const level = this.determineEscalationLevel(duration, threshold);

    if (level === null) {
      return null;
    }

    if (state.lastEscalationLevel === level) {
      return null;
    }

    state.lastEscalationLevel = level;

    const escalation = await this.handleEscalation(state, level, duration);
    return escalation;
  }

  /**
   * Determine escalation level based on duration
   * @param duration - Elapsed time in milliseconds since the worker started
   * @param threshold - Warning, stuck, and critical time thresholds for comparison
   * @returns Matched escalation level, or null if duration is below all thresholds
   */
  private determineEscalationLevel(
    duration: number,
    threshold: TaskTypeThreshold
  ): StuckWorkerEscalationLevel | null {
    if (duration >= threshold.critical) {
      return 'critical';
    }
    if (duration >= threshold.stuck) {
      return 'stuck';
    }
    if (duration >= threshold.warning) {
      return 'warning';
    }
    return null;
  }

  /**
   * Handle escalation based on level
   * @param state - Tracked state for the stuck worker
   * @param level - Escalation severity (warning, stuck, or critical)
   * @param duration - Elapsed time in milliseconds triggering the escalation
   * @returns Created escalation record with suggested action
   */
  private async handleEscalation(
    state: TrackedWorkerState,
    level: StuckWorkerEscalationLevel,
    duration: number
  ): Promise<StuckWorkerEscalation> {
    const escalation: StuckWorkerEscalation = {
      workerId: state.workerId,
      issueId: state.issueId,
      level,
      durationMs: duration,
      recoveryAttempts: state.recoveryAttempts,
      timestamp: new Date().toISOString(),
      suggestedAction: this.getSuggestedAction(level, state.recoveryAttempts),
    };

    this.escalationHistory.push(escalation);

    await this.emitEscalationEvent(level, state, duration);

    if (this.config.autoRecoveryEnabled) {
      await this.attemptRecovery(state, level, duration);
    }

    return escalation;
  }

  /**
   * Get suggested action based on escalation level and attempts
   * @param level - Current escalation severity level
   * @param attempts - Number of recovery attempts already made
   * @returns Human-readable suggestion for resolving the stuck condition
   */
  private getSuggestedAction(level: StuckWorkerEscalationLevel, attempts: number): string {
    switch (level) {
      case 'warning':
        return 'Monitor worker progress. Consider extending deadline if near completion.';
      case 'stuck':
        if (attempts === 0) {
          return 'Extend deadline and send warning notification.';
        }
        if (attempts === 1) {
          return 'Reassign task to a healthy worker.';
        }
        return 'Restart worker and reassign task.';
      case 'critical':
        return 'Manual intervention required. Pipeline may need to be paused.';
    }
  }

  /**
   * Attempt recovery based on escalation level
   * @param state - Tracked state for the worker to recover
   * @param level - Current escalation severity determining the recovery strategy
   * @param duration - Elapsed time in milliseconds used for critical escalation reporting
   */
  private async attemptRecovery(
    state: TrackedWorkerState,
    level: StuckWorkerEscalationLevel,
    duration: number
  ): Promise<void> {
    if (state.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      await this.emitEvent('recovery_failed', {
        workerId: state.workerId,
        issueId: state.issueId,
        reason: 'max_attempts_exceeded',
        attempts: state.recoveryAttempts,
      });

      if (level === 'critical') {
        await this.handleCriticalEscalation(state, duration);
      }
      return;
    }

    const action = this.determineRecoveryAction(state, level);
    state.recoveryAttempts++;

    let success = false;
    let errorMessage: string | undefined;

    try {
      await this.executeRecoveryAction(state, action);
      success = true;

      await this.emitEvent('recovery_succeeded', {
        workerId: state.workerId,
        issueId: state.issueId,
        action,
        attemptNumber: state.recoveryAttempts,
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.emitEvent('recovery_failed', {
        workerId: state.workerId,
        issueId: state.issueId,
        action,
        attemptNumber: state.recoveryAttempts,
        error: errorMessage,
      });

      if (state.recoveryAttempts >= this.config.maxRecoveryAttempts && level === 'critical') {
        throw new StuckWorkerRecoveryError(
          state.workerId,
          state.issueId,
          state.recoveryAttempts,
          error instanceof Error ? error : undefined
        );
      }
    }

    const attempt: StuckWorkerRecoveryAttempt =
      errorMessage !== undefined
        ? {
            workerId: state.workerId,
            issueId: state.issueId ?? 'unknown',
            attemptNumber: state.recoveryAttempts,
            action,
            timestamp: new Date().toISOString(),
            success,
            error: errorMessage,
          }
        : {
            workerId: state.workerId,
            issueId: state.issueId ?? 'unknown',
            attemptNumber: state.recoveryAttempts,
            action,
            timestamp: new Date().toISOString(),
            success,
          };
    this.recoveryHistory.push(attempt);
  }

  /**
   * Determine which recovery action to take
   * @param state - Tracked state including prior recovery attempt count
   * @param level - Escalation severity guiding the progressive recovery strategy
   * @returns Recovery action to execute (send_warning, extend_deadline, reassign, restart, or escalate)
   */
  private determineRecoveryAction(
    state: TrackedWorkerState,
    level: StuckWorkerEscalationLevel
  ): StuckWorkerRecoveryAction {
    const attempts = state.recoveryAttempts;

    if (level === 'warning') {
      return 'send_warning';
    }

    if (level === 'stuck') {
      if (attempts === 0) {
        return 'extend_deadline';
      }
      if (attempts === 1) {
        return 'reassign_task';
      }
      return 'restart_worker';
    }

    // level === 'critical' (exhaustive check after 'warning' and 'stuck')
    if (attempts < this.config.maxRecoveryAttempts) {
      return 'restart_worker';
    }
    return 'escalate_critical';
  }

  /**
   * Execute the recovery action
   * @param state - Tracked worker state used to identify the worker and task
   * @param action - Specific recovery action to perform (e.g., extend_deadline, reassign_task)
   */
  private async executeRecoveryAction(
    state: TrackedWorkerState,
    action: StuckWorkerRecoveryAction
  ): Promise<void> {
    await this.emitEvent('recovery_attempted', {
      workerId: state.workerId,
      issueId: state.issueId,
      action,
      attemptNumber: state.recoveryAttempts,
    });

    switch (action) {
      case 'send_warning':
        break;

      case 'extend_deadline':
        if (this.onDeadlineExtend !== undefined && state.issueId !== null) {
          await this.onDeadlineExtend(
            state.workerId,
            state.issueId,
            this.config.deadlineExtensionMs
          );
          state.deadlineExtensions++;
          state.startedAt = Date.now();

          await this.emitEvent('deadline_extended', {
            workerId: state.workerId,
            issueId: state.issueId,
            extensionMs: this.config.deadlineExtensionMs,
            totalExtensions: state.deadlineExtensions,
          });
        }
        break;

      case 'reassign_task':
        if (this.onTaskReassign !== undefined && state.issueId !== null) {
          const newWorkerId = await this.onTaskReassign(state.issueId, state.workerId);
          if (newWorkerId !== null) {
            this.untrackWorker(state.workerId);

            await this.emitEvent('task_reassigned', {
              taskId: state.issueId,
              fromWorkerId: state.workerId,
              toWorkerId: newWorkerId,
            });
          }
        }
        break;

      case 'restart_worker':
        if (this.onWorkerRestart !== undefined) {
          await this.onWorkerRestart(state.workerId);
          state.lastEscalationLevel = null;
          state.startedAt = Date.now();
        }
        break;

      case 'escalate_critical':
        await this.handleCriticalEscalation(state, Date.now() - state.startedAt);
        break;
    }
  }

  /**
   * Handle critical escalation
   * @param state - Tracked worker state for the critically stuck worker
   * @param duration - Elapsed time in milliseconds since the worker started
   */
  private async handleCriticalEscalation(
    state: TrackedWorkerState,
    duration: number
  ): Promise<void> {
    const escalation: StuckWorkerEscalation = {
      workerId: state.workerId,
      issueId: state.issueId,
      level: 'critical',
      durationMs: duration,
      recoveryAttempts: state.recoveryAttempts,
      timestamp: new Date().toISOString(),
      suggestedAction: 'Manual intervention required. All automatic recovery attempts exhausted.',
    };

    await this.emitEvent('critical_escalation', {
      workerId: state.workerId,
      issueId: state.issueId,
      durationMs: duration,
      recoveryAttempts: state.recoveryAttempts,
    });

    if (this.onCriticalEscalation !== undefined) {
      await this.onCriticalEscalation(escalation);
    }

    if (this.config.pauseOnCritical && this.onPipelinePause !== undefined) {
      await this.onPipelinePause(`Critical worker stuck: ${state.workerId}`);
    }
  }

  /**
   * Emit escalation event based on level
   * @param level - Escalation severity determining the event type to emit
   * @param state - Tracked worker state included in the event payload
   * @param duration - Elapsed time in milliseconds included in the event payload
   */
  private async emitEscalationEvent(
    level: StuckWorkerEscalationLevel,
    state: TrackedWorkerState,
    duration: number
  ): Promise<void> {
    const eventType: ProgressEventType =
      level === 'warning'
        ? 'worker_warning'
        : level === 'critical'
          ? 'worker_critical'
          : 'worker_stuck';

    await this.emitEvent(eventType, {
      workerId: state.workerId,
      issueId: state.issueId,
      durationMs: duration,
      durationMinutes: Math.round(duration / 60000),
      level,
    });
  }

  /**
   * Emit an event to all listeners
   * @param type - Event type identifier (e.g., worker_stuck, recovery_succeeded)
   * @param data - Arbitrary key-value payload describing the event
   */
  private async emitEvent(type: ProgressEventType, data: Record<string, unknown>): Promise<void> {
    const event: ProgressEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const listener of this.eventListeners) {
      try {
        await listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Register event listener
   * @param callback - Handler invoked for all progress events (escalations, recoveries, etc.)
   */
  public onEvent(callback: ProgressEventCallback): void {
    this.eventListeners.push(callback);
  }

  /**
   * Set task reassignment handler
   * @param handler - Async callback that moves a task from a stuck worker to a healthy one
   */
  public setTaskReassignHandler(handler: TaskReassignHandler): void {
    this.onTaskReassign = handler;
  }

  /**
   * Set worker restart handler
   * @param handler - Async callback that restarts a stuck worker process
   */
  public setWorkerRestartHandler(handler: WorkerRestartHandler): void {
    this.onWorkerRestart = handler;
  }

  /**
   * Set deadline extension handler
   * @param handler - Async callback that grants additional time before a worker is considered stuck
   */
  public setDeadlineExtendHandler(handler: DeadlineExtendHandler): void {
    this.onDeadlineExtend = handler;
  }

  /**
   * Set critical escalation handler
   * @param handler - Async callback invoked when all automatic recovery attempts are exhausted
   */
  public setCriticalEscalationHandler(handler: CriticalEscalationHandler): void {
    this.onCriticalEscalation = handler;
  }

  /**
   * Set pipeline pause handler
   * @param handler - Async callback that halts the pipeline when a critical stuck condition occurs
   */
  public setPipelinePauseHandler(handler: PipelinePauseHandler): void {
    this.onPipelinePause = handler;
  }

  /**
   * Get recovery history
   * @returns Chronological list of all recovery attempts with outcomes
   */
  public getRecoveryHistory(): readonly StuckWorkerRecoveryAttempt[] {
    return [...this.recoveryHistory];
  }

  /**
   * Get escalation history
   * @returns Chronological list of all escalation events across all workers
   */
  public getEscalationHistory(): readonly StuckWorkerEscalation[] {
    return [...this.escalationHistory];
  }

  /**
   * Get current tracked workers
   * @returns Snapshot of all workers currently being monitored for stuck conditions
   */
  public getTrackedWorkers(): readonly TrackedWorkerState[] {
    return Array.from(this.trackedWorkers.values());
  }

  /**
   * Get configuration
   * @returns Resolved configuration with all defaults applied
   */
  public getConfig(): Required<Omit<StuckWorkerConfig, 'taskThresholds'>> & {
    taskThresholds: Record<string, TaskTypeThreshold>;
  } {
    return { ...this.config };
  }

  /**
   * Reset all state
   */
  public reset(): void {
    this.trackedWorkers.clear();
    this.recoveryHistory.length = 0;
    this.escalationHistory.length = 0;
  }
}
