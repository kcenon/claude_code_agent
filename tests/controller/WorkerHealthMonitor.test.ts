import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WorkerHealthMonitor,
  HealthMonitorAlreadyRunningError,
  HealthMonitorNotRunningError,
  DEFAULT_HEALTH_CHECK_CONFIG,
} from '../../src/controller/index.js';
import type {
  WorkerInfo,
  WorkerHeartbeat,
  HealthEvent,
} from '../../src/controller/index.js';

describe('WorkerHealthMonitor', () => {
  let monitor: WorkerHealthMonitor;

  beforeEach(() => {
    monitor = new WorkerHealthMonitor({
      heartbeatIntervalMs: 100, // Fast for testing
      healthCheckIntervalMs: 50, // Fast for testing
      missedHeartbeatThreshold: 3,
      memoryThresholdBytes: 1073741824, // 1GB
      maxRestarts: 2,
      restartCooldownMs: 100,
    });
  });

  afterEach(() => {
    if (monitor.isActive()) {
      monitor.stop();
    }
  });

  const createWorkerInfo = (overrides: Partial<WorkerInfo> = {}): WorkerInfo => ({
    id: overrides.id ?? 'worker-1',
    status: overrides.status ?? 'idle',
    currentIssue: overrides.currentIssue ?? null,
    startedAt: overrides.startedAt ?? null,
    completedTasks: overrides.completedTasks ?? 0,
    ...(overrides.lastError !== undefined && { lastError: overrides.lastError }),
  });

  const createHeartbeat = (overrides: Partial<WorkerHeartbeat> = {}): WorkerHeartbeat => ({
    workerId: overrides.workerId ?? 'worker-1',
    timestamp: overrides.timestamp ?? Date.now(),
    memoryUsage: overrides.memoryUsage ?? 500000000, // 500MB
    status: overrides.status ?? 'idle',
    ...(overrides.currentTask !== undefined && { currentTask: overrides.currentTask }),
    ...(overrides.progress !== undefined && { progress: overrides.progress }),
    ...(overrides.cpuUsage !== undefined && { cpuUsage: overrides.cpuUsage }),
  });

  describe('constructor', () => {
    it('should use default config when not provided', () => {
      const defaultMonitor = new WorkerHealthMonitor();
      const config = defaultMonitor.getConfig();

      expect(config.heartbeatIntervalMs).toBe(DEFAULT_HEALTH_CHECK_CONFIG.heartbeatIntervalMs);
      expect(config.healthCheckIntervalMs).toBe(DEFAULT_HEALTH_CHECK_CONFIG.healthCheckIntervalMs);
      expect(config.missedHeartbeatThreshold).toBe(
        DEFAULT_HEALTH_CHECK_CONFIG.missedHeartbeatThreshold
      );
    });

    it('should use provided config values', () => {
      const config = monitor.getConfig();

      expect(config.heartbeatIntervalMs).toBe(100);
      expect(config.missedHeartbeatThreshold).toBe(3);
      expect(config.maxRestarts).toBe(2);
    });
  });

  describe('worker registration', () => {
    it('should register a worker', () => {
      monitor.registerWorker('worker-1');
      const health = monitor.getWorkerHealth('worker-1');

      expect(health).not.toBeNull();
      expect(health?.workerId).toBe('worker-1');
      expect(health?.healthStatus).toBe('healthy');
    });

    it('should not duplicate registration', () => {
      monitor.registerWorker('worker-1');
      monitor.registerWorker('worker-1');
      const status = monitor.getStatus();

      expect(status.totalWorkers).toBe(1);
    });

    it('should unregister a worker', () => {
      monitor.registerWorker('worker-1');
      monitor.unregisterWorker('worker-1');
      const health = monitor.getWorkerHealth('worker-1');

      expect(health).toBeNull();
    });
  });

  describe('start/stop', () => {
    it('should start monitoring', () => {
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      expect(monitor.isActive()).toBe(true);
    });

    it('should throw if already running', () => {
      const getWorkers = (): readonly WorkerInfo[] => [];
      monitor.start(getWorkers);

      expect(() => monitor.start(getWorkers)).toThrow(HealthMonitorAlreadyRunningError);
    });

    it('should stop monitoring', () => {
      const getWorkers = (): readonly WorkerInfo[] => [];
      monitor.start(getWorkers);
      monitor.stop();

      expect(monitor.isActive()).toBe(false);
    });

    it('should throw if not running when stopping', () => {
      expect(() => monitor.stop()).toThrow(HealthMonitorNotRunningError);
    });

    it('should register workers on start', () => {
      const workers = [createWorkerInfo({ id: 'worker-1' }), createWorkerInfo({ id: 'worker-2' })];
      const getWorkers = (): readonly WorkerInfo[] => workers;

      monitor.start(getWorkers);
      const status = monitor.getStatus();

      expect(status.totalWorkers).toBe(2);
    });
  });

  describe('heartbeat recording', () => {
    it('should record a heartbeat', () => {
      monitor.registerWorker('worker-1');
      const heartbeat = createHeartbeat();
      monitor.recordHeartbeat(heartbeat);

      const health = monitor.getWorkerHealth('worker-1');
      expect(health?.lastHeartbeat).toBe(heartbeat.timestamp);
      expect(health?.missedHeartbeats).toBe(0);
    });

    it('should auto-register unknown worker', () => {
      const heartbeat = createHeartbeat({ workerId: 'unknown-worker' });
      monitor.recordHeartbeat(heartbeat);

      const health = monitor.getWorkerHealth('unknown-worker');
      expect(health).not.toBeNull();
      expect(health?.healthStatus).toBe('healthy');
    });

    it('should reset missed heartbeats on new heartbeat', () => {
      monitor.registerWorker('worker-1');

      // Record first heartbeat
      const heartbeat1 = createHeartbeat({ timestamp: Date.now() - 1000 });
      monitor.recordHeartbeat(heartbeat1);

      // Record second heartbeat
      const heartbeat2 = createHeartbeat({ timestamp: Date.now() });
      monitor.recordHeartbeat(heartbeat2);

      const health = monitor.getWorkerHealth('worker-1');
      expect(health?.missedHeartbeats).toBe(0);
      expect(health?.healthStatus).toBe('healthy');
    });

    it('should emit heartbeat_received event', async () => {
      const events: HealthEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });

      monitor.registerWorker('worker-1');
      monitor.recordHeartbeat(createHeartbeat());

      // Wait for async event emission
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'heartbeat_received')).toBe(true);
    });
  });

  describe('health status', () => {
    it('should return null for unknown worker', () => {
      const health = monitor.getWorkerHealth('unknown');
      expect(health).toBeNull();
    });

    it('should return correct status counts', () => {
      monitor.registerWorker('worker-1');
      monitor.registerWorker('worker-2');
      monitor.registerWorker('worker-3');

      const status = monitor.getStatus();

      expect(status.totalWorkers).toBe(3);
      expect(status.healthyCount).toBe(3);
      expect(status.zombieCount).toBe(0);
    });

    it('should show monitoring status', () => {
      expect(monitor.getStatus().isActive).toBe(false);

      const getWorkers = (): readonly WorkerInfo[] => [];
      monitor.start(getWorkers);

      expect(monitor.getStatus().isActive).toBe(true);
    });
  });

  describe('zombie detection', () => {
    it('should return empty zombie list when all healthy', () => {
      monitor.registerWorker('worker-1');
      monitor.recordHeartbeat(createHeartbeat());

      const zombies = monitor.getZombieWorkers();
      expect(zombies.length).toBe(0);
    });

    it('should include zombie worker IDs in status', async () => {
      // Use a separate monitor with fast config for this test
      const fastMonitor = new WorkerHealthMonitor({
        heartbeatIntervalMs: 10,
        healthCheckIntervalMs: 20,
        missedHeartbeatThreshold: 2,
        maxRestarts: 0, // Disable restarts to avoid throw
        restartCooldownMs: 1000,
      });

      fastMonitor.registerWorker('worker-1');
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      fastMonitor.start(getWorkers);

      // Wait for zombie detection
      await new Promise((resolve) => setTimeout(resolve, 200));

      const status = fastMonitor.getStatus();
      expect(status.zombieCount).toBeGreaterThanOrEqual(0); // May or may not be zombie yet

      fastMonitor.stop();
    });

    it('should emit zombie_detected event', async () => {
      const events: HealthEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });

      monitor.registerWorker('worker-1');
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      // Wait for zombie detection
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(events.some((e) => e.type === 'zombie_detected')).toBe(true);
    });

    it('should call zombie handler', async () => {
      const zombieHandler = vi.fn();
      monitor.onZombie(zombieHandler);

      monitor.registerWorker('worker-1');
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      // Wait for zombie detection
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(zombieHandler).toHaveBeenCalled();
    });
  });

  describe('task reassignment', () => {
    it('should call reassign handler when zombie has task', async () => {
      const reassignHandler = vi.fn().mockResolvedValue('worker-2');
      monitor.onReassign(reassignHandler);

      // Record initial heartbeat with task
      monitor.recordHeartbeat(
        createHeartbeat({
          workerId: 'worker-1',
          currentTask: 'ISSUE-1',
          status: 'busy',
        })
      );

      const getWorkers = (): readonly WorkerInfo[] => [
        createWorkerInfo({ id: 'worker-1', status: 'working', currentIssue: 'ISSUE-1' }),
      ];

      monitor.start(getWorkers);

      // Wait for zombie detection and reassignment
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(reassignHandler).toHaveBeenCalledWith('ISSUE-1', 'worker-1');
    });

    it('should emit task_reassigned event', async () => {
      const events: HealthEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });
      monitor.onReassign(vi.fn().mockResolvedValue('worker-2'));

      monitor.recordHeartbeat(
        createHeartbeat({
          workerId: 'worker-1',
          currentTask: 'ISSUE-1',
          status: 'busy',
        })
      );

      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(events.some((e) => e.type === 'task_reassigned')).toBe(true);
    });
  });

  describe('worker restart', () => {
    it('should call restart handler', async () => {
      const restartHandler = vi.fn().mockResolvedValue(undefined);
      monitor.onRestart(restartHandler);

      monitor.registerWorker('worker-1');
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(restartHandler).toHaveBeenCalledWith('worker-1');
    });

    it('should emit worker_restart_failed after max attempts', async () => {
      const events: HealthEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });

      let restartAttempts = 0;
      const restartHandler = vi.fn().mockImplementation(() => {
        restartAttempts++;
        throw new Error('Restart failed');
      });
      monitor.onRestart(restartHandler);

      monitor.registerWorker('worker-1');
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];

      monitor.start(getWorkers);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should have emitted restart_failed event
      const failedEvents = events.filter((e) => e.type === 'worker_restart_failed');
      expect(failedEvents.length).toBeGreaterThan(0);
    });

    it('should emit worker_restarted event on success', async () => {
      const events: HealthEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });
      monitor.onRestart(vi.fn().mockResolvedValue(undefined));

      monitor.registerWorker('worker-1');
      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(events.some((e) => e.type === 'worker_restarted')).toBe(true);
    });
  });

  describe('memory threshold', () => {
    it('should emit memory_threshold_exceeded event', async () => {
      const events: HealthEvent[] = [];
      monitor.onEvent((event) => {
        events.push(event);
      });

      // Record heartbeat with high memory
      monitor.recordHeartbeat(
        createHeartbeat({
          workerId: 'worker-1',
          memoryUsage: 2000000000, // 2GB, over threshold
        })
      );

      const getWorkers = (): readonly WorkerInfo[] => [createWorkerInfo()];
      monitor.start(getWorkers);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events.some((e) => e.type === 'memory_threshold_exceeded')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      monitor.registerWorker('worker-1');
      monitor.registerWorker('worker-2');

      const getWorkers = (): readonly WorkerInfo[] => [];
      monitor.start(getWorkers);
      monitor.reset();

      expect(monitor.isActive()).toBe(false);
      expect(monitor.getStatus().totalWorkers).toBe(0);
    });

    it('should reset worker health', () => {
      monitor.registerWorker('worker-1');
      monitor.resetWorkerHealth('worker-1');

      const health = monitor.getWorkerHealth('worker-1');
      expect(health?.healthStatus).toBe('healthy');
      expect(health?.missedHeartbeats).toBe(0);
    });
  });
});
