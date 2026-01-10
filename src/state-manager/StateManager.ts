/**
 * State Manager - High-level state management for AD-SDLC projects
 *
 * Provides state operations with:
 * - State transition validation
 * - History tracking and versioning
 * - Watch mode for state changes
 * - Concurrent access handling via file locking
 *
 * This is a Facade that coordinates multiple focused sub-modules:
 * - StateMachine: State transition logic and validation
 * - StatePersistence: File I/O and state storage
 * - StateHistory: History tracking and checkpoints
 * - StateWatcher: File watching and event notification
 * - StateRecovery: Recovery paths and admin overrides
 *
 * @module state-manager/StateManager
 */

import { Scratchpad } from '../scratchpad/Scratchpad.js';
import type { ScratchpadSection } from '../scratchpad/types.js';
import type {
  StateManagerOptions,
  ProjectState,
  StateChangeCallback,
  StateWatcher,
  StateHistory,
  TransitionResult,
  ProjectStateSummary,
  UpdateOptions,
  ReadStateOptions,
  StateWithMetadata,
  EnhancedTransitionRule,
  StateCheckpoint,
  CheckpointTrigger,
  SkipOptions,
  SkipResult,
  AdminOverride,
  RecoveryAuditEntry,
  RestoreResult,
} from './types.js';
import { InvalidTransitionError, ProjectNotFoundError } from './errors.js';
import { StateMachine } from './StateMachine.js';
import { StatePersistence } from './StatePersistence.js';
import { StateHistoryManager } from './StateHistory.js';
import { StateWatcherManager } from './StateWatcher.js';
import { StateRecovery } from './StateRecovery.js';

/**
 * Default options for StateManager
 */
const DEFAULT_OPTIONS: Required<StateManagerOptions> = {
  basePath: '.ad-sdlc/scratchpad',
  enableLocking: true,
  lockTimeout: 5000,
  enableHistory: true,
  maxHistoryEntries: 50,
};

/**
 * StateManager class for managing project state lifecycle
 *
 * This class serves as a Facade, coordinating multiple focused modules:
 * - StateMachine: Handles state transition rules and validation
 * - StatePersistence: Manages file I/O and locking
 * - StateHistoryManager: Tracks state history and checkpoints
 * - StateWatcherManager: Handles file watching and notifications
 * - StateRecovery: Manages recovery operations
 */
export class StateManager {
  private readonly scratchpad: Scratchpad;
  private readonly options: Required<StateManagerOptions>;

  // Sub-modules
  private readonly stateMachine: StateMachine;
  private readonly persistence: StatePersistence;
  private readonly historyManager: StateHistoryManager;
  private readonly watcherManager: StateWatcherManager;
  private readonly recovery: StateRecovery;

  constructor(options: StateManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize scratchpad
    this.scratchpad = new Scratchpad({
      basePath: this.options.basePath,
      enableLocking: this.options.enableLocking,
      lockTimeout: this.options.lockTimeout,
    });

    // Initialize sub-modules
    this.stateMachine = new StateMachine();

    this.persistence = new StatePersistence(this.scratchpad, this.options.enableLocking);

    this.historyManager = new StateHistoryManager(this.scratchpad, this.options.maxHistoryEntries);

    this.watcherManager = new StateWatcherManager(this.scratchpad, async (section, projectId) => {
      return this.persistence.readYaml(section, projectId);
    });

    this.recovery = new StateRecovery(
      this.stateMachine,
      this.persistence,
      this.historyManager,
      this.options.enableHistory,
      async (section, projectId) => {
        return this.persistence.readYaml(section, projectId);
      }
    );
  }

  // ============================================================
  // Project Initialization
  // ============================================================

  /**
   * Initialize a new project with all required state structures
   *
   * @param projectId - Unique project identifier
   * @param name - Project name
   * @param initialState - Initial project state (default: 'collecting')
   * @returns Project info
   */
  async initializeProject(
    projectId: string,
    name: string,
    initialState: ProjectState = 'collecting'
  ): Promise<ProjectStateSummary> {
    const meta = await this.persistence.initializeProject(projectId, name, initialState);

    // Initialize empty history if enabled
    if (this.options.enableHistory) {
      await this.historyManager.initializeHistory(projectId, 'progress', {
        state: initialState,
        projectName: name,
      });
    }

    return {
      projectId,
      currentState: initialState,
      lastUpdated: meta.updatedAt,
      historyCount: 1,
      hasPendingChanges: false,
    };
  }

  /**
   * Check if a project exists
   *
   * @param projectId - Project identifier
   * @returns True if project exists
   */
  async projectExists(projectId: string): Promise<boolean> {
    return this.persistence.projectExists(projectId);
  }

  /**
   * Delete a project and all its state
   *
   * @param projectId - Project identifier
   */
  async deleteProject(projectId: string): Promise<void> {
    // Stop all watchers for this project
    this.watcherManager.stopProjectWatchers(projectId);

    // Delete project files
    await this.persistence.deleteProject(projectId);
  }

  // ============================================================
  // State Operations
  // ============================================================

  /**
   * Get state for a section
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param options - Read options
   * @returns State value or null if missing and allowMissing is true
   */
  async getState<T>(
    section: ScratchpadSection,
    projectId: string,
    options: ReadStateOptions = {}
  ): Promise<StateWithMetadata<T> | null> {
    const result = await this.persistence.getState<T>(section, projectId, options);

    if (result === null) {
      return null;
    }

    if (options.includeHistory === true && this.options.enableHistory) {
      const history = await this.historyManager.getHistory<T>(section, projectId);
      return { ...result, history: history ?? undefined };
    }

    return result;
  }

  /**
   * Set state for a section (full replacement)
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param data - State data to write
   * @param options - Update options
   */
  /* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
  async setState<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    data: T,
    options: UpdateOptions = {}
  ): Promise<void> {
    const { previousValue, isCreate } = await this.persistence.setState(
      section,
      projectId,
      data,
      options
    );

    // Record history if enabled
    if (this.options.enableHistory) {
      await this.historyManager.addHistoryEntry(section, projectId, data, options.description);
    }

    // Notify watchers
    this.watcherManager.notifyWatchers(
      projectId,
      section,
      previousValue,
      data,
      isCreate ? 'create' : 'update'
    );
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

  /**
   * Update state for a section (partial update/merge)
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param updates - Partial state updates
   * @param options - Update options
   */
  async updateState<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    updates: Partial<T>,
    options: UpdateOptions = {}
  ): Promise<void> {
    const { previousValue, newState } = await this.persistence.updateState(
      section,
      projectId,
      updates,
      options
    );

    // Record history if enabled
    if (this.options.enableHistory) {
      await this.historyManager.addHistoryEntry(section, projectId, newState, options.description);
    }

    // Notify watchers
    this.watcherManager.notifyWatchers(
      projectId,
      section,
      previousValue,
      newState,
      previousValue === null ? 'create' : 'update'
    );
  }

  // ============================================================
  // State Transitions
  // ============================================================

  /**
   * Transition project to a new state
   *
   * @param projectId - Project identifier
   * @param toState - Target state
   * @returns Transition result
   */
  async transitionState(projectId: string, toState: ProjectState): Promise<TransitionResult> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.persistence.getMeta(projectId);
    const fromState = meta.currentState;
    const timestamp = new Date().toISOString();

    // Check if transition is valid
    if (!this.stateMachine.isValidTransition(fromState, toState)) {
      throw new InvalidTransitionError(fromState, toState, projectId);
    }

    // Perform transition
    await this.persistence.transitionState(projectId, toState);

    // Record transition in history
    if (this.options.enableHistory) {
      await this.historyManager.addHistoryEntry(
        'progress',
        projectId,
        {
          transition: { from: fromState, to: toState },
          timestamp,
        },
        `State transition: ${fromState} → ${toState}`
      );
    }

    return {
      success: true,
      previousState: fromState,
      newState: toState,
      timestamp,
    };
  }

  /**
   * Check if a state transition is valid
   *
   * @param from - Source state
   * @param to - Target state
   * @returns True if transition is valid
   */
  isValidTransition(from: ProjectState, to: ProjectState): boolean {
    return this.stateMachine.isValidTransition(from, to);
  }

  /**
   * Get allowed transitions from a state
   *
   * @param from - Source state
   * @returns Array of valid target states
   */
  getValidTransitions(from: ProjectState): readonly ProjectState[] {
    return this.stateMachine.getValidTransitions(from);
  }

  /**
   * Get current project state
   *
   * @param projectId - Project identifier
   * @returns Current project state
   */
  async getCurrentState(projectId: string): Promise<ProjectState> {
    const meta = await this.persistence.getMeta(projectId);
    return meta.currentState;
  }

  /**
   * Get project state summary
   *
   * @param projectId - Project identifier
   * @returns Project state summary
   */
  async getProjectSummary(projectId: string): Promise<ProjectStateSummary> {
    const meta = await this.persistence.getMeta(projectId);
    let historyCount = 0;

    if (this.options.enableHistory) {
      const history = await this.historyManager.getHistory('progress', projectId);
      historyCount = history?.entries.length ?? 0;
    }

    return {
      projectId,
      currentState: meta.currentState,
      lastUpdated: meta.updatedAt,
      historyCount,
      hasPendingChanges: false,
    };
  }

  // ============================================================
  // History Management
  // ============================================================

  /**
   * Get state history for a section
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @returns State history or null if not found
   */
  async getHistory<T>(
    section: ScratchpadSection,
    projectId: string
  ): Promise<StateHistory<T> | null> {
    return this.historyManager.getHistory(section, projectId);
  }

  // ============================================================
  // Watch Mode
  // ============================================================

  /**
   * Watch for state changes
   *
   * @param projectId - Project identifier
   * @param callback - Callback for state changes
   * @param section - Optional section to watch (null for all)
   * @returns State watcher handle
   */
  watchState<T = unknown>(
    projectId: string,
    callback: StateChangeCallback<T>,
    section?: ScratchpadSection
  ): StateWatcher {
    return this.watcherManager.watch(projectId, callback, section);
  }

  // ============================================================
  // Checkpoint System
  // ============================================================

  /**
   * Create a checkpoint for the current project state
   *
   * @param projectId - Project identifier
   * @param trigger - What triggered this checkpoint
   * @param reason - Optional reason for the checkpoint
   * @returns Checkpoint ID
   */
  async createCheckpoint(
    projectId: string,
    trigger: CheckpointTrigger = 'manual',
    reason?: string
  ): Promise<string> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.persistence.getMeta(projectId);
    const now = new Date().toISOString();

    // Collect section states
    const sections = await this.collectSectionStates(projectId);

    const checkpointId = await this.historyManager.createCheckpoint(
      projectId,
      meta.currentState,
      { currentState: meta.currentState, version: meta.version },
      sections,
      trigger,
      reason
    );

    // Record in audit log
    await this.historyManager.recordAudit(projectId, {
      id: checkpointId,
      projectId,
      type: 'checkpoint_created',
      timestamp: now,
      fromState: meta.currentState,
      toState: meta.currentState,
      details: { checkpointId, trigger, reason },
    });

    return checkpointId;
  }

  /**
   * Collect section states for checkpoint
   */
  private async collectSectionStates(
    projectId: string
  ): Promise<Partial<Record<ScratchpadSection, unknown>>> {
    const sections: Partial<Record<ScratchpadSection, unknown>> = {};
    const sectionNames: ScratchpadSection[] = ['info', 'documents', 'issues', 'progress'];

    for (const section of sectionNames) {
      try {
        const sectionState = await this.persistence.readYaml(section, projectId);
        if (sectionState !== null) {
          sections[section] = sectionState;
        }
      } catch {
        // Ignore sections that don't exist
      }
    }

    return sections;
  }

  /**
   * Get all available checkpoints for a project
   *
   * @param projectId - Project identifier
   * @returns List of checkpoints (newest first)
   */
  async getCheckpoints(projectId: string): Promise<StateCheckpoint[]> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    return this.historyManager.getCheckpoints(projectId);
  }

  /**
   * Restore project state from a checkpoint
   *
   * @param projectId - Project identifier
   * @param checkpointId - Checkpoint ID to restore
   * @returns Restore result
   */
  async restoreCheckpoint(projectId: string, checkpointId: string): Promise<RestoreResult> {
    return this.recovery.restoreCheckpoint(projectId, checkpointId);
  }

  // ============================================================
  // Skip-Forward Capability
  // ============================================================

  /**
   * Skip forward to a target state, bypassing intermediate stages
   *
   * @param projectId - Project identifier
   * @param targetState - Target state to skip to
   * @param options - Skip options
   * @returns Skip result
   */
  async skipTo(
    projectId: string,
    targetState: ProjectState,
    options: SkipOptions
  ): Promise<SkipResult> {
    return this.recovery.skipTo(projectId, targetState, options);
  }

  /**
   * Get the stages between two states in the pipeline
   *
   * @param from - Starting state
   * @param to - Target state
   * @returns Array of states between from and to (exclusive)
   */
  getStagesBetween(from: ProjectState, to: ProjectState): ProjectState[] {
    return this.stateMachine.getStagesBetween(from, to);
  }

  /**
   * Check if a stage is required
   *
   * @param state - State to check
   * @returns True if the stage is required
   */
  isStageRequired(state: ProjectState): boolean {
    return this.stateMachine.isStageRequired(state);
  }

  /**
   * Get skip-to options for a state
   *
   * @param from - Current state
   * @returns Array of states that can be skipped to
   */
  getSkipOptions(from: ProjectState): readonly ProjectState[] {
    return this.stateMachine.getSkipOptions(from);
  }

  // ============================================================
  // Admin Override
  // ============================================================

  /**
   * Perform an admin override operation
   *
   * @param projectId - Project identifier
   * @param override - Override specification
   * @returns Transition result
   */
  async adminOverride(projectId: string, override: AdminOverride): Promise<TransitionResult> {
    return this.recovery.adminOverride(projectId, override);
  }

  // ============================================================
  // Recovery Transition
  // ============================================================

  /**
   * Perform a recovery transition (go back to a previous state)
   *
   * @param projectId - Project identifier
   * @param toState - Target recovery state
   * @param reason - Reason for recovery
   * @returns Transition result
   */
  async recoverTo(
    projectId: string,
    toState: ProjectState,
    reason?: string
  ): Promise<TransitionResult> {
    return this.recovery.recoverTo(projectId, toState, reason);
  }

  /**
   * Get recovery options for current state
   *
   * @param from - Current state
   * @returns Array of valid recovery states
   */
  getRecoveryOptions(from: ProjectState): readonly ProjectState[] {
    return this.stateMachine.getRecoveryOptions(from);
  }

  /**
   * Get the enhanced transition rule for a state
   *
   * @param state - State to get rule for
   * @returns Enhanced transition rule or undefined
   */
  getEnhancedTransitionRule(state: ProjectState): EnhancedTransitionRule | undefined {
    return this.stateMachine.getEnhancedTransitionRule(state);
  }

  // ============================================================
  // Audit Logging
  // ============================================================

  /**
   * Get recovery audit log for a project
   *
   * @param projectId - Project identifier
   * @returns Array of audit entries (newest first)
   */
  async getRecoveryAuditLog(projectId: string): Promise<RecoveryAuditEntry[]> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    return this.historyManager.getRecoveryAuditLog(projectId);
  }

  // ============================================================
  // Cleanup
  // ============================================================

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Clean up watcher resources
    this.watcherManager.cleanup();

    // Clean up scratchpad
    await this.scratchpad.cleanup();
  }

  /**
   * Get the underlying scratchpad instance
   */
  getScratchpad(): Scratchpad {
    return this.scratchpad;
  }
}

/**
 * Singleton instance for global access
 */
let globalStateManager: StateManager | null = null;

/**
 * Get or create the global StateManager instance
 *
 * @param options - Options for creating new instance
 * @returns The global StateManager instance
 */
export function getStateManager(options?: StateManagerOptions): StateManager {
  if (globalStateManager === null) {
    globalStateManager = new StateManager(options);
  }
  return globalStateManager;
}

/**
 * Reset the global StateManager instance (for testing)
 */
export function resetStateManager(): void {
  if (globalStateManager !== null) {
    globalStateManager.cleanup().catch(() => {});
    globalStateManager = null;
  }
}
