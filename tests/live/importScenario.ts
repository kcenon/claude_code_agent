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

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LiveBudget } from '../../scripts/live-lane.js';
import { IMPORT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import { parseCliJson, withMaxTurns } from './harness.js';

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

/** Topic a GitHub repository must carry before the lane writes to it. */
export const DISPOSABLE_REPO_TOPIC = 'ad-sdlc-live-target';

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
 * Write the target repository into a directory (`gitignore` becomes
 * `.gitignore`, which the fixture cannot hold without affecting this repository).
 * @param dir - Destination; created when missing
 */
export function materializeTarget(dir: string): void {
  mkdirSync(dir, { recursive: true });
  cpSync(IMPORT_FIXTURE.target, dir, { recursive: true });
  renameSync(join(dir, 'gitignore'), join(dir, '.gitignore'));
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
  for (const agent of IMPORT_AGENTS) {
    const path = join(projectDir, '.claude', 'agents', `${agent}.md`);
    writeFileSync(path, withMaxTurns(readFileSync(path, 'utf8'), budget.maxTurns));
  }
}

/** Result of the independent acceptance tests on one checkout. */
export interface AcceptanceResult {
  readonly passed: boolean;
  readonly tests: number;
  readonly pass: number;
  readonly fail: number;
  readonly output: string;
}

/**
 * Run the acceptance tests of the given issues on a checkout. The tests are
 * copied into `acceptance/` and removed afterwards; the required-test switch
 * is cleared so only the issue behavior is judged.
 * @param checkout - Repository checkout to judge
 * @param keys - Issue keys
 * @returns Test counts and output
 */
export function runAcceptance(checkout: string, keys: readonly string[]): AcceptanceResult {
  const dir = join(checkout, 'acceptance');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const files = keys.map((key) => {
    cpSync(join(IMPORT_FIXTURE.acceptance, `${key}.test.mjs`), join(dir, `${key}.test.mjs`));
    return join('acceptance', `${key}.test.mjs`);
  });
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env[REQUIRED_FAIL_ENV];
  delete env['NODE_TEST_CONTEXT'];
  // TAP output, whose `# pass N` summary lines are parsed below.
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    cwd: checkout,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
  rmSync(dir, { recursive: true, force: true });
  const output = `${result.stdout}${result.stderr}`;
  const count = (name: string): number =>
    Number(new RegExp(`^# ${name} (\\d+)`, 'm').exec(output)?.[1] ?? 0);
  return {
    passed: result.status === 0 && count('fail') === 0 && count('pass') > 0,
    tests: count('tests'),
    pass: count('pass'),
    fail: count('fail'),
    output,
  };
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
 * `ad-sdlc run` arguments of a first invocation: Import mode, one attempt per
 * stage, the stage time budget, automatic approval (merges are prevented by
 * the requirements and the repository's rules, and judged afterwards), the
 * delivery verification profile (a failed required check fails the run),
 * no prompts, JSON output.
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
  return [
    'run',
    requirements,
    '--project-dir',
    projectDir,
    '--mode',
    'import',
    '--max-attempts',
    '1',
    '--stage-timeout-ms',
    String(budget.stageTimeoutMs),
    '--approval-mode',
    'auto',
    '--vnv-profile',
    'delivery',
    '--non-interactive',
    '--format',
    'json',
    ...extra,
  ];
}

/**
 * `ad-sdlc run` arguments of a resumed invocation. Resume reuses the saved
 * graph and policy, so only the session, project, and output flags are given.
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
  return [
    'run',
    requirements,
    '--project-dir',
    projectDir,
    '--resume',
    sessionId,
    '--non-interactive',
    '--format',
    'json',
    ...extra,
  ];
}

/** A pull request as `gh pr list --json` reports it. */
export interface GithubPullRequest {
  readonly number: number;
  readonly headRefName: string;
  readonly headRefOid?: string;
  readonly state: string;
  readonly mergedAt: string | null;
  readonly title: string;
  readonly body: string;
  readonly closingIssuesReferences?: readonly { readonly number: number }[];
}

/**
 * Pull requests created during a run: the ones absent from the snapshot
 * taken before it. The lane's concurrency group keeps runs from overlapping.
 * @param before - Pull request numbers before the run
 * @param after - Pull requests after the run
 * @returns Pull requests the run created
 */
export function ownedPullRequests(
  before: readonly number[],
  after: readonly GithubPullRequest[]
): GithubPullRequest[] {
  const known = new Set(before);
  return after.filter((pr) => !known.has(pr.number));
}

/**
 * Issues a pull request links: closing references, or `#N` in its title or body.
 * @param pr - Pull request
 * @param issues - Candidate issue numbers
 * @returns Linked issue numbers in candidate order
 */
export function linkedIssues(pr: GithubPullRequest, issues: readonly number[]): number[] {
  const closing = new Set((pr.closingIssuesReferences ?? []).map((ref) => ref.number));
  const text = `${pr.title}\n${pr.body}`;
  return issues.filter(
    (issue) => closing.has(issue) || new RegExp(`(^|[^\\w&])#${String(issue)}(?!\\d)`).test(text)
  );
}

/** Evidence of one attempt (SDK execution) of a stage. */
export interface AttemptEvidence {
  readonly stage: string;
  readonly outcome: string;
  readonly execution: string;
  readonly sdkSessionId: string | null;
  readonly modelId: string | null;
  readonly sdkVersion: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly durationMs: number;
  readonly errorType: string | null;
}

/** Evidence of one stage of an invocation. */
export interface StageEvidenceRow {
  readonly stage: string;
  readonly status: string;
  readonly restored: boolean;
  readonly attempts: number;
  readonly verification: string | null;
  /** Stage error message, when the stage failed */
  readonly error: string | null;
  /** Failed verification checks as `checkId: message` */
  readonly failedChecks: readonly string[];
}

/** Evidence of one `ad-sdlc run` invocation. */
export interface InvocationEvidence {
  readonly invocation: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly durationMs: number;
  readonly sessionId: string | null;
  readonly status: string | null;
  readonly error: string | null;
  readonly resumed: boolean;
  readonly stages: readonly StageEvidenceRow[];
  readonly attempts: readonly AttemptEvidence[];
}

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/**
 * Extract the evidence of one invocation from the CLI's JSON output (a run
 * result, or `{ ready: false, error, result }` for a failed run). Credentials
 * never appear in the output; prompts and tool inputs are not recorded.
 * @param invocation - Label (`run`, `resume-1`, ...)
 * @param child - CLI child process result
 * @param durationMs - Wall time
 * @returns Evidence
 */
export function invocationEvidence(
  invocation: string,
  child: Pick<SpawnSyncReturns<string>, 'status' | 'signal' | 'stdout'>,
  durationMs: number
): InvocationEvidence {
  let output: JsonRecord = {};
  try {
    output = parseCliJson(child.stdout);
  } catch {
    output = { ready: false, error: 'No JSON result in the CLI output' };
  }
  const result = asRecord(output['result']) ?? (output['ready'] === false ? {} : output);
  const records = (asRecord(result['metrics'])?.['records'] as unknown[] | undefined) ?? [];
  const byKind = (kind: string): JsonRecord[] =>
    records.map(asRecord).filter((entry): entry is JsonRecord => entry?.['kind'] === kind);
  const pipeline = byKind('pipeline')[0];
  const stageResults = new Map(
    (Array.isArray(result['stages']) ? result['stages'] : [])
      .map(asRecord)
      .filter((entry): entry is JsonRecord => entry !== undefined)
      .map((entry) => [asString(entry['name']) ?? 'unknown', entry] as const)
  );
  const failedChecks = (stage: string): string[] => {
    const checks = asRecord(stageResults.get(stage)?.['verification'])?.['checks'];
    return (Array.isArray(checks) ? checks : [])
      .map(asRecord)
      .filter((check) => check?.['outcome'] === 'fail')
      .map(
        (check) => `${asString(check?.['checkId']) ?? '?'}: ${asString(check?.['message']) ?? ''}`
      );
  };
  return {
    invocation,
    exitCode: child.status,
    signal: child.signal,
    durationMs,
    sessionId: asString(result['pipelineId']),
    status: asString(result['overallStatus']) ?? asString(pipeline?.['status']),
    error: asString(output['error']),
    resumed: asRecord(pipeline?.['resume'])?.['resumed'] === true,
    stages: byKind('stage').map((stage) => {
      const name = asString(stage['stage']) ?? 'unknown';
      return {
        stage: name,
        status: asString(stage['status']) ?? 'unknown',
        restored: stage['restored'] === true,
        attempts: asNumber(asRecord(stage['attempts'])?.['total']) ?? 0,
        verification: asString(asRecord(stage['verification'])?.['state']),
        error: asString(stageResults.get(name)?.['error']),
        failedChecks: failedChecks(name),
      };
    }),
    attempts: byKind('attempt').map((attempt) => {
      const usage = asRecord(attempt['usage']);
      return {
        stage: asString(attempt['stage']) ?? 'unknown',
        outcome: asString(attempt['outcome']) ?? 'unknown',
        execution: asString(attempt['execution']) ?? 'unknown',
        sdkSessionId: asString(attempt['sdkSessionId']),
        modelId: asString(attempt['modelId']),
        sdkVersion: asString(attempt['sdkVersion']),
        inputTokens: asNumber(usage?.['inputTokens']),
        outputTokens: asNumber(usage?.['outputTokens']),
        durationMs: asNumber(attempt['durationMs']) ?? 0,
        errorType: asString(attempt['errorType']),
      };
    }),
  };
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
 * Problems with the SDK evidence of an invocation: every SDK attempt must
 * report its session, model, and token usage.
 * @param invocation - Invocation evidence
 * @returns Problems; empty when the evidence is complete
 */
function sdkEvidenceProblems(invocation: InvocationEvidence): string[] {
  return invocation.attempts
    .filter((attempt) => attempt.execution === 'sdk')
    .flatMap((attempt) => {
      const where = `${invocation.invocation} ${attempt.stage}`;
      const problems: string[] = [];
      if (attempt.sdkSessionId === null) problems.push(`${where}: no SDK session ID`);
      if (attempt.modelId === null) problems.push(`${where}: no model ID`);
      if ((attempt.inputTokens ?? 0) + (attempt.outputTokens ?? 0) === 0)
        problems.push(`${where}: no token usage`);
      return problems;
    });
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

const stageStatus = (invocation: InvocationEvidence | undefined, stage: string): string | null =>
  invocation?.stages.find((entry) => entry.stage === stage)?.status ?? null;

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
  readonly startedAt: string;
  readonly finishedAt: string;
}

const cell = (value: unknown): string =>
  (value === null || value === undefined ? '—' : String(value))
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');

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
    `Run \`${meta.runId}\` against \`${meta.repository}\`; package ${cell(meta.packageVersion)}, SDK ${cell(meta.sdkVersion)}; budget maxTurns ${String(meta.budget.maxTurns)}, stage ${String(meta.budget.stageTimeoutMs)} ms; ${meta.startedAt} to ${meta.finishedAt}.`,
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
    for (const invocation of result.invocations) {
      lines.push(
        '',
        `### ${invocation.invocation}`,
        '',
        `Session ${cell(invocation.sessionId)}; status ${cell(invocation.status)}; exit ${cell(invocation.exitCode)}${invocation.signal === null ? '' : ` (${invocation.signal})`}; ${String(invocation.durationMs)} ms; resumed ${String(invocation.resumed)}.${invocation.error === null ? '' : ` Error: ${cell(invocation.error)}`}`,
        '',
        '| Stage | Status | Restored | Attempts | Verification | Failed checks and error |',
        '| --- | --- | --- | --- | --- | --- |',
        ...invocation.stages.map(
          (stage) =>
            `| ${stage.stage} | ${stage.status} | ${String(stage.restored)} | ${String(stage.attempts)} | ${cell(stage.verification)} | ${cell([...stage.failedChecks, ...(stage.error === null ? [] : [stage.error])].join('; ') || null)} |`
        ),
        '',
        '| Attempt stage | Outcome | Execution | SDK session | Model | Input tokens | Output tokens | Duration (ms) | Error type |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...invocation.attempts.map(
          (attempt) =>
            `| ${attempt.stage} | ${attempt.outcome} | ${attempt.execution} | ${cell(attempt.sdkSessionId)} | ${cell(attempt.modelId)} | ${cell(attempt.inputTokens)} | ${cell(attempt.outputTokens)} | ${String(attempt.durationMs)} | ${cell(attempt.errorType)} |`
        )
      );
    }
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

/**
 * Run a command and require exit 0.
 * @param command - Executable
 * @param args - Arguments
 * @param options - Working directory, environment, and timeout
 * @returns Standard output
 */
export function exec(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd?: string;
    readonly env: NodeJS.ProcessEnv;
    readonly timeoutMs?: number;
    /** Run through the platform shell (Windows `.cmd` launchers need it) */
    readonly shell?: boolean;
  }
): string {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? 300_000,
    maxBuffer: 20 * 1024 * 1024,
    shell: options.shell ?? false,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} exited with ${String(result.status)}\n${result.stdout}\n${result.stderr}`
    );
  return result.stdout;
}

/** How to start the installed `ad-sdlc` CLI: `command ...args <cli arguments>`. */
export interface InstalledCli {
  readonly command: string;
  readonly args: readonly string[];
}

/** Git for Windows' bash, which runs the package scripts (`rm -rf`) on Windows. */
const WINDOWS_SCRIPT_SHELL = 'C:\\Program Files\\Git\\bin\\bash.exe';

/**
 * Pack this repository and install the tarball, production dependencies only,
 * in a separate consumer directory. On Windows npm runs through its `.cmd`
 * launcher, and the package scripts run in Git for Windows' bash.
 * @param repoRoot - AD-SDLC checkout
 * @param dir - Consumer directory
 * @param env - Environment
 * @returns The installed package's CLI entry, run with this Node.js
 */
export function installPackedPackage(
  repoRoot: string,
  dir: string,
  env: NodeJS.ProcessEnv
): InstalledCli {
  const pack = join(dir, 'pack');
  const consumer = join(dir, 'consumer');
  mkdirSync(pack, { recursive: true });
  mkdirSync(consumer, { recursive: true });
  const windows = process.platform === 'win32';
  if (windows && !existsSync(WINDOWS_SCRIPT_SHELL))
    throw new Error(`npm pack on Windows needs Git for Windows' bash at ${WINDOWS_SCRIPT_SHELL}`);
  const npmEnv: NodeJS.ProcessEnv = windows
    ? { ...env, npm_config_script_shell: WINDOWS_SCRIPT_SHELL }
    : env;
  const npm = (args: readonly string[], cwd: string): string =>
    exec(windows ? 'npm.cmd' : 'npm', args, {
      cwd,
      env: npmEnv,
      timeoutMs: 600_000,
      shell: windows,
    });
  npm(['pack', '--pack-destination', pack], repoRoot);
  const tarball = readdirSync(pack).find((file) => file.endsWith('.tgz'));
  if (tarball === undefined) throw new Error('npm pack wrote no tarball');
  npm(['init', '-y'], consumer);
  npm(['install', '--omit=dev', '--no-audit', '--no-fund', join(pack, tarball)], consumer);
  const pkg = join(consumer, 'node_modules', 'ad-sdlc');
  const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as {
    bin?: Record<string, string>;
  };
  const entry = manifest.bin?.['ad-sdlc'];
  if (entry === undefined || !existsSync(join(pkg, entry)))
    throw new Error(`Installed package has no ad-sdlc executable: ${pkg}`);
  return { command: process.execPath, args: [join(pkg, entry)] };
}
