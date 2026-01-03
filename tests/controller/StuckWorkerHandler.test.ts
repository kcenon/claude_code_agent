import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StuckWorkerHandler,
  DEFAULT_STUCK_WORKER_CONFIG,
  StuckWorkerRecoveryError,
} from '../../src/controller/index.js';
import type {
  WorkerInfo,
  StuckWorkerEscalation,
  ProgressEvent,
} from '../../src/controller/index.js';

describe('StuckWorkerHandler', () => {
  let handler: StuckWorkerHandler;

  beforeEach(() => {
    handler = new StuckWorkerHandler({
      warningThresholdMs: 1000, // 1 second for testing
      stuckThresholdMs: 2000, // 2 seconds for testing
      criticalThresholdMs: 3000, // 3 seconds for testing
      autoRecoveryEnabled: true,
      maxRecoveryAttempts: 3,
      deadlineExtensionMs: 500,
      pauseOnCritical: false,
    });
  });

  const createWorkerInfo = (overrides: Partial<WorkerInfo> = {}): WorkerInfo => ({
    id: overrides.id ?? 'worker-1',
    status: overrides.status ?? 'working',
    currentIssue: overrides.currentIssue ?? 'issue-1',
    startedAt: overrides.startedAt ?? new Date(Date.now() - 5000).toISOString(),
    completedTasks: overrides.completedTasks ?? 0,
    ...(overrides.lastError !== undefined && { lastError: overrides.lastError }),
  });

  describe('constructor', () => {
    it('should use default config when not provided', () => {
      const defaultHandler = new StuckWorkerHandler();
      const config = defaultHandler.getConfig();

      expect(config.warningThresholdMs).toBe(DEFAULT_STUCK_WORKER_CONFIG.warningThresholdMs);
      expect(config.stuckThresholdMs).toBe(DEFAULT_STUCK_WORKER_CONFIG.stuckThresholdMs);
      expect(config.criticalThresholdMs).toBe(DEFAULT_STUCK_WORKER_CONFIG.criticalThresholdMs);
    });

    it('should use provided config values', () => {
      const config = handler.getConfig();

      expect(config.warningThresholdMs).toBe(1000);
      expect(config.stuckThresholdMs).toBe(2000);
      expect(config.criticalThresholdMs).toBe(3000);
      expect(config.maxRecoveryAttempts).toBe(3);
    });
  });

  describe('getThresholdForTask', () => {
    it('should return default thresholds for unknown task type', () => {
      const threshold = handler.getThresholdForTask(null);

      expect(threshold.warning).toBe(1000);
      expect(threshold.stuck).toBe(2000);
      expect(threshold.critical).toBe(3000);
    });

    it('should return custom thresholds for configured task type', () => {
      const customHandler = new StuckWorkerHandler({
        warningThresholdMs: 1000,
        stuckThresholdMs: 2000,
        criticalThresholdMs: 3000,
        taskThresholds: {
          build: {
            warning: 5000,
            stuck: 10000,
            critical: 15000,
          },
        },
      });

      const buildThreshold = customHandler.getThresholdForTask('build');
      expect(buildThreshold.warning).toBe(5000);
      expect(buildThreshold.stuck).toBe(10000);
      expect(buildThreshold.critical).toBe(15000);

      const defaultThreshold = customHandler.getThresholdForTask('other');
      expect(defaultThreshold.warning).toBe(1000);
    });
  });

  describe('worker tracking', () => {
    it('should track a worker', () => {
      handler.trackWorker('worker-1', 'issue-1', Date.now(), 'build');
      const tracked = handler.getTrackedWorkers();

      expect(tracked.length).toBe(1);
      expect(tracked[0].workerId).toBe('worker-1');
      expect(tracked[0].issueId).toBe('issue-1');
      expect(tracked[0].taskType).toBe('build');
    });

    it('should untrack a worker', () => {
      handler.trackWorker('worker-1', 'issue-1', Date.now());
      handler.untrackWorker('worker-1');
      const tracked = handler.getTrackedWorkers();

      expect(tracked.length).toBe(0);
    });
  });

  describe('checkWorkers', () => {
    it('should detect warning level for workers approaching threshold', async () => {
      const events: ProgressEvent[] = [];
      handler.onEvent((event) => {
        events.push(event);
      });

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 1500).toISOString(), // 1.5 seconds ago
        }),
      ];

      const escalations = await handler.checkWorkers(workers);

      expect(escalations.length).toBe(1);
      expect(escalations[0].level).toBe('warning');
      expect(events.some((e) => e.type === 'worker_warning')).toBe(true);
    });

    it('should detect stuck level for workers exceeding stuck threshold', async () => {
      const events: ProgressEvent[] = [];
      handler.onEvent((event) => {
        events.push(event);
      });

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(), // 2.5 seconds ago
        }),
      ];

      const escalations = await handler.checkWorkers(workers);

      expect(escalations.length).toBe(1);
      expect(escalations[0].level).toBe('stuck');
      expect(events.some((e) => e.type === 'worker_stuck')).toBe(true);
    });

    it('should detect critical level for workers exceeding critical threshold', async () => {
      const events: ProgressEvent[] = [];
      handler.onEvent((event) => {
        events.push(event);
      });

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 3500).toISOString(), // 3.5 seconds ago
        }),
      ];

      const escalations = await handler.checkWorkers(workers);

      expect(escalations.length).toBe(1);
      expect(escalations[0].level).toBe('critical');
      expect(events.some((e) => e.type === 'worker_critical')).toBe(true);
    });

    it('should not detect escalation for workers within threshold', async () => {
      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 500).toISOString(), // 0.5 seconds ago
        }),
      ];

      const escalations = await handler.checkWorkers(workers);

      expect(escalations.length).toBe(0);
    });

    it('should not duplicate escalation for same level', async () => {
      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      const escalations1 = await handler.checkWorkers(workers);
      expect(escalations1.length).toBe(1);

      const escalations2 = await handler.checkWorkers(workers);
      expect(escalations2.length).toBe(0);
    });

    it('should untrack workers that are no longer working', async () => {
      handler.trackWorker('worker-1', 'issue-1', Date.now() - 2500);

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          status: 'idle',
          currentIssue: null,
          startedAt: null,
        }),
      ];

      await handler.checkWorkers(workers);
      const tracked = handler.getTrackedWorkers();

      expect(tracked.length).toBe(0);
    });
  });

  describe('recovery actions', () => {
    it('should execute deadline extension on first stuck detection', async () => {
      const extendHandler = vi.fn().mockResolvedValue(undefined);
      handler.setDeadlineExtendHandler(extendHandler);

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      expect(extendHandler).toHaveBeenCalledWith('worker-1', 'issue-1', 500);
    });

    it('should execute task reassignment on second stuck detection', async () => {
      const extendHandler = vi.fn().mockResolvedValue(undefined);
      const reassignHandler = vi.fn().mockResolvedValue('worker-2');
      handler.setDeadlineExtendHandler(extendHandler);
      handler.setTaskReassignHandler(reassignHandler);

      handler.trackWorker('worker-1', 'issue-1', Date.now() - 2500);
      const tracked = handler.getTrackedWorkers();
      (tracked[0] as { recoveryAttempts: number }).recoveryAttempts = 1;
      (tracked[0] as { lastEscalationLevel: string | null }).lastEscalationLevel = null;

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      expect(reassignHandler).toHaveBeenCalledWith('issue-1', 'worker-1');
    });

    it('should execute worker restart on third stuck detection', async () => {
      const restartHandler = vi.fn().mockResolvedValue(undefined);
      handler.setWorkerRestartHandler(restartHandler);

      handler.trackWorker('worker-1', 'issue-1', Date.now() - 2500);
      const tracked = handler.getTrackedWorkers();
      (tracked[0] as { recoveryAttempts: number }).recoveryAttempts = 2;
      (tracked[0] as { lastEscalationLevel: string | null }).lastEscalationLevel = null;

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      expect(restartHandler).toHaveBeenCalledWith('worker-1');
    });

    it('should record recovery attempts in history', async () => {
      const extendHandler = vi.fn().mockResolvedValue(undefined);
      handler.setDeadlineExtendHandler(extendHandler);

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      const history = handler.getRecoveryHistory();
      expect(history.length).toBe(1);
      expect(history[0].action).toBe('extend_deadline');
      expect(history[0].success).toBe(true);
    });

    it('should record failed recovery attempts', async () => {
      const extendHandler = vi.fn().mockRejectedValue(new Error('Extension failed'));
      handler.setDeadlineExtendHandler(extendHandler);

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      const history = handler.getRecoveryHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(false);
      expect(history[0].error).toBe('Extension failed');
    });
  });

  describe('critical escalation', () => {
    it('should call critical escalation handler when max attempts exceeded', async () => {
      const criticalHandler = vi.fn().mockResolvedValue(undefined);
      handler.setCriticalEscalationHandler(criticalHandler);

      handler.trackWorker('worker-1', 'issue-1', Date.now() - 3500);
      const tracked = handler.getTrackedWorkers();
      (tracked[0] as { recoveryAttempts: number }).recoveryAttempts = 3;
      (tracked[0] as { lastEscalationLevel: string | null }).lastEscalationLevel = null;

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 3500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      expect(criticalHandler).toHaveBeenCalled();
      const escalation: StuckWorkerEscalation = criticalHandler.mock.calls[0][0];
      expect(escalation.level).toBe('critical');
      expect(escalation.workerId).toBe('worker-1');
    });

    it('should pause pipeline when pauseOnCritical is enabled', async () => {
      const pauseHandler = vi.fn().mockResolvedValue(undefined);
      const criticalHandler = vi.fn().mockResolvedValue(undefined);

      const pauseEnabledHandler = new StuckWorkerHandler({
        warningThresholdMs: 1000,
        stuckThresholdMs: 2000,
        criticalThresholdMs: 3000,
        pauseOnCritical: true,
        maxRecoveryAttempts: 0,
      });

      pauseEnabledHandler.setPipelinePauseHandler(pauseHandler);
      pauseEnabledHandler.setCriticalEscalationHandler(criticalHandler);

      pauseEnabledHandler.trackWorker('worker-1', 'issue-1', Date.now() - 3500);
      const tracked = pauseEnabledHandler.getTrackedWorkers();
      (tracked[0] as { lastEscalationLevel: string | null }).lastEscalationLevel = null;

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 3500).toISOString(),
        }),
      ];

      await pauseEnabledHandler.checkWorkers(workers);

      expect(pauseHandler).toHaveBeenCalledWith('Critical worker stuck: worker-1');
    });
  });

  describe('event emission', () => {
    it('should emit events for all escalation levels', async () => {
      const events: ProgressEvent[] = [];
      handler.onEvent((event) => {
        events.push(event);
      });

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 3500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      expect(events.some((e) => e.type === 'worker_critical')).toBe(true);
      expect(events.some((e) => e.type === 'recovery_attempted')).toBe(true);
    });

    it('should emit recovery_succeeded on successful recovery', async () => {
      const events: ProgressEvent[] = [];
      handler.onEvent((event) => {
        events.push(event);
      });

      const restartHandler = vi.fn().mockResolvedValue(undefined);
      handler.setWorkerRestartHandler(restartHandler);

      handler.trackWorker('worker-1', 'issue-1', Date.now() - 3500);
      const tracked = handler.getTrackedWorkers();
      (tracked[0] as { recoveryAttempts: number }).recoveryAttempts = 2;
      (tracked[0] as { lastEscalationLevel: string | null }).lastEscalationLevel = null;

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 3500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      expect(events.some((e) => e.type === 'recovery_succeeded')).toBe(true);
    });
  });

  describe('escalation history', () => {
    it('should record escalations in history', async () => {
      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);

      const history = handler.getEscalationHistory();
      expect(history.length).toBe(1);
      expect(history[0].workerId).toBe('worker-1');
      expect(history[0].level).toBe('stuck');
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await handler.checkWorkers(workers);
      handler.reset();

      expect(handler.getTrackedWorkers().length).toBe(0);
      expect(handler.getEscalationHistory().length).toBe(0);
      expect(handler.getRecoveryHistory().length).toBe(0);
    });
  });

  describe('disabled auto-recovery', () => {
    it('should not attempt recovery when autoRecoveryEnabled is false', async () => {
      const disabledHandler = new StuckWorkerHandler({
        warningThresholdMs: 1000,
        stuckThresholdMs: 2000,
        criticalThresholdMs: 3000,
        autoRecoveryEnabled: false,
      });

      const extendHandler = vi.fn();
      disabledHandler.setDeadlineExtendHandler(extendHandler);

      const workers: WorkerInfo[] = [
        createWorkerInfo({
          id: 'worker-1',
          startedAt: new Date(Date.now() - 2500).toISOString(),
        }),
      ];

      await disabledHandler.checkWorkers(workers);

      expect(extendHandler).not.toHaveBeenCalled();
    });
  });
});
