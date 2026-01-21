/**
 * AgentFactory - Unified factory for agent instantiation
 *
 * Provides centralized agent creation with:
 * - Singleton caching for singleton lifecycle agents
 * - Fresh instances for transient lifecycle agents
 * - Automatic dependency injection
 * - Lifecycle management (initialize/dispose)
 *
 * @packageDocumentation
 */

import type {
  IAgent,
  CreateAgentOptions,
  AgentDependencies,
} from './types.js';
import { AgentRegistry } from './AgentRegistry.js';

/**
 * Error thrown when agent creation fails
 */
export class AgentCreationError extends Error {
  constructor(agentId: string, cause: string) {
    super(`Failed to create agent ${agentId}: ${cause}`);
    this.name = 'AgentCreationError';
  }
}

/**
 * Error thrown when agent initialization fails
 */
export class AgentInitializationError extends Error {
  constructor(agentId: string, cause: string) {
    super(`Failed to initialize agent ${agentId}: ${cause}`);
    this.name = 'AgentInitializationError';
  }
}

/**
 * Error thrown when dependency resolution fails
 */
export class DependencyResolutionError extends Error {
  constructor(agentId: string, missingDeps: string[]) {
    super(
      `Cannot create agent ${agentId}: missing dependencies [${missingDeps.join(', ')}]`
    );
    this.name = 'DependencyResolutionError';
  }
}

/**
 * AgentFactory - Singleton factory for creating agent instances
 *
 * @example
 * ```typescript
 * const factory = AgentFactory.getInstance();
 *
 * // Create a singleton agent (returns cached instance on subsequent calls)
 * const collector = await factory.create<CollectorAgent>('collector-agent');
 *
 * // Create a transient agent (new instance each time)
 * const worker = await factory.create<WorkerAgent>('worker-agent');
 *
 * // Force new instance even for singleton
 * const freshCollector = await factory.create<CollectorAgent>('collector-agent', {
 *   forceNew: true,
 * });
 * ```
 */
export class AgentFactory {
  private static instance: AgentFactory | null = null;

  private readonly singletonCache: Map<string, IAgent> = new Map();
  private readonly registry: AgentRegistry;

  private constructor() {
    this.registry = AgentRegistry.getInstance();
  }

  /**
   * Get the singleton factory instance
   *
   * @returns The AgentFactory singleton
   */
  public static getInstance(): AgentFactory {
    if (AgentFactory.instance === null) {
      AgentFactory.instance = new AgentFactory();
    }
    return AgentFactory.instance;
  }

  /**
   * Reset the factory and clear all cached instances (for testing)
   */
  public static async reset(): Promise<void> {
    if (AgentFactory.instance !== null) {
      await AgentFactory.instance.disposeAll();
      AgentFactory.instance.singletonCache.clear();
      AgentFactory.instance = null;
    }
  }

  /**
   * Create or retrieve an agent instance
   *
   * For singleton agents, returns the cached instance if available.
   * For transient agents, creates a new instance each time.
   *
   * @typeParam T - The agent type to create
   * @param agentId - ID of the agent to create
   * @param options - Creation options
   * @returns The agent instance
   * @throws AgentNotRegisteredError if agent is not registered
   * @throws DependencyResolutionError if dependencies cannot be resolved
   * @throws AgentCreationError if factory function fails
   * @throws AgentInitializationError if initialization fails
   */
  public async create<T extends IAgent>(
    agentId: string,
    options: CreateAgentOptions = {}
  ): Promise<T> {
    const { forceNew = false, skipInitialize = false } = options;

    const metadata = this.registry.get<T>(agentId);

    // Return cached singleton if available and not forcing new
    if (metadata.lifecycle === 'singleton' && !forceNew) {
      const cached = this.singletonCache.get(agentId);
      if (cached) {
        return cached as T;
      }
    }

    // Validate dependencies
    const missingDeps = this.registry.validateDependencies(agentId);
    if (missingDeps.length > 0) {
      const requiredMissing = missingDeps.filter((depId) => {
        const dep = metadata.dependencies.find((d) => d.agentId === depId);
        return !dep?.optional;
      });

      if (requiredMissing.length > 0) {
        throw new DependencyResolutionError(agentId, requiredMissing);
      }
    }

    // Resolve dependencies
    const dependencies = await this.resolveDependencies(agentId);

    // Create the agent
    let agent: T;
    try {
      agent = metadata.factory(dependencies) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AgentCreationError(agentId, message);
    }

    // Initialize if not skipped
    if (!skipInitialize) {
      try {
        await agent.initialize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new AgentInitializationError(agentId, message);
      }
    }

    // Cache singleton
    if (metadata.lifecycle === 'singleton') {
      // If forceNew was used, dispose the old instance first
      if (forceNew) {
        const oldInstance = this.singletonCache.get(agentId);
        if (oldInstance) {
          try {
            await oldInstance.dispose();
          } catch {
            // Ignore dispose errors when replacing
          }
        }
      }
      this.singletonCache.set(agentId, agent);
    }

    return agent;
  }

  /**
   * Check if a singleton agent is cached
   *
   * @param agentId - Agent ID to check
   * @returns True if agent is cached
   */
  public isCached(agentId: string): boolean {
    return this.singletonCache.has(agentId);
  }

  /**
   * Get a cached singleton instance without creating one
   *
   * @typeParam T - The agent type
   * @param agentId - Agent ID to retrieve
   * @returns The cached agent or undefined
   */
  public getCached<T extends IAgent>(agentId: string): T | undefined {
    return this.singletonCache.get(agentId) as T | undefined;
  }

  /**
   * Dispose a specific agent
   *
   * @param agentId - Agent ID to dispose
   * @returns True if agent was disposed, false if not found
   */
  public async dispose(agentId: string): Promise<boolean> {
    const cached = this.singletonCache.get(agentId);
    if (!cached) {
      return false;
    }

    try {
      await cached.dispose();
    } finally {
      this.singletonCache.delete(agentId);
    }

    return true;
  }

  /**
   * Dispose all cached agents
   */
  public async disposeAll(): Promise<void> {
    const disposePromises: Promise<void>[] = [];

    for (const [, agent] of this.singletonCache) {
      disposePromises.push(
        agent.dispose().catch(() => {
          // Ignore individual dispose errors
        })
      );
    }

    await Promise.all(disposePromises);
    this.singletonCache.clear();
  }

  /**
   * Get the number of cached singleton instances
   *
   * @returns Number of cached instances
   */
  public getCacheSize(): number {
    return this.singletonCache.size;
  }

  /**
   * Get all cached agent IDs
   *
   * @returns Array of cached agent IDs
   */
  public getCachedAgentIds(): string[] {
    return Array.from(this.singletonCache.keys());
  }

  /**
   * Resolve dependencies for an agent
   */
  private async resolveDependencies(agentId: string): Promise<AgentDependencies> {
    const metadata = this.registry.get(agentId);
    const dependencies: AgentDependencies = {};

    for (const dep of metadata.dependencies) {
      if (this.registry.has(dep.agentId)) {
        dependencies[dep.agentId] = await this.create(dep.agentId);
      } else if (!dep.optional) {
        // This shouldn't happen if validateDependencies was called
        throw new DependencyResolutionError(agentId, [dep.agentId]);
      }
    }

    return dependencies;
  }
}
