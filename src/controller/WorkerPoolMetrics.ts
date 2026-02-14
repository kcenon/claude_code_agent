/**
 * Worker Pool Metrics module
 *
 * Provides metrics collection and observability for WorkerPoolManager.
 * Tracks pool utilization, queue depth, and task completion times.
 * Supports export in Prometheus-compatible format.
 *
 * @module controller/WorkerPoolMetrics
 */

import type {
  WorkerPoolMetricsConfig,
  PoolUtilizationMetrics,
  QueueDepthMetrics,
  TaskCompletionRecord,
  TaskCompletionStats,
  WorkerPoolMetricsSnapshot,
  PrometheusMetric,
  PrometheusHistogram,
  PrometheusHistogramBucket,
  MetricsExportFormat,
  MetricsEventType,
  MetricsEvent,
  MetricsEventCallback,
} from './types.js';
import { DEFAULT_WORKER_POOL_METRICS_CONFIG } from './types.js';

/**
 * Internal mutable completion record for tracking
 */
interface MutableCompletionRecord {
  orderId: string;
  issueId: string;
  workerId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  success: boolean;
}

/**
 * Internal active task tracking
 */
interface ActiveTask {
  orderId: string;
  issueId: string;
  workerId: string;
  startedAt: number;
}

/**
 * Worker Pool Metrics Collector
 *
 * Collects and aggregates metrics from WorkerPoolManager operations.
 * Provides real-time utilization monitoring, queue depth tracking,
 * and task completion time statistics.
 */
export class WorkerPoolMetrics {
  private readonly config: Required<WorkerPoolMetricsConfig>;
  private readonly completionRecords: MutableCompletionRecord[];
  private readonly activeTasks: Map<string, ActiveTask>;
  private readonly workerCompletionCounts: Map<string, number>;
  private eventCallback?: MetricsEventCallback;

  // Counters for metrics
  private totalTasksStarted: number;
  private totalTasksCompleted: number;
  private totalTasksFailed: number;

  // Current pool state (updated via callbacks)
  private currentPoolState: {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    errorWorkers: number;
  };

  // Current queue state
  private currentQueueState: {
    depth: number;
    maxCapacity: number;
    deadLetterCount: number;
    backpressureActive: boolean;
  };

  constructor(config: WorkerPoolMetricsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? DEFAULT_WORKER_POOL_METRICS_CONFIG.enabled,
      maxCompletionRecords:
        config.maxCompletionRecords ?? DEFAULT_WORKER_POOL_METRICS_CONFIG.maxCompletionRecords,
      histogramBuckets:
        config.histogramBuckets ?? DEFAULT_WORKER_POOL_METRICS_CONFIG.histogramBuckets,
      metricsPrefix: config.metricsPrefix ?? DEFAULT_WORKER_POOL_METRICS_CONFIG.metricsPrefix,
    };

    this.completionRecords = [];
    this.activeTasks = new Map();
    this.workerCompletionCounts = new Map();

    this.totalTasksStarted = 0;
    this.totalTasksCompleted = 0;
    this.totalTasksFailed = 0;

    this.currentPoolState = {
      totalWorkers: 0,
      activeWorkers: 0,
      idleWorkers: 0,
      errorWorkers: 0,
    };

    this.currentQueueState = {
      depth: 0,
      maxCapacity: 1000,
      deadLetterCount: 0,
      backpressureActive: false,
    };
  }

  /**
   * Check if metrics collection is enabled
   * @returns true if metrics collection is active per configuration
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set event callback for metrics events
   * @param callback - Handler invoked when metrics events occur (task start/complete, pool changes)
   */
  public onEvent(callback: MetricsEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Emit a metrics event
   * @param type - Category of the metrics event (e.g., task_started, worker_utilized)
   * @param data - Event payload with context-specific metrics details
   */
  private emitEvent(type: MetricsEventType, data: Record<string, unknown>): void {
    if (this.eventCallback !== undefined) {
      const event: MetricsEvent = {
        type,
        timestamp: Date.now(),
        data,
      };
      void this.eventCallback(event);
    }
  }

  // ============================================================================
  // Pool State Updates
  // ============================================================================

  /**
   * Update pool state from WorkerPoolManager
   * @param totalWorkers - Total number of workers registered in the pool
   * @param activeWorkers - Number of workers currently processing tasks
   * @param idleWorkers - Number of workers available for new tasks
   * @param errorWorkers - Number of workers in an error or unhealthy state
   */
  public updatePoolState(
    totalWorkers: number,
    activeWorkers: number,
    idleWorkers: number,
    errorWorkers: number
  ): void {
    if (!this.config.enabled) return;

    const previousActiveWorkers = this.currentPoolState.activeWorkers;
    this.currentPoolState = {
      totalWorkers,
      activeWorkers,
      idleWorkers,
      errorWorkers,
    };

    if (activeWorkers > previousActiveWorkers) {
      this.emitEvent('worker_utilized', { activeWorkers, previousActiveWorkers });
    } else if (activeWorkers < previousActiveWorkers) {
      this.emitEvent('worker_released', { activeWorkers, previousActiveWorkers });
    }
  }

  /**
   * Update queue state
   * @param depth - Current number of tasks waiting in the queue
   * @param maxCapacity - Maximum number of tasks the queue can hold
   * @param deadLetterCount - Number of tasks in the dead letter queue
   * @param backpressureActive - Whether the queue is currently applying backpressure
   */
  public updateQueueState(
    depth: number,
    maxCapacity: number,
    deadLetterCount: number,
    backpressureActive: boolean
  ): void {
    if (!this.config.enabled) return;

    const previousDepth = this.currentQueueState.depth;
    const previousBackpressure = this.currentQueueState.backpressureActive;

    this.currentQueueState = {
      depth,
      maxCapacity,
      deadLetterCount,
      backpressureActive,
    };

    if (depth !== previousDepth) {
      this.emitEvent('queue_depth_changed', { depth, previousDepth });
    }

    if (backpressureActive !== previousBackpressure) {
      this.emitEvent('backpressure_changed', { backpressureActive, previousBackpressure });
    }
  }

  // ============================================================================
  // Task Tracking
  // ============================================================================

  /**
   * Record task start
   * @param orderId - Unique work order identifier for tracking this task execution
   * @param issueId - Issue identifier associated with the task
   * @param workerId - Identifier of the worker that was assigned this task
   */
  public recordTaskStart(orderId: string, issueId: string, workerId: string): void {
    if (!this.config.enabled) return;

    const activeTask: ActiveTask = {
      orderId,
      issueId,
      workerId,
      startedAt: Date.now(),
    };

    this.activeTasks.set(orderId, activeTask);
    this.totalTasksStarted++;

    this.emitEvent('task_started', { orderId, issueId, workerId });
  }

  /**
   * Record task completion
   * @param orderId - Work order identifier of the completed task
   * @param success - Whether the task completed successfully or failed
   */
  public recordTaskCompletion(orderId: string, success: boolean): void {
    if (!this.config.enabled) return;

    const activeTask = this.activeTasks.get(orderId);
    if (activeTask === undefined) {
      // Task was not tracked (started before metrics were enabled)
      return;
    }

    const completedAt = Date.now();
    const durationMs = completedAt - activeTask.startedAt;

    const record: MutableCompletionRecord = {
      orderId: activeTask.orderId,
      issueId: activeTask.issueId,
      workerId: activeTask.workerId,
      startedAt: activeTask.startedAt,
      completedAt,
      durationMs,
      success,
    };

    this.completionRecords.push(record);
    this.activeTasks.delete(orderId);

    // Update worker completion count
    const currentCount = this.workerCompletionCounts.get(activeTask.workerId) ?? 0;
    this.workerCompletionCounts.set(activeTask.workerId, currentCount + 1);

    if (success) {
      this.totalTasksCompleted++;
      this.emitEvent('task_completed', { orderId, durationMs, workerId: activeTask.workerId });
    } else {
      this.totalTasksFailed++;
      this.emitEvent('task_failed', { orderId, durationMs, workerId: activeTask.workerId });
    }

    // Trim records if exceeding limit
    this.trimRecords();
  }

  /**
   * Trim completion records to stay within limit
   */
  private trimRecords(): void {
    while (this.completionRecords.length > this.config.maxCompletionRecords) {
      this.completionRecords.shift();
    }
  }

  // ============================================================================
  // Metrics Retrieval
  // ============================================================================

  /**
   * Get pool utilization metrics
   * @returns Current worker pool state with utilization ratio and worker counts
   */
  public getPoolUtilization(): PoolUtilizationMetrics {
    const { totalWorkers, activeWorkers, idleWorkers, errorWorkers } = this.currentPoolState;
    const utilizationRatio = totalWorkers > 0 ? activeWorkers / totalWorkers : 0;

    return {
      totalWorkers,
      activeWorkers,
      idleWorkers,
      errorWorkers,
      utilizationRatio,
      timestamp: Date.now(),
    };
  }

  /**
   * Get queue depth metrics
   * @returns Current queue depth, capacity, dead letter count, and backpressure state
   */
  public getQueueDepth(): QueueDepthMetrics {
    const { depth, maxCapacity, deadLetterCount, backpressureActive } = this.currentQueueState;
    const utilizationRatio = maxCapacity > 0 ? depth / maxCapacity : 0;

    return {
      currentDepth: depth,
      maxCapacity,
      utilizationRatio,
      deadLetterCount,
      backpressureActive,
      timestamp: Date.now(),
    };
  }

  /**
   * Get task completion statistics
   * @returns Aggregated stats including success rate, average/min/max/percentile durations
   */
  public getCompletionStats(): TaskCompletionStats {
    const records = this.completionRecords;
    const totalCompleted = records.length;

    if (totalCompleted === 0) {
      return {
        totalCompleted: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        averageTimeMs: 0,
        minTimeMs: 0,
        maxTimeMs: 0,
        p50TimeMs: 0,
        p95TimeMs: 0,
        p99TimeMs: 0,
        timestamp: Date.now(),
      };
    }

    const successCount = records.filter((r) => r.success).length;
    const failureCount = totalCompleted - successCount;
    const successRate = successCount / totalCompleted;

    const durations = records.map((r) => r.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const averageTimeMs = sum / totalCompleted;

    const minTimeMs = durations[0] ?? 0;
    const maxTimeMs = durations[durations.length - 1] ?? 0;

    const p50TimeMs = this.percentile(durations, 50);
    const p95TimeMs = this.percentile(durations, 95);
    const p99TimeMs = this.percentile(durations, 99);

    return {
      totalCompleted,
      successCount,
      failureCount,
      successRate,
      averageTimeMs,
      minTimeMs,
      maxTimeMs,
      p50TimeMs,
      p95TimeMs,
      p99TimeMs,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate percentile from sorted array
   * @param sortedArray - Pre-sorted array of numeric values in ascending order
   * @param p - Percentile to compute (0-100, e.g., 50 for median, 95 for p95)
   * @returns Interpolated value at the specified percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    if (sortedArray.length === 1) return sortedArray[0] ?? 0;

    const index = (p / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    const lowerValue = sortedArray[lower] ?? 0;
    const upperValue = sortedArray[upper] ?? 0;

    return lowerValue * (1 - weight) + upperValue * weight;
  }

  /**
   * Get recent completion records
   * @param limit - Maximum number of records to return; omit for all records
   * @returns Immutable array of the most recent task completion records
   */
  public getRecentCompletions(limit?: number): readonly TaskCompletionRecord[] {
    const records = this.completionRecords.map((r) => ({ ...r }));
    if (limit !== undefined && limit > 0) {
      return records.slice(-limit);
    }
    return records;
  }

  /**
   * Get per-worker completion counts
   * @returns Map of worker IDs to the total number of tasks each has completed
   */
  public getWorkerCompletions(): ReadonlyMap<string, number> {
    return new Map(this.workerCompletionCounts);
  }

  /**
   * Get complete metrics snapshot
   * @returns Full point-in-time snapshot of all pool, queue, and completion metrics
   */
  public getSnapshot(): WorkerPoolMetricsSnapshot {
    return {
      utilization: this.getPoolUtilization(),
      queueDepth: this.getQueueDepth(),
      completionStats: this.getCompletionStats(),
      recentCompletions: this.getRecentCompletions(100),
      workerCompletions: this.getWorkerCompletions(),
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // Prometheus Export
  // ============================================================================

  /**
   * Generate Prometheus-compatible metrics
   * @returns Array of gauge and counter metrics for pool utilization, queue depth, and task stats
   */
  public toPrometheusMetrics(): readonly PrometheusMetric[] {
    const prefix = this.config.metricsPrefix;
    const metrics: PrometheusMetric[] = [];
    const utilization = this.getPoolUtilization();
    const queueDepth = this.getQueueDepth();
    const completionStats = this.getCompletionStats();

    // Pool utilization metrics
    metrics.push({
      name: `${prefix}_workers_total`,
      type: 'gauge',
      help: 'Total number of workers in the pool',
      value: utilization.totalWorkers,
    });

    metrics.push({
      name: `${prefix}_workers_active`,
      type: 'gauge',
      help: 'Number of workers currently processing tasks',
      value: utilization.activeWorkers,
    });

    metrics.push({
      name: `${prefix}_workers_idle`,
      type: 'gauge',
      help: 'Number of idle workers',
      value: utilization.idleWorkers,
    });

    metrics.push({
      name: `${prefix}_workers_error`,
      type: 'gauge',
      help: 'Number of workers in error state',
      value: utilization.errorWorkers,
    });

    metrics.push({
      name: `${prefix}_utilization_ratio`,
      type: 'gauge',
      help: 'Pool utilization ratio (0-1)',
      value: utilization.utilizationRatio,
    });

    // Queue depth metrics
    metrics.push({
      name: `${prefix}_queue_depth`,
      type: 'gauge',
      help: 'Current queue depth',
      value: queueDepth.currentDepth,
    });

    metrics.push({
      name: `${prefix}_queue_max_capacity`,
      type: 'gauge',
      help: 'Maximum queue capacity',
      value: queueDepth.maxCapacity,
    });

    metrics.push({
      name: `${prefix}_queue_utilization_ratio`,
      type: 'gauge',
      help: 'Queue utilization ratio (0-1)',
      value: queueDepth.utilizationRatio,
    });

    metrics.push({
      name: `${prefix}_dead_letter_queue_size`,
      type: 'gauge',
      help: 'Number of items in dead letter queue',
      value: queueDepth.deadLetterCount,
    });

    metrics.push({
      name: `${prefix}_backpressure_active`,
      type: 'gauge',
      help: 'Whether backpressure is currently active (1 or 0)',
      value: queueDepth.backpressureActive ? 1 : 0,
    });

    // Task completion metrics (counters)
    metrics.push({
      name: `${prefix}_tasks_started_total`,
      type: 'counter',
      help: 'Total number of tasks started',
      value: this.totalTasksStarted,
    });

    metrics.push({
      name: `${prefix}_tasks_completed_total`,
      type: 'counter',
      help: 'Total number of tasks completed successfully',
      value: this.totalTasksCompleted,
    });

    metrics.push({
      name: `${prefix}_tasks_failed_total`,
      type: 'counter',
      help: 'Total number of tasks failed',
      value: this.totalTasksFailed,
    });

    // Task completion time statistics
    metrics.push({
      name: `${prefix}_task_duration_average_ms`,
      type: 'gauge',
      help: 'Average task completion time in milliseconds',
      value: completionStats.averageTimeMs,
    });

    metrics.push({
      name: `${prefix}_task_duration_min_ms`,
      type: 'gauge',
      help: 'Minimum task completion time in milliseconds',
      value: completionStats.minTimeMs,
    });

    metrics.push({
      name: `${prefix}_task_duration_max_ms`,
      type: 'gauge',
      help: 'Maximum task completion time in milliseconds',
      value: completionStats.maxTimeMs,
    });

    metrics.push({
      name: `${prefix}_task_duration_p50_ms`,
      type: 'gauge',
      help: 'Median (p50) task completion time in milliseconds',
      value: completionStats.p50TimeMs,
    });

    metrics.push({
      name: `${prefix}_task_duration_p95_ms`,
      type: 'gauge',
      help: '95th percentile task completion time in milliseconds',
      value: completionStats.p95TimeMs,
    });

    metrics.push({
      name: `${prefix}_task_duration_p99_ms`,
      type: 'gauge',
      help: '99th percentile task completion time in milliseconds',
      value: completionStats.p99TimeMs,
    });

    // Success rate
    metrics.push({
      name: `${prefix}_task_success_rate`,
      type: 'gauge',
      help: 'Task success rate (0-1)',
      value: completionStats.successRate,
    });

    return metrics;
  }

  /**
   * Generate Prometheus histogram for task duration
   * @returns Histogram with configured buckets, sum, and count for task duration distribution
   */
  public toPrometheusHistogram(): PrometheusHistogram {
    const prefix = this.config.metricsPrefix;
    const durations = this.completionRecords.map((r) => r.durationMs);
    const buckets = this.config.histogramBuckets;

    const histogramBuckets: PrometheusHistogramBucket[] = [];
    let sum = 0;
    const count = durations.length;

    for (const le of buckets) {
      const bucketCount = durations.filter((d) => d <= le).length;
      histogramBuckets.push({ le, count: bucketCount });
    }

    // Add +Inf bucket
    histogramBuckets.push({ le: Infinity, count });

    for (const d of durations) {
      sum += d;
    }

    return {
      name: `${prefix}_task_duration_ms`,
      help: 'Task duration in milliseconds',
      buckets: histogramBuckets,
      sum,
      count,
    };
  }

  /**
   * Export metrics in Prometheus text format
   * @returns Prometheus exposition format string with HELP, TYPE, and metric lines
   */
  public exportPrometheus(): string {
    const metrics = this.toPrometheusMetrics();
    const histogram = this.toPrometheusHistogram();
    const lines: string[] = [];

    // Export standard metrics
    for (const metric of metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.labels !== undefined && Object.keys(metric.labels).length > 0) {
        const labelStr = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        lines.push(`${metric.name}{${labelStr}} ${String(metric.value)}`);
      } else {
        lines.push(`${metric.name} ${String(metric.value)}`);
      }
    }

    // Export histogram
    lines.push(`# HELP ${histogram.name} ${histogram.help}`);
    lines.push(`# TYPE ${histogram.name} histogram`);

    for (const bucket of histogram.buckets) {
      const leStr = bucket.le === Infinity ? '+Inf' : String(bucket.le);
      lines.push(`${histogram.name}_bucket{le="${leStr}"} ${String(bucket.count)}`);
    }

    lines.push(`${histogram.name}_sum ${String(histogram.sum)}`);
    lines.push(`${histogram.name}_count ${String(histogram.count)}`);

    return lines.join('\n');
  }

  /**
   * Export metrics in specified format
   * @param format - Output format: 'prometheus', 'openmetrics', or 'json'
   * @returns Serialized metrics string in the requested format
   */
  public export(format: MetricsExportFormat): string {
    switch (format) {
      case 'prometheus':
      case 'openmetrics':
        return this.exportPrometheus();
      case 'json':
        return JSON.stringify(this.getSnapshot(), null, 2);
      default:
        return this.exportPrometheus();
    }
  }

  // ============================================================================
  // Reset and Cleanup
  // ============================================================================

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.completionRecords.length = 0;
    this.activeTasks.clear();
    this.workerCompletionCounts.clear();
    this.totalTasksStarted = 0;
    this.totalTasksCompleted = 0;
    this.totalTasksFailed = 0;
  }

  /**
   * Get the number of active (in-progress) tasks
   * @returns Count of tasks that have started but not yet completed
   */
  public getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Get active tasks
   * @returns Immutable array of all currently in-progress task records
   */
  public getActiveTasks(): readonly ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }
}
