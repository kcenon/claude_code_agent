/**
 * WriteBatcher - Batch write operations for improved I/O performance
 *
 * Collects write operations and flushes them periodically or when
 * a threshold is reached, reducing disk I/O overhead.
 *
 * Features:
 * - Configurable flush interval (default: 50ms)
 * - Configurable batch size threshold
 * - Graceful flush on shutdown
 * - Write coalescing (multiple writes to same key)
 * - Async write completion tracking
 *
 * @example
 * ```typescript
 * const batcher = new WriteBatcher({
 *   flushIntervalMs: 50,
 *   maxBatchSize: 100,
 *   writeHandler: async (key, content) => {
 *     await fs.promises.writeFile(key, content);
 *   },
 * });
 *
 * await batcher.write('/path/to/file1', 'content1');
 * await batcher.write('/path/to/file2', 'content2');
 *
 * // Writes will be batched and flushed together
 * await batcher.close(); // Ensure all writes are flushed
 * ```
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

/**
 * Pending write operation
 */
interface PendingWrite {
  /** File path/key */
  key: string;
  /** Content to write */
  content: string;
  /** Timestamp when queued */
  queuedAt: number;
  /** Promise resolvers for callers waiting on this write */
  resolvers: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
}

/**
 * Write handler function type
 */
export type WriteHandler = (key: string, content: string) => Promise<void>;

/**
 * WriteBatcher configuration options
 */
export interface WriteBatcherOptions {
  /**
   * Flush interval in milliseconds (default: 50)
   * Set to 0 to disable automatic flushing
   */
  flushIntervalMs?: number;
  /**
   * Maximum batch size before forced flush (default: 100)
   */
  maxBatchSize?: number;
  /**
   * Handler function to perform actual writes
   */
  writeHandler: WriteHandler;
  /**
   * Callback invoked when flush completes
   */
  onFlush?: (count: number, durationMs: number) => void;
  /**
   * Callback invoked when a write fails
   */
  onError?: (key: string, error: Error) => void;
}

/**
 * Write batcher metrics
 */
export interface WriteBatcherMetrics {
  /** Total number of writes queued */
  totalWrites: number;
  /** Total number of flush operations */
  totalFlushes: number;
  /** Total number of writes coalesced (merged) */
  coalescedWrites: number;
  /** Total number of write errors */
  errors: number;
  /** Current pending writes */
  pendingWrites: number;
  /** Average writes per flush */
  avgWritesPerFlush: number;
  /** Average flush duration in milliseconds */
  avgFlushDurationMs: number;
}

/**
 * Default flush interval in milliseconds
 */
const DEFAULT_FLUSH_INTERVAL_MS = 50;

/**
 * Default maximum batch size
 */
const DEFAULT_MAX_BATCH_SIZE = 100;

/**
 * WriteBatcher - Batches write operations for improved performance
 */
export class WriteBatcher {
  private readonly pendingWrites: Map<string, PendingWrite> = new Map();
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly writeHandler: WriteHandler;
  private readonly onFlush: ((count: number, durationMs: number) => void) | undefined;
  private readonly onError: ((key: string, error: Error) => void) | undefined;

  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private isClosed = false;

  private totalWrites = 0;
  private totalFlushes = 0;
  private coalescedWrites = 0;
  private errors = 0;
  private totalFlushDurationMs = 0;

  constructor(options: WriteBatcherOptions) {
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.writeHandler = options.writeHandler;
    this.onFlush = options.onFlush ?? undefined;
    this.onError = options.onError ?? undefined;

    // Start automatic flushing if interval is set
    if (this.flushIntervalMs > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Queue a write operation
   *
   * Returns a promise that resolves when the write is flushed to disk.
   * Multiple writes to the same key before flush will be coalesced.
   *
   * @param key - File path/key
   * @param content - Content to write
   * @returns Promise that resolves when write is complete
   */
  async write(key: string, content: string): Promise<void> {
    if (this.isClosed) {
      throw new Error('WriteBatcher is closed');
    }

    this.totalWrites++;

    return new Promise<void>((resolve, reject) => {
      const existing = this.pendingWrites.get(key);

      if (existing !== undefined) {
        // Coalesce with existing write - update content and add resolver
        existing.content = content;
        existing.resolvers.push({ resolve, reject });
        this.coalescedWrites++;
      } else {
        // New write
        this.pendingWrites.set(key, {
          key,
          content,
          queuedAt: Date.now(),
          resolvers: [{ resolve, reject }],
        });
      }

      // Force flush if batch size exceeded
      if (this.pendingWrites.size >= this.maxBatchSize) {
        this.flush().catch((error: unknown) => {
          // Primary error handling is done per-write in flush()
          // This catch prevents unhandled promise rejection
          logger.debug('Batch flush failed', { error });
        });
      }
    });
  }

  /**
   * Immediately write without batching
   *
   * Useful for critical operations that must not be delayed.
   *
   * @param key - File path/key
   * @param content - Content to write
   */
  async writeImmediate(key: string, content: string): Promise<void> {
    if (this.isClosed) {
      throw new Error('WriteBatcher is closed');
    }

    // Remove from pending if exists
    const existing = this.pendingWrites.get(key);
    if (existing !== undefined) {
      this.pendingWrites.delete(key);
      // Reject pending resolvers - they'll need to retry
      for (const { reject } of existing.resolvers) {
        reject(new Error('Write superseded by immediate write'));
      }
    }

    // Perform immediate write
    await this.writeHandler(key, content);
    this.totalWrites++;
  }

  /**
   * Flush all pending writes to disk
   *
   * @returns Promise that resolves when all writes are complete
   */
  async flush(): Promise<void> {
    if (this.pendingWrites.size === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const startTime = Date.now();

    // Take a snapshot of pending writes
    const writes = Array.from(this.pendingWrites.values());
    this.pendingWrites.clear();

    const writePromises = writes.map(async (write) => {
      try {
        await this.writeHandler(write.key, write.content);

        // Resolve all waiting callers
        for (const { resolve } of write.resolvers) {
          resolve();
        }
      } catch (error) {
        this.errors++;
        const err = error instanceof Error ? error : new Error(String(error));

        // Reject all waiting callers
        for (const { reject } of write.resolvers) {
          reject(err);
        }

        if (this.onError !== undefined) {
          this.onError(write.key, err);
        }
      }
    });

    await Promise.all(writePromises);

    const durationMs = Date.now() - startTime;
    this.totalFlushes++;
    this.totalFlushDurationMs += durationMs;

    if (this.onFlush !== undefined) {
      this.onFlush(writes.length, durationMs);
    }

    this.isFlushing = false;
  }

  /**
   * Check if a write is pending for a key
   *
   * @param key - File path/key
   * @returns True if write is pending
   */
  isPending(key: string): boolean {
    return this.pendingWrites.has(key);
  }

  /**
   * Get pending content for a key (if any)
   *
   * Useful for reading back recently written content before flush.
   *
   * @param key - File path/key
   * @returns Pending content or undefined
   */
  getPending(key: string): string | undefined {
    return this.pendingWrites.get(key)?.content;
  }

  /**
   * Get the number of pending writes
   *
   * @returns Number of writes currently queued for flushing
   */
  get pendingCount(): number {
    return this.pendingWrites.size;
  }

  /**
   * Get batcher metrics
   *
   * @returns Current write batcher performance metrics
   */
  getMetrics(): WriteBatcherMetrics {
    return {
      totalWrites: this.totalWrites,
      totalFlushes: this.totalFlushes,
      coalescedWrites: this.coalescedWrites,
      errors: this.errors,
      pendingWrites: this.pendingWrites.size,
      avgWritesPerFlush: this.totalFlushes > 0 ? this.totalWrites / this.totalFlushes : 0,
      avgFlushDurationMs: this.totalFlushes > 0 ? this.totalFlushDurationMs / this.totalFlushes : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalWrites = 0;
    this.totalFlushes = 0;
    this.coalescedWrites = 0;
    this.errors = 0;
    this.totalFlushDurationMs = 0;
  }

  /**
   * Close the batcher
   *
   * Flushes all pending writes and stops the flush timer.
   * After close(), no more writes can be queued.
   */
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    this.stopFlushTimer();

    // Final flush
    await this.flush();
  }

  /**
   * Check if the batcher is closed
   *
   * @returns True if the batcher has been closed and no longer accepts writes
   */
  get closed(): boolean {
    return this.isClosed;
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error: unknown) => {
        // Primary error handling is done per-write
        // This catch prevents unhandled promise rejection
        logger.debug('Periodic flush failed', { error });
      });
    }, this.flushIntervalMs);

    // Ensure timer doesn't keep process alive
    this.flushTimer.unref();
  }

  /**
   * Stop the automatic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
