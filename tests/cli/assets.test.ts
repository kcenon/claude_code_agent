import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { snapshot } from '../project-initializer/assetFixtures.js';

const cli = fileURLToPath(new URL('../../src/cli.ts', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const loader = pathToFileURL(require.resolve('tsx')).href;
let project: string;
function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', loader, cli, ...args], {
    cwd: project,
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: '1' },
  });
}
beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'asset CLI '));
  const result = run(['init', '.', '--quick', '--skip-validation']);
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

describe('asset update CLI', () => {
  it('prints a pure dry-run plan then applies safe changes', () => {
    const file = join(project, '.claude/commands/status.md');
    rmSync(file);
    const before = snapshot(project);
    const dryRun = run(['assets', 'update', '--project-dir', project, '--dry-run']);
    expect(dryRun.status, dryRun.stdout + dryRun.stderr).toBe(0);
    expect(dryRun.stdout).toContain('ready (dry run)');
    expect(dryRun.stdout).toContain('install: .claude/commands/status.md');
    expect(snapshot(project)).toEqual(before);
    const applied = run(['assets', 'update', '--project-dir', project]);
    expect(applied.status, applied.stdout + applied.stderr).toBe(0);
    expect(applied.stdout).toContain('updated');
  });

  it('prints conflicts with path, versions and reconciliation instruction and exits nonzero', () => {
    writeFileSync(join(project, '.claude/commands/status.md'), 'user customization');
    const before = snapshot(project);
    for (const extra of [[], ['--dry-run']]) {
      const result = run(['assets', 'update', '--project-dir', project, ...extra]);
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('conflict: .claude/commands/status.md (1.0.0 -> 1.0.0)');
      expect(result.stdout).toContain('Compare');
      expect(snapshot(project)).toEqual(before);
    }
  });
});

it('registers an unconditional package smoke CI lane without credential skips', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const workflow = yaml.load(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')) as {
    jobs: Record<
      string,
      { if?: string; env?: unknown; steps: { run?: string; if?: string; env?: unknown }[] }
    >;
  };
  const lane = workflow.jobs['package-assets']!;
  expect(lane).toBeDefined();
  expect(lane.if).toBeUndefined();
  expect(lane.env).toBeUndefined();
  const step = lane.steps.find((s) => s.run === 'npm run test:package')!;
  expect(step).toBeDefined();
  expect(step.if).toBeUndefined();
  expect(step.env).toBeUndefined();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  expect(pkg.scripts['test:package']).toBe('node tests/package/asset-delivery.smoke.mjs');
});
