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

// ============================================================
// Recovery Error Classes (Issue #218)
// ============================================================

/**
 * Error when attempting invalid skip operation
 */
export class InvalidSkipError extends StateManagerError {
  readonly fromState: ProjectState;
  readonly toState: ProjectState;

  constructor(fromState: ProjectState, toState: ProjectState, projectId?: string) {
    const message = `Cannot skip from '${fromState}' to '${toState}': not allowed by transition rules`;
    super(message, 'INVALID_SKIP', projectId);
    this.name = 'InvalidSkipError';
    this.fromState = fromState;
    this.toState = toState;
    Object.setPrototypeOf(this, InvalidSkipError.prototype);
  }
}

/**
 * Error when trying to skip required stages without force flag
 */
export class RequiredStageSkipError extends StateManagerError {
  readonly requiredStages: readonly ProjectState[];

  constructor(requiredStages: readonly ProjectState[], projectId?: string) {
    const stageList = requiredStages.join(', ');
    const message = `Cannot skip required stages: ${stageList}. Use forceSkipRequired option to override.`;
    super(message, 'REQUIRED_STAGE_SKIP', projectId);
    this.name = 'RequiredStageSkipError';
    this.requiredStages = requiredStages;
    Object.setPrototypeOf(this, RequiredStageSkipError.prototype);
  }
}

/**
 * Error when checkpoint is not found
 */
export class CheckpointNotFoundError extends StateManagerError {
  readonly checkpointId: string;

  constructor(checkpointId: string, projectId?: string) {
    const message = `Checkpoint '${checkpointId}' not found`;
    super(message, 'CHECKPOINT_NOT_FOUND', projectId);
    this.name = 'CheckpointNotFoundError';
    this.checkpointId = checkpointId;
    Object.setPrototypeOf(this, CheckpointNotFoundError.prototype);
  }
}

/**
 * Error when checkpoint validation fails
 */
export class CheckpointValidationError extends StateManagerError {
  readonly checkpointId: string;
  readonly validationErrors: readonly string[];

  constructor(checkpointId: string, validationErrors: readonly string[], projectId?: string) {
    const errorList = validationErrors.join('; ');
    const message = `Checkpoint '${checkpointId}' validation failed: ${errorList}`;
    super(message, 'CHECKPOINT_VALIDATION_FAILED', projectId);
    this.name = 'CheckpointValidationError';
    this.checkpointId = checkpointId;
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, CheckpointValidationError.prototype);
  }
}

/**
 * Error when admin override authorization fails
 */
export class AdminAuthorizationError extends StateManagerError {
  readonly action: string;
  readonly authorizedBy: string;

  constructor(action: string, authorizedBy: string, projectId?: string) {
    const message = `Admin override authorization failed for action '${action}' by '${authorizedBy}'`;
    super(message, 'ADMIN_AUTH_FAILED', projectId);
    this.name = 'AdminAuthorizationError';
    this.action = action;
    this.authorizedBy = authorizedBy;
    Object.setPrototypeOf(this, AdminAuthorizationError.prototype);
  }
}

/**
 * Error when recovery operation fails
 */
export class RecoveryError extends StateManagerError {
  readonly recoveryType: string;
  readonly reason: string;

  constructor(recoveryType: string, reason: string, projectId?: string) {
    const message = `Recovery operation '${recoveryType}' failed: ${reason}`;
    super(message, 'RECOVERY_FAILED', projectId);
    this.name = 'RecoveryError';
    this.recoveryType = recoveryType;
    this.reason = reason;
    Object.setPrototypeOf(this, RecoveryError.prototype);
  }
}
