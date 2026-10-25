/**
 * Delivery metrics through the CLI (#956): `ad-sdlc run` exports records only
 * with telemetry consent, and `ad-sdlc telemetry report` reads them back. An
 * offline execution adapter writes each agent's files; the consent lookup is
 * injected so the machine's own consent never matters. No SDK call is made.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dump } from 'js-yaml';
import { Command } from 'commander';

import { configureRunCommand, executeRunCommand } from '../../src/cli/runCommand.js';
import {
  METRICS_REPORT_FORMATS,
  configureMetricsReportCommand,
  executeMetricsReportCommand,
} from '../../src/cli/metricsReportCommand.js';
import { CompletionGenerator } from '../../src/completion/CompletionGenerator.js';
import type {
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../src/execution/types.js';
import type { DeliveryMetricsConsent } from '../../src/telemetry/deliveryMetricsExport.js';

const S = '.ad-sdlc/scratchpad';
const OUTPUTS: Record<string, Record<string, string>> = {
  'issue-reader': {
    [`${S}/issues/demo/issue_list.json`]: JSON.stringify({
      issues: [
        { id: 'ISS-001', title: 'Add login', body: '## Acceptance Criteria\n- [ ] Signs in' },
      ],
    }),
  },
  controller: {
    [`${S}/progress/demo/work_orders/WO-001.yaml`]:
      'work_order:\n  id: WO-001\n  status: assigned\n  issue:\n    id: ISS-001\n',
  },
};

/** Writes each agent's files and reports SDK-style execution metrics. */
class MetricsFileAdapter implements ExecutionAdapter {
  async execute(request: StageExecutionRequest): Promise<StageExecutionResult> {
    const files = OUTPUTS[request.agentType] ?? {};
    for (const [path, content] of Object.entries(files)) {
      await mkdir(join(request.projectDir, dirname(path)), { recursive: true });
      await writeFile(join(request.projectDir, path), content);
    }
    return {
      status: 'success',
      artifacts: Object.keys(files).map((path) => ({ path })),
      sessionId: `offline-${request.agentType}`,
      toolCallCount: 2,
      tokenUsage: { input: 120, output: 30, cache: 0 },
      metrics: {
        usage: {
          inputTokens: 120,
          outputTokens: 30,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: null,
          source: 'result',
        },
        turnCount: 2,
        toolUseCount: 3,
        toolUses: { Read: 2, Write: 1 },
        modelId: 'claude-sonnet-4-5',
        models: ['claude-sonnet-4-5'],
        sdkVersion: '0.3.301',
        claudeCodeVersion: '2.1.0',
      },
    };
  }
  async dispose(): Promise<void> {}
}

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'cli-delivery-metrics-'));
  await mkdir(join(project, '.ad-sdlc/config'), { recursive: true });
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({ version: '1.0.0', pipeline: { default_mode: 'import' } })
  );
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

const granted: DeliveryMetricsConsent = { status: 'granted', export: true };

async function run(
  args: string[],
  consent: DeliveryMetricsConsent
): Promise<{ status: number; stdout: string[]; json: any }> {
  const stdout: string[] = [];
  const options = configureRunCommand(new Command())
    .exitOverride()
    .parse(
      [
        'offline',
        '--project-dir',
        project,
        '--max-attempts',
        '1',
        '--stop-after',
        'orchestration',
        '--allow-stub',
        ...args,
      ],
      { from: 'user' }
    )
    .opts();
  const status = await executeRunCommand('offline', options, {
    env: {},
    createAdapter: () => new MetricsFileAdapter(),
    hasExecutionEnvironment: () => false,
    deliveryMetricsConsent: () => consent,
    output: { info: (m) => stdout.push(m), warn: () => {}, error: (m) => stdout.push(m) },
  });
  let json: unknown;
  try {
    json = JSON.parse(stdout.join('\n'));
  } catch {
    json = undefined;
  }
  return { status, stdout, json };
}

async function report(
  args: string[],
  files: string[] = []
): Promise<{ status: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const command = configureMetricsReportCommand(new Command()).exitOverride();
  command.parse([...files, ...args], { from: 'user' });
  const status = await executeMetricsReportCommand(
    command.args,
    command.opts(),
    { info: (m) => stdout.push(m), error: (m) => stderr.push(m) },
    new Date('2026-10-26T12:00:00.000Z')
  );
  return { status, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

const exportsOf = async (): Promise<string[]> => {
  try {
    return await readdir(join(project, S, 'metrics'));
  } catch {
    return [];
  }
};

describe('ad-sdlc run delivery metrics export', () => {
  it('exports records with granted consent and summarizes them', async () => {
    const { status, json } = await run(['--format', 'json'], granted);
    expect(status).toBe(0);
    const id = json.pipelineId as string;
    expect(json.metrics.export).toEqual({
      enabled: true,
      location: `${S}/metrics/${id}.jsonl`,
      written: json.metrics.records.length,
      failed: 0,
      consent: 'granted',
    });
    expect(await exportsOf()).toEqual([`${id}.jsonl`]);
    const pipeline = json.metrics.records.find(
      (record: { kind: string }) => record.kind === 'pipeline'
    );
    expect(pipeline).toMatchObject({
      status: 'completed',
      attempts: { total: 2 },
      usage: { inputTokens: 240, outputTokens: 60, cacheCreationInputTokens: null },
      toolUseCount: 6,
      turnCount: 4,
    });

    const text = await run([], granted);
    expect(text.stdout).toContain(
      'Usage: 2 attempts (2 succeeded, 0 failed, 0 timed out, 0 cancelled, 0 retries); tokens (result): input 240, output 60, cache read 0, cache creation unknown; tool uses 6; turns 4'
    );
    expect(
      text.stdout.some((line) =>
        /^Metrics: \d+ records appended to \.ad-sdlc\/scratchpad\/metrics\/.+\.jsonl$/u.test(line)
      )
    ).toBe(true);
  });

  it.each([
    ['pending', { status: 'pending', export: false }],
    ['denied', { status: 'denied', export: false }],
    ['outdated', { status: 'outdated', export: false }],
  ] as const)('writes nothing when consent is %s', async (status, consent) => {
    const result = await run([], consent);
    expect(result.status).toBe(0);
    expect(await exportsOf()).toEqual([]);
    expect(result.stdout).toContain(
      `Metrics: not exported (telemetry consent ${status}; 'ad-sdlc telemetry enable --yes' exports them)`
    );
  });
});

describe('ad-sdlc telemetry report', () => {
  it('reports the project exports and filters one session', async () => {
    const first = await run(['--format', 'json'], granted);
    await run([], granted);
    const text = await report(['--project-dir', project]);
    expect(text.status).toBe(0);
    expect(text.stdout).toContain('# Delivery metrics report');
    expect(text.stdout).toContain('Scope: 2 sessions, 2 runs');
    expect(text.stdout).toContain(
      '| Completed runs | 100.0% | 2 | 2 runs with a pipeline record | 2 | 0 | observed |'
    );
    expect(text.stdout).toContain('supplied review data: none (supplied metrics are n/a)');

    const json = await report([
      '--project-dir',
      project,
      '--session',
      first.json.pipelineId,
      '--format',
      'json',
    ]);
    expect(json.status).toBe(0);
    const parsed = JSON.parse(json.stdout);
    expect(parsed).toMatchObject({
      kind: 'delivery_metrics_report',
      scope: { sessions: 1, runs: 1, attempts: 2 },
      inputs: { session: first.json.pipelineId },
    });
  });

  it('reads given files and a supplied review file', async () => {
    const corpus = join(import.meta.dirname, '..', 'telemetry', 'fixtures', 'delivery-metrics');
    const files = ['s1', 's2', 's3', 's4'].map((name) => join(corpus, `${name}.jsonl`));
    const result = await report(
      ['--supplied', join(corpus, 'supplied.json'), '--format', 'json'],
      files
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.scope).toEqual({ sessions: 4, runs: 5, stages: 20, attempts: 14 });
    expect(
      parsed.metrics.find((metric: { id: string }) => metric.id === 'pull_requests.accepted_rate')
    ).toMatchObject({ numerator: 2, sample: 4, missing: 1, source: 'supplied' });
  });

  it('fails clearly without exports, with an invalid supplied file, or an unknown format', async () => {
    const none = await report(['--project-dir', project]);
    expect(none.status).toBe(1);
    expect(none.stderr).toContain("'ad-sdlc telemetry enable --yes'");

    await run([], granted);
    const badSupplied = join(project, 'review.json');
    await writeFile(badSupplied, JSON.stringify({ schemaVersion: 1, kind: 'delivery_review' }));
    const invalid = await report(['--project-dir', project, '--supplied', badSupplied]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Invalid supplied review data');

    expect((await report(['--project-dir', project, '--format', 'yaml'])).status).toBe(1);
    expect((await report(['--project-dir', project, '--session', 'absent'])).status).toBe(1);
    await expect(access(join(project, S, 'metrics'))).resolves.toBeUndefined();
  });

  it('completion offers the report formats', () => {
    const report = new CompletionGenerator()
      .getCommands()
      .find((command) => command.name === 'telemetry')
      ?.subcommands?.find((command) => command.name === 'report');
    expect(report?.options.find((option) => option.long === '--format')?.values).toEqual([
      ...METRICS_REPORT_FORMATS,
    ]);
  });
});
