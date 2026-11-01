/**
 * Live acceptance lane: Enhancement scenarios (#957).
 *
 * Installs the packed npm package in a separate directory and drives
 * `ad-sdlc init` and `ad-sdlc run --mode enhancement` with the real Claude Agent
 * SDK against clones of the disposable GitHub repository named by
 * AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO, or AD_SDLC_LIVE_GITHUB_REPO without it:
 *
 * (a) delivery: the requested feature becomes one open, unmerged pull request; the
 *     comparison reports the planted drift, the documents change only as expected,
 *     and the independent retained and feature tests pass on its head;
 * (b) regression: a run stopped after implementation resumes with a retained test
 *     failing, and regression testing blocks delivery;
 * (c) the run report lists every invocation and attempt, usage and duration per
 *     run, the unresolved drift, and the before/after document diff.
 *
 * Each scenario removes only what it created, and starts from the fixture on the
 * default branch. Selected through `AD_SDLC_LIVE_SUITE` (`enhancement` or `all`) by
 * `npm run test:live`. Without the required settings every test fails instead of
 * skipping. The upper bound of a run is 15 + 12 stage attempts plus the smoke.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIVE_FILES, notExecutedMessage, resolveLiveSettings } from '../../scripts/live-lane.js';
import { ENHANCEMENT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import {
  COMPARISON_STAGE,
  ENHANCEMENT_SCENARIOS,
  REGRESSION_ENV,
  deliveryReviewTemplate,
  driftEvidence,
  enhancementReportProblems,
  enhancementRequirements,
  enhancementRunArguments,
  judgeEnhancementScenario,
  judgePullRequestHead,
  loadEnhancementExpectation,
  materializeEnhancementTarget,
  prepareEnhancementProject,
  redactValues,
  regressionSwitchSeen,
  renderDocumentDiffs,
  renderEnhancementReport,
  runSummary,
  stageArtifactPaths,
  type DriftEvidence,
  type EnhancementPullRequest,
  type EnhancementReportMeta,
  type EnhancementScenario,
  type EnhancementScenarioResult,
  type JudgeRow,
  type RunSummary,
} from './enhancementScenario.js';
import {
  assertDisposableRepository,
  cleanupRun,
  cloneRepository,
  ensureFixture,
  githubEnv,
  listBranches,
  listIssues,
  listLabels,
  listPullRequests,
  type TargetFixture,
} from './githubTarget.js';
import {
  LIVE_PERMISSIONS,
  liveAuthArguments,
  liveChildEnv,
  prepareClaudeConfigDir,
} from './harness.js';
import {
  exec,
  installPackedPackage,
  invocationEvidence,
  ownedIssues,
  ownedPullRequests,
  pipelineResumeArguments,
  type GithubPullRequest,
  type InstalledCli,
  type InvocationEvidence,
} from './scenarioSupport.js';

const settings = resolveLiveSettings(process.env);
const repo = settings.enhancementRepo ?? '';
const runId = Date.now().toString(36);
/** One invocation runs at most every Enhancement stage within its stage budget. */
const cliTimeoutMs = settings.budget.stageTimeoutMs * ENHANCEMENT_STAGES.length + 120_000;
const scenarioTimeoutMs = cliTimeoutMs * 2 + 600_000;

const TARGET_FIXTURE: TargetFixture = {
  materialize: materializeEnhancementTarget,
  commitMessage: 'test: reset the AD-SDLC Enhancement fixture',
};

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
const results: EnhancementScenarioResult[] = [];
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
 * Check the settings and the repository, reset the default branch to the fixture
 * (a rejected reset fails here, before any SDK call of this file), and install the
 * packed package.
 * @returns Live context
 */
async function setUp(): Promise<LiveContext> {
  if (!settings.ready) throw new Error(notExecutedMessage(settings));
  const root = await mkdtemp(join(tmpdir(), 'ad-sdlc-enhancement-live-'));
  await prepareClaudeConfigDir(join(root, 'claude-config'), settings);
  const base = liveChildEnv(process.env, join(root, 'claude-config'));
  const token = settings.auth === 'secrets' ? base['AD_SDLC_LIVE_GITHUB_TOKEN'] : undefined;
  delete base['AD_SDLC_LIVE_GITHUB_TOKEN'];
  // Set for the resumed invocation of the regression scenario only.
  delete base[REGRESSION_ENV];
  const env = githubEnv(base, token, root);
  // local-login mode: fail early when gh is not logged in.
  if (token === undefined) exec('gh', ['auth', 'status'], { env });
  const branch = assertDisposableRepository(repo, env);
  ensureFixture(repo, branch, join(root, 'fixture-setup'), env, TARGET_FIXTURE);
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
 * Judge one pull request on a clone holding its head and the commit it branched from.
 * @param live - Live context
 * @param scenario - Scenario
 * @param pr - Pull request
 * @returns Evidence
 */
function judgedPullRequest(
  live: LiveContext,
  scenario: EnhancementScenario,
  pr: GithubPullRequest
): EnhancementPullRequest {
  const checkout = join(live.root, `pr-${scenario.id}-${String(pr.number)}`);
  cloneRepository(repo, checkout, live.env);
  const git = (args: readonly string[]): string =>
    exec('git', args, { cwd: checkout, env: live.env }).trim();
  git(['fetch', 'origin', `pull/${String(pr.number)}/head`]);
  const head = git(['rev-parse', 'FETCH_HEAD']);
  const base = git(['merge-base', `origin/${live.branch}`, head]);
  return {
    number: pr.number,
    state: pr.state,
    merged: pr.mergedAt !== null,
    headRefName: pr.headRefName,
    judgement: judgePullRequestHead(checkout, base, head, loadEnhancementExpectation(), live.env),
  };
}

/**
 * Run one scenario end to end and always clean up what it created.
 * @param live - Live context
 * @param scenario - Scenario
 * @returns Result, also appended to the report
 */
async function runScenario(
  live: LiveContext,
  scenario: EnhancementScenario
): Promise<EnhancementScenarioResult> {
  const expectation = loadEnhancementExpectation();
  const requirements = enhancementRequirements(expectation);
  // Every scenario starts from the fixture, even if an earlier one changed the
  // default branch (a merge the repository could not prevent is a failure there).
  ensureFixture(
    repo,
    live.branch,
    join(live.root, `fixture-${scenario.id}`),
    live.env,
    TARGET_FIXTURE
  );
  const prsBefore = listPullRequests(repo, live.env).map((pr) => pr.number);
  const issuesBefore = listIssues(repo, live.env);
  const branchesBefore = new Set(listBranches(repo, live.env));
  const labelsBefore = new Set(listLabels(repo, live.env));
  const invocations: InvocationEvidence[] = [];
  const runs: RunSummary[] = [];
  let pullRequests: EnhancementPullRequest[] = [];
  let pullRequestsAtStop = 0;
  let drift: DriftEvidence | null = null;
  let switchSeen = false;
  let rows: JudgeRow[] = [];
  let failure: string | null = null;
  let issues: number[] = [];
  let cleanup: string[] = [];
  try {
    const checkout = join(live.root, `checkout-${scenario.id}`);
    cloneRepository(repo, checkout, live.env);
    prepareEnhancementProject(live.cli, checkout, settings.budget, live.env);
    const auth = liveAuthArguments(settings);
    const invoke = (
      name: string,
      args: string[],
      extraEnv: Readonly<Record<string, string>>
    ): { readonly evidence: InvocationEvidence; readonly stdout: string } => {
      const started = Date.now();
      const child = spawnSync(live.cli.command, [...live.cli.args, ...args], {
        cwd: checkout,
        env: { ...live.env, ...extraEnv },
        encoding: 'utf8',
        timeout: cliTimeoutMs,
        killSignal: 'SIGTERM',
        maxBuffer: 50 * 1024 * 1024,
      });
      const evidence = invocationEvidence(name, child, Date.now() - started);
      invocations.push(evidence);
      runs.push(runSummary(name, child.stdout));
      return { evidence, stdout: child.stdout };
    };

    const first = invoke(
      'run',
      enhancementRunArguments(
        checkout,
        settings.budget,
        requirements,
        scenario.stopAfter === undefined ? auth : [...auth, '--stop-after', scenario.stopAfter]
      ),
      {}
    );
    const comparison = stageArtifactPaths(first.stdout, COMPARISON_STAGE);
    if (comparison.length > 0)
      drift = driftEvidence(
        expectation,
        comparison.map((path) => ({
          path,
          content: readFileSync(join(checkout, path), 'utf8'),
        }))
      );
    if (scenario.stopAfter !== undefined) {
      pullRequestsAtStop = ownedPullRequests(prsBefore, listPullRequests(repo, live.env)).length;
      // A resume after a failed first invocation would prove nothing and still cost.
      if (first.evidence.exitCode === 0 && first.evidence.sessionId !== null)
        invoke(
          'resume-1',
          pipelineResumeArguments(checkout, requirements, first.evidence.sessionId, auth),
          scenario.resumeEnv
        );
      switchSeen = regressionSwitchSeen(checkout);
    }
    pullRequests = ownedPullRequests(prsBefore, listPullRequests(repo, live.env)).map((pr) =>
      scenario.id === 'delivery'
        ? judgedPullRequest(live, scenario, pr)
        : {
            number: pr.number,
            state: pr.state,
            merged: pr.mergedAt !== null,
            headRefName: pr.headRefName,
            judgement: null,
          }
    );
    rows = judgeEnhancementScenario(
      scenario,
      {
        invocations,
        runs,
        pullRequests,
        pullRequestsAtStop,
        drift,
        regressionSwitchSeen: switchSeen,
      },
      expectation
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    issues = ownedIssues(issuesBefore, listIssues(repo, live.env));
    cleanup = cleanupRun(
      repo,
      {
        labels: listLabels(repo, live.env).filter((label) => !labelsBefore.has(label)),
        issues,
        pullRequests: ownedPullRequests(prsBefore, listPullRequests(repo, live.env)),
        branches: listBranches(repo, live.env).filter((branch) => !branchesBefore.has(branch)),
      },
      live.env
    );
  }
  const allRows =
    failure === null ? rows : [...rows, { criterion: 'Scenario ran', problems: [failure] }];
  const problems = allRows.flatMap((row) => row.problems);
  const result: EnhancementScenarioResult = {
    id: scenario.id,
    description: scenario.description,
    outcome: problems.length === 0 ? 'passed' : 'failed',
    reason: problems.length === 0 ? null : problems.join('; '),
    rows: allRows,
    invocations,
    runs,
    issues,
    pullRequests,
    drift,
    requiredHumanCorrections: null,
    cleanup,
  };
  results.push(result);
  return result;
}

/**
 * Write the reports, the document diff, and the `delivery_review` template to the
 * lane output directory, without any credential the lane holds.
 * @returns Rendered Markdown
 */
async function writeReport(): Promise<string> {
  const meta: EnhancementReportMeta = {
    runId,
    repository: repo,
    packageVersion: context?.packageVersion ?? null,
    sdkVersion: context?.sdkVersion ?? null,
    budget: settings.budget,
    auth: settings.auth,
    permissions: LIVE_PERMISSIONS,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  const clean = (text: string): string =>
    redactValues(text, [
      process.env['ANTHROPIC_API_KEY'],
      process.env['CLAUDE_API_KEY'],
      process.env['AD_SDLC_LIVE_GITHUB_TOKEN'],
      process.env['GH_TOKEN'],
      process.env['GITHUB_TOKEN'],
    ]);
  const markdown = clean(renderEnhancementReport(meta, results));
  await mkdir(settings.outputDir, { recursive: true });
  await writeFile(
    join(settings.outputDir, LIVE_FILES.enhancementReport),
    clean(`${JSON.stringify({ schemaVersion: 1, ...meta, scenarios: results }, null, 2)}\n`)
  );
  await writeFile(join(settings.outputDir, LIVE_FILES.enhancementSummary), markdown);
  await writeFile(
    join(settings.outputDir, LIVE_FILES.enhancementDiff),
    clean(renderDocumentDiffs(results))
  );
  await writeFile(
    join(settings.outputDir, LIVE_FILES.enhancementReview),
    `${JSON.stringify(deliveryReviewTemplate(meta, results), null, 2)}\n`
  );
  return markdown;
}

describe('Enhancement live acceptance (#957)', () => {
  beforeAll(async () => {
    context = await setUp();
  }, 1_200_000);

  afterAll(async () => {
    // Without the settings nothing ran; the lane metadata already says so.
    if (settings.ready) await writeReport();
    if (context !== undefined) await rm(context.root, { recursive: true, force: true });
  });

  const scenario = (id: EnhancementScenario['id']): EnhancementScenario => {
    const found = ENHANCEMENT_SCENARIOS.find((entry) => entry.id === id);
    if (found === undefined) throw new Error(`Unknown scenario ${id}`);
    return found;
  };
  const live = (): LiveContext => {
    if (context === undefined) throw new Error(notExecutedMessage(settings));
    return context;
  };

  it(
    '(a) delivers the feature as an open pull request that passes every judge row',
    async () => {
      const result = await runScenario(live(), scenario('delivery'));
      expect(result.reason).toBeNull();
    },
    scenarioTimeoutMs
  );

  it(
    '(b) does not report delivery when a retained test fails after implementation',
    async () => {
      const result = await runScenario(live(), scenario('regression'));
      expect(result.reason).toBeNull();
    },
    scenarioTimeoutMs
  );

  it('(c) reports every invocation and attempt, the usage, the drift, and the diff', async () => {
    const markdown = await writeReport();
    expect(enhancementReportProblems(results, markdown)).toEqual([]);
  });
});
