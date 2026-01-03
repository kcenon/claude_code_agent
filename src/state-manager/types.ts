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

// ============================================================
// Enhanced Recovery Types (Issue #218)
// ============================================================

/**
 * Enhanced transition rule with recovery paths
 */
export interface EnhancedTransitionRule {
  /** Target states for normal forward flow */
  readonly normal: readonly ProjectState[];
  /** Target states for recovery/backward flow */
  readonly recovery: readonly ProjectState[];
  /** States that can be skipped to from this state */
  readonly skipTo: readonly ProjectState[];
  /** Is this stage required for completion? */
  readonly required: boolean;
  /** Minimum completion percentage to proceed (for partial completion) */
  readonly minCompletion?: number;
}

/**
 * Checkpoint trigger type
 */
export type CheckpointTrigger = 'auto' | 'manual' | 'recovery' | 'skip';

/**
 * State checkpoint for recovery
 */
export interface StateCheckpoint {
  /** Unique checkpoint ID */
  readonly id: string;
  /** Project state at checkpoint */
  readonly state: ProjectState;
  /** Checkpoint creation timestamp */
  readonly timestamp: string;
  /** Full state data at checkpoint */
  readonly data: CheckpointData;
  /** Checkpoint metadata */
  readonly metadata: CheckpointMetadata;
}

/**
 * Checkpoint data structure
 */
export interface CheckpointData {
  /** State metadata */
  readonly meta: {
    readonly currentState: ProjectState;
    readonly version: number;
  };
  /** Section states at checkpoint time */
  readonly sections: Partial<Record<ScratchpadSection, unknown>>;
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
  /** How this checkpoint was triggered */
  readonly triggeredBy: CheckpointTrigger;
  /** Reason for creating checkpoint */
  readonly reason?: string | undefined;
  /** User/agent that created the checkpoint */
  readonly createdBy?: string | undefined;
  /** Related transition (if any) */
  readonly transition?: {
    readonly from: ProjectState;
    readonly to: ProjectState;
  };
}

/**
 * Options for skip-forward operation
 */
export interface SkipOptions {
  /** Reason for skipping */
  readonly reason: string;
  /** Force skip even required stages (requires admin) */
  readonly forceSkipRequired?: boolean;
  /** User/agent approving the skip */
  readonly approvedBy?: string;
  /** Create checkpoint before skip */
  readonly createCheckpoint?: boolean;
}

/**
 * Result of skip-forward operation
 */
export interface SkipResult {
  /** Whether skip was successful */
  readonly success: boolean;
  /** Stages that were skipped */
  readonly skippedStages: readonly ProjectState[];
  /** Checkpoint ID if created */
  readonly checkpointId?: string | undefined;
  /** Timestamp of skip */
  readonly timestamp: string;
}

/**
 * Admin override action types
 */
export type AdminOverrideAction =
  | 'force_transition'
  | 'force_skip'
  | 'restore_checkpoint'
  | 'manual_correction';

/**
 * Admin override request
 */
export interface AdminOverride {
  /** Type of override action */
  readonly action: AdminOverrideAction;
  /** Target state for the override */
  readonly targetState: ProjectState;
  /** Reason for the override */
  readonly reason: string;
  /** User/agent authorizing the override */
  readonly authorizedBy: string;
  /** Override timestamp */
  readonly timestamp: string;
}

/**
 * Recovery audit entry for logging
 */
export interface RecoveryAuditEntry {
  /** Unique audit entry ID */
  readonly id: string;
  /** Project ID */
  readonly projectId: string;
  /** Audit entry type */
  readonly type:
    | 'checkpoint_created'
    | 'checkpoint_restored'
    | 'skip_forward'
    | 'admin_override'
    | 'recovery_transition';
  /** Timestamp */
  readonly timestamp: string;
  /** Previous state */
  readonly fromState: ProjectState;
  /** New state */
  readonly toState: ProjectState;
  /** Additional details */
  readonly details: Record<string, unknown>;
  /** User/agent that performed the action */
  readonly performedBy?: string | undefined;
}

/**
 * Result of checkpoint restore operation
 */
export interface RestoreResult {
  /** Whether restore was successful */
  readonly success: boolean;
  /** State restored to */
  readonly restoredState: ProjectState;
  /** Timestamp of restore */
  readonly restoredAt: string;
  /** Checkpoint that was restored */
  readonly checkpointId: string;
}

/**
 * Options for checkpoint operations
 */
export interface CheckpointOptions {
  /** Maximum number of checkpoints to retain */
  readonly maxCheckpoints?: number;
  /** Auto-create checkpoints on transitions */
  readonly autoCheckpoint?: boolean;
}

/**
 * Partial completion tracking
 */
export interface PartialCompletion {
  /** State in partial completion */
  readonly state: ProjectState;
  /** Completion percentage (0-100) */
  readonly percentage: number;
  /** Items completed */
  readonly completedItems: readonly string[];
  /** Items remaining */
  readonly remainingItems: readonly string[];
  /** Last update timestamp */
  readonly lastUpdated: string;
}
