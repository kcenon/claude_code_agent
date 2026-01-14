/**
 * TokenBudgetManager - Manages token budgets and enforces limits
 *
 * Features:
 * - Session-based token budgets
 * - Warning thresholds at configurable percentages
 * - Hard limits with graceful handling
 * - Cost-based budget controls
 * - Dynamic budget adjustment for reallocation between agents
 * - Budget persistence across sessions
 *
 * Per-agent budget isolation is implemented via AgentBudgetRegistry.
 * See AgentBudgetRegistry for managing multiple agent budgets with
 * budget transfer capabilities between agents.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AlertSeverity,
  BudgetPersistenceState,
  UsageRecord,
  ForecastConfig,
  BudgetForecast,
  ProjectedOverageAlert,
} from './types.js';

/**
 * Budget threshold configuration
 */
export interface BudgetThreshold {
  /** Percentage of budget (0-100) */
  readonly percentage: number;
  /** Severity level for the alert */
  readonly severity: AlertSeverity;
  /** Whether this is a hard limit that blocks execution */
  readonly hardLimit: boolean;
}

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  /** Maximum tokens per session (input + output) */
  readonly sessionTokenLimit?: number;
  /** Maximum cost per session in USD */
  readonly sessionCostLimitUsd?: number;
  /** Warning thresholds (default: 50%, 75%, 90%) */
  readonly warningThresholds?: readonly number[];
  /** Hard limit threshold percentage (default: 100%) */
  readonly hardLimitThreshold?: number;
  /** Custom threshold configurations */
  readonly customThresholds?: readonly BudgetThreshold[];
  /** Action when limit is reached */
  readonly onLimitReached?: BudgetAction;
  /** Allow override of hard limits */
  readonly allowOverride?: boolean;
  /** Enable budget persistence across sessions */
  readonly enablePersistence?: boolean;
  /** Directory for storing budget state */
  readonly persistenceDir?: string;
  /** Session ID for persistence (auto-generated if not provided) */
  readonly sessionId?: string;
  /** Budget forecasting configuration */
  readonly forecastConfig?: ForecastConfig;
  /** Maximum number of usage records to keep in history */
  readonly maxHistorySize?: number;
}

/**
 * Budget status information
 */
export interface BudgetStatus {
  /** Current token usage */
  readonly currentTokens: number;
  /** Current cost in USD */
  readonly currentCostUsd: number;
  /** Token limit if set */
  readonly tokenLimit?: number;
  /** Cost limit if set */
  readonly costLimitUsd?: number;
  /** Token usage percentage (0-100) */
  readonly tokenUsagePercent: number;
  /** Cost usage percentage (0-100) */
  readonly costUsagePercent: number;
  /** Whether any warning threshold is exceeded */
  readonly warningExceeded: boolean;
  /** Whether hard limit is exceeded */
  readonly limitExceeded: boolean;
  /** Remaining tokens before limit */
  readonly remainingTokens?: number;
  /** Remaining cost before limit */
  readonly remainingCostUsd?: number;
  /** Active warnings */
  readonly activeWarnings: readonly BudgetWarning[];
}

/**
 * Budget warning information
 */
export interface BudgetWarning {
  /** Warning type */
  readonly type: 'token' | 'cost';
  /** Threshold percentage that was exceeded */
  readonly thresholdPercent: number;
  /** Severity level */
  readonly severity: AlertSeverity;
  /** Warning message */
  readonly message: string;
  /** Timestamp of warning */
  readonly timestamp: string;
}

/**
 * Suggested action type
 */
export type BudgetAction = 'continue' | 'pause' | 'terminate';

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  /** Whether the operation is allowed */
  readonly allowed: boolean;
  /** Reason if not allowed */
  readonly reason?: string;
  /** Suggested action */
  readonly suggestedAction?: BudgetAction;
  /** Active warnings */
  readonly warnings: readonly BudgetWarning[];
}

/**
 * Default configuration values
 */
const DEFAULT_WARNING_THRESHOLDS = [50, 75, 90] as const;
const DEFAULT_HARD_LIMIT_THRESHOLD = 100;
const DEFAULT_ON_LIMIT_REACHED = 'pause' as const;
const DEFAULT_PERSISTENCE_DIR = '.ad-sdlc/budget';
const DEFAULT_FORECAST_WINDOW_SIZE = 10;
const DEFAULT_FORECAST_MIN_RECORDS = 3;
const DEFAULT_FORECAST_SMOOTHING_FACTOR = 0.3;
const DEFAULT_MAX_HISTORY_SIZE = 100;

/**
 * TokenBudgetManager class for managing token budgets
 */
export class TokenBudgetManager {
  private readonly config: Required<
    Pick<
      TokenBudgetConfig,
      'warningThresholds' | 'hardLimitThreshold' | 'onLimitReached' | 'allowOverride'
    >
  > &
    TokenBudgetConfig;
  private currentTokens = 0;
  private currentCostUsd = 0;
  private triggeredWarnings: Set<string> = new Set();
  private overrideActive = false;
  private warningHistory: BudgetWarning[] = [];
  private readonly sessionId: string;
  private readonly persistenceEnabled: boolean;
  private readonly persistenceDir: string;
  private usageHistory: UsageRecord[] = [];
  private readonly forecastWindowSize: number;
  private readonly forecastMinRecords: number;
  private readonly forecastSmoothingFactor: number;
  private readonly maxHistorySize: number;
  private projectedOverageAlerts: ProjectedOverageAlert[] = [];
  private triggeredOverageAlerts: Set<string> = new Set();

  constructor(config: TokenBudgetConfig = {}) {
    this.config = {
      ...config,
      warningThresholds: config.warningThresholds ?? DEFAULT_WARNING_THRESHOLDS,
      hardLimitThreshold: config.hardLimitThreshold ?? DEFAULT_HARD_LIMIT_THRESHOLD,
      onLimitReached: config.onLimitReached ?? DEFAULT_ON_LIMIT_REACHED,
      allowOverride: config.allowOverride ?? true,
    };
    this.sessionId = config.sessionId ?? randomUUID();
    this.persistenceEnabled = config.enablePersistence ?? false;
    this.persistenceDir = config.persistenceDir ?? DEFAULT_PERSISTENCE_DIR;

    // Initialize forecasting configuration
    const forecastConfig = config.forecastConfig ?? {};
    this.forecastWindowSize = forecastConfig.windowSize ?? DEFAULT_FORECAST_WINDOW_SIZE;
    this.forecastMinRecords = forecastConfig.minRecordsRequired ?? DEFAULT_FORECAST_MIN_RECORDS;
    this.forecastSmoothingFactor = forecastConfig.smoothingFactor ?? DEFAULT_FORECAST_SMOOTHING_FACTOR;
    this.maxHistorySize = config.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;

    // Try to restore from persistence if enabled
    if (this.persistenceEnabled) {
      this.ensurePersistenceDir();
      this.loadFromPersistence();
    }
  }

  /**
   * Record token usage and check budget
   */
  public recordUsage(
    inputTokens: number,
    outputTokens: number,
    costUsd: number
  ): BudgetCheckResult {
    this.currentTokens += inputTokens + outputTokens;
    this.currentCostUsd += costUsd;

    // Record usage history for forecasting
    this.addUsageRecord(inputTokens, outputTokens, costUsd);

    // Check for projected overage and generate alerts
    this.checkProjectedOverage();

    const result = this.checkBudget();

    // Auto-save to persistence if enabled
    if (this.persistenceEnabled) {
      this.saveToPersistence();
    }

    return result;
  }

  /**
   * Add a usage record to history
   */
  private addUsageRecord(inputTokens: number, outputTokens: number, costUsd: number): void {
    const record: UsageRecord = {
      timestamp: new Date().toISOString(),
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
    };

    this.usageHistory.push(record);

    // Trim history if it exceeds max size
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory = this.usageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Check current budget status
   */
  public checkBudget(): BudgetCheckResult {
    const warnings: BudgetWarning[] = [];
    let limitExceeded = false;

    // Check token limit
    if (this.config.sessionTokenLimit !== undefined) {
      const tokenPercent = (this.currentTokens / this.config.sessionTokenLimit) * 100;

      // Check warning thresholds
      for (const threshold of this.config.warningThresholds) {
        if (tokenPercent >= threshold) {
          const key = `token-${String(threshold)}`;
          if (!this.triggeredWarnings.has(key)) {
            const warning = this.createWarning('token', threshold, tokenPercent);
            warnings.push(warning);
            this.warningHistory.push(warning);
            this.triggeredWarnings.add(key);
          }
        }
      }

      // Check hard limit
      if (tokenPercent >= this.config.hardLimitThreshold) {
        limitExceeded = true;
      }
    }

    // Check cost limit
    if (this.config.sessionCostLimitUsd !== undefined) {
      const costPercent = (this.currentCostUsd / this.config.sessionCostLimitUsd) * 100;

      // Check warning thresholds
      for (const threshold of this.config.warningThresholds) {
        if (costPercent >= threshold) {
          const key = `cost-${String(threshold)}`;
          if (!this.triggeredWarnings.has(key)) {
            const warning = this.createWarning('cost', threshold, costPercent);
            warnings.push(warning);
            this.warningHistory.push(warning);
            this.triggeredWarnings.add(key);
          }
        }
      }

      // Check hard limit
      if (costPercent >= this.config.hardLimitThreshold) {
        limitExceeded = true;
      }
    }

    // Check custom thresholds
    if (this.config.customThresholds !== undefined) {
      for (const threshold of this.config.customThresholds) {
        const tokenLimitForCustom = this.config.sessionTokenLimit;
        const percent =
          tokenLimitForCustom !== undefined && tokenLimitForCustom > 0
            ? (this.currentTokens / tokenLimitForCustom) * 100
            : 0;

        if (percent >= threshold.percentage && threshold.hardLimit) {
          limitExceeded = true;
        }
      }
    }

    // Determine if operation is allowed
    const allowed = !limitExceeded || this.overrideActive;
    const suggestedAction: BudgetAction = limitExceeded ? this.config.onLimitReached : 'continue';

    const result: BudgetCheckResult = {
      allowed,
      suggestedAction: allowed ? 'continue' : suggestedAction,
      warnings,
    };

    if (limitExceeded) {
      (result as { reason?: string }).reason = this.getLimitExceededReason();
    }

    return result;
  }

  /**
   * Get current budget status
   */
  public getStatus(): BudgetStatus {
    const tokenLimit = this.config.sessionTokenLimit;
    const costLimit = this.config.sessionCostLimitUsd;

    const tokenPercent =
      tokenLimit !== undefined && tokenLimit > 0 ? (this.currentTokens / tokenLimit) * 100 : 0;
    const costPercent =
      costLimit !== undefined && costLimit > 0 ? (this.currentCostUsd / costLimit) * 100 : 0;

    const warningExceeded =
      this.config.warningThresholds.some((t) => tokenPercent >= t) ||
      this.config.warningThresholds.some((t) => costPercent >= t);

    const limitExceeded =
      tokenPercent >= this.config.hardLimitThreshold ||
      costPercent >= this.config.hardLimitThreshold;

    const status: BudgetStatus = {
      currentTokens: this.currentTokens,
      currentCostUsd: Math.round(this.currentCostUsd * 10000) / 10000,
      tokenUsagePercent: Math.round(tokenPercent * 100) / 100,
      costUsagePercent: Math.round(costPercent * 100) / 100,
      warningExceeded,
      limitExceeded: limitExceeded && !this.overrideActive,
      activeWarnings: this.warningHistory,
    };

    if (tokenLimit !== undefined) {
      (status as { tokenLimit?: number }).tokenLimit = tokenLimit;
      (status as { remainingTokens?: number }).remainingTokens = Math.max(
        0,
        tokenLimit - this.currentTokens
      );
    }

    if (costLimit !== undefined) {
      (status as { costLimitUsd?: number }).costLimitUsd = costLimit;
      (status as { remainingCostUsd?: number }).remainingCostUsd =
        Math.round(Math.max(0, costLimit - this.currentCostUsd) * 10000) / 10000;
    }

    return status;
  }

  /**
   * Enable override to allow exceeding limits
   */
  public enableOverride(): void {
    if (this.config.allowOverride) {
      this.overrideActive = true;
    }
  }

  /**
   * Disable override
   */
  public disableOverride(): void {
    this.overrideActive = false;
  }

  /**
   * Check if override is active
   */
  public isOverrideActive(): boolean {
    return this.overrideActive;
  }

  /**
   * Reset usage counters
   */
  public reset(): void {
    this.currentTokens = 0;
    this.currentCostUsd = 0;
    this.triggeredWarnings.clear();
    this.overrideActive = false;
    this.warningHistory = [];
    this.usageHistory = [];
    this.projectedOverageAlerts = [];
    this.triggeredOverageAlerts.clear();
  }

  /**
   * Get warning history
   */
  public getWarningHistory(): readonly BudgetWarning[] {
    return this.warningHistory;
  }

  /**
   * Adjust the token limit dynamically
   *
   * Used for budget reallocation between agents.
   *
   * @param newLimit - The new token limit (must be positive or undefined to remove limit)
   * @returns The previous limit value
   */
  public adjustTokenLimit(newLimit: number | undefined): number | undefined {
    const previousLimit = this.config.sessionTokenLimit;
    if (newLimit === undefined) {
      delete (this.config as { sessionTokenLimit?: number }).sessionTokenLimit;
    } else {
      (this.config as { sessionTokenLimit?: number }).sessionTokenLimit = newLimit;
    }
    return previousLimit;
  }

  /**
   * Adjust the cost limit dynamically
   *
   * Used for budget reallocation between agents.
   *
   * @param newLimit - The new cost limit in USD (must be positive or undefined to remove limit)
   * @returns The previous limit value
   */
  public adjustCostLimit(newLimit: number | undefined): number | undefined {
    const previousLimit = this.config.sessionCostLimitUsd;
    if (newLimit === undefined) {
      delete (this.config as { sessionCostLimitUsd?: number }).sessionCostLimitUsd;
    } else {
      (this.config as { sessionCostLimitUsd?: number }).sessionCostLimitUsd = newLimit;
    }
    return previousLimit;
  }

  /**
   * Get current token limit
   */
  public getTokenLimit(): number | undefined {
    return this.config.sessionTokenLimit;
  }

  /**
   * Get current cost limit
   */
  public getCostLimit(): number | undefined {
    return this.config.sessionCostLimitUsd;
  }

  /**
   * Estimate if a request will exceed budget
   */
  public estimateUsage(
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): BudgetCheckResult {
    const estimatedTotal = this.currentTokens + estimatedInputTokens + estimatedOutputTokens;
    const tokenLimit = this.config.sessionTokenLimit;

    if (tokenLimit !== undefined && estimatedTotal > tokenLimit && !this.overrideActive) {
      return {
        allowed: false,
        reason: `Estimated usage (${String(estimatedTotal)} tokens) would exceed limit (${String(tokenLimit)} tokens)`,
        suggestedAction: this.config.onLimitReached,
        warnings: [],
      };
    }

    return {
      allowed: true,
      warnings: [],
    };
  }

  /**
   * Get budget forecast based on historical usage patterns
   */
  public getForecast(): BudgetForecast {
    // Check if we have enough data for forecasting
    if (this.usageHistory.length < this.forecastMinRecords) {
      return {
        available: false,
        unavailableReason: `Insufficient data: ${String(this.usageHistory.length)}/${String(this.forecastMinRecords)} records required`,
      };
    }

    // Get recent records for analysis
    const recentRecords = this.usageHistory.slice(-this.forecastWindowSize);

    // Calculate averages using exponential smoothing
    const { avgTokens, avgCost } = this.calculateSmoothedAverages(recentRecords);

    // Calculate operation rate (operations per millisecond)
    const operationRate = this.calculateOperationRate(recentRecords);

    // Calculate trend
    const trend = this.calculateUsageTrend(recentRecords);

    // Calculate confidence based on data consistency
    const confidence = this.calculateForecastConfidence(recentRecords);

    // Estimate remaining operations and time for tokens
    let estimatedRemainingOperations: number | undefined;
    let estimatedTimeToExhaustionMs: number | undefined;
    let projectedTokenOverage = false;

    const tokenLimit = this.config.sessionTokenLimit;
    if (tokenLimit !== undefined && avgTokens > 0) {
      const remainingTokens = Math.max(0, tokenLimit - this.currentTokens);
      estimatedRemainingOperations = Math.floor(remainingTokens / avgTokens);

      if (operationRate !== undefined && operationRate > 0) {
        estimatedTimeToExhaustionMs = estimatedRemainingOperations / operationRate;
      }

      // Check if projected to exceed in next window operations
      const projectedUsage = this.currentTokens + avgTokens * this.forecastWindowSize;
      projectedTokenOverage = projectedUsage > tokenLimit;
    }

    // Estimate remaining operations and time for cost
    let estimatedRemainingOperationsByCost: number | undefined;
    let estimatedTimeToExhaustionByCostMs: number | undefined;
    let projectedCostOverage = false;

    const costLimit = this.config.sessionCostLimitUsd;
    if (costLimit !== undefined && avgCost > 0) {
      const remainingCost = Math.max(0, costLimit - this.currentCostUsd);
      estimatedRemainingOperationsByCost = Math.floor(remainingCost / avgCost);

      if (operationRate !== undefined && operationRate > 0) {
        estimatedTimeToExhaustionByCostMs = estimatedRemainingOperationsByCost / operationRate;
      }

      // Check if projected to exceed in next window operations
      const projectedCost = this.currentCostUsd + avgCost * this.forecastWindowSize;
      projectedCostOverage = projectedCost > costLimit;
    }

    const forecast: BudgetForecast = {
      available: true,
      avgTokensPerOperation: Math.round(avgTokens),
      avgCostPerOperation: Math.round(avgCost * 100000) / 100000,
      projectedTokenOverage,
      projectedCostOverage,
      usageTrend: trend,
      confidence: Math.round(confidence * 100) / 100,
    };

    if (estimatedRemainingOperations !== undefined) {
      (forecast as { estimatedRemainingOperations?: number }).estimatedRemainingOperations =
        estimatedRemainingOperations;
    }
    if (estimatedTimeToExhaustionMs !== undefined) {
      (forecast as { estimatedTimeToExhaustionMs?: number }).estimatedTimeToExhaustionMs =
        estimatedTimeToExhaustionMs;
    }
    if (estimatedRemainingOperationsByCost !== undefined) {
      (forecast as { estimatedRemainingOperationsByCost?: number }).estimatedRemainingOperationsByCost =
        estimatedRemainingOperationsByCost;
    }
    if (estimatedTimeToExhaustionByCostMs !== undefined) {
      (forecast as { estimatedTimeToExhaustionByCostMs?: number }).estimatedTimeToExhaustionByCostMs =
        estimatedTimeToExhaustionByCostMs;
    }

    return forecast;
  }

  /**
   * Get usage history records
   */
  public getUsageHistory(): readonly UsageRecord[] {
    return this.usageHistory;
  }

  /**
   * Get projected overage alerts
   */
  public getProjectedOverageAlerts(): readonly ProjectedOverageAlert[] {
    return this.projectedOverageAlerts;
  }

  /**
   * Calculate exponentially smoothed averages
   */
  private calculateSmoothedAverages(records: UsageRecord[]): {
    avgTokens: number;
    avgCost: number;
  } {
    const firstRecord = records[0];
    if (records.length === 0 || firstRecord === undefined) {
      return { avgTokens: 0, avgCost: 0 };
    }

    const alpha = this.forecastSmoothingFactor;
    let smoothedTokens = firstRecord.totalTokens;
    let smoothedCost = firstRecord.costUsd;

    for (let i = 1; i < records.length; i++) {
      const record = records[i];
      if (record !== undefined) {
        smoothedTokens = alpha * record.totalTokens + (1 - alpha) * smoothedTokens;
        smoothedCost = alpha * record.costUsd + (1 - alpha) * smoothedCost;
      }
    }

    return {
      avgTokens: smoothedTokens,
      avgCost: smoothedCost,
    };
  }

  /**
   * Calculate operation rate (operations per millisecond)
   */
  private calculateOperationRate(records: UsageRecord[]): number | undefined {
    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];

    if (records.length < 2 || firstRecord === undefined || lastRecord === undefined) {
      return undefined;
    }

    const firstTime = new Date(firstRecord.timestamp).getTime();
    const lastTime = new Date(lastRecord.timestamp).getTime();
    const timeSpanMs = lastTime - firstTime;

    if (timeSpanMs <= 0) {
      return undefined;
    }

    return (records.length - 1) / timeSpanMs;
  }

  /**
   * Calculate usage trend
   */
  private calculateUsageTrend(records: UsageRecord[]): 'increasing' | 'stable' | 'decreasing' {
    if (records.length < 3) {
      return 'stable';
    }

    // Compare first half average to second half average
    const midpoint = Math.floor(records.length / 2);
    const firstHalf = records.slice(0, midpoint);
    const secondHalf = records.slice(midpoint);

    const firstHalfAvg =
      firstHalf.reduce((sum, r) => sum + r.totalTokens, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, r) => sum + r.totalTokens, 0) / secondHalf.length;

    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    // Use 10% threshold for trend detection
    if (changePercent > 10) {
      return 'increasing';
    } else if (changePercent < -10) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Calculate forecast confidence based on data consistency
   */
  private calculateForecastConfidence(records: UsageRecord[]): number {
    if (records.length < 2) {
      return 0;
    }

    const tokens = records.map((r) => r.totalTokens);
    const mean = tokens.reduce((a, b) => a + b, 0) / tokens.length;

    // Calculate coefficient of variation (CV)
    const variance =
      tokens.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / tokens.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;

    // Convert CV to confidence (lower CV = higher confidence)
    // CV of 0 -> confidence 1.0
    // CV of 1 -> confidence 0.5
    // CV of 2+ -> confidence 0.25
    const confidence = Math.max(0.25, 1 / (1 + cv));

    // Adjust for sample size (more data = higher confidence)
    const sampleSizeFactor = Math.min(1, records.length / this.forecastWindowSize);

    return confidence * sampleSizeFactor;
  }

  /**
   * Check for projected overage and generate alerts
   */
  private checkProjectedOverage(): void {
    const forecast = this.getForecast();

    if (!forecast.available) {
      return;
    }

    const timestamp = new Date().toISOString();

    // Check for projected token overage
    if (forecast.projectedTokenOverage === true) {
      const key = 'projected-token-overage';
      if (!this.triggeredOverageAlerts.has(key)) {
        const remainingOps = forecast.estimatedRemainingOperations ?? 0;
        const severity: AlertSeverity = remainingOps <= 5 ? 'critical' : 'warning';

        const alert: ProjectedOverageAlert = {
          type: 'token',
          severity,
          message: `Projected to exceed token budget in approximately ${String(remainingOps)} operations`,
          timestamp,
          estimatedRemainingOperations: remainingOps,
        };

        if (forecast.estimatedTimeToExhaustionMs !== undefined) {
          (alert as { estimatedTimeToExhaustionMs?: number }).estimatedTimeToExhaustionMs =
            forecast.estimatedTimeToExhaustionMs;
        }

        this.projectedOverageAlerts.push(alert);
        this.triggeredOverageAlerts.add(key);
      }
    }

    // Check for projected cost overage
    if (forecast.projectedCostOverage === true) {
      const key = 'projected-cost-overage';
      if (!this.triggeredOverageAlerts.has(key)) {
        const remainingOps = forecast.estimatedRemainingOperationsByCost ?? 0;
        const severity: AlertSeverity = remainingOps <= 5 ? 'critical' : 'warning';

        const alert: ProjectedOverageAlert = {
          type: 'cost',
          severity,
          message: `Projected to exceed cost budget in approximately ${String(remainingOps)} operations`,
          timestamp,
          estimatedRemainingOperations: remainingOps,
        };

        if (forecast.estimatedTimeToExhaustionByCostMs !== undefined) {
          (alert as { estimatedTimeToExhaustionMs?: number }).estimatedTimeToExhaustionMs =
            forecast.estimatedTimeToExhaustionByCostMs;
        }

        this.projectedOverageAlerts.push(alert);
        this.triggeredOverageAlerts.add(key);
      }
    }
  }

  /**
   * Create a warning object
   */
  private createWarning(
    type: 'token' | 'cost',
    thresholdPercent: number,
    currentPercent: number
  ): BudgetWarning {
    const severity = this.getSeverityForThreshold(thresholdPercent);
    const typeLabel = type === 'token' ? 'Token' : 'Cost';

    return {
      type,
      thresholdPercent,
      severity,
      message: `${typeLabel} usage at ${String(Math.round(currentPercent))}% - exceeded ${String(thresholdPercent)}% threshold`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get severity level for a threshold
   */
  private getSeverityForThreshold(threshold: number): AlertSeverity {
    if (threshold >= 90) return 'critical';
    if (threshold >= 75) return 'warning';
    return 'info';
  }

  /**
   * Get reason message for limit exceeded
   */
  private getLimitExceededReason(): string {
    const status = this.getStatus();
    const reasons: string[] = [];

    if (
      status.tokenLimit !== undefined &&
      status.tokenLimit > 0 &&
      status.tokenUsagePercent >= this.config.hardLimitThreshold
    ) {
      reasons.push(
        `Token limit exceeded: ${String(status.currentTokens)}/${String(status.tokenLimit)}`
      );
    }

    if (
      status.costLimitUsd !== undefined &&
      status.costLimitUsd > 0 &&
      status.costUsagePercent >= this.config.hardLimitThreshold
    ) {
      reasons.push(
        `Cost limit exceeded: $${String(status.currentCostUsd)}/$${String(status.costLimitUsd)}`
      );
    }

    return reasons.join('; ') || 'Budget limit exceeded';
  }

  /**
   * Ensure the persistence directory exists
   */
  private ensurePersistenceDir(): void {
    if (!fs.existsSync(this.persistenceDir)) {
      fs.mkdirSync(this.persistenceDir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Get the persistence file path for the current session
   */
  private getPersistenceFilePath(): string {
    return path.join(this.persistenceDir, `budget-${this.sessionId}.json`);
  }

  /**
   * Save current budget state to persistence
   */
  public saveToPersistence(): boolean {
    if (!this.persistenceEnabled) {
      return false;
    }

    try {
      const state: BudgetPersistenceState = {
        sessionId: this.sessionId,
        currentTokens: this.currentTokens,
        currentCostUsd: this.currentCostUsd,
        triggeredWarnings: Array.from(this.triggeredWarnings),
        overrideActive: this.overrideActive,
        savedAt: new Date().toISOString(),
        warningHistory: this.warningHistory.map((w) => ({
          type: w.type,
          thresholdPercent: w.thresholdPercent,
          severity: w.severity,
          message: w.message,
          timestamp: w.timestamp,
        })),
        usageHistory: this.usageHistory,
        triggeredOverageAlerts: Array.from(this.triggeredOverageAlerts),
      };

      if (this.config.sessionTokenLimit !== undefined) {
        (state as { tokenLimit?: number }).tokenLimit = this.config.sessionTokenLimit;
      }
      if (this.config.sessionCostLimitUsd !== undefined) {
        (state as { costLimitUsd?: number }).costLimitUsd = this.config.sessionCostLimitUsd;
      }

      const filePath = this.getPersistenceFilePath();
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), { mode: 0o644 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load budget state from persistence
   */
  public loadFromPersistence(): boolean {
    if (!this.persistenceEnabled) {
      return false;
    }

    try {
      const filePath = this.getPersistenceFilePath();
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const state = JSON.parse(content) as BudgetPersistenceState;

      // Validate session ID matches
      if (state.sessionId !== this.sessionId) {
        return false;
      }

      // Restore state
      this.currentTokens = state.currentTokens;
      this.currentCostUsd = state.currentCostUsd;
      this.triggeredWarnings = new Set(state.triggeredWarnings);
      this.overrideActive = state.overrideActive;
      this.warningHistory = state.warningHistory.map((w) => ({
        type: w.type,
        thresholdPercent: w.thresholdPercent,
        severity: w.severity,
        message: w.message,
        timestamp: w.timestamp,
      }));

      // Restore usage history for forecasting (if available)
      if (state.usageHistory !== undefined) {
        this.usageHistory = [...state.usageHistory];
      }

      // Restore triggered overage alerts (if available)
      if (state.triggeredOverageAlerts !== undefined) {
        this.triggeredOverageAlerts = new Set(state.triggeredOverageAlerts);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete persisted budget state
   */
  public deletePersistence(): boolean {
    if (!this.persistenceEnabled) {
      return false;
    }

    try {
      const filePath = this.getPersistenceFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if persistence is enabled
   */
  public isPersistenceEnabled(): boolean {
    return this.persistenceEnabled;
  }

  /**
   * List all persisted budget sessions
   */
  public static listPersistedSessions(persistenceDir?: string): string[] {
    const dir = persistenceDir ?? DEFAULT_PERSISTENCE_DIR;

    if (!fs.existsSync(dir)) {
      return [];
    }

    try {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith('budget-') && f.endsWith('.json'));

      return files.map((f) => f.replace(/^budget-/, '').replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }

  /**
   * Load a specific persisted session
   */
  public static loadSession(
    sessionId: string,
    persistenceDir?: string
  ): BudgetPersistenceState | null {
    const dir = persistenceDir ?? DEFAULT_PERSISTENCE_DIR;
    const filePath = path.join(dir, `budget-${sessionId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as BudgetPersistenceState;
    } catch {
      return null;
    }
  }

  /**
   * Delete a specific persisted session
   */
  public static deleteSession(sessionId: string, persistenceDir?: string): boolean {
    const dir = persistenceDir ?? DEFAULT_PERSISTENCE_DIR;
    const filePath = path.join(dir, `budget-${sessionId}.json`);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old persisted sessions
   *
   * Removes sessions older than the specified age (in milliseconds)
   */
  public static cleanupOldSessions(olderThanMs: number, persistenceDir?: string): number {
    const dir = persistenceDir ?? DEFAULT_PERSISTENCE_DIR;
    const now = Date.now();
    let deletedCount = 0;

    if (!fs.existsSync(dir)) {
      return 0;
    }

    try {
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith('budget-') && f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > olderThanMs) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    return deletedCount;
  }
}

/**
 * Singleton instance for global access
 */
let globalBudgetManager: TokenBudgetManager | null = null;

/**
 * Get or create the global TokenBudgetManager instance
 */
export function getTokenBudgetManager(config?: TokenBudgetConfig): TokenBudgetManager {
  if (globalBudgetManager === null) {
    globalBudgetManager = new TokenBudgetManager(config);
  }
  return globalBudgetManager;
}

/**
 * Reset the global TokenBudgetManager instance
 */
export function resetTokenBudgetManager(): void {
  globalBudgetManager = null;
}
