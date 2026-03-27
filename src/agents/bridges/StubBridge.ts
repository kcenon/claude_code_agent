/**
 * StubBridge - Fallback bridge that returns stub responses
 *
 * Used as the default fallback when no real bridge (Anthropic API, Claude Code)
 * is available. When registered in BridgeRegistry, it catches all agent types
 * that no other bridge handles.
 *
 * In production, AgentDispatcher falls through to existing call adapters
 * when no bridge supports a given agent type. StubBridge is primarily used
 * in testing and as an explicit "no-op" bridge.
 *
 * @packageDocumentation
 */

import type { AgentBridge, AgentRequest, AgentResponse } from '../AgentBridge.js';

/**
 * Stub implementation that returns minimal success responses.
 * Serves as the catch-all fallback and test fixture.
 */
export class StubBridge implements AgentBridge {
  /** When true, execute() returns success (for explicit opt-in testing). */
  private readonly allowExecution: boolean;

  constructor(options?: { allowExecution?: boolean }) {
    this.allowExecution = options?.allowExecution ?? false;
  }

  /**
   *
   * @param _agentType
   */
  supports(_agentType: string): boolean {
    return true;
  }

  /**
   *
   * @param request
   */
  execute(request: AgentRequest): Promise<AgentResponse> {
    return Promise.resolve({
      output: this.allowExecution
        ? `Stub execution for ${request.agentType}`
        : `[STUB] No real AI bridge available for '${request.agentType}'. Set ANTHROPIC_API_KEY or run inside Claude Code session.`,
      artifacts: [],
      success: true,
      isStub: true,
    });
  }

  /**
   *
   */
  dispose(): Promise<void> {
    return Promise.resolve();
  }
}
