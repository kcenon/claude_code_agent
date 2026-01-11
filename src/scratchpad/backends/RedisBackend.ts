/**
 * Redis-based backend for Scratchpad
 *
 * Stores data in Redis for distributed deployments.
 * Supports TTL, connection pooling, and pipeline operations.
 */

import type { IScratchpadBackend, BatchOperation, BackendHealth } from './IScratchpadBackend.js';
import type { RedisBackendConfig } from './types.js';

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
 * Redis client interface (compatible with ioredis)
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exMode?: 'EX', exValue?: number): Promise<'OK'>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(...keys: string[]): Promise<number>;
  ping(): Promise<string>;
  pipeline(): RedisPipeline;
  quit(): Promise<'OK'>;
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
 * Redis-based storage backend
 *
 * Implements IScratchpadBackend using Redis for distributed
 * storage with optional TTL support.
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

  private client: RedisClient | null = null;

  constructor(config: RedisBackendConfig = {}) {
    this.host = config.host ?? DEFAULT_HOST;
    this.port = config.port ?? DEFAULT_PORT;
    this.password = config.password;
    this.db = config.db ?? DEFAULT_DB;
    this.prefix = config.prefix ?? DEFAULT_PREFIX;
    this.ttl = config.ttl;
    this.connectTimeout = config.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Get the Redis key for a section/key combination
   */
  private getRedisKey(section: string, key: string): string {
    return `${this.prefix}${section}:${key}`;
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

  async initialize(): Promise<void> {
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
      retryStrategy: (times: number) => {
        if (times > this.maxRetries) {
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
    });

    // Verify connection
    await this.client.ping();
  }

  private ensureInitialized(): void {
    if (!this.client) {
      throw new Error('RedisBackend not initialized. Call initialize() first.');
    }
  }

  async read<T>(section: string, key: string): Promise<T | null> {
    this.ensureInitialized();

    const redisKey = this.getRedisKey(section, key);
    const value = await this.client!.get(redisKey);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async write<T>(section: string, key: string, value: T): Promise<void> {
    this.ensureInitialized();

    const redisKey = this.getRedisKey(section, key);
    const serialized = JSON.stringify(value);

    if (this.ttl) {
      await this.client!.setex(redisKey, this.ttl, serialized);
    } else {
      await this.client!.set(redisKey, serialized);
    }
  }

  async delete(section: string, key: string): Promise<boolean> {
    this.ensureInitialized();

    const redisKey = this.getRedisKey(section, key);
    const deleted = await this.client!.del(redisKey);

    return deleted > 0;
  }

  async list(section: string): Promise<string[]> {
    this.ensureInitialized();

    const pattern = `${this.prefix}${section}:*`;
    const keys = await this.client!.keys(pattern);

    return keys
      .map((redisKey) => {
        const parsed = this.parseRedisKey(redisKey);
        return parsed?.key ?? null;
      })
      .filter((key): key is string => key !== null);
  }

  async exists(section: string, key: string): Promise<boolean> {
    this.ensureInitialized();

    const redisKey = this.getRedisKey(section, key);
    const result = await this.client!.exists(redisKey);

    return result > 0;
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    this.ensureInitialized();

    const pipeline = this.client!.pipeline();

    for (const op of operations) {
      const redisKey = this.getRedisKey(op.section, op.key);

      if (op.type === 'write') {
        const serialized = JSON.stringify(op.value);
        if (this.ttl) {
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
    try {
      this.ensureInitialized();

      const startTime = Date.now();
      await this.client!.ping();
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
  }
}
