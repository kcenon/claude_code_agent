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

/**
 * Runtime exports of the root entry that the core entry leaves out: the
 * ControlPlane and DataPlane facades, the controller re-exports of the
 * control plane, and the Monitoring and Controller namespaces (#959).
 */
const OPTIONAL_ROOT_VALUES = [
  'AgentRegistryError',
  'CONTROLLER_PRIORITY_WEIGHTS',
  'ControlPlane',
  'ControlPlaneError',
  'Controller',
  'ControllerCircularDependencyError',
  'ControllerError',
  'DEFAULT_ANALYZER_CONFIG',
  'DataAccessError',
  'DataPlane',
  'DataPlaneError',
  'DataValidationError',
  'EmptyGraphError',
  'GraphNotFoundError',
  'GraphParseError',
  'GraphValidationError',
  'IssueNotFoundError',
  'Monitoring',
  'PipelineOperationError',
  'PriorityAnalysisError',
  'PriorityAnalyzer',
  'SerializationError',
  'camelToSnake',
  'getControlPlane',
  'getDataPlane',
  'resetControlPlane',
  'resetDataPlane',
  'snakeToCamel',
  'toCamelCase',
  'toSnakeCase',
];

describe('public API surface', () => {
  it('matches the recorded baseline (run npm run api:surface -- --write after review)', () => {
    expect(diffApiSurface(readApiSurface(), computeApiSurface())).toEqual([]);
  }, 180_000);

  it('records core as the root without the optional subsystems', () => {
    const { entries } = readApiSurface();
    for (const kind of ['values', 'types'] as const) {
      const root = new Set(entries['.'][kind]);
      expect(
        entries['./core'][kind].filter((name) => !root.has(name)),
        kind
      ).toEqual([]);
    }
    const core = new Set(entries['./core'].values);
    expect(entries['.'].values.filter((name) => !core.has(name))).toEqual(OPTIONAL_ROOT_VALUES);
  });

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
