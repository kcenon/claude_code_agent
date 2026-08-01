/**
 * Scratchpad I/O Benchmarks
 *
 * Benchmarks for file-based state operations:
 * - Read/write operations
 * - JSON/YAML serialization
 * - Lock acquisition/release
 */

import { describe, bench, type BenchOptions } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Scratchpad } from '../../../src/scratchpad/index.js';
import { getLogger } from '../../../src/logging/index.js';

describe('Scratchpad I/O Benchmarks', () => {
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
  const readSmallPath = 'read-bench-small.json';
  const readMediumPath = 'read-bench-medium.json';
  const readLargePath = 'read-bench-large.json';
  const yamlPath = 'read-bench.yaml';

  let testDir = '';
  let scratchpad: Scratchpad;
  let counter = 0;

  // Vitest's benchmark runner does not execute suite lifecycle hooks. Tinybench
  // setup/teardown hooks run outside the measured operation for warmup and run.
  const benchmarkOptions: BenchOptions = {
    throws: true,
    setup: async () => {
      const logger = getLogger();
      if (!logger.isReady()) await logger.initialize();
      testDir = await mkdtemp(join(tmpdir(), 'scratchpad-bench-'));
      scratchpad = new Scratchpad({ basePath: testDir });
      counter = 0;
      await Promise.all([
        scratchpad.writeJson(readSmallPath, smallData),
        scratchpad.writeJson(readMediumPath, mediumData),
        scratchpad.writeJson(readLargePath, largeData),
        scratchpad.writeYaml(yamlPath, yamlData),
      ]);
    },
    teardown: async () => {
      await rm(testDir, { recursive: true, force: true });
      testDir = '';
    },
  };

  describe('JSON Operations', () => {
    bench(
      'writeJson - small payload',
      async () => {
        await scratchpad.writeJson(`bench-json-small-${counter++}.json`, smallData);
      },
      benchmarkOptions
    );

    bench(
      'writeJson - medium payload (100 items)',
      async () => {
        await scratchpad.writeJson(`bench-json-medium-${counter++}.json`, mediumData);
      },
      benchmarkOptions
    );

    bench(
      'writeJson - large payload (1000 items)',
      async () => {
        await scratchpad.writeJson(`bench-json-large-${counter++}.json`, largeData);
      },
      benchmarkOptions
    );

    bench(
      'readJson - small payload',
      async () => {
        await scratchpad.readJson(readSmallPath);
      },
      benchmarkOptions
    );

    bench(
      'readJson - medium payload',
      async () => {
        await scratchpad.readJson(readMediumPath);
      },
      benchmarkOptions
    );

    bench(
      'readJson - large payload',
      async () => {
        await scratchpad.readJson(readLargePath);
      },
      benchmarkOptions
    );
  });

  describe('YAML Operations', () => {
    bench(
      'writeYaml',
      async () => {
        await scratchpad.writeYaml(`bench-yaml-${counter++}.yaml`, yamlData);
      },
      benchmarkOptions
    );

    bench(
      'readYaml',
      async () => {
        await scratchpad.readYaml(yamlPath);
      },
      benchmarkOptions
    );
  });

  describe('Lock Operations', () => {
    bench(
      'acquireLock + releaseLock',
      async () => {
        const lockPath = `lock-bench-${counter++}`;
        const lockId = `holder-${counter}`;

        await scratchpad.acquireLock(lockPath, lockId);
        await scratchpad.releaseLock(lockPath, lockId);
      },
      benchmarkOptions
    );

    bench(
      'withLock - simple operation',
      async () => {
        const path = `withlock-bench-${counter++}.json`;
        await scratchpad.writeJson(path, { value: 0 });

        await scratchpad.withLock(path, async () => {
          const data = (await scratchpad.readJson(path)) as { value: number };
          data.value++;
          await scratchpad.writeJson(path, data);
        });
      },
      benchmarkOptions
    );
  });

  describe('Path Operations', () => {
    bench(
      'getSectionPath (100 calls)',
      () => {
        for (let i = 0; i < 100; i++) {
          scratchpad.getSectionPath('progress');
          scratchpad.getSectionPath('issues');
          scratchpad.getSectionPath('documents');
        }
      },
      benchmarkOptions
    );

    bench(
      'resolve complex paths',
      () => {
        for (let i = 0; i < 100; i++) {
          scratchpad.getSectionPath('progress');
          scratchpad.getProjectPath('progress', 'benchmark-project');
          scratchpad.getDocumentPath('benchmark-project', 'srs');
        }
      },
      benchmarkOptions
    );
  });
});
