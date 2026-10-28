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
 * Secrets are never written: the metadata names missing settings only.
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Lane identifier written to the metadata. */
export const LIVE_LANE = 'live-acceptance';

/** Process exit codes of the runner. */
export const LIVE_EXIT = { passed: 0, failed: 1, notExecuted: 2 } as const;

/** Settings that must be present for the lane to execute. */
export const REQUIRED_LIVE_SETTINGS = [
  { name: 'ANTHROPIC_API_KEY', purpose: 'Anthropic API key used by the Claude Agent SDK' },
  {
    name: 'AD_SDLC_LIVE_GITHUB_REPO',
    purpose:
      'Disposable GitHub repository (`owner/name`, with the `ad-sdlc-live-target` topic) of the Import scenarios',
  },
  {
    name: 'AD_SDLC_LIVE_GITHUB_TOKEN',
    purpose: 'GitHub token with access to that repository only',
  },
] as const;

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
 * @returns Settings; `ready` is false when a required setting is missing or a budget is invalid
 */
export function resolveLiveSettings(
  env: NodeJS.ProcessEnv,
  root: string = process.cwd()
): LiveSettings {
  const missing = REQUIRED_LIVE_SETTINGS.filter((setting) => !nonEmpty(env[setting.name])).map(
    (setting) => setting.name
  );
  const invalid: string[] = [];
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
      ? 'Metadata: `live-lane.json`, and the Import run report `import-acceptance-report.md`, in the `live-acceptance-metadata` artifact.'
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
 * Scenario outcomes of an Import run report (`import-acceptance-report.json`).
 * @param report - Parsed report, or undefined when the live suite wrote none
 * @returns `{ id, outcome }` per scenario; empty without a report
 */
export function importScenarioOutcomes(
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
    importScenarios: importScenarioOutcomes(readJson(file('importReport'))),
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
