/**
 * Control Plane Facade
 *
 * Provides a unified, high-level API for Control-Plane operations
 * including pipeline orchestration, state management, mode detection,
 * and agent lifecycle tracking.
 *
 * This facade delegates to underlying modules (StateManager, ModeDetector,
 * AnalysisOrchestratorAgent, PriorityAnalyzer) while providing:
 * - Centralized error handling with consistent ControlPlaneError types
 * - Agent registry for lifecycle tracking
 * - Cross-cutting request routing
 *
 * @module control-plane/ControlPlane
 */

import { AppError } from '../errors/AppError.js';
import { ControlPlaneErrorCodes } from '../errors/codes.js';
import { ErrorSeverity } from '../errors/types.js';
import type { AppErrorOptions, ErrorCategory } from '../errors/types.js';
import { getStateManager, resetStateManager } from '../state-manager/index.js';
import type {
  ProjectState,
  TransitionResult,
  ProjectStateSummary,
  StateManagerOptions,
} from '../state-manager/index.js';
import { getModeDetector, resetModeDetector } from '../mode-detector/index.js';
import type {
  PipelineMode,
  ModeDetectionResult,
  ModeDetectionSession,
  ModeDetectorConfig,
} from '../mode-detector/index.js';
import {
  getAnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
} from '../analysis-orchestrator/index.js';
import type {
  AnalysisInput,
  AnalysisSession,
  PipelineState,
  AnalysisOrchestratorConfig,
} from '../analysis-orchestrator/index.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Base error for all Control-Plane operations
 */
export class ControlPlaneError extends AppError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.HIGH,
      category: options.category ?? 'recoverable',
      ...options,
    });
    this.name = 'ControlPlaneError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error starting or managing a pipeline
 */
export class PipelineOperationError extends ControlPlaneError {
  constructor(
    operation: 'start' | 'resume' | 'state',
    message: string,
    options: AppErrorOptions = {}
  ) {
    const codeMap = {
      start: ControlPlaneErrorCodes.CPL_PIPELINE_START_ERROR,
      resume: ControlPlaneErrorCodes.CPL_PIPELINE_RESUME_ERROR,
      state: ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR,
    };
    super(codeMap[operation], message, {
      context: { operation, ...options.context },
      ...options,
    });
    this.name = 'PipelineOperationError';
  }
}

/**
 * Error in agent registry operations
 */
export class AgentRegistryError extends ControlPlaneError {
  constructor(
    agentId: string,
    reason: 'not_registered' | 'already_registered' | 'lifecycle',
    message: string,
    options: AppErrorOptions = {}
  ) {
    const codeMap = {
      not_registered: ControlPlaneErrorCodes.CPL_AGENT_NOT_REGISTERED,
      already_registered: ControlPlaneErrorCodes.CPL_AGENT_ALREADY_REGISTERED,
      lifecycle: ControlPlaneErrorCodes.CPL_AGENT_LIFECYCLE_ERROR,
    };
    super(codeMap[reason], message, {
      context: { agentId, ...options.context },
      ...options,
    });
    this.name = 'AgentRegistryError';
  }
}

// ---------------------------------------------------------------------------
// Agent registry types
// ---------------------------------------------------------------------------

/** Possible agent lifecycle states */
export type AgentStatus = 'registered' | 'initializing' | 'ready' | 'busy' | 'error' | 'disposed';

/** Information tracked for each registered agent */
export interface AgentInfo {
  /** Unique identifier for the agent */
  id: string;
  /** Human-readable name */
  name: string;
  /** Current lifecycle status */
  status: AgentStatus;
  /** Timestamp of last status change */
  lastUpdated: string;
  /** Optional metadata */
  metadata: Record<string, unknown>;
}

/** Options for creating a ControlPlane instance */
export interface ControlPlaneOptions {
  stateManager?: StateManagerOptions;
  modeDetector?: Partial<ModeDetectorConfig>;
  orchestrator?: Partial<AnalysisOrchestratorConfig>;
}

// ---------------------------------------------------------------------------
// ControlPlane facade
// ---------------------------------------------------------------------------

/**
 * Control-Plane facade coordinating pipeline orchestration, state management,
 * mode detection, and agent lifecycle.
 *
 * Follows the singleton pattern used by other control-plane modules
 * (StateManager, ModeDetector, AnalysisOrchestratorAgent).
 *
 * @example
 * ```typescript
 * const cp = getControlPlane();
 *
 * // Detect pipeline mode
 * const mode = await cp.detectMode('project-1', '/path/to/project');
 *
 * // Manage project state
 * const state = await cp.getProjectState('project-1');
 *
 * // Agent lifecycle
 * cp.registerAgent('collector', 'Collector Agent');
 * cp.updateAgentStatus('collector', 'ready');
 * ```
 */
export class ControlPlane {
  private readonly agents = new Map<string, AgentInfo>();
  private readonly options: ControlPlaneOptions;

  constructor(options: ControlPlaneOptions = {}) {
    this.options = options;
  }

  // -------------------------------------------------------------------------
  // State management delegation
  // -------------------------------------------------------------------------

  /**
   * Initialize a new project in the state machine
   *
   * @param projectId - Unique project identifier
   * @param rootPath - Absolute path to the project directory
   */
  async initializeProject(projectId: string, rootPath: string): Promise<void> {
    try {
      const sm = getStateManager(this.options.stateManager);
      await sm.initializeProject(projectId, rootPath);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_INIT_ERROR,
        `Failed to initialize project: ${projectId}`,
        { projectId, rootPath }
      );
    }
  }

  /**
   * Transition a project to a new pipeline state
   *
   * @param projectId - Project identifier
   * @param toState - Target state
   * @returns Transition result with from/to states and metadata
   */
  async transitionState(projectId: string, toState: ProjectState): Promise<TransitionResult> {
    try {
      const sm = getStateManager(this.options.stateManager);
      return await sm.transitionState(projectId, toState);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR,
        `Failed to transition project ${projectId} to ${toState}`,
        { projectId, toState }
      );
    }
  }

  /**
   * Get the current state of a project
   *
   * @param projectId - Project identifier
   * @returns Current project state
   */
  async getProjectState(projectId: string): Promise<ProjectState> {
    try {
      const sm = getStateManager(this.options.stateManager);
      return await sm.getCurrentState(projectId);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR,
        `Failed to get state for project: ${projectId}`,
        { projectId }
      );
    }
  }

  /**
   * Get a summary of a project's state including history
   *
   * @param projectId - Project identifier
   * @returns Project state summary
   */
  async getProjectSummary(projectId: string): Promise<ProjectStateSummary> {
    try {
      const sm = getStateManager(this.options.stateManager);
      return await sm.getProjectSummary(projectId);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR,
        `Failed to get summary for project: ${projectId}`,
        { projectId }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Mode detection delegation
  // -------------------------------------------------------------------------

  /**
   * Detect the pipeline mode (greenfield, enhancement, or import)
   * for a given project
   *
   * @param projectId - Project identifier
   * @param rootPath - Absolute path to the project directory
   * @param userInput - Optional user input for keyword analysis
   * @param overrideMode - Optional explicit mode override
   * @returns Detection result with mode, confidence, and evidence
   */
  async detectMode(
    projectId: string,
    rootPath: string,
    userInput?: string,
    overrideMode?: PipelineMode
  ): Promise<ModeDetectionResult> {
    try {
      const detector = getModeDetector(this.options.modeDetector as ModeDetectorConfig | undefined);
      detector.startSession(projectId, rootPath, userInput);
      return await detector.detect(overrideMode);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_MODE_DETECTION_ERROR,
        `Mode detection failed for project: ${projectId}`,
        { projectId, rootPath }
      );
    }
  }

  /**
   * Get the current mode detection session
   *
   * @returns Active session or null
   */
  getModeDetectionSession(): ModeDetectionSession | null {
    const detector = getModeDetector(this.options.modeDetector as ModeDetectorConfig | undefined);
    return detector.getSession();
  }

  // -------------------------------------------------------------------------
  // Analysis orchestration delegation
  // -------------------------------------------------------------------------

  /**
   * Start a new analysis pipeline
   *
   * @param input - Analysis input (project path, scope, etc.)
   * @returns Analysis session with tracking information
   */
  async startAnalysis(input: AnalysisInput): Promise<AnalysisSession> {
    try {
      const orchestrator = getAnalysisOrchestratorAgent(
        this.options.orchestrator as AnalysisOrchestratorConfig | undefined
      );
      return await orchestrator.startAnalysis(input);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_PIPELINE_START_ERROR,
        `Failed to start analysis for: ${input.projectPath}`,
        { projectPath: input.projectPath, scope: input.scope }
      );
    }
  }

  /**
   * Resume a previously started analysis pipeline
   *
   * @param analysisId - ID of the analysis to resume
   * @param rootPath - Project root path
   * @param retryFailed - Whether to retry failed stages (default: true)
   * @returns Resumed analysis session
   */
  async resumeAnalysis(
    analysisId: string,
    rootPath: string,
    retryFailed: boolean = true
  ): Promise<AnalysisSession> {
    try {
      const orchestrator = getAnalysisOrchestratorAgent(
        this.options.orchestrator as AnalysisOrchestratorConfig | undefined
      );
      return await orchestrator.resume(analysisId, rootPath, retryFailed);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_PIPELINE_RESUME_ERROR,
        `Failed to resume analysis: ${analysisId}`,
        { analysisId, rootPath }
      );
    }
  }

  /**
   * Get the status of an active analysis pipeline
   *
   * @param analysisId - Analysis identifier
   * @param rootPath - Project root path
   * @returns Current pipeline state
   */
  async getAnalysisStatus(analysisId: string, rootPath: string): Promise<PipelineState> {
    try {
      const orchestrator = getAnalysisOrchestratorAgent(
        this.options.orchestrator as AnalysisOrchestratorConfig | undefined
      );
      return await orchestrator.getStatus(analysisId, rootPath);
    } catch (error) {
      throw this.wrapError(
        error,
        ControlPlaneErrorCodes.CPL_PIPELINE_STATE_ERROR,
        `Failed to get analysis status: ${analysisId}`,
        { analysisId, rootPath }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Agent registry
  // -------------------------------------------------------------------------

  /**
   * Register an agent in the lifecycle registry
   *
   * @param id - Unique agent identifier
   * @param name - Human-readable agent name
   * @param metadata - Optional metadata
   * @returns Registered agent information
   * @throws AgentRegistryError if agent is already registered
   */
  registerAgent(id: string, name: string, metadata: Record<string, unknown> = {}): AgentInfo {
    if (this.agents.has(id)) {
      throw new AgentRegistryError(id, 'already_registered', `Agent already registered: ${id}`);
    }

    const info: AgentInfo = {
      id,
      name,
      status: 'registered',
      lastUpdated: new Date().toISOString(),
      metadata,
    };

    this.agents.set(id, info);
    return info;
  }

  /**
   * Update an agent's lifecycle status
   *
   * @param id - Agent identifier
   * @param status - New status
   * @returns Updated agent information
   * @throws AgentRegistryError if agent is not registered
   */
  updateAgentStatus(id: string, status: AgentStatus): AgentInfo {
    const info = this.agents.get(id);
    if (!info) {
      throw new AgentRegistryError(id, 'not_registered', `Agent not registered: ${id}`);
    }

    info.status = status;
    info.lastUpdated = new Date().toISOString();
    return info;
  }

  /**
   * Remove an agent from the registry
   *
   * @param id - Agent identifier
   * @returns true if agent was removed, false if not found
   */
  unregisterAgent(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * Get information about a registered agent
   *
   * @param id - Agent identifier
   * @returns Agent info or undefined
   */
  getAgent(id: string): AgentInfo | undefined {
    return this.agents.get(id);
  }

  /**
   * List all registered agents, optionally filtered by status
   *
   * @param status - Optional status filter
   * @returns Array of agent information
   */
  listAgents(status?: AgentStatus): AgentInfo[] {
    const all = Array.from(this.agents.values());
    if (status !== undefined) {
      return all.filter((a) => a.status === status);
    }
    return all;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Clean up all underlying resources
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    this.agents.clear();

    // StateManager cleanup is async (involves scratchpad I/O and watcher teardown)
    const sm = getStateManager(this.options.stateManager);
    await sm.cleanup();

    resetStateManager();
    resetModeDetector();
    resetAnalysisOrchestratorAgent();
  }

  // -------------------------------------------------------------------------
  // Error wrapping
  // -------------------------------------------------------------------------

  private wrapError(
    error: unknown,
    code: string,
    message: string,
    context: Record<string, unknown>,
    category: ErrorCategory = 'recoverable'
  ): ControlPlaneError {
    if (error instanceof ControlPlaneError) {
      return error;
    }

    const cause = error instanceof Error ? error : new Error(String(error));
    return new ControlPlaneError(code, message, {
      cause,
      context,
      category,
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: ControlPlane | null = null;

/**
 * Get or create the singleton ControlPlane instance
 *
 * @param options - Options applied only on first creation
 * @returns ControlPlane singleton
 */
export function getControlPlane(options?: ControlPlaneOptions): ControlPlane {
  if (instance === null) {
    instance = new ControlPlane(options);
  }
  return instance;
}

/**
 * Reset the singleton for testing or reconfiguration
 */
export function resetControlPlane(): void {
  instance = null;
}
