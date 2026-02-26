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
    return this.stubBridge;
  }

  /**
   * Check if any non-stub bridge supports the given agent type.
   */
  hasBridge(agentType: string): boolean {
    return this.bridges.some((b) => b.supports(agentType));
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
    await Promise.all(promises);
    this.bridges.length = 0;
  }
}
