import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DashboardDataProvider,
  getDashboardDataProvider,
  resetDashboardDataProvider,
  resetLogger,
  resetMetricsCollector,
  resetAlertManager,
  getLogger,
  getMetricsCollector,
  getAlertManager,
} from '../../src/monitoring/index.js';

describe('DashboardDataProvider', () => {
  let provider: DashboardDataProvider;

  beforeEach(() => {
    resetDashboardDataProvider();
    resetLogger();
    resetMetricsCollector();
    resetAlertManager();
    provider = new DashboardDataProvider({ refreshIntervalMs: 1000 });
  });

  afterEach(() => {
    provider.stopAutoRefresh();
    resetDashboardDataProvider();
    resetLogger();
    resetMetricsCollector();
    resetAlertManager();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultProvider = new DashboardDataProvider();
      expect(defaultProvider).toBeInstanceOf(DashboardDataProvider);
      defaultProvider.stopAutoRefresh();
    });

    it('should create instance with custom refresh interval', () => {
      const customProvider = new DashboardDataProvider({ refreshIntervalMs: 5000 });
      expect(customProvider).toBeInstanceOf(DashboardDataProvider);
      customProvider.stopAutoRefresh();
    });
  });

  describe('auto-refresh', () => {
    it('should start auto-refresh', () => {
      provider.startAutoRefresh();
      // Calling again should not create another timer
      provider.startAutoRefresh();
      provider.stopAutoRefresh();
    });

    it('should stop auto-refresh', () => {
      provider.startAutoRefresh();
      provider.stopAutoRefresh();
      // Calling again should be safe
      provider.stopAutoRefresh();
    });

    it('should execute refresh on interval', async () => {
      const refreshSpy = vi.spyOn(provider, 'refresh');
      provider.startAutoRefresh();

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(refreshSpy).toHaveBeenCalled();
      provider.stopAutoRefresh();
    });
  });

  describe('refresh', () => {
    it('should update all panels on refresh', () => {
      provider.refresh();

      const panels = provider.getAllPanels();
      expect(panels.length).toBe(6);
    });

    it('should update lastRefresh time', () => {
      const before = new Date();
      provider.refresh();
      const after = new Date();

      const lastRefresh = provider.getLastRefreshTime();
      expect(lastRefresh.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastRefresh.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getPanel', () => {
    it('should return null for non-existent panel', () => {
      const panel = provider.getPanel('non_existent');
      expect(panel).toBeNull();
    });

    it('should return panel after refresh', () => {
      provider.refresh();
      const panel = provider.getPanel('pipeline_progress');
      expect(panel).not.toBeNull();
      expect(panel?.title).toBe('Pipeline Progress');
      expect(panel?.type).toBe('progress');
    });
  });

  describe('getAllPanels', () => {
    it('should return empty array before refresh', () => {
      const panels = provider.getAllPanels();
      expect(panels).toEqual([]);
    });

    it('should return all panels after refresh', () => {
      provider.refresh();
      const panels = provider.getAllPanels();
      expect(panels.length).toBe(6);
      const titles = panels.map((p) => p.title);
      expect(titles).toContain('Pipeline Progress');
      expect(titles).toContain('Agent Performance');
      expect(titles).toContain('Token Usage');
      expect(titles).toContain('Recent Errors');
      expect(titles).toContain('Active Alerts');
      expect(titles).toContain('System Health');
    });
  });

  describe('pipeline progress panel', () => {
    it('should provide pipeline progress data', () => {
      const metricsCollector = getMetricsCollector();
      metricsCollector.recordStageStart('planning');
      metricsCollector.recordStageEnd('planning', true);
      metricsCollector.recordStageStart('implementation');

      provider.refresh();
      const panel = provider.getPanel('pipeline_progress');

      expect(panel?.type).toBe('progress');
      expect(panel?.data).toHaveProperty('currentStage');
      expect(panel?.data).toHaveProperty('totalStages');
      expect(panel?.data).toHaveProperty('completedStages');
    });

    it('should show none as current stage when no stage is in progress', () => {
      provider.refresh();
      const panel = provider.getPanel('pipeline_progress');
      expect((panel?.data as { currentStage: string }).currentStage).toBe('none');
    });
  });

  describe('agent performance panel', () => {
    it('should provide agent performance data', () => {
      const metricsCollector = getMetricsCollector();
      const start1 = metricsCollector.recordAgentStart('test-agent');
      metricsCollector.recordAgentEnd('test-agent', start1, true);
      const start2 = metricsCollector.recordAgentStart('test-agent');
      metricsCollector.recordAgentEnd('test-agent', start2, false);

      provider.refresh();
      const panel = provider.getPanel('agent_performance');

      expect(panel?.type).toBe('table');
      expect(panel?.data).toHaveProperty('columns');
      expect(panel?.data).toHaveProperty('rows');
    });

    it('should calculate success and error rates correctly', () => {
      const metricsCollector = getMetricsCollector();
      const start1 = metricsCollector.recordAgentStart('agent1');
      metricsCollector.recordAgentEnd('agent1', start1, true);
      const start2 = metricsCollector.recordAgentStart('agent1');
      metricsCollector.recordAgentEnd('agent1', start2, true);
      const start3 = metricsCollector.recordAgentStart('agent1');
      metricsCollector.recordAgentEnd('agent1', start3, false);

      provider.refresh();
      const panel = provider.getPanel('agent_performance');
      const rows = (panel?.data as { rows: Array<{ successRate: number; errorRate: number }> }).rows;
      const agent1 = rows.find((r: { agent?: string }) => (r as { agent?: string }).agent === 'agent1');

      expect(agent1?.successRate).toBe(67);
      expect(agent1?.errorRate).toBe(33);
    });

    it('should handle zero invocations gracefully', () => {
      provider.refresh();
      const panel = provider.getPanel('agent_performance');
      const rows = (panel?.data as { rows: Array<{ successRate: number; errorRate: number }> }).rows;
      expect(rows).toEqual([]);
    });
  });

  describe('token usage panel', () => {
    it('should provide token usage data', () => {
      const metricsCollector = getMetricsCollector();
      metricsCollector.recordTokenUsage('test-agent', 1000, 500);

      provider.refresh();
      const panel = provider.getPanel('token_usage');

      expect(panel?.type).toBe('timeSeries');
      expect(panel?.data).toHaveProperty('total');
      expect(panel?.data).toHaveProperty('byAgent');
    });

    it('should aggregate token usage by agent', () => {
      const metricsCollector = getMetricsCollector();
      metricsCollector.recordTokenUsage('agent1', 100, 50);
      metricsCollector.recordTokenUsage('agent2', 200, 100);

      provider.refresh();
      const panel = provider.getPanel('token_usage');
      const byAgent = (panel?.data as { byAgent: Array<{ agent: string }> }).byAgent;

      expect(byAgent.length).toBe(2);
      expect(byAgent.some((a: { agent: string }) => a.agent === 'agent1')).toBe(true);
      expect(byAgent.some((a: { agent: string }) => a.agent === 'agent2')).toBe(true);
    });
  });

  describe('recent errors panel', () => {
    it('should provide recent errors data', () => {
      const logger = getLogger();
      logger.error('Test error message');

      provider.refresh();
      const panel = provider.getPanel('recent_errors');

      expect(panel?.type).toBe('logViewer');
      expect(panel?.data).toHaveProperty('entries');
      expect(panel?.data).toHaveProperty('total');
    });
  });

  describe('active alerts panel', () => {
    it('should provide active alerts data', () => {
      const alertManager = getAlertManager({ consoleAlerts: false });
      alertManager.fire('test_alert', 'Test alert message');

      provider.refresh();
      const panel = provider.getPanel('active_alerts');

      expect(panel?.type).toBe('table');
      expect(panel?.data).toHaveProperty('critical');
      expect(panel?.data).toHaveProperty('warning');
      expect(panel?.data).toHaveProperty('alerts');
    });
  });

  describe('system health panel', () => {
    it('should provide system health data', () => {
      provider.refresh();
      const panel = provider.getPanel('system_health');

      expect(panel?.type).toBe('gauge');
      expect(panel?.data).toHaveProperty('score');
      expect(panel?.data).toHaveProperty('status');
      expect(panel?.data).toHaveProperty('metrics');
    });

    it('should return healthy status when no issues', () => {
      provider.refresh();
      const panel = provider.getPanel('system_health');
      const data = panel?.data as { score: number; status: string };

      expect(data.score).toBe(100);
      expect(data.status).toBe('healthy');
    });

    it('should reduce health score with critical alerts', () => {
      const alertManager = getAlertManager({ consoleAlerts: false });
      alertManager.registerAlert({
        name: 'critical_test',
        description: 'Critical test alert',
        severity: 'critical',
        condition: 'test',
      });
      alertManager.fire('critical_test', 'Critical issue');

      provider.refresh();
      const panel = provider.getPanel('system_health');
      const data = panel?.data as { score: number; status: string };

      expect(data.score).toBeLessThan(100);
    });

    it('should reduce health score with warning alerts', () => {
      const alertManager = getAlertManager({ consoleAlerts: false });
      alertManager.registerAlert({
        name: 'warning_test',
        description: 'Warning test alert',
        severity: 'warning',
        condition: 'test',
      });
      alertManager.fire('warning_test', 'Warning issue');

      provider.refresh();
      const panel = provider.getPanel('system_health');
      const data = panel?.data as { score: number; status: string };

      expect(data.score).toBeLessThan(100);
    });

    it('should show degraded status for medium scores', () => {
      const alertManager = getAlertManager({ consoleAlerts: false });
      // Add multiple warning alerts to reduce score below 80 but above 50
      for (let i = 0; i < 5; i++) {
        alertManager.registerAlert({
          name: `warning_test_${i}`,
          description: 'Warning test',
          severity: 'warning',
          condition: 'test',
        });
        alertManager.fire(`warning_test_${i}`, 'Warning');
      }

      provider.refresh();
      const panel = provider.getPanel('system_health');
      const data = panel?.data as { score: number; status: string };

      expect(data.status).toBe('degraded');
    });

    it('should show unhealthy status for low scores', () => {
      const alertManager = getAlertManager({ consoleAlerts: false });
      // Add many critical alerts to reduce score below 50
      for (let i = 0; i < 5; i++) {
        alertManager.registerAlert({
          name: `critical_test_${i}`,
          description: 'Critical test',
          severity: 'critical',
          condition: 'test',
        });
        alertManager.fire(`critical_test_${i}`, 'Critical');
      }

      provider.refresh();
      const panel = provider.getPanel('system_health');
      const data = panel?.data as { score: number; status: string };

      expect(data.status).toBe('unhealthy');
    });

    it('should factor in error rate', () => {
      const metricsCollector = getMetricsCollector();
      // Create high error rate
      for (let i = 0; i < 10; i++) {
        const start = metricsCollector.recordAgentStart('failing-agent');
        metricsCollector.recordAgentEnd('failing-agent', start, false);
      }

      provider.refresh();
      const panel = provider.getPanel('system_health');
      const data = panel?.data as { score: number };

      expect(data.score).toBeLessThan(100);
    });
  });

  describe('getPipelineProgress', () => {
    it('should return null/undefined before refresh', () => {
      const progress = provider.getPipelineProgress();
      expect(progress).toBeFalsy();
    });

    it('should return progress data after refresh', () => {
      provider.refresh();
      const progress = provider.getPipelineProgress();
      expect(progress).not.toBeNull();
      expect(progress).toHaveProperty('currentStage');
      expect(progress).toHaveProperty('totalStages');
    });
  });

  describe('getAgentPerformance', () => {
    it('should return agent metrics from collector', () => {
      const metricsCollector = getMetricsCollector();
      const start = metricsCollector.recordAgentStart('test-agent');
      metricsCollector.recordAgentEnd('test-agent', start, true);

      const metrics = provider.getAgentPerformance();
      expect(metrics.length).toBe(1);
      expect(metrics[0]?.agent).toBe('test-agent');
    });
  });

  describe('getTokenUsage', () => {
    it('should return token usage from collector', () => {
      const metricsCollector = getMetricsCollector();
      metricsCollector.recordTokenUsage('test-agent', 1000, 500);

      const usage = provider.getTokenUsage();
      expect(usage.totalInputTokens).toBe(1000);
      expect(usage.totalOutputTokens).toBe(500);
    });
  });

  describe('getRecentErrors', () => {
    it('should return errors from logger', () => {
      // Mock logger's getErrors to simulate stored errors
      const logger = getLogger();
      const mockErrors = [
        { timestamp: new Date().toISOString(), level: 'ERROR', message: 'Test error 1' },
        { timestamp: new Date().toISOString(), level: 'ERROR', message: 'Test error 2' },
      ];
      vi.spyOn(logger, 'getErrors').mockReturnValue(mockErrors as ReturnType<typeof logger.getErrors>);

      const errors = provider.getRecentErrors(10);
      expect(errors.length).toBe(2);
      expect(logger.getErrors).toHaveBeenCalledWith(10);
    });

    it('should respect limit parameter', () => {
      // Mock logger's getErrors to respect the limit
      const logger = getLogger();
      const mockErrors = Array.from({ length: 5 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: `Error ${i}`,
      }));
      vi.spyOn(logger, 'getErrors').mockReturnValue(mockErrors as ReturnType<typeof logger.getErrors>);

      const errors = provider.getRecentErrors(5);
      expect(errors.length).toBeLessThanOrEqual(5);
      expect(logger.getErrors).toHaveBeenCalledWith(5);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts from manager', () => {
      const alertManager = getAlertManager({ consoleAlerts: false });
      alertManager.fire('test_alert', 'Test alert');

      const alerts = provider.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('getHealthScore', () => {
    it('should return 100 when no issues', () => {
      const score = provider.getHealthScore();
      expect(score).toBe(100);
    });

    it('should update panel if not yet cached', () => {
      const score = provider.getHealthScore();
      expect(score).toBe(100);
      const panel = provider.getPanel('system_health');
      expect(panel).not.toBeNull();
    });

    it('should return cached score after refresh', () => {
      provider.refresh();
      const score = provider.getHealthScore();
      expect(score).toBe(100);
    });
  });

  describe('getLastRefreshTime', () => {
    it('should return epoch time before any refresh', () => {
      const lastRefresh = provider.getLastRefreshTime();
      expect(lastRefresh.getTime()).toBe(0);
    });

    it('should return current time after refresh', () => {
      const before = Date.now();
      provider.refresh();
      const after = Date.now();

      const lastRefresh = provider.getLastRefreshTime();
      expect(lastRefresh.getTime()).toBeGreaterThanOrEqual(before);
      expect(lastRefresh.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('exportAsJson', () => {
    it('should export all panels as JSON', () => {
      const metricsCollector = getMetricsCollector();
      const start = metricsCollector.recordAgentStart('test-agent');
      metricsCollector.recordAgentEnd('test-agent', start, true);

      const json = provider.exportAsJson();
      const data = JSON.parse(json);

      expect(data).toHaveProperty('pipeline_progress');
      expect(data).toHaveProperty('agent_performance');
      expect(data).toHaveProperty('token_usage');
      expect(data).toHaveProperty('recent_errors');
      expect(data).toHaveProperty('active_alerts');
      expect(data).toHaveProperty('system_health');
    });

    it('should produce valid JSON', () => {
      const json = provider.exportAsJson();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('getSummary', () => {
    it('should return dashboard summary', () => {
      const metricsCollector = getMetricsCollector();
      metricsCollector.recordTokenUsage('test-agent', 1000, 500);

      const summary = provider.getSummary();

      expect(summary).toHaveProperty('healthScore');
      expect(summary).toHaveProperty('pipelineProgress');
      expect(summary).toHaveProperty('activeAlerts');
      expect(summary).toHaveProperty('tokenUsage');
      expect(summary.tokenUsage).toHaveProperty('input');
      expect(summary.tokenUsage).toHaveProperty('output');
      expect(summary.tokenUsage).toHaveProperty('cost');
    });

    it('should calculate pipeline progress percentage', () => {
      const metricsCollector = getMetricsCollector();
      metricsCollector.recordStageStart('stage1');
      metricsCollector.recordStageEnd('stage1', true);
      metricsCollector.recordStageStart('stage2');

      const summary = provider.getSummary();
      expect(summary.pipelineProgress).toBe(50);
    });

    it('should return 0 progress when no stages', () => {
      const summary = provider.getSummary();
      expect(summary.pipelineProgress).toBe(0);
    });
  });
});

describe('singleton functions', () => {
  beforeEach(() => {
    resetDashboardDataProvider();
    resetLogger();
    resetMetricsCollector();
    resetAlertManager();
  });

  afterEach(() => {
    resetDashboardDataProvider();
    resetLogger();
    resetMetricsCollector();
    resetAlertManager();
  });

  describe('getDashboardDataProvider', () => {
    it('should return singleton instance', () => {
      const provider1 = getDashboardDataProvider();
      const provider2 = getDashboardDataProvider();
      expect(provider1).toBe(provider2);
    });

    it('should accept options on first call', () => {
      const provider = getDashboardDataProvider({ refreshIntervalMs: 5000 });
      expect(provider).toBeInstanceOf(DashboardDataProvider);
    });
  });

  describe('resetDashboardDataProvider', () => {
    it('should reset singleton instance', () => {
      const provider1 = getDashboardDataProvider();
      resetDashboardDataProvider();
      const provider2 = getDashboardDataProvider();
      expect(provider1).not.toBe(provider2);
    });

    it('should stop auto-refresh on reset', () => {
      const provider = getDashboardDataProvider();
      provider.startAutoRefresh();
      resetDashboardDataProvider();
      // No error should occur
    });

    it('should be safe to call multiple times', () => {
      resetDashboardDataProvider();
      resetDashboardDataProvider();
      // No error should occur
    });
  });
});
