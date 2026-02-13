/**
 * Worker Pool Manager module
 *
 * Manages a pool of Worker Agents for parallel task execution.
 * Handles worker spawning, task assignment, and status tracking.
 *
 * ## Distributed Lock Support
 *
 * This module now supports distributed locking for multi-process deployments
 * using Scratchpad's file-based locking mechanism. Enable distributed locking
 * by setting `distributedLock.enabled: true` in the configuration.
 *
 * When enabled, all state-modifying operations (assignWork, completeWork,
 * saveState, etc.) will use file locks to ensure consistency across processes.
 *
 * DONE(P1): Distributed lock support implemented via Scratchpad's withLock.
 * See Issue #247 for implementation details.
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
import { randomUUID } from 'node:crypto';

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
  DistributedLockOptions,
  WorkerPoolMetricsConfig,
  WorkerPoolMetricsSnapshot,
  MetricsExportFormat,
  MetricsEventCallback,
} from './types.js';
import { DEFAULT_WORKER_POOL_CONFIG, DEFAULT_DISTRIBUTED_LOCK_OPTIONS } from './types.js';
import { WorkerPoolMetrics } from './WorkerPoolMetrics.js';
import { Scratchpad } from '../scratchpad/Scratchpad.js';
import type { ScratchpadOptions, LockOptions } from '../scratchpad/types.js';
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
  readonly distributedLock: Required<DistributedLockOptions>;
  readonly metricsConfig: WorkerPoolMetricsConfig | undefined;
}

/**
 *
 */
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

  /** Scratchpad instance for distributed locking */
  private readonly scratchpad: Scratchpad | null;
  /** Unique holder ID for this process instance */
  private readonly lockHolderId: string;
  /** Path to the shared state file for distributed locking */
  private readonly sharedStatePath: string;
  /** Metrics collector for observability */
  private readonly metrics: WorkerPoolMetrics | null;

  constructor(config: WorkerPoolConfig = {}, scratchpadOptions?: ScratchpadOptions) {
    // Merge distributed lock options with defaults
    const distributedLockConfig: Required<DistributedLockOptions> = {
      enabled: config.distributedLock?.enabled ?? DEFAULT_DISTRIBUTED_LOCK_OPTIONS.enabled,
      lockTimeout:
        config.distributedLock?.lockTimeout ?? DEFAULT_DISTRIBUTED_LOCK_OPTIONS.lockTimeout,
      lockRetryAttempts:
        config.distributedLock?.lockRetryAttempts ??
        DEFAULT_DISTRIBUTED_LOCK_OPTIONS.lockRetryAttempts,
      lockRetryDelayMs:
        config.distributedLock?.lockRetryDelayMs ??
        DEFAULT_DISTRIBUTED_LOCK_OPTIONS.lockRetryDelayMs,
      lockStealThresholdMs:
        config.distributedLock?.lockStealThresholdMs ??
        DEFAULT_DISTRIBUTED_LOCK_OPTIONS.lockStealThresholdMs,
      holderIdPrefix:
        config.distributedLock?.holderIdPrefix ?? DEFAULT_DISTRIBUTED_LOCK_OPTIONS.holderIdPrefix,
    };

    this.config = {
      maxWorkers: config.maxWorkers ?? DEFAULT_WORKER_POOL_CONFIG.maxWorkers,
      workerTimeout: config.workerTimeout ?? DEFAULT_WORKER_POOL_CONFIG.workerTimeout,
      workOrdersPath: config.workOrdersPath ?? DEFAULT_WORKER_POOL_CONFIG.workOrdersPath,
      queueConfig: config.queueConfig,
      distributedLock: distributedLockConfig,
      metricsConfig: config.metricsConfig,
    };

    this.workers = new Map();
    this.workOrders = new Map();
    this.completedOrders = new Set();
    this.failedOrders = new Set();
    this.workOrderCounter = 0;

    // Initialize distributed locking support
    this.lockHolderId = `${distributedLockConfig.holderIdPrefix}-${randomUUID()}`;
    this.sharedStatePath = join(this.config.workOrdersPath, 'pool_state.json');

    if (distributedLockConfig.enabled) {
      // Create Scratchpad instance with lock configuration
      this.scratchpad = new Scratchpad({
        basePath: this.config.workOrdersPath,
        lockTimeout: distributedLockConfig.lockTimeout,
        lockRetryAttempts: distributedLockConfig.lockRetryAttempts,
        lockRetryDelayMs: distributedLockConfig.lockRetryDelayMs,
        lockStealThresholdMs: distributedLockConfig.lockStealThresholdMs,
        ...scratchpadOptions,
      });
    } else {
      this.scratchpad = null;
    }

    // Initialize bounded queue if config provided, otherwise use legacy queue
    if (config.queueConfig !== undefined) {
      this.boundedQueue = new BoundedWorkQueue(config.queueConfig);
      this.legacyQueue = new Map(); // Not used but kept for type safety
    } else {
      this.boundedQueue = null;
      this.legacyQueue = new Map();
    }

    // Initialize metrics collector if config provided
    if (config.metricsConfig !== undefined) {
      this.metrics = new WorkerPoolMetrics(config.metricsConfig);
    } else {
      this.metrics = null;
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
   * @param worker
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
   * @param issueId
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
   * @param workerId
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
   * @param workerId
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
   * @param issue
   * @param context
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
   * @param priority
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
   * @param workOrder
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
   * @param workerId
   * @param workOrder
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

      // Record metrics
      if (this.metrics !== null) {
        this.metrics.recordTaskStart(workOrder.orderId, workOrder.issueId, workerId);
        this.updateMetricsState();
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
   * @param orderId
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
   * @param workerId
   * @param result
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

    // Record metrics
    if (this.metrics !== null) {
      this.metrics.recordTaskCompletion(result.orderId, result.success);
      this.updateMetricsState();
    }

    // Invoke callback
    if (this.onCompletionCallback !== undefined) {
      await this.onCompletionCallback(workerId, result);
    }
  }

  /**
   * Mark a worker as failed
   * @param workerId
   * @param orderId
   * @param error
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

    // Record metrics
    if (this.metrics !== null) {
      this.metrics.recordTaskCompletion(orderId, false);
      this.updateMetricsState();
    }

    // Invoke callback
    if (this.onFailureCallback !== undefined) {
      await this.onFailureCallback(workerId, orderId, error);
    }
  }

  /**
   * Release a worker back to idle state
   * @param workerId
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
   * @param workerId
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
   * @param issueId
   * @param priorityScore
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
   * @param issueId
   * @param priorityScore
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
   * @param issueId
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
   * @param callback
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
   * @param issueId
   */
  public async retryFromDeadLetter(issueId: string): Promise<boolean> {
    if (this.boundedQueue === null) {
      return false;
    }
    return await this.boundedQueue.retryFromDeadLetter(issueId);
  }

  /**
   * Check if an issue is being worked on
   * @param issueId
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
   * @param callback
   */
  public onCompletion(callback: WorkerCompletionCallback): void {
    this.onCompletionCallback = callback;
  }

  /**
   * Set failure callback
   * @param callback
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
   * @param projectId
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
   * @param projectId
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
   * @param state
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

  // ============================================================================
  // Distributed Lock Support Methods
  // ============================================================================

  /**
   * Check if distributed locking is enabled
   */
  public isDistributedLockEnabled(): boolean {
    return this.scratchpad !== null && this.config.distributedLock.enabled;
  }

  /**
   * Get the lock holder ID for this process instance
   */
  public getLockHolderId(): string {
    return this.lockHolderId;
  }

  /**
   * Get lock options for distributed operations
   */
  private getLockOptions(): LockOptions {
    return {
      holderId: this.lockHolderId,
      retryAttempts: this.config.distributedLock.lockRetryAttempts,
      retryDelayMs: this.config.distributedLock.lockRetryDelayMs,
    };
  }

  /**
   * Execute a function with distributed lock protection
   *
   * If distributed locking is enabled, wraps the operation in a file lock.
   * Otherwise, executes the operation directly.
   *
   * @param fn - Function to execute
   * @returns Result of the function
   */
  private async withDistributedLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.scratchpad === null) {
      return fn();
    }

    return this.scratchpad.withLock(this.sharedStatePath, fn, this.getLockOptions());
  }

  /**
   * Execute a synchronous function with distributed lock protection (for sync operations)
   *
   * NOTE: This wraps the sync function in a Promise for lock acquisition.
   * Use sparingly as it introduces async overhead for sync operations.
   *
   * @param fn - Synchronous function to execute
   * @returns Result of the function
   */
  private async withDistributedLockSync<T>(fn: () => T): Promise<T> {
    if (this.scratchpad === null) {
      return fn();
    }

    return this.scratchpad.withLock(
      this.sharedStatePath,
      () => Promise.resolve(fn()),
      this.getLockOptions()
    );
  }

  /**
   * Assign work to a worker with distributed lock protection
   *
   * Thread-safe version of assignWork that acquires a distributed lock
   * before modifying shared state.
   *
   * @param workerId - Worker ID to assign work to
   * @param workOrder - Work order to assign
   * @throws WorkerNotFoundError if worker doesn't exist
   * @throws WorkerNotAvailableError if worker is not idle
   * @throws LockContentionError if lock cannot be acquired
   */
  public async assignWorkWithLock(workerId: string, workOrder: WorkOrder): Promise<void> {
    await this.withDistributedLockSync(() => {
      this.assignWork(workerId, workOrder);
    });
  }

  /**
   * Complete work with distributed lock protection
   *
   * Thread-safe version of completeWork that ensures atomic state updates
   * across multiple processes.
   *
   * @param workerId - Worker ID that completed work
   * @param result - Work order result
   */
  public async completeWorkWithLock(workerId: string, result: WorkOrderResult): Promise<void> {
    await this.withDistributedLock(async () => {
      await this.completeWork(workerId, result);
    });
  }

  /**
   * Fail work with distributed lock protection
   *
   * Thread-safe version of failWork that ensures atomic state updates.
   *
   * @param workerId - Worker ID that failed
   * @param orderId - Work order ID
   * @param error - Error that occurred
   */
  public async failWorkWithLock(workerId: string, orderId: string, error: Error): Promise<void> {
    await this.withDistributedLock(async () => {
      await this.failWork(workerId, orderId, error);
    });
  }

  /**
   * Create work order with distributed lock protection
   *
   * Thread-safe version of createWorkOrder that ensures atomic work order
   * creation and counter increment across processes.
   *
   * @param issue - Issue to create work order for
   * @param context - Work order context
   * @returns Created work order
   */
  public async createWorkOrderWithLock(
    issue: IssueNode | AnalyzedIssue,
    context: Partial<WorkOrderContext> = {}
  ): Promise<WorkOrder> {
    return this.withDistributedLock(async () => {
      return this.createWorkOrder(issue, context);
    });
  }

  /**
   * Enqueue issue with distributed lock protection
   *
   * Thread-safe version of enqueue for bounded queue operations.
   *
   * @param issueId - Issue ID to enqueue
   * @param priorityScore - Priority score for ordering
   */
  public async enqueueWithLock(issueId: string, priorityScore: number): Promise<void> {
    await this.withDistributedLockSync(() => {
      this.enqueue(issueId, priorityScore);
    });
  }

  /**
   * Dequeue issue with distributed lock protection
   *
   * Thread-safe version of dequeue that ensures atomic dequeue operations.
   *
   * @returns Next issue ID or null if queue is empty
   */
  public async dequeueWithLock(): Promise<string | null> {
    return this.withDistributedLockSync(() => {
      return this.dequeue();
    });
  }

  /**
   * Get an available worker slot with distributed lock protection
   *
   * Thread-safe version that prevents multiple processes from
   * simultaneously claiming the same worker slot.
   *
   * @returns Worker ID if available, null otherwise
   */
  public async getAvailableSlotWithLock(): Promise<string | null> {
    return this.withDistributedLockSync(() => {
      return this.getAvailableSlot();
    });
  }

  /**
   * Release worker with distributed lock protection
   *
   * @param workerId - Worker ID to release
   */
  public async releaseWorkerWithLock(workerId: string): Promise<void> {
    await this.withDistributedLockSync(() => {
      this.releaseWorker(workerId);
    });
  }

  /**
   * Reset worker with distributed lock protection
   *
   * @param workerId - Worker ID to reset
   */
  public async resetWorkerWithLock(workerId: string): Promise<void> {
    await this.withDistributedLockSync(() => {
      this.resetWorker(workerId);
    });
  }

  /**
   * Save state with distributed lock protection
   *
   * Ensures atomic state persistence across multiple processes.
   *
   * @param projectId - Project identifier
   */
  public async saveStateWithLock(projectId: string): Promise<void> {
    await this.withDistributedLock(async () => {
      await this.saveState(projectId);
    });
  }

  /**
   * Load state with distributed lock protection
   *
   * Ensures consistent state loading across multiple processes.
   *
   * @param projectId - Project identifier
   * @returns Loaded controller state or null if not found
   */
  public async loadStateWithLock(projectId: string): Promise<ControllerState | null> {
    return this.withDistributedLock(async () => {
      return this.loadState(projectId);
    });
  }

  /**
   * Synchronize state with shared storage
   *
   * When distributed locking is enabled, this method:
   * 1. Acquires the distributed lock
   * 2. Loads the latest state from shared storage
   * 3. Merges with local state (external state takes precedence)
   * 4. Saves the merged state back
   *
   * This is useful for periodic state synchronization in multi-process setups.
   *
   * @param projectId - Project identifier
   * @returns True if synchronization was performed, false if disabled
   */
  public async synchronizeState(projectId: string): Promise<boolean> {
    if (!this.isDistributedLockEnabled()) {
      return false;
    }

    await this.withDistributedLock(async () => {
      const externalState = await this.loadState(projectId);
      if (externalState !== null) {
        // Merge external state into local state
        // External state takes precedence for completed/failed orders
        for (const orderId of externalState.completedOrders) {
          this.completedOrders.add(orderId);
        }
        for (const orderId of externalState.failedOrders) {
          this.failedOrders.add(orderId);
        }
      }
      // Save merged state
      await this.saveState(projectId);
    });

    return true;
  }

  /**
   * Clean up distributed lock resources
   *
   * Should be called when shutting down to release any held locks.
   */
  public async cleanupDistributedLock(): Promise<void> {
    if (this.scratchpad !== null) {
      await this.scratchpad.cleanup();
    }
  }

  // ============================================================================
  // Metrics Support Methods
  // ============================================================================

  /**
   * Check if metrics collection is enabled
   */
  public isMetricsEnabled(): boolean {
    return this.metrics !== null && this.metrics.isEnabled();
  }

  /**
   * Update metrics state from current pool state
   * @internal
   */
  private updateMetricsState(): void {
    if (this.metrics === null) return;

    const status = this.getStatus();
    this.metrics.updatePoolState(
      status.totalWorkers,
      status.workingWorkers,
      status.idleWorkers,
      status.errorWorkers
    );

    // Update queue state
    const queueStatus = this.getQueueStatus();
    if (queueStatus !== null) {
      this.metrics.updateQueueState(
        queueStatus.size,
        queueStatus.maxSize,
        queueStatus.deadLetterSize,
        queueStatus.backpressureActive
      );
    } else {
      // Legacy queue - no bounded queue configured
      this.metrics.updateQueueState(
        this.getQueueSize(),
        Number.MAX_SAFE_INTEGER, // No limit
        0,
        false
      );
    }
  }

  /**
   * Get metrics snapshot
   *
   * Returns a complete snapshot of all worker pool metrics including
   * utilization, queue depth, and task completion statistics.
   *
   * @returns Metrics snapshot or null if metrics not enabled
   */
  public getMetricsSnapshot(): WorkerPoolMetricsSnapshot | null {
    if (this.metrics === null) {
      return null;
    }
    this.updateMetricsState();
    return this.metrics.getSnapshot();
  }

  /**
   * Export metrics in specified format
   *
   * Supports Prometheus, OpenMetrics, and JSON formats.
   *
   * @param format - Export format (default: 'prometheus')
   * @returns Formatted metrics string or null if metrics not enabled
   */
  public exportMetrics(format: MetricsExportFormat = 'prometheus'): string | null {
    if (this.metrics === null) {
      return null;
    }
    this.updateMetricsState();
    return this.metrics.export(format);
  }

  /**
   * Set metrics event callback
   *
   * Receives notifications for metrics-related events such as
   * task start/completion, utilization changes, etc.
   *
   * @param callback - Event callback function
   */
  public onMetricsEvent(callback: MetricsEventCallback): void {
    if (this.metrics !== null) {
      this.metrics.onEvent(callback);
    }
  }

  /**
   * Reset metrics
   *
   * Clears all collected metrics data. Pool and queue state are preserved.
   */
  public resetMetrics(): void {
    if (this.metrics !== null) {
      this.metrics.reset();
    }
  }

  /**
   * Get raw metrics instance
   *
   * Provides direct access to the metrics collector for advanced usage.
   *
   * @returns WorkerPoolMetrics instance or null if metrics not enabled
   */
  public getMetricsCollector(): WorkerPoolMetrics | null {
    return this.metrics;
  }
}
