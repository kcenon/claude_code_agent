/**
 * AgentBudgetRegistry - Manages per-agent token budget instances
 *
 * Provides a centralized registry for creating, retrieving, and managing
 * individual TokenBudgetManager instances for each agent. Supports:
 * - Per-agent budget isolation
 * - Category-based default inheritance
 * - Pipeline-level aggregation
 * - Budget exceeded callbacks
 */

import { TokenBudgetManager, type BudgetStatus } from './TokenBudgetManager.js';
import {
  type AgentTokenBudgetConfig,
  type PipelineBudgetConfig,
  type PipelineBudgetStatus,
  type CategoryBudgetDefaults,
  DEFAULT_CATEGORY_BUDGETS,
  DEFAULT_PIPELINE_BUDGET,
} from './AgentTokenBudgetConfig.js';

/**
 * Registry configuration options
 */
export interface AgentBudgetRegistryConfig {
  /** Pipeline-level budget configuration */
  readonly pipelineConfig?: PipelineBudgetConfig | undefined;

  /** Default limits by agent category */
  readonly categoryDefaults?: CategoryBudgetDefaults | undefined;

  /** Callback when any agent exceeds budget */
  readonly onAnyBudgetExceeded?:
    | ((agentName: string, status: BudgetStatus) => void | Promise<void>)
    | undefined;

  /** Callback when pipeline budget exceeded */
  readonly onPipelineBudgetExceeded?:
    | ((status: PipelineBudgetStatus) => void | Promise<void>)
    | undefined;
}

/**
 * Internal agent budget entry with metadata
 */
interface AgentBudgetEntry {
  readonly manager: TokenBudgetManager;
  readonly config: AgentTokenBudgetConfig;
  readonly createdAt: string;
}

/**
 * AgentBudgetRegistry class for managing per-agent budget instances
 */
export class AgentBudgetRegistry {
  private readonly agentBudgets: Map<string, AgentBudgetEntry> = new Map();
  private readonly pipelineConfig: Required<PipelineBudgetConfig>;
  private readonly categoryDefaults: Required<CategoryBudgetDefaults>;
  private readonly onAnyBudgetExceeded:
    | ((agentName: string, status: BudgetStatus) => void | Promise<void>)
    | undefined;
  private readonly onPipelineBudgetExceeded:
    | ((status: PipelineBudgetStatus) => void | Promise<void>)
    | undefined;

  constructor(config: AgentBudgetRegistryConfig = {}) {
    this.pipelineConfig = {
      ...DEFAULT_PIPELINE_BUDGET,
      ...config.pipelineConfig,
    };
    this.categoryDefaults = {
      ...DEFAULT_CATEGORY_BUDGETS,
      ...config.categoryDefaults,
    };
    this.onAnyBudgetExceeded = config.onAnyBudgetExceeded;
    this.onPipelineBudgetExceeded = config.onPipelineBudgetExceeded;
  }

  /**
   * Get or create a budget manager for an agent
   */
  public getAgentBudget(
    agentName: string,
    config?: Partial<AgentTokenBudgetConfig>
  ): TokenBudgetManager {
    const existing = this.agentBudgets.get(agentName);
    if (existing !== undefined) {
      return existing.manager;
    }

    return this.createAgentBudget(agentName, config);
  }

  /**
   * Create a new budget manager for an agent
   */
  private createAgentBudget(
    agentName: string,
    config?: Partial<AgentTokenBudgetConfig>
  ): TokenBudgetManager {
    const category = config?.agentCategory;
    const categoryDefaults = category !== undefined ? this.categoryDefaults[category] : undefined;

    const sessionTokenLimit =
      config?.agentTokenLimit ?? config?.sessionTokenLimit ?? categoryDefaults?.maxTokens;

    const sessionCostLimitUsd =
      config?.agentCostLimitUsd ?? config?.sessionCostLimitUsd ?? categoryDefaults?.maxCostUsd;

    // Build AgentTokenBudgetConfig with only defined properties
    const fullConfig: AgentTokenBudgetConfig = {
      agentName,
      ...(category !== undefined && { agentCategory: category }),
      ...(sessionTokenLimit !== undefined && { sessionTokenLimit }),
      ...(sessionCostLimitUsd !== undefined && { sessionCostLimitUsd }),
      ...(config?.warningThresholds !== undefined && {
        warningThresholds: config.warningThresholds,
      }),
      ...(config?.hardLimitThreshold !== undefined && {
        hardLimitThreshold: config.hardLimitThreshold,
      }),
      ...(config?.onLimitReached !== undefined && { onLimitReached: config.onLimitReached }),
      ...(config?.allowOverride !== undefined && { allowOverride: config.allowOverride }),
      ...(config?.onBudgetExceeded !== undefined && { onBudgetExceeded: config.onBudgetExceeded }),
      ...(config?.modelPreference !== undefined && { modelPreference: config.modelPreference }),
    };

    // Build TokenBudgetConfig with only defined properties
    const managerConfig = {
      ...(sessionTokenLimit !== undefined && { sessionTokenLimit }),
      ...(sessionCostLimitUsd !== undefined && { sessionCostLimitUsd }),
      ...(config?.warningThresholds !== undefined && {
        warningThresholds: config.warningThresholds,
      }),
      ...(config?.hardLimitThreshold !== undefined && {
        hardLimitThreshold: config.hardLimitThreshold,
      }),
      ...(config?.onLimitReached !== undefined && { onLimitReached: config.onLimitReached }),
      ...(config?.allowOverride !== undefined && { allowOverride: config.allowOverride }),
    };

    const manager = new TokenBudgetManager(managerConfig);

    const entry: AgentBudgetEntry = {
      manager,
      config: fullConfig,
      createdAt: new Date().toISOString(),
    };

    this.agentBudgets.set(agentName, entry);

    return manager;
  }

  /**
   * Record usage for an agent and check budgets
   */
  public recordAgentUsage(
    agentName: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number
  ): BudgetStatus {
    const manager = this.getAgentBudget(agentName);
    const result = manager.recordUsage(inputTokens, outputTokens, costUsd);
    const status = manager.getStatus();

    if (!result.allowed) {
      const entry = this.agentBudgets.get(agentName);
      if (entry?.config.onBudgetExceeded !== undefined) {
        void entry.config.onBudgetExceeded(status);
      }
      if (this.onAnyBudgetExceeded !== undefined) {
        void this.onAnyBudgetExceeded(agentName, status);
      }
    }

    this.checkPipelineBudget();

    return status;
  }

  /**
   * Check pipeline-level budget
   */
  private checkPipelineBudget(): void {
    const pipelineStatus = this.getPipelineStatus();

    if (pipelineStatus.limitExceeded && this.onPipelineBudgetExceeded !== undefined) {
      void this.onPipelineBudgetExceeded(pipelineStatus);
    }
  }

  /**
   * Get all agent budgets
   */
  public getAllBudgets(): Map<string, BudgetStatus> {
    const budgets = new Map<string, BudgetStatus>();

    for (const [agentName, entry] of this.agentBudgets) {
      budgets.set(agentName, entry.manager.getStatus());
    }

    return budgets;
  }

  /**
   * Get list of registered agent names
   */
  public getRegisteredAgents(): readonly string[] {
    return Array.from(this.agentBudgets.keys());
  }

  /**
   * Get agent budget configuration
   */
  public getAgentConfig(agentName: string): AgentTokenBudgetConfig | undefined {
    return this.agentBudgets.get(agentName)?.config;
  }

  /**
   * Get aggregated pipeline status
   */
  public getPipelineStatus(): PipelineBudgetStatus {
    let totalTokens = 0;
    let totalCostUsd = 0;
    const byAgent = new Map<string, BudgetStatus>();
    const exceededAgents: string[] = [];
    const warningAgents: string[] = [];

    for (const [agentName, entry] of this.agentBudgets) {
      const status = entry.manager.getStatus();
      byAgent.set(agentName, status);
      totalTokens += status.currentTokens;
      totalCostUsd += status.currentCostUsd;

      if (status.limitExceeded) {
        exceededAgents.push(agentName);
      } else if (status.warningExceeded) {
        warningAgents.push(agentName);
      }
    }

    const tokenLimit = this.pipelineConfig.maxTokens;
    const costLimit = this.pipelineConfig.maxCostUsd;

    const tokenUsagePercent = tokenLimit > 0 ? (totalTokens / tokenLimit) * 100 : 0;
    const costUsagePercent = costLimit > 0 ? (totalCostUsd / costLimit) * 100 : 0;

    const warningThresholdPercent = this.pipelineConfig.warningThreshold * 100;
    const warningExceeded =
      tokenUsagePercent >= warningThresholdPercent ||
      costUsagePercent >= warningThresholdPercent ||
      exceededAgents.length > 0;

    const limitExceeded =
      tokenUsagePercent >= 100 || costUsagePercent >= 100 || exceededAgents.length > 0;

    return {
      totalTokens,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      totalTokenLimit: tokenLimit,
      totalCostLimitUsd: costLimit,
      tokenUsagePercent: Math.round(tokenUsagePercent * 100) / 100,
      costUsagePercent: Math.round(costUsagePercent * 100) / 100,
      byAgent,
      exceededAgents,
      warningAgents,
      warningExceeded,
      limitExceeded,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if any agent exceeded budget
   */
  public hasExceededBudgets(): boolean {
    for (const entry of this.agentBudgets.values()) {
      if (entry.manager.getStatus().limitExceeded) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if pipeline budget is exceeded
   */
  public isPipelineBudgetExceeded(): boolean {
    return this.getPipelineStatus().limitExceeded;
  }

  /**
   * Reset specific agent budget
   */
  public resetAgent(agentName: string): void {
    const entry = this.agentBudgets.get(agentName);
    if (entry !== undefined) {
      entry.manager.reset();
    }
  }

  /**
   * Reset all agent budgets
   */
  public resetAll(): void {
    for (const entry of this.agentBudgets.values()) {
      entry.manager.reset();
    }
  }

  /**
   * Remove an agent from the registry
   */
  public removeAgent(agentName: string): boolean {
    return this.agentBudgets.delete(agentName);
  }

  /**
   * Clear all agents from the registry
   */
  public clear(): void {
    this.agentBudgets.clear();
  }

  /**
   * Get total number of registered agents
   */
  public get size(): number {
    return this.agentBudgets.size;
  }

  /**
   * Estimate if a request will exceed agent or pipeline budget
   */
  public estimateUsage(
    agentName: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): { allowed: boolean; reason?: string } {
    const manager = this.getAgentBudget(agentName);
    const agentEstimate = manager.estimateUsage(estimatedInputTokens, estimatedOutputTokens);

    if (!agentEstimate.allowed) {
      return {
        allowed: false,
        reason: `Agent ${agentName}: ${agentEstimate.reason ?? 'Budget exceeded'}`,
      };
    }

    const pipelineStatus = this.getPipelineStatus();
    const estimatedTotal =
      pipelineStatus.totalTokens + estimatedInputTokens + estimatedOutputTokens;

    if (this.pipelineConfig.maxTokens > 0 && estimatedTotal > this.pipelineConfig.maxTokens) {
      return {
        allowed: false,
        reason: `Pipeline budget exceeded: estimated ${String(estimatedTotal)} tokens would exceed limit ${String(this.pipelineConfig.maxTokens)}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get a summary report of all agent budgets
   */
  public getSummaryReport(): string {
    const status = this.getPipelineStatus();
    const lines: string[] = [
      '=== Pipeline Budget Status ===',
      `Total Tokens: ${String(status.totalTokens)}/${String(status.totalTokenLimit ?? 'unlimited')} (${String(status.tokenUsagePercent)}%)`,
      `Total Cost: $${String(status.totalCostUsd)}/$${String(status.totalCostLimitUsd ?? 'unlimited')} (${String(status.costUsagePercent)}%)`,
      '',
      '=== Per-Agent Breakdown ===',
    ];

    for (const [agentName, agentStatus] of status.byAgent) {
      const tokenStr =
        agentStatus.tokenLimit !== undefined
          ? `${String(agentStatus.currentTokens)}/${String(agentStatus.tokenLimit)}`
          : String(agentStatus.currentTokens);
      const costStr =
        agentStatus.costLimitUsd !== undefined
          ? `$${String(agentStatus.currentCostUsd)}/$${String(agentStatus.costLimitUsd)}`
          : `$${String(agentStatus.currentCostUsd)}`;
      const statusIndicator = agentStatus.limitExceeded
        ? '❌'
        : agentStatus.warningExceeded
          ? '⚠️'
          : '✓';

      lines.push(`${statusIndicator} ${agentName}: ${tokenStr} tokens, ${costStr}`);
    }

    if (status.exceededAgents.length > 0) {
      lines.push('');
      lines.push(`⚠️ Exceeded: ${status.exceededAgents.join(', ')}`);
    }

    return lines.join('\n');
  }
}

/**
 * Singleton instance for global access
 */
let globalAgentBudgetRegistry: AgentBudgetRegistry | null = null;

/**
 * Get or create the global AgentBudgetRegistry instance
 */
export function getAgentBudgetRegistry(config?: AgentBudgetRegistryConfig): AgentBudgetRegistry {
  if (globalAgentBudgetRegistry === null) {
    globalAgentBudgetRegistry = new AgentBudgetRegistry(config);
  }
  return globalAgentBudgetRegistry;
}

/**
 * Reset the global AgentBudgetRegistry instance
 */
export function resetAgentBudgetRegistry(): void {
  globalAgentBudgetRegistry = null;
}
