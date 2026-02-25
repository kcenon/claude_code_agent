/**
 * bootstrapAgents - Registers all pipeline agents into AgentRegistry
 *
 * Iterates over AGENT_TYPE_MAP and registers each entry in the singleton
 * AgentRegistry. Registration is idempotent: already-registered agents
 * are silently skipped.
 *
 * The factory functions throw by default because actual agent instantiation
 * is deferred to AgentDispatcher (see #521). This module only populates
 * the registry so that metadata lookups and dependency validation work.
 *
 * @packageDocumentation
 */

import { AgentRegistry } from './AgentRegistry.js';
import { AGENT_TYPE_MAP } from './AgentTypeMapping.js';
import type { AgentTypeEntry } from './AgentTypeMapping.js';

/**
 * Number of agents registered during the most recent bootstrap call.
 * Useful for diagnostics and testing.
 */
export interface BootstrapResult {
  /** Total entries processed from AGENT_TYPE_MAP */
  readonly totalEntries: number;
  /** Number of agents newly registered in this call */
  readonly registered: number;
  /** Number of agents skipped (already registered) */
  readonly skipped: number;
}

/**
 * Register all pipeline agents into the AgentRegistry.
 *
 * Safe to call multiple times; duplicate registrations are skipped.
 * Factory functions are placeholder stubs that throw -- real factories
 * will be wired in by AgentDispatcher (#521).
 *
 * @returns Summary of how many agents were registered vs skipped
 *
 * @example
 * ```typescript
 * import { bootstrapAgents } from './bootstrapAgents.js';
 *
 * const result = await bootstrapAgents();
 * console.log(`Registered ${result.registered} agents`);
 * ```
 */
export async function bootstrapAgents(): Promise<BootstrapResult> {
  const registry = AgentRegistry.getInstance();

  let registered = 0;
  let skipped = 0;

  const entries = Object.entries(AGENT_TYPE_MAP) as ReadonlyArray<[string, AgentTypeEntry]>;

  for (const [agentType, entry] of entries) {
    if (registry.has(entry.agentId)) {
      skipped++;
      continue;
    }

    registry.register({
      agentId: entry.agentId,
      name: entry.name,
      description: `Pipeline agent for '${agentType}' stage`,
      lifecycle: entry.lifecycle,
      dependencies: [],
      factory: () => {
        throw new Error(
          `Agent '${entry.agentId}' must be created through AgentDispatcher. ` +
            `Direct factory invocation is not supported.`
        );
      },
    });

    registered++;
  }

  return {
    totalEntries: entries.length,
    registered,
    skipped,
  };
}
