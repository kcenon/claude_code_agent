/**
 * State Persistence Benchmarks
 *
 * Benchmarks for state save/load cycles and data persistence operations
 */

import { describe, bench, type BenchOptions } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Scratchpad } from '../../../src/scratchpad/index.js';
import { getLogger } from '../../../src/logging/index.js';
import { generateIssueGraph } from '../fixtures/graph-generator.js';

describe('State Persistence Benchmarks', () => {
  const small = generateIssueGraph(100);
  const medium = generateIssueGraph(500);
  const large = generateIssueGraph(1000);
  const small100Path = 'graph-read-100.json';
  const medium500Path = 'graph-read-500.json';
  const large1000Path = 'graph-read-1000.json';

  let testDir = '';
  let scratchpad: Scratchpad;
  let counter = 0;

  // Tinybench hooks run outside the measured operation and are honored by
  // Vitest's benchmark runner, unlike regular suite lifecycle hooks.
  const benchmarkOptions: BenchOptions = {
    throws: true,
    setup: async () => {
      const logger = getLogger();
      if (!logger.isReady()) await logger.initialize();
      testDir = await mkdtemp(join(tmpdir(), 'state-bench-'));
      scratchpad = new Scratchpad({ basePath: testDir });
      counter = 0;
      await Promise.all([
        scratchpad.writeJson(small100Path, small),
        scratchpad.writeJson(medium500Path, medium),
        scratchpad.writeJson(large1000Path, large),
      ]);
    },
    teardown: async () => {
      await rm(testDir, { recursive: true, force: true });
      testDir = '';
    },
  };

  describe('Graph State Persistence', () => {
    bench(
      'save 100-node graph',
      async () => {
        await scratchpad.writeJson(`graph-100-${counter++}.json`, small);
      },
      benchmarkOptions
    );

    bench(
      'save 500-node graph',
      async () => {
        await scratchpad.writeJson(`graph-500-${counter++}.json`, medium);
      },
      benchmarkOptions
    );

    bench(
      'save 1000-node graph',
      async () => {
        await scratchpad.writeJson(`graph-1000-${counter++}.json`, large);
      },
      benchmarkOptions
    );

    bench(
      'load 100-node graph',
      async () => {
        await scratchpad.readJson(small100Path);
      },
      benchmarkOptions
    );

    bench(
      'load 500-node graph',
      async () => {
        await scratchpad.readJson(medium500Path);
      },
      benchmarkOptions
    );

    bench(
      'load 1000-node graph',
      async () => {
        await scratchpad.readJson(large1000Path);
      },
      benchmarkOptions
    );
  });

  describe('Save/Load Cycles', () => {
    const testData = {
      metadata: { version: '1.0.0', timestamp: new Date().toISOString() },
      state: {
        phase: 'processing',
        progress: 0.5,
        errors: [] as string[],
        warnings: ['warning1', 'warning2'],
      },
      results: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        status: 'completed',
        output: `Result for item ${i}`,
      })),
    };

    bench(
      'complete save/load cycle',
      async () => {
        const path = `cycle-${counter++}.json`;
        await scratchpad.writeJson(path, testData);
        await scratchpad.readJson(path);
      },
      benchmarkOptions
    );

    bench(
      '10 consecutive save/load cycles',
      async () => {
        for (let i = 0; i < 10; i++) {
          const path = `multi-cycle-${counter}-${i}.json`;
          await scratchpad.writeJson(path, testData);
          await scratchpad.readJson(path);
        }
        counter++;
      },
      benchmarkOptions
    );
  });

  describe('Incremental Updates', () => {
    interface IncrementalState {
      counter: number;
      items: Array<{ id: number; updated: string }>;
    }

    bench(
      'incremental update (read-modify-write)',
      async () => {
        const path = `incremental-${counter++}.json`;
        const initial: IncrementalState = { counter: 0, items: [] };
        await scratchpad.writeJson(path, initial);

        // Simulate 5 incremental updates
        for (let i = 0; i < 5; i++) {
          const state = (await scratchpad.readJson(path)) as IncrementalState;
          state.counter++;
          state.items.push({ id: i, updated: new Date().toISOString() });
          await scratchpad.writeJson(path, state);
        }
      },
      benchmarkOptions
    );
  });

  describe('Concurrent Access Simulation', () => {
    bench(
      'sequential locked writes (10 ops)',
      async () => {
        const path = `locked-${counter++}.json`;
        await scratchpad.writeJson(path, { value: 0 });

        for (let i = 0; i < 10; i++) {
          await scratchpad.withLock(path, async () => {
            const data = (await scratchpad.readJson(path)) as { value: number };
            data.value++;
            await scratchpad.writeJson(path, data);
          });
        }
      },
      benchmarkOptions
    );
  });
});
