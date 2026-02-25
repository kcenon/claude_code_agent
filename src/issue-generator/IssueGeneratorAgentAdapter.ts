/**
 * IssueGenerator Agent Adapter
 *
 * Thin wrapper that adapts IssueGenerator to the IAgent interface
 * for unified agent lifecycle management through AgentFactory.
 *
 * @packageDocumentation
 */

import type { IAgent } from '../agents/types.js';
import { IssueGenerator } from './IssueGenerator.js';
import type { IssueGeneratorConfig } from './IssueGenerator.js';
import type { IssueGenerationResult } from './types.js';

/**
 * Agent ID for IssueGeneratorAgentAdapter
 */
export const ISSUE_GENERATOR_AGENT_ID = 'issue-generator';

/**
 * Adapts IssueGenerator to the IAgent interface
 *
 * Wraps the existing IssueGenerator class and delegates generation logic
 * to it while providing IAgent lifecycle management.
 */
export class IssueGeneratorAgentAdapter implements IAgent {
  public readonly agentId = ISSUE_GENERATOR_AGENT_ID;
  public readonly name = 'Issue Generator Agent';

  private instance: IssueGenerator | null = null;
  private readonly config: IssueGeneratorConfig;

  /**
   * Create an adapter with optional IssueGenerator configuration
   * @param config - Optional configuration for the IssueGenerator instance
   */
  constructor(config: IssueGeneratorConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the agent (IAgent lifecycle)
   *
   * Creates the underlying IssueGenerator instance.
   */
  public async initialize(): Promise<void> {
    await Promise.resolve();
    this.instance = new IssueGenerator(this.config);
  }

  /**
   * Dispose of the agent and release resources
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.instance = null;
  }

  /**
   * Generate issues from an SDS file
   *
   * @param sdsPath - Path to the SDS markdown file
   * @param projectId - Project identifier for output
   * @returns Issue generation result
   */
  public async generateFromFile(
    sdsPath: string,
    projectId: string
  ): Promise<IssueGenerationResult> {
    if (!this.instance) {
      throw new Error('Agent not initialized');
    }
    return this.instance.generateFromFile(sdsPath, projectId);
  }

  /**
   * Generate issues from SDS content string
   *
   * @param sdsContent - SDS markdown content
   * @returns Issue generation result
   */
  public generate(sdsContent: string): IssueGenerationResult {
    if (!this.instance) {
      throw new Error('Agent not initialized');
    }
    return this.instance.generate(sdsContent);
  }

  /**
   * Get the underlying IssueGenerator instance
   * @returns The inner IssueGenerator instance
   * @throws Error if the agent has not been initialized
   */
  public getInner(): IssueGenerator {
    if (!this.instance) {
      throw new Error('Agent not initialized');
    }
    return this.instance;
  }
}
