/**
 * State Manager error classes
 *
 * Custom error types for state management operations.
 *
 * @module state-manager/errors
 */

import type { ProjectState, ValidationError } from './types.js';

/**
 * Base error for state manager operations
 */
export class StateManagerError extends Error {
  readonly code: string;
  readonly projectId: string | undefined;

  constructor(message: string, code: string, projectId?: string) {
    super(message);
    this.name = 'StateManagerError';
    this.code = code;
    this.projectId = projectId;
    Object.setPrototypeOf(this, StateManagerError.prototype);
  }
}

/**
 * Error for invalid state transitions
 */
export class InvalidTransitionError extends StateManagerError {
  readonly fromState: ProjectState;
  readonly toState: ProjectState;

  constructor(fromState: ProjectState, toState: ProjectState, projectId?: string) {
    const message = `Invalid state transition from '${fromState}' to '${toState}'`;
    super(message, 'INVALID_TRANSITION', projectId);
    this.name = 'InvalidTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    Object.setPrototypeOf(this, InvalidTransitionError.prototype);
  }
}

/**
 * Error when state is not found
 */
export class StateNotFoundError extends StateManagerError {
  readonly section: string;

  constructor(section: string, projectId: string) {
    const message = `State not found for section '${section}' in project '${projectId}'`;
    super(message, 'STATE_NOT_FOUND', projectId);
    this.name = 'StateNotFoundError';
    this.section = section;
    Object.setPrototypeOf(this, StateNotFoundError.prototype);
  }
}

/**
 * Error when project is not found
 */
export class ProjectNotFoundError extends StateManagerError {
  constructor(projectId: string) {
    const message = `Project '${projectId}' not found`;
    super(message, 'PROJECT_NOT_FOUND', projectId);
    this.name = 'ProjectNotFoundError';
    Object.setPrototypeOf(this, ProjectNotFoundError.prototype);
  }
}

/**
 * Error when project already exists
 */
export class ProjectExistsError extends StateManagerError {
  constructor(projectId: string) {
    const message = `Project '${projectId}' already exists`;
    super(message, 'PROJECT_EXISTS', projectId);
    this.name = 'ProjectExistsError';
    Object.setPrototypeOf(this, ProjectExistsError.prototype);
  }
}

/**
 * Error for state validation failures
 */
export class StateValidationError extends StateManagerError {
  readonly errors: readonly ValidationError[];

  constructor(errors: readonly ValidationError[], projectId?: string) {
    const errorMessages = errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    const message = `State validation failed: ${errorMessages}`;
    super(message, 'VALIDATION_FAILED', projectId);
    this.name = 'StateValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, StateValidationError.prototype);
  }

  /**
   * Format errors for display
   */
  formatErrors(): string {
    return this.errors.map((e) => `  - [${e.code}] ${e.path}: ${e.message}`).join('\n');
  }
}

/**
 * Error when file lock cannot be acquired
 */
export class LockAcquisitionError extends StateManagerError {
  readonly filePath: string;

  constructor(filePath: string, projectId?: string) {
    const message = `Failed to acquire lock for: ${filePath}`;
    super(message, 'LOCK_FAILED', projectId);
    this.name = 'LockAcquisitionError';
    this.filePath = filePath;
    Object.setPrototypeOf(this, LockAcquisitionError.prototype);
  }
}

/**
 * Error when state history operation fails
 */
export class HistoryError extends StateManagerError {
  constructor(message: string, projectId?: string) {
    super(message, 'HISTORY_ERROR', projectId);
    this.name = 'HistoryError';
    Object.setPrototypeOf(this, HistoryError.prototype);
  }
}

/**
 * Error when watch operation fails
 */
export class WatchError extends StateManagerError {
  constructor(message: string, projectId?: string) {
    super(message, 'WATCH_ERROR', projectId);
    this.name = 'WatchError';
    Object.setPrototypeOf(this, WatchError.prototype);
  }
}
