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
          await manager.assignWork(slot, order);
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
      await manager.assignWork('worker-1', order);

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('working');
      expect(worker.currentIssue).toBe('ISS-001');
      expect(worker.startedAt).not.toBeNull();
    });

    it('should throw WorkerNotFoundError for invalid worker', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));

      await expect(manager.assignWork('worker-999', order)).rejects.toThrow(
        WorkerNotFoundError
      );
    });

    it('should throw WorkerNotAvailableError for busy worker', async () => {
      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001'));
      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002'));

      await manager.assignWork('worker-1', order1);

      await expect(manager.assignWork('worker-1', order2)).rejects.toThrow(
        WorkerNotAvailableError
      );
    });

    it('should update pool status after assignment', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);

      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(2);
      expect(status.workingWorkers).toBe(1);
    });

    it('should track active work orders', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);

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
      await manager.assignWork('worker-1', order);

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
      await manager.assignWork('worker-1', order);

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
      await manager.assignWork('worker-1', order);

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
      await manager.assignWork('worker-1', order);

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
      await manager.assignWork('worker-1', order);

      await manager.failWork('worker-1', 'WO-001', new Error('Test error'));

      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('error');
      expect(worker.lastError).toBe('Test error');
    });

    it('should track failed orders', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);

      await manager.failWork('worker-1', 'WO-001', new Error('Test error'));

      expect(manager.getFailedOrders()).toContain('WO-001');
    });

    it('should invoke failure callback', async () => {
      const callback = vi.fn();
      manager.onFailure(callback);

      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);

      const error = new Error('Test error');
      await manager.failWork('worker-1', 'WO-001', error);

      expect(callback).toHaveBeenCalledWith('worker-1', 'WO-001', error);
    });
  });

  describe('releaseWorker', () => {
    it('should release worker back to idle', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);

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
      await manager.assignWork('worker-1', order);
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
      await manager.assignWork('worker-1', order);

      expect(manager.isInProgress('ISS-001')).toBe(true);
    });

    it('should return false for unassigned issue', () => {
      expect(manager.isInProgress('ISS-999')).toBe(false);
    });
  });

  describe('state persistence', () => {
    it('should save state to disk', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);
      manager.enqueue('ISS-002', 75);

      await manager.saveState('test-project');

      const statePath = join(testDir, 'controller_state.json');
      expect(existsSync(statePath)).toBe(true);
    });

    it('should load state from disk', async () => {
      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      await manager.assignWork('worker-1', order);
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
      await manager.assignWork('worker-1', order);
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
      await manager.assignWork('worker-1', order);
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

      await manager.assignWork('worker-1', order1);
      await manager.assignWork('worker-2', order2);
      await manager.failWork('worker-2', 'WO-002', new Error('Test'));

      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(1);
      expect(status.workingWorkers).toBe(1);
      expect(status.errorWorkers).toBe(1);
    });
  });
});
