import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RedisBackend } from '../../../src/scratchpad/backends/RedisBackend.js';
import { RedisConnectionError, RedisLockTimeoutError } from '../../../src/scratchpad/errors.js';

/**
 * Redis Backend Tests
 *
 * These tests require a running Redis server.
 * Tests will be skipped if Redis is not available.
 *
 * To run these tests locally:
 * 1. Start Redis: docker run -d -p 6379:6379 redis:7-alpine
 * 2. Run tests: npm test tests/scratchpad/backends/RedisBackend.test.ts
 */

// Test configuration
const TEST_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  prefix: 'ad-sdlc:test:',
};

// Fallback test directory
const FALLBACK_TEST_DIR = '.ad-sdlc/test-fallback';

// Check if Redis is available
let redisAvailable = false;
let skipReason = '';

async function checkRedisAvailability(): Promise<boolean> {
  const backend = new RedisBackend(TEST_CONFIG);
  try {
    await backend.initialize();
    await backend.close();
    return true;
  } catch (error) {
    skipReason = `Redis not available: ${(error as Error).message}`;
    return false;
  }
}

beforeAll(async () => {
  redisAvailable = await checkRedisAvailability();
  if (!redisAvailable) {
    console.log(`⚠️  Skipping Redis tests: ${skipReason}`);
  }
});

afterAll(async () => {
  // Clean up fallback test directory
  try {
    await fs.promises.rm(FALLBACK_TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('RedisBackend', () => {
  describe('when Redis is not available', () => {
    it('should fail initialization gracefully', async () => {
      const backend = new RedisBackend({
        host: 'nonexistent-host-12345.invalid',
        port: 9999,
        connectTimeout: 1000,
        maxRetries: 0,
      });

      await expect(backend.initialize()).rejects.toThrow(RedisConnectionError);
    });

    it('should throw if not initialized', async () => {
      const backend = new RedisBackend(TEST_CONFIG);
      await expect(backend.read('section', 'key')).rejects.toThrow(
        'RedisBackend not initialized'
      );
    });
  });

  describe('Fallback Mode', () => {
    it('should fallback to FileBackend on connection failure', async () => {
      const backend = new RedisBackend({
        host: 'nonexistent-host-12345.invalid',
        port: 9999,
        connectTimeout: 1000,
        maxRetries: 0,
        fallback: {
          enabled: true,
          fileConfig: {
            basePath: path.join(FALLBACK_TEST_DIR, 'fallback-test'),
          },
        },
      });

      // Should not throw with fallback enabled
      await expect(backend.initialize()).resolves.not.toThrow();
      expect(backend.isUsingFallback()).toBe(true);

      // Should still work with fallback
      await backend.write('section', 'key', { data: 'test' });
      const result = await backend.read<{ data: string }>('section', 'key');
      expect(result?.data).toBe('test');

      // Health check should indicate fallback
      const health = await backend.healthCheck();
      expect(health.message).toContain('fallback');

      await backend.close();
    });

    it('should indicate fallback is not being used when Redis is available', async () => {
      if (!redisAvailable) return;

      const backend = new RedisBackend({
        ...TEST_CONFIG,
        fallback: {
          enabled: true,
          fileConfig: {
            basePath: path.join(FALLBACK_TEST_DIR, 'not-used'),
          },
        },
      });

      await backend.initialize();
      expect(backend.isUsingFallback()).toBe(false);
      await backend.close();
    });
  });

  describe('IScratchpadBackend Interface', () => {
    it.skipIf(!redisAvailable)('should have correct name', () => {
      const backend = new RedisBackend(TEST_CONFIG);
      expect(backend.name).toBe('redis');
    });

    it.skipIf(!redisAvailable)('should initialize successfully', async () => {
      const backend = new RedisBackend(TEST_CONFIG);
      await expect(backend.initialize()).resolves.not.toThrow();
      await backend.close();
    });
  });

  describe('CRUD operations', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend(TEST_CONFIG);
      await backend.initialize();
      // Clean up test keys
      const keys = await backend.list('test-section');
      for (const key of keys) {
        await backend.delete('test-section', key);
      }
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        // Final cleanup
        const keys = await backend.list('test-section');
        for (const key of keys) {
          await backend.delete('test-section', key);
        }
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should write and read a value', async () => {
      const data = { name: 'test', value: 42 };
      await backend.write('test-section', 'key1', data);
      const result = await backend.read<typeof data>('test-section', 'key1');
      expect(result).toEqual(data);
    });

    it.skipIf(!redisAvailable)('should return null for non-existent key', async () => {
      const result = await backend.read('test-section', 'nonexistent-key-xyz');
      expect(result).toBeNull();
    });

    it.skipIf(!redisAvailable)('should overwrite existing value', async () => {
      await backend.write('test-section', 'key2', { value: 1 });
      await backend.write('test-section', 'key2', { value: 2 });
      const result = await backend.read<{ value: number }>('test-section', 'key2');
      expect(result?.value).toBe(2);
    });

    it.skipIf(!redisAvailable)('should handle complex nested objects', async () => {
      const data = {
        nested: {
          array: [1, 2, 3],
          object: { a: 'b' },
        },
        boolean: true,
        null: null,
      };
      await backend.write('test-section', 'complex', data);
      const result = await backend.read<typeof data>('test-section', 'complex');
      expect(result).toEqual(data);
    });

    it.skipIf(!redisAvailable)('should handle unicode strings', async () => {
      const data = { text: '한국어 테스트 🎉' };
      await backend.write('test-section', 'unicode', data);
      const result = await backend.read<typeof data>('test-section', 'unicode');
      expect(result?.text).toBe('한국어 테스트 🎉');
    });
  });

  describe('delete', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend(TEST_CONFIG);
      await backend.initialize();
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should delete existing value', async () => {
      await backend.write('test-section', 'to-delete', { data: 'test' });
      const deleted = await backend.delete('test-section', 'to-delete');
      expect(deleted).toBe(true);
      const result = await backend.read('test-section', 'to-delete');
      expect(result).toBeNull();
    });

    it.skipIf(!redisAvailable)('should return false for non-existent key', async () => {
      const deleted = await backend.delete('test-section', 'nonexistent-delete-key');
      expect(deleted).toBe(false);
    });
  });

  describe('list', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend(TEST_CONFIG);
      await backend.initialize();
      // Clean up
      const keys = await backend.list('list-section');
      for (const key of keys) {
        await backend.delete('list-section', key);
      }
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        const keys = await backend.list('list-section');
        for (const key of keys) {
          await backend.delete('list-section', key);
        }
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should list all keys in a section', async () => {
      await backend.write('list-section', 'key1', { data: 1 });
      await backend.write('list-section', 'key2', { data: 2 });
      await backend.write('list-section', 'key3', { data: 3 });

      const keys = await backend.list('list-section');
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it.skipIf(!redisAvailable)('should return empty array for non-existent section', async () => {
      const keys = await backend.list('nonexistent-section-xyz');
      expect(keys).toEqual([]);
    });
  });

  describe('exists', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend(TEST_CONFIG);
      await backend.initialize();
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        await backend.delete('exists-section', 'exists-key');
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should return true for existing key', async () => {
      await backend.write('exists-section', 'exists-key', { data: 'test' });
      const exists = await backend.exists('exists-section', 'exists-key');
      expect(exists).toBe(true);
    });

    it.skipIf(!redisAvailable)('should return false for non-existent key', async () => {
      const exists = await backend.exists('exists-section', 'nonexistent-exists-key');
      expect(exists).toBe(false);
    });
  });

  describe('batch', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend(TEST_CONFIG);
      await backend.initialize();
      // Clean up
      const keys = await backend.list('batch-section');
      for (const key of keys) {
        await backend.delete('batch-section', key);
      }
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        const keys = await backend.list('batch-section');
        for (const key of keys) {
          await backend.delete('batch-section', key);
        }
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should execute multiple writes', async () => {
      await backend.batch([
        { type: 'write', section: 'batch-section', key: 'key1', value: { a: 1 } },
        { type: 'write', section: 'batch-section', key: 'key2', value: { b: 2 } },
      ]);

      const result1 = await backend.read<{ a: number }>('batch-section', 'key1');
      const result2 = await backend.read<{ b: number }>('batch-section', 'key2');
      expect(result1?.a).toBe(1);
      expect(result2?.b).toBe(2);
    });

    it.skipIf(!redisAvailable)('should execute mixed operations', async () => {
      await backend.write('batch-section', 'to-delete', { data: 'delete me' });

      await backend.batch([
        { type: 'write', section: 'batch-section', key: 'new-key', value: { data: 'new' } },
        { type: 'delete', section: 'batch-section', key: 'to-delete' },
      ]);

      const newResult = await backend.read('batch-section', 'new-key');
      const deletedResult = await backend.read('batch-section', 'to-delete');
      expect(newResult).toEqual({ data: 'new' });
      expect(deletedResult).toBeNull();
    });
  });

  describe('healthCheck', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend(TEST_CONFIG);
      await backend.initialize();
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should return healthy status', async () => {
      const health = await backend.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeDefined();
      expect(health.message).toBe('Redis backend is healthy');
    });
  });

  describe('TTL support', () => {
    it.skipIf(!redisAvailable)('should set TTL on writes', async () => {
      const ttlBackend = new RedisBackend({
        ...TEST_CONFIG,
        ttl: 1, // 1 second TTL
      });
      await ttlBackend.initialize();

      await ttlBackend.write('ttl-section', 'ttl-key', { data: 'expires' });

      // Immediately should exist
      const exists = await ttlBackend.exists('ttl-section', 'ttl-key');
      expect(exists).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should be expired
      const result = await ttlBackend.read('ttl-section', 'ttl-key');
      expect(result).toBeNull();

      await ttlBackend.close();
    });
  });

  describe('custom prefix', () => {
    it.skipIf(!redisAvailable)('should use custom prefix', async () => {
      const customBackend = new RedisBackend({
        ...TEST_CONFIG,
        prefix: 'custom:prefix:',
      });
      await customBackend.initialize();

      await customBackend.write('section', 'key', { data: 'custom' });
      const result = await customBackend.read<{ data: string }>('section', 'key');
      expect(result?.data).toBe('custom');

      // Cleanup
      await customBackend.delete('section', 'key');
      await customBackend.close();
    });
  });

  describe('Distributed Locking', () => {
    let backend: RedisBackend;

    beforeEach(async () => {
      if (!redisAvailable) return;
      backend = new RedisBackend({
        ...TEST_CONFIG,
        lock: {
          lockTtl: 5,
          lockTimeout: 2000,
          lockRetryInterval: 50,
        },
      });
      await backend.initialize();
    });

    afterAll(async () => {
      if (!redisAvailable) return;
      if (backend) {
        await backend.close();
      }
    });

    it.skipIf(!redisAvailable)('should acquire and release a lock', async () => {
      const lock = await backend.acquireLock('test-lock-1');

      expect(lock.key).toContain('lock:test-lock-1');
      expect(lock.value).toBeDefined();
      expect(lock.ttl).toBe(5);

      const released = await backend.releaseLock(lock);
      expect(released).toBe(true);
    });

    it.skipIf(!redisAvailable)('should prevent double lock acquisition', async () => {
      const lock1 = await backend.acquireLock('test-lock-2', { timeout: 100 });

      // Should timeout trying to acquire the same lock
      await expect(
        backend.acquireLock('test-lock-2', { timeout: 100 })
      ).rejects.toThrow(RedisLockTimeoutError);

      await backend.releaseLock(lock1);
    });

    it.skipIf(!redisAvailable)('should allow lock after release', async () => {
      const lock1 = await backend.acquireLock('test-lock-3');
      await backend.releaseLock(lock1);

      // Should be able to acquire after release
      const lock2 = await backend.acquireLock('test-lock-3');
      expect(lock2.key).toBe(lock1.key);

      await backend.releaseLock(lock2);
    });

    it.skipIf(!redisAvailable)('should not release lock with wrong value', async () => {
      const lock = await backend.acquireLock('test-lock-4');

      // Try to release with fake handle
      const fakeHandle = {
        key: lock.key,
        value: 'fake-value',
        ttl: lock.ttl,
        acquiredAt: lock.acquiredAt,
      };

      const released = await backend.releaseLock(fakeHandle);
      expect(released).toBe(false);

      // Real release should work
      const realReleased = await backend.releaseLock(lock);
      expect(realReleased).toBe(true);
    });

    it.skipIf(!redisAvailable)('should extend lock TTL', async () => {
      const lock = await backend.acquireLock('test-lock-5', { ttl: 2 });

      // Extend lock
      const extended = await backend.extendLock(lock, 10);
      expect(extended).toBe(true);

      await backend.releaseLock(lock);
    });

    it.skipIf(!redisAvailable)('should execute function with lock', async () => {
      let executed = false;

      const result = await backend.withLock('test-lock-6', async () => {
        executed = true;
        return 'success';
      });

      expect(executed).toBe(true);
      expect(result).toBe('success');

      // Lock should be released, can acquire again
      const lock = await backend.acquireLock('test-lock-6', { timeout: 100 });
      await backend.releaseLock(lock);
    });

    it.skipIf(!redisAvailable)('should release lock even on error', async () => {
      await expect(
        backend.withLock('test-lock-7', async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');

      // Lock should be released, can acquire again
      const lock = await backend.acquireLock('test-lock-7', { timeout: 100 });
      await backend.releaseLock(lock);
    });

    it('should throw error when using locking with fallback', async () => {
      const fallbackBackend = new RedisBackend({
        host: 'nonexistent-host-12345.invalid',
        port: 9999,
        connectTimeout: 1000,
        maxRetries: 0,
        fallback: {
          enabled: true,
          fileConfig: {
            basePath: path.join(FALLBACK_TEST_DIR, 'lock-fallback'),
          },
        },
      });

      await fallbackBackend.initialize();
      expect(fallbackBackend.isUsingFallback()).toBe(true);

      await expect(
        fallbackBackend.acquireLock('test-lock')
      ).rejects.toThrow('Distributed locking not available when using fallback backend');

      await fallbackBackend.close();
    });
  });

  describe('Error Classes', () => {
    it('should have correct properties for RedisConnectionError', () => {
      const error = new RedisConnectionError('localhost', 6379, new Error('test'));
      expect(error.name).toBe('RedisConnectionError');
      expect(error.host).toBe('localhost');
      expect(error.port).toBe(6379);
      expect(error.message).toContain('localhost:6379');
    });

    it('should have correct properties for RedisLockTimeoutError', () => {
      const error = new RedisLockTimeoutError('my-lock', 5000);
      expect(error.name).toBe('RedisLockTimeoutError');
      expect(error.lockKey).toBe('my-lock');
      expect(error.timeoutMs).toBe(5000);
      expect(error.message).toContain('5000ms');
    });
  });
});
