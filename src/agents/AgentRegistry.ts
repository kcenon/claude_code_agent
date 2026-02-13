/**
 * AgentRegistry - Central registry for agent metadata
 *
 * Manages registration and lookup of agent metadata for use by AgentFactory.
 * Provides validation, dependency checking, and metadata retrieval.
 *
 * @packageDocumentation
 */

import type { AgentMetadata, IAgent, RegistrationResult, AgentDependency } from './types.js';

/**
 * Error thrown when an agent is not found in the registry
 */
export class AgentNotRegisteredError extends Error {
  constructor(agentId: string) {
    super(`Agent not registered: ${agentId}`);
    this.name = 'AgentNotRegisteredError';
  }
}

/**
 * Error thrown when an agent is already registered
 */
export class AgentAlreadyRegisteredError extends Error {
  constructor(agentId: string) {
    super(`Agent already registered: ${agentId}`);
    this.name = 'AgentAlreadyRegisteredError';
  }
}

/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends Error {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * AgentRegistry - Singleton registry for agent metadata
 *
 * @example
 * ```typescript
 * const registry = AgentRegistry.getInstance();
 *
 * // Register an agent
 * registry.register({
 *   agentId: 'my-agent',
 *   name: 'My Agent',
 *   description: 'Does something useful',
 *   lifecycle: 'singleton',
 *   dependencies: [],
 *   factory: () => new MyAgent(),
 * });
 *
 * // Get agent metadata
 * const metadata = registry.get('my-agent');
 * ```
 */
export class AgentRegistry {
  private static instance: AgentRegistry | null = null;

  private readonly agents: Map<string, AgentMetadata> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton registry instance
   *
   * @returns The AgentRegistry singleton
   */
  public static getInstance(): AgentRegistry {
    if (AgentRegistry.instance === null) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Reset the registry (for testing)
   */
  public static reset(): void {
    if (AgentRegistry.instance !== null) {
      AgentRegistry.instance.agents.clear();
      AgentRegistry.instance = null;
    }
  }

  /**
   * Register an agent with the registry
   *
   * @param metadata - Agent metadata to register
   * @returns Registration result
   * @throws AgentAlreadyRegisteredError if agent is already registered
   */
  public register<T extends IAgent>(metadata: AgentMetadata<T>): RegistrationResult {
    if (this.agents.has(metadata.agentId)) {
      throw new AgentAlreadyRegisteredError(metadata.agentId);
    }

    // Validate metadata
    const validationError = this.validateMetadata(metadata);
    if (validationError !== null) {
      return {
        success: false,
        agentId: metadata.agentId,
        error: validationError,
      };
    }

    this.agents.set(metadata.agentId, metadata as AgentMetadata);

    return {
      success: true,
      agentId: metadata.agentId,
    };
  }

  /**
   * Get agent metadata by ID
   *
   * @param agentId - Agent ID to look up
   * @returns Agent metadata
   * @throws AgentNotRegisteredError if agent is not found
   */
  public get<T extends IAgent = IAgent>(agentId: string): AgentMetadata<T> {
    const metadata = this.agents.get(agentId);
    if (!metadata) {
      throw new AgentNotRegisteredError(agentId);
    }
    return metadata as AgentMetadata<T>;
  }

  /**
   * Check if an agent is registered
   *
   * @param agentId - Agent ID to check
   * @returns True if agent is registered
   */
  public has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get all registered agent IDs
   *
   * @returns Array of registered agent IDs
   */
  public getAll(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all agent metadata
   *
   * @returns Array of all registered agent metadata
   */
  public getAllMetadata(): AgentMetadata[] {
    return Array.from(this.agents.values());
  }

  /**
   * Unregister an agent
   *
   * @param agentId - Agent ID to unregister
   * @returns True if agent was unregistered, false if not found
   */
  public unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get the dependency chain for an agent
   *
   * @param agentId - Agent ID to get dependencies for
   * @returns Array of agent IDs in dependency order
   * @throws CircularDependencyError if a circular dependency is detected
   */
  public getDependencyChain(agentId: string): string[] {
    const visited = new Set<string>();
    const chain: string[] = [];

    this.resolveDependencies(agentId, visited, chain, [agentId]);

    return chain;
  }

  /**
   * Validate that all dependencies can be resolved
   *
   * @param agentId - Agent ID to validate
   * @returns Array of missing dependency IDs
   */
  public validateDependencies(agentId: string): string[] {
    const metadata = this.get(agentId);
    const missing: string[] = [];

    for (const dep of metadata.dependencies) {
      if (dep.optional !== true && !this.has(dep.agentId)) {
        missing.push(dep.agentId);
      }
    }

    return missing;
  }

  /**
   * Recursively resolve dependencies
   * @param agentId - Agent ID to resolve dependencies for
   * @param visited - Set of already visited agent IDs
   * @param chain - Resolved dependency chain being built
   * @param path - Current traversal path for cycle detection
   */
  private resolveDependencies(
    agentId: string,
    visited: Set<string>,
    chain: string[],
    path: string[]
  ): void {
    if (visited.has(agentId)) {
      return;
    }

    const metadata = this.agents.get(agentId);
    if (!metadata) {
      return; // Missing dependency, will be caught by validateDependencies
    }

    for (const dep of metadata.dependencies) {
      if (path.includes(dep.agentId)) {
        throw new CircularDependencyError([...path, dep.agentId]);
      }

      this.resolveDependencies(dep.agentId, visited, chain, [...path, dep.agentId]);
    }

    visited.add(agentId);
    chain.push(agentId);
  }

  /**
   * Validate agent metadata
   * @param metadata - Agent metadata to validate
   * @returns Error message string if invalid, null if valid
   */
  private validateMetadata(metadata: AgentMetadata): string | null {
    if (!metadata.agentId || typeof metadata.agentId !== 'string') {
      return 'agentId is required and must be a string';
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      return 'name is required and must be a string';
    }

    if (!['singleton', 'transient'].includes(metadata.lifecycle)) {
      return 'lifecycle must be "singleton" or "transient"';
    }

    if (typeof metadata.factory !== 'function') {
      return 'factory must be a function';
    }

    // Validate dependencies format
    if (!Array.isArray(metadata.dependencies)) {
      return 'dependencies must be an array';
    }

    for (const dep of metadata.dependencies) {
      if (!this.isValidDependency(dep)) {
        return `Invalid dependency format: ${JSON.stringify(dep)}`;
      }
    }

    return null;
  }

  /**
   * Check if a dependency object is valid
   * @param dep - Value to check as a valid dependency
   * @returns True if the value is a valid AgentDependency
   */
  private isValidDependency(dep: unknown): dep is AgentDependency {
    if (dep === null || typeof dep !== 'object') {
      return false;
    }

    const d = dep as Partial<AgentDependency>;
    return typeof d.agentId === 'string';
  }
}
