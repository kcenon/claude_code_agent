/**
 * What the Import (#955) and Enhancement (#957) live scenarios share: running
 * commands, installing the packed package, reading a run's evidence from the
 * CLI's JSON output, owning the GitHub resources a run created, and running
 * independent acceptance tests.
 *
 * Everything here that does not spawn a process is pure and checked offline by
 * tests/ci/import-fixture.test.ts and tests/ci/enhancement-fixture.test.ts.
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
import type { LiveBudget } from '../../scripts/live-lane.js';
import { parseCliJson, withMaxTurns } from './harness.js';

/** Topic a GitHub repository must carry before the lane writes to it. */
export const DISPOSABLE_REPO_TOPIC = 'ad-sdlc-live-target';

/**
 * Write a target repository fixture into a directory (`gitignore` becomes
 * `.gitignore`, which the fixture cannot hold without affecting this repository).
 * @param fixture - Fixture directory
 * @param dir - Destination; created when missing
 */
export function materializeFixture(fixture: string, dir: string): void {
  mkdirSync(dir, { recursive: true });
  cpSync(fixture, dir, { recursive: true });
  renameSync(join(dir, 'gitignore'), join(dir, '.gitignore'));
}

/**
 * Set the lane's turn budget in the definition of each agent; the SDK adapter
 * forwards it to the SDK.
 * @param projectDir - Initialized project
 * @param agents - Agent types
 * @param budget - Lane budget
 */
export function applyTurnBudgetTo(
  projectDir: string,
  agents: readonly string[],
  budget: LiveBudget
): void {
  for (const agent of agents) {
    const path = join(projectDir, '.claude', 'agents', `${agent}.md`);
    writeFileSync(path, withMaxTurns(readFileSync(path, 'utf8'), budget.maxTurns));
  }
}

/** Result of independent acceptance tests on one checkout. */
export interface AcceptanceResult {
  readonly passed: boolean;
  readonly tests: number;
  readonly pass: number;
  readonly fail: number;
  readonly output: string;
}

/**
 * Run independent acceptance tests on a checkout. The tests are copied into
 * `acceptance/` and removed afterwards, and the fixture's switches are cleared,
 * so only the behavior under test is judged.
 * @param checkout - Repository checkout to judge
 * @param options - Where the tests come from, which to run, and the switches to clear
 * @param options.sourceDir - Directory holding `<key>.test.mjs` files
 * @param options.keys - Test keys
 * @param options.clearedEnv - Variables removed from the test environment
 * @returns Test counts and output
 */
export function runAcceptanceTests(
  checkout: string,
  options: {
    readonly sourceDir: string;
    readonly keys: readonly string[];
    readonly clearedEnv: readonly string[];
  }
): AcceptanceResult {
  const dir = join(checkout, 'acceptance');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const files = options.keys.map((key) => {
    cpSync(join(options.sourceDir, `${key}.test.mjs`), join(dir, `${key}.test.mjs`));
    return join('acceptance', `${key}.test.mjs`);
  });
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of options.clearedEnv) delete env[name];
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

/**
 * `ad-sdlc run` arguments of a first invocation: the mode, one attempt per
 * stage, the stage time budget, automatic approval (merges are prevented by
 * the requirements and the repository's rules, and judged afterwards), the
 * delivery verification profile (a failed required check fails the run),
 * no prompts, JSON output.
 * @param mode - Pipeline mode
 * @param projectDir - Clone of the target repository
 * @param budget - Lane budget
 * @param requirements - Requirements text
 * @param extra - Additional flags, such as `--dry-run` or `--stop-after`
 * @returns CLI arguments
 */
export function pipelineRunArguments(
  mode: 'import' | 'enhancement',
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
    mode,
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
export function pipelineResumeArguments(
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
 * Issues created during a run: the ones absent from the snapshot taken before it.
 * Enhancement issues are generated, so no seeded list or run label identifies them.
 * @param before - Issue numbers before the run
 * @param after - Issue numbers after the run
 * @returns Issue numbers the run created
 */
export function ownedIssues(before: readonly number[], after: readonly number[]): number[] {
  const known = new Set(before);
  return after.filter((issue) => !known.has(issue));
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
export const asRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
export const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;
export const asNumber = (value: unknown): number | null =>
  typeof value === 'number' ? value : null;

/**
 * The run result in the CLI's JSON output: the output itself, or the `result`
 * of a `{ ready: false, error, result }` wrapper for a failed run.
 * @param stdout - CLI standard output
 * @returns The parsed output and the run result; empty when the output holds no JSON
 */
export function parseRunOutput(stdout: string): {
  readonly output: JsonRecord;
  readonly result: JsonRecord;
} {
  let output: JsonRecord = {};
  try {
    output = parseCliJson(stdout);
  } catch {
    output = { ready: false, error: 'No JSON result in the CLI output' };
  }
  return {
    output,
    result: asRecord(output['result']) ?? (output['ready'] === false ? {} : output),
  };
}

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
  const { output, result } = parseRunOutput(child.stdout);
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

/**
 * Problems with the SDK evidence of an invocation: every SDK attempt must
 * report its session, model, and token usage.
 * @param invocation - Invocation evidence
 * @returns Problems; empty when the evidence is complete
 */
export function sdkEvidenceProblems(invocation: InvocationEvidence): string[] {
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
 * Status of a stage in an invocation.
 * @param invocation - Invocation evidence
 * @param stage - Stage name
 * @returns Status, or null when the invocation has no record of the stage
 */
export const stageStatus = (
  invocation: InvocationEvidence | undefined,
  stage: string
): string | null => invocation?.stages.find((entry) => entry.stage === stage)?.status ?? null;

/**
 * Escape a report value for a Markdown table cell, backslashes first.
 * @param value - Cell value
 * @returns Cell text; an em dash for null and undefined
 */
export const cell = (value: unknown): string =>
  (value === null || value === undefined ? '—' : String(value))
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');

/**
 * Report section of one invocation: its outcome and a row per stage and attempt,
 * including failed, skipped, and restored ones.
 * @param invocation - Invocation evidence
 * @returns Markdown lines
 */
export function renderInvocation(invocation: InvocationEvidence): string[] {
  return [
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
    ),
  ];
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
