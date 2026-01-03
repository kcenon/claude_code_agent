/**
 * Multi-Agent Orchestration E2E Tests
 *
 * Tests the orchestration and coordination between multiple agents.
 * Validates proper handoffs, state management, parallel execution,
 * and conflict resolution.
 *
 * @see Issue #55 - Multi-agent orchestration and coordination tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import {
  createTestEnvironment,
  resetAllAgents,
  sleep,
  type TestEnvironment,
} from './helpers/test-environment.js';
import {
  WorkerPoolManager,
  PriorityAnalyzer,
  type IssueNode,
  type AnalyzedIssue,
  type WorkOrder,
  type WorkOrderResult,
  type RawDependencyGraph,
} from '../../src/controller/index.js';

describe('Multi-Agent Orchestration', () => {
  let env: TestEnvironment;
  let testDir: string;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-orchestration',
      initScratchpad: true,
      initGit: true,
    });
    testDir = path.join(tmpdir(), `orchestration-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
    if (fs.existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a mock IssueNode
   */
  function createIssueNode(
    id: string,
    priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P1',
    dependencies: string[] = []
  ): IssueNode {
    return {
      id,
      title: `Issue ${id}: Test Task`,
      priority,
      effort: 4,
      status: 'pending',
    };
  }

  /**
   * Helper to create a mock AnalyzedIssue
   */
  function createAnalyzedIssue(
    id: string,
    priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P1',
    priorityScore: number = 75,
    dependencies: string[] = [],
    dependenciesResolved: boolean = true
  ): AnalyzedIssue {
    return {
      node: createIssueNode(id, priority),
      dependencies,
      dependents: [],
      transitiveDependencies: [],
      depth: dependencies.length,
      priorityScore,
      isOnCriticalPath: false,
      dependenciesResolved,
    };
  }

  /**
   * Helper to create a mock dependency graph
   */
  function createDependencyGraph(issues: IssueNode[], edges: [string, string][]): RawDependencyGraph {
    return {
      nodes: issues,
      edges: edges.map(([from, to]) => ({ from, to })),
    };
  }

  /**
   * Helper to simulate work completion
   */
  function createSuccessResult(orderId: string, filesModified: string[] = []): WorkOrderResult {
    return {
      orderId,
      success: true,
      completedAt: new Date().toISOString(),
      filesModified,
    };
  }

  /**
   * Helper to simulate work failure
   */
  function createFailureResult(orderId: string, error: string): WorkOrderResult {
    return {
      orderId,
      success: false,
      completedAt: new Date().toISOString(),
      filesModified: [],
      error,
    };
  }

  describe('Controller → Worker(s) Distribution', () => {
    it('should distribute work to available workers correctly', async () => {
      // Given: A pool of 3 workers and 3 issues to process
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const issues = [
        createIssueNode('ISS-001', 'P0'),
        createIssueNode('ISS-002', 'P1'),
        createIssueNode('ISS-003', 'P2'),
      ];

      // When: Distributing work to workers
      const assignments: { workerId: string; order: WorkOrder }[] = [];

      for (const issue of issues) {
        const slot = manager.getAvailableSlot();
        expect(slot).not.toBeNull();

        const order = await manager.createWorkOrder(issue);
        manager.assignWork(slot!, order);
        assignments.push({ workerId: slot!, order });
      }

      // Then: All workers should be busy
      const status = manager.getStatus();
      expect(status.workingWorkers).toBe(3);
      expect(status.idleWorkers).toBe(0);
      expect(assignments.length).toBe(3);

      // Verify each assignment is unique
      const workerIds = new Set(assignments.map((a) => a.workerId));
      expect(workerIds.size).toBe(3);
    });

    it('should track work orders in progress', async () => {
      // Given: A worker processing an issue
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const issue = createIssueNode('ISS-001', 'P0');
      const order = await manager.createWorkOrder(issue);
      const slot = manager.getAvailableSlot()!;
      manager.assignWork(slot, order);

      // When: Checking if work is in progress
      const isInProgress = manager.isInProgress('ISS-001');
      const isNotInProgress = manager.isInProgress('ISS-999');

      // Then: Should correctly track in-progress work
      expect(isInProgress).toBe(true);
      expect(isNotInProgress).toBe(false);
    });

    it('should return null when all workers are busy', async () => {
      // Given: All workers are assigned
      const manager = new WorkerPoolManager({
        maxWorkers: 2,
        workOrdersPath: testDir,
      });

      for (let i = 1; i <= 2; i++) {
        const issue = createIssueNode(`ISS-00${i}`);
        const order = await manager.createWorkOrder(issue);
        const slot = manager.getAvailableSlot()!;
        manager.assignWork(slot, order);
      }

      // When: Requesting another slot
      const slot = manager.getAvailableSlot();

      // Then: No slot should be available
      expect(slot).toBeNull();
    });
  });

  describe('State Persistence Between Agents', () => {
    it('should save and restore controller state correctly', async () => {
      // Given: A controller with active work
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const issue1 = createIssueNode('ISS-001', 'P0');
      const issue2 = createIssueNode('ISS-002', 'P1');

      const order1 = await manager.createWorkOrder(issue1);
      manager.assignWork('worker-1', order1);
      manager.enqueue('ISS-003', 50);

      // Complete one order
      await manager.completeWork('worker-1', createSuccessResult('WO-001', ['src/feature.ts']));

      // Assign second order
      const order2 = await manager.createWorkOrder(issue2);
      manager.assignWork('worker-2', order2);

      // When: Saving and loading state
      await manager.saveState('test-project');

      const newManager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const state = await newManager.loadState('test-project');

      // Then: State should be restored correctly
      expect(state).not.toBeNull();
      expect(state?.projectId).toBe('test-project');
      expect(state?.completedOrders).toContain('WO-001');
      expect(state?.workQueue.length).toBe(1);
      expect(state?.workerPool.workingWorkers).toBe(1);
    });

    it('should preserve work order files on disk', async () => {
      // Given: Work orders created
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const issues = ['ISS-001', 'ISS-002', 'ISS-003'];
      for (const id of issues) {
        await manager.createWorkOrder(createIssueNode(id));
      }

      // When: Checking disk
      const workOrdersDir = path.join(testDir, 'work_orders');

      // Then: Work order files should exist
      expect(fs.existsSync(workOrdersDir)).toBe(true);
      expect(fs.existsSync(path.join(workOrdersDir, 'WO-001.json'))).toBe(true);
      expect(fs.existsSync(path.join(workOrdersDir, 'WO-002.json'))).toBe(true);
      expect(fs.existsSync(path.join(workOrdersDir, 'WO-003.json'))).toBe(true);

      // Verify content
      const orderContent = JSON.parse(
        fs.readFileSync(path.join(workOrdersDir, 'WO-001.json'), 'utf-8')
      ) as WorkOrder;
      expect(orderContent.issueId).toBe('ISS-001');
    });

    it('should handle state recovery after simulated crash', async () => {
      // Given: A controller with state saved before crash
      const manager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });

      // Set up some work
      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001', 'P0'));
      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002', 'P1'));
      manager.assignWork('worker-1', order1);
      manager.assignWork('worker-2', order2);
      manager.enqueue('ISS-003', 75);
      manager.enqueue('ISS-004', 50);

      // Save state (simulating checkpoint before crash)
      await manager.saveState('recovery-test');

      // Simulate crash - create new manager instance
      const recoveredManager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });

      // When: Recovering state
      const state = await recoveredManager.loadState('recovery-test');

      // Then: State should be recovered
      expect(state).not.toBeNull();
      expect(state?.workerPool.workingWorkers).toBe(2);
      expect(state?.workQueue.length).toBe(2);

      // Queue should maintain priority order
      expect(state?.workQueue[0]?.issueId).toBe('ISS-003'); // Higher priority
      expect(state?.workQueue[1]?.issueId).toBe('ISS-004');
    });
  });

  describe('Parallel Worker Execution (3-5 workers)', () => {
    it('should handle 5 concurrent workers without conflict', async () => {
      // Given: 5 workers and 10 issues to process
      const manager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });

      const completionOrder: string[] = [];
      const completionCallback = vi.fn((workerId: string, result: WorkOrderResult) => {
        completionOrder.push(result.orderId);
      });
      manager.onCompletion(completionCallback);

      // Create 10 issues
      const issues = Array.from({ length: 10 }, (_, i) =>
        createIssueNode(`ISS-${String(i + 1).padStart(3, '0')}`, i < 3 ? 'P0' : 'P1')
      );

      // Process first batch (5 workers)
      const firstBatch: WorkOrder[] = [];
      for (let i = 0; i < 5; i++) {
        const slot = manager.getAvailableSlot();
        expect(slot).not.toBeNull();
        const order = await manager.createWorkOrder(issues[i]!);
        manager.assignWork(slot!, order);
        firstBatch.push(order);
      }

      // When: All 5 workers complete
      const status = manager.getStatus();
      expect(status.workingWorkers).toBe(5);
      expect(status.idleWorkers).toBe(0);

      // Complete all first batch
      for (let i = 0; i < 5; i++) {
        const workerId = `worker-${i + 1}`;
        await manager.completeWork(workerId, createSuccessResult(firstBatch[i]!.orderId));
      }

      // Then: Workers should be available for second batch
      const statusAfter = manager.getStatus();
      expect(statusAfter.workingWorkers).toBe(0);
      expect(statusAfter.idleWorkers).toBe(5);
      expect(completionCallback).toHaveBeenCalledTimes(5);

      // Process second batch
      for (let i = 5; i < 10; i++) {
        const slot = manager.getAvailableSlot();
        expect(slot).not.toBeNull();
        const order = await manager.createWorkOrder(issues[i]!);
        manager.assignWork(slot!, order);
      }

      const statusSecondBatch = manager.getStatus();
      expect(statusSecondBatch.workingWorkers).toBe(5);
    });

    it('should maintain proper load balancing across workers', async () => {
      // Given: Pool with 3 workers
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const workerTaskCounts = new Map<string, number>();

      // When: Processing 9 tasks (3 rounds)
      for (let round = 0; round < 3; round++) {
        // Assign work to all workers
        const assignments: { workerId: string; order: WorkOrder }[] = [];
        for (let i = 0; i < 3; i++) {
          const slot = manager.getAvailableSlot()!;
          const issue = createIssueNode(`ISS-${round * 3 + i + 1}`);
          const order = await manager.createWorkOrder(issue);
          manager.assignWork(slot, order);
          assignments.push({ workerId: slot, order });

          const count = workerTaskCounts.get(slot) ?? 0;
          workerTaskCounts.set(slot, count + 1);
        }

        // Complete all work
        for (const { workerId, order } of assignments) {
          await manager.completeWork(workerId, createSuccessResult(order.orderId));
        }
      }

      // Then: Each worker should have processed 3 tasks
      expect(workerTaskCounts.size).toBe(3);
      for (const [workerId, count] of workerTaskCounts) {
        expect(count).toBe(3);
        const worker = manager.getWorker(workerId);
        expect(worker.completedTasks).toBe(3);
      }
    });

    it('should handle parallel work completion callbacks', async () => {
      // Given: Multiple workers completing simultaneously
      const manager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });

      const completions: { workerId: string; orderId: string }[] = [];
      manager.onCompletion(async (workerId, result) => {
        // Simulate some async processing
        await sleep(10);
        completions.push({ workerId, orderId: result.orderId });
      });

      // Assign work to all 5 workers
      const orders: WorkOrder[] = [];
      for (let i = 0; i < 5; i++) {
        const issue = createIssueNode(`ISS-00${i + 1}`);
        const order = await manager.createWorkOrder(issue);
        manager.assignWork(`worker-${i + 1}`, order);
        orders.push(order);
      }

      // When: All workers complete concurrently
      await Promise.all(
        orders.map((order, i) =>
          manager.completeWork(`worker-${i + 1}`, createSuccessResult(order.orderId))
        )
      );

      // Then: All completions should be recorded
      expect(completions.length).toBe(5);
      const completedOrderIds = new Set(completions.map((c) => c.orderId));
      expect(completedOrderIds.size).toBe(5);
    });
  });

  describe('Resource Contention Handling', () => {
    it('should handle concurrent work order creation', async () => {
      // Given: Multiple concurrent work order creations
      const manager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });

      const issues = Array.from({ length: 10 }, (_, i) =>
        createIssueNode(`ISS-${String(i + 1).padStart(3, '0')}`)
      );

      // When: Creating work orders concurrently
      const orders = await Promise.all(issues.map((issue) => manager.createWorkOrder(issue)));

      // Then: All orders should have unique IDs
      const orderIds = new Set(orders.map((o) => o.orderId));
      expect(orderIds.size).toBe(10);

      // Verify sequential IDs
      for (let i = 0; i < 10; i++) {
        expect(orders[i]?.orderId).toBe(`WO-${String(i + 1).padStart(3, '0')}`);
      }
    });

    it('should prevent duplicate worker assignments', async () => {
      // Given: A worker with assigned work
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001'));
      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002'));

      manager.assignWork('worker-1', order1);

      // When: Trying to assign to already busy worker
      // Then: Should throw WorkerNotAvailableError
      expect(() => manager.assignWork('worker-1', order2)).toThrow();
    });

    it('should handle work queue priority correctly under contention', async () => {
      // Given: Multiple issues with different priorities
      const manager = new WorkerPoolManager({
        maxWorkers: 2,
        workOrdersPath: testDir,
      });

      // Enqueue items with different priorities (out of order)
      manager.enqueue('ISS-LOW', 25);     // P3
      manager.enqueue('ISS-CRITICAL', 100); // P0
      manager.enqueue('ISS-MEDIUM', 50);  // P2
      manager.enqueue('ISS-HIGH', 75);    // P1

      // When: Dequeuing items
      const dequeueOrder: string[] = [];
      let next: string | null;
      while ((next = manager.dequeue()) !== null) {
        dequeueOrder.push(next);
      }

      // Then: Should be in priority order (highest first)
      expect(dequeueOrder).toEqual(['ISS-CRITICAL', 'ISS-HIGH', 'ISS-MEDIUM', 'ISS-LOW']);
    });
  });

  describe('Deadlock Prevention', () => {
    it('should not deadlock when workers complete in different order', async () => {
      // Given: Workers completing in non-sequential order
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const orders: WorkOrder[] = [];
      for (let i = 0; i < 3; i++) {
        const order = await manager.createWorkOrder(createIssueNode(`ISS-00${i + 1}`));
        manager.assignWork(`worker-${i + 1}`, order);
        orders.push(order);
      }

      // When: Completing in reverse order (3, 2, 1)
      await manager.completeWork('worker-3', createSuccessResult(orders[2]!.orderId));
      await manager.completeWork('worker-1', createSuccessResult(orders[0]!.orderId));
      await manager.completeWork('worker-2', createSuccessResult(orders[1]!.orderId));

      // Then: All workers should be idle and no deadlock
      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(3);
      expect(status.workingWorkers).toBe(0);
      expect(manager.getCompletedOrders().length).toBe(3);
    });

    it('should handle interleaved assignments and completions', async () => {
      // Given: Interleaved work assignments and completions
      const manager = new WorkerPoolManager({
        maxWorkers: 2,
        workOrdersPath: testDir,
      });

      // When: Interleaving operations
      const order1 = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order1);

      const order2 = await manager.createWorkOrder(createIssueNode('ISS-002'));
      manager.assignWork('worker-2', order2);

      // Complete first, assign new work to first
      await manager.completeWork('worker-1', createSuccessResult(order1.orderId));

      const order3 = await manager.createWorkOrder(createIssueNode('ISS-003'));
      manager.assignWork('worker-1', order3);

      // Complete second
      await manager.completeWork('worker-2', createSuccessResult(order2.orderId));

      // Complete third
      await manager.completeWork('worker-1', createSuccessResult(order3.orderId));

      // Then: No deadlock, all completed
      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(2);
      expect(manager.getCompletedOrders().length).toBe(3);
    });

    it('should handle rapid assign-complete cycles without deadlock', async () => {
      // Given: Many rapid cycles
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      // When: Running 50 rapid cycles
      for (let i = 0; i < 50; i++) {
        const slot = manager.getAvailableSlot();
        expect(slot).not.toBeNull();

        const order = await manager.createWorkOrder(createIssueNode(`ISS-${i}`));
        manager.assignWork(slot!, order);
        await manager.completeWork(slot!, createSuccessResult(order.orderId));
      }

      // Then: All completed, no deadlock
      const status = manager.getStatus();
      expect(status.idleWorkers).toBe(3);
      expect(status.workingWorkers).toBe(0);
      expect(manager.getCompletedOrders().length).toBe(50);
    });
  });

  describe('Agent Failure and Recovery', () => {
    it('should handle worker failure and mark as error state', async () => {
      // Given: A worker processing work
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const failureCallback = vi.fn();
      manager.onFailure(failureCallback);

      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);

      // When: Worker fails
      const error = new Error('Build compilation failed');
      await manager.failWork('worker-1', order.orderId, error);

      // Then: Worker should be in error state
      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('error');
      expect(worker.lastError).toBe('Build compilation failed');
      expect(manager.getFailedOrders()).toContain('WO-001');
      expect(failureCallback).toHaveBeenCalledWith('worker-1', 'WO-001', error);
    });

    it('should allow worker reset after failure', async () => {
      // Given: A failed worker
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const order = await manager.createWorkOrder(createIssueNode('ISS-001'));
      manager.assignWork('worker-1', order);
      await manager.failWork('worker-1', order.orderId, new Error('Test error'));

      // When: Resetting the worker
      manager.resetWorker('worker-1');

      // Then: Worker should be idle and ready for new work
      const worker = manager.getWorker('worker-1');
      expect(worker.status).toBe('idle');
      expect(worker.lastError).toBeUndefined();

      // Should be able to assign new work
      const newOrder = await manager.createWorkOrder(createIssueNode('ISS-002'));
      manager.assignWork('worker-1', newOrder);
      expect(manager.getWorker('worker-1').status).toBe('working');
    });

    it('should track both successful and failed completions', async () => {
      // Given: Mixed success and failure results
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const orders: WorkOrder[] = [];
      for (let i = 0; i < 3; i++) {
        const order = await manager.createWorkOrder(createIssueNode(`ISS-00${i + 1}`));
        manager.assignWork(`worker-${i + 1}`, order);
        orders.push(order);
      }

      // When: Some succeed, some fail
      await manager.completeWork('worker-1', createSuccessResult(orders[0]!.orderId));
      await manager.completeWork('worker-2', createFailureResult(orders[1]!.orderId, 'Test failed'));
      await manager.completeWork('worker-3', createSuccessResult(orders[2]!.orderId));

      // Then: Should track correctly
      expect(manager.getCompletedOrders()).toContain('WO-001');
      expect(manager.getCompletedOrders()).toContain('WO-003');
      expect(manager.getFailedOrders()).toContain('WO-002');
      expect(manager.getCompletedOrders().length).toBe(2);
      expect(manager.getFailedOrders().length).toBe(1);
    });

    it('should handle task reassignment after worker failure', async () => {
      // Given: A failed worker with pending work
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      const issue = createIssueNode('ISS-001', 'P0');
      const order = await manager.createWorkOrder(issue);
      manager.assignWork('worker-1', order);

      // Worker fails
      await manager.failWork('worker-1', order.orderId, new Error('Worker crashed'));

      // When: Reassigning to another worker
      manager.resetWorker('worker-1'); // Reset failed worker

      // Create new order for same issue (simulating retry)
      const retryOrder = await manager.createWorkOrder(issue);
      const newSlot = manager.getAvailableSlot()!;
      manager.assignWork(newSlot, retryOrder);

      // Then: Work should be reassigned
      expect(manager.isInProgress('ISS-001')).toBe(true);

      // Complete successfully this time
      await manager.completeWork(newSlot, createSuccessResult(retryOrder.orderId));
      expect(manager.getCompletedOrders()).toContain(retryOrder.orderId);
    });

    it('should preserve state correctly after multiple failures', async () => {
      // Given: Multiple failures occurring
      const manager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });

      const orders: WorkOrder[] = [];
      for (let i = 0; i < 5; i++) {
        const order = await manager.createWorkOrder(createIssueNode(`ISS-00${i + 1}`));
        manager.assignWork(`worker-${i + 1}`, order);
        orders.push(order);
      }

      // Fail workers 1, 3, and 5
      await manager.failWork('worker-1', orders[0]!.orderId, new Error('Error 1'));
      await manager.completeWork('worker-2', createSuccessResult(orders[1]!.orderId));
      await manager.failWork('worker-3', orders[2]!.orderId, new Error('Error 3'));
      await manager.completeWork('worker-4', createSuccessResult(orders[3]!.orderId));
      await manager.failWork('worker-5', orders[4]!.orderId, new Error('Error 5'));

      // Save state
      await manager.saveState('failure-recovery-test');

      // When: Loading state in new manager
      const newManager = new WorkerPoolManager({
        maxWorkers: 5,
        workOrdersPath: testDir,
      });
      const state = await newManager.loadState('failure-recovery-test');

      // Then: State should reflect failures correctly
      expect(state).not.toBeNull();
      expect(state?.completedOrders.length).toBe(2);
      expect(state?.failedOrders.length).toBe(3);
      expect(state?.workerPool.errorWorkers).toBe(3);
      expect(state?.workerPool.idleWorkers).toBe(2);
    });
  });

  describe('Priority Analysis and Parallel Groups', () => {
    it('should correctly identify parallel execution groups', async () => {
      // Given: Issues with dependencies forming groups
      const analyzer = new PriorityAnalyzer();

      const issues: IssueNode[] = [
        { id: 'ISS-001', title: 'Task A', priority: 'P0', effort: 4, status: 'pending' },
        { id: 'ISS-002', title: 'Task B', priority: 'P0', effort: 4, status: 'pending' },
        { id: 'ISS-003', title: 'Task C', priority: 'P1', effort: 4, status: 'pending' },
        { id: 'ISS-004', title: 'Task D', priority: 'P1', effort: 4, status: 'pending' },
      ];

      const graph = createDependencyGraph(issues, [
        ['ISS-003', 'ISS-001'], // C depends on A
        ['ISS-004', 'ISS-002'], // D depends on B
      ]);

      // Write graph to temp file
      const graphPath = path.join(testDir, 'test-graph.json');
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

      // When: Analyzing the graph
      const loadedGraph = await analyzer.loadGraph(graphPath);
      const result = analyzer.analyze(loadedGraph);

      // Then: Should identify parallel groups
      expect(result.parallelGroups.length).toBeGreaterThan(0);

      // First group should contain ISS-001 and ISS-002 (no dependencies)
      const firstGroup = result.parallelGroups[0]!;
      expect(firstGroup.issueIds).toContain('ISS-001');
      expect(firstGroup.issueIds).toContain('ISS-002');
    });

    it('should determine correct execution order based on dependencies', async () => {
      // Given: Issues with chain dependencies
      const analyzer = new PriorityAnalyzer();

      const issues: IssueNode[] = [
        { id: 'ISS-001', title: 'Foundation', priority: 'P0', effort: 4, status: 'pending' },
        { id: 'ISS-002', title: 'Structure', priority: 'P1', effort: 8, status: 'pending' },
        { id: 'ISS-003', title: 'Finishing', priority: 'P2', effort: 4, status: 'pending' },
      ];

      const graph = createDependencyGraph(issues, [
        ['ISS-002', 'ISS-001'], // Structure depends on Foundation
        ['ISS-003', 'ISS-002'], // Finishing depends on Structure
      ]);

      const graphPath = path.join(testDir, 'chain-graph.json');
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

      // When: Analyzing
      const loadedGraph = await analyzer.loadGraph(graphPath);
      const result = analyzer.analyze(loadedGraph);

      // Then: Execution order should respect dependencies
      const order = result.executionOrder;
      expect(order.indexOf('ISS-001')).toBeLessThan(order.indexOf('ISS-002'));
      expect(order.indexOf('ISS-002')).toBeLessThan(order.indexOf('ISS-003'));
    });

    it('should detect and report circular dependencies', async () => {
      // Given: Issues with circular dependency
      const analyzer = new PriorityAnalyzer();

      const issues: IssueNode[] = [
        { id: 'ISS-001', title: 'Task A', priority: 'P0', effort: 4, status: 'pending' },
        { id: 'ISS-002', title: 'Task B', priority: 'P1', effort: 4, status: 'pending' },
        { id: 'ISS-003', title: 'Task C', priority: 'P1', effort: 4, status: 'pending' },
      ];

      const graph = createDependencyGraph(issues, [
        ['ISS-001', 'ISS-003'], // A depends on C
        ['ISS-002', 'ISS-001'], // B depends on A
        ['ISS-003', 'ISS-002'], // C depends on B (creates cycle)
      ]);

      const graphPath = path.join(testDir, 'circular-graph.json');
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

      // When: Analyze graph with cycles
      const loadedGraph = await analyzer.loadGraph(graphPath);
      const result = analyzer.analyze(loadedGraph);

      // Then: Should detect cycles gracefully without throwing
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.blockedByCycle.length).toBeGreaterThan(0);
      expect(analyzer.hasCycles()).toBe(true);

      // All nodes in the cycle should be blocked
      expect(result.blockedByCycle).toContain('ISS-001');
      expect(result.blockedByCycle).toContain('ISS-002');
      expect(result.blockedByCycle).toContain('ISS-003');
    });
  });

  describe('End-to-End Orchestration Flow', () => {
    it('should complete full orchestration cycle with multiple workers', async () => {
      // Given: A complete orchestration setup
      const analyzer = new PriorityAnalyzer();
      const manager = new WorkerPoolManager({
        maxWorkers: 3,
        workOrdersPath: testDir,
      });

      // Create a realistic issue set
      const issues: IssueNode[] = [
        { id: 'ISS-001', title: 'Setup project structure', priority: 'P0', effort: 2, status: 'pending' },
        { id: 'ISS-002', title: 'Implement core module', priority: 'P0', effort: 4, status: 'pending' },
        { id: 'ISS-003', title: 'Add API endpoints', priority: 'P1', effort: 4, status: 'pending' },
        { id: 'ISS-004', title: 'Write unit tests', priority: 'P1', effort: 4, status: 'pending' },
        { id: 'ISS-005', title: 'Add documentation', priority: 'P2', effort: 2, status: 'pending' },
      ];

      const graph = createDependencyGraph(issues, [
        ['ISS-002', 'ISS-001'], // Core depends on setup
        ['ISS-003', 'ISS-002'], // API depends on core
        ['ISS-004', 'ISS-002'], // Tests depend on core
        ['ISS-005', 'ISS-003'], // Docs depend on API
        ['ISS-005', 'ISS-004'], // Docs depend on tests
      ]);

      const graphPath = path.join(testDir, 'e2e-graph.json');
      fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

      // When: Running the orchestration
      const loadedGraph = await analyzer.loadGraph(graphPath);
      const analysis = analyzer.analyze(loadedGraph);

      const completedIssues: string[] = [];
      const processingLog: string[] = [];

      // Process in execution order
      for (const issueId of analysis.executionOrder) {
        const analyzedIssue = analysis.issues.get(issueId)!;

        // Wait for dependencies
        const depsResolved = analyzedIssue.dependencies.every((dep) =>
          completedIssues.includes(dep)
        );
        expect(depsResolved).toBe(true);

        // Get available worker
        const slot = manager.getAvailableSlot();
        if (slot !== null) {
          const order = await manager.createWorkOrder(analyzedIssue);
          manager.assignWork(slot, order);
          processingLog.push(`${slot} started ${issueId}`);

          // Simulate work completion
          await manager.completeWork(slot, createSuccessResult(order.orderId, [`src/${issueId}.ts`]));
          processingLog.push(`${slot} completed ${issueId}`);
          completedIssues.push(issueId);
        }
      }

      // Then: All issues should be completed
      expect(completedIssues.length).toBe(5);
      expect(manager.getCompletedOrders().length).toBe(5);

      // Verify order respects dependencies
      expect(completedIssues.indexOf('ISS-001')).toBeLessThan(completedIssues.indexOf('ISS-002'));
      expect(completedIssues.indexOf('ISS-002')).toBeLessThan(completedIssues.indexOf('ISS-003'));
      expect(completedIssues.indexOf('ISS-002')).toBeLessThan(completedIssues.indexOf('ISS-004'));
      expect(completedIssues.indexOf('ISS-003')).toBeLessThan(completedIssues.indexOf('ISS-005'));
      expect(completedIssues.indexOf('ISS-004')).toBeLessThan(completedIssues.indexOf('ISS-005'));
    });
  });
});
