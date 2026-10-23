/**
 * Orchestrator integration: the real StageVerifierAgent checks malformed
 * artifacts written to a temporary project under both verification profiles.
 *
 * A scripted SDK writes each stage's files and reports them through the
 * production capture hooks, so the real SdkExecutionAdapter publishes durable
 * manifests and the verifier locates artifacts from those manifests. No
 * verifier, scheduler, or artifact validator is replaced. No paid SDK call or
 * GitHub resource is used.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
import type { VerificationProfile } from '../../src/vnv/types.js';
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

class PolicyOrchestrator extends AdsdlcOrchestratorAgent {
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
const AC = '## Acceptance Criteria\n- [ ] Valid credentials sign in';

/** Valid outputs for every Import stage. */
function importOutputs(): StageOutputs {
  return {
    'issue-reader': {
      [`${S}/issues/demo/issue_list.json`]: JSON.stringify({
        schema_version: '1.0',
        issues: [
          { id: 'ISS-001', title: 'Add login', body: AC },
          { id: 'ISS-002', title: 'Add logout', body: '## Acceptance Criteria\n- [ ] Signs out' },
        ],
      }),
      [`${S}/issues/demo/dependency_graph.json`]: JSON.stringify({
        nodes: [{ id: 'ISS-001' }, { id: 'ISS-002' }],
        edges: [{ from: 'ISS-002', to: 'ISS-001', type: 'depends_on' }],
        has_cycles: false,
      }),
    },
    controller: {
      [`${S}/progress/demo/work_orders/WO-001.yaml`]:
        'work_order:\n  id: WO-001\n  status: assigned\n  issue:\n    id: ISS-001\n',
    },
    worker: {
      'src/login.ts': 'export const login = (): boolean => true;\n',
      [`${S}/progress/demo/results/WO-001-result.yaml`]: [
        'implementation_result:',
        '  work_order_id: WO-001',
        '  issue_id: ISS-001',
        '  status: completed',
        '  changes:',
        '    - file_path: src/login.ts',
        '      change_type: create',
        '  verification:',
        '    tests_passed: true',
        '    build_passed: true',
        '    lint_passed: true',
        '',
      ].join('\n'),
    },
    'validation-agent': {
      [`${S}/vnv/demo/rtm.yaml`]: 'rtm:\n  entries: []\n',
      [`${S}/vnv/demo/validation-report.yaml`]:
        'validation_report:\n  overall_status: pass\n  quality_gates:\n    - name: overall_coverage\n      status: pass\n',
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
  project = await mkdtemp(join(tmpdir(), 'verification-policy-'));
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

async function runPipeline(
  mode: PipelineMode,
  outputs: StageOutputs,
  profile: VerificationProfile,
  stopAfterStage?: StageName
): Promise<RunOutcome> {
  for (const agent of Object.keys(outputs)) await installAgent(project, agent);
  const calls: string[] = [];
  const orchestrator = new PolicyOrchestrator(scriptedSdk(outputs, calls), {
    vnv: { rigor: 'standard', haltOnVerificationFailure: false, profile },
  });
  await orchestrator.startSession({
    projectDir: project,
    userRequest: 'Verification policy integration',
    overrideMode: mode,
    ...(stopAfterStage === undefined ? {} : { stopAfterStage }),
  });
  try {
    const result = await orchestrator.executePipeline(project, 'Verification policy integration');
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

function failingChecks(result: PipelineResult, name: StageName): string[] {
  return (stage(result, name).verification?.checks ?? [])
    .filter((check) => check.outcome === 'fail')
    .map((check) => check.checkId);
}

describe('verification policy on the production orchestrator path', () => {
  it('verifies a complete Import run from manifest artifacts under delivery', async () => {
    const { result, failed, calls } = await runPipeline('import', importOutputs(), 'delivery');

    expect(failed).toBe(false);
    expect(calls).toEqual([
      'issue-reader',
      'controller',
      'worker',
      'validation-agent',
      'pr-reviewer',
    ]);
    expect(result.overallStatus).toBe('completed');
    expect(result.verification).toMatchObject({
      status: 'verified',
      policy: { profile: 'delivery', blocking: true, source: { kind: 'programmatic' } },
      counts: { verified_pass: 5, failed: 0, advisory_findings: 0 },
    });
    // Artifacts were located through the published manifests.
    expect(stage(result, 'implementation').manifest).toBeDefined();
    expect(stage(result, 'implementation').artifacts).toContain(
      `${S}/progress/demo/results/WO-001-result.yaml`
    );
    expect(pipelineExitCode(result)).toBe(0);
  });

  describe('Import issue list missing acceptance criteria', () => {
    const outputs = (): StageOutputs => {
      const base = importOutputs();
      base['issue-reader']![`${S}/issues/demo/issue_list.json`] = JSON.stringify({
        issues: [
          { id: 'ISS-001', title: 'Add login', body: AC },
          { id: 'ISS-002', title: 'Add logout', body: 'Make logout work.' },
        ],
      });
      return base;
    };

    it('delivery: fails the stage, skips every dependent, and fails the run', async () => {
      const { result, failed, calls } = await runPipeline('import', outputs(), 'delivery');

      expect(failed).toBe(true);
      expect(calls).toEqual(['issue-reader']);
      expect(result.overallStatus).toBe('failed');
      expect(stage(result, 'issue_reading')).toMatchObject({
        status: 'failed',
        verification: { state: 'failed', checkSet: 'imported-issues' },
      });
      expect(failingChecks(result, 'issue_reading')).toEqual(['VR-IRD-003']);
      for (const name of ['orchestration', 'implementation', 'validation-agent', 'review'] as const)
        expect(stage(result, name).status).toBe('skipped');
      expect(result.verification?.status).toBe('failed');
      expect(pipelineExitCode(result)).toBe(1);
    });

    it('advisory: completes, retains the failed check, and is not reported as verified', async () => {
      const { result, failed, calls } = await runPipeline('import', outputs(), 'advisory');

      expect(failed).toBe(false);
      expect(calls).toHaveLength(5);
      expect(result.overallStatus).toBe('completed');
      expect(stage(result, 'issue_reading')).toMatchObject({
        status: 'completed',
        verification: { state: 'advisory_findings' },
      });
      expect(failingChecks(result, 'issue_reading')).toEqual(['VR-IRD-003']);
      expect(stage(result, 'issue_reading').warnings?.join(' ')).toContain(
        'Verification advisory: [VR-IRD-003]'
      );
      expect(result.verification?.status).toBe('advisory_findings');
      expect(result.verification?.counts.verified_pass).toBe(4);
      expect(pipelineExitCode(result)).toBe(0);
    });
  });

  describe('implementation result referencing a missing file', () => {
    const outputs = (): StageOutputs => {
      const base = importOutputs();
      base['worker']![`${S}/progress/demo/results/WO-001-result.yaml`] = [
        'implementation_result:',
        '  status: completed',
        '  changes:',
        '    - file_path: src/login.ts',
        '      change_type: create',
        '    - file_path: src/session.ts',
        '      change_type: modify',
        '  verification:',
        '    tests_passed: true',
        '    build_passed: true',
        '',
      ].join('\n');
      return base;
    };

    it('delivery: blocks validation and review', async () => {
      const { result, failed, calls } = await runPipeline('import', outputs(), 'delivery');

      expect(failed).toBe(true);
      expect(calls).toEqual(['issue-reader', 'controller', 'worker']);
      expect(stage(result, 'implementation')).toMatchObject({
        status: 'failed',
        verification: { state: 'failed' },
      });
      expect(failingChecks(result, 'implementation')).toEqual(['VR-IMP-007']);
      expect(stage(result, 'validation-agent').status).toBe('skipped');
      expect(stage(result, 'review').status).toBe('skipped');
      expect(result.verification?.stages.find((s) => s.stage === 'review')).toMatchObject({
        state: 'skipped',
        reason: expect.stringContaining('verification gate failed'),
      });
    });

    it('advisory: completes with the finding retained', async () => {
      const { result, failed } = await runPipeline('import', outputs(), 'advisory');

      expect(failed).toBe(false);
      expect(result.overallStatus).toBe('completed');
      expect(stage(result, 'implementation').verification?.state).toBe('advisory_findings');
      expect(failingChecks(result, 'implementation')).toEqual(['VR-IMP-007']);
      expect(result.verification?.status).toBe('advisory_findings');
    });
  });

  describe('Greenfield PRD missing required sections', () => {
    const outputs = (): StageOutputs => ({
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
          'The demo product lets registered users sign in with their credentials and keeps',
          'their session open until they sign out. FR-001 covers the sign-in flow.',
          '',
        ].join('\n'),
      },
    });

    it('delivery: fails prd_generation and does not start srs_generation', async () => {
      const { result, failed, calls } = await runPipeline(
        'greenfield',
        outputs(),
        'delivery',
        'prd_generation'
      );

      expect(failed).toBe(true);
      expect(calls).toEqual(['project-initializer', 'mode-detector', 'collector', 'prd-writer']);
      expect(stage(result, 'prd_generation').status).toBe('failed');
      expect(failingChecks(result, 'prd_generation')).toContain('VR-PRD-002');
      expect(stage(result, 'srs_generation').status).toBe('skipped');
      expect(stage(result, 'initialization').verification?.state).toBe('not_applicable');
      expect(stage(result, 'collection').verification?.state).toBe('verified_pass');
    });

    it('advisory: completes the stopped run with the PRD finding and no verified pass', async () => {
      const { result, failed } = await runPipeline(
        'greenfield',
        outputs(),
        'advisory',
        'prd_generation'
      );

      expect(failed).toBe(false);
      expect(result.overallStatus).toBe('completed');
      expect(stage(result, 'prd_generation').verification?.state).toBe('advisory_findings');
      expect(failingChecks(result, 'prd_generation')).toContain('VR-PRD-002');
      expect(result.verification?.status).toBe('advisory_findings');
      expect(result.verification?.status).not.toBe('verified');
    });
  });
});
