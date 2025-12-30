/**
 * BudgetAggregator - Pipeline-level budget aggregation and reporting
 *
 * Provides utilities for aggregating budget data across agents,
 * generating reports, and analyzing cost trends.
 */

import type { PipelineBudgetStatus, AgentCategory } from './AgentTokenBudgetConfig.js';

/**
 * Usage trend data point
 */
export interface UsageTrendPoint {
  /** Timestamp of the measurement */
  readonly timestamp: string;
  /** Total tokens at this point */
  readonly totalTokens: number;
  /** Total cost at this point */
  readonly totalCostUsd: number;
  /** Number of active agents */
  readonly activeAgents: number;
}

/**
 * Agent usage summary
 */
export interface AgentUsageSummary {
  /** Agent name */
  readonly agentName: string;
  /** Agent category if known */
  readonly category?: AgentCategory | undefined;
  /** Total tokens used */
  readonly totalTokens: number;
  /** Total cost in USD */
  readonly totalCostUsd: number;
  /** Percentage of pipeline tokens */
  readonly tokenSharePercent: number;
  /** Percentage of pipeline cost */
  readonly costSharePercent: number;
  /** Budget utilization percentage */
  readonly utilizationPercent: number;
  /** Whether budget was exceeded */
  readonly budgetExceeded: boolean;
}

/**
 * Category usage summary
 */
export interface CategoryUsageSummary {
  /** Category name */
  readonly category: AgentCategory;
  /** Total tokens used by category */
  readonly totalTokens: number;
  /** Total cost in USD */
  readonly totalCostUsd: number;
  /** Number of agents in category */
  readonly agentCount: number;
  /** Percentage of pipeline tokens */
  readonly tokenSharePercent: number;
  /** Percentage of pipeline cost */
  readonly costSharePercent: number;
}

/**
 * Budget optimization suggestion
 */
export interface BudgetOptimizationSuggestion {
  /** Suggestion type */
  readonly type: 'increase' | 'decrease' | 'rebalance' | 'warning';
  /** Target agent or category */
  readonly target: string;
  /** Suggestion message */
  readonly message: string;
  /** Potential savings in USD if applicable */
  readonly potentialSavingsUsd?: number;
  /** Recommended new limit if applicable */
  readonly recommendedLimit?: number;
}

/**
 * Comprehensive budget report
 */
export interface BudgetReport {
  /** Report generation timestamp */
  readonly generatedAt: string;
  /** Pipeline status summary */
  readonly pipelineStatus: PipelineBudgetStatus;
  /** Per-agent usage summaries sorted by cost */
  readonly agentSummaries: readonly AgentUsageSummary[];
  /** Per-category summaries */
  readonly categorySummaries: readonly CategoryUsageSummary[];
  /** Top consumers (by cost) */
  readonly topConsumers: readonly AgentUsageSummary[];
  /** Optimization suggestions */
  readonly suggestions: readonly BudgetOptimizationSuggestion[];
}

/**
 * Agent category mapping for aggregation
 */
export interface AgentCategoryMapping {
  readonly agentName: string;
  readonly category: AgentCategory;
}

/**
 * BudgetAggregator class for pipeline-level reporting
 */
export class BudgetAggregator {
  private usageTrends: UsageTrendPoint[] = [];
  private readonly maxTrendPoints: number;
  private readonly categoryMappings: Map<string, AgentCategory> = new Map();

  constructor(options: { maxTrendPoints?: number } = {}) {
    this.maxTrendPoints = options.maxTrendPoints ?? 100;
  }

  /**
   * Register agent category mapping
   */
  public registerAgentCategory(agentName: string, category: AgentCategory): void {
    this.categoryMappings.set(agentName, category);
  }

  /**
   * Register multiple agent category mappings
   */
  public registerCategoryMappings(mappings: readonly AgentCategoryMapping[]): void {
    for (const mapping of mappings) {
      this.categoryMappings.set(mapping.agentName, mapping.category);
    }
  }

  /**
   * Record a usage trend point
   */
  public recordTrendPoint(status: PipelineBudgetStatus): void {
    const point: UsageTrendPoint = {
      timestamp: status.timestamp,
      totalTokens: status.totalTokens,
      totalCostUsd: status.totalCostUsd,
      activeAgents: status.byAgent.size,
    };

    this.usageTrends.push(point);

    if (this.usageTrends.length > this.maxTrendPoints) {
      this.usageTrends = this.usageTrends.slice(-this.maxTrendPoints);
    }
  }

  /**
   * Get usage trends
   */
  public getUsageTrends(): readonly UsageTrendPoint[] {
    return this.usageTrends;
  }

  /**
   * Clear usage trends
   */
  public clearTrends(): void {
    this.usageTrends = [];
  }

  /**
   * Generate agent usage summaries from pipeline status
   */
  public generateAgentSummaries(status: PipelineBudgetStatus): AgentUsageSummary[] {
    const summaries: AgentUsageSummary[] = [];

    for (const [agentName, agentStatus] of status.byAgent) {
      const tokenSharePercent =
        status.totalTokens > 0 ? (agentStatus.currentTokens / status.totalTokens) * 100 : 0;
      const costSharePercent =
        status.totalCostUsd > 0 ? (agentStatus.currentCostUsd / status.totalCostUsd) * 100 : 0;

      summaries.push({
        agentName,
        category: this.categoryMappings.get(agentName),
        totalTokens: agentStatus.currentTokens,
        totalCostUsd: agentStatus.currentCostUsd,
        tokenSharePercent: Math.round(tokenSharePercent * 100) / 100,
        costSharePercent: Math.round(costSharePercent * 100) / 100,
        utilizationPercent: agentStatus.tokenUsagePercent,
        budgetExceeded: agentStatus.limitExceeded,
      });
    }

    return summaries.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }

  /**
   * Generate category usage summaries
   */
  public generateCategorySummaries(status: PipelineBudgetStatus): CategoryUsageSummary[] {
    const categoryData: Map<AgentCategory, { tokens: number; cost: number; count: number }> =
      new Map();

    for (const [agentName, agentStatus] of status.byAgent) {
      const category = this.categoryMappings.get(agentName);
      if (category === undefined) continue;

      const existing = categoryData.get(category) ?? { tokens: 0, cost: 0, count: 0 };
      existing.tokens += agentStatus.currentTokens;
      existing.cost += agentStatus.currentCostUsd;
      existing.count++;
      categoryData.set(category, existing);
    }

    const summaries: CategoryUsageSummary[] = [];

    for (const [category, data] of categoryData) {
      const tokenSharePercent =
        status.totalTokens > 0 ? (data.tokens / status.totalTokens) * 100 : 0;
      const costSharePercent =
        status.totalCostUsd > 0 ? (data.cost / status.totalCostUsd) * 100 : 0;

      summaries.push({
        category,
        totalTokens: data.tokens,
        totalCostUsd: Math.round(data.cost * 10000) / 10000,
        agentCount: data.count,
        tokenSharePercent: Math.round(tokenSharePercent * 100) / 100,
        costSharePercent: Math.round(costSharePercent * 100) / 100,
      });
    }

    return summaries.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }

  /**
   * Generate optimization suggestions
   */
  public generateSuggestions(
    status: PipelineBudgetStatus,
    agentSummaries: readonly AgentUsageSummary[]
  ): BudgetOptimizationSuggestion[] {
    const suggestions: BudgetOptimizationSuggestion[] = [];

    for (const agentSummary of agentSummaries) {
      const agentStatus = status.byAgent.get(agentSummary.agentName);
      if (agentStatus === undefined) continue;

      if (agentSummary.budgetExceeded) {
        suggestions.push({
          type: 'warning',
          target: agentSummary.agentName,
          message: `Agent "${agentSummary.agentName}" exceeded budget. Consider increasing limit or optimizing usage.`,
        });
      }

      if (agentSummary.utilizationPercent < 20 && agentStatus.tokenLimit !== undefined) {
        const recommendedLimit = Math.ceil(agentStatus.currentTokens * 1.5);
        const savings =
          ((agentStatus.tokenLimit - recommendedLimit) / agentStatus.tokenLimit) *
          (agentStatus.costLimitUsd ?? 0);

        if (recommendedLimit < agentStatus.tokenLimit * 0.5) {
          suggestions.push({
            type: 'decrease',
            target: agentSummary.agentName,
            message: `Agent "${agentSummary.agentName}" using only ${String(Math.round(agentSummary.utilizationPercent))}% of budget. Consider reducing limit.`,
            potentialSavingsUsd: Math.round(savings * 100) / 100,
            recommendedLimit,
          });
        }
      }

      if (agentSummary.utilizationPercent > 90 && !agentSummary.budgetExceeded) {
        const recommendedLimit = Math.ceil(agentStatus.currentTokens * 1.3);
        suggestions.push({
          type: 'increase',
          target: agentSummary.agentName,
          message: `Agent "${agentSummary.agentName}" at ${String(Math.round(agentSummary.utilizationPercent))}% utilization. Consider increasing limit to avoid interruptions.`,
          recommendedLimit,
        });
      }
    }

    if (agentSummaries.length >= 2) {
      const topCost = agentSummaries[0];
      const secondCost = agentSummaries[1];

      if (
        topCost !== undefined &&
        secondCost !== undefined &&
        topCost.costSharePercent > 50 &&
        topCost.costSharePercent > secondCost.costSharePercent * 3
      ) {
        suggestions.push({
          type: 'rebalance',
          target: topCost.agentName,
          message: `Agent "${topCost.agentName}" consuming ${String(Math.round(topCost.costSharePercent))}% of total cost. Consider optimizing or redistributing work.`,
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate a comprehensive budget report
   */
  public generateReport(status: PipelineBudgetStatus): BudgetReport {
    const agentSummaries = this.generateAgentSummaries(status);
    const categorySummaries = this.generateCategorySummaries(status);
    const suggestions = this.generateSuggestions(status, agentSummaries);

    return {
      generatedAt: new Date().toISOString(),
      pipelineStatus: status,
      agentSummaries,
      categorySummaries,
      topConsumers: agentSummaries.slice(0, 5),
      suggestions,
    };
  }

  /**
   * Format report as a readable string
   */
  public formatReportAsString(report: BudgetReport): string {
    const lines: string[] = [
      '╔════════════════════════════════════════════════════════════╗',
      '║              PIPELINE BUDGET REPORT                        ║',
      '╚════════════════════════════════════════════════════════════╝',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      '─── Pipeline Summary ───────────────────────────────────────',
      `Total Tokens: ${String(report.pipelineStatus.totalTokens).padStart(10)} / ${String(report.pipelineStatus.totalTokenLimit ?? 'unlimited')}`,
      `Total Cost:   $${String(report.pipelineStatus.totalCostUsd).padStart(9)} / $${String(report.pipelineStatus.totalCostLimitUsd ?? 'unlimited')}`,
      `Status:       ${report.pipelineStatus.limitExceeded ? '❌ EXCEEDED' : report.pipelineStatus.warningExceeded ? '⚠️  WARNING' : '✓  OK'}`,
      '',
    ];

    if (report.topConsumers.length > 0) {
      lines.push('─── Top Consumers ──────────────────────────────────────────');
      for (const agent of report.topConsumers) {
        const statusIcon = agent.budgetExceeded ? '❌' : '✓';
        lines.push(
          `${statusIcon} ${agent.agentName.padEnd(20)} ${String(agent.totalTokens).padStart(8)} tokens  $${String(agent.totalCostUsd).padStart(6)}  (${String(Math.round(agent.costSharePercent))}%)`
        );
      }
      lines.push('');
    }

    if (report.categorySummaries.length > 0) {
      lines.push('─── By Category ────────────────────────────────────────────');
      for (const category of report.categorySummaries) {
        lines.push(
          `${category.category.padEnd(15)} ${String(category.agentCount)} agents  ${String(category.totalTokens).padStart(8)} tokens  $${String(category.totalCostUsd).padStart(6)}  (${String(Math.round(category.costSharePercent))}%)`
        );
      }
      lines.push('');
    }

    if (report.suggestions.length > 0) {
      lines.push('─── Suggestions ────────────────────────────────────────────');
      for (const suggestion of report.suggestions) {
        const icon =
          suggestion.type === 'warning'
            ? '⚠️'
            : suggestion.type === 'increase'
              ? '📈'
              : suggestion.type === 'decrease'
                ? '📉'
                : '⚖️';
        lines.push(`${icon} ${suggestion.message}`);
        if (suggestion.potentialSavingsUsd !== undefined) {
          lines.push(`   Potential savings: $${String(suggestion.potentialSavingsUsd)}`);
        }
        if (suggestion.recommendedLimit !== undefined) {
          lines.push(`   Recommended limit: ${String(suggestion.recommendedLimit)} tokens`);
        }
      }
    }

    lines.push('');
    lines.push('════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

/**
 * Singleton instance for global access
 */
let globalBudgetAggregator: BudgetAggregator | null = null;

/**
 * Get or create the global BudgetAggregator instance
 */
export function getBudgetAggregator(options?: { maxTrendPoints?: number }): BudgetAggregator {
  if (globalBudgetAggregator === null) {
    globalBudgetAggregator = new BudgetAggregator(options);
  }
  return globalBudgetAggregator;
}

/**
 * Reset the global BudgetAggregator instance
 */
export function resetBudgetAggregator(): void {
  globalBudgetAggregator = null;
}
