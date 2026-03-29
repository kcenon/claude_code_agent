/**
 * BridgeRegistry - Selects the appropriate bridge for an agent type
 *
 * Bridges are registered in priority order (first registered = highest priority).
 * When resolving a bridge for an agent type, the registry returns the first
 * bridge whose `supports()` method returns true.
 *
 * @packageDocumentation
 */

import type { AgentBridge } from './AgentBridge.js';
import { StubBridge } from './bridges/StubBridge.js';
import { AnthropicApiBridge } from './bridges/AnthropicApiBridge.js';
import { ClaudeCodeBridge } from './bridges/ClaudeCodeBridge.js';

/**
 * Registry that selects the appropriate AgentBridge for a given agent type.
 *
 * Priority: first registered bridge that supports the agent type wins.
 * StubBridge is always registered as the final fallback.
 *
 * @example
 * ```typescript
 * const registry = new BridgeRegistry();
 * registry.register(new AnthropicApiBridge()); // higher priority
 * // StubBridge is auto-registered as fallback
 *
 * const bridge = registry.resolve('collector'); // AnthropicApiBridge if it supports it
 * ```
 */
export class BridgeRegistry {
  private readonly bridges: AgentBridge[] = [];
  private readonly stubBridge = new StubBridge();

  /**
   * Register a bridge. Bridges are checked in registration order.
   * The first bridge whose `supports()` returns true for an agent type is used.
   * @param bridge
   */
  register(bridge: AgentBridge): void {
    this.bridges.push(bridge);
  }

  /**
   * Resolve the appropriate bridge for the given agent type.
   *
   * @param agentType - Pipeline agent type string
   * @returns The first registered bridge that supports this type, or StubBridge
   */
  resolve(agentType: string): AgentBridge {
    for (const bridge of this.bridges) {
      if (bridge.supports(agentType)) {
        return bridge;
      }
    }
    console.warn(
      `[BridgeRegistry] No real bridge registered for agent type "${agentType}" — using StubBridge (no-op). ` +
        'Set ANTHROPIC_API_KEY or run inside Claude Code session to enable real execution.'
    );
    return this.stubBridge;
  }

  /**
   * Check if the resolved bridge for an agent type is the StubBridge fallback.
   *
   * @param agentType - Pipeline agent type string
   * @returns True if no real bridge handles this type
   */
  isStub(agentType: string): boolean {
    return !this.bridges.some((b) => b.supports(agentType));
  }

  /**
   * Get the StubBridge instance used as fallback.
   */
  getStubBridge(): AgentBridge {
    return this.stubBridge;
  }

  /**
   * Check if any non-stub bridge supports the given agent type.
   * @param agentType
   */
  hasBridge(agentType: string): boolean {
    return this.bridges.some((b) => b.supports(agentType));
  }

  /**
   * Check if at least one real (non-stub) bridge is registered.
   * Use this to verify the environment is properly configured before running a pipeline.
   */
  hasRealBridge(): boolean {
    return this.bridges.length > 0;
  }

  /**
   * Get the number of registered bridges (excluding the default StubBridge).
   */
  get size(): number {
    return this.bridges.length;
  }

  /**
   * Dispose all registered bridges and the fallback StubBridge.
   */
  async disposeAll(): Promise<void> {
    const promises = this.bridges.map((b) =>
      b.dispose().catch(() => {
        // Suppress individual dispose errors
      })
    );
    promises.push(
      this.stubBridge.dispose().catch(() => {
        // Suppress dispose error
      })
    );
    await Promise.allSettled(promises);
    this.bridges.length = 0;
  }
}

/**
 * Create a BridgeRegistry with auto-detected bridges based on environment.
 *
 * Detection logic:
 * 1. If inside a Claude Code session → register ClaudeCodeBridge
 * 2. If ANTHROPIC_API_KEY is set → register AnthropicApiBridge
 * 3. StubBridge is always the final fallback (built into BridgeRegistry)
 */
export function createDefaultBridgeRegistry(): BridgeRegistry {
  const registry = new BridgeRegistry();

  // Claude Code session detection
  if (isClaudeCodeSession()) {
    registry.register(new ClaudeCodeBridge());
  }

  // Anthropic API key detection
  if (process.env['ANTHROPIC_API_KEY'] !== undefined && process.env['ANTHROPIC_API_KEY'] !== '') {
    registry.register(new AnthropicApiBridge());
  }

  return registry;
}

/**
 * Detect if running inside a Claude Code session.
 *
 * Checks four environment variables that Claude Code may set:
 * - CLAUDE_CODE_SESSION: legacy session marker
 * - CLAUDE_CODE: legacy presence flag
 * - CLAUDECODE: runtime flag (set to "1")
 * - CLAUDE_CODE_ENTRYPOINT: entry point identifier (e.g. "cli")
 */
export function isClaudeCodeSession(): boolean {
  return (
    (process.env['CLAUDE_CODE_SESSION'] ?? '') !== '' ||
    (process.env['CLAUDE_CODE'] ?? '') !== '' ||
    process.env['CLAUDECODE'] === '1' ||
    (process.env['CLAUDE_CODE_ENTRYPOINT'] ?? '') !== ''
  );
}
