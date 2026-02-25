/**
 * ProjectInitializer Agent Adapter
 *
 * Thin wrapper that adapts ProjectInitializer to the IAgent interface
 * for unified agent lifecycle management through AgentFactory.
 *
 * @packageDocumentation
 */

import type { IAgent } from '../agents/types.js';
import { ProjectInitializer } from './ProjectInitializer.js';
import type { InitOptions, InitResult } from './types.js';

/**
 * Agent ID for ProjectInitializerAgentAdapter
 */
export const PROJECT_INITIALIZER_AGENT_ID = 'project-initializer';

/**
 * Adapts ProjectInitializer to the IAgent interface
 *
 * The original ProjectInitializer.initialize() performs project scaffolding,
 * which is distinct from the IAgent lifecycle initialize(). This adapter
 * keeps the IAgent initialize() as a no-op and exposes project initialization
 * through the execute() method.
 */
export class ProjectInitializerAgentAdapter implements IAgent {
  public readonly agentId = PROJECT_INITIALIZER_AGENT_ID;
  public readonly name = 'Project Initializer Agent';

  private instance: ProjectInitializer | null = null;
  private defaultOptions: InitOptions | null = null;

  /**
   * Create an adapter with optional default options
   * @param defaultOptions - Default options for creating the ProjectInitializer instance
   */
  constructor(defaultOptions?: InitOptions) {
    this.defaultOptions = defaultOptions ?? null;
  }

  /**
   * Initialize the agent (IAgent lifecycle)
   *
   * Creates the underlying ProjectInitializer instance if default options
   * were provided. Otherwise, the instance is created on first execute() call.
   */
  public async initialize(): Promise<void> {
    await Promise.resolve();
    if (this.defaultOptions) {
      this.instance = new ProjectInitializer(this.defaultOptions);
    }
  }

  /**
   * Dispose of the agent and release resources
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.instance = null;
    this.defaultOptions = null;
  }

  /**
   * Execute project initialization
   *
   * Delegates to the underlying ProjectInitializer.initialize() method.
   *
   * @param options - Init options (required if no default options were provided)
   * @returns Project initialization result
   */
  public async execute(options?: InitOptions): Promise<InitResult> {
    if (options) {
      this.instance = new ProjectInitializer(options);
    }

    if (!this.instance) {
      throw new Error('Agent not initialized: provide options via constructor or execute()');
    }

    return this.instance.initialize();
  }

  /**
   * Get the underlying ProjectInitializer instance
   * @returns The inner ProjectInitializer instance
   * @throws Error if the agent has not been initialized
   */
  public getInner(): ProjectInitializer {
    if (!this.instance) {
      throw new Error('Agent not initialized');
    }
    return this.instance;
  }
}
