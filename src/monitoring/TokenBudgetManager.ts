/**
 * TokenBudgetManager - Manages token budgets and enforces limits
 *
 * Features:
 * - Session-based token budgets
 * - Warning thresholds at configurable percentages
 * - Hard limits with graceful handling
 * - Cost-based budget controls
 *
 * NOTE: Per-agent budget isolation is planned.
 * See Issue #248 for implementation details.
 * Currently all agents share a single global budget.
 *
 * TODO(P2): Add budget persistence across sessions
 * Budget state is lost when the process restarts. Consider persisting
 * cumulative usage to the scratchpad for cost tracking over time.
 *
 * TODO(P3): Add budget forecasting based on historical usage
 * Predict budget exhaustion time based on usage patterns to provide
 * early warnings before hitting hard limits.
 */

import type { AlertSeverity } from './types.js';

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

  constructor(config: TokenBudgetConfig = {}) {
    this.config = {
      ...config,
      warningThresholds: config.warningThresholds ?? DEFAULT_WARNING_THRESHOLDS,
      hardLimitThreshold: config.hardLimitThreshold ?? DEFAULT_HARD_LIMIT_THRESHOLD,
      onLimitReached: config.onLimitReached ?? DEFAULT_ON_LIMIT_REACHED,
      allowOverride: config.allowOverride ?? true,
    };
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

    return this.checkBudget();
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
  }

  /**
   * Get warning history
   */
  public getWarningHistory(): readonly BudgetWarning[] {
    return this.warningHistory;
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
