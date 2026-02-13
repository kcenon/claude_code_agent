/**
 * QueryCache - Caches repeated queries to reduce token usage
 *
 * Features:
 * - Content-based caching with configurable TTL
 * - Similarity matching for near-duplicate queries
 * - Cache statistics for optimization insights
 * - Memory-efficient LRU eviction
 */

import * as crypto from 'node:crypto';

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  /** Cached value */
  readonly value: T;
  /** Entry creation timestamp */
  readonly createdAt: Date;
  /** Last access timestamp */
  readonly lastAccessedAt: Date;
  /** Number of times accessed */
  readonly accessCount: number;
  /** Estimated tokens saved */
  readonly tokensSaved: number;
  /** Original query hash */
  readonly queryHash: string;
}

/**
 * Cache configuration
 */
export interface QueryCacheConfig {
  /** Maximum number of entries */
  readonly maxEntries?: number;
  /** TTL in milliseconds */
  readonly ttlMs?: number;
  /** Enable similarity matching */
  readonly enableSimilarity?: boolean;
  /** Similarity threshold (0-1, higher = more similar required) */
  readonly similarityThreshold?: number;
  /** Cleanup interval in milliseconds */
  readonly cleanupIntervalMs?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total cache hits */
  readonly hits: number;
  /** Total cache misses */
  readonly misses: number;
  /** Hit rate (0-1) */
  readonly hitRate: number;
  /** Current entry count */
  readonly entryCount: number;
  /** Total tokens saved */
  readonly totalTokensSaved: number;
  /** Estimated cost savings in USD */
  readonly estimatedSavingsUsd: number;
  /** Average entry age in milliseconds */
  readonly avgEntryAgeMs: number;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult<T> {
  /** Whether cache hit occurred */
  readonly hit: boolean;
  /** Cached value if hit */
  readonly value?: T;
  /** Whether this was a similarity match */
  readonly similarityMatch?: boolean;
  /** Similarity score if applicable */
  readonly similarityScore?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Token pricing for savings calculation (per 1000 tokens)
 */
const DEFAULT_TOKEN_PRICE = 0.003; // Sonnet input price

/**
 * QueryCache class for caching query results
 */
export class QueryCache<T = unknown> {
  private readonly config: Required<QueryCacheConfig>;
  private readonly cache: Map<string, CacheEntry<T>> = new Map();
  private readonly queryHashes: Map<string, string> = new Map(); // normalized query -> hash
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private hits = 0;
  private misses = 0;
  private totalTokensSaved = 0;

  constructor(config: QueryCacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? DEFAULT_MAX_ENTRIES,
      ttlMs: config.ttlMs ?? DEFAULT_TTL_MS,
      enableSimilarity: config.enableSimilarity ?? true,
      similarityThreshold: config.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD,
      cleanupIntervalMs: config.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS,
    };

    this.startCleanupTimer();
  }

  /**
   * Get cached value for a query
   * @param query
   */
  public get(query: string): CacheLookupResult<T> {
    const hash = this.hashQuery(query);
    const entry = this.cache.get(hash);

    // Direct hit
    if (entry !== undefined && !this.isExpired(entry)) {
      this.updateAccessTime(hash, entry);
      this.hits++;
      return {
        hit: true,
        value: entry.value,
        similarityMatch: false,
      };
    }

    // Try similarity match if enabled
    if (this.config.enableSimilarity) {
      const similarResult = this.findSimilar(query);
      if (similarResult !== null) {
        this.hits++;
        return {
          hit: true,
          value: similarResult.entry.value,
          similarityMatch: true,
          similarityScore: similarResult.score,
        };
      }
    }

    this.misses++;
    return { hit: false };
  }

  /**
   * Set cached value for a query
   * @param query
   * @param value
   * @param estimatedTokens
   */
  public set(query: string, value: T, estimatedTokens: number): void {
    const hash = this.hashQuery(query);
    const normalizedQuery = this.normalizeQuery(query);

    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
      tokensSaved: estimatedTokens,
      queryHash: hash,
    };

    this.cache.set(hash, entry);
    this.queryHashes.set(normalizedQuery, hash);
  }

  /**
   * Check if query is cached
   * @param query
   */
  public has(query: string): boolean {
    const hash = this.hashQuery(query);
    const entry = this.cache.get(hash);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Delete cached entry
   * @param query
   */
  public delete(query: string): boolean {
    const hash = this.hashQuery(query);
    const normalizedQuery = this.normalizeQuery(query);
    this.queryHashes.delete(normalizedQuery);
    return this.cache.delete(hash);
  }

  /**
   * Clear all cached entries
   */
  public clear(): void {
    this.cache.clear();
    this.queryHashes.clear();
    this.hits = 0;
    this.misses = 0;
    this.totalTokensSaved = 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    const totalAge = entries.reduce((sum, e) => sum + (now - e.createdAt.getTime()), 0);
    const avgAgeMs = entries.length > 0 ? totalAge / entries.length : 0;

    const tokensSaved = entries.reduce((sum, e) => sum + e.tokensSaved * e.accessCount, 0);

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      entryCount: this.cache.size,
      totalTokensSaved: tokensSaved,
      estimatedSavingsUsd: (tokensSaved / 1000) * DEFAULT_TOKEN_PRICE,
      avgEntryAgeMs: avgAgeMs,
    };
  }

  /**
   * Get entry count
   */
  public get size(): number {
    return this.cache.size;
  }

  /**
   * Stop cleanup timer
   */
  public stop(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Record tokens saved from cache hit
   * @param tokens
   */
  public recordTokensSaved(tokens: number): void {
    this.totalTokensSaved += tokens;
  }

  /**
   * Hash a query string
   * @param query
   */
  private hashQuery(query: string): string {
    const normalized = this.normalizeQuery(query);
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Normalize a query for comparison
   * @param query
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if an entry is expired
   * @param entry
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    const age = Date.now() - entry.createdAt.getTime();
    return age > this.config.ttlMs;
  }

  /**
   * Update access time for an entry
   * @param hash
   * @param entry
   */
  private updateAccessTime(hash: string, entry: CacheEntry<T>): void {
    const updated: CacheEntry<T> = {
      ...entry,
      lastAccessedAt: new Date(),
      accessCount: entry.accessCount + 1,
    };
    this.cache.set(hash, updated);
  }

  /**
   * Find similar cached query
   * @param query
   */
  private findSimilar(query: string): { entry: CacheEntry<T>; score: number } | null {
    const normalizedQuery = this.normalizeQuery(query);
    let bestMatch: { entry: CacheEntry<T>; score: number } | null = null;

    for (const [cachedQuery, hash] of this.queryHashes) {
      const similarity = this.calculateSimilarity(normalizedQuery, cachedQuery);

      if (similarity >= this.config.similarityThreshold) {
        const entry = this.cache.get(hash);
        if (entry !== undefined && !this.isExpired(entry)) {
          if (bestMatch === null || similarity > bestMatch.score) {
            bestMatch = { entry, score: similarity };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate Jaccard similarity between two strings
   * @param a
   * @param b
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestHash: string | null = null;
    let oldestTime = Infinity;

    for (const [hash, entry] of this.cache) {
      const accessTime = entry.lastAccessedAt.getTime();
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestHash = hash;
      }
    }

    if (oldestHash !== null) {
      this.cache.delete(oldestHash);
      // Also clean up query hash mapping
      for (const [query, hash] of this.queryHashes) {
        if (hash === oldestHash) {
          this.queryHashes.delete(query);
          break;
        }
      }
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer !== null) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const expiredHashes: string[] = [];

    for (const [hash, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredHashes.push(hash);
      }
    }

    for (const hash of expiredHashes) {
      this.cache.delete(hash);
      // Clean up query hash mapping
      for (const [query, h] of this.queryHashes) {
        if (h === hash) {
          this.queryHashes.delete(query);
          break;
        }
      }
    }
  }
}

/**
 * Singleton instance for global access
 */
let globalQueryCache: QueryCache | null = null;

/**
 * Get or create the global QueryCache instance
 * @param config
 */
export function getQueryCache<T = unknown>(config?: QueryCacheConfig): QueryCache<T> {
  if (globalQueryCache === null) {
    globalQueryCache = new QueryCache<T>(config);
  }
  return globalQueryCache as QueryCache<T>;
}

/**
 * Reset the global QueryCache instance
 */
export function resetQueryCache(): void {
  if (globalQueryCache !== null) {
    globalQueryCache.stop();
    globalQueryCache = null;
  }
}
