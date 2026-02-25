/**
 * ModeDetector Agent Adapter
 *
 * Thin wrapper that adapts ModeDetector to the IAgent interface
 * for unified agent lifecycle management through AgentFactory.
 *
 * @packageDocumentation
 */

import type { IAgent } from '../agents/types.js';
import { ModeDetector } from './ModeDetector.js';
import type { ModeDetectorConfig, ModeDetectionResult, PipelineMode } from './types.js';

/**
 * Agent ID for ModeDetectorAgentAdapter
 */
export const MODE_DETECTOR_AGENT_ID = 'mode-detector';

/**
 * Adapts ModeDetector to the IAgent interface
 *
 * Wraps the existing ModeDetector class and delegates detection logic
 * to it while providing IAgent lifecycle management.
 */
export class ModeDetectorAgentAdapter implements IAgent {
  public readonly agentId = MODE_DETECTOR_AGENT_ID;
  public readonly name = 'Mode Detector Agent';

  private instance: ModeDetector | null = null;
  private readonly config: ModeDetectorConfig;

  /**
   * Create an adapter with optional ModeDetector configuration
   * @param config - Optional configuration for the ModeDetector instance
   */
  constructor(config: ModeDetectorConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the agent (IAgent lifecycle)
   *
   * Creates the underlying ModeDetector instance.
   */
  public async initialize(): Promise<void> {
    await Promise.resolve();
    this.instance = new ModeDetector(this.config);
  }

  /**
   * Dispose of the agent and release resources
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.instance = null;
  }

  /**
   * Detect the pipeline mode for a project
   *
   * Starts a detection session and runs detection on the given project path.
   *
   * @param projectId - Unique project identifier
   * @param rootPath - Absolute path to the project root
   * @param userInput - Optional user input for keyword analysis
   * @param userOverrideMode - Optional explicit mode override
   * @returns Detection result with selected mode and confidence
   */
  public async detect(
    projectId: string,
    rootPath: string,
    userInput?: string,
    userOverrideMode?: PipelineMode
  ): Promise<ModeDetectionResult> {
    if (!this.instance) {
      throw new Error('Agent not initialized');
    }

    this.instance.startSession(projectId, rootPath, userInput);
    return this.instance.detect(userOverrideMode);
  }

  /**
   * Get the underlying ModeDetector instance
   * @returns The inner ModeDetector instance
   * @throws Error if the agent has not been initialized
   */
  public getInner(): ModeDetector {
    if (!this.instance) {
      throw new Error('Agent not initialized');
    }
    return this.instance;
  }
}
