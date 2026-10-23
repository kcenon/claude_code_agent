#!/usr/bin/env tsx
/**
 * Workflow trigger matrix (#954): which check runs for each supported event and ref.
 *
 * Parses every workflow under `.github/workflows/` with js-yaml, evaluates the
 * `on:` filters and the job-level `if:` conditions for a fixed set of modeled
 * events, and renders the tables embedded in `docs/guides/testing.md` between
 * the BEGIN/END GENERATED markers. The offline test
 * `tests/ci/workflow-trigger-matrix.test.ts` asserts the documented tables and
 * the lane invariants, so a trigger or condition change cannot drift silently.
 *
 * The model fails closed: an event type, filter pattern, expression, or matrix
 * form that it does not understand throws instead of being guessed.
 *
 * Usage:
 *   npm run ci:trigger-matrix              # print the generated Markdown
 *   npm run ci:trigger-matrix -- --check   # exit 1 when the doc block differs
 *   npm run ci:trigger-matrix -- --write   # rewrite the doc block
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from 'js-yaml';

/** Repository default branch: schedule and workflow_dispatch runs use it. */
export const DEFAULT_BRANCH = 'develop';

/** Repository slug used for `github.repository` (same-repository pull requests). */
export const REPOSITORY = 'kcenon/claude_code_agent';

/** Documentation file that embeds the generated tables. */
export const MATRIX_DOCUMENT = 'docs/guides/testing.md';

/** Markers delimiting the generated block in {@link MATRIX_DOCUMENT}. */
export const BEGIN_MARKER =
  '<!-- BEGIN GENERATED: workflow-trigger-matrix (npm run ci:trigger-matrix -- --write) -->';
export const END_MARKER = '<!-- END GENERATED: workflow-trigger-matrix -->';

const MODELED_EVENT_TYPES = ['pull_request', 'push', 'schedule', 'workflow_dispatch'] as const;

/** GitHub event types the model can evaluate. */
export type ModeledEventType = (typeof MODELED_EVENT_TYPES)[number];

/** One concrete event and ref for which the matrix is evaluated. */
export interface ModeledEvent {
  /** Stable row label rendered in the documentation. */
  readonly label: string;
  readonly event: ModeledEventType;
  /** Value of `github.ref` for this event. */
  readonly ref: string;
  /** Pull request target branch (`github.base_ref`). */
  readonly baseRef?: string;
  /** For workflow_dispatch: the workflow file that is dispatched. */
  readonly workflow?: string;
}

/** Trigger filters for one event type of one workflow. */
export interface TriggerFilters {
  readonly branches?: readonly string[];
  readonly 'branches-ignore'?: readonly string[];
  readonly tags?: readonly string[];
  readonly 'tags-ignore'?: readonly string[];
  readonly paths?: readonly string[];
  readonly 'paths-ignore'?: readonly string[];
}

/** The subset of a workflow job that the model reads. */
export interface WorkflowJob {
  readonly name?: string;
  readonly if?: string | boolean;
  readonly needs?: string | readonly string[];
  readonly strategy?: { readonly matrix?: unknown };
  readonly 'continue-on-error'?: boolean;
  readonly 'timeout-minutes'?: number;
  readonly permissions?: unknown;
  readonly env?: unknown;
  readonly steps?: readonly { readonly run?: string; readonly env?: unknown }[];
}

/** A parsed workflow file. */
export interface WorkflowFile {
  /** File name under `.github/workflows/`, e.g. `ci.yml`. */
  readonly file: string;
  readonly name: string;
  /** Normalized `on:` map: event type to filters (empty object when none). */
  readonly on: Readonly<Partial<Record<ModeledEventType, TriggerFilters>>>;
  readonly jobs: Readonly<Record<string, WorkflowJob>>;
  readonly permissions?: unknown;
  /** Default values of `on.workflow_dispatch.inputs`, by input name. */
  readonly dispatchDefaults: Readonly<Record<string, string | number | boolean>>;
  /** Raw YAML text, for text-level invariants such as secret references. */
  readonly source: string;
}

/** A check run name produced by one job (matrix jobs produce several). */
export interface CheckIdentity {
  readonly workflow: string;
  readonly job: string;
  readonly name: string;
}

/** Evaluation of one triggered workflow for one modeled event. */
export interface MatrixRow {
  readonly event: ModeledEvent;
  /** Undefined when no workflow is triggered by the event. */
  readonly workflow?: WorkflowFile;
  /** True when the triggering filter has `paths` or `paths-ignore`. */
  readonly pathFiltered: boolean;
  /** Check names whose jobs run on the happy path. */
  readonly runs: readonly string[];
  /** Check names whose jobs are skipped by `if:` or by a skipped dependency. */
  readonly skipped: readonly string[];
}

/** A check intended to be a required status check (#970 rulesets). */
export interface RequiredCheck {
  readonly workflow: string;
  readonly name: string;
}

/**
 * Checks intended to be required on `develop` and `main` (#970). Each one
 * reports on every pull request into develop and main and on every push to
 * develop, without a path filter, and can fail.
 */
export const REQUIRED_CHECKS: readonly RequiredCheck[] = [
  { workflow: 'ci.yml', name: 'Lint' },
  { workflow: 'ci.yml', name: 'Test (ubuntu-latest)' },
  { workflow: 'ci.yml', name: 'Test (windows-2022)' },
  { workflow: 'ci.yml', name: 'Build' },
  { workflow: 'ci.yml', name: 'Package Asset Delivery (offline)' },
  { workflow: 'ci.yml', name: 'Integration Tests' },
  { workflow: 'ci.yml', name: 'Pipeline E2E (offline)' },
  { workflow: 'ci.yml', name: 'Security Scan' },
  { workflow: 'security.yml', name: 'Dependency Audit' },
  { workflow: 'security.yml', name: 'License Check' },
];

/**
 * Checks that report on every pull request but are deliberately not required,
 * with the reason. Every unfiltered pull request check must be either required
 * or listed here, so a new check forces an explicit decision.
 */
export const ADVISORY_CHECKS: readonly (RequiredCheck & { readonly reason: string })[] = [
  {
    workflow: 'security.yml',
    name: 'Secret Scanning',
    reason: 'Gitleaks runs with continue-on-error, so the job cannot fail.',
  },
  {
    workflow: 'security.yml',
    name: 'Security Best Practices Check',
    reason: 'Reports grep findings as warnings only; the job cannot fail.',
  },
  {
    workflow: 'security.yml',
    name: 'Security Summary',
    reason: 'Writes a summary table with if: always(); the job cannot fail.',
  },
];

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, where: string): readonly string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
    return value as string[];
  throw new Error(`${where}: expected a string or a list of strings`);
}

const FILTER_KEYS = ['branches', 'branches-ignore', 'tags', 'tags-ignore', 'paths', 'paths-ignore'];
// Dispatch inputs do not change which events start a run. Activity `types`
// would, so they are not modeled and throw.
const IGNORED_TRIGGER_KEYS = ['inputs'];

function normalizeTriggers(
  value: unknown,
  file: string
): Partial<Record<ModeledEventType, TriggerFilters>> {
  const entries: [string, unknown][] =
    typeof value === 'string'
      ? [[value, null]]
      : Array.isArray(value)
        ? value.map((event): [string, unknown] => [String(event), null])
        : isRecord(value)
          ? Object.entries(value)
          : [];
  if (entries.length === 0) throw new Error(`${file}: missing or empty "on:"`);
  const result: Partial<Record<ModeledEventType, TriggerFilters>> = {};
  for (const [event, config] of entries) {
    if (!(MODELED_EVENT_TYPES as readonly string[]).includes(event))
      throw new Error(`${file}: event "${event}" is not modeled by the trigger matrix`);
    const filters: Record<string, readonly string[]> = {};
    if (event === 'schedule') {
      if (!Array.isArray(config) || config.length === 0)
        throw new Error(`${file}: schedule must list at least one cron entry`);
    } else if (isRecord(config)) {
      for (const [key, entry] of Object.entries(config)) {
        if (FILTER_KEYS.includes(key))
          filters[key] = stringList(entry, `${file}: on.${event}.${key}`);
        else if (!IGNORED_TRIGGER_KEYS.includes(key))
          throw new Error(`${file}: on.${event}.${key} is not modeled by the trigger matrix`);
      }
    } else if (config !== null && config !== undefined) {
      throw new Error(`${file}: on.${event} must be a mapping`);
    }
    result[event as ModeledEventType] = filters;
  }
  return result;
}

/**
 * Parse one workflow file.
 * @param file - File name under `.github/workflows/`
 * @param source - YAML text
 * @returns Parsed workflow with normalized triggers
 */
export function parseWorkflow(file: string, source: string): WorkflowFile {
  const document: unknown = load(source);
  if (!isRecord(document)) throw new Error(`${file}: workflow must be a mapping`);
  const jobs = document['jobs'];
  if (!isRecord(jobs) || Object.keys(jobs).length === 0) throw new Error(`${file}: no jobs`);
  for (const [id, job] of Object.entries(jobs))
    if (!isRecord(job)) throw new Error(`${file}: job "${id}" must be a mapping`);
  const on = document['on'];
  const dispatch = isRecord(on) ? on['workflow_dispatch'] : undefined;
  const inputs = isRecord(dispatch) && isRecord(dispatch['inputs']) ? dispatch['inputs'] : {};
  const dispatchDefaults: Record<string, string | number | boolean> = {};
  for (const [input, definition] of Object.entries(inputs)) {
    const fallback = isRecord(definition) ? definition['default'] : undefined;
    if (
      typeof fallback === 'string' ||
      typeof fallback === 'number' ||
      typeof fallback === 'boolean'
    )
      dispatchDefaults[input] = fallback;
  }
  return {
    file,
    name: typeof document['name'] === 'string' ? document['name'] : file,
    on: normalizeTriggers(on, file),
    jobs: jobs as Record<string, WorkflowJob>,
    ...(document['permissions'] !== undefined ? { permissions: document['permissions'] } : {}),
    dispatchDefaults,
    source,
  };
}

/**
 * Load every workflow under `.github/workflows/`, sorted by file name.
 * @param root - Repository root
 * @returns Parsed workflows
 */
export function loadWorkflows(root: string): WorkflowFile[] {
  const directory = join(root, '.github', 'workflows');
  return readdirSync(directory)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => parseWorkflow(file, readFileSync(join(directory, file), 'utf8')));
}

// ---------------------------------------------------------------------------
// Modeled events and trigger filters
// ---------------------------------------------------------------------------

/**
 * Events evaluated for every matrix: pull requests and pushes for the
 * long-lived branches and one representative other branch, a release tag,
 * the schedule, and one workflow_dispatch row per workflow that declares it.
 * @param workflows - Parsed workflows
 * @returns Modeled events in display order
 */
export function modeledEvents(workflows: readonly WorkflowFile[]): ModeledEvent[] {
  const pullRequest = (base: string): ModeledEvent => ({
    label: `\`pull_request\` → \`${base}\``,
    event: 'pull_request',
    ref: 'refs/pull/1/merge',
    baseRef: base,
  });
  const push = (ref: string, label: string): ModeledEvent => ({
    label: `\`push\` → ${label}`,
    event: 'push',
    ref,
  });
  return [
    pullRequest('develop'),
    pullRequest('main'),
    pullRequest('feature/example'),
    push('refs/heads/develop', '`develop`'),
    push('refs/heads/main', '`main`'),
    push('refs/heads/release/example', '`release/example`'),
    push('refs/tags/v0.1.0', 'tag `v0.1.0`'),
    {
      label: `\`schedule\` (\`${DEFAULT_BRANCH}\`)`,
      event: 'schedule',
      ref: `refs/heads/${DEFAULT_BRANCH}`,
    },
    ...workflows
      .filter((workflow) => workflow.on.workflow_dispatch !== undefined)
      .map((workflow): ModeledEvent => ({
        label: `\`workflow_dispatch\` of \`${workflow.file}\` (\`${DEFAULT_BRANCH}\`)`,
        event: 'workflow_dispatch',
        ref: `refs/heads/${DEFAULT_BRANCH}`,
        workflow: workflow.file,
      })),
  ];
}

/**
 * Convert a GitHub filter pattern to a regular expression. Only `*` and `**`
 * are modeled; other special characters and negations throw.
 * @param pattern - Branch or tag filter pattern
 * @returns Anchored expression
 */
export function filterPattern(pattern: string): RegExp {
  if (/^!|[?+[\]]/.test(pattern))
    throw new Error(`Filter pattern "${pattern}" uses syntax the trigger matrix does not model`);
  let expression = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? '';
    if (char === '*' && pattern[index + 1] === '*') {
      expression += '.*';
      index += 1;
    } else if (char === '*') expression += '[^/]*';
    else expression += char.replace(/[.^${}()|\\]/g, '\\$&');
  }
  return new RegExp(`^${expression}$`);
}

function matchesFilters(
  value: string,
  include: readonly string[] | undefined,
  exclude: readonly string[] | undefined
): boolean {
  if (include !== undefined) return include.some((pattern) => filterPattern(pattern).test(value));
  if (exclude !== undefined) return !exclude.some((pattern) => filterPattern(pattern).test(value));
  return true;
}

/**
 * Decide whether an event triggers a workflow.
 * @param workflow - Parsed workflow
 * @param event - Modeled event
 * @returns Whether it triggers, and whether a changed-path filter applies
 */
export function triggers(
  workflow: WorkflowFile,
  event: ModeledEvent
): { readonly triggered: boolean; readonly pathFiltered: boolean } {
  const filters = workflow.on[event.event];
  if (filters === undefined) return { triggered: false, pathFiltered: false };
  const pathFiltered = filters.paths !== undefined || filters['paths-ignore'] !== undefined;
  const branchFilters = filters.branches !== undefined || filters['branches-ignore'] !== undefined;
  const tagFilters = filters.tags !== undefined || filters['tags-ignore'] !== undefined;
  switch (event.event) {
    case 'workflow_dispatch':
      return { triggered: event.workflow === workflow.file, pathFiltered: false };
    case 'schedule':
      return { triggered: true, pathFiltered: false };
    case 'pull_request': {
      const base = event.baseRef ?? '';
      return {
        triggered: matchesFilters(base, filters.branches, filters['branches-ignore']),
        pathFiltered,
      };
    }
    case 'push': {
      if (event.ref.startsWith('refs/tags/')) {
        // GitHub: branch-only filters exclude tag pushes; paths are not evaluated for tags.
        if (branchFilters && !tagFilters) return { triggered: false, pathFiltered: false };
        const tag = event.ref.slice('refs/tags/'.length);
        return {
          triggered: matchesFilters(tag, filters.tags, filters['tags-ignore']),
          pathFiltered: false,
        };
      }
      if (tagFilters && !branchFilters) return { triggered: false, pathFiltered };
      const branch = event.ref.slice('refs/heads/'.length);
      return {
        triggered: matchesFilters(branch, filters.branches, filters['branches-ignore']),
        pathFiltered,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Job-level `if:` expressions
// ---------------------------------------------------------------------------

type ExpressionValue = string | number | boolean | null;

/** Inputs to {@link evaluateCondition}. */
export interface ExpressionScope {
  readonly event: ModeledEvent;
  readonly workflow: WorkflowFile;
  /** Whether every job in `needs` ran successfully. */
  readonly needsSucceeded: boolean;
}

function contextValue(path: string, scope: ExpressionScope): ExpressionValue {
  const { event, workflow } = scope;
  const isPullRequest = event.event === 'pull_request';
  // Contexts whose value would be invented for a modeled event (such as
  // github.head_ref) are deliberately absent and throw below.
  switch (path) {
    case 'github.event_name':
      return event.event;
    case 'github.ref':
      return event.ref;
    case 'github.ref_type':
      return event.ref.startsWith('refs/tags/') ? 'tag' : 'branch';
    case 'github.base_ref':
      return isPullRequest ? (event.baseRef ?? '') : '';
    case 'github.repository':
      return REPOSITORY;
    case 'github.event.pull_request.head.repo.full_name':
      return isPullRequest ? REPOSITORY : null;
  }
  if (path.startsWith('inputs.')) {
    // Dispatch rows use the declared defaults; other events have no inputs.
    if (event.event !== 'workflow_dispatch') return null;
    return workflow.dispatchDefaults[path.slice('inputs.'.length)] ?? null;
  }
  throw new Error(
    `${workflow.file}: context "${path}" in a job-level if: is not modeled by the trigger matrix`
  );
}

type Token =
  | { readonly kind: 'op'; readonly value: string }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'ident'; readonly value: string };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /\s*(?:(&&|\|\||==|!=|<=|>=|[!()<>,])|'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)|([A-Za-z_][\w-]*(?:\.[\w*-]+)*))/y;
  let index = 0;
  while (index < expression.length) {
    if (/^\s*$/.test(expression.slice(index))) break;
    pattern.lastIndex = index;
    const match = pattern.exec(expression);
    if (match === null)
      throw new Error(`Cannot parse expression near "${expression.slice(index)}"`);
    index = pattern.lastIndex;
    if (match[1] !== undefined) tokens.push({ kind: 'op', value: match[1] });
    else if (match[2] !== undefined)
      tokens.push({ kind: 'string', value: match[2].replace(/''/g, "'") });
    else if (match[3] !== undefined) tokens.push({ kind: 'number', value: Number(match[3]) });
    else if (match[4] !== undefined) tokens.push({ kind: 'ident', value: match[4] });
  }
  return tokens;
}

function truthy(value: ExpressionValue): boolean {
  return value !== null && value !== false && value !== 0 && value !== '';
}

function looseEquals(left: ExpressionValue, right: ExpressionValue): boolean {
  if (typeof left === 'string' && typeof right === 'string')
    return left.toLowerCase() === right.toLowerCase();
  if (typeof left === typeof right) return left === right;
  // GitHub coerces mixed types to numbers (null is 0, booleans are 0 or 1).
  const number = (value: ExpressionValue): number => (value === null ? 0 : Number(value));
  return number(left) === number(right);
}

const STATUS_FUNCTION = /\b(always|success|failure|cancelled)\s*\(/;

/**
 * Evaluate a job-level `if:` expression for one modeled event on the happy
 * path (every executed job succeeds). Only the operators, functions, and
 * contexts used by job conditions are modeled; anything else throws.
 * @param condition - Expression, with or without the `${{ }}` wrapper
 * @param scope - Event, workflow, and dependency state
 * @returns Whether the job runs
 */
export function evaluateCondition(condition: string | boolean, scope: ExpressionScope): boolean {
  if (typeof condition === 'boolean') return condition && scope.needsSucceeded;
  const expression = condition.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1');
  const tokens = tokenize(expression);
  let position = 0;
  const peek = (): Token | undefined => tokens[position];
  const take = (): Token => {
    const token = tokens[position];
    if (token === undefined) throw new Error(`Unexpected end of expression: ${expression}`);
    position += 1;
    return token;
  };
  const expectOp = (value: string): void => {
    const token = take();
    if (token.kind !== 'op' || token.value !== value)
      throw new Error(`Expected "${value}" in expression: ${expression}`);
  };

  const primary = (): ExpressionValue => {
    const token = take();
    if (token.kind === 'op' && token.value === '(') {
      const value = or();
      expectOp(')');
      return value;
    }
    if (token.kind === 'string' || token.kind === 'number') return token.value;
    if (token.kind !== 'ident') throw new Error(`Unexpected "${token.value}" in: ${expression}`);
    if (token.value === 'true') return true;
    if (token.value === 'false') return false;
    if (token.value === 'null') return null;
    const next = peek();
    if (next?.kind === 'op' && next.value === '(') {
      take();
      const args: ExpressionValue[] = [];
      while (!(peek()?.kind === 'op' && peek()?.value === ')')) {
        args.push(or());
        if (peek()?.kind === 'op' && peek()?.value === ',') take();
      }
      expectOp(')');
      return call(token.value, args);
    }
    return contextValue(token.value, scope);
  };
  const call = (name: string, args: readonly ExpressionValue[]): ExpressionValue => {
    const text = (index: number): string => String(args[index] ?? '').toLowerCase();
    switch (name) {
      case 'always':
        return true;
      case 'success':
        return scope.needsSucceeded;
      // Happy path: no dependency fails and the run is not cancelled.
      case 'failure':
      case 'cancelled':
        return false;
      case 'startsWith':
        return text(0).startsWith(text(1));
      case 'endsWith':
        return text(0).endsWith(text(1));
      case 'contains':
        return text(0).includes(text(1));
    }
    throw new Error(`Function "${name}" is not modeled by the trigger matrix`);
  };
  const comparison = (): ExpressionValue => {
    const left = primary();
    const next = peek();
    if (next?.kind === 'op' && (next.value === '==' || next.value === '!=')) {
      take();
      const equal = looseEquals(left, primary());
      return next.value === '==' ? equal : !equal;
    }
    if (next?.kind === 'op' && ['<', '>', '<=', '>='].includes(next.value))
      throw new Error(`Ordering comparisons are not modeled: ${expression}`);
    return left;
  };
  const not = (): ExpressionValue => {
    const next = peek();
    if (next?.kind === 'op' && next.value === '!') {
      take();
      return !truthy(not());
    }
    return comparison();
  };
  const and = (): ExpressionValue => {
    let value = not();
    while (peek()?.kind === 'op' && peek()?.value === '&&') {
      take();
      const right = not();
      value = truthy(value) ? right : value;
    }
    return value;
  };
  const or = (): ExpressionValue => {
    let value = and();
    while (peek()?.kind === 'op' && peek()?.value === '||') {
      take();
      const right = and();
      value = truthy(value) ? value : right;
    }
    return value;
  };

  const result = truthy(or());
  if (position !== tokens.length) throw new Error(`Trailing tokens in expression: ${expression}`);
  // GitHub adds an implicit success() when no status function is used.
  return STATUS_FUNCTION.test(expression) ? result : result && scope.needsSucceeded;
}

// ---------------------------------------------------------------------------
// Check names and job evaluation
// ---------------------------------------------------------------------------

function needsOf(job: WorkflowJob): readonly string[] {
  if (job.needs === undefined) return [];
  return typeof job.needs === 'string' ? [job.needs] : job.needs;
}

/**
 * Check run names produced by one job, expanding simple matrices the way
 * GitHub names matrix jobs.
 * @param workflow - Owning workflow
 * @param jobId - Job key
 * @returns Check names
 */
export function checkNames(workflow: WorkflowFile, jobId: string): string[] {
  const job = workflow.jobs[jobId];
  if (job === undefined) throw new Error(`${workflow.file}: unknown job "${jobId}"`);
  const base = job.name ?? jobId;
  const matrix = job.strategy?.matrix;
  let names: string[];
  if (matrix === undefined) names = [base];
  else {
    if (!isRecord(matrix) || 'include' in matrix || 'exclude' in matrix)
      throw new Error(`${workflow.file}: job "${jobId}" uses a matrix form that is not modeled`);
    const keys = Object.keys(matrix);
    let combinations: Record<string, string>[] = [{}];
    for (const key of keys) {
      const values = matrix[key];
      if (!Array.isArray(values) || values.some((value) => typeof value === 'object'))
        throw new Error(`${workflow.file}: matrix.${key} of job "${jobId}" is not a scalar list`);
      combinations = combinations.flatMap((combination) =>
        values.map((value) => ({ ...combination, [key]: String(value) }))
      );
    }
    names = combinations.map((combination) =>
      base.includes('${{')
        ? base.replace(/\$\{\{\s*matrix\.([\w-]+)\s*\}\}/g, (_, key: string) => {
            const value = combination[key];
            if (value === undefined) throw new Error(`${workflow.file}: unknown matrix.${key}`);
            return value;
          })
        : `${base} (${keys.map((key) => combination[key] ?? '').join(', ')})`
    );
  }
  for (const name of names)
    if (name.includes('${{'))
      throw new Error(`${workflow.file}: job "${jobId}" name "${name}" is not modeled`);
  return names;
}

/**
 * Evaluate which jobs of a triggered workflow run for an event.
 * @param workflow - Parsed workflow
 * @param event - Modeled event that triggers it
 * @returns Map of job id to whether it runs
 */
export function evaluateJobs(workflow: WorkflowFile, event: ModeledEvent): Map<string, boolean> {
  const result = new Map<string, boolean>();
  const visiting = new Set<string>();
  const visit = (jobId: string): boolean => {
    const known = result.get(jobId);
    if (known !== undefined) return known;
    if (visiting.has(jobId)) throw new Error(`${workflow.file}: dependency cycle at "${jobId}"`);
    const job = workflow.jobs[jobId];
    if (job === undefined) throw new Error(`${workflow.file}: unknown job "${jobId}" in needs`);
    visiting.add(jobId);
    const needsSucceeded = needsOf(job).every((dependency) => visit(dependency));
    const runs =
      job.if === undefined
        ? needsSucceeded
        : evaluateCondition(job.if, { event, workflow, needsSucceeded });
    visiting.delete(jobId);
    result.set(jobId, runs);
    return runs;
  };
  for (const jobId of Object.keys(workflow.jobs)) visit(jobId);
  return result;
}

/**
 * Evaluate every modeled event against every workflow.
 * @param workflows - Parsed workflows
 * @returns One row per (event, triggered workflow), or one empty row per event
 */
export function computeTriggerMatrix(workflows: readonly WorkflowFile[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const event of modeledEvents(workflows)) {
    let triggeredAny = false;
    for (const workflow of workflows) {
      const { triggered, pathFiltered } = triggers(workflow, event);
      if (!triggered) continue;
      triggeredAny = true;
      const jobs = evaluateJobs(workflow, event);
      const runs: string[] = [];
      const skipped: string[] = [];
      for (const [jobId, ran] of jobs) (ran ? runs : skipped).push(...checkNames(workflow, jobId));
      rows.push({ event, workflow, pathFiltered, runs, skipped });
    }
    if (!triggeredAny) rows.push({ event, pathFiltered: false, runs: [], skipped: [] });
  }
  return rows;
}

/**
 * Jobs whose `if:` (or dependency chain) never lets them run under any of the
 * workflow's own triggers, such as a release-branch condition in a workflow
 * that only triggers on main and develop.
 * @param workflows - Parsed workflows
 * @returns `file:job` identifiers of unreachable jobs
 */
export function findUnreachableJobs(workflows: readonly WorkflowFile[]): string[] {
  const rows = computeTriggerMatrix(workflows);
  const unreachable: string[] = [];
  for (const workflow of workflows)
    for (const jobId of Object.keys(workflow.jobs)) {
      const names = checkNames(workflow, jobId);
      const reachable = rows.some(
        (row) => row.workflow === workflow && names.every((name) => row.runs.includes(name))
      );
      if (!reachable) unreachable.push(`${workflow.file}:${jobId}`);
    }
  return unreachable;
}

/**
 * Every check name of every workflow.
 * @param workflows - Parsed workflows
 * @returns Check identities in workflow and job order
 */
export function allChecks(workflows: readonly WorkflowFile[]): CheckIdentity[] {
  return workflows.flatMap((workflow) =>
    Object.keys(workflow.jobs).flatMap((job) =>
      checkNames(workflow, job).map((name) => ({ workflow: workflow.file, job, name }))
    )
  );
}

/** How a check behaves for one event label. */
export type CheckReport = 'every run' | 'path-filtered' | 'skipped by if:' | 'not triggered';

/**
 * Classify how a check reports for one modeled event.
 * @param rows - Matrix rows
 * @param check - Check identity
 * @param label - Event label from {@link modeledEvents}
 * @returns Report classification
 */
export function checkReport(
  rows: readonly MatrixRow[],
  check: CheckIdentity,
  label: string
): CheckReport {
  const row = rows.find(
    (entry) => entry.event.label === label && entry.workflow?.file === check.workflow
  );
  if (row === undefined) return 'not triggered';
  if (!row.runs.includes(check.name)) return 'skipped by if:';
  return row.pathFiltered ? 'path-filtered' : 'every run';
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const PR_DEVELOP = '`pull_request` → `develop`';
const PR_MAIN = '`pull_request` → `main`';
const PUSH_DEVELOP = '`push` → `develop`';

/** Labels used for the required-check columns. */
export const EVENT_LABELS = { PR_DEVELOP, PR_MAIN, PUSH_DEVELOP } as const;

const code = (value: string): string => `\`${value}\``;
const list = (values: readonly string[], empty = '—'): string =>
  values.length === 0 ? empty : values.map(code).join(', ');

function filterSummary(filters: TriggerFilters): string {
  const parts: string[] = [];
  if (filters.branches !== undefined) parts.push(`branches: ${list(filters.branches)}`);
  if (filters['branches-ignore'] !== undefined)
    parts.push(`branches-ignore: ${list(filters['branches-ignore'])}`);
  if (filters.tags !== undefined) parts.push(`tags: ${list(filters.tags)}`);
  if (filters['tags-ignore'] !== undefined)
    parts.push(`tags-ignore: ${list(filters['tags-ignore'])}`);
  return parts.length === 0 ? 'any' : parts.join('; ');
}

function checkNote(rows: readonly MatrixRow[], check: CheckIdentity): string {
  const required = REQUIRED_CHECKS.some(
    (entry) => entry.workflow === check.workflow && entry.name === check.name
  );
  if (required) return '—';
  const advisory = ADVISORY_CHECKS.find(
    (entry) => entry.workflow === check.workflow && entry.name === check.name
  );
  if (advisory !== undefined) return advisory.reason;
  const develop = checkReport(rows, check, PR_DEVELOP);
  const main = checkReport(rows, check, PR_MAIN);
  if (develop === 'path-filtered' || main === 'path-filtered')
    return `Path-filtered${develop === 'not triggered' ? ', pull requests into main only' : ''}: does not report on every PR, so it must not be required.`;
  if (develop === 'skipped by if:') return 'Skipped on pull requests by its job-level if:.';
  if (main === 'every run')
    return 'Pull requests into main only; not part of the shared develop and main set.';
  return 'Does not run on pull requests.';
}

/**
 * Render the generated Markdown block (without the markers).
 * @param workflows - Parsed workflows
 * @returns Markdown tables
 */
export function renderMatrixMarkdown(workflows: readonly WorkflowFile[]): string {
  const rows = computeTriggerMatrix(workflows);
  const lines: string[] = [
    '#### Trigger matrix',
    '',
    '| Event / ref | Workflow | Changed-path filter | Checks that run | Checks skipped by `if:` |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const row of rows)
    lines.push(
      row.workflow === undefined
        ? `| ${row.event.label} | — | — | nothing runs | — |`
        : `| ${row.event.label} | ${row.workflow.name} (${code(row.workflow.file)}) | ${row.pathFiltered ? 'yes' : 'no'} | ${list(row.runs)} | ${list(row.skipped)} |`
    );
  lines.push(
    '',
    '#### Workflow trigger filters',
    '',
    '| Workflow | Event | Branch / tag filter | `paths` | `paths-ignore` |',
    '| --- | --- | --- | --- | --- |'
  );
  for (const workflow of workflows)
    for (const event of MODELED_EVENT_TYPES) {
      const filters = workflow.on[event];
      if (filters === undefined) continue;
      lines.push(
        `| ${code(workflow.file)} | ${code(event)} | ${event === 'schedule' || event === 'workflow_dispatch' ? `default branch (${code(DEFAULT_BRANCH)})` : filterSummary(filters)} | ${list(filters.paths ?? [])} | ${list(filters['paths-ignore'] ?? [])} |`
      );
    }
  lines.push(
    '',
    '#### Check names and required status',
    '',
    '| Check | Workflow | PR → `develop` | PR → `main` | Push → `develop` | Required (#970) | Note |',
    '| --- | --- | --- | --- | --- | --- | --- |'
  );
  for (const check of allChecks(workflows)) {
    const required = REQUIRED_CHECKS.some(
      (entry) => entry.workflow === check.workflow && entry.name === check.name
    );
    lines.push(
      `| ${code(check.name)} | ${code(check.workflow)} | ${checkReport(rows, check, PR_DEVELOP)} | ${checkReport(rows, check, PR_MAIN)} | ${checkReport(rows, check, PUSH_DEVELOP)} | ${required ? 'yes' : 'no'} | ${checkNote(rows, check)} |`
    );
  }
  lines.push(
    '',
    'Required check names for the #970 rulesets on `develop` and `main`:',
    '',
    ...REQUIRED_CHECKS.map((entry) => `- ${code(entry.name)} (${code(entry.workflow)})`)
  );
  return lines.join('\n');
}

/**
 * Normalize Markdown for comparison: trims table cells and lines and drops
 * blank lines and table separator rows, so Prettier's column alignment does
 * not count as drift.
 * @param markdown - Markdown text
 * @returns Normalized lines
 */
export function normalizeMarkdown(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) =>
      line.startsWith('|')
        ? line
            .slice(1, line.endsWith('|') ? -1 : undefined)
            .split('|')
            .map((cell) => cell.trim())
            .join(' | ')
        : line
    )
    .filter((line) => !/^:?-+:?( \| :?-+:?)*$/.test(line));
}

/**
 * Extract the generated block from a document.
 * @param document - Document text
 * @returns Text between the markers
 */
export function extractGeneratedBlock(document: string): string {
  const begin = document.indexOf(BEGIN_MARKER);
  const end = document.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin)
    throw new Error(`${MATRIX_DOCUMENT}: generated trigger-matrix markers not found`);
  return document.slice(begin + BEGIN_MARKER.length, end);
}

function main(argv: readonly string[]): number {
  const root = process.cwd();
  const workflows = loadWorkflows(root);
  const generated = renderMatrixMarkdown(workflows);
  const documentPath = join(root, MATRIX_DOCUMENT);
  if (argv.includes('--write')) {
    const document = readFileSync(documentPath, 'utf8');
    const begin = document.indexOf(BEGIN_MARKER);
    const end = document.indexOf(END_MARKER);
    if (begin === -1 || end === -1) throw new Error(`${MATRIX_DOCUMENT}: markers not found`);
    writeFileSync(
      documentPath,
      `${document.slice(0, begin + BEGIN_MARKER.length)}\n\n${generated}\n\n${document.slice(end)}`
    );
    process.stdout.write(`Updated ${MATRIX_DOCUMENT}; run prettier on it before committing.\n`);
    return 0;
  }
  if (argv.includes('--check')) {
    const documented = normalizeMarkdown(extractGeneratedBlock(readFileSync(documentPath, 'utf8')));
    const expected = normalizeMarkdown(generated);
    if (JSON.stringify(documented) === JSON.stringify(expected)) {
      process.stdout.write(`${MATRIX_DOCUMENT}: trigger matrix is up to date.\n`);
      return 0;
    }
    process.stderr.write(
      `${MATRIX_DOCUMENT}: trigger matrix is stale; run npm run ci:trigger-matrix -- --write.\n`
    );
    return 1;
  }
  process.stdout.write(`${generated}\n`);
  return 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
