/**
 * State Recovery - Recovery paths, skip operations, and admin overrides
 *
 * Handles recovery transitions, skip-forward capability, and admin override operations.
 * This module provides advanced state manipulation features for error recovery.
 *
 * @module state-manager/StateRecovery
 */

import { randomUUID } from 'node:crypto';
import type { ScratchpadSection } from '../scratchpad/types.js';
import type {
  ProjectState,
  TransitionResult,
  SkipOptions,
  SkipResult,
  AdminOverride,
  StateCheckpoint,
  RestoreResult,
} from './types.js';
import {
  ProjectNotFoundError,
  InvalidTransitionError,
  InvalidSkipError,
  RequiredStageSkipError,
} from './errors.js';
import type { StateMachine } from './StateMachine.js';
import type { StatePersistence } from './StatePersistence.js';
import type { StateHistoryManager } from './StateHistory.js';

/**
 * Interface for state recovery operations
 */
export interface IStateRecovery {
  skipTo(projectId: string, targetState: ProjectState, options: SkipOptions): Promise<SkipResult>;
  recoverTo(projectId: string, toState: ProjectState, reason?: string): Promise<TransitionResult>;
  adminOverride(projectId: string, override: AdminOverride): Promise<TransitionResult>;
  restoreCheckpoint(projectId: string, checkpointId: string): Promise<RestoreResult>;
}

/**
 * StateRecovery class for managing recovery operations
 *
 * This class encapsulates all recovery-related logic including skip-forward,
 * recovery transitions, and admin overrides.
 */
export class StateRecovery implements IStateRecovery {
  constructor(
    private readonly stateMachine: StateMachine,
    private readonly persistence: StatePersistence,
    private readonly history: StateHistoryManager,
    private readonly enableHistory: boolean = true,
    private readonly getSectionState: (
      section: ScratchpadSection,
      projectId: string
    ) => Promise<unknown>
  ) {}

  /**
   * Skip forward to a target state, bypassing intermediate stages
   *
   * @param projectId - Project identifier
   * @param targetState - Target state to skip to
   * @param options - Skip options
   * @returns Skip result
   */
  async skipTo(
    projectId: string,
    targetState: ProjectState,
    options: SkipOptions
  ): Promise<SkipResult> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.persistence.getMeta(projectId);
    const currentState = meta.currentState;
    const now = new Date().toISOString();

    // Check if skip is allowed
    if (!this.stateMachine.canSkipTo(currentState, targetState)) {
      throw new InvalidSkipError(currentState, targetState, projectId);
    }

    // Get stages that would be skipped
    const skippedStages = this.stateMachine.getStagesBetween(currentState, targetState);

    // Check for required stages
    const requiredSkipped = skippedStages.filter((stage) =>
      this.stateMachine.isStageRequired(stage)
    );

    if (requiredSkipped.length > 0 && options.forceSkipRequired !== true) {
      throw new RequiredStageSkipError(requiredSkipped, projectId);
    }

    // Create checkpoint before skip if requested
    let checkpointId: string | undefined;
    if (options.createCheckpoint !== false) {
      const sections = await this.collectSectionStates(projectId);
      checkpointId = await this.history.createCheckpoint(
        projectId,
        currentState,
        { currentState: meta.currentState, version: meta.version },
        sections,
        'skip',
        options.reason
      );

      // Record checkpoint creation in audit log
      await this.history.recordAudit(projectId, {
        id: randomUUID(),
        projectId,
        type: 'checkpoint_created',
        timestamp: now,
        fromState: currentState,
        toState: currentState,
        details: { checkpointId, trigger: 'skip', reason: options.reason },
      });
    }

    // Perform the skip transition
    await this.persistence.transitionState(projectId, targetState);

    // Record in audit log
    await this.history.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'skip_forward',
      timestamp: now,
      fromState: currentState,
      toState: targetState,
      details: {
        skippedStages,
        reason: options.reason,
        forceSkipRequired: options.forceSkipRequired,
        approvedBy: options.approvedBy,
        checkpointId,
      },
      performedBy: options.approvedBy,
    });

    // Record in history
    if (this.enableHistory) {
      await this.history.addHistoryEntry(
        'progress',
        projectId,
        {
          skip: { from: currentState, to: targetState },
          skippedStages,
          timestamp: now,
        },
        `Skip forward: ${currentState} → ${targetState} (skipped: ${skippedStages.join(', ')})`
      );
    }

    return {
      success: true,
      skippedStages,
      checkpointId,
      timestamp: now,
    };
  }

  /**
   * Perform a recovery transition (go back to a previous state)
   *
   * @param projectId - Project identifier
   * @param toState - Target recovery state
   * @param reason - Reason for recovery
   * @returns Transition result
   */
  async recoverTo(
    projectId: string,
    toState: ProjectState,
    reason?: string
  ): Promise<TransitionResult> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.persistence.getMeta(projectId);
    const currentState = meta.currentState;

    // Check if recovery transition is valid
    if (!this.stateMachine.canRecoverTo(currentState, toState)) {
      throw new InvalidTransitionError(currentState, toState, projectId);
    }

    const now = new Date().toISOString();

    // Create checkpoint before recovery
    const sections = await this.collectSectionStates(projectId);
    await this.history.createCheckpoint(
      projectId,
      currentState,
      { currentState: meta.currentState, version: meta.version },
      sections,
      'recovery',
      reason
    );

    // Perform the recovery transition
    await this.persistence.transitionState(projectId, toState);

    // Record in audit log
    await this.history.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'recovery_transition',
      timestamp: now,
      fromState: currentState,
      toState,
      details: { reason },
    });

    // Record in history
    if (this.enableHistory) {
      await this.history.addHistoryEntry(
        'progress',
        projectId,
        {
          recovery: { from: currentState, to: toState },
          reason,
          timestamp: now,
        },
        `Recovery: ${currentState} → ${toState}${reason !== undefined && reason !== '' ? ` (${reason})` : ''}`
      );
    }

    return {
      success: true,
      previousState: currentState,
      newState: toState,
      timestamp: now,
    };
  }

  /**
   * Perform an admin override operation
   *
   * @param projectId - Project identifier
   * @param override - Override specification
   * @returns Transition result
   */
  async adminOverride(projectId: string, override: AdminOverride): Promise<TransitionResult> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    const meta = await this.persistence.getMeta(projectId);
    const previousState = meta.currentState;
    const now = new Date().toISOString();

    // Create checkpoint before override
    const sections = await this.collectSectionStates(projectId);
    await this.history.createCheckpoint(
      projectId,
      previousState,
      { currentState: meta.currentState, version: meta.version },
      sections,
      'recovery',
      `Admin override: ${override.reason}`
    );

    // Record in audit log first
    await this.history.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'admin_override',
      timestamp: now,
      fromState: previousState,
      toState: override.targetState,
      details: {
        action: override.action,
        reason: override.reason,
      },
      performedBy: override.authorizedBy,
    });

    // Perform the override
    await this.persistence.transitionState(projectId, override.targetState);

    // Record in history
    if (this.enableHistory) {
      await this.history.addHistoryEntry(
        'progress',
        projectId,
        {
          adminOverride: {
            from: previousState,
            to: override.targetState,
            action: override.action,
          },
          timestamp: now,
        },
        `Admin override (${override.action}): ${previousState} → ${override.targetState}`
      );
    }

    return {
      success: true,
      previousState,
      newState: override.targetState,
      timestamp: now,
    };
  }

  /**
   * Restore project state from a checkpoint
   *
   * @param projectId - Project identifier
   * @param checkpointId - Checkpoint ID to restore
   * @returns Restore result
   */
  async restoreCheckpoint(projectId: string, checkpointId: string): Promise<RestoreResult> {
    const exists = await this.persistence.projectExists(projectId);
    if (!exists) {
      throw new ProjectNotFoundError(projectId);
    }

    // Get and validate checkpoint
    const checkpoint = await this.history.restoreCheckpoint(projectId, checkpointId);
    const meta = await this.persistence.getMeta(projectId);
    const previousState = meta.currentState;
    const now = new Date().toISOString();

    // Restore state metadata
    await this.persistence.updateMeta(projectId, {
      currentState: checkpoint.state,
    });

    // Restore section states
    await this.restoreSectionStates(projectId, checkpoint);

    // Record in audit log
    await this.history.recordAudit(projectId, {
      id: randomUUID(),
      projectId,
      type: 'checkpoint_restored',
      timestamp: now,
      fromState: previousState,
      toState: checkpoint.state,
      details: { checkpointId, checkpointTimestamp: checkpoint.timestamp },
    });

    // Record in history
    if (this.enableHistory) {
      await this.history.addHistoryEntry(
        'progress',
        projectId,
        {
          restore: { from: previousState, to: checkpoint.state },
          checkpointId,
          timestamp: now,
        },
        `Restored from checkpoint: ${checkpoint.state}`
      );
    }

    return {
      success: true,
      restoredState: checkpoint.state,
      restoredAt: now,
      checkpointId,
    };
  }

  /**
   * Collect section states for checkpoint creation
   *
   * @param projectId - Project identifier
   * @returns Partial record of section states
   */
  private async collectSectionStates(
    projectId: string
  ): Promise<Partial<Record<ScratchpadSection, unknown>>> {
    const sections: Partial<Record<ScratchpadSection, unknown>> = {};
    const sectionNames: ScratchpadSection[] = ['info', 'documents', 'issues', 'progress'];

    for (const section of sectionNames) {
      try {
        const sectionState = await this.getSectionState(section, projectId);
        if (sectionState !== null) {
          sections[section] = sectionState;
        }
      } catch {
        // Ignore sections that don't exist
      }
    }

    return sections;
  }

  /**
   * Restore section states from a checkpoint
   *
   * @param projectId - Project identifier
   * @param checkpoint - Checkpoint to restore from
   */
  private async restoreSectionStates(
    projectId: string,
    checkpoint: StateCheckpoint
  ): Promise<void> {
    for (const [section, sectionData] of Object.entries(checkpoint.data.sections)) {
      if (sectionData !== undefined) {
        await this.persistence.writeYaml(section as ScratchpadSection, projectId, sectionData as object);
      }
    }
  }
}
