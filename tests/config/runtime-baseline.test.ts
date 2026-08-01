import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MINIMUM_NODE_VERSION } from '../../src/utils/nodeVersion.js';

const projectRoot = process.cwd();
const expectedMajor = MINIMUM_NODE_VERSION.split('.')[0];
const workflowPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/docs-check.yml',
  '.github/workflows/performance.yml',
  '.github/workflows/release.yml',
  '.github/workflows/security.yml',
] as const;

describe('Node.js runtime baseline', () => {
  it('keeps package metadata and local version selection aligned', () => {
    const packageJson = readJson('package.json') as { engines?: { node?: string } };
    const packageLock = readJson('package-lock.json') as {
      packages?: Record<string, { engines?: { node?: string } }>;
    };

    expect(packageJson.engines?.node).toBe(`>=${MINIMUM_NODE_VERSION}`);
    expect(packageLock.packages?.['']?.engines?.node).toBe(`>=${MINIMUM_NODE_VERSION}`);
    expect(read('.nvmrc').trim()).toBe(MINIMUM_NODE_VERSION);
  });

  it.each(workflowPaths)('uses the supported Node.js major in %s', (path) => {
    const versions = [...read(path).matchAll(/node-version:\s*['"]?(\d+)/g)].map(
      (match) => match[1]
    );

    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([expectedMajor]));
  });

  it('uses the supported Node.js major in the runtime container', () => {
    expect(read('docker/Dockerfile')).toMatch(new RegExp(`^FROM node:${expectedMajor}-slim$`, 'm'));
  });
});

function read(path: string): string {
  return readFileSync(join(projectRoot, path), 'utf8');
}

function readJson(path: string): unknown {
  return JSON.parse(read(path));
}
