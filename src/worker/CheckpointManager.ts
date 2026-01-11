/**
 * Checkpoint Manager for Worker Agent
 *
 * Provides checkpoint/resume capability for long-running implementations.
 * Persists intermediate state to allow resuming from the last successful step
 * if a worker crashes mid-implementation.
 *
 * Features:
 * - Automatic checkpoint saving after each step
 * - Resume from last checkpoint on restart
 * - Checkpoint validation and integrity checks
 * - Cleanup of completed checkpoints
 *
 * @module worker/CheckpointManager
 */

import { join } from 'node:path';

import type { ProgressCheckpoint, WorkerStep, WorkOrder, FileChange, CommitInfo } from './types.js';
import { getScratchpad, type Scratchpad } from '../scratchpad/index.js';
import { tryGetProjectRoot } from '../utils/index.js';

/**
 * Checkpoint state data that captures the worker's progress
 */
export interface CheckpointState {
  /** Current execution context */
  readonly context?: {
    /** Work order being processed */
    readonly workOrder: WorkOrder;
    /** Branch name created for this work */
    readonly branchName?: string;
  };
  /** Files changed so far */
  readonly fileChanges: readonly FileChange[];
  /** Tests created so far */
  readonly testsCreated: ReadonlyMap<string, number> | Record<string, number>;
  /** Commits made so far */
  readonly commits: readonly CommitInfo[];
  /** Test generation result */
  readonly testGenerationResult?: unknown;
}

/**
 * Configuration for CheckpointManager
 */
export interface CheckpointManagerConfig {
  /** Base path for checkpoint storage (default: '.ad-sdlc/scratchpad/checkpoints') */
  readonly checkpointPath?: string;
  /** Project root directory */
  readonly projectRoot?: string;
  /** Whether to enable checkpointing (default: true) */
  readonly enabled?: boolean;
}

/**
 * Default checkpoint configuration
 */
export const DEFAULT_CHECKPOINT_CONFIG: Required<CheckpointManagerConfig> = {
  checkpointPath: '.ad-sdlc/scratchpad/checkpoints',
  projectRoot: process.cwd(),
  enabled: true,
} as const;

/**
 * Checkpoint Manager
 *
 * Manages checkpoint creation, retrieval, and cleanup for WorkerAgent.
 * Uses Scratchpad for persistent storage with atomic writes.
 */
export class CheckpointManager {
  private readonly config: Required<CheckpointManagerConfig>;
  private readonly scratchpad: Scratchpad;

  constructor(config: CheckpointManagerConfig = {}) {
    this.config = {
      checkpointPath: config.checkpointPath ?? DEFAULT_CHECKPOINT_CONFIG.checkpointPath,
      projectRoot: config.projectRoot ?? tryGetProjectRoot() ?? DEFAULT_CHECKPOINT_CONFIG.projectRoot,
      enabled: config.enabled ?? DEFAULT_CHECKPOINT_CONFIG.enabled,
    };

    this.scratchpad = getScratchpad({
      basePath: this.config.checkpointPath,
      projectRoot: this.config.projectRoot,
    });
  }

  /**
   * Check if checkpointing is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the checkpoint file path for a work order
   *
   * @param workOrderId - Work order identifier
   * @returns Path to checkpoint file
   */
  private getCheckpointPath(workOrderId: string): string {
    return join(this.config.checkpointPath, `${workOrderId}-checkpoint.yaml`);
  }

  /**
   * Save a checkpoint for the current execution state
   *
   * @param workOrderId - Work order identifier
   * @param taskId - Task identifier (can be same as workOrderId)
   * @param step - Current step being executed
   * @param attemptNumber - Current attempt number
   * @param state - Current state to save
   */
  public async saveCheckpoint(
    workOrderId: string,
    taskId: string,
    step: WorkerStep,
    attemptNumber: number,
    state: CheckpointState
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const checkpoint: ProgressCheckpoint = {
      workOrderId,
      taskId,
      currentStep: step,
      timestamp: new Date().toISOString(),
      attemptNumber,
      progressSnapshot: this.serializeState(state),
      filesChanged: Array.from(state.fileChanges.map((fc) => fc.filePath)),
      resumable: this.isResumableStep(step),
    };

    const checkpointPath = this.getCheckpointPath(workOrderId);
    await this.scratchpad.writeYaml(checkpointPath, checkpoint);
  }

  /**
   * Load the most recent checkpoint for a work order
   *
   * @param workOrderId - Work order identifier
   * @returns Checkpoint if found and valid, null otherwise
   */
  public async loadCheckpoint(workOrderId: string): Promise<ProgressCheckpoint | null> {
    if (!this.config.enabled) {
      return null;
    }

    const checkpointPath = this.getCheckpointPath(workOrderId);
    const checkpoint = await this.scratchpad.readYaml<ProgressCheckpoint>(checkpointPath, {
      allowMissing: true,
    });

    if (checkpoint === null) {
      return null;
    }

    // Validate checkpoint integrity
    if (!this.isValidCheckpoint(checkpoint)) {
      // Invalid checkpoint, delete it and return null
      await this.deleteCheckpoint(workOrderId);
      return null;
    }

    return checkpoint;
  }

  /**
   * Check if a checkpoint exists for a work order
   *
   * @param workOrderId - Work order identifier
   * @returns True if checkpoint exists
   */
  public async hasCheckpoint(workOrderId: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    const checkpointPath = this.getCheckpointPath(workOrderId);
    return this.scratchpad.exists(checkpointPath);
  }

  /**
   * Delete a checkpoint after successful completion
   *
   * @param workOrderId - Work order identifier
   */
  public async deleteCheckpoint(workOrderId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const checkpointPath = this.getCheckpointPath(workOrderId);
    try {
      await this.scratchpad.deleteFile(checkpointPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Extract state from a checkpoint for resume
   *
   * @param checkpoint - Checkpoint to extract state from
   * @returns Deserialized state or null if invalid
   */
  public extractState(checkpoint: ProgressCheckpoint): CheckpointState | null {
    try {
      const snapshot = checkpoint.progressSnapshot as Record<string, unknown>;

      // Reconstruct testsCreated as a Map
      const testsCreatedRaw = snapshot.testsCreated as Record<string, number> | undefined;
      const testsCreated = testsCreatedRaw !== undefined ? testsCreatedRaw : {};

      // Extract context, handling optional fields properly
      const rawContext = snapshot.context as
        | { workOrder: WorkOrder; branchName?: string }
        | undefined;

      // Build context if present
      const context: CheckpointState['context'] = rawContext !== undefined
        ? (rawContext.branchName !== undefined
            ? { workOrder: rawContext.workOrder, branchName: rawContext.branchName }
            : { workOrder: rawContext.workOrder })
        : undefined;

      // Build the result with all fields
      if (context !== undefined && snapshot.testGenerationResult !== undefined) {
        return {
          context,
          fileChanges: (snapshot.fileChanges as FileChange[]) ?? [],
          testsCreated,
          commits: (snapshot.commits as CommitInfo[]) ?? [],
          testGenerationResult: snapshot.testGenerationResult,
        };
      } else if (context !== undefined) {
        return {
          context,
          fileChanges: (snapshot.fileChanges as FileChange[]) ?? [],
          testsCreated,
          commits: (snapshot.commits as CommitInfo[]) ?? [],
        };
      } else if (snapshot.testGenerationResult !== undefined) {
        return {
          fileChanges: (snapshot.fileChanges as FileChange[]) ?? [],
          testsCreated,
          commits: (snapshot.commits as CommitInfo[]) ?? [],
          testGenerationResult: snapshot.testGenerationResult,
        };
      } else {
        return {
          fileChanges: (snapshot.fileChanges as FileChange[]) ?? [],
          testsCreated,
          commits: (snapshot.commits as CommitInfo[]) ?? [],
        };
      }
    } catch {
      return null;
    }
  }

  /**
   * Determine if a step is resumable
   *
   * Not all steps are safe to resume from. For example, if we crashed
   * during verification, we should resume from code_generation to ensure
   * proper state.
   *
   * @param step - Step to check
   * @returns True if step is safe to resume from
   */
  private isResumableStep(step: WorkerStep): boolean {
    // These steps have clear boundaries and can be safely resumed from
    const resumableSteps: WorkerStep[] = [
      'context_analysis',
      'branch_creation',
      'code_generation',
      'test_generation',
    ];
    return resumableSteps.includes(step);
  }

  /**
   * Get the next step to execute after resuming
   *
   * @param lastCompletedStep - Last step that was completed
   * @returns Next step to execute
   */
  public getNextStep(lastCompletedStep: WorkerStep): WorkerStep {
    const stepOrder: WorkerStep[] = [
      'context_analysis',
      'branch_creation',
      'code_generation',
      'test_generation',
      'verification',
      'commit',
      'result_persistence',
    ];

    const currentIndex = stepOrder.indexOf(lastCompletedStep);
    if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
      // Unknown step or last step - start from beginning
      return 'context_analysis';
    }

    const nextStep = stepOrder[currentIndex + 1];
    return nextStep ?? 'context_analysis';
  }

  /**
   * Validate checkpoint integrity
   *
   * @param checkpoint - Checkpoint to validate
   * @returns True if checkpoint is valid
   */
  private isValidCheckpoint(checkpoint: ProgressCheckpoint): boolean {
    // Check required fields
    if (
      typeof checkpoint.workOrderId !== 'string' ||
      checkpoint.workOrderId.length === 0
    ) {
      return false;
    }
    if (typeof checkpoint.currentStep !== 'string') {
      return false;
    }
    if (typeof checkpoint.timestamp !== 'string') {
      return false;
    }
    if (typeof checkpoint.attemptNumber !== 'number') {
      return false;
    }

    // Check timestamp validity (not too old - max 24 hours)
    const checkpointTime = new Date(checkpoint.timestamp).getTime();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (isNaN(checkpointTime) || now - checkpointTime > maxAge) {
      return false;
    }

    return true;
  }

  /**
   * Serialize state for storage
   *
   * @param state - State to serialize
   * @returns Serializable object
   */
  private serializeState(state: CheckpointState): Record<string, unknown> {
    // Convert Map to plain object for YAML serialization
    const testsCreated =
      state.testsCreated instanceof Map
        ? Object.fromEntries(state.testsCreated)
        : state.testsCreated;

    return {
      context: state.context,
      fileChanges: state.fileChanges,
      testsCreated,
      commits: state.commits,
      testGenerationResult: state.testGenerationResult,
    };
  }

  /**
   * List all existing checkpoints
   *
   * @returns Array of work order IDs with checkpoints
   */
  public async listCheckpoints(): Promise<string[]> {
    if (!this.config.enabled) {
      return [];
    }

    try {
      const basePath = this.scratchpad.getBasePath();
      const entries = await import('node:fs').then((fs) =>
        fs.promises.readdir(basePath)
      );
      return entries
        .filter((name) => name.endsWith('-checkpoint.yaml'))
        .map((name) => name.replace('-checkpoint.yaml', ''));
    } catch {
      return [];
    }
  }

  /**
   * Clean up old or invalid checkpoints
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
   * @returns Number of checkpoints cleaned up
   */
  public async cleanupOldCheckpoints(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.config.enabled) {
      return 0;
    }

    const workOrderIds = await this.listCheckpoints();
    let cleanedUp = 0;

    for (const workOrderId of workOrderIds) {
      const checkpoint = await this.loadCheckpoint(workOrderId);
      if (checkpoint === null) {
        // Already cleaned up in loadCheckpoint or doesn't exist
        continue;
      }

      const checkpointTime = new Date(checkpoint.timestamp).getTime();
      const now = Date.now();
      if (now - checkpointTime > maxAgeMs) {
        await this.deleteCheckpoint(workOrderId);
        cleanedUp++;
      }
    }

    return cleanedUp;
  }

  /**
   * Get the configuration
   */
  public getConfig(): Required<CheckpointManagerConfig> {
    return { ...this.config };
  }
}
