/**
 * Progress Monitor module
 *
 * Provides real-time progress tracking, bottleneck detection,
 * and progress report generation for the Controller Agent.
 *
 * @module controller/ProgressMonitor
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type {
  WorkerPoolStatus,
  WorkerInfo,
  ProgressMonitorConfig,
  ProgressMetrics,
  Bottleneck,
  BottleneckType,
  ProgressReport,
  RecentActivity,
  ProgressEvent,
  ProgressEventType,
  ProgressEventCallback,
  WorkQueueEntry,
  HealthMonitorStatus,
  StuckWorkerConfig,
  StuckWorkerEscalation,
} from './types.js';
import { DEFAULT_PROGRESS_MONITOR_CONFIG, DEFAULT_STUCK_WORKER_CONFIG } from './types.js';
import {
  ProgressMonitorAlreadyRunningError,
  ProgressMonitorNotRunningError,
  ProgressReportPersistenceError,
} from './errors.js';
import {
  StuckWorkerHandler,
  type TaskReassignHandler,
  type WorkerRestartHandler,
  type DeadlineExtendHandler,
  type CriticalEscalationHandler,
  type PipelinePauseHandler,
} from './StuckWorkerHandler.js';

/**
 * Completion record for ETA calculation
 */
interface CompletionRecord {
  readonly issueId: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
}

/**
 * Internal mutable state for activity tracking
 */
interface MutableRecentActivity {
  timestamp: string;
  type: 'completed' | 'started' | 'failed' | 'blocked';
  issueId: string;
  workerId?: string;
  details?: string;
}

/**
 * Progress Monitor
 *
 * Monitors worker pool progress at regular intervals, detects bottlenecks,
 * and generates progress reports.
 */
/**
 * Function type to get health monitor status
 */
type GetHealthStatusFn = () => HealthMonitorStatus;

/**
 *
 */
export class ProgressMonitor {
  private readonly config: Required<Omit<ProgressMonitorConfig, 'stuckWorkerConfig'>> & {
    stuckWorkerConfig: Required<Omit<StuckWorkerConfig, 'taskThresholds'>> & {
      taskThresholds: Record<string, import('./types.js').TaskTypeThreshold>;
    };
  };
  private readonly sessionId: string;
  private timer: ReturnType<typeof setInterval> | null;
  private isRunning: boolean;

  private readonly completionHistory: CompletionRecord[];
  private readonly recentActivities: MutableRecentActivity[];
  private readonly detectedBottlenecks: Map<string, Bottleneck>;
  private readonly eventListeners: ProgressEventCallback[];

  private totalIssues: number;
  private completedCount: number;
  private failedCount: number;
  private lastWorkerStatus: Map<string, { status: string; currentIssue: string | null }>;

  private getHealthStatus?: GetHealthStatusFn;

  private readonly stuckWorkerHandler: StuckWorkerHandler;

  constructor(sessionId: string, config: ProgressMonitorConfig = {}) {
    const stuckWorkerConfig = config.stuckWorkerConfig ?? {};

    // Support deprecated stuckWorkerThreshold for backward compatibility
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const legacyThreshold = config.stuckWorkerThreshold;

    const effectiveStuckThreshold =
      stuckWorkerConfig.stuckThresholdMs ??
      legacyThreshold ??
      DEFAULT_STUCK_WORKER_CONFIG.stuckThresholdMs;

    const effectiveWarningThreshold =
      stuckWorkerConfig.warningThresholdMs ??
      (legacyThreshold !== undefined
        ? Math.round(legacyThreshold * 0.6)
        : DEFAULT_STUCK_WORKER_CONFIG.warningThresholdMs);

    const effectiveCriticalThreshold =
      stuckWorkerConfig.criticalThresholdMs ??
      (legacyThreshold !== undefined
        ? legacyThreshold * 2
        : DEFAULT_STUCK_WORKER_CONFIG.criticalThresholdMs);

    this.config = {
      pollingInterval: config.pollingInterval ?? DEFAULT_PROGRESS_MONITOR_CONFIG.pollingInterval,
      stuckWorkerThreshold: effectiveStuckThreshold,
      maxRecentActivities:
        config.maxRecentActivities ?? DEFAULT_PROGRESS_MONITOR_CONFIG.maxRecentActivities,
      reportPath: config.reportPath ?? DEFAULT_PROGRESS_MONITOR_CONFIG.reportPath,
      enableNotifications:
        config.enableNotifications ?? DEFAULT_PROGRESS_MONITOR_CONFIG.enableNotifications,
      stuckWorkerConfig: {
        warningThresholdMs: effectiveWarningThreshold,
        stuckThresholdMs: effectiveStuckThreshold,
        criticalThresholdMs: effectiveCriticalThreshold,
        taskThresholds:
          stuckWorkerConfig.taskThresholds ?? DEFAULT_STUCK_WORKER_CONFIG.taskThresholds,
        autoRecoveryEnabled:
          stuckWorkerConfig.autoRecoveryEnabled ?? DEFAULT_STUCK_WORKER_CONFIG.autoRecoveryEnabled,
        maxRecoveryAttempts:
          stuckWorkerConfig.maxRecoveryAttempts ?? DEFAULT_STUCK_WORKER_CONFIG.maxRecoveryAttempts,
        deadlineExtensionMs:
          stuckWorkerConfig.deadlineExtensionMs ?? DEFAULT_STUCK_WORKER_CONFIG.deadlineExtensionMs,
        pauseOnCritical:
          stuckWorkerConfig.pauseOnCritical ?? DEFAULT_STUCK_WORKER_CONFIG.pauseOnCritical,
      },
    };

    this.sessionId = sessionId;
    this.timer = null;
    this.isRunning = false;

    this.completionHistory = [];
    this.recentActivities = [];
    this.detectedBottlenecks = new Map();
    this.eventListeners = [];

    this.totalIssues = 0;
    this.completedCount = 0;
    this.failedCount = 0;
    this.lastWorkerStatus = new Map();

    this.stuckWorkerHandler = new StuckWorkerHandler(this.config.stuckWorkerConfig);

    this.stuckWorkerHandler.onEvent((event) => {
      void this.emitEvent(event.type, event.data);
    });
  }

  /**
   * Start the progress monitor
   * @param getWorkerPoolStatus Function to get current worker pool status
   * @param getWorkQueue Function to get current work queue
   * @throws ProgressMonitorAlreadyRunningError if already running
   */
  public start(
    getWorkerPoolStatus: () => WorkerPoolStatus,
    getWorkQueue: () => readonly WorkQueueEntry[]
  ): void {
    if (this.isRunning) {
      throw new ProgressMonitorAlreadyRunningError();
    }

    this.isRunning = true;
    this.timer = setInterval(() => {
      void this.checkProgress(getWorkerPoolStatus, getWorkQueue);
    }, this.config.pollingInterval);

    // Run initial check
    void this.checkProgress(getWorkerPoolStatus, getWorkQueue);
  }

  /**
   * Stop the progress monitor
   * @throws ProgressMonitorNotRunningError if not running
   */
  public stop(): void {
    if (!this.isRunning) {
      throw new ProgressMonitorNotRunningError();
    }

    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * Check if the monitor is currently running
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Set the total number of issues to track
   * @param count
   */
  public setTotalIssues(count: number): void {
    this.totalIssues = count;
  }

  /**
   * Record a task completion
   * @param issueId
   * @param startedAt
   * @param success
   */
  public recordCompletion(issueId: string, startedAt: Date, success: boolean): void {
    const now = new Date();

    if (success) {
      this.completedCount++;
      this.completionHistory.push({
        issueId,
        startedAt,
        completedAt: now,
        durationMs: now.getTime() - startedAt.getTime(),
      });

      this.addActivity({
        timestamp: now.toISOString(),
        type: 'completed',
        issueId,
        details: `Completed successfully`,
      });
    } else {
      this.failedCount++;
      this.addActivity({
        timestamp: now.toISOString(),
        type: 'failed',
        issueId,
        details: `Task failed`,
      });
    }
  }

  /**
   * Record a task start
   * @param issueId
   * @param workerId
   */
  public recordStart(issueId: string, workerId: string): void {
    this.addActivity({
      timestamp: new Date().toISOString(),
      type: 'started',
      issueId,
      workerId,
      details: `Started by ${workerId}`,
    });
  }

  /**
   * Record a task being blocked
   * @param issueId
   * @param reason
   */
  public recordBlocked(issueId: string, reason: string): void {
    this.addActivity({
      timestamp: new Date().toISOString(),
      type: 'blocked',
      issueId,
      details: reason,
    });
  }

  /**
   * Add an activity to the recent activities log
   * @param activity
   */
  private addActivity(activity: MutableRecentActivity): void {
    this.recentActivities.unshift(activity);

    // Trim to max size
    while (this.recentActivities.length > this.config.maxRecentActivities) {
      this.recentActivities.pop();
    }
  }

  /**
   * Register an event listener
   * @param callback
   */
  public onEvent(callback: ProgressEventCallback): void {
    this.eventListeners.push(callback);
  }

  /**
   * Emit an event to all listeners
   * @param type
   * @param data
   */
  private async emitEvent(type: ProgressEventType, data: Record<string, unknown>): Promise<void> {
    if (!this.config.enableNotifications) {
      return;
    }

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
   * Check progress and detect bottlenecks
   * @param getWorkerPoolStatus
   * @param getWorkQueue
   */
  private async checkProgress(
    getWorkerPoolStatus: () => WorkerPoolStatus,
    getWorkQueue: () => readonly WorkQueueEntry[]
  ): Promise<ProgressReport> {
    const workerStatus = getWorkerPoolStatus();
    const workQueue = getWorkQueue();

    // Detect worker state changes
    this.detectWorkerStateChanges(workerStatus);

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(workerStatus, workQueue);

    // Calculate progress metrics
    const metrics = this.calculateMetrics(workerStatus, workQueue);

    // Generate report
    const report = this.generateReport(metrics, workerStatus, bottlenecks);

    // Emit progress event
    await this.emitEvent('progress_updated', {
      metrics,
      bottleneckCount: bottlenecks.length,
    });

    // Check for milestones
    await this.checkMilestones(metrics);

    // Save report to disk
    await this.saveReport(report);

    return report;
  }

  /**
   * Detect worker state changes and record activities
   * @param workerStatus
   */
  private detectWorkerStateChanges(workerStatus: WorkerPoolStatus): void {
    for (const worker of workerStatus.workers) {
      const lastStatus = this.lastWorkerStatus.get(worker.id);

      if (lastStatus !== undefined) {
        // Worker started working
        if (lastStatus.status !== 'working' && worker.status === 'working') {
          if (worker.currentIssue !== null) {
            this.recordStart(worker.currentIssue, worker.id);
          }
        }
      }

      this.lastWorkerStatus.set(worker.id, {
        status: worker.status,
        currentIssue: worker.currentIssue,
      });
    }
  }

  /**
   * Detect bottlenecks in the system
   * @param workerStatus
   * @param workQueue
   */
  public detectBottlenecks(
    workerStatus: WorkerPoolStatus,
    workQueue: readonly WorkQueueEntry[]
  ): readonly Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const now = Date.now();

    // 1. Detect stuck workers using StuckWorkerHandler (with configurable thresholds)
    void this.stuckWorkerHandler.checkWorkers(workerStatus.workers);

    for (const worker of workerStatus.workers) {
      if (worker.status === 'working' && worker.startedAt !== null) {
        const duration = now - new Date(worker.startedAt).getTime();
        const threshold = this.stuckWorkerHandler.getThresholdForTask(null);

        if (duration > threshold.stuck) {
          const bottleneckId = `stuck_worker_${worker.id}`;

          if (!this.detectedBottlenecks.has(bottleneckId)) {
            const severity = duration >= threshold.critical ? 5 : 4;
            const level = duration >= threshold.critical ? 'critical' : 'stuck';
            const bottleneck = this.createBottleneck(
              'stuck_worker',
              `Worker ${worker.id} has been working on ${worker.currentIssue ?? 'unknown'} for over ${String(Math.round(duration / 60000))} minutes (${level})`,
              worker.currentIssue !== null ? [worker.currentIssue] : [],
              this.getSuggestedActionForStuckWorker(duration, threshold),
              severity
            );
            this.detectedBottlenecks.set(bottleneckId, bottleneck);
            bottlenecks.push(bottleneck);
          } else {
            const existing = this.detectedBottlenecks.get(bottleneckId);
            if (existing !== undefined) {
              bottlenecks.push(existing);
            }
          }
        } else if (duration > threshold.warning) {
          const bottleneckId = `warning_worker_${worker.id}`;

          if (!this.detectedBottlenecks.has(bottleneckId)) {
            const bottleneck = this.createBottleneck(
              'stuck_worker',
              `Worker ${worker.id} approaching stuck threshold (${String(Math.round(duration / 60000))} minutes)`,
              worker.currentIssue !== null ? [worker.currentIssue] : [],
              'Monitor progress. Automatic recovery will trigger if threshold exceeded.',
              2
            );
            this.detectedBottlenecks.set(bottleneckId, bottleneck);
            bottlenecks.push(bottleneck);
          }
        } else {
          this.detectedBottlenecks.delete(`warning_worker_${worker.id}`);
          this.detectedBottlenecks.delete(`stuck_worker_${worker.id}`);
        }
      } else {
        this.detectedBottlenecks.delete(`warning_worker_${worker.id}`);
        this.detectedBottlenecks.delete(`stuck_worker_${worker.id}`);
      }
    }

    // 2. Detect blocked chain (all workers idle but queue not empty)
    if (workerStatus.workingWorkers === 0 && workerStatus.idleWorkers > 0 && workQueue.length > 0) {
      const bottleneckId = 'blocked_chain';

      if (!this.detectedBottlenecks.has(bottleneckId)) {
        const affectedIssues = workQueue.map((entry) => entry.issueId);
        const bottleneck = this.createBottleneck(
          'blocked_chain',
          `${String(workQueue.length)} issues are blocked with ${String(workerStatus.idleWorkers)} idle workers`,
          affectedIssues,
          'Check for unresolved dependencies or failed prerequisite tasks',
          3
        );
        this.detectedBottlenecks.set(bottleneckId, bottleneck);
        bottlenecks.push(bottleneck);

        void this.emitEvent('bottleneck_detected', {
          type: 'blocked_chain',
          affectedCount: workQueue.length,
        });
      } else {
        const existing = this.detectedBottlenecks.get(bottleneckId);
        if (existing !== undefined) {
          bottlenecks.push(existing);
        }
      }
    } else {
      // Resolve if previously detected
      if (this.detectedBottlenecks.has('blocked_chain')) {
        this.detectedBottlenecks.delete('blocked_chain');
        void this.emitEvent('bottleneck_resolved', { type: 'blocked_chain' });
      }
    }

    // 3. Detect resource contention (all workers busy and large queue)
    if (workerStatus.idleWorkers === 0 && workQueue.length > workerStatus.totalWorkers * 2) {
      const bottleneckId = 'resource_contention';

      if (!this.detectedBottlenecks.has(bottleneckId)) {
        const affectedIssues = workQueue.slice(0, 10).map((entry) => entry.issueId);
        const bottleneck = this.createBottleneck(
          'resource_contention',
          `High queue depth (${String(workQueue.length)}) with all ${String(workerStatus.totalWorkers)} workers busy`,
          affectedIssues,
          'Consider increasing worker pool size or prioritizing critical tasks',
          2
        );
        this.detectedBottlenecks.set(bottleneckId, bottleneck);
        bottlenecks.push(bottleneck);
      } else {
        const existing = this.detectedBottlenecks.get(bottleneckId);
        if (existing !== undefined) {
          bottlenecks.push(existing);
        }
      }
    } else {
      if (this.detectedBottlenecks.has('resource_contention')) {
        this.detectedBottlenecks.delete('resource_contention');
        void this.emitEvent('bottleneck_resolved', { type: 'resource_contention' });
      }
    }

    // 4. Detect error workers
    if (workerStatus.errorWorkers > 0) {
      const errorWorkers = workerStatus.workers.filter((w) => w.status === 'error');
      for (const worker of errorWorkers) {
        const bottleneckId = `error_worker_${worker.id}`;

        if (!this.detectedBottlenecks.has(bottleneckId)) {
          const bottleneck = this.createBottleneck(
            'stuck_worker',
            `Worker ${worker.id} is in error state: ${worker.lastError ?? 'Unknown error'}`,
            worker.currentIssue !== null ? [worker.currentIssue] : [],
            'Reset the worker and retry the failed task',
            4
          );
          this.detectedBottlenecks.set(bottleneckId, bottleneck);
          bottlenecks.push(bottleneck);
        } else {
          const existing = this.detectedBottlenecks.get(bottleneckId);
          if (existing !== undefined) {
            bottlenecks.push(existing);
          }
        }
      }
    }

    return bottlenecks;
  }

  /**
   * Get suggested action for stuck worker based on duration
   * @param duration
   * @param threshold
   */
  private getSuggestedActionForStuckWorker(
    duration: number,
    threshold: import('./types.js').TaskTypeThreshold
  ): string {
    if (duration >= threshold.critical) {
      return 'Manual intervention required. Automatic recovery attempts exhausted.';
    }
    if (duration >= threshold.stuck) {
      return 'Automatic recovery in progress. Check worker logs if issue persists.';
    }
    return 'Monitor progress. Recovery will trigger automatically if threshold exceeded.';
  }

  /**
   * Create a bottleneck object
   * @param type
   * @param description
   * @param affectedIssues
   * @param suggestedAction
   * @param severity
   */
  private createBottleneck(
    type: BottleneckType,
    description: string,
    affectedIssues: readonly string[],
    suggestedAction: string,
    severity: number
  ): Bottleneck {
    return {
      type,
      description,
      affectedIssues,
      suggestedAction,
      severity,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate progress metrics
   * @param workerStatus
   * @param workQueue
   */
  public calculateMetrics(
    workerStatus: WorkerPoolStatus,
    workQueue: readonly WorkQueueEntry[]
  ): ProgressMetrics {
    const inProgress = workerStatus.workingWorkers;
    const pending = workQueue.length;
    const blocked = workerStatus.errorWorkers;

    // If total not set, estimate from current state
    const total =
      this.totalIssues > 0
        ? this.totalIssues
        : this.completedCount + inProgress + pending + blocked + this.failedCount;

    const percentage = total > 0 ? (this.completedCount / total) * 100 : 0;

    // Calculate average completion time
    const avgTime = this.calculateAverageCompletionTime();

    // Calculate ETA
    const remainingTasks = pending + inProgress;
    let eta: Date | null = null;
    if (avgTime > 0 && remainingTasks > 0) {
      // Account for parallel execution
      const effectiveWorkers = Math.min(workerStatus.totalWorkers, remainingTasks);
      const estimatedMs = (avgTime * remainingTasks) / effectiveWorkers;
      eta = new Date(Date.now() + estimatedMs);
    }

    return {
      totalIssues: total,
      completed: this.completedCount,
      inProgress,
      pending,
      blocked,
      failed: this.failedCount,
      percentage: Math.round(percentage * 100) / 100,
      eta,
      averageCompletionTime: avgTime,
    };
  }

  /**
   * Calculate average completion time from history
   */
  private calculateAverageCompletionTime(): number {
    if (this.completionHistory.length === 0) {
      return 0;
    }

    const totalDuration = this.completionHistory.reduce(
      (sum, record) => sum + record.durationMs,
      0
    );
    return totalDuration / this.completionHistory.length;
  }

  /**
   * Check for milestones and emit events
   * @param metrics
   */
  private async checkMilestones(metrics: ProgressMetrics): Promise<void> {
    const milestones = [25, 50, 75, 100];

    for (const milestone of milestones) {
      if (
        metrics.percentage >= milestone &&
        (this.completedCount === 1 ||
          ((this.completedCount - 1) / (this.totalIssues || 1)) * 100 < milestone)
      ) {
        await this.emitEvent('milestone_reached', {
          milestone,
          completed: metrics.completed,
          total: metrics.totalIssues,
        });

        if (milestone === 100) {
          await this.emitEvent('all_completed', {
            totalCompleted: metrics.completed,
            totalFailed: metrics.failed,
            totalTime: this.completionHistory.reduce((sum, r) => sum + r.durationMs, 0),
          });
        }
      }
    }
  }

  /**
   * Set a health status provider function
   * This allows integration with WorkerHealthMonitor
   * @param provider
   */
  public setHealthStatusProvider(provider: GetHealthStatusFn): void {
    this.getHealthStatus = provider;
  }

  /**
   * Generate a progress report
   * @param metrics
   * @param workerStatus
   * @param bottlenecks
   */
  public generateReport(
    metrics: ProgressMetrics,
    workerStatus: WorkerPoolStatus,
    bottlenecks: readonly Bottleneck[]
  ): ProgressReport {
    const report: ProgressReport = {
      sessionId: this.sessionId,
      generatedAt: new Date().toISOString(),
      metrics,
      workers: workerStatus.workers,
      bottlenecks,
      recentActivity: this.recentActivities.map((a) => ({ ...a })),
    };

    // Include health status if available
    if (this.getHealthStatus !== undefined) {
      return {
        ...report,
        workerHealth: this.getHealthStatus(),
      };
    }

    return report;
  }

  /**
   * Generate markdown report content
   * @param report
   */
  public generateMarkdownReport(report: ProgressReport): string {
    const lines: string[] = [];

    lines.push('# Progress Report');
    lines.push('');
    lines.push(`**Generated**: ${report.generatedAt}`);
    lines.push(`**Session**: ${report.sessionId}`);
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Issues | ${String(report.metrics.totalIssues)} |`);
    lines.push(
      `| Completed | ${String(report.metrics.completed)} (${String(report.metrics.percentage)}%) |`
    );
    lines.push(`| In Progress | ${String(report.metrics.inProgress)} |`);
    lines.push(`| Pending | ${String(report.metrics.pending)} |`);
    lines.push(`| Blocked | ${String(report.metrics.blocked)} |`);
    lines.push(`| Failed | ${String(report.metrics.failed)} |`);
    lines.push(
      `| ETA | ${report.metrics.eta !== null ? report.metrics.eta.toISOString() : 'N/A'} |`
    );
    lines.push('');

    // Workers table
    lines.push('## Workers');
    lines.push('');
    lines.push('| Worker | Status | Current Issue | Duration |');
    lines.push('|--------|--------|---------------|----------|');

    for (const worker of report.workers) {
      const duration = this.formatDuration(worker);
      lines.push(
        `| ${worker.id} | ${worker.status} | ${worker.currentIssue ?? '-'} | ${duration} |`
      );
    }
    lines.push('');

    // Worker Health (if available)
    if (report.workerHealth !== undefined) {
      lines.push('## Worker Health');
      lines.push('');
      lines.push('| Status | Count |');
      lines.push('|--------|-------|');
      lines.push(`| Healthy | ${String(report.workerHealth.healthyCount)} |`);
      lines.push(`| Degraded | ${String(report.workerHealth.degradedCount)} |`);
      lines.push(`| Zombie | ${String(report.workerHealth.zombieCount)} |`);
      lines.push(`| Restarting | ${String(report.workerHealth.restartingCount)} |`);
      lines.push('');

      if (report.workerHealth.zombieCount > 0) {
        lines.push('### Zombie Workers');
        lines.push('');
        for (const w of report.workerHealth.workers) {
          if (w.healthStatus === 'zombie') {
            lines.push(
              `- **${w.workerId}**: ${String(w.missedHeartbeats)} missed heartbeats, ${String(w.restartCount)} restarts`
            );
          }
        }
        lines.push('');
      }
    }

    // Bottlenecks
    lines.push('## Bottlenecks');
    lines.push('');
    if (report.bottlenecks.length === 0) {
      lines.push('No bottlenecks detected.');
    } else {
      for (const bottleneck of report.bottlenecks) {
        lines.push(`### ${bottleneck.type} (Severity: ${String(bottleneck.severity)}/5)`);
        lines.push('');
        lines.push(`**Description**: ${bottleneck.description}`);
        lines.push('');
        lines.push(`**Affected Issues**: ${bottleneck.affectedIssues.join(', ') || 'None'}`);
        lines.push('');
        lines.push(`**Suggested Action**: ${bottleneck.suggestedAction}`);
        lines.push('');
      }
    }

    // Recent Activity
    lines.push('## Recent Activity');
    lines.push('');
    if (report.recentActivity.length === 0) {
      lines.push('No recent activity.');
    } else {
      for (const activity of report.recentActivity.slice(0, 10)) {
        const time = new Date(activity.timestamp).toLocaleTimeString();
        const workerInfo = activity.workerId !== undefined ? ` (${activity.workerId})` : '';
        lines.push(`- **${time}** [${activity.type}] ${activity.issueId}${workerInfo}`);
        if (activity.details !== undefined) {
          lines.push(`  - ${activity.details}`);
        }
      }
    }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format worker duration for display
   * @param worker
   */
  private formatDuration(worker: WorkerInfo): string {
    if (worker.startedAt === null) {
      return '-';
    }

    const durationMs = Date.now() - new Date(worker.startedAt).getTime();
    const seconds = Math.floor(durationMs / 1000) % 60;
    const minutes = Math.floor(durationMs / 60000) % 60;
    const hours = Math.floor(durationMs / 3600000);

    if (hours > 0) {
      return `${String(hours)}h ${String(minutes)}m`;
    }
    return `${String(minutes)}m ${String(seconds)}s`;
  }

  /**
   * Save report to disk
   * @param report
   */
  public async saveReport(report: ProgressReport): Promise<void> {
    const reportDir = this.config.reportPath;

    try {
      if (!existsSync(reportDir)) {
        await mkdir(reportDir, { recursive: true });
      }

      // Save JSON report
      const jsonPath = join(reportDir, 'progress_report.json');
      await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');

      // Save Markdown report
      const markdownContent = this.generateMarkdownReport(report);
      const mdPath = join(reportDir, 'progress_report.md');
      await writeFile(mdPath, markdownContent, 'utf-8');
    } catch (error) {
      throw new ProgressReportPersistenceError('save', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Load the last saved report
   */
  public async loadReport(): Promise<ProgressReport | null> {
    const jsonPath = join(this.config.reportPath, 'progress_report.json');

    if (!existsSync(jsonPath)) {
      return null;
    }

    try {
      const content = await readFile(jsonPath, 'utf-8');
      // Internal data saved by this class - use direct parse with type assertion
      return JSON.parse(content) as ProgressReport;
    } catch (error) {
      throw new ProgressReportPersistenceError('load', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get the current list of detected bottlenecks
   */
  public getBottlenecks(): readonly Bottleneck[] {
    return Array.from(this.detectedBottlenecks.values());
  }

  /**
   * Get recent activities
   */
  public getRecentActivities(): readonly RecentActivity[] {
    return this.recentActivities.map((a) => ({ ...a }));
  }

  /**
   * Clear a resolved bottleneck
   * @param bottleneckId
   */
  public clearBottleneck(bottleneckId: string): boolean {
    return this.detectedBottlenecks.delete(bottleneckId);
  }

  /**
   * Reset all state
   */
  public reset(): void {
    if (this.isRunning) {
      this.stop();
    }

    this.completionHistory.length = 0;
    this.recentActivities.length = 0;
    this.detectedBottlenecks.clear();
    this.lastWorkerStatus.clear();
    this.totalIssues = 0;
    this.completedCount = 0;
    this.failedCount = 0;
    this.stuckWorkerHandler.reset();
  }

  /**
   * Get the current completed count
   */
  public getCompletedCount(): number {
    return this.completedCount;
  }

  /**
   * Get the current failed count
   */
  public getFailedCount(): number {
    return this.failedCount;
  }

  /**
   * Get the stuck worker handler instance
   */
  public getStuckWorkerHandler(): StuckWorkerHandler {
    return this.stuckWorkerHandler;
  }

  /**
   * Get stuck worker configuration
   */
  public getStuckWorkerConfig(): Required<Omit<StuckWorkerConfig, 'taskThresholds'>> & {
    taskThresholds: Record<string, import('./types.js').TaskTypeThreshold>;
  } {
    return this.config.stuckWorkerConfig;
  }

  /**
   * Set task reassignment handler for stuck worker recovery
   * @param handler
   */
  public setTaskReassignHandler(handler: TaskReassignHandler): void {
    this.stuckWorkerHandler.setTaskReassignHandler(handler);
  }

  /**
   * Set worker restart handler for stuck worker recovery
   * @param handler
   */
  public setWorkerRestartHandler(handler: WorkerRestartHandler): void {
    this.stuckWorkerHandler.setWorkerRestartHandler(handler);
  }

  /**
   * Set deadline extension handler for stuck worker recovery
   * @param handler
   */
  public setDeadlineExtendHandler(handler: DeadlineExtendHandler): void {
    this.stuckWorkerHandler.setDeadlineExtendHandler(handler);
  }

  /**
   * Set critical escalation handler
   * @param handler
   */
  public setCriticalEscalationHandler(handler: CriticalEscalationHandler): void {
    this.stuckWorkerHandler.setCriticalEscalationHandler(handler);
  }

  /**
   * Set pipeline pause handler for critical escalations
   * @param handler
   */
  public setPipelinePauseHandler(handler: PipelinePauseHandler): void {
    this.stuckWorkerHandler.setPipelinePauseHandler(handler);
  }

  /**
   * Get stuck worker escalation history
   */
  public getEscalationHistory(): readonly StuckWorkerEscalation[] {
    return this.stuckWorkerHandler.getEscalationHistory();
  }

  /**
   * Get stuck worker recovery history
   */
  public getRecoveryHistory(): readonly import('./types.js').StuckWorkerRecoveryAttempt[] {
    return this.stuckWorkerHandler.getRecoveryHistory();
  }
}
