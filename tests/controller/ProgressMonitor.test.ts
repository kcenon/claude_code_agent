import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ProgressMonitor,
  ProgressMonitorAlreadyRunningError,
  ProgressMonitorNotRunningError,
  DEFAULT_PROGRESS_MONITOR_CONFIG,
} from '../../src/controller/index.js';
import type {
  WorkerPoolStatus,
  WorkerInfo,
  WorkQueueEntry,
  ProgressEvent,
} from '../../src/controller/index.js';

describe('ProgressMonitor', () => {
  let monitor: ProgressMonitor;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `progress-monitor-test-${Date.now()}`);
    monitor = new ProgressMonitor('test-session', {
      pollingInterval: 100, // Fast polling for tests
      stuckWorkerThreshold: 5000, // 5 seconds for tests
      maxRecentActivities: 10,
      reportPath: testDir,
      enableNotifications: true,
    });
  });

  afterEach(async () => {
    if (monitor.isActive()) {
      monitor.stop();
    }
    // Small delay to allow async file operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      if (existsSync(testDir)) {
        await rm(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      }
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  const createWorkerPoolStatus = (
    workers: Partial<WorkerInfo>[] = [],
    overrides: Partial<WorkerPoolStatus> = {}
  ): WorkerPoolStatus => {
    const workerList: WorkerInfo[] = workers.map((w, i) => ({
      id: w.id ?? `worker-${i + 1}`,
      status: w.status ?? 'idle',
      currentIssue: w.currentIssue ?? null,
      startedAt: w.startedAt ?? null,
      completedTasks: w.completedTasks ?? 0,
      ...(w.lastError !== undefined && { lastError: w.lastError }),
    }));

    const idleCount = workerList.filter((w) => w.status === 'idle').length;
    const workingCount = workerList.filter((w) => w.status === 'working').length;
    const errorCount = workerList.filter((w) => w.status === 'error').length;

    return {
      totalWorkers: overrides.totalWorkers ?? workerList.length,
      idleWorkers: overrides.idleWorkers ?? idleCount,
      workingWorkers: overrides.workingWorkers ?? workingCount,
      errorWorkers: overrides.errorWorkers ?? errorCount,
      workers: workerList,
      activeWorkOrders: overrides.activeWorkOrders ?? [],
    };
  };

  const createWorkQueue = (
    issueIds: string[] = [],
    priorityScore = 50
  ): readonly WorkQueueEntry[] => {
    return issueIds.map((issueId) => ({
      issueId,
      priorityScore,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    }));
  };

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultMonitor = new ProgressMonitor('default-session');
      expect(defaultMonitor.isActive()).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      expect(monitor.isActive()).toBe(false);
      expect(monitor.getCompletedCount()).toBe(0);
      expect(monitor.getFailedCount()).toBe(0);
    });

    it('should not be active initially', () => {
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('start and stop', () => {
    it('should start monitoring', () => {
      const getStatus = () => createWorkerPoolStatus();
      const getQueue = () => createWorkQueue();

      monitor.start(getStatus, getQueue);
      expect(monitor.isActive()).toBe(true);
    });

    it('should stop monitoring', () => {
      const getStatus = () => createWorkerPoolStatus();
      const getQueue = () => createWorkQueue();

      monitor.start(getStatus, getQueue);
      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });

    it('should throw error when starting already running monitor', () => {
      const getStatus = () => createWorkerPoolStatus();
      const getQueue = () => createWorkQueue();

      monitor.start(getStatus, getQueue);

      expect(() => {
        monitor.start(getStatus, getQueue);
      }).toThrow(ProgressMonitorAlreadyRunningError);
    });

    it('should throw error when stopping non-running monitor', () => {
      expect(() => {
        monitor.stop();
      }).toThrow(ProgressMonitorNotRunningError);
    });
  });

  describe('activity recording', () => {
    it('should record completion successfully', () => {
      const startedAt = new Date(Date.now() - 5000);
      monitor.recordCompletion('ISS-001', startedAt, true);

      expect(monitor.getCompletedCount()).toBe(1);
      expect(monitor.getFailedCount()).toBe(0);

      const activities = monitor.getRecentActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('completed');
      expect(activities[0].issueId).toBe('ISS-001');
    });

    it('should record failure correctly', () => {
      const startedAt = new Date(Date.now() - 5000);
      monitor.recordCompletion('ISS-002', startedAt, false);

      expect(monitor.getCompletedCount()).toBe(0);
      expect(monitor.getFailedCount()).toBe(1);

      const activities = monitor.getRecentActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('failed');
    });

    it('should record task start', () => {
      monitor.recordStart('ISS-003', 'worker-1');

      const activities = monitor.getRecentActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('started');
      expect(activities[0].workerId).toBe('worker-1');
    });

    it('should record blocked task', () => {
      monitor.recordBlocked('ISS-004', 'Dependency not resolved');

      const activities = monitor.getRecentActivities();
      expect(activities).toHaveLength(1);
      expect(activities[0].type).toBe('blocked');
      expect(activities[0].details).toBe('Dependency not resolved');
    });

    it('should limit recent activities to max size', () => {
      for (let i = 0; i < 15; i++) {
        monitor.recordStart(`ISS-${i}`, 'worker-1');
      }

      const activities = monitor.getRecentActivities();
      expect(activities.length).toBeLessThanOrEqual(10);
    });
  });

  describe('metrics calculation', () => {
    it('should calculate metrics correctly', () => {
      monitor.setTotalIssues(10);

      // Record 3 completions
      for (let i = 0; i < 3; i++) {
        monitor.recordCompletion(`ISS-${i}`, new Date(Date.now() - 1000), true);
      }

      const workerStatus = createWorkerPoolStatus([
        { id: 'worker-1', status: 'working', currentIssue: 'ISS-003' },
        { id: 'worker-2', status: 'idle' },
      ]);

      const queue = createWorkQueue(['ISS-004', 'ISS-005']);

      const metrics = monitor.calculateMetrics(workerStatus, queue);

      expect(metrics.totalIssues).toBe(10);
      expect(metrics.completed).toBe(3);
      expect(metrics.inProgress).toBe(1);
      expect(metrics.pending).toBe(2);
      expect(metrics.percentage).toBe(30);
    });

    it('should calculate percentage correctly', () => {
      monitor.setTotalIssues(4);
      monitor.recordCompletion('ISS-001', new Date(), true);
      monitor.recordCompletion('ISS-002', new Date(), true);

      const workerStatus = createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const queue = createWorkQueue([]);

      const metrics = monitor.calculateMetrics(workerStatus, queue);

      expect(metrics.percentage).toBe(50);
    });

    it('should estimate ETA based on completion history', () => {
      monitor.setTotalIssues(10);

      // Simulate 5 completions with 1 second each
      for (let i = 0; i < 5; i++) {
        monitor.recordCompletion(`ISS-${i}`, new Date(Date.now() - 1000), true);
      }

      const workerStatus = createWorkerPoolStatus([
        { id: 'worker-1', status: 'working' },
        { id: 'worker-2', status: 'working' },
      ]);

      const queue = createWorkQueue(['ISS-5', 'ISS-6', 'ISS-7']);

      const metrics = monitor.calculateMetrics(workerStatus, queue);

      expect(metrics.eta).not.toBeNull();
      expect(metrics.averageCompletionTime).toBeGreaterThan(0);
    });

    it('should return null ETA when no history', () => {
      const workerStatus = createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const queue = createWorkQueue([]);

      const metrics = monitor.calculateMetrics(workerStatus, queue);

      expect(metrics.eta).toBeNull();
    });
  });

  describe('bottleneck detection', () => {
    it('should detect stuck worker', () => {
      // Worker started more than threshold ago
      const stuckTime = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago

      const workerStatus = createWorkerPoolStatus([
        {
          id: 'worker-1',
          status: 'working',
          currentIssue: 'ISS-001',
          startedAt: stuckTime,
        },
      ]);

      const queue = createWorkQueue([]);

      const bottlenecks = monitor.detectBottlenecks(workerStatus, queue);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some((b) => b.type === 'stuck_worker')).toBe(true);
    });

    it('should detect blocked chain when idle workers with pending queue', () => {
      const workerStatus = createWorkerPoolStatus(
        [
          { id: 'worker-1', status: 'idle' },
          { id: 'worker-2', status: 'idle' },
        ],
        { idleWorkers: 2, workingWorkers: 0 }
      );

      const queue = createWorkQueue(['ISS-001', 'ISS-002', 'ISS-003']);

      const bottlenecks = monitor.detectBottlenecks(workerStatus, queue);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some((b) => b.type === 'blocked_chain')).toBe(true);
    });

    it('should detect resource contention when all workers busy with large queue', () => {
      const workerStatus = createWorkerPoolStatus(
        [
          { id: 'worker-1', status: 'working', currentIssue: 'ISS-001' },
          { id: 'worker-2', status: 'working', currentIssue: 'ISS-002' },
        ],
        { totalWorkers: 2, idleWorkers: 0, workingWorkers: 2 }
      );

      // Queue larger than 2x workers
      const queue = createWorkQueue(['ISS-003', 'ISS-004', 'ISS-005', 'ISS-006', 'ISS-007']);

      const bottlenecks = monitor.detectBottlenecks(workerStatus, queue);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some((b) => b.type === 'resource_contention')).toBe(true);
    });

    it('should detect error workers', () => {
      const workerStatus = createWorkerPoolStatus(
        [
          { id: 'worker-1', status: 'error', lastError: 'Connection timeout' },
        ],
        { errorWorkers: 1 }
      );

      const queue = createWorkQueue([]);

      const bottlenecks = monitor.detectBottlenecks(workerStatus, queue);

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].description).toContain('error state');
    });

    it('should not detect bottlenecks when all is well', () => {
      const workerStatus = createWorkerPoolStatus(
        [
          { id: 'worker-1', status: 'working', currentIssue: 'ISS-001', startedAt: new Date().toISOString() },
          { id: 'worker-2', status: 'idle' },
        ],
        { idleWorkers: 1, workingWorkers: 1 }
      );

      const queue = createWorkQueue(['ISS-002']);

      const bottlenecks = monitor.detectBottlenecks(workerStatus, queue);

      expect(bottlenecks.length).toBe(0);
    });

    it('should clear resolved bottlenecks', () => {
      // First detect a blocked chain
      const blockedStatus = createWorkerPoolStatus(
        [{ id: 'worker-1', status: 'idle' }],
        { idleWorkers: 1, workingWorkers: 0 }
      );
      const pendingQueue = createWorkQueue(['ISS-001']);

      monitor.detectBottlenecks(blockedStatus, pendingQueue);
      expect(monitor.getBottlenecks().length).toBeGreaterThan(0);

      // Then resolve it
      const workingStatus = createWorkerPoolStatus(
        [{ id: 'worker-1', status: 'working', currentIssue: 'ISS-001' }],
        { idleWorkers: 0, workingWorkers: 1 }
      );
      const emptyQueue = createWorkQueue([]);

      monitor.detectBottlenecks(workingStatus, emptyQueue);
      expect(monitor.getBottlenecks().some((b) => b.type === 'blocked_chain')).toBe(false);
    });
  });

  describe('report generation', () => {
    it('should generate a progress report', () => {
      monitor.setTotalIssues(5);
      monitor.recordCompletion('ISS-001', new Date(), true);

      const workerStatus = createWorkerPoolStatus([
        { id: 'worker-1', status: 'working', currentIssue: 'ISS-002' },
      ]);

      const metrics = monitor.calculateMetrics(workerStatus, createWorkQueue(['ISS-003']));
      const bottlenecks = monitor.detectBottlenecks(workerStatus, createWorkQueue(['ISS-003']));

      const report = monitor.generateReport(metrics, workerStatus, bottlenecks);

      expect(report.sessionId).toBe('test-session');
      expect(report.generatedAt).toBeDefined();
      expect(report.metrics).toEqual(metrics);
      expect(report.workers).toHaveLength(1);
    });

    it('should generate markdown report', () => {
      monitor.setTotalIssues(5);
      monitor.recordCompletion('ISS-001', new Date(), true);
      monitor.recordStart('ISS-002', 'worker-1');

      const workerStatus = createWorkerPoolStatus([
        { id: 'worker-1', status: 'working', currentIssue: 'ISS-002', startedAt: new Date().toISOString() },
      ]);

      const metrics = monitor.calculateMetrics(workerStatus, createWorkQueue(['ISS-003']));
      const bottlenecks = monitor.detectBottlenecks(workerStatus, createWorkQueue(['ISS-003']));
      const report = monitor.generateReport(metrics, workerStatus, bottlenecks);

      const markdown = monitor.generateMarkdownReport(report);

      expect(markdown).toContain('# Progress Report');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Workers');
      expect(markdown).toContain('## Bottlenecks');
      expect(markdown).toContain('## Recent Activity');
      expect(markdown).toContain('test-session');
    });
  });

  describe('report persistence', () => {
    it('should save report to disk', async () => {
      monitor.setTotalIssues(5);
      monitor.recordCompletion('ISS-001', new Date(), true);

      const workerStatus = createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const metrics = monitor.calculateMetrics(workerStatus, createWorkQueue([]));
      const report = monitor.generateReport(metrics, workerStatus, []);

      await monitor.saveReport(report);

      expect(existsSync(join(testDir, 'progress_report.json'))).toBe(true);
      expect(existsSync(join(testDir, 'progress_report.md'))).toBe(true);
    });

    it('should load saved report', async () => {
      monitor.setTotalIssues(5);
      monitor.recordCompletion('ISS-001', new Date(), true);

      const workerStatus = createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const metrics = monitor.calculateMetrics(workerStatus, createWorkQueue([]));
      const report = monitor.generateReport(metrics, workerStatus, []);

      await monitor.saveReport(report);

      const loadedReport = await monitor.loadReport();

      expect(loadedReport).not.toBeNull();
      expect(loadedReport?.sessionId).toBe('test-session');
      expect(loadedReport?.metrics.completed).toBe(1);
    });

    it('should return null when no saved report exists', async () => {
      const report = await monitor.loadReport();
      expect(report).toBeNull();
    });
  });

  describe('event notifications', () => {
    it('should emit progress_updated events', async () => {
      const events: ProgressEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });

      const getStatus = () => createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const getQueue = () => createWorkQueue([]);

      monitor.start(getStatus, getQueue);

      // Wait for polling
      await new Promise((resolve) => setTimeout(resolve, 150));

      monitor.stop();

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'progress_updated')).toBe(true);
    });

    it('should emit bottleneck_detected events', async () => {
      const events: ProgressEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });

      const workerStatus = createWorkerPoolStatus(
        [{ id: 'worker-1', status: 'idle' }],
        { idleWorkers: 1, workingWorkers: 0 }
      );
      const pendingQueue = createWorkQueue(['ISS-001']);

      monitor.detectBottlenecks(workerStatus, pendingQueue);

      // Wait for async event processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events.some((e) => e.type === 'bottleneck_detected')).toBe(true);
    });

    it('should handle listener errors gracefully', async () => {
      monitor.onEvent(() => {
        throw new Error('Listener error');
      });

      const getStatus = () => createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const getQueue = () => createWorkQueue([]);

      // Should not throw
      monitor.start(getStatus, getQueue);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stop();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      monitor.setTotalIssues(10);
      monitor.recordCompletion('ISS-001', new Date(), true);
      monitor.recordStart('ISS-002', 'worker-1');

      const getStatus = () => createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const getQueue = () => createWorkQueue([]);

      monitor.start(getStatus, getQueue);
      monitor.reset();

      expect(monitor.isActive()).toBe(false);
      expect(monitor.getCompletedCount()).toBe(0);
      expect(monitor.getFailedCount()).toBe(0);
      expect(monitor.getRecentActivities()).toHaveLength(0);
      expect(monitor.getBottlenecks()).toHaveLength(0);
    });

    it('should stop monitoring if active', () => {
      const getStatus = () => createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
      const getQueue = () => createWorkQueue([]);

      monitor.start(getStatus, getQueue);
      expect(monitor.isActive()).toBe(true);

      monitor.reset();
      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('worker state change detection', () => {
    it('should detect when worker starts working', async () => {
      const activities: string[] = [];
      const originalRecordStart = monitor.recordStart.bind(monitor);
      vi.spyOn(monitor, 'recordStart').mockImplementation((issueId, workerId) => {
        activities.push(`${workerId}:${issueId}`);
        originalRecordStart(issueId, workerId);
      });

      let callCount = 0;
      const getStatus = () => {
        callCount++;
        if (callCount === 1) {
          return createWorkerPoolStatus([{ id: 'worker-1', status: 'idle' }]);
        }
        return createWorkerPoolStatus([
          { id: 'worker-1', status: 'working', currentIssue: 'ISS-001' },
        ]);
      };
      const getQueue = () => createWorkQueue([]);

      monitor.start(getStatus, getQueue);
      await new Promise((resolve) => setTimeout(resolve, 150));
      monitor.stop();

      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0]).toBe('worker-1:ISS-001');
    });
  });

  describe('default configuration', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_PROGRESS_MONITOR_CONFIG.pollingInterval).toBe(30000);
      expect(DEFAULT_PROGRESS_MONITOR_CONFIG.stuckWorkerThreshold).toBe(300000); // 5 minutes (reduced from 30)
      expect(DEFAULT_PROGRESS_MONITOR_CONFIG.maxRecentActivities).toBe(50);
      expect(DEFAULT_PROGRESS_MONITOR_CONFIG.enableNotifications).toBe(true);
    });
  });
});
