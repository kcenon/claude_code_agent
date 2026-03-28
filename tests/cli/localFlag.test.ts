/**
 * Tests for the --local CLI flag and AD_SDLC_LOCAL env var.
 *
 * Requires a prior build (`npm run build`) since it executes dist/cli.js.
 * Automatically skipped when dist/cli.js does not exist.
 */

import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const cliPath = resolve(__dirname, '../../dist/cli.js');
const cliBuilt = existsSync(cliPath);

async function runCli(
  args: string[],
  env?: Record<string, string>
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync('node', [cliPath, ...args], {
      timeout: 10000,
      env: { ...process.env, NODE_NO_WARNINGS: '1', ...env },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.code ?? 1,
    };
  }
}

describe.skipIf(!cliBuilt)('CLI --local flag', () => {
  it('should show --local option in run command help', async () => {
    const result = await runCli(['run', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--local');
    expect(result.stdout).toContain('-L');
  });

  it('should show Local Mode in doctor output', async () => {
    const result = await runCli(['doctor']);
    expect(result.stdout).toContain('Local Mode');
    expect(result.stdout).toContain('available');
  });

  it('should detect AD_SDLC_LOCAL=1 in doctor output', async () => {
    const result = await runCli(['doctor'], { AD_SDLC_LOCAL: '1' });
    expect(result.stdout).toContain('Local Mode');
    expect(result.stdout).toContain('active');
  });
});
