/**
 * Worker Pool Manager module
 *
 * Manages a pool of Worker Agents for parallel task execution.
 * Handles worker spawning, task assignment, and status tracking.
 *
 * NOTE: Distributed lock support for multi-process deployments is planned.
 * See Issue #247 for implementation details.
 * Currently uses in-memory Maps; for horizontal scaling, use Scratchpad's withLock.
 *
 * DONE(P2): Worker health checks implemented via WorkerHealthMonitor
 * See WorkerHealthMonitor.ts for heartbeat-based zombie detection
 * and automatic worker recovery. Integration methods added:
 * - markWorkerZombie(): Mark worker as zombie
 * - getWorkerTask(): Get current worker task
 * - reassignTask(): Reassign task from zombie worker
 * - respawnWorker(): Reset worker to healthy state
 * - getActiveWorkers(): Get workers for health monitoring
 *
 * NOTE: Worker pool metrics and observability are planned. See Issue #261.
 *
 * @module controller/WorkerPoolManager
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

import type {
  WorkerInfo,
  WorkerStatus,
  WorkerPoolConfig,
  WorkerPoolStatus,
  WorkOrder,
  WorkOrderResult,
  WorkOrderContext,
  WorkQueueEntry,
  ControllerState,
  WorkerCompletionCallback,
  WorkerFailureCallback,
  IssueNode,
  AnalyzedIssue,
  BoundedQueueConfig,
  EnqueueResult,
  QueueStatus,
  QueueEventCallback,
  DeadLetterEntry,
} from './types.js';
import { DEFAULT_WORKER_POOL_CONFIG } from './types.js';
import {
  WorkerNotFoundError,
  WorkerNotAvailableError,
  WorkOrderNotFoundError,
  WorkOrderCreationError,
  WorkerAssignmentError,
  ControllerStatePersistenceError,
} from './errors.js';
import { BoundedWorkQueue } from './BoundedWorkQueue.js';

/**
 * Internal mutable worker state
 */
interface MutableWorkerInfo {
  id: string;
  status: WorkerStatus;
  currentIssue: string | null;
  startedAt: string | null;
  completedTasks: number;
  lastError?: string;
}

/**
 * Worker Pool Manager
 *
 * Manages a pool of workers for concurrent task execution.
 * Provides work order creation, assignment, and lifecycle management.
 *
 * Now includes bounded queue support with:
 * - Configurable queue size limits
 * - Backpressure mechanism
 * - Rejection policies
 * - Dead letter queue
 * - Memory monitoring
 */
/**
 * Internal configuration type with optional queueConfig
 */
interface InternalWorkerPoolConfig {
  readonly maxWorkers: number;
  readonly workerTimeout: number;
  readonly workOrdersPath: string;
  readonly queueConfig: BoundedQueueConfig | undefined;
}

export class WorkerPoolManager {
  private readonly config: InternalWorkerPoolConfig;
  private readonly workers: Map<string, MutableWorkerInfo>;
  private readonly workOrders: Map<string, WorkOrder>;
  private readonly boundedQueue: BoundedWorkQueue | null;
  private readonly legacyQueue: Map<string, WorkQueueEntry>;
  private readonly completedOrders: Set<string>;
  private readonly failedOrders: Set<string>;
  private workOrderCounter: number;

  private onCompletionCallback?: WorkerCompletionCallback;
  private onFailureCallback?: WorkerFailureCallback;

  constructor(config: WorkerPoolConfig = {}) {
    this.config = {
      maxWorkers: config.maxWorkers ?? DEFAULT_WORKER_POOL_CONFIG.maxWorkers,
      workerTimeout: config.workerTimeout ?? DEFAULT_WORKER_POOL_CONFIG.workerTimeout,
      workOrdersPath: config.workOrdersPath ?? DEFAULT_WORKER_POOL_CONFIG.workOrdersPath,
      queueConfig: config.queueConfig,
    };

    this.workers = new Map();
    this.workOrders = new Map();
    this.completedOrders = new Set();
    this.failedOrders = new Set();
    this.workOrderCounter = 0;

    // Initialize bounded queue if config provided, otherwise use legacy queue
    if (config.queueConfig !== undefined) {
      this.boundedQueue = new BoundedWorkQueue(config.queueConfig);
      this.legacyQueue = new Map(); // Not used but kept for type safety
    } else {
      this.boundedQueue = null;
      this.legacyQueue = new Map();
    }

    this.initializeWorkers();
  }

  /**
   * Initialize worker pool with idle workers
   */
  private initializeWorkers(): void {
    for (let i = 1; i <= this.config.maxWorkers; i++) {
      const workerId = `worker-${String(i)}`;
      this.workers.set(workerId, {
        id: workerId,
        status: 'idle',
        currentIssue: null,
        startedAt: null,
        completedTasks: 0,
      });
    }
  }

  /**
   * Get the pool status
   */
  public getStatus(): WorkerPoolStatus {
    const workerList = Array.from(this.workers.values());
    const idleCount = workerList.filter((w) => w.status === 'idle').length;
    const workingCount = workerList.filter((w) => w.status === 'working').length;
    const errorCount = workerList.filter((w) => w.status === 'error').length;

    const activeOrders: string[] = [];
    for (const worker of workerList) {
      if (worker.status === 'working' && worker.currentIssue !== null) {
        const order = this.findOrderByIssueId(worker.currentIssue);
        if (order !== undefined) {
          activeOrders.push(order.orderId);
        }
      }
    }

    return {
      totalWorkers: this.config.maxWorkers,
      idleWorkers: idleCount,
      workingWorkers: workingCount,
      errorWorkers: errorCount,
      workers: workerList.map((w) => this.toWorkerInfo(w)),
      activeWorkOrders: activeOrders,
    };
  }

  /**
   * Convert mutable worker to readonly WorkerInfo
   */
  private toWorkerInfo(worker: MutableWorkerInfo): WorkerInfo {
    const base = {
      id: worker.id,
      status: worker.status,
      currentIssue: worker.currentIssue,
      startedAt: worker.startedAt,
      completedTasks: worker.completedTasks,
    };

    if (worker.lastError !== undefined) {
      return { ...base, lastError: worker.lastError };
    }

    return base;
  }

  /**
   * Find a work order by issue ID
   */
  private findOrderByIssueId(issueId: string): WorkOrder | undefined {
    for (const order of this.workOrders.values()) {
      if (order.issueId === issueId) {
        return order;
      }
    }
    return undefined;
  }

  /**
   * Get an available worker slot
   * @returns Worker ID if available, null otherwise
   */
  public getAvailableSlot(): string | null {
    for (const worker of this.workers.values()) {
      if (worker.status === 'idle') {
        return worker.id;
      }
    }
    return null;
  }

  /**
   * Get worker info by ID
   * @throws WorkerNotFoundError if worker doesn't exist
   */
  public getWorker(workerId: string): WorkerInfo {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }
    return this.toWorkerInfo(worker);
  }

  /**
   * Get worker status by ID
   * @throws WorkerNotFoundError if worker doesn't exist
   */
  public getWorkerStatus(workerId: string): WorkerStatus {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }
    return worker.status;
  }

  /**
   * Create a work order for an issue
   */
  public async createWorkOrder(
    issue: IssueNode | AnalyzedIssue,
    context: Partial<WorkOrderContext> = {}
  ): Promise<WorkOrder> {
    const issueNode = 'node' in issue ? issue.node : issue;
    const analyzed = 'node' in issue ? issue : undefined;

    this.workOrderCounter++;
    const orderId = `WO-${String(this.workOrderCounter).padStart(3, '0')}`;

    const dependenciesStatus =
      analyzed !== undefined
        ? analyzed.dependencies.map((depId) => ({
            issueId: depId,
            status: 'completed' as const,
          }))
        : (context.dependenciesStatus ?? []);

    // Build context with proper optional property handling
    const workOrderContext: WorkOrderContext = {
      relatedFiles: context.relatedFiles ?? [],
      dependenciesStatus,
    };

    // Only add optional properties if they have values
    if (context.sdsComponent !== undefined) {
      (workOrderContext as { sdsComponent: string }).sdsComponent = context.sdsComponent;
    }
    if (context.srsFeature !== undefined) {
      (workOrderContext as { srsFeature: string }).srsFeature = context.srsFeature;
    }
    if (context.prdRequirement !== undefined) {
      (workOrderContext as { prdRequirement: string }).prdRequirement = context.prdRequirement;
    }

    // Build base work order
    const baseWorkOrder = {
      orderId,
      issueId: issueNode.id,
      createdAt: new Date().toISOString(),
      priority:
        analyzed !== undefined ? analyzed.priorityScore : this.getPriorityValue(issueNode.priority),
      context: workOrderContext,
      acceptanceCriteria: [] as readonly string[],
    };

    // Add optional issueUrl if present
    const workOrder: WorkOrder =
      issueNode.url !== undefined ? { ...baseWorkOrder, issueUrl: issueNode.url } : baseWorkOrder;

    this.workOrders.set(orderId, workOrder);

    try {
      await this.persistWorkOrder(workOrder);
    } catch (error) {
      this.workOrders.delete(orderId);
      throw new WorkOrderCreationError(issueNode.id, error instanceof Error ? error : undefined);
    }

    return workOrder;
  }

  /**
   * Get priority numeric value from priority string
   */
  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'P0':
        return 100;
      case 'P1':
        return 75;
      case 'P2':
        return 50;
      case 'P3':
        return 25;
      default:
        return 0;
    }
  }

  /**
   * Persist a work order to disk
   */
  private async persistWorkOrder(workOrder: WorkOrder): Promise<void> {
    const projectPath = this.config.workOrdersPath;
    const workOrdersDir = join(projectPath, 'work_orders');

    if (!existsSync(workOrdersDir)) {
      await mkdir(workOrdersDir, { recursive: true });
    }

    const filePath = join(workOrdersDir, `${workOrder.orderId}.json`);
    await writeFile(filePath, JSON.stringify(workOrder, null, 2), 'utf-8');
  }

  /**
   * Assign work to a worker
   * @throws WorkerNotFoundError if worker doesn't exist
   * @throws WorkerNotAvailableError if worker is not idle
   * @throws WorkerAssignmentError if assignment fails
   */
  public assignWork(workerId: string, workOrder: WorkOrder): void {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    if (worker.status !== 'idle') {
      throw new WorkerNotAvailableError(workerId, worker.status);
    }

    try {
      // Update worker status
      worker.status = 'working';
      worker.currentIssue = workOrder.issueId;
      worker.startedAt = new Date().toISOString();

      // Remove from queue if present
      if (this.boundedQueue !== null) {
        this.boundedQueue.remove(workOrder.issueId);
      } else {
        this.legacyQueue.delete(workOrder.issueId);
      }
    } catch (error) {
      // Rollback on failure
      worker.status = 'idle';
      worker.currentIssue = null;
      worker.startedAt = null;

      throw new WorkerAssignmentError(
        workerId,
        workOrder.issueId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a work order by ID
   * @throws WorkOrderNotFoundError if order doesn't exist
   */
  public getWorkOrder(orderId: string): WorkOrder {
    const order = this.workOrders.get(orderId);
    if (order === undefined) {
      throw new WorkOrderNotFoundError(orderId);
    }
    return order;
  }

  /**
   * Mark a worker as completed
   */
  public async completeWork(workerId: string, result: WorkOrderResult): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    // Update worker status
    worker.status = 'idle';
    worker.currentIssue = null;
    worker.startedAt = null;
    worker.completedTasks++;

    // Track completion
    if (result.success) {
      this.completedOrders.add(result.orderId);
    } else {
      this.failedOrders.add(result.orderId);
      if (result.error !== undefined) {
        worker.lastError = result.error;
      }
    }

    // Invoke callback
    if (this.onCompletionCallback !== undefined) {
      await this.onCompletionCallback(workerId, result);
    }
  }

  /**
   * Mark a worker as failed
   */
  public async failWork(workerId: string, orderId: string, error: Error): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    // Update worker status
    worker.status = 'error';
    worker.lastError = error.message;

    // Track failure
    this.failedOrders.add(orderId);

    // Invoke callback
    if (this.onFailureCallback !== undefined) {
      await this.onFailureCallback(workerId, orderId, error);
    }
  }

  /**
   * Release a worker back to idle state
   */
  public releaseWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    worker.status = 'idle';
    worker.currentIssue = null;
    worker.startedAt = null;
    delete worker.lastError;
  }

  /**
   * Reset a worker from error state
   */
  public resetWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    worker.status = 'idle';
    worker.currentIssue = null;
    worker.startedAt = null;
    delete worker.lastError;
  }

  /**
   * Add an issue to the work queue
   *
   * If bounded queue is enabled, this will apply size limits and backpressure.
   * Use enqueueBounded() for explicit result handling with bounded queue.
   */
  public enqueue(issueId: string, priorityScore: number): void {
    if (this.boundedQueue !== null) {
      // Fire and forget for backward compatibility
      void this.boundedQueue.enqueue(issueId, priorityScore);
    } else {
      this.legacyQueue.set(issueId, {
        issueId,
        priorityScore,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      });
    }
  }

  /**
   * Add an issue to the work queue with result handling
   *
   * Only available when bounded queue is enabled.
   * Returns detailed result including success/failure reason and backpressure info.
   *
   * @throws Error if bounded queue is not enabled
   */
  public async enqueueBounded(issueId: string, priorityScore: number): Promise<EnqueueResult> {
    if (this.boundedQueue === null) {
      throw new Error('Bounded queue is not enabled. Configure queueConfig to use this method.');
    }
    return await this.boundedQueue.enqueue(issueId, priorityScore);
  }

  /**
   * Get the next issue from the work queue
   * @returns The highest priority issue ID, or null if queue is empty
   */
  public dequeue(): string | null {
    if (this.boundedQueue !== null) {
      // Synchronous wrapper - bounded queue dequeue is async but we need sync here
      // For full async support, use dequeueBounded()
      const entries = this.boundedQueue.getAll();
      if (entries.length === 0) {
        return null;
      }
      const next = entries[0];
      if (next !== undefined) {
        this.boundedQueue.remove(next.issueId);
        return next.issueId;
      }
      return null;
    }

    if (this.legacyQueue.size === 0) {
      return null;
    }

    // Sort by priority score (descending)
    const sorted = Array.from(this.legacyQueue.values()).sort(
      (a, b) => b.priorityScore - a.priorityScore
    );

    const next = sorted[0];
    if (next !== undefined) {
      this.legacyQueue.delete(next.issueId);
      return next.issueId;
    }

    return null;
  }

  /**
   * Get the next issue from the work queue (async version)
   *
   * Recommended when using bounded queue for proper event handling.
   */
  public async dequeueBounded(): Promise<string | null> {
    if (this.boundedQueue !== null) {
      return await this.boundedQueue.dequeue();
    }
    return this.dequeue();
  }

  /**
   * Get the work queue entries
   */
  public getQueue(): readonly WorkQueueEntry[] {
    if (this.boundedQueue !== null) {
      return this.boundedQueue.getAll();
    }
    return Array.from(this.legacyQueue.values()).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get the queue size
   */
  public getQueueSize(): number {
    if (this.boundedQueue !== null) {
      return this.boundedQueue.size;
    }
    return this.legacyQueue.size;
  }

  /**
   * Check if an issue is in the queue
   */
  public isQueued(issueId: string): boolean {
    if (this.boundedQueue !== null) {
      return this.boundedQueue.has(issueId);
    }
    return this.legacyQueue.has(issueId);
  }

  /**
   * Get bounded queue status
   *
   * Only available when bounded queue is enabled.
   * Returns detailed status including utilization, backpressure state, memory usage.
   */
  public getQueueStatus(): QueueStatus | null {
    if (this.boundedQueue === null) {
      return null;
    }
    return this.boundedQueue.getStatus();
  }

  /**
   * Set event callback for queue notifications
   *
   * Only effective when bounded queue is enabled.
   */
  public onQueueEvent(callback: QueueEventCallback): void {
    if (this.boundedQueue !== null) {
      this.boundedQueue.onEvent(callback);
    }
  }

  /**
   * Check if bounded queue is enabled
   */
  public isBoundedQueueEnabled(): boolean {
    return this.boundedQueue !== null;
  }

  /**
   * Get dead letter queue entries
   *
   * Only available when bounded queue is enabled.
   */
  public getDeadLetterQueue(): readonly DeadLetterEntry[] {
    if (this.boundedQueue === null) {
      return [];
    }
    return this.boundedQueue.getDeadLetterQueue();
  }

  /**
   * Retry a task from the dead letter queue
   *
   * Only available when bounded queue is enabled.
   */
  public async retryFromDeadLetter(issueId: string): Promise<boolean> {
    if (this.boundedQueue === null) {
      return false;
    }
    return await this.boundedQueue.retryFromDeadLetter(issueId);
  }

  /**
   * Check if an issue is being worked on
   */
  public isInProgress(issueId: string): boolean {
    for (const worker of this.workers.values()) {
      if (worker.currentIssue === issueId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Set completion callback
   */
  public onCompletion(callback: WorkerCompletionCallback): void {
    this.onCompletionCallback = callback;
  }

  /**
   * Set failure callback
   */
  public onFailure(callback: WorkerFailureCallback): void {
    this.onFailureCallback = callback;
  }

  /**
   * Get completed order IDs
   */
  public getCompletedOrders(): readonly string[] {
    return Array.from(this.completedOrders);
  }

  /**
   * Get failed order IDs
   */
  public getFailedOrders(): readonly string[] {
    return Array.from(this.failedOrders);
  }

  /**
   * Save controller state to disk
   */
  public async saveState(projectId: string): Promise<void> {
    const state: ControllerState = {
      projectId,
      lastUpdated: new Date().toISOString(),
      workerPool: this.getStatus(),
      workQueue: this.getQueue(),
      completedOrders: this.getCompletedOrders(),
      failedOrders: this.getFailedOrders(),
    };

    const statePath = join(this.config.workOrdersPath, 'controller_state.json');

    try {
      const dir = dirname(statePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
      await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      throw new ControllerStatePersistenceError('save', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Load controller state from disk
   */
  public async loadState(projectId: string): Promise<ControllerState | null> {
    const statePath = join(this.config.workOrdersPath, 'controller_state.json');

    if (!existsSync(statePath)) {
      return null;
    }

    try {
      const content = await readFile(statePath, 'utf-8');
      // Internal data saved by this class - use direct parse with type assertion
      const state = JSON.parse(content) as ControllerState;

      if (state.projectId !== projectId) {
        return null;
      }

      // Restore state
      this.restoreFromState(state);

      return state;
    } catch (error) {
      throw new ControllerStatePersistenceError('load', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Restore internal state from loaded state
   */
  private restoreFromState(state: ControllerState): void {
    // Restore workers
    for (const workerInfo of state.workerPool.workers) {
      const worker = this.workers.get(workerInfo.id);
      if (worker !== undefined) {
        worker.status = workerInfo.status;
        worker.currentIssue = workerInfo.currentIssue;
        worker.startedAt = workerInfo.startedAt;
        worker.completedTasks = workerInfo.completedTasks;
        if (workerInfo.lastError !== undefined) {
          worker.lastError = workerInfo.lastError;
        }
      }
    }

    // Restore queue
    if (this.boundedQueue !== null) {
      this.boundedQueue.clear();
      for (const entry of state.workQueue) {
        void this.boundedQueue.enqueue(entry.issueId, entry.priorityScore);
      }
    } else {
      this.legacyQueue.clear();
      for (const entry of state.workQueue) {
        this.legacyQueue.set(entry.issueId, entry);
      }
    }

    // Restore completed/failed orders
    this.completedOrders.clear();
    for (const orderId of state.completedOrders) {
      this.completedOrders.add(orderId);
    }

    this.failedOrders.clear();
    for (const orderId of state.failedOrders) {
      this.failedOrders.add(orderId);
    }
  }

  /**
   * Reset the worker pool to initial state
   */
  public reset(): void {
    this.workOrders.clear();

    if (this.boundedQueue !== null) {
      this.boundedQueue.clear();
      this.boundedQueue.clearDeadLetterQueue();
    } else {
      this.legacyQueue.clear();
    }

    this.completedOrders.clear();
    this.failedOrders.clear();
    this.workOrderCounter = 0;

    for (const worker of this.workers.values()) {
      worker.status = 'idle';
      worker.currentIssue = null;
      worker.startedAt = null;
      worker.completedTasks = 0;
      delete worker.lastError;
    }
  }

  // ============================================================================
  // Worker Health Check Support Methods
  // ============================================================================

  /**
   * Mark a worker as zombie and remove from active pool
   * @param workerId Worker to mark as zombie
   * @returns The issue ID that was being processed, if any
   */
  public markWorkerZombie(workerId: string): string | null {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    const currentIssue = worker.currentIssue;

    // Mark worker as error state (closest equivalent to zombie)
    worker.status = 'error';
    worker.lastError = 'Worker became unresponsive (zombie)';

    return currentIssue;
  }

  /**
   * Get the current task/issue assigned to a worker
   * @param workerId Worker ID to check
   * @returns The issue ID being processed, or null if idle
   */
  public getWorkerTask(workerId: string): string | null {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    return worker.currentIssue;
  }

  /**
   * Reassign a task from one worker to another available worker
   * @param issueId Issue to reassign
   * @returns The new worker ID if reassigned, null if no worker available
   */
  public reassignTask(issueId: string): string | null {
    // Find the work order
    const workOrder = this.findOrderByIssueId(issueId);
    if (workOrder === undefined) {
      return null;
    }

    // Find available worker
    const availableWorkerId = this.getAvailableSlot();
    if (availableWorkerId === null) {
      // Re-queue the task for later processing
      const order = this.workOrders.get(workOrder.orderId);
      if (order !== undefined) {
        this.enqueue(issueId, order.priority);
      }
      return null;
    }

    // Assign to new worker
    this.assignWork(availableWorkerId, workOrder);

    return availableWorkerId;
  }

  /**
   * Respawn a worker (reset to idle state for health recovery)
   * @param workerId Worker to respawn
   */
  public respawnWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      throw new WorkerNotFoundError(workerId);
    }

    // Reset worker to idle state
    worker.status = 'idle';
    worker.currentIssue = null;
    worker.startedAt = null;
    delete worker.lastError;
  }

  /**
   * Get all active workers (for health monitoring)
   */
  public getActiveWorkers(): readonly WorkerInfo[] {
    return Array.from(this.workers.values()).map((w) => this.toWorkerInfo(w));
  }
}
