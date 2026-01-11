/**
 * Backend configuration types
 *
 * Defines configuration options for each backend implementation.
 */

/**
 * Supported backend types
 */
export type BackendType = 'file' | 'sqlite' | 'redis';

/**
 * File backend configuration
 */
export interface FileBackendConfig {
  /** Base directory for storing files (default: '.ad-sdlc/scratchpad') */
  readonly basePath?: string;
  /** File permission mode (default: 0o600) */
  readonly fileMode?: number;
  /** Directory permission mode (default: 0o700) */
  readonly dirMode?: number;
  /**
   * File format for serialization (default: 'yaml')
   * - 'yaml': YAML serialization with .yaml extension
   * - 'json': JSON serialization with .json extension
   * - 'raw': No serialization, no extension added (key includes extension)
   */
  readonly format?: 'yaml' | 'json' | 'raw';
}

/**
 * SQLite backend configuration
 */
export interface SQLiteBackendConfig {
  /** Path to SQLite database file (default: '.ad-sdlc/scratchpad.db') */
  readonly dbPath?: string;
  /** Enable WAL mode for better concurrency (default: true) */
  readonly walMode?: boolean;
  /** Busy timeout in milliseconds (default: 5000) */
  readonly busyTimeout?: number;
}

/**
 * Redis backend configuration
 */
export interface RedisBackendConfig {
  /** Redis host (default: 'localhost') */
  readonly host?: string;
  /** Redis port (default: 6379) */
  readonly port?: number;
  /** Redis password (optional) */
  readonly password?: string;
  /** Redis database number (default: 0) */
  readonly db?: number;
  /** Key prefix (default: 'ad-sdlc:scratchpad:') */
  readonly prefix?: string;
  /** TTL in seconds for entries (optional, no expiry if not set) */
  readonly ttl?: number;
  /** Connection timeout in milliseconds (default: 5000) */
  readonly connectTimeout?: number;
  /** Maximum retry attempts on connection failure (default: 3) */
  readonly maxRetries?: number;
}

/**
 * Combined scratchpad backend configuration
 */
export interface ScratchpadBackendConfig {
  /** Backend type to use (default: 'file') */
  readonly backend?: BackendType;
  /** File backend specific options */
  readonly file?: FileBackendConfig;
  /** SQLite backend specific options */
  readonly sqlite?: SQLiteBackendConfig;
  /** Redis backend specific options */
  readonly redis?: RedisBackendConfig;
}
