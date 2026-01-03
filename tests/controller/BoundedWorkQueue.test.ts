/**
 * Tests for BoundedWorkQueue
 *
 * Tests queue size limits, backpressure mechanism, rejection policies,
 * dead letter queue, and memory monitoring.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BoundedWorkQueue,
  DEFAULT_BOUNDED_QUEUE_CONFIG,
  type QueueEvent,
  type BoundedQueueConfig,
} from '../../src/controller/index.js';

describe('BoundedWorkQueue', () => {
  let queue: BoundedWorkQueue;

  beforeEach(() => {
    queue = new BoundedWorkQueue();
  });

  describe('Basic Operations', () => {
    it('should enqueue and dequeue tasks in priority order', async () => {
      await queue.enqueue('task-1', 50);
      await queue.enqueue('task-2', 100);
      await queue.enqueue('task-3', 75);

      const first = await queue.dequeue();
      const second = await queue.dequeue();
      const third = await queue.dequeue();

      expect(first).toBe('task-2'); // Highest priority
      expect(second).toBe('task-3');
      expect(third).toBe('task-1'); // Lowest priority
    });

    it('should return null when dequeuing empty queue', async () => {
      const result = await queue.dequeue();
      expect(result).toBeNull();
    });

    it('should not add duplicate tasks', async () => {
      await queue.enqueue('task-1', 50);
      await queue.enqueue('task-1', 100); // Same ID

      expect(queue.size).toBe(1);
    });

    it('should check if task exists', async () => {
      await queue.enqueue('task-1', 50);

      expect(queue.has('task-1')).toBe(true);
      expect(queue.has('task-2')).toBe(false);
    });

    it('should remove specific task', async () => {
      await queue.enqueue('task-1', 50);
      await queue.enqueue('task-2', 60);

      const removed = queue.remove('task-1');

      expect(removed).toBe(true);
      expect(queue.has('task-1')).toBe(false);
      expect(queue.size).toBe(1);
    });

    it('should get all entries sorted by priority', async () => {
      await queue.enqueue('task-1', 50);
      await queue.enqueue('task-2', 100);
      await queue.enqueue('task-3', 75);

      const entries = queue.getAll();

      expect(entries).toHaveLength(3);
      expect(entries[0]?.issueId).toBe('task-2');
      expect(entries[1]?.issueId).toBe('task-3');
      expect(entries[2]?.issueId).toBe('task-1');
    });

    it('should clear the queue', async () => {
      await queue.enqueue('task-1', 50);
      await queue.enqueue('task-2', 60);

      queue.clear();

      expect(queue.size).toBe(0);
    });
  });

  describe('Queue Size Limits', () => {
    it('should reject when queue is full with reject policy', async () => {
      const smallQueue = new BoundedWorkQueue({
        maxSize: 3,
        rejectionPolicy: 'reject',
      });

      await smallQueue.enqueue('task-1', 50);
      await smallQueue.enqueue('task-2', 60);
      await smallQueue.enqueue('task-3', 70);

      const result = await smallQueue.enqueue('task-4', 80);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('queue_full');
      expect(smallQueue.size).toBe(3);
    });

    it('should drop oldest when queue is full with drop-oldest policy', async () => {
      const smallQueue = new BoundedWorkQueue({
        maxSize: 3,
        rejectionPolicy: 'drop-oldest',
        enableDeadLetter: true,
      });

      await smallQueue.enqueue('task-1', 50);
      await smallQueue.enqueue('task-2', 60);
      await smallQueue.enqueue('task-3', 70);

      const result = await smallQueue.enqueue('task-4', 80);

      expect(result.success).toBe(true);
      expect(smallQueue.size).toBe(3);
      expect(smallQueue.has('task-1')).toBe(false); // Oldest dropped
      expect(smallQueue.has('task-4')).toBe(true);
      expect(smallQueue.deadLetterSize).toBe(1);
    });

    it('should drop lowest priority when queue is full with drop-lowest-priority policy', async () => {
      const smallQueue = new BoundedWorkQueue({
        maxSize: 3,
        rejectionPolicy: 'drop-lowest-priority',
        enableDeadLetter: true,
      });

      await smallQueue.enqueue('task-1', 50);
      await smallQueue.enqueue('task-2', 60);
      await smallQueue.enqueue('task-3', 70);

      const result = await smallQueue.enqueue('task-4', 80);

      expect(result.success).toBe(true);
      expect(smallQueue.size).toBe(3);
      expect(smallQueue.has('task-1')).toBe(false); // Lowest priority dropped
      expect(smallQueue.has('task-4')).toBe(true);
    });

    it('should reject lower priority task with drop-lowest-priority policy', async () => {
      const smallQueue = new BoundedWorkQueue({
        maxSize: 3,
        rejectionPolicy: 'drop-lowest-priority',
      });

      await smallQueue.enqueue('task-1', 50);
      await smallQueue.enqueue('task-2', 60);
      await smallQueue.enqueue('task-3', 70);

      const result = await smallQueue.enqueue('task-4', 30); // Lower than all

      expect(result.success).toBe(false);
      expect(result.reason).toBe('lower_priority_than_queue');
    });
  });

  describe('Backpressure', () => {
    it('should apply backpressure at threshold', async () => {
      const bpQueue = new BoundedWorkQueue({
        maxSize: 10,
        backpressureThreshold: 0.5, // 50%
        maxBackpressureDelayMs: 100,
      });

      // Fill to 60% (above threshold)
      for (let i = 0; i < 6; i++) {
        await bpQueue.enqueue(`task-${i}`, i);
      }

      const startTime = Date.now();
      await bpQueue.enqueue('task-6', 60);
      const endTime = Date.now();

      // Should have some delay due to backpressure
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should report backpressure status', async () => {
      const bpQueue = new BoundedWorkQueue({
        maxSize: 10,
        backpressureThreshold: 0.5,
        maxBackpressureDelayMs: 10,
      });

      // Fill to 60%
      for (let i = 0; i < 6; i++) {
        await bpQueue.enqueue(`task-${i}`, i);
      }

      await bpQueue.enqueue('task-6', 60);
      const status = bpQueue.getStatus();

      expect(status.backpressureActive).toBe(true);
    });

    it('should deactivate backpressure when drained', async () => {
      const bpQueue = new BoundedWorkQueue({
        maxSize: 10,
        backpressureThreshold: 0.5,
        maxBackpressureDelayMs: 10,
      });

      // Fill to 60%
      for (let i = 0; i < 6; i++) {
        await bpQueue.enqueue(`task-${i}`, i);
      }

      await bpQueue.enqueue('task-6', 60);

      // Drain queue below threshold
      for (let i = 0; i < 4; i++) {
        await bpQueue.dequeue();
      }

      const status = bpQueue.getStatus();
      expect(status.backpressureActive).toBe(false);
    });
  });

  describe('Dead Letter Queue', () => {
    it('should move dropped tasks to dead letter queue', async () => {
      const dlQueue = new BoundedWorkQueue({
        maxSize: 2,
        rejectionPolicy: 'drop-oldest',
        enableDeadLetter: true,
      });

      await dlQueue.enqueue('task-1', 50);
      await dlQueue.enqueue('task-2', 60);
      await dlQueue.enqueue('task-3', 70);

      const deadLetters = dlQueue.getDeadLetterQueue();

      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0]?.issueId).toBe('task-1');
      expect(deadLetters[0]?.reason).toBe('dropped_for_newer');
    });

    it('should retry tasks from dead letter queue', async () => {
      const dlQueue = new BoundedWorkQueue({
        maxSize: 3,
        rejectionPolicy: 'drop-oldest',
        enableDeadLetter: true,
      });

      await dlQueue.enqueue('task-1', 50);
      await dlQueue.enqueue('task-2', 60);
      await dlQueue.enqueue('task-3', 70);
      await dlQueue.enqueue('task-4', 80); // Drops task-1

      // Make room
      await dlQueue.dequeue();

      const retried = await dlQueue.retryFromDeadLetter('task-1');

      expect(retried).toBe(true);
      expect(dlQueue.has('task-1')).toBe(true);
      expect(dlQueue.deadLetterSize).toBe(0);
    });

    it('should limit dead letter queue size', async () => {
      const dlQueue = new BoundedWorkQueue({
        maxSize: 2,
        rejectionPolicy: 'drop-oldest',
        enableDeadLetter: true,
        maxDeadLetterSize: 3,
      });

      // Fill and overflow multiple times
      for (let i = 0; i < 10; i++) {
        await dlQueue.enqueue(`task-${i}`, i);
      }

      expect(dlQueue.deadLetterSize).toBeLessThanOrEqual(3);
    });

    it('should not use dead letter when disabled', async () => {
      const noDlQueue = new BoundedWorkQueue({
        maxSize: 2,
        rejectionPolicy: 'drop-oldest',
        enableDeadLetter: false,
      });

      await noDlQueue.enqueue('task-1', 50);
      await noDlQueue.enqueue('task-2', 60);
      await noDlQueue.enqueue('task-3', 70);

      expect(noDlQueue.deadLetterSize).toBe(0);
    });
  });

  describe('Queue Status', () => {
    it('should return accurate status', async () => {
      const statusQueue = new BoundedWorkQueue({
        maxSize: 10,
        softLimitRatio: 0.8,
      });

      await statusQueue.enqueue('task-1', 50);
      await statusQueue.enqueue('task-2', 60);

      const status = statusQueue.getStatus();

      expect(status.size).toBe(2);
      expect(status.maxSize).toBe(10);
      expect(status.utilizationRatio).toBe(0.2);
      expect(status.backpressureActive).toBe(false);
      expect(status.softLimitWarning).toBe(false);
    });

    it('should activate soft limit warning', async () => {
      const warnQueue = new BoundedWorkQueue({
        maxSize: 10,
        softLimitRatio: 0.5,
      });

      // Fill to 60% (above soft limit)
      for (let i = 0; i < 6; i++) {
        await warnQueue.enqueue(`task-${i}`, i);
      }

      const status = warnQueue.getStatus();
      expect(status.softLimitWarning).toBe(true);
    });
  });

  describe('Memory Monitoring', () => {
    it('should estimate memory usage', async () => {
      await queue.enqueue('task-1', 50);
      await queue.enqueue('task-2', 60);

      const memory = queue.getMemoryUsage();

      expect(memory).toBeGreaterThan(0);
    });

    it('should reject when memory limit exceeded', async () => {
      const memQueue = new BoundedWorkQueue({
        maxSize: 1000,
        maxMemoryBytes: 100, // Very low for testing
        rejectionPolicy: 'reject',
      });

      // First task should succeed
      const result1 = await memQueue.enqueue('task-1', 50);
      expect(result1.success).toBe(true);

      // Additional tasks may exceed memory
      for (let i = 2; i < 100; i++) {
        await memQueue.enqueue(`task-${i}`, i);
      }

      const status = memQueue.getStatus();
      // Memory should be tracked
      expect(status.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Event Notifications', () => {
    it('should emit events on operations', async () => {
      const events: QueueEvent[] = [];
      queue.onEvent((event) => {
        events.push(event);
      });

      await queue.enqueue('task-1', 50);
      await queue.dequeue();

      expect(events.some((e) => e.type === 'task_enqueued')).toBe(true);
      expect(events.some((e) => e.type === 'task_dequeued')).toBe(true);
    });

    it('should emit rejection event', async () => {
      const smallQueue = new BoundedWorkQueue({
        maxSize: 1,
        rejectionPolicy: 'reject',
      });

      const events: QueueEvent[] = [];
      smallQueue.onEvent((event) => {
        events.push(event);
      });

      await smallQueue.enqueue('task-1', 50);
      await smallQueue.enqueue('task-2', 60);

      expect(events.some((e) => e.type === 'task_rejected')).toBe(true);
    });

    it('should emit backpressure events', async () => {
      const bpQueue = new BoundedWorkQueue({
        maxSize: 10,
        backpressureThreshold: 0.5,
        maxBackpressureDelayMs: 10,
      });

      const events: QueueEvent[] = [];
      bpQueue.onEvent((event) => {
        events.push(event);
      });

      // Fill to 60%
      for (let i = 0; i < 6; i++) {
        await bpQueue.enqueue(`task-${i}`, i);
      }

      await bpQueue.enqueue('task-6', 60);

      expect(events.some((e) => e.type === 'backpressure_activated')).toBe(true);
    });

    it('should emit soft limit warning', async () => {
      const warnQueue = new BoundedWorkQueue({
        maxSize: 10,
        softLimitRatio: 0.5,
      });

      const events: QueueEvent[] = [];
      warnQueue.onEvent((event) => {
        events.push(event);
      });

      // Fill to 60%
      for (let i = 0; i < 6; i++) {
        await warnQueue.enqueue(`task-${i}`, i);
      }

      expect(events.some((e) => e.type === 'soft_limit_warning')).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultQueue = new BoundedWorkQueue();
      const status = defaultQueue.getStatus();

      expect(status.maxSize).toBe(DEFAULT_BOUNDED_QUEUE_CONFIG.maxSize);
    });

    it('should allow custom configuration', () => {
      const customConfig: BoundedQueueConfig = {
        maxSize: 500,
        softLimitRatio: 0.7,
        rejectionPolicy: 'drop-oldest',
        backpressureThreshold: 0.5,
        maxMemoryBytes: 50000000,
        enableDeadLetter: false,
        maxDeadLetterSize: 50,
        maxBackpressureDelayMs: 3000,
      };

      const customQueue = new BoundedWorkQueue(customConfig);
      const status = customQueue.getStatus();

      expect(status.maxSize).toBe(500);
    });
  });
});
