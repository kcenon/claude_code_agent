/**
 * State Watcher - File watching and event notification
 *
 * Handles file system watching for state changes and notifying callbacks
 * when state files are modified.
 *
 * @module state-manager/StateWatcher
 */

import * as fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Scratchpad } from '../scratchpad/Scratchpad.js';
import type { ScratchpadSection } from '../scratchpad/types.js';
import type { StateChangeEvent, StateChangeCallback, StateWatcher } from './types.js';

/**
 * Interface for state watcher operations
 */
export interface IStateWatcher {
  watch<T>(
    projectId: string,
    callback: StateChangeCallback<T>,
    section?: ScratchpadSection
  ): StateWatcher;
  notifyWatchers<T>(
    projectId: string,
    section: ScratchpadSection,
    previousValue: T | null,
    newValue: T,
    changeType: 'create' | 'update' | 'delete'
  ): void;
  cleanup(): void;
}

/**
 * Callback for reading state values during file change handling
 */
export type StateReader<T> = (section: ScratchpadSection, projectId: string) => Promise<T | null>;

/**
 * StateWatcherManager class for managing file watchers and notifications
 *
 * This class encapsulates all file watching and event notification logic.
 */
export class StateWatcherManager implements IStateWatcher {
  private readonly watchers: Map<string, StateWatcher> = new Map();
  private readonly watcherCallbacks: Map<string, StateChangeCallback> = new Map();
  private readonly fsWatchers: Map<string, fs.FSWatcher> = new Map();

  constructor(
    private readonly scratchpad: Scratchpad,
    private readonly stateReader?: StateReader<unknown>
  ) {}

  /**
   * Watch for state changes
   *
   * @param projectId - Project identifier
   * @param callback - Callback for state changes
   * @param section - Optional section to watch (null for all)
   * @returns State watcher handle
   */
  watch<T = unknown>(
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
   *
   * @param projectId - Project identifier
   * @param section - Scratchpad section
   * @param _filename - Changed filename (unused but kept for debugging)
   * @param callback - Callback to notify
   */
  private async handleFileChange<T>(
    projectId: string,
    section: ScratchpadSection,
    _filename: string,
    callback: StateChangeCallback<T>
  ): Promise<void> {
    try {
      if (!this.stateReader) {
        return;
      }

      const value = (await this.stateReader(section, projectId)) as T | null;

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
   *
   * @param projectId - Project identifier
   * @param section - Section that changed
   * @param previousValue - Previous value before change
   * @param newValue - New value after change
   * @param changeType - Type of change
   */
  notifyWatchers<T>(
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

  /**
   * Stop a specific watcher
   *
   * @param watcherId - ID of the watcher to stop
   */
  stopWatcher(watcherId: string): void {
    const watcher = this.watchers.get(watcherId);
    if (watcher) {
      watcher.unsubscribe();
    }
  }

  /**
   * Stop all watchers for a specific project
   *
   * @param projectId - Project identifier
   */
  stopProjectWatchers(projectId: string): void {
    for (const [id, watcher] of this.watchers) {
      if (watcher.projectId === projectId) {
        watcher.unsubscribe();
        this.watchers.delete(id);
        this.watcherCallbacks.delete(id);
      }
    }
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Close all file watchers
    for (const [, fsWatcher] of this.fsWatchers) {
      fsWatcher.close();
    }
    this.fsWatchers.clear();
    this.watchers.clear();
    this.watcherCallbacks.clear();
  }

  /**
   * Get the number of active watchers
   *
   * @returns Number of active watchers
   */
  getActiveWatcherCount(): number {
    return this.watchers.size;
  }

  /**
   * Get all active watcher IDs for a project
   *
   * @param projectId - Project identifier
   * @returns Array of watcher IDs
   */
  getProjectWatcherIds(projectId: string): string[] {
    const ids: string[] = [];
    for (const [id, watcher] of this.watchers) {
      if (watcher.projectId === projectId) {
        ids.push(id);
      }
    }
    return ids;
  }
}
