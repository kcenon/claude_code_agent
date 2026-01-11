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
 * Distributed lock configuration
 */
export interface RedisLockConfig {
  /** Default lock TTL in seconds (default: 30) */
  readonly lockTtl?: number;
  /** Lock acquisition timeout in milliseconds (default: 10000) */
  readonly lockTimeout?: number;
  /** Retry interval for lock acquisition in milliseconds (default: 100) */
  readonly lockRetryInterval?: number;
}

/**
 * Fallback configuration for Redis backend
 */
export interface RedisFallbackConfig {
  /** Enable fallback to file backend on connection failure (default: false) */
  readonly enabled?: boolean;
  /** File backend configuration for fallback */
  readonly fileConfig?: FileBackendConfig;
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
  /** Distributed lock configuration */
  readonly lock?: RedisLockConfig;
  /** Fallback configuration for connection failures */
  readonly fallback?: RedisFallbackConfig;
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
