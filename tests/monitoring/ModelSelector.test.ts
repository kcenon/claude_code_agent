import { describe, it, expect, beforeEach } from 'vitest';
import { ModelSelector, getModelSelector, resetModelSelector } from '../../src/monitoring/index.js';
import type { TaskAnalysis } from '../../src/monitoring/index.js';

describe('ModelSelector', () => {
  let selector: ModelSelector;

  beforeEach(() => {
    resetModelSelector();
    selector = new ModelSelector({
      defaultModel: 'sonnet',
      costSensitivity: 0.5,
      qualitySensitivity: 0.5,
    });
  });

  describe('selectModel', () => {
    it('should select haiku for simple tasks', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 100,
        estimatedOutputTokens: 100,
        complexity: 'simple',
      };

      const result = selector.selectModel(task);

      expect(result.model).toBe('haiku');
    });

    it('should select sonnet for moderate tasks', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        complexity: 'moderate',
      };

      const result = selector.selectModel(task);

      expect(['sonnet', 'haiku']).toContain(result.model);
    });

    it('should select opus for critical tasks', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 5000,
        estimatedOutputTokens: 2000,
        complexity: 'critical',
        accuracyCritical: true,
      };

      const result = selector.selectModel(task);

      expect(result.model).toBe('opus');
    });

    it('should respect agent overrides', () => {
      const selectorWithOverrides = new ModelSelector({
        agentOverrides: {
          validator: 'haiku',
        },
      });

      const task: TaskAnalysis = {
        estimatedInputTokens: 5000,
        estimatedOutputTokens: 2000,
        complexity: 'complex',
        agent: 'validator',
      };

      const result = selectorWithOverrides.selectModel(task);

      expect(result.model).toBe('haiku');
      expect(result.reason).toContain('Agent-specific');
    });

    it('should respect task type overrides', () => {
      const selectorWithOverrides = new ModelSelector({
        taskOverrides: {
          formatting: 'haiku',
        },
      });

      const task: TaskAnalysis = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        complexity: 'moderate',
        taskType: 'formatting',
      };

      const result = selectorWithOverrides.selectModel(task);

      expect(result.model).toBe('haiku');
      expect(result.reason).toContain('Task-type');
    });

    it('should consider budget constraints', () => {
      const budgetSelector = new ModelSelector({
        budgetConstraintUsd: 0.001,
      });

      const task: TaskAnalysis = {
        estimatedInputTokens: 10000,
        estimatedOutputTokens: 5000,
        complexity: 'critical',
      };

      const result = budgetSelector.selectModel(task);

      // Should select cheaper model due to budget
      expect(['haiku', 'sonnet']).toContain(result.model);
    });

    it('should include alternatives in result', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        complexity: 'moderate',
      };

      const result = selector.selectModel(task);

      expect(result.alternatives.length).toBe(2);
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost for haiku', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 1000,
        complexity: 'simple',
      };

      const cost = selector.estimateCost('haiku', task);

      // haiku: input=0.00025/1k, output=0.00125/1k
      // cost = (1000/1000)*0.00025 + (1000/1000)*0.00125 = 0.0015
      expect(cost).toBeCloseTo(0.0015, 4);
    });

    it('should calculate cost for sonnet', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 1000,
        complexity: 'moderate',
      };

      const cost = selector.estimateCost('sonnet', task);

      // sonnet: input=0.003/1k, output=0.015/1k
      // cost = (1000/1000)*0.003 + (1000/1000)*0.015 = 0.018
      expect(cost).toBeCloseTo(0.018, 4);
    });

    it('should calculate cost for opus', () => {
      const task: TaskAnalysis = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 1000,
        complexity: 'complex',
      };

      const cost = selector.estimateCost('opus', task);

      // opus: input=0.015/1k, output=0.075/1k
      // cost = (1000/1000)*0.015 + (1000/1000)*0.075 = 0.09
      expect(cost).toBeCloseTo(0.09, 4);
    });
  });

  describe('analyzeComplexity', () => {
    it('should classify short text as simple', () => {
      const complexity = selector.analyzeComplexity('Short text');

      expect(complexity).toBe('simple');
    });

    it('should classify text with code as more complex', () => {
      const complexity = selector.analyzeComplexity('```javascript\nconst x = 1;\n```');

      expect(['simple', 'moderate']).toContain(complexity);
    });

    it('should classify long text as more complex', () => {
      const longText = 'a'.repeat(6000);
      const complexity = selector.analyzeComplexity(longText);

      expect(['moderate', 'complex']).toContain(complexity);
    });

    it('should consider options for complexity', () => {
      const complexity = selector.analyzeComplexity('Test text', {
        hasCodeGeneration: true,
        hasReasoning: true,
        requiresAccuracy: true,
      });

      expect(['complex', 'critical']).toContain(complexity);
    });
  });

  describe('getAgentRecommendation', () => {
    it('should return haiku for validator', () => {
      expect(selector.getAgentRecommendation('validator')).toBe('haiku');
    });

    it('should return sonnet for prd-writer', () => {
      expect(selector.getAgentRecommendation('prd-writer')).toBe('sonnet');
    });

    it('should return opus for sds-writer', () => {
      expect(selector.getAgentRecommendation('sds-writer')).toBe('opus');
    });

    it('should return default for unknown agent', () => {
      expect(selector.getAgentRecommendation('unknown')).toBe('sonnet');
    });
  });

  describe('getModelProfile', () => {
    it('should return profile for haiku', () => {
      const profile = selector.getModelProfile('haiku');

      expect(profile.name).toBe('haiku');
      expect(profile.capabilityScore).toBe(0.6);
    });

    it('should return profile for sonnet', () => {
      const profile = selector.getModelProfile('sonnet');

      expect(profile.name).toBe('sonnet');
      expect(profile.capabilityScore).toBe(0.85);
    });

    it('should return profile for opus', () => {
      const profile = selector.getModelProfile('opus');

      expect(profile.name).toBe('opus');
      expect(profile.capabilityScore).toBe(1.0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetModelSelector();
      const instance1 = getModelSelector({ defaultModel: 'sonnet' });
      const instance2 = getModelSelector();

      expect(instance1).toBe(instance2);
    });
  });
});
