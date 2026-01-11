import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileBackend } from '../../../src/scratchpad/backends/FileBackend.js';

describe('FileBackend', () => {
  let backend: FileBackend;
  let testBasePath: string;

  beforeEach(async () => {
    testBasePath = path.join(os.tmpdir(), `file-backend-test-${Date.now()}`);
    backend = new FileBackend({ basePath: testBasePath });
    await backend.initialize();
  });

  afterEach(async () => {
    await backend.close();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('IScratchpadBackend Interface', () => {
    it('should have correct name', () => {
      expect(backend.name).toBe('file');
    });

    it('should initialize without error', async () => {
      const newBackend = new FileBackend({ basePath: testBasePath + '-new' });
      await expect(newBackend.initialize()).resolves.not.toThrow();
      await newBackend.close();
    });
  });

  describe('read and write', () => {
    it('should write and read a value', async () => {
      const data = { name: 'test', value: 42 };
      await backend.write('section1', 'key1', data);
      const result = await backend.read<typeof data>('section1', 'key1');
      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const result = await backend.read('section1', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should overwrite existing value', async () => {
      await backend.write('section1', 'key1', { value: 1 });
      await backend.write('section1', 'key1', { value: 2 });
      const result = await backend.read<{ value: number }>('section1', 'key1');
      expect(result?.value).toBe(2);
    });

    it('should handle complex nested objects', async () => {
      const data = {
        nested: {
          array: [1, 2, 3],
          object: { a: 'b' },
        },
        boolean: true,
        null: null,
      };
      await backend.write('section1', 'complex', data);
      const result = await backend.read<typeof data>('section1', 'complex');
      expect(result).toEqual(data);
    });
  });

  describe('delete', () => {
    it('should delete existing value', async () => {
      await backend.write('section1', 'key1', { data: 'test' });
      const deleted = await backend.delete('section1', 'key1');
      expect(deleted).toBe(true);
      const result = await backend.read('section1', 'key1');
      expect(result).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await backend.delete('section1', 'nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all keys in a section', async () => {
      await backend.write('section1', 'key1', { data: 1 });
      await backend.write('section1', 'key2', { data: 2 });
      await backend.write('section1', 'key3', { data: 3 });

      const keys = await backend.list('section1');
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array for non-existent section', async () => {
      const keys = await backend.list('nonexistent');
      expect(keys).toEqual([]);
    });

    it('should not list keys from other sections', async () => {
      await backend.write('section1', 'key1', { data: 1 });
      await backend.write('section2', 'key2', { data: 2 });

      const keys = await backend.list('section1');
      expect(keys).toHaveLength(1);
      expect(keys).toContain('key1');
      expect(keys).not.toContain('key2');
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await backend.write('section1', 'key1', { data: 'test' });
      const exists = await backend.exists('section1', 'key1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await backend.exists('section1', 'nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('batch', () => {
    it('should execute multiple writes atomically', async () => {
      await backend.batch([
        { type: 'write', section: 'section1', key: 'key1', value: { a: 1 } },
        { type: 'write', section: 'section1', key: 'key2', value: { b: 2 } },
      ]);

      const result1 = await backend.read<{ a: number }>('section1', 'key1');
      const result2 = await backend.read<{ b: number }>('section1', 'key2');
      expect(result1?.a).toBe(1);
      expect(result2?.b).toBe(2);
    });

    it('should execute mixed operations', async () => {
      await backend.write('section1', 'toDelete', { data: 'delete me' });

      await backend.batch([
        { type: 'write', section: 'section1', key: 'new', value: { data: 'new' } },
        { type: 'delete', section: 'section1', key: 'toDelete' },
      ]);

      const newResult = await backend.read('section1', 'new');
      const deletedResult = await backend.read('section1', 'toDelete');
      expect(newResult).toEqual({ data: 'new' });
      expect(deletedResult).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const health = await backend.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeDefined();
    });
  });

  describe('JSON format', () => {
    it('should work with JSON format', async () => {
      const jsonBackend = new FileBackend({
        basePath: testBasePath + '-json',
        format: 'json',
      });
      await jsonBackend.initialize();

      await jsonBackend.write('section1', 'key1', { data: 'json' });
      const result = await jsonBackend.read<{ data: string }>('section1', 'key1');
      expect(result?.data).toBe('json');

      await jsonBackend.close();
    });
  });
});
