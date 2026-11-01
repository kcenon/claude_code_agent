/**
 * Enhancement live acceptance scenarios (#957).
 *
 * A compact existing project (`fixtures/enhancement-target`) with canonical
 * documents, working code, required tests, and exactly one planted
 * document/code drift, plus an expectation file
 * (`fixtures/enhancement-expectation.json`), independent acceptance tests
 * (`fixtures/enhancement-acceptance`), a reference solution
 * (`fixtures/enhancement-reference`), and wrong variants
 * (`fixtures/enhancement-wrong`). The live lane pushes the target to a disposable
 * GitHub repository, runs the installed npm package with
 * `ad-sdlc run --mode enhancement` against a clone, judges the result, and removes
 * only what the run created.
 *
 * Everything that judges a run is pure and checked offline by
 * tests/ci/enhancement-fixture.test.ts. The judge does not use the production
 * document parsers: `parseDocumentIds` is its own small parser, cross-checked
 * against `TraceabilityCheck` offline. The GitHub and SDK parts run only in the
 * live lane.
 */

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import type { LiveBudget } from '../../scripts/live-lane.js';
import { ENHANCEMENT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import {
  applyTurnBudgetTo,
  asNumber,
  asRecord,
  asString,
  cell,
  exec,
  materializeFixture,
  parseRunOutput,
  pipelineRunArguments,
  renderInvocation,
  runAcceptanceTests,
  sdkEvidenceProblems,
  stageStatus,
  type AcceptanceResult,
  type InstalledCli,
  type InvocationEvidence,
} from './scenarioSupport.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** Fixture paths. */
export const ENHANCEMENT_FIXTURE = {
  target: join(FIXTURES, 'enhancement-target'),
  expectation: join(FIXTURES, 'enhancement-expectation.json'),
  acceptance: join(FIXTURES, 'enhancement-acceptance'),
  reference: join(FIXTURES, 'enhancement-reference'),
  wrong: join(FIXTURES, 'enhancement-wrong'),
} as const;

/** Agents of the Enhancement stages; each gets the lane's turn budget. */
export const ENHANCEMENT_AGENTS: readonly string[] = ENHANCEMENT_STAGES.map(
  (stage) => stage.agentType
);

/** Variable that makes the target's retained report tests fail (scenario b). */
export const REGRESSION_ENV = 'AD_SDLC_FIXTURE_REGRESSION';

/** File the retained report test writes when {@link REGRESSION_ENV} reaches it. */
export const REGRESSION_MARKER = join('.ad-sdlc', 'fixture-regression-seen');

/** Stage whose artifacts hold the document/code comparison. */
export const COMPARISON_STAGE = 'doc_code_comparison';

/** Acceptance test files, without their `.test.mjs` suffix. */
const ACCEPTANCE_KEYS = { retained: 'retained', feature: 'feature' } as const;

const ID = /^(?:FR|SF|CMP)-\d{3}$/;
const IdsSchema = z.array(z.string().regex(ID)).min(1);
const KindSchema = z.enum([
  'documented_not_implemented',
  'implemented_not_documented',
  'partial_implementation',
  'documentation_code_mismatch',
]);

/** Schema of `fixtures/enhancement-expectation.json`. */
export const EnhancementExpectationSchema = z
  .object({
    schemaVersion: z.literal(1),
    feature: z
      .object({
        title: z.string().min(1),
        request: z.string().min(1),
        acceptanceCriteria: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    /** Identifiers whose text and links the feature may change */
    impacted: z
      .object({ requirements: IdsSchema, features: IdsSchema, components: IdsSchema })
      .strict(),
    /** Identifiers that must still be defined after the run */
    preserved: z
      .object({ requirements: IdsSchema, features: IdsSchema, components: IdsSchema })
      .strict(),
    /** How many new identifiers of each kind the feature may add */
    newIdAllowance: z
      .object({
        requirements: z.number().int().min(0),
        features: z.number().int().min(0),
        components: z.number().int().min(0),
      })
      .strict(),
    paths: z
      .object({ allowed: z.array(z.string().min(1)).min(1), forbidden: z.array(z.string().min(1)) })
      .strict(),
    drift: z
      .object({
        ids: IdsSchema,
        sourceFile: z.string().min(1),
        acceptedKinds: z.array(KindSchema).min(1),
        /** The run reports the drift and leaves it in place */
        outcome: z.literal('reported-not-fixed'),
      })
      .strict(),
  })
  .strict();

/** Parsed expectation file. */
export type EnhancementExpectation = z.infer<typeof EnhancementExpectationSchema>;

/**
 * Read and validate the expectation file.
 * @param path - Expectation file
 * @returns Expectation
 * @throws Error when the file does not have the expected shape
 */
export function loadEnhancementExpectation(
  path: string = ENHANCEMENT_FIXTURE.expectation
): EnhancementExpectation {
  return EnhancementExpectationSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/** Convert CRLF text to LF in a directory tree, skipping Git metadata. */
function normalizeLineEndings(dir: string): void {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) normalizeLineEndings(path);
    else {
      const content = readFileSync(path, 'utf8');
      if (content.includes('\r\n')) writeFileSync(path, content.replaceAll('\r\n', '\n'));
    }
  }
}

/**
 * Write the target repository into a directory. This repository checks text out
 * with CRLF on every platform; the target holds LF, like most projects, so a
 * model's rewrite of a document stays reviewable as a line diff.
 * @param dir - Destination; created when missing
 */
export function materializeEnhancementTarget(dir: string): void {
  materializeFixture(ENHANCEMENT_FIXTURE.target, dir);
  normalizeLineEndings(dir);
}

/**
 * Lay a solution (the reference, or a wrong variant) over a target checkout.
 * @param dir - Target checkout
 * @param overlay - Directory holding the changed files
 */
export function applyOverlay(dir: string, overlay: string): void {
  cpSync(overlay, dir, { recursive: true });
  normalizeLineEndings(dir);
}

/**
 * Initialize the AD-SDLC project in a clone of the target repository with the
 * installed CLI and give every Enhancement agent the lane's turn budget.
 * @param cli - Installed `ad-sdlc` CLI
 * @param checkout - Clone of the target repository
 * @param budget - Lane budget
 * @param env - Environment
 */
export function prepareEnhancementProject(
  cli: InstalledCli,
  checkout: string,
  budget: LiveBudget,
  env: NodeJS.ProcessEnv
): void {
  exec(cli.command, [...cli.args, 'init', '.', '--quick'], {
    cwd: checkout,
    env,
    timeoutMs: 120_000,
  });
  applyTurnBudget(checkout, budget);
}

/**
 * Set the lane's turn budget in the definition of every Enhancement agent.
 * @param projectDir - Initialized project
 * @param budget - Lane budget
 */
export function applyTurnBudget(projectDir: string, budget: LiveBudget): void {
  applyTurnBudgetTo(projectDir, ENHANCEMENT_AGENTS, budget);
}

/**
 * `ad-sdlc run` arguments of a first Enhancement invocation.
 * @param projectDir - Clone of the target repository
 * @param budget - Lane budget
 * @param requirements - Requirements text
 * @param extra - Additional flags, such as `--dry-run` or `--stop-after`
 * @returns CLI arguments
 */
export function enhancementRunArguments(
  projectDir: string,
  budget: LiveBudget,
  requirements: string,
  extra: readonly string[] = []
): string[] {
  return pipelineRunArguments('enhancement', projectDir, budget, requirements, extra);
}

/**
 * Requirements text of an Enhancement run. It becomes every stage's work order.
 * It names the feature and the rules, and never the planted drift: the comparison
 * stage has to find that on its own.
 * @param expectation - Expectation file
 * @returns Requirements
 */
export function enhancementRequirements(expectation: EnhancementExpectation): string {
  return [
    expectation.feature.request,
    `Acceptance criteria: ${expectation.feature.acceptanceCriteria.join('; ')}.`,
    'Implement only this feature.',
    'Report every difference the analysis finds between the documents and the code, and leave it as it is: do not implement, change, or remove anything else.',
    'Update the requirement, feature, and component documents under docs/ for this feature only, keep every existing identifier, and add new identifiers only for this feature.',
    'Put new tests in a new file under test/. Do not modify the existing tests, src/tasks.mjs, package.json, or doc-sync-points.yaml.',
    'Open one pull request for the work. It must carry the updated documents as well as the code and tests.',
    'Leave every pull request open for human review: do not merge or close it.',
  ].join(' ');
}

/** Live scenarios. */
export interface EnhancementScenario {
  readonly id: 'delivery' | 'regression';
  readonly description: string;
  /** Stage the first invocation stops after; the scenario then resumes once */
  readonly stopAfter?: string;
  /** Extra environment of the resumed invocation only */
  readonly resumeEnv: Readonly<Record<string, string>>;
}

export const ENHANCEMENT_SCENARIOS: readonly EnhancementScenario[] = [
  {
    id: 'delivery',
    description:
      'The requested feature is delivered as a reviewable pull request with the expected document delta',
    resumeEnv: {},
  },
  {
    id: 'regression',
    description: 'A regression that appears after implementation blocks delivery',
    // The worker's own test run must pass, or regression_testing is never exercised.
    stopAfter: 'implementation',
    resumeEnv: { [REGRESSION_ENV]: '1' },
  },
];

// -----------------------------------------------------------------------------
// Identifiers and links
// -----------------------------------------------------------------------------

/** Identifier kinds, named as in the expectation file. */
export type IdKind = 'requirements' | 'features' | 'components';

const KIND_OF_PREFIX: Readonly<Record<string, IdKind>> = {
  FR: 'requirements',
  SF: 'features',
  CMP: 'components',
};
/** The kind of identifier each kind links to. */
const PARENT_PREFIX: Readonly<Record<string, string>> = { SF: 'FR', CMP: 'SF' };
const KINDS: readonly IdKind[] = ['requirements', 'features', 'components'];

/** Identifiers defined by a set of documents, and the parents each one links to. */
export interface DocumentIndex {
  readonly defined: Readonly<Record<IdKind, readonly string[]>>;
  /** Parent identifiers of each `SF` (`FR`) and `CMP` (`SF`), sorted */
  readonly links: Readonly<Record<string, readonly string[]>>;
}

/**
 * Parse identifier definitions and links. A definition is a heading of level 2
 * to 5 that starts with the identifier. Its block runs to the next heading of the
 * same or a higher level, and a parent identifier anywhere in the block, the
 * heading included, is a link.
 * @param documents - Document texts
 * @returns Defined identifiers and links
 */
export function parseDocumentIds(documents: readonly string[]): DocumentIndex {
  const defined: Record<IdKind, Set<string>> = {
    requirements: new Set(),
    features: new Set(),
    components: new Set(),
  };
  const links = new Map<string, Set<string>>();
  for (const document of documents) {
    let block: { readonly id: string; readonly level: number; readonly parent?: string } | null =
      null;
    for (const line of document.split(/\r?\n/)) {
      const heading = /^(#{1,6})\s/.exec(line);
      if (heading !== null) {
        const level = (heading[1] ?? '').length;
        const definition = /^#{2,5}\s+(FR|SF|CMP)-\d{3}\b/.exec(line);
        const id = definition === null ? undefined : /(?:FR|SF|CMP)-\d{3}/.exec(line)?.[0];
        if (definition !== null && id !== undefined) {
          const prefix = definition[1] ?? '';
          defined[KIND_OF_PREFIX[prefix] ?? 'requirements'].add(id);
          const parent = PARENT_PREFIX[prefix];
          block = { id, level, ...(parent === undefined ? {} : { parent }) };
          if (parent !== undefined && !links.has(id)) links.set(id, new Set());
        } else if (block !== null && level <= block.level) block = null;
      }
      if (block?.parent !== undefined)
        for (const match of line.matchAll(/\b(FR|SF)-\d{3}\b/g))
          if (match[1] === block.parent) links.get(block.id)?.add(match[0]);
    }
  }
  const sorted = (ids: Iterable<string>): string[] => [...ids].sort();
  return {
    defined: {
      requirements: sorted(defined.requirements),
      features: sorted(defined.features),
      components: sorted(defined.components),
    },
    links: Object.fromEntries(
      [...links.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, parents]) => [id, sorted(parents)])
    ),
  };
}

// -----------------------------------------------------------------------------
// Document delta
// -----------------------------------------------------------------------------

/** Project files by repository-relative path, with LF line endings. */
export type ProjectFiles = Readonly<Record<string, string>>;

/** What a project file is, for the delta judge. */
export type PathClass = 'document' | 'localized-copy' | 'document-index' | 'other';

/**
 * Classify a path. The updaters also write a Korean copy of each document
 * (`prd-updater.md`), which is expected and carries no identifier of its own for
 * the judge, and the index stage writes `docs/.index/`.
 * @param path - Repository-relative path with forward slashes
 * @returns Path class
 */
export function classifyPath(path: string): PathClass {
  if (path.startsWith('docs/.index/')) return 'document-index';
  if (!path.startsWith('docs/') || !path.endsWith('.md')) return 'other';
  return path.endsWith('.kr.md') ? 'localized-copy' : 'document';
}

/**
 * Index of the primary documents among project files.
 * @param files - Project files
 * @returns Document index
 */
export function documentIndex(files: ProjectFiles): DocumentIndex {
  return parseDocumentIds(
    Object.keys(files)
      .filter((path) => classifyPath(path) === 'document')
      .sort()
      .map((path) => files[path] ?? '')
  );
}

/** Before and after state of the documents of a pull request. */
export interface DocumentDelta {
  readonly before: DocumentIndex;
  readonly after: DocumentIndex;
  /** Identifiers defined after but not before, per kind */
  readonly newIds: Readonly<Record<IdKind, readonly string[]>>;
  /** Identifiers defined before but not after */
  readonly removedIds: readonly string[];
  /** Identifiers defined on both sides whose links differ */
  readonly changedLinks: readonly {
    readonly id: string;
    readonly before: readonly string[];
    readonly after: readonly string[];
  }[];
  /** Every added, changed, or deleted path */
  readonly changedPaths: readonly string[];
  /** The changed primary documents */
  readonly changedDocuments: readonly string[];
  /** The changed localized copies, classified and not judged */
  readonly localizedCopies: readonly string[];
}

/**
 * Compare the project files of the base and the head of a pull request.
 * @param before - Files on the base
 * @param after - Files on the head
 * @returns Delta
 */
export function documentDelta(before: ProjectFiles, after: ProjectFiles): DocumentDelta {
  const indexBefore = documentIndex(before);
  const indexAfter = documentIndex(after);
  const changedPaths = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => before[path] !== after[path])
    .sort();
  const defined = (index: DocumentIndex): string[] => KINDS.flatMap((kind) => index.defined[kind]);
  const newOf = (kind: IdKind): string[] =>
    indexAfter.defined[kind].filter((id) => !indexBefore.defined[kind].includes(id));
  return {
    before: indexBefore,
    after: indexAfter,
    newIds: {
      requirements: newOf('requirements'),
      features: newOf('features'),
      components: newOf('components'),
    },
    removedIds: defined(indexBefore).filter((id) => !defined(indexAfter).includes(id)),
    changedLinks: Object.keys(indexBefore.links)
      .filter(
        (id) =>
          indexAfter.links[id] !== undefined &&
          JSON.stringify(indexBefore.links[id]) !== JSON.stringify(indexAfter.links[id])
      )
      .map((id) => ({
        id,
        before: indexBefore.links[id] ?? [],
        after: indexAfter.links[id] ?? [],
      })),
    changedPaths,
    changedDocuments: changedPaths.filter((path) => classifyPath(path) === 'document'),
    localizedCopies: changedPaths.filter((path) => classifyPath(path) === 'localized-copy'),
  };
}

/** The message of a pull request whose documents did not change. */
export const NO_DOCUMENT_DELTA =
  'The pull request changes no document under docs/: the requested feature reached no requirement, feature, or component';

/**
 * Whether a path matches an expectation pattern: the exact path, or `dir/**`.
 * @param path - Repository-relative path
 * @param pattern - Pattern
 * @returns Whether it matches
 */
function matchesPath(path: string, pattern: string): boolean {
  return pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern;
}

/**
 * Problems with a pull request's delta against the expectation: every prior
 * identifier is still defined, links of unimpacted identifiers are unchanged, new
 * identifiers are within the allowance and linked to impacted parents, the new
 * chain reaches the design, and only allowed paths changed.
 * @param expectation - Expectation file
 * @param delta - Delta of the pull request
 * @returns Problems; empty when the delta is the expected one
 */
export function deltaProblems(expectation: EnhancementExpectation, delta: DocumentDelta): string[] {
  const problems: string[] = [];
  for (const path of delta.changedPaths) {
    if (expectation.paths.forbidden.some((pattern) => matchesPath(path, pattern)))
      problems.push(`The pull request changes forbidden path ${path}`);
    else if (!expectation.paths.allowed.some((pattern) => matchesPath(path, pattern)))
      problems.push(`The pull request changes ${path}, which is outside the allowed paths`);
  }
  if (delta.changedDocuments.length === 0) return [NO_DOCUMENT_DELTA, ...problems];

  for (const area of ['docs/prd/', 'docs/srs/', 'docs/sds/'])
    if (!delta.changedDocuments.some((path) => path.startsWith(area)))
      problems.push(`The pull request changes no document under ${area}`);

  const preserved = KINDS.flatMap((kind) => expectation.preserved[kind]);
  for (const id of new Set([...preserved, ...delta.removedIds]))
    if (!KINDS.some((kind) => delta.after.defined[kind].includes(id)))
      problems.push(`Prior identifier ${id} is no longer defined`);

  const impacted = new Set(KINDS.flatMap((kind) => expectation.impacted[kind]));
  for (const change of delta.changedLinks) {
    if (!impacted.has(change.id))
      problems.push(
        `Links of unimpacted ${change.id} changed from [${change.before.join(', ')}] to [${change.after.join(', ')}]`
      );
    else
      for (const parent of change.before)
        if (!change.after.includes(parent))
          problems.push(`Impacted ${change.id} lost its link to ${parent}`);
  }

  for (const kind of KINDS)
    if (delta.newIds[kind].length > expectation.newIdAllowance[kind])
      problems.push(
        `${String(delta.newIds[kind].length)} new ${kind} (${delta.newIds[kind].join(', ')}) exceed the allowance of ${String(expectation.newIdAllowance[kind])}`
      );

  // A new feature links to an impacted or new requirement, a new component to an
  // impacted or new feature, and the new chain has to reach the design.
  const allowedParents: Readonly<Record<'features' | 'components', ReadonlySet<string>>> = {
    features: new Set([...expectation.impacted.requirements, ...delta.newIds.requirements]),
    components: new Set([...expectation.impacted.features, ...delta.newIds.features]),
  };
  for (const kind of ['features', 'components'] as const)
    for (const id of delta.newIds[kind]) {
      const parents = delta.after.links[id] ?? [];
      if (parents.length === 0) problems.push(`New ${id} links to no parent`);
      for (const parent of parents)
        if (!allowedParents[kind].has(parent))
          problems.push(`New ${id} links to ${parent}, which the feature does not impact`);
    }
  const linkedByChildren = new Set(Object.values(delta.after.links).flat());
  for (const id of [...delta.newIds.requirements, ...delta.newIds.features])
    if (!linkedByChildren.has(id))
      problems.push(`New ${id} is not linked from the next document, so the chain stops there`);
  return problems;
}

// -----------------------------------------------------------------------------
// Git helpers (offline-tested against a local repository)
// -----------------------------------------------------------------------------

/**
 * Read every tracked file of a commit.
 * @param checkout - Repository
 * @param ref - Commit
 * @param env - Environment
 * @returns Files with LF line endings
 */
export function filesAtRef(checkout: string, ref: string, env: NodeJS.ProcessEnv): ProjectFiles {
  const names = exec('git', ['ls-tree', '-r', '-z', '--name-only', ref], {
    cwd: checkout,
    env,
  })
    .split('\0')
    .filter((name) => name !== '');
  return Object.fromEntries(
    names.map((name) => [
      name,
      exec('git', ['show', `${ref}:${name}`], { cwd: checkout, env }).replaceAll('\r\n', '\n'),
    ])
  );
}

/**
 * The reviewable before/after diff of the documents of a pull request.
 * @param checkout - Repository holding both commits
 * @param base - Base commit
 * @param head - Head commit
 * @param env - Environment
 * @returns Unified diff; empty when no document changed
 */
export function documentDiff(
  checkout: string,
  base: string,
  head: string,
  env: NodeJS.ProcessEnv
): string {
  return exec(
    'git',
    ['diff', '--no-color', '--ignore-cr-at-eol', base, head, '--', 'docs', ':(exclude)docs/.index'],
    { cwd: checkout, env }
  );
}

/** Acceptance result without its output, as the report keeps it. */
export type AcceptanceSummary = Omit<AcceptanceResult, 'output'>;

/** What the independent checks found on the head of a pull request. */
export interface PullRequestJudgement {
  readonly delta: DocumentDelta;
  readonly diff: string;
  /** The behavior the project had before the run */
  readonly retained: AcceptanceSummary;
  /** The requested feature */
  readonly feature: AcceptanceSummary;
  /** Whether the file of the planted drift exists on the head */
  readonly driftSourcePresent: boolean;
}

/**
 * Judge the head of a pull request: the document delta against the base, and the
 * retained and feature acceptance tests with the fixture switches cleared. The
 * head stays checked out.
 * @param checkout - Repository holding both commits
 * @param base - Base commit
 * @param head - Head commit
 * @param expectation - Expectation file
 * @param env - Environment
 * @returns Judgement
 */
export function judgePullRequestHead(
  checkout: string,
  base: string,
  head: string,
  expectation: EnhancementExpectation,
  env: NodeJS.ProcessEnv
): PullRequestJudgement {
  const after = filesAtRef(checkout, head, env);
  const delta = documentDelta(filesAtRef(checkout, base, env), after);
  exec('git', ['checkout', '--detach', head], { cwd: checkout, env });
  const run = (key: string): AcceptanceSummary => {
    const { output: _output, ...summary } = runAcceptanceTests(checkout, {
      sourceDir: ENHANCEMENT_FIXTURE.acceptance,
      keys: [key],
      clearedEnv: [REGRESSION_ENV],
    });
    return summary;
  };
  return {
    delta,
    diff: documentDiff(checkout, base, head, env),
    retained: run(ACCEPTANCE_KEYS.retained),
    feature: run(ACCEPTANCE_KEYS.feature),
    driftSourcePresent: after[expectation.drift.sourceFile] !== undefined,
  };
}

// -----------------------------------------------------------------------------
// Drift detection
// -----------------------------------------------------------------------------

/** One entry a comparison artifact reports. */
export interface ReportedGap {
  readonly artifact: string;
  /** Compact entry text, shortened for the report */
  readonly text: string;
}

/** What the comparison stage's artifacts say about the planted drift. */
export interface DriftEvidence {
  /** Artifacts the comparison stage produced, from the run result */
  readonly artifacts: readonly string[];
  /** Whether an entry names the planted identifier, its source file, and an accepted kind */
  readonly detected: boolean;
  /** Artifact holding that entry */
  readonly artifact: string | null;
  /** Accepted kind that entry names */
  readonly kind: string | null;
  /** Every gap entry the artifacts report: the drift the run left unresolved */
  readonly unresolved: readonly ReportedGap[];
}

/** Longest gap entry kept in the report. */
const GAP_TEXT_LIMIT = 300;

/**
 * Structured entries of an artifact: every array element, and every object under
 * a key path that names gaps, each with its key path. The whole file is never an
 * entry, so a kind counted in a summary cannot combine with an identifier from
 * an unrelated mapping row.
 * @param value - Parsed artifact
 * @param path - Key path of the value
 * @returns Entries
 */
function structuredEntries(
  value: unknown,
  path = ''
): { readonly path: string; readonly text: string }[] {
  if (Array.isArray(value))
    return value.flatMap((element) => [
      { path, text: JSON.stringify(element) },
      ...structuredEntries(element, path),
    ]);
  const record = asRecord(value);
  if (record === undefined) return [];
  return Object.entries(record).flatMap(([key, child]) => {
    const childPath = `${path}.${key}`;
    const named =
      /gap/i.test(path) && asRecord(child) !== undefined
        ? [{ path: childPath, text: JSON.stringify(child) }]
        : [];
    return [...named, ...structuredEntries(child, childPath)];
  });
}

/**
 * Parse an artifact as JSON or YAML.
 * @param content - Artifact text
 * @returns Parsed value; undefined when it is neither
 */
function parseArtifact(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    try {
      return yaml.load(content);
    } catch {
      return undefined;
    }
  }
}

/**
 * Judge the comparison stage's artifacts directly: no definition lists them as an
 * input, so the drift need not reach the documents or the issues.
 * @param expectation - Expectation file
 * @param artifacts - Path and text of each artifact of the comparison stage
 * @returns Evidence
 */
export function driftEvidence(
  expectation: EnhancementExpectation,
  artifacts: readonly { readonly path: string; readonly content: string }[]
): DriftEvidence {
  const { ids, sourceFile, acceptedKinds } = expectation.drift;
  let artifact: string | null = null;
  let kind: string | null = null;
  let match: ReportedGap | null = null;
  const unresolved: ReportedGap[] = [];
  for (const file of artifacts) {
    for (const entry of structuredEntries(parseArtifact(file.content))) {
      const gap = { artifact: file.path, text: entry.text.slice(0, GAP_TEXT_LIMIT) };
      // Whole objects only: a list of identifiers inside a gap is not a gap of its own.
      if (
        /gap/i.test(entry.path) &&
        !/summary|statistic/i.test(entry.path) &&
        entry.text[0] === '{'
      )
        unresolved.push(gap);
      const text = `${entry.path} ${entry.text}`;
      const named = acceptedKinds.find((candidate) => text.includes(candidate));
      if (
        artifact === null &&
        named !== undefined &&
        text.includes(sourceFile) &&
        ids.some((id) => text.includes(id))
      ) {
        artifact = file.path;
        kind = named;
        match = gap;
      }
    }
  }
  // An artifact need not call its list "gaps"; the planted drift is still unresolved.
  if (unresolved.length === 0 && match !== null) unresolved.push(match);
  return {
    artifacts: artifacts.map((file) => file.path),
    detected: artifact !== null,
    artifact,
    kind,
    unresolved,
  };
}

/**
 * The artifacts of a stage in a run's JSON output, not a hard-coded file name.
 * @param stdout - CLI standard output
 * @param stage - Stage name
 * @returns Project-relative artifact paths
 */
export function stageArtifactPaths(stdout: string, stage: string): string[] {
  const { result } = parseRunOutput(stdout);
  const entry = (Array.isArray(result['stages']) ? result['stages'] : [])
    .map(asRecord)
    .find((candidate) => candidate?.['name'] === stage);
  const artifacts = entry?.['artifacts'];
  return Array.isArray(artifacts)
    ? artifacts.flatMap((artifact) => {
        const path = asString(artifact) ?? asString(asRecord(artifact)?.['path']);
        return path === null ? [] : [posix.normalize(path.replaceAll('\\', '/'))];
      })
    : [];
}

// -----------------------------------------------------------------------------
// Run summary
// -----------------------------------------------------------------------------

/** Usage of a run. Unknown values are null, never 0 (docs/guides/delivery-metrics.md). */
export interface RunUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
}

/** Summary of one invocation, read from `metrics.records` and the run result. */
export interface RunSummary {
  readonly invocation: string;
  readonly completed: boolean;
  readonly status: string | null;
  /** Pipeline duration; null without a pipeline record */
  readonly durationMs: number | null;
  /** Null when the run made no attempt or has no pipeline record */
  readonly usage: RunUsage | null;
  readonly turnCount: number | null;
  readonly toolUseCount: number | null;
  readonly attempts: number | null;
  readonly verification: string | null;
  readonly traceability: string | null;
  readonly uncovered: readonly string[];
}

/**
 * Summarize one invocation from the CLI's JSON output.
 * @param invocation - Label
 * @param stdout - CLI standard output
 * @returns Summary; everything unknown is null
 */
export function runSummary(invocation: string, stdout: string): RunSummary {
  const { result } = parseRunOutput(stdout);
  const records = asRecord(result['metrics'])?.['records'];
  const pipeline = (Array.isArray(records) ? records : [])
    .map(asRecord)
    .find((record) => record?.['kind'] === 'pipeline');
  const usage = asRecord(pipeline?.['usage']);
  const traceability = asRecord(result['traceability']);
  const uncovered = traceability?.['uncovered'];
  const status = asString(result['overallStatus']) ?? asString(pipeline?.['status']);
  return {
    invocation,
    completed: status === 'completed',
    status,
    durationMs: asNumber(pipeline?.['durationMs']),
    usage:
      usage === undefined
        ? null
        : {
            inputTokens: asNumber(usage['inputTokens']),
            outputTokens: asNumber(usage['outputTokens']),
            cacheReadInputTokens: asNumber(usage['cacheReadInputTokens']),
            cacheCreationInputTokens: asNumber(usage['cacheCreationInputTokens']),
          },
    turnCount: asNumber(pipeline?.['turnCount']),
    toolUseCount: asNumber(pipeline?.['toolUseCount']),
    attempts: asNumber(asRecord(pipeline?.['attempts'])?.['total']),
    verification: asString(asRecord(result['verification'])?.['status']),
    traceability: asString(traceability?.['status']),
    uncovered: Array.isArray(uncovered) ? uncovered.flatMap((id) => asString(id) ?? []) : [],
  };
}

// -----------------------------------------------------------------------------
// Scenario verdicts
// -----------------------------------------------------------------------------

/** A pull request a scenario created. */
export interface EnhancementPullRequest {
  readonly number: number;
  readonly state: string;
  readonly merged: boolean;
  readonly headRefName: string;
  readonly judgement: PullRequestJudgement | null;
}

/** What a scenario run observed. */
export interface EnhancementObservation {
  readonly invocations: readonly InvocationEvidence[];
  /** One summary per invocation, in order */
  readonly runs: readonly RunSummary[];
  readonly pullRequests: readonly EnhancementPullRequest[];
  /** Pull requests that existed after the first invocation of a stopped run */
  readonly pullRequestsAtStop: number;
  /** Comparison evidence of the first invocation; null when the stage did not run */
  readonly drift: DriftEvidence | null;
  /** Whether the regression switch reached a retained test */
  readonly regressionSwitchSeen: boolean;
}

/** One judged criterion of a scenario. */
export interface JudgeRow {
  readonly criterion: string;
  readonly problems: readonly string[];
}

const describeRun = (invocation: InvocationEvidence): string =>
  `${invocation.invocation} ended ${String(invocation.status)} with exit ${String(invocation.exitCode)}`;

/**
 * Judge the delivery scenario, one row per criterion.
 * @param observation - What the run observed
 * @param expectation - Expectation file
 * @returns Rows
 */
function deliveryRows(
  observation: EnhancementObservation,
  expectation: EnhancementExpectation
): JudgeRow[] {
  const { invocations, runs, pullRequests, drift } = observation;
  const [first] = invocations;
  const run: string[] = [];
  if (first === undefined) run.push('no invocation ran');
  else {
    if (first.exitCode !== 0 || first.status !== 'completed') run.push(describeRun(first));
    for (const stage of ['review', 'doc_indexing'])
      if (stageStatus(first, stage) !== 'completed') run.push(`${stage} did not complete`);
    if (!first.attempts.some((attempt) => attempt.execution === 'sdk'))
      run.push('the first invocation made no SDK attempt');
    run.push(...sdkEvidenceProblems(first));
    if (runs[0]?.traceability !== 'covered')
      run.push(
        `traceability is ${String(runs[0]?.traceability)}${
          (runs[0]?.uncovered.length ?? 0) > 0
            ? `; uncovered: ${(runs[0]?.uncovered ?? []).join(', ')}`
            : ''
        }`
      );
  }

  const requests: string[] = [];
  if (pullRequests.length === 0) requests.push('no pull request was opened');
  else if (pullRequests.length > 1)
    requests.push(`${String(pullRequests.length)} pull requests were opened instead of one`);
  for (const pr of pullRequests) {
    if (pr.merged) requests.push(`pull request #${String(pr.number)} was merged`);
    if (pr.state !== 'OPEN') requests.push(`pull request #${String(pr.number)} is ${pr.state}`);
  }

  const detection: string[] = [];
  if (drift === null) detection.push('the comparison stage produced no artifact to judge');
  else if (!drift.detected)
    detection.push(
      `no entry of ${drift.artifacts.join(', ') || 'the comparison artifacts'} names ${expectation.drift.ids.join(' or ')}, ${expectation.drift.sourceFile}, and one of the kinds ${expectation.drift.acceptedKinds.join(', ')}`
    );

  const judged = pullRequests.flatMap((pr) =>
    pr.judgement === null ? [] : [{ number: pr.number, judgement: pr.judgement }]
  );
  const delta = judged.flatMap(({ judgement }) => deltaProblems(expectation, judgement.delta));
  const acceptance = judged.flatMap(({ number, judgement }) => {
    const label = `pull request #${String(number)}`;
    return [
      ...(judgement.retained.passed ? [] : [`retained tests did not pass on ${label}`]),
      ...(judgement.feature.passed ? [] : [`feature tests did not pass on ${label}`]),
    ];
  });
  const fixed = judged.flatMap(({ number, judgement }) =>
    judgement.driftSourcePresent
      ? [
          `pull request #${String(number)} adds ${expectation.drift.sourceFile}: the drift was silently fixed instead of reported`,
        ]
      : []
  );
  return [
    { criterion: 'Run completed and traced', problems: run },
    { criterion: 'One open, unmerged pull request', problems: requests },
    { criterion: 'Seeded mismatch detected with a reference', problems: detection },
    { criterion: 'Only expected relationships changed', problems: delta },
    { criterion: 'Acceptance and retained tests pass', problems: acceptance },
    { criterion: 'Drift reported, not silently fixed', problems: fixed },
  ];
}

/**
 * Judge the regression scenario, one row per criterion. If the switch did not
 * reach the tests the scenario reports that instead of passing, even when the
 * stage failed for another reason.
 * @param observation - What the run observed
 * @returns Rows
 */
function regressionRows(observation: EnhancementObservation): JudgeRow[] {
  const [first, resumed] = observation.invocations;
  const stop: string[] = [];
  if (first === undefined) stop.push('no invocation ran');
  else {
    if (first.exitCode !== 0) stop.push(`the stopped run: ${describeRun(first)}`);
    if (stageStatus(first, 'implementation') !== 'completed')
      stop.push('implementation did not complete before the stop');
    stop.push(...sdkEvidenceProblems(first));
  }
  if (observation.pullRequestsAtStop > 0) stop.push('a pull request was opened before the stop');

  const blocked: string[] = [];
  const reached: string[] = [];
  if (resumed === undefined) blocked.push('the run was not resumed');
  else {
    if (!resumed.resumed) blocked.push('the second invocation did not resume the session');
    if (resumed.exitCode === 0) blocked.push('the resume exited 0 although a retained test failed');
    if (resumed.status === 'completed') blocked.push('the resume reported completed delivery');
    const regression = resumed.stages.find((stage) => stage.stage === 'regression_testing');
    if (regression?.status === 'completed' || regression?.status === 'degraded')
      blocked.push('regression_testing completed although a retained test failed');
    if (regression?.failedChecks.some((check) => check.startsWith('VR-REG-002')) !== true)
      blocked.push('VR-REG-002 is not among the failed checks of regression_testing');
    for (const stage of ['validation-agent', 'review', 'doc_indexing'])
      if (stageStatus(resumed, stage) === 'completed') blocked.push(`${stage} completed`);
    blocked.push(...sdkEvidenceProblems(resumed));
    if (!observation.regressionSwitchSeen)
      reached.push(
        `${REGRESSION_ENV} did not reach a retained test: the SDK child or its Bash tool did not inherit it, or regression_testing did not run test/report.test.mjs`
      );
  }
  if (observation.pullRequests.length > 0)
    blocked.push(`${String(observation.pullRequests.length)} pull request(s) were opened`);
  return [
    { criterion: 'Run stopped after implementation', problems: stop },
    { criterion: 'Regression blocks delivery', problems: blocked },
    { criterion: 'Regression switch reached the tests', problems: reached },
  ];
}

/**
 * Judge a scenario run, one row per criterion.
 * @param scenario - Scenario
 * @param observation - What the run observed
 * @param expectation - Expectation file
 * @returns Rows
 */
export function judgeEnhancementScenario(
  scenario: EnhancementScenario,
  observation: EnhancementObservation,
  expectation: EnhancementExpectation
): JudgeRow[] {
  return scenario.id === 'delivery'
    ? deliveryRows(observation, expectation)
    : regressionRows(observation);
}

/**
 * Judge a scenario run. The live test fails when this returns problems; the same
 * rules are checked offline against the reference and the wrong variants.
 * @param scenario - Scenario
 * @param observation - What the run observed
 * @param expectation - Expectation file
 * @returns Problems; empty when the scenario passed
 */
export function evaluateEnhancementScenario(
  scenario: EnhancementScenario,
  observation: EnhancementObservation,
  expectation: EnhancementExpectation
): string[] {
  return judgeEnhancementScenario(scenario, observation, expectation).flatMap(
    (row) => row.problems
  );
}

// -----------------------------------------------------------------------------
// Report
// -----------------------------------------------------------------------------

/** Result of one scenario. */
export interface EnhancementScenarioResult {
  readonly id: EnhancementScenario['id'];
  readonly description: string;
  readonly outcome: 'passed' | 'failed';
  readonly reason: string | null;
  readonly rows: readonly JudgeRow[];
  readonly invocations: readonly InvocationEvidence[];
  readonly runs: readonly RunSummary[];
  /** Issues the run generated in the target repository */
  readonly issues: readonly number[];
  readonly pullRequests: readonly EnhancementPullRequest[];
  readonly drift: DriftEvidence | null;
  /** Human corrections cannot be inferred from CI; a person records them */
  readonly requiredHumanCorrections: null;
  readonly cleanup: readonly string[];
}

/** Report header data. */
export interface EnhancementReportMeta {
  readonly runId: string;
  readonly repository: string;
  readonly packageVersion: string | null;
  readonly sdkVersion: string | null;
  readonly budget: LiveBudget;
  /** Authentication mode of the lane */
  readonly auth: string;
  /** Tool permissions granted to the pipeline's agent sessions */
  readonly permissions: {
    readonly defaultMode: string;
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly startedAt: string;
  readonly finishedAt: string;
}

/**
 * Replace exact secret values in report text. The diff and the gap entries hold
 * text a model wrote, so the report never relies on it being free of credentials.
 * @param text - Report text
 * @param secrets - Secret values; empty values are ignored
 * @returns Text without the values
 */
export function redactValues(text: string, secrets: readonly (string | undefined)[]): string {
  return secrets
    .filter((secret): secret is string => secret !== undefined && secret !== '')
    .reduce((current, secret) => current.split(secret).join('[redacted]'), text);
}

/**
 * The before/after document diffs of the results, as the file saved next to the
 * report: cleanup closes the pull requests, so the diff must outlive them.
 * @param results - Scenario results
 * @returns Diff text; a note when no pull request was judged
 */
export function renderDocumentDiffs(results: readonly EnhancementScenarioResult[]): string {
  const sections = results.flatMap((result) =>
    result.pullRequests.flatMap((pr) =>
      pr.judgement === null
        ? []
        : [`# ${result.id}: pull request #${String(pr.number)}\n\n${pr.judgement.diff}`]
    )
  );
  return sections.length === 0
    ? '# No pull request was judged, so there is no document diff.\n'
    : sections.join('\n');
}

const count = (value: number | null | undefined): string => cell(value ?? null);

/**
 * Render the Markdown run report: every scenario, invocation, stage, and attempt,
 * including failed and skipped ones, usage and duration per run (unknown shown as
 * unknown, never 0), the unresolved drift, and the document diff.
 * @param meta - Report header
 * @param results - Scenario results
 * @returns Markdown
 */
export function renderEnhancementReport(
  meta: EnhancementReportMeta,
  results: readonly EnhancementScenarioResult[]
): string {
  const lines = [
    '# Enhancement Live Acceptance Report (#957)',
    '',
    `Run \`${meta.runId}\` against \`${meta.repository}\`; package ${cell(meta.packageVersion)}, SDK ${cell(meta.sdkVersion)}; authentication ${meta.auth}; budget maxTurns ${String(meta.budget.maxTurns)}, stage ${String(meta.budget.stageTimeoutMs)} ms; ${meta.startedAt} to ${meta.finishedAt}.`,
    '',
    `Agent session permissions: mode \`${meta.permissions.defaultMode}\`; allowed ${meta.permissions.allow.map((rule) => `\`${rule}\``).join(', ')}; denied ${meta.permissions.deny.map((rule) => `\`${rule}\``).join(', ')}.`,
    '',
    '| Scenario | Outcome | Reason |',
    '| --- | --- | --- |',
    ...results.map((result) => `| ${result.id} | ${result.outcome} | ${cell(result.reason)} |`),
  ];
  for (const result of results) {
    lines.push(
      '',
      `## ${result.id}: ${result.description}`,
      '',
      `Outcome **${result.outcome}**. Generated issues: ${result.issues.map((issue) => `#${String(issue)}`).join(', ') || 'none'}.`,
      '',
      '| Criterion | Result | Problems |',
      '| --- | --- | --- |',
      ...result.rows.map(
        (row) =>
          `| ${row.criterion} | ${row.problems.length === 0 ? 'pass' : 'fail'} | ${cell(row.problems.join('; ') || null)} |`
      ),
      '',
      '| Invocation | Completed | Status | Duration (ms) | Input tokens | Output tokens | Cache read | Cache creation | Turns | Tool uses | Attempts | Verification | Traceability |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...result.runs.map(
        (run) =>
          `| ${run.invocation} | ${String(run.completed)} | ${cell(run.status)} | ${count(run.durationMs)} | ${count(run.usage?.inputTokens)} | ${count(run.usage?.outputTokens)} | ${count(run.usage?.cacheReadInputTokens)} | ${count(run.usage?.cacheCreationInputTokens)} | ${count(run.turnCount)} | ${count(run.toolUseCount)} | ${count(run.attempts)} | ${cell(run.verification)} | ${cell(run.traceability)} |`
      )
    );
    for (const invocation of result.invocations) lines.push(...renderInvocation(invocation));
    lines.push(
      '',
      '### Unresolved drift',
      '',
      result.drift === null
        ? 'The comparison stage produced no artifact.'
        : `Planted drift ${result.drift.detected ? `detected in \`${String(result.drift.artifact)}\` as \`${String(result.drift.kind)}\`` : 'not detected'}. Artifacts: ${result.drift.artifacts.map((path) => `\`${path}\``).join(', ') || 'none'}.`
    );
    if (result.drift !== null && result.drift.unresolved.length > 0)
      lines.push(
        '',
        '| Artifact | Reported gap |',
        '| --- | --- |',
        ...result.drift.unresolved.map((gap) => `| ${cell(gap.artifact)} | ${cell(gap.text)} |`)
      );
    lines.push(
      '',
      '### Pull requests',
      '',
      '| Pull request | State | Merged | Retained | Feature | New identifiers | Changed documents | Localized copies |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...result.pullRequests.map((pr) => {
        const judged = pr.judgement;
        const score = (summary: AcceptanceSummary | undefined): string =>
          summary === undefined
            ? 'not run'
            : `${String(summary.pass)}/${String(summary.tests)} passed`;
        return `| #${String(pr.number)} | ${pr.state} | ${String(pr.merged)} | ${score(judged?.retained)} | ${score(judged?.feature)} | ${cell(judged === null ? null : KINDS.flatMap((kind) => judged.delta.newIds[kind]).join(', ') || 'none')} | ${cell(judged === null ? null : judged.delta.changedDocuments.join(', ') || 'none')} | ${cell(judged === null ? null : judged.delta.localizedCopies.join(', ') || 'none')} |`;
      }),
      '',
      `Required human corrections: not assessed (${cell(result.requiredHumanCorrections)}). A person records them in the \`delivery_review\` template and passes it to \`ad-sdlc telemetry report --supplied\`.`
    );
    for (const pr of result.pullRequests)
      if (pr.judgement !== null)
        lines.push(
          '',
          `### Document diff of pull request #${String(pr.number)}`,
          '',
          '````diff',
          pr.judgement.diff.trimEnd() || '(no document changed)',
          '````'
        );
    lines.push('', `Cleanup: ${result.cleanup.join('; ') || 'nothing to clean up'}.`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Problems with the run report: it must cover every scenario and invocation, list
 * every attempt, say what is unknown, and include the unsuccessful stages the
 * scenarios produce, not only the successful example.
 * @param results - Scenario results
 * @param markdown - Rendered report
 * @returns Problems; empty when the report is complete
 */
export function enhancementReportProblems(
  results: readonly EnhancementScenarioResult[],
  markdown: string
): string[] {
  const problems: string[] = [];
  for (const scenario of ENHANCEMENT_SCENARIOS)
    if (!results.some((result) => result.id === scenario.id))
      problems.push(`scenario ${scenario.id} is missing`);
  for (const result of results) {
    if (!markdown.includes(`## ${result.id}:`)) problems.push(`no section for ${result.id}`);
    for (const invocation of result.invocations) {
      if (!markdown.includes(`### ${invocation.invocation}`))
        problems.push(`${result.id}: invocation ${invocation.invocation} is missing`);
      for (const attempt of invocation.attempts)
        if (attempt.sdkSessionId !== null && !markdown.includes(attempt.sdkSessionId))
          problems.push(`${result.id}: attempt ${attempt.sdkSessionId} is missing`);
    }
    for (const run of result.runs)
      if (!markdown.includes(`| ${run.invocation} | ${String(run.completed)} |`))
        problems.push(`${result.id}: no usage row for ${run.invocation}`);
    for (const pr of result.pullRequests)
      if (
        pr.judgement !== null &&
        !markdown.includes(`### Document diff of pull request #${String(pr.number)}`)
      )
        problems.push(`${result.id}: no document diff for pull request #${String(pr.number)}`);
  }
  if (!markdown.includes('### Unresolved drift')) problems.push('no unresolved drift section');
  if (!markdown.includes('Required human corrections: not assessed'))
    problems.push('no statement that human corrections are not assessed');
  const all = results.flatMap((result) => result.invocations);
  if (
    !all.some(
      (invocation) =>
        invocation.status !== 'completed' ||
        invocation.stages.some((stage) => stage.status === 'failed' || stage.status === 'skipped')
    )
  )
    problems.push('the report shows no unsuccessful or skipped stage');
  return problems;
}

/**
 * The `delivery_review` template of a run, for a person to fill in and pass to
 * `ad-sdlc telemetry report --supplied` (docs/guides/delivery-metrics.md). Every
 * value a person decides stays null, which the report counts as not assessed.
 * @param meta - Report header
 * @param results - Scenario results
 * @returns Review data
 */
export function deliveryReviewTemplate(
  meta: Pick<EnhancementReportMeta, 'repository' | 'finishedAt'>,
  results: readonly EnhancementScenarioResult[]
): Record<string, unknown> {
  const requirements = new Set<string>();
  const pullRequests = results.flatMap((result) =>
    result.pullRequests.map((pr) => {
      for (const id of pr.judgement?.delta.newIds.requirements ?? []) requirements.add(id);
      const sessionId = result.invocations[0]?.sessionId;
      return {
        id: `${meta.repository}#${String(pr.number)}`,
        ...(sessionId === null || sessionId === undefined ? {} : { sessionId }),
        accepted: null,
        reworkMinutes: null,
      };
    })
  );
  return {
    schemaVersion: 1,
    kind: 'delivery_review',
    collectedAt: meta.finishedAt.slice(0, 10),
    pullRequests,
    requirements: [...requirements].sort().map((id) => ({ id, evidence: null })),
  };
}

/**
 * Whether a checkout's retained test saw the regression switch.
 * @param checkout - The run's checkout
 * @returns Whether the marker file exists
 */
export function regressionSwitchSeen(checkout: string): boolean {
  return existsSync(join(checkout, REGRESSION_MARKER));
}
