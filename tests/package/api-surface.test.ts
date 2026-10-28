/**
 * Supported package entry points (#958): the `exports` map matches the
 * supported entry list, and the source surface of every entry matches the
 * recorded baseline. The packed-tarball side is checked by
 * `tests/package/asset-delivery.smoke.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  API_ENTRY_POINTS,
  REPO_ROOT,
  computeApiSurface,
  diffApiSurface,
  distPath,
  readApiSurface,
} from '../../scripts/api-surface.js';

const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
  main: string;
  types: string;
  exports: Record<string, unknown>;
};

describe('package exports map', () => {
  it('declares every supported entry with declarations and code, then the compatibility alias', () => {
    expect(Object.keys(pkg.exports)).toEqual([
      ...Object.keys(API_ENTRY_POINTS),
      './package.json',
      './*',
    ]);
    for (const [subpath, source] of Object.entries(API_ENTRY_POINTS))
      expect(pkg.exports[subpath], subpath).toEqual({
        types: distPath(source, '.d.ts'),
        default: distPath(source, '.js'),
      });
    // Every path a consumer could import before the map existed stays importable.
    expect(pkg.exports['./*']).toBe('./*');
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });

  it('keeps main and types on the root entry for resolvers that ignore exports', () => {
    expect(`./${pkg.main}`).toBe(distPath(API_ENTRY_POINTS['.'], '.js'));
    expect(`./${pkg.types}`).toBe(distPath(API_ENTRY_POINTS['.'], '.d.ts'));
  });
});

describe('public API surface', () => {
  it('matches the recorded baseline (run npm run api:surface -- --write after review)', () => {
    expect(diffApiSurface(readApiSurface(), computeApiSurface())).toEqual([]);
  }, 180_000);

  it('reports removed and added names per entry and kind', () => {
    const baseline = readApiSurface();
    const changed = {
      ...baseline,
      entries: {
        ...baseline.entries,
        './monitoring': {
          values: [...baseline.entries['./monitoring'].values.slice(1), 'zzAddedValue'],
          types: baseline.entries['./monitoring'].types,
        },
      },
    };

    expect(diffApiSurface(baseline, changed)).toEqual([
      `removed value ./monitoring: ${baseline.entries['./monitoring'].values[0] ?? ''}`,
      'added value ./monitoring: zzAddedValue',
    ]);
  });
});
