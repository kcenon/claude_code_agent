/**
 * State Manager Module
 *
 * High-level state management for AD-SDLC projects with:
 * - State transition validation
 * - History tracking and versioning
 * - Watch mode for state changes
 * - Concurrent access handling via file locking
 *
 * @module state-manager
 */

// Main class and singleton
export { StateManager, getStateManager, resetStateManager } from './StateManager.js';

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
} from './errors.js';
