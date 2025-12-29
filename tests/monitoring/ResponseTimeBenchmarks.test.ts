import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResponseTimeBenchmarks,
  getResponseTimeBenchmarks,
  resetResponseTimeBenchmarks,
  DEFAULT_BENCHMARKS,
} from '../../src/monitoring/index.js';

describe('ResponseTimeBenchmarks', () => {
  let benchmarks: ResponseTimeBenchmarks;

  beforeEach(() => {
    resetResponseTimeBenchmarks();
    benchmarks = new ResponseTimeBenchmarks();
  });

  describe('getBenchmarks', () => {
    it('should return all benchmark definitions', () => {
      const all = benchmarks.getBenchmarks();

      expect(all.pipeline).toBeDefined();
      expect(all.stages).toBeDefined();
      expect(all.latency).toBeDefined();
      expect(all.e2e).toBeDefined();
    });

    it('should use default benchmarks', () => {
      const all = benchmarks.getBenchmarks();

      expect(all.pipeline.simple.total).toBe(DEFAULT_BENCHMARKS.pipeline.simple.total);
      expect(all.latency.agentStartup).toBe(DEFAULT_BENCHMARKS.latency.agentStartup);
    });
  });

  describe('getPipelineBenchmarks', () => {
    it('should return benchmarks for simple complexity', () => {
      const simple = benchmarks.getPipelineBenchmarks('simple');

      expect(simple.documentGeneration).toBe(20000);
      expect(simple.issueGeneration).toBe(10000);
      expect(simple.total).toBe(30000);
    });

    it('should return benchmarks for medium complexity', () => {
      const medium = benchmarks.getPipelineBenchmarks('medium');

      expect(medium.documentGeneration).toBe(30000);
      expect(medium.issueGeneration).toBe(15000);
      expect(medium.total).toBe(45000);
    });

    it('should return benchmarks for complex complexity', () => {
      const complex = benchmarks.getPipelineBenchmarks('complex');

      expect(complex.documentGeneration).toBe(60000);
      expect(complex.issueGeneration).toBe(30000);
      expect(complex.total).toBe(90000);
    });
  });

  describe('getStageBenchmarks', () => {
    it('should return stage-level benchmarks', () => {
      const stages = benchmarks.getStageBenchmarks();

      expect(stages.collection).toBe(10000);
      expect(stages.prd).toBe(15000);
      expect(stages.srs).toBe(15000);
      expect(stages.sds).toBe(15000);
      expect(stages.issues).toBe(30000);
      expect(stages.implementation).toBe(300000);
      expect(stages.prReview).toBe(120000);
    });
  });

  describe('getLatencyBenchmarks', () => {
    it('should return latency benchmarks', () => {
      const latency = benchmarks.getLatencyBenchmarks();

      expect(latency.agentStartup).toBe(2000);
      expect(latency.handoffLatency).toBe(1000);
      expect(latency.fileIO).toBe(100);
      expect(latency.apiConnection).toBe(500);
    });
  });

  describe('createTarget', () => {
    it('should create a benchmark target', () => {
      const target = benchmarks.createTarget('test', 1000, 'Test benchmark');

      expect(target.name).toBe('test');
      expect(target.targetMs).toBe(1000);
      expect(target.warningMs).toBe(1200); // 20% over
      expect(target.criticalMs).toBe(1500); // 50% over
      expect(target.description).toBe('Test benchmark');
    });
  });

  describe('validateTiming', () => {
    it('should pass when under target', () => {
      const target = benchmarks.createTarget('test', 1000, 'Test');
      const result = benchmarks.validateTiming('test', 800, target);

      expect(result.status).toBe('pass');
      expect(result.targetMet).toBe(true);
      expect(result.deviationPercent).toBe(-20);
    });

    it('should warn when slightly over target', () => {
      const target = benchmarks.createTarget('test', 1000, 'Test');
      const result = benchmarks.validateTiming('test', 1100, target);

      expect(result.status).toBe('warning');
      expect(result.deviationPercent).toBe(10);
    });

    it('should fail when significantly over target', () => {
      const target = benchmarks.createTarget('test', 1000, 'Test');
      const result = benchmarks.validateTiming('test', 1600, target);

      expect(result.status).toBe('fail');
      expect(result.deviationPercent).toBe(60);
    });
  });

  describe('validatePipeline', () => {
    it('should validate pipeline timings', () => {
      const result = benchmarks.validatePipeline('simple', {
        documentGenerationMs: 15000,
        issueGenerationMs: 8000,
        totalMs: 25000,
      });

      expect(result.passed).toBe(true);
      expect(result.results.length).toBe(3);
      expect(result.summary.passed).toBe(3);
      expect(result.summary.failed).toBe(0);
    });

    it('should fail when over targets', () => {
      const result = benchmarks.validatePipeline('simple', {
        totalMs: 60000, // Double the target
      });

      expect(result.passed).toBe(false);
      expect(result.summary.failed).toBe(1);
    });
  });

  describe('validateStages', () => {
    it('should validate stage timings', () => {
      const result = benchmarks.validateStages({
        collection: 5000,
        prd: 10000,
        srs: 10000,
        sds: 10000,
      });

      expect(result.passed).toBe(true);
      expect(result.results.length).toBe(4);
    });

    it('should detect slow stages', () => {
      const result = benchmarks.validateStages({
        collection: 5000,
        prd: 30000, // Double the target
      });

      expect(result.passed).toBe(false);
      expect(result.summary.failed).toBe(1);
    });
  });

  describe('validateLatency', () => {
    it('should validate latency metrics', () => {
      const result = benchmarks.validateLatency({
        agentStartup: 1500,
        handoffLatency: 800,
        fileIO: 50,
      });

      expect(result.passed).toBe(true);
      expect(result.results.length).toBe(3);
    });

    it('should detect slow latency', () => {
      const result = benchmarks.validateLatency({
        agentStartup: 5000, // Way over target
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('recordRun', () => {
    it('should record a benchmark run', () => {
      const entry = benchmarks.recordRun('session-1', 'simple', { collection: 5000 }, 25000);

      expect(entry.sessionId).toBe('session-1');
      expect(entry.complexity).toBe('simple');
      expect(entry.totalTimeMs).toBe(25000);
      expect(entry.allPassed).toBe(true);
    });

    it('should track failed runs', () => {
      const entry = benchmarks.recordRun('session-2', 'simple', {}, 60000);

      expect(entry.allPassed).toBe(false);
    });

    it('should accumulate history', () => {
      benchmarks.recordRun('s1', 'simple', {}, 25000);
      benchmarks.recordRun('s2', 'medium', {}, 40000);
      benchmarks.recordRun('s3', 'complex', {}, 80000);

      const history = benchmarks.getHistory();
      expect(history.length).toBe(3);
    });
  });

  describe('getHistoryByComplexity', () => {
    it('should filter history by complexity', () => {
      benchmarks.recordRun('s1', 'simple', {}, 25000);
      benchmarks.recordRun('s2', 'medium', {}, 40000);
      benchmarks.recordRun('s3', 'simple', {}, 28000);
      benchmarks.recordRun('s4', 'complex', {}, 80000);

      const simpleHistory = benchmarks.getHistoryByComplexity('simple');
      expect(simpleHistory.length).toBe(2);
      expect(simpleHistory[0].complexity).toBe('simple');
      expect(simpleHistory[1].complexity).toBe('simple');
    });
  });

  describe('getPerformanceTrend', () => {
    it('should return empty trend with no history', () => {
      const trend = benchmarks.getPerformanceTrend();

      expect(trend.avgTotalMs).toBe(0);
      expect(trend.passRate).toBe(0);
      expect(trend.trend).toBe('stable');
    });

    it('should calculate trend from history', () => {
      benchmarks.recordRun('s1', 'simple', {}, 25000);
      benchmarks.recordRun('s2', 'simple', {}, 28000);
      benchmarks.recordRun('s3', 'simple', {}, 26000);

      const trend = benchmarks.getPerformanceTrend('simple');

      expect(trend.avgTotalMs).toBeGreaterThan(0);
      expect(trend.minTotalMs).toBe(25000);
      expect(trend.maxTotalMs).toBe(28000);
      expect(trend.passRate).toBe(100);
    });

    it('should detect improving trend', () => {
      // Earlier runs are slower
      benchmarks.recordRun('s1', 'simple', {}, 29000);
      benchmarks.recordRun('s2', 'simple', {}, 28000);
      // Later runs are faster
      benchmarks.recordRun('s3', 'simple', {}, 22000);
      benchmarks.recordRun('s4', 'simple', {}, 21000);

      const trend = benchmarks.getPerformanceTrend('simple');
      expect(trend.trend).toBe('improving');
    });

    it('should detect degrading trend', () => {
      // Earlier runs are faster
      benchmarks.recordRun('s1', 'simple', {}, 20000);
      benchmarks.recordRun('s2', 'simple', {}, 21000);
      // Later runs are slower
      benchmarks.recordRun('s3', 'simple', {}, 28000);
      benchmarks.recordRun('s4', 'simple', {}, 29000);

      const trend = benchmarks.getPerformanceTrend('simple');
      expect(trend.trend).toBe('degrading');
    });
  });

  describe('generateReport', () => {
    it('should generate performance report', () => {
      benchmarks.recordRun('s1', 'simple', {}, 25000);
      benchmarks.recordRun('s2', 'medium', {}, 40000);
      benchmarks.recordRun('s3', 'complex', {}, 80000);

      const report = benchmarks.generateReport();

      expect(report.benchmarks).toBeDefined();
      expect(report.history.total).toBe(3);
      expect(report.byComplexity.simple.count).toBe(1);
      expect(report.byComplexity.medium.count).toBe(1);
      expect(report.byComplexity.complex.count).toBe(1);
    });
  });

  describe('checkE2ETarget', () => {
    it('should check simple feature target', () => {
      const result = benchmarks.checkE2ETarget('simple', 10 * 60 * 1000); // 10 minutes

      expect(result.targetMinutes).toBe(15);
      expect(result.actualMinutes).toBe(10);
      expect(result.met).toBe(true);
    });

    it('should check complex feature target', () => {
      const result = benchmarks.checkE2ETarget('complex', 25 * 60 * 1000); // 25 minutes

      expect(result.targetMinutes).toBe(30);
      expect(result.actualMinutes).toBe(25);
      expect(result.met).toBe(true);
    });

    it('should fail when over target', () => {
      const result = benchmarks.checkE2ETarget('simple', 20 * 60 * 1000); // 20 minutes

      expect(result.met).toBe(false);
    });
  });

  describe('custom benchmarks', () => {
    it('should accept custom benchmark overrides', () => {
      const customBenchmarks = new ResponseTimeBenchmarks({
        pipeline: {
          simple: {
            total: 60000, // Custom total
            documentGeneration: 20000,
            issueGeneration: 10000,
          },
        },
        latency: {
          agentStartup: 3000, // Custom startup time
          handoffLatency: 1000,
          fileIO: 100,
          apiConnection: 500,
        },
      });

      const simple = customBenchmarks.getPipelineBenchmarks('simple');
      expect(simple.total).toBe(60000);

      const latency = customBenchmarks.getLatencyBenchmarks();
      expect(latency.agentStartup).toBe(3000);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetResponseTimeBenchmarks();
      const instance1 = getResponseTimeBenchmarks();
      const instance2 = getResponseTimeBenchmarks();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getResponseTimeBenchmarks();
      instance1.recordRun('test', 'simple', {}, 25000);

      resetResponseTimeBenchmarks();
      const instance2 = getResponseTimeBenchmarks();

      expect(instance2.getHistory().length).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      benchmarks.recordRun('s1', 'simple', {}, 25000);
      benchmarks.recordRun('s2', 'simple', {}, 26000);

      expect(benchmarks.getHistory().length).toBe(2);

      benchmarks.clearHistory();

      expect(benchmarks.getHistory().length).toBe(0);
    });
  });
});
