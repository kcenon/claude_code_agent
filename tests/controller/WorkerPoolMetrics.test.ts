import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkerPoolMetrics,
  DEFAULT_WORKER_POOL_METRICS_CONFIG,
} from '../../src/controller/index.js';
import type {
  MetricsEvent,
  MetricsEventCallback,
} from '../../src/controller/index.js';

describe('WorkerPoolMetrics', () => {
  let metrics: WorkerPoolMetrics;

  beforeEach(() => {
    metrics = new WorkerPoolMetrics();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      expect(metrics.isEnabled()).toBe(true);
    });

    it('should respect disabled configuration', () => {
      const disabledMetrics = new WorkerPoolMetrics({ enabled: false });
      expect(disabledMetrics.isEnabled()).toBe(false);
    });

    it('should use custom configuration', () => {
      const customMetrics = new WorkerPoolMetrics({
        maxCompletionRecords: 500,
        metricsPrefix: 'custom_pool',
      });
      expect(customMetrics.isEnabled()).toBe(true);
    });
  });

  describe('pool state updates', () => {
    it('should update pool state', () => {
      metrics.updatePoolState(5, 3, 2, 0);

      const utilization = metrics.getPoolUtilization();
      expect(utilization.totalWorkers).toBe(5);
      expect(utilization.activeWorkers).toBe(3);
      expect(utilization.idleWorkers).toBe(2);
      expect(utilization.errorWorkers).toBe(0);
      expect(utilization.utilizationRatio).toBeCloseTo(0.6);
    });

    it('should handle zero workers', () => {
      metrics.updatePoolState(0, 0, 0, 0);

      const utilization = metrics.getPoolUtilization();
      expect(utilization.utilizationRatio).toBe(0);
    });

    it('should emit worker_utilized event when active workers increase', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.updatePoolState(5, 0, 5, 0);
      metrics.updatePoolState(5, 2, 3, 0);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'worker_utilized',
          data: expect.objectContaining({ activeWorkers: 2, previousActiveWorkers: 0 }),
        })
      );
    });

    it('should emit worker_released event when active workers decrease', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.updatePoolState(5, 3, 2, 0);
      metrics.updatePoolState(5, 1, 4, 0);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'worker_released',
          data: expect.objectContaining({ activeWorkers: 1, previousActiveWorkers: 3 }),
        })
      );
    });
  });

  describe('queue state updates', () => {
    it('should update queue state', () => {
      metrics.updateQueueState(50, 1000, 5, false);

      const queueDepth = metrics.getQueueDepth();
      expect(queueDepth.currentDepth).toBe(50);
      expect(queueDepth.maxCapacity).toBe(1000);
      expect(queueDepth.deadLetterCount).toBe(5);
      expect(queueDepth.backpressureActive).toBe(false);
      expect(queueDepth.utilizationRatio).toBeCloseTo(0.05);
    });

    it('should emit queue_depth_changed event', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.updateQueueState(10, 1000, 0, false);
      metrics.updateQueueState(20, 1000, 0, false);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'queue_depth_changed',
          data: expect.objectContaining({ depth: 20, previousDepth: 10 }),
        })
      );
    });

    it('should emit backpressure_changed event', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.updateQueueState(800, 1000, 0, false);
      metrics.updateQueueState(900, 1000, 0, true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'backpressure_changed',
          data: expect.objectContaining({ backpressureActive: true, previousBackpressure: false }),
        })
      );
    });
  });

  describe('task tracking', () => {
    it('should record task start', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');

      expect(metrics.getActiveTaskCount()).toBe(1);
    });

    it('should record task completion', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      expect(metrics.getActiveTaskCount()).toBe(0);

      const stats = metrics.getCompletionStats();
      expect(stats.totalCompleted).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(0);
    });

    it('should record task failure', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', false);

      const stats = metrics.getCompletionStats();
      expect(stats.totalCompleted).toBe(1);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    it('should calculate success rate correctly', () => {
      // Complete 3 tasks: 2 success, 1 failure
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      metrics.recordTaskStart('WO-002', 'ISS-002', 'worker-1');
      metrics.recordTaskCompletion('WO-002', true);

      metrics.recordTaskStart('WO-003', 'ISS-003', 'worker-1');
      metrics.recordTaskCompletion('WO-003', false);

      const stats = metrics.getCompletionStats();
      expect(stats.successRate).toBeCloseTo(0.6667, 2);
    });

    it('should emit task_started event', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_started',
          data: expect.objectContaining({ orderId: 'WO-001', issueId: 'ISS-001', workerId: 'worker-1' }),
        })
      );
    });

    it('should emit task_completed event', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_completed',
          data: expect.objectContaining({ orderId: 'WO-001', workerId: 'worker-1' }),
        })
      );
    });

    it('should emit task_failed event', () => {
      const callback = vi.fn();
      metrics.onEvent(callback);

      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', false);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task_failed',
          data: expect.objectContaining({ orderId: 'WO-001', workerId: 'worker-1' }),
        })
      );
    });

    it('should ignore completion for untracked tasks', () => {
      metrics.recordTaskCompletion('WO-UNKNOWN', true);

      const stats = metrics.getCompletionStats();
      expect(stats.totalCompleted).toBe(0);
    });

    it('should not record when disabled', () => {
      const disabledMetrics = new WorkerPoolMetrics({ enabled: false });
      disabledMetrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      disabledMetrics.recordTaskCompletion('WO-001', true);

      expect(disabledMetrics.getActiveTaskCount()).toBe(0);
      expect(disabledMetrics.getCompletionStats().totalCompleted).toBe(0);
    });
  });

  describe('completion statistics', () => {
    beforeEach(() => {
      // Create tasks with varying durations using mock time
      vi.useFakeTimers();

      // Task 1: 100ms
      vi.setSystemTime(0);
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      vi.setSystemTime(100);
      metrics.recordTaskCompletion('WO-001', true);

      // Task 2: 500ms
      vi.setSystemTime(1000);
      metrics.recordTaskStart('WO-002', 'ISS-002', 'worker-1');
      vi.setSystemTime(1500);
      metrics.recordTaskCompletion('WO-002', true);

      // Task 3: 1000ms
      vi.setSystemTime(2000);
      metrics.recordTaskStart('WO-003', 'ISS-003', 'worker-1');
      vi.setSystemTime(3000);
      metrics.recordTaskCompletion('WO-003', true);

      vi.useRealTimers();
    });

    it('should calculate average time correctly', () => {
      const stats = metrics.getCompletionStats();
      expect(stats.averageTimeMs).toBeCloseTo(533.33, 0);
    });

    it('should calculate min time correctly', () => {
      const stats = metrics.getCompletionStats();
      expect(stats.minTimeMs).toBe(100);
    });

    it('should calculate max time correctly', () => {
      const stats = metrics.getCompletionStats();
      expect(stats.maxTimeMs).toBe(1000);
    });

    it('should calculate p50 (median) correctly', () => {
      const stats = metrics.getCompletionStats();
      expect(stats.p50TimeMs).toBe(500);
    });
  });

  describe('recent completions', () => {
    it('should return recent completion records', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      const records = metrics.getRecentCompletions();
      expect(records.length).toBe(1);
      expect(records[0]?.orderId).toBe('WO-001');
      expect(records[0]?.issueId).toBe('ISS-001');
      expect(records[0]?.workerId).toBe('worker-1');
      expect(records[0]?.success).toBe(true);
    });

    it('should limit returned records', () => {
      for (let i = 1; i <= 10; i++) {
        metrics.recordTaskStart(`WO-${i}`, `ISS-${i}`, 'worker-1');
        metrics.recordTaskCompletion(`WO-${i}`, true);
      }

      const records = metrics.getRecentCompletions(5);
      expect(records.length).toBe(5);
    });

    it('should trim records when exceeding limit', () => {
      const limitedMetrics = new WorkerPoolMetrics({ maxCompletionRecords: 5 });

      for (let i = 1; i <= 10; i++) {
        limitedMetrics.recordTaskStart(`WO-${i}`, `ISS-${i}`, 'worker-1');
        limitedMetrics.recordTaskCompletion(`WO-${i}`, true);
      }

      const records = limitedMetrics.getRecentCompletions();
      expect(records.length).toBe(5);
      // Should keep the most recent records
      expect(records[0]?.orderId).toBe('WO-6');
    });
  });

  describe('worker completions', () => {
    it('should track per-worker completion counts', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      metrics.recordTaskStart('WO-002', 'ISS-002', 'worker-1');
      metrics.recordTaskCompletion('WO-002', true);

      metrics.recordTaskStart('WO-003', 'ISS-003', 'worker-2');
      metrics.recordTaskCompletion('WO-003', true);

      const workerCompletions = metrics.getWorkerCompletions();
      expect(workerCompletions.get('worker-1')).toBe(2);
      expect(workerCompletions.get('worker-2')).toBe(1);
    });
  });

  describe('snapshot', () => {
    it('should return complete metrics snapshot', () => {
      metrics.updatePoolState(5, 2, 3, 0);
      metrics.updateQueueState(10, 1000, 0, false);
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      const snapshot = metrics.getSnapshot();

      expect(snapshot.utilization.totalWorkers).toBe(5);
      expect(snapshot.queueDepth.currentDepth).toBe(10);
      expect(snapshot.completionStats.totalCompleted).toBe(1);
      expect(snapshot.recentCompletions.length).toBe(1);
      expect(snapshot.workerCompletions.get('worker-1')).toBe(1);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Prometheus export', () => {
    beforeEach(() => {
      metrics.updatePoolState(5, 2, 3, 0);
      metrics.updateQueueState(10, 1000, 1, false);
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);
    });

    it('should generate Prometheus metrics', () => {
      const prometheusMetrics = metrics.toPrometheusMetrics();

      expect(prometheusMetrics.length).toBeGreaterThan(0);

      const workersTotal = prometheusMetrics.find((m) => m.name === 'worker_pool_workers_total');
      expect(workersTotal).toBeDefined();
      expect(workersTotal?.value).toBe(5);
      expect(workersTotal?.type).toBe('gauge');
    });

    it('should include all expected metrics', () => {
      const prometheusMetrics = metrics.toPrometheusMetrics();
      const metricNames = prometheusMetrics.map((m) => m.name);

      expect(metricNames).toContain('worker_pool_workers_total');
      expect(metricNames).toContain('worker_pool_workers_active');
      expect(metricNames).toContain('worker_pool_workers_idle');
      expect(metricNames).toContain('worker_pool_workers_error');
      expect(metricNames).toContain('worker_pool_utilization_ratio');
      expect(metricNames).toContain('worker_pool_queue_depth');
      expect(metricNames).toContain('worker_pool_queue_max_capacity');
      expect(metricNames).toContain('worker_pool_dead_letter_queue_size');
      expect(metricNames).toContain('worker_pool_backpressure_active');
      expect(metricNames).toContain('worker_pool_tasks_started_total');
      expect(metricNames).toContain('worker_pool_tasks_completed_total');
      expect(metricNames).toContain('worker_pool_tasks_failed_total');
      expect(metricNames).toContain('worker_pool_task_success_rate');
    });

    it('should generate Prometheus histogram', () => {
      const histogram = metrics.toPrometheusHistogram();

      expect(histogram.name).toBe('worker_pool_task_duration_ms');
      expect(histogram.buckets.length).toBeGreaterThan(0);
      expect(histogram.count).toBe(1);
      expect(histogram.sum).toBeGreaterThanOrEqual(0);
    });

    it('should export in Prometheus text format', () => {
      const exported = metrics.exportPrometheus();

      expect(exported).toContain('# HELP worker_pool_workers_total');
      expect(exported).toContain('# TYPE worker_pool_workers_total gauge');
      expect(exported).toContain('worker_pool_workers_total 5');
      expect(exported).toContain('worker_pool_task_duration_ms_bucket');
      expect(exported).toContain('worker_pool_task_duration_ms_sum');
      expect(exported).toContain('worker_pool_task_duration_ms_count');
    });

    it('should use custom metrics prefix', () => {
      const customMetrics = new WorkerPoolMetrics({ metricsPrefix: 'my_app' });
      customMetrics.updatePoolState(3, 1, 2, 0);

      const prometheusMetrics = customMetrics.toPrometheusMetrics();
      const workersTotal = prometheusMetrics.find((m) => m.name === 'my_app_workers_total');

      expect(workersTotal).toBeDefined();
    });
  });

  describe('export formats', () => {
    beforeEach(() => {
      metrics.updatePoolState(5, 2, 3, 0);
    });

    it('should export in Prometheus format', () => {
      const exported = metrics.export('prometheus');

      expect(exported).toContain('# HELP');
      expect(exported).toContain('# TYPE');
    });

    it('should export in OpenMetrics format', () => {
      const exported = metrics.export('openmetrics');

      // OpenMetrics is similar to Prometheus format
      expect(exported).toContain('# HELP');
    });

    it('should export in JSON format', () => {
      const exported = metrics.export('json');
      const parsed = JSON.parse(exported);

      expect(parsed.utilization.totalWorkers).toBe(5);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskCompletion('WO-001', true);

      metrics.reset();

      expect(metrics.getActiveTaskCount()).toBe(0);
      expect(metrics.getCompletionStats().totalCompleted).toBe(0);
      expect(metrics.getWorkerCompletions().size).toBe(0);
    });
  });

  describe('active tasks', () => {
    it('should return active tasks', () => {
      metrics.recordTaskStart('WO-001', 'ISS-001', 'worker-1');
      metrics.recordTaskStart('WO-002', 'ISS-002', 'worker-2');

      const activeTasks = metrics.getActiveTasks();

      expect(activeTasks.length).toBe(2);
      expect(activeTasks.map((t) => t.orderId)).toContain('WO-001');
      expect(activeTasks.map((t) => t.orderId)).toContain('WO-002');
    });
  });
});
