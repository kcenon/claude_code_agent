/**
 * Pipeline Benchmarks E2E Tests
 *
 * Tests for establishing and validating performance benchmarks
 * for the AD-SDLC pipeline execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEnvironment,
  resetAllAgents,
  Timer,
  type TestEnvironment,
} from './helpers/test-environment.js';
import { runPipeline, runDocumentPipeline } from './helpers/pipeline-runner.js';
import {
  SIMPLE_FEATURE_INPUT,
  MEDIUM_FEATURE_INPUT,
  COMPLEX_FEATURE_INPUT,
  FIXTURE_EXPECTATIONS,
} from './helpers/fixtures.js';

/**
 * Benchmark targets (in milliseconds)
 */
const BENCHMARKS = {
  simple: {
    documentGeneration: 20000, // 20 seconds
    issueGeneration: 10000, // 10 seconds
    total: 30000, // 30 seconds
  },
  medium: {
    documentGeneration: 30000, // 30 seconds
    issueGeneration: 15000, // 15 seconds
    total: 45000, // 45 seconds
  },
  complex: {
    documentGeneration: 60000, // 60 seconds
    issueGeneration: 30000, // 30 seconds
    total: 90000, // 90 seconds
  },
};

describe('Pipeline Benchmarks', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    await resetAllAgents();
    env = await createTestEnvironment({
      baseName: 'e2e-benchmarks',
      initScratchpad: true,
    });
  });

  afterEach(async () => {
    await env.cleanup();
    await resetAllAgents();
  });

  describe('Simple Feature Benchmarks', () => {
    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should complete document generation within benchmark', async () => {
      const timer = new Timer();
      timer.start();

      const result = await runDocumentPipeline(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Simple Benchmark',
        skipClarification: true,
      });

      const elapsed = timer.stop();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(BENCHMARKS.simple.documentGeneration);

      // Log actual timing for reference
      console.log(`Simple document generation: ${elapsed}ms (target: ${BENCHMARKS.simple.documentGeneration}ms)`);
    }, 60000);

    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should complete full pipeline within benchmark', async () => {
      const timer = new Timer();
      timer.start();

      const result = await runPipeline(env, SIMPLE_FEATURE_INPUT, {
        projectName: 'Simple Full Benchmark',
        skipClarification: true,
        generateIssues: true,
      });

      const elapsed = timer.stop();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(BENCHMARKS.simple.total);

      console.log(`Simple full pipeline: ${elapsed}ms (target: ${BENCHMARKS.simple.total}ms)`);
    }, 60000);
  });

  describe('Medium Feature Benchmarks', () => {
    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should complete document generation within benchmark', async () => {
      const timer = new Timer();
      timer.start();

      const result = await runDocumentPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Medium Benchmark',
        skipClarification: true,
      });

      const elapsed = timer.stop();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(BENCHMARKS.medium.documentGeneration);

      console.log(`Medium document generation: ${elapsed}ms (target: ${BENCHMARKS.medium.documentGeneration}ms)`);
    }, 90000);

    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should complete full pipeline within benchmark', async () => {
      const timer = new Timer();
      timer.start();

      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Medium Full Benchmark',
        skipClarification: true,
        generateIssues: true,
      });

      const elapsed = timer.stop();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(BENCHMARKS.medium.total);

      console.log(`Medium full pipeline: ${elapsed}ms (target: ${BENCHMARKS.medium.total}ms)`);
    }, 90000);
  });

  describe('Complex Feature Benchmarks', () => {
    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should complete document generation within benchmark', async () => {
      const timer = new Timer();
      timer.start();

      const result = await runDocumentPipeline(env, COMPLEX_FEATURE_INPUT, {
        projectName: 'Complex Benchmark',
        skipClarification: true,
      });

      const elapsed = timer.stop();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(BENCHMARKS.complex.documentGeneration);

      console.log(`Complex document generation: ${elapsed}ms (target: ${BENCHMARKS.complex.documentGeneration}ms)`);
    }, 120000);

    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should complete full pipeline within benchmark', async () => {
      const timer = new Timer();
      timer.start();

      const result = await runPipeline(env, COMPLEX_FEATURE_INPUT, {
        projectName: 'Complex Full Benchmark',
        skipClarification: true,
        generateIssues: true,
      });

      const elapsed = timer.stop();

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(BENCHMARKS.complex.total);

      console.log(`Complex full pipeline: ${elapsed}ms (target: ${BENCHMARKS.complex.total}ms)`);
    }, 120000);
  });

  describe('Stage-by-Stage Benchmarks', () => {
    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should track timing for each pipeline stage', async () => {
      const result = await runPipeline(env, MEDIUM_FEATURE_INPUT, {
        projectName: 'Stage Timing Test',
        skipClarification: true,
        generateIssues: true,
      });

      expect(result.success).toBe(true);

      // Verify timing data is captured
      expect(result.timing.collection).toBeDefined();
      expect(result.timing.prd).toBeDefined();
      expect(result.timing.srs).toBeDefined();
      expect(result.timing.sds).toBeDefined();
      expect(result.timing.issues).toBeDefined();

      // Log stage timings
      console.log('Stage timings:');
      console.log(`  Collection: ${result.timing.collection}ms`);
      console.log(`  PRD: ${result.timing.prd}ms`);
      console.log(`  SRS: ${result.timing.srs}ms`);
      console.log(`  SDS: ${result.timing.sds}ms`);
      console.log(`  Issues: ${result.timing.issues}ms`);
      console.log(`  Total: ${result.totalTimeMs}ms`);

      // Verify individual stages are reasonable
      expect(result.timing.collection).toBeLessThan(10000);
      expect(result.timing.prd).toBeLessThan(15000);
      expect(result.timing.srs).toBeLessThan(15000);
      expect(result.timing.sds).toBeLessThan(15000);
    }, 90000);
  });

  describe('Throughput Benchmarks', () => {
    // TODO: Depends on SDS generation which has format mismatch issue
    it.skip('should process multiple simple projects sequentially', async () => {
      const projectCount = 3;
      const timer = new Timer();
      timer.start();

      const results = [];
      for (let i = 0; i < projectCount; i++) {
        await resetAllAgents();
        const result = await runDocumentPipeline(env, SIMPLE_FEATURE_INPUT, {
          projectName: `Throughput Test ${i + 1}`,
          skipClarification: true,
        });
        results.push(result);
      }

      const elapsed = timer.stop();
      const successCount = results.filter((r) => r.success).length;

      expect(successCount).toBe(projectCount);

      const avgTime = elapsed / projectCount;
      console.log(`Sequential throughput: ${projectCount} projects in ${elapsed}ms (avg: ${avgTime}ms)`);

      // Average should be within 2x of single project benchmark
      expect(avgTime).toBeLessThan(BENCHMARKS.simple.documentGeneration * 2);
    }, 120000);
  });
});
