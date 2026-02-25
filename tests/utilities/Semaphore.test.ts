/**
 * Semaphore unit tests
 */

import { describe, it, expect } from 'vitest';
import { Semaphore } from '../../src/utilities/Semaphore.js';

describe('Semaphore', () => {
  describe('constructor', () => {
    it('should create a semaphore with the specified max', () => {
      const sem = new Semaphore(3);
      expect(sem.activeCount).toBe(0);
      expect(sem.waitingCount).toBe(0);
    });

    it('should throw if max is less than 1', () => {
      expect(() => new Semaphore(0)).toThrow('Semaphore max must be at least 1');
      expect(() => new Semaphore(-1)).toThrow('Semaphore max must be at least 1');
    });
  });

  describe('acquire and release', () => {
    it('should acquire immediately when slots are available', async () => {
      const sem = new Semaphore(2);
      await sem.acquire();
      expect(sem.activeCount).toBe(1);
      await sem.acquire();
      expect(sem.activeCount).toBe(2);
    });

    it('should release and decrement active count', async () => {
      const sem = new Semaphore(2);
      await sem.acquire();
      await sem.acquire();
      sem.release();
      expect(sem.activeCount).toBe(1);
      sem.release();
      expect(sem.activeCount).toBe(0);
    });

    it('should queue when all slots are occupied', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();

      // This acquire will not resolve immediately
      let acquired = false;
      const pending = sem.acquire().then(() => {
        acquired = true;
      });

      // Give microtask queue a chance to process
      await Promise.resolve();
      expect(acquired).toBe(false);
      expect(sem.waitingCount).toBe(1);

      // Release to let the queued acquire proceed
      sem.release();
      await pending;
      expect(acquired).toBe(true);
      expect(sem.waitingCount).toBe(0);
    });

    it('should maintain FIFO order for queued acquires', async () => {
      const sem = new Semaphore(1);
      await sem.acquire();

      const order: number[] = [];

      const p1 = sem.acquire().then(() => order.push(1));
      const p2 = sem.acquire().then(() => order.push(2));
      const p3 = sem.acquire().then(() => order.push(3));

      // Release three times to process all queued
      sem.release();
      await p1;
      sem.release();
      await p2;
      sem.release();
      await p3;

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('concurrency limiting', () => {
    it('should limit concurrent operations to the max', async () => {
      const sem = new Semaphore(2);
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = async (duration: number): Promise<void> => {
        await sem.acquire();
        try {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, duration));
        } finally {
          concurrent--;
          sem.release();
        }
      };

      await Promise.all([task(10), task(10), task(10), task(10)]);

      expect(maxConcurrent).toBe(2);
    });

    it('should handle single-slot semaphore as a mutex', async () => {
      const sem = new Semaphore(1);
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = async (): Promise<void> => {
        await sem.acquire();
        try {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 5));
        } finally {
          concurrent--;
          sem.release();
        }
      };

      await Promise.all([task(), task(), task()]);

      expect(maxConcurrent).toBe(1);
    });

    it('should handle high concurrency max', async () => {
      const sem = new Semaphore(100);
      const tasks = Array.from({ length: 50 }, async () => {
        await sem.acquire();
        sem.release();
      });

      await Promise.all(tasks);
      expect(sem.activeCount).toBe(0);
      expect(sem.waitingCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should work with max of 1', () => {
      const sem = new Semaphore(1);
      expect(sem.activeCount).toBe(0);
    });

    it('should handle acquire-release cycles correctly', async () => {
      const sem = new Semaphore(2);

      // Cycle 1
      await sem.acquire();
      await sem.acquire();
      sem.release();
      sem.release();

      // Cycle 2 - should work identically
      await sem.acquire();
      await sem.acquire();
      expect(sem.activeCount).toBe(2);
      sem.release();
      sem.release();
      expect(sem.activeCount).toBe(0);
    });
  });
});
