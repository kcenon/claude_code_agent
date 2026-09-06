import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'sdk-project-isolation-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('offline SDK boundary project isolation (not live persona verification)', () => {
  it('launches in A, selects and writes under B, rejects bad definitions, and isolates concurrent A/B requests', async () => {
    const cwd = process.cwd();
    const projectA = join(directory, 'A');
    const projectB = join(directory, 'B');
    await Promise.all([mkdir(projectA), mkdir(projectB)]);
    const { stdout } = await exec(
      process.execPath,
      [
        '--import',
        import.meta.resolve('tsx'),
        fileURLToPath(new URL('./fixtures/projectIsolation.ts', import.meta.url)),
        projectB,
      ],
      { cwd: projectA, timeout: 20_000 }
    );
    expect(JSON.parse(stdout)).toEqual({
      cwd: await realpath(projectA),
      queries: 4,
      isolation: 'passed',
    });
    expect(process.cwd()).toBe(cwd);
  });
});
