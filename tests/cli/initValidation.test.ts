/**
 * Offline init-to-validate regression tests. Run the source CLI so ordinary
 * npm test covers initialization even before dist/cli.js has been built.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

  it.each([
    { template: 'minimal', workers: 2, coverage: 50, complexity: 20, requireReview: false },
    { template: 'standard', workers: 3, coverage: 70, complexity: 15, requireReview: true },
    { template: 'enterprise', workers: 5, coverage: 80, complexity: 10, requireReview: true },
  ] as const)('initializes and validates the $template template', async (settings) => {
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
    expect(workflow.pipeline.stages.map(({ name, agent }) => [name, agent])).toEqual([
      ['collect', 'collector'],
      ['prd', 'prd-writer'],
      ['srs', 'srs-writer'],
      ['sds', 'sds-writer'],
      ['issues', 'issue-generator'],
      ['implement', 'controller'],
      ['review', 'pr-reviewer'],
    ]);
    expect(agents.version).toBe('1.0.0');
    expect(Object.keys(agents.agents)).toEqual(Object.keys(expectedAgents));
    for (const [id, expected] of Object.entries(expectedAgents)) {
      expect(agents.agents[id]).toEqual(expected);
      expect(agents.agents[id]?.name.trim().length).toBeGreaterThan(0);
      expect(agents.agents[id]?.definition_file).toBe(`.claude/agents/${id}.md`);
    }

    // The loader's schema strips these legacy settings. Check the saved YAML
    // directly to ensure initialization preserves each template's original data.
    const savedWorkflow = yaml.load(
      readFileSync(join(projectDir, '.ad-sdlc', 'config', 'workflow.yaml'), 'utf-8')
    );
    expect(savedWorkflow).toMatchObject({
      execution: {
        max_parallel_workers: settings.workers,
        retry_attempts: 3,
        retry_delay_ms: 5000,
      },
      quality_gates: {
        coverage: settings.coverage,
        complexity: settings.complexity,
        requireReview: settings.requireReview,
        requireTests: true,
      },
      pipeline: {
        stages: workflow.pipeline.stages.map(({ name, agent }) => ({
          name,
          agent,
          timeout_ms: agent === 'controller' ? 600000 : 300000,
        })),
      },
    });
  });

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
});
