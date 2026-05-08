/**
 * PipelineCheckpointManager — schema_version + sdk_session_id tests.
 *
 * Covers the four scenarios required by issue #800:
 *   1. v1 (legacy) checkpoint loads and is auto-migrated to v2.
 *   2. v2 checkpoint round-trips (save -> load -> save -> load) preserving
 *      every field including `sdkSessionId`.
 *   3. Missing `version` field is treated as v1 and migrated.
 *   4. v2 save with `sdkSessionId` absent leaves the field unset on load.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

import { PipelineCheckpointManager } from '../../src/ad-sdlc-orchestrator/PipelineCheckpointManager.js';
import type { PipelineCheckpoint, StageResult } from '../../src/ad-sdlc-orchestrator/types.js';

const SESSION_ID = 'sess-test-800';
const COMPLETED_NAMES = ['mode_detector', 'collector'] as const;

function makeCompletedResults(): readonly StageResult[] {
  return [
    {
      name: 'mode_detector',
      agentType: 'mode-detector',
      status: 'completed',
      durationMs: 12,
      output: '{"mode":"greenfield"}',
      artifacts: [],
      error: null,
      retryCount: 0,
    },
    {
      name: 'collector',
      agentType: 'collector',
      status: 'completed',
      durationMs: 34,
      output: '{}',
      artifacts: [],
      error: null,
      retryCount: 0,
    },
  ];
}

describe('PipelineCheckpointManager — schema_version + sdkSessionId', () => {
  let scratchpadDir: string;
  let manager: PipelineCheckpointManager;

  beforeEach(() => {
    scratchpadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-800-'));
    manager = new PipelineCheckpointManager();
  });

  afterEach(() => {
    fs.rmSync(scratchpadDir, { recursive: true, force: true });
  });

  /**
   * Helper: write a checkpoint file by hand so we can simulate v1 fixtures.
   */
  function writeRawCheckpoint(payload: Record<string, unknown>): void {
    const dir = path.join(scratchpadDir, 'pipeline', 'checkpoints');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${SESSION_ID}-ckpt-${String(Date.now())}.yaml`;
    fs.writeFileSync(path.join(dir, filename), yaml.dump(payload), 'utf-8');
  }

  it('loads a v1 checkpoint and auto-migrates it to v2 with sdkSessionId undefined', async () => {
    writeRawCheckpoint({
      version: 1,
      sessionId: SESSION_ID,
      mode: 'greenfield',
      projectDir: '/tmp/proj',
      userRequest: 'build a thing',
      createdAt: '2025-01-01T00:00:00.000Z',
      completedStageResults: makeCompletedResults(),
      completedStageNames: COMPLETED_NAMES,
    });

    const loaded = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);

    expect(loaded).not.toBeNull();
    const ckpt = loaded as PipelineCheckpoint;
    expect(ckpt.version).toBe(2);
    expect(ckpt.sdkSessionId).toBeUndefined();
    expect(ckpt.sessionId).toBe(SESSION_ID);
    expect(ckpt.completedStageNames).toEqual([...COMPLETED_NAMES]);
  });

  it('loads a checkpoint missing the version field as v1 (defaults to migrated v2)', async () => {
    writeRawCheckpoint({
      // No version field at all — legacy fixture from a hypothetical pre-v1 build.
      sessionId: SESSION_ID,
      mode: 'greenfield',
      projectDir: '/tmp/proj',
      userRequest: 'build a thing',
      createdAt: '2025-01-01T00:00:00.000Z',
      completedStageResults: makeCompletedResults(),
      completedStageNames: COMPLETED_NAMES,
    });

    const loaded = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);

    expect(loaded).not.toBeNull();
    const ckpt = loaded as PipelineCheckpoint;
    expect(ckpt.version).toBe(2);
    expect(ckpt.sdkSessionId).toBeUndefined();
  });

  it('round-trips a v2 checkpoint with sdkSessionId set (save -> load -> save -> load)', async () => {
    const sdkSessionId = 'sdk-sess-abc-123';

    // First save with sdkSessionId.
    await manager.saveCheckpoint(
      SESSION_ID,
      'greenfield',
      '/tmp/proj',
      'build a thing',
      scratchpadDir,
      makeCompletedResults(),
      [...COMPLETED_NAMES],
      sdkSessionId
    );

    const firstLoad = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);
    expect(firstLoad).not.toBeNull();
    expect(firstLoad?.version).toBe(2);
    expect(firstLoad?.sdkSessionId).toBe(sdkSessionId);

    // Second save — different SDK session id (e.g. next stage produced a new one).
    const sdkSessionIdNext = 'sdk-sess-def-456';
    // Wait 1 ms to guarantee the timestamped filename sorts after the first.
    await new Promise<void>((resolve) => setTimeout(resolve, 2));
    await manager.saveCheckpoint(
      SESSION_ID,
      'greenfield',
      '/tmp/proj',
      'build a thing',
      scratchpadDir,
      makeCompletedResults(),
      [...COMPLETED_NAMES],
      sdkSessionIdNext
    );

    const secondLoad = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);
    expect(secondLoad).not.toBeNull();
    expect(secondLoad?.version).toBe(2);
    expect(secondLoad?.sdkSessionId).toBe(sdkSessionIdNext);
    expect(secondLoad?.completedStageNames).toEqual([...COMPLETED_NAMES]);
  });

  it('omits sdkSessionId on save when caller passes undefined', async () => {
    await manager.saveCheckpoint(
      SESSION_ID,
      'greenfield',
      '/tmp/proj',
      'build a thing',
      scratchpadDir,
      makeCompletedResults(),
      [...COMPLETED_NAMES]
      // sdkSessionId omitted -- adapter does not surface a session id (e.g. Bedrock).
    );

    const loaded = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(2);
    expect(loaded?.sdkSessionId).toBeUndefined();
  });

  it('treats empty-string sdkSessionId as absent (graceful fallback for adapters without session ids)', async () => {
    await manager.saveCheckpoint(
      SESSION_ID,
      'greenfield',
      '/tmp/proj',
      'build a thing',
      scratchpadDir,
      makeCompletedResults(),
      [...COMPLETED_NAMES],
      '' // explicit empty string
    );

    const loaded = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.sdkSessionId).toBeUndefined();
  });

  it('rejects unknown future schema versions (returns null so caller can cold-restart)', async () => {
    writeRawCheckpoint({
      version: 99,
      sessionId: SESSION_ID,
      mode: 'greenfield',
      projectDir: '/tmp/proj',
      userRequest: 'build a thing',
      createdAt: '2025-01-01T00:00:00.000Z',
      completedStageResults: makeCompletedResults(),
      completedStageNames: COMPLETED_NAMES,
    });

    const loaded = await manager.loadLatestCheckpoint(SESSION_ID, scratchpadDir);
    expect(loaded).toBeNull();
  });
});
