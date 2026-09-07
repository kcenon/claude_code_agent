import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dump } from 'js-yaml';
import { Command } from 'commander';
import { configureRunCommand, prepareRunCommand } from '../../src/cli/runCommand.js';
import { loadResolvedRuntimeConfig, resolveRuntimeConfig } from '../../src/config/runtime.js';
import { RuntimeConfigError } from '../../src/config/runtimeTypes.js';
import { WorkflowConfigSchema } from '../../src/config/schemas.js';
import { validateAllConfigs } from '../../src/config/loader.js';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../../src/ad-sdlc-orchestrator/types.js';

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'runtime-config-'));
  await mkdir(join(project, '.ad-sdlc/config'), { recursive: true });
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});
async function config(value: object, overlay?: object | string) {
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({ version: '1.0.0', pipeline: {}, ...value })
  );
  if (overlay !== undefined)
    await writeFile(
      join(project, '.ad-sdlc/config/workflow.test.yaml'),
      typeof overlay === 'string' ? overlay : dump(overlay)
    );
}
function options(args: string[] = []) {
  return configureRunCommand(new Command())
    .exitOverride()
    .parse(['offline', '--project-dir', project, ...args], { from: 'user' })
    .opts();
}

describe('production runtime resolution boundary', () => {
  it('preserves absence and the live defaults, including four attempts', async () => {
    await config({});
    expect(options()).not.toHaveProperty('mode');
    expect(options()).not.toHaveProperty('approvalMode');
    expect(options()).not.toHaveProperty('local');
    const parsed = WorkflowConfigSchema.parse({
      version: '1.0.0',
      pipeline: {},
      global: { retry_policy: {}, vnv: {}, timeouts: {} },
    });
    expect(parsed.global).toEqual({ retry_policy: {}, vnv: {}, timeouts: {} });
    const { plan } = await prepareRunCommand('offline', options(), { env: {} });
    expect(plan.config).toMatchObject({
      maxRetries: DEFAULT_ORCHESTRATOR_CONFIG.maxRetries,
      maxParallelAgents: 3,
      mode: 'greenfield',
      approvalMode: 'auto',
    });
    expect(plan.stages).toHaveLength(19);
    expect(plan.stages.every((s) => s.timeoutMs === 300000)).toBe(true);
  });
  it('applies defaults < base < overlay < direct env < explicit CLI', async () => {
    await config(
      {
        pipeline: { default_mode: 'import' },
        global: { approval_mode: 'manual' },
        execution: { max_parallel_stages: 1, local_mode: true },
      },
      { global: { approval_mode: 'critical' }, execution: { max_parallel_stages: 2 } }
    );
    expect((await loadResolvedRuntimeConfig(project, {}, {})).config).toMatchObject({
      mode: 'import',
      approvalMode: 'manual',
      maxParallelAgents: 1,
    });
    const overlay = await loadResolvedRuntimeConfig(project, {}, { NODE_ENV: 'test' });
    expect(overlay.config).toMatchObject({
      mode: 'import',
      approvalMode: 'critical',
      maxParallelAgents: 2,
    });
    expect(overlay.sources['execution.max_parallel_stages']?.source).toContain(
      'workflow.test.yaml'
    );
    const env = {
      AD_SDLC_ENV: 'test',
      NODE_ENV: 'production',
      AD_SDLC_MODE: 'enhancement',
      AD_SDLC_APPROVAL_MODE: 'auto',
      AD_SDLC_MAX_PARALLEL_STAGES: '4',
      AD_SDLC_LOCAL: 'false',
    };
    expect((await loadResolvedRuntimeConfig(project, {}, env)).config).toMatchObject({
      mode: 'enhancement',
      approvalMode: 'auto',
      maxParallelAgents: 4,
      localMode: false,
    });
    const { plan } = await prepareRunCommand(
      'offline',
      options([
        '--mode',
        'greenfield',
        '--approval-mode',
        'manual',
        '--max-parallel-stages',
        '5',
        '--no-local',
      ]),
      { env }
    );
    expect(plan.config).toMatchObject({
      mode: 'greenfield',
      approvalMode: 'manual',
      maxParallelAgents: 5,
      localMode: false,
    });
    expect(plan.sources['pipeline.default_mode']).toEqual({
      source: 'CLI',
      path: 'pipeline.default_mode',
    });
  });
  it('preserves false and zero; aliases mean retries and milliseconds', async () => {
    await config({
      execution: { retry_attempts: 0, retry_delay_ms: 0 },
      global: { vnv: { rigor: 'strict', halt_on_verification_failure: true } },
    });
    const { plan } = await prepareRunCommand(
      'offline',
      options(['--halt-on-verification-failure', 'false']),
      { env: {} }
    );
    expect(plan.config.maxRetries).toBe(0);
    expect(plan.config.retryBackoff.baseDelayMs).toBe(0);
    expect(plan.config.vnv.haltOnVerificationFailure).toBe(false);
    expect(plan.diagnostics.map((d) => d.code)).toEqual(['deprecated', 'deprecated']);
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '1.5', '', '3oops'])(
    'rejects malformed active concurrency environment %j even if CLI overrides it',
    async (value) => {
      await config({});
      await expect(
        prepareRunCommand('offline', options(['--max-parallel-stages', '2']), {
          env: { AD_SDLC_MAX_PARALLEL_STAGES: value },
        })
      ).rejects.toMatchObject({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            source: 'environment:AD_SDLC_MAX_PARALLEL_STAGES',
            path: 'execution.max_parallel_stages',
            severity: 'error',
          }),
        ]),
      });
    }
  );
  it.each(['', 'truthy', '2'])('rejects malformed boolean %j', async (value) => {
    await config({});
    await expect(
      loadResolvedRuntimeConfig(project, {}, { AD_SDLC_LOCAL: value })
    ).rejects.toBeInstanceOf(RuntimeConfigError);
  });
  it.each([
    { execution: { invented: true } },
    { execution: { max_parallel_workers: 2 } },
    { agents: { controller: { scheduling: { max_workers: 2 } } } },
    { pipeline: { stages: [{ name: 'implement', max_parallel: 2, timeout_ms: -5 }] } },
    { pipeline: { modes: { import: { stages: [{ name: 'issue_reading' }] } } } },
    { execution: { stage_timeouts_ms: { invented: 20 } } },
    { quality_gates: { coverage: 80, complexity: 10, requireTests: true, requireReview: true } },
    { quality_gates: { security: { no_hardcoded_secrets: true } } },
    { global: { vnv: { generate_vnv_plan: false } } },
    { global: { approval_mode: 'custom' } },
    { execution: { max_parallel_stages: -1 } },
    { execution: { max_parallel_stages: 1.5 } },
    { execution: { stage_timeout_ms: 0 } },
  ])('rejects unsupported/unknown input before any adapter creation: %j', async (value) => {
    await config(value);
    let created = 0;
    for (const dryRun of [false, true])
      await expect(
        prepareRunCommand(
          'offline',
          { ...options(), dryRun },
          {
            env: {},
            createAdapter: () => {
              created++;
              throw new Error('must not create');
            },
          }
        )
      ).rejects.toBeInstanceOf(RuntimeConfigError);
    expect(created).toBe(0);
  });
  it('distinguishes conflicts within a source from normal overrides across sources', async () => {
    await config({
      execution: { retry_attempts: 2 },
      global: { retry_policy: { max_attempts: 2 } },
    });
    await expect(loadResolvedRuntimeConfig(project, {}, {})).rejects.toMatchObject({
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: 'conflict' })]),
    });
    await config(
      { execution: { retry_attempts: 2 } },
      { global: { retry_policy: { max_attempts: 1 } } }
    );
    expect(
      (await loadResolvedRuntimeConfig(project, {}, { AD_SDLC_ENV: 'test' })).config.maxRetries
    ).toBe(0);
  });
  it('rejects malformed active overlays, including values overwritten by CLI', async () => {
    await config({}, 'execution: [broken');
    await expect(
      loadResolvedRuntimeConfig(project, {}, { NODE_ENV: 'test' })
    ).rejects.toMatchObject({
      diagnostics: [
        expect.objectContaining({ source: join(project, '.ad-sdlc/config/workflow.test.yaml') }),
      ],
    });
    await config({}, { execution: { max_parallel_stages: -3 } });
    await expect(
      loadResolvedRuntimeConfig(project, { maxParallelStages: 2 }, { NODE_ENV: 'test' })
    ).rejects.toBeInstanceOf(RuntimeConfigError);
    expect((await loadResolvedRuntimeConfig(project, {}, {})).config.maxParallelAgents).toBe(3);
  });
  it('resolves timeouts layer by layer, then blanket < phase < stage within each layer', async () => {
    await config(
      {
        execution: {
          stage_timeout_ms: 700,
          stage_timeouts_ms: { prd_update: 8000, orchestration: 9000 },
        },
        global: { timeouts: { document_generation: 2, implementation: 3, orchestration: 4 } },
      },
      { execution: { stage_timeout_ms: 1000 }, global: { timeouts: { implementation: 5 } } }
    );
    const base = await loadResolvedRuntimeConfig(project, {}, {});
    expect(base.config.timeouts.overrides).toMatchObject({
      prd_update: 8000,
      sds_update: 2000,
      sdp_generation: 2000,
      ui_spec_generation: 2000,
      orchestration: 9000,
      implementation: 3000,
      collection: 700,
    });
    const overlay = await loadResolvedRuntimeConfig(project, {}, { NODE_ENV: 'test' });
    expect(overlay.config.timeouts.overrides).toMatchObject({
      prd_update: 1000,
      orchestration: 1000,
      implementation: 5000,
    });
    expect(overlay.sources['execution.stage_timeouts_ms.prd_update']).toEqual({
      source: join(project, '.ad-sdlc/config/workflow.test.yaml'),
      path: 'execution.stage_timeout_ms',
    });
    const cli = await loadResolvedRuntimeConfig(
      project,
      { stageTimeoutMs: '20' },
      { NODE_ENV: 'test' }
    );
    expect(cli.stages.every((s) => s.timeoutMs === 20)).toBe(true);
  });
  it('substitutes supported numeric values from the provided environment', async () => {
    await config({
      execution: { max_parallel_stages: '${STAGES}' },
      extensions: { target: '${PWD}', secret: '${TOKEN}' },
    });
    const plan = await loadResolvedRuntimeConfig(
      project,
      {},
      { STAGES: '2', PWD: '/unrelated', TOKEN: 'credential-sentinel' }
    );
    expect(plan.config.maxParallelAgents).toBe(2);
    expect(JSON.stringify(plan)).not.toContain('credential-sentinel');
    expect(JSON.stringify(plan)).not.toContain('/unrelated');
  });
  it('reports inactive gates and classifies metadata without manufacturing active defaults', async () => {
    await config({
      quality_gates: { coverage: 0, requireTests: false },
      notifications: { enabled: false },
      extensions: { anything: { enabled: true } },
    });
    const plan = await loadResolvedRuntimeConfig(project, {}, {});
    expect(plan.diagnostics).toHaveLength(3);
    expect(plan.diagnostics.every((d) => d.code === 'inactive')).toBe(true);
    expect(
      resolveRuntimeConfig({ layers: [{ source: 'raw', value: { quality_gates: {} } }] })
        .diagnostics
    ).toEqual([]);
  });
  it('exposes runtime support through validation and retains full agent validation', async () => {
    await config({ execution: { max_parallel_workers: 2 } });
    await writeFile(
      join(project, '.ad-sdlc/config/agents.yaml'),
      dump({ version: '1.0.0', agents: { collector: { id: '', name: '' } } })
    );
    const report = await validateAllConfigs(project, { runtime: true });
    expect(report.valid).toBe(false);
    expect(report.runtimeDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'execution.max_parallel_workers', code: 'unsupported' }),
      ])
    );
    expect(report.files.find((file) => file.filePath.endsWith('agents.yaml'))?.errors).toHaveLength(
      2
    );
  });
  it.each([
    { notifications: { enabled: false, invented: true } },
    { quality_gates: { invented: false } },
    { quality_gates: { invented: {} } },
    { global: { retry_policy: { max_attempts: Number.NaN } } },
    { global: { retry_policy: { max_attempts: 1.5 } } },
    { execution: { stage_timeouts_ms: { implementation: -1 } } },
  ])('does not accept unknown inactive-looking keys or malformed limits: %j', (value) => {
    expect(() => resolveRuntimeConfig({ layers: [{ source: 'raw', value }] })).toThrow(
      RuntimeConfigError
    );
  });

  it('retains feature-flag environment precedence as an explicit exception', async () => {
    await config({});
    await writeFile(
      join(project, '.ad-sdlc/config/feature-flags.yaml'),
      dump({ flags: { useSdkForWorker: true } })
    );
    const plan = await loadResolvedRuntimeConfig(
      project,
      { useSdkForWorker: true },
      { AD_SDLC_USE_SDK_FOR_WORKER: 'false' }
    );
    expect(plan.featureFlags.useSdkForWorker).toBe(false);
    expect(plan.sources['featureFlags.useSdkForWorker']?.source).toBe(
      'environment:AD_SDLC_USE_SDK_FOR_WORKER'
    );
  });
});
