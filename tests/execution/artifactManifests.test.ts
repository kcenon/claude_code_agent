import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import {
  SdkExecutionAdapter,
  type SdkExecutionAdapterOptions,
  type SdkQueryOptions,
} from '../../src/execution/SdkExecutionAdapter.js';
import { ManifestStore } from '../../src/execution/artifacts/ManifestStore.js';
import { ArtifactAttempt } from '../../src/execution/artifacts/ArtifactAttempt.js';
import {
  ArtifactManifestSchema,
  type ArtifactContext,
  type ArtifactDeclaration,
  type ManifestReference,
} from '../../src/execution/artifacts/schemas.js';
import { normalizeArtifactPath } from '../../src/execution/artifacts/paths.js';
import type { StageExecutionRequest, StageExecutionResult } from '../../src/execution/types.js';
import { installAgent, sdkResult, withQueryLifecycle } from './fixtures/sdk.js';
import { deferred } from './fixtures/controlledSdk.js';
import { BackendFactory } from '../../src/scratchpad/backends/BackendFactory.js';
import type { IScratchpadBackend } from '../../src/scratchpad/backends/IScratchpadBackend.js';

let projectDir: string;
beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'artifact-950-'));
  await installAgent(projectDir);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectDir, { recursive: true, force: true });
});

function context(overrides: Partial<ArtifactContext> = {}): ArtifactContext {
  return {
    sessionId: 'pipeline',
    stageName: 'implementation',
    attemptId: 'attempt-1',
    scratchpadDir: join(projectDir, '.ad-sdlc', 'scratchpad'),
    requiredOutputs: [],
    upstream: [],
    ...overrides,
  };
}
function request(overrides: Partial<StageExecutionRequest> = {}): StageExecutionRequest {
  return {
    projectDir,
    agentType: 'worker',
    priorOutputs: {},
    workOrder: 'offline artifacts',
    artifactContext: context(),
    ...overrides,
  };
}
function adapter(
  query: (input: SdkQueryOptions) => AsyncGenerator<SDKMessage, void>,
  options: SdkExecutionAdapterOptions = {}
): SdkExecutionAdapter {
  return new SdkExecutionAdapter({ loader: async () => withQueryLifecycle({ query }), ...options });
}
function output(artifacts: ArtifactDeclaration[]) {
  return { schemaVersion: 1, artifacts };
}

async function file(location: string, content = 'content', root = projectDir): Promise<void> {
  const target = join(root, location.replace(/\\/g, '/'));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
async function capture(
  options: Options | undefined,
  location: string,
  id = 'tool-1',
  tool = 'Write'
): Promise<void> {
  if (options?.cwd === undefined) throw new Error('No SDK cwd');
  for (const entry of options.hooks?.PostToolUse ?? []) {
    if (entry.matcher !== undefined && !new RegExp(entry.matcher).test(tool)) continue;
    for (const callback of entry.hooks)
      await callback(
        {
          hook_event_name: 'PostToolUse',
          tool_name: tool,
          tool_input: { file_path: location },
          tool_response: {},
          tool_use_id: id,
          session_id: `sdk-${options.cwd}`,
          transcript_path: join(options.cwd, 'transcript'),
          cwd: options.cwd,
        },
        id,
        { signal: options.abortController?.signal ?? new AbortController().signal }
      );
  }
}
async function load(result: StageExecutionResult, ctx = context(), root = projectDir) {
  expect(result.manifest, result.error?.message).toBeDefined();
  const store = await ManifestStore.open(root, ctx.scratchpadDir);
  try {
    return await store.load(result.manifest!);
  } finally {
    await store.close();
  }
}

describe('durable SDK artifact manifests', () => {
  it('persists official hook events before acknowledgement, normalizes paths and deduplicates replays', async () => {
    const paths = ['docs/design notes.md', 'docs/설계.md', 'src\\nested\\file.ts'];
    const sdk = adapter(async function* ({ options }) {
      expect(options?.outputFormat?.type).toBe('json_schema');
      for (const [index, location] of paths.entries()) {
        await file(location);
        await capture(options, location, `tool-${index}`);
        await capture(options, location.replace(/\\/g, '/'), `tool-${index}`);
      }
      const fresh = await ManifestStore.open(projectDir, context().scratchpadDir);
      expect(await fresh.captures('pipeline', 'implementation')).toHaveLength(3);
      await fresh.close();
      yield sdkResult({ result: 'status: success' });
    });
    const result = await sdk.execute(request());
    expect(result.status).toBe('success');
    const manifest = await load(result);
    expect(manifest.entries.map((entry) => entry.path).sort()).toEqual(
      paths.map((p) => p.replace(/\\/g, '/')).sort()
    );
    expect(
      manifest.entries.every(
        (entry) => entry.provenance.length === 1 && entry.checksum?.length === 64
      )
    ).toBe(true);
    expect(manifest.entries.some((entry) => entry.path === 'status')).toBe(false);
    await sdk.dispose();
  });

  it('reconciles declarations for Bash/MCP files, directories, deletions and permitted external references', async () => {
    const external = await mkdtemp(join(tmpdir(), 'artifact-external-'));
    const externalFile = join(external, 'reference.txt');
    const uri = 'https://example.com/issues/950';
    try {
      await writeFile(externalFile, 'external');
      const ctx = context({ externalReferences: [externalFile, uri] });
      const sdk = adapter(async function* ({ options }) {
        await file('captured.txt');
        await capture(options, 'captured.txt');
        await file('bash output.txt');
        await mkdir(join(projectDir, 'reports'));
        await file('removed.txt');
        await rm(join(projectDir, 'removed.txt'));
        yield sdkResult({
          structured_output: output([
            {
              path: 'bash output.txt',
              kind: 'file',
              operation: 'written',
              description: 'Bash output',
            },
            { path: 'reports', kind: 'directory', operation: 'created' },
            { path: 'removed.txt', kind: 'file', operation: 'deleted' },
            { path: externalFile, kind: 'external-file', operation: 'reused' },
            { path: uri, kind: 'external-uri', operation: 'reused' },
          ]),
        });
      });
      const result = await sdk.execute(request({ artifactContext: ctx }));
      const manifest = await load(result, ctx);
      expect(manifest.entries).toHaveLength(6);
      expect(manifest.entries.find((entry) => entry.path === 'removed.txt')).toMatchObject({
        operation: 'deleted',
        availability: 'absent',
      });
      expect(manifest.entries.find((entry) => entry.path === uri)?.availability).toBe(
        'external-unverified'
      );
      expect(result.artifacts.map((entry) => entry.path).sort()).toEqual([
        'bash output.txt',
        'captured.txt',
        'reports',
      ]);
      await sdk.dispose();
    } finally {
      await rm(external, { recursive: true, force: true });
    }
  });

  it.each([
    ['omitted', undefined],
    ['missing', output([{ path: 'required.txt', kind: 'file', operation: 'written' }])],
    ['deletion', output([{ path: 'required.txt', kind: 'file', operation: 'deleted' }])],
    ['wrong-kind', output([{ path: 'required.txt', kind: 'directory', operation: 'created' }])],
    [
      'self-disabled',
      {
        schemaVersion: 1,
        artifacts: [{ path: 'required.txt', kind: 'file', operation: 'written', required: false }],
      },
    ],
  ])('fails a trusted required-output contract for %s', async (variant, declaration) => {
    if (variant === 'wrong-kind') await mkdir(join(projectDir, 'required.txt'));
    const sdk = adapter(async function* () {
      yield sdkResult({ structured_output: declaration });
    });
    const result = await sdk.execute(
      request({
        artifactContext: context({ requiredOutputs: [{ pattern: 'required.txt', kind: 'file' }] }),
      })
    );
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('EXEC-003');
    expect(result.error?.category).toBe('fatal');
    expect((await load(result)).status).toBe('failed');
    await sdk.dispose();
  });

  it('rejects stale undeclared outputs and accepts explicitly inherited reuse', async () => {
    await file('required.txt');
    const requiredOutputs = [{ pattern: 'required.txt', kind: 'file' as const }];
    const sdk = adapter(async function* () {
      yield sdkResult();
    });
    expect(
      (await sdk.execute(request({ artifactContext: context({ requiredOutputs }) }))).status
    ).toBe('failed');
    await sdk.dispose();
    const producer = adapter(async function* ({ options }) {
      await capture(options, 'required.txt');
      yield sdkResult();
    });
    const first = await producer.execute(
      request({ artifactContext: context({ requiredOutputs, attemptId: 'attempt-2' }) })
    );
    const consumer = adapter(async function* () {
      yield sdkResult({
        structured_output: output([{ path: 'required.txt', kind: 'file', operation: 'reused' }]),
      });
    });
    const second = await consumer.execute(
      request({ artifactContext: context({ stageName: 'review', upstream: [first.manifest!] }) })
    );
    expect(second.status).toBe('success');
    expect((await load(second)).upstream).toEqual([first.manifest]);
    await producer.dispose();
    await consumer.dispose();
  });

  it.each([
    { schemaVersion: 2, artifacts: [] },
    { status: 'success' },
    { schemaVersion: 1, artifacts: [{ path: 'x', kind: 'invented', operation: 'written' }] },
    output([
      { path: 'x', kind: 'file', operation: 'written' },
      { path: './x', kind: 'file', operation: 'deleted' },
    ]),
  ])(
    'fails malformed or conflicting structured output instead of falling back to text',
    async (structured_output) => {
      const sdk = adapter(async function* () {
        yield sdkResult({ structured_output, result: 'src/good.ts: produced' });
      });
      const result = await sdk.execute(request());
      expect(result.status).toBe('failed');
      expect(result.artifacts).toEqual([]);
      await sdk.dispose();
    }
  );

  it('refuses to promote a failed upstream attempt through a standalone reuse declaration', async () => {
    const producer = adapter(async function* ({ options }) {
      await file('partial.txt');
      await capture(options, 'partial.txt');
      throw new Error('producer interrupted');
    });
    const partial = await producer.execute(request());
    expect(partial.status).toBe('failed');
    expect((await load(partial)).entries[0]?.availability).toBe('present');
    await producer.dispose();
    const consumer = adapter(async function* () {
      yield sdkResult({
        structured_output: output([{ path: 'partial.txt', kind: 'file', operation: 'reused' }]),
      });
    });
    const result = await consumer.execute(
      request({
        artifactContext: context({ stageName: 'consumer', upstream: [partial.manifest!] }),
      })
    );
    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('Upstream manifest is not complete');
    expect(result.artifacts).toEqual([]);
    await consumer.dispose();
  });

  it('does not accept status prose, including in explicit legacy compatibility mode', async () => {
    await file('docs/legacy notes.md');
    const sdk = adapter(
      async function* () {
        yield sdkResult({
          result:
            'status: success\ndocs/legacy notes.md: file\ndocs/legacy notes.md: duplicate\n../escape.txt: invalid',
        });
      },
      { legacyTextArtifacts: true }
    );
    const result = await sdk.execute({
      projectDir,
      agentType: 'worker',
      priorOutputs: {},
      workOrder: 'legacy',
    });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.path).toBe('docs/legacy notes.md');
    await sdk.dispose();
  });

  it.each([
    '../escape.txt',
    '..\\escape.txt',
    'C:\\outside\\x.txt',
    '\\\\server\\share\\x.txt',
    'https://example.com/x',
  ])('rejects escaped or foreign local paths: %s', async (location) => {
    const sdk = adapter(async function* () {
      yield sdkResult({
        structured_output: output([{ path: location, kind: 'file', operation: 'written' }]),
      });
    });
    expect((await sdk.execute(request())).status).toBe('failed');
    await sdk.dispose();
  });

  it('accepts in-project absolute paths and checks symlink parents even for absent deletion targets', async () => {
    await file('existing.txt');
    expect(normalizeArtifactPath(projectDir, join(projectDir, 'existing.txt'))).toBe(
      'existing.txt'
    );
    const outside = await mkdtemp(join(tmpdir(), 'artifact-outside-'));
    try {
      await symlink(
        outside,
        join(projectDir, 'escape'),
        process.platform === 'win32' ? 'junction' : 'dir'
      );
      const sdk = adapter(async function* () {
        yield sdkResult({
          structured_output: output([
            { path: 'escape/absent.txt', kind: 'file', operation: 'deleted' },
          ]),
        });
      });
      const result = await sdk.execute(request());
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('symlink escapes');
      await sdk.dispose();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects unapproved external references and checksum/type contradictions', async () => {
    await file('exists.txt');
    for (const declaration of [
      { path: 'https://example.com/x', kind: 'external-uri', operation: 'reused' },
      { path: 'exists.txt', kind: 'file', operation: 'written', checksum: '0'.repeat(64) },
      { path: 'exists.txt', kind: 'directory', operation: 'written' },
    ] satisfies ArtifactDeclaration[]) {
      const sdk = adapter(async function* () {
        yield sdkResult({ structured_output: output([declaration]) });
      });
      expect((await sdk.execute(request())).status).toBe('failed');
      await sdk.dispose();
    }
  });

  it('retains interrupted captures across fresh instances and preserves later edits without duplicate logical entries', async () => {
    await file('resumed.txt', 'first');
    const store = await ManifestStore.open(projectDir, context().scratchpadDir);
    const attempt = new ArtifactAttempt(store, context(), 'worker', new AbortController().signal);
    await attempt.recordArtifact({
      filePath: 'resumed.txt',
      toolName: 'Write',
      toolUseId: 'original',
      capturedAt: new Date().toISOString(),
      sessionId: 'old-sdk',
    });
    await store.close(); // interrupted before a final result or manifest
    const sdk = adapter(async function* ({ options }) {
      await file('resumed.txt', 'second');
      await capture(options, './resumed.txt', 'second');
      yield sdkResult();
    });
    const result = await sdk.execute(
      request({ artifactContext: context({ attemptId: 'attempt-2' }) })
    );
    const manifest = await load(result);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]?.provenance.map((source) => source.attemptId).sort()).toEqual([
      'attempt-1',
      'attempt-2',
    ]);
    expect(manifest.entries[0]?.provenance.map((source) => source.sdkSessionId)).toContain(
      'old-sdk'
    );
    expect(manifest.status).toBe('complete');
    await sdk.dispose();
  });

  it('keeps concurrent stages and projects isolated with one adapter', async () => {
    const other = await mkdtemp(join(tmpdir(), 'artifact-project-b-'));
    await installAgent(other);
    try {
      const sdk = adapter(async function* ({ options, prompt }) {
        const location = String(prompt).includes('stage-two') ? 'two.txt' : 'one.txt';
        await file(location, 'owned', options?.cwd);
        await capture(options, location);
        yield sdkResult();
      });
      const requests = [
        request(),
        request({
          workOrder: 'stage-two',
          artifactContext: context({ stageName: 'review', attemptId: 'parallel' }),
        }),
        request({
          projectDir: other,
          artifactContext: context({
            sessionId: 'other-pipeline',
            scratchpadDir: join(other, '.ad-sdlc/scratchpad'),
          }),
        }),
      ];
      const results = await Promise.all(requests.map((req) => sdk.execute(req)));
      for (let i = 0; i < results.length; i++) {
        const req = requests[i]!;
        const manifest = await load(results[i]!, req.artifactContext, req.projectDir);
        expect(manifest.sessionId).toBe(req.artifactContext?.sessionId);
        expect(manifest.stageName).toBe(req.artifactContext?.stageName);
        expect(manifest.entries).toHaveLength(1);
      }
      await sdk.dispose();
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it('fails if the SDK swallows a durable capture rejection and reports success', async () => {
    const sdk = adapter(
      async function* ({ options }) {
        await file('written.txt');
        try {
          await capture(options, 'written.txt');
        } catch {
          /* SDK reports this as a tool error. */
        }
        yield sdkResult();
      },
      {
        openManifestStore: async (...args) => {
          const store = await ManifestStore.open(...args);
          vi.spyOn(store, 'recordCapture').mockRejectedValue(new Error('disk unavailable'));
          return store;
        },
      }
    );
    const result = await sdk.execute(request());
    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('disk unavailable');
    expect((await load(result)).status).toBe('failed');
    await sdk.dispose();
  });

  it('waits for a delayed capture write before reporting stage completion', async () => {
    const writing = deferred<void>();
    const release = deferred<void>();
    let settled = false;
    const sdk = adapter(
      async function* ({ options }) {
        await file('slow.txt');
        await capture(options, 'slow.txt');
        yield sdkResult();
      },
      {
        openManifestStore: async (...args) => {
          const store = await ManifestStore.open(...args);
          const original = store.recordCapture.bind(store);
          vi.spyOn(store, 'recordCapture').mockImplementation(async (record) => {
            writing.resolve();
            await release.promise;
            await original(record);
          });
          return store;
        },
      }
    );
    const running = sdk.execute(request()).then((result) => {
      settled = true;
      return result;
    });
    await writing.promise;
    expect(settled).toBe(false);
    release.resolve();
    expect((await running).status).toBe('success');
    await sdk.dispose();
  });

  it('detects corrupt, missing and cross-session manifest references', async () => {
    const sdk = adapter(async function* () {
      yield sdkResult();
    });
    const result = await sdk.execute(request());
    const ref = result.manifest!;
    const store = await ManifestStore.open(projectDir, context().scratchpadDir);
    const target = join(
      store.basePath,
      'pipeline/artifacts',
      ref.sessionId,
      `manifest-${ref.id}.json`
    );
    const original = await readFile(target, 'utf8');
    const raw = JSON.parse(original) as Record<string, unknown>;
    await writeFile(target, JSON.stringify({ ...raw, stageName: 'review' }));
    await expect(store.load(ref)).rejects.toThrow('ownership');
    await writeFile(target, JSON.stringify({ ...raw, schemaVersion: 99 }));
    await expect(store.load(ref)).rejects.toThrow('Invalid');
    expect(ArtifactManifestSchema.safeParse({ ...raw, attemptId: '' }).success).toBe(false);
    await rm(target);
    await expect(store.load(ref)).rejects.toThrow('Missing manifest');
    await expect(
      store.load({ ...ref, sessionId: '../other' } as ManifestReference)
    ).rejects.toThrow('Invalid');
    await store.close();
    await sdk.dispose();
  });

  it('preserves immutable published metadata when a later attempt edits the same artifact', async () => {
    let revision = 0;
    const sdk = adapter(async function* ({ options }) {
      await file('versioned.txt', String(++revision));
      await capture(options, 'versioned.txt', `write-${revision}`);
      yield sdkResult();
    });
    const first = await sdk.execute(request());
    const original = await load(first);
    const entry = original.entries[0]!;
    for (const contradictory of [
      { ...entry, availability: 'external-unverified' },
      { ...entry, availability: 'absent' },
      { ...entry, required: true },
      { ...entry, provenance: [...entry.provenance, ...entry.provenance] },
    ]) {
      expect(
        ArtifactManifestSchema.safeParse({ ...original, entries: [contradictory] }).success
      ).toBe(false);
    }
    const second = await sdk.execute(
      request({ artifactContext: context({ attemptId: 'attempt-2' }) })
    );
    const changed = await load(second);
    expect(await load(first)).toEqual(original);
    expect(changed.entries).toHaveLength(1);
    expect(changed.entries[0]?.id).toBe(original.entries[0]?.id);
    expect(changed.entries[0]?.checksum).not.toBe(original.entries[0]?.checksum);
    expect(changed.entries[0]?.provenance).toHaveLength(2);
    expect(second.manifest?.id).not.toBe(first.manifest?.id);
    await sdk.dispose();
  });

  it('joins a capture on cancellation and refuses late hook writes after disposal', async () => {
    const writing = deferred<void>();
    const release = deferred<void>();
    const controller = new AbortController();
    let options: Options | undefined;
    const sdk = adapter(
      async function* (input) {
        options = input.options;
        await file('cancelled.txt');
        await capture(options, 'cancelled.txt');
        yield sdkResult();
      },
      {
        openManifestStore: async (...args) => {
          const store = await ManifestStore.open(...args);
          const original = store.recordCapture.bind(store);
          vi.spyOn(store, 'recordCapture').mockImplementation(async (record) => {
            writing.resolve();
            await release.promise;
            await original(record);
          });
          return store;
        },
      }
    );
    const running = sdk.execute(request({ signal: controller.signal }));
    await writing.promise;
    controller.abort(new Error('cancelled by test'));
    release.resolve();
    const result = await running;
    expect(result.status).toBe('aborted');
    const manifest = await load(result);
    expect(manifest.status).toBe('aborted');
    expect(manifest.entries[0]?.path).toBe('cancelled.txt');
    await sdk.dispose();
    await expect(capture(options, 'cancelled.txt', 'late')).rejects.toThrow('shutdown');
    const fresh = await ManifestStore.open(projectDir, context().scratchpadDir);
    expect(await fresh.captures('pipeline', 'implementation')).toHaveLength(1);
    await fresh.close();
  });

  it('does not recover a success whose asynchronous publication overlapped cancellation', async () => {
    const publishing = deferred<void>();
    const release = deferred<void>();
    const controller = new AbortController();
    const sdk = adapter(
      async function* () {
        yield sdkResult();
      },
      {
        openManifestStore: async (...args) => {
          const store = await ManifestStore.open(...args);
          const original = store.publish.bind(store);
          vi.spyOn(store, 'publish').mockImplementation(async (manifest) => {
            if (manifest.status === 'complete') {
              publishing.resolve();
              await release.promise;
            }
            return original(manifest);
          });
          return store;
        },
      }
    );
    const running = sdk.execute(request({ signal: controller.signal }));
    await publishing.promise;
    controller.abort();
    release.resolve();
    expect((await running).status).toBe('aborted');
    const fresh = await ManifestStore.open(projectDir, context().scratchpadDir);
    expect(await fresh.findCompleted('pipeline', 'implementation', [])).toBeUndefined();
    await fresh.close();
    await sdk.dispose();
  });

  it('blocks replacement work after a publication timeout and drains the late write as aborted', async () => {
    const publishing = deferred<void>();
    const release = deferred<void>();
    const closed = deferred<void>();
    const sdk = adapter(
      async function* () {
        yield sdkResult();
      },
      {
        cleanupGraceMs: 100,
        openManifestStore: async (...args) => {
          const store = await ManifestStore.open(...args);
          const publish = store.publish.bind(store);
          const close = store.close.bind(store);
          vi.spyOn(store, 'publish').mockImplementation(async (manifest) => {
            if (manifest.status === 'complete') {
              publishing.resolve();
              await release.promise;
            }
            return publish(manifest);
          });
          vi.spyOn(store, 'close').mockImplementation(async () => {
            await close();
            closed.resolve();
          });
          return store;
        },
      }
    );
    const running = sdk.execute(request());
    await publishing.promise;
    const result = await running;
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('EXEC-004');
    expect(result.artifacts).toEqual([]);
    await expect(sdk.execute(request())).rejects.toThrow('cleanup grace period');
    await expect(sdk.dispose()).rejects.toThrow();
    release.resolve();
    await closed.promise;
    const fresh = await ManifestStore.open(projectDir, context().scratchpadDir);
    expect(await fresh.findCompleted('pipeline', 'implementation', [])).toBeUndefined();
    await fresh.close();
  });

  it('routes durable records through fresh controlled Redis backends without local metadata files', async () => {
    await mkdir(join(projectDir, '.ad-sdlc/config'), { recursive: true });
    await writeFile(
      join(projectDir, '.ad-sdlc/config/workflow.yaml'),
      'scratchpad:\n  backend: redis\n  redis:\n    host: offline.invalid\n    prefix: "manifests:"\n    ttl: 30\n'
    );
    const records = new Map<string, unknown>();
    const handles: { closed: boolean }[] = [];
    vi.spyOn(BackendFactory, 'create').mockImplementation(async (config) => {
      expect(config).toMatchObject({
        backend: 'redis',
        redis: { host: 'offline.invalid', prefix: 'manifests:', ttl: 0 },
      });
      const handle = { closed: false };
      handles.push(handle);
      const keyFor = (section: string, key: string) => `${section}:${key}`;
      const backend: IScratchpadBackend = {
        name: 'redis',
        initialize: async () => {},
        read: async <T>(section: string, key: string): Promise<T | null> =>
          (records.get(keyFor(section, key)) as T | undefined) ?? null,
        write: async (section, key, value) => {
          expect(handle.closed).toBe(false);
          records.set(keyFor(section, key), structuredClone(value));
        },
        delete: async (section, key) => records.delete(keyFor(section, key)),
        exists: async (section, key) => records.has(keyFor(section, key)),
        list: async (section) =>
          [...records.keys()]
            .filter((key) => key.startsWith(`${section}:`))
            .map((key) => key.slice(section.length + 1)),
        batch: async () => {
          throw new Error('Unexpected batch');
        },
        healthCheck: async () => ({ healthy: true }),
        close: async () => {
          handle.closed = true;
        },
      };
      return backend;
    });
    const sdk = adapter(async function* ({ options }) {
      await file('redis output.txt');
      await capture(options, 'redis output.txt');
      yield sdkResult();
    });
    const result = await sdk.execute(request());
    expect(result.status, result.error?.message).toBe('success');
    await sdk.dispose();
    const fresh = await ManifestStore.open(projectDir, context().scratchpadDir);
    expect((await fresh.load(result.manifest!)).entries[0]?.path).toBe('redis output.txt');
    expect(await fresh.findCompleted('pipeline', 'implementation', [])).toEqual(result.manifest);
    await expect(
      readFile(
        join(fresh.basePath, 'pipeline/artifacts/pipeline', `manifest-${result.manifest!.id}.json`)
      )
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await fresh.close();
    expect(handles).toHaveLength(2);
    expect(handles.every((handle) => handle.closed)).toBe(true);
  });

  it.each(['file', 'sqlite'] as const)(
    'survives fresh %s backend instances at a custom storage location',
    async (backend) => {
      await mkdir(join(projectDir, '.ad-sdlc/config'), { recursive: true });
      await writeFile(
        join(projectDir, '.ad-sdlc/config/workflow.yaml'),
        `scratchpad:\n  backend: ${backend}\n  file:\n    base_path: custom records\n  sqlite:\n    db_path: custom records/manifests.db\n`
      );
      const sdk = adapter(async function* ({ options }) {
        await file('durable.txt');
        await capture(options, 'durable.txt');
        yield sdkResult();
      });
      const result = await sdk.execute(request());
      expect(result.status, result.error?.message).toBe('success');
      const store = await ManifestStore.open(projectDir, context().scratchpadDir);
      expect(store.basePath).toBe(join(projectDir, 'custom records'));
      expect((await store.load(result.manifest!)).entries[0]?.path).toBe('durable.txt');
      expect(await store.findCompleted('pipeline', 'implementation', [])).toEqual(result.manifest);
      await store.close();
      await sdk.dispose();
    }
  );
});
