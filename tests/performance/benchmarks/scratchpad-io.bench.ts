/**
 * Scratchpad I/O Benchmarks
 *
 * Benchmarks for file-based state operations:
 * - Read/write operations
 * - JSON/YAML serialization
 * - Lock acquisition/release
 */

import { describe, bench, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Scratchpad } from '../../../src/scratchpad/index.js';

describe('Scratchpad I/O Benchmarks', () => {
  let testDir: string;
  let scratchpad: Scratchpad;
  let counter: number;

  beforeAll(async () => {
    testDir = join(tmpdir(), `scratchpad-bench-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    scratchpad = new Scratchpad({ basePath: testDir });
    counter = 0;
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    counter++;
  });

  describe('JSON Operations', () => {
    const smallData = { key: 'value', count: 42 };
    const mediumData = {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        metadata: { created: new Date().toISOString(), tags: ['a', 'b', 'c'] },
      })),
    };
    const largeData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
          properties: { key1: 'value1', key2: 'value2', nested: { deep: true } },
        },
      })),
    };

    bench('writeJson - small payload', async () => {
      await scratchpad.writeJson(`bench-json-small-${counter++}.json`, smallData);
    });

    bench('writeJson - medium payload (100 items)', async () => {
      await scratchpad.writeJson(`bench-json-medium-${counter++}.json`, mediumData);
    });

    bench('writeJson - large payload (1000 items)', async () => {
      await scratchpad.writeJson(`bench-json-large-${counter++}.json`, largeData);
    });

    // Setup files for read benchmarks
    let readSmallPath: string;
    let readMediumPath: string;
    let readLargePath: string;

    beforeAll(async () => {
      readSmallPath = 'read-bench-small.json';
      readMediumPath = 'read-bench-medium.json';
      readLargePath = 'read-bench-large.json';

      await scratchpad.writeJson(readSmallPath, smallData);
      await scratchpad.writeJson(readMediumPath, mediumData);
      await scratchpad.writeJson(readLargePath, largeData);
    });

    bench('readJson - small payload', async () => {
      await scratchpad.readJson(readSmallPath);
    });

    bench('readJson - medium payload', async () => {
      await scratchpad.readJson(readMediumPath);
    });

    bench('readJson - large payload', async () => {
      await scratchpad.readJson(readLargePath);
    });
  });

  describe('YAML Operations', () => {
    const yamlData = {
      project: {
        name: 'Test Project',
        version: '1.0.0',
        dependencies: Array.from({ length: 50 }, (_, i) => `dep-${i}`),
        config: {
          debug: true,
          environment: 'development',
          features: { feature1: true, feature2: false },
        },
      },
    };

    bench('writeYaml', async () => {
      await scratchpad.writeYaml(`bench-yaml-${counter++}.yaml`, yamlData);
    });

    let yamlPath: string;
    beforeAll(async () => {
      yamlPath = 'read-bench.yaml';
      await scratchpad.writeYaml(yamlPath, yamlData);
    });

    bench('readYaml', async () => {
      await scratchpad.readYaml(yamlPath);
    });
  });

  describe('Lock Operations', () => {
    bench('acquireLock + releaseLock', async () => {
      const lockPath = `lock-bench-${counter++}`;
      const lockId = `holder-${counter}`;

      await scratchpad.acquireLock(lockPath, lockId);
      await scratchpad.releaseLock(lockPath, lockId);
    });

    bench('withLock - simple operation', async () => {
      const path = `withlock-bench-${counter++}.json`;
      await scratchpad.writeJson(path, { value: 0 });

      await scratchpad.withLock(path, async () => {
        const data = (await scratchpad.readJson(path)) as { value: number };
        data.value++;
        await scratchpad.writeJson(path, data);
      });
    });
  });

  describe('Path Operations', () => {
    bench('getSectionPath (100 calls)', () => {
      for (let i = 0; i < 100; i++) {
        scratchpad.getSectionPath('progress');
        scratchpad.getSectionPath('state');
        scratchpad.getSectionPath('documents');
      }
    });

    bench('resolve complex paths', () => {
      for (let i = 0; i < 100; i++) {
        scratchpad.getSectionPath('progress');
        scratchpad.getSubsectionPath('progress', 'issues');
        scratchpad.getDocumentPath('progress', 'state', 'current');
      }
    });
  });
});
