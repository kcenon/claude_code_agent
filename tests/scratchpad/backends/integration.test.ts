import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { IScratchpadBackend } from '../../../src/scratchpad/backends/IScratchpadBackend.js';
import { BackendFactory } from '../../../src/scratchpad/backends/BackendFactory.js';
import { FileBackend } from '../../../src/scratchpad/backends/FileBackend.js';
import { SQLiteBackend } from '../../../src/scratchpad/backends/SQLiteBackend.js';
import { RedisBackend } from '../../../src/scratchpad/backends/RedisBackend.js';

/**
 * Integration Tests for Scratchpad Backends
 *
 * These tests verify:
 * 1. All backends conform to IScratchpadBackend interface
 * 2. Data migration between backends works correctly
 * 3. BackendFactory creates backends with correct configuration
 */

// Test base path
const TEST_BASE_PATH = path.join(os.tmpdir(), `backend-integration-${Date.now()}`);

// Check Redis availability
let redisAvailable = false;

async function checkRedisAvailability(): Promise<boolean> {
  try {
    const backend = new RedisBackend({
      host: 'localhost',
      port: 6379,
      prefix: 'ad-sdlc:integration-test:',
    });
    await backend.initialize();
    await backend.close();
    return true;
  } catch {
    return false;
  }
}

// Get all available backends for testing
async function getAvailableBackends(): Promise<
  Array<{ name: string; backend: IScratchpadBackend; cleanup: () => Promise<void> }>
> {
  const backends: Array<{
    name: string;
    backend: IScratchpadBackend;
    cleanup: () => Promise<void>;
  }> = [];

  // File backend (always available)
  const filePath = path.join(TEST_BASE_PATH, 'file');
  const fileBackend = new FileBackend({ basePath: filePath });
  backends.push({
    name: 'file',
    backend: fileBackend,
    cleanup: async () => {
      await fileBackend.close();
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    },
  });

  // SQLite backend (always available)
  const sqlitePath = path.join(TEST_BASE_PATH, 'test.db');
  const sqliteBackend = new SQLiteBackend({ dbPath: sqlitePath });
  backends.push({
    name: 'sqlite',
    backend: sqliteBackend,
    cleanup: async () => {
      await sqliteBackend.close();
      try {
        fs.rmSync(sqlitePath, { force: true });
        fs.rmSync(sqlitePath + '-wal', { force: true });
        fs.rmSync(sqlitePath + '-shm', { force: true });
      } catch {
        // Ignore
      }
    },
  });

  // Redis backend (if available)
  if (redisAvailable) {
    const redisBackend = new RedisBackend({
      host: 'localhost',
      port: 6379,
      prefix: 'ad-sdlc:integration-test:',
    });
    backends.push({
      name: 'redis',
      backend: redisBackend,
      cleanup: async () => {
        // Clean up test keys
        try {
          const keys = await redisBackend.list('integration');
          for (const key of keys) {
            await redisBackend.delete('integration', key);
          }
        } catch {
          // Ignore
        }
        await redisBackend.close();
      },
    });
  }

  return backends;
}

beforeEach(async () => {
  redisAvailable = await checkRedisAvailability();
  fs.mkdirSync(TEST_BASE_PATH, { recursive: true });
});

afterAll(() => {
  try {
    fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
  } catch {
    // Ignore
  }
});

describe('Backend Integration Tests', () => {
  describe('IScratchpadBackend Interface Compliance', () => {
    it('all backends should have required methods', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        // Check all interface methods exist
        expect(typeof backend.name).toBe('string');
        expect(typeof backend.initialize).toBe('function');
        expect(typeof backend.read).toBe('function');
        expect(typeof backend.write).toBe('function');
        expect(typeof backend.delete).toBe('function');
        expect(typeof backend.list).toBe('function');
        expect(typeof backend.exists).toBe('function');
        expect(typeof backend.batch).toBe('function');
        expect(typeof backend.healthCheck).toBe('function');
        expect(typeof backend.close).toBe('function');

        // Verify name matches expected
        expect(backend.name).toBe(name);

        await cleanup();
      }
    });

    it('all backends should handle the same data consistently', async () => {
      const backends = await getAvailableBackends();
      const testData = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { a: { b: { c: 'deep' } } },
        null: null,
        unicode: '한국어 🎉',
      };

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        // Write
        await backend.write('integration', 'test-data', testData);

        // Read
        const result = await backend.read<typeof testData>('integration', 'test-data');
        expect(result, `${name} backend should preserve data`).toEqual(testData);

        // Cleanup for this test
        await backend.delete('integration', 'test-data');
        await cleanup();
      }
    });
  });

  describe('Backend Switching', () => {
    let fileBackend: FileBackend;
    let sqliteBackend: SQLiteBackend;
    let filePath: string;
    let sqlitePath: string;

    beforeEach(async () => {
      filePath = path.join(TEST_BASE_PATH, 'switch-file');
      sqlitePath = path.join(TEST_BASE_PATH, 'switch.db');

      fileBackend = new FileBackend({ basePath: filePath });
      sqliteBackend = new SQLiteBackend({ dbPath: sqlitePath });

      await fileBackend.initialize();
      await sqliteBackend.initialize();
    });

    afterEach(async () => {
      await fileBackend.close();
      await sqliteBackend.close();
      try {
        fs.rmSync(filePath, { recursive: true, force: true });
        fs.rmSync(sqlitePath, { force: true });
        fs.rmSync(sqlitePath + '-wal', { force: true });
        fs.rmSync(sqlitePath + '-shm', { force: true });
      } catch {
        // Ignore
      }
    });

    it('should migrate data from file to sqlite', async () => {
      // Write data to file backend
      await fileBackend.write('config', 'settings', { theme: 'dark' });
      await fileBackend.write('config', 'user', { name: 'test' });
      await fileBackend.write('data', 'items', [1, 2, 3]);

      // Read from file and write to sqlite
      const fileKeys = await fileBackend.list('config');
      for (const key of fileKeys) {
        const data = await fileBackend.read('config', key);
        await sqliteBackend.write('config', key, data);
      }

      const dataKeys = await fileBackend.list('data');
      for (const key of dataKeys) {
        const data = await fileBackend.read('data', key);
        await sqliteBackend.write('data', key, data);
      }

      // Verify data in sqlite
      expect(await sqliteBackend.read('config', 'settings')).toEqual({ theme: 'dark' });
      expect(await sqliteBackend.read('config', 'user')).toEqual({ name: 'test' });
      expect(await sqliteBackend.read('data', 'items')).toEqual([1, 2, 3]);
    });

    it('should migrate data from sqlite to file', async () => {
      // Write data to sqlite backend
      await sqliteBackend.write('config', 'db-settings', { maxConn: 10 });
      await sqliteBackend.write('config', 'db-user', { id: 123 });

      // Read from sqlite and write to file
      const keys = await sqliteBackend.list('config');
      for (const key of keys) {
        const data = await sqliteBackend.read('config', key);
        await fileBackend.write('config', key, data);
      }

      // Verify data in file
      expect(await fileBackend.read('config', 'db-settings')).toEqual({ maxConn: 10 });
      expect(await fileBackend.read('config', 'db-user')).toEqual({ id: 123 });
    });
  });

  describe('BackendFactory Integration', () => {
    it('should create and initialize file backend', async () => {
      const backend = await BackendFactory.createAndInitialize({
        backend: 'file',
        file: { basePath: path.join(TEST_BASE_PATH, 'factory-file') },
      });

      expect(backend).toBeInstanceOf(FileBackend);

      // Test basic operation
      await backend.write('test', 'key', { value: 1 });
      const result = await backend.read<{ value: number }>('test', 'key');
      expect(result?.value).toBe(1);

      await backend.close();
    });

    it('should create and initialize sqlite backend', async () => {
      const backend = await BackendFactory.createAndInitialize({
        backend: 'sqlite',
        sqlite: { dbPath: path.join(TEST_BASE_PATH, 'factory.db') },
      });

      expect(backend).toBeInstanceOf(SQLiteBackend);

      // Test basic operation
      await backend.write('test', 'key', { value: 2 });
      const result = await backend.read<{ value: number }>('test', 'key');
      expect(result?.value).toBe(2);

      await backend.close();
    });

    it('should fail initialization gracefully for invalid config', async () => {
      await expect(
        BackendFactory.createAndInitialize({
          backend: 'redis',
          redis: {
            host: 'nonexistent-host.invalid',
            port: 9999,
            connectTimeout: 1000,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('all backends should handle concurrent writes', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        // Concurrent writes
        const writes = Array.from({ length: 10 }, (_, i) =>
          backend.write('concurrent', `key-${i}`, { index: i })
        );
        await Promise.all(writes);

        // Verify all writes
        const keys = await backend.list('concurrent');
        expect(keys.length, `${name} should have all keys`).toBe(10);

        // Cleanup
        for (let i = 0; i < 10; i++) {
          await backend.delete('concurrent', `key-${i}`);
        }
        await cleanup();
      }
    });

    it('all backends should handle concurrent reads', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        // Setup data
        await backend.write('read-test', 'shared', { data: 'shared-value' });

        // Concurrent reads
        const reads = Array.from({ length: 10 }, () =>
          backend.read<{ data: string }>('read-test', 'shared')
        );
        const results = await Promise.all(reads);

        // All should get the same value
        for (const result of results) {
          expect(result?.data, `${name} concurrent read`).toBe('shared-value');
        }

        // Cleanup
        await backend.delete('read-test', 'shared');
        await cleanup();
      }
    });
  });

  describe('Error Handling Consistency', () => {
    it('all backends should return null for non-existent keys', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        const result = await backend.read('nonexistent-section', 'nonexistent-key');
        expect(result, `${name} should return null`).toBeNull();

        await cleanup();
      }
    });

    it('all backends should return false when deleting non-existent keys', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        const deleted = await backend.delete('nonexistent-section', 'nonexistent-key');
        expect(deleted, `${name} should return false`).toBe(false);

        await cleanup();
      }
    });

    it('all backends should return empty array for non-existent section', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        const keys = await backend.list('nonexistent-section-xyz');
        expect(keys, `${name} should return empty array`).toEqual([]);

        await cleanup();
      }
    });
  });

  describe('Health Check', () => {
    it('all backends should report healthy after initialization', async () => {
      const backends = await getAvailableBackends();

      for (const { name, backend, cleanup } of backends) {
        await backend.initialize();

        const health = await backend.healthCheck();
        expect(health.healthy, `${name} should be healthy`).toBe(true);
        expect(health.latencyMs, `${name} should report latency`).toBeDefined();

        await cleanup();
      }
    });
  });
});
