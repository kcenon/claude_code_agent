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
});
