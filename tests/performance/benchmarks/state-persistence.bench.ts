/**
 * State Persistence Benchmarks
 *
 * Benchmarks for state save/load cycles and data persistence operations
 */

import { describe, bench, beforeAll, afterAll } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Scratchpad } from '../../../src/scratchpad/index.js';
import { generateIssueGraph } from '../fixtures/graph-generator.js';

describe('State Persistence Benchmarks', () => {
  let testDir: string;
  let scratchpad: Scratchpad;
  let counter: number;

  beforeAll(async () => {
    testDir = join(tmpdir(), `state-bench-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    scratchpad = new Scratchpad({ basePath: testDir });
    counter = 0;
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Graph State Persistence', () => {
    const small = generateIssueGraph(100);
    const medium = generateIssueGraph(500);
    const large = generateIssueGraph(1000);

    bench('save 100-node graph', async () => {
      await scratchpad.writeJson(`graph-100-${counter++}.json`, small);
    });

    bench('save 500-node graph', async () => {
      await scratchpad.writeJson(`graph-500-${counter++}.json`, medium);
    });

    bench('save 1000-node graph', async () => {
      await scratchpad.writeJson(`graph-1000-${counter++}.json`, large);
    });

    let small100Path: string;
    let medium500Path: string;
    let large1000Path: string;

    beforeAll(async () => {
      small100Path = 'graph-read-100.json';
      medium500Path = 'graph-read-500.json';
      large1000Path = 'graph-read-1000.json';

      await scratchpad.writeJson(small100Path, small);
      await scratchpad.writeJson(medium500Path, medium);
      await scratchpad.writeJson(large1000Path, large);
    });

    bench('load 100-node graph', async () => {
      await scratchpad.readJson(small100Path);
    });

    bench('load 500-node graph', async () => {
      await scratchpad.readJson(medium500Path);
    });

    bench('load 1000-node graph', async () => {
      await scratchpad.readJson(large1000Path);
    });
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

    bench('complete save/load cycle', async () => {
      const path = `cycle-${counter++}.json`;
      await scratchpad.writeJson(path, testData);
      await scratchpad.readJson(path);
    });

    bench('10 consecutive save/load cycles', async () => {
      for (let i = 0; i < 10; i++) {
        const path = `multi-cycle-${counter}-${i}.json`;
        await scratchpad.writeJson(path, testData);
        await scratchpad.readJson(path);
      }
      counter++;
    });
  });

  describe('Incremental Updates', () => {
    interface IncrementalState {
      counter: number;
      items: Array<{ id: number; updated: string }>;
    }

    bench('incremental update (read-modify-write)', async () => {
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
    });
  });

  describe('Concurrent Access Simulation', () => {
    bench('sequential locked writes (10 ops)', async () => {
      const path = `locked-${counter++}.json`;
      await scratchpad.writeJson(path, { value: 0 });

      for (let i = 0; i < 10; i++) {
        await scratchpad.withLock(path, async () => {
          const data = (await scratchpad.readJson(path)) as { value: number };
          data.value++;
          await scratchpad.writeJson(path, data);
        });
      }
    });
  });
});
