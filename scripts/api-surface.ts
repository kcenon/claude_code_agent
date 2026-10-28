/**
 * Public API surface of the supported package entry points.
 *
 * For every supported `exports` entry, records the names the entry exports,
 * split into values (present at runtime) and type-only names. The recorded
 * baseline (`tests/package/api-surface.json`) is compared with the source by
 * `tests/package/api-surface.test.ts` and with the packed tarball by the
 * package smoke test, so a change to a supported surface is always explicit.
 *
 * Usage: tsx scripts/api-surface.ts [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Repository root. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Recorded baseline, relative to the repository root. */
export const API_SURFACE_PATH = 'tests/package/api-surface.json';

/**
 * Supported entry points: package subpath to source module. `.` is the
 * compatibility root, `./core` the root without the optional subsystems, and
 * the others are the subpaths ADR-0006 accepted for optional capabilities.
 */
export const API_ENTRY_POINTS = {
  '.': 'src/index.ts',
  './core': 'src/core.ts',
  './control-plane': 'src/control-plane/index.ts',
  './data-plane': 'src/data-plane/index.ts',
  './controller': 'src/controller/index.ts',
  './monitoring': 'src/monitoring/index.ts',
} as const satisfies Record<string, string>;

/** Subpath of a supported entry point. */
export type ApiEntryPoint = keyof typeof API_ENTRY_POINTS;

/** Names one entry point exports. */
export interface EntrySurface {
  /** Exports present at runtime (functions, classes, constants, namespaces) */
  readonly values: readonly string[];
  /** Type-only exports (interfaces, type aliases, `export type`) */
  readonly types: readonly string[];
}

/** Recorded surface of every supported entry point. */
export interface ApiSurface {
  readonly schemaVersion: 1;
  readonly entries: Readonly<Record<ApiEntryPoint, EntrySurface>>;
}

/**
 * Build-output location of a source module.
 * @param source - Source module (`src/<path>.ts`)
 * @param extension - `.js` or `.d.ts`
 * @returns Package-relative output path (`./dist/<path><extension>`)
 */
export function distPath(source: string, extension: '.js' | '.d.ts'): string {
  return `./dist/${source.slice('src/'.length, -'.ts'.length)}${extension}`;
}

/**
 * Compute the surface of every supported entry point from the source.
 * @param root - Repository root
 * @returns Surface per entry point, names sorted
 * @throws Error when an entry point does not exist or is not a module
 */
export function computeApiSurface(root: string = REPO_ROOT): ApiSurface {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), (path) => ts.sys.readFile(path));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const files = Object.values(API_ENTRY_POINTS).map((file) => resolve(root, file));
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const entries = {} as Record<ApiEntryPoint, EntrySurface>;
  for (const [subpath, file] of Object.entries(API_ENTRY_POINTS) as [ApiEntryPoint, string][]) {
    const sourceFile = program
      .getSourceFiles()
      .find((candidate) => resolve(candidate.fileName) === resolve(root, file));
    const moduleSymbol =
      sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) throw new Error(`${file} is not a module of the program`);
    const values: string[] = [];
    const types: string[] = [];
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const target =
        (exported.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(exported)
          : exported;
      const typeOnly = checker.getTypeOnlyAliasDeclaration(exported) !== undefined;
      (!typeOnly && (target.flags & ts.SymbolFlags.Value) !== 0 ? values : types).push(
        exported.name
      );
    }
    entries[subpath] = { values: values.sort(), types: types.sort() };
  }
  return { schemaVersion: 1, entries };
}

/**
 * Read the recorded baseline.
 * @param root - Repository root
 * @returns Recorded surface
 */
export function readApiSurface(root: string = REPO_ROOT): ApiSurface {
  return JSON.parse(readFileSync(join(root, API_SURFACE_PATH), 'utf8')) as ApiSurface;
}

/**
 * Names added to or removed from each entry point, relative to the baseline.
 * @param baseline - Recorded surface
 * @param current - Computed surface
 * @returns One line per changed name; empty when the surfaces match
 */
export function diffApiSurface(baseline: ApiSurface, current: ApiSurface): string[] {
  const lines: string[] = [];
  for (const subpath of Object.keys(API_ENTRY_POINTS) as ApiEntryPoint[])
    for (const kind of ['values', 'types'] as const) {
      const before = new Set(baseline.entries[subpath]?.[kind] ?? []);
      const after = new Set(current.entries[subpath][kind]);
      for (const name of before)
        if (!after.has(name)) lines.push(`removed ${kind.slice(0, -1)} ${subpath}: ${name}`);
      for (const name of after)
        if (!before.has(name)) lines.push(`added ${kind.slice(0, -1)} ${subpath}: ${name}`);
    }
  return lines;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const current = computeApiSurface();
  if (process.argv.includes('--write')) {
    writeFileSync(join(REPO_ROOT, API_SURFACE_PATH), `${JSON.stringify(current, null, 2)}\n`);
    process.stdout.write(`Updated ${API_SURFACE_PATH}\n`);
  } else {
    const changes = diffApiSurface(readApiSurface(), current);
    for (const line of changes) process.stdout.write(`${line}\n`);
    if (changes.length > 0) {
      process.stdout.write(
        'The public API surface changed. Review the changes, then run: npm run api:surface -- --write\n'
      );
      process.exitCode = 1;
    } else process.stdout.write('Public API surface matches the recorded baseline\n');
  }
}
