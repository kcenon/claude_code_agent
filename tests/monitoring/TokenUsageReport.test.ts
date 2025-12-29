import { describe, it, expect, beforeEach } from 'vitest';
import { TokenUsageReport, createTokenUsageReport } from '../../src/monitoring/index.js';
import type { TokenUsageMetrics, AgentMetrics, StageDuration } from '../../src/monitoring/index.js';

describe('TokenUsageReport', () => {
  let report: TokenUsageReport;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    report = createTokenUsageReport(sessionId, {
      includeRecommendations: true,
      includeTrends: true,
    });
  });

  const createMockTokenUsage = (): TokenUsageMetrics => ({
    sessionId,
    totalInputTokens: 5000,
    totalOutputTokens: 3000,
    byAgent: {
      collector: { input: 1000, output: 500 },
      'prd-writer': { input: 2000, output: 1500 },
      worker: { input: 2000, output: 1000 },
    },
    estimatedCostUsd: 0.069,
  });

  const createMockAgentMetrics = (): AgentMetrics[] => [
    {
      agent: 'collector',
      invocations: 2,
      successes: 2,
      failures: 0,
      avgDurationMs: 1000,
      p95DurationMs: 1200,
      inputTokens: 1000,
      outputTokens: 500,
    },
    {
      agent: 'prd-writer',
      invocations: 1,
      successes: 1,
      failures: 0,
      avgDurationMs: 5000,
      p95DurationMs: 5000,
      inputTokens: 2000,
      outputTokens: 1500,
    },
    {
      agent: 'worker',
      invocations: 3,
      successes: 3,
      failures: 0,
      avgDurationMs: 3000,
      p95DurationMs: 4000,
      inputTokens: 2000,
      outputTokens: 1000,
    },
  ];

  const createMockStageDurations = (): StageDuration[] => [
    {
      stage: 'collect',
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-01T00:01:00Z',
      durationMs: 60000,
      status: 'completed',
    },
    {
      stage: 'prd',
      startTime: '2024-01-01T00:01:00Z',
      endTime: '2024-01-01T00:03:00Z',
      durationMs: 120000,
      status: 'completed',
    },
  ];

  describe('generate', () => {
    it('should generate a complete report', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.summary.sessionId).toBe(sessionId);
      expect(result.summary.totalTokens).toBe(8000);
      expect(result.summary.totalCostUsd).toBe(0.069);
    });

    it('should include usage by agent', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.byAgent.length).toBe(3);
      expect(result.byAgent[0]?.agent).toBeDefined();
    });

    it('should sort agents by token usage', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      // First should be the highest usage
      const firstAgentTokens = result.byAgent[0]?.totalTokens ?? 0;
      const secondAgentTokens = result.byAgent[1]?.totalTokens ?? 0;
      expect(firstAgentTokens).toBeGreaterThanOrEqual(secondAgentTokens);
    });

    it('should include usage by model', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations(),
        'sonnet'
      );

      expect(result.byModel.length).toBe(1);
      expect(result.byModel[0]?.model).toBe('sonnet');
    });

    it('should include stage usage', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.byStage.length).toBe(2);
    });
  });

  describe('recommendations', () => {
    it('should generate optimization recommendations', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should recommend caching for multiple invocations', () => {
      const metricsWithManyInvocations = createMockAgentMetrics().map((m) => ({
        ...m,
        invocations: 10,
      }));

      const result = report.generate(
        createMockTokenUsage(),
        metricsWithManyInvocations,
        createMockStageDurations()
      );

      const cachingRec = result.recommendations.find((r) => r.type === 'caching');
      expect(cachingRec).toBeDefined();
    });

    it('should recommend pruning for large context', () => {
      const largeContextUsage: TokenUsageMetrics = {
        ...createMockTokenUsage(),
        totalInputTokens: 100000,
      };

      const result = report.generate(
        largeContextUsage,
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      const pruningRec = result.recommendations.find((r) => r.type === 'pruning');
      expect(pruningRec).toBeDefined();
    });

    it('should sort recommendations by priority', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      if (result.recommendations.length >= 2) {
        const priorities = result.recommendations.map((r) => r.priority);
        for (let i = 1; i < priorities.length; i++) {
          expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]!);
        }
      }
    });
  });

  describe('trends', () => {
    it('should record trend points', () => {
      report.recordTrendPoint(100, 0.01);
      report.recordTrendPoint(200, 0.02);

      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.trends.length).toBe(2);
    });

    it('should calculate cumulative values', () => {
      report.recordTrendPoint(100, 0.01);
      report.recordTrendPoint(200, 0.02);

      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.trends[1]?.cumulativeTokens).toBe(300);
      expect(result.trends[1]?.cumulativeCostUsd).toBe(0.03);
    });
  });

  describe('toJSON', () => {
    it('should export report as JSON string', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      const json = report.toJSON(result);

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('toMarkdown', () => {
    it('should export report as Markdown', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      const markdown = report.toMarkdown(result);

      expect(markdown).toContain('# Token Usage Report');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Usage by Agent');
      expect(markdown).toContain('## Usage by Model');
    });

    it('should include recommendations in Markdown', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      const markdown = report.toMarkdown(result);

      if (result.recommendations.length > 0) {
        expect(markdown).toContain('## Optimization Recommendations');
      }
    });
  });

  describe('summary', () => {
    it('should identify most expensive agent', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.summary.mostExpensiveAgent).toBe('prd-writer');
    });

    it('should calculate tokens per minute', () => {
      const result = report.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.summary.tokensPerMinute).toBeGreaterThan(0);
    });
  });

  describe('createTokenUsageReport', () => {
    it('should create a new report instance', () => {
      const newReport = createTokenUsageReport('new-session');

      expect(newReport).toBeInstanceOf(TokenUsageReport);
    });

    it('should accept config options', () => {
      const newReport = createTokenUsageReport('new-session', {
        includeRecommendations: false,
      });

      const result = newReport.generate(
        createMockTokenUsage(),
        createMockAgentMetrics(),
        createMockStageDurations()
      );

      expect(result.recommendations.length).toBe(0);
    });
  });
});
