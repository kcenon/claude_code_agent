/**
 * State Persistence - File I/O and state storage
 *
 * Handles state file persistence, locking, and metadata management.
 * This module is responsible for all file I/O operations.
 *
 * @module state-manager/StatePersistence
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Scratchpad } from '../scratchpad/Scratchpad.js';
import type { ScratchpadSection } from '../scratchpad/types.js';
import type { ProjectState, StateWithMetadata, UpdateOptions, ReadStateOptions } from './types.js';
import {
  ProjectNotFoundError,
  ProjectExistsError,
  StateNotFoundError,
  LockAcquisitionError,
} from './errors.js';

/**
 * State metadata file name
 */
const STATE_META_FILE = '_state_meta.json';

/**
 * Internal state metadata structure
 */
export interface StateMeta {
  currentState: ProjectState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface for state persistence operations
 */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
export interface IStatePersistence {
  initializeProject(
    projectId: string,
    name: string,
    initialState: ProjectState
  ): Promise<StateMeta>;
  projectExists(projectId: string): Promise<boolean>;
  deleteProject(projectId: string): Promise<void>;
  getMeta(projectId: string): Promise<StateMeta>;
  updateMeta(projectId: string, updates: Partial<StateMeta>): Promise<StateMeta>;
  getState<T>(
    section: ScratchpadSection,
    projectId: string,
    options?: ReadStateOptions
  ): Promise<StateWithMetadata<T> | null>;
  setState<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    data: T,
    options?: UpdateOptions
  ): Promise<{ previousValue: T | null; isCreate: boolean }>;
  updateState<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    updates: Partial<T>,
    options?: UpdateOptions
  ): Promise<{ previousValue: T | null; newState: T }>;
  transitionState(projectId: string, toState: ProjectState): Promise<StateMeta>;
  acquireLock(filePath: string): Promise<string>;
  releaseLock(filePath: string, lockId: string): Promise<void>;
  getSectionStatePath(section: ScratchpadSection, projectId: string): string;
  getMetaPath(projectId: string): string;
  readYaml<T>(section: ScratchpadSection, projectId: string): Promise<T | null>;
  writeYaml<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    data: T
  ): Promise<void>;
}
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

/**
 * StatePersistence class for managing state file operations
 *
 * This class encapsulates all file I/O, locking, and persistence logic.
 */
export class StatePersistence implements IStatePersistence {
  constructor(
    private readonly scratchpad: Scratchpad,
    private readonly enableLocking: boolean = true
  ) {}

  /**
   * Get metadata file path
   * @param projectId - The unique identifier for the project
   * @returns The absolute file path to the state metadata JSON file
   */
  getMetaPath(projectId: string): string {
    return path.join(this.scratchpad.getProjectPath('progress', projectId), STATE_META_FILE);
  }

  /**
   * Get section state file path
   * @param section - The scratchpad section to get the state path for
   * @param projectId - The unique identifier for the project
   * @returns The absolute file path to the section state file
   */
  getSectionStatePath(section: ScratchpadSection, projectId: string): string {
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
   * Initialize a new project with all required state structures
   *
   * @param projectId - Unique project identifier
   * @param name - Project name
   * @param initialState - Initial project state
   * @returns State metadata
   */
  async initializeProject(
    projectId: string,
    name: string,
    initialState: ProjectState = 'collecting'
  ): Promise<StateMeta> {
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

    return meta;
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

  /**
   * Get project metadata
   *
   * @param projectId - Project identifier
   * @returns State metadata
   */
  async getMeta(projectId: string): Promise<StateMeta> {
    const metaPath = this.getMetaPath(projectId);
    const meta = await this.scratchpad.readJson<StateMeta>(metaPath, { allowMissing: true });

    if (meta === null) {
      throw new ProjectNotFoundError(projectId);
    }

    return meta;
  }

  /**
   * Update project metadata
   *
   * @param projectId - Project identifier
   * @param updates - Partial updates to apply
   * @returns Updated state metadata
   */
  async updateMeta(projectId: string, updates: Partial<StateMeta> = {}): Promise<StateMeta> {
    const metaPath = this.getMetaPath(projectId);
    const meta = await this.getMeta(projectId);

    const updatedMeta: StateMeta = {
      ...meta,
      ...updates,
      version: (updates.version ?? meta.version) + (updates.version === undefined ? 1 : 0),
      updatedAt: new Date().toISOString(),
    };

    await this.scratchpad.writeJson(metaPath, updatedMeta);
    return updatedMeta;
  }

  /**
   * Get state for a section
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param options - Read options
   * @returns State value with metadata or null if missing and allowMissing is true
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

    return result;
  }

  /**
   * Set state for a section (full replacement)
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param data - State data to write
   * @param _options - Update options (unused, kept for interface compatibility)
   * @returns Previous value and whether this was a create operation
   */

  /**
   * @param section - The scratchpad section to write state to
   * @param projectId - The unique identifier for the project
   * @param data - The state data to persist
   * @param _options - Update options (unused, kept for interface compatibility)
   * @returns An object containing the previous value and whether this was a create operation
   */
  async setState<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    data: T,
    _options: UpdateOptions = {}
  ): Promise<{ previousValue: T | null; isCreate: boolean }> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const statePath = this.getSectionStatePath(section, projectId);
    const lockId = randomUUID();

    try {
      // Acquire lock
      if (this.enableLocking) {
        const acquired = await this.scratchpad.acquireLock(statePath, lockId);
        if (!acquired) {
          throw new LockAcquisitionError(statePath, projectId);
        }
      }

      // Get previous value
      const previousValue = await this.scratchpad.readYaml<T>(statePath, { allowMissing: true });
      const isCreate = previousValue === null;

      // Write new state
      await this.scratchpad.writeYaml(statePath, data);

      // Update metadata
      await this.updateMeta(projectId);

      return { previousValue, isCreate };
    } finally {
      if (this.enableLocking) {
        await this.scratchpad.releaseLock(statePath, lockId);
      }
    }
  }

  /**
   * Update state for a section (partial update/merge)
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param updates - Partial state updates
   * @param options - Update options
   * @returns Previous value and new state
   */
  async updateState<T extends object>(
    section: ScratchpadSection,
    projectId: string,
    updates: Partial<T>,
    options: UpdateOptions = {}
  ): Promise<{ previousValue: T | null; newState: T }> {
    const exists = await this.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const statePath = this.getSectionStatePath(section, projectId);
    const lockId = randomUUID();

    try {
      if (this.enableLocking) {
        const acquired = await this.scratchpad.acquireLock(statePath, lockId);
        if (!acquired) {
          throw new LockAcquisitionError(statePath, projectId);
        }
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

      return { previousValue, newState };
    } finally {
      if (this.enableLocking) {
        await this.scratchpad.releaseLock(statePath, lockId);
      }
    }
  }

  /**
   * Transition project to a new state
   *
   * @param projectId - Project identifier
   * @param toState - Target state
   * @returns Updated state metadata
   */
  async transitionState(projectId: string, toState: ProjectState): Promise<StateMeta> {
    const metaPath = this.getMetaPath(projectId);
    const lockId = randomUUID();

    try {
      if (this.enableLocking) {
        const acquired = await this.scratchpad.acquireLock(metaPath, lockId);
        if (!acquired) {
          throw new LockAcquisitionError(metaPath, projectId);
        }
      }

      const meta = await this.getMeta(projectId);
      const timestamp = new Date().toISOString();

      const newMeta: StateMeta = {
        ...meta,
        currentState: toState,
        version: meta.version + 1,
        updatedAt: timestamp,
      };

      await this.scratchpad.writeJson(metaPath, newMeta);

      return newMeta;
    } finally {
      if (this.enableLocking) {
        await this.scratchpad.releaseLock(metaPath, lockId);
      }
    }
  }

  /**
   * Acquire a lock for a file path
   *
   * @param filePath - File path to lock
   * @returns Lock ID
   */
  async acquireLock(filePath: string): Promise<string> {
    const lockId = randomUUID();
    if (this.enableLocking) {
      const acquired = await this.scratchpad.acquireLock(filePath, lockId);
      if (!acquired) {
        throw new LockAcquisitionError(filePath);
      }
    }
    return lockId;
  }

  /**
   * Release a lock for a file path
   *
   * @param filePath - File path to unlock
   * @param lockId - Lock ID to release
   */
  async releaseLock(filePath: string, lockId: string): Promise<void> {
    if (this.enableLocking) {
      await this.scratchpad.releaseLock(filePath, lockId);
    }
  }

  /**
   * Read YAML data from a section
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @returns Parsed YAML data or null
   */
  async readYaml<T>(section: ScratchpadSection, projectId: string): Promise<T | null> {
    const statePath = this.getSectionStatePath(section, projectId);
    return this.scratchpad.readYaml<T>(statePath, { allowMissing: true });
  }

  /**
   * Write YAML data to a section
   *
   * @param section - Scratchpad section
   * @param projectId - Project identifier
   * @param data - Data to write
   */
  async writeYaml(section: ScratchpadSection, projectId: string, data: object): Promise<void> {
    const statePath = this.getSectionStatePath(section, projectId);
    await this.scratchpad.writeYaml(statePath, data);
  }

  /**
   * Write JSON data to a checkpoint or metadata file
   *
   * @param filePath - Path to write to
   * @param data - Data to write
   */
  async writeJson(filePath: string, data: object): Promise<void> {
    await this.scratchpad.writeJson(filePath, data);
  }

  /**
   * Get the underlying scratchpad instance
   *
   * @returns Scratchpad instance
   */
  getScratchpad(): Scratchpad {
    return this.scratchpad;
  }
}
