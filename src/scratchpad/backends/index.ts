/**
 * Scratchpad backends module
 *
 * Provides storage backend implementations for Scratchpad.
 */

// Interface and types
export type { IScratchpadBackend, BatchOperation, BackendHealth } from './IScratchpadBackend.js';
export type {
  BackendType,
  FileBackendConfig,
  SQLiteBackendConfig,
  RedisBackendConfig,
  RedisLockConfig,
  RedisFallbackConfig,
  ScratchpadBackendConfig,
} from './types.js';

// Backend implementations (to be added)
export { FileBackend } from './FileBackend.js';
export { SQLiteBackend } from './SQLiteBackend.js';
export { RedisBackend } from './RedisBackend.js';
export type { RedisLockHandle, AcquireLockOptions } from './RedisBackend.js';

// Factory
export { BackendFactory } from './BackendFactory.js';
