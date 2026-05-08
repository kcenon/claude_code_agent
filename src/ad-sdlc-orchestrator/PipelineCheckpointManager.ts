/**
 * PipelineCheckpointManager - Mid-stage checkpoint persistence for pipeline resume
 *
 * Saves checkpoint files after each completed stage so that interrupted
 * pipelines can resume from the last checkpoint instead of restarting.
 *
 * Storage: {scratchpadDir}/pipeline/checkpoints/{sessionId}-ckpt-{timestamp}.yaml
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { getLogger } from '../logging/index.js';
import type {
  CheckpointConfig,
  PipelineCheckpoint,
  PipelineMode,
  StageName,
  StageResult,
} from './types.js';

const logger = getLogger();

/**
 * Default checkpoint configuration
 */
const DEFAULT_CONFIG: Required<CheckpointConfig> = {
  enabled: true,
  maxCheckpoints: 5,
};

/**
 * Latest checkpoint schema version. Save paths always emit this; load
 * paths auto-migrate older payloads in memory.
 */
const CURRENT_CHECKPOINT_VERSION = 2 as const;

/**
 * Manages pipeline checkpoint persistence for crash recovery.
 */
export class PipelineCheckpointManager {
  private readonly config: Required<CheckpointConfig>;

  constructor(config?: Partial<CheckpointConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Whether checkpointing is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Save a checkpoint after a stage completes.
   *
   * @param sessionId - Current session ID
   * @param mode - Pipeline mode
   * @param projectDir - Project directory
   * @param userRequest - User request text
   * @param scratchpadDir - Scratchpad directory
   * @param completedResults - Stage results accumulated so far
   * @param completedNames - Names of completed stages
   * @param sdkSessionId - Optional SDK session id from the most recent
   *   ExecutionAdapter call. Persisted so a resumed stage can pass
   *   `resume: sessionId` to the SDK and recover its tool-loop context.
   *   Pass `undefined` (or omit) when the adapter does not surface a
   *   session id.
   */
  public async saveCheckpoint(
    sessionId: string,
    mode: PipelineMode,
    projectDir: string,
    userRequest: string,
    scratchpadDir: string,
    completedResults: readonly StageResult[],
    completedNames: readonly StageName[],
    sdkSessionId?: string
  ): Promise<string> {
    const checkpointDir = this.getCheckpointDir(scratchpadDir);
    await fs.promises.mkdir(checkpointDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `${sessionId}-ckpt-${String(timestamp)}.yaml`;
    const filePath = path.join(checkpointDir, filename);

    const checkpoint: PipelineCheckpoint = {
      version: CURRENT_CHECKPOINT_VERSION,
      sessionId,
      mode,
      projectDir,
      userRequest,
      createdAt: new Date().toISOString(),
      completedStageResults: completedResults,
      completedStageNames: completedNames,
      ...(sdkSessionId !== undefined && sdkSessionId !== '' ? { sdkSessionId } : {}),
    };

    await fs.promises.writeFile(filePath, yaml.dump(checkpoint), 'utf-8');

    // Prune old checkpoints
    await this.pruneCheckpoints(sessionId, scratchpadDir);

    logger.debug('Pipeline checkpoint saved', {
      agent: 'PipelineCheckpointManager',
      sessionId,
      completedStages: completedNames.length,
      file: filename,
    });

    return filename;
  }

  /**
   * Load the most recent checkpoint for a session.
   *
   * @param sessionId - Session ID to load checkpoint for
   * @param scratchpadDir - Scratchpad directory
   * @returns Latest checkpoint or null if none exists
   */
  public async loadLatestCheckpoint(
    sessionId: string,
    scratchpadDir: string
  ): Promise<PipelineCheckpoint | null> {
    const checkpointDir = this.getCheckpointDir(scratchpadDir);

    try {
      const files = await fs.promises.readdir(checkpointDir);
      const sessionFiles = files
        .filter((f) => f.startsWith(`${sessionId}-ckpt-`) && f.endsWith('.yaml'))
        .sort()
        .reverse();

      if (sessionFiles.length === 0) {
        return null;
      }

      const latestFile = sessionFiles[0];
      if (latestFile === undefined) {
        return null;
      }
      const content = await fs.promises.readFile(path.join(checkpointDir, latestFile), 'utf-8');
      const raw = yaml.load(content) as Record<string, unknown> | null;

      if (raw === null || typeof raw !== 'object') {
        logger.warn('Invalid checkpoint data', {
          agent: 'PipelineCheckpointManager',
          file: latestFile,
          reason: 'not an object',
        });
        return null;
      }

      if (raw['sessionId'] !== sessionId) {
        logger.warn('Invalid checkpoint data', {
          agent: 'PipelineCheckpointManager',
          file: latestFile,
          reason: 'sessionId mismatch',
        });
        return null;
      }

      return migrateCheckpoint(raw, latestFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      logger.warn('Failed to load checkpoint', {
        agent: 'PipelineCheckpointManager',
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Delete all checkpoints for a session (called after successful completion).
   * @param sessionId
   * @param scratchpadDir
   */
  public async deleteSessionCheckpoints(sessionId: string, scratchpadDir: string): Promise<void> {
    const checkpointDir = this.getCheckpointDir(scratchpadDir);

    try {
      const files = await fs.promises.readdir(checkpointDir);
      const sessionFiles = files.filter(
        (f) => f.startsWith(`${sessionId}-ckpt-`) && f.endsWith('.yaml')
      );
      await Promise.all(
        sessionFiles.map((f) =>
          fs.promises.unlink(path.join(checkpointDir, f)).catch(() => {
            // Best-effort cleanup
          })
        )
      );
    } catch {
      // Directory may not exist — that's fine
    }
  }

  /**
   * Keep only the most recent N checkpoints for a session.
   * @param sessionId
   * @param scratchpadDir
   */
  private async pruneCheckpoints(sessionId: string, scratchpadDir: string): Promise<void> {
    const checkpointDir = this.getCheckpointDir(scratchpadDir);

    try {
      const files = await fs.promises.readdir(checkpointDir);
      const sessionFiles = files
        .filter((f) => f.startsWith(`${sessionId}-ckpt-`) && f.endsWith('.yaml'))
        .sort()
        .reverse();

      const toDelete = sessionFiles.slice(this.config.maxCheckpoints);
      await Promise.all(
        toDelete.map((f) =>
          fs.promises.unlink(path.join(checkpointDir, f)).catch(() => {
            // Best-effort
          })
        )
      );
    } catch {
      // Directory may not exist yet
    }
  }

  /**
   * Get the checkpoint directory path.
   * @param scratchpadDir
   */
  private getCheckpointDir(scratchpadDir: string): string {
    return path.join(scratchpadDir, 'pipeline', 'checkpoints');
  }
}

/**
 * Auto-migrate a raw checkpoint payload to the current schema version.
 *
 * v1 → v2: rewrites `version` to 2 and leaves `sdkSessionId` undefined.
 * v2 → v2: returned as-is.
 *
 * Unknown / future versions are rejected (returns `null`) so callers can
 * fall back to a clean restart.
 *
 * The on-disk file is left untouched — migrations happen in memory and
 * the next `saveCheckpoint` call will persist a v2 record.
 *
 * @param raw - YAML-decoded checkpoint payload (already validated to be a
 *   non-null object whose `sessionId` matches the caller's request).
 * @param sourceFile - Filename for diagnostic logging.
 */
function migrateCheckpoint(
  raw: Record<string, unknown>,
  sourceFile: string
): PipelineCheckpoint | null {
  const rawVersion = raw['version'];

  // v1 (or missing version): augment to v2 with sdkSessionId undefined.
  if (rawVersion === undefined || rawVersion === 1) {
    logger.debug('Migrated v1 checkpoint to v2', {
      agent: 'PipelineCheckpointManager',
      file: sourceFile,
    });
    const migrated = {
      ...raw,
      version: CURRENT_CHECKPOINT_VERSION,
    };
    delete (migrated as Record<string, unknown>)['sdkSessionId'];
    return migrated as unknown as PipelineCheckpoint;
  }

  // v2 (current): pass through.
  if (rawVersion === 2) {
    return raw as unknown as PipelineCheckpoint;
  }

  // Unknown / future schema — refuse to load so the orchestrator can
  // fall back to a clean session rather than misinterpret the payload.
  logger.warn('Unsupported checkpoint schema version', {
    agent: 'PipelineCheckpointManager',
    file: sourceFile,
    version: rawVersion,
  });
  return null;
}
