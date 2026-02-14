/**
 * AgentBudgetRegistry - Manages per-agent token budget instances
 *
 * Provides a centralized registry for creating, retrieving, and managing
 * individual TokenBudgetManager instances for each agent. Supports:
 * - Per-agent budget isolation
 * - Category-based default inheritance
 * - Pipeline-level aggregation
 * - Budget exceeded callbacks
 * - Budget transfer between agents for dynamic reallocation
 */

import { TokenBudgetManager, type BudgetStatus } from './TokenBudgetManager.js';
import {
  type AgentTokenBudgetConfig,
  type PipelineBudgetConfig,
  type PipelineBudgetStatus,
  type CategoryBudgetDefaults,
  DEFAULT_CATEGORY_BUDGETS,
  DEFAULT_PIPELINE_BUDGET,
  DEFAULT_MODEL_PREFERENCE,
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
 * Result of a budget transfer operation
 */
export interface BudgetTransferResult {
  /** Whether the transfer was successful */
  readonly success: boolean;
  /** Error message if transfer failed */
  readonly error?: string;
  /** Amount of tokens transferred */
  readonly tokensTransferred?: number;
  /** Amount of cost transferred in USD */
  readonly costTransferred?: number;
  /** Source agent's new token limit */
  readonly sourceNewLimit?: number;
  /** Target agent's new token limit */
  readonly targetNewLimit?: number;
  /** Timestamp of the transfer */
  readonly timestamp: string;
}

/**
 * Budget transfer record for history tracking
 */
export interface BudgetTransferRecord {
  /** Source agent name */
  readonly fromAgent: string;
  /** Target agent name */
  readonly toAgent: string;
  /** Tokens transferred */
  readonly tokens?: number;
  /** Cost transferred in USD */
  readonly costUsd?: number;
  /** Timestamp of the transfer */
  readonly timestamp: string;
  /** Whether transfer was successful */
  readonly success: boolean;
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
  private readonly transferHistory: BudgetTransferRecord[] = [];

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
   * @param agentName - Name of the agent to get budget manager for
   * @param config - Optional partial configuration for agent budget
   * @returns TokenBudgetManager instance for the specified agent
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
   * @param agentName - Name of the agent to create budget manager for
   * @param config - Optional partial configuration for the new agent budget
   * @returns Newly created TokenBudgetManager instance
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

    // Use provided model preference or fall back to default (Opus)
    const modelPreference = config?.modelPreference ?? DEFAULT_MODEL_PREFERENCE;

    // Build AgentTokenBudgetConfig with only defined properties
    const fullConfig: AgentTokenBudgetConfig = {
      agentName,
      modelPreference,
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
   * @param agentName - Name of the agent that consumed resources
   * @param inputTokens - Number of input tokens consumed
   * @param outputTokens - Number of output tokens generated
   * @param costUsd - Cost of the operation in US dollars
   * @returns Budget status for the agent after recording usage
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
   * @returns Map of agent names to their current budget status
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
   * @returns Array of all registered agent names
   */
  public getRegisteredAgents(): readonly string[] {
    return Array.from(this.agentBudgets.keys());
  }

  /**
   * Get agent budget configuration
   * @param agentName - Name of the agent to get configuration for
   * @returns Agent budget configuration or undefined if not found
   */
  public getAgentConfig(agentName: string): AgentTokenBudgetConfig | undefined {
    return this.agentBudgets.get(agentName)?.config;
  }

  /**
   * Get aggregated pipeline status
   * @returns Aggregated budget status across all agents in the pipeline
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
   * @returns True if at least one agent has exceeded their budget limit
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
   * @returns True if the total pipeline budget limit has been exceeded
   */
  public isPipelineBudgetExceeded(): boolean {
    return this.getPipelineStatus().limitExceeded;
  }

  /**
   * Reset specific agent budget
   * @param agentName - Name of the agent whose budget should be reset
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
   * @param agentName - Name of the agent to remove
   * @returns True if agent was found and removed, false if not found
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
   * @returns Total count of agents currently registered
   */
  public get size(): number {
    return this.agentBudgets.size;
  }

  /**
   * Estimate if a request will exceed agent or pipeline budget
   * @param agentName - Name of the agent that would perform the operation
   * @param estimatedInputTokens - Expected number of input tokens for the operation
   * @param estimatedOutputTokens - Expected number of output tokens for the operation
   * @returns Object indicating if operation is allowed and reason if not
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
   * @returns Formatted text report of pipeline and per-agent budget status
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

  /**
   * Transfer budget tokens from one agent to another
   *
   * Reallocates token budget between agents. The source agent's limit is reduced
   * and the target agent's limit is increased by the specified amount.
   *
   * @param fromAgent - Name of the source agent
   * @param toAgent - Name of the target agent
   * @param tokens - Number of tokens to transfer
   * @returns Result of the transfer operation
   */
  public transferTokenBudget(
    fromAgent: string,
    toAgent: string,
    tokens: number
  ): BudgetTransferResult {
    const timestamp = new Date().toISOString();

    if (tokens <= 0) {
      return this.createTransferResult(false, 'Transfer amount must be positive', timestamp);
    }

    if (fromAgent === toAgent) {
      return this.createTransferResult(false, 'Cannot transfer to same agent', timestamp);
    }

    const sourceEntry = this.agentBudgets.get(fromAgent);
    const targetEntry = this.agentBudgets.get(toAgent);

    if (sourceEntry === undefined) {
      return this.createTransferResult(false, `Source agent "${fromAgent}" not found`, timestamp);
    }

    if (targetEntry === undefined) {
      return this.createTransferResult(false, `Target agent "${toAgent}" not found`, timestamp);
    }

    const sourceLimit = sourceEntry.manager.getTokenLimit();
    if (sourceLimit === undefined) {
      return this.createTransferResult(
        false,
        `Source agent "${fromAgent}" has no token limit to transfer`,
        timestamp
      );
    }

    const sourceUsed = sourceEntry.manager.getStatus().currentTokens;
    const availableToTransfer = sourceLimit - sourceUsed;

    if (tokens > availableToTransfer) {
      return this.createTransferResult(
        false,
        `Insufficient available budget: requested ${String(tokens)}, available ${String(availableToTransfer)}`,
        timestamp
      );
    }

    const newSourceLimit = sourceLimit - tokens;
    const currentTargetLimit = targetEntry.manager.getTokenLimit() ?? 0;
    const newTargetLimit = currentTargetLimit + tokens;

    sourceEntry.manager.adjustTokenLimit(newSourceLimit);
    targetEntry.manager.adjustTokenLimit(newTargetLimit);

    const record: BudgetTransferRecord = {
      fromAgent,
      toAgent,
      tokens,
      timestamp,
      success: true,
    };
    this.transferHistory.push(record);

    return {
      success: true,
      tokensTransferred: tokens,
      sourceNewLimit: newSourceLimit,
      targetNewLimit: newTargetLimit,
      timestamp,
    };
  }

  /**
   * Transfer budget cost from one agent to another
   *
   * Reallocates cost budget between agents.
   *
   * @param fromAgent - Name of the source agent
   * @param toAgent - Name of the target agent
   * @param costUsd - Amount of cost budget to transfer in USD
   * @returns Result of the transfer operation
   */
  public transferCostBudget(
    fromAgent: string,
    toAgent: string,
    costUsd: number
  ): BudgetTransferResult {
    const timestamp = new Date().toISOString();

    if (costUsd <= 0) {
      return this.createTransferResult(false, 'Transfer amount must be positive', timestamp);
    }

    if (fromAgent === toAgent) {
      return this.createTransferResult(false, 'Cannot transfer to same agent', timestamp);
    }

    const sourceEntry = this.agentBudgets.get(fromAgent);
    const targetEntry = this.agentBudgets.get(toAgent);

    if (sourceEntry === undefined) {
      return this.createTransferResult(false, `Source agent "${fromAgent}" not found`, timestamp);
    }

    if (targetEntry === undefined) {
      return this.createTransferResult(false, `Target agent "${toAgent}" not found`, timestamp);
    }

    const sourceLimit = sourceEntry.manager.getCostLimit();
    if (sourceLimit === undefined) {
      return this.createTransferResult(
        false,
        `Source agent "${fromAgent}" has no cost limit to transfer`,
        timestamp
      );
    }

    const sourceUsed = sourceEntry.manager.getStatus().currentCostUsd;
    const availableToTransfer = sourceLimit - sourceUsed;

    if (costUsd > availableToTransfer) {
      return this.createTransferResult(
        false,
        `Insufficient available budget: requested $${String(costUsd)}, available $${String(availableToTransfer)}`,
        timestamp
      );
    }

    const newSourceLimit = sourceLimit - costUsd;
    const currentTargetLimit = targetEntry.manager.getCostLimit() ?? 0;
    const newTargetLimit = currentTargetLimit + costUsd;

    sourceEntry.manager.adjustCostLimit(newSourceLimit);
    targetEntry.manager.adjustCostLimit(newTargetLimit);

    const record: BudgetTransferRecord = {
      fromAgent,
      toAgent,
      costUsd,
      timestamp,
      success: true,
    };
    this.transferHistory.push(record);

    return {
      success: true,
      costTransferred: costUsd,
      sourceNewLimit: newSourceLimit,
      targetNewLimit: newTargetLimit,
      timestamp,
    };
  }

  /**
   * Get the history of budget transfers
   * @returns Array of all budget transfer records between agents
   */
  public getTransferHistory(): readonly BudgetTransferRecord[] {
    return this.transferHistory;
  }

  /**
   * Clear transfer history
   */
  public clearTransferHistory(): void {
    this.transferHistory.length = 0;
  }

  /**
   * Helper to create transfer result for failed transfers
   * @param success - Always false for this helper (failed transfers)
   * @param error - Error message describing why the transfer failed
   * @param timestamp - ISO timestamp of the failed transfer attempt
   * @returns Budget transfer result object indicating failure
   */
  private createTransferResult(
    success: false,
    error: string,
    timestamp: string
  ): BudgetTransferResult {
    return {
      success,
      error,
      timestamp,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalAgentBudgetRegistry: AgentBudgetRegistry | null = null;

/**
 * Get or create the global AgentBudgetRegistry instance
 * @param config - Optional configuration for the registry
 * @returns Global singleton instance of AgentBudgetRegistry
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
