import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  LatencyOptimizer,
  getLatencyOptimizer,
  resetLatencyOptimizer,
} from '../../src/monitoring/index.js';

describe('LatencyOptimizer', () => {
  let optimizer: LatencyOptimizer;
  const testCacheDir = '.test-cache-latency';

  beforeEach(() => {
    resetLatencyOptimizer();
    optimizer = new LatencyOptimizer({
      cacheDir: testCacheDir,
      enableTracking: true,
      maxTrackedMeasurements: 100,
    });
  });

  afterEach(() => {
    optimizer.reset();
    // Cleanup test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('getTargets', () => {
    it('should return default latency targets', () => {
      const targets = optimizer.getTargets();

      expect(targets.agentStartup).toBe(2000);
      expect(targets.handoffLatency).toBe(1000);
      expect(targets.fileIO).toBe(100);
      expect(targets.apiConnection).toBe(500);
    });

    it('should use custom targets when provided', () => {
      const customOptimizer = new LatencyOptimizer({
        targets: {
          agentStartup: 3000,
          handoffLatency: 500,
        },
        cacheDir: testCacheDir,
      });

      const targets = customOptimizer.getTargets();
      expect(targets.agentStartup).toBe(3000);
      expect(targets.handoffLatency).toBe(500);
      expect(targets.fileIO).toBe(100); // Default
    });
  });

  describe('measure', () => {
    it('should measure synchronous operation latency', () => {
      const result = optimizer.measure('test_op', 'fileIO', () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500);

      const measurements = optimizer.getMeasurements();
      expect(measurements.length).toBe(1);
      expect(measurements[0].operation).toBe('test_op');
      expect(measurements[0].latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should track target met status', () => {
      optimizer.measure('fast_op', 'fileIO', () => 'fast');

      const measurements = optimizer.getMeasurements();
      expect(measurements[0].targetMs).toBe(100);
      // Fast operation should meet target
      expect(measurements[0].targetMet).toBe(true);
    });
  });

  describe('measureAsync', () => {
    it('should measure async operation latency', async () => {
      const result = await optimizer.measureAsync('async_op', 'handoffLatency', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');

      const measurements = optimizer.getMeasurements();
      expect(measurements.length).toBe(1);
      expect(measurements[0].operation).toBe('async_op');
      // Use a small margin (5ms) to account for setTimeout timing imprecision
      // setTimeout does not guarantee exact timing, especially in CI environments
      expect(measurements[0].latencyMs).toBeGreaterThanOrEqual(5);
    });
  });

  describe('prewarmAgent', () => {
    it('should prewarm an agent definition', async () => {
      // Create a test agent definition file
      const agentDir = path.join(testCacheDir, 'agents');
      fs.mkdirSync(agentDir, { recursive: true });
      const agentPath = path.join(agentDir, 'test-agent.md');
      fs.writeFileSync(agentPath, '# Test Agent\nThis is a test agent definition.');

      const status = await optimizer.prewarmAgent('test-agent', agentPath);

      expect(status.isWarm).toBe(true);
      expect(status.resource).toBe('test-agent');
      expect(status.warmupTimeMs).toBeGreaterThanOrEqual(0);
      expect(status.lastWarmedAt).toBeDefined();
    });

    it('should handle missing agent definition', async () => {
      const status = await optimizer.prewarmAgent('missing-agent', '/nonexistent/path.md');

      expect(status.isWarm).toBe(false);
      expect(status.error).toContain('not found');
    });

    it('should cache prewarmed agent definition', async () => {
      // Create a test agent definition file
      const agentDir = path.join(testCacheDir, 'agents');
      fs.mkdirSync(agentDir, { recursive: true });
      const agentPath = path.join(agentDir, 'cached-agent.md');
      const content = '# Cached Agent\nCached content.';
      fs.writeFileSync(agentPath, content);

      await optimizer.prewarmAgent('cached-agent', agentPath);

      expect(optimizer.isAgentWarmed('cached-agent')).toBe(true);

      const cachedContent = optimizer.getCachedAgentDefinition('cached-agent');
      expect(cachedContent).toBe(content);
    });
  });

  describe('prewarmAgents', () => {
    it('should prewarm multiple agents in parallel', async () => {
      // Create test agent definition files
      const agentDir = path.join(testCacheDir, 'agents');
      fs.mkdirSync(agentDir, { recursive: true });

      const agents = [
        { name: 'agent1', definitionPath: path.join(agentDir, 'agent1.md') },
        { name: 'agent2', definitionPath: path.join(agentDir, 'agent2.md') },
      ];

      fs.writeFileSync(agents[0].definitionPath, '# Agent 1');
      fs.writeFileSync(agents[1].definitionPath, '# Agent 2');

      const statuses = await optimizer.prewarmAgents(agents);

      expect(statuses.length).toBe(2);
      expect(statuses[0].isWarm).toBe(true);
      expect(statuses[1].isWarm).toBe(true);
    });
  });

  describe('getLatencyStats', () => {
    it('should calculate latency statistics', () => {
      // Add some measurements
      for (let i = 0; i < 10; i++) {
        optimizer.measure('stat_op', 'fileIO', () => {
          const start = Date.now();
          while (Date.now() - start < i) {
            // Busy wait
          }
          return i;
        });
      }

      const stats = optimizer.getLatencyStats('stat_op');

      expect(stats.count).toBe(10);
      expect(stats.minMs).toBeGreaterThanOrEqual(0);
      expect(stats.maxMs).toBeGreaterThanOrEqual(stats.minMs);
      expect(stats.avgMs).toBeGreaterThanOrEqual(0);
    });

    it('should return empty stats for no measurements', () => {
      const stats = optimizer.getLatencyStats('nonexistent');

      expect(stats.count).toBe(0);
      expect(stats.avgMs).toBe(0);
      expect(stats.targetMetRate).toBe(0);
    });
  });

  describe('getSlowMeasurements', () => {
    it('should return measurements that missed target', () => {
      // Create a slow measurement by using a very tight target
      const slowOptimizer = new LatencyOptimizer({
        targets: { fileIO: 0 }, // Impossible target
        cacheDir: testCacheDir,
      });

      slowOptimizer.measure('slow_op', 'fileIO', () => {
        // Any operation will be slow with 0ms target
        return 'slow';
      });

      const slow = slowOptimizer.getMeasurements().filter((m) => !m.targetMet);
      expect(slow.length).toBeGreaterThan(0);
    });
  });

  describe('meetsTargets', () => {
    it('should report target compliance', () => {
      // Add fast measurements
      for (let i = 0; i < 10; i++) {
        optimizer.measure('fast_op', 'fileIO', () => 'fast');
      }

      const result = optimizer.meetsTargets();
      expect(result.overall).toBe(true);
      expect(result.details['fast_op']).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetLatencyOptimizer();
      const instance1 = getLatencyOptimizer();
      const instance2 = getLatencyOptimizer();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getLatencyOptimizer();
      instance1.measure('test', 'fileIO', () => 'test');

      resetLatencyOptimizer();
      const instance2 = getLatencyOptimizer();

      expect(instance2.getMeasurements().length).toBe(0);
    });
  });

  describe('clearMeasurements', () => {
    it('should clear all measurements', () => {
      optimizer.measure('op1', 'fileIO', () => 'test');
      optimizer.measure('op2', 'fileIO', () => 'test');

      expect(optimizer.getMeasurements().length).toBe(2);

      optimizer.clearMeasurements();

      expect(optimizer.getMeasurements().length).toBe(0);
    });
  });

  describe('parallelIO', () => {
    it('should execute I/O operations in parallel', async () => {
      const operations = [
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 1;
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 2;
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 3;
        },
      ];

      const results = await optimizer.parallelIO(operations);

      expect(results).toEqual([1, 2, 3]);

      const measurements = optimizer.getMeasurements();
      expect(measurements.length).toBe(1);
      expect(measurements[0].operation).toBe('parallel_io_batch');
    });
  });
});
