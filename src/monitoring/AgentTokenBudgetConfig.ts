/**
 * AgentTokenBudgetConfig - Per-agent token budget configuration types
 *
 * Defines configuration interfaces for agent-specific token budgets,
 * enabling independent budget tracking and enforcement per agent.
 */

import type { TokenBudgetConfig, BudgetStatus, BudgetAction } from './TokenBudgetManager.js';

/**
 * Agent category for budget defaults inheritance
 */
export type AgentCategory = 'document' | 'execution' | 'analysis' | 'infrastructure';

/**
 * Per-agent token budget configuration extending base TokenBudgetConfig
 */
export interface AgentTokenBudgetConfig extends TokenBudgetConfig {
  /** Agent name for identification */
  readonly agentName: string;

  /** Agent category for default inheritance */
  readonly agentCategory?: AgentCategory | undefined;

  /** Override session token limit for this agent */
  readonly agentTokenLimit?: number | undefined;

  /** Override cost limit for this agent in USD */
  readonly agentCostLimitUsd?: number | undefined;

  /** Callback when budget exceeded */
  readonly onBudgetExceeded?: ((status: BudgetStatus) => void | Promise<void>) | undefined;

  /** Model preference for this agent (affects cost calculation) */
  readonly modelPreference?: 'sonnet' | 'opus' | 'haiku' | undefined;
}

/**
 * Pipeline-level budget configuration
 */
export interface PipelineBudgetConfig {
  /** Maximum total tokens across all agents */
  readonly maxTokens?: number;

  /** Maximum total cost in USD across all agents */
  readonly maxCostUsd?: number;

  /** Warning threshold percentage (0-1) */
  readonly warningThreshold?: number;

  /** Action when pipeline budget exceeded */
  readonly onLimitReached?: BudgetAction;
}

/**
 * Default budget limits by agent category
 */
export interface CategoryBudgetDefaults {
  /** Default limits for document pipeline agents */
  readonly document?: {
    readonly maxTokens: number;
    readonly maxCostUsd: number;
  };

  /** Default limits for execution agents */
  readonly execution?: {
    readonly maxTokens: number;
    readonly maxCostUsd: number;
  };

  /** Default limits for analysis agents */
  readonly analysis?: {
    readonly maxTokens: number;
    readonly maxCostUsd: number;
  };

  /** Default limits for infrastructure agents */
  readonly infrastructure?: {
    readonly maxTokens: number;
    readonly maxCostUsd: number;
  };
}

/**
 * Complete token budget configuration for a pipeline
 */
export interface TokenBudgetsConfig {
  /** Pipeline-level limits (aggregate of all agents) */
  readonly pipeline?: PipelineBudgetConfig;

  /** Default limits by agent category */
  readonly defaults?: CategoryBudgetDefaults;

  /** Agent-specific overrides */
  readonly agents?: Record<
    string,
    {
      readonly maxTokens?: number;
      readonly maxCostUsd?: number;
      readonly modelPreference?: 'sonnet' | 'opus' | 'haiku';
    }
  >;
}

/**
 * Pipeline-level budget status (aggregated from all agents)
 */
export interface PipelineBudgetStatus {
  /** Total tokens used across all agents */
  readonly totalTokens: number;

  /** Total cost across all agents in USD */
  readonly totalCostUsd: number;

  /** Total token limit if set */
  readonly totalTokenLimit?: number;

  /** Total cost limit if set */
  readonly totalCostLimitUsd?: number;

  /** Token usage percentage (0-100) */
  readonly tokenUsagePercent: number;

  /** Cost usage percentage (0-100) */
  readonly costUsagePercent: number;

  /** Per-agent breakdown */
  readonly byAgent: Map<string, BudgetStatus>;

  /** Agents that exceeded their budgets */
  readonly exceededAgents: readonly string[];

  /** Agents approaching limit (>80%) */
  readonly warningAgents: readonly string[];

  /** Whether any warning threshold is exceeded */
  readonly warningExceeded: boolean;

  /** Whether any hard limit is exceeded */
  readonly limitExceeded: boolean;

  /** Timestamp of status generation */
  readonly timestamp: string;
}

/**
 * Default model preference for agents
 * Uses Opus (claude-opus-4-5-20251101) as the default model
 */
export const DEFAULT_MODEL_PREFERENCE: 'sonnet' | 'opus' | 'haiku' = 'opus';

/**
 * Default category budget limits
 * Tokens are set based on typical usage patterns per category
 */
export const DEFAULT_CATEGORY_BUDGETS: Required<CategoryBudgetDefaults> = {
  document: {
    maxTokens: 150000,
    maxCostUsd: 3.0,
  },
  execution: {
    maxTokens: 150000,
    maxCostUsd: 3.0,
  },
  analysis: {
    maxTokens: 150000,
    maxCostUsd: 3.0,
  },
  infrastructure: {
    maxTokens: 50000,
    maxCostUsd: 1.0,
  },
};

/**
 * Default pipeline budget limits
 * Total budget across all agents in a pipeline
 * Set high enough to allow multiple agents to use their full 150000 token budgets
 */
export const DEFAULT_PIPELINE_BUDGET: Required<PipelineBudgetConfig> = {
  maxTokens: 1500000,
  maxCostUsd: 50.0,
  warningThreshold: 0.8,
  onLimitReached: 'pause',
};
