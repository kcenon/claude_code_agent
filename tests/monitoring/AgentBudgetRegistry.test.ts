import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentBudgetRegistry,
  getAgentBudgetRegistry,
  resetAgentBudgetRegistry,
  DEFAULT_CATEGORY_BUDGETS,
  DEFAULT_PIPELINE_BUDGET,
} from '../../src/monitoring/index.js';

describe('AgentBudgetRegistry', () => {
  let registry: AgentBudgetRegistry;

  beforeEach(() => {
    resetAgentBudgetRegistry();
    registry = new AgentBudgetRegistry();
  });

  afterEach(() => {
    resetAgentBudgetRegistry();
  });

  describe('agent budget creation', () => {
    it('should create a new budget manager for an agent', () => {
      const manager = registry.getAgentBudget('worker-1');
      expect(manager).toBeDefined();
      expect(registry.size).toBe(1);
    });

    it('should return existing manager for same agent', () => {
      const manager1 = registry.getAgentBudget('worker-1');
      const manager2 = registry.getAgentBudget('worker-1');
      expect(manager1).toBe(manager2);
      expect(registry.size).toBe(1);
    });

    it('should create separate managers for different agents', () => {
      const manager1 = registry.getAgentBudget('worker-1');
      const manager2 = registry.getAgentBudget('worker-2');
      expect(manager1).not.toBe(manager2);
      expect(registry.size).toBe(2);
    });

    it('should apply category defaults', () => {
      registry.getAgentBudget('prd-writer', { agentCategory: 'document' });
      const config = registry.getAgentConfig('prd-writer');
      expect(config?.agentCategory).toBe('document');
    });

    it('should apply custom token limits', () => {
      registry.getAgentBudget('worker-1', {
        agentTokenLimit: 50000,
        agentCostLimitUsd: 1.5,
      });
      const status = registry.getAgentBudget('worker-1').getStatus();
      expect(status.tokenLimit).toBe(50000);
      expect(status.costLimitUsd).toBe(1.5);
    });
  });

  describe('usage recording', () => {
    it('should record usage and update status', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 10000 });
      const status = registry.recordAgentUsage('worker-1', 100, 50, 0.01);

      expect(status.currentTokens).toBe(150);
      expect(status.currentCostUsd).toBe(0.01);
    });

    it('should accumulate usage across multiple records', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 10000 });
      registry.recordAgentUsage('worker-1', 100, 50, 0.01);
      const status = registry.recordAgentUsage('worker-1', 200, 100, 0.02);

      expect(status.currentTokens).toBe(450);
      expect(status.currentCostUsd).toBe(0.03);
    });

    it('should trigger budget exceeded callback', async () => {
      let callbackTriggered = false;
      registry.getAgentBudget('worker-1', {
        agentTokenLimit: 100,
        onBudgetExceeded: () => {
          callbackTriggered = true;
        },
      });

      registry.recordAgentUsage('worker-1', 80, 50, 0.01);
      expect(callbackTriggered).toBe(true);
    });
  });

  describe('pipeline status', () => {
    it('should aggregate tokens across all agents', () => {
      registry.getAgentBudget('worker-1');
      registry.getAgentBudget('worker-2');
      registry.recordAgentUsage('worker-1', 100, 50, 0.01);
      registry.recordAgentUsage('worker-2', 200, 100, 0.02);

      const status = registry.getPipelineStatus();
      expect(status.totalTokens).toBe(450);
      expect(status.totalCostUsd).toBe(0.03);
    });

    it('should track exceeded agents', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 100 });
      registry.getAgentBudget('worker-2', { agentTokenLimit: 1000 });
      registry.recordAgentUsage('worker-1', 80, 50, 0.01);
      registry.recordAgentUsage('worker-2', 50, 25, 0.005);

      const status = registry.getPipelineStatus();
      expect(status.exceededAgents).toContain('worker-1');
      expect(status.exceededAgents).not.toContain('worker-2');
    });

    it('should track warning agents', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 100 });
      registry.recordAgentUsage('worker-1', 70, 5, 0.005);

      const status = registry.getPipelineStatus();
      expect(status.warningAgents).toContain('worker-1');
    });

    it('should calculate usage percentages', () => {
      const customRegistry = new AgentBudgetRegistry({
        pipelineConfig: {
          maxTokens: 1000,
          maxCostUsd: 1.0,
        },
      });
      customRegistry.getAgentBudget('worker-1');
      customRegistry.recordAgentUsage('worker-1', 250, 250, 0.5);

      const status = customRegistry.getPipelineStatus();
      expect(status.tokenUsagePercent).toBe(50);
      expect(status.costUsagePercent).toBe(50);
    });
  });

  describe('budget checks', () => {
    it('should detect exceeded budgets', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 100 });
      registry.recordAgentUsage('worker-1', 80, 50, 0.01);

      expect(registry.hasExceededBudgets()).toBe(true);
    });

    it('should return false when no budgets exceeded', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
      registry.recordAgentUsage('worker-1', 50, 25, 0.005);

      expect(registry.hasExceededBudgets()).toBe(false);
    });

    it('should detect pipeline budget exceeded', () => {
      const customRegistry = new AgentBudgetRegistry({
        pipelineConfig: {
          maxTokens: 100,
          maxCostUsd: 0.01,
        },
      });
      customRegistry.getAgentBudget('worker-1');
      customRegistry.recordAgentUsage('worker-1', 80, 50, 0.02);

      expect(customRegistry.isPipelineBudgetExceeded()).toBe(true);
    });
  });

  describe('usage estimation', () => {
    it('should allow usage within budget', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
      const estimate = registry.estimateUsage('worker-1', 100, 100);
      expect(estimate.allowed).toBe(true);
    });

    it('should reject usage exceeding agent budget', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 100 });
      const estimate = registry.estimateUsage('worker-1', 100, 100);
      expect(estimate.allowed).toBe(false);
      expect(estimate.reason).toContain('worker-1');
    });

    it('should reject usage exceeding pipeline budget', () => {
      const customRegistry = new AgentBudgetRegistry({
        pipelineConfig: {
          maxTokens: 100,
        },
      });
      customRegistry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
      const estimate = customRegistry.estimateUsage('worker-1', 80, 80);
      expect(estimate.allowed).toBe(false);
      expect(estimate.reason).toContain('Pipeline');
    });
  });

  describe('reset operations', () => {
    it('should reset specific agent', () => {
      registry.getAgentBudget('worker-1');
      registry.recordAgentUsage('worker-1', 100, 50, 0.01);
      registry.resetAgent('worker-1');

      const status = registry.getAgentBudget('worker-1').getStatus();
      expect(status.currentTokens).toBe(0);
    });

    it('should reset all agents', () => {
      registry.getAgentBudget('worker-1');
      registry.getAgentBudget('worker-2');
      registry.recordAgentUsage('worker-1', 100, 50, 0.01);
      registry.recordAgentUsage('worker-2', 200, 100, 0.02);
      registry.resetAll();

      const status = registry.getPipelineStatus();
      expect(status.totalTokens).toBe(0);
    });

    it('should remove agent from registry', () => {
      registry.getAgentBudget('worker-1');
      expect(registry.size).toBe(1);
      registry.removeAgent('worker-1');
      expect(registry.size).toBe(0);
    });

    it('should clear all agents', () => {
      registry.getAgentBudget('worker-1');
      registry.getAgentBudget('worker-2');
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe('registered agents', () => {
    it('should return list of registered agents', () => {
      registry.getAgentBudget('worker-1');
      registry.getAgentBudget('prd-writer');
      registry.getAgentBudget('collector');

      const agents = registry.getRegisteredAgents();
      expect(agents).toContain('worker-1');
      expect(agents).toContain('prd-writer');
      expect(agents).toContain('collector');
      expect(agents.length).toBe(3);
    });
  });

  describe('summary report', () => {
    it('should generate readable summary', () => {
      registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
      registry.getAgentBudget('prd-writer', { agentTokenLimit: 500 });
      registry.recordAgentUsage('worker-1', 200, 100, 0.02);
      registry.recordAgentUsage('prd-writer', 100, 50, 0.01);

      const report = registry.getSummaryReport();
      expect(report).toContain('Pipeline Budget Status');
      expect(report).toContain('worker-1');
      expect(report).toContain('prd-writer');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getter', () => {
      const instance1 = getAgentBudgetRegistry();
      const instance2 = getAgentBudgetRegistry();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton on reset call', () => {
      const instance1 = getAgentBudgetRegistry();
      instance1.getAgentBudget('worker-1');
      resetAgentBudgetRegistry();
      const instance2 = getAgentBudgetRegistry();
      expect(instance1).not.toBe(instance2);
      expect(instance2.size).toBe(0);
    });
  });

  describe('default constants', () => {
    it('should have category budget defaults', () => {
      // Default model is Opus, tokens set to 150000
      expect(DEFAULT_CATEGORY_BUDGETS.document.maxTokens).toBe(150000);
      expect(DEFAULT_CATEGORY_BUDGETS.execution.maxTokens).toBe(150000);
      expect(DEFAULT_CATEGORY_BUDGETS.analysis.maxTokens).toBe(150000);
      expect(DEFAULT_CATEGORY_BUDGETS.infrastructure.maxTokens).toBe(50000);
    });

    it('should have pipeline budget defaults', () => {
      // Pipeline budget set high to allow multiple agents with 150000 tokens each
      expect(DEFAULT_PIPELINE_BUDGET.maxTokens).toBe(1500000);
      expect(DEFAULT_PIPELINE_BUDGET.maxCostUsd).toBe(50.0);
      expect(DEFAULT_PIPELINE_BUDGET.warningThreshold).toBe(0.8);
    });
  });

  describe('budget transfer', () => {
    describe('token budget transfer', () => {
      it('should transfer tokens between agents', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });

        const result = registry.transferTokenBudget('worker-1', 'worker-2', 200);

        expect(result.success).toBe(true);
        expect(result.tokensTransferred).toBe(200);
        expect(result.sourceNewLimit).toBe(800);
        expect(result.targetNewLimit).toBe(700);
      });

      it('should fail for non-existent source agent', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });

        const result = registry.transferTokenBudget('non-existent', 'worker-1', 100);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });

      it('should fail for non-existent target agent', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });

        const result = registry.transferTokenBudget('worker-1', 'non-existent', 100);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });

      it('should fail for same source and target', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });

        const result = registry.transferTokenBudget('worker-1', 'worker-1', 100);

        expect(result.success).toBe(false);
        expect(result.error).toContain('same agent');
      });

      it('should fail for negative amount', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });

        const result = registry.transferTokenBudget('worker-1', 'worker-2', -100);

        expect(result.success).toBe(false);
        expect(result.error).toContain('positive');
      });

      it('should fail when insufficient budget available', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });
        registry.recordAgentUsage('worker-1', 900, 50, 0.01);

        const result = registry.transferTokenBudget('worker-1', 'worker-2', 200);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient');
      });

      it('should fail when source has no token limit', () => {
        registry.getAgentBudget('worker-1');
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });

        const result = registry.transferTokenBudget('worker-1', 'worker-2', 100);

        expect(result.success).toBe(false);
        expect(result.error).toContain('no token limit');
      });

      it('should handle transfer to agent without limit', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
        registry.getAgentBudget('worker-2');

        const result = registry.transferTokenBudget('worker-1', 'worker-2', 200);

        expect(result.success).toBe(true);
        expect(result.targetNewLimit).toBe(200);
      });
    });

    describe('cost budget transfer', () => {
      it('should transfer cost between agents', () => {
        registry.getAgentBudget('worker-1', { agentCostLimitUsd: 1.0 });
        registry.getAgentBudget('worker-2', { agentCostLimitUsd: 0.5 });

        const result = registry.transferCostBudget('worker-1', 'worker-2', 0.3);

        expect(result.success).toBe(true);
        expect(result.costTransferred).toBe(0.3);
        expect(result.sourceNewLimit).toBe(0.7);
        expect(result.targetNewLimit).toBe(0.8);
      });

      it('should fail for non-existent agents', () => {
        registry.getAgentBudget('worker-1', { agentCostLimitUsd: 1.0 });

        const result = registry.transferCostBudget('worker-1', 'non-existent', 0.1);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });

      it('should fail when source has no cost limit', () => {
        registry.getAgentBudget('worker-1');
        registry.getAgentBudget('worker-2', { agentCostLimitUsd: 0.5 });

        const result = registry.transferCostBudget('worker-1', 'worker-2', 0.1);

        expect(result.success).toBe(false);
        expect(result.error).toContain('no cost limit');
      });
    });

    describe('transfer history', () => {
      it('should record successful transfers', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });

        registry.transferTokenBudget('worker-1', 'worker-2', 200);

        const history = registry.getTransferHistory();
        expect(history.length).toBe(1);
        expect(history[0]!.fromAgent).toBe('worker-1');
        expect(history[0]!.toAgent).toBe('worker-2');
        expect(history[0]!.tokens).toBe(200);
        expect(history[0]!.success).toBe(true);
      });

      it('should not record failed transfers', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 100 });
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });
        registry.recordAgentUsage('worker-1', 90, 5, 0.01);

        registry.transferTokenBudget('worker-1', 'worker-2', 200);

        const history = registry.getTransferHistory();
        expect(history.length).toBe(0);
      });

      it('should clear transfer history', () => {
        registry.getAgentBudget('worker-1', { agentTokenLimit: 1000 });
        registry.getAgentBudget('worker-2', { agentTokenLimit: 500 });

        registry.transferTokenBudget('worker-1', 'worker-2', 200);
        expect(registry.getTransferHistory().length).toBe(1);

        registry.clearTransferHistory();
        expect(registry.getTransferHistory().length).toBe(0);
      });

      it('should track multiple transfers', () => {
        registry.getAgentBudget('worker-1', {
          agentTokenLimit: 1000,
          agentCostLimitUsd: 1.0,
        });
        registry.getAgentBudget('worker-2', {
          agentTokenLimit: 500,
          agentCostLimitUsd: 0.5,
        });

        registry.transferTokenBudget('worker-1', 'worker-2', 100);
        registry.transferCostBudget('worker-1', 'worker-2', 0.2);

        const history = registry.getTransferHistory();
        expect(history.length).toBe(2);
        expect(history[0]!.tokens).toBe(100);
        expect(history[1]!.costUsd).toBe(0.2);
      });
    });
  });
});
