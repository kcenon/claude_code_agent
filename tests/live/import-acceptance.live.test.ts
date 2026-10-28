/**
 * Live acceptance lane: Import scenarios (#955).
 *
 * Installs the packed npm package in a separate directory and drives
 * `ad-sdlc init` and `ad-sdlc run --mode import` with the real Claude Agent
 * SDK against clones of the disposable GitHub repository named by
 * AD_SDLC_LIVE_GITHUB_REPO:
 *
 * (a) delivery: imported issues become one open, unmerged pull request that
 *     the independent acceptance tests pass on;
 * (b) a failing required test blocks successful delivery;
 * (c) a run stopped after validation resumes from durable state, and a second
 *     resume of the completed session changes nothing;
 * (d) the run report lists every invocation and attempt, including the
 *     unsuccessful and restored ones.
 *
 * Each scenario seeds its own issues under its own label and removes only
 * what it created, and starts from the fixture on the default branch. The
 * requirements tell the reviewer to leave the pull request open; a rule that
 * requires an approving review on the default branch, where the plan allows
 * one, makes a merge impossible, and a merged pull request fails the scenario.
 *
 * Selected only by vitest.live.config.ts through `npm run test:live`. Without
 * the required settings every test fails instead of skipping.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIVE_FILES, notExecutedMessage, resolveLiveSettings } from '../../scripts/live-lane.js';
import { IMPORT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import {
  assertDisposableRepository,
  cleanupRun,
  cloneRepository,
  createIssue,
  createLabel,
  ensureFixture,
  githubEnv,
  listBranches,
  listLabeledIssues,
  listPullRequests,
} from './githubTarget.js';
import { liveAuthArguments, liveChildEnv, prepareClaudeConfigDir } from './harness.js';
import {
  IMPORT_SCENARIOS,
  evaluateScenario,
  exec,
  importRequirements,
  type InstalledCli,
  importResumeArguments,
  importRunArguments,
  installPackedPackage,
  invocationEvidence,
  linkedIssues,
  loadIssueCorpus,
  ownedPullRequests,
  prepareImportProject,
  renderImportReport,
  renderIssueBody,
  reportProblems,
  runAcceptance,
  runLabel,
  type ImportReportMeta,
  type ImportScenario,
  type InvocationEvidence,
  type PullRequestEvidence,
  type ScenarioResult,
  type ScenarioSnapshot,
} from './importScenario.js';

const settings = resolveLiveSettings(process.env);
const repo = (process.env['AD_SDLC_LIVE_GITHUB_REPO'] ?? '').trim();
const runId = Date.now().toString(36);
/** One invocation runs every Import stage within its stage budget. */
const cliTimeoutMs = settings.budget.stageTimeoutMs * IMPORT_STAGES.length + 120_000;
const scenarioTimeoutMs = cliTimeoutMs * 3 + 600_000;

interface LiveContext {
  readonly root: string;
  readonly cli: InstalledCli;
  readonly env: NodeJS.ProcessEnv;
  /** Default branch of the target repository */
  readonly branch: string;
  readonly packageVersion: string | null;
  readonly sdkVersion: string | null;
}

let context: LiveContext | undefined;
const results: ScenarioResult[] = [];
const startedAt = new Date().toISOString();

async function versionOf(packageJson: string): Promise<string | null> {
  try {
    return (
      (JSON.parse(await readFile(packageJson, 'utf8')) as { version?: string }).version ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Check the settings and the repository, put the fixture on its default
 * branch, and install the packed package.
 * @returns Live context
 */
async function setUp(): Promise<LiveContext> {
  if (!settings.ready) throw new Error(notExecutedMessage(settings));
  const root = await mkdtemp(join(tmpdir(), 'ad-sdlc-import-live-'));
  await prepareClaudeConfigDir(join(root, 'claude-config'), settings);
  const base = liveChildEnv(process.env, join(root, 'claude-config'));
  const token = settings.auth === 'secrets' ? base['AD_SDLC_LIVE_GITHUB_TOKEN'] : undefined;
  delete base['AD_SDLC_LIVE_GITHUB_TOKEN'];
  const env = githubEnv(base, token, root);
  // local-login mode: fail early when gh is not logged in.
  if (token === undefined) exec('gh', ['auth', 'status'], { env });
  const branch = assertDisposableRepository(repo, env);
  const cli = installPackedPackage(process.cwd(), join(root, 'package'), env);
  const modules = join(root, 'package', 'consumer', 'node_modules');
  return {
    root,
    cli,
    env,
    branch,
    packageVersion: await versionOf(join(modules, 'ad-sdlc', 'package.json')),
    sdkVersion: await versionOf(join(modules, '@anthropic-ai', 'claude-agent-sdk', 'package.json')),
  };
}

/**
 * Pull request evidence, with the acceptance tests run on each head commit.
 * @param live - Live context
 * @param scenario - Scenario
 * @param prsBefore - Pull request numbers before the scenario
 * @param issues - Seeded issue numbers
 * @returns Evidence of the pull requests the scenario created
 */
function pullRequestEvidence(
  live: LiveContext,
  scenario: ImportScenario,
  prsBefore: readonly number[],
  issues: readonly number[]
): PullRequestEvidence[] {
  return ownedPullRequests(prsBefore, listPullRequests(repo, live.env)).map((pr) => {
    const checkout = join(live.root, `pr-${scenario.id}-${String(pr.number)}`);
    cloneRepository(repo, checkout, live.env);
    exec('git', ['fetch', 'origin', `pull/${String(pr.number)}/head`], {
      cwd: checkout,
      env: live.env,
    });
    exec('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: checkout, env: live.env });
    const { output: _output, ...acceptance } = runAcceptance(checkout, scenario.issues);
    return {
      number: pr.number,
      state: pr.state,
      merged: pr.mergedAt !== null,
      headRefName: pr.headRefName,
      linkedIssues: linkedIssues(pr, issues),
      acceptance,
    };
  });
}

/**
 * Run one scenario end to end and always clean up what it created.
 * @param live - Live context
 * @param scenario - Scenario
 * @returns Result, also appended to the report
 */
async function runScenario(live: LiveContext, scenario: ImportScenario): Promise<ScenarioResult> {
  const corpus = loadIssueCorpus();
  const label = runLabel(runId, scenario.id);
  const requirements = importRequirements(label);
  // Every scenario starts from the fixture, even if an earlier one changed the
  // default branch (a merge the repository could not prevent is a failure there).
  ensureFixture(repo, live.branch, join(live.root, `fixture-${scenario.id}`), live.env);
  const prsBefore = listPullRequests(repo, live.env).map((pr) => pr.number);
  const branchesBefore = new Set(listBranches(repo, live.env));
  const issues: { key: string; number: number }[] = [];
  const invocations: InvocationEvidence[] = [];
  const snapshots: ScenarioSnapshot[] = [];
  let pullRequests: PullRequestEvidence[] = [];
  let problems: string[] = [];
  let cleanup: string[] = [];
  try {
    createLabel(repo, label, live.env);
    for (const key of scenario.issues) {
      const issue = corpus.issues.find((entry) => entry.key === key);
      if (issue === undefined) throw new Error(`Unknown seeded issue ${key}`);
      issues.push({
        key,
        number: createIssue(
          repo,
          { title: issue.title, body: renderIssueBody(issue, corpus), label },
          live.env
        ),
      });
    }
    const checkout = join(live.root, `checkout-${scenario.id}`);
    cloneRepository(repo, checkout, live.env);
    prepareImportProject(live.cli, checkout, settings.budget, live.env);
    const auth = liveAuthArguments(settings);
    const runEnv = { ...live.env, ...scenario.env };
    const snapshot = (): void => {
      const owned = ownedPullRequests(prsBefore, listPullRequests(repo, live.env));
      snapshots.push({
        pullRequests: owned.map((pr) => pr.number),
        labeledIssues: listLabeledIssues(repo, label, live.env).length,
        heads: Object.fromEntries(owned.map((pr) => [String(pr.number), pr.headRefOid ?? ''])),
      });
    };
    const invoke = (name: string, args: string[]): InvocationEvidence => {
      const started = Date.now();
      const child = spawnSync(live.cli.command, [...live.cli.args, ...args], {
        cwd: checkout,
        env: runEnv,
        encoding: 'utf8',
        timeout: cliTimeoutMs,
        killSignal: 'SIGTERM',
        maxBuffer: 50 * 1024 * 1024,
      });
      const evidence = invocationEvidence(name, child, Date.now() - started);
      invocations.push(evidence);
      snapshot();
      return evidence;
    };

    const first = invoke(
      'run',
      importRunArguments(
        checkout,
        settings.budget,
        requirements,
        scenario.stopAfter === undefined ? auth : [...auth, '--stop-after', scenario.stopAfter]
      )
    );
    if (scenario.stopAfter !== undefined) {
      if (first.sessionId === null) throw new Error('The stopped run reported no session ID');
      invoke('resume-1', importResumeArguments(checkout, requirements, first.sessionId, auth));
      invoke('resume-2', importResumeArguments(checkout, requirements, first.sessionId, auth));
    }
    pullRequests = pullRequestEvidence(
      live,
      scenario,
      prsBefore,
      issues.map((issue) => issue.number)
    );
    problems = evaluateScenario(scenario, {
      invocations,
      issues: issues.map((issue) => issue.number),
      pullRequests,
      snapshots,
    });
  } catch (error) {
    problems = [...problems, error instanceof Error ? error.message : String(error)];
  } finally {
    cleanup = cleanupRun(
      repo,
      {
        label,
        issues: issues.map((issue) => issue.number),
        pullRequests: ownedPullRequests(prsBefore, listPullRequests(repo, live.env)),
        branches: listBranches(repo, live.env).filter((branch) => !branchesBefore.has(branch)),
      },
      live.env
    );
  }
  const result: ScenarioResult = {
    id: scenario.id,
    description: scenario.description,
    outcome: problems.length === 0 ? 'passed' : 'failed',
    reason: problems.length === 0 ? null : problems.join('; '),
    label,
    issues,
    invocations,
    pullRequests,
    cleanup,
  };
  results.push(result);
  return result;
}

/**
 * Write the JSON and Markdown run reports to the lane output directory.
 * @returns Rendered Markdown
 */
async function writeReport(): Promise<string> {
  const meta: ImportReportMeta = {
    runId,
    repository: repo,
    packageVersion: context?.packageVersion ?? null,
    sdkVersion: context?.sdkVersion ?? null,
    budget: settings.budget,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  const markdown = renderImportReport(meta, results);
  await mkdir(settings.outputDir, { recursive: true });
  await writeFile(
    join(settings.outputDir, LIVE_FILES.importReport),
    `${JSON.stringify({ schemaVersion: 1, ...meta, scenarios: results }, null, 2)}\n`
  );
  await writeFile(join(settings.outputDir, LIVE_FILES.importSummary), markdown);
  return markdown;
}

describe('Import live acceptance (#955)', () => {
  beforeAll(async () => {
    context = await setUp();
  }, 1_200_000);

  afterAll(async () => {
    // Without the settings nothing ran; the lane metadata already says so.
    if (settings.ready) await writeReport();
    if (context !== undefined) await rm(context.root, { recursive: true, force: true });
  });

  const scenario = (id: ImportScenario['id']): ImportScenario => {
    const found = IMPORT_SCENARIOS.find((entry) => entry.id === id);
    if (found === undefined) throw new Error(`Unknown scenario ${id}`);
    return found;
  };
  const live = (): LiveContext => {
    if (context === undefined) throw new Error(notExecutedMessage(settings));
    return context;
  };

  it(
    '(a) delivers imported issues as an open pull request that passes the acceptance tests',
    async () => {
      const result = await runScenario(live(), scenario('delivery'));
      expect(result.reason).toBeNull();
    },
    scenarioTimeoutMs
  );

  it(
    '(b) does not report delivery when a required test fails',
    async () => {
      const result = await runScenario(live(), scenario('required-fail'));
      expect(result.reason).toBeNull();
    },
    scenarioTimeoutMs
  );

  it(
    '(c) resumes a stopped run without duplicate issues, pull requests, or commits',
    async () => {
      const result = await runScenario(live(), scenario('resume'));
      expect(result.reason).toBeNull();
    },
    scenarioTimeoutMs
  );

  it('(d) reports every invocation and attempt, including unsuccessful and restored ones', async () => {
    const markdown = await writeReport();
    expect(reportProblems(results, markdown)).toEqual([]);
  });
});
