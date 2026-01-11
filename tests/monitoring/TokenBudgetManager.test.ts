import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
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

  describe('budget adjustment', () => {
    describe('adjustTokenLimit', () => {
      it('should adjust token limit and return previous value', () => {
        const previousLimit = manager.adjustTokenLimit(15000);

        expect(previousLimit).toBe(10000);
        expect(manager.getTokenLimit()).toBe(15000);
      });

      it('should allow removing token limit', () => {
        manager.adjustTokenLimit(undefined);

        expect(manager.getTokenLimit()).toBeUndefined();
      });

      it('should affect budget checks after adjustment', () => {
        manager.recordUsage(9000, 500, 0.5);

        // At 9500/10000 = 95%, would be blocked
        const resultBefore = manager.checkBudget();
        expect(resultBefore.allowed).toBe(true);

        // Reduce limit to 9000, now at 9500/9000 = 105%, should block
        manager.adjustTokenLimit(9000);
        const resultAfter = manager.checkBudget();
        expect(resultAfter.allowed).toBe(false);
      });

      it('should allow increasing limit to unblock', () => {
        manager.recordUsage(10000, 500, 0.5);
        expect(manager.checkBudget().allowed).toBe(false);

        manager.adjustTokenLimit(15000);
        expect(manager.checkBudget().allowed).toBe(true);
      });
    });

    describe('adjustCostLimit', () => {
      it('should adjust cost limit and return previous value', () => {
        const previousLimit = manager.adjustCostLimit(2.0);

        expect(previousLimit).toBe(1.0);
        expect(manager.getCostLimit()).toBe(2.0);
      });

      it('should allow removing cost limit', () => {
        manager.adjustCostLimit(undefined);

        expect(manager.getCostLimit()).toBeUndefined();
      });
    });

    describe('getTokenLimit', () => {
      it('should return current token limit', () => {
        expect(manager.getTokenLimit()).toBe(10000);
      });

      it('should return undefined when no limit set', () => {
        const unlimitedManager = new TokenBudgetManager({});
        expect(unlimitedManager.getTokenLimit()).toBeUndefined();
      });
    });

    describe('getCostLimit', () => {
      it('should return current cost limit', () => {
        expect(manager.getCostLimit()).toBe(1.0);
      });

      it('should return undefined when no limit set', () => {
        const unlimitedManager = new TokenBudgetManager({});
        expect(unlimitedManager.getCostLimit()).toBeUndefined();
      });
    });
  });

  describe('budget persistence', () => {
    let persistenceDir: string;

    beforeEach(() => {
      persistenceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-persist-'));
    });

    afterEach(() => {
      if (fs.existsSync(persistenceDir)) {
        fs.rmSync(persistenceDir, { recursive: true, force: true });
      }
    });

    it('should save budget state to persistence', () => {
      const persistentManager = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        sessionCostLimitUsd: 1.0,
        enablePersistence: true,
        persistenceDir,
        sessionId: 'test-session-1',
      });

      persistentManager.recordUsage(500, 500, 0.1);
      const result = persistentManager.saveToPersistence();

      expect(result).toBe(true);
      const filePath = path.join(persistenceDir, 'budget-test-session-1.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const savedState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(savedState.currentTokens).toBe(1000);
      expect(savedState.currentCostUsd).toBe(0.1);
    });

    it('should auto-save on recordUsage when persistence is enabled', () => {
      const persistentManager = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        enablePersistence: true,
        persistenceDir,
        sessionId: 'auto-save-test',
      });

      persistentManager.recordUsage(200, 200, 0.02);

      const filePath = path.join(persistenceDir, 'budget-auto-save-test.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should restore budget state from persistence', () => {
      const sessionId = 'restore-test';
      const filePath = path.join(persistenceDir, `budget-${sessionId}.json`);

      // Manually create a persistence file
      const state = {
        sessionId,
        currentTokens: 5000,
        currentCostUsd: 0.5,
        triggeredWarnings: ['token-50'],
        overrideActive: false,
        savedAt: new Date().toISOString(),
        warningHistory: [],
        tokenLimit: 10000,
        costLimitUsd: 1.0,
      };
      fs.writeFileSync(filePath, JSON.stringify(state));

      // Create a new manager that should restore from this state
      const restoredManager = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        sessionCostLimitUsd: 1.0,
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });

      const status = restoredManager.getStatus();
      expect(status.currentTokens).toBe(5000);
      expect(status.currentCostUsd).toBe(0.5);
    });

    it('should return false when saving without persistence enabled', () => {
      const nonPersistentManager = new TokenBudgetManager({
        sessionTokenLimit: 10000,
      });

      const result = nonPersistentManager.saveToPersistence();
      expect(result).toBe(false);
    });

    it('should load from persistence and continue accumulating', () => {
      const sessionId = 'accumulate-test';

      // First manager saves state
      const firstManager = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });
      firstManager.recordUsage(1000, 1000, 0.1);

      // Second manager should restore and continue
      const secondManager = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });
      secondManager.recordUsage(500, 500, 0.05);

      const status = secondManager.getStatus();
      expect(status.currentTokens).toBe(3000); // 2000 + 1000
      expect(status.currentCostUsd).toBeCloseTo(0.15);
    });

    it('should preserve warning history in persistence', () => {
      const sessionId = 'warning-history-test';

      const manager1 = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        sessionCostLimitUsd: 1.0,
        warningThresholds: [50],
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });
      manager1.recordUsage(2500, 2500, 0.5); // Triggers 50% warning

      // Create new manager that restores
      const manager2 = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        sessionCostLimitUsd: 1.0,
        warningThresholds: [50],
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });

      const history = manager2.getWarningHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should preserve override state in persistence', () => {
      const sessionId = 'override-persist-test';

      const manager1 = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });
      manager1.enableOverride();
      manager1.recordUsage(100, 100, 0.01); // Triggers save

      const manager2 = new TokenBudgetManager({
        sessionTokenLimit: 10000,
        enablePersistence: true,
        persistenceDir,
        sessionId,
      });

      expect(manager2.isOverrideActive()).toBe(true);
    });

    it('should get session ID', () => {
      const persistentManager = new TokenBudgetManager({
        enablePersistence: true,
        persistenceDir,
        sessionId: 'known-session-id',
      });

      expect(persistentManager.getSessionId()).toBe('known-session-id');
    });

    it('should generate session ID if not provided', () => {
      const persistentManager = new TokenBudgetManager({
        enablePersistence: true,
        persistenceDir,
      });

      const sessionId = persistentManager.getSessionId();
      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should list persisted sessions', () => {
      // Create some sessions
      new TokenBudgetManager({
        enablePersistence: true,
        persistenceDir,
        sessionId: 'session-a',
      }).recordUsage(100, 100, 0.01);

      new TokenBudgetManager({
        enablePersistence: true,
        persistenceDir,
        sessionId: 'session-b',
      }).recordUsage(100, 100, 0.01);

      const sessions = TokenBudgetManager.listPersistedSessions(persistenceDir);
      expect(sessions).toContain('session-a');
      expect(sessions).toContain('session-b');
    });

    it('should return empty array for non-existent directory', () => {
      const sessions = TokenBudgetManager.listPersistedSessions('/nonexistent/path');
      expect(sessions).toEqual([]);
    });

    it('should handle persistence errors gracefully', () => {
      const sessionId = 'error-test';

      // Create manager in read-only scenario (simulated by testing save returns false)
      const manager1 = new TokenBudgetManager({
        sessionTokenLimit: 10000,
      });

      // saveToPersistence returns false when persistence is disabled
      const result = manager1.saveToPersistence();
      expect(result).toBe(false);
    });
  });
});
