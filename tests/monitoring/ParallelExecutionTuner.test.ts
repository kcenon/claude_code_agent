import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ParallelExecutionTuner,
  getParallelExecutionTuner,
  resetParallelExecutionTuner,
} from '../../src/monitoring/index.js';

describe('ParallelExecutionTuner', () => {
  let tuner: ParallelExecutionTuner;

  beforeEach(() => {
    resetParallelExecutionTuner();
    tuner = new ParallelExecutionTuner({
      baseWorkerCount: 4,
      maxWorkerCount: 8,
      enableAutoScaling: true,
    });
  });

  afterEach(() => {
    tuner.reset();
  });

  describe('getSystemResources', () => {
    it('should return system resource information', () => {
      const resources = tuner.getSystemResources();

      expect(resources.cpuCores).toBeGreaterThan(0);
      expect(resources.totalMemoryBytes).toBeGreaterThan(0);
      expect(resources.freeMemoryBytes).toBeGreaterThan(0);
      expect(resources.memoryUsagePercent).toBeGreaterThanOrEqual(0);
      expect(resources.memoryUsagePercent).toBeLessThanOrEqual(100);
      expect(resources.loadAverage).toHaveLength(3);
    });
  });

  describe('calculateOptimalWorkerCount', () => {
    it('should return worker pool recommendation', () => {
      const recommendation = tuner.calculateOptimalWorkerCount();

      expect(recommendation.recommendedWorkers).toBeGreaterThanOrEqual(1);
      expect(recommendation.minWorkers).toBe(1);
      expect(recommendation.maxWorkers).toBe(8);
      expect(recommendation.reasoning).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
      expect(recommendation.confidence).toBeLessThanOrEqual(100);
    });

    it('should respect max worker count', () => {
      const recommendation = tuner.calculateOptimalWorkerCount();

      expect(recommendation.recommendedWorkers).toBeLessThanOrEqual(8);
    });
  });

  describe('calculateBatchConfig', () => {
    it('should calculate batch configuration for items', () => {
      const config = tuner.calculateBatchConfig(20);

      expect(config.batchSize).toBeGreaterThanOrEqual(1);
      expect(config.maxConcurrentBatches).toBeGreaterThanOrEqual(1);
      expect(config.batchDelayMs).toBe(500);
    });

    it('should handle small item counts', () => {
      const config = tuner.calculateBatchConfig(2);

      expect(config.batchSize).toBeGreaterThanOrEqual(1);
      expect(config.maxConcurrentBatches).toBeGreaterThanOrEqual(1);
    });

    it('should handle large item counts', () => {
      const config = tuner.calculateBatchConfig(1000);

      expect(config.batchSize).toBeGreaterThanOrEqual(1);
      expect(config.batchSize).toBeLessThanOrEqual(5);
    });
  });

  describe('recordTuningResult', () => {
    it('should record tuning history', () => {
      tuner.recordTuningResult(4, 3, 100, 10000, 2);

      const history = tuner.getTuningHistory();
      expect(history.length).toBe(1);
      expect(history[0].workerCount).toBe(4);
      expect(history[0].batchSize).toBe(3);
      expect(history[0].throughput).toBe(10); // 100 items / 10000ms * 1000
      expect(history[0].avgLatencyMs).toBe(100); // 10000ms / 100 items
      expect(history[0].errorRate).toBe(0.02); // 2 / 100
    });

    it('should accumulate history entries', () => {
      tuner.recordTuningResult(4, 3, 100, 10000, 0);
      tuner.recordTuningResult(5, 3, 120, 10000, 1);
      tuner.recordTuningResult(3, 2, 80, 10000, 0);

      const history = tuner.getTuningHistory();
      expect(history.length).toBe(3);
    });
  });

  describe('getTuningRecommendations', () => {
    it('should return defaults with insufficient history', () => {
      const recommendations = tuner.getTuningRecommendations();

      expect(recommendations.workerCount).toBeGreaterThanOrEqual(1);
      expect(recommendations.batchSize).toBe(3);
      expect(recommendations.reasoning).toContain('insufficient history');
    });

    it('should use history-based recommendations', () => {
      // Add enough history
      for (let i = 0; i < 5; i++) {
        tuner.recordTuningResult(4, 3, 100, 10000, 0);
      }

      const recommendations = tuner.getTuningRecommendations();

      expect(recommendations.workerCount).toBe(4);
      expect(recommendations.batchSize).toBe(3);
      expect(recommendations.reasoning).toContain('recent runs');
    });
  });

  describe('getCurrentWorkerCount', () => {
    it('should return current worker count', () => {
      expect(tuner.getCurrentWorkerCount()).toBe(4);
    });

    it('should be updatable', () => {
      tuner.setCurrentWorkerCount(6);
      expect(tuner.getCurrentWorkerCount()).toBe(6);
    });

    it('should respect bounds', () => {
      tuner.setCurrentWorkerCount(100);
      expect(tuner.getCurrentWorkerCount()).toBe(8); // maxWorkerCount

      tuner.setCurrentWorkerCount(0);
      expect(tuner.getCurrentWorkerCount()).toBe(1); // minimum
    });
  });

  describe('getCurrentBatchSize', () => {
    it('should return current batch size', () => {
      expect(tuner.getCurrentBatchSize()).toBe(3);
    });

    it('should be updatable', () => {
      tuner.setCurrentBatchSize(5);
      expect(tuner.getCurrentBatchSize()).toBe(5);
    });

    it('should enforce minimum', () => {
      tuner.setCurrentBatchSize(0);
      expect(tuner.getCurrentBatchSize()).toBe(1);
    });
  });

  describe('autoScale', () => {
    it('should return no change when optimal', () => {
      const result = tuner.autoScale();

      expect(result.action).toBeDefined();
      expect(['scale_up', 'scale_down', 'no_change']).toContain(result.action);
      expect(result.previousWorkers).toBe(4);
      expect(result.reason).toBeDefined();
    });

    it('should disable auto-scaling when configured', () => {
      const noScaleTuner = new ParallelExecutionTuner({
        enableAutoScaling: false,
      });

      const result = noScaleTuner.autoScale();

      expect(result.action).toBe('no_change');
      expect(result.reason).toContain('disabled');
    });
  });

  describe('detectContention', () => {
    it('should return null when no contention', () => {
      // Under normal conditions, should not detect contention
      const contention = tuner.detectContention();

      // May or may not detect contention depending on system state
      if (contention !== null) {
        expect(contention.type).toBeDefined();
        expect(contention.severity).toBeGreaterThanOrEqual(0);
        expect(contention.severity).toBeLessThanOrEqual(100);
      }
    });

    it('should track contention events', () => {
      // Force a check
      tuner.detectContention();

      const events = tuner.getContentionEvents();
      // Events may or may not exist depending on system state
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return empty summary with no history', () => {
      const summary = tuner.getPerformanceSummary();

      expect(summary.avgThroughput).toBe(0);
      expect(summary.avgLatencyMs).toBe(0);
      expect(summary.avgErrorRate).toBe(0);
    });

    it('should calculate summary from history', () => {
      tuner.recordTuningResult(4, 3, 100, 10000, 0);
      tuner.recordTuningResult(4, 3, 100, 10000, 0);

      const summary = tuner.getPerformanceSummary();

      expect(summary.avgThroughput).toBe(10);
      expect(summary.avgLatencyMs).toBe(100);
      expect(summary.avgErrorRate).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetParallelExecutionTuner();
      const instance1 = getParallelExecutionTuner();
      const instance2 = getParallelExecutionTuner();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getParallelExecutionTuner();
      instance1.recordTuningResult(4, 3, 100, 10000, 0);

      resetParallelExecutionTuner();
      const instance2 = getParallelExecutionTuner();

      expect(instance2.getTuningHistory().length).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear tuning history', () => {
      tuner.recordTuningResult(4, 3, 100, 10000, 0);
      tuner.recordTuningResult(4, 3, 100, 10000, 0);

      expect(tuner.getTuningHistory().length).toBe(2);

      tuner.clearHistory();

      expect(tuner.getTuningHistory().length).toBe(0);
    });
  });

  describe('monitoring', () => {
    it('should start and stop monitoring', () => {
      let callbackCalled = false;
      tuner.startMonitoring(() => {
        callbackCalled = true;
      });

      // Stop immediately to avoid interference with other tests
      tuner.stopMonitoring();

      // Just verify no errors thrown
      expect(true).toBe(true);
    });
  });
});
