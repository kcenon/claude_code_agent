/**
 * Offline validation of the Import live acceptance fixture (#955). Runs in the
 * ordinary offline lanes without credentials, GitHub, or SDK calls, and
 * proves that:
 * - the target repository's own tests pass, and its required gate fails when
 *   the live lane forces it;
 * - the independent acceptance tests fail on the unchanged target and pass on
 *   a reference solution, so they judge the issue's behavior and can pass;
 * - every seeded issue states acceptance criteria in the format the RTM
 *   builder reads, and the acceptance tests name only those criteria;
 * - the live Import invocation, its turn budget, and its resume invocation are
 *   valid for the production CLI;
 * - the scenario verdicts and the run report reject the failures they exist
 *   to catch.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claudeCredentialsPath, resolveLiveSettings } from '../../scripts/live-lane.js';
import { IMPORT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import { resolveProjectAgent } from '../../src/execution/resolveProjectAgent.js';
import { issueAcceptanceCriteria } from '../../src/rtm-builder/issueCriteria.js';
import {
  LOGIN_MIN_VALIDITY_MS,
  liveAuthArguments,
  liveChildEnv,
  parseCliJson,
  prepareClaudeConfigDir,
  runSourceCli,
} from '../live/harness.js';
import {
  IMPORT_AGENTS,
  IMPORT_FIXTURE,
  IMPORT_SCENARIOS,
  REQUIRED_FAIL_ENV,
  applyTurnBudget,
  evaluateScenario,
  importRequirements,
  importResumeArguments,
  importRunArguments,
  invocationEvidence,
  linkedIssues,
  loadIssueCorpus,
  materializeTarget,
  ownedPullRequests,
  renderImportReport,
  renderIssueBody,
  reportProblems,
  runAcceptance,
  runLabel,
  type ImportScenario,
  type InvocationEvidence,
  type ScenarioObservation,
  type ScenarioResult,
} from '../live/importScenario.js';

const budget = { maxTurns: 4, stageTimeoutMs: 60_000 };
const corpus = loadIssueCorpus();
const scenario = (id: ImportScenario['id']): ImportScenario => {
  const found = IMPORT_SCENARIOS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

/** Environment without credentials or live-lane settings. */
function offlineEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
  for (const key of Object.keys(env))
    if (/^(ANTHROPIC_|CLAUDE_API_KEY$|AD_SDLC_|GH_TOKEN$|GITHUB_TOKEN$|VITEST|NODE_TEST)/.test(key))
      delete env[key];
  return env;
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'import-fixture-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Run the target repository's own tests (`npm test` without npm). */
function targetTests(target: string, extra: NodeJS.ProcessEnv = {}): number | null {
  const tests = readdirSync(join(target, 'test')).map((file) => join('test', file));
  return spawnSync(process.execPath, ['--test', ...tests], {
    cwd: target,
    env: { ...offlineEnv(), ...extra },
    encoding: 'utf8',
    timeout: 60_000,
  }).status;
}

describe('Import target repository', () => {
  it('passes its own tests, and its required gate fails when the lane forces it', () => {
    const target = join(dir, 'target');
    materializeTarget(target);
    expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('.ad-sdlc/');
    expect(targetTests(target)).toBe(0);
    expect(targetTests(target, { [REQUIRED_FAIL_ENV]: '1' })).not.toBe(0);
  });

  it('fails every acceptance test before the issues are implemented', () => {
    const target = join(dir, 'target');
    materializeTarget(target);
    for (const issue of corpus.issues) {
      const result = runAcceptance(target, [issue.key]);
      expect(result.passed, issue.key).toBe(false);
    }
  });

  it('passes every acceptance test, and its own tests, on the reference solution', () => {
    const target = join(dir, 'target');
    materializeTarget(target);
    cpSync(IMPORT_FIXTURE.reference, target, { recursive: true });
    const result = runAcceptance(
      target,
      corpus.issues.map((issue) => issue.key)
    );
    expect(result.passed, result.output).toBe(true);
    expect(result.fail).toBe(0);
    expect(result.pass).toBe(result.tests);
    expect(targetTests(target)).toBe(0);
  });
});

describe('seeded issue corpus', () => {
  it('states criteria the RTM builder reads, and the acceptance tests name only those', () => {
    for (const issue of corpus.issues) {
      const criteria = issueAcceptanceCriteria({ body: renderIssueBody(issue, corpus) });
      expect(criteria.map((criterion) => criterion.id)).toEqual(
        issue.acceptanceCriteria.map((_, index) => `AC-${String(index + 1).padStart(3, '0')}`)
      );
      const test = readFileSync(join(IMPORT_FIXTURE.acceptance, `${issue.key}.test.mjs`), 'utf8');
      const named = [...test.matchAll(/AC-\d{3}/g)].map((match) => match[0]);
      expect(named.length, issue.key).toBeGreaterThan(0);
      for (const id of named) expect(criteria.map((criterion) => criterion.id)).toContain(id);
    }
  });

  it('defines scenarios over seeded issues with labels GitHub accepts', () => {
    const keys = corpus.issues.map((issue) => issue.key);
    expect(IMPORT_SCENARIOS.map((entry) => entry.id)).toEqual([
      'delivery',
      'required-fail',
      'resume',
    ]);
    for (const entry of IMPORT_SCENARIOS) {
      for (const key of entry.issues) expect(keys).toContain(key);
      expect(runLabel(Date.now().toString(36), entry.id).length).toBeLessThanOrEqual(50);
    }
    expect(scenario('required-fail').env).toEqual({ [REQUIRED_FAIL_ENV]: '1' });
    expect(scenario('resume').stopAfter).toBe('validation-agent');
    expect(IMPORT_STAGES.map((stage) => stage.name)).toContain('validation-agent');
  });
});

describe('live Import invocation (offline)', () => {
  it('is accepted by the production CLI with the turn budget on every Import agent', async () => {
    const claudeConfigDir = join(dir, 'claude-config');
    await mkdir(claudeConfigDir);
    const env = liveChildEnv(offlineEnv(), claudeConfigDir);
    const project = join(dir, 'import project');
    const init = runSourceCli(['init', project, '--quick', '--skip-validation'], env, 120_000);
    expect(init.status, init.stdout + init.stderr).toBe(0);
    applyTurnBudget(project, budget);
    for (const agent of IMPORT_AGENTS)
      expect((await resolveProjectAgent(project, agent)).maxTurns, agent).toBe(budget.maxTurns);

    const requirements = importRequirements(runLabel('offline', 'delivery'));
    const dryRun = runSourceCli(
      importRunArguments(project, budget, requirements, ['--dry-run']),
      env,
      60_000
    );
    expect(dryRun.status, dryRun.stdout + dryRun.stderr).toBe(0);
    const plan = parseCliJson(dryRun.stdout) as {
      ready: boolean;
      config: { mode: string; localMode: boolean; approvalMode: string; vnv: { profile?: string } };
      retryPolicy: { maxAttempts: number };
      stages: { name: string; timeoutMs: number }[];
      diagnostics: unknown[];
    };
    expect(plan).toMatchObject({
      ready: true,
      config: {
        mode: 'import',
        localMode: false,
        approvalMode: 'auto',
        vnv: { profile: 'delivery' },
      },
      retryPolicy: { maxAttempts: 1 },
      diagnostics: [],
    });
    expect(plan.stages.map((stage) => stage.name)).toEqual(
      IMPORT_STAGES.map((stage) => stage.name)
    );
    for (const stage of plan.stages) expect(stage.timeoutMs).toBe(budget.stageTimeoutMs);

    // The resume invocation, with the local-login flag, passes only flags resume
    // accepts (a runtime override would be rejected first); a missing session is reported.
    const resume = runSourceCli(
      [
        ...importResumeArguments(
          project,
          requirements,
          'offline-session',
          liveAuthArguments({ auth: 'local-login' })
        ),
        '--dry-run',
      ],
      env,
      60_000
    );
    expect(resume.status).toBe(1);
    const diagnostics = (parseCliJson(resume.stdout) as { diagnostics: { reason: string }[] })
      .diagnostics;
    expect(diagnostics.map((entry) => entry.reason).join(' ')).toMatch(/Session not found/);
  }, 180_000);
});

describe('scenario evidence and verdicts', () => {
  const attempt = (stage: string, overrides: Record<string, unknown> = {}) => ({
    kind: 'attempt',
    stage,
    outcome: 'succeeded',
    execution: 'sdk',
    sdkSessionId: `s-${stage}`,
    modelId: 'claude-model',
    sdkVersion: '1.0.0',
    usage: { inputTokens: 10, outputTokens: 5 },
    durationMs: 100,
    errorType: null,
    ...overrides,
  });
  const stageRecord = (stage: string, status = 'completed', restored = false) => ({
    kind: 'stage',
    stage,
    status,
    restored,
    attempts: { total: restored ? 0 : 1 },
    verification: { state: status === 'failed' ? 'failed' : 'verified_pass' },
  });
  const names = IMPORT_STAGES.map((stage) => stage.name);
  const invocation = (
    name: string,
    status: string,
    exitCode: number,
    stages: Record<string, unknown>[],
    attempts: Record<string, unknown>[],
    resumed = false
  ): InvocationEvidence =>
    invocationEvidence(
      name,
      {
        status: exitCode,
        signal: null,
        stdout: `${JSON.stringify({
          pipelineId: 'session-1',
          overallStatus: status,
          metrics: {
            records: [...attempts, ...stages, { kind: 'pipeline', status, resume: { resumed } }],
          },
        })}\n`,
      },
      1000
    );
  const pr = {
    number: 7,
    state: 'OPEN',
    merged: false,
    headRefName: 'feature/x',
    linkedIssues: [1, 2],
  };
  const passed = { passed: true, tests: 3, pass: 3, fail: 0 };
  const delivered: ScenarioObservation = {
    invocations: [
      invocation(
        'run',
        'completed',
        0,
        names.map((name) => stageRecord(name)),
        names.map((name) => attempt(name))
      ),
    ],
    issues: [1, 2],
    pullRequests: [{ ...pr, acceptance: passed }],
    snapshots: [{ pullRequests: [7], labeledIssues: 2, heads: { '7': 'abc' } }],
  };

  it('reads the evidence of a run result and of a failed-run wrapper', () => {
    const [first] = delivered.invocations;
    expect(first).toMatchObject({ sessionId: 'session-1', status: 'completed', exitCode: 0 });
    expect(first?.attempts[0]).toMatchObject({ sdkSessionId: 's-issue_reading', inputTokens: 10 });
    const failed = invocationEvidence(
      'run',
      {
        status: 1,
        signal: null,
        stdout: JSON.stringify({
          ready: false,
          error: 'Verification failed',
          result: { pipelineId: 'session-2', overallStatus: 'partial', metrics: { records: [] } },
        }),
      },
      10
    );
    expect(failed).toMatchObject({
      sessionId: 'session-2',
      status: 'partial',
      error: 'Verification failed',
    });
    expect(
      invocationEvidence('run', { status: null, signal: 'SIGTERM', stdout: '' }, 1).error
    ).toMatch(/No JSON/);
  });

  it('accepts a delivered run and rejects merged, unlinked, or failing pull requests', () => {
    expect(evaluateScenario(scenario('delivery'), delivered)).toEqual([]);
    expect(
      evaluateScenario(scenario('delivery'), {
        ...delivered,
        pullRequests: [
          {
            ...pr,
            merged: true,
            state: 'MERGED',
            linkedIssues: [1],
            acceptance: { ...passed, passed: false },
          },
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        'pull request #7 was merged',
        'acceptance tests did not pass on pull request #7',
        'issue #2 is not linked by a pull request',
      ])
    );
    expect(
      evaluateScenario(scenario('delivery'), {
        ...delivered,
        invocations: [
          invocation(
            'run',
            'completed',
            0,
            [stageRecord('review')],
            [attempt('review', { sdkSessionId: null })]
          ),
        ],
      })
    ).toContain('run review: no SDK session ID');
  });

  it('accepts a blocked delivery and rejects a run that reports success despite the failed test', () => {
    const blocked: ScenarioObservation = {
      invocations: [
        invocation(
          'run',
          'partial',
          1,
          [
            stageRecord('implementation'),
            stageRecord('validation-agent', 'failed'),
            stageRecord('review', 'skipped'),
          ],
          [attempt('implementation'), attempt('validation-agent')]
        ),
      ],
      issues: [1],
      pullRequests: [],
      snapshots: [{ pullRequests: [], labeledIssues: 1, heads: {} }],
    };
    expect(evaluateScenario(scenario('required-fail'), blocked)).toEqual([]);
    expect(
      evaluateScenario(scenario('required-fail'), {
        ...delivered,
        issues: [1, 2],
      })
    ).toEqual(
      expect.arrayContaining([
        'run exited 0 although a required test failed',
        'run reported completed delivery',
        '1 pull request(s) were opened',
      ])
    );
  });

  it('accepts an idempotent resume and rejects re-run stages, new commits, and duplicate issues', () => {
    const before = names.filter((name) => name !== 'review');
    const resumedRun: ScenarioObservation = {
      invocations: [
        invocation(
          'run',
          'completed',
          0,
          before.map((name) => stageRecord(name)),
          before.map((name) => attempt(name))
        ),
        invocation(
          'resume-1',
          'completed',
          0,
          [...before.map((name) => stageRecord(name, 'completed', true)), stageRecord('review')],
          [attempt('review')],
          true
        ),
        invocation(
          'resume-2',
          'completed',
          0,
          names.map((name) => stageRecord(name, 'completed', true)),
          [],
          true
        ),
      ],
      issues: [3],
      pullRequests: [{ ...pr, linkedIssues: [3], acceptance: passed }],
      snapshots: [
        { pullRequests: [], labeledIssues: 1, heads: {} },
        { pullRequests: [7], labeledIssues: 1, heads: { '7': 'abc' } },
        { pullRequests: [7], labeledIssues: 1, heads: { '7': 'abc' } },
      ],
    };
    expect(evaluateScenario(scenario('resume'), resumedRun)).toEqual([]);
    const [run, resumed] = resumedRun.invocations;
    expect(
      evaluateScenario(scenario('resume'), {
        ...resumedRun,
        invocations: [
          run!,
          resumed!,
          invocation(
            'resume-2',
            'completed',
            0,
            [stageRecord('review')],
            [attempt('review')],
            true
          ),
        ],
        snapshots: [
          { pullRequests: [], labeledIssues: 1, heads: {} },
          { pullRequests: [7], labeledIssues: 1, heads: { '7': 'abc' } },
          { pullRequests: [7, 8], labeledIssues: 2, heads: { '7': 'def', '8': 'ghi' } },
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        'resuming a completed session made SDK attempts',
        'resuming a completed session changed the pull requests',
        'resuming a completed session pushed new commits',
        'resume-2: 2 labeled issues instead of 1',
      ])
    );
    expect(
      evaluateScenario(scenario('resume'), {
        ...resumedRun,
        invocations: [
          run!,
          invocation(
            'resume-1',
            'completed',
            0,
            names.map((name) => stageRecord(name)),
            names.map((name) => attempt(name)),
            true
          ),
          resumedRun.invocations[2]!,
        ],
      })
    ).toEqual(
      expect.arrayContaining([
        'resume re-ran completed stage implementation',
        'resume made SDK attempts for stages completed before the stop',
      ])
    );
  });

  it('identifies the pull requests a run created and the issues they link', () => {
    const list = [
      { number: 1, headRefName: 'old', state: 'CLOSED', mergedAt: null, title: 'old', body: '' },
      {
        number: 9,
        headRefName: 'new',
        state: 'OPEN',
        mergedAt: null,
        title: 'Add slugify',
        body: 'Closes #4, see #45',
      },
    ];
    expect(ownedPullRequests([1], list).map((entry) => entry.number)).toEqual([9]);
    expect(linkedIssues(list[1]!, [4, 5, 45])).toEqual([4, 45]);
    expect(
      linkedIssues({ ...list[1]!, body: '', closingIssuesReferences: [{ number: 5 }] }, [4, 5])
    ).toEqual([5]);
  });

  it('reports every scenario, invocation, and attempt, including unsuccessful and restored ones', () => {
    const result = (
      id: ImportScenario['id'],
      invocations: InvocationEvidence[]
    ): ScenarioResult => ({
      id,
      description: scenario(id).description,
      outcome: 'passed',
      reason: null,
      label: runLabel('r1', id),
      issues: [{ key: 'slugify', number: 1 }],
      invocations,
      pullRequests: [],
      cleanup: ['closed issue #1'],
    });
    const results = [
      result('delivery', delivered.invocations),
      result('required-fail', [
        invocation(
          'run',
          'partial',
          1,
          [stageRecord('validation-agent', 'failed')],
          [attempt('validation-agent', { outcome: 'failed', sdkSessionId: 's-failed' })]
        ),
      ]),
      result('resume', [
        invocation(
          'resume-1',
          'completed',
          0,
          [stageRecord('implementation', 'completed', true)],
          [],
          true
        ),
      ]),
    ];
    const meta = {
      runId: 'r1',
      repository: 'owner/target',
      packageVersion: '0.1.0',
      sdkVersion: '1.0.0',
      budget,
      startedAt: '2026-10-28T00:00:00.000Z',
      finishedAt: '2026-10-28T01:00:00.000Z',
    };
    const markdown = renderImportReport(meta, results);
    expect(reportProblems(results, markdown)).toEqual([]);
    expect(markdown).toContain('| validation-agent | failed | false |');
    expect(markdown).toContain('s-failed');
    expect(
      reportProblems(results.slice(0, 1), renderImportReport(meta, results.slice(0, 1)))
    ).toEqual(
      expect.arrayContaining([
        'scenario required-fail is missing',
        'the report shows no unsuccessful or skipped stage',
        'the report shows no restored stage',
      ])
    );
  });
});

describe('live lane settings for the Import scenarios', () => {
  it('requires the disposable repository and its token, and validates the repository name', () => {
    expect(resolveLiveSettings({ ANTHROPIC_API_KEY: 'k' }, dir).missing).toEqual([
      'AD_SDLC_LIVE_GITHUB_REPO',
      'AD_SDLC_LIVE_GITHUB_TOKEN',
    ]);
    const invalid = resolveLiveSettings(
      {
        ANTHROPIC_API_KEY: 'k',
        AD_SDLC_LIVE_GITHUB_REPO: 'not a repo',
        AD_SDLC_LIVE_GITHUB_TOKEN: 't',
      },
      dir
    );
    expect(invalid.ready).toBe(false);
    expect(invalid.reason).toMatch(/invalid AD_SDLC_LIVE_GITHUB_REPO="not a repo"/);
    expect(
      resolveLiveSettings(
        {
          ANTHROPIC_API_KEY: 'k',
          AD_SDLC_LIVE_GITHUB_REPO: 'owner/target',
          AD_SDLC_LIVE_GITHUB_TOKEN: 't',
        },
        dir
      ).ready
    ).toBe(true);
  });

  it('replaces the API key and token with the machine logins in local-login mode', () => {
    const repo = { AD_SDLC_LIVE_AUTH: 'local-login', AD_SDLC_LIVE_GITHUB_REPO: 'owner/target' };
    const withLogin = resolveLiveSettings({ ...repo, HOME: dir }, dir, () => true);
    expect(withLogin).toMatchObject({ ready: true, auth: 'local-login', missing: [] });
    const withoutLogin = resolveLiveSettings({ ...repo, HOME: dir }, dir, () => false);
    expect(withoutLogin.missing).toEqual(['Claude Code login']);
    expect(claudeCredentialsPath({ CLAUDE_CONFIG_DIR: join(dir, 'cfg') })).toBe(
      join(dir, 'cfg', '.credentials.json')
    );
    expect(resolveLiveSettings({ AD_SDLC_LIVE_AUTH: 'sso' }, dir).reason).toMatch(
      /invalid AD_SDLC_LIVE_AUTH="sso"/
    );
    expect(liveAuthArguments({ auth: 'secrets' })).toEqual([]);
  });

  it('copies only a login that stays valid, and nothing in secrets mode', async () => {
    const userConfig = join(dir, 'user-claude');
    await mkdir(userConfig);
    const now = Date.parse('2026-10-28T00:00:00Z');
    const write = (minutes: number): Promise<void> =>
      writeFile(
        join(userConfig, '.credentials.json'),
        JSON.stringify({ claudeAiOauth: { expiresAt: now + minutes * 60_000 } })
      );
    const env = { CLAUDE_CONFIG_DIR: userConfig };

    await write(LOGIN_MIN_VALIDITY_MS / 60_000 + 30);
    await prepareClaudeConfigDir(join(dir, 'run-1'), { auth: 'local-login' }, env, now);
    expect(readdirSync(join(dir, 'run-1'))).toEqual(['.credentials.json']);

    await write(LOGIN_MIN_VALIDITY_MS / 60_000 - 1);
    await expect(
      prepareClaudeConfigDir(join(dir, 'run-2'), { auth: 'local-login' }, env, now)
    ).rejects.toThrow(/must stay valid/);
    expect(readdirSync(join(dir, 'run-2'))).toEqual([]);

    await prepareClaudeConfigDir(join(dir, 'run-3'), { auth: 'secrets' }, env, now);
    expect(readdirSync(join(dir, 'run-3'))).toEqual([]);
  });
});
