/**
 * ILogTransport - Interface for log transport implementations
 *
 * This interface defines the contract for all log transport implementations
 * including Console, File, Elasticsearch, and CloudWatch transports.
 *
 * @module logging/transports
 */

import type { TransportLogEntry } from './types.js';

/**
 * Transport state representing the current operational status
 */
export type TransportState = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'closed';

/**
 * Transport health information for monitoring
 */
export interface TransportHealth {
  /** Current transport state */
  readonly state: TransportState;
  /** Last successful log time */
  readonly lastLogTime?: Date;
  /** Last error time if any */
  readonly lastErrorTime?: Date;
  /** Last error message if any */
  readonly lastError?: string;
  /** Number of pending logs in buffer */
  readonly pendingLogs: number;
  /** Number of failed log attempts */
  readonly failedAttempts: number;
  /** Total logs processed */
  readonly totalProcessed: number;
}

/**
 * Interface for log transport implementations
 *
 * All transport implementations must implement this interface to enable
 * pluggable logging destinations. Transports handle the actual shipping
 * of log entries to their respective destinations.
 *
 * @example
 * ```typescript
 * class ConsoleTransport implements ILogTransport {
 *   readonly name = 'console';
 *
 *   async initialize(): Promise<void> {
 *     // No initialization needed for console
 *   }
 *
 *   async log(entry: TransportLogEntry): Promise<void> {
 *     console.log(JSON.stringify(entry));
 *   }
 *
 *   async flush(): Promise<void> {
 *     // Console is synchronous, no flush needed
 *   }
 *
 *   async close(): Promise<void> {
 *     // Nothing to close for console
 *   }
 * }
 * ```
 */
export interface ILogTransport {
  /**
   * Unique name identifying this transport
   *
   * Used for logging, debugging, and configuration purposes.
   * Should be a short, descriptive name like 'console', 'file', 'elasticsearch', etc.
   */
  readonly name: string;

  /**
   * Initialize the transport connection
   *
   * Called once before any log entries are shipped. Implementations should
   * establish connections, create necessary resources, and validate configuration.
   *
   * @throws TransportInitializationError if initialization fails
   *
   * @example
   * ```typescript
   * async initialize(): Promise<void> {
   *   this.client = new Client({ node: this.config.url });
   *   await this.client.ping();
   * }
   * ```
   */
  initialize(): Promise<void>;

  /**
   * Ship a log entry to the destination
   *
   * Called for each log entry that needs to be shipped. Implementations
   * may buffer entries for batch shipping or ship immediately.
   *
   * This method should be non-blocking when possible. Failed log attempts
   * should be handled gracefully (e.g., buffered for retry).
   *
   * @param entry - The log entry to ship
   * @throws TransportLogError if logging fails and cannot be retried
   *
   * @example
   * ```typescript
   * async log(entry: TransportLogEntry): Promise<void> {
   *   this.buffer.push(entry);
   *   if (this.buffer.length >= this.batchSize) {
   *     await this.flush();
   *   }
   * }
   * ```
   */
  log(entry: TransportLogEntry): Promise<void>;

  /**
   * Flush any pending log entries
   *
   * Called to ensure all buffered log entries are shipped to the destination.
   * Should be called periodically and before closing the transport.
   *
   * @throws TransportFlushError if flush fails
   *
   * @example
   * ```typescript
   * async flush(): Promise<void> {
   *   if (this.buffer.length === 0) return;
   *   await this.client.bulk({ body: this.buffer });
   *   this.buffer = [];
   * }
   * ```
   */
  flush(): Promise<void>;

  /**
   * Close the transport connection
   *
   * Called when the transport is no longer needed. Implementations should
   * flush any pending logs and release all resources.
   *
   * After close() is called, the transport should not accept any more logs.
   *
   * @throws TransportCloseError if close fails
   *
   * @example
   * ```typescript
   * async close(): Promise<void> {
   *   await this.flush();
   *   await this.client.close();
   * }
   * ```
   */
  close(): Promise<void>;

  /**
   * Get the current health status of the transport
   *
   * Optional method for monitoring transport health. Returns information
   * about the transport's current state, pending logs, and error history.
   *
   * @returns Current transport health information
   *
   * @example
   * ```typescript
   * getHealth(): TransportHealth {
   *   return {
   *     state: this.state,
   *     pendingLogs: this.buffer.length,
   *     failedAttempts: this.failureCount,
   *     totalProcessed: this.processedCount,
   *   };
   * }
   * ```
   */
  getHealth?(): TransportHealth;

  /**
   * Check if the transport is ready to accept logs
   *
   * Optional method for checking transport readiness.
   *
   * @returns true if the transport is ready to accept logs
   */
  isReady?(): boolean;
}
