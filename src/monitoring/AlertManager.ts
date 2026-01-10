/**
 * AlertManager - Manages alerts and notifications for critical events
 *
 * Features:
 * - Alert definition and evaluation
 * - Severity levels (critical, warning, info)
 * - Cooldown to prevent alert storms
 * - Alert history tracking
 * - Custom alert handlers
 *
 * NOTE: Alert condition type safety and escalation are planned.
 * See Issue #253 for implementation details.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AlertManagerOptions,
  AlertDefinition,
  AlertEvent,
  AlertHandler,
  AlertSeverity,
} from './types.js';

/**
 * Default alerts directory
 */
const DEFAULT_ALERTS_DIR = '.ad-sdlc/alerts';

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
 * Alert manager for monitoring and notification
 */
export class AlertManager {
  private readonly alertsDir: string;
  private readonly maxHistorySize: number;
  private readonly consoleAlerts: boolean;
  private readonly alerts: Map<string, AlertDefinition> = new Map();
  private readonly handlers: AlertHandler[] = [];
  private readonly history: AlertEvent[] = [];
  private readonly lastFired: Map<string, number> = new Map();

  constructor(options: AlertManagerOptions = {}) {
    this.alertsDir = options.alertsDir ?? DEFAULT_ALERTS_DIR;
    this.maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
    this.consoleAlerts = options.consoleAlerts ?? process.env['NODE_ENV'] !== 'production';

    this.ensureAlertsDirectory();
    this.loadBuiltinAlerts();
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
   */
  public registerAlert(alert: AlertDefinition): void {
    this.alerts.set(alert.name, alert);
  }

  /**
   * Unregister an alert definition
   */
  public unregisterAlert(name: string): boolean {
    return this.alerts.delete(name);
  }

  /**
   * Get an alert definition by name
   */
  public getAlert(name: string): AlertDefinition | undefined {
    return this.alerts.get(name);
  }

  /**
   * Get all registered alerts
   */
  public getAllAlerts(): AlertDefinition[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Register an alert handler
   */
  public addHandler(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Remove an alert handler
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

    const event: AlertEvent = {
      name,
      severity: severityOverride ?? alertDef.severity,
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
   * Fire an ad-hoc alert without a definition
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
   */
  public critical(name: string, message: string, context?: Record<string, unknown>): boolean {
    return this.fire(name, message, context, 'critical');
  }

  /**
   * Fire a warning alert
   */
  public warning(name: string, message: string, context?: Record<string, unknown>): boolean {
    return this.fire(name, message, context, 'warning');
  }

  /**
   * Fire an info alert
   */
  public info(name: string, message: string, context?: Record<string, unknown>): boolean {
    return this.fire(name, message, context, 'info');
  }

  /**
   * Resolve an alert
   */
  public resolve(name: string, message?: string): void {
    const event: AlertEvent = {
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
      console.error(message);
    } else if (event.severity === 'warning' && !isResolved) {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  /**
   * Write alert to file
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
   */
  public getHistory(limit?: number): AlertEvent[] {
    const entries = [...this.history].reverse();
    return limit !== undefined ? entries.slice(0, limit) : entries;
  }

  /**
   * Get alerts by severity
   */
  public getAlertsBySeverity(severity: AlertSeverity, limit = 50): AlertEvent[] {
    return this.history
      .filter((e) => e.severity === severity && e.resolved !== true)
      .reverse()
      .slice(0, limit);
  }

  /**
   * Get active (unresolved) alerts
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
   */
  public getCriticalCount(): number {
    return this.getActiveAlerts().filter((e) => e.severity === 'critical').length;
  }

  /**
   * Get warning alerts count
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
   */
  public getAlertsDir(): string {
    return this.alertsDir;
  }
}

/**
 * Singleton instance for global access
 */
let globalAlertManager: AlertManager | null = null;

/**
 * Get or create the global AlertManager instance
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
