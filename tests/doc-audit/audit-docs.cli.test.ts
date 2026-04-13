import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts', 'audit-docs.ts');
const FIXTURES = join(HERE, 'fixtures');
const VALID_FIXTURE = join(FIXTURES, 'valid-project');
const BROKEN_FIXTURE = join(FIXTURES, 'broken-project');

function runCli(projectDir: string, outputDir: string) {
  return spawnSync(
    'npx',
    ['tsx', SCRIPT_PATH, '--project-dir', projectDir, '--output', outputDir],
    {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
      shell: true,
    }
  );
}

describe('audit-docs CLI', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'audit-docs-cli-'));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('exits 0 on a valid fixture and writes both report files', () => {
    const projectDir = join(tempRoot, 'valid');
    cpSync(VALID_FIXTURE, projectDir, { recursive: true });
    const outputDir = join(projectDir, '.ad-sdlc', 'audit');

    const result = runCli(projectDir, outputDir);

    expect(result.status).toBe(0);
    expect(existsSync(join(outputDir, 'audit-report.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'audit-report.md'))).toBe(true);

    const json = JSON.parse(readFileSync(join(outputDir, 'audit-report.json'), 'utf-8'));
    expect(json.pass).toBe(true);
    expect(json.counts.error).toBe(0);
  }, 30000);

  it('exits 1 on a broken fixture and still writes both report files', () => {
    const projectDir = join(tempRoot, 'broken');
    cpSync(BROKEN_FIXTURE, projectDir, { recursive: true });
    const outputDir = join(projectDir, '.ad-sdlc', 'audit');

    const result = runCli(projectDir, outputDir);

    expect(result.status).toBe(1);
    expect(existsSync(join(outputDir, 'audit-report.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'audit-report.md'))).toBe(true);

    const json = JSON.parse(readFileSync(join(outputDir, 'audit-report.json'), 'utf-8'));
    expect(json.pass).toBe(false);
    expect(json.counts.error).toBeGreaterThan(0);
  }, 30000);
});
