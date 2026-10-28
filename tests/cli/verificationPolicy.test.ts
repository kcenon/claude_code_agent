/**
 * `ad-sdlc run` verification policy through the production run command:
 * Commander options -> workflow/env/CLI resolution -> orchestrator -> real
 * stage verifier -> exit status and JSON/text output. The execution adapter
 * is injected and writes real files; no paid SDK call is made.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dump } from 'js-yaml';
import { Command } from 'commander';

import {
  configureRunCommand,
  executeRunCommand,
  prepareRunCommand,
} from '../../src/cli/runCommand.js';
import { validateAllConfigs } from '../../src/config/loader.js';
import type {
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../src/execution/types.js';

const ISSUES = '.ad-sdlc/scratchpad/issues/demo/issue_list.json';
const ORDER = '.ad-sdlc/scratchpad/progress/demo/work_orders/WO-001.yaml';

/** Writes each agent's files into the project and reports them as artifacts. */
class FileAdapter implements ExecutionAdapter {
  readonly calls: string[] = [];
  constructor(private readonly files: Record<string, Record<string, string>>) {}
  async execute(request: StageExecutionRequest): Promise<StageExecutionResult> {
    this.calls.push(request.agentType);
    const files = this.files[request.agentType] ?? {};
    for (const [path, content] of Object.entries(files)) {
      await mkdir(join(request.projectDir, dirname(path)), { recursive: true });
      await writeFile(join(request.projectDir, path), content);
    }
    return {
      status: 'success',
      artifacts: Object.keys(files).map((path) => ({ path })),
      sessionId: `offline-${request.agentType}`,
      toolCallCount: 0,
      tokenUsage: { input: 0, output: 0, cache: 0 },
    };
  }
  async dispose(): Promise<void> {}
}

const issueList = (withCriteria: boolean) =>
  JSON.stringify({
    issues: [
      {
        id: 'ISS-001',
        title: 'Add login',
        body: withCriteria ? '## Acceptance Criteria\n- [ ] Signs in' : 'Make login work.',
      },
    ],
  });

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'cli-verification-policy-'));
  await mkdir(join(project, '.ad-sdlc/config'), { recursive: true });
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function workflow(vnv: Record<string, unknown> = {}) {
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({ version: '1.0.0', pipeline: { default_mode: 'import' }, global: { vnv } })
  );
}

function opts(args: string[]) {
  return configureRunCommand(new Command())
    .exitOverride()
    .parse(['offline', '--project-dir', project, ...args], { from: 'user' })
    .opts();
}

async function run(
  args: string[],
  adapter: ExecutionAdapter,
  env: NodeJS.ProcessEnv = {}
): Promise<{ status: 0 | 1; stdout: string[]; stderr: string[] }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await executeRunCommand('offline', opts(args), {
    env,
    createAdapter: () => adapter,
    hasExecutionEnvironment: () => false,
    output: {
      info: (message) => stdout.push(message),
      warn: (message) => stderr.push(message),
      error: (message) => stderr.push(message),
    },
  });
  return { status, stdout, stderr };
}

describe('run verification policy', () => {
  it('fails with exit status 1 and reports the JSON policy fields under delivery', async () => {
    await workflow({ profile: 'delivery' });
    const adapter = new FileAdapter({ 'issue-reader': { [ISSUES]: issueList(false) } });

    const { status, stdout } = await run(['--allow-stub', '--format', 'json'], adapter);

    expect(status).toBe(1);
    expect(adapter.calls).toEqual(['issue-reader']);
    const output = JSON.parse(stdout.join('\n'));
    expect(output).toMatchObject({ ready: false, error: expect.stringContaining('failed') });
    expect(output.runtimeSnapshot.config.vnv).toEqual({
      rigor: 'standard',
      haltOnVerificationFailure: false,
      profile: 'delivery',
      generateRtm: true,
      crossDocumentConsistency: true,
      acceptanceCriteriaValidation: true,
    });
    expect(output.result.overallStatus).toBe('failed');
    expect(output.result.verification).toMatchObject({
      status: 'failed',
      policy: {
        profile: 'delivery',
        rigor: 'standard',
        blocking: true,
        source: {
          kind: 'config',
          path: 'global.vnv.profile',
          origin: join(project, '.ad-sdlc/config/workflow.yaml'),
        },
      },
      counts: { failed: 1, skipped: 4 },
    });
    expect(output.result.stages[0]).toMatchObject({
      name: 'issue_reading',
      status: 'failed',
      verification: {
        state: 'failed',
        checkSet: 'imported-issues',
        checks: expect.arrayContaining([
          expect.objectContaining({ checkId: 'VR-IRD-003', required: true, outcome: 'fail' }),
        ]),
      },
    });
  });

  it('keeps the advisory default: exit status 0, findings retained, not verified', async () => {
    await workflow();
    const adapter = new FileAdapter({ 'issue-reader': { [ISSUES]: issueList(false) } });

    const { status, stdout } = await run(['--allow-stub', '--format', 'json'], adapter);

    expect(status).toBe(0);
    expect(adapter.calls).toHaveLength(5);
    const result = JSON.parse(stdout.join('\n'));
    expect(result.overallStatus).toBe('completed');
    expect(result.verification.policy).toMatchObject({
      profile: 'advisory',
      blocking: false,
      source: { kind: 'default' },
    });
    expect(result.verification.status).toBe('advisory_findings');
    expect(result.stages[0].verification.state).toBe('advisory_findings');
  });

  it('prints the traceability summary with the uncovered identifiers and the RTM', async () => {
    await workflow();
    const adapter = new FileAdapter({ 'issue-reader': { [ISSUES]: issueList(false) } });

    const { status, stdout } = await run(['--allow-stub'], adapter);

    expect(status).toBe(0);
    expect(stdout).toContain(
      'Traceability: uncovered (1 imported issue(s), 0 of 0 acceptance criteria implemented and tested)'
    );
    expect(stdout).toContain('  uncovered: ISS-001');
    expect(
      stdout.some((line) => /^ {2}RTM: \.ad-sdlc\/scratchpad\/traceability\/.+\.md$/.test(line))
    ).toBe(true);
  });

  it('prints a short text summary and fails when the CLI selects delivery', async () => {
    await workflow({ profile: 'advisory' });
    const adapter = new FileAdapter({ 'issue-reader': { [ISSUES]: issueList(false) } });

    const { status, stdout, stderr } = await run(
      ['--allow-stub', '--vnv-profile', 'delivery'],
      adapter
    );

    expect(status).toBe(1);
    expect(
      stdout.some(
        (line) =>
          line.startsWith('  issue_reading: failed (') &&
          line.endsWith(
            'verification failed — Verification failed: [VR-IRD-003] 1 of 1 issue(s) state no acceptance criteria: ISS-001'
          )
      )
    ).toBe(true);
    expect(stdout).toContain('Verification: failed (profile delivery from cli, rigor standard)');
    expect(stdout).toContain(
      '  issue_reading: failed: [VR-IRD-003] 1 of 1 issue(s) state no acceptance criteria: ISS-001'
    );
    expect(stderr.at(-1)).toContain('failed');
  });

  it('selects the profile from the environment and from the legacy strict halt mapping', async () => {
    await workflow({ rigor: 'strict', halt_on_verification_failure: true });
    const legacy = await prepareRunCommand('offline', opts([]), { env: {} });
    expect(legacy.plan.config.vnv.profile).toBe('delivery');
    expect(legacy.plan.sources['global.vnv.profile']).toEqual({
      source: join(project, '.ad-sdlc/config/workflow.yaml'),
      path: 'global.vnv.halt_on_verification_failure',
    });

    await workflow();
    const fromEnv = await prepareRunCommand('offline', opts([]), {
      env: { AD_SDLC_VNV_PROFILE: 'delivery' },
    });
    expect(fromEnv.plan.config.vnv.profile).toBe('delivery');
    expect(fromEnv.plan.sources['global.vnv.profile']?.source).toBe(
      'environment:AD_SDLC_VNV_PROFILE'
    );

    const { status, stdout } = await run(
      ['--allow-stub', '--format', 'json'],
      new FileAdapter({ 'issue-reader': { [ISSUES]: issueList(false) } }),
      { AD_SDLC_VNV_PROFILE: 'delivery' }
    );
    expect(status).toBe(1);
    expect(JSON.parse(stdout.join('\n')).result.verification.policy.source.kind).toBe(
      'environment'
    );
  });

  it('warns when an explicit profile makes the halt flag ineffective', async () => {
    await workflow({ profile: 'advisory', rigor: 'strict', halt_on_verification_failure: true });
    const { plan } = await prepareRunCommand('offline', opts([]), { env: {} });
    expect(plan.config.vnv.profile).toBe('advisory');
    expect(plan.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'conflict',
        path: 'global.vnv.halt_on_verification_failure',
      }),
    ]);
  });

  it('shows the effective profile in dry-run text and JSON', async () => {
    await workflow({ profile: 'delivery' });
    const text = await run(['--dry-run'], new FileAdapter({}));
    expect(text.status).toBe(0);
    expect(text.stdout).toContain(
      `Verification profile: delivery (${join(project, '.ad-sdlc/config/workflow.yaml')}); rigor standard`
    );
    const json = await run(
      ['--dry-run', '--format', 'json', '--vnv-profile', 'advisory'],
      new FileAdapter({})
    );
    const plan = JSON.parse(json.stdout.join('\n'));
    expect(plan.config.vnv.profile).toBe('advisory');
    expect(plan.sources['global.vnv.profile']).toEqual({
      source: 'CLI',
      path: 'global.vnv.profile',
    });
  });

  it('persists the effective policy and stage records, and reuses them on resume', async () => {
    await workflow({ profile: 'delivery' });
    const first = await prepareRunCommand('offline', opts(['--stop-after', 'issue_reading']), {
      env: {},
      createAdapter: () => new FileAdapter({ 'issue-reader': { [ISSUES]: issueList(true) } }),
    });
    const completed = await first.execute();
    expect(completed.verification?.status).toBe('verified');

    // A changed workflow and a conflicting environment override do not change the resumed policy.
    await workflow({ profile: 'advisory' });
    const adapter = new FileAdapter({
      controller: { [ORDER]: 'work_order:\n  id: WO-001\n' },
    });
    const { status, stdout } = await run(
      [
        '--allow-stub',
        '--format',
        'json',
        '--resume',
        completed.pipelineId,
        '--stop-after',
        'orchestration',
      ],
      adapter,
      { AD_SDLC_VNV_PROFILE: 'advisory' }
    );

    expect(adapter.calls).toEqual(['controller']);
    expect(status).toBe(1);
    const output = JSON.parse(stdout.join('\n'));
    expect(output.runtimeSnapshot.config.vnv.profile).toBe('delivery');
    expect(output.result.verification.policy).toMatchObject({
      profile: 'delivery',
      source: { kind: 'resume', origin: join(project, '.ad-sdlc/config/workflow.yaml') },
    });
    // The pre-completed stage keeps the record saved by the first run.
    expect(output.result.verification.stages[0]).toMatchObject({
      stage: 'issue_reading',
      state: 'verified_pass',
    });
    expect(
      output.result.stages.find((s: { name: string }) => s.name === 'orchestration')
    ).toMatchObject({
      status: 'failed',
      verification: { state: 'failed' },
    });

    await expect(
      prepareRunCommand(
        'offline',
        opts(['--resume', completed.pipelineId, '--vnv-profile', 'advisory']),
        { env: {} }
      )
    ).rejects.toThrow('Resume retains');
  });
});

describe('validate accepts the profile setting', () => {
  it('accepts global.vnv.profile and rejects an unknown profile', async () => {
    await workflow({ profile: 'delivery' });
    expect((await validateAllConfigs(project, { runtime: true })).runtimeDiagnostics).toEqual([]);

    await workflow({ profile: 'strict' });
    const report = await validateAllConfigs(project, { runtime: true });
    expect(report.valid).toBe(false);
    expect(report.runtimeDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'global.vnv.profile', code: 'invalid' }),
      ])
    );
  });
});
