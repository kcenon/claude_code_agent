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
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { LiveBudget } from '../../scripts/live-lane.js';
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
