/**
 * CachedScratchpad - Scratchpad with caching layer for improved performance
 *
 * Extends the base Scratchpad with:
 * - LRU cache for frequently accessed files
 * - Write batching to reduce disk I/O
 * - Cache warming for known hot paths
 * - Cache invalidation on external file changes
 * - Performance metrics collection
 *
 * @example
 * ```typescript
 * const scratchpad = new CachedScratchpad({
 *   basePath: '.ad-sdlc/scratchpad',
 *   cacheSize: 1000,
 *   cacheTTLMs: 60000,
 *   flushIntervalMs: 50,
 * });
 *
 * // Reads are cached
 * const data1 = await scratchpad.readYaml(path); // Disk read
 * const data2 = await scratchpad.readYaml(path); // Cache hit
 *
 * // Writes are batched
 * await scratchpad.writeYaml(path1, data1);
 * await scratchpad.writeYaml(path2, data2);
 * // Both writes flushed together
 *
 * // Get performance metrics
 * console.log(scratchpad.getCacheMetrics());
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { Scratchpad } from './Scratchpad.js';
import { LRUCache } from './LRUCache.js';
import type { CacheMetrics } from './LRUCache.js';
import { WriteBatcher } from './WriteBatcher.js';
import type { WriteBatcherMetrics } from './WriteBatcher.js';
import type {
  ScratchpadOptions,
  AtomicWriteOptions,
  ReadOptions,
  SerializationFormat,
} from './types.js';

/**
 * Cache entry storing both raw content and parsed value
 */
interface CachedContent {
  /** Raw file content */
  raw: string;
  /** Parsed value (if applicable) */
  parsed?: unknown;
  /** File modification time when cached */
  mtime: number;
}

/**
 * CachedScratchpad configuration options
 */
export interface CachedScratchpadOptions extends ScratchpadOptions {
  /**
   * Enable caching (default: true)
   */
  enableCaching?: boolean;
  /**
   * Maximum number of entries in cache (default: 1000)
   */
  cacheSize?: number;
  /**
   * Cache TTL in milliseconds (default: undefined - no expiration)
   */
  cacheTTLMs?: number;
  /**
   * Enable write batching (default: true)
   */
  enableBatching?: boolean;
  /**
   * Flush interval in milliseconds (default: 50)
   */
  flushIntervalMs?: number;
  /**
   * Maximum batch size before forced flush (default: 100)
   */
  maxBatchSize?: number;
  /**
   * Enable file change detection for cache invalidation (default: false)
   * Note: This adds overhead by checking file mtime on each read
   */
  enableChangeDetection?: boolean;
  /**
   * Paths to warm cache on initialization
   */
  warmPaths?: string[];
}

/**
 * Combined metrics for cache and batcher
 */
export interface CachedScratchpadMetrics {
  cache: CacheMetrics;
  batcher: WriteBatcherMetrics;
}

/**
 * Default cache size
 */
const DEFAULT_CACHE_SIZE = 1000;

/**
 * Default flush interval
 */
const DEFAULT_FLUSH_INTERVAL_MS = 50;

/**
 * Default max batch size
 */
const DEFAULT_MAX_BATCH_SIZE = 100;

/**
 * Known hot paths to warm cache
 */
const HOT_PATHS = ['state', 'progress', 'controller_state.yaml'];

/**
 * CachedScratchpad - Scratchpad with caching and batching
 */
export class CachedScratchpad extends Scratchpad {
  private readonly cache: LRUCache<CachedContent>;
  private readonly batcher: WriteBatcher | null;
  private readonly enableCaching: boolean;
  private readonly enableChangeDetection: boolean;
  private readonly warmPaths: string[];

  constructor(options: CachedScratchpadOptions = {}) {
    super(options);

    this.enableCaching = options.enableCaching ?? true;
    this.enableChangeDetection = options.enableChangeDetection ?? false;
    this.warmPaths = options.warmPaths ?? HOT_PATHS;

    // Initialize cache
    const cacheOptions: { maxSize: number; ttlMs?: number } = {
      maxSize: options.cacheSize ?? DEFAULT_CACHE_SIZE,
    };
    if (options.cacheTTLMs !== undefined) {
      cacheOptions.ttlMs = options.cacheTTLMs;
    }
    this.cache = new LRUCache<CachedContent>(cacheOptions);

    // Initialize batcher
    const enableBatching = options.enableBatching ?? true;
    if (enableBatching) {
      this.batcher = new WriteBatcher({
        flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
        maxBatchSize: options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
        writeHandler: async (key: string, content: string): Promise<void> => {
          await super.atomicWrite(key, content);
        },
      });
    } else {
      this.batcher = null;
    }
  }

  /**
   * Initialize the cached scratchpad
   *
   * Optionally warms the cache with known hot paths.
   */
  async initialize(): Promise<void> {
    await this.warmCache();
  }

  /**
   * Warm the cache with known hot paths
   */
  async warmCache(): Promise<void> {
    if (!this.enableCaching) {
      return;
    }

    const basePath = this.getBasePath();

    for (const hotPath of this.warmPaths) {
      try {
        const fullPath = path.join(basePath, hotPath);
        const exists = await super.exists(fullPath);

        if (exists) {
          // Pre-load into cache
          await this.readWithCache(fullPath);
        }
      } catch {
        // Ignore warm errors - paths may not exist
      }
    }
  }

  /**
   * Read a file with caching support
   *
   * @override
   */
  override async read<T>(filePath: string, options: ReadOptions = {}): Promise<T | null> {
    if (!this.enableCaching) {
      return super.read<T>(filePath, options);
    }

    try {
      const content = await this.readWithCache(filePath);
      if (content === null) {
        if (options.allowMissing === true) {
          return null;
        }
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }
      return content.parsed as T;
    } catch (error) {
      if (options.allowMissing === true && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Read YAML with caching
   *
   * @override
   */
  override async readYaml<T>(filePath: string, options: ReadOptions = {}): Promise<T | null> {
    return this.read<T>(filePath, { ...options, format: 'yaml' });
  }

  /**
   * Read JSON with caching
   *
   * @override
   */
  override async readJson<T>(filePath: string, options: ReadOptions = {}): Promise<T | null> {
    return this.read<T>(filePath, { ...options, format: 'json' });
  }

  /**
   * Read Markdown with caching
   *
   * @override
   */
  override async readMarkdown(filePath: string, options: ReadOptions = {}): Promise<string | null> {
    return this.read<string>(filePath, { ...options, format: 'markdown' });
  }

  /**
   * Write with batching support
   *
   * When batching is enabled, this method updates the cache immediately
   * and queues the disk write. The disk write happens asynchronously
   * on the next flush. Call flush() to ensure all writes are persisted.
   *
   * @override
   */
  override async write(
    filePath: string,
    data: unknown,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    const content = this.serializeData(data, filePath, options.format);

    // Update cache immediately
    if (this.enableCaching) {
      this.updateCache(filePath, content, data);
    }

    // Use batcher or direct write
    if (this.batcher !== null && options.mode === undefined) {
      // Queue write without waiting for flush
      // The write will be persisted on next flush() call or auto-flush
      this.batcher.write(filePath, content).catch(() => {
        // Error will be handled by batcher's onError callback
      });
    } else {
      await super.atomicWrite(filePath, content, options);
    }
  }

  /**
   * Write YAML with batching
   *
   * @override
   */
  override async writeYaml(
    filePath: string,
    data: unknown,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    return this.write(filePath, data, { ...options, format: 'yaml' });
  }

  /**
   * Write JSON with batching
   *
   * @override
   */
  override async writeJson(
    filePath: string,
    data: unknown,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    return this.write(filePath, data, { ...options, format: 'json' });
  }

  /**
   * Write Markdown with batching
   *
   * @override
   */
  override async writeMarkdown(
    filePath: string,
    content: string,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    return this.write(filePath, content, { ...options, format: 'markdown' });
  }

  /**
   * Write immediately without batching (for critical operations)
   *
   * @param filePath - File path
   * @param data - Data to write
   * @param options - Write options
   */
  async writeImmediate(
    filePath: string,
    data: unknown,
    options: AtomicWriteOptions = {}
  ): Promise<void> {
    const content = this.serializeData(data, filePath, options.format);

    // Update cache immediately
    if (this.enableCaching) {
      this.updateCache(filePath, content, data);
    }

    // Bypass batcher
    if (this.batcher !== null) {
      await this.batcher.writeImmediate(filePath, content);
    } else {
      await super.atomicWrite(filePath, content, options);
    }
  }

  /**
   * Delete a file
   *
   * @override
   */
  override async deleteFile(filePath: string): Promise<void> {
    // Invalidate cache
    this.cache.delete(filePath);

    await super.deleteFile(filePath);
  }

  /**
   * Invalidate cache for a specific file
   *
   * @param filePath - File path to invalidate
   */
  invalidateCache(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Invalidate entire cache
   */
  invalidateAllCache(): void {
    this.cache.clear();
  }

  /**
   * Flush pending writes to disk
   */
  async flush(): Promise<void> {
    if (this.batcher !== null) {
      await this.batcher.flush();
    }
  }

  /**
   * Check if a write is pending for a path
   *
   * @param filePath - File path
   * @returns True if write is pending
   */
  isWritePending(filePath: string): boolean {
    return this.batcher?.isPending(filePath) ?? false;
  }

  /**
   * Get combined cache and batcher metrics
   */
  getMetrics(): CachedScratchpadMetrics {
    return {
      cache: this.cache.getMetrics(),
      batcher: this.batcher?.getMetrics() ?? {
        totalWrites: 0,
        totalFlushes: 0,
        coalescedWrites: 0,
        errors: 0,
        pendingWrites: 0,
        avgWritesPerFlush: 0,
        avgFlushDurationMs: 0,
      },
    };
  }

  /**
   * Get cache metrics only
   */
  getCacheMetrics(): CacheMetrics {
    return this.cache.getMetrics();
  }

  /**
   * Get batcher metrics only
   */
  getBatcherMetrics(): WriteBatcherMetrics | null {
    return this.batcher?.getMetrics() ?? null;
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.cache.resetMetrics();
    this.batcher?.resetMetrics();
  }

  /**
   * Cleanup: flush pending writes and clear cache
   *
   * @override
   */
  override async cleanup(): Promise<void> {
    // Flush pending writes first
    if (this.batcher !== null) {
      await this.batcher.close();
    }

    // Clear cache
    this.cache.clear();

    // Call parent cleanup
    await super.cleanup();
  }

  /**
   * Read file with cache support
   */
  private async readWithCache(filePath: string): Promise<CachedContent | null> {
    // Check for pending write first
    if (this.batcher !== null) {
      const pending = this.batcher.getPending(filePath);
      if (pending !== undefined) {
        // Return pending content without updating cache
        const cached = this.cache.get(filePath);
        if (cached !== undefined) {
          return cached;
        }
      }
    }

    // Check cache
    const cached = this.cache.get(filePath);

    if (cached !== undefined) {
      // Optionally check for external changes
      if (this.enableChangeDetection) {
        const isValid = await this.isCacheValid(filePath, cached.mtime);
        if (!isValid) {
          this.cache.delete(filePath);
          return this.loadAndCache(filePath);
        }
      }
      return cached;
    }

    // Load from disk and cache
    return this.loadAndCache(filePath);
  }

  /**
   * Load file from disk and cache it
   */
  private async loadAndCache(filePath: string): Promise<CachedContent | null> {
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const stat = await fs.promises.stat(filePath);
      const format = this.detectFormat(filePath);
      const parsed = this.parseContent(raw, format);

      const entry: CachedContent = {
        raw,
        parsed,
        mtime: stat.mtimeMs,
      };

      this.cache.set(filePath, entry);
      return entry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if cached content is still valid
   */
  private async isCacheValid(filePath: string, cachedMtime: number): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.mtimeMs === cachedMtime;
    } catch {
      return false;
    }
  }

  /**
   * Update cache with new content
   */
  private updateCache(filePath: string, content: string, parsed: unknown): void {
    const entry: CachedContent = {
      raw: content,
      parsed,
      mtime: Date.now(),
    };
    this.cache.set(filePath, entry);
  }

  /**
   * Parse content based on format
   */
  private parseContent(
    content: string,
    format: Exclude<SerializationFormat, 'auto'>
  ): unknown {
    // Use parent's deserialize method via read
    switch (format) {
      case 'yaml':
        return yaml.load(content);
      case 'json':
        return JSON.parse(content);
      case 'markdown':
      case 'raw':
        return content;
    }
  }

  /**
   * Serialize data based on format
   */
  private serializeData(
    data: unknown,
    filePath: string,
    format?: SerializationFormat
  ): string {
    const resolvedFormat = format === undefined || format === 'auto'
      ? this.detectFormat(filePath)
      : format;

    switch (resolvedFormat) {
      case 'yaml':
        return yaml.dump(data, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
        });
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'markdown':
      case 'raw':
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  }
}

/**
 * Singleton instance for global cached access
 */
let globalCachedScratchpad: CachedScratchpad | null = null;

/**
 * Get or create the global CachedScratchpad instance
 *
 * @param options - Options for creating new instance
 * @returns The global CachedScratchpad instance
 */
export function getCachedScratchpad(options?: CachedScratchpadOptions): CachedScratchpad {
  if (globalCachedScratchpad === null) {
    globalCachedScratchpad = new CachedScratchpad(options);
  }
  return globalCachedScratchpad;
}

/**
 * Reset the global CachedScratchpad instance (for testing)
 */
export async function resetCachedScratchpad(): Promise<void> {
  if (globalCachedScratchpad !== null) {
    await globalCachedScratchpad.cleanup();
    globalCachedScratchpad = null;
  }
}
