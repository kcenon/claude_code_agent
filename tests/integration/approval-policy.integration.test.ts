/**
 * Orchestrator integration: approval decisions on the production adapter
 * path. A scripted SDK writes each stage's files through the real capture
 * hooks, so the real SdkExecutionAdapter publishes manifests, and the decision
 * request references them. inquirer is a test double. No paid SDK call or
 * GitHub resource is used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

const prompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { createPromptModule: () => prompt, prompt } }));

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineCheckpointManager } from '../../src/ad-sdlc-orchestrator/PipelineCheckpointManager.js';
import type {
  OrchestratorConfig,
  PipelineResult,
  StageResult,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import type { ExecutionAdapter } from '../../src/execution/types.js';
import { pipelineExitCode } from '../../src/vnv/policy.js';
import { installAgent, sdkResult, withQueryLifecycle } from '../execution/fixtures/sdk.js';

const S = '.ad-sdlc/scratchpad';
const AC = '## Acceptance Criteria\n- [ ] Valid credentials sign in';

/** Valid files for every Import agent. */
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

function scriptedSdk(calls: string[]): ExecutionAdapter {
  return new SdkExecutionAdapter({
    loader: async () =>
      withQueryLifecycle({
        async *query(input): AsyncGenerator<SDKMessage, void> {
          const agent = input.options?.agent ?? 'unknown';
          const root = input.options?.cwd ?? '';
          calls.push(agent);
          let index = 0;
          for (const [path, content] of Object.entries(OUTPUTS[agent] ?? {})) {
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

class ApprovalOrchestrator extends AdsdlcOrchestratorAgent {
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

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'approval-policy-'));
  for (const agent of Object.keys(OUTPUTS)) await installAgent(project, agent);
  prompt.mockReset();
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function runImport(
  config: OrchestratorConfig,
  resumeSessionId?: string
): Promise<{ result: PipelineResult; calls: string[] }> {
  const calls: string[] = [];
  const agent = new ApprovalOrchestrator(scriptedSdk(calls), config);
  try {
    await agent.startSession({
      projectDir: project,
      userRequest: 'Implement the imported login issue',
      overrideMode: 'import',
      ...(resumeSessionId === undefined ? {} : { resumeSessionId, resumeMode: 'resume' }),
    });
    return { result: await agent.executePipeline(project, 'unused'), calls };
  } finally {
    await agent.dispose();
  }
}

const stage = (result: PipelineResult, name: string): StageResult =>
  result.stages.find((candidate) => candidate.name === name)!;

/** Answer prompts in order and capture what they showed. */
function answers(...queue: { approve: boolean; reason?: string }[]): string[] {
  const messages: string[] = [];
  prompt.mockImplementation(async (questions: { message: string }[]) => {
    messages.push(questions[0]!.message);
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected approval prompt');
    return next;
  });
  return messages;
}

describe('approval on the manifest-backed adapter path', () => {
  it('references upstream manifests in the request and the decision record', async () => {
    const messages = answers({ approve: true }, { approve: true });
    const { result, calls } = await runImport({ approvalMode: 'manual', interactive: true });

    expect(calls).toHaveLength(5);
    expect(result.overallStatus).toBe('completed');
    const manifest = stage(result, 'issue_reading').manifest!;
    expect(messages[0]).toContain(`issue_reading (manifest ${manifest.id.slice(0, 12)})`);
    expect(stage(result, 'orchestration').approval?.scope.artifacts).toEqual([
      {
        stage: 'issue_reading',
        manifest: manifest.id,
        paths: [`${S}/issues/demo/issue_list.json`],
      },
    ]);
    // The delivery decision covers every upstream manifest, in graph order.
    expect(
      stage(result, 'review').approval?.scope.artifacts.map((artifact) => artifact.stage)
    ).toEqual(['issue_reading', 'orchestration', 'implementation', 'validation-agent']);
    expect(pipelineExitCode(result)).toBe(0);
  });

  it('pauses without a terminal and resumes from the saved manifests', async () => {
    const paused = await runImport({ approvalMode: 'manual', interactive: false });
    expect(paused.calls).toEqual(['issue-reader']);
    expect(paused.result.overallStatus).toBe('awaiting_decision');
    expect(pipelineExitCode(paused.result)).toBe(3);

    const messages = answers({ approve: true }, { approve: true });
    const resumed = await runImport(
      { approvalMode: 'manual', interactive: true },
      paused.result.pipelineId
    );
    expect(messages).toHaveLength(2);
    expect(resumed.calls).toEqual(['controller', 'worker', 'validation-agent', 'pr-reviewer']);
    expect(resumed.result.overallStatus).toBe('completed');
    expect(resumed.result.approval?.policy.source.kind).toBe('resume');
    // The pre-completed stage keeps its manifest; the decision references it.
    expect(stage(resumed.result, 'orchestration').approval?.scope.artifacts[0]?.manifest).toBe(
      stage(paused.result, 'issue_reading').manifest?.id
    );
  });

  it('validates decision records restored from a checkpoint', async () => {
    answers({ approve: false, reason: 'Wrong scope' });
    const first = await runImport({ approvalMode: 'manual', interactive: true });
    expect(first.result.overallStatus).toBe('rejected');

    // Simulate a crash after the rejection: the checkpoint is the newest state.
    const scratchpad = join(project, S);
    const checkpoint = async (stages: readonly StageResult[]): Promise<void> => {
      await new PipelineCheckpointManager().saveCheckpoint(
        first.result.pipelineId,
        'import',
        project,
        'Implement the imported login issue',
        scratchpad,
        stages,
        ['issue_reading']
      );
    };
    await checkpoint(first.result.stages);
    const reused = await runImport(
      { approvalMode: 'manual', interactive: true },
      first.result.pipelineId
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(reused.calls).toEqual([]);
    expect(stage(reused.result, 'orchestration').approval).toMatchObject({
      outcome: 'rejected',
      reused: true,
    });

    // A tampered record is dropped, so the stage asks again.
    await checkpoint(
      first.result.stages.map((result) =>
        result.approval === undefined
          ? result
          : { ...result, approval: { ...result.approval, sessionId: '' } }
      )
    );
    const messages = answers({ approve: true }, { approve: true });
    const asked = await runImport(
      { approvalMode: 'manual', interactive: true },
      first.result.pipelineId
    );
    expect(messages).toHaveLength(2);
    expect(asked.result.overallStatus).toBe('completed');
  });
});
