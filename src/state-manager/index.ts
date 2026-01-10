/**
 * State Manager Module
 *
 * High-level state management for AD-SDLC projects with:
 * - State transition validation
 * - History tracking and versioning
 * - Watch mode for state changes
 * - Concurrent access handling via file locking
 *
 * The module is organized into focused sub-modules:
 * - StateMachine: State transition logic and validation
 * - StatePersistence: File I/O and state storage
 * - StateHistory: History tracking and checkpoints
 * - StateWatcher: File watching and event notification
 * - StateRecovery: Recovery paths and admin overrides
 *
 * @module state-manager
 */

// Main class and singleton (Facade)
export { StateManager, getStateManager, resetStateManager } from './StateManager.js';

// Sub-modules for advanced usage
export {
  StateMachine,
  VALID_TRANSITIONS,
  ENHANCED_TRANSITIONS,
  PIPELINE_STAGES,
} from './StateMachine.js';
export type { IStateMachine } from './StateMachine.js';

export { StatePersistence } from './StatePersistence.js';
export type { IStatePersistence, StateMeta } from './StatePersistence.js';

export { StateHistoryManager } from './StateHistory.js';
export type { IStateHistory } from './StateHistory.js';

export { StateWatcherManager } from './StateWatcher.js';
export type { IStateWatcher, StateReader } from './StateWatcher.js';

export { StateRecovery } from './StateRecovery.js';
export type { IStateRecovery } from './StateRecovery.js';

// Types
export type {
  ProjectState,
  StateManagerOptions,
  StateChangeEvent,
  StateChangeCallback,
  StateWatcher,
  StateHistoryEntry,
  StateHistory,
  StateTransition,
  TransitionResult,
  ProjectStateSummary,
  ValidationResult,
  ValidationError,
  UpdateOptions,
  ReadStateOptions,
  StateWithMetadata,
  // Recovery types (Issue #218)
  EnhancedTransitionRule,
  StateCheckpoint,
  CheckpointData,
  CheckpointMetadata,
  CheckpointTrigger,
  SkipOptions,
  SkipResult,
  AdminOverride,
  AdminOverrideAction,
  RecoveryAuditEntry,
  RestoreResult,
  CheckpointOptions,
  PartialCompletion,
} from './types.js';

// Errors
export {
  StateManagerError,
  InvalidTransitionError,
  StateNotFoundError,
  ProjectNotFoundError,
  ProjectExistsError,
  StateValidationError,
  LockAcquisitionError,
  HistoryError,
  WatchError,
  // Recovery errors (Issue #218)
  InvalidSkipError,
  RequiredStageSkipError,
  CheckpointNotFoundError,
  CheckpointValidationError,
  AdminAuthorizationError,
  RecoveryError,
} from './errors.js';
