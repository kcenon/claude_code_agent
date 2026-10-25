/**
 * Delivery metrics end to end (#956): a scripted SDK drives the real
 * SdkExecutionAdapter, scheduler, approval gate, and stage verifier through an
 * Import run that pauses at a decision and is resumed. Records are exported to
 * the local JSONL file, the report reads them back, and a privacy scan checks
 * that no credential, prompt, requirement, tool input, approval reason, or
 * path reached a record. inquirer is a test double; no paid SDK call or
 * GitHub resource is used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

const prompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { createPromptModule: () => prompt, prompt } }));

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type { OrchestratorConfig, PipelineResult } from '../../src/ad-sdlc-orchestrator/types.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import type { ExecutionAdapter } from '../../src/execution/types.js';
import type {
  AttemptMetricsRecord,
  PipelineMetricsRecord,
  StageMetricsRecord,
} from '../../src/telemetry/deliveryMetrics.js';
import {
  deliveryMetricsFile,
  jsonlDeliveryMetricsSink,
} from '../../src/telemetry/deliveryMetricsExport.js';
import {
  buildDeliveryMetricsReport,
  readDeliveryMetricsFiles,
} from '../../src/telemetry/deliveryMetricsReport.js';
import { installAgent, withQueryLifecycle } from '../execution/fixtures/sdk.js';
import {
  assistant,
  init,
  success,
  text,
  toolUse,
  usage,
} from '../execution/fixtures/usageStreams.js';

const S = '.ad-sdlc/scratchpad';
const AC = '## Acceptance Criteria\n- [ ] Valid credentials sign in';

// Key-shaped values are assembled at run time so no credential-like literal is in source.
const API_KEY = ['sk', 'ant', 'api03', 'Q'.repeat(88)].join('-');
const GITHUB_TOKEN = `ghp_${'Z'.repeat(36)}`;
const REQUIREMENT = 'REQ-MARKER-7f3c: users sign in with a hardware key';
const REASON = 'REASON-MARKER-91ab approved after reading the issue list';

const OUTPUTS: Record<string, Record<string, string>> = {
  'issue-reader': {
    [`${S}/issues/demo/issue_list.json`]: JSON.stringify({
      issues: [{ id: 'ISS-001', title: 'Add login', body: AC }],
    }),
  },
  controller: {
    [`${S}/progress/demo/work_orders/WO-001.yaml`]:
      'work_order:\n  id: WO-001\n  issue:\n    id: ISS-001\n',
  },
  worker: {
    'src/login.ts': 'export const login = (): boolean => true;\n',
    [`${S}/progress/demo/results/WO-001-result.yaml`]:
      'implementation_result:\n  work_order_id: WO-001\n  status: completed\n  changes:\n    - file_path: src/login.ts\n      change_type: create\n  verification:\n    tests_passed: true\n    build_passed: true\n    lint_passed: true\n',
  },
  'validation-agent': {
    [`${S}/vnv/demo/rtm.yaml`]: 'rtm:\n  entries: []\n',
    [`${S}/vnv/demo/validation-report.yaml`]: 'validation_report:\n  overall_status: pass\n',
  },
  'pr-reviewer': {
    [`${S}/progress/demo/reviews/PR-001-review.yaml`]:
      'pr_review_result:\n  work_order_id: WO-001\n  pull_request:\n    number: 1\n  checks:\n    ci_passed: true\n    tests_passed: true\n',
  },
};

/** Every agent writes its files with one Write tool_use per file and a Bash call. */
function scriptedSdk(): ExecutionAdapter {
  return new SdkExecutionAdapter({
    loader: async () =>
      withQueryLifecycle({
        async *query(input): AsyncGenerator<SDKMessage, void> {
          const agent = input.options?.agent ?? 'unknown';
          const root = input.options?.cwd ?? '';
          const files = Object.entries(OUTPUTS[agent] ?? {});
          yield init(`sdk-${agent}`);
          // One API message streams its tool_use blocks one per assistant message.
          let index = 0;
          for (const [path, content] of files)
            yield assistant(
              `msg-${agent}-1`,
              [
                toolUse(`toolu-${agent}-${String(index++)}`, 'Write', {
                  file_path: path,
                  content: `${content}\n# token ${GITHUB_TOKEN}`,
                }),
              ],
              usage(1000, 50 * index, 0, 200)
            );
          yield assistant(
            `msg-${agent}-2`,
            [
              text(`Using ${API_KEY} for ${REQUIREMENT}`),
              toolUse(`toolu-${agent}-bash`, 'Bash', {
                command: `ANTHROPIC_API_KEY=${API_KEY} npm test`,
              }),
            ],
            usage(400, 30, 1000, 0)
          );
          for (const [path, content] of files) {
            await mkdir(dirname(join(root, path)), { recursive: true });
            await writeFile(join(root, path), content);
            const toolUseId = `toolu-${agent}-${path}`;
            for (const entry of input.options?.hooks?.PostToolUse ?? [])
              for (const callback of entry.hooks)
                await callback(
                  {
                    hook_event_name: 'PostToolUse',
                    session_id: `sdk-${agent}`,
                    tool_use_id: toolUseId,
                    tool_name: 'Write',
                    tool_input: { file_path: path },
                    tool_response: {},
                    cwd: root,
                    transcript_path: join(root, 'transcript'),
                  },
                  toolUseId,
                  { signal: input.options!.abortController!.signal }
                );
          }
          yield {
            ...success(2, usage(1400, 30 + 50 * files.length, 1000, 200)),
            session_id: `sdk-${agent}`,
            result: `status: success (${API_KEY})`,
          };
        },
      }),
  });
}

class MetricsOrchestrator extends AdsdlcOrchestratorAgent {
  protected override createExecutionAdapter(): ExecutionAdapter {
    return scriptedSdk();
  }
}

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'delivery-metrics-'));
  for (const agent of Object.keys(OUTPUTS)) await installAgent(project, agent);
  prompt.mockReset();
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function runImport(
  config: OrchestratorConfig,
  resumeSessionId?: string
): Promise<PipelineResult> {
  const agent = new MetricsOrchestrator({
    maxRetries: 0,
    approvalMode: 'manual',
    deliveryMetrics: { consent: 'granted', sink: jsonlDeliveryMetricsSink },
    ...config,
  });
  try {
    await agent.startSession({
      projectDir: project,
      userRequest: REQUIREMENT,
      overrideMode: 'import',
      ...(resumeSessionId === undefined ? {} : { resumeSessionId, resumeMode: 'resume' }),
    });
    return await agent.executePipeline(project, REQUIREMENT);
  } finally {
    await agent.dispose();
  }
}

describe('delivery metrics through a paused and resumed run', () => {
  it('exports every run of the session, reports resume success, and leaks nothing', async () => {
    const paused = await runImport({ interactive: false });
    expect(paused.overallStatus).toBe('awaiting_decision');
    prompt.mockImplementation(async () => ({ approve: true }));
    const resumed = await runImport({ interactive: true }, paused.pipelineId);
    expect(resumed.overallStatus).toBe('completed');

    const file = deliveryMetricsFile(join(project, S), paused.pipelineId);
    expect(resumed.metrics?.export.location).toBe(`${S}/metrics/${paused.pipelineId}.jsonl`);
    const input = await readDeliveryMetricsFiles([file]);
    expect(input.invalidRecords).toEqual([]);
    const runIds = [...new Set(input.records.map((record) => record.runId))];
    expect(runIds).toHaveLength(2);

    // The paused run: one attempt, a pending decision projected from #953.
    const first = input.records.filter((record) => record.runId === runIds[0]);
    const firstPipeline = first.find((r): r is PipelineMetricsRecord => r.kind === 'pipeline')!;
    expect(firstPipeline).toMatchObject({
      status: 'awaiting_decision',
      exitCode: 3,
      resume: { resumed: false },
      attempts: { total: 1 },
      approval: {
        status: 'awaiting_decision',
        mode: 'manual',
        requested: 1,
        counts: { pending: 1 },
      },
    });
    expect(
      first.find((r): r is StageMetricsRecord => r.kind === 'stage' && r.stage === 'orchestration')
    ).toMatchObject({
      status: 'skipped',
      usage: null,
      approval: { outcome: 'pending', basis: 'unattended', boundaries: ['review'] },
    });

    // The resumed run: restored stage, four attempts, decisions by a person.
    const second = input.records.filter((record) => record.runId === runIds[1]);
    const secondPipeline = second.find((r): r is PipelineMetricsRecord => r.kind === 'pipeline')!;
    expect(secondPipeline).toMatchObject({
      status: 'completed',
      exitCode: 0,
      resume: { resumed: true, priorStatus: 'awaiting_decision' },
      stages: { total: 5, restored: 1 },
      attempts: { total: 4, retries: 0 },
      approval: { status: 'approved', requested: 2, byBasis: { prompt: 2 } },
    });
    expect(secondPipeline.resume.source).toMatch(/^(checkpoint|session)$/);
    expect(
      second.find((r): r is StageMetricsRecord => r.kind === 'stage' && r.stage === 'issue_reading')
    ).toMatchObject({ restored: true, attempts: { total: 0 }, usage: null });

    // Tool invocations come from tool_use blocks: one Write per file plus one Bash.
    const worker = second.find(
      (r): r is AttemptMetricsRecord => r.kind === 'attempt' && r.stage === 'implementation'
    )!;
    expect(worker).toMatchObject({
      outcome: 'succeeded',
      execution: 'sdk',
      sdkSessionId: 'sdk-worker',
      toolUseCount: 3,
      toolUses: { Bash: 1, Write: 2 },
      turnCount: 2,
      usage: { inputTokens: 1400, outputTokens: 130, source: 'result' },
    });

    const report = buildDeliveryMetricsReport(input);
    expect(report.scope).toMatchObject({ sessions: 1, runs: 2, attempts: 5 });
    const resumeRate = report.metrics.find(
      (m) => m.id === 'runs.resume_after_decision_success_rate'
    )!;
    expect(resumeRate).toMatchObject({ value: 1, numerator: 1, sample: 1, missing: 0 });
    const tools = report.metrics.find((m) => m.id === 'attempts.all.tool_uses')!;
    // issue-reader 1 Write, controller 1, worker 2, validation-agent 2, pr-reviewer 1; plus one Bash each.
    expect(tools).toMatchObject({ value: 7 + 5, sample: 5, missing: 0 });

    // Privacy: the export and the in-memory records hold none of the planted values.
    expectNoPlantedValues(await readFile(file, 'utf8'));
    expectNoPlantedValues(JSON.stringify([paused.metrics, resumed.metrics]));
  });

  it('keeps a typed rejection reason out of the records', async () => {
    prompt.mockImplementation(async () => ({ approve: false, reason: REASON }));
    const rejected = await runImport({ interactive: true });
    expect(rejected.overallStatus).toBe('rejected');
    // The reason is in the #953 decision record of the run result...
    expect(rejected.approval?.decisions.some((record) => record.reason === REASON)).toBe(true);

    // ...and the metrics keep only its outcome and basis.
    const file = deliveryMetricsFile(join(project, S), rejected.pipelineId);
    const { records } = await readDeliveryMetricsFiles([file]);
    expect(
      records.find(
        (r): r is StageMetricsRecord => r.kind === 'stage' && r.stage === 'orchestration'
      )
    ).toMatchObject({
      status: 'skipped',
      approval: { outcome: 'rejected', basis: 'prompt', decidedBy: 'user' },
    });
    expect(records.find((r): r is PipelineMetricsRecord => r.kind === 'pipeline')).toMatchObject({
      status: 'rejected',
      exitCode: 2,
      approval: { status: 'rejected', counts: { rejected: 1 } },
    });
    expectNoPlantedValues(await readFile(file, 'utf8'));
    expectNoPlantedValues(JSON.stringify(rejected.metrics));
  });
});

/**
 * Scan serialized records for every planted value: credentials, the
 * requirement (the prompt's work order), tool inputs, the typed reason, and
 * the project path.
 * @param content - Serialized records
 */
function expectNoPlantedValues(content: string): void {
  for (const planted of [
    API_KEY,
    GITHUB_TOKEN,
    REQUIREMENT,
    'REQ-MARKER',
    REASON,
    'REASON-MARKER',
    project,
    'npm test',
    'login.ts',
  ])
    expect(content).not.toContain(planted);
  expect(content).not.toMatch(/sk-ant-|ghp_|Bearer /u);
}
