import { describe, it, expect, beforeEach } from 'vitest';
import {
  TokenBudgetManager,
  getTokenBudgetManager,
  resetTokenBudgetManager,
} from '../../src/monitoring/index.js';

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    resetTokenBudgetManager();
    manager = new TokenBudgetManager({
      sessionTokenLimit: 10000,
      sessionCostLimitUsd: 1.0,
      warningThresholds: [50, 75, 90],
    });
  });

  describe('recordUsage', () => {
    it('should record token usage', () => {
      const result = manager.recordUsage(100, 50, 0.001);
      expect(result.allowed).toBe(true);

      const status = manager.getStatus();
      expect(status.currentTokens).toBe(150);
    });

    it('should accumulate usage across multiple calls', () => {
      manager.recordUsage(100, 50, 0.001);
      manager.recordUsage(200, 100, 0.002);

      const status = manager.getStatus();
      expect(status.currentTokens).toBe(450);
      expect(status.currentCostUsd).toBe(0.003);
    });
  });

  describe('warning thresholds', () => {
    it('should trigger warning at 50% threshold', () => {
      const result = manager.recordUsage(2500, 2500, 0.5);

      // Both token (50%) and cost (50%) warnings are triggered
      expect(result.warnings.length).toBe(2);
      const tokenWarning = result.warnings.find((w) => w.type === 'token');
      const costWarning = result.warnings.find((w) => w.type === 'cost');
      expect(tokenWarning?.thresholdPercent).toBe(50);
      expect(tokenWarning?.severity).toBe('info');
      expect(costWarning?.thresholdPercent).toBe(50);
      expect(costWarning?.severity).toBe('info');
    });

    it('should trigger warning at 75% threshold', () => {
      manager.recordUsage(2500, 2500, 0.5); // 50%
      const result = manager.recordUsage(1250, 1250, 0.25); // 75%

      // Both token (75%) and cost (75%) warnings are triggered
      expect(result.warnings.length).toBe(2);
      const tokenWarning = result.warnings.find((w) => w.type === 'token');
      const costWarning = result.warnings.find((w) => w.type === 'cost');
      expect(tokenWarning?.thresholdPercent).toBe(75);
      expect(tokenWarning?.severity).toBe('warning');
      expect(costWarning?.thresholdPercent).toBe(75);
      expect(costWarning?.severity).toBe('warning');
    });

    it('should trigger critical warning at 90% threshold', () => {
      manager.recordUsage(4000, 4000, 0.8); // 80%
      const result = manager.recordUsage(500, 500, 0.1); // 90%

      // Both token (90%) and cost (90%) warnings are triggered
      expect(result.warnings.length).toBe(2);
      const tokenWarning = result.warnings.find((w) => w.type === 'token');
      const costWarning = result.warnings.find((w) => w.type === 'cost');
      expect(tokenWarning?.thresholdPercent).toBe(90);
      expect(tokenWarning?.severity).toBe('critical');
      expect(costWarning?.thresholdPercent).toBe(90);
      expect(costWarning?.severity).toBe('critical');
    });

    it('should not trigger same warning twice', () => {
      manager.recordUsage(2500, 2500, 0.5); // 50%
      const result = manager.recordUsage(100, 100, 0.01); // still >50%

      expect(result.warnings.length).toBe(0);
    });
  });

  describe('hard limits', () => {
    it('should block when token limit exceeded', () => {
      const result = manager.recordUsage(5000, 6000, 1.0);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeded');
    });

    it('should block when cost limit exceeded', () => {
      manager = new TokenBudgetManager({
        sessionCostLimitUsd: 0.5,
      });

      const result = manager.recordUsage(1000, 1000, 0.6);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cost limit exceeded');
    });
  });

  describe('override', () => {
    it('should allow exceeding limit when override is enabled', () => {
      manager.enableOverride();
      const result = manager.recordUsage(5000, 6000, 1.0);

      expect(result.allowed).toBe(true);
      expect(manager.isOverrideActive()).toBe(true);
    });

    it('should block when override is disabled', () => {
      manager.enableOverride();
      manager.disableOverride();

      const result = manager.recordUsage(5000, 6000, 1.0);

      expect(result.allowed).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return comprehensive status', () => {
      manager.recordUsage(2500, 2500, 0.5);

      const status = manager.getStatus();

      expect(status.currentTokens).toBe(5000);
      expect(status.currentCostUsd).toBe(0.5);
      expect(status.tokenLimit).toBe(10000);
      expect(status.costLimitUsd).toBe(1.0);
      expect(status.tokenUsagePercent).toBe(50);
      expect(status.warningExceeded).toBe(true);
      expect(status.limitExceeded).toBe(false);
      expect(status.remainingTokens).toBe(5000);
    });

    it('should calculate remaining correctly', () => {
      manager.recordUsage(4000, 4000, 0.8);

      const status = manager.getStatus();

      expect(status.remainingTokens).toBe(2000);
      expect(status.remainingCostUsd).toBe(0.2);
    });
  });

  describe('estimateUsage', () => {
    it('should allow if estimate is within budget', () => {
      manager.recordUsage(2000, 2000, 0.4);

      const result = manager.estimateUsage(2000, 2000);

      expect(result.allowed).toBe(true);
    });

    it('should block if estimate exceeds budget', () => {
      manager.recordUsage(5000, 4000, 0.9);

      const result = manager.estimateUsage(1000, 500);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('would exceed');
    });
  });

  describe('reset', () => {
    it('should reset all counters', () => {
      manager.recordUsage(5000, 4000, 0.9);
      manager.reset();

      const status = manager.getStatus();

      expect(status.currentTokens).toBe(0);
      expect(status.currentCostUsd).toBe(0);
      expect(status.activeWarnings.length).toBe(0);
    });
  });

  describe('getWarningHistory', () => {
    it('should return all triggered warnings', () => {
      manager.recordUsage(2500, 2500, 0.5); // 50% token + 50% cost = 2 warnings
      manager.recordUsage(1250, 1250, 0.25); // 75% token + 75% cost = 2 warnings

      const history = manager.getWarningHistory();

      // Total: 4 warnings (2 for 50% + 2 for 75%)
      expect(history.length).toBe(4);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetTokenBudgetManager();
      const instance1 = getTokenBudgetManager({ sessionTokenLimit: 10000 });
      const instance2 = getTokenBudgetManager();

      expect(instance1).toBe(instance2);
    });
  });
});
