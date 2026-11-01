#!/usr/bin/env tsx
/**
 * Live acceptance lane runner (#954): `npm run test:live`.
 *
 * The only entry point that may execute the paid SDK pipeline. It checks the
 * required settings first. When one is missing or invalid it does not start
 * any test and records an explicit not-executed status with the reason.
 * Otherwise it runs `vitest.live.config.ts` and records the outcome. Either
 * way it writes machine-readable execution metadata (`live-lane.json`) and a
 * Markdown summary, and appends the summary to `$GITHUB_STEP_SUMMARY` when
 * that variable is set.
 *
 * Exit codes: 0 executed and passed, 1 executed and failed (including a run
 * where no live test passed), 2 not executed. A missing credential therefore
 * never yields a successful exit.
 *
 * Secrets are never written: the metadata names missing settings only, and the
 * lane removes credentials from every output file before it writes the metadata.
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Lane identifier written to the metadata. */
export const LIVE_LANE = 'live-acceptance';

/** Process exit codes of the runner. */
export const LIVE_EXIT = { passed: 0, failed: 1, notExecuted: 2 } as const;

/** Environment variable selecting how the lane authenticates. */
export const LIVE_AUTH_ENV = 'AD_SDLC_LIVE_AUTH';

/**
 * Authentication modes. `secrets` (the default, used by the workflow) takes
 * an Anthropic API key and a repository-scoped GitHub token. `local-login`
 * uses the Claude Code login of the machine (its `.credentials.json`) and the
 * GitHub account `gh` is logged in to, for a run on a developer machine.
 */
export const LIVE_AUTH_MODES = ['secrets', 'local-login'] as const;

/** One of {@link LIVE_AUTH_MODES}. */
export type LiveAuthMode = (typeof LIVE_AUTH_MODES)[number];

/** Environment variable selecting the live scenarios that run with the smoke. */
export const LIVE_SUITE_ENV = 'AD_SDLC_LIVE_SUITE';

/**
 * Suites. `import` is the default, so a run that does not ask for the Enhancement
 * scenarios never pays for them.
 */
export const LIVE_SUITES = ['import', 'enhancement', 'all'] as const;

/** One of {@link LIVE_SUITES}. */
export type LiveSuite = (typeof LIVE_SUITES)[number];

const LIVE_TEST_FILES = {
  smoke: 'tests/live/sdk-cli-smoke.live.test.ts',
  import: 'tests/live/import-acceptance.live.test.ts',
  enhancement: 'tests/live/enhancement-acceptance.live.test.ts',
} as const;

/**
 * Live test files of a suite. Selecting files instead of skipping tests matters:
 * {@link decideLaneStatus} fails a run with skipped tests.
 * @param suite - Suite
 * @returns Test files, passed to Vitest as filters
 */
export function liveSuiteFiles(suite: LiveSuite): string[] {
  const scenarios: Readonly<Record<LiveSuite, readonly string[]>> = {
    import: [LIVE_TEST_FILES.import],
    enhancement: [LIVE_TEST_FILES.enhancement],
    all: [LIVE_TEST_FILES.import, LIVE_TEST_FILES.enhancement],
  };
  return [LIVE_TEST_FILES.smoke, ...scenarios[suite]];
}

/**
 * Environment variable naming the target repository of the Enhancement scenarios.
 * It falls back to `AD_SDLC_LIVE_GITHUB_REPO`. A repository whose default branch
 * rejects direct pushes needs its own one, because switching between the Import
 * and Enhancement fixtures always changes the tree.
 */
export const LIVE_ENHANCEMENT_REPO_ENV = 'AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO';

/** Settings that must be present for the lane to execute in `secrets` mode. */
export const REQUIRED_LIVE_SETTINGS = [
  { name: 'ANTHROPIC_API_KEY', purpose: 'Anthropic API key used by the Claude Agent SDK' },
  {
    name: 'AD_SDLC_LIVE_GITHUB_REPO',
    purpose:
      'Disposable GitHub repository (`owner/name`, with the `ad-sdlc-live-target` topic) of the live scenarios',
  },
  {
    name: 'AD_SDLC_LIVE_GITHUB_TOKEN',
    purpose: 'GitHub token with access to that repository only',
  },
] as const;

/** Settings that `local-login` mode replaces with the machine's logins. */
const LOCAL_LOGIN_REPLACED: readonly string[] = ['ANTHROPIC_API_KEY', 'AD_SDLC_LIVE_GITHUB_TOKEN'];

/**
 * Claude Code login credentials file that `local-login` mode copies into the
 * isolated Claude configuration directory of each run.
 * @param env - Process environment
 * @returns Path of `.credentials.json` in the user's Claude configuration directory
 */
export function claudeCredentialsPath(env: NodeJS.ProcessEnv): string {
  const configured = env['CLAUDE_CONFIG_DIR'];
  const home = env['HOME'] ?? env['USERPROFILE'] ?? homedir();
  return join(
    configured !== undefined && configured.trim() !== '' ? configured : join(home, '.claude'),
    '.credentials.json'
  );
}

/** Accepted form of `AD_SDLC_LIVE_GITHUB_REPO`. */
const GITHUB_REPO_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

/** Budget settings with their defaults and accepted ranges. */
export const LIVE_BUDGET_SETTINGS = {
  maxTurns: { env: 'AD_SDLC_LIVE_MAX_TURNS', default: 8, min: 1, max: 30 },
  stageTimeoutMs: {
    env: 'AD_SDLC_LIVE_STAGE_TIMEOUT_MS',
    default: 240_000,
    min: 10_000,
    max: 1_200_000,
  },
} as const;

/** Environment variable selecting the output directory. */
export const LIVE_OUTPUT_DIR_ENV = 'AD_SDLC_LIVE_OUTPUT_DIR';

/** Default output directory, relative to the repository root (git-ignored). */
export const DEFAULT_LIVE_OUTPUT_DIR = 'test-output/live';

/** File names inside the output directory. */
export const LIVE_FILES = {
  metadata: 'live-lane.json',
  summary: 'live-lane-summary.md',
  vitestReport: 'vitest-report.json',
  evidence: 'smoke-evidence.json',
  importReport: 'import-acceptance-report.json',
  importSummary: 'import-acceptance-report.md',
  enhancementReport: 'enhancement-acceptance-report.json',
  enhancementSummary: 'enhancement-acceptance-report.md',
  /** The before/after document diff; cleanup closes the pull requests it came from */
  enhancementDiff: 'enhancement-document-diff.diff',
  /** The `delivery_review` template a person fills in for `telemetry report --supplied` */
  enhancementReview: 'enhancement-delivery-review.json',
} as const;

/** Turn and time limits applied to every live stage. */
export interface LiveBudget {
  readonly maxTurns: number;
  readonly stageTimeoutMs: number;
}

/** Resolved lane settings. `ready` is false when the lane must not execute. */
export interface LiveSettings {
  readonly ready: boolean;
  readonly missing: readonly string[];
  readonly invalid: readonly string[];
  readonly reason: string | null;
  readonly budget: LiveBudget;
  readonly outputDir: string;
  readonly auth: LiveAuthMode;
  readonly suite: LiveSuite;
  /** Target repository of the Enhancement scenarios; null when no repository is set */
  readonly enhancementRepo: string | null;
}

/** Test counts taken from the Vitest JSON report. */
export interface LiveTestCounts {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

/** Lane outcome. */
export type LiveLaneStatus = 'passed' | 'failed' | 'not-executed';

/** Machine-readable execution metadata written to `live-lane.json`. */
export interface LiveLaneMetadata {
  readonly schemaVersion: 1;
  readonly lane: typeof LIVE_LANE;
  readonly executed: boolean;
  readonly status: LiveLaneStatus;
  readonly reason: string | null;
  readonly missingSettings: readonly string[];
  readonly invalidSettings: readonly string[];
  readonly auth: LiveAuthMode;
  readonly suite: LiveSuite;
  readonly budget: LiveBudget;
  readonly sdk: {
    readonly package: string;
    readonly declared: string | null;
    readonly installed: string | null;
  };
  readonly adSdlcVersion: string | null;
  readonly node: string;
  readonly platform: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly tests: LiveTestCounts;
  readonly exitCode: number;
  /** Stage evidence written by the live smoke (session, turns, tokens), when present. */
  readonly evidence: unknown;
  /** Outcome per Import scenario (#955) from `import-acceptance-report.json`, when present. */
  readonly importScenarios: readonly { readonly id: string; readonly outcome: string }[];
  /** Outcome per Enhancement scenario (#957) from `enhancement-acceptance-report.json`, when present. */
  readonly enhancementScenarios: readonly { readonly id: string; readonly outcome: string }[];
  /** Output files that held a credential, now replaced. A non-empty list means revoke it. */
  readonly scrubbedFiles: readonly string[];
  readonly ci: {
    readonly runUrl: string | null;
    readonly sha: string | null;
    readonly ref: string | null;
  };
}

const SDK_PACKAGE = '@anthropic-ai/claude-agent-sdk';
const STATUS_TEXT: Readonly<Record<LiveLaneStatus, string>> = {
  passed: 'PASSED',
  failed: 'FAILED',
  'not-executed': 'NOT EXECUTED',
};
const NO_TESTS: LiveTestCounts = { total: 0, passed: 0, failed: 0, skipped: 0 };

function nonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/**
 * Resolve the lane settings without reading any secret value beyond presence.
 * @param env - Process environment
 * @param root - Repository root, for the default output directory
 * @param exists - File existence check (for the Claude Code login in `local-login` mode)
 * @returns Settings; `ready` is false when a required setting is missing or a budget is invalid
 */
export function resolveLiveSettings(
  env: NodeJS.ProcessEnv,
  root: string = process.cwd(),
  exists: (path: string) => boolean = existsSync
): LiveSettings {
  const invalid: string[] = [];
  const authValue = env[LIVE_AUTH_ENV];
  let auth: LiveAuthMode = 'secrets';
  if (nonEmpty(authValue)) {
    const mode = LIVE_AUTH_MODES.find((candidate) => candidate === authValue.trim());
    if (mode === undefined)
      invalid.push(
        `${LIVE_AUTH_ENV}=${JSON.stringify(authValue)} (expected ${LIVE_AUTH_MODES.join(' or ')})`
      );
    else auth = mode;
  }
  const missing = REQUIRED_LIVE_SETTINGS.filter(
    (setting) =>
      !(auth === 'local-login' && LOCAL_LOGIN_REPLACED.includes(setting.name)) &&
      !nonEmpty(env[setting.name])
  ).map((setting) => setting.name);
  if (auth === 'local-login' && !exists(claudeCredentialsPath(env)))
    missing.unshift('Claude Code login');
  const budgetValue = (key: keyof typeof LIVE_BUDGET_SETTINGS): number => {
    const setting = LIVE_BUDGET_SETTINGS[key];
    const raw = env[setting.env];
    if (!nonEmpty(raw)) return setting.default;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < setting.min || value > setting.max) {
      invalid.push(
        `${setting.env}=${JSON.stringify(raw)} (expected an integer from ${String(setting.min)} to ${String(setting.max)})`
      );
      return setting.default;
    }
    return value;
  };
  const budget = {
    maxTurns: budgetValue('maxTurns'),
    stageTimeoutMs: budgetValue('stageTimeoutMs'),
  };
  const repo = env['AD_SDLC_LIVE_GITHUB_REPO'];
  if (nonEmpty(repo) && !GITHUB_REPO_PATTERN.test(repo.trim()))
    invalid.push(`AD_SDLC_LIVE_GITHUB_REPO=${JSON.stringify(repo)} (expected owner/name)`);
  const enhancementRepo = env[LIVE_ENHANCEMENT_REPO_ENV];
  if (nonEmpty(enhancementRepo) && !GITHUB_REPO_PATTERN.test(enhancementRepo.trim()))
    invalid.push(
      `${LIVE_ENHANCEMENT_REPO_ENV}=${JSON.stringify(enhancementRepo)} (expected owner/name)`
    );
  const suiteValue = env[LIVE_SUITE_ENV];
  let suite: LiveSuite = 'import';
  if (nonEmpty(suiteValue)) {
    const selected = LIVE_SUITES.find((candidate) => candidate === suiteValue.trim());
    if (selected === undefined)
      invalid.push(
        `${LIVE_SUITE_ENV}=${JSON.stringify(suiteValue)} (expected ${LIVE_SUITES.join(', ')})`
      );
    else suite = selected;
  }
  const configuredDir = env[LIVE_OUTPUT_DIR_ENV];
  const outputDir = nonEmpty(configuredDir)
    ? isAbsolute(configuredDir)
      ? configuredDir
      : resolve(root, configuredDir)
    : resolve(root, DEFAULT_LIVE_OUTPUT_DIR);
  const reasons = [
    ...missing.map((name) => `${name} is not set`),
    ...invalid.map((entry) => `invalid ${entry}`),
  ];
  return {
    ready: reasons.length === 0,
    missing,
    invalid,
    reason: reasons.length === 0 ? null : reasons.join('; '),
    budget,
    outputDir,
    auth,
    suite,
    enhancementRepo: nonEmpty(enhancementRepo)
      ? enhancementRepo.trim()
      : nonEmpty(repo)
        ? repo.trim()
        : null,
  };
}

/**
 * Message used when the live suite is selected without its settings.
 * @param settings - Resolved settings
 * @returns Explanation naming the missing or invalid settings
 */
export function notExecutedMessage(settings: LiveSettings): string {
  return `Live acceptance lane not executed: ${settings.reason ?? 'required settings are absent'}. No SDK call was made. Run it through npm run test:live with the required settings (docs/guides/testing.md).`;
}

/**
 * Read test counts from a Vitest JSON report.
 * @param report - Parsed `--reporter=json` output
 * @returns Counts; skipped includes pending and todo tests
 */
export function summarizeVitestReport(report: unknown): LiveTestCounts {
  if (typeof report !== 'object' || report === null) throw new Error('Invalid Vitest report');
  const value = (key: string): number => {
    const entry = (report as Record<string, unknown>)[key];
    return typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 ? entry : 0;
  };
  return {
    total: value('numTotalTests'),
    passed: value('numPassedTests'),
    failed: value('numFailedTests'),
    skipped: value('numPendingTests') + value('numTodoTests'),
  };
}

/**
 * Decide the outcome of an executed lane. A run passes only when Vitest
 * exited 0, at least one live test passed, and no test failed or was skipped:
 * a skipped live test is a silent non-execution, not a pass.
 * @param exitCode - Vitest exit code (null when it was killed)
 * @param counts - Test counts
 * @returns Outcome and, when it failed, the reason
 */
export function decideLaneStatus(
  exitCode: number | null,
  counts: LiveTestCounts
): { readonly status: 'passed' | 'failed'; readonly reason: string | null } {
  if (exitCode === 0 && counts.failed === 0 && counts.skipped === 0 && counts.passed > 0)
    return { status: 'passed', reason: null };
  if (counts.failed > 0)
    return { status: 'failed', reason: `${String(counts.failed)} live test(s) failed` };
  if (counts.skipped > 0)
    return {
      status: 'failed',
      reason: `${String(counts.skipped)} live test(s) skipped; the live lane does not allow skips`,
    };
  if (counts.passed === 0) return { status: 'failed', reason: 'no live test passed' };
  return { status: 'failed', reason: `Vitest exited with ${String(exitCode)}` };
}

/**
 * Escape a value for a Markdown table cell: backslashes first, then pipes,
 * so an input backslash cannot turn the added escape into a literal one.
 * @param value - Cell text
 * @returns Escaped cell text
 */
export function escapeTableCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/**
 * Render the Markdown summary for the job summary and the artifact.
 * @param metadata - Execution metadata
 * @returns Markdown
 */
export function renderLiveSummary(metadata: LiveLaneMetadata): string {
  const headline =
    metadata.status === 'passed'
      ? `${STATUS_TEXT.passed} (real SDK execution)`
      : STATUS_TEXT[metadata.status];
  const rows: [string, string][] = [
    ['Status', metadata.status],
    ['Executed', String(metadata.executed)],
    ['Reason', metadata.reason ?? '—'],
    ['Missing settings', metadata.missingSettings.join(', ') || '—'],
    ['Authentication', metadata.auth],
    ['Suite', metadata.suite],
    [
      'Budget',
      `maxTurns ${String(metadata.budget.maxTurns)}, stage ${String(metadata.budget.stageTimeoutMs)} ms`,
    ],
    [
      'Tests',
      `${String(metadata.tests.passed)} passed, ${String(metadata.tests.failed)} failed, ${String(metadata.tests.skipped)} skipped, ${String(metadata.tests.total)} total`,
    ],
    [
      'Import scenarios',
      metadata.importScenarios.map((scenario) => `${scenario.id} ${scenario.outcome}`).join(', ') ||
        '—',
    ],
    [
      'Enhancement scenarios',
      metadata.enhancementScenarios
        .map((scenario) => `${scenario.id} ${scenario.outcome}`)
        .join(', ') || '—',
    ],
    ['Credentials removed from', metadata.scrubbedFiles.join(', ') || '—'],
    ['SDK', `${metadata.sdk.package} ${metadata.sdk.installed ?? 'not installed'}`],
    ['Node.js', metadata.node],
    ['Started / finished', `${metadata.startedAt} / ${metadata.finishedAt}`],
  ];
  return [
    `## Live Acceptance: ${headline}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    ...rows.map(([field, value]) => `| ${field} | ${escapeTableCell(value)} |`),
    '',
    metadata.executed
      ? 'Metadata: `live-lane.json`, the Import run report `import-acceptance-report.md`, and the Enhancement run report `enhancement-acceptance-report.md`, in the `live-acceptance-metadata` artifact.'
      : 'No live test ran and no SDK call was made. This is not a passing live acceptance run.',
    '',
  ].join('\n');
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function stringField(value: unknown, ...keys: string[]): string | null {
  let current = value;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

/**
 * Scenario outcomes of a run report (`import-acceptance-report.json`,
 * `enhancement-acceptance-report.json`).
 * @param report - Parsed report, or undefined when the live suite wrote none
 * @returns `{ id, outcome }` per scenario; empty without a report
 */
export function scenarioOutcomes(
  report: unknown
): { readonly id: string; readonly outcome: string }[] {
  const scenarios =
    typeof report === 'object' && report !== null
      ? (report as Record<string, unknown>)['scenarios']
      : undefined;
  if (!Array.isArray(scenarios)) return [];
  return scenarios.map((scenario: unknown) => ({
    id: stringField(scenario, 'id') ?? 'unknown',
    outcome: stringField(scenario, 'outcome') ?? 'unknown',
  }));
}

/** Replaces a credential in an output file. */
const REDACTED = '[redacted]';

/** Settings whose values must never reach an output file. */
const SECRET_SETTINGS = [
  'ANTHROPIC_API_KEY',
  'CLAUDE_API_KEY',
  'AD_SDLC_LIVE_GITHUB_TOKEN',
  'GH_TOKEN',
  'GITHUB_TOKEN',
] as const;

/**
 * Credential shapes, for a value the lane does not hold, such as one a stage found
 * and quoted: Anthropic API keys and GitHub tokens.
 */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /sk-ant-[\w-]{8,}/gu,
  /\bgh[pousr]_\w{20,}/gu,
  /\bgithub_pat_\w{20,}/gu,
];

/**
 * Remove credentials from every file in the output directory. Reports quote stage
 * errors and text a model wrote, and the workflow uploads this directory as an
 * artifact: the artifacts of a public repository are public, and GitHub masks secrets
 * only in logs.
 * @param dir - Output directory
 * @param env - Environment holding the secret values
 * @returns Sorted paths, relative to `dir`, of the files that held a credential
 */
export function scrubOutputDirectory(dir: string, env: NodeJS.ProcessEnv): string[] {
  const secrets = SECRET_SETTINGS.map((name) => env[name]).filter(nonEmpty);
  const scrubbed: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const text = readFileSync(path, 'utf8');
    const clean = CREDENTIAL_PATTERNS.reduce(
      (current, pattern) => current.replace(pattern, REDACTED),
      secrets.reduce((current, secret) => current.split(secret).join(REDACTED), text)
    );
    if (clean === text) continue;
    writeFileSync(path, clean);
    scrubbed.push(relative(dir, path));
  }
  return scrubbed.sort();
}

/** Options for {@link runLiveLane}. */
export interface RunLiveLaneOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly root: string;
  readonly now?: () => Date;
  /** Stream for the one-line status (default: process.stdout). */
  readonly log?: (line: string) => void;
}

/**
 * Run the lane: check settings, run the live suite when ready, and write the
 * metadata and summary.
 * @param options - Environment, repository root, clock, and logger
 * @returns Exit code and the metadata that was written
 */
export function runLiveLane(options: RunLiveLaneOptions): {
  readonly exitCode: number;
  readonly metadata: LiveLaneMetadata;
} {
  const { env, root } = options;
  const now = options.now ?? ((): Date => new Date());
  const log = options.log ?? ((line: string): void => void process.stdout.write(`${line}\n`));
  const started = now();
  const settings = resolveLiveSettings(env, root);
  mkdirSync(settings.outputDir, { recursive: true });
  const file = (name: keyof typeof LIVE_FILES): string =>
    join(settings.outputDir, LIVE_FILES[name]);
  // Stale files from an earlier run must not be reported as this run's results.
  for (const name of Object.keys(LIVE_FILES) as (keyof typeof LIVE_FILES)[])
    rmSync(file(name), { force: true });

  let status: LiveLaneStatus = 'not-executed';
  let reason = settings.reason;
  let counts = NO_TESTS;
  let exitCode: number = LIVE_EXIT.notExecuted;
  if (settings.ready) {
    const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
    const child = spawnSync(
      process.execPath,
      [
        vitest,
        'run',
        '--config',
        'vitest.live.config.ts',
        ...liveSuiteFiles(settings.suite),
        '--reporter=default',
        '--reporter=json',
        `--outputFile.json=${file('vitestReport')}`,
      ],
      {
        cwd: root,
        env: { ...env, [LIVE_OUTPUT_DIR_ENV]: settings.outputDir },
        stdio: 'inherit',
      }
    );
    const report = readJson(file('vitestReport'));
    counts = report === undefined ? NO_TESTS : summarizeVitestReport(report);
    const decision = decideLaneStatus(child.status, counts);
    status = decision.status;
    reason =
      decision.reason ??
      (child.error !== undefined ? `Vitest could not start: ${child.error.message}` : null);
    if (report === undefined && status === 'failed')
      reason = `${reason ?? 'failed'}; no Vitest JSON report was written`;
    exitCode = status === 'passed' ? LIVE_EXIT.passed : LIVE_EXIT.failed;
  }

  // Before anything below reads these files and before the metadata exists: the
  // workflow uploads the directory only when the metadata does.
  const scrubbedFiles = settings.ready ? scrubOutputDirectory(settings.outputDir, env) : [];
  if (scrubbedFiles.length > 0)
    log(`LIVE LANE: credentials removed from ${scrubbedFiles.join(', ')}; revoke them`);

  const finished = now();
  const packageJson = readJson(join(root, 'package.json'));
  const sdkPackageJson = readJson(
    join(root, 'node_modules', ...SDK_PACKAGE.split('/'), 'package.json')
  );
  const server = env['GITHUB_SERVER_URL'];
  const repository = env['GITHUB_REPOSITORY'];
  const runId = env['GITHUB_RUN_ID'];
  const metadata: LiveLaneMetadata = {
    schemaVersion: 1,
    lane: LIVE_LANE,
    executed: settings.ready,
    status,
    reason,
    missingSettings: settings.missing,
    invalidSettings: settings.invalid,
    auth: settings.auth,
    suite: settings.suite,
    budget: settings.budget,
    sdk: {
      package: SDK_PACKAGE,
      declared: stringField(packageJson, 'dependencies', SDK_PACKAGE),
      installed: stringField(sdkPackageJson, 'version'),
    },
    adSdlcVersion: stringField(packageJson, 'version'),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    tests: counts,
    exitCode,
    evidence: readJson(file('evidence')) ?? null,
    importScenarios: scenarioOutcomes(readJson(file('importReport'))),
    enhancementScenarios: scenarioOutcomes(readJson(file('enhancementReport'))),
    scrubbedFiles,
    ci: {
      runUrl:
        nonEmpty(server) && nonEmpty(repository) && nonEmpty(runId)
          ? `${server}/${repository}/actions/runs/${runId}`
          : null,
      sha: env['GITHUB_SHA'] ?? null,
      ref: env['GITHUB_REF'] ?? null,
    },
  };
  const summary = renderLiveSummary(metadata);
  writeFileSync(file('metadata'), `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(file('summary'), summary);
  const stepSummary = env['GITHUB_STEP_SUMMARY'];
  if (nonEmpty(stepSummary)) appendFileSync(stepSummary, summary);
  log(`LIVE LANE: ${STATUS_TEXT[status]}${reason === null ? '' : ` (${reason})`}`);
  log(`LIVE LANE: metadata written to ${file('metadata')}`);
  if (env['GITHUB_ACTIONS'] === 'true' && status !== 'passed')
    log(`::error title=Live acceptance ${status}::${reason ?? status}`);
  return { exitCode, metadata };
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  try {
    process.exitCode = runLiveLane({ env: process.env, root: process.cwd() }).exitCode;
  } catch (error) {
    process.stderr.write(
      `LIVE LANE: runner error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = LIVE_EXIT.failed;
  }
}
