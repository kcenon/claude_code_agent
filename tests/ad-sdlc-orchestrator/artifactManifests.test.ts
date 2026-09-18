import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { load as loadYaml, dump } from 'js-yaml';
import { installAgent } from '../execution/fixtures/sdk.js';
import {
  ManifestOrchestrator,
  OUTPUT,
  pipelineSdk,
} from '../execution/fixtures/manifestPipeline.js';
import { PipelineCheckpointManager } from '../../src/ad-sdlc-orchestrator/PipelineCheckpointManager.js';
import { ManifestStore } from '../../src/execution/artifacts/ManifestStore.js';
import type { ManifestReference } from '../../src/execution/artifacts/schemas.js';
import type { SdkQueryOptions } from '../../src/execution/SdkExecutionAdapter.js';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'manifest-pipeline-'));
  await installAgent(root, 'issue-reader');
  await installAgent(root, 'controller');
});
afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

async function producer() {
  const orchestrator = new ManifestOrchestrator(pipelineSdk());
  const session = await orchestrator.startSession({
    projectDir: root,
    userRequest: 'offline',
    overrideMode: 'import',
    stopAfterStage: 'issue_reading',
  });
  const result = await orchestrator.executePipeline(root, 'offline');
  await orchestrator.dispose();
  return { session, result, reference: result.stages[0]!.manifest! };
}

describe('production hook → scratchpad → scheduler → restart → next stage', () => {
  it.each(['session-only', 'checkpoint', 'degraded-session'] as const)(
    'hydrates authoritative upstream manifests after %s resume',
    async (mode) => {
      const first = await producer();
      expect(first.result.stages[0]?.artifacts).toEqual([OUTPUT]);
      expect(first.reference).toBeDefined();
      if (mode === 'degraded-session') {
        const statePath = join(
          first.session.scratchpadDir,
          'pipeline',
          `${first.session.sessionId}.yaml`
        );
        const state = loadYaml(await readFile(statePath, 'utf8')) as {
          stages: { status: string }[];
        };
        state.stages[0]!.status = 'degraded';
        await writeFile(statePath, dump(state));
      }
      if (mode === 'checkpoint')
        await new PipelineCheckpointManager().saveCheckpoint(
          first.session.sessionId,
          'import',
          root,
          'offline',
          first.session.scratchpadDir,
          [first.result.stages[0]!],
          ['issue_reading'],
          'sdk-producer'
        );
      const calls: SdkQueryOptions[] = [];
      const restarted = new ManifestOrchestrator(pipelineSdk((input) => calls.push(input)));
      await restarted.startSession({
        projectDir: root,
        userRequest: 'offline',
        resumeSessionId: first.session.sessionId,
        stopAfterStage: 'orchestration',
      });
      const result = await restarted.executePipeline(root, 'offline');
      expect(result.overallStatus).toBe('completed'); // Preserve the existing explicit-stop status.
      expect(calls.map((call) => call.options?.agent)).toEqual(['controller']);
      expect(calls[0]?.prompt).toContain(first.reference.id);
      expect(calls[0]?.prompt).toContain(OUTPUT);
      expect(calls[0]?.prompt).toContain('## Persisted upstream manifests');
      expect(calls[0]?.options?.resume).toBe(mode === 'checkpoint' ? 'sdk-producer' : undefined);
      expect(result.stages[0]?.manifest).toEqual(first.reference);
      if (mode === 'degraded-session') expect(result.stages[0]?.status).toBe('degraded');
      const store = await ManifestStore.open(root, first.session.scratchpadDir);
      const downstream = await store.load(result.stages[1]!.manifest!);
      expect(downstream.upstream).toEqual([first.reference]);
      expect((await store.load(first.reference)).entries[0]?.path).toBe(OUTPUT);
      await store.close();
      await restarted.dispose();
    }
  );

  it('recovers a publication from a terminated process before checkpoint creation, without rerunning its SDK stage', async () => {
    const fixture = new URL('../execution/fixtures/manifestProducer.ts', import.meta.url);
    await promisify(execFile)(process.execPath, ['--import', 'tsx', fileURLToPath(fixture), root], {
      cwd: process.cwd(),
      timeout: 15000,
    });
    const boundary = JSON.parse(await readFile(join(root, 'crash-boundary.json'), 'utf8')) as {
      sessionId: string;
      output: string;
    };
    const original = JSON.parse(boundary.output) as { manifest: ManifestReference };
    const recovery = new ManifestOrchestrator(
      pipelineSdk(() => {
        throw new Error('Recovery must not launch the producer SDK again');
      })
    );
    const recoveredSession = await recovery.startSession({
      projectDir: root,
      userRequest: 'offline',
      resumeSessionId: boundary.sessionId,
    });
    for (let repetition = 0; repetition < 2; repetition++) {
      const recovered = JSON.parse(await recovery.produceWithoutCheckpoint(recoveredSession)) as {
        manifest: ManifestReference;
      };
      expect(recovered.manifest).toEqual(original.manifest);
    }
    await recovery.dispose();
    const calls: string[] = [];
    const restarted = new ManifestOrchestrator(
      pipelineSdk((input) => {
        calls.push(input.options!.agent!);
        expect(input.options?.agent).toBe('controller');
        expect(input.prompt).toContain(original.manifest.id);
      })
    );
    await restarted.startSession({
      projectDir: root,
      userRequest: 'offline',
      resumeSessionId: boundary.sessionId,
      stopAfterStage: 'orchestration',
    });
    const result = await restarted.executePipeline(root, 'offline');
    expect(calls).toEqual(['controller']);
    expect(result.stages[0]?.manifest).toEqual(original.manifest);
    expect(result.stages[0]?.artifacts).toEqual([OUTPUT]);
    await restarted.dispose();
  });

  it.each(['missing', 'changed', 'wrong-type', 'missing-manifest', 'foreign-reference'] as const)(
    'fails %s recovery before dependent SDK work',
    async (fault) => {
      const first = await producer();
      if (fault === 'missing') await rm(join(root, OUTPUT));
      if (fault === 'changed') await writeFile(join(root, OUTPUT), 'changed externally');
      if (fault === 'wrong-type') {
        await rm(join(root, OUTPUT));
        const { mkdir } = await import('node:fs/promises');
        await mkdir(join(root, OUTPUT));
      }
      if (fault === 'missing-manifest')
        await rm(
          join(
            first.session.scratchpadDir,
            'pipeline/artifacts',
            first.session.sessionId,
            `manifest-${first.reference.id}.json`
          )
        );
      if (fault === 'foreign-reference') {
        const statePath = join(
          first.session.scratchpadDir,
          'pipeline',
          `${first.session.sessionId}.yaml`
        );
        const state = loadYaml(await readFile(statePath, 'utf8')) as {
          stages: { manifest?: ManifestReference }[];
        };
        state.stages[0]!.manifest = { ...first.reference, sessionId: 'foreign' };
        await writeFile(statePath, dump(state));
      }
      const calls: SdkQueryOptions[] = [];
      const restarted = new ManifestOrchestrator(pipelineSdk((input) => calls.push(input)));
      await restarted.startSession({
        projectDir: root,
        userRequest: 'offline',
        resumeSessionId: first.session.sessionId,
        stopAfterStage: 'orchestration',
      });
      await expect(restarted.executePipeline(root, 'offline')).rejects.toThrow();
      expect(calls).toHaveLength(0);
      await restarted.dispose();
    }
  );

  it('fails a fresh stage with missing required output and skips its dependent', async () => {
    const calls: SdkQueryOptions[] = [];
    const orchestrator = new ManifestOrchestrator(pipelineSdk((input) => calls.push(input), true));
    await orchestrator.startSession({
      projectDir: root,
      userRequest: 'offline',
      overrideMode: 'import',
    });
    await expect(orchestrator.executePipeline(root, 'offline')).rejects.toThrow();
    expect(calls.map((call) => call.options?.agent)).toEqual(['issue-reader']);
    expect(orchestrator.getStatus().stages.map((stage) => stage.status)).toEqual([
      'failed',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    await orchestrator.dispose();
  });

  it('uses the explicitly selected root when a project moves and repairs compatibility arrays from the manifest', async () => {
    const first = await producer();
    const statePath = join(
      first.session.scratchpadDir,
      'pipeline',
      `${first.session.sessionId}.yaml`
    );
    const state = loadYaml(await readFile(statePath, 'utf8')) as {
      stages: { artifacts: string[] }[];
    };
    state.stages[0]!.artifacts = ['status'];
    await writeFile(statePath, dump(state));
    const moved = `${root}-moved`;
    await rename(root, moved);
    root = moved;
    const calls: SdkQueryOptions[] = [];
    const restarted = new ManifestOrchestrator(pipelineSdk((input) => calls.push(input)));
    await restarted.startSession({
      projectDir: root,
      userRequest: 'offline',
      resumeSessionId: first.session.sessionId,
      stopAfterStage: 'orchestration',
    });
    const result = await restarted.executePipeline(root, 'offline');
    expect(calls[0]?.options?.cwd).toBe(root);
    expect(result.stages[0]?.artifacts).toEqual([OUTPUT]);
    expect(result.stages[0]?.manifest).toEqual(first.reference);
    await restarted.dispose();
  });
});
