/**
 * AlertManager - Manages alerts and notifications for critical events
 *
 * Features:
 * - Alert definition and evaluation
 * - Severity levels (critical, warning, info)
 * - Cooldown to prevent alert storms
 * - Alert history tracking
 * - Custom alert handlers
 * - Type-safe alert conditions
 * - Alert escalation for unacknowledged alerts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AlertManagerOptions,
  AlertDefinition,
  AlertEvent,
  AlertHandler,
  AlertSeverity,
  AlertConditionTyped,
  AlertEscalationConfig,
  AlertEventWithEscalation,
} from './types.js';
import { DEFAULT_PATHS } from '../config/paths.js';

/**
 * Default alerts directory
 */
const DEFAULT_ALERTS_DIR = DEFAULT_PATHS.ALERTS;

/**
 * Default max history size
 */
const DEFAULT_MAX_HISTORY_SIZE = 1000;

/**
 * Default cooldown period (5 minutes)
 */
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Built-in alert definitions
 */
export const BUILTIN_ALERTS: readonly AlertDefinition[] = [
  {
    name: 'pipeline_stuck',
    description: 'Pipeline has not made progress',
    severity: 'critical',
    condition: 'no_progress_for > 10m',
    windowMs: 10 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000,
  },
  {
    name: 'high_error_rate',
    description: 'Error rate exceeds threshold',
    severity: 'critical',
    condition: 'error_rate > 10%',
    windowMs: 5 * 60 * 1000,
    cooldownMs: 10 * 60 * 1000,
  },
  {
    name: 'token_budget_exceeded',
    description: 'Session token budget exceeded',
    severity: 'critical',
    condition: 'session_tokens > budget_limit',
    cooldownMs: 30 * 60 * 1000,
  },
  {
    name: 'slow_agent',
    description: 'Agent response time is slow',
    severity: 'warning',
    condition: 'agent_p95_latency > 60s',
    windowMs: 5 * 60 * 1000,
    cooldownMs: 10 * 60 * 1000,
  },
  {
    name: 'low_coverage',
    description: 'Test coverage below threshold',
    severity: 'warning',
    condition: 'test_coverage < 70%',
    cooldownMs: 60 * 60 * 1000,
  },
  {
    name: 'agent_failure',
    description: 'Agent invocation failed',
    severity: 'warning',
    condition: 'agent_status = failure',
    cooldownMs: 5 * 60 * 1000,
  },
];

/**
 * Default escalation check interval (1 minute)
 */
const DEFAULT_ESCALATION_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Alert manager for monitoring and notification
 */
export class AlertManager {
  private readonly alertsDir: string;
  private readonly maxHistorySize: number;
  private readonly consoleAlerts: boolean;
  private readonly alerts: Map<string, AlertDefinition> = new Map();
  private readonly handlers: AlertHandler[] = [];
  private readonly history: AlertEventWithEscalation[] = [];
  private readonly lastFired: Map<string, number> = new Map();
  private readonly unacknowledgedAlerts: Map<string, AlertEventWithEscalation> = new Map();
  private escalationTimer: NodeJS.Timeout | null = null;
  private readonly escalationCheckIntervalMs: number;

  constructor(options: AlertManagerOptions = {}) {
    this.alertsDir = options.alertsDir ?? DEFAULT_ALERTS_DIR;
    this.maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
    this.consoleAlerts = options.consoleAlerts ?? process.env['NODE_ENV'] !== 'production';
    this.escalationCheckIntervalMs = DEFAULT_ESCALATION_CHECK_INTERVAL_MS;

    this.ensureAlertsDirectory();
    this.loadBuiltinAlerts();
    this.startEscalationChecker();
  }

  /**
   * Ensure the alerts directory exists
   */
  private ensureAlertsDirectory(): void {
    if (!fs.existsSync(this.alertsDir)) {
      fs.mkdirSync(this.alertsDir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Load builtin alert definitions
   */
  private loadBuiltinAlerts(): void {
    for (const alert of BUILTIN_ALERTS) {
      this.alerts.set(alert.name, alert);
    }
  }

  /**
   * Register a custom alert definition
   * @param alert - The alert definition to register
   */
  public registerAlert(alert: AlertDefinition): void {
    this.alerts.set(alert.name, alert);
  }

  /**
   * Unregister an alert definition
   * @param name - The name of the alert to unregister
   * @returns True if the alert was removed, false if it didn't exist
   */
  public unregisterAlert(name: string): boolean {
    return this.alerts.delete(name);
  }

  /**
   * Get an alert definition by name
   * @param name - The name of the alert to retrieve
   * @returns The alert definition if found, undefined otherwise
   */
  public getAlert(name: string): AlertDefinition | undefined {
    return this.alerts.get(name);
  }

  /**
   * Get all registered alerts
   * @returns Array of all registered alert definitions
   */
  public getAllAlerts(): AlertDefinition[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Register an alert handler
   * @param handler - The callback function to invoke when alerts are fired
   */
  public addHandler(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove an alert handler
   * @param handler - The handler function to remove
   * @returns True if the handler was removed, false if it wasn't found
   */
  public removeHandler(handler: AlertHandler): boolean {
    const index = this.handlers.indexOf(handler);
    if (index >= 0) {
      this.handlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Check if alert is in cooldown
   * @param alertName - The name of the alert to check
   * @returns True if the alert is in its cooldown period
   */
  private isInCooldown(alertName: string): boolean {
    const lastTime = this.lastFired.get(alertName);
    if (lastTime === undefined) return false;

    const alert = this.alerts.get(alertName);
    const cooldown = alert?.cooldownMs ?? DEFAULT_COOLDOWN_MS;

    return Date.now() - lastTime < cooldown;
  }

  /**
   * Fire an alert
   * @param name - The name of the alert to fire
   * @param message - Human-readable description of the alert event
   * @param context - Additional context data for the alert
   * @param severityOverride - Optional severity level to override the alert definition's severity
   * @returns True if the alert was fired, false if it was in cooldown
   */
  public fire(
    name: string,
    message: string,
    context?: Record<string, unknown>,
    severityOverride?: AlertSeverity
  ): boolean {
    const alertDef = this.alerts.get(name);
    if (alertDef === undefined) {
      // Create ad-hoc alert for unknown alert names
      return this.fireAdHoc(name, message, severityOverride ?? 'warning', context);
    }

    if (this.isInCooldown(name)) {
      return false;
    }

    const event: AlertEventWithEscalation = {
      name,
      severity: severityOverride ?? alertDef.severity,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      escalationLevel: 0,
    };

    if (context !== undefined) {
      (event as { context?: Record<string, unknown> }).context = context;
    }

    this.processAlert(event);
    this.lastFired.set(name, Date.now());

    // Track for escalation if alert has escalation config
    if (alertDef.escalation !== undefined) {
      this.unacknowledgedAlerts.set(name, event);
    }

    return true;
  }

  /**
   * Fire an ad-hoc alert without a definition
   * @param name - Unique name for the ad-hoc alert
   * @param message - Human-readable description of the alert event
   * @param severity - Severity level for the alert
   * @param context - Additional context data for the alert
   * @returns True if the alert was fired, false if it was in cooldown
   */
  public fireAdHoc(
    name: string,
    message: string,
    severity: AlertSeverity,
    context?: Record<string, unknown>
  ): boolean {
    if (this.isInCooldown(name)) {
      return false;
    }

    const event: AlertEvent = {
      name,
      severity,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    if (context !== undefined) {
      (event as { context?: Record<string, unknown> }).context = context;
    }

    this.processAlert(event);
    this.lastFired.set(name, Date.now());
    return true;
  }

  /**
   * Fire a critical alert
   * @param name - The name of the alert to fire
   * @param message - Human-readable description of the critical event
   * @param context - Additional context data for the alert
   * @returns True if the alert was fired, false if it was in cooldown
   */
  public critical(name: string, message: string, context?: Record<string, unknown>): boolean {
    return this.fire(name, message, context, 'critical');
  }

  /**
   * Fire a warning alert
   * @param name - The name of the alert to fire
   * @param message - Human-readable description of the warning event
   * @param context - Additional context data for the alert
   * @returns True if the alert was fired, false if it was in cooldown
   */
  public warning(name: string, message: string, context?: Record<string, unknown>): boolean {
    return this.fire(name, message, context, 'warning');
  }

  /**
   * Fire an info alert
   * @param name - The name of the alert to fire
   * @param message - Human-readable description of the informational event
   * @param context - Additional context data for the alert
   * @returns True if the alert was fired, false if it was in cooldown
   */
  public info(name: string, message: string, context?: Record<string, unknown>): boolean {
    return this.fire(name, message, context, 'info');
  }

  /**
   * Resolve an alert
   * @param name - The name of the alert to resolve
   * @param message - Optional custom resolution message
   */
  public resolve(name: string, message?: string): void {
    // Remove from unacknowledged alerts
    this.unacknowledgedAlerts.delete(name);

    const event: AlertEventWithEscalation = {
      name,
      severity: 'info',
      message: message ?? `Alert '${name}' resolved`,
      timestamp: new Date().toISOString(),
      resolved: true,
    };

    this.processAlert(event);
  }

  /**
   * Process an alert event
   * @param event - The alert event to process and distribute to handlers
   */
  private processAlert(event: AlertEvent): void {
    // Add to history
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Log to console if enabled
    if (this.consoleAlerts) {
      this.logToConsole(event);
    }

    // Write to file
    this.writeAlertToFile(event);

    // Call handlers
    for (const handler of this.handlers) {
      try {
        void handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Log alert to console
   * @param event - The alert event to log with appropriate formatting
   */
  private logToConsole(event: AlertEvent): void {
    const isResolved = event.resolved === true;
    const icon = isResolved
      ? '\u2713'
      : event.severity === 'critical'
        ? '\u26A0'
        : event.severity === 'warning'
          ? '\u26A0'
          : '\u2139';

    const severityLabel = isResolved ? 'RESOLVED' : event.severity.toUpperCase();
    const message = `[ALERT] ${icon} [${severityLabel}] ${event.name}: ${event.message}`;

    if (event.severity === 'critical' && !isResolved) {
      // eslint-disable-next-line no-console -- Intentional console output for user-facing alerts
      console.error(message);
    } else if (event.severity === 'warning' && !isResolved) {
      // eslint-disable-next-line no-console -- Intentional console output for user-facing alerts
      console.warn(message);
    } else {
      // eslint-disable-next-line no-console -- Intentional console output for user-facing alerts
      console.log(message);
    }
  }

  /**
   * Write alert to file
   * @param event - The alert event to persist to the alerts.jsonl file
   */
  private writeAlertToFile(event: AlertEvent): void {
    const filename = path.join(this.alertsDir, 'alerts.jsonl');

    try {
      fs.appendFileSync(filename, JSON.stringify(event) + '\n', { mode: 0o644 });
    } catch {
      // Ignore write errors
    }
  }

  /**
   * Get alert history
   * @param limit - Maximum number of recent alerts to return
   * @returns Array of alert events in reverse chronological order
   */
  public getHistory(limit?: number): AlertEvent[] {
    const entries = [...this.history].reverse();
    return limit !== undefined ? entries.slice(0, limit) : entries;
  }

  /**
   * Get alerts by severity
   * @param severity - The severity level to filter by
   * @param limit - Maximum number of alerts to return (default: 50)
   * @returns Array of unresolved alerts matching the severity level
   */
  public getAlertsBySeverity(severity: AlertSeverity, limit = 50): AlertEvent[] {
    return this.history
      .filter((e) => e.severity === severity && e.resolved !== true)
      .reverse()
      .slice(0, limit);
  }

  /**
   * Get active (unresolved) alerts
   * @returns Array of currently active alerts
   */
  public getActiveAlerts(): AlertEvent[] {
    const active: Map<string, AlertEvent> = new Map();

    for (const event of this.history) {
      if (event.resolved === true) {
        active.delete(event.name);
      } else {
        active.set(event.name, event);
      }
    }

    return Array.from(active.values());
  }

  /**
   * Get critical alerts count
   * @returns Number of active critical alerts
   */
  public getCriticalCount(): number {
    return this.getActiveAlerts().filter((e) => e.severity === 'critical').length;
  }

  /**
   * Get warning alerts count
   * @returns Number of active warning alerts
   */
  public getWarningCount(): number {
    return this.getActiveAlerts().filter((e) => e.severity === 'warning').length;
  }

  /**
   * Clear alert history
   */
  public clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Reset cooldowns
   */
  public resetCooldowns(): void {
    this.lastFired.clear();
  }

  /**
   * Get the alerts directory
   * @returns Absolute path to the alerts directory
   */
  public getAlertsDir(): string {
    return this.alertsDir;
  }

  /**
   * Start the escalation checker timer
   */
  private startEscalationChecker(): void {
    if (this.escalationTimer !== null) {
      return;
    }

    this.escalationTimer = setInterval(() => {
      this.checkEscalations();
    }, this.escalationCheckIntervalMs);

    // Ensure timer doesn't prevent process exit
    this.escalationTimer.unref();
  }

  /**
   * Stop the escalation checker timer
   */
  public stopEscalationChecker(): void {
    if (this.escalationTimer !== null) {
      clearInterval(this.escalationTimer);
      this.escalationTimer = null;
    }
  }

  /**
   * Check all unacknowledged alerts for escalation
   */
  private checkEscalations(): void {
    const now = Date.now();

    for (const [alertName, event] of this.unacknowledgedAlerts) {
      const alertDef = this.alerts.get(alertName);
      if (alertDef?.escalation === undefined) {
        continue;
      }

      const escalation = alertDef.escalation;
      const eventTime = new Date(event.timestamp).getTime();
      const lastEscalatedTime =
        event.lastEscalatedAt !== undefined && event.lastEscalatedAt !== ''
          ? new Date(event.lastEscalatedAt).getTime()
          : eventTime;

      const timeSinceLastEscalation = now - lastEscalatedTime;
      const currentLevel = event.escalationLevel ?? 0;
      const maxEscalations = escalation.maxEscalations ?? 3;

      if (timeSinceLastEscalation >= escalation.escalateAfterMs && currentLevel < maxEscalations) {
        this.escalateAlert(alertName, event, escalation);
      }
    }
  }

  /**
   * Escalate an alert
   * @param alertName - The name of the alert to escalate
   * @param event - The current alert event to escalate
   * @param escalation - The escalation configuration defining severity and limits
   */
  private escalateAlert(
    alertName: string,
    event: AlertEventWithEscalation,
    escalation: AlertEscalationConfig
  ): void {
    const newLevel = (event.escalationLevel ?? 0) + 1;
    const escalatedEvent: AlertEventWithEscalation = {
      name: alertName,
      severity: escalation.escalateTo,
      message: `[ESCALATED L${String(newLevel)}] ${event.message}`,
      timestamp: new Date().toISOString(),
      escalationLevel: newLevel,
      lastEscalatedAt: new Date().toISOString(),
    };

    if (event.context !== undefined) {
      (escalatedEvent as { context?: Record<string, unknown> }).context = event.context;
    }

    // Update the unacknowledged alert
    this.unacknowledgedAlerts.set(alertName, escalatedEvent);

    // Process the escalated alert
    this.processAlert(escalatedEvent);

    // Log escalation
    if (this.consoleAlerts) {
      // eslint-disable-next-line no-console -- Intentional console output for user-facing alerts
      console.warn(
        `[ALERT] \u26A0 Alert '${alertName}' escalated to level ${String(newLevel)} (${escalation.escalateTo})`
      );
    }
  }

  /**
   * Acknowledge an alert to prevent further escalation
   * @param alertName - The name of the alert to acknowledge
   * @returns True if the alert was acknowledged, false if it wasn't found
   */
  public acknowledge(alertName: string): boolean {
    const event = this.unacknowledgedAlerts.get(alertName);
    if (event === undefined) {
      return false;
    }

    const acknowledgedEvent: AlertEventWithEscalation = {
      ...event,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    };

    // Remove from unacknowledged map
    this.unacknowledgedAlerts.delete(alertName);

    // Add to history
    this.history.push(acknowledgedEvent);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    if (this.consoleAlerts) {
      // eslint-disable-next-line no-console -- Intentional console output for user-facing alerts
      console.log(`[ALERT] \u2713 Alert '${alertName}' acknowledged`);
    }

    return true;
  }

  /**
   * Get all unacknowledged alerts
   * @returns Array of alerts that have not been acknowledged
   */
  public getUnacknowledgedAlerts(): AlertEventWithEscalation[] {
    return Array.from(this.unacknowledgedAlerts.values());
  }

  /**
   * Get unacknowledged alerts that need escalation soon
   * @param withinMs - Time window in milliseconds to check for upcoming escalations
   * @returns Array of alerts that will escalate within the specified time window
   */
  public getAlertsNeedingEscalation(withinMs: number): AlertEventWithEscalation[] {
    const now = Date.now();
    const result: AlertEventWithEscalation[] = [];

    for (const [alertName, event] of this.unacknowledgedAlerts) {
      const alertDef = this.alerts.get(alertName);
      if (alertDef?.escalation === undefined) {
        continue;
      }

      const lastEscalatedTime =
        event.lastEscalatedAt !== undefined && event.lastEscalatedAt !== ''
          ? new Date(event.lastEscalatedAt).getTime()
          : new Date(event.timestamp).getTime();

      const timeSinceLastEscalation = now - lastEscalatedTime;
      const timeToEscalation = alertDef.escalation.escalateAfterMs - timeSinceLastEscalation;

      if (timeToEscalation > 0 && timeToEscalation <= withinMs) {
        result.push(event);
      }
    }

    return result;
  }

  /**
   * Create a type-safe alert condition
   * @param metric - The metric name to evaluate
   * @param operator - The comparison operator to use
   * @param threshold - The threshold value to compare against
   * @param unit - Optional unit for the threshold (e.g., 's', 'm', '%')
   * @returns A typed alert condition object
   */
  public static createCondition(
    metric: AlertConditionTyped['metric'],
    operator: AlertConditionTyped['operator'],
    threshold: number | string,
    unit?: string
  ): AlertConditionTyped {
    const condition: AlertConditionTyped = { metric, operator, threshold };
    if (unit !== undefined) {
      (condition as { unit?: string }).unit = unit;
    }
    return condition;
  }

  /**
   * Parse a legacy condition string to typed condition
   * @param condition - The condition string to parse (e.g., "error_rate > 10%")
   * @returns A typed alert condition object, or null if parsing failed
   */
  public static parseConditionString(condition: string): AlertConditionTyped | null {
    // Pattern: metric operator value[unit]
    // Examples: "no_progress_for > 10m", "error_rate > 10%", "agent_status = failure"
    const patterns: Array<{
      regex: RegExp;
      metric: AlertConditionTyped['metric'];
    }> = [
      { regex: /no_progress_for\s*([><=!]+)\s*(\d+)(\w+)?/i, metric: 'no_progress_for' },
      { regex: /error_rate\s*([><=!]+)\s*(\d+)(%)?/i, metric: 'error_rate' },
      { regex: /session_tokens\s*([><=!]+)\s*(\w+)/i, metric: 'session_tokens' },
      { regex: /agent_p95_latency\s*([><=!]+)\s*(\d+)(\w+)?/i, metric: 'agent_p95_latency' },
      { regex: /test_coverage\s*([<>=!]+)\s*(\d+)(%)?/i, metric: 'test_coverage' },
      { regex: /agent_status\s*([=!]+)\s*(\w+)/i, metric: 'agent_status' },
    ];

    for (const { regex, metric } of patterns) {
      const match = condition.match(regex);
      if (match !== null) {
        const operatorStr = match[1] ?? '=';
        const threshold = match[2] ?? '';
        const unit = match[3];

        const operator = AlertManager.normalizeOperator(operatorStr);
        if (operator === null) {
          continue;
        }

        const thresholdValue = /^\d+$/.test(threshold) ? parseInt(threshold, 10) : threshold;

        const condition: AlertConditionTyped = {
          metric,
          operator,
          threshold: thresholdValue,
        };
        if (unit !== undefined) {
          (condition as { unit?: string }).unit = unit;
        }
        return condition;
      }
    }

    return null;
  }

  /**
   * Normalize operator string to typed operator
   * @param op - The operator string to normalize (e.g., '>', '==', '!=')
   * @returns A normalized typed operator, or null if invalid
   */
  private static normalizeOperator(op: string): AlertConditionTyped['operator'] | null {
    const normalized = op.trim();
    const operatorMap: Record<string, AlertConditionTyped['operator']> = {
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
      '=': '=',
      '==': '=',
      '!=': '!=',
      '<>': '!=',
    };

    return operatorMap[normalized] ?? null;
  }

  /**
   * Evaluate a typed condition against current metrics
   * @param condition - The alert condition to evaluate
   * @param metrics - The current metrics values to compare against
   * @returns True if the condition is met, false otherwise
   */
  public evaluateCondition(
    condition: AlertConditionTyped,
    metrics: Record<string, number | string>
  ): boolean {
    const metricValue = metrics[condition.metric] ?? metrics[condition.customMetric ?? ''];
    if (metricValue === undefined) {
      return false;
    }

    const threshold = condition.threshold;

    switch (condition.operator) {
      case '>':
        return typeof metricValue === 'number' && typeof threshold === 'number'
          ? metricValue > threshold
          : false;
      case '>=':
        return typeof metricValue === 'number' && typeof threshold === 'number'
          ? metricValue >= threshold
          : false;
      case '<':
        return typeof metricValue === 'number' && typeof threshold === 'number'
          ? metricValue < threshold
          : false;
      case '<=':
        return typeof metricValue === 'number' && typeof threshold === 'number'
          ? metricValue <= threshold
          : false;
      case '=':
        return metricValue === threshold;
      case '!=':
        return metricValue !== threshold;
      case 'contains':
        return typeof metricValue === 'string' && typeof threshold === 'string'
          ? metricValue.includes(threshold)
          : false;
      case 'not_contains':
        return typeof metricValue === 'string' && typeof threshold === 'string'
          ? !metricValue.includes(threshold)
          : false;
      default:
        return false;
    }
  }

  /**
   * Fire an alert if its typed condition evaluates to true
   * @param name - The name of the alert to potentially fire
   * @param message - Human-readable description of the alert event
   * @param metrics - Current metrics values to evaluate the condition against
   * @param context - Additional context data for the alert
   * @returns True if the condition was met and alert was fired, false otherwise
   */
  public fireIfConditionMet(
    name: string,
    message: string,
    metrics: Record<string, number | string>,
    context?: Record<string, unknown>
  ): boolean {
    const alertDef = this.alerts.get(name);
    if (alertDef === undefined) {
      return false;
    }

    // Use typed condition if available, otherwise parse string condition
    const condition =
      alertDef.conditionTyped ?? AlertManager.parseConditionString(alertDef.condition);
    if (condition === null) {
      // If we can't parse the condition, fire the alert
      return this.fire(name, message, context);
    }

    if (this.evaluateCondition(condition, metrics)) {
      return this.fire(name, message, context);
    }

    return false;
  }

  /**
   * Register an alert with type-safe condition
   * @param name - Unique name for the alert
   * @param description - Human-readable description of what the alert monitors
   * @param severity - The severity level for this alert
   * @param condition - Typed condition that determines when the alert fires
   * @param options - Optional configuration for window, cooldown, and escalation
   * @param options.windowMs - Time window for evaluating the condition
   * @param options.cooldownMs - Minimum time between alert firings
   * @param options.escalation - Escalation configuration for unacknowledged alerts
   */
  public registerTypedAlert(
    name: string,
    description: string,
    severity: AlertSeverity,
    condition: AlertConditionTyped,
    options?: {
      windowMs?: number;
      cooldownMs?: number;
      escalation?: AlertEscalationConfig;
    }
  ): void {
    const conditionString = `${condition.metric} ${condition.operator} ${String(condition.threshold)}${condition.unit ?? ''}`;

    const alert: AlertDefinition = {
      name,
      description,
      severity,
      condition: conditionString,
      conditionTyped: condition,
    };

    if (options?.windowMs !== undefined) {
      (alert as { windowMs?: number }).windowMs = options.windowMs;
    }
    if (options?.cooldownMs !== undefined) {
      (alert as { cooldownMs?: number }).cooldownMs = options.cooldownMs;
    }
    if (options?.escalation !== undefined) {
      (alert as { escalation?: AlertEscalationConfig }).escalation = options.escalation;
    }

    this.alerts.set(name, alert);
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopEscalationChecker();
    this.unacknowledgedAlerts.clear();
  }
}

/**
 * Singleton instance for global access
 */
let globalAlertManager: AlertManager | null = null;

/**
 * Get or create the global AlertManager instance
 * @param options - Optional configuration for the AlertManager
 * @returns The singleton AlertManager instance
 */
export function getAlertManager(options?: AlertManagerOptions): AlertManager {
  if (globalAlertManager === null) {
    globalAlertManager = new AlertManager(options);
  }
  return globalAlertManager;
}

/**
 * Reset the global AlertManager instance (for testing)
 */
export function resetAlertManager(): void {
  globalAlertManager = null;
}
