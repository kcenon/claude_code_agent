/**
 * Offline guard for the live acceptance lane (#954). Runs in the ordinary
 * offline lanes and proves, without credentials or SDK calls, that:
 * - selecting the live lane without its settings reports not-executed with
 *   the reason and a non-zero exit (runner) or fails (direct Vitest
 *   selection), never a pass;
 * - an executed run passes only when a live test really passed;
 * - the smoke's production CLI invocation and turn budget are valid.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LIVE_BUDGET_SETTINGS,
  LIVE_EXIT,
  LIVE_FILES,
  decideLaneStatus,
  resolveLiveSettings,
  runLiveLane,
  summarizeVitestReport,
  type LiveLaneMetadata,
} from '../../scripts/live-lane.js';
import { resolveProjectAgent } from '../../src/execution/resolveProjectAgent.js';
import {
  SdkExecutionAdapter,
  type SdkQueryOptions,
} from '../../src/execution/SdkExecutionAdapter.js';
import { sdkQuery, sdkResult, sdkStatus } from '../execution/fixtures/sdk.js';
import {
  LIVE_SMOKE_AGENT,
  LIVE_SMOKE_STAGE,
  liveChildEnv,
  liveRunArguments,
  parseCliJson,
  prepareLiveProject,
  runSourceCli,
  stageEvidence,
  withMaxTurns,
} from '../live/harness.js';

const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
const repoRoot = process.cwd();

/**
 * Child environment without credentials, live-lane settings, Vitest worker
 * markers, or GitHub Actions summary/annotation variables, plus `extra`.
 * @param extra - Variables to set after the removal
 * @returns Environment for child processes and the in-process runner
 */
function offlineEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
  for (const key of Object.keys(env))
    if (
      /^(ANTHROPIC_|CLAUDE_API_KEY$|AD_SDLC_LIVE_|VITEST|GITHUB_STEP_SUMMARY$|GITHUB_ACTIONS$)/.test(
        key
      )
    )
      delete env[key];
  return { ...env, ...extra };
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'live-lane-guard-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('live lane settings', () => {
  it('is not ready and names ANTHROPIC_API_KEY when the key is absent or blank', () => {
    for (const env of [{}, { ANTHROPIC_API_KEY: '' }, { ANTHROPIC_API_KEY: '   ' }]) {
      const settings = resolveLiveSettings(env, dir);
      expect(settings.ready).toBe(false);
      expect(settings.missing).toEqual(['ANTHROPIC_API_KEY']);
      expect(settings.reason).toBe('ANTHROPIC_API_KEY is not set');
    }
  });

  it('rejects budgets outside the accepted range instead of clamping them', () => {
    const settings = resolveLiveSettings(
      {
        ANTHROPIC_API_KEY: 'placeholder',
        AD_SDLC_LIVE_MAX_TURNS: '0',
        AD_SDLC_LIVE_STAGE_TIMEOUT_MS: 'soon',
      },
      dir
    );
    expect(settings.ready).toBe(false);
    expect(settings.invalid).toHaveLength(2);
    expect(settings.reason).toMatch(/invalid AD_SDLC_LIVE_MAX_TURNS="0"/);
    expect(settings.reason).toMatch(/invalid AD_SDLC_LIVE_STAGE_TIMEOUT_MS="soon"/);
  });

  it('uses the documented defaults and output directory when only the key is set', () => {
    const settings = resolveLiveSettings({ ANTHROPIC_API_KEY: 'placeholder' }, dir);
    expect(settings).toMatchObject({
      ready: true,
      reason: null,
      budget: {
        maxTurns: LIVE_BUDGET_SETTINGS.maxTurns.default,
        stageTimeoutMs: LIVE_BUDGET_SETTINGS.stageTimeoutMs.default,
      },
      outputDir: join(dir, 'test-output', 'live'),
    });
  });
});

describe('live lane outcome', () => {
  it('reads Vitest JSON counts, counting pending and todo tests as skipped', () => {
    expect(
      summarizeVitestReport({
        numTotalTests: 4,
        numPassedTests: 1,
        numFailedTests: 1,
        numPendingTests: 1,
        numTodoTests: 1,
      })
    ).toEqual({ total: 4, passed: 1, failed: 1, skipped: 2 });
  });

  it('passes only when Vitest exited 0 and every selected live test passed', () => {
    const counts = (passed: number, failed = 0, skipped = 0) => ({
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
    });
    expect(decideLaneStatus(0, counts(1)).status).toBe('passed');
    expect(decideLaneStatus(0, counts(0))).toEqual({
      status: 'failed',
      reason: 'no live test passed',
    });
    expect(decideLaneStatus(0, counts(1, 0, 1)).status).toBe('failed');
    expect(decideLaneStatus(1, counts(0, 1)).status).toBe('failed');
    expect(decideLaneStatus(null, counts(1)).status).toBe('failed');
  });
});

describe('live lane runner', () => {
  it('writes an explicit not-executed status and exits 2 through npm run test:live without credentials', async () => {
    const outputDir = join(dir, 'out');
    const stepSummary = join(dir, 'step-summary.md');
    const result = spawnSync(process.execPath, ['--import', tsxLoader, 'scripts/live-lane.ts'], {
      cwd: repoRoot,
      env: offlineEnv({ AD_SDLC_LIVE_OUTPUT_DIR: outputDir, GITHUB_STEP_SUMMARY: stepSummary }),
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(result.status, result.stdout + result.stderr).toBe(LIVE_EXIT.notExecuted);
    expect(result.stdout).toContain('LIVE LANE: NOT EXECUTED (ANTHROPIC_API_KEY is not set)');
    const metadata = JSON.parse(
      await readFile(join(outputDir, LIVE_FILES.metadata), 'utf8')
    ) as LiveLaneMetadata;
    expect(metadata).toMatchObject({
      schemaVersion: 1,
      lane: 'live-acceptance',
      executed: false,
      status: 'not-executed',
      reason: 'ANTHROPIC_API_KEY is not set',
      missingSettings: ['ANTHROPIC_API_KEY'],
      tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      exitCode: LIVE_EXIT.notExecuted,
      evidence: null,
      node: process.version,
      sdk: { package: '@anthropic-ai/claude-agent-sdk' },
    });
    expect(metadata.sdk.installed).toMatch(/^\d+\.\d+\.\d+/);
    expect(Date.parse(metadata.finishedAt)).toBeGreaterThanOrEqual(Date.parse(metadata.startedAt));
    // Nothing was selected: no Vitest report exists.
    expect(existsSync(join(outputDir, LIVE_FILES.vitestReport))).toBe(false);
    const summary = await readFile(stepSummary, 'utf8');
    expect(summary).toContain('## Live Acceptance: NOT EXECUTED');
    expect(summary).toContain('This is not a passing live acceptance run.');
    expect(await readFile(join(outputDir, LIVE_FILES.summary), 'utf8')).toBe(summary);
  }, 60_000);

  it('fails a direct Vitest selection of the live suite without credentials', () => {
    const result = spawnSync(
      process.execPath,
      [
        join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'),
        'run',
        '--config',
        'vitest.live.config.ts',
      ],
      {
        cwd: repoRoot,
        env: offlineEnv({ AD_SDLC_LIVE_OUTPUT_DIR: dir }),
        encoding: 'utf8',
        timeout: 90_000,
      }
    );
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toContain(
      'Live acceptance lane not executed: ANTHROPIC_API_KEY is not set'
    );
    expect(existsSync(join(dir, LIVE_FILES.evidence))).toBe(false);
  }, 90_000);

  // The executed path is exercised with a stand-in Vitest entry point in a
  // scratch root, so no real live test and no SDK call can run.
  async function fakeRoot(outcome: 'pass' | 'empty' | 'fail'): Promise<string> {
    const root = join(dir, `root-${outcome}`);
    await mkdir(join(root, 'node_modules', 'vitest'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    const report = {
      pass: {
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
      },
      empty: {
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
      },
      fail: {
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        numPendingTests: 0,
        numTodoTests: 0,
      },
    }[outcome];
    await writeFile(
      join(root, 'node_modules', 'vitest', 'vitest.mjs'),
      [
        "import { writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const out = process.argv.find((arg) => arg.startsWith('--outputFile.json=')).split('=').slice(1).join('=');",
        `writeFileSync(out, ${JSON.stringify(JSON.stringify(report))});`,
        `if (${String(outcome === 'pass')}) writeFileSync(join(process.env.AD_SDLC_LIVE_OUTPUT_DIR, 'smoke-evidence.json'), '{"sessionId":"s-1"}');`,
        `process.exit(${outcome === 'fail' ? 1 : 0});`,
      ].join('\n')
    );
    return root;
  }

  it.each([
    ['pass', 'passed', LIVE_EXIT.passed],
    ['empty', 'failed', LIVE_EXIT.failed],
    ['fail', 'failed', LIVE_EXIT.failed],
  ] as const)(
    'records an executed %s run as %s with exit %i',
    async (outcome, status, exitCode) => {
      const root = await fakeRoot(outcome);
      const result = runLiveLane({
        env: offlineEnv({ ANTHROPIC_API_KEY: 'placeholder-not-a-key' }),
        root,
        log: () => undefined,
      });
      expect(result.exitCode).toBe(exitCode);
      expect(result.metadata).toMatchObject({ executed: true, status, exitCode });
      expect(result.metadata.evidence).toEqual(outcome === 'pass' ? { sessionId: 's-1' } : null);
      const written = JSON.parse(
        await readFile(join(root, 'test-output', 'live', LIVE_FILES.metadata), 'utf8')
      ) as LiveLaneMetadata;
      expect(written.status).toBe(status);
      expect(JSON.stringify(written)).not.toContain('placeholder-not-a-key');
    }
  );
});

describe('live smoke harness (offline)', () => {
  const budget = { maxTurns: 3, stageTimeoutMs: 45_000 };

  it('sets maxTurns in agent frontmatter and keeps the line endings', () => {
    const lf = '---\nname: a\nmaxTurns: 99\n---\nBody\n';
    expect(withMaxTurns(lf, 3)).toBe('---\nname: a\nmaxTurns: 3\n---\nBody\n');
    const crlf = '---\r\nname: a\r\n---\r\nBody\r\n';
    expect(withMaxTurns(crlf, 3)).toBe('---\r\nname: a\r\nmaxTurns: 3\r\n---\r\nBody\r\n');
    expect(() => withMaxTurns('no frontmatter', 3)).toThrow(/frontmatter/);
  });

  it('extracts SDK evidence from completed and failed stage results', () => {
    const completed = stageEvidence(
      parseCliJson(
        `${JSON.stringify({
          stages: [
            {
              name: 'initialization',
              status: 'completed',
              error: null,
              output: JSON.stringify({
                via: 'execution-adapter',
                sessionId: 's-9',
                toolCallCount: 2,
                tokenUsage: { input: 10, output: 5, cache: 0 },
              }),
            },
          ],
        })}\n`
      ),
      'initialization'
    );
    expect(completed).toMatchObject({
      status: 'completed',
      via: 'execution-adapter',
      sessionId: 's-9',
      tokenUsage: { input: 10, output: 5 },
    });
    const failed = stageEvidence(
      {
        stages: [
          {
            name: 'initialization',
            status: 'failed',
            error: 'boom',
            output: '',
            errorDetails: { context: { sessionId: 's-8', tokenUsage: { input: 1, output: 0 } } },
          },
        ],
      },
      'initialization'
    );
    expect(failed).toMatchObject({ status: 'failed', sessionId: 's-8', error: 'boom' });
  });

  it('prepares the project and validates the exact live run arguments with the production CLI', async () => {
    const claudeConfigDir = join(dir, 'claude-config');
    await mkdir(claudeConfigDir);
    const env = liveChildEnv(offlineEnv(), claudeConfigDir);
    const project = join(dir, 'live project');
    await prepareLiveProject(project, budget, env);

    const dryRun = runSourceCli(liveRunArguments(project, budget, ['--dry-run']), env, 60_000);
    expect(dryRun.status, dryRun.stdout + dryRun.stderr).toBe(0);
    const plan = parseCliJson(dryRun.stdout) as {
      ready: boolean;
      stopAfterStage: string;
      config: { mode: string; localMode: boolean; approvalMode: string };
      retryPolicy: { maxAttempts: number };
      stages: { name: string; agentType: string; timeoutMs: number }[];
      diagnostics: unknown[];
    };
    expect(plan).toMatchObject({
      ready: true,
      stopAfterStage: LIVE_SMOKE_STAGE,
      config: { mode: 'greenfield', localMode: true, approvalMode: 'auto' },
      retryPolicy: { maxAttempts: 1 },
      diagnostics: [],
    });
    expect(plan.stages.find((stage) => stage.name === LIVE_SMOKE_STAGE)).toMatchObject({
      agentType: LIVE_SMOKE_AGENT,
      timeoutMs: budget.stageTimeoutMs,
    });

    // The turn budget reaches the SDK through the project's agent definition.
    const definition = await resolveProjectAgent(project, LIVE_SMOKE_AGENT);
    expect(definition.maxTurns).toBe(budget.maxTurns);
    let captured: SdkQueryOptions | undefined;
    const adapter = new SdkExecutionAdapter({
      loader: async () => ({
        query(options) {
          captured = options;
          return sdkQuery(
            (async function* () {
              yield sdkStatus('offline-session');
              yield sdkResult({ session_id: 'offline-session' });
            })()
          );
        },
      }),
    });
    const outcome = await adapter.execute({
      projectDir: project,
      agentType: LIVE_SMOKE_AGENT,
      workOrder: 'offline',
      priorOutputs: {},
    });
    await adapter.dispose();
    expect(outcome.status).toBe('success');
    expect(captured?.options?.agent).toBe(LIVE_SMOKE_AGENT);
    expect(captured?.options?.agents?.[LIVE_SMOKE_AGENT]?.maxTurns).toBe(budget.maxTurns);
  }, 180_000);
});
