/**
 * WriteBatcher unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WriteBatcher } from '../../src/scratchpad/WriteBatcher.js';

describe('WriteBatcher', () => {
  let batcher: WriteBatcher;
  let writeHandler: ReturnType<typeof vi.fn>;
  let writtenFiles: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    writtenFiles = new Map();
    writeHandler = vi.fn().mockImplementation(async (key: string, content: string) => {
      writtenFiles.set(key, content);
    });
  });

  afterEach(async () => {
    if (batcher !== undefined && !batcher.closed) {
      await batcher.close();
    }
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create batcher with default options', () => {
      batcher = new WriteBatcher({ writeHandler });
      expect(batcher.pendingCount).toBe(0);
      expect(batcher.closed).toBe(false);
    });

    it('should create batcher with custom options', () => {
      batcher = new WriteBatcher({
        writeHandler,
        flushIntervalMs: 100,
        maxBatchSize: 50,
      });
      expect(batcher.pendingCount).toBe(0);
    });
  });

  describe('write', () => {
    it('should queue writes', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      const promise = batcher.write('/path/file1', 'content1');
      expect(batcher.pendingCount).toBe(1);
      expect(writeHandler).not.toHaveBeenCalled();

      await batcher.flush();
      await promise;

      expect(writeHandler).toHaveBeenCalledWith('/path/file1', 'content1');
      expect(writtenFiles.get('/path/file1')).toBe('content1');
    });

    it('should coalesce multiple writes to same key', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      const promise1 = batcher.write('/path/file1', 'content1');
      const promise2 = batcher.write('/path/file1', 'content2');
      const promise3 = batcher.write('/path/file1', 'content3');

      expect(batcher.pendingCount).toBe(1);

      await batcher.flush();
      await Promise.all([promise1, promise2, promise3]);

      expect(writeHandler).toHaveBeenCalledTimes(1);
      expect(writeHandler).toHaveBeenCalledWith('/path/file1', 'content3');

      const metrics = batcher.getMetrics();
      expect(metrics.coalescedWrites).toBe(2);
    });

    it('should throw error when closed', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });
      await batcher.close();

      await expect(batcher.write('/path/file1', 'content1')).rejects.toThrow(
        'WriteBatcher is closed'
      );
    });
  });

  describe('writeImmediate', () => {
    it('should write immediately without batching', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      await batcher.writeImmediate('/path/file1', 'content1');

      expect(writeHandler).toHaveBeenCalledWith('/path/file1', 'content1');
      expect(batcher.pendingCount).toBe(0);
    });

    it('should supersede pending writes', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      const pendingPromise = batcher.write('/path/file1', 'pending');
      expect(batcher.pendingCount).toBe(1);

      await batcher.writeImmediate('/path/file1', 'immediate');

      expect(batcher.pendingCount).toBe(0);
      expect(writtenFiles.get('/path/file1')).toBe('immediate');

      await expect(pendingPromise).rejects.toThrow('superseded');
    });
  });

  describe('flush', () => {
    it('should flush all pending writes', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      const promise1 = batcher.write('/path/file1', 'content1');
      const promise2 = batcher.write('/path/file2', 'content2');
      const promise3 = batcher.write('/path/file3', 'content3');

      await batcher.flush();
      await Promise.all([promise1, promise2, promise3]);

      expect(writeHandler).toHaveBeenCalledTimes(3);
      expect(batcher.pendingCount).toBe(0);
    });

    it('should handle write errors', async () => {
      const errorHandler = vi.fn();
      const failingHandler = vi.fn().mockRejectedValue(new Error('Write failed'));

      batcher = new WriteBatcher({
        writeHandler: failingHandler,
        flushIntervalMs: 0,
        onError: errorHandler,
      });

      const promise = batcher.write('/path/file1', 'content1');
      await batcher.flush();

      await expect(promise).rejects.toThrow('Write failed');
      expect(errorHandler).toHaveBeenCalled();

      const metrics = batcher.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('should not flush when already flushing', async () => {
      let resolveWrite: (() => void) | undefined;
      const slowHandler = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolveWrite = resolve;
        });
      });

      batcher = new WriteBatcher({ writeHandler: slowHandler, flushIntervalMs: 0 });

      batcher.write('/path/file1', 'content1');

      // Start first flush
      const flush1 = batcher.flush();

      // Try second flush while first is in progress
      const flush2 = batcher.flush();

      expect(slowHandler).toHaveBeenCalledTimes(1);

      // Complete the write
      resolveWrite?.();
      await Promise.all([flush1, flush2]);
    });

    it('should call onFlush callback', async () => {
      const onFlush = vi.fn();
      batcher = new WriteBatcher({
        writeHandler,
        flushIntervalMs: 0,
        onFlush,
      });

      batcher.write('/path/file1', 'content1');
      batcher.write('/path/file2', 'content2');
      await batcher.flush();

      expect(onFlush).toHaveBeenCalledWith(2, expect.any(Number));
    });
  });

  describe('automatic flush', () => {
    it('should flush on interval', async () => {
      batcher = new WriteBatcher({
        writeHandler,
        flushIntervalMs: 50,
      });

      batcher.write('/path/file1', 'content1');

      expect(writeHandler).not.toHaveBeenCalled();

      // Advance timer past flush interval
      await vi.advanceTimersByTimeAsync(60);

      expect(writeHandler).toHaveBeenCalled();
    });

    it('should flush when batch size exceeded', async () => {
      batcher = new WriteBatcher({
        writeHandler,
        flushIntervalMs: 0,
        maxBatchSize: 2,
      });

      batcher.write('/path/file1', 'content1');
      batcher.write('/path/file2', 'content2');

      // This should trigger flush
      batcher.write('/path/file3', 'content3');

      // Allow flush to complete
      await vi.runAllTimersAsync();

      expect(writeHandler).toHaveBeenCalled();
    });
  });

  describe('isPending and getPending', () => {
    it('should check if write is pending', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      expect(batcher.isPending('/path/file1')).toBe(false);

      batcher.write('/path/file1', 'content1');

      expect(batcher.isPending('/path/file1')).toBe(true);
      expect(batcher.isPending('/path/file2')).toBe(false);

      await batcher.flush();

      expect(batcher.isPending('/path/file1')).toBe(false);
    });

    it('should get pending content', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      expect(batcher.getPending('/path/file1')).toBeUndefined();

      batcher.write('/path/file1', 'content1');

      expect(batcher.getPending('/path/file1')).toBe('content1');

      // Update pending content
      batcher.write('/path/file1', 'content2');

      expect(batcher.getPending('/path/file1')).toBe('content2');
    });
  });

  describe('metrics', () => {
    it('should track write metrics', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      batcher.write('/path/file1', 'content1');
      batcher.write('/path/file2', 'content2');
      batcher.write('/path/file1', 'content1-updated'); // Coalesced

      await batcher.flush();

      const metrics = batcher.getMetrics();
      expect(metrics.totalWrites).toBe(3);
      expect(metrics.coalescedWrites).toBe(1);
      expect(metrics.totalFlushes).toBe(1);
      expect(metrics.pendingWrites).toBe(0);
    });

    it('should calculate averages', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      batcher.write('/path/file1', 'content1');
      batcher.write('/path/file2', 'content2');
      await batcher.flush();

      batcher.write('/path/file3', 'content3');
      batcher.write('/path/file4', 'content4');
      await batcher.flush();

      const metrics = batcher.getMetrics();
      expect(metrics.avgWritesPerFlush).toBe(2); // 4 writes / 2 flushes
      expect(metrics.avgFlushDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      batcher.write('/path/file1', 'content1');
      await batcher.flush();

      batcher.resetMetrics();

      const metrics = batcher.getMetrics();
      expect(metrics.totalWrites).toBe(0);
      expect(metrics.totalFlushes).toBe(0);
    });
  });

  describe('close', () => {
    it('should flush pending writes on close', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      const promise = batcher.write('/path/file1', 'content1');

      await batcher.close();
      await promise;

      expect(writeHandler).toHaveBeenCalled();
      expect(batcher.closed).toBe(true);
    });

    it('should be idempotent', async () => {
      batcher = new WriteBatcher({ writeHandler, flushIntervalMs: 0 });

      await batcher.close();
      await batcher.close(); // Should not throw

      expect(batcher.closed).toBe(true);
    });
  });
});
