import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  AlertManager,
  getAlertManager,
  resetAlertManager,
  BUILTIN_ALERTS,
} from '../../src/monitoring/index.js';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let testAlertsDir: string;

  beforeEach(() => {
    testAlertsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alerts-test-'));
    resetAlertManager();
    alertManager = new AlertManager({ alertsDir: testAlertsDir, consoleAlerts: false });
  });

  afterEach(() => {
    resetAlertManager();
    if (fs.existsSync(testAlertsDir)) {
      fs.rmSync(testAlertsDir, { recursive: true, force: true });
    }
  });

  describe('builtin alerts', () => {
    it('should load builtin alert definitions', () => {
      const allAlerts = alertManager.getAllAlerts();
      expect(allAlerts.length).toBeGreaterThan(0);
      expect(allAlerts.some((a) => a.name === 'pipeline_stuck')).toBe(true);
    });

    it('should get specific builtin alert', () => {
      const alert = alertManager.getAlert('high_error_rate');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe('critical');
    });
  });

  describe('custom alerts', () => {
    it('should register custom alert', () => {
      alertManager.registerAlert({
        name: 'custom_alert',
        description: 'Custom alert for testing',
        severity: 'warning',
        condition: 'custom_condition',
      });

      const alert = alertManager.getAlert('custom_alert');
      expect(alert).toBeDefined();
      expect(alert?.name).toBe('custom_alert');
    });

    it('should unregister alert', () => {
      alertManager.registerAlert({
        name: 'to_remove',
        description: 'Will be removed',
        severity: 'info',
        condition: 'test',
      });

      const result = alertManager.unregisterAlert('to_remove');
      expect(result).toBe(true);
      expect(alertManager.getAlert('to_remove')).toBeUndefined();
    });

    it('should return false when unregistering unknown alert', () => {
      const result = alertManager.unregisterAlert('unknown');
      expect(result).toBe(false);
    });
  });

  describe('firing alerts', () => {
    it('should fire a known alert', () => {
      const result = alertManager.fire('pipeline_stuck', 'Pipeline has been stuck for 10 minutes');

      expect(result).toBe(true);
      const history = alertManager.getHistory(1);
      expect(history[0]?.name).toBe('pipeline_stuck');
      expect(history[0]?.message).toBe('Pipeline has been stuck for 10 minutes');
    });

    it('should fire an ad-hoc alert for unknown name', () => {
      const result = alertManager.fire('unknown_alert', 'Something happened');

      expect(result).toBe(true);
      const history = alertManager.getHistory(1);
      expect(history[0]?.name).toBe('unknown_alert');
    });

    it('should fire with context', () => {
      alertManager.fire('pipeline_stuck', 'Stuck', { stage: 'implementation', duration: 600 });

      const history = alertManager.getHistory(1);
      expect(history[0]?.context).toEqual({ stage: 'implementation', duration: 600 });
    });

    it('should fire with severity override', () => {
      alertManager.fire('slow_agent', 'Very slow', undefined, 'critical');

      const history = alertManager.getHistory(1);
      expect(history[0]?.severity).toBe('critical');
    });

    it('should not fire during cooldown', () => {
      alertManager.fire('pipeline_stuck', 'First fire');
      const result = alertManager.fire('pipeline_stuck', 'Second fire');

      expect(result).toBe(false);
      const history = alertManager.getHistory(10);
      expect(history.filter((h) => h.name === 'pipeline_stuck')).toHaveLength(1);
    });
  });

  describe('convenience methods', () => {
    it('should fire critical alert', () => {
      alertManager.critical('test', 'Critical issue');

      const history = alertManager.getHistory(1);
      expect(history[0]?.severity).toBe('critical');
    });

    it('should fire warning alert', () => {
      alertManager.warning('test', 'Warning issue');

      const history = alertManager.getHistory(1);
      expect(history[0]?.severity).toBe('warning');
    });

    it('should fire info alert', () => {
      alertManager.info('test', 'Info message');

      const history = alertManager.getHistory(1);
      expect(history[0]?.severity).toBe('info');
    });
  });

  describe('resolving alerts', () => {
    it('should resolve an alert', () => {
      alertManager.fire('test_alert', 'Issue occurred');
      alertManager.resolve('test_alert', 'Issue resolved');

      const history = alertManager.getHistory(2);
      expect(history[0]?.resolved).toBe(true);
      expect(history[0]?.message).toBe('Issue resolved');
    });

    it('should use default message when resolving', () => {
      alertManager.fire('test_alert', 'Issue occurred');
      alertManager.resolve('test_alert');

      const history = alertManager.getHistory(1);
      expect(history[0]?.message).toContain('resolved');
    });
  });

  describe('alert handlers', () => {
    it('should call registered handlers', async () => {
      const handler = vi.fn();
      alertManager.addHandler(handler);

      alertManager.fire('test_alert', 'Test message');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        name: 'test_alert',
        message: 'Test message',
      }));
    });

    it('should remove handler', () => {
      const handler = vi.fn();
      alertManager.addHandler(handler);
      alertManager.removeHandler(handler);

      alertManager.fire('test_alert', 'Test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should return false when removing unknown handler', () => {
      const handler = vi.fn();
      const result = alertManager.removeHandler(handler);
      expect(result).toBe(false);
    });

    it('should continue even if handler throws', () => {
      alertManager.addHandler(() => {
        throw new Error('Handler error');
      });

      // Should not throw
      expect(() => {
        alertManager.fire('test_alert', 'Test');
      }).not.toThrow();
    });
  });

  describe('alert history', () => {
    it('should get history with limit', () => {
      for (let i = 0; i < 10; i++) {
        alertManager.fireAdHoc(`alert_${i}`, `Message ${i}`, 'info');
      }

      const history = alertManager.getHistory(5);
      expect(history).toHaveLength(5);
    });

    it('should get alerts by severity', () => {
      alertManager.critical('crit1', 'Critical 1');
      alertManager.warning('warn1', 'Warning 1');
      alertManager.critical('crit2', 'Critical 2');

      const criticals = alertManager.getAlertsBySeverity('critical', 10);
      expect(criticals).toHaveLength(2);
      expect(criticals.every((a) => a.severity === 'critical')).toBe(true);
    });

    it('should clear history', () => {
      alertManager.fire('test', 'Test');
      alertManager.clearHistory();

      const history = alertManager.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('active alerts', () => {
    it('should get active alerts', () => {
      alertManager.fire('alert1', 'Message 1');
      alertManager.fire('alert2', 'Message 2');

      const active = alertManager.getActiveAlerts();
      expect(active).toHaveLength(2);
    });

    it('should exclude resolved alerts from active', () => {
      alertManager.fire('alert1', 'Message 1');
      alertManager.fire('alert2', 'Message 2');
      alertManager.resolve('alert1');

      const active = alertManager.getActiveAlerts();
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe('alert2');
    });

    it('should get critical count', () => {
      alertManager.critical('crit1', 'Critical 1');
      alertManager.critical('crit2', 'Critical 2');
      alertManager.warning('warn1', 'Warning 1');

      expect(alertManager.getCriticalCount()).toBe(2);
    });

    it('should get warning count', () => {
      alertManager.critical('crit1', 'Critical 1');
      alertManager.warning('warn1', 'Warning 1');
      alertManager.warning('warn2', 'Warning 2');

      expect(alertManager.getWarningCount()).toBe(2);
    });
  });

  describe('cooldown', () => {
    it('should reset cooldowns', () => {
      alertManager.fire('test', 'First');
      alertManager.resetCooldowns();

      const result = alertManager.fire('test', 'Second');
      expect(result).toBe(true);
    });
  });

  describe('file output', () => {
    it('should write alerts to file', () => {
      alertManager.fire('test', 'Test message');

      const alertsFile = path.join(testAlertsDir, 'alerts.jsonl');
      expect(fs.existsSync(alertsFile)).toBe(true);

      const content = fs.readFileSync(alertsFile, 'utf8');
      expect(content).toContain('test');
    });
  });

  describe('console output', () => {
    it('should log critical to console.error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const consoleAlertManager = new AlertManager({
        alertsDir: testAlertsDir,
        consoleAlerts: true,
      });

      consoleAlertManager.critical('test', 'Critical issue');

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should log warning to console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const consoleAlertManager = new AlertManager({
        alertsDir: testAlertsDir,
        consoleAlerts: true,
      });

      consoleAlertManager.warning('test', 'Warning issue');

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should log resolved to console.log', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const consoleAlertManager = new AlertManager({
        alertsDir: testAlertsDir,
        consoleAlerts: true,
      });

      consoleAlertManager.fire('test', 'Issue');
      consoleAlertManager.resolve('test');

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetAlertManager();
      const instance1 = getAlertManager({ consoleAlerts: false });
      const instance2 = getAlertManager();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getAlertsDir', () => {
    it('should return alerts directory', () => {
      expect(alertManager.getAlertsDir()).toBe(testAlertsDir);
    });
  });

  describe('BUILTIN_ALERTS', () => {
    it('should export builtin alerts', () => {
      expect(BUILTIN_ALERTS.length).toBeGreaterThan(0);
      expect(BUILTIN_ALERTS.some((a) => a.name === 'pipeline_stuck')).toBe(true);
      expect(BUILTIN_ALERTS.some((a) => a.name === 'high_error_rate')).toBe(true);
      expect(BUILTIN_ALERTS.some((a) => a.name === 'token_budget_exceeded')).toBe(true);
    });
  });

  describe('escalation', () => {
    it('should track unacknowledged alerts for escalation', () => {
      alertManager.registerAlert({
        name: 'escalating_alert',
        description: 'Alert that escalates',
        severity: 'warning',
        condition: 'test',
        escalation: {
          escalateAfterMs: 1000,
          escalateTo: 'critical',
          maxEscalations: 3,
        },
      });

      alertManager.fire('escalating_alert', 'Initial alert');
      const unacked = alertManager.getUnacknowledgedAlerts();
      expect(unacked.length).toBe(1);
      expect(unacked[0]?.name).toBe('escalating_alert');
    });

    it('should acknowledge an alert and remove from unacknowledged', () => {
      alertManager.registerAlert({
        name: 'ack_test',
        description: 'Alert to acknowledge',
        severity: 'warning',
        condition: 'test',
        escalation: {
          escalateAfterMs: 1000,
          escalateTo: 'critical',
        },
      });

      alertManager.fire('ack_test', 'Test alert');
      expect(alertManager.getUnacknowledgedAlerts().length).toBe(1);

      const result = alertManager.acknowledge('ack_test');
      expect(result).toBe(true);
      expect(alertManager.getUnacknowledgedAlerts().length).toBe(0);
    });

    it('should return false when acknowledging unknown alert', () => {
      const result = alertManager.acknowledge('unknown_alert');
      expect(result).toBe(false);
    });

    it('should get alerts needing escalation within time window', () => {
      alertManager.registerAlert({
        name: 'soon_escalate',
        description: 'Will escalate soon',
        severity: 'warning',
        condition: 'test',
        escalation: {
          escalateAfterMs: 500,
          escalateTo: 'critical',
        },
      });

      alertManager.fire('soon_escalate', 'Test');
      const needingEscalation = alertManager.getAlertsNeedingEscalation(1000);
      expect(needingEscalation.length).toBe(1);
    });

    it('should stop escalation checker on dispose', () => {
      alertManager.dispose();
      // Should not throw
      expect(() => alertManager.dispose()).not.toThrow();
    });

    it('should stop escalation checker explicitly', () => {
      alertManager.stopEscalationChecker();
      // Should not throw when stopping again
      expect(() => alertManager.stopEscalationChecker()).not.toThrow();
    });

    it('should remove from unacknowledged when resolving', () => {
      alertManager.registerAlert({
        name: 'resolve_test',
        description: 'Alert to resolve',
        severity: 'warning',
        condition: 'test',
        escalation: {
          escalateAfterMs: 1000,
          escalateTo: 'critical',
        },
      });

      alertManager.fire('resolve_test', 'Test');
      expect(alertManager.getUnacknowledgedAlerts().length).toBe(1);

      alertManager.resolve('resolve_test');
      expect(alertManager.getUnacknowledgedAlerts().length).toBe(0);
    });

    it('should log acknowledgment when console alerts enabled', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const consoleManager = new AlertManager({
        alertsDir: testAlertsDir,
        consoleAlerts: true,
      });

      consoleManager.registerAlert({
        name: 'console_ack',
        description: 'Test',
        severity: 'warning',
        condition: 'test',
        escalation: {
          escalateAfterMs: 1000,
          escalateTo: 'critical',
        },
      });

      consoleManager.fire('console_ack', 'Test');
      consoleManager.acknowledge('console_ack');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('acknowledged'));
      logSpy.mockRestore();
      consoleManager.dispose();
    });
  });

  describe('condition parsing and evaluation', () => {
    it('should create a typed condition', () => {
      const condition = AlertManager.createCondition('error_rate', '>', 10, '%');
      expect(condition.metric).toBe('error_rate');
      expect(condition.operator).toBe('>');
      expect(condition.threshold).toBe(10);
      expect(condition.unit).toBe('%');
    });

    it('should create condition without unit', () => {
      const condition = AlertManager.createCondition('session_tokens', '>=', 1000);
      expect(condition.metric).toBe('session_tokens');
      expect(condition.unit).toBeUndefined();
    });

    it('should parse no_progress_for condition string', () => {
      const condition = AlertManager.parseConditionString('no_progress_for > 10m');
      expect(condition).not.toBeNull();
      expect(condition?.metric).toBe('no_progress_for');
      expect(condition?.operator).toBe('>');
      expect(condition?.threshold).toBe(10);
    });

    it('should parse error_rate condition string', () => {
      const condition = AlertManager.parseConditionString('error_rate > 10%');
      expect(condition).not.toBeNull();
      expect(condition?.metric).toBe('error_rate');
      expect(condition?.threshold).toBe(10);
    });

    it('should parse session_tokens condition string', () => {
      const condition = AlertManager.parseConditionString('session_tokens > budget_limit');
      expect(condition).not.toBeNull();
      expect(condition?.metric).toBe('session_tokens');
      expect(condition?.threshold).toBe('budget_limit');
    });

    it('should parse agent_p95_latency condition string', () => {
      const condition = AlertManager.parseConditionString('agent_p95_latency > 60s');
      expect(condition).not.toBeNull();
      expect(condition?.metric).toBe('agent_p95_latency');
    });

    it('should parse test_coverage condition string', () => {
      const condition = AlertManager.parseConditionString('test_coverage < 70%');
      expect(condition).not.toBeNull();
      expect(condition?.metric).toBe('test_coverage');
      expect(condition?.operator).toBe('<');
    });

    it('should parse agent_status condition string', () => {
      const condition = AlertManager.parseConditionString('agent_status = failure');
      expect(condition).not.toBeNull();
      expect(condition?.metric).toBe('agent_status');
      expect(condition?.operator).toBe('=');
      expect(condition?.threshold).toBe('failure');
    });

    it('should return null for unparseable condition', () => {
      const condition = AlertManager.parseConditionString('invalid condition format');
      expect(condition).toBeNull();
    });

    it('should handle different operator formats', () => {
      const cond1 = AlertManager.parseConditionString('error_rate >= 10%');
      expect(cond1?.operator).toBe('>=');

      const cond2 = AlertManager.parseConditionString('error_rate <= 10%');
      expect(cond2?.operator).toBe('<=');

      const cond3 = AlertManager.parseConditionString('error_rate != 10%');
      expect(cond3?.operator).toBe('!=');
    });

    it('should evaluate > operator correctly', () => {
      const condition = AlertManager.createCondition('error_rate', '>', 10);
      expect(alertManager.evaluateCondition(condition, { error_rate: 15 })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { error_rate: 5 })).toBe(false);
    });

    it('should evaluate >= operator correctly', () => {
      const condition = AlertManager.createCondition('error_rate', '>=', 10);
      expect(alertManager.evaluateCondition(condition, { error_rate: 10 })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { error_rate: 9 })).toBe(false);
    });

    it('should evaluate < operator correctly', () => {
      const condition = AlertManager.createCondition('test_coverage', '<', 70);
      expect(alertManager.evaluateCondition(condition, { test_coverage: 65 })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { test_coverage: 75 })).toBe(false);
    });

    it('should evaluate <= operator correctly', () => {
      const condition = AlertManager.createCondition('test_coverage', '<=', 70);
      expect(alertManager.evaluateCondition(condition, { test_coverage: 70 })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { test_coverage: 71 })).toBe(false);
    });

    it('should evaluate = operator correctly', () => {
      const condition = AlertManager.createCondition('agent_status', '=', 'failure');
      expect(alertManager.evaluateCondition(condition, { agent_status: 'failure' })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { agent_status: 'success' })).toBe(false);
    });

    it('should evaluate != operator correctly', () => {
      const condition = AlertManager.createCondition('agent_status', '!=', 'success');
      expect(alertManager.evaluateCondition(condition, { agent_status: 'failure' })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { agent_status: 'success' })).toBe(false);
    });

    it('should evaluate contains operator correctly', () => {
      const condition: { metric: 'agent_status'; operator: 'contains'; threshold: string } = {
        metric: 'agent_status',
        operator: 'contains',
        threshold: 'fail',
      };
      expect(alertManager.evaluateCondition(condition, { agent_status: 'failure' })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { agent_status: 'success' })).toBe(false);
    });

    it('should evaluate not_contains operator correctly', () => {
      const condition: { metric: 'agent_status'; operator: 'not_contains'; threshold: string } = {
        metric: 'agent_status',
        operator: 'not_contains',
        threshold: 'fail',
      };
      expect(alertManager.evaluateCondition(condition, { agent_status: 'success' })).toBe(true);
      expect(alertManager.evaluateCondition(condition, { agent_status: 'failure' })).toBe(false);
    });

    it('should return false for missing metric', () => {
      const condition = AlertManager.createCondition('error_rate', '>', 10);
      expect(alertManager.evaluateCondition(condition, {})).toBe(false);
    });

    it('should return false for type mismatch in comparison', () => {
      const condition = AlertManager.createCondition('error_rate', '>', 10);
      expect(alertManager.evaluateCondition(condition, { error_rate: 'invalid' })).toBe(false);
    });
  });

  describe('fireIfConditionMet', () => {
    it('should fire alert when condition is met', () => {
      alertManager.registerTypedAlert(
        'high_error_test',
        'High error rate',
        'critical',
        AlertManager.createCondition('error_rate', '>', 10)
      );

      const result = alertManager.fireIfConditionMet(
        'high_error_test',
        'Error rate too high',
        { error_rate: 15 }
      );

      expect(result).toBe(true);
      const history = alertManager.getHistory(1);
      expect(history[0]?.name).toBe('high_error_test');
    });

    it('should not fire alert when condition is not met', () => {
      alertManager.registerTypedAlert(
        'low_error_test',
        'Low error rate',
        'critical',
        AlertManager.createCondition('error_rate', '>', 10)
      );

      const result = alertManager.fireIfConditionMet(
        'low_error_test',
        'Error rate too high',
        { error_rate: 5 }
      );

      expect(result).toBe(false);
    });

    it('should return false for unknown alert', () => {
      const result = alertManager.fireIfConditionMet(
        'unknown_condition_alert',
        'Test',
        { error_rate: 50 }
      );

      expect(result).toBe(false);
    });

    it('should fire when condition cannot be parsed', () => {
      alertManager.registerAlert({
        name: 'unparseable',
        description: 'Unparseable condition',
        severity: 'warning',
        condition: 'invalid syntax that cannot be parsed',
      });

      const result = alertManager.fireIfConditionMet(
        'unparseable',
        'Test message',
        { some_metric: 100 }
      );

      expect(result).toBe(true);
    });
  });

  describe('registerTypedAlert', () => {
    it('should register alert with typed condition', () => {
      alertManager.registerTypedAlert(
        'typed_alert',
        'Typed condition alert',
        'warning',
        AlertManager.createCondition('test_coverage', '<', 80, '%'),
        { cooldownMs: 5000 }
      );

      const alert = alertManager.getAlert('typed_alert');
      expect(alert).toBeDefined();
      expect(alert?.conditionTyped).toBeDefined();
      expect(alert?.cooldownMs).toBe(5000);
    });

    it('should register alert with windowMs option', () => {
      alertManager.registerTypedAlert(
        'windowed_alert',
        'Alert with window',
        'warning',
        AlertManager.createCondition('error_rate', '>', 5),
        { windowMs: 60000 }
      );

      const alert = alertManager.getAlert('windowed_alert');
      expect(alert?.windowMs).toBe(60000);
    });

    it('should register alert with escalation config', () => {
      alertManager.registerTypedAlert(
        'escalatable_typed',
        'Alert with escalation',
        'warning',
        AlertManager.createCondition('error_rate', '>', 5),
        {
          escalation: {
            escalateAfterMs: 5000,
            escalateTo: 'critical',
            maxEscalations: 2,
          },
        }
      );

      const alert = alertManager.getAlert('escalatable_typed');
      expect(alert?.escalation).toBeDefined();
      expect(alert?.escalation?.escalateTo).toBe('critical');
    });
  });

  describe('ad-hoc alert cooldown', () => {
    it('should respect cooldown for ad-hoc alerts', () => {
      alertManager.fireAdHoc('adhoc_cooldown', 'First', 'info');
      const result = alertManager.fireAdHoc('adhoc_cooldown', 'Second', 'info');
      expect(result).toBe(false);
    });

    it('should fire ad-hoc alert with context', () => {
      alertManager.fireAdHoc('adhoc_context', 'Test', 'warning', { key: 'value' });
      const history = alertManager.getHistory(1);
      expect(history[0]?.context).toEqual({ key: 'value' });
    });
  });

  describe('max history size', () => {
    it('should trim history when exceeding max size', () => {
      const smallHistoryManager = new AlertManager({
        alertsDir: testAlertsDir,
        consoleAlerts: false,
        maxHistorySize: 5,
      });

      for (let i = 0; i < 10; i++) {
        smallHistoryManager.fireAdHoc(`alert_${i}`, `Message ${i}`, 'info');
      }

      const history = smallHistoryManager.getHistory();
      expect(history.length).toBe(5);
      smallHistoryManager.dispose();
    });
  });
});
