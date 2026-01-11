/**
 * Scratchpad Backend Interface
 *
 * Defines the contract for storage backends used by Scratchpad.
 * Implementations include FileBackend, SQLiteBackend, and RedisBackend.
 *
 * @example
 * ```typescript
 * class CustomBackend implements IScratchpadBackend {
 *   async read<T>(section: string, key: string): Promise<T | null> {
 *     // Custom implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */

/**
 * Batch operation for atomic updates
 */
export interface BatchOperation {
  /** Operation type */
  readonly type: 'write' | 'delete';
  /** Section identifier */
  readonly section: string;
  /** Key identifier */
  readonly key: string;
  /** Value to write (required for 'write' type) */
  readonly value?: unknown;
}

/**
 * Backend health status
 */
export interface BackendHealth {
  /** Whether the backend is healthy */
  readonly healthy: boolean;
  /** Optional status message */
  readonly message?: string;
  /** Latency in milliseconds (if measured) */
  readonly latencyMs?: number;
}

/**
 * Scratchpad storage backend interface
 *
 * All backend implementations must implement this interface to be
 * compatible with the Scratchpad system.
 */
export interface IScratchpadBackend {
  /**
   * Backend name for identification and logging
   */
  readonly name: string;

  /**
   * Initialize the backend connection/resources
   *
   * Called once before any read/write operations.
   * Should create tables, establish connections, etc.
   *
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Read a value by section and key
   *
   * @param section - Section identifier (e.g., 'info', 'documents')
   * @param key - Key within the section
   * @returns The stored value or null if not found
   */
  read<T>(section: string, key: string): Promise<T | null>;

  /**
   * Write a value by section and key
   *
   * @param section - Section identifier
   * @param key - Key within the section
   * @param value - Value to store (will be serialized)
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  write<T>(section: string, key: string, value: T): Promise<void>;

  /**
   * Delete a value by section and key
   *
   * @param section - Section identifier
   * @param key - Key within the section
   * @returns True if the value was deleted, false if it didn't exist
   */
  delete(section: string, key: string): Promise<boolean>;

  /**
   * List all keys in a section
   *
   * @param section - Section identifier
   * @returns Array of keys in the section
   */
  list(section: string): Promise<string[]>;

  /**
   * Check if a key exists in a section
   *
   * @param section - Section identifier
   * @param key - Key within the section
   * @returns True if the key exists
   */
  exists(section: string, key: string): Promise<boolean>;

  /**
   * Execute multiple operations atomically
   *
   * All operations succeed or all fail together.
   *
   * @param operations - Array of batch operations
   * @throws Error if any operation fails (all are rolled back)
   */
  batch(operations: BatchOperation[]): Promise<void>;

  /**
   * Check backend health
   *
   * @returns Health status of the backend
   */
  healthCheck(): Promise<BackendHealth>;

  /**
   * Close the backend and release resources
   *
   * Called when the backend is no longer needed.
   * Should close connections, flush buffers, etc.
   */
  close(): Promise<void>;
}
