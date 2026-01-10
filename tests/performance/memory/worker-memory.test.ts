/**
 * Worker Memory Usage Tests
 *
 * Tests memory usage patterns for worker operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryProfiler } from '../utils/memory-profiler.js';
import { PriorityAnalyzer } from '../../../src/controller/index.js';
import { Scratchpad } from '../../../src/scratchpad/index.js';
import { generateIssueGraph } from '../fixtures/graph-generator.js';

describe('Worker Memory Usage', () => {
  let testDir: string;
  let profiler: MemoryProfiler;

  beforeEach(async () => {
    testDir = join(tmpdir(), `memory-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    profiler = new MemoryProfiler();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should not exceed 50MB for 100-node graph analysis', async () => {
    const graph = generateIssueGraph(100);

    const { metrics } = await profiler.measureOperation(async () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
      return analyzer;
    });

    const peakMB = metrics.peak.heapUsed / (1024 * 1024);
    expect(peakMB).toBeLessThan(50);
  });

  it('should not exceed 100MB for 500-node graph analysis', async () => {
    const graph = generateIssueGraph(500);

    const { metrics } = await profiler.measureOperation(async () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
      return analyzer;
    });

    const peakMB = metrics.peak.heapUsed / (1024 * 1024);
    expect(peakMB).toBeLessThan(100);
  });

  it('should not exceed 200MB for 1000-node graph analysis', async () => {
    const graph = generateIssueGraph(1000);

    const { metrics } = await profiler.measureOperation(async () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
      return analyzer;
    });

    const peakMB = metrics.peak.heapUsed / (1024 * 1024);
    expect(peakMB).toBeLessThan(200);
  });

  it('should have acceptable memory for Scratchpad operations', async () => {
    const scratchpad = new Scratchpad({ basePath: testDir });
    const largeData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: 'x'.repeat(100),
      })),
    };

    const { metrics } = await profiler.measureOperation(async () => {
      for (let i = 0; i < 10; i++) {
        await scratchpad.writeJson(`test-${i}.json`, largeData);
        await scratchpad.readJson(`test-${i}.json`);
      }
    });

    const peakMB = metrics.peak.heapUsed / (1024 * 1024);
    expect(peakMB).toBeLessThan(150);
  });

  it('should scale linearly with graph size', async () => {
    const sizes = [100, 200, 400];
    const memoryUsages: number[] = [];

    for (const size of sizes) {
      const graph = generateIssueGraph(size);

      const { metrics } = await profiler.measureOperation(async () => {
        const analyzer = new PriorityAnalyzer();
        analyzer.analyze(graph);
        return analyzer;
      });

      memoryUsages.push(metrics.peak.heapUsed);

      // Force GC between tests if available
      if (global.gc) {
        global.gc();
      }
    }

    // Check that memory scales approximately linearly (not exponentially)
    // The ratio between sizes is 2x, so memory should grow roughly proportionally
    const ratio1 = memoryUsages[1]! / memoryUsages[0]!;
    const ratio2 = memoryUsages[2]! / memoryUsages[1]!;

    // Allow up to 3x growth per 2x size increase (sub-quadratic is acceptable)
    expect(ratio1).toBeLessThan(3);
    expect(ratio2).toBeLessThan(3);
  });
});
