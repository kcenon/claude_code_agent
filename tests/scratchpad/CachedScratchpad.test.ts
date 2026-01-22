/**
 * CachedScratchpad unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CachedScratchpad } from '../../src/scratchpad/CachedScratchpad.js';

describe('CachedScratchpad', () => {
  let testDir: string;
  let scratchpad: CachedScratchpad;

  beforeEach(async () => {
    // Create temp directory
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cached-scratchpad-test-'));

    scratchpad = new CachedScratchpad({
      basePath: testDir,
      projectRoot: testDir,
      enableCaching: true,
      enableBatching: true,
      flushIntervalMs: 0, // Disable auto-flush for tests
      cacheSize: 100,
    });
  });

  afterEach(async () => {
    await scratchpad.cleanup();
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('basic operations', () => {
    it('should write and read YAML', async () => {
      const testPath = path.join(testDir, 'test.yaml');
      const data = { key: 'value', nested: { a: 1, b: 2 } };

      await scratchpad.writeYaml(testPath, data);
      await scratchpad.flush();

      const result = await scratchpad.readYaml<typeof data>(testPath);
      expect(result).toEqual(data);
    });

    it('should write and read JSON', async () => {
      const testPath = path.join(testDir, 'test.json');
      const data = { items: [1, 2, 3], count: 3 };

      await scratchpad.writeJson(testPath, data);
      await scratchpad.flush();

      const result = await scratchpad.readJson<typeof data>(testPath);
      expect(result).toEqual(data);
    });

    it('should write and read Markdown', async () => {
      const testPath = path.join(testDir, 'test.md');
      const content = '# Hello World\n\nThis is a test.';

      await scratchpad.writeMarkdown(testPath, content);
      await scratchpad.flush();

      const result = await scratchpad.readMarkdown(testPath);
      expect(result).toBe(content);
    });

    it('should handle allowMissing option', async () => {
      const testPath = path.join(testDir, 'nonexistent.yaml');

      const result = await scratchpad.readYaml(testPath, { allowMissing: true });
      expect(result).toBeNull();
    });

    it('should throw for missing file without allowMissing', async () => {
      const testPath = path.join(testDir, 'nonexistent.yaml');

      await expect(scratchpad.readYaml(testPath)).rejects.toThrow('ENOENT');
    });
  });

  describe('caching', () => {
    it('should cache reads', async () => {
      const testPath = path.join(testDir, 'cached.yaml');
      const data = { value: 42 };

      // Write initial data
      await scratchpad.writeYaml(testPath, data);
      await scratchpad.flush();

      // First read (from cache since write populates cache)
      const result1 = await scratchpad.readYaml<typeof data>(testPath);

      // Second read (also from cache)
      const result2 = await scratchpad.readYaml<typeof data>(testPath);

      expect(result1).toEqual(data);
      expect(result2).toEqual(data);

      const metrics = scratchpad.getCacheMetrics();
      // Both reads are cache hits since write populates the cache
      expect(metrics.hits).toBe(2);
    });

    it('should update cache on write', async () => {
      const testPath = path.join(testDir, 'update-cache.yaml');

      // Write and read
      await scratchpad.writeYaml(testPath, { version: 1 });
      await scratchpad.flush();
      const result1 = await scratchpad.readYaml<{ version: number }>(testPath);

      // Write new data (should update cache)
      await scratchpad.writeYaml(testPath, { version: 2 });
      const result2 = await scratchpad.readYaml<{ version: number }>(testPath);

      expect(result1?.version).toBe(1);
      expect(result2?.version).toBe(2);
    });

    it('should invalidate cache on delete', async () => {
      const testPath = path.join(testDir, 'delete-cache.yaml');

      // Write and read (caches the value)
      await scratchpad.writeYaml(testPath, { data: 'test' });
      await scratchpad.flush();
      await scratchpad.readYaml(testPath);

      // Delete file
      await scratchpad.deleteFile(testPath);

      // Should not find in cache
      const result = await scratchpad.readYaml(testPath, { allowMissing: true });
      expect(result).toBeNull();
    });

    it('should allow manual cache invalidation', async () => {
      const testPath = path.join(testDir, 'manual-invalidate.yaml');

      // Write and read
      await scratchpad.writeYaml(testPath, { data: 'original' });
      await scratchpad.flush();
      await scratchpad.readYaml(testPath);

      // Invalidate cache manually
      scratchpad.invalidateCache(testPath);

      // Write externally (simulating external change)
      await fs.promises.writeFile(testPath, 'data: modified\n');

      // Read should get new data
      const result = await scratchpad.readYaml<{ data: string }>(testPath);
      expect(result?.data).toBe('modified');
    });

    it('should clear all cache', async () => {
      const path1 = path.join(testDir, 'cache1.yaml');
      const path2 = path.join(testDir, 'cache2.yaml');

      await scratchpad.writeYaml(path1, { a: 1 });
      await scratchpad.writeYaml(path2, { b: 2 });
      await scratchpad.flush();

      await scratchpad.readYaml(path1);
      await scratchpad.readYaml(path2);

      scratchpad.invalidateAllCache();

      const metrics = scratchpad.getCacheMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe('batching', () => {
    it('should batch writes', async () => {
      const path1 = path.join(testDir, 'batch1.yaml');
      const path2 = path.join(testDir, 'batch2.yaml');

      // Queue multiple writes
      await scratchpad.writeYaml(path1, { a: 1 });
      await scratchpad.writeYaml(path2, { b: 2 });

      // Files not written yet
      expect(fs.existsSync(path1)).toBe(false);
      expect(fs.existsSync(path2)).toBe(false);

      // Flush writes to disk
      await scratchpad.flush();

      // Files now exist
      expect(fs.existsSync(path1)).toBe(true);
      expect(fs.existsSync(path2)).toBe(true);
    });

    it('should check pending writes', async () => {
      const testPath = path.join(testDir, 'pending.yaml');

      await scratchpad.writeYaml(testPath, { pending: true });

      expect(scratchpad.isWritePending(testPath)).toBe(true);

      await scratchpad.flush();

      expect(scratchpad.isWritePending(testPath)).toBe(false);
    });

    it('should bypass batching with writeImmediate', async () => {
      const testPath = path.join(testDir, 'immediate.yaml');

      await scratchpad.writeImmediate(testPath, { immediate: true });

      // File should exist immediately
      expect(fs.existsSync(testPath)).toBe(true);
    });

    it('should read pending writes from cache', async () => {
      const testPath = path.join(testDir, 'read-pending.yaml');

      await scratchpad.writeYaml(testPath, { data: 'pending' });

      // Read before flush (should get from cache)
      const result = await scratchpad.readYaml<{ data: string }>(testPath);
      expect(result?.data).toBe('pending');
    });
  });

  describe('metrics', () => {
    it('should return combined metrics', async () => {
      const testPath = path.join(testDir, 'metrics.yaml');

      await scratchpad.writeYaml(testPath, { data: 1 });
      await scratchpad.flush();
      await scratchpad.readYaml(testPath);
      await scratchpad.readYaml(testPath); // Cache hit

      const metrics = scratchpad.getMetrics();

      expect(metrics.cache).toBeDefined();
      expect(metrics.batcher).toBeDefined();
      expect(metrics.cache.hits).toBeGreaterThan(0);
      expect(metrics.batcher.totalFlushes).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const testPath = path.join(testDir, 'reset-metrics.yaml');

      await scratchpad.writeYaml(testPath, { data: 1 });
      await scratchpad.flush();
      await scratchpad.readYaml(testPath);

      scratchpad.resetMetrics();

      const metrics = scratchpad.getMetrics();
      expect(metrics.cache.hits).toBe(0);
      expect(metrics.batcher.totalWrites).toBe(0);
    });
  });

  describe('disable caching/batching', () => {
    it('should work without caching', async () => {
      const noCacheScratchpad = new CachedScratchpad({
        basePath: testDir,
        projectRoot: testDir,
        enableCaching: false,
        enableBatching: false,
      });

      const testPath = path.join(testDir, 'no-cache.yaml');

      await noCacheScratchpad.writeYaml(testPath, { value: 1 });
      const result = await noCacheScratchpad.readYaml<{ value: number }>(testPath);

      expect(result?.value).toBe(1);

      await noCacheScratchpad.cleanup();
    });

    it('should work without batching', async () => {
      const noBatchScratchpad = new CachedScratchpad({
        basePath: testDir,
        projectRoot: testDir,
        enableCaching: true,
        enableBatching: false,
      });

      const testPath = path.join(testDir, 'no-batch.yaml');

      await noBatchScratchpad.writeYaml(testPath, { value: 1 });

      // File should exist immediately
      expect(fs.existsSync(testPath)).toBe(true);

      await noBatchScratchpad.cleanup();
    });
  });

  describe('cleanup', () => {
    it('should flush pending writes on cleanup', async () => {
      const testPath = path.join(testDir, 'cleanup.yaml');

      await scratchpad.writeYaml(testPath, { cleanup: true });

      // File not written yet
      expect(fs.existsSync(testPath)).toBe(false);

      await scratchpad.cleanup();

      // File written after cleanup
      expect(fs.existsSync(testPath)).toBe(true);
    });
  });
});
