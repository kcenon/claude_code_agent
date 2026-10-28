/**
 * Live acceptance lane: plumbing smoke (#954).
 *
 * Drives the production path end to end against the real Claude Agent SDK:
 * the `ad-sdlc init` and `ad-sdlc run` CLI commands, the orchestrator, and
 * SdkExecutionAdapter. It runs a single stage (initialization) with one
 * attempt, the lane's turn budget (agent `maxTurns`), and the lane's stage
 * time budget. It is the lane's cheapest plumbing check, not an acceptance
 * scenario; the acceptance scenarios are in import-acceptance.live.test.ts (#955).
 *
 * Selected only by vitest.live.config.ts through `npm run test:live`. When
 * the required settings are absent the test fails instead of skipping, so
 * selecting the live suite can never report a silent pass.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIVE_FILES, notExecutedMessage, resolveLiveSettings } from '../../scripts/live-lane.js';
import {
  LIVE_SMOKE_STAGE,
  liveChildEnv,
  liveRunArguments,
  parseCliJson,
  prepareLiveProject,
  runSourceCli,
  stageEvidence,
} from './harness.js';

const settings = resolveLiveSettings(process.env);
const cliTimeoutMs = settings.budget.stageTimeoutMs + 60_000;

describe('live lane plumbing smoke (#954)', () => {
  it(
    'runs the initialization stage through ad-sdlc run and the real SDK within the lane budget',
    async () => {
      if (!settings.ready) throw new Error(notExecutedMessage(settings));
      const root = await mkdtemp(join(tmpdir(), 'ad-sdlc-live-'));
      try {
        const claudeConfigDir = join(root, 'claude-config');
        await mkdir(claudeConfigDir);
        const env = liveChildEnv(process.env, claudeConfigDir);
        const project = join(root, 'project');
        await prepareLiveProject(project, settings.budget, env);

        const startedAt = Date.now();
        const run = runSourceCli(liveRunArguments(project, settings.budget), env, cliTimeoutMs);
        const durationMs = Date.now() - startedAt;
        const evidence = stageEvidence(parseCliJson(run.stdout), LIVE_SMOKE_STAGE);
        await mkdir(settings.outputDir, { recursive: true });
        await writeFile(
          join(settings.outputDir, LIVE_FILES.evidence),
          `${JSON.stringify({ ...evidence, exitCode: run.status, signal: run.signal, durationMs, budget: settings.budget }, null, 2)}\n`
        );

        // Real SDK execution: the adapter reported an SDK session and token usage.
        expect(evidence.sessionId, run.stderr).toMatch(/^(?!unknown$).+/);
        expect(
          (evidence.tokenUsage?.input ?? 0) + (evidence.tokenUsage?.output ?? 0)
        ).toBeGreaterThan(0);
        expect(evidence.status, evidence.error ?? run.stderr).toBe('completed');
        expect(evidence.via).toBe('execution-adapter');
        expect(run.status, run.stderr).toBe(0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    cliTimeoutMs + 180_000
  );
});
