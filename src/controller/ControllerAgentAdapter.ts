/**
 * Controller Agent Adapter
 *
 * Thin wrapper that adapts the Controller module (WorkerPoolManager and
 * supporting components) to the IAgent interface for unified agent
 * lifecycle management through AgentFactory.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';

import type { IAgent } from '../agents/types.js';
import { WorkerPoolManager } from './WorkerPoolManager.js';
import { PriorityAnalyzer } from './PriorityAnalyzer.js';
import { ProgressMonitor } from './ProgressMonitor.js';
import type {
  WorkerPoolConfig,
  PriorityAnalyzerConfig,
  ProgressMonitorConfig,
  WorkerPoolStatus,
} from './types.js';

/**
 * Agent ID for ControllerAgentAdapter
 */
export const CONTROLLER_AGENT_ID = 'controller';

/**
 * Configuration for the Controller Agent Adapter
 */
export interface ControllerAgentConfig {
  /** Worker pool configuration */
  readonly pool?: WorkerPoolConfig;
  /** Priority analyzer configuration */
  readonly priority?: PriorityAnalyzerConfig;
  /** Progress monitor configuration */
  readonly progress?: ProgressMonitorConfig;
}

/**
 * Adapts the Controller module to the IAgent interface
 *
 * The Controller module consists of multiple sub-components:
 * - WorkerPoolManager: Manages worker pool and task assignment
 * - PriorityAnalyzer: Analyzes dependency graphs and determines execution order
 * - ProgressMonitor: Monitors overall progress and detects bottlenecks
 *
 * This adapter provides a unified IAgent facade and exposes the
 * orchestrate() method as the primary entry point.
 */
export class ControllerAgentAdapter implements IAgent {
  public readonly agentId = CONTROLLER_AGENT_ID;
  public readonly name = 'Controller Agent';

  private poolManager: WorkerPoolManager | null = null;
  private priorityAnalyzer: PriorityAnalyzer | null = null;
  private progressMonitor: ProgressMonitor | null = null;
  private readonly config: ControllerAgentConfig;

  /**
   * Create an adapter with optional controller configuration
   * @param config - Optional configuration for controller sub-components
   */
  constructor(config: ControllerAgentConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the agent (IAgent lifecycle)
   *
   * Creates the underlying WorkerPoolManager, PriorityAnalyzer,
   * and ProgressMonitor instances.
   */
  public async initialize(): Promise<void> {
    await Promise.resolve();
    this.poolManager = new WorkerPoolManager(this.config.pool);
    this.priorityAnalyzer = new PriorityAnalyzer(this.config.priority);
    this.progressMonitor = new ProgressMonitor(randomUUID(), this.config.progress);
  }

  /**
   * Dispose of the agent and release resources
   *
   * Stops the progress monitor if running and releases all sub-components.
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    if (this.progressMonitor) {
      try {
        this.progressMonitor.stop();
      } catch {
        // Monitor may not be running - safe to ignore
      }
    }
    this.poolManager = null;
    this.priorityAnalyzer = null;
    this.progressMonitor = null;
  }

  /**
   * Get the current pool status
   *
   * Convenience method that delegates to WorkerPoolManager.getPoolStatus().
   *
   * @returns Current worker pool status
   */
  public getPoolStatus(): WorkerPoolStatus {
    if (!this.poolManager) {
      throw new Error('Agent not initialized');
    }
    return this.poolManager.getStatus();
  }

  /**
   * Get the underlying WorkerPoolManager instance
   * @returns The WorkerPoolManager instance
   * @throws Error if the agent has not been initialized
   */
  public getPoolManager(): WorkerPoolManager {
    if (!this.poolManager) {
      throw new Error('Agent not initialized');
    }
    return this.poolManager;
  }

  /**
   * Get the underlying PriorityAnalyzer instance
   * @returns The PriorityAnalyzer instance
   * @throws Error if the agent has not been initialized
   */
  public getPriorityAnalyzer(): PriorityAnalyzer {
    if (!this.priorityAnalyzer) {
      throw new Error('Agent not initialized');
    }
    return this.priorityAnalyzer;
  }

  /**
   * Get the underlying ProgressMonitor instance
   * @returns The ProgressMonitor instance
   * @throws Error if the agent has not been initialized
   */
  public getProgressMonitor(): ProgressMonitor {
    if (!this.progressMonitor) {
      throw new Error('Agent not initialized');
    }
    return this.progressMonitor;
  }
}
