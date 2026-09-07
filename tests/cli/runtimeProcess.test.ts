/** Actual CLI process checks run from source in the ordinary offline lane. */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dump } from 'js-yaml';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { prepareRunCommand } from '../../src/cli/runCommand.js';
import { RUNTIME_ENV_MAPPING } from '../../src/config/runtimeSupport.js';
import { MockExecutionAdapter } from '../../src/execution/MockExecutionAdapter.js';

const require = createRequire(import.meta.url);
const loader = pathToFileURL(require.resolve('tsx')).href;
const cli = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
let project: string;
const env = { ...process.env, NODE_ENV: 'test', NO_COLOR: '1' };
for (const key of [
  ...Object.keys(RUNTIME_ENV_MAPPING),
  'AD_SDLC_ENV',
  'AD_SDLC_USE_SDK_FOR_WORKER',
])
  delete env[key];
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'runtime CLI space '));
  await mkdir(join(project, '.ad-sdlc/config'), { recursive: true });
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});
function processRun(args: string[]) {
  const result = spawnSync(process.execPath, ['--import', loader, cli, ...args], {
    env,
    encoding: 'utf8',
    timeout: 30000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}
it('prints parseable dry-run JSON identical to the live plan and local adaptation', async () => {
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({
      version: '1.0.0',
      pipeline: { default_mode: 'enhancement' },
      execution: { max_parallel_stages: 2 },
      global: { retry_policy: { max_attempts: 1 }, approval_mode: 'critical' },
    })
  );
  const result = processRun([
    'run',
    'offline',
    '--project-dir',
    project,
    '--dry-run',
    '--local',
    '--stop-after',
    'document_reading',
    '--format',
    'json',
  ]);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const { ready, ...plan } = JSON.parse(result.stdout);
  expect(ready).toBe(true);
  const run = await prepareRunCommand(
    'offline',
    { projectDir: project, local: true, stopAfter: 'document_reading' },
    { env, createAdapter: () => new MockExecutionAdapter() }
  );
  expect(plan).toEqual(run.plan);
  expect((await run.execute()).runtimeSnapshot).toEqual(plan);
});
it.each([
  { execution: { max_parallel_workers: 2 } },
  { execution: { invented: 2 } },
  { quality_gates: { coverage: 80 } },
  { pipeline: { stages: [{ name: 'implement', agent: 'controller' }] } },
])('run and dry-run fail identically before SDK construction: %j', async (unsupported) => {
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({ version: '1.0.0', pipeline: {}, ...unsupported })
  );
  const live = processRun(['run', 'offline', '--project-dir', project, '--format', 'json']);
  const dry = processRun([
    'run',
    'offline',
    '--project-dir',
    project,
    '--format',
    'json',
    '--dry-run',
  ]);
  expect(live.status).toBe(1);
  expect(dry.status).toBe(1);
  expect(JSON.parse(live.stdout)).toEqual(JSON.parse(dry.stdout));
  const diagnostic = JSON.parse(dry.stdout).diagnostics[0];
  expect(diagnostic).toMatchObject({
    severity: 'error',
    source: join(project, '.ad-sdlc/config/workflow.yaml'),
    path: expect.any(String),
    action: expect.any(String),
    reason: expect.any(String),
  });
});
it('validates stop-after against the local effective graph', async () => {
  await writeFile(join(project, '.ad-sdlc/config/workflow.yaml'), 'version: 1.0.0\npipeline: {}\n');
  const result = processRun([
    'run',
    'offline',
    '--project-dir',
    project,
    '--dry-run',
    '--local',
    '--stop-after',
    'github_repo_setup',
    '--format',
    'json',
  ]);
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout).diagnostics[0].path).toBe('--stop-after');
});
it('status and dry-run resume use the saved plan after YAML changes', async () => {
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    'version: 1.0.0\npipeline:\n  default_mode: import\n'
  );
  const run = await prepareRunCommand(
    'offline',
    { projectDir: project, stopAfter: 'issue_reading', local: true },
    { env, createAdapter: () => new MockExecutionAdapter() }
  );
  const completed = await run.execute();
  await writeFile(join(project, '.ad-sdlc/config/workflow.yaml'), 'execution: [broken');
  const status = processRun(['status', '--project-dir', project, '--format', 'json']);
  expect(status.status, status.stdout + status.stderr).toBe(0);
  expect(JSON.parse(status.stdout).runs[0].runtimeSnapshot).toEqual(run.plan);
  const dry = processRun([
    'run',
    'offline',
    '--project-dir',
    project,
    '--resume',
    completed.pipelineId,
    '--dry-run',
    '--format',
    'json',
  ]);
  expect(dry.status, dry.stdout + dry.stderr).toBe(0);
  const { ready, ...snapshot } = JSON.parse(dry.stdout);
  expect(ready).toBe(true);
  expect(snapshot).toEqual(run.plan);
});

it('runtime validation diagnoses unsupported project and explicit workflow files', async () => {
  const workflowPath = join(project, '.ad-sdlc/config/workflow.yaml');
  await writeFile(
    workflowPath,
    dump({ version: '1.0.0', pipeline: {}, execution: { max_parallel_workers: 2 } })
  );
  await writeFile(
    join(project, '.ad-sdlc/config/agents.yaml'),
    dump({ version: '1.0.0', agents: {} })
  );
  for (const args of [
    ['--project-dir', project],
    ['--file', workflowPath],
  ]) {
    const result = processRun(['validate', ...args, '--format', 'json']);
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.files).toContainEqual(
      expect.objectContaining({
        filePath: workflowPath,
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: 'execution.max_parallel_workers',
            suggestion: expect.stringContaining('max_parallel_stages'),
          }),
        ]),
      })
    );
  }
});
