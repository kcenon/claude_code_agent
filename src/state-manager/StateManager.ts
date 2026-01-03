/**
 * State Manager - High-level state management for AD-SDLC projects
 *
 * Provides state operations with:
 * - State transition validation
 * - History tracking and versioning
 * - Watch mode for state changes
 * - Concurrent access handling via file locking
 *
 * @module state-manager/StateManager
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Scratchpad } from '../scratchpad/Scratchpad.js';
import type { ScratchpadSection } from '../scratchpad/types.js';
import type {
  StateManagerOptions,
  ProjectState,
  StateChangeEvent,
  StateChangeCallback,
  StateWatcher,
  StateHistoryEntry,
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
import {
  InvalidTransitionError,
  StateNotFoundError,
  ProjectNotFoundError,
  ProjectExistsError,
  LockAcquisitionError,
  InvalidSkipError,
  RequiredStageSkipError,
  CheckpointNotFoundError,
  CheckpointValidationError,
} from './errors.js';

/**
 * Valid state transitions map
 *
 * Defines which state transitions are allowed in the project lifecycle.
 */
const VALID_TRANSITIONS: ReadonlyMap<ProjectState, readonly ProjectState[]> = new Map([
  ['collecting', ['clarifying', 'prd_drafting', 'cancelled']],
  ['clarifying', ['collecting', 'prd_drafting', 'cancelled']],
  ['prd_drafting', ['prd_approved', 'collecting', 'cancelled']],
  ['prd_approved', ['srs_drafting', 'prd_drafting', 'cancelled']],
  ['srs_drafting', ['srs_approved', 'prd_approved', 'cancelled']],
  ['srs_approved', ['sds_drafting', 'srs_drafting', 'cancelled']],
  ['sds_drafting', ['sds_approved', 'srs_approved', 'cancelled']],
  ['sds_approved', ['issues_creating', 'sds_drafting', 'cancelled']],
  ['issues_creating', ['issues_created', 'sds_approved', 'cancelled']],
  ['issues_created', ['implementing', 'issues_creating', 'cancelled']],
  ['implementing', ['pr_review', 'issues_created', 'cancelled']],
  ['pr_review', ['merged', 'implementing', 'cancelled']],
  ['merged', []],
  ['cancelled', []],
]);

/**
 * Enhanced transition rules with recovery paths, skip capability, and stage requirements
 *
 * Defines extended transition rules that include:
 * - Normal flow: standard forward transitions
 * - Recovery flow: allowed backward transitions for error recovery
 * - Skip-to: states that can be skipped to (for optional stages)
 * - Required flag: whether the stage is mandatory
 * - Min completion: minimum % to proceed from partial state
 */
const ENHANCED_TRANSITIONS: ReadonlyMap<ProjectState, EnhancedTransitionRule> = new Map([
  [
    'collecting',
    {
      normal: ['clarifying', 'prd_drafting'],
      recovery: [],
      skipTo: ['prd_drafting'], // Can skip clarifying
      required: true,
    },
  ],
  [
    'clarifying',
    {
      normal: ['prd_drafting'],
      recovery: ['collecting'],
      skipTo: [],
      required: false, // Optional clarification stage
    },
  ],
  [
    'prd_drafting',
    {
      normal: ['prd_approved'],
      recovery: ['collecting', 'clarifying'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'prd_approved',
    {
      normal: ['srs_drafting'],
      recovery: ['prd_drafting', 'clarifying'],
      skipTo: ['sds_drafting'], // Can skip SRS for simple projects
      required: true,
    },
  ],
  [
    'srs_drafting',
    {
      normal: ['srs_approved'],
      recovery: ['prd_approved', 'prd_drafting'],
      skipTo: ['sds_drafting'], // Can skip to SDS
      required: false, // Optional for simple projects
      minCompletion: 50,
    },
  ],
  [
    'srs_approved',
    {
      normal: ['sds_drafting'],
      recovery: ['srs_drafting', 'prd_approved'],
      skipTo: ['issues_creating'], // Can skip SDS
      required: false, // Optional for simple projects
    },
  ],
  [
    'sds_drafting',
    {
      normal: ['sds_approved'],
      recovery: ['srs_approved', 'srs_drafting'],
      skipTo: ['issues_creating'], // Can skip if SDS not needed
      required: false, // Optional for simple projects
      minCompletion: 50,
    },
  ],
  [
    'sds_approved',
    {
      normal: ['issues_creating'],
      recovery: ['sds_drafting', 'srs_approved'],
      skipTo: [],
      required: false,
    },
  ],
  [
    'issues_creating',
    {
      normal: ['issues_created'],
      recovery: ['sds_approved', 'srs_approved'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'issues_created',
    {
      normal: ['implementing'],
      recovery: ['issues_creating', 'sds_approved'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'implementing',
    {
      normal: ['pr_review'],
      recovery: ['issues_created', 'issues_creating'],
      skipTo: [],
      required: true,
      minCompletion: 25,
    },
  ],
  [
    'pr_review',
    {
      normal: ['merged'],
      recovery: ['implementing', 'issues_created'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'merged',
    {
      normal: [],
      recovery: [],
      skipTo: [],
      required: true,
    },
  ],
  [
    'cancelled',
    {
      normal: [],
      recovery: [],
      skipTo: [],
      required: false,
    },
  ],
]);

/**
 * Ordered list of pipeline stages for calculating skip ranges
 */
const PIPELINE_STAGES: readonly ProjectState[] = [
  'collecting',
  'clarifying',
  'prd_drafting',
  'prd_approved',
  'srs_drafting',
  'srs_approved',
  'sds_drafting',
  'sds_approved',
  'issues_creating',
  'issues_created',
  'implementing',
  'pr_review',
  'merged',
];

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
 * State metadata file name
 */
const STATE_META_FILE = '_state_meta.json';

/**
 * State history file name
 */
const STATE_HISTORY_FILE = '_state_history.json';

/**
 * Checkpoints file name
 */
const CHECKPOINTS_FILE = '_checkpoints.json';

/**
 * Recovery audit log file name
 */
const RECOVERY_AUDIT_FILE = '_recovery_audit.json';

/**
 * Default maximum number of checkpoints to retain
 */
const DEFAULT_MAX_CHECKPOINTS = 10;

/**
 * Internal state metadata structure
 */
interface StateMeta {
  currentState: ProjectState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Internal history storage structure
 */
interface HistoryStorage<T = unknown> {
  projectId: string;
  section: ScratchpadSection;
  currentId: string;
  entries: StateHistoryEntry<T>[];
}

/**
 * StateManager class for managing project state lifecycle
 */
export class StateManager {
  private readonly scratchpad: Scratchpad;
  private readonly options: Required<StateManagerOptions>;
  private readonly watchers: Map<string, StateWatcher> = new Map();
  private readonly watcherCallbacks: Map<string, StateChangeCallback> = new Map();
  private readonly fsWatchers: Map<string, fs.FSWatcher> = new Map();

  constructor(options: StateManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.scratchpad = new Scratchpad({
      basePath: this.options.basePath,
      enableLocking: this.options.enableLocking,
      lockTimeout: this.options.lockTimeout,
    });
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
    // Check if project already exists
    const exists = await this.projectExists(projectId);
    if (exists) {
      throw new ProjectExistsError(projectId);
    }

    // Initialize scratchpad structure
    await this.scratchpad.initializeProject(projectId, name);

    // Create state metadata
    const now = new Date().toISOString();
    const meta: StateMeta = {
      currentState: initialState,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const metaPath = this.getMetaPath(projectId);
    await this.scratchpad.writeJson(metaPath, meta);

    // Initialize empty history if enabled
    if (this.options.enableHistory) {
      await this.initializeHistory(projectId, 'progress', {
        state: initialState,
        projectName: name,
      });
    }

    return {
      projectId,
      currentState: initialState,
      lastUpdated: now,
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
    const metaPath = this.getMetaPath(projectId);
    return this.scratchpad.exists(metaPath);
  }

  /**
   * Delete a project and all its state
   *
   * @param projectId - Project identifier
   */
  async deleteProject(projectId: string): Promise<void> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    // Stop all watchers for this project
    for (const [id, watcher] of this.watchers) {
      if (watcher.projectId === projectId) {
        watcher.unsubscribe();
        this.watchers.delete(id);
        this.watcherCallbacks.delete(id);
      }
    }

    // Delete all project directories
    const sections: ScratchpadSection[] = ['info', 'documents', 'issues', 'progress'];
    for (const section of sections) {
      const sectionPath = this.scratchpad.getProjectPath(section, projectId);
      try {
        await fs.promises.rm(sectionPath, { recursive: true, force: true });
      } catch {
        // Ignore errors during cleanup
      }
    }
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      if (options.allowMissing === true) {
        return null;
      }
      throw new ProjectNotFoundError(projectId);
    }

    const statePath = this.getSectionStatePath(section, projectId);
    const stateExists = await this.scratchpad.exists(statePath);

    if (!stateExists) {
      if (options.allowMissing === true) {
        return null;
      }
      throw new StateNotFoundError(section, projectId);
    }

    const value = await this.scratchpad.readYaml<T>(statePath);
    if (value === null) {
      if (options.allowMissing === true) {
        return null;
      }
      throw new StateNotFoundError(section, projectId);
    }

    const meta = await this.getMeta(projectId);
    const result: StateWithMetadata<T> = {
      value,
      projectId,
      section,
      updatedAt: meta.updatedAt,
      version: meta.version,
      history: undefined,
    };

    if (options.includeHistory === true && this.options.enableHistory) {
      const history = await this.getHistory<T>(section, projectId);
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const statePath = this.getSectionStatePath(section, projectId);
    const lockId = randomUUID();

    try {
      // Acquire lock
      const acquired = await this.scratchpad.acquireLock(statePath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(statePath, projectId);
      }

      // Get previous value for history and notification
      const previousValue = await this.scratchpad.readYaml<T>(statePath, { allowMissing: true });
      const isCreate = previousValue === null;

      // Write new state
      await this.scratchpad.writeYaml(statePath, data);

      // Update metadata
      await this.updateMeta(projectId);

      // Record history if enabled
      if (this.options.enableHistory) {
        await this.addHistoryEntry(section, projectId, data, options.description);
      }

      // Notify watchers
      this.notifyWatchers(projectId, section, previousValue, data, isCreate ? 'create' : 'update');
    } finally {
      await this.scratchpad.releaseLock(statePath, lockId);
    }
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const statePath = this.getSectionStatePath(section, projectId);
    const lockId = randomUUID();

    try {
      const acquired = await this.scratchpad.acquireLock(statePath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(statePath, projectId);
      }

      // Get current state
      const currentState = await this.scratchpad.readYaml<T>(statePath, { allowMissing: true });
      const previousValue = currentState;

      // Merge or replace based on options
      const newState =
        options.merge !== false && currentState !== null
          ? { ...currentState, ...updates }
          : (updates as T);

      // Write merged state
      await this.scratchpad.writeYaml(statePath, newState);

      // Update metadata
      await this.updateMeta(projectId);

      // Record history if enabled
      if (this.options.enableHistory) {
        await this.addHistoryEntry(section, projectId, newState, options.description);
      }

      // Notify watchers
      this.notifyWatchers(
        projectId,
        section,
        previousValue,
        newState,
        previousValue === null ? 'create' : 'update'
      );
    } finally {
      await this.scratchpad.releaseLock(statePath, lockId);
    }
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.getMeta(projectId);
    const fromState = meta.currentState;
    const timestamp = new Date().toISOString();

    // Check if transition is valid
    if (!this.isValidTransition(fromState, toState)) {
      throw new InvalidTransitionError(fromState, toState, projectId);
    }

    // Update state metadata
    const metaPath = this.getMetaPath(projectId);
    const lockId = randomUUID();

    try {
      const acquired = await this.scratchpad.acquireLock(metaPath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(metaPath, projectId);
      }

      const newMeta: StateMeta = {
        ...meta,
        currentState: toState,
        version: meta.version + 1,
        updatedAt: timestamp,
      };

      await this.scratchpad.writeJson(metaPath, newMeta);

      // Record transition in history
      if (this.options.enableHistory) {
        await this.addHistoryEntry(
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
    } finally {
      await this.scratchpad.releaseLock(metaPath, lockId);
    }
  }

  /**
   * Check if a state transition is valid
   *
   * @param from - Source state
   * @param to - Target state
   * @returns True if transition is valid
   */
  isValidTransition(from: ProjectState, to: ProjectState): boolean {
    const validTargets = VALID_TRANSITIONS.get(from);
    return validTargets !== undefined && validTargets.includes(to);
  }

  /**
   * Get allowed transitions from a state
   *
   * @param from - Source state
   * @returns Array of valid target states
   */
  getValidTransitions(from: ProjectState): readonly ProjectState[] {
    return VALID_TRANSITIONS.get(from) ?? [];
  }

  /**
   * Get current project state
   *
   * @param projectId - Project identifier
   * @returns Current project state
   */
  async getCurrentState(projectId: string): Promise<ProjectState> {
    const meta = await this.getMeta(projectId);
    return meta.currentState;
  }

  /**
   * Get project state summary
   *
   * @param projectId - Project identifier
   * @returns Project state summary
   */
  async getProjectSummary(projectId: string): Promise<ProjectStateSummary> {
    const meta = await this.getMeta(projectId);
    let historyCount = 0;

    if (this.options.enableHistory) {
      const history = await this.getHistory('progress', projectId);
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
    const historyPath = this.getHistoryPath(section, projectId);
    const storage = await this.scratchpad.readJson<HistoryStorage<T>>(historyPath, {
      allowMissing: true,
    });

    if (storage === null) {
      return null;
    }

    return {
      projectId: storage.projectId,
      section: storage.section,
      entries: storage.entries,
      currentId: storage.currentId,
    };
  }

  /**
   * Initialize history for a section
   */
  /* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
  private async initializeHistory<T>(
    projectId: string,
    section: ScratchpadSection,
    initialValue: T
  ): Promise<void> {
    const entryId = randomUUID();
    const now = new Date().toISOString();

    const entry: StateHistoryEntry<T> = {
      id: entryId,
      value: initialValue,
      timestamp: now,
      description: 'Initial state',
      previousId: undefined,
    };

    const storage: HistoryStorage<T> = {
      projectId,
      section,
      currentId: entryId,
      entries: [entry],
    };

    const historyPath = this.getHistoryPath(section, projectId);
    await this.scratchpad.writeJson(historyPath, storage);
  }

  /**
   * Add a history entry
   */
  private async addHistoryEntry<T>(
    section: ScratchpadSection,
    projectId: string,
    value: T,
    description?: string
  ): Promise<void> {
    const historyPath = this.getHistoryPath(section, projectId);
    const storage = await this.scratchpad.readJson<HistoryStorage<T>>(historyPath, {
      allowMissing: true,
    });

    const entryId = randomUUID();
    const now = new Date().toISOString();

    const entry: StateHistoryEntry<T> = {
      id: entryId,
      value,
      timestamp: now,
      description,
      previousId: storage?.currentId,
    };

    const entries = storage?.entries ?? [];
    entries.unshift(entry);

    // Trim to max entries
    while (entries.length > this.options.maxHistoryEntries) {
      entries.pop();
    }

    const newStorage: HistoryStorage<T> = {
      projectId,
      section,
      currentId: entryId,
      entries,
    };

    await this.scratchpad.writeJson(historyPath, newStorage);
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

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
    const watcherId = randomUUID();

    // Store callback
    this.watcherCallbacks.set(watcherId, callback as StateChangeCallback);

    // Set up file system watcher
    const watchPath = section
      ? this.scratchpad.getProjectPath(section, projectId)
      : this.scratchpad.getProjectPath('progress', projectId);

    try {
      const fsWatcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (
          filename !== null &&
          filename !== '' &&
          !filename.startsWith('_') &&
          eventType === 'change'
        ) {
          void this.handleFileChange(
            projectId,
            section ?? 'progress',
            filename,
            callback as StateChangeCallback
          );
        }
      });

      this.fsWatchers.set(watcherId, fsWatcher);
    } catch {
      // Directory might not exist yet, which is fine
    }

    const watcher: StateWatcher = {
      id: watcherId,
      projectId,
      section: section ?? null,
      unsubscribe: () => {
        this.watchers.delete(watcherId);
        this.watcherCallbacks.delete(watcherId);
        const fsWatcher = this.fsWatchers.get(watcherId);
        if (fsWatcher) {
          fsWatcher.close();
          this.fsWatchers.delete(watcherId);
        }
      },
    };

    this.watchers.set(watcherId, watcher);
    return watcher;
  }

  /**
   * Handle file change event
   */
  private async handleFileChange<T>(
    projectId: string,
    section: ScratchpadSection,
    _filename: string,
    callback: StateChangeCallback<T>
  ): Promise<void> {
    try {
      const statePath = this.getSectionStatePath(section, projectId);
      const value = await this.scratchpad.readYaml<T>(statePath, { allowMissing: true });

      if (value !== null) {
        const event: StateChangeEvent<T> = {
          projectId,
          section,
          previousValue: null,
          newValue: value,
          timestamp: new Date().toISOString(),
          changeType: 'update',
        };
        callback(event);
      }
    } catch {
      // Ignore errors during watch callback
    }
  }

  /**
   * Notify watchers of state change
   */
  private notifyWatchers<T>(
    projectId: string,
    section: ScratchpadSection,
    previousValue: T | null,
    newValue: T,
    changeType: 'create' | 'update' | 'delete'
  ): void {
    const event: StateChangeEvent<T> = {
      projectId,
      section,
      previousValue,
      newValue,
      timestamp: new Date().toISOString(),
      changeType,
    };

    for (const [watcherId, watcher] of this.watchers) {
      if (
        watcher.projectId === projectId &&
        (watcher.section === null || watcher.section === section)
      ) {
        const callback = this.watcherCallbacks.get(watcherId);
        if (callback) {
          try {
            callback(event as StateChangeEvent);
          } catch {
            // Ignore callback errors
          }
        }
      }
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Get metadata file path
   */
  private getMetaPath(projectId: string): string {
    return path.join(this.scratchpad.getProjectPath('progress', projectId), STATE_META_FILE);
  }

  /**
   * Get history file path
   */
  private getHistoryPath(section: ScratchpadSection, projectId: string): string {
    return path.join(this.scratchpad.getProjectPath(section, projectId), STATE_HISTORY_FILE);
  }

  /**
   * Get section state file path
   */
  private getSectionStatePath(section: ScratchpadSection, projectId: string): string {
    switch (section) {
      case 'info':
        return this.scratchpad.getCollectedInfoPath(projectId);
      case 'documents':
        return path.join(this.scratchpad.getProjectPath('documents', projectId), 'state.yaml');
      case 'issues':
        return this.scratchpad.getIssueListPath(projectId);
      case 'progress':
        return this.scratchpad.getControllerStatePath(projectId);
    }
  }

  /**
   * Get project metadata
   */
  private async getMeta(projectId: string): Promise<StateMeta> {
    const metaPath = this.getMetaPath(projectId);
    const meta = await this.scratchpad.readJson<StateMeta>(metaPath, { allowMissing: true });

    if (meta === null) {
      throw new ProjectNotFoundError(projectId);
    }

    return meta;
  }

  /**
   * Update project metadata
   */
  private async updateMeta(projectId: string): Promise<void> {
    const metaPath = this.getMetaPath(projectId);
    const meta = await this.getMeta(projectId);

    const updatedMeta: StateMeta = {
      ...meta,
      version: meta.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.scratchpad.writeJson(metaPath, updatedMeta);
  }

  /**
   * Get checkpoints file path
   */
  private getCheckpointsPath(projectId: string): string {
    return path.join(this.scratchpad.getProjectPath('progress', projectId), CHECKPOINTS_FILE);
  }

  /**
   * Get recovery audit file path
   */
  private getAuditPath(projectId: string): string {
    return path.join(this.scratchpad.getProjectPath('progress', projectId), RECOVERY_AUDIT_FILE);
  }

  // ============================================================
  // Checkpoint System (Issue #218)
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.getMeta(projectId);
    const checkpointId = randomUUID();
    const now = new Date().toISOString();

    // Collect section states
    const sections: Partial<Record<ScratchpadSection, unknown>> = {};
    const sectionNames: ScratchpadSection[] = ['info', 'documents', 'issues', 'progress'];

    for (const section of sectionNames) {
      try {
        const statePath = this.getSectionStatePath(section, projectId);
        const sectionState = await this.scratchpad.readYaml(statePath, { allowMissing: true });
        if (sectionState !== null) {
          sections[section] = sectionState;
        }
      } catch {
        // Ignore sections that don't exist
      }
    }

    const checkpoint: StateCheckpoint = {
      id: checkpointId,
      state: meta.currentState,
      timestamp: now,
      data: {
        meta: {
          currentState: meta.currentState,
          version: meta.version,
        },
        sections,
      },
      metadata: {
        triggeredBy: trigger,
        reason,
      },
    };

    // Load existing checkpoints
    const checkpointsPath = this.getCheckpointsPath(projectId);
    const existing = await this.scratchpad.readJson<StateCheckpoint[]>(checkpointsPath, {
      allowMissing: true,
    });

    const checkpoints = existing ?? [];
    checkpoints.unshift(checkpoint);

    // Prune old checkpoints
    while (checkpoints.length > DEFAULT_MAX_CHECKPOINTS) {
      checkpoints.pop();
    }

    await this.scratchpad.writeJson(checkpointsPath, checkpoints);

    // Record in audit log
    await this.recordAudit(projectId, {
      id: randomUUID(),
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
   * Get all available checkpoints for a project
   *
   * @param projectId - Project identifier
   * @returns List of checkpoints (newest first)
   */
  async getCheckpoints(projectId: string): Promise<StateCheckpoint[]> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const checkpointsPath = this.getCheckpointsPath(projectId);
    const checkpoints = await this.scratchpad.readJson<StateCheckpoint[]>(checkpointsPath, {
      allowMissing: true,
    });

    return checkpoints ?? [];
  }

  /**
   * Restore project state from a checkpoint
   *
   * @param projectId - Project identifier
   * @param checkpointId - Checkpoint ID to restore
   * @returns Restore result
   */
  async restoreCheckpoint(projectId: string, checkpointId: string): Promise<RestoreResult> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const checkpoints = await this.getCheckpoints(projectId);
    const checkpoint = checkpoints.find((c) => c.id === checkpointId);

    if (!checkpoint) {
      throw new CheckpointNotFoundError(checkpointId, projectId);
    }

    // Validate checkpoint data
    const validationErrors: string[] = [];
    if (!checkpoint.data.meta.currentState) {
      validationErrors.push('Missing state in checkpoint data');
    }
    if (typeof checkpoint.data.meta.version !== 'number') {
      validationErrors.push('Invalid version in checkpoint data');
    }

    if (validationErrors.length > 0) {
      throw new CheckpointValidationError(checkpointId, validationErrors, projectId);
    }

    const meta = await this.getMeta(projectId);
    const previousState = meta.currentState;
    const now = new Date().toISOString();

    // Restore state metadata
    const metaPath = this.getMetaPath(projectId);
    const restoredMeta: StateMeta = {
      currentState: checkpoint.state,
      version: meta.version + 1,
      createdAt: meta.createdAt,
      updatedAt: now,
    };
    await this.scratchpad.writeJson(metaPath, restoredMeta);

    // Restore section states
    for (const [section, sectionData] of Object.entries(checkpoint.data.sections)) {
      if (sectionData !== undefined) {
        const statePath = this.getSectionStatePath(section as ScratchpadSection, projectId);
        await this.scratchpad.writeYaml(statePath, sectionData as object);
      }
    }

    // Record in audit log
    await this.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'checkpoint_restored',
      timestamp: now,
      fromState: previousState,
      toState: checkpoint.state,
      details: { checkpointId, checkpointTimestamp: checkpoint.timestamp },
    });

    // Record in history
    if (this.options.enableHistory) {
      await this.addHistoryEntry(
        'progress',
        projectId,
        {
          restore: { from: previousState, to: checkpoint.state },
          checkpointId,
          timestamp: now,
        },
        `Restored from checkpoint: ${checkpoint.state}`
      );
    }

    return {
      success: true,
      restoredState: checkpoint.state,
      restoredAt: now,
      checkpointId,
    };
  }

  // ============================================================
  // Skip-Forward Capability (Issue #218)
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.getMeta(projectId);
    const currentState = meta.currentState;
    const now = new Date().toISOString();

    // Check if skip is allowed
    const rule = ENHANCED_TRANSITIONS.get(currentState);
    if (!rule || !rule.skipTo.includes(targetState)) {
      throw new InvalidSkipError(currentState, targetState, projectId);
    }

    // Get stages that would be skipped
    const skippedStages = this.getStagesBetween(currentState, targetState);

    // Check for required stages
    const requiredSkipped = skippedStages.filter((stage) => {
      const stageRule = ENHANCED_TRANSITIONS.get(stage);
      return stageRule?.required === true;
    });

    if (requiredSkipped.length > 0 && options.forceSkipRequired !== true) {
      throw new RequiredStageSkipError(requiredSkipped, projectId);
    }

    // Create checkpoint before skip if requested
    let checkpointId: string | undefined;
    if (options.createCheckpoint !== false) {
      checkpointId = await this.createCheckpoint(projectId, 'skip', options.reason);
    }

    // Perform the skip transition
    const metaPath = this.getMetaPath(projectId);
    const lockId = randomUUID();

    try {
      const acquired = await this.scratchpad.acquireLock(metaPath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(metaPath, projectId);
      }

      const newMeta: StateMeta = {
        ...meta,
        currentState: targetState,
        version: meta.version + 1,
        updatedAt: now,
      };

      await this.scratchpad.writeJson(metaPath, newMeta);
    } finally {
      await this.scratchpad.releaseLock(metaPath, lockId);
    }

    // Record in audit log
    await this.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'skip_forward',
      timestamp: now,
      fromState: currentState,
      toState: targetState,
      details: {
        skippedStages,
        reason: options.reason,
        forceSkipRequired: options.forceSkipRequired,
        approvedBy: options.approvedBy,
        checkpointId,
      },
      performedBy: options.approvedBy,
    });

    // Record in history
    if (this.options.enableHistory) {
      await this.addHistoryEntry(
        'progress',
        projectId,
        {
          skip: { from: currentState, to: targetState },
          skippedStages,
          timestamp: now,
        },
        `Skip forward: ${currentState} → ${targetState} (skipped: ${skippedStages.join(', ')})`
      );
    }

    return {
      success: true,
      skippedStages,
      checkpointId,
      timestamp: now,
    };
  }

  /**
   * Get the stages between two states in the pipeline
   *
   * @param from - Starting state
   * @param to - Target state
   * @returns Array of states between from and to (exclusive)
   */
  getStagesBetween(from: ProjectState, to: ProjectState): ProjectState[] {
    const fromIdx = PIPELINE_STAGES.indexOf(from);
    const toIdx = PIPELINE_STAGES.indexOf(to);

    if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) {
      return [];
    }

    return PIPELINE_STAGES.slice(fromIdx + 1, toIdx) as ProjectState[];
  }

  /**
   * Check if a stage is required
   *
   * @param state - State to check
   * @returns True if the stage is required
   */
  isStageRequired(state: ProjectState): boolean {
    const rule = ENHANCED_TRANSITIONS.get(state);
    return rule?.required === true;
  }

  /**
   * Get skip-to options for a state
   *
   * @param from - Current state
   * @returns Array of states that can be skipped to
   */
  getSkipOptions(from: ProjectState): readonly ProjectState[] {
    const rule = ENHANCED_TRANSITIONS.get(from);
    return rule?.skipTo ?? [];
  }

  // ============================================================
  // Admin Override (Issue #218)
  // ============================================================

  /**
   * Perform an admin override operation
   *
   * @param projectId - Project identifier
   * @param override - Override specification
   */
  async adminOverride(projectId: string, override: AdminOverride): Promise<TransitionResult> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.getMeta(projectId);
    const previousState = meta.currentState;
    const now = new Date().toISOString();

    // Create checkpoint before override
    await this.createCheckpoint(projectId, 'recovery', `Admin override: ${override.reason}`);

    // Record in audit log first
    await this.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'admin_override',
      timestamp: now,
      fromState: previousState,
      toState: override.targetState,
      details: {
        action: override.action,
        reason: override.reason,
      },
      performedBy: override.authorizedBy,
    });

    // Perform the override
    const metaPath = this.getMetaPath(projectId);
    const lockId = randomUUID();

    try {
      const acquired = await this.scratchpad.acquireLock(metaPath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(metaPath, projectId);
      }

      const newMeta: StateMeta = {
        ...meta,
        currentState: override.targetState,
        version: meta.version + 1,
        updatedAt: now,
      };

      await this.scratchpad.writeJson(metaPath, newMeta);
    } finally {
      await this.scratchpad.releaseLock(metaPath, lockId);
    }

    // Record in history
    if (this.options.enableHistory) {
      await this.addHistoryEntry(
        'progress',
        projectId,
        {
          adminOverride: {
            from: previousState,
            to: override.targetState,
            action: override.action,
          },
          timestamp: now,
        },
        `Admin override (${override.action}): ${previousState} → ${override.targetState}`
      );
    }

    return {
      success: true,
      previousState,
      newState: override.targetState,
      timestamp: now,
    };
  }

  // ============================================================
  // Recovery Transition (Issue #218)
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
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.getMeta(projectId);
    const currentState = meta.currentState;

    // Check if recovery transition is valid
    const rule = ENHANCED_TRANSITIONS.get(currentState);
    if (!rule || !rule.recovery.includes(toState)) {
      throw new InvalidTransitionError(currentState, toState, projectId);
    }

    const now = new Date().toISOString();

    // Create checkpoint before recovery
    await this.createCheckpoint(projectId, 'recovery', reason);

    // Perform the recovery transition
    const metaPath = this.getMetaPath(projectId);
    const lockId = randomUUID();

    try {
      const acquired = await this.scratchpad.acquireLock(metaPath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(metaPath, projectId);
      }

      const newMeta: StateMeta = {
        ...meta,
        currentState: toState,
        version: meta.version + 1,
        updatedAt: now,
      };

      await this.scratchpad.writeJson(metaPath, newMeta);
    } finally {
      await this.scratchpad.releaseLock(metaPath, lockId);
    }

    // Record in audit log
    await this.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'recovery_transition',
      timestamp: now,
      fromState: currentState,
      toState,
      details: { reason },
    });

    // Record in history
    if (this.options.enableHistory) {
      await this.addHistoryEntry(
        'progress',
        projectId,
        {
          recovery: { from: currentState, to: toState },
          reason,
          timestamp: now,
        },
        `Recovery: ${currentState} → ${toState}${reason ? ` (${reason})` : ''}`
      );
    }

    return {
      success: true,
      previousState: currentState,
      newState: toState,
      timestamp: now,
    };
  }

  /**
   * Get recovery options for current state
   *
   * @param from - Current state
   * @returns Array of valid recovery states
   */
  getRecoveryOptions(from: ProjectState): readonly ProjectState[] {
    const rule = ENHANCED_TRANSITIONS.get(from);
    return rule?.recovery ?? [];
  }

  /**
   * Get the enhanced transition rule for a state
   *
   * @param state - State to get rule for
   * @returns Enhanced transition rule or undefined
   */
  getEnhancedTransitionRule(state: ProjectState): EnhancedTransitionRule | undefined {
    return ENHANCED_TRANSITIONS.get(state);
  }

  // ============================================================
  // Audit Logging (Issue #218)
  // ============================================================

  /**
   * Record an audit entry
   */
  private async recordAudit(projectId: string, entry: RecoveryAuditEntry): Promise<void> {
    const auditPath = this.getAuditPath(projectId);
    const existing = await this.scratchpad.readJson<RecoveryAuditEntry[]>(auditPath, {
      allowMissing: true,
    });

    const entries = existing ?? [];
    entries.unshift(entry);

    // Keep last 100 audit entries
    while (entries.length > 100) {
      entries.pop();
    }

    await this.scratchpad.writeJson(auditPath, entries);
  }

  /**
   * Get recovery audit log for a project
   *
   * @param projectId - Project identifier
   * @returns Array of audit entries (newest first)
   */
  async getRecoveryAuditLog(projectId: string): Promise<RecoveryAuditEntry[]> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const auditPath = this.getAuditPath(projectId);
    const entries = await this.scratchpad.readJson<RecoveryAuditEntry[]>(auditPath, {
      allowMissing: true,
    });

    return entries ?? [];
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Close all file watchers
    for (const [, fsWatcher] of this.fsWatchers) {
      fsWatcher.close();
    }
    this.fsWatchers.clear();
    this.watchers.clear();
    this.watcherCallbacks.clear();

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
