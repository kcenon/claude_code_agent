import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { PACKAGE_ROOT, readPackageVersion } from '../../src/utils/packageVersion.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

describe('packageVersion', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('resolves the package root that ships package.json', () => {
    expect(PACKAGE_ROOT).toBe(repoRoot);
  });

  it('reads the version declared in package.json', () => {
    const { version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8')) as {
      version: string;
    };
    expect(readPackageVersion()).toBe(version);
  });

  function packageRootWith(manifest: Record<string, unknown>): string {
    const dir = mkdtempSync(join(tmpdir(), 'ad-sdlc-package-version-'));
    tempDir = dir;
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
    return dir;
  }

  it('reads the version of an explicit package root', () => {
    expect(readPackageVersion(packageRootWith({ name: 'x', version: '9.8.7' }))).toBe('9.8.7');
  });

  it('rejects a package.json without a version', () => {
    const dir = packageRootWith({ name: 'x' });
    expect(() => readPackageVersion(dir)).toThrow();
  });
});
