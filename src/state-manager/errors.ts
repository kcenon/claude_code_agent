/**
 * State Manager error classes
 *
 * Custom error types for state management operations.
 * All errors extend AppError for standardized error handling.
 *
 * @module state-manager/errors
 */

import { AppError, ErrorCodes, ErrorSeverity } from '../errors/index.js';
import type { AppErrorOptions } from '../errors/index.js';
import type { ProjectState, ValidationError } from './types.js';

/**
 * Base error for state manager operations
 */
export class StateManagerError extends AppError {
  readonly projectId: string | undefined;

  constructor(
    code: string,
    message: string,
    options: AppErrorOptions & { projectId?: string } = {}
  ) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.MEDIUM,
      category: options.category ?? 'recoverable',
      ...options,
    });
    this.name = 'StateManagerError';
    this.projectId = options.projectId;
    if (options.projectId !== undefined) {
      this.context.projectId = options.projectId;
    }
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { fromState, toState },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_INVALID_TRANSITION, message, options);
    this.name = 'InvalidTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

/**
 * Error when state is not found
 */
export class StateNotFoundError extends StateManagerError {
  readonly section: string;

  constructor(section: string, projectId: string) {
    const message = `State not found for section '${section}' in project '${projectId}'`;
    super(ErrorCodes.STM_STATE_NOT_FOUND, message, {
      context: { section },
      projectId,
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    });
    this.name = 'StateNotFoundError';
    this.section = section;
  }
}

/**
 * Error when project is not found
 */
export class ProjectNotFoundError extends StateManagerError {
  constructor(projectId: string) {
    const message = `Project '${projectId}' not found`;
    super(ErrorCodes.STM_PROJECT_NOT_FOUND, message, {
      projectId,
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    });
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Error when project already exists
 */
export class ProjectExistsError extends StateManagerError {
  constructor(projectId: string) {
    const message = `Project '${projectId}' already exists`;
    super(ErrorCodes.STM_PROJECT_EXISTS, message, {
      projectId,
      severity: ErrorSeverity.LOW,
      category: 'recoverable',
    });
    this.name = 'ProjectExistsError';
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { errors, errorCount: errors.length },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_VALIDATION_FAILED, message, options);
    this.name = 'StateValidationError';
    this.errors = errors;
  }

  /**
   * Format errors for display
   * @returns A formatted string with each validation error on a separate line
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { filePath },
      severity: ErrorSeverity.HIGH,
      category: 'transient',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_LOCK_FAILED, message, options);
    this.name = 'LockAcquisitionError';
    this.filePath = filePath;
  }
}

/**
 * Error when state history operation fails
 */
export class HistoryError extends StateManagerError {
  constructor(message: string, projectId?: string) {
    const options: AppErrorOptions & { projectId?: string } = {
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_HISTORY_ERROR, message, options);
    this.name = 'HistoryError';
  }
}

/**
 * Error when watch operation fails
 */
export class WatchError extends StateManagerError {
  constructor(message: string, projectId?: string) {
    const options: AppErrorOptions & { projectId?: string } = {
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_WATCH_ERROR, message, options);
    this.name = 'WatchError';
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { fromState, toState },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_INVALID_SKIP, message, options);
    this.name = 'InvalidSkipError';
    this.fromState = fromState;
    this.toState = toState;
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { requiredStages, stageCount: requiredStages.length },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_REQUIRED_STAGE_SKIP, message, options);
    this.name = 'RequiredStageSkipError';
    this.requiredStages = requiredStages;
  }
}

/**
 * Error when checkpoint is not found
 */
export class CheckpointNotFoundError extends StateManagerError {
  readonly checkpointId: string;

  constructor(checkpointId: string, projectId?: string) {
    const message = `Checkpoint '${checkpointId}' not found`;
    const options: AppErrorOptions & { projectId?: string } = {
      context: { checkpointId },
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_CHECKPOINT_NOT_FOUND, message, options);
    this.name = 'CheckpointNotFoundError';
    this.checkpointId = checkpointId;
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { checkpointId, validationErrors, errorCount: validationErrors.length },
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_CHECKPOINT_VALIDATION_FAILED, message, options);
    this.name = 'CheckpointValidationError';
    this.checkpointId = checkpointId;
    this.validationErrors = validationErrors;
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { action, authorizedBy },
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_ADMIN_AUTH_FAILED, message, options);
    this.name = 'AdminAuthorizationError';
    this.action = action;
    this.authorizedBy = authorizedBy;
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
    const options: AppErrorOptions & { projectId?: string } = {
      context: { recoveryType, reason },
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
    };
    if (projectId !== undefined) {
      options.projectId = projectId;
    }
    super(ErrorCodes.STM_RECOVERY_FAILED, message, options);
    this.name = 'RecoveryError';
    this.recoveryType = recoveryType;
    this.reason = reason;
  }
}
