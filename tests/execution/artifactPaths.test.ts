/**
 * Artifact inspection: availability, checksums, and the symlink rules of
 * inspectArtifact (kcenon/claude_code_agent#950, #973).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lstat, mkdtemp, mkdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashCheckedFile, inspectArtifact } from '../../src/execution/artifacts/paths.js';
import type { ArtifactDeclaration } from '../../src/execution/artifacts/schemas.js';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const canSymlink = process.platform !== 'win32';

let projectDir: string;
beforeEach(async () => {
  projectDir = await realpath(await mkdtemp(join(tmpdir(), 'artifact-paths-')));
});
afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

function declare(overrides: Partial<ArtifactDeclaration>): ArtifactDeclaration {
  return { path: 'out.txt', kind: 'file', operation: 'written', ...overrides };
}

describe('inspectArtifact', () => {
  it('should return the checksum of a present file', async () => {
    await writeFile(join(projectDir, 'out.txt'), 'artifact bytes');

    expect(await inspectArtifact(projectDir, declare({}))).toEqual({
      path: 'out.txt',
      availability: 'present',
      checksum: sha256('artifact bytes'),
    });
  });

  it('should accept a matching declared checksum and reject a different one', async () => {
    await writeFile(join(projectDir, 'out.txt'), 'artifact bytes');

    await expect(
      inspectArtifact(projectDir, declare({ checksum: sha256('artifact bytes') }))
    ).resolves.toMatchObject({ availability: 'present' });
    await expect(
      inspectArtifact(projectDir, declare({ checksum: sha256('other bytes') }))
    ).rejects.toThrow('SHA-256 mismatch for artifact: out.txt');
  });

  it('should report an absent file and reject a deleted file that still exists', async () => {
    await expect(inspectArtifact(projectDir, declare({ path: 'gone.txt' }))).resolves.toEqual({
      path: 'gone.txt',
      availability: 'absent',
    });
    await writeFile(join(projectDir, 'out.txt'), 'x');
    await expect(inspectArtifact(projectDir, declare({ operation: 'deleted' }))).rejects.toThrow(
      'Deleted artifact still exists: out.txt'
    );
  });

  it('should check the declared kind', async () => {
    await mkdir(join(projectDir, 'dir'));
    await writeFile(join(projectDir, 'out.txt'), 'x');

    await expect(
      inspectArtifact(projectDir, declare({ path: 'dir', kind: 'directory' }))
    ).resolves.toEqual({ path: 'dir', availability: 'present' });
    await expect(inspectArtifact(projectDir, declare({ path: 'dir' }))).rejects.toThrow(
      'Expected file artifact: dir'
    );
    await expect(inspectArtifact(projectDir, declare({ kind: 'directory' }))).rejects.toThrow(
      'Expected directory artifact: out.txt'
    );
  });

  it('should hash a permitted external file', async () => {
    const outside = await realpath(await mkdtemp(join(tmpdir(), 'artifact-external-')));
    try {
      const external = join(outside, 'report.txt');
      await writeFile(external, 'external bytes');

      await expect(
        inspectArtifact(projectDir, declare({ path: external, kind: 'external-file' }), [external])
      ).resolves.toEqual({
        path: external,
        availability: 'present',
        checksum: sha256('external bytes'),
      });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(!canSymlink)('should reject an artifact that is itself a symlink', async () => {
    await writeFile(join(projectDir, 'real.txt'), 'x');
    await symlink(join(projectDir, 'real.txt'), join(projectDir, 'out.txt'));

    await expect(inspectArtifact(projectDir, declare({}))).rejects.toThrow(
      'Artifact itself must not be a symlink: out.txt'
    );
  });

  it.skipIf(!canSymlink)('should reject a symlink parent that leaves the project', async () => {
    const outside = await realpath(await mkdtemp(join(tmpdir(), 'artifact-outside-')));
    try {
      await writeFile(join(outside, 'out.txt'), 'x');
      await symlink(outside, join(projectDir, 'escape'), 'dir');

      await expect(
        inspectArtifact(projectDir, declare({ path: 'escape/out.txt' }))
      ).rejects.toThrow('Artifact symlink escapes project root: ');
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe('hashCheckedFile', () => {
  // The lstat result that inspectArtifact checked, then a change of the file
  // before it is hashed (the window between the check and the read).
  const target = (): string => join(projectDir, 'out.txt');

  it('should hash the checked file', async () => {
    await writeFile(target(), 'checked bytes');
    const checked = await lstat(target());

    expect(await hashCheckedFile(target(), checked, 'out.txt')).toBe(sha256('checked bytes'));
  });

  it('should reject a file that replaced the checked one', async () => {
    await writeFile(target(), 'checked bytes');
    const checked = await lstat(target());
    await writeFile(join(projectDir, 'other.txt'), 'replacement');
    await rename(join(projectDir, 'other.txt'), target());

    await expect(hashCheckedFile(target(), checked, 'out.txt')).rejects.toThrow(
      'Artifact changed while it was inspected: out.txt'
    );
  });

  it.skipIf(!canSymlink)('should not follow a symlink that replaced the checked file', async () => {
    const outside = await realpath(await mkdtemp(join(tmpdir(), 'artifact-swap-')));
    try {
      await writeFile(join(outside, 'secret.txt'), 'outside bytes');
      await writeFile(target(), 'checked bytes');
      const checked = await lstat(target());
      await rm(target());
      await symlink(join(outside, 'secret.txt'), target());

      await expect(hashCheckedFile(target(), checked, 'out.txt')).rejects.toThrow(
        'Artifact itself must not be a symlink: out.txt'
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('should reject a file that was removed after the check', async () => {
    await writeFile(target(), 'checked bytes');
    const checked = await lstat(target());
    await rm(target());

    await expect(hashCheckedFile(target(), checked, 'out.txt')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('should reject a directory that replaced the checked file', async () => {
    await writeFile(target(), 'checked bytes');
    const checked = await lstat(target());
    await rm(target());
    await mkdir(target());

    await expect(hashCheckedFile(target(), checked, 'out.txt')).rejects.toThrow(
      'Artifact changed while it was inspected: out.txt'
    );
  });
});
