import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  WorkerPoolManager,
  WorkerNotFoundError,
  WorkerNotAvailableError,
  WorkOrderNotFoundError,
  ControllerStatePersistenceError,
  DEFAULT_WORKER_POOL_CONFIG,
} from '../../src/controller/index.js';
import type {
  IssueNode,
  AnalyzedIssue,
  WorkOrder,
  WorkOrderResult,
} from '../../src/controller/index.js';

describe('WorkerPoolManager', () => {
  let manager: WorkerPoolManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `worker-pool-test-${Date.now()}`);
    manager = new WorkerPoolManager({
      maxWorkers: 3,
      workOrdersPath: testDir,
    });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  const createIssueNode = (
    id: string,
    priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P1',
    url?: string
  ): IssueNode => ({
    id,
    title: `Issue ${id}`,
    priority,
    effort: 4,
    status: 'pending',
    ...(url !== undefined && { url }),
  });

  const createAnalyzedIssue = (
    id: string,
    priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P1',
    priorityScore = 75
  ): AnalyzedIssue => ({
    node: createIssueNode(id, priority),
    dependencies: [],
    dependents: [],
    transitiveDependencies: [],
    depth: 0,
    priorityScore,
    isOnCriticalPath: false,
    dependenciesResolved: true,
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new WorkerPoolManager();
      const status = defaultManager.getStatus();

      expect(status.totalWorkers).toBe(DEFAULT_WORKER_POOL_CONFIG.maxWorkers);
      expect(status.idleWorkers).toBe(DEFAULT_WORKER_POOL_CONFIG.maxWorkers);
      expect(status.workingWorkers).toBe(0);
      expect(status.errorWorkers).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const status = manager.getStatus();

      expect(status.totalWorkers).toBe(3);
      expect(status.idleWorkers).toBe(3);
    });

    it('should create workers with sequential IDs', () => {
      const status = manager.getStatus();
      const workerIds = status.workers.map((w) => w.id);

      expect(workerIds).toContain('worker-1');
      expect(workerIds).toContain('worker-2');
      expect(workerIds).toContain('worker-3');
    });

    it('should initialize all workers as idle', () => {
      const status = manager.getStatus();

      for (const worker of status.workers) {
        expect(worker.status).toBe('idle');
        expect(worker.currentIssue).toBeNull();
        expect(worker.startedAt).toBeNull();
        expect(worker.completedTasks).toBe(0);
      }
    });
  });

  describe('getAvailableSlot', () => {
    it('should return an idle worker ID', () => {
      const slot = manager.getAvailableSlot();

      expect(slot).not.toBeNull();
      expect(slot).toMatch(/^worker-\d+$/);
    });

    it('should return null when all workers are busy', async () => {
      // Fill all worker slots
      const issues = ['ISS-001', 'ISS-002', 'ISS-003'];
      for (const issueId of issues) {
        const slot = manager.getAvailableSlot();
        if (slot !== null) {
          const order = await manager.createWorkOrder(createIssueNode(issueId));
          manager.assignWork(slot, order);
        }
      }

      const slot = manager.getAvailableSlot();
      expect(slot).toBeNull();
    });
  });

  describe('getWorker', () => {
    it('should return worker info for valid ID', () => {
      const worker = manager.getWorker('worker-1');

      expect(worker.id).toBe('worker-1');
      expect(worker.status).toBe('idle');
    });

    it('should throw WorkerNotFoundError for invalid ID', () => {
      expect(() => manager.getWorker('worker-999')).toThrow(WorkerNotFoundError);
    });
  });

  describe('getWorkerStatus', () => {
    it('should return worker status', () => {
      const status = manager.getWorkerStatus('worker-1');

      expect(status).toBe('idle');
    });

    it('should throw WorkerNotFoundError for invalid ID', () => {
      expect(() => manager.getWorkerStatus('worker-999')).toThrow(WorkerNotFoundError);
    });
  });

  describe('createWorkOrder', () => {
    it('should create work order from IssueNode', async () => {
      const issue = createIssueNode('ISS-001', 'P0');
      const order = await manager.createWorkOrder(issue);

      expect(order.orderId).toBe('WO-001');
      expect(order.issueId).toBe('ISS-001');
      expect(order.priority).toBe(100); // P0 priority
      expect(order.createdAt).toBeDefined();
    });

    it('should create work order from AnalyzedIssue', async () => {
      const analyzed = createAnalyzedIssue('ISS-002', 'P1', 85);
      const order = await manager.createWorkOrder(analyzed);

      expect(order.orderId).toBe('WO-001');
      expect(order.issueId).toBe('ISS-002');
      expect(order.priority).toBe(85); // Uses priorityScore
    });

    it('should increment order IDs', async () => {
      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001'));
      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002'));
      const order3 = await manager.createWorkOrder(createIssueNode('ISS-003'));

      expect(order1.orderId).toBe('WO-001');
      expect(order2.orderId).toBe('WO-002');
      expect(order3.orderId).toBe('WO-003');
    });

    it('should include issue URL when present', async () => {
      const issue = createIssueNode('ISS-001', 'P1', 'https://github.com/org/repo/issues/1');
      const order = await manager.createWorkOrder(issue);

      expect(order.issueUrl).toBe('https://github.com/org/repo/issues/1');
    });

    it('should include context information', async () => {
      const issue = createIssueNode('ISS-001');
      const order = await manager.createWorkOrder(issue, {
        sdsComponent: 'CMP-001',
        srsFeature: 'SF-001',
        prdRequirement: 'FR-001',
        relatedFiles: [{ path: 'src/index.ts', reason: 'Main entry' }],
      });

      expect(order.context.sdsComponent).toBe('CMP-001');
      expect(order.context.srsFeature).toBe('SF-001');
      expect(order.context.prdRequirement).toBe('FR-001');
      expect(order.context.relatedFiles.length).toBe(1);
    });

    it('should persist work order to disk', async () => {
      await manager.createWorkOrder(createIssueNode('ISS-001'));

      const orderPath = join(testDir, 'work_orders', 'WO-001.json');
      expect(existsSync(orderPath)).toBe(true);
    });
  });

  describe('assignWork', () => {
    it('should assign work to idle worker', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('working');
      expect(worker.currentIssue).toBe('ISS-001');
      expect(worker.startedAt).not.toBeNull();
    });

    it('should throw WorkerNotFoundError for invalid worker', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));

      expect(() => manager.assignWork('worker-999', order)).toThrow(
        WorkerNotFoundError
      );
    });

    it('should throw WorkerNotAvailableError for busy worker', async () => {
      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001'));
      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002'));

      manager.assignWork('worker-1', order1);

      expect(() => manager.assignWork('worker-1', order2)).toThrow(
        WorkerNotAvailableError
      );
    });

    it('should update pool status after assignment', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(2);
      expect(status.workingWorkers).toBe(1);
    });

    it('should track active work orders', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      const status = manager.getStatus();
      expect(status.activeWorkOrders).toContain('WO-001');
    });
  });

  describe('getWorkOrder', () => {
    it('should return work order by ID', async () => {
      await manager.createWorkOrder(createIssueNode('ISS-001'));

      const order = manager.getWorkOrder('WO-001');
      expect(order.issueId).toBe('ISS-001');
    });

    it('should throw WorkOrderNotFoundError for invalid ID', () => {
      expect(() => manager.getWorkOrder('WO-999')).toThrow(WorkOrderNotFoundError);
    });
  });

  describe('completeWork', () => {
    it('should mark work as completed successfully', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      const result: WorkOrderResult = {
        orderId: 'WO-001',
        success: true,
        completedAt: new Date().toISOString(),
        filesModified: ['src/feature.ts'],
      };

      await manager.completeWork('worker-1', result);

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('idle');
      expect(worker.currentIssue).toBeNull();
      expect(worker.completedTasks).toBe(1);
    });

    it('should track completed orders', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      await manager.completeWork('worker-1', {
        orderId: 'WO-001',
        success: true,
        completedAt: new Date().toISOString(),
        filesModified: [],
      });

      expect(manager.getCompletedOrders()).toContain('WO-001');
    });

    it('should track failed orders', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      await manager.completeWork('worker-1', {
        orderId: 'WO-001',
        success: false,
        completedAt: new Date().toISOString(),
        filesModified: [],
        error: 'Build failed',
      });

      expect(manager.getFailedOrders()).toContain('WO-001');
    });

    it('should invoke completion callback', async () => {
      const callback = vi.fn();
      manager.onCompletion(callback);

      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      const result: WorkOrderResult = {
        orderId: 'WO-001',
        success: true,
        completedAt: new Date().toISOString(),
        filesModified: [],
      };

      await manager.completeWork('worker-1', result);

      expect(callback).toHaveBeenCalledWith('worker-1', result);
    });
  });

  describe('failWork', () => {
    it('should mark worker as error state', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      await manager.failWork('worker-1', 'WO-001', new Error('Test error'));

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('error');
      expect(worker.lastError).toBe('Test error');
    });

    it('should track failed orders', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      await manager.failWork('worker-1', 'WO-001', new Error('Test error'));

      expect(manager.getFailedOrders()).toContain('WO-001');
    });

    it('should invoke failure callback', async () => {
      const callback = vi.fn();
      manager.onFailure(callback);

      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      const error = new Error('Test error');
      await manager.failWork('worker-1', 'WO-001', error);

      expect(callback).toHaveBeenCalledWith('worker-1', 'WO-001', error);
    });
  });

  describe('releaseWorker', () => {
    it('should release worker back to idle', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      manager.releaseWorker('worker-1');

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('idle');
      expect(worker.currentIssue).toBeNull();
    });

    it('should throw WorkerNotFoundError for invalid worker', () => {
      expect(() => manager.releaseWorker('worker-999')).toThrow(WorkerNotFoundError);
    });
  });

  describe('resetWorker', () => {
    it('should reset worker from error state', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);
      await manager.failWork('worker-1', 'WO-001', new Error('Test'));

      manager.resetWorker('worker-1');

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('idle');
      expect(worker.lastError).toBeUndefined();
    });
  });

  describe('work queue', () => {
    it('should enqueue issues with priority', () => {
      manager.enqueue('ISS-001', 100);
      manager.enqueue('ISS-002', 75);

      expect(manager.getQueueSize()).toBe(2);
      expect(manager.isQueued('ISS-001')).toBe(true);
    });

    it('should dequeue highest priority issue first', () => {
      manager.enqueue('ISS-001', 50);
      manager.enqueue('ISS-002', 100);
      manager.enqueue('ISS-003', 75);

      const first = manager.dequeue();
      const second = manager.dequeue();
      const third = manager.dequeue();

      expect(first).toBe('ISS-002'); // Highest priority
      expect(second).toBe('ISS-003');
      expect(third).toBe('ISS-001'); // Lowest priority
    });

    it('should return null when queue is empty', () => {
      expect(manager.dequeue()).toBeNull();
    });

    it('should track queue order correctly', () => {
      manager.enqueue('ISS-001', 50);
      manager.enqueue('ISS-002', 100);

      const queue = manager.getQueue();
      expect(queue[0]?.issueId).toBe('ISS-002');
      expect(queue[1]?.issueId).toBe('ISS-001');
    });
  });

  describe('isInProgress', () => {
    it('should return true for assigned issue', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      expect(manager.isInProgress('ISS-001')).toBe(true);
    });

    it('should return false for unassigned issue', () => {
      expect(manager.isInProgress('ISS-999')).toBe(false);
    });
  });

  describe('state persistence', () => {
    it('should save state to disk', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);
      manager.enqueue('ISS-002', 75);

      await manager.saveState('test-project');

      const statePath = join(testDir, 'controller_state.json');
      expect(existsSync(statePath)).toBe(true);
    });

    it('should load state from disk', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);
      manager.enqueue('ISS-002', 75);

      await manager.saveState('test-project');

      // Create new manager and load state
      const newManager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const state = await newManager.loadState('test-project');

      expect(state).not.toBeNull();
      expect(state?.projectId).toBe('test-project');
      expect(state?.workerPool.workingWorkers).toBe(1);
      expect(state?.workQueue.length).toBe(1);
    });

    it('should return null for non-existent state', async () => {
      const state = await manager.loadState('non-existent');

      expect(state).toBeNull();
    });

    it('should return null for mismatched project ID', async () => {
      await manager.saveState('project-a');

      const state = await manager.loadState('project-b');

      expect(state).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);
      manager.enqueue('ISS-002', 75);

      await manager.completeWork('worker-1', {
        orderId: 'WO-001',
        success: true,
        completedAt: new Date().toISOString(),
        filesModified: [],
      });

      manager.reset();

      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(3);
      expect(status.workingWorkers).toBe(0);
      expect(manager.getQueueSize()).toBe(0);
      expect(manager.getCompletedOrders().length).toBe(0);
    });

    it('should reset worker completed task counts', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);
      await manager.completeWork('worker-1', {
        orderId: 'WO-001',
        success: true,
        completedAt: new Date().toISOString(),
        filesModified: [],
      });

      manager.reset();

      const worker = manager.getWorker('worker-1');
      expect(worker.completedTasks).toBe(0);
    });
  });

  describe('pool status', () => {
    it('should track worker counts correctly', async () => {
      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001'));
      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002'));

      manager.assignWork('worker-1', order1);
      manager.assignWork('worker-2', order2);
      await manager.failWork('worker-2', 'WO-002', new Error('Test'));

      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(1);
      expect(status.workingWorkers).toBe(1);
      expect(status.errorWorkers).toBe(1);
    });
  });

  describe('distributed lock support', () => {
    let distributedManager: WorkerPoolManager;
    let distributedTestDir: string;

    beforeEach(async () => {
      distributedTestDir = join(tmpdir(), `worker-pool-distributed-test-${Date.now()}`);
      distributedManager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: distributedTestDir,
        distributedLock: {
          enabled: true,
          lockTimeout: 5000,
          lockRetryAttempts: 5,
          lockRetryDelayMs: 50,
        },
      });
    });

    afterEach(async () => {
      await distributedManager.cleanupDistributedLock();
      if (existsSync(distributedTestDir)) {
        await rm(distributedTestDir, { recursive: true, force: true });
      }
    });

    describe('configuration', () => {
      it('should detect distributed lock enabled', () => {
        expect(distributedManager.isDistributedLockEnabled()).toBe(true);
      });

      it('should detect distributed lock disabled when not configured', () => {
        expect(manager.isDistributedLockEnabled()).toBe(false);
      });

      it('should generate unique lock holder ID', () => {
        const holderId1 = distributedManager.getLockHolderId();
        const otherManager = new WorkerPoolManager({
          maxWorkers: 2,
          workOrdersPath: distributedTestDir,
          distributedLock: { enabled: true },
        });
        const holderId2 = otherManager.getLockHolderId();

        expect(holderId1).toBeDefined();
        expect(holderId2).toBeDefined();
        expect(holderId1).not.toBe(holderId2);
      });

      it('should use custom holder ID prefix', () => {
        const customManager = new WorkerPoolManager({
          maxWorkers: 2,
          workOrdersPath: distributedTestDir,
          distributedLock: {
            enabled: true,
            holderIdPrefix: 'custom-prefix',
          },
        });

        expect(customManager.getLockHolderId()).toContain('custom-prefix-');
      });
    });

    describe('assignWorkWithLock', () => {
      it('should assign work with lock protection', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);

        const worker = distributedManager.getWorker('worker-1');
        expect(worker.status).toBe('working');
        expect(worker.currentIssue).toBe('ISS-001');
      });

      it('should work without lock when disabled', async () => {
        const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
        await manager.assignWorkWithLock('worker-1', order);

        const worker = manager.getWorker('worker-1');
        expect(worker.status).toBe('working');
      });
    });

    describe('completeWorkWithLock', () => {
      it('should complete work with lock protection', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);

        const result: WorkOrderResult = {
          orderId: 'WO-001',
          success: true,
          completedAt: new Date().toISOString(),
          filesModified: [],
        };

        await distributedManager.completeWorkWithLock('worker-1', result);

        const worker = distributedManager.getWorker('worker-1');
        expect(worker.status).toBe('idle');
        expect(distributedManager.getCompletedOrders()).toContain('WO-001');
      });
    });

    describe('failWorkWithLock', () => {
      it('should fail work with lock protection', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);

        await distributedManager.failWorkWithLock('worker-1', 'WO-001', new Error('Test failure'));

        const worker = distributedManager.getWorker('worker-1');
        expect(worker.status).toBe('error');
        expect(distributedManager.getFailedOrders()).toContain('WO-001');
      });
    });

    describe('createWorkOrderWithLock', () => {
      it('should create work order with lock protection', async () => {
        const order = await distributedManager.createWorkOrderWithLock(
          createIssueNode('ISS-001', 'P0')
        );

        expect(order.orderId).toBe('WO-001');
        expect(order.issueId).toBe('ISS-001');
        expect(order.priority).toBe(100);
      });

      it('should maintain order ID uniqueness with locks', async () => {
        const [order1, order2] = await Promise.all([
          distributedManager.createWorkOrderWithLock(createIssueNode('ISS-001')),
          distributedManager.createWorkOrderWithLock(createIssueNode('ISS-002')),
        ]);

        // Both orders should be created with unique IDs
        expect(order1.orderId).not.toBe(order2.orderId);
      });
    });

    describe('queue operations with lock', () => {
      it('should enqueue with lock protection', async () => {
        await distributedManager.enqueueWithLock('ISS-001', 100);
        await distributedManager.enqueueWithLock('ISS-002', 75);

        expect(distributedManager.getQueueSize()).toBe(2);
        expect(distributedManager.isQueued('ISS-001')).toBe(true);
        expect(distributedManager.isQueued('ISS-002')).toBe(true);
      });

      it('should dequeue with lock protection', async () => {
        await distributedManager.enqueueWithLock('ISS-001', 50);
        await distributedManager.enqueueWithLock('ISS-002', 100);

        const dequeued = await distributedManager.dequeueWithLock();
        expect(dequeued).toBe('ISS-002'); // Highest priority
        expect(distributedManager.getQueueSize()).toBe(1);
      });

      it('should return null when dequeuing empty queue', async () => {
        const result = await distributedManager.dequeueWithLock();
        expect(result).toBeNull();
      });
    });

    describe('getAvailableSlotWithLock', () => {
      it('should get available slot with lock', async () => {
        const slot = await distributedManager.getAvailableSlotWithLock();
        expect(slot).toBeDefined();
        expect(slot).toMatch(/^worker-\d+$/);
      });

      it('should return null when no slots available', async () => {
        // Fill all slots
        for (let i = 1; i <= 3; i++) {
          const order = await distributedManager.createWorkOrder(createIssueNode(`ISS-00${i}`));
          distributedManager.assignWork(`worker-${i}`, order);
        }

        const slot = await distributedManager.getAvailableSlotWithLock();
        expect(slot).toBeNull();
      });
    });

    describe('worker management with lock', () => {
      it('should release worker with lock', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);

        await distributedManager.releaseWorkerWithLock('worker-1');

        const worker = distributedManager.getWorker('worker-1');
        expect(worker.status).toBe('idle');
      });

      it('should reset worker with lock', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);
        await distributedManager.failWorkWithLock('worker-1', 'WO-001', new Error('Test'));

        await distributedManager.resetWorkerWithLock('worker-1');

        const worker = distributedManager.getWorker('worker-1');
        expect(worker.status).toBe('idle');
        expect(worker.lastError).toBeUndefined();
      });
    });

    describe('state persistence with lock', () => {
      it('should save state with lock protection', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);

        await distributedManager.saveStateWithLock('test-project');

        const statePath = join(distributedTestDir, 'controller_state.json');
        expect(existsSync(statePath)).toBe(true);
      });

      it('should load state with lock protection', async () => {
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);
        await distributedManager.saveStateWithLock('test-project');

        const state = await distributedManager.loadStateWithLock('test-project');

        expect(state).not.toBeNull();
        expect(state?.projectId).toBe('test-project');
      });
    });

    describe('synchronizeState', () => {
      it('should synchronize state when distributed lock enabled', async () => {
        // Create some state
        const order = await distributedManager.createWorkOrder(createIssueNode('ISS-001'));
        await distributedManager.assignWorkWithLock('worker-1', order);

        const result: WorkOrderResult = {
          orderId: 'WO-001',
          success: true,
          completedAt: new Date().toISOString(),
          filesModified: [],
        };
        await distributedManager.completeWorkWithLock('worker-1', result);

        // Synchronize should succeed
        const synced = await distributedManager.synchronizeState('test-project');
        expect(synced).toBe(true);
      });

      it('should return false when distributed lock disabled', async () => {
        const synced = await manager.synchronizeState('test-project');
        expect(synced).toBe(false);
      });
    });

    describe('cleanupDistributedLock', () => {
      it('should cleanup without error', async () => {
        await expect(distributedManager.cleanupDistributedLock()).resolves.not.toThrow();
      });

      it('should be safe to call multiple times', async () => {
        await distributedManager.cleanupDistributedLock();
        await expect(distributedManager.cleanupDistributedLock()).resolves.not.toThrow();
      });

      it('should be safe when distributed lock disabled', async () => {
        await expect(manager.cleanupDistributedLock()).resolves.not.toThrow();
      });
    });
  });

  describe('metrics support', () => {
    let metricsManager: WorkerPoolManager;
    let metricsTestDir: string;

    beforeEach(async () => {
      metricsTestDir = join(tmpdir(), `worker-pool-metrics-test-${Date.now()}`);
      metricsManager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: metricsTestDir,
        metricsConfig: {
          enabled: true,
          maxCompletionRecords: 100,
        },
      });
    });

    afterEach(async () => {
      if (existsSync(metricsTestDir)) {
        await rm(metricsTestDir, { recursive: true, force: true });
      }
    });

    describe('configuration', () => {
      it('should detect metrics enabled', () => {
        expect(metricsManager.isMetricsEnabled()).toBe(true);
      });

      it('should detect metrics disabled when not configured', () => {
        expect(manager.isMetricsEnabled()).toBe(false);
      });

      it('should return null for metrics when disabled', () => {
        expect(manager.getMetricsSnapshot()).toBeNull();
        expect(manager.exportMetrics()).toBeNull();
      });
    });

    describe('getMetricsSnapshot', () => {
      it('should return metrics snapshot', () => {
        const snapshot = metricsManager.getMetricsSnapshot();

        expect(snapshot).not.toBeNull();
        expect(snapshot?.utilization.totalWorkers).toBe(3);
        expect(snapshot?.utilization.idleWorkers).toBe(3);
        expect(snapshot?.utilization.activeWorkers).toBe(0);
      });

      it('should reflect worker state changes', async () => {
        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);

        const snapshot = metricsManager.getMetricsSnapshot();

        expect(snapshot?.utilization.activeWorkers).toBe(1);
        expect(snapshot?.utilization.idleWorkers).toBe(2);
      });

      it('should track task completions', async () => {
        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);

        await metricsManager.completeWork('worker-1', {
          orderId: 'WO-001',
          success: true,
          completedAt: new Date().toISOString(),
          filesModified: [],
        });

        const snapshot = metricsManager.getMetricsSnapshot();

        expect(snapshot?.completionStats.totalCompleted).toBe(1);
        expect(snapshot?.completionStats.successCount).toBe(1);
      });

      it('should track task failures', async () => {
        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);

        await metricsManager.failWork('worker-1', 'WO-001', new Error('Test failure'));

        const snapshot = metricsManager.getMetricsSnapshot();

        expect(snapshot?.completionStats.totalCompleted).toBe(1);
        expect(snapshot?.completionStats.failureCount).toBe(1);
      });
    });

    describe('exportMetrics', () => {
      it('should export metrics in Prometheus format', async () => {
        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);

        const exported = metricsManager.exportMetrics('prometheus');

        expect(exported).not.toBeNull();
        expect(exported).toContain('worker_pool_workers_total 3');
        expect(exported).toContain('worker_pool_workers_active 1');
      });

      it('should export metrics in JSON format', () => {
        const exported = metricsManager.exportMetrics('json');

        expect(exported).not.toBeNull();
        const parsed = JSON.parse(exported!);
        expect(parsed.utilization.totalWorkers).toBe(3);
      });

      it('should default to Prometheus format', () => {
        const exported = metricsManager.exportMetrics();

        expect(exported).toContain('# HELP');
        expect(exported).toContain('# TYPE');
      });
    });

    describe('onMetricsEvent', () => {
      it('should receive task_started event', async () => {
        const callback = vi.fn();
        metricsManager.onMetricsEvent(callback);

        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'task_started',
            data: expect.objectContaining({ orderId: 'WO-001' }),
          })
        );
      });

      it('should receive task_completed event', async () => {
        const callback = vi.fn();
        metricsManager.onMetricsEvent(callback);

        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);

        await metricsManager.completeWork('worker-1', {
          orderId: 'WO-001',
          success: true,
          completedAt: new Date().toISOString(),
          filesModified: [],
        });

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'task_completed',
            data: expect.objectContaining({ orderId: 'WO-001' }),
          })
        );
      });

      it('should not receive events when metrics disabled', async () => {
        const callback = vi.fn();
        manager.onMetricsEvent(callback);

        const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
        manager.assignWork('worker-1', order);

        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('resetMetrics', () => {
      it('should reset metrics data', async () => {
        const order = await metricsManager.createWorkOrder(createIssueNode('ISS-001'));
        metricsManager.assignWork('worker-1', order);
        await metricsManager.completeWork('worker-1', {
          orderId: 'WO-001',
          success: true,
          completedAt: new Date().toISOString(),
          filesModified: [],
        });

        metricsManager.resetMetrics();

        const snapshot = metricsManager.getMetricsSnapshot();
        expect(snapshot?.completionStats.totalCompleted).toBe(0);
      });

      it('should be safe to call when metrics disabled', () => {
        expect(() => manager.resetMetrics()).not.toThrow();
      });
    });

    describe('getMetricsCollector', () => {
      it('should return metrics collector when enabled', () => {
        const collector = metricsManager.getMetricsCollector();

        expect(collector).not.toBeNull();
        expect(collector?.isEnabled()).toBe(true);
      });

      it('should return null when metrics disabled', () => {
        const collector = manager.getMetricsCollector();

        expect(collector).toBeNull();
      });
    });
  });
});
