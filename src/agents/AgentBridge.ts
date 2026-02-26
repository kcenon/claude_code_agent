/**
 * AgentBridge - Interface defining the contract for agent execution
 *
 * Separates infrastructure concerns from AI execution, allowing agents
 * to delegate their core intelligence to either the Anthropic API,
 * Claude Code sub-agents, or test stubs.
 *
 * @packageDocumentation
 */

/**
 * Contract for agent execution. Infrastructure code (orchestrator,
 * dispatcher) interacts with AI capabilities exclusively through this interface.
 */
export interface AgentBridge {
  /**
   * Execute an agent with the given context and return structured output.
   * Implementations may call Anthropic API, Claude Code sub-agents, or test stubs.
   */
  execute(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Check if this bridge supports the given agent type.
   *
   * @param agentType - Agent type string from AgentTypeMapping
   * @returns True if this bridge can handle execution for the given type
   */
  supports(agentType: string): boolean;

  /**
   * Clean up resources (API connections, temp files).
   */
  dispose(): Promise<void>;
}

/**
 * Request payload for agent execution via AgentBridge.
 */
export interface AgentRequest {
  /** Agent type from AgentTypeMapping (e.g., 'collector', 'worker', 'prd-writer') */
  agentType: string;

  /** User's original request or work order content */
  input: string;

  /** Scratchpad directory for reading prior stage outputs */
  scratchpadDir: string;

  /** Project directory for file operations */
  projectDir: string;

  /** Results from completed prior stages */
  priorStageOutputs: Record<string, string>;

  /** Token budget from agents.yaml */
  tokenBudget?: { maxInput: number; maxOutput: number };

  /** Model preference from agents.yaml (opus, sonnet, haiku) */
  modelPreference?: string;

  /** Maximum conversation turns for multi-turn execution (default: 10) */
  maxTurns?: number;

  /** Whether to enable tool use in the bridge (default: true) */
  enableTools?: boolean;

  /** Restrict which tools are available (by tool name) */
  allowedTools?: string[];
}

/**
 * Response from agent execution via AgentBridge.
 */
export interface AgentResponse {
  /** Primary output (document content, analysis result, etc.) */
  output: string;

  /** Files created or modified by the agent */
  artifacts: Array<{ path: string; action: 'created' | 'modified' | 'deleted' }>;

  /** Token usage for budget tracking */
  tokenUsage?: { inputTokens: number; outputTokens: number };

  /** Whether the agent completed successfully */
  success: boolean;

  /** Error details if success is false */
  error?: string;
}
