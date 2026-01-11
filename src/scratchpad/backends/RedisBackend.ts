/**
 * Redis-based backend for Scratchpad
 *
 * Stores data in Redis for distributed deployments.
 * Supports TTL, connection pooling, distributed locking, and fallback to FileBackend.
 */

import { randomUUID } from 'node:crypto';
import type { IScratchpadBackend, BatchOperation, BackendHealth } from './IScratchpadBackend.js';
import type { RedisBackendConfig, RedisLockConfig, RedisFallbackConfig } from './types.js';
import { RedisConnectionError, RedisLockTimeoutError } from '../errors.js';

/**
 * Default values
 */
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 6379;
const DEFAULT_DB = 0;
const DEFAULT_PREFIX = 'ad-sdlc:scratchpad:';
const DEFAULT_CONNECT_TIMEOUT = 5000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Default lock configuration
 */
const DEFAULT_LOCK_TTL = 30;
const DEFAULT_LOCK_TIMEOUT = 10000;
const DEFAULT_LOCK_RETRY_INTERVAL = 100;

/**
 * Redis client interface (compatible with ioredis)
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    exMode?: 'EX' | 'PX',
    exValue?: number,
    setMode?: 'NX' | 'XX'
  ): Promise<'OK' | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
  pipeline(): RedisPipeline;
  quit(): Promise<'OK'>;
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

/**
 * Redis pipeline interface
 */
interface RedisPipeline {
  set(key: string, value: string): RedisPipeline;
  setex(key: string, seconds: number, value: string): RedisPipeline;
  del(key: string): RedisPipeline;
  exec(): Promise<Array<[Error | null, unknown]>>;
}

/**
 * Distributed lock handle
 */
export interface RedisLockHandle {
  /** Lock key */
  readonly key: string;
  /** Lock value (used for safe release) */
  readonly value: string;
  /** Lock TTL in seconds */
  readonly ttl: number;
  /** Timestamp when lock was acquired */
  readonly acquiredAt: number;
}

/**
 * Lock acquisition options
 */
export interface AcquireLockOptions {
  /** Lock TTL in seconds (overrides default) */
  ttl?: number;
  /** Timeout for lock acquisition in milliseconds (overrides default) */
  timeout?: number;
}

/**
 * Lua script for safe lock release
 * Only releases the lock if the value matches (prevents releasing another client's lock)
 */
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Lua script for lock extension
 * Only extends the lock if the value matches
 */
const EXTEND_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Redis-based storage backend
 *
 * Implements IScratchpadBackend using Redis for distributed
 * storage with optional TTL support, distributed locking, and fallback.
 */
export class RedisBackend implements IScratchpadBackend {
  public readonly name = 'redis';

  private readonly host: string;
  private readonly port: number;
  private readonly password: string | undefined;
  private readonly db: number;
  private readonly prefix: string;
  private readonly ttl: number | undefined;
  private readonly connectTimeout: number;
  private readonly maxRetries: number;
  private readonly lockConfig: Required<RedisLockConfig>;
  private readonly fallbackConfig: RedisFallbackConfig | undefined;

  private client: RedisClient | null = null;
  private fallbackBackend: IScratchpadBackend | null = null;
  private useFallback = false;

  constructor(config: RedisBackendConfig = {}) {
    this.host = config.host ?? DEFAULT_HOST;
    this.port = config.port ?? DEFAULT_PORT;
    this.password = config.password;
    this.db = config.db ?? DEFAULT_DB;
    this.prefix = config.prefix ?? DEFAULT_PREFIX;
    this.ttl = config.ttl;
    this.connectTimeout = config.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fallbackConfig = config.fallback;

    // Initialize lock configuration with defaults
    this.lockConfig = {
      lockTtl: config.lock?.lockTtl ?? DEFAULT_LOCK_TTL,
      lockTimeout: config.lock?.lockTimeout ?? DEFAULT_LOCK_TIMEOUT,
      lockRetryInterval: config.lock?.lockRetryInterval ?? DEFAULT_LOCK_RETRY_INTERVAL,
    };
  }

  /**
   * Get the Redis key for a section/key combination
   */
  private getRedisKey(section: string, key: string): string {
    return `${this.prefix}${section}:${key}`;
  }

  /**
   * Get the Redis key for a distributed lock
   */
  private getLockKey(lockName: string): string {
    return `${this.prefix}lock:${lockName}`;
  }

  /**
   * Parse section and key from a Redis key
   */
  private parseRedisKey(redisKey: string): { section: string; key: string } | null {
    if (!redisKey.startsWith(this.prefix)) {
      return null;
    }

    const rest = redisKey.slice(this.prefix.length);
    const colonIndex = rest.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    return {
      section: rest.slice(0, colonIndex),
      key: rest.slice(colonIndex + 1),
    };
  }

  /**
   * Initialize fallback backend if configured
   */
  private async initializeFallback(): Promise<void> {
    if (this.fallbackConfig?.enabled !== true || this.fallbackBackend !== null) {
      return;
    }

    // Dynamic import of FileBackend
    const { FileBackend } = await import('./FileBackend.js');
    this.fallbackBackend = new FileBackend(this.fallbackConfig.fileConfig);
    await this.fallbackBackend.initialize();
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of ioredis
      const IoRedisModule = await import('ioredis');
      const Redis =
        'default' in IoRedisModule
          ? (IoRedisModule.default as unknown as new (options: object) => RedisClient)
          : (IoRedisModule as unknown as new (options: object) => RedisClient);

      // Create Redis client
      this.client = new Redis({
        host: this.host,
        port: this.port,
        password: this.password,
        db: this.db,
        connectTimeout: this.connectTimeout,
        maxRetriesPerRequest: this.maxRetries,
        retryStrategy: (times: number): number | null => {
          if (times > this.maxRetries) {
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        },
      });

      // Verify connection
      await this.client.ping();
      this.useFallback = false;
    } catch (error) {
      // If fallback is enabled, use it
      if (this.fallbackConfig?.enabled === true) {
        await this.initializeFallback();
        this.useFallback = true;
        this.client = null;
        return;
      }
      // Otherwise, throw the connection error
      throw new RedisConnectionError(this.host, this.port, error as Error);
    }
  }

  /**
   * Get the active backend (Redis client or fallback)
   */
  private getActiveBackend(): IScratchpadBackend | null {
    if (this.useFallback && this.fallbackBackend !== null) {
      return this.fallbackBackend;
    }
    return null;
  }

  private getClient(): RedisClient {
    if (this.useFallback) {
      throw new Error('Redis client not available, using fallback backend.');
    }
    if (!this.client) {
      throw new Error('RedisBackend not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Check if currently using fallback backend
   */
  public isUsingFallback(): boolean {
    return this.useFallback;
  }

  async read<T>(section: string, key: string): Promise<T | null> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      return fallback.read<T>(section, key);
    }

    const client = this.getClient();

    const redisKey = this.getRedisKey(section, key);
    const value = await client.get(redisKey);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  async write<T>(section: string, key: string, value: T): Promise<void> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      return fallback.write(section, key, value);
    }

    const client = this.getClient();

    const redisKey = this.getRedisKey(section, key);
    const serialized = JSON.stringify(value);

    if (this.ttl !== undefined) {
      await client.setex(redisKey, this.ttl, serialized);
    } else {
      await client.set(redisKey, serialized);
    }
  }

  async delete(section: string, key: string): Promise<boolean> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      return fallback.delete(section, key);
    }

    const client = this.getClient();

    const redisKey = this.getRedisKey(section, key);
    const deleted = await client.del(redisKey);

    return deleted > 0;
  }

  async list(section: string): Promise<string[]> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      return fallback.list(section);
    }

    const client = this.getClient();

    const pattern = `${this.prefix}${section}:*`;
    const keys = await client.keys(pattern);

    return keys
      .map((redisKey) => {
        const parsed = this.parseRedisKey(redisKey);
        return parsed?.key ?? null;
      })
      .filter((key): key is string => key !== null);
  }

  async exists(section: string, key: string): Promise<boolean> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      return fallback.exists(section, key);
    }

    const client = this.getClient();

    const redisKey = this.getRedisKey(section, key);
    const result = await client.exists(redisKey);

    return result > 0;
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      return fallback.batch(operations);
    }

    const client = this.getClient();

    const pipeline = client.pipeline();

    for (const op of operations) {
      const redisKey = this.getRedisKey(op.section, op.key);

      if (op.type === 'write') {
        const serialized = JSON.stringify(op.value);
        if (this.ttl !== undefined) {
          pipeline.setex(redisKey, this.ttl, serialized);
        } else {
          pipeline.set(redisKey, serialized);
        }
      } else {
        pipeline.del(redisKey);
      }
    }

    const results = await pipeline.exec();

    // Check for errors
    for (const [error] of results) {
      if (error) {
        throw error;
      }
    }
  }

  async healthCheck(): Promise<BackendHealth> {
    const fallback = this.getActiveBackend();
    if (fallback !== null) {
      const health = await fallback.healthCheck();
      return {
        ...health,
        message: `Using fallback: ${health.message ?? 'unknown'}`,
      };
    }

    try {
      const client = this.getClient();

      const startTime = Date.now();
      await client.ping();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: true,
        message: 'Redis backend is healthy',
        latencyMs,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Redis backend error: ${(error as Error).message}`,
      };
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.fallbackBackend !== null) {
      await this.fallbackBackend.close();
      this.fallbackBackend = null;
    }
  }

  // =====================
  // Distributed Locking
  // =====================

  /**
   * Acquire a distributed lock
   *
   * Uses Redis SET NX EX pattern for atomic lock acquisition.
   * The lock is identified by a unique value to ensure safe release.
   *
   * @param lockName - Name of the lock to acquire
   * @param options - Lock acquisition options
   * @returns Lock handle for releasing the lock
   * @throws {RedisLockTimeoutError} If lock cannot be acquired within timeout
   * @throws {Error} If Redis connection is not available
   *
   * @example
   * ```typescript
   * const lock = await backend.acquireLock('my-resource');
   * try {
   *   // Do work with exclusive access
   * } finally {
   *   await backend.releaseLock(lock);
   * }
   * ```
   */
  async acquireLock(lockName: string, options: AcquireLockOptions = {}): Promise<RedisLockHandle> {
    if (this.useFallback) {
      throw new Error('Distributed locking not available when using fallback backend.');
    }

    const client = this.getClient();
    const lockKey = this.getLockKey(lockName);
    const lockValue = randomUUID();
    const ttl = options.ttl ?? this.lockConfig.lockTtl;
    const timeout = options.timeout ?? this.lockConfig.lockTimeout;

    const startTime = Date.now();
    const deadline = startTime + timeout;

    while (Date.now() < deadline) {
      // Try to acquire lock with SET NX EX
      const result = await client.set(lockKey, lockValue, 'EX', ttl, 'NX');

      if (result === 'OK') {
        return {
          key: lockKey,
          value: lockValue,
          ttl,
          acquiredAt: Date.now(),
        };
      }

      // Wait before retrying
      await this.sleep(this.lockConfig.lockRetryInterval);
    }

    throw new RedisLockTimeoutError(lockName, timeout);
  }

  /**
   * Release a distributed lock
   *
   * Uses Lua script to atomically check and delete the lock,
   * ensuring we only release our own lock (not one acquired by another client).
   *
   * @param handle - Lock handle returned from acquireLock
   * @returns True if lock was released, false if lock was already released or expired
   * @throws {Error} If Redis connection is not available
   */
  async releaseLock(handle: RedisLockHandle): Promise<boolean> {
    if (this.useFallback) {
      throw new Error('Distributed locking not available when using fallback backend.');
    }

    const client = this.getClient();
    const result = await client.eval(RELEASE_LOCK_SCRIPT, 1, handle.key, handle.value);

    return result === 1;
  }

  /**
   * Extend a lock's TTL
   *
   * Uses Lua script to atomically check and extend the lock's TTL,
   * ensuring we only extend our own lock.
   *
   * @param handle - Lock handle returned from acquireLock
   * @param newTtl - New TTL in seconds (optional, uses original TTL if not specified)
   * @returns True if lock was extended, false if lock was already released or expired
   * @throws {Error} If Redis connection is not available
   */
  async extendLock(handle: RedisLockHandle, newTtl?: number): Promise<boolean> {
    if (this.useFallback) {
      throw new Error('Distributed locking not available when using fallback backend.');
    }

    const client = this.getClient();
    const ttl = newTtl ?? handle.ttl;
    const result = await client.eval(EXTEND_LOCK_SCRIPT, 1, handle.key, handle.value, ttl);

    return result === 1;
  }

  /**
   * Execute a function with a distributed lock
   *
   * Acquires the lock, executes the function, and releases the lock.
   * The lock is released even if the function throws an error.
   *
   * @param lockName - Name of the lock to acquire
   * @param fn - Function to execute with the lock held
   * @param options - Lock acquisition options
   * @returns Result of the function
   *
   * @example
   * ```typescript
   * const result = await backend.withLock('my-resource', async () => {
   *   return await doExclusiveWork();
   * });
   * ```
   */
  async withLock<T>(
    lockName: string,
    fn: () => Promise<T>,
    options: AcquireLockOptions = {}
  ): Promise<T> {
    const lock = await this.acquireLock(lockName, options);
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
