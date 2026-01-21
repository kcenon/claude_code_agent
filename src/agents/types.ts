/**
 * Agent Types - Core interfaces and types for the AgentFactory pattern
 *
 * This module defines the foundational types for unified agent instantiation:
 * - IAgent interface for all agents to implement
 * - AgentLifecycle enum for singleton vs transient agents
 * - AgentMetadata for agent registration
 * - AgentDependency for dependency injection
 *
 * @packageDocumentation
 */

/**
 * Agent lifecycle type
 *
 * - singleton: Single instance shared across the application
 * - transient: New instance created on each request
 */
export type AgentLifecycle = 'singleton' | 'transient';

/**
 * Base interface that all agents must implement
 *
 * Provides common lifecycle methods and identification for unified
 * agent management through AgentFactory.
 *
 * @example
 * ```typescript
 * class MyAgent implements IAgent {
 *   readonly agentId = 'my-agent';
 *   readonly name = 'My Agent';
 *
 *   async initialize(): Promise<void> {
 *     // Setup resources
 *   }
 *
 *   async dispose(): Promise<void> {
 *     // Cleanup resources
 *   }
 * }
 * ```
 */
export interface IAgent {
  /**
   * Unique identifier for this agent type
   * Used for registration and lookup in AgentFactory
   */
  readonly agentId: string;

  /**
   * Human-readable name for the agent
   */
  readonly name: string;

  /**
   * Initialize the agent
   * Called after construction, before first use
   *
   * @returns Promise that resolves when initialization is complete
   */
  initialize(): Promise<void>;

  /**
   * Dispose of the agent and release resources
   * Called when the agent is no longer needed
   *
   * @returns Promise that resolves when cleanup is complete
   */
  dispose(): Promise<void>;
}

/**
 * Configuration for agent dependencies
 */
export interface AgentDependency {
  /**
   * Agent ID of the dependency
   */
  agentId: string;

  /**
   * Whether this dependency is optional
   * @default false
   */
  optional?: boolean;
}

/**
 * Metadata for registering an agent with AgentRegistry
 *
 * @example
 * ```typescript
 * const metadata: AgentMetadata = {
 *   agentId: 'collector-agent',
 *   name: 'Collector Agent',
 *   description: 'Collects information from various sources',
 *   lifecycle: 'singleton',
 *   dependencies: [],
 *   factory: (deps) => new CollectorAgent(deps.config),
 * };
 * ```
 */
export interface AgentMetadata<T extends IAgent = IAgent> {
  /**
   * Unique identifier for the agent
   */
  agentId: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of the agent's purpose
   */
  description: string;

  /**
   * Lifecycle type: singleton or transient
   */
  lifecycle: AgentLifecycle;

  /**
   * Dependencies required by this agent
   */
  dependencies: AgentDependency[];

  /**
   * Factory function to create agent instances
   *
   * @param dependencies - Resolved dependencies map
   * @returns New agent instance
   */
  factory: (dependencies: AgentDependencies) => T;
}

/**
 * Map of resolved agent dependencies
 * Key is the agentId, value is the agent instance
 */
export interface AgentDependencies {
  [agentId: string]: IAgent;
}

/**
 * Options for creating an agent through AgentFactory
 */
export interface CreateAgentOptions {
  /**
   * Force creation of a new instance even for singleton agents
   * Useful for testing
   * @default false
   */
  forceNew?: boolean;

  /**
   * Skip initialization after creation
   * @default false
   */
  skipInitialize?: boolean;
}

/**
 * Result of agent registration
 */
export interface RegistrationResult {
  /**
   * Whether registration was successful
   */
  success: boolean;

  /**
   * Agent ID that was registered
   */
  agentId: string;

  /**
   * Error message if registration failed
   */
  error?: string;
}

/**
 * Type guard to check if an object implements IAgent
 *
 * @param obj - Object to check
 * @returns True if object implements IAgent interface
 */
export function isAgent(obj: unknown): obj is IAgent {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }

  const agent = obj as Partial<IAgent>;

  return (
    typeof agent.agentId === 'string' &&
    typeof agent.name === 'string' &&
    typeof agent.initialize === 'function' &&
    typeof agent.dispose === 'function'
  );
}
