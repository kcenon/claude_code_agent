/**
 * `ad-sdlc run` approval policy through the production run command:
 * Commander options -> runtime resolution -> orchestrator -> real scheduler,
 * approval gate, and stage verifier -> exit status and JSON/text output.
 *
 * inquirer is replaced by a test double (the prompt the gate would show is
 * captured), and an offline execution adapter writes each agent's files. No
 * SDK call is made and no GitHub resource is created.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dump, load } from 'js-yaml';
import { Command } from 'commander';

const prompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { createPromptModule: () => prompt, prompt } }));

import { configureRunCommand, executeRunCommand } from '../../src/cli/runCommand.js';
import { readSavedPipelineRun } from '../../src/config/runtimeSnapshot.js';
import type {
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../src/execution/types.js';

const S = '.ad-sdlc/scratchpad';
const ISSUES = `${S}/issues/demo/issue_list.json`;

const issueList = (criteria: boolean) =>
  JSON.stringify({
    issues: [
      { id: 'ISS-001', title: 'Add login', body: '## Acceptance Criteria\n- [ ] Signs in' },
      {
        id: 'ISS-002',
        title: 'Add logout',
        body: criteria ? '## Acceptance Criteria\n- [ ] Signs out' : 'Make logout work.',
      },
    ],
  });

/**
 * Implementation result of one work order whose criterion AC-001 is met and tested.
 * @param order - Work order number
 * @param issue - Issue number
 * @param name - Changed source file name
 * @returns Result YAML
 */
const implementationResult = (order: string, issue: string, name: string): string =>
  [
    'implementation_result:',
    `  work_order_id: WO-${order}`,
    `  issue_id: ISS-${issue}`,
    '  status: completed',
    '  changes:',
    `    - file_path: src/${name}.ts`,
    '      change_type: create',
    '  verification:',
    '    tests_passed: true',
    '    build_passed: true',
    '    lint_passed: true',
    '  acceptance_criteria:',
    '    - id: AC-001',
    '      status: met',
    `      tests: [tests/${name}.test.ts]`,
    '',
  ].join('\n');

/** Files every Import agent writes; all verification checks pass. */
function importOutputs(criteria = true): Record<string, Record<string, string>> {
  return {
    'issue-reader': { [ISSUES]: issueList(criteria) },
    controller: {
      [`${S}/progress/demo/work_orders/WO-001.yaml`]:
        'work_order:\n  id: WO-001\n  status: assigned\n  issue:\n    id: ISS-001\n',
      [`${S}/progress/demo/work_orders/WO-002.yaml`]:
        'work_order:\n  id: WO-002\n  status: assigned\n  issue:\n    id: ISS-002\n',
    },
    worker: {
      'src/login.ts': 'export const login = (): boolean => true;\n',
      'src/logout.ts': 'export const logout = (): boolean => true;\n',
      'tests/login.test.ts': "it('signs in', () => undefined);\n",
      'tests/logout.test.ts': "it('signs out', () => undefined);\n",
      [`${S}/progress/demo/results/WO-001-result.yaml`]: implementationResult(
        '001',
        '001',
        'login'
      ),
      [`${S}/progress/demo/results/WO-002-result.yaml`]: implementationResult(
        '002',
        '002',
        'logout'
      ),
    },
    'validation-agent': {
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

/** Writes each agent's files into the project; can fail an agent's first call. */
class FileAdapter implements ExecutionAdapter {
  readonly calls: string[] = [];
  constructor(
    private readonly files: Record<string, Record<string, string>>,
    private readonly failOnce = new Set<string>()
  ) {}
  async execute(request: StageExecutionRequest): Promise<StageExecutionResult> {
    this.calls.push(request.agentType);
    if (this.failOnce.delete(request.agentType)) throw new Error('transient adapter failure');
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

type Answer = { approve: boolean; reason?: string };

/** Queue prompt answers and return the messages the gate showed. */
function answers(...queue: Answer[]): string[] {
  const messages: string[] = [];
  prompt.mockImplementation(async (questions: { message: string }[]) => {
    messages.push(questions[0]!.message);
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected approval prompt');
    return next;
  });
  return messages;
}

let project: string;
const tty = {
  stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
  stderr: Object.getOwnPropertyDescriptor(process.stderr, 'isTTY'),
};

/** Make terminal detection deterministic for one test. */
function setTerminal(interactive: boolean): void {
  for (const stream of [process.stdin, process.stderr])
    Object.defineProperty(stream, 'isTTY', {
      value: interactive ? true : undefined,
      configurable: true,
    });
}

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'cli-approval-policy-'));
  await mkdir(join(project, '.ad-sdlc/config'), { recursive: true });
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({ version: '1.0.0', pipeline: { default_mode: 'import' } })
  );
  prompt.mockReset();
  setTerminal(false);
});
afterEach(async () => {
  for (const [name, descriptor] of Object.entries(tty)) {
    const stream = name === 'stdin' ? process.stdin : process.stderr;
    if (descriptor === undefined) delete (stream as { isTTY?: boolean }).isTTY;
    else Object.defineProperty(stream, 'isTTY', descriptor);
  }
  await rm(project, { recursive: true, force: true });
});

function opts(args: string[]) {
  // Resume keeps the saved retry policy and rejects policy overrides.
  const attempts = args.includes('--resume') ? [] : ['--max-attempts', '1'];
  return configureRunCommand(new Command())
    .exitOverride()
    .parse(['offline', '--project-dir', project, ...attempts, ...args], { from: 'user' })
    .opts();
}

async function run(
  args: string[],
  adapter: ExecutionAdapter,
  interactive?: boolean
): Promise<{ status: number; stdout: string[]; stderr: string[]; json: any }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await executeRunCommand('offline', opts(['--allow-stub', ...args]), {
    env: {},
    createAdapter: () => adapter,
    hasExecutionEnvironment: () => false,
    ...(interactive === undefined ? {} : { interactive }),
    output: {
      info: (message) => stdout.push(message),
      warn: (message) => stderr.push(message),
      error: (message) => stderr.push(message),
    },
  });
  let json: unknown;
  try {
    json = JSON.parse(stdout.join('\n'));
  } catch {
    json = undefined;
  }
  return { status, stdout, stderr, json };
}

function stage(result: { stages: { name: string }[] }, name: string): any {
  const found = result.stages.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`stage ${name} missing`);
  return found;
}

describe('manual approval', () => {
  it('shows the decision request content and records approved decisions', async () => {
    const messages = answers({ approve: true }, { approve: true });
    const adapter = new FileAdapter(importOutputs());

    const { status, json } = await run(
      ['--approval-mode', 'manual', '--format', 'json'],
      adapter,
      true
    );

    expect(status).toBe(0);
    expect(adapter.calls).toHaveLength(5);
    expect(messages).toHaveLength(2);
    const [orchestration, review] = messages;
    expect(orchestration).toContain('Decision required before stage "orchestration" (controller)');
    expect(orchestration).toContain('Policy: manual mode; boundaries: review');
    expect(orchestration).toContain('Request: offline');
    expect(orchestration).toContain(
      'Proposed action: Run stage "orchestration" (controller): Orchestrate work distribution from imported issues'
    );
    expect(orchestration).toContain(`issue_reading: ${ISSUES}`);
    expect(orchestration).toContain('Verification findings: none');
    expect(review).toContain('Policy: manual mode; boundaries: delivery');
    expect(review).toContain('External effects: push_branch, open_pull_request, merge');
    expect(review).toContain('it pushes a branch to the remote repository, opens a pull request');
    expect(review).toContain(`${S}/progress/demo/results/WO-001-result.yaml`);

    expect(json.overallStatus).toBe('completed');
    expect(json.approval).toMatchObject({
      status: 'approved',
      requested: 2,
      counts: { approved: 2, rejected: 0, pending: 0 },
      policy: {
        mode: 'manual',
        interactive: true,
        unattended: 'pause',
        source: { kind: 'cli', path: 'global.approval_mode', origin: 'CLI' },
      },
    });
    expect(json.approval.decisions.map((d: { stage: string }) => d.stage)).toEqual([
      'orchestration',
      'review',
    ]);
    for (const decision of json.approval.decisions)
      expect(decision).toMatchObject({
        outcome: 'approved',
        basis: 'prompt',
        decidedBy: 'user',
        mode: 'manual',
        sessionId: json.pipelineId,
        scope: { fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
      });
    expect(stage(json, 'review').approval.effects).toEqual([
      'push_branch',
      'open_pull_request',
      'merge',
    ]);
    // The decisions are durable in the session file.
    const saved = await readSavedPipelineRun(project, json.pipelineId);
    expect(
      (saved?.stages as { name: string; approval?: { outcome: string } }[]).find(
        (s) => s.name === 'orchestration'
      )?.approval?.outcome
    ).toBe('approved');
    expect((saved?.data['approval'] as { status: string }).status).toBe('approved');
  });

  it('rejection prevents the covered work, skips dependents, and is retained (exit 2)', async () => {
    answers({ approve: false, reason: 'ISS-002 is out of scope' });
    const adapter = new FileAdapter(importOutputs());

    const { status, json } = await run(
      ['--approval-mode', 'manual', '--format', 'json'],
      adapter,
      true
    );

    expect(status).toBe(2);
    expect(adapter.calls).toEqual(['issue-reader']);
    expect(json.overallStatus).toBe('rejected');
    expect(stage(json, 'orchestration')).toMatchObject({
      status: 'skipped',
      error: 'Approval rejected: ISS-002 is out of scope',
      approval: { outcome: 'rejected', reason: 'ISS-002 is out of scope', basis: 'prompt' },
    });
    for (const name of ['implementation', 'validation-agent', 'review'])
      expect(stage(json, name)).toMatchObject({
        status: 'skipped',
        error: "Skipped: 'orchestration' was rejected at its approval gate",
      });
    expect(json.approval).toMatchObject({
      status: 'rejected',
      counts: { approved: 0, rejected: 1, pending: 0 },
    });
  });

  it('prints the rejection in the text summary', async () => {
    answers({ approve: false, reason: 'Wrong issues' });
    const { status, stdout } = await run(
      ['--approval-mode', 'manual'],
      new FileAdapter(importOutputs()),
      true
    );
    expect(status).toBe(2);
    expect(stdout[0]).toMatch(/^Pipeline .+: rejected \(import\)$/);
    expect(stdout).toContain(
      '  orchestration: skipped (0 ms), approval rejected — Approval rejected: Wrong issues'
    );
    expect(stdout).toContain('Approval: rejected (mode manual from cli; interactive)');
    expect(stdout).toContain('  orchestration: rejected by user [review]: Wrong issues');
  });
});

describe('unattended runs', () => {
  it('pause without a terminal instead of appearing approved, then resume in one', async () => {
    const adapter = new FileAdapter(importOutputs());
    const paused = await run(['--approval-mode', 'manual', '--format', 'json'], adapter);

    expect(prompt).not.toHaveBeenCalled();
    expect(paused.status).toBe(3);
    expect(adapter.calls).toEqual(['issue-reader']);
    const result = paused.json;
    expect(result.overallStatus).toBe('awaiting_decision');
    expect(result.approval).toMatchObject({
      status: 'awaiting_decision',
      counts: { approved: 0, rejected: 0, pending: 1 },
      policy: { interactive: false, unattended: 'pause' },
    });
    expect(stage(result, 'orchestration')).toMatchObject({
      status: 'skipped',
      approval: { outcome: 'pending', basis: 'unattended', decidedBy: 'system' },
    });
    expect(stage(result, 'orchestration').error).toContain(`--resume ${result.pipelineId}`);
    for (const name of ['implementation', 'validation-agent', 'review'])
      expect(stage(result, name).error).toBe(
        "Skipped: run paused awaiting a decision at 'orchestration'"
      );

    // A person resumes the paused session in a terminal and approves.
    const messages = answers({ approve: true }, { approve: true });
    const resumedAdapter = new FileAdapter(importOutputs());
    const resumed = await run(
      ['--resume', result.pipelineId, '--format', 'json'],
      resumedAdapter,
      true
    );
    expect(resumed.status).toBe(0);
    expect(messages).toHaveLength(2);
    expect(resumedAdapter.calls).toEqual([
      'controller',
      'worker',
      'validation-agent',
      'pr-reviewer',
    ]);
    expect(resumed.json.overallStatus).toBe('completed');
    expect(resumed.json.approval.policy.source).toMatchObject({ kind: 'resume', origin: 'CLI' });
  });

  it('detects the missing terminal itself and honors --non-interactive in a terminal', async () => {
    // No injection: the gate reads stdin/stderr, which are not terminals here.
    const detected = await run(['--approval-mode', 'manual'], new FileAdapter(importOutputs()));
    expect(detected.status).toBe(3);
    expect(detected.stdout).toContain(
      'Approval: awaiting_decision (mode manual from cli; not interactive, a requested decision pauses the run)'
    );

    setTerminal(true);
    const flagged = await run(
      ['--approval-mode', 'manual', '--non-interactive', '--format', 'json'],
      new FileAdapter(importOutputs())
    );
    expect(prompt).not.toHaveBeenCalled();
    expect(flagged.status).toBe(3);

    // With a terminal and no flag, the gate prompts.
    const messages = answers({ approve: false });
    const asked = await run(['--approval-mode', 'manual'], new FileAdapter(importOutputs()));
    expect(messages).toHaveLength(1);
    expect(asked.status).toBe(2);
    expect(asked.stdout).toContain('  orchestration: rejected by user [review]: Rejected by user');
  });

  it('critical pauses only at the delivery boundary; review boundaries are approved by policy', async () => {
    const adapter = new FileAdapter(importOutputs());
    const { status, json } = await run(
      ['--approval-mode', 'critical', '--format', 'json'],
      adapter
    );

    expect(status).toBe(3);
    expect(adapter.calls).toEqual(['issue-reader', 'controller', 'worker', 'validation-agent']);
    expect(stage(json, 'orchestration').approval).toMatchObject({
      outcome: 'approved',
      basis: 'policy',
      boundaries: ['review'],
    });
    expect(stage(json, 'review').approval).toMatchObject({
      outcome: 'pending',
      boundaries: ['delivery'],
      effects: ['push_branch', 'open_pull_request', 'merge'],
    });
    expect(json.approval).toMatchObject({ status: 'awaiting_decision', requested: 1 });
  });
});

describe('critical boundaries', () => {
  it('requests a decision after a failed required check and shows the finding', async () => {
    const messages = answers({ approve: true }, { approve: false, reason: 'Do not merge yet' });
    const adapter = new FileAdapter(importOutputs(false));

    const { status, json } = await run(
      ['--approval-mode', 'critical', '--format', 'json'],
      adapter,
      true
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('Policy: critical mode; boundaries: review, failed_verification');
    expect(messages[0]).toContain(
      'issue_reading: [VR-IRD-003, required] 1 of 2 issue(s) state no acceptance criteria: ISS-002'
    );
    expect(stage(json, 'orchestration').approval.scope.findings).toEqual([
      expect.objectContaining({ stage: 'issue_reading', checkId: 'VR-IRD-003', required: true }),
    ]);
    // The delivery decision rejected the review stage: no pull request work ran.
    expect(adapter.calls).not.toContain('pr-reviewer');
    expect(status).toBe(2);
    expect(json.overallStatus).toBe('rejected');
  });
});

describe('autonomous profile', () => {
  it('auto requests nothing and records every boundary as approved by policy', async () => {
    const { status, json, stdout } = await (async () => {
      const first = await run(['--format', 'json'], new FileAdapter(importOutputs()));
      const text = await run([], new FileAdapter(importOutputs()));
      return { ...first, stdout: text.stdout };
    })();

    expect(prompt).not.toHaveBeenCalled();
    expect(status).toBe(0);
    expect(json.overallStatus).toBe('completed');
    expect(json.approval).toMatchObject({
      status: 'approved_by_policy',
      requested: 0,
      counts: { approved: 2, rejected: 0, pending: 0 },
      policy: { mode: 'auto', requests: [], source: { kind: 'default' } },
    });
    expect(json.approval.decisions.map((d: { basis: string }) => d.basis)).toEqual([
      'policy',
      'policy',
    ]);
    expect(stdout).toContain(
      'Approval: approved_by_policy (mode auto from default; not interactive, a requested decision pauses the run)'
    );
    expect(stdout).toContain(
      '  decisions: 2 approved, 0 rejected, 0 pending; 0 requested, 2 by policy'
    );
  });
});

describe('resume', () => {
  it('reuses an approval when the approved stage failed and is resumed', async () => {
    answers({ approve: true });
    const failing = new FileAdapter(importOutputs(), new Set(['controller']));
    const first = await run(['--approval-mode', 'manual', '--format', 'json'], failing, true);
    const pipelineId = first.json.result?.pipelineId ?? first.json.pipelineId;
    const firstResult = first.json.result ?? first.json;
    expect(stage(firstResult, 'orchestration')).toMatchObject({
      status: 'failed',
      approval: { outcome: 'approved', basis: 'prompt' },
    });

    const messages = answers({ approve: true });
    const adapter = new FileAdapter(importOutputs());
    const resumed = await run(['--resume', pipelineId, '--format', 'json'], adapter, true);

    expect(resumed.status).toBe(0);
    // Only the review boundary asks; the orchestration approval is reused.
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Decision required before stage "review"');
    expect(adapter.calls).toEqual(['controller', 'worker', 'validation-agent', 'pr-reviewer']);
    expect(stage(resumed.json, 'orchestration').approval).toMatchObject({
      outcome: 'approved',
      reused: true,
      decidedAt: stage(firstResult, 'orchestration').approval.decidedAt,
    });
  });

  it('reuses a rejection while the reviewed scope is unchanged', async () => {
    answers({ approve: false, reason: 'Not now' });
    const first = await run(
      ['--approval-mode', 'manual', '--format', 'json'],
      new FileAdapter(importOutputs()),
      true
    );
    expect(first.status).toBe(2);

    const adapter = new FileAdapter(importOutputs());
    const again = await run(['--resume', first.json.pipelineId, '--format', 'json'], adapter, true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(adapter.calls).toEqual([]);
    expect(again.status).toBe(2);
    expect(stage(again.json, 'orchestration').approval).toMatchObject({
      outcome: 'rejected',
      reason: 'Not now',
      reused: true,
    });
  });

  it('asks again when the reviewed scope changed', async () => {
    answers({ approve: false, reason: 'ISS-002 has no acceptance criteria' });
    const first = await run(
      ['--approval-mode', 'manual', '--format', 'json'],
      new FileAdapter(importOutputs(false)),
      true
    );
    const rejected = stage(first.json, 'orchestration').approval;

    // The operator fixes the reviewed issue list, then resumes.
    await writeFile(join(project, ISSUES), issueList(true));
    const messages = answers({ approve: true }, { approve: true });
    const adapter = new FileAdapter(importOutputs());
    const resumed = await run(
      ['--resume', first.json.pipelineId, '--format', 'json'],
      adapter,
      true
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('Decision required before stage "orchestration"');
    const approved = stage(resumed.json, 'orchestration').approval;
    expect(approved).toMatchObject({ outcome: 'approved', basis: 'prompt' });
    expect(approved.reused).toBeUndefined();
    expect(approved.scope.fingerprint).not.toBe(rejected.scope.fingerprint);
    expect(resumed.status).toBe(0);
  });

  it('drops an invalid saved record and asks again', async () => {
    answers({ approve: false, reason: 'Not now' });
    const first = await run(
      ['--approval-mode', 'manual', '--format', 'json'],
      new FileAdapter(importOutputs()),
      true
    );
    const file = join(project, S, 'pipeline', `${first.json.pipelineId}.yaml`);
    const saved = load(await readFile(file, 'utf8')) as {
      stages: { name: string; approval?: { outcome: string } }[];
    };
    for (const entry of saved.stages)
      if (entry.approval !== undefined) entry.approval.outcome = 'approved-by-tampering';
    await writeFile(file, dump(saved));

    const messages = answers({ approve: true }, { approve: true });
    const resumed = await run(
      ['--resume', first.json.pipelineId, '--format', 'json'],
      new FileAdapter(importOutputs()),
      true
    );
    expect(messages).toHaveLength(2);
    expect(stage(resumed.json, 'orchestration').approval.reused).toBeUndefined();
  });
});

describe('dry run and help', () => {
  it('shows the approval mode and each stage gate', async () => {
    const text = await run(['--dry-run', '--approval-mode', 'critical'], new FileAdapter({}));
    expect(text.status).toBe(0);
    expect(text.stdout).toContain(
      'Approval mode: critical (CLI); a requested decision without an interactive terminal pauses the run (exit status 3)'
    );
    expect(text.stdout).toContain(
      '  orchestration: controller, depends on [issue_reading], budget 300000 ms, gate review'
    );
    expect(text.stdout).toContain(
      '  review: pr-reviewer, depends on [validation-agent], budget 300000 ms, gate delivery (push_branch, open_pull_request, merge)'
    );
    expect(text.stdout).toContain(
      '  implementation: worker, depends on [orchestration], budget 300000 ms, no gate'
    );
    const json = await run(['--dry-run', '--format', 'json', '--local'], new FileAdapter({}));
    expect(json.json.stages.find((s: { name: string }) => s.name === 'review').effects).toEqual([
      'merge',
    ]);
  });

  it('states the autonomous default and the non-interactive behavior in help', () => {
    const help = configureRunCommand(new Command()).helpInformation();
    expect(help).toContain('auto (built-in default)');
    expect(help).toContain('--non-interactive');
    expect(help).toContain('pauses the run (exit status 3)');
  });
});
