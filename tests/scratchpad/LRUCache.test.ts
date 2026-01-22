/**
 * LRUCache unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache } from '../../src/scratchpad/LRUCache.js';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({ maxSize: 3 });
  });

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const defaultCache = new LRUCache<string>();
      expect(defaultCache.size).toBe(0);
    });

    it('should throw error for invalid maxSize', () => {
      expect(() => new LRUCache<string>({ maxSize: 0 })).toThrow('maxSize must be at least 1');
      expect(() => new LRUCache<string>({ maxSize: -1 })).toThrow('maxSize must be at least 1');
    });
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
      expect(cache.size).toBe(1);
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should check key existence with has()', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when at capacity', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on get()', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1, making it most recently used
      cache.get('key1');

      // Add new entry, should evict key2 (oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on set() for existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update key1, making it most recently used
      cache.set('key1', 'updated1');

      // Add new entry, should evict key2 (oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('updated1');
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      vi.useFakeTimers();
      const ttlCache = new LRUCache<string>({ maxSize: 3, ttlMs: 100 });

      ttlCache.set('key1', 'value1');
      expect(ttlCache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(150);

      expect(ttlCache.get('key1')).toBeUndefined();
      vi.useRealTimers();
    });

    it('should not expire entries before TTL', async () => {
      vi.useFakeTimers();
      const ttlCache = new LRUCache<string>({ maxSize: 3, ttlMs: 100 });

      ttlCache.set('key1', 'value1');

      // Advance time but not past TTL
      vi.advanceTimersByTime(50);

      expect(ttlCache.get('key1')).toBe('value1');
      vi.useRealTimers();
    });

    it('should handle has() for expired entries', async () => {
      vi.useFakeTimers();
      const ttlCache = new LRUCache<string>({ maxSize: 3, ttlMs: 100 });

      ttlCache.set('key1', 'value1');
      expect(ttlCache.has('key1')).toBe(true);

      vi.advanceTimersByTime(150);

      expect(ttlCache.has('key1')).toBe(false);
      vi.useRealTimers();
    });

    it('should purge expired entries', () => {
      vi.useFakeTimers();
      const ttlCache = new LRUCache<string>({ maxSize: 10, ttlMs: 100 });

      ttlCache.set('key1', 'value1');
      ttlCache.set('key2', 'value2');
      ttlCache.set('key3', 'value3');

      vi.advanceTimersByTime(150);

      const purged = ttlCache.purgeExpired();
      expect(purged).toBe(3);
      expect(ttlCache.size).toBe(0);
      vi.useRealTimers();
    });
  });

  describe('metrics', () => {
    it('should track cache hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(0);
    });

    it('should track cache misses', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(2);
    });

    it('should track evictions', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Evicts key1
      cache.set('key5', 'value5'); // Evicts key2

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(2);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      const metrics = cache.getMetrics();
      expect(metrics.hitRate).toBeCloseTo(2 / 3);
    });

    it('should reset metrics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      cache.resetMetrics();

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.evictions).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should call onEvict when entry is evicted', () => {
      const onEvict = vi.fn();
      const callbackCache = new LRUCache<string>({ maxSize: 2, onEvict });

      callbackCache.set('key1', 'value1');
      callbackCache.set('key2', 'value2');
      callbackCache.set('key3', 'value3'); // Evicts key1

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should call onEvict when entry is deleted', () => {
      const onEvict = vi.fn();
      const callbackCache = new LRUCache<string>({ maxSize: 3, onEvict });

      callbackCache.set('key1', 'value1');
      callbackCache.delete('key1');

      expect(onEvict).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should call onEvict for all entries on clear()', () => {
      const onEvict = vi.fn();
      const callbackCache = new LRUCache<string>({ maxSize: 3, onEvict });

      callbackCache.set('key1', 'value1');
      callbackCache.set('key2', 'value2');
      callbackCache.clear();

      expect(onEvict).toHaveBeenCalledTimes(2);
    });
  });

  describe('peek', () => {
    it('should return value without updating LRU order', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Peek at key1 (should not update LRU order)
      expect(cache.peek('key1')).toBe('value1');

      // Add new entry, should evict key1 (still oldest)
      cache.set('key4', 'value4');

      expect(cache.peek('key1')).toBeUndefined();
    });

    it('should return undefined for expired entries', () => {
      vi.useFakeTimers();
      const ttlCache = new LRUCache<string>({ maxSize: 3, ttlMs: 100 });

      ttlCache.set('key1', 'value1');
      vi.advanceTimersByTime(150);

      expect(ttlCache.peek('key1')).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('iterators', () => {
    it('should return keys in LRU order', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = Array.from(cache.keys());
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return values in LRU order', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const values = cache.values();
      expect(values).toEqual(['value1', 'value2', 'value3']);
    });
  });
});
