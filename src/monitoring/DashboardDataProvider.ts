/**
 * DashboardDataProvider - Provides data for monitoring dashboards
 *
 * Features:
 * - Pipeline progress tracking
 * - Agent performance data
 * - Token usage visualization
 * - Recent errors and alerts
 * - System health overview
 */

import type {
  DashboardDataProviderOptions,
  DashboardPanel,
  PipelineProgress,
  AgentMetrics,
  TokenUsageMetrics,
  LogEntry,
  AlertEvent,
} from './types.js';
import { getLogger } from './Logger.js';
import { getMetricsCollector } from './MetricsCollector.js';
import { getAlertManager } from './AlertManager.js';

/**
 * Default refresh interval (10 seconds)
 */
const DEFAULT_REFRESH_INTERVAL_MS = 10000;

/**
 * Dashboard data provider for system monitoring
 */
export class DashboardDataProvider {
  private readonly refreshIntervalMs: number;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private cachedData: Map<string, DashboardPanel> = new Map();
  private lastRefresh: Date = new Date(0);

  constructor(options: DashboardDataProviderOptions = {}) {
    this.refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  }

  /**
   * Start auto-refresh
   */
  public startAutoRefresh(): void {
    if (this.refreshTimer !== null) return;
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.refreshIntervalMs);
  }

  /**
   * Stop auto-refresh
   */
  public stopAutoRefresh(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh all dashboard data
   */
  public refresh(): void {
    this.lastRefresh = new Date();

    // Update all panels
    this.updatePipelineProgressPanel();
    this.updateAgentPerformancePanel();
    this.updateTokenUsagePanel();
    this.updateRecentErrorsPanel();
    this.updateActiveAlertsPanel();
    this.updateSystemHealthPanel();
  }

  /**
   * Get a specific panel's data
   */
  public getPanel(panelId: string): DashboardPanel | null {
    return this.cachedData.get(panelId) ?? null;
  }

  /**
   * Get all panels
   */
  public getAllPanels(): DashboardPanel[] {
    return Array.from(this.cachedData.values());
  }

  /**
   * Update pipeline progress panel
   */
  private updatePipelineProgressPanel(): void {
    const metricsCollector = getMetricsCollector();
    const stages = metricsCollector.getStageDurations();

    const completedStages = stages.filter((s) => s.status === 'completed').length;
    const currentStage = stages.find((s) => s.status === 'in_progress')?.stage ?? 'none';

    const progress: PipelineProgress = {
      currentStage,
      totalStages: stages.length,
      completedStages,
      stages,
    };

    this.cachedData.set('pipeline_progress', {
      title: 'Pipeline Progress',
      type: 'progress',
      data: progress,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update agent performance panel
   */
  private updateAgentPerformancePanel(): void {
    const metricsCollector = getMetricsCollector();
    const agentMetrics = metricsCollector.getAllAgentMetrics();

    const tableData = agentMetrics.map((m) => ({
      agent: m.agent,
      invocations: m.invocations,
      successRate: m.invocations > 0
        ? Math.round((m.successes / m.invocations) * 100)
        : 0,
      avgDuration: Math.round(m.avgDurationMs),
      p95Duration: Math.round(m.p95DurationMs),
      errorRate: m.invocations > 0
        ? Math.round((m.failures / m.invocations) * 100)
        : 0,
    }));

    this.cachedData.set('agent_performance', {
      title: 'Agent Performance',
      type: 'table',
      data: {
        columns: ['agent', 'invocations', 'successRate', 'avgDuration', 'p95Duration', 'errorRate'],
        rows: tableData,
      },
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update token usage panel
   */
  private updateTokenUsagePanel(): void {
    const metricsCollector = getMetricsCollector();
    const tokenUsage = metricsCollector.getTokenUsageMetrics();

    const timeSeriesData = Object.entries(tokenUsage.byAgent).map(([agent, usage]) => ({
      agent,
      inputTokens: usage.input,
      outputTokens: usage.output,
      total: usage.input + usage.output,
    }));

    this.cachedData.set('token_usage', {
      title: 'Token Usage',
      type: 'timeSeries',
      data: {
        total: {
          input: tokenUsage.totalInputTokens,
          output: tokenUsage.totalOutputTokens,
          cost: tokenUsage.estimatedCostUsd,
        },
        byAgent: timeSeriesData,
      },
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update recent errors panel
   */
  private updateRecentErrorsPanel(): void {
    const logger = getLogger();
    const errors = logger.getErrors(50);

    this.cachedData.set('recent_errors', {
      title: 'Recent Errors',
      type: 'logViewer',
      data: {
        entries: errors.map((e) => ({
          timestamp: e.timestamp,
          message: e.message,
          agent: e.agent,
          stage: e.stage,
          error: e.error,
        })),
        total: errors.length,
      },
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update active alerts panel
   */
  private updateActiveAlertsPanel(): void {
    const alertManager = getAlertManager();
    const activeAlerts = alertManager.getActiveAlerts();

    this.cachedData.set('active_alerts', {
      title: 'Active Alerts',
      type: 'table',
      data: {
        critical: alertManager.getCriticalCount(),
        warning: alertManager.getWarningCount(),
        alerts: activeAlerts.map((a) => ({
          name: a.name,
          severity: a.severity,
          message: a.message,
          timestamp: a.timestamp,
        })),
      },
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Update system health panel
   */
  private updateSystemHealthPanel(): void {
    const metricsCollector = getMetricsCollector();
    const alertManager = getAlertManager();
    const agentMetrics = metricsCollector.getAllAgentMetrics();
    const stages = metricsCollector.getStageDurations();

    // Calculate overall health score
    const criticalAlerts = alertManager.getCriticalCount();
    const warningAlerts = alertManager.getWarningCount();
    const totalInvocations = agentMetrics.reduce((sum, m) => sum + m.invocations, 0);
    const totalFailures = agentMetrics.reduce((sum, m) => sum + m.failures, 0);
    const errorRate = totalInvocations > 0 ? totalFailures / totalInvocations : 0;

    let healthScore = 100;
    healthScore -= criticalAlerts * 20;
    healthScore -= warningAlerts * 5;
    healthScore -= errorRate * 50;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const status = healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'degraded' : 'unhealthy';

    this.cachedData.set('system_health', {
      title: 'System Health',
      type: 'gauge',
      data: {
        score: Math.round(healthScore),
        status,
        metrics: {
          criticalAlerts,
          warningAlerts,
          errorRate: Math.round(errorRate * 100),
          completedStages: stages.filter((s) => s.status === 'completed').length,
          totalStages: stages.length,
        },
      },
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Get pipeline progress data
   */
  public getPipelineProgress(): PipelineProgress | null {
    const panel = this.getPanel('pipeline_progress');
    return panel?.data as PipelineProgress | null;
  }

  /**
   * Get agent performance data
   */
  public getAgentPerformance(): AgentMetrics[] {
    const metricsCollector = getMetricsCollector();
    return metricsCollector.getAllAgentMetrics();
  }

  /**
   * Get token usage data
   */
  public getTokenUsage(): TokenUsageMetrics {
    const metricsCollector = getMetricsCollector();
    return metricsCollector.getTokenUsageMetrics();
  }

  /**
   * Get recent errors
   */
  public getRecentErrors(limit = 50): LogEntry[] {
    const logger = getLogger();
    return logger.getErrors(limit);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): AlertEvent[] {
    const alertManager = getAlertManager();
    return alertManager.getActiveAlerts();
  }

  /**
   * Get system health score
   */
  public getHealthScore(): number {
    const panel = this.getPanel('system_health');
    if (panel === null) {
      this.updateSystemHealthPanel();
      const updatedPanel = this.getPanel('system_health');
      return (updatedPanel?.data as { score: number })?.score ?? 100;
    }
    return (panel.data as { score: number }).score;
  }

  /**
   * Get last refresh time
   */
  public getLastRefreshTime(): Date {
    return this.lastRefresh;
  }

  /**
   * Export dashboard data as JSON
   */
  public exportAsJson(): string {
    this.refresh();
    const data: Record<string, DashboardPanel> = {};
    for (const [key, panel] of this.cachedData) {
      data[key] = panel;
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get dashboard summary
   */
  public getSummary(): {
    healthScore: number;
    pipelineProgress: number;
    activeAlerts: number;
    tokenUsage: { input: number; output: number; cost: number };
  } {
    const metricsCollector = getMetricsCollector();
    const alertManager = getAlertManager();
    const stages = metricsCollector.getStageDurations();
    const tokenUsage = metricsCollector.getTokenUsageMetrics();

    const completedStages = stages.filter((s) => s.status === 'completed').length;
    const totalStages = stages.length;

    return {
      healthScore: this.getHealthScore(),
      pipelineProgress: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
      activeAlerts: alertManager.getActiveAlerts().length,
      tokenUsage: {
        input: tokenUsage.totalInputTokens,
        output: tokenUsage.totalOutputTokens,
        cost: tokenUsage.estimatedCostUsd,
      },
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalDashboardDataProvider: DashboardDataProvider | null = null;

/**
 * Get or create the global DashboardDataProvider instance
 */
export function getDashboardDataProvider(options?: DashboardDataProviderOptions): DashboardDataProvider {
  if (globalDashboardDataProvider === null) {
    globalDashboardDataProvider = new DashboardDataProvider(options);
  }
  return globalDashboardDataProvider;
}

/**
 * Reset the global DashboardDataProvider instance (for testing)
 */
export function resetDashboardDataProvider(): void {
  if (globalDashboardDataProvider !== null) {
    globalDashboardDataProvider.stopAutoRefresh();
    globalDashboardDataProvider = null;
  }
}
