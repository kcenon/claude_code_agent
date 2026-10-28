/**
 * Orchestrator integration: requirements traceability and cross-document
 * consistency on the production path (#952).
 *
 * A scripted SDK writes each stage's files and reports them through the
 * production capture hooks, so the real SdkExecutionAdapter publishes durable
 * manifests and the real StageVerifierAgent builds the traceability record
 * from the manifest-located artifacts. No verifier, scheduler, RTM builder, or
 * artifact validator is replaced. No paid SDK call or GitHub resource is used.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as yaml from 'js-yaml';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineFailedError } from '../../src/ad-sdlc-orchestrator/errors.js';
import type {
  OrchestratorConfig,
  PipelineMode,
  PipelineResult,
  StageName,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import type { ExecutionAdapter } from '../../src/execution/types.js';
import { pipelineExitCode } from '../../src/vnv/policy.js';
import type { VnvConfig } from '../../src/vnv/types.js';
import { installAgent, sdkResult, withQueryLifecycle } from '../execution/fixtures/sdk.js';

/** Files each agent writes, keyed by agent type, then project-relative path. */
type StageOutputs = Record<string, Record<string, string>>;

/**
 * SDK double: writes the agent's files and reports each through the
 * production PostToolUse capture hooks, like a real Write tool call.
 * @param outputs - Files per agent type
 * @param calls - Receives the agent types in invocation order
 * @returns Production adapter over the scripted SDK
 */
function scriptedSdk(outputs: StageOutputs, calls: string[]): ExecutionAdapter {
  return new SdkExecutionAdapter({
    loader: async () =>
      withQueryLifecycle({
        async *query(input): AsyncGenerator<SDKMessage, void> {
          const agent = input.options?.agent ?? 'unknown';
          const root = input.options?.cwd ?? '';
          calls.push(agent);
          let index = 0;
          for (const [path, content] of Object.entries(outputs[agent] ?? {})) {
            await mkdir(dirname(join(root, path)), { recursive: true });
            await writeFile(join(root, path), content);
            const toolUseId = `write-${agent}-${String(index++)}`;
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
          yield sdkResult({ session_id: `sdk-${agent}`, result: 'status: success' });
        },
      }),
  });
}

class TraceOrchestrator extends AdsdlcOrchestratorAgent {
  constructor(
    private readonly adapter: ExecutionAdapter,
    config: OrchestratorConfig
  ) {
    super({ maxRetries: 0, ...config });
  }
  protected override createExecutionAdapter(): ExecutionAdapter {
    return this.adapter;
  }
}

const S = '.ad-sdlc/scratchpad';

/**
 * Completed implementation result of WO-NNN for ISS-NNN.
 * @param number - Work order and issue number
 * @param name - Changed source file name
 * @param tests - Test files linked to AC-001; empty links none
 * @returns Result YAML
 */
function implementationResult(number: string, name: string, tests: readonly string[]): string {
  return [
    'implementation_result:',
    `  work_order_id: WO-${number}`,
    `  issue_id: ISS-${number}`,
    '  status: completed',
    '  changes:',
    `    - file_path: src/${name}.ts`,
    '      change_type: create',
    '  verification:',
    '    tests_passed: true',
    '    build_passed: true',
    '  acceptance_criteria:',
    '    - id: AC-001',
    '      status: met',
    `      tests: [${tests.join(', ')}]`,
    '',
  ].join('\n');
}

/**
 * Import outputs: two imported issues, each implemented by one work order.
 * @param logoutTests - Test files the logout result links to its criterion
 * @returns Outputs per agent
 */
function importOutputs(logoutTests: readonly string[] = ['tests/logout.test.ts']): StageOutputs {
  return {
    'issue-reader': {
      [`${S}/issues/demo/issue_list.json`]: JSON.stringify({
        issues: [
          { id: 'ISS-001', title: 'Add login', body: '## Acceptance Criteria\n- [ ] Signs in' },
          { id: 'ISS-002', title: 'Add logout', body: '## Acceptance Criteria\n- [ ] Signs out' },
        ],
      }),
    },
    controller: {
      [`${S}/progress/demo/work_orders/WO-001.yaml`]:
        'work_order:\n  id: WO-001\n  issue:\n    id: ISS-001\n',
      [`${S}/progress/demo/work_orders/WO-002.yaml`]:
        'work_order:\n  id: WO-002\n  issue:\n    id: ISS-002\n',
    },
    worker: {
      'src/login.ts': 'export const login = (): boolean => true;\n',
      'src/logout.ts': 'export const logout = (): boolean => true;\n',
      'tests/login.test.ts': "it('signs in', () => undefined);\n",
      'tests/logout.test.ts': "it('signs out', () => undefined);\n",
      [`${S}/progress/demo/results/WO-001-result.yaml`]: implementationResult('001', 'login', [
        'tests/login.test.ts',
      ]),
      [`${S}/progress/demo/results/WO-002-result.yaml`]: implementationResult(
        '002',
        'logout',
        logoutTests
      ),
    },
    'validation-agent': {
      [`${S}/vnv/demo/rtm.yaml`]: 'rtm:\n  entries: []\n',
      [`${S}/vnv/demo/validation-report.yaml`]: 'validation_report:\n  overall_status: pass\n',
    },
    'pr-reviewer': {
      [`${S}/progress/demo/reviews/PR-001-review.yaml`]: [
        'pr_review_result:',
        '  work_order_id: WO-001',
        '  pull_request:',
        '    number: 1',
        '    url: https://github.com/example/demo/pull/1',
        '  checks:',
        '    ci_passed: true',
        '    tests_passed: true',
        '  decision:',
        '    action: merge',
        '',
      ].join('\n'),
    },
  };
}

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'traceability-'));
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

/** Outcome of one orchestrated run. */
interface RunOutcome {
  readonly result: PipelineResult;
  readonly failed: boolean;
  readonly calls: readonly string[];
}

/** Options of one orchestrated run. */
interface RunOptions {
  readonly vnv?: Partial<VnvConfig>;
  readonly stopAfterStage?: StageName;
  readonly resumeSessionId?: string;
}

async function runPipeline(
  mode: PipelineMode,
  outputs: StageOutputs,
  options: RunOptions = {}
): Promise<RunOutcome> {
  for (const agent of Object.keys(outputs)) await installAgent(project, agent);
  const calls: string[] = [];
  const orchestrator = new TraceOrchestrator(scriptedSdk(outputs, calls), {
    vnv: { rigor: 'standard', haltOnVerificationFailure: false, ...options.vnv },
  });
  await orchestrator.startSession({
    projectDir: project,
    userRequest: 'Traceability integration',
    overrideMode: mode,
    ...(options.stopAfterStage === undefined ? {} : { stopAfterStage: options.stopAfterStage }),
    ...(options.resumeSessionId === undefined
      ? {}
      : { resumeSessionId: options.resumeSessionId, resumeMode: 'resume' as const }),
  });
  try {
    const result = await orchestrator.executePipeline(project, 'Traceability integration');
    return { result, failed: false, calls };
  } catch (error) {
    if (!(error instanceof PipelineFailedError) || error.result === undefined) throw error;
    return { result: error.result, failed: true, calls };
  } finally {
    await orchestrator.dispose();
  }
}

function stage(result: PipelineResult, name: StageName) {
  const found = result.stages.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`stage ${name} missing from result`);
  return found;
}

function check(result: PipelineResult, name: StageName, checkId: string) {
  return stage(result, name).verification?.checks.find((c) => c.checkId === checkId);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(join(project, path));
    return true;
  } catch {
    return false;
  }
}

describe('requirements traceability on the production orchestrator path', () => {
  it('advisory: reports an untested criterion by its ID and persists the links', async () => {
    const { result, failed } = await runPipeline('import', importOutputs([]), {
      vnv: { profile: 'advisory' },
    });

    expect(failed).toBe(false);
    expect(check(result, 'validation-agent', 'VR-VAL-004')).toMatchObject({
      outcome: 'fail',
      required: true,
      message: expect.stringContaining('ISS-002/AC-001'),
    });
    expect(stage(result, 'validation-agent').verification?.state).toBe('advisory_findings');
    expect(result.traceability).toMatchObject({
      status: 'uncovered',
      roots: 'issue_acceptance_criteria',
      uncovered: ['ISS-002/AC-001'],
      counts: { roots: 2, criteria: 2, validatedCriteria: 1 },
    });

    // Import roots are the imported issues; no upstream document is read or implied.
    const record = stage(result, 'validation-agent').traceability!;
    expect(record.rtm.entries.map((entry) => entry.requirementId)).toEqual(['ISS-001', 'ISS-002']);
    expect(record.rtm.gaps.map((gap) => gap.type)).not.toContain('uncovered_requirement');
    expect(record.sources.some((source) => /prd|srs|sds/i.test(source))).toBe(false);
    expect(record.rtm.entries[0]?.acceptanceCriteria[0]).toMatchObject({
      id: 'AC-001',
      issueId: 'ISS-001',
      validated: true,
      workOrders: ['WO-001'],
      changedFiles: ['src/login.ts'],
      tests: ['tests/login.test.ts'],
    });
    expect(record.rtm.entries[1]?.acceptanceCriteria[0]).toMatchObject({
      issueId: 'ISS-002',
      validated: false,
      implemented: true,
      uncoveredReason: 'No test is linked to the criterion',
    });

    // RTM files and the session state carry the same record.
    const files = result.traceability?.rtm;
    expect(files).toEqual({
      json: `${S}/traceability/${result.pipelineId}.json`,
      markdown: `${S}/traceability/${result.pipelineId}.md`,
    });
    const written = JSON.parse(await readFile(join(project, files!.json), 'utf-8'));
    expect(written.uncovered).toEqual(['ISS-002/AC-001']);
    expect(await readFile(join(project, files!.markdown), 'utf-8')).toContain('- ISS-002/AC-001');
    const session = yaml.load(
      await readFile(join(project, S, 'pipeline', `${result.pipelineId}.yaml`), 'utf-8')
    ) as { stages: { name: string; traceability?: { uncovered: string[] } }[] };
    expect(
      session.stages.find((saved) => saved.name === 'validation-agent')?.traceability?.uncovered
    ).toEqual(['ISS-002/AC-001']);
    expect(pipelineExitCode(result)).toBe(0);
  });

  it('delivery: the uncovered criterion fails final validation and blocks review', async () => {
    const { result, failed, calls } = await runPipeline('import', importOutputs([]), {
      vnv: { profile: 'delivery' },
    });

    expect(failed).toBe(true);
    expect(calls).not.toContain('pr-reviewer');
    expect(stage(result, 'validation-agent')).toMatchObject({
      status: 'failed',
      verification: { state: 'failed' },
    });
    expect(stage(result, 'review').status).toBe('skipped');
    expect(result.traceability?.uncovered).toEqual(['ISS-002/AC-001']);
    expect(pipelineExitCode(result)).toBe(1);
  });

  it('delivery: complete evidence is covered and delivered', async () => {
    const { result, failed } = await runPipeline('import', importOutputs(), {
      vnv: { profile: 'delivery' },
    });

    expect(failed).toBe(false);
    expect(check(result, 'validation-agent', 'VR-VAL-004')?.outcome).toBe('pass');
    expect(result.traceability).toMatchObject({ status: 'covered', uncovered: [] });
    expect(result.verification?.status).toBe('verified');
  });

  it('a linked test file that does not exist leaves the criterion uncovered', async () => {
    const { result } = await runPipeline('import', importOutputs(['tests/missing.test.ts']), {
      vnv: { profile: 'advisory' },
    });

    expect(result.traceability?.uncovered).toEqual(['ISS-002/AC-001']);
    expect(
      stage(result, 'validation-agent').traceability?.rtm.entries[1]?.acceptanceCriteria[0]
        ?.uncoveredReason
    ).toBe('Linked test file not found: tests/missing.test.ts');
  });

  it('turning RTM generation off writes no RTM file but keeps the summary', async () => {
    const { result } = await runPipeline('import', importOutputs(), {
      vnv: { generateRtm: false },
    });

    expect(result.traceability).toMatchObject({ status: 'covered' });
    expect(result.traceability?.rtm).toBeUndefined();
    expect(await exists(`${S}/traceability`)).toBe(false);
  });

  it('turning both options off suppresses the record, the summary, and the check', async () => {
    const { result } = await runPipeline('import', importOutputs([]), {
      vnv: { generateRtm: false, acceptanceCriteriaValidation: false },
    });

    expect(result.traceability).toBeUndefined();
    expect(stage(result, 'validation-agent').traceability).toBeUndefined();
    expect(check(result, 'validation-agent', 'VR-VAL-004')).toMatchObject({
      outcome: 'skipped',
      skipReason: 'disabled by global.vnv.acceptance_criteria_validation',
    });
    expect(await exists(`${S}/traceability`)).toBe(false);
  });

  it('turning only acceptance validation off still writes the RTM', async () => {
    const { result } = await runPipeline('import', importOutputs([]), {
      vnv: { acceptanceCriteriaValidation: false },
    });

    expect(check(result, 'validation-agent', 'VR-VAL-004')?.outcome).toBe('skipped');
    expect(result.traceability).toMatchObject({ status: 'uncovered' });
    expect(await exists(result.traceability!.rtm!.json)).toBe(true);
  });

  it('reports the deprecated plan and report options instead of ignoring them', async () => {
    const { result } = await runPipeline('import', importOutputs(), {
      vnv: { generateVnvPlan: true, generateVnvReport: false },
    });

    expect(result.warnings).toEqual([
      expect.stringContaining('vnv.generateVnvPlan is deprecated and not supported'),
    ]);
  });

  it('resume regenerates the RTM from the persisted record without rerunning validation', async () => {
    const first = await runPipeline('import', importOutputs([]), {
      vnv: { profile: 'advisory' },
      stopAfterStage: 'validation-agent',
    });
    expect(first.calls).toEqual(['issue-reader', 'controller', 'worker', 'validation-agent']);
    await rm(join(project, S, 'traceability'), { recursive: true, force: true });

    const resumed = await runPipeline('import', importOutputs([]), {
      vnv: { profile: 'advisory' },
      resumeSessionId: first.result.pipelineId,
    });

    expect(resumed.calls).not.toContain('validation-agent');
    expect(resumed.result.traceability?.uncovered).toEqual(['ISS-002/AC-001']);
    expect(await exists(resumed.result.traceability!.rtm!.json)).toBe(true);
    expect(await exists(resumed.result.traceability!.rtm!.markdown)).toBe(true);
  });
});

/** Greenfield outputs up to srs_generation; the SRS contradicts a PRD sync point. */
function greenfieldOutputs(srsTimeout: string): StageOutputs {
  return {
    'project-initializer': { [`${S}/README.md`]: 'scratchpad\n' },
    'mode-detector': { [`${S}/mode/demo/mode.yaml`]: 'mode: greenfield\n' },
    collector: {
      [`${S}/info/demo/collected_info.yaml`]: [
        'requirements:',
        '  functional:',
        '    - id: FR-001',
        '      title: Login',
        '      description: Users sign in with credentials',
        '      acceptance_criteria:',
        '        - Valid credentials sign in',
        '',
      ].join('\n'),
    },
    'prd-writer': {
      [`${S}/documents/demo/prd.md`]: [
        '# PRD: Demo',
        '',
        '## Introduction',
        '',
        'Registered users sign in with their credentials.',
        '',
        '## Functional Requirements',
        '',
        '### FR-001: Login',
        '',
        'Priority: P0. Session timeout: 30 minutes.',
        '',
        '## Non-Functional Requirements',
        '',
        'Sign-in completes within one second.',
        '',
      ].join('\n'),
    },
    'srs-writer': {
      [`${S}/documents/demo/srs.md`]: [
        '# SRS: Demo',
        '',
        '## Introduction',
        '',
        'Implements the demo PRD.',
        '',
        '## Software Features',
        '',
        '### SF-001: Login',
        '',
        `Implements FR-001. Session timeout: ${srsTimeout}.`,
        '',
      ].join('\n'),
    },
  };
}

const SYNC_POINTS = [
  'sync_points:',
  '  - name: session-timeout',
  '    documents: [prd, srs]',
  "    pattern: 'Session timeout: 30 minutes'",
  '    severity: high',
  '',
].join('\n');

describe('cross-document consistency on the Greenfield path', () => {
  beforeEach(async () => {
    await writeFile(join(project, 'doc-sync-points.yaml'), SYNC_POINTS);
  });

  it('delivery: a conflicting SRS fails srs_generation', async () => {
    const { result, failed, calls } = await runPipeline(
      'greenfield',
      greenfieldOutputs('15 minutes'),
      { vnv: { profile: 'delivery' }, stopAfterStage: 'srs_generation' }
    );

    expect(failed).toBe(true);
    expect(calls.at(-1)).toBe('srs-writer');
    // Only the PRD existed when prd_generation was verified.
    expect(check(result, 'prd_generation', 'VR-XDOC-001')).toMatchObject({
      outcome: 'skipped',
      skipReason: 'fewer than two of the run documents exist yet',
    });
    expect(stage(result, 'srs_generation')).toMatchObject({
      status: 'failed',
      verification: { state: 'failed' },
    });
    expect(check(result, 'srs_generation', 'VR-XDOC-001')).toMatchObject({
      outcome: 'fail',
      message: expect.stringContaining("Sync point 'session-timeout'"),
    });
    expect(pipelineExitCode(result)).toBe(1);
  });

  it('advisory: the conflict is a retained finding', async () => {
    const { result, failed } = await runPipeline('greenfield', greenfieldOutputs('15 minutes'), {
      vnv: { profile: 'advisory' },
      stopAfterStage: 'srs_generation',
    });

    expect(failed).toBe(false);
    expect(stage(result, 'srs_generation').verification?.state).toBe('advisory_findings');
    expect(check(result, 'srs_generation', 'VR-XDOC-001')?.outcome).toBe('fail');
    expect(result.verification?.status).toBe('advisory_findings');
  });

  it('consistent documents pass the check', async () => {
    const { result } = await runPipeline('greenfield', greenfieldOutputs('30 minutes'), {
      vnv: { profile: 'delivery' },
      stopAfterStage: 'srs_generation',
    });

    expect(check(result, 'srs_generation', 'VR-XDOC-001')).toMatchObject({
      outcome: 'pass',
      message: expect.stringContaining('1 sync point(s) agree'),
    });
  });

  it('turning the check off records it as skipped', async () => {
    const { result, failed } = await runPipeline('greenfield', greenfieldOutputs('15 minutes'), {
      vnv: { profile: 'delivery', crossDocumentConsistency: false },
      stopAfterStage: 'srs_generation',
    });

    expect(failed).toBe(false);
    expect(stage(result, 'srs_generation').verification?.state).not.toBe('failed');
    expect(check(result, 'srs_generation', 'VR-XDOC-001')).toMatchObject({
      outcome: 'skipped',
      skipReason: 'disabled by global.vnv.cross_document_consistency',
    });
  });
});
