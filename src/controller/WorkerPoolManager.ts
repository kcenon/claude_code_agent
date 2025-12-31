/**
 * Worker Pool Manager module
 *
 * Manages a pool of Worker Agents for parallel task execution.
 * Handles worker spawning, task assignment, and status tracking.
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
 */
export class WorkerPoolManager {
  private readonly config: Required<WorkerPoolConfig>;
  private readonly workers: Map<string, MutableWorkerInfo>;
  private readonly workOrders: Map<string, WorkOrder>;
  private readonly workQueue: Map<string, WorkQueueEntry>;
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
    };

    this.workers = new Map();
    this.workOrders = new Map();
    this.workQueue = new Map();
    this.completedOrders = new Set();
    this.failedOrders = new Set();
    this.workOrderCounter = 0;

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
      this.workQueue.delete(workOrder.issueId);
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
   */
  public enqueue(issueId: string, priorityScore: number): void {
    this.workQueue.set(issueId, {
      issueId,
      priorityScore,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });
  }

  /**
   * Get the next issue from the work queue
   * @returns The highest priority issue ID, or null if queue is empty
   */
  public dequeue(): string | null {
    if (this.workQueue.size === 0) {
      return null;
    }

    // Sort by priority score (descending)
    const sorted = Array.from(this.workQueue.values()).sort(
      (a, b) => b.priorityScore - a.priorityScore
    );

    const next = sorted[0];
    if (next !== undefined) {
      this.workQueue.delete(next.issueId);
      return next.issueId;
    }

    return null;
  }

  /**
   * Get the work queue entries
   */
  public getQueue(): readonly WorkQueueEntry[] {
    return Array.from(this.workQueue.values()).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get the queue size
   */
  public getQueueSize(): number {
    return this.workQueue.size;
  }

  /**
   * Check if an issue is in the queue
   */
  public isQueued(issueId: string): boolean {
    return this.workQueue.has(issueId);
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
    this.workQueue.clear();
    for (const entry of state.workQueue) {
      this.workQueue.set(entry.issueId, entry);
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
    this.workQueue.clear();
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
}
