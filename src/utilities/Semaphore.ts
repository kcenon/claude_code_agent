/**
 * Semaphore - Generic concurrency limiter
 *
 * Controls concurrent access to a shared resource by limiting
 * the number of simultaneous operations. Tasks that exceed the
 * limit are queued and executed as slots become available.
 *
 * @packageDocumentation
 */

/**
 * A counting semaphore for limiting concurrent operations.
 *
 * @example
 * ```typescript
 * const semaphore = new Semaphore(3); // Allow 3 concurrent operations
 *
 * async function limitedOperation() {
 *   await semaphore.acquire();
 *   try {
 *     await doWork();
 *   } finally {
 *     semaphore.release();
 *   }
 * }
 * ```
 */
export class Semaphore {
  private queue: Array<() => void> = [];
  private current = 0;

  constructor(private readonly max: number) {
    if (max < 1) {
      throw new Error('Semaphore max must be at least 1');
    }
  }

  /**
   * Acquire a semaphore slot. Resolves immediately if a slot is
   * available, otherwise waits until one is released.
   */
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  /**
   * Release a semaphore slot. If tasks are waiting in the queue,
   * the next one is immediately resumed.
   */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      // Slot is transferred to the next waiter (current stays the same)
      next();
    } else {
      this.current--;
    }
  }

  /** Number of currently acquired slots. */
  get activeCount(): number {
    return this.current;
  }

  /** Number of tasks waiting in the queue. */
  get waitingCount(): number {
    return this.queue.length;
  }
}
