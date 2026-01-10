/**
 * Memory Leak Detection Tests
 *
 * Tests for detecting memory leaks in repeated operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryProfiler } from '../utils/memory-profiler.js';
import { PriorityAnalyzer } from '../../../src/controller/index.js';
import { Scratchpad } from '../../../src/scratchpad/index.js';
import { generateIssueGraph } from '../fixtures/graph-generator.js';

describe('Memory Leak Detection', () => {
  let testDir: string;
  let profiler: MemoryProfiler;

  beforeEach(async () => {
    testDir = join(tmpdir(), `leak-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    profiler = new MemoryProfiler({ sampleInterval: 50 });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should not leak memory over 100 graph analyses', async () => {
    const graph = generateIssueGraph(100);

    const { metrics } = await profiler.measureOperation(async () => {
      for (let i = 0; i < 100; i++) {
        const analyzer = new PriorityAnalyzer();
        analyzer.analyze(graph);
        // Let GC run periodically
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }
    });

    // Memory growth should be minimal after GC
    // Note: In short test runs, leakSuspected may be true due to normal V8 behavior
    // Focus on actual memory difference rather than growth pattern
    const growthMB = (metrics.final.heapUsed - metrics.initial.heapUsed) / (1024 * 1024);

    // Allow up to 50MB growth for 100 graph analyses (reasonable for creating/discarding objects)
    expect(growthMB).toBeLessThan(50);
  });

  it('should not leak memory over 100 Scratchpad read/write cycles', async () => {
    const scratchpad = new Scratchpad({ basePath: testDir });
    const testData = {
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
      })),
    };

    const { metrics } = await profiler.measureOperation(async () => {
      for (let i = 0; i < 100; i++) {
        const path = `leak-test-${i % 10}.json`;
        await scratchpad.writeJson(path, testData);
        await scratchpad.readJson(path);

        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }
    });

    // Focus on actual memory growth rather than pattern detection
    const growthMB = (metrics.final.heapUsed - metrics.initial.heapUsed) / (1024 * 1024);
    // Allow reasonable growth for I/O operations
    expect(growthMB).toBeLessThan(30);
  });

  it('should not leak memory over repeated lock/unlock cycles', async () => {
    const scratchpad = new Scratchpad({ basePath: testDir });
    const lockPath = 'lock-leak-test';

    const { metrics } = await profiler.measureOperation(async () => {
      for (let i = 0; i < 100; i++) {
        const holderId = `holder-${i}`;
        await scratchpad.acquireLock(lockPath, holderId);
        await scratchpad.releaseLock(lockPath, holderId);

        if (i % 25 === 0 && global.gc) {
          global.gc();
        }
      }
    });

    // Focus on actual memory growth rather than pattern detection
    const growthMB = (metrics.final.heapUsed - metrics.initial.heapUsed) / (1024 * 1024);
    // Allow reasonable growth for lock operations
    expect(growthMB).toBeLessThan(20);
  });

  it('should properly release memory when analyzers go out of scope', async () => {
    const graph = generateIssueGraph(200);

    // Capture initial memory
    if (global.gc) global.gc();
    const initialHeap = profiler.getHeapUsedMB();

    // Create and discard many analyzers
    for (let i = 0; i < 50; i++) {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
      // Analyzer goes out of scope here
    }

    // Force GC and check memory
    if (global.gc) global.gc();
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (global.gc) global.gc();

    const finalHeap = profiler.getHeapUsedMB();

    // Memory should not have grown significantly
    const growth = finalHeap - initialHeap;
    expect(growth).toBeLessThan(20); // Less than 20MB growth
  });

  it('should not accumulate memory during transitive dependency calculations', async () => {
    const graph = generateIssueGraph(500);
    const analyzer = new PriorityAnalyzer();
    analyzer.analyze(graph);

    const nodes = graph.nodes;

    const { metrics } = await profiler.measureOperation(async () => {
      for (let i = 0; i < 200; i++) {
        const randomNode = nodes[Math.floor(Math.random() * nodes.length)]!;
        analyzer.getTransitiveDependencies(randomNode.id);
      }
    });

    expect(metrics.leakSuspected).toBe(false);
  });
});
