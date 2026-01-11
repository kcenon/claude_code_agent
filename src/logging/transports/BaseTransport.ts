/**
 * BaseTransport - Abstract base class for log transport implementations
 *
 * Provides common functionality for buffering, retry logic, and health tracking
 * that can be shared across all transport implementations.
 *
 * @module logging/transports
 */

import type { ILogTransport, TransportState, TransportHealth } from './ILogTransport.js';
import type { TransportLogEntry, BaseTransportConfig, LogLevel } from './types.js';
import { shouldLog } from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_BUFFER_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MIN_LEVEL: LogLevel = 'DEBUG';

/**
 * Abstract base class for log transport implementations
 *
 * Provides common functionality including:
 * - Log entry buffering
 * - Automatic flush on buffer size or interval
 * - Retry logic for failed log attempts
 * - Health tracking and monitoring
 *
 * Subclasses must implement:
 * - `doInitialize()`: Transport-specific initialization
 * - `doLog()`: Actual log shipping logic
 * - `doFlush()`: Flush pending logs
 * - `doClose()`: Transport-specific cleanup
 *
 * @example
 * ```typescript
 * class ConsoleTransport extends BaseTransport {
 *   constructor(config: ConsoleTransportConfig) {
 *     super('console', config);
 *   }
 *
 *   protected async doInitialize(): Promise<void> {
 *     // No initialization needed
 *   }
 *
 *   protected async doLog(entries: TransportLogEntry[]): Promise<void> {
 *     for (const entry of entries) {
 *       console.log(JSON.stringify(entry));
 *     }
 *   }
 *
 *   protected async doFlush(): Promise<void> {
 *     // Console is synchronous
 *   }
 *
 *   protected async doClose(): Promise<void> {
 *     // Nothing to close
 *   }
 * }
 * ```
 */
export abstract class BaseTransport implements ILogTransport {
  /**
   * Transport name for identification
   */
  public readonly name: string;

  /**
   * Current transport state
   */
  protected state: TransportState = 'uninitialized';

  /**
   * Buffer for pending log entries
   */
  protected buffer: TransportLogEntry[] = [];

  /**
   * Configuration values
   */
  protected readonly bufferSize: number;
  protected readonly flushIntervalMs: number;
  protected readonly maxRetries: number;
  protected readonly retryDelayMs: number;
  protected readonly minLevel: LogLevel;
  protected readonly enableBatching: boolean;

  /**
   * Health tracking
   */
  protected lastLogTime?: Date;
  protected lastErrorTime?: Date;
  protected lastError?: string;
  protected failedAttempts = 0;
  protected totalProcessed = 0;

  /**
   * Flush interval timer
   */
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Create a new BaseTransport instance
   *
   * @param name - Transport name for identification
   * @param config - Transport configuration
   */
  constructor(name: string, config: BaseTransportConfig = {}) {
    this.name = name;
    this.bufferSize = config.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.minLevel = config.minLevel ?? DEFAULT_MIN_LEVEL;
    this.enableBatching = config.enableBatching ?? true;
  }

  /**
   * Initialize the transport
   *
   * Sets up the flush interval timer and calls transport-specific initialization.
   */
  public async initialize(): Promise<void> {
    if (this.state !== 'uninitialized') {
      throw new Error(`Transport ${this.name} is already initialized (state: ${this.state})`);
    }

    this.state = 'initializing';

    try {
      await this.doInitialize();

      // Start flush interval timer
      if (this.flushIntervalMs > 0 && this.enableBatching) {
        this.flushTimer = setInterval(() => {
          void this.flush().catch((error: unknown) => {
            this.handleError('Flush interval error', error);
          });
        }, this.flushIntervalMs);
      }

      this.state = 'ready';
    } catch (error) {
      this.state = 'error';
      this.handleError('Initialization failed', error);
      throw error;
    }
  }

  /**
   * Log an entry
   *
   * Buffers the entry and flushes if buffer is full (when batching is enabled).
   * Ships immediately if batching is disabled.
   */
  public async log(entry: TransportLogEntry): Promise<void> {
    if (this.state !== 'ready') {
      throw new Error(`Transport ${this.name} is not ready (state: ${this.state})`);
    }

    // Check log level
    if (!shouldLog(entry.level, this.minLevel)) {
      return;
    }

    if (this.enableBatching) {
      this.buffer.push(entry);

      if (this.buffer.length >= this.bufferSize) {
        await this.flush();
      }
    } else {
      await this.shipWithRetry([entry]);
    }
  }

  /**
   * Flush pending logs
   *
   * Ships all buffered entries to the destination.
   */
  public async flush(): Promise<void> {
    if (this.state !== 'ready' && this.state !== 'error') {
      return;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const entries = this.buffer.splice(0);
    await this.shipWithRetry(entries);
    await this.doFlush();
  }

  /**
   * Close the transport
   *
   * Flushes pending logs, stops the timer, and cleans up resources.
   */
  public async close(): Promise<void> {
    if (this.state === 'closed') {
      return;
    }

    // Stop flush timer
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining logs
    try {
      await this.flush();
    } catch {
      // Ignore flush errors during close
    }

    try {
      await this.doClose();
    } finally {
      this.state = 'closed';
    }
  }

  /**
   * Get transport health status
   */
  public getHealth(): TransportHealth {
    const health: TransportHealth = {
      state: this.state,
      pendingLogs: this.buffer.length,
      failedAttempts: this.failedAttempts,
      totalProcessed: this.totalProcessed,
    };

    // Add optional fields only if defined
    if (this.lastLogTime !== undefined) {
      (health as { lastLogTime: Date }).lastLogTime = this.lastLogTime;
    }
    if (this.lastErrorTime !== undefined) {
      (health as { lastErrorTime: Date }).lastErrorTime = this.lastErrorTime;
    }
    if (this.lastError !== undefined) {
      (health as { lastError: string }).lastError = this.lastError;
    }

    return health;
  }

  /**
   * Check if transport is ready
   */
  public isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Ship entries with retry logic
   */
  private async shipWithRetry(entries: TransportLogEntry[]): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.doLog(entries);
        this.totalProcessed += entries.length;
        this.lastLogTime = new Date();
        return;
      } catch (error) {
        lastError = error;
        this.failedAttempts++;
        this.handleError(`Log attempt ${String(attempt + 1)} failed`, error);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelayMs * (attempt + 1));
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Handle an error by tracking it
   */
  protected handleError(context: string, error: unknown): void {
    this.lastErrorTime = new Date();
    this.lastError = error instanceof Error ? error.message : String(error);

    // Log to console for visibility
    console.error(`[${this.name}] ${context}:`, this.lastError);
  }

  /**
   * Delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Transport-specific initialization
   *
   * Override in subclass to perform transport-specific setup.
   */
  protected abstract doInitialize(): Promise<void>;

  /**
   * Transport-specific log shipping
   *
   * Override in subclass to ship log entries to the destination.
   *
   * @param entries - Log entries to ship
   */
  protected abstract doLog(entries: TransportLogEntry[]): Promise<void>;

  /**
   * Transport-specific flush
   *
   * Override in subclass for any additional flush operations.
   */
  protected abstract doFlush(): Promise<void>;

  /**
   * Transport-specific cleanup
   *
   * Override in subclass to release resources.
   */
  protected abstract doClose(): Promise<void>;
}
