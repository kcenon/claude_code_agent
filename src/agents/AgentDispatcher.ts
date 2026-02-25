/**
 * AgentDispatcher - Dispatches pipeline stages to their corresponding agents
 *
 * Bridges the gap between the orchestrator's pipeline execution and individual
 * agent invocation. Each pipeline agentType string is resolved to an IAgent
 * instance via AGENT_TYPE_MAP, then a per-agent "call adapter" function
 * translates session context into the correct method call for that agent.
 *
 * Key design decisions:
 * - Dynamic `import()` for all agent modules (no static imports)
 * - Singleton caching for agents with lifecycle='singleton'
 * - Per-agent call adapters handle the heterogeneous IAgent APIs
 * - A default adapter provides generic fallback behavior
 *
 * @packageDocumentation
 */

import path from 'node:path';
import type {
  PipelineStageDefinition,
  OrchestratorSession,
} from '../ad-sdlc-orchestrator/types.js';
import type { IAgent } from './types.js';
import { isAgent } from './types.js';
import { getAgentTypeEntry } from './AgentTypeMapping.js';
import type { AgentTypeEntry } from './AgentTypeMapping.js';
import type { AgentRequest } from './AgentBridge.js';
import { BridgeRegistry } from './BridgeRegistry.js';

/**
 * Function signature for per-agent call adapters.
 *
 * An adapter extracts the relevant data from the orchestrator session,
 * calls the agent's primary method, and returns the output as a string.
 */
export type AgentCallAdapter = (
  agent: IAgent,
  stage: PipelineStageDefinition,
  session: OrchestratorSession
) => Promise<string>;

/**
 * Error thrown when a dispatcher operation fails
 */
export class AgentDispatchError extends Error {
  constructor(agentType: string, cause: string) {
    super(`Failed to dispatch agent '${agentType}': ${cause}`);
    this.name = 'AgentDispatchError';
  }
}

/**
 * Error thrown when no suitable agent class is found in a module
 */
export class AgentModuleError extends Error {
  constructor(agentType: string, importPath: string) {
    super(`No valid agent class found in module '${importPath}' for agent type '${agentType}'`);
    this.name = 'AgentModuleError';
  }
}

/**
 * Cast an IAgent to a duck-typing record for method probing.
 *
 * IAgent is a strict interface without an index signature, so TypeScript
 * rejects a direct cast to `Record<string, unknown>`. This helper
 * performs the two-step cast `agent -> unknown -> Record` once.
 *
 * @param agent - The agent instance to cast
 * @returns A record view of the agent for duck-typing checks
 */
function toRecord(agent: IAgent): Record<string, unknown> {
  return agent as unknown as Record<string, unknown>;
}

/**
 * AgentDispatcher - Creates agent instances and dispatches stage execution
 *
 * Usage:
 * ```typescript
 * const dispatcher = new AgentDispatcher();
 *
 * // Register a custom adapter for a specific agent type
 * dispatcher.registerAdapter('collector', async (agent, stage, session) => {
 *   const a = toRecord(agent);
 *   const result = await (a.collectFromText as Function)(session.userRequest);
 *   return JSON.stringify(result);
 * });
 *
 * // Dispatch a pipeline stage
 * const output = await dispatcher.dispatch(stage, session);
 * ```
 */
export class AgentDispatcher {
  private readonly agentCache = new Map<string, IAgent>();
  private readonly callAdapters = new Map<string, AgentCallAdapter>();
  private readonly bridgeRegistry: BridgeRegistry;

  constructor(bridgeRegistry?: BridgeRegistry) {
    this.bridgeRegistry = bridgeRegistry ?? new BridgeRegistry();
    this.registerDefaultAdapters();
  }

  /**
   * Dispatch a pipeline stage to its corresponding agent.
   *
   * Resolves the agentType from the stage definition, creates or retrieves
   * the agent instance, selects the appropriate call adapter, and invokes it.
   *
   * @param stage - Pipeline stage definition identifying which agent to invoke
   * @param session - Current orchestrator session with project context
   * @returns Agent output string
   * @throws AgentDispatchError if the agent type is unknown or dispatch fails
   */
  async dispatch(stage: PipelineStageDefinition, session: OrchestratorSession): Promise<string> {
    const entry = getAgentTypeEntry(stage.agentType);
    if (!entry) {
      throw new AgentDispatchError(
        stage.agentType,
        `Unknown agent type '${stage.agentType}' — not found in AGENT_TYPE_MAP`
      );
    }

    // If a registered (non-stub) bridge supports this agent type, use it
    if (this.bridgeRegistry.hasBridge(stage.agentType)) {
      const bridge = this.bridgeRegistry.resolve(stage.agentType);
      try {
        const request = this.buildAgentRequest(stage, session);
        const response = await bridge.execute(request);
        if (!response.success) {
          throw new AgentDispatchError(
            stage.agentType,
            `Bridge execution failed: ${response.error ?? 'unknown error'}`
          );
        }
        return response.output;
      } catch (error) {
        if (error instanceof AgentDispatchError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new AgentDispatchError(stage.agentType, `Bridge execution failed: ${message}`);
      }
    }

    // Fall back to existing call adapter logic
    let agent: IAgent;
    try {
      agent = await this.getOrCreateAgent(stage.agentType, entry);
    } catch (error) {
      if (error instanceof AgentDispatchError || error instanceof AgentModuleError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new AgentDispatchError(stage.agentType, `Agent creation failed: ${message}`);
    }

    const adapter = this.callAdapters.get(stage.agentType) ?? this.defaultAdapter;

    try {
      return await adapter(agent, stage, session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AgentDispatchError(stage.agentType, `Agent execution failed: ${message}`);
    }
  }

  /**
   * Register a custom call adapter for a specific agent type.
   *
   * Custom adapters override the default adapter for the given agentType.
   * This is useful for agents that have non-standard APIs.
   *
   * @param agentType - Pipeline agent type string (e.g., 'collector')
   * @param adapter - Function that calls the agent's primary method
   */
  registerAdapter(agentType: string, adapter: AgentCallAdapter): void {
    this.callAdapters.set(agentType, adapter);
  }

  /**
   * Check if a custom adapter is registered for the given agent type.
   *
   * @param agentType - Pipeline agent type string
   * @returns True if a custom adapter is registered
   */
  hasAdapter(agentType: string): boolean {
    return this.callAdapters.has(agentType);
  }

  /**
   * Inject a pre-created agent instance into the cache.
   *
   * Useful for testing or when agents are created externally.
   *
   * @param agentType - Pipeline agent type string
   * @param agent - Pre-created agent instance
   */
  setAgent(agentType: string, agent: IAgent): void {
    this.agentCache.set(agentType, agent);
  }

  /**
   * Get a cached agent instance, if present.
   *
   * @param agentType - Pipeline agent type string
   * @returns The cached agent, or undefined
   */
  getCachedAgent(agentType: string): IAgent | undefined {
    return this.agentCache.get(agentType);
  }

  /**
   * Get the number of cached agent instances.
   *
   * @returns The number of agents currently in the cache
   */
  get cacheSize(): number {
    return this.agentCache.size;
  }

  /**
   * Dispose all cached agents and clear the cache.
   */
  async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = [];

    for (const [, agent] of this.agentCache) {
      disposePromises.push(
        agent.dispose().catch(() => {
          // Suppress individual dispose errors
        })
      );
    }

    disposePromises.push(
      this.bridgeRegistry.disposeAll().catch(() => {
        // Suppress bridge dispose errors
      })
    );

    await Promise.all(disposePromises);
    this.agentCache.clear();
    this.callAdapters.clear();
  }

  /**
   * Get the bridge registry for registering custom bridges.
   *
   * @returns The BridgeRegistry instance used by this dispatcher
   */
  getBridgeRegistry(): BridgeRegistry {
    return this.bridgeRegistry;
  }

  // ---------------------------------------------------------------------------
  // Private: Bridge Support
  // ---------------------------------------------------------------------------

  /**
   * Build an AgentRequest from the pipeline stage and orchestrator session.
   *
   * @param stage - Pipeline stage definition
   * @param session - Orchestrator session context
   * @returns AgentRequest for bridge execution
   */
  private buildAgentRequest(
    stage: PipelineStageDefinition,
    session: OrchestratorSession
  ): AgentRequest {
    // Collect outputs from completed prior stages
    const priorStageOutputs: Record<string, string> = {};
    for (const result of session.stageResults) {
      if (result.status === 'completed' && result.output) {
        priorStageOutputs[result.name] = result.output;
      }
    }

    return {
      agentType: stage.agentType,
      input: session.userRequest,
      scratchpadDir: session.scratchpadDir,
      projectDir: session.projectDir,
      priorStageOutputs,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Agent Creation
  // ---------------------------------------------------------------------------

  /**
   * Get or create an agent instance based on AGENT_TYPE_MAP entry.
   *
   * For singleton lifecycle agents, the instance is cached after first creation.
   * For transient agents, a new instance is created on every call.
   *
   * @param agentType - Pipeline agent type string
   * @param entry - Agent type entry from AGENT_TYPE_MAP
   * @returns The agent instance
   */
  private async getOrCreateAgent(agentType: string, entry: AgentTypeEntry): Promise<IAgent> {
    // Check cache for singletons
    if (entry.lifecycle === 'singleton') {
      const cached = this.agentCache.get(agentType);
      if (cached) {
        return cached;
      }
    }

    // Dynamic import the module
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mod: Record<string, unknown> = await import(entry.importPath);

    // Create agent from the imported module
    const agent = await this.createAgentFromModule(mod, agentType, entry);

    // Cache singleton instances
    if (entry.lifecycle === 'singleton') {
      this.agentCache.set(agentType, agent);
    }

    return agent;
  }

  /**
   * Create an IAgent instance from a dynamically imported module.
   *
   * Discovery strategy:
   * 1. Look for a `get*Agent()` or `get*()` singleton accessor function
   * 2. Look for an exported class that produces IAgent instances
   * 3. Look for a `default` export that is a class or IAgent
   *
   * For modules whose classes do not implement IAgent (`requiresWrapper`),
   * a lightweight wrapper is created that delegates initialize/dispose.
   *
   * @param mod - The dynamically imported module
   * @param agentType - Pipeline agent type string
   * @param entry - Agent type entry from AGENT_TYPE_MAP
   * @returns An IAgent instance
   */
  private async createAgentFromModule(
    mod: Record<string, unknown>,
    agentType: string,
    entry: AgentTypeEntry
  ): Promise<IAgent> {
    // Strategy 1: Look for singleton accessor (get*Agent, get*)
    const accessorNames = this.findAccessorNames(mod);
    for (const name of accessorNames) {
      const accessor = mod[name] as () => unknown;
      const instance = accessor();
      if (isAgent(instance)) {
        return instance;
      }
      // If it returns a non-IAgent, wrap it if requiresWrapper
      if (entry.requiresWrapper && instance !== null && typeof instance === 'object') {
        return this.wrapNonAgent(instance as Record<string, unknown>, entry);
      }
    }

    // Strategy 2: Look for exported classes whose names match the agent
    const classNames = this.findClassNames(mod, agentType);
    for (const name of classNames) {
      const Ctor = mod[name] as new (...args: unknown[]) => unknown;
      try {
        const instance = new Ctor();
        if (isAgent(instance)) {
          await instance.initialize();
          return instance;
        }
        if (entry.requiresWrapper && instance !== null && typeof instance === 'object') {
          const wrapped = this.wrapNonAgent(instance as Record<string, unknown>, entry);
          await wrapped.initialize();
          return wrapped;
        }
      } catch {
        // Constructor may require arguments; skip and try next
        continue;
      }
    }

    // Strategy 3: Default export
    if (mod['default'] !== undefined) {
      const defaultExport = mod['default'];
      if (isAgent(defaultExport as Record<string, unknown>)) {
        return defaultExport as IAgent;
      }
      if (typeof defaultExport === 'function') {
        try {
          const Ctor = defaultExport as new (...args: unknown[]) => unknown;
          const instance = new Ctor();
          if (isAgent(instance)) {
            await instance.initialize();
            return instance;
          }
        } catch {
          // Not a constructable default
        }
      }
    }

    throw new AgentModuleError(agentType, entry.importPath);
  }

  /**
   * Find singleton accessor function names in a module (e.g., getCollectorAgent).
   *
   * @param mod - The dynamically imported module
   * @returns Array of function names starting with 'get'
   */
  private findAccessorNames(mod: Record<string, unknown>): string[] {
    return Object.keys(mod).filter(
      (key) => key.startsWith('get') && typeof mod[key] === 'function'
    );
  }

  /**
   * Find class-like exports whose names are plausible for the given agentType.
   *
   * Prioritizes exports whose names contain the agentType fragments.
   *
   * @param mod - The dynamically imported module
   * @param agentType - Pipeline agent type string used for relevance scoring
   * @returns Array of class-like export names, sorted by relevance
   */
  private findClassNames(mod: Record<string, unknown>, agentType: string): string[] {
    const fragments = agentType.split('-').map((f) => f.toLowerCase());

    return Object.keys(mod)
      .filter((key) => {
        const val = mod[key];
        // Check if it looks like a class (function with prototype)
        return (
          typeof val === 'function' &&
          val.prototype !== undefined &&
          key[0] === key[0]?.toUpperCase()
        );
      })
      .sort((a, b) => {
        // Prioritize names that match more agentType fragments
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aScore = fragments.filter((f) => aLower.includes(f)).length;
        const bScore = fragments.filter((f) => bLower.includes(f)).length;
        return bScore - aScore;
      });
  }

  /**
   * Wrap a non-IAgent object in a lightweight IAgent-compatible wrapper.
   *
   * @param instance - The non-IAgent object to wrap
   * @param entry - Agent type entry providing agentId and name
   * @returns An IAgent wrapper around the instance
   */
  private wrapNonAgent(instance: Record<string, unknown>, entry: AgentTypeEntry): IAgent {
    return {
      agentId: entry.agentId,
      name: entry.name,

      async initialize(): Promise<void> {
        if (typeof instance['initialize'] === 'function') {
          await (instance['initialize'] as () => Promise<void>)();
        }
      },

      async dispose(): Promise<void> {
        if (typeof instance['dispose'] === 'function') {
          await (instance['dispose'] as () => Promise<void>)();
        }
      },

      // Preserve access to the wrapped instance for adapters
      ...({ _wrapped: instance } as Record<string, unknown>),
    } as IAgent;
  }

  // ---------------------------------------------------------------------------
  // Private: Call Adapters
  // ---------------------------------------------------------------------------

  /**
   * Register the built-in per-agent call adapters.
   *
   * Each adapter knows how to extract data from OrchestratorSession
   * and call the corresponding agent's primary method.
   */
  private registerDefaultAdapters(): void {
    // Collector: collectFromText(text, projectName?)
    this.callAdapters.set('collector', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['collectFromText'] === 'function') {
        const projectName = path.basename(session.projectDir);
        const result = await (
          a['collectFromText'] as (text: string, project?: string) => Promise<unknown>
        )(session.userRequest, projectName);
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // PRD Writer: generateFromProject(projectId)
    this.callAdapters.set('prd-writer', this.createProjectIdAdapter('generateFromProject'));

    // SRS Writer: generateFromProject(projectId)
    this.callAdapters.set('srs-writer', this.createProjectIdAdapter('generateFromProject'));

    // SDS Writer: generateFromProject(projectId)
    this.callAdapters.set('sds-writer', this.createProjectIdAdapter('generateFromProject'));

    // Repo Detector: startSession + detect + finalize pattern
    this.callAdapters.set('repo-detector', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['detect'] === 'function') {
        const result = await (a['detect'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // GitHub Repo Setup: similar session pattern
    this.callAdapters.set('github-repo-setup', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['setup'] === 'function') {
        const result = await (a['setup'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // Document Reader: startSession + readAll + finalize pattern
    this.callAdapters.set('document-reader', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['readAll'] === 'function') {
        const result = await (a['readAll'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // Codebase Analyzer: startSession + analyze + finalize
    this.callAdapters.set('codebase-analyzer', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['analyze'] === 'function') {
        const result = await (a['analyze'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // Impact Analyzer: startSession + analyze + finalize
    this.callAdapters.set('impact-analyzer', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['analyze'] === 'function') {
        const result = await (a['analyze'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // PRD/SRS/SDS Updaters: updateFromProject(projectId)
    this.callAdapters.set('prd-updater', this.createProjectIdAdapter('updateFromProject'));
    this.callAdapters.set('srs-updater', this.createProjectIdAdapter('updateFromProject'));
    this.callAdapters.set('sds-updater', this.createProjectIdAdapter('updateFromProject'));

    // Regression Tester: startSession + run + finalize
    this.callAdapters.set('regression-tester', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['run'] === 'function') {
        const result = await (a['run'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });

    // Issue Reader (Import pipeline): read(projectDir)
    this.callAdapters.set('issue-reader', async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a['startSession'] === 'function') {
        await (a['startSession'] as (dir: string) => Promise<unknown>)(session.projectDir);
      }
      if (typeof a['read'] === 'function') {
        const result = await (a['read'] as () => Promise<unknown>)();
        if (typeof a['finalize'] === 'function') {
          await (a['finalize'] as () => Promise<unknown>)();
        }
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    });
  }

  /**
   * Create a call adapter that invokes a projectId-based method.
   *
   * Used by doc writers (generateFromProject) and updaters (updateFromProject).
   *
   * @param methodName - The method name to invoke on the agent
   * @returns A call adapter that extracts projectId and invokes the method
   */
  private createProjectIdAdapter(methodName: string): AgentCallAdapter {
    return async (agent, _stage, session) => {
      const a = toRecord(agent);
      if (typeof a[methodName] === 'function') {
        const projectId = path.basename(session.projectDir);
        const result = await (a[methodName] as (id: string) => Promise<unknown>)(projectId);
        return JSON.stringify(result);
      }
      return this.defaultAdapter(agent, _stage, session);
    };
  }

  /**
   * Default call adapter used when no specific adapter is registered.
   *
   * Attempts common method patterns in order:
   * 1. generateFromProject(projectId) -- doc writers
   * 2. analyze(projectDir) -- analyzers
   * 3. Falls back to a descriptive string
   *
   * @param agent - The agent instance
   * @param stage - The pipeline stage definition
   * @param session - The orchestrator session
   * @returns Agent output string
   */
  private defaultAdapter: AgentCallAdapter = async (agent, stage, session) => {
    const a = toRecord(agent);

    // Try generateFromProject pattern (doc writers)
    if (typeof a['generateFromProject'] === 'function') {
      const projectId = path.basename(session.projectDir);
      const result = await (a['generateFromProject'] as (id: string) => Promise<unknown>)(
        projectId
      );
      return JSON.stringify(result);
    }

    // Try analyze pattern (analyzers)
    if (typeof a['analyze'] === 'function') {
      const result = await (a['analyze'] as (dir: string) => Promise<unknown>)(session.projectDir);
      return JSON.stringify(result);
    }

    // Try execute pattern (generic agents)
    if (typeof a['execute'] === 'function') {
      const result = await (a['execute'] as (session: OrchestratorSession) => Promise<unknown>)(
        session
      );
      return JSON.stringify(result);
    }

    return `Agent ${agent.agentId} executed for stage "${stage.name}"`;
  };
}
