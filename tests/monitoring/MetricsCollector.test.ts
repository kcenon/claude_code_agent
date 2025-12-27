import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector,
} from '../../src/monitoring/index.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let testMetricsDir: string;

  beforeEach(() => {
    testMetricsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
    resetMetricsCollector();
    collector = new MetricsCollector({ metricsDir: testMetricsDir, flushIntervalMs: 60000 });
  });

  afterEach(() => {
    collector.stopFlushTimer();
    resetMetricsCollector();
    if (fs.existsSync(testMetricsDir)) {
      fs.rmSync(testMetricsDir, { recursive: true, force: true });
    }
  });

  describe('agent metrics', () => {
    it('should record agent invocation', () => {
      const startTime = collector.recordAgentStart('worker-1');
      collector.recordAgentEnd('worker-1', startTime, true);

      const metrics = collector.getAgentMetrics('worker-1');
      expect(metrics).not.toBeNull();
      expect(metrics?.agent).toBe('worker-1');
      expect(metrics?.invocations).toBe(1);
      expect(metrics?.successes).toBe(1);
      expect(metrics?.failures).toBe(0);
    });

    it('should record failed invocations', () => {
      const startTime = collector.recordAgentStart('worker-1');
      collector.recordAgentEnd('worker-1', startTime, false);

      const metrics = collector.getAgentMetrics('worker-1');
      expect(metrics?.failures).toBe(1);
      expect(metrics?.successes).toBe(0);
    });

    it('should calculate average duration', () => {
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now() - 100; // 100ms ago
        collector.recordAgentEnd('worker-1', startTime, true);
      }

      const metrics = collector.getAgentMetrics('worker-1');
      expect(metrics?.avgDurationMs).toBeGreaterThan(0);
    });

    it('should calculate P95 duration', () => {
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now() - (i * 10); // varying durations
        collector.recordAgentEnd('worker-1', startTime, true);
      }

      const metrics = collector.getAgentMetrics('worker-1');
      expect(metrics?.p95DurationMs).toBeGreaterThan(0);
    });

    it('should return null for unknown agent', () => {
      const metrics = collector.getAgentMetrics('unknown');
      expect(metrics).toBeNull();
    });

    it('should get all agent metrics', () => {
      collector.recordAgentEnd('worker-1', Date.now() - 100, true);
      collector.recordAgentEnd('worker-2', Date.now() - 200, true);

      const allMetrics = collector.getAllAgentMetrics();
      expect(allMetrics).toHaveLength(2);
    });
  });

  describe('token usage', () => {
    it('should record token usage', () => {
      collector.setSessionId('test-session');
      collector.recordTokenUsage('worker-1', 100, 50);

      const usage = collector.getTokenUsageMetrics();
      expect(usage.totalInputTokens).toBe(100);
      expect(usage.totalOutputTokens).toBe(50);
      expect(usage.byAgent['worker-1']).toEqual({ input: 100, output: 50 });
    });

    it('should accumulate token usage', () => {
      collector.recordTokenUsage('worker-1', 100, 50);
      collector.recordTokenUsage('worker-1', 200, 100);

      const usage = collector.getTokenUsageMetrics();
      expect(usage.totalInputTokens).toBe(300);
      expect(usage.totalOutputTokens).toBe(150);
    });

    it('should calculate cost estimate', () => {
      collector.setModel('sonnet');
      collector.recordTokenUsage('worker-1', 1000, 1000);

      const usage = collector.getTokenUsageMetrics();
      expect(usage.estimatedCostUsd).toBeGreaterThan(0);
    });

    it('should track usage by agent', () => {
      collector.recordTokenUsage('worker-1', 100, 50);
      collector.recordTokenUsage('worker-2', 200, 100);

      const usage = collector.getTokenUsageMetrics();
      expect(usage.byAgent['worker-1']).toEqual({ input: 100, output: 50 });
      expect(usage.byAgent['worker-2']).toEqual({ input: 200, output: 100 });
    });
  });

  describe('pipeline stages', () => {
    it('should record stage start', () => {
      collector.recordStageStart('implementation');

      const stages = collector.getStageDurations();
      expect(stages).toHaveLength(1);
      expect(stages[0]?.stage).toBe('implementation');
      expect(stages[0]?.status).toBe('in_progress');
    });

    it('should record stage completion', () => {
      collector.recordStageStart('implementation');
      collector.recordStageEnd('implementation', true);

      const stages = collector.getStageDurations();
      expect(stages[0]?.status).toBe('completed');
      expect(stages[0]?.durationMs).toBeDefined();
    });

    it('should record stage failure', () => {
      collector.recordStageStart('implementation');
      collector.recordStageEnd('implementation', false);

      const stages = collector.getStageDurations();
      expect(stages[0]?.status).toBe('failed');
    });
  });

  describe('counters', () => {
    it('should increment counter', () => {
      collector.incrementCounter('test_counter', 1);
      collector.incrementCounter('test_counter', 2);

      expect(collector.getCounter('test_counter')).toBe(3);
    });

    it('should increment counter with labels', () => {
      collector.incrementCounter('test_counter', 1, { status: 'success' });
      collector.incrementCounter('test_counter', 1, { status: 'failure' });

      expect(collector.getCounter('test_counter', { status: 'success' })).toBe(1);
      expect(collector.getCounter('test_counter', { status: 'failure' })).toBe(1);
    });

    it('should return 0 for unknown counter', () => {
      expect(collector.getCounter('unknown')).toBe(0);
    });
  });

  describe('gauges', () => {
    it('should set gauge value', () => {
      collector.setGauge('test_gauge', 42);
      expect(collector.getGauge('test_gauge')).toBe(42);
    });

    it('should overwrite gauge value', () => {
      collector.setGauge('test_gauge', 42);
      collector.setGauge('test_gauge', 100);
      expect(collector.getGauge('test_gauge')).toBe(100);
    });

    it('should set gauge with labels', () => {
      collector.setGauge('test_gauge', 42, { agent: 'worker-1' });
      expect(collector.getGauge('test_gauge', { agent: 'worker-1' })).toBe(42);
    });
  });

  describe('histograms', () => {
    it('should record histogram observation', () => {
      collector.recordHistogram('response_time', 1.5);
      collector.recordHistogram('response_time', 2.5);

      const histogram = collector.getHistogram('response_time');
      expect(histogram).not.toBeNull();
      expect(histogram?.count).toBe(2);
      expect(histogram?.sum).toBe(4);
    });

    it('should record histogram with labels', () => {
      collector.recordHistogram('response_time', 1.5, { agent: 'worker-1' });

      const histogram = collector.getHistogram('response_time', { agent: 'worker-1' });
      expect(histogram?.count).toBe(1);
    });

    it('should calculate bucket counts', () => {
      const buckets = [1, 5, 10];
      collector.recordHistogram('duration', 0.5, undefined, buckets);
      collector.recordHistogram('duration', 3, undefined, buckets);
      collector.recordHistogram('duration', 7, undefined, buckets);
      collector.recordHistogram('duration', 15, undefined, buckets);

      const histogram = collector.getHistogram('duration');
      expect(histogram?.buckets['1']).toBe(1);
      expect(histogram?.buckets['5']).toBe(2);
      expect(histogram?.buckets['10']).toBe(3);
      expect(histogram?.buckets['+Inf']).toBe(4);
    });
  });

  describe('getAllMetrics', () => {
    it('should return all metric values', () => {
      collector.incrementCounter('counter1', 1);
      collector.setGauge('gauge1', 42);

      const metrics = collector.getAllMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('flush', () => {
    it('should write metrics to file', () => {
      collector.incrementCounter('test', 1);
      collector.flush();

      const files = fs.readdirSync(testMetricsDir);
      expect(files.some((f) => f.startsWith('metrics-'))).toBe(true);
    });
  });

  describe('Prometheus export', () => {
    it('should export metrics in Prometheus format', () => {
      collector.incrementCounter('test_counter', 5, { status: 'success' });
      collector.setGauge('test_gauge', 42);

      const output = collector.exportPrometheus();
      expect(output).toContain('test_counter');
      expect(output).toContain('test_gauge');
    });

    it('should include histogram buckets', () => {
      collector.recordHistogram('test_histogram', 1.5, { agent: 'worker-1' });

      const output = collector.exportPrometheus();
      expect(output).toContain('test_histogram_bucket');
      expect(output).toContain('test_histogram_sum');
      expect(output).toContain('test_histogram_count');
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      collector.incrementCounter('test', 1);
      collector.recordAgentEnd('worker-1', Date.now() - 100, true);

      collector.reset();

      expect(collector.getCounter('test')).toBe(0);
      expect(collector.getAgentMetrics('worker-1')).toBeNull();
    });
  });

  describe('session and model', () => {
    it('should set and get session ID', () => {
      collector.setSessionId('session-123');
      expect(collector.getSessionId()).toBe('session-123');
    });

    it('should set model for cost calculation', () => {
      collector.setModel('opus');
      collector.recordTokenUsage('worker-1', 1000, 1000);

      const usage = collector.getTokenUsageMetrics();
      // Opus is more expensive than Sonnet
      expect(usage.estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetMetricsCollector();
      const instance1 = getMetricsCollector({ flushIntervalMs: 60000 });
      const instance2 = getMetricsCollector();

      expect(instance1).toBe(instance2);
      instance1.stopFlushTimer();
    });
  });

  describe('getMetricsDir', () => {
    it('should return metrics directory', () => {
      expect(collector.getMetricsDir()).toBe(testMetricsDir);
    });
  });
});
