/**
 * LRUCache - Least Recently Used cache implementation
 *
 * A generic cache with configurable size limit that automatically evicts
 * the least recently used entries when capacity is reached.
 *
 * Features:
 * - O(1) get, set, and delete operations
 * - Configurable maximum size (default: 1000 entries)
 * - Cache hit/miss metrics collection
 * - TTL (time-to-live) support for automatic entry expiration
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string>({ maxSize: 100, ttlMs: 60000 });
 *
 * cache.set('key1', 'value1');
 * const value = cache.get('key1'); // Returns 'value1'
 *
 * console.log(cache.getMetrics()); // { hits: 1, misses: 0, evictions: 0, size: 1 }
 * ```
 */

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Timestamp when entry was created/updated */
  createdAt: number;
  /** Expiration timestamp (if TTL is enabled) */
  expiresAt?: number;
}

/**
 * LRU Cache configuration options
 */
export interface LRUCacheOptions {
  /**
   * Maximum number of entries in cache (default: 1000)
   */
  maxSize?: number;
  /**
   * Time-to-live in milliseconds for cache entries.
   * Entries older than TTL are considered expired.
   * If not set, entries never expire based on time.
   */
  ttlMs?: number;
  /**
   * Callback invoked when an entry is evicted
   */
  onEvict?: (key: string, value: unknown) => void;
}

/**
 * Cache metrics for monitoring performance
 */
export interface CacheMetrics {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of evictions due to size limit */
  evictions: number;
  /** Number of expirations due to TTL */
  expirations: number;
  /** Current number of entries in cache */
  size: number;
  /** Hit rate (hits / (hits + misses)) */
  hitRate: number;
}

/**
 * Default maximum cache size
 */
const DEFAULT_MAX_SIZE = 1000;

/**
 * LRUCache - Least Recently Used cache implementation
 *
 * Uses a Map for O(1) operations while maintaining insertion order
 * for LRU eviction. When an entry is accessed, it's moved to the end
 * of the Map (most recently used position).
 *
 * @template T - Type of cached values
 */
export class LRUCache<T> {
  private readonly cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number | undefined;
  private readonly onEvict: ((key: string, value: unknown) => void) | undefined;

  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.ttlMs = options.ttlMs ?? undefined;
    this.onEvict = options.onEvict ?? undefined;

    if (this.maxSize < 1) {
      throw new Error('maxSize must be at least 1');
    }
  }

  /**
   * Get a value from the cache
   *
   * If the key exists and hasn't expired, returns the value and
   * marks it as recently used. Otherwise returns undefined.
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      this.misses++;
      return undefined;
    }

    // Check TTL expiration
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.expirations++;
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   *
   * If the key already exists, updates the value and marks as recently used.
   * If cache is at capacity, evicts the least recently used entry first.
   *
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    const now = Date.now();

    // Remove existing entry first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict least recently used if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value as string;
      const oldestEntry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.evictions++;

      if (this.onEvict !== undefined && oldestEntry !== undefined) {
        this.onEvict(oldestKey, oldestEntry.value);
      }
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
    };

    if (this.ttlMs !== undefined) {
      entry.expiresAt = now + this.ttlMs;
    }

    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists in the cache (without updating LRU order)
   *
   * Note: This method does NOT update the LRU order. Use get() if
   * you want the entry to be marked as recently used.
   *
   * @param key - Cache key
   * @returns True if key exists and hasn't expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      return false;
    }

    // Check TTL expiration
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete an entry from the cache
   *
   * @param key - Cache key
   * @returns True if entry was deleted, false if not found
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    const deleted = this.cache.delete(key);

    if (deleted && this.onEvict !== undefined && entry !== undefined) {
      this.onEvict(key, entry.value);
    }

    return deleted;
  }

  /**
   * Clear all entries from the cache
   *
   * This also triggers the onEvict callback for each entry.
   */
  clear(): void {
    if (this.onEvict !== undefined) {
      for (const [key, entry] of this.cache) {
        this.onEvict(key, entry.value);
      }
    }
    this.cache.clear();
  }

  /**
   * Get the current number of entries in the cache
   *
   * @returns Number of entries currently stored
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache (in LRU order, oldest first)
   *
   * @returns Iterator of cache keys ordered from least to most recently used
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }

  /**
   * Get all values in the cache (in LRU order, oldest first)
   *
   * @returns Array of cached values ordered from least to most recently used
   */
  values(): T[] {
    const result: T[] = [];
    for (const entry of this.cache.values()) {
      result.push(entry.value);
    }
    return result;
  }

  /**
   * Get cache performance metrics
   *
   * @returns Current cache metrics
   */
  getMetrics(): CacheMetrics {
    const totalAccesses = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      expirations: this.expirations,
      size: this.cache.size,
      hitRate: totalAccesses > 0 ? this.hits / totalAccesses : 0,
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  /**
   * Remove expired entries from the cache
   *
   * This is automatically done during get() and has() operations,
   * but can be called explicitly for cleanup.
   *
   * @returns Number of expired entries removed
   */
  purgeExpired(): number {
    if (this.ttlMs === undefined) {
      return 0;
    }

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== undefined && now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
      this.expirations++;
    }

    return keysToDelete.length;
  }

  /**
   * Peek at a value without updating LRU order
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  peek(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry === undefined) {
      return undefined;
    }

    // Check TTL expiration
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      return undefined;
    }

    return entry.value;
  }
}
