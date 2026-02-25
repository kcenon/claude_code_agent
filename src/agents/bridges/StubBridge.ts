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
  supports(_agentType: string): boolean {
    return true;
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    return {
      output: `Stub execution for ${request.agentType}`,
      artifacts: [],
      success: true,
    };
  }

  async dispose(): Promise<void> {
    // No resources to clean up
  }
}
