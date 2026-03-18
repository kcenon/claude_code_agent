/**
 * CLI command routing and error handling tests
 *
 * Tests the CLI entry point for:
 * - Command routing (help, version, unknown commands)
 * - Error exit codes for invalid inputs
 *
 * Requires a prior build (`npm run build`) since it executes dist/cli.js.
 * Automatically skipped when dist/cli.js does not exist (e.g., CI test-before-build).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const cliPath = resolve(__dirname, '../../dist/cli.js');
const cliBuilt = existsSync(cliPath);

async function runCli(
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync('node', [cliPath, ...args], {
      timeout: 10000,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
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

describe.skipIf(!cliBuilt)('CLI', () => {
  describe('command routing', () => {
    it('should show help with --help flag', async () => {
      const result = await runCli(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ad-sdlc');
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('validate');
    });

    it('should show version with --version flag', async () => {
      const result = await runCli(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should show help for init subcommand', async () => {
      const result = await runCli(['init', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('init');
    });

    it('should show help for validate subcommand', async () => {
      const result = await runCli(['validate', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('validate');
    });

    it('should exit with error for unknown command', async () => {
      const result = await runCli(['nonexistent-command']);
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle validate with no config files gracefully', async () => {
      const result = await runCli(['validate', '--project-root', '/tmp/nonexistent-project-dir']);
      // Should exit with non-zero (no config files found)
      expect(result.exitCode).not.toBe(0);
    });
  });
});
