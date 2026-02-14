/**
 * State History - History tracking and checkpoint management
 *
 * Handles state history tracking, checkpoints creation and restoration,
 * and recovery audit logging.
 *
 * @module state-manager/StateHistory
 */

import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Scratchpad } from '../scratchpad/Scratchpad.js';
import type { ScratchpadSection } from '../scratchpad/types.js';
import type {
  ProjectState,
  StateHistoryEntry,
  StateHistory,
  StateCheckpoint,
  CheckpointTrigger,
  RecoveryAuditEntry,
} from './types.js';
import { CheckpointNotFoundError, CheckpointValidationError } from './errors.js';

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
 * Internal history storage structure
 */
interface HistoryStorage<T = unknown> {
  projectId: string;
  section: ScratchpadSection;
  currentId: string;
  entries: StateHistoryEntry<T>[];
}

/**
 * State metadata structure for checkpoints
 */
interface StateMeta {
  currentState: ProjectState;
  version: number;
}

/**
 * Interface for state history operations
 */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
export interface IStateHistory {
  getHistory<T>(section: ScratchpadSection, projectId: string): Promise<StateHistory<T> | null>;
  initializeHistory<T>(
    projectId: string,
    section: ScratchpadSection,
    initialValue: T
  ): Promise<void>;
  addHistoryEntry<T>(
    section: ScratchpadSection,
    projectId: string,
    value: T,
    description?: string
  ): Promise<void>;
  createCheckpoint(
    projectId: string,
    state: ProjectState,
    meta: StateMeta,
    sections: Partial<Record<ScratchpadSection, unknown>>,
    trigger: CheckpointTrigger,
    reason?: string
  ): Promise<string>;
  getCheckpoints(projectId: string): Promise<StateCheckpoint[]>;
  restoreCheckpoint(projectId: string, checkpointId: string): Promise<StateCheckpoint>;
  recordAudit(projectId: string, entry: RecoveryAuditEntry): Promise<void>;
  getRecoveryAuditLog(projectId: string): Promise<RecoveryAuditEntry[]>;
}
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

/**
 * StateHistory class for managing state history and checkpoints
 *
 * This class encapsulates all history tracking, checkpoint management,
 * and audit logging functionality.
 */
export class StateHistoryManager implements IStateHistory {
  constructor(
    private readonly scratchpad: Scratchpad,
    private readonly maxHistoryEntries: number = 50,
    private readonly maxCheckpoints: number = DEFAULT_MAX_CHECKPOINTS
  ) {}

  /**
   * Get history file path
   * @param section - The scratchpad section to retrieve history for
   * @param projectId - The unique identifier for the project
   * @returns The absolute file path to the history JSON file
   */
  private getHistoryPath(section: ScratchpadSection, projectId: string): string {
    return path.join(this.scratchpad.getProjectPath(section, projectId), STATE_HISTORY_FILE);
  }

  /**
   * Get checkpoints file path
   * @param projectId - The unique identifier for the project
   * @returns The absolute file path to the checkpoints JSON file
   */
  private getCheckpointsPath(projectId: string): string {
    return path.join(this.scratchpad.getProjectPath('progress', projectId), CHECKPOINTS_FILE);
  }

  /**
   * Get recovery audit file path
   * @param projectId - The unique identifier for the project
   * @returns The absolute file path to the recovery audit JSON file
   */
  private getAuditPath(projectId: string): string {
    return path.join(this.scratchpad.getProjectPath('progress', projectId), RECOVERY_AUDIT_FILE);
  }

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
   *
   * @param projectId - Project identifier
   * @param section - Scratchpad section
   * @param initialValue - Initial value for the history
   */
  /* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
  /**
   * @param projectId - The unique identifier for the project
   * @param section - The scratchpad section to initialize history for
   * @param initialValue - The initial value to store as the first history entry
   */
  async initializeHistory<T>(
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
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param value - Value to record in history
   * @param description - Optional description of the change
   */
  async addHistoryEntry<T>(
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
    while (entries.length > this.maxHistoryEntries) {
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

  /**
   * Create a checkpoint for the current project state
   *
   * @param projectId - Project identifier
   * @param state - Current project state
   * @param meta - State metadata
   * @param sections - Section states to include in checkpoint
   * @param trigger - What triggered this checkpoint
   * @param reason - Optional reason for the checkpoint
   * @returns Checkpoint ID
   */
  async createCheckpoint(
    projectId: string,
    state: ProjectState,
    meta: StateMeta,
    sections: Partial<Record<ScratchpadSection, unknown>>,
    trigger: CheckpointTrigger = 'manual',
    reason?: string
  ): Promise<string> {
    const checkpointId = randomUUID();
    const now = new Date().toISOString();

    const checkpoint: StateCheckpoint = {
      id: checkpointId,
      state,
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
    while (checkpoints.length > this.maxCheckpoints) {
      checkpoints.pop();
    }

    await this.scratchpad.writeJson(checkpointsPath, checkpoints);

    return checkpointId;
  }

  /**
   * Get all available checkpoints for a project
   *
   * @param projectId - Project identifier
   * @returns List of checkpoints (newest first)
   */
  async getCheckpoints(projectId: string): Promise<StateCheckpoint[]> {
    const checkpointsPath = this.getCheckpointsPath(projectId);
    const checkpoints = await this.scratchpad.readJson<StateCheckpoint[]>(checkpointsPath, {
      allowMissing: true,
    });

    return checkpoints ?? [];
  }

  /**
   * Validate and retrieve a checkpoint by ID
   *
   * @param projectId - Project identifier
   * @param checkpointId - Checkpoint ID to retrieve
   * @returns The checkpoint
   * @throws CheckpointNotFoundError if checkpoint doesn't exist
   * @throws CheckpointValidationError if checkpoint data is invalid
   */
  async restoreCheckpoint(projectId: string, checkpointId: string): Promise<StateCheckpoint> {
    const checkpoints = await this.getCheckpoints(projectId);
    const checkpoint = checkpoints.find((c) => c.id === checkpointId);

    if (!checkpoint) {
      throw new CheckpointNotFoundError(checkpointId, projectId);
    }

    // Validate checkpoint data
    const validationErrors: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety check
    if (checkpoint.data.meta.currentState === undefined) {
      validationErrors.push('Missing state in checkpoint data');
    }
    if (typeof checkpoint.data.meta.version !== 'number') {
      validationErrors.push('Invalid version in checkpoint data');
    }

    if (validationErrors.length > 0) {
      throw new CheckpointValidationError(checkpointId, validationErrors, projectId);
    }

    return checkpoint;
  }

  /**
   * Record an audit entry
   *
   * @param projectId - Project identifier
   * @param entry - Audit entry to record
   */
  async recordAudit(projectId: string, entry: RecoveryAuditEntry): Promise<void> {
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
    const auditPath = this.getAuditPath(projectId);
    const entries = await this.scratchpad.readJson<RecoveryAuditEntry[]>(auditPath, {
      allowMissing: true,
    });

    return entries ?? [];
  }
}
