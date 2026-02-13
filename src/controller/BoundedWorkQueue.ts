/**
 * Bounded Work Queue module
 *
 * Implements queue size limits and backpressure mechanisms for the WorkerPoolManager.
 * Prevents memory exhaustion and performance degradation by limiting queue growth.
 *
 * Features:
 * - Configurable maximum queue size
 * - Soft limit warnings at 80% capacity
 * - Hard limit rejection at 100% capacity
 * - Backpressure mechanism with exponential delay
 * - Multiple rejection policies (reject, drop-oldest, drop-lowest-priority)
 * - Dead letter queue for rejected tasks
 * - Memory usage monitoring
 *
 * @module controller/BoundedWorkQueue
 */

import type {
  WorkQueueEntry,
  BoundedQueueConfig,
  EnqueueResult,
  DeadLetterEntry,
  QueueStatus,
  QueueEvent,
  QueueEventCallback,
  QueueRejectionReason,
} from './types.js';
import { DEFAULT_BOUNDED_QUEUE_CONFIG } from './types.js';

/**
 * Internal mutable work queue entry with priority
 */
interface MutableWorkQueueEntry {
  issueId: string;
  priorityScore: number;
  queuedAt: string;
  attempts: number;
}

/**
 * Bounded Work Queue
 *
 * A work queue implementation with size limits, backpressure, and rejection policies.
 * Designed to prevent unbounded memory growth and provide graceful degradation
 * under high load conditions.
 */
export class BoundedWorkQueue {
  private readonly config: Required<BoundedQueueConfig>;
  private readonly queue: Map<string, MutableWorkQueueEntry>;
  private readonly deadLetter: Map<string, DeadLetterEntry>;
  private backpressureActive: boolean;
  private softLimitWarningActive: boolean;
  private eventCallback?: QueueEventCallback;

  constructor(config: BoundedQueueConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? DEFAULT_BOUNDED_QUEUE_CONFIG.maxSize,
      softLimitRatio: config.softLimitRatio ?? DEFAULT_BOUNDED_QUEUE_CONFIG.softLimitRatio,
      rejectionPolicy: config.rejectionPolicy ?? DEFAULT_BOUNDED_QUEUE_CONFIG.rejectionPolicy,
      backpressureThreshold:
        config.backpressureThreshold ?? DEFAULT_BOUNDED_QUEUE_CONFIG.backpressureThreshold,
      maxMemoryBytes: config.maxMemoryBytes ?? DEFAULT_BOUNDED_QUEUE_CONFIG.maxMemoryBytes,
      enableDeadLetter: config.enableDeadLetter ?? DEFAULT_BOUNDED_QUEUE_CONFIG.enableDeadLetter,
      maxDeadLetterSize: config.maxDeadLetterSize ?? DEFAULT_BOUNDED_QUEUE_CONFIG.maxDeadLetterSize,
      maxBackpressureDelayMs:
        config.maxBackpressureDelayMs ?? DEFAULT_BOUNDED_QUEUE_CONFIG.maxBackpressureDelayMs,
    };

    this.queue = new Map();
    this.deadLetter = new Map();
    this.backpressureActive = false;
    this.softLimitWarningActive = false;
  }

  /**
   * Set event callback for queue notifications
   * @param callback
   */
  public onEvent(callback: QueueEventCallback): void {
    this.eventCallback = callback;
  }

  /**
   * Enqueue a task with priority
   *
   * @param issueId - Unique task identifier
   * @param priorityScore - Task priority score (higher = more urgent)
   * @returns Result indicating success or failure with reason
   */
  public async enqueue(issueId: string, priorityScore: number): Promise<EnqueueResult> {
    // Check if already queued
    if (this.queue.has(issueId)) {
      return { success: true, taskId: issueId };
    }

    // Check memory limit
    const currentMemory = this.getMemoryUsage();
    if (currentMemory > this.config.maxMemoryBytes) {
      await this.emitEvent('memory_limit_warning', issueId, { currentMemory });
      return await this.handleFull(issueId, priorityScore, 'memory_limit');
    }

    // Check size limit
    if (this.queue.size >= this.config.maxSize) {
      await this.emitEvent('hard_limit_reached', issueId, {
        size: this.queue.size,
        maxSize: this.config.maxSize,
      });
      return await this.handleFull(issueId, priorityScore, 'queue_full');
    }

    // Apply backpressure if needed
    let delayMs = 0;
    if (this.shouldApplyBackpressure()) {
      delayMs = await this.applyBackpressure();
    }

    // Enqueue task
    this.queue.set(issueId, {
      issueId,
      priorityScore,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });

    // Check soft limit
    this.checkSoftLimit();

    await this.emitEvent('task_enqueued', issueId, { priorityScore });

    return {
      success: true,
      taskId: issueId,
      backpressureApplied: delayMs > 0,
      delayMs: delayMs > 0 ? delayMs : undefined,
    };
  }

  /**
   * Dequeue the highest priority task
   *
   * @returns The highest priority issue ID, or null if queue is empty
   */
  public async dequeue(): Promise<string | null> {
    if (this.queue.size === 0) {
      return null;
    }

    // Sort by priority score (descending)
    const sorted = Array.from(this.queue.values()).sort(
      (a, b) => b.priorityScore - a.priorityScore
    );

    const next = sorted[0];
    if (next !== undefined) {
      this.queue.delete(next.issueId);
      await this.emitEvent('task_dequeued', next.issueId, { priorityScore: next.priorityScore });

      // Deactivate backpressure if below threshold
      if (this.backpressureActive && !this.shouldApplyBackpressure()) {
        this.backpressureActive = false;
        await this.emitEvent('backpressure_deactivated', undefined, {
          size: this.queue.size,
          ratio: this.queue.size / this.config.maxSize,
        });
      }

      // Reset soft limit warning if below soft limit
      if (this.softLimitWarningActive) {
        const ratio = this.queue.size / this.config.maxSize;
        if (ratio < this.config.softLimitRatio) {
          this.softLimitWarningActive = false;
        }
      }

      return next.issueId;
    }

    return null;
  }

  /**
   * Remove a specific task from the queue
   *
   * @param issueId - Task to remove
   * @returns true if task was removed, false if not found
   */
  public remove(issueId: string): boolean {
    return this.queue.delete(issueId);
  }

  /**
   * Get a queue entry without removing it
   * @param issueId
   */
  public get(issueId: string): WorkQueueEntry | undefined {
    const entry = this.queue.get(issueId);
    if (entry === undefined) {
      return undefined;
    }
    return { ...entry };
  }

  /**
   * Check if a task is in the queue
   * @param issueId
   */
  public has(issueId: string): boolean {
    return this.queue.has(issueId);
  }

  /**
   * Get current queue size
   */
  public get size(): number {
    return this.queue.size;
  }

  /**
   * Get all queue entries sorted by priority
   */
  public getAll(): readonly WorkQueueEntry[] {
    return Array.from(this.queue.values())
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((entry) => ({ ...entry }));
  }

  /**
   * Get queue status snapshot
   */
  public getStatus(): QueueStatus {
    return {
      size: this.queue.size,
      maxSize: this.config.maxSize,
      utilizationRatio: this.queue.size / this.config.maxSize,
      backpressureActive: this.backpressureActive,
      memoryUsage: this.getMemoryUsage(),
      deadLetterSize: this.deadLetter.size,
      softLimitWarning: this.softLimitWarningActive,
    };
  }

  /**
   * Get dead letter queue entries
   */
  public getDeadLetterQueue(): readonly DeadLetterEntry[] {
    return Array.from(this.deadLetter.values());
  }

  /**
   * Get dead letter queue size
   */
  public get deadLetterSize(): number {
    return this.deadLetter.size;
  }

  /**
   * Retry a task from the dead letter queue
   *
   * @param issueId - Task to retry
   * @returns true if task was moved back to main queue
   */
  public async retryFromDeadLetter(issueId: string): Promise<boolean> {
    const entry = this.deadLetter.get(issueId);
    if (entry === undefined) {
      return false;
    }

    const result = await this.enqueue(issueId, entry.priorityScore);
    if (result.success) {
      this.deadLetter.delete(issueId);
      return true;
    }

    return false;
  }

  /**
   * Clear a task from the dead letter queue
   * @param issueId
   */
  public clearFromDeadLetter(issueId: string): boolean {
    return this.deadLetter.delete(issueId);
  }

  /**
   * Clear all tasks from the dead letter queue
   */
  public clearDeadLetterQueue(): void {
    this.deadLetter.clear();
  }

  /**
   * Clear the entire queue
   */
  public clear(): void {
    this.queue.clear();
    this.backpressureActive = false;
    this.softLimitWarningActive = false;
  }

  /**
   * Estimate memory usage in bytes
   */
  public getMemoryUsage(): number {
    let size = 0;

    // Estimate queue memory
    for (const entry of this.queue.values()) {
      // Approximate size: key + value serialization
      size += entry.issueId.length * 2; // UTF-16
      size += 8; // priorityScore (number)
      size += entry.queuedAt.length * 2;
      size += 4; // attempts (number)
      size += 64; // Map overhead
    }

    // Estimate dead letter memory
    for (const entry of this.deadLetter.values()) {
      size += entry.issueId.length * 2;
      size += 8;
      size += entry.queuedAt.length * 2;
      size += 4;
      size += entry.movedAt.length * 2;
      size += entry.reason.length * 2;
      size += 96; // Map overhead
    }

    return size;
  }

  /**
   * Handle full queue based on rejection policy
   * @param issueId
   * @param priorityScore
   * @param reason
   */
  private async handleFull(
    issueId: string,
    priorityScore: number,
    reason: QueueRejectionReason
  ): Promise<EnqueueResult> {
    switch (this.config.rejectionPolicy) {
      case 'reject':
        await this.emitEvent('task_rejected', issueId, { reason, priorityScore });
        return { success: false, reason };

      case 'drop-oldest':
        return await this.handleDropOldest(issueId, priorityScore);

      case 'drop-lowest-priority':
        return await this.handleDropLowestPriority(issueId, priorityScore);
    }
  }

  /**
   * Drop oldest entry to make room for new task
   * @param issueId
   * @param priorityScore
   */
  private async handleDropOldest(issueId: string, priorityScore: number): Promise<EnqueueResult> {
    const oldest = this.getOldestEntry();
    if (oldest === undefined) {
      return { success: false, reason: 'queue_full' };
    }

    await this.moveToDeadLetter(oldest, 'dropped_for_newer');
    this.queue.delete(oldest.issueId);

    // Now enqueue the new task
    return await this.enqueue(issueId, priorityScore);
  }

  /**
   * Drop lowest priority entry if new task has higher priority
   * @param issueId
   * @param priorityScore
   */
  private async handleDropLowestPriority(
    issueId: string,
    priorityScore: number
  ): Promise<EnqueueResult> {
    const lowest = this.getLowestPriorityEntry();
    if (lowest === undefined) {
      return { success: false, reason: 'queue_full' };
    }

    if (priorityScore <= lowest.priorityScore) {
      await this.emitEvent('task_rejected', issueId, {
        reason: 'lower_priority_than_queue',
        taskPriority: priorityScore,
        lowestQueuePriority: lowest.priorityScore,
      });
      return { success: false, reason: 'lower_priority_than_queue' };
    }

    await this.moveToDeadLetter(lowest, 'dropped_for_higher_priority');
    this.queue.delete(lowest.issueId);

    // Now enqueue the new task
    return await this.enqueue(issueId, priorityScore);
  }

  /**
   * Get the oldest entry in the queue
   */
  private getOldestEntry(): MutableWorkQueueEntry | undefined {
    let oldest: MutableWorkQueueEntry | undefined;

    for (const entry of this.queue.values()) {
      if (oldest === undefined || entry.queuedAt < oldest.queuedAt) {
        oldest = entry;
      }
    }

    return oldest;
  }

  /**
   * Get the lowest priority entry in the queue
   */
  private getLowestPriorityEntry(): MutableWorkQueueEntry | undefined {
    let lowest: MutableWorkQueueEntry | undefined;

    for (const entry of this.queue.values()) {
      if (lowest === undefined || entry.priorityScore < lowest.priorityScore) {
        lowest = entry;
      }
    }

    return lowest;
  }

  /**
   * Move an entry to the dead letter queue
   * @param entry
   * @param reason
   */
  private async moveToDeadLetter(entry: MutableWorkQueueEntry, reason: string): Promise<void> {
    if (!this.config.enableDeadLetter) {
      return;
    }

    const deadLetterEntry: DeadLetterEntry = {
      ...entry,
      movedAt: new Date().toISOString(),
      reason,
    };

    this.deadLetter.set(entry.issueId, deadLetterEntry);
    await this.emitEvent('task_moved_to_dead_letter', entry.issueId, { reason });

    // Limit dead letter size
    if (this.deadLetter.size > this.config.maxDeadLetterSize) {
      const oldest = this.getOldestDeadLetterEntry();
      if (oldest !== undefined) {
        this.deadLetter.delete(oldest.issueId);
      }
    }
  }

  /**
   * Get the oldest dead letter entry
   */
  private getOldestDeadLetterEntry(): DeadLetterEntry | undefined {
    let oldest: DeadLetterEntry | undefined;

    for (const entry of this.deadLetter.values()) {
      if (oldest === undefined || entry.movedAt < oldest.movedAt) {
        oldest = entry;
      }
    }

    return oldest;
  }

  /**
   * Check if backpressure should be applied
   */
  private shouldApplyBackpressure(): boolean {
    const ratio = this.queue.size / this.config.maxSize;
    return ratio >= this.config.backpressureThreshold;
  }

  /**
   * Apply backpressure delay
   *
   * @returns The delay applied in milliseconds
   */
  private async applyBackpressure(): Promise<number> {
    if (!this.backpressureActive) {
      this.backpressureActive = true;
      await this.emitEvent('backpressure_activated', undefined, {
        size: this.queue.size,
        ratio: this.queue.size / this.config.maxSize,
        threshold: this.config.backpressureThreshold,
      });
    }

    // Calculate exponential backoff delay
    const ratio = this.queue.size / this.config.maxSize;
    const exponent = (ratio - this.config.backpressureThreshold) * 10;
    const delay = Math.pow(2, exponent) * 100;
    const cappedDelay = Math.min(delay, this.config.maxBackpressureDelayMs);

    await this.sleep(cappedDelay);

    return cappedDelay;
  }

  /**
   * Check and emit soft limit warning
   */
  private checkSoftLimit(): void {
    const ratio = this.queue.size / this.config.maxSize;

    if (ratio >= this.config.softLimitRatio && !this.softLimitWarningActive) {
      this.softLimitWarningActive = true;
      void this.emitEvent('soft_limit_warning', undefined, {
        size: this.queue.size,
        maxSize: this.config.maxSize,
        ratio: ratio.toFixed(2),
      });
    }
  }

  /**
   * Emit a queue event
   * @param type
   * @param taskId
   * @param data
   */
  private async emitEvent(
    type: QueueEvent['type'],
    taskId: string | undefined,
    data: Record<string, unknown>
  ): Promise<void> {
    if (this.eventCallback === undefined) {
      return;
    }

    const event: QueueEvent = {
      type,
      timestamp: new Date().toISOString(),
      taskId,
      data,
    };

    try {
      await this.eventCallback(event);
    } catch {
      // Ignore callback errors
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
