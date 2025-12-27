/**
 * State Manager type definitions
 *
 * Provides types for state management, transitions, and history tracking.
 *
 * @module state-manager/types
 */

import type { ScratchpadSection } from '../scratchpad/types.js';

/**
 * Project lifecycle states
 *
 * Represents the complete lifecycle of a project from requirements
 * collection through to merge completion.
 */
export type ProjectState =
  | 'collecting'
  | 'clarifying'
  | 'prd_drafting'
  | 'prd_approved'
  | 'srs_drafting'
  | 'srs_approved'
  | 'sds_drafting'
  | 'sds_approved'
  | 'issues_creating'
  | 'issues_created'
  | 'implementing'
  | 'pr_review'
  | 'merged'
  | 'cancelled';

/**
 * State Manager configuration options
 */
export interface StateManagerOptions {
  /** Base directory for state storage (default: '.ad-sdlc/scratchpad') */
  readonly basePath?: string;
  /** Enable file locking for concurrent access (default: true) */
  readonly enableLocking?: boolean;
  /** Lock timeout in milliseconds (default: 5000) */
  readonly lockTimeout?: number;
  /** Enable state history tracking (default: true) */
  readonly enableHistory?: boolean;
  /** Maximum history entries to keep per state (default: 50) */
  readonly maxHistoryEntries?: number;
}

/**
 * State change event
 */
export interface StateChangeEvent<T = unknown> {
  /** Project ID */
  readonly projectId: string;
  /** Section that changed */
  readonly section: ScratchpadSection;
  /** Previous state value */
  readonly previousValue: T | null;
  /** New state value */
  readonly newValue: T;
  /** Change timestamp */
  readonly timestamp: string;
  /** Change type */
  readonly changeType: 'create' | 'update' | 'delete';
}

/**
 * State change callback function
 */
export type StateChangeCallback<T = unknown> = (event: StateChangeEvent<T>) => void;

/**
 * State watcher handle for cleanup
 */
export interface StateWatcher {
  /** Watcher identifier */
  readonly id: string;
  /** Project ID being watched */
  readonly projectId: string;
  /** Section being watched (null for all sections) */
  readonly section: ScratchpadSection | null;
  /** Stop watching */
  readonly unsubscribe: () => void;
}

/**
 * State history entry
 */
export interface StateHistoryEntry<T = unknown> {
  /** History entry ID */
  readonly id: string;
  /** State value at this point */
  readonly value: T;
  /** Timestamp of this entry */
  readonly timestamp: string;
  /** Change description */
  readonly description: string | undefined;
  /** Previous entry ID (for chain) */
  readonly previousId: string | undefined;
}

/**
 * State history for a specific section
 */
export interface StateHistory<T = unknown> {
  /** Project ID */
  readonly projectId: string;
  /** Section */
  readonly section: ScratchpadSection;
  /** History entries (newest first) */
  readonly entries: readonly StateHistoryEntry<T>[];
  /** Current entry ID */
  readonly currentId: string;
}

/**
 * State transition definition
 */
export interface StateTransition {
  /** Source state */
  readonly from: ProjectState;
  /** Target state */
  readonly to: ProjectState;
  /** Transition description */
  readonly description?: string;
}

/**
 * State transition result
 */
export interface TransitionResult {
  /** Whether transition was successful */
  readonly success: boolean;
  /** Previous state */
  readonly previousState: ProjectState;
  /** New state (same as previous if failed) */
  readonly newState: ProjectState;
  /** Error message if failed */
  readonly error?: string;
  /** Transition timestamp */
  readonly timestamp: string;
}

/**
 * Project state summary
 */
export interface ProjectStateSummary {
  /** Project ID */
  readonly projectId: string;
  /** Current project state */
  readonly currentState: ProjectState;
  /** Last update timestamp */
  readonly lastUpdated: string;
  /** State history count */
  readonly historyCount: number;
  /** Has pending changes */
  readonly hasPendingChanges: boolean;
}

/**
 * Validation result for state operations
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly valid: boolean;
  /** Validation errors */
  readonly errors: readonly ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error field path */
  readonly path: string;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code: string;
}

/**
 * State update options
 */
export interface UpdateOptions {
  /** Whether to merge with existing state (default: true) */
  readonly merge?: boolean;
  /** Description of the change for history */
  readonly description?: string;
  /** Skip validation (default: false) */
  readonly skipValidation?: boolean;
}

/**
 * State read options
 */
export interface ReadStateOptions {
  /** Return null instead of throwing on missing state */
  readonly allowMissing?: boolean;
  /** Include history in response */
  readonly includeHistory?: boolean;
}

/**
 * State with metadata
 */
export interface StateWithMetadata<T> {
  /** The state value */
  readonly value: T;
  /** Project ID */
  readonly projectId: string;
  /** Section */
  readonly section: ScratchpadSection;
  /** Last update timestamp */
  readonly updatedAt: string;
  /** State version */
  readonly version: number;
  /** History (if requested) */
  readonly history: StateHistory<T> | undefined;
}
