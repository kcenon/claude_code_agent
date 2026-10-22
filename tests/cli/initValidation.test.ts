/**
 * Offline init-to-validate regression tests, plus the init-adjacent CLI
 * contracts (--version, doctor, removed init options). Run the source CLI so
 * ordinary npm test covers initialization even before dist/cli.js has been built.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearConfigCache,
  ConfigValidationError,
  loadAgentsConfig,
  loadWorkflowConfig,
} from '../../src/config/index.js';
import { loadResolvedRuntimeConfig } from '../../src/config/runtime.js';
import { buildCanonicalPlan } from '../../src/ad-sdlc-orchestrator/plan.js';
import type { ValidationReport } from '../../src/config/types.js';
import { loadAssetBundle } from '../../src/project-initializer/AgentAssets.js';
import { generateAgentsConfig } from '../../src/project-initializer/generatedConfig.js';
import type { TemplateType } from '../../src/project-initializer/types.js';

const cliPath = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
// A file URL keeps the absolute loader path usable by --import on Windows too.
const tsxLoader = pathToFileURL(require.resolve('tsx')).href;

function runCli(args: string[], cwd: string) {
  const result = spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
    cwd,
    encoding: 'utf-8',
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}

const expectedAgents = generateAgentsConfig(loadAssetBundle()).agents;

describe('CLI initialization configuration validation', () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(() => {
    // Spaces exercise subprocess argument handling without shell quoting.
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'ad-sdlc init validation ')));
    projectDir = join(tempDir, 'project');
  });

  afterEach(() => {
    clearConfigCache();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function initialize(template: TemplateType = 'standard') {
    const result = runCli(
      [
        'init',
        'project',
        '--template',
        template,
        '--tech-stack',
        'typescript',
        '--quick',
        '--skip-validation',
      ],
      tempDir
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }

  it.each([{ template: 'minimal' }, { template: 'standard' }, { template: 'enterprise' }] as const)(
    'initializes and validates the $template template',
    async (settings) => {
      initialize(settings.template);

      const validation = runCli(['validate', '--format', 'json'], projectDir);
      expect(validation.status, validation.stdout + validation.stderr).toBe(0);
      const report: ValidationReport = JSON.parse(validation.stdout);
      expect(report.valid).toBe(true);
      expect(report.totalErrors).toBe(0);
      expect(report.files).toHaveLength(2);
      for (const filename of ['workflow.yaml', 'agents.yaml']) {
        expect(report.files).toContainEqual(
          expect.objectContaining({
            filePath: join(projectDir, '.ad-sdlc', 'config', filename),
            valid: true,
            errors: [],
          })
        );
      }

      const options = { baseDir: projectDir, environment: false } as const;
      const workflow = await loadWorkflowConfig(options);
      const agents = await loadAgentsConfig(options);
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.pipeline).toEqual({ default_mode: 'greenfield' });
      expect(agents.version).toBe('1.0.0');
      expect(Object.keys(agents.agents)).toEqual(Object.keys(expectedAgents));
      for (const [id, expected] of Object.entries(expectedAgents)) {
        expect(agents.agents[id]).toEqual(expected);
        expect(agents.agents[id]?.name.trim().length).toBeGreaterThan(0);
        expect(agents.agents[id]?.definition_file).toBe(`.claude/agents/${id}.md`);
      }

      const savedWorkflow = yaml.load(
        readFileSync(join(projectDir, '.ad-sdlc', 'config', 'workflow.yaml'), 'utf-8')
      );
      expect(savedWorkflow).toEqual(workflow);
      for (const mode of ['greenfield', 'enhancement', 'import'] as const) {
        const plan = await loadResolvedRuntimeConfig(projectDir, { mode }, {});
        expect(plan.diagnostics).toEqual([]);
        expect(plan.stages.map(({ timeoutMs, ...stage }) => stage)).toEqual(
          buildCanonicalPlan(mode)
        );
        expect(plan.config.maxParallelAgents).toBe(3);
        expect(plan.config.maxRetries).toBe(3);
      }
    }
  );

  it.each([
    { field: 'id', value: 'missing' },
    { field: 'name', value: 'missing' },
    { field: 'id', value: 'empty' },
    { field: 'name', value: 'empty' },
  ])('rejects an agent with $value $field in both CLI and loader', async ({ field, value }) => {
    initialize();
    const agentsPath = join(projectDir, '.ad-sdlc', 'config', 'agents.yaml');
    const original = readFileSync(agentsPath, 'utf-8');
    const malformed = original.replace(
      new RegExp(`^    ${field}: .+\\n`, 'm'),
      value === 'missing' ? '' : `    ${field}: ''\n`
    );
    expect(malformed).not.toBe(original);
    writeFileSync(agentsPath, malformed);

    const validation = runCli(['validate', '--format', 'json'], projectDir);
    expect(validation.status, validation.stdout + validation.stderr).toBe(1);
    const report: ValidationReport = JSON.parse(validation.stdout);
    expect(report.valid).toBe(false);
    expect(report.totalErrors).toBe(1);
    const agentsReport = report.files.find((file) => file.filePath === agentsPath);
    expect(agentsReport?.valid).toBe(false);
    expect(agentsReport?.errors).toEqual([
      expect.objectContaining({
        path: `agents.${Object.keys(expectedAgents)[0]}.${field}`,
        message: expect.any(String),
      }),
    ]);

    const loading = loadAgentsConfig({ baseDir: projectDir, environment: false });
    await expect(loading).rejects.toBeInstanceOf(ConfigValidationError);
    await expect(loading).rejects.toMatchObject({
      filePath: agentsPath,
      errors: [
        expect.objectContaining({ path: `agents.${Object.keys(expectedAgents)[0]}.${field}` }),
      ],
    });
  });

  it('prints the version declared in package.json', () => {
    const { version } = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
    ) as { version: string };
    const result = runCli(['--version'], tempDir);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });

  // The exit status depends on the AI bridge of the environment; assert the config check only.
  it('doctor finds the configuration of a quick-initialized project', () => {
    initialize();
    const found = 'OK  Config files: workflow.yaml + agents.yaml found';
    expect(runCli(['doctor', '--project-dir', projectDir], tempDir).stdout).toContain(found);
    // Without --project-dir, doctor checks the current directory.
    expect(runCli(['doctor'], projectDir).stdout).toContain(found);
    expect(runCli(['doctor', '--project-dir', tempDir], tempDir).stdout).toContain(
      'FAIL  Config files: missing: workflow.yaml, agents.yaml'
    );
  }, 90_000);

  // No pipeline stage reads a repository from init; repo detection uses the git remote.
  it.each(['--github-repo', '-g'])('rejects the removed %s init option', (flag) => {
    const result = runCli(
      ['init', 'project', '--quick', '--skip-validation', flag, 'https://github.com/user/project'],
      tempDir
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`unknown option '${flag}'`);
    expect(existsSync(projectDir)).toBe(false);
    expect(runCli(['init', '--help'], tempDir).stdout).not.toContain('--github-repo');
  });
});
