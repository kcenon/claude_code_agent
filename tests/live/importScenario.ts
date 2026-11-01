/**
 * Import live acceptance scenarios (#955).
 *
 * A small deterministic target repository (`fixtures/import-target`) and a
 * seeded issue corpus (`fixtures/import-issues.json`) with independent
 * acceptance tests (`fixtures/import-acceptance`). The live lane pushes the
 * target to a disposable GitHub repository, seeds the issues there, runs the
 * installed npm package (`ad-sdlc init` and `ad-sdlc run --mode import`)
 * against a clone, checks the resulting pull requests with the acceptance
 * tests, and removes only what the run created.
 *
 * The pure parts (corpus, requirements, run arguments, ownership, evidence,
 * report) are checked offline by tests/ci/import-fixture.test.ts; the GitHub
 * and SDK parts run only in the live lane.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LiveBudget } from '../../scripts/live-lane.js';
import { IMPORT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import {
  applyTurnBudgetTo,
  cell,
  exec,
  materializeFixture,
  pipelineResumeArguments,
  pipelineRunArguments,
  renderInvocation,
  runAcceptanceTests,
  sdkEvidenceProblems,
  stageStatus,
  type AcceptanceResult,
  type InstalledCli,
  type InvocationEvidence,
} from './scenarioSupport.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** Fixture paths. */
export const IMPORT_FIXTURE = {
  target: join(FIXTURES, 'import-target'),
  issues: join(FIXTURES, 'import-issues.json'),
  acceptance: join(FIXTURES, 'import-acceptance'),
  reference: join(FIXTURES, 'import-reference'),
} as const;

/** Agents of the Import stages; each gets the lane's turn budget. */
export const IMPORT_AGENTS: readonly string[] = IMPORT_STAGES.map((stage) => stage.agentType);

/** Variable that makes the target's required test fail (scenario b). */
export const REQUIRED_FAIL_ENV = 'AD_SDLC_FIXTURE_REQUIRED_FAIL';

/** Report files written to the lane output directory. */
export const IMPORT_REPORT_FILES = {
  json: 'import-acceptance-report.json',
  markdown: 'import-acceptance-report.md',
} as const;

/** One seeded issue. */
export interface SeededIssue {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly acceptanceCriteria: readonly string[];
}

/** Seeded issue corpus. */
export interface IssueCorpus {
  readonly schemaVersion: 1;
  /** Constraints appended to every issue body */
  readonly rules: string;
  readonly issues: readonly SeededIssue[];
}

/**
 * Read and validate the seeded issue corpus.
 * @param path - Corpus file
 * @returns Corpus
 * @throws Error when the file does not have the expected shape
 */
export function loadIssueCorpus(path: string = IMPORT_FIXTURE.issues): IssueCorpus {
  const corpus = JSON.parse(readFileSync(path, 'utf8')) as Partial<IssueCorpus>;
  const strings = (value: unknown): value is string[] =>
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
  if (
    corpus.schemaVersion !== 1 ||
    typeof corpus.rules !== 'string' ||
    !Array.isArray(corpus.issues)
  )
    throw new Error(`Invalid issue corpus: ${path}`);
  for (const issue of corpus.issues)
    if (
      !/^[a-z][a-z-]*$/.test(issue.key) ||
      typeof issue.title !== 'string' ||
      typeof issue.summary !== 'string' ||
      !strings(issue.acceptanceCriteria)
    )
      throw new Error(`Invalid seeded issue in ${path}: ${JSON.stringify(issue.key)}`);
  return corpus as IssueCorpus;
}

/**
 * Body of a seeded issue: summary, an "Acceptance Criteria" checklist in the
 * format the RTM builder reads, and the corpus rules.
 * @param issue - Seeded issue
 * @param corpus - Corpus with the shared rules
 * @returns Markdown body
 */
export function renderIssueBody(issue: SeededIssue, corpus: IssueCorpus): string {
  return [
    issue.summary,
    '',
    '## Acceptance Criteria',
    '',
    ...issue.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`),
    '',
    '## Constraints',
    '',
    corpus.rules,
    '',
  ].join('\n');
}

/**
 * Write the target repository into a directory.
 * @param dir - Destination; created when missing
 */
export function materializeTarget(dir: string): void {
  materializeFixture(IMPORT_FIXTURE.target, dir);
}

/**
 * Initialize the AD-SDLC project in a clone of the target repository with
 * the installed CLI, exactly as a user would (`ad-sdlc init . --quick`), and
 * give every Import agent the lane's turn budget.
 * @param cli - Installed `ad-sdlc` CLI
 * @param checkout - Clone of the target repository
 * @param budget - Lane budget
 * @param env - Environment
 */
export function prepareImportProject(
  cli: InstalledCli,
  checkout: string,
  budget: LiveBudget,
  env: NodeJS.ProcessEnv
): void {
  exec(cli.command, [...cli.args, 'init', '.', '--quick'], {
    cwd: checkout,
    env,
    timeoutMs: 120_000,
  });
  applyTurnBudget(checkout, budget);
}

/**
 * Set the lane's turn budget in the definition of every Import agent; the SDK
 * adapter forwards it to the SDK.
 * @param projectDir - Initialized project
 * @param budget - Lane budget
 */
export function applyTurnBudget(projectDir: string, budget: LiveBudget): void {
  applyTurnBudgetTo(projectDir, IMPORT_AGENTS, budget);
}

/**
 * Run the acceptance tests of the given issues on a checkout. The required-test
 * switch is cleared so only the issue behavior is judged.
 * @param checkout - Repository checkout to judge
 * @param keys - Issue keys
 * @returns Test counts and output
 */
export function runAcceptance(checkout: string, keys: readonly string[]): AcceptanceResult {
  return runAcceptanceTests(checkout, {
    sourceDir: IMPORT_FIXTURE.acceptance,
    keys,
    clearedEnv: [REQUIRED_FAIL_ENV],
  });
}

/** Live scenarios. Each run seeds its own issues under its own label. */
export interface ImportScenario {
  readonly id: 'delivery' | 'required-fail' | 'resume';
  readonly description: string;
  /** Seeded issue keys */
  readonly issues: readonly string[];
  /** Extra environment of the AD-SDLC run */
  readonly env: Readonly<Record<string, string>>;
  /** Stage the first invocation stops after; the scenario then resumes twice */
  readonly stopAfter?: string;
}

export const IMPORT_SCENARIOS: readonly ImportScenario[] = [
  {
    id: 'delivery',
    description: 'Imported issues are delivered as a reviewable pull request',
    issues: ['slugify', 'count-words'],
    env: {},
  },
  {
    id: 'required-fail',
    description: 'A failing required test blocks successful delivery',
    issues: ['slugify'],
    env: { [REQUIRED_FAIL_ENV]: '1' },
  },
  {
    id: 'resume',
    description:
      'An interrupted run resumes from durable state without duplicate issues, pull requests, or changes',
    issues: ['count-words'],
    env: {},
    stopAfter: 'validation-agent',
  },
];

/**
 * Label of one scenario run's seeded issues (GitHub allows 50 characters).
 * @param runId - Lane run identifier
 * @param scenario - Scenario ID
 * @returns Label name
 */
export function runLabel(runId: string, scenario: ImportScenario['id']): string {
  const label = `ad-sdlc-live-${runId}-${scenario}`;
  if (label.length > 50) throw new Error(`Label too long: ${label}`);
  return label;
}

/**
 * Requirements text of an Import run. It becomes every stage's work order.
 * @param label - Label of the seeded issues
 * @returns Requirements
 */
export function importRequirements(label: string): string {
  return [
    `Implement the open GitHub issues of this repository that carry the label "${label}", and only those.`,
    'Open one pull request for the work and link each implemented issue in its body.',
    'Leave every pull request open for human review: do not merge or close it.',
    'Do not modify test/required-gate.test.mjs or the package.json scripts.',
  ].join(' ');
}

/**
 * `ad-sdlc run` arguments of a first Import invocation.
 * @param projectDir - Clone of the target repository
 * @param budget - Lane budget
 * @param requirements - Requirements text
 * @param extra - Additional flags, such as `--dry-run` or `--stop-after`
 * @returns CLI arguments
 */
export function importRunArguments(
  projectDir: string,
  budget: LiveBudget,
  requirements: string,
  extra: readonly string[] = []
): string[] {
  return pipelineRunArguments('import', projectDir, budget, requirements, extra);
}

/**
 * `ad-sdlc run` arguments of a resumed Import invocation.
 * @param projectDir - Clone of the target repository
 * @param requirements - The original requirements text
 * @param sessionId - Saved session
 * @param extra - Additional flags, such as the authentication flags
 * @returns CLI arguments
 */
export function importResumeArguments(
  projectDir: string,
  requirements: string,
  sessionId: string,
  extra: readonly string[] = []
): string[] {
  return pipelineResumeArguments(projectDir, requirements, sessionId, extra);
}

/** Pull request evidence of a scenario. */
export interface PullRequestEvidence {
  readonly number: number;
  readonly state: string;
  readonly merged: boolean;
  readonly headRefName: string;
  readonly linkedIssues: readonly number[];
  readonly acceptance: Omit<AcceptanceResult, 'output'> | null;
}

/** Result of one scenario. */
export interface ScenarioResult {
  readonly id: ImportScenario['id'];
  readonly description: string;
  readonly outcome: 'passed' | 'failed' | 'not-run';
  readonly reason: string | null;
  readonly label: string;
  readonly issues: readonly { readonly key: string; readonly number: number }[];
  readonly invocations: readonly InvocationEvidence[];
  readonly pullRequests: readonly PullRequestEvidence[];
  readonly cleanup: readonly string[];
}

/** External state observed after each invocation of a scenario. */
export interface ScenarioSnapshot {
  /** Pull requests the run created so far */
  readonly pullRequests: readonly number[];
  /** Issues carrying the run's label */
  readonly labeledIssues: number;
  /** Head commit per created pull request */
  readonly heads: Readonly<Record<string, string>>;
}

/** What a scenario run observed. */
export interface ScenarioObservation {
  readonly invocations: readonly InvocationEvidence[];
  /** Seeded issue numbers */
  readonly issues: readonly number[];
  readonly pullRequests: readonly PullRequestEvidence[];
  /** One snapshot per invocation, in order */
  readonly snapshots: readonly ScenarioSnapshot[];
}

/**
 * Problems with the delivered pull requests: each is open and unmerged,
 * every seeded issue is linked, and the acceptance tests pass on every one.
 * @param observation - Scenario observation
 * @returns Problems
 */
function deliveryProblems(observation: ScenarioObservation): string[] {
  const problems: string[] = [];
  if (observation.pullRequests.length === 0) problems.push('no pull request was opened');
  for (const pr of observation.pullRequests) {
    if (pr.merged) problems.push(`pull request #${String(pr.number)} was merged`);
    if (pr.state !== 'OPEN') problems.push(`pull request #${String(pr.number)} is ${pr.state}`);
    if (pr.acceptance?.passed !== true)
      problems.push(`acceptance tests did not pass on pull request #${String(pr.number)}`);
  }
  const linked = new Set(observation.pullRequests.flatMap((pr) => pr.linkedIssues));
  for (const issue of observation.issues)
    if (!linked.has(issue))
      problems.push(`issue #${String(issue)} is not linked by a pull request`);
  return problems;
}

/**
 * Judge a scenario run. The live test fails when this returns problems; the
 * same rules are checked offline against synthetic observations.
 * @param scenario - Scenario
 * @param observation - What the run observed
 * @returns Problems; empty when the scenario passed
 */
export function evaluateScenario(
  scenario: ImportScenario,
  observation: ScenarioObservation
): string[] {
  const { invocations, snapshots } = observation;
  const [first] = invocations;
  if (first === undefined) return ['no invocation ran'];
  const problems = invocations.flatMap(sdkEvidenceProblems);
  if (!first.attempts.some((attempt) => attempt.execution === 'sdk'))
    problems.push('the first invocation made no SDK attempt');
  for (const [index, snapshot] of snapshots.entries())
    if (snapshot.labeledIssues !== observation.issues.length)
      problems.push(
        `${invocations[index]?.invocation ?? `invocation ${String(index)}`}: ${String(snapshot.labeledIssues)} labeled issues instead of ${String(observation.issues.length)}`
      );

  if (scenario.id === 'delivery') {
    if (first.exitCode !== 0 || first.status !== 'completed')
      problems.push(`run ended ${String(first.status)} with exit ${String(first.exitCode)}`);
    if (stageStatus(first, 'review') !== 'completed') problems.push('review did not complete');
    problems.push(...deliveryProblems(observation));
  } else if (scenario.id === 'required-fail') {
    if (first.exitCode === 0) problems.push('run exited 0 although a required test failed');
    if (first.status === 'completed') problems.push('run reported completed delivery');
    if (stageStatus(first, 'review') === 'completed') problems.push('review ran and completed');
    if (observation.pullRequests.length > 0)
      problems.push(`${String(observation.pullRequests.length)} pull request(s) were opened`);
  } else {
    const [, resumed, repeated] = invocations;
    if (resumed === undefined || repeated === undefined)
      return [...problems, `expected 3 invocations, got ${String(invocations.length)}`];
    if (first.exitCode !== 0) problems.push(`stopped run exited ${String(first.exitCode)}`);
    if ((snapshots[0]?.pullRequests.length ?? 0) > 0)
      problems.push('a pull request was opened before the stop point');
    if (!resumed.resumed || resumed.exitCode !== 0 || resumed.status !== 'completed')
      problems.push(
        `resume ended ${String(resumed.status)} with exit ${String(resumed.exitCode)} (resumed ${String(resumed.resumed)})`
      );
    for (const stage of resumed.stages)
      if (stage.stage !== 'review' && !stage.restored)
        problems.push(`resume re-ran completed stage ${stage.stage}`);
    if (
      resumed.attempts.some((attempt) => attempt.stage !== 'review' && attempt.execution === 'sdk')
    )
      problems.push('resume made SDK attempts for stages completed before the stop');
    if (!repeated.resumed || repeated.exitCode !== 0)
      problems.push(`second resume exited ${String(repeated.exitCode)}`);
    if (repeated.attempts.some((attempt) => attempt.execution === 'sdk'))
      problems.push('resuming a completed session made SDK attempts');
    const [, afterResume, afterRepeat] = snapshots;
    if (JSON.stringify(afterResume?.pullRequests) !== JSON.stringify(afterRepeat?.pullRequests))
      problems.push('resuming a completed session changed the pull requests');
    if (JSON.stringify(afterResume?.heads) !== JSON.stringify(afterRepeat?.heads))
      problems.push('resuming a completed session pushed new commits');
    problems.push(...deliveryProblems(observation));
  }
  return problems;
}

/**
 * Problems with the run report: it must cover every scenario and invocation,
 * list every attempt, and include the unsuccessful and the restored stages
 * the scenarios produce, not only the successful example.
 * @param results - Scenario results
 * @param markdown - Rendered report
 * @returns Problems; empty when the report is complete
 */
export function reportProblems(results: readonly ScenarioResult[], markdown: string): string[] {
  const problems: string[] = [];
  for (const scenario of IMPORT_SCENARIOS)
    if (!results.some((result) => result.id === scenario.id))
      problems.push(`scenario ${scenario.id} is missing`);
  for (const result of results) {
    if (!markdown.includes(`## ${result.id}:`)) problems.push(`no section for ${result.id}`);
    for (const invocation of result.invocations) {
      if (!markdown.includes(`### ${invocation.invocation}`))
        problems.push(`${result.id}: invocation ${invocation.invocation} is missing`);
      for (const attempt of invocation.attempts)
        if (attempt.sdkSessionId !== null && !markdown.includes(attempt.sdkSessionId))
          problems.push(`${result.id}: attempt ${attempt.sdkSessionId} is missing`);
    }
  }
  const all = results.flatMap((result) => result.invocations);
  if (
    !all.some(
      (invocation) =>
        invocation.status !== 'completed' ||
        invocation.stages.some((stage) => stage.status === 'failed' || stage.status === 'skipped')
    )
  )
    problems.push('the report shows no unsuccessful or skipped stage');
  if (!all.some((invocation) => invocation.stages.some((stage) => stage.restored)))
    problems.push('the report shows no restored stage');
  return problems;
}

/** Report header data. */
export interface ImportReportMeta {
  readonly runId: string;
  readonly repository: string;
  readonly packageVersion: string | null;
  readonly sdkVersion: string | null;
  readonly budget: LiveBudget;
  /** Authentication mode of the lane */
  readonly auth: string;
  /** Tool permissions granted to the pipeline's agent sessions */
  readonly permissions: {
    readonly defaultMode: string;
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly startedAt: string;
  readonly finishedAt: string;
}

/**
 * Render the Markdown run report: every scenario, every invocation, and every
 * stage and attempt, including failed, skipped, and restored ones.
 * @param meta - Report header
 * @param results - Scenario results
 * @returns Markdown
 */
export function renderImportReport(
  meta: ImportReportMeta,
  results: readonly ScenarioResult[]
): string {
  const lines = [
    '# Import Live Acceptance Report (#955)',
    '',
    `Run \`${meta.runId}\` against \`${meta.repository}\`; package ${cell(meta.packageVersion)}, SDK ${cell(meta.sdkVersion)}; authentication ${meta.auth}; budget maxTurns ${String(meta.budget.maxTurns)}, stage ${String(meta.budget.stageTimeoutMs)} ms; ${meta.startedAt} to ${meta.finishedAt}.`,
    '',
    `Agent session permissions: mode \`${meta.permissions.defaultMode}\`; allowed ${meta.permissions.allow.map((rule) => `\`${rule}\``).join(', ')}; denied ${meta.permissions.deny.map((rule) => `\`${rule}\``).join(', ')}.`,
    '',
    '| Scenario | Outcome | Reason |',
    '| --- | --- | --- |',
    ...results.map((result) => `| ${result.id} | ${result.outcome} | ${cell(result.reason)} |`),
  ];
  for (const result of results) {
    lines.push(
      '',
      `## ${result.id}: ${result.description}`,
      '',
      `Outcome **${result.outcome}**. Label \`${result.label}\`; issues ${result.issues.map((issue) => `#${String(issue.number)} (${issue.key})`).join(', ') || 'none'}.`
    );
    for (const invocation of result.invocations) lines.push(...renderInvocation(invocation));
    lines.push(
      '',
      '| Pull request | State | Merged | Linked issues | Acceptance |',
      '| --- | --- | --- | --- | --- |',
      ...result.pullRequests.map(
        (pr) =>
          `| #${String(pr.number)} | ${pr.state} | ${String(pr.merged)} | ${pr.linkedIssues.map((issue) => `#${String(issue)}`).join(', ') || 'none'} | ${pr.acceptance === null ? 'not run' : `${String(pr.acceptance.pass)}/${String(pr.acceptance.tests)} passed`} |`
      ),
      '',
      `Cleanup: ${result.cleanup.join('; ') || 'nothing to clean up'}.`
    );
  }
  return `${lines.join('\n')}\n`;
}
