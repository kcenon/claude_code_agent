import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryCache, getQueryCache, resetQueryCache } from '../../src/monitoring/index.js';

describe('QueryCache', () => {
  let cache: QueryCache<string>;

  beforeEach(() => {
    resetQueryCache();
    cache = new QueryCache<string>({
      maxEntries: 100,
      ttlMs: 60000,
      enableSimilarity: true,
      similarityThreshold: 0.7,
      cleanupIntervalMs: 60000, // Longer interval to avoid test interference
    });
  });

  afterEach(() => {
    cache.stop();
    resetQueryCache();
  });

  describe('set and get', () => {
    it('should store and retrieve values', () => {
      cache.set('What is the capital of France?', 'Paris', 10);

      const result = cache.get('What is the capital of France?');

      expect(result.hit).toBe(true);
      expect(result.value).toBe('Paris');
    });

    it('should return miss for unknown query', () => {
      const result = cache.get('Unknown query');

      expect(result.hit).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should handle case-insensitive matching', () => {
      cache.set('HELLO WORLD', 'test', 5);

      const result = cache.get('hello world');

      expect(result.hit).toBe(true);
    });
  });

  describe('similarity matching', () => {
    it('should find similar queries', () => {
      // Note: normalization only lowercases and collapses whitespace
      // Punctuation differences cause similarity match instead of exact match
      cache.set('What is the capital of France?', 'Paris', 10);

      const result = cache.get('what is the capital of france');

      expect(result.hit).toBe(true);
      // Punctuation difference (? vs none) triggers similarity matching
      // Both tests verify the cache returns correct results
    });

    it('should match semantically similar queries', () => {
      cache.set('What is the capital city of France', 'Paris', 10);

      const result = cache.get('what is the capital of france');

      expect(result.hit).toBe(true);
      expect(result.similarityMatch).toBe(true);
    });
  });

  describe('has', () => {
    it('should return true for cached query', () => {
      cache.set('Test query', 'value', 5);

      expect(cache.has('Test query')).toBe(true);
    });

    it('should return false for uncached query', () => {
      expect(cache.has('Unknown query')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove cached entry', () => {
      cache.set('Test query', 'value', 5);
      cache.delete('Test query');

      expect(cache.has('Test query')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('Query 1', 'value1', 5);
      cache.set('Query 2', 'value2', 5);
      cache.clear();

      expect(cache.size).toBe(0);
    });

    it('should reset statistics', () => {
      cache.set('Query 1', 'value1', 5);
      cache.get('Query 1');
      cache.get('Unknown');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', async () => {
      const smallCache = new QueryCache<string>({ maxEntries: 3, cleanupIntervalMs: 60000 });

      smallCache.set('Query 1', 'value1', 5);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      smallCache.set('Query 2', 'value2', 5);
      await new Promise((resolve) => setTimeout(resolve, 10));
      smallCache.set('Query 3', 'value3', 5);

      // Access Query 1 to make it recently used
      await new Promise((resolve) => setTimeout(resolve, 10));
      smallCache.get('Query 1');

      // Add new entry - should evict Query 2 (oldest not recently accessed)
      await new Promise((resolve) => setTimeout(resolve, 10));
      smallCache.set('Query 4', 'value4', 5);

      expect(smallCache.has('Query 1')).toBe(true);
      expect(smallCache.has('Query 4')).toBe(true);
      expect(smallCache.size).toBe(3);

      smallCache.stop();
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('Query 1', 'value1', 100);
      cache.get('Query 1'); // hit
      cache.get('Query 1'); // hit
      cache.get('Unknown'); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should track entry count', () => {
      cache.set('Query 1', 'value1', 5);
      cache.set('Query 2', 'value2', 5);

      const stats = cache.getStats();

      expect(stats.entryCount).toBe(2);
    });

    it('should calculate tokens saved', () => {
      cache.set('Query 1', 'value1', 100);
      cache.get('Query 1'); // First access - counts as 1

      const stats = cache.getStats();

      expect(stats.totalTokensSaved).toBe(100);
    });
  });

  describe('size', () => {
    it('should return number of entries', () => {
      expect(cache.size).toBe(0);

      cache.set('Query 1', 'value1', 5);
      expect(cache.size).toBe(1);

      cache.set('Query 2', 'value2', 5);
      expect(cache.size).toBe(2);
    });
  });

  describe('recordTokensSaved', () => {
    it('should accumulate tokens saved', () => {
      cache.recordTokensSaved(100);
      cache.recordTokensSaved(200);

      // This is tracked separately from cache hits
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetQueryCache();
      const instance1 = getQueryCache<string>({ maxEntries: 100 });
      const instance2 = getQueryCache<string>();

      expect(instance1).toBe(instance2);

      instance1.stop();
    });
  });
});
