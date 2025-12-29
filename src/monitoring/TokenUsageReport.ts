/**
 * TokenUsageReport - Generates detailed token usage reports with recommendations
 *
 * Features:
 * - Comprehensive usage breakdown by agent, stage, and model
 * - Cost analysis with trending
 * - Optimization recommendations
 * - Export to multiple formats
 */

import type { TokenUsageMetrics, AgentMetrics, StageDuration } from './types.js';

/**
 * Token usage by model
 */
export interface ModelUsage {
  /** Model name */
  readonly model: string;
  /** Input tokens */
  readonly inputTokens: number;
  /** Output tokens */
  readonly outputTokens: number;
  /** Total tokens */
  readonly totalTokens: number;
  /** Cost in USD */
  readonly costUsd: number;
  /** Percentage of total usage */
  readonly percentageOfTotal: number;
}

/**
 * Usage trend data point
 */
export interface UsageTrendPoint {
  /** Timestamp */
  readonly timestamp: string;
  /** Tokens used */
  readonly tokens: number;
  /** Cost in USD */
  readonly costUsd: number;
  /** Cumulative tokens */
  readonly cumulativeTokens: number;
  /** Cumulative cost */
  readonly cumulativeCostUsd: number;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Recommendation type */
  readonly type: 'model' | 'caching' | 'pruning' | 'batching' | 'general';
  /** Priority (1-5, 1 = highest) */
  readonly priority: number;
  /** Recommendation title */
  readonly title: string;
  /** Detailed description */
  readonly description: string;
  /** Estimated savings in USD */
  readonly estimatedSavingsUsd?: number;
  /** Estimated token reduction */
  readonly estimatedTokenReduction?: number;
  /** Implementation difficulty */
  readonly difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Report summary
 */
export interface ReportSummary {
  /** Session ID */
  readonly sessionId: string;
  /** Report generation timestamp */
  readonly generatedAt: string;
  /** Session duration in milliseconds */
  readonly sessionDurationMs: number;
  /** Total tokens used */
  readonly totalTokens: number;
  /** Total cost in USD */
  readonly totalCostUsd: number;
  /** Average tokens per minute */
  readonly tokensPerMinute: number;
  /** Average cost per minute */
  readonly costPerMinute: number;
  /** Most expensive agent */
  readonly mostExpensiveAgent?: string;
  /** Most token-heavy stage */
  readonly mostTokenHeavyStage?: string;
}

/**
 * Full token usage report
 */
export interface TokenUsageReportData {
  /** Report summary */
  readonly summary: ReportSummary;
  /** Token usage metrics */
  readonly tokenUsage: TokenUsageMetrics;
  /** Usage by model */
  readonly byModel: readonly ModelUsage[];
  /** Usage by agent */
  readonly byAgent: readonly AgentUsageDetail[];
  /** Usage by stage */
  readonly byStage: readonly StageUsageDetail[];
  /** Usage trends */
  readonly trends: readonly UsageTrendPoint[];
  /** Optimization recommendations */
  readonly recommendations: readonly OptimizationRecommendation[];
}

/**
 * Agent usage detail
 */
export interface AgentUsageDetail {
  /** Agent name */
  readonly agent: string;
  /** Input tokens */
  readonly inputTokens: number;
  /** Output tokens */
  readonly outputTokens: number;
  /** Total tokens */
  readonly totalTokens: number;
  /** Cost in USD */
  readonly costUsd: number;
  /** Invocation count */
  readonly invocations: number;
  /** Average tokens per invocation */
  readonly avgTokensPerInvocation: number;
  /** Percentage of total */
  readonly percentageOfTotal: number;
}

/**
 * Stage usage detail
 */
export interface StageUsageDetail {
  /** Stage name */
  readonly stage: string;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Tokens used */
  readonly tokens: number;
  /** Cost in USD */
  readonly costUsd: number;
  /** Tokens per second */
  readonly tokensPerSecond: number;
}

/**
 * Report configuration
 */
export interface TokenUsageReportConfig {
  /** Include recommendations */
  readonly includeRecommendations?: boolean;
  /** Include trends */
  readonly includeTrends?: boolean;
  /** Trend granularity in milliseconds */
  readonly trendGranularityMs?: number;
  /** Minimum savings threshold for recommendations (USD) */
  readonly minSavingsThreshold?: number;
}

/**
 * Token pricing for cost calculation
 */
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.015, output: 0.075 },
  haiku: { input: 0.00025, output: 0.00125 },
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TokenUsageReportConfig> = {
  includeRecommendations: true,
  includeTrends: true,
  trendGranularityMs: 60000, // 1 minute
  minSavingsThreshold: 0.01,
};

/**
 * TokenUsageReport class for generating reports
 */
export class TokenUsageReport {
  private readonly config: Required<TokenUsageReportConfig>;
  private readonly sessionId: string;
  private readonly sessionStartTime: Date;
  private readonly trendData: UsageTrendPoint[] = [];

  constructor(sessionId: string, config: TokenUsageReportConfig = {}) {
    this.sessionId = sessionId;
    this.sessionStartTime = new Date();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a full report
   */
  public generate(
    tokenUsage: TokenUsageMetrics,
    agentMetrics: readonly AgentMetrics[],
    stageDurations: readonly StageDuration[],
    model = 'sonnet'
  ): TokenUsageReportData {
    const sessionDurationMs = Date.now() - this.sessionStartTime.getTime();

    const summary = this.generateSummary(
      tokenUsage,
      agentMetrics,
      stageDurations,
      sessionDurationMs
    );

    const byModel = this.calculateModelUsage(tokenUsage, model);
    const byAgent = this.calculateAgentUsage(tokenUsage, agentMetrics);
    const byStage = this.calculateStageUsage(stageDurations, tokenUsage);

    const recommendations = this.config.includeRecommendations
      ? this.generateRecommendations(tokenUsage, agentMetrics, byAgent)
      : [];

    return {
      summary,
      tokenUsage,
      byModel,
      byAgent,
      byStage,
      trends: this.trendData,
      recommendations,
    };
  }

  /**
   * Record a trend data point
   */
  public recordTrendPoint(tokens: number, costUsd: number): void {
    if (!this.config.includeTrends) return;

    const lastPoint = this.trendData[this.trendData.length - 1];
    const cumulativeTokens = (lastPoint?.cumulativeTokens ?? 0) + tokens;
    const cumulativeCostUsd = (lastPoint?.cumulativeCostUsd ?? 0) + costUsd;

    this.trendData.push({
      timestamp: new Date().toISOString(),
      tokens,
      costUsd,
      cumulativeTokens,
      cumulativeCostUsd,
    });
  }

  /**
   * Export report to JSON
   */
  public toJSON(report: TokenUsageReportData): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report to Markdown
   */
  public toMarkdown(report: TokenUsageReportData): string {
    const lines: string[] = [];

    lines.push('# Token Usage Report');
    lines.push('');
    lines.push(`**Session ID:** ${report.summary.sessionId}`);
    lines.push(`**Generated:** ${report.summary.generatedAt}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Tokens | ${report.summary.totalTokens.toLocaleString()} |`);
    lines.push(`| Total Cost | $${report.summary.totalCostUsd.toFixed(4)} |`);
    lines.push(`| Duration | ${String(Math.round(report.summary.sessionDurationMs / 1000))}s |`);
    lines.push(`| Tokens/min | ${report.summary.tokensPerMinute.toFixed(0)} |`);
    lines.push('');

    // By Agent
    lines.push('## Usage by Agent');
    lines.push('');
    lines.push(`| Agent | Tokens | Cost | % |`);
    lines.push(`|-------|--------|------|---|`);
    for (const agent of report.byAgent) {
      lines.push(
        `| ${agent.agent} | ${agent.totalTokens.toLocaleString()} | $${agent.costUsd.toFixed(4)} | ${agent.percentageOfTotal.toFixed(1)}% |`
      );
    }
    lines.push('');

    // By Model
    lines.push('## Usage by Model');
    lines.push('');
    lines.push(`| Model | Tokens | Cost | % |`);
    lines.push(`|-------|--------|------|---|`);
    for (const model of report.byModel) {
      lines.push(
        `| ${model.model} | ${model.totalTokens.toLocaleString()} | $${model.costUsd.toFixed(4)} | ${model.percentageOfTotal.toFixed(1)}% |`
      );
    }
    lines.push('');

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('## Optimization Recommendations');
      lines.push('');
      for (const rec of report.recommendations) {
        lines.push(`### ${String(rec.priority)}. ${rec.title}`);
        lines.push('');
        lines.push(rec.description);
        if (rec.estimatedSavingsUsd !== undefined) {
          lines.push(`- **Estimated Savings:** $${rec.estimatedSavingsUsd.toFixed(4)}`);
        }
        lines.push(`- **Difficulty:** ${rec.difficulty}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate summary
   */
  private generateSummary(
    tokenUsage: TokenUsageMetrics,
    _agentMetrics: readonly AgentMetrics[],
    stageDurations: readonly StageDuration[],
    sessionDurationMs: number
  ): ReportSummary {
    const totalTokens = tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens;
    // Ensure minimum duration of 1ms to avoid division by zero
    const effectiveDurationMs = Math.max(sessionDurationMs, 1);
    const durationMinutes = effectiveDurationMs / 60000;

    // Find most expensive agent
    let mostExpensiveAgent: string | undefined;
    let maxAgentCost = 0;
    for (const [agent, usage] of Object.entries(tokenUsage.byAgent)) {
      const cost = this.calculateCost(usage.input, usage.output);
      if (cost > maxAgentCost) {
        maxAgentCost = cost;
        mostExpensiveAgent = agent;
      }
    }

    // Find most token-heavy stage
    let mostTokenHeavyStage: string | undefined;
    let maxStageTokens = 0;
    for (const stage of stageDurations) {
      if (stage.durationMs !== undefined && stage.durationMs > maxStageTokens) {
        maxStageTokens = stage.durationMs;
        mostTokenHeavyStage = stage.stage;
      }
    }

    const summary: ReportSummary = {
      sessionId: this.sessionId,
      generatedAt: new Date().toISOString(),
      sessionDurationMs,
      totalTokens,
      totalCostUsd: tokenUsage.estimatedCostUsd,
      tokensPerMinute: durationMinutes > 0 ? totalTokens / durationMinutes : 0,
      costPerMinute: durationMinutes > 0 ? tokenUsage.estimatedCostUsd / durationMinutes : 0,
    };

    if (mostExpensiveAgent !== undefined) {
      (summary as { mostExpensiveAgent?: string }).mostExpensiveAgent = mostExpensiveAgent;
    }

    if (mostTokenHeavyStage !== undefined) {
      (summary as { mostTokenHeavyStage?: string }).mostTokenHeavyStage = mostTokenHeavyStage;
    }

    return summary;
  }

  /**
   * Calculate usage by model
   */
  private calculateModelUsage(tokenUsage: TokenUsageMetrics, model: string): ModelUsage[] {
    const totalTokens = tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens;
    const cost = this.calculateCost(
      tokenUsage.totalInputTokens,
      tokenUsage.totalOutputTokens,
      model
    );

    return [
      {
        model,
        inputTokens: tokenUsage.totalInputTokens,
        outputTokens: tokenUsage.totalOutputTokens,
        totalTokens,
        costUsd: cost,
        percentageOfTotal: 100,
      },
    ];
  }

  /**
   * Calculate usage by agent
   */
  private calculateAgentUsage(
    tokenUsage: TokenUsageMetrics,
    agentMetrics: readonly AgentMetrics[]
  ): AgentUsageDetail[] {
    const totalTokens = tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens;
    const details: AgentUsageDetail[] = [];

    for (const [agent, usage] of Object.entries(tokenUsage.byAgent)) {
      const agentTotal = usage.input + usage.output;
      const metrics = agentMetrics.find((m) => m.agent === agent);
      const invocations = metrics?.invocations ?? 1;

      details.push({
        agent,
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: agentTotal,
        costUsd: this.calculateCost(usage.input, usage.output),
        invocations,
        avgTokensPerInvocation: agentTotal / invocations,
        percentageOfTotal: totalTokens > 0 ? (agentTotal / totalTokens) * 100 : 0,
      });
    }

    // Sort by total tokens descending
    details.sort((a, b) => b.totalTokens - a.totalTokens);

    return details;
  }

  /**
   * Calculate usage by stage
   */
  private calculateStageUsage(
    stageDurations: readonly StageDuration[],
    tokenUsage: TokenUsageMetrics
  ): StageUsageDetail[] {
    // Estimate tokens per stage based on duration
    const totalDuration = stageDurations.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
    const totalTokens = tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens;

    return stageDurations
      .filter((s) => s.durationMs !== undefined)
      .map((stage) => {
        const durationMs = stage.durationMs ?? 0;
        const proportion = totalDuration > 0 ? durationMs / totalDuration : 0;
        const tokens = Math.round(totalTokens * proportion);
        const cost = this.calculateCost(tokens * 0.4, tokens * 0.6); // Rough input/output split

        return {
          stage: stage.stage,
          durationMs,
          tokens,
          costUsd: cost,
          tokensPerSecond: durationMs > 0 ? (tokens / durationMs) * 1000 : 0,
        };
      });
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    tokenUsage: TokenUsageMetrics,
    agentMetrics: readonly AgentMetrics[],
    byAgent: readonly AgentUsageDetail[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const totalTokens = tokenUsage.totalInputTokens + tokenUsage.totalOutputTokens;

    // Check for high-usage agents that could use cheaper models
    for (const agent of byAgent) {
      if (agent.percentageOfTotal > 30) {
        const potentialSavings = agent.costUsd * 0.9; // 90% savings with haiku
        if (potentialSavings >= this.config.minSavingsThreshold) {
          recommendations.push({
            type: 'model',
            priority: 1,
            title: `Consider using Haiku for ${agent.agent}`,
            description: `The ${agent.agent} agent uses ${agent.percentageOfTotal.toFixed(1)}% of total tokens. If task complexity allows, switching to Haiku could significantly reduce costs.`,
            estimatedSavingsUsd: potentialSavings,
            estimatedTokenReduction: 0,
            difficulty: 'medium',
          });
        }
      }
    }

    // Check for caching opportunities
    const avgInvocations =
      agentMetrics.reduce((sum, m) => sum + m.invocations, 0) / agentMetrics.length;
    if (avgInvocations > 3) {
      recommendations.push({
        type: 'caching',
        priority: 2,
        title: 'Enable query caching',
        description:
          'Multiple agent invocations detected. Enabling query caching for repeated or similar queries could reduce token usage.',
        estimatedSavingsUsd: tokenUsage.estimatedCostUsd * 0.15,
        estimatedTokenReduction: Math.round(totalTokens * 0.15),
        difficulty: 'easy',
      });
    }

    // Check for context pruning opportunities
    if (tokenUsage.totalInputTokens > 50000) {
      recommendations.push({
        type: 'pruning',
        priority: 2,
        title: 'Apply context pruning',
        description:
          'Large input context detected. Implementing context pruning could reduce input tokens while maintaining quality.',
        estimatedSavingsUsd: tokenUsage.estimatedCostUsd * 0.2,
        estimatedTokenReduction: Math.round(tokenUsage.totalInputTokens * 0.2),
        difficulty: 'medium',
      });
    }

    // General recommendations
    if (tokenUsage.totalOutputTokens > tokenUsage.totalInputTokens * 2) {
      recommendations.push({
        type: 'general',
        priority: 3,
        title: 'Optimize output verbosity',
        description:
          'Output tokens significantly exceed input. Consider requesting more concise responses where appropriate.',
        estimatedSavingsUsd: tokenUsage.estimatedCostUsd * 0.1,
        difficulty: 'easy',
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Calculate cost for given tokens
   */
  private calculateCost(inputTokens: number, outputTokens: number, model = 'sonnet'): number {
    const pricing = TOKEN_PRICING[model] ?? TOKEN_PRICING['sonnet'];
    return (
      Math.round(
        ((inputTokens / 1000) * (pricing?.input ?? 0.003) +
          (outputTokens / 1000) * (pricing?.output ?? 0.015)) *
          10000
      ) / 10000
    );
  }
}

/**
 * Create a new TokenUsageReport instance
 */
export function createTokenUsageReport(
  sessionId: string,
  config?: TokenUsageReportConfig
): TokenUsageReport {
  return new TokenUsageReport(sessionId, config);
}
