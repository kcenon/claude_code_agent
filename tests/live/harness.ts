/**
 * Shared harness for the live acceptance lane (#954).
 *
 * Drives the production `ad-sdlc` CLI (src/cli.ts, the `ad-sdlc` bin entry,
 * loaded through tsx) in a child process. The live smoke uses it against the
 * real SDK; the offline guard test uses the same project preparation and the
 * same `run` arguments with `--dry-run`, so the live invocation is validated
 * on every pull request without credentials.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  claudeCredentialsPath,
  type LiveBudget,
  type LiveSettings,
} from '../../scripts/live-lane.js';
import { RUNTIME_ENV_MAPPING } from '../../src/config/runtimeSupport.js';

const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
const cliEntry = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));

/** Stage executed by the placeholder smoke: the first canonical stage. */
export const LIVE_SMOKE_STAGE = 'initialization';

/** Agent that runs {@link LIVE_SMOKE_STAGE}; its definition receives the turn budget. */
export const LIVE_SMOKE_AGENT = 'project-initializer';

/** Work order for the placeholder smoke. */
export const LIVE_SMOKE_REQUEST =
  'Live lane smoke test: confirm that the AD-SDLC project structure exists and report it. Do not create application code.';

/** Claude Code session markers that would switch the SDK away from the API key. */
const SESSION_MARKERS = [
  'CLAUDECODE',
  'CLAUDE_CODE',
  'CLAUDE_CODE_SESSION',
  'CLAUDE_CODE_ENTRYPOINT',
];

/**
 * Child environment for the CLI: deterministic runtime settings (no direct
 * AD_SDLC_* overrides), no Claude Code session markers, an isolated Claude
 * configuration directory, and no color. API keys are inherited unchanged.
 * @param base - Environment to copy
 * @param claudeConfigDir - Isolated CLAUDE_CONFIG_DIR for the SDK child
 * @returns Child environment
 */
export function liveChildEnv(base: NodeJS.ProcessEnv, claudeConfigDir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, NO_COLOR: '1', CLAUDE_CONFIG_DIR: claudeConfigDir };
  for (const key of [
    ...Object.keys(RUNTIME_ENV_MAPPING),
    'AD_SDLC_ENV',
    'AD_SDLC_USE_SDK_FOR_WORKER',
    ...SESSION_MARKERS,
  ])
    delete env[key];
  return env;
}

/**
 * Minimum remaining validity of the Claude Code login's access token. The
 * copy used by a run must not refresh: with rotating refresh tokens that
 * could invalidate the user's own login, and the copy is never written back.
 */
export const LOGIN_MIN_VALIDITY_MS = 120 * 60_000;

/**
 * Create the isolated Claude configuration directory of a live run. In
 * `local-login` mode it receives a copy of the machine's Claude Code login
 * credentials and nothing else, so the user's settings, hooks, and plugins
 * never reach the run; the copy is removed with the run's directory.
 * @param dir - Isolated CLAUDE_CONFIG_DIR
 * @param settings - Lane settings
 * @param env - Environment that locates the user's Claude configuration
 * @param now - Current time in milliseconds
 * @throws Error when the login's access token expires within {@link LOGIN_MIN_VALIDITY_MS}
 */
export async function prepareClaudeConfigDir(
  dir: string,
  settings: Pick<LiveSettings, 'auth'>,
  env: NodeJS.ProcessEnv = process.env,
  now: number = Date.now()
): Promise<void> {
  await mkdir(dir, { recursive: true });
  if (settings.auth !== 'local-login') return;
  const source = claudeCredentialsPath(env);
  const credentials = JSON.parse(await readFile(source, 'utf8')) as {
    claudeAiOauth?: { expiresAt?: unknown };
  };
  const expiresAt = credentials.claudeAiOauth?.expiresAt;
  if (typeof expiresAt !== 'number' || expiresAt - now < LOGIN_MIN_VALIDITY_MS)
    throw new Error(
      `The Claude Code login must stay valid for ${String(LOGIN_MIN_VALIDITY_MS / 60_000)} more minutes so the run never refreshes it (expires ${typeof expiresAt === 'number' ? new Date(expiresAt).toISOString() : 'unknown'}); use Claude Code until it refreshes the login, then run again`
    );
  await copyFile(source, join(dir, '.credentials.json'));
}

/**
 * Extra `ad-sdlc run` flags of the authentication mode. With a Claude Code
 * login there is no API key or session marker for the CLI to detect, so the
 * run passes `--allow-stub`, which only skips that detection: the stages still
 * run through the SDK adapter, which uses the copied login.
 * @param settings - Lane settings
 * @returns Flags
 */
export function liveAuthArguments(settings: Pick<LiveSettings, 'auth'>): string[] {
  return settings.auth === 'local-login' ? ['--allow-stub'] : [];
}

/**
 * Run the source CLI in a child process.
 * @param args - CLI arguments
 * @param env - Child environment
 * @param timeoutMs - Kill the child after this many milliseconds
 * @returns Child result with UTF-8 output
 */
export function runSourceCli(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, ['--import', tsxLoader, cliEntry, ...args], {
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGTERM',
    maxBuffer: 20 * 1024 * 1024,
  });
}

/**
 * Set `maxTurns` in an agent definition's frontmatter. The SDK adapter
 * forwards the project's agent definition, including `maxTurns`, to the SDK.
 * @param content - Agent Markdown file
 * @param maxTurns - Turn budget
 * @returns Updated content, preserving the file's line endings
 */
export function withMaxTurns(content: string, maxTurns: number): string {
  const match = /^---(\r?\n)([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (match === null) throw new Error('Agent definition has no YAML frontmatter');
  const newline = match[1] ?? '\n';
  const lines = (match[2] ?? '').split(/\r?\n/).filter((line) => !/^maxTurns\s*:/.test(line));
  const frontmatter = [...lines, `maxTurns: ${String(maxTurns)}`].join(newline);
  return `---${newline}${frontmatter}${newline}---${newline}${content.slice(match[0].length)}`;
}

/**
 * Initialize a target project with the production CLI and apply the turn
 * budget to the smoke stage's agent definition.
 * @param projectDir - New project directory (must not exist yet)
 * @param budget - Lane budget
 * @param env - Child environment
 */
export async function prepareLiveProject(
  projectDir: string,
  budget: LiveBudget,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const init = runSourceCli(['init', projectDir, '--quick', '--skip-validation'], env, 120_000);
  if (init.status !== 0)
    throw new Error(
      `ad-sdlc init failed (${String(init.status)}):\n${init.stdout}\n${init.stderr}`
    );
  const agentPath = join(projectDir, '.claude', 'agents', `${LIVE_SMOKE_AGENT}.md`);
  await writeFile(agentPath, withMaxTurns(await readFile(agentPath, 'utf8'), budget.maxTurns));
}

/**
 * `ad-sdlc run` arguments for the smoke: one stage, one attempt, the stage
 * time budget, local mode (no GitHub), automatic approval, JSON output.
 * @param projectDir - Initialized project
 * @param budget - Lane budget
 * @param extra - Additional flags, such as `--dry-run`
 * @returns CLI arguments
 */
export function liveRunArguments(
  projectDir: string,
  budget: LiveBudget,
  extra: readonly string[] = []
): string[] {
  return [
    'run',
    LIVE_SMOKE_REQUEST,
    '--project-dir',
    projectDir,
    '--mode',
    'greenfield',
    '--local',
    '--stop-after',
    LIVE_SMOKE_STAGE,
    '--max-attempts',
    '1',
    '--stage-timeout-ms',
    String(budget.stageTimeoutMs),
    '--approval-mode',
    'auto',
    '--format',
    'json',
    ...extra,
  ];
}

/** SDK evidence for one stage of a CLI run. */
export interface StageEvidence {
  readonly stage: string;
  readonly status: string | null;
  readonly via: string | null;
  readonly sessionId: string | null;
  readonly toolCallCount: number | null;
  readonly tokenUsage: { readonly input: number; readonly output: number } | null;
  readonly error: string | null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Parse the terminal JSON object printed by `ad-sdlc run --format json`.
 * @param stdout - CLI standard output
 * @returns Parsed object
 */
export function parseCliJson(stdout: string): Record<string, unknown> {
  const start = stdout.startsWith('{') ? 0 : stdout.lastIndexOf('\n{');
  if (start === -1) throw new Error(`No JSON object in CLI output:\n${stdout}`);
  const parsed = record(JSON.parse(stdout.slice(start)));
  if (parsed === undefined) throw new Error('CLI JSON output is not an object');
  return parsed;
}

/**
 * Extract the SDK session, turn, and token evidence of one stage from a CLI
 * run result. Completed stages carry it in their output; failed stages in
 * the error context.
 * @param result - Parsed `ad-sdlc run --format json` output
 * @param stage - Stage name
 * @returns Evidence; fields are null when absent
 */
export function stageEvidence(result: Record<string, unknown>, stage: string): StageEvidence {
  const stages = Array.isArray(result['stages']) ? result['stages'] : [];
  const entry = stages.map(record).find((candidate) => candidate?.['name'] === stage);
  let source: Record<string, unknown> | undefined;
  try {
    source = record(JSON.parse(String(entry?.['output'] ?? '')));
  } catch {
    source = undefined;
  }
  source ??= record(record(entry?.['errorDetails'])?.['context']);
  const usage = record(source?.['tokenUsage']);
  const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);
  const input = number(usage?.['input']);
  const output = number(usage?.['output']);
  return {
    stage,
    status: typeof entry?.['status'] === 'string' ? entry['status'] : null,
    via: typeof source?.['via'] === 'string' ? source['via'] : null,
    sessionId: typeof source?.['sessionId'] === 'string' ? source['sessionId'] : null,
    toolCallCount: number(source?.['toolCallCount']),
    tokenUsage: input === null || output === null ? null : { input, output },
    error: typeof entry?.['error'] === 'string' ? entry['error'] : null,
  };
}
