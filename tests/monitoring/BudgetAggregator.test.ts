import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BudgetAggregator,
  getBudgetAggregator,
  resetBudgetAggregator,
  AgentBudgetRegistry,
  type PipelineBudgetStatus,
  type BudgetStatus,
} from '../../src/monitoring/index.js';

describe('BudgetAggregator', () => {
  let aggregator: BudgetAggregator;
  let registry: AgentBudgetRegistry;

  beforeEach(() => {
    resetBudgetAggregator();
    aggregator = new BudgetAggregator();
    registry = new AgentBudgetRegistry();
  });

  afterEach(() => {
    resetBudgetAggregator();
  });

  function createMockPipelineStatus(
    overrides: Partial<PipelineBudgetStatus> = {}
  ): PipelineBudgetStatus {
    const byAgent = new Map<string, BudgetStatus>();
    byAgent.set('worker-1', {
      currentTokens: 1000,
      currentCostUsd: 0.1,
      tokenUsagePercent: 50,
      costUsagePercent: 50,
      warningExceeded: false,
      limitExceeded: false,
      activeWarnings: [],
      tokenLimit: 2000,
      costLimitUsd: 0.2,
    });
    byAgent.set('prd-writer', {
      currentTokens: 500,
      currentCostUsd: 0.05,
      tokenUsagePercent: 25,
      costUsagePercent: 25,
      warningExceeded: false,
      limitExceeded: false,
      activeWarnings: [],
      tokenLimit: 2000,
      costLimitUsd: 0.2,
    });

    return {
      totalTokens: 1500,
      totalCostUsd: 0.15,
      totalTokenLimit: 10000,
      totalCostLimitUsd: 1.0,
      tokenUsagePercent: 15,
      costUsagePercent: 15,
      byAgent,
      exceededAgents: [],
      warningAgents: [],
      warningExceeded: false,
      limitExceeded: false,
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('category mappings', () => {
    it('should register agent category', () => {
      aggregator.registerAgentCategory('worker-1', 'execution');
      aggregator.registerAgentCategory('prd-writer', 'document');

      const status = createMockPipelineStatus();
      const summaries = aggregator.generateAgentSummaries(status);

      const worker = summaries.find((s) => s.agentName === 'worker-1');
      const prdWriter = summaries.find((s) => s.agentName === 'prd-writer');

      expect(worker?.category).toBe('execution');
      expect(prdWriter?.category).toBe('document');
    });

    it('should register multiple mappings at once', () => {
      aggregator.registerCategoryMappings([
        { agentName: 'worker-1', category: 'execution' },
        { agentName: 'prd-writer', category: 'document' },
        { agentName: 'collector', category: 'document' },
      ]);

      const status = createMockPipelineStatus();
      const summaries = aggregator.generateAgentSummaries(status);

      expect(summaries.find((s) => s.agentName === 'worker-1')?.category).toBe('execution');
      expect(summaries.find((s) => s.agentName === 'prd-writer')?.category).toBe('document');
    });
  });

  describe('usage trends', () => {
    it('should record trend points', () => {
      const status = createMockPipelineStatus();
      aggregator.recordTrendPoint(status);

      const trends = aggregator.getUsageTrends();
      expect(trends.length).toBe(1);
      expect(trends[0]!.totalTokens).toBe(1500);
      expect(trends[0]!.totalCostUsd).toBe(0.15);
    });

    it('should accumulate multiple trend points', () => {
      for (let i = 0; i < 5; i++) {
        const status = createMockPipelineStatus({
          totalTokens: (i + 1) * 1000,
          totalCostUsd: (i + 1) * 0.1,
        });
        aggregator.recordTrendPoint(status);
      }

      const trends = aggregator.getUsageTrends();
      expect(trends.length).toBe(5);
      expect(trends[4]!.totalTokens).toBe(5000);
    });

    it('should limit trend points to max', () => {
      const smallAggregator = new BudgetAggregator({ maxTrendPoints: 3 });

      for (let i = 0; i < 5; i++) {
        const status = createMockPipelineStatus({
          totalTokens: (i + 1) * 1000,
        });
        smallAggregator.recordTrendPoint(status);
      }

      const trends = smallAggregator.getUsageTrends();
      expect(trends.length).toBe(3);
      expect(trends[0]!.totalTokens).toBe(3000);
    });

    it('should clear trends', () => {
      aggregator.recordTrendPoint(createMockPipelineStatus());
      aggregator.clearTrends();

      expect(aggregator.getUsageTrends().length).toBe(0);
    });
  });

  describe('agent summaries', () => {
    it('should generate summaries sorted by cost', () => {
      const byAgent = new Map<string, BudgetStatus>();
      byAgent.set('worker-1', {
        currentTokens: 1000,
        currentCostUsd: 0.5,
        tokenUsagePercent: 50,
        costUsagePercent: 50,
        warningExceeded: false,
        limitExceeded: false,
        activeWarnings: [],
      });
      byAgent.set('prd-writer', {
        currentTokens: 500,
        currentCostUsd: 0.1,
        tokenUsagePercent: 25,
        costUsagePercent: 25,
        warningExceeded: false,
        limitExceeded: false,
        activeWarnings: [],
      });

      const status = createMockPipelineStatus({
        totalTokens: 1500,
        totalCostUsd: 0.6,
        byAgent,
      });

      const summaries = aggregator.generateAgentSummaries(status);
      expect(summaries[0]!.agentName).toBe('worker-1');
      expect(summaries[0]!.totalCostUsd).toBe(0.5);
    });

    it('should calculate share percentages', () => {
      const status = createMockPipelineStatus();
      const summaries = aggregator.generateAgentSummaries(status);

      const worker = summaries.find((s) => s.agentName === 'worker-1');
      expect(worker?.tokenSharePercent).toBeCloseTo(66.67, 1);
      expect(worker?.costSharePercent).toBeCloseTo(66.67, 1);
    });

    it('should track budget exceeded status', () => {
      const byAgent = new Map<string, BudgetStatus>();
      byAgent.set('worker-1', {
        currentTokens: 1000,
        currentCostUsd: 0.5,
        tokenUsagePercent: 110,
        costUsagePercent: 110,
        warningExceeded: true,
        limitExceeded: true,
        activeWarnings: [],
      });

      const status = createMockPipelineStatus({ byAgent });
      const summaries = aggregator.generateAgentSummaries(status);

      expect(summaries[0]!.budgetExceeded).toBe(true);
    });
  });

  describe('category summaries', () => {
    it('should aggregate by category', () => {
      aggregator.registerCategoryMappings([
        { agentName: 'worker-1', category: 'execution' },
        { agentName: 'prd-writer', category: 'document' },
      ]);

      const status = createMockPipelineStatus();
      const categorySummaries = aggregator.generateCategorySummaries(status);

      expect(categorySummaries.length).toBe(2);
      const execution = categorySummaries.find((c) => c.category === 'execution');
      expect(execution?.totalTokens).toBe(1000);
      expect(execution?.agentCount).toBe(1);
    });

    it('should combine multiple agents in same category', () => {
      aggregator.registerCategoryMappings([
        { agentName: 'worker-1', category: 'document' },
        { agentName: 'prd-writer', category: 'document' },
      ]);

      const status = createMockPipelineStatus();
      const categorySummaries = aggregator.generateCategorySummaries(status);

      expect(categorySummaries.length).toBe(1);
      const document = categorySummaries[0]!;
      expect(document.totalTokens).toBe(1500);
      expect(document.agentCount).toBe(2);
    });
  });

  describe('optimization suggestions', () => {
    it('should suggest increase for high utilization', () => {
      const byAgent = new Map<string, BudgetStatus>();
      byAgent.set('worker-1', {
        currentTokens: 950,
        currentCostUsd: 0.5,
        tokenUsagePercent: 95,
        costUsagePercent: 95,
        warningExceeded: true,
        limitExceeded: false,
        activeWarnings: [],
        tokenLimit: 1000,
        costLimitUsd: 0.52,
      });

      const status = createMockPipelineStatus({
        byAgent,
        totalTokens: 950,
        totalCostUsd: 0.5,
      });

      const agentSummaries = aggregator.generateAgentSummaries(status);
      const suggestions = aggregator.generateSuggestions(status, agentSummaries);

      const increaseSuggestion = suggestions.find((s) => s.type === 'increase');
      expect(increaseSuggestion).toBeDefined();
      expect(increaseSuggestion?.target).toBe('worker-1');
    });

    it('should suggest decrease for low utilization', () => {
      const byAgent = new Map<string, BudgetStatus>();
      byAgent.set('worker-1', {
        currentTokens: 100,
        currentCostUsd: 0.01,
        tokenUsagePercent: 10,
        costUsagePercent: 10,
        warningExceeded: false,
        limitExceeded: false,
        activeWarnings: [],
        tokenLimit: 1000,
        costLimitUsd: 0.1,
      });

      const status = createMockPipelineStatus({
        byAgent,
        totalTokens: 100,
        totalCostUsd: 0.01,
      });

      const agentSummaries = aggregator.generateAgentSummaries(status);
      const suggestions = aggregator.generateSuggestions(status, agentSummaries);

      const decreaseSuggestion = suggestions.find((s) => s.type === 'decrease');
      expect(decreaseSuggestion).toBeDefined();
      expect(decreaseSuggestion?.target).toBe('worker-1');
    });

    it('should warn for exceeded budgets', () => {
      const byAgent = new Map<string, BudgetStatus>();
      byAgent.set('worker-1', {
        currentTokens: 1100,
        currentCostUsd: 0.55,
        tokenUsagePercent: 110,
        costUsagePercent: 110,
        warningExceeded: true,
        limitExceeded: true,
        activeWarnings: [],
        tokenLimit: 1000,
      });

      const status = createMockPipelineStatus({
        byAgent,
        exceededAgents: ['worker-1'],
      });

      const agentSummaries = aggregator.generateAgentSummaries(status);
      const suggestions = aggregator.generateSuggestions(status, agentSummaries);

      const warningSuggestion = suggestions.find((s) => s.type === 'warning');
      expect(warningSuggestion).toBeDefined();
      expect(warningSuggestion?.message).toContain('exceeded');
    });

    it('should suggest rebalance for dominant agent', () => {
      const byAgent = new Map<string, BudgetStatus>();
      byAgent.set('worker-1', {
        currentTokens: 9000,
        currentCostUsd: 0.9,
        tokenUsagePercent: 90,
        costUsagePercent: 90,
        warningExceeded: true,
        limitExceeded: false,
        activeWarnings: [],
        tokenLimit: 10000,
      });
      byAgent.set('prd-writer', {
        currentTokens: 500,
        currentCostUsd: 0.05,
        tokenUsagePercent: 5,
        costUsagePercent: 5,
        warningExceeded: false,
        limitExceeded: false,
        activeWarnings: [],
      });

      const status = createMockPipelineStatus({
        byAgent,
        totalTokens: 9500,
        totalCostUsd: 0.95,
      });

      const agentSummaries = aggregator.generateAgentSummaries(status);
      const suggestions = aggregator.generateSuggestions(status, agentSummaries);

      const rebalanceSuggestion = suggestions.find((s) => s.type === 'rebalance');
      expect(rebalanceSuggestion).toBeDefined();
      expect(rebalanceSuggestion?.target).toBe('worker-1');
    });
  });

  describe('budget report', () => {
    it('should generate comprehensive report', () => {
      aggregator.registerCategoryMappings([
        { agentName: 'worker-1', category: 'execution' },
        { agentName: 'prd-writer', category: 'document' },
      ]);

      const status = createMockPipelineStatus();
      const report = aggregator.generateReport(status);

      expect(report.generatedAt).toBeDefined();
      expect(report.pipelineStatus).toBe(status);
      expect(report.agentSummaries.length).toBe(2);
      expect(report.categorySummaries.length).toBe(2);
      expect(report.topConsumers.length).toBeLessThanOrEqual(5);
    });

    it('should limit top consumers to 5', () => {
      const byAgent = new Map<string, BudgetStatus>();
      for (let i = 0; i < 10; i++) {
        byAgent.set(`agent-${i}`, {
          currentTokens: (10 - i) * 100,
          currentCostUsd: (10 - i) * 0.01,
          tokenUsagePercent: 50,
          costUsagePercent: 50,
          warningExceeded: false,
          limitExceeded: false,
          activeWarnings: [],
        });
      }

      const status = createMockPipelineStatus({ byAgent, totalTokens: 5500, totalCostUsd: 0.55 });
      const report = aggregator.generateReport(status);

      expect(report.topConsumers.length).toBe(5);
      expect(report.topConsumers[0]!.agentName).toBe('agent-0');
    });
  });

  describe('formatted report', () => {
    it('should format report as readable string', () => {
      aggregator.registerCategoryMappings([
        { agentName: 'worker-1', category: 'execution' },
        { agentName: 'prd-writer', category: 'document' },
      ]);

      const status = createMockPipelineStatus();
      const report = aggregator.generateReport(status);
      const formatted = aggregator.formatReportAsString(report);

      expect(formatted).toContain('PIPELINE BUDGET REPORT');
      expect(formatted).toContain('Pipeline Summary');
      expect(formatted).toContain('Top Consumers');
      expect(formatted).toContain('By Category');
      expect(formatted).toContain('worker-1');
    });

    it('should show exceeded status in report', () => {
      const status = createMockPipelineStatus({
        limitExceeded: true,
        exceededAgents: ['worker-1'],
      });

      const report = aggregator.generateReport(status);
      const formatted = aggregator.formatReportAsString(report);

      expect(formatted).toContain('EXCEEDED');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getter', () => {
      const instance1 = getBudgetAggregator();
      const instance2 = getBudgetAggregator();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton on reset call', () => {
      const instance1 = getBudgetAggregator();
      instance1.recordTrendPoint(createMockPipelineStatus());
      resetBudgetAggregator();
      const instance2 = getBudgetAggregator();
      expect(instance1).not.toBe(instance2);
      expect(instance2.getUsageTrends().length).toBe(0);
    });
  });
});
