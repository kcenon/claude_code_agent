/**
 * Delivery-path verification rules.
 *
 * Check sets for the stages that turn requirements into a reviewable change:
 * issue import, work orders, implementation results, regression testing,
 * final validation, and review. Each rule inspects the real files the stage's
 * agent definition writes (located through the manifest-derived artifact
 * list), never the stage's success flag or free-text output.
 *
 * @module stage-verifier/deliveryRules
 */

import { access } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { OverallResultSchema } from '../validation-agent/schemas.js';
import type { VerificationCheck, VerificationRule, VerificationRuleContext } from './types.js';
import {
  failCheck,
  findArtifact,
  findArtifacts,
  isRecord,
  parseStructured,
  passCheck,
  readPath,
  safeReadFile,
  skipCheck,
  unwrapRoot,
  type RuleIdentity,
} from './ruleSupport.js';

// =============================================================================
// Artifact locations (from the checked-in agent definitions)
// =============================================================================

/** `issues/<project>/issue_list.json` (issue-reader, local-issue-reader, issue-generator). */
const ISSUE_LIST = [/(?:^|\/)issue_list\.json$/u];
/** `issues/<project>/dependency_graph.json` (issue-reader, local-issue-reader). */
const DEPENDENCY_GRAPH = [/(?:^|\/)dependency_graph\.json$/u];
/** `progress/<project>/work_orders/WO-XXX.yaml` (controller). */
const WORK_ORDERS = [/(?:^|\/)work_orders\/[^/]+\.(?:ya?ml|json)$/u];
/** `progress/<project>/results/WO-XXX-result.yaml` (worker), plus legacy names. */
const IMPLEMENTATION_RESULTS = [
  /(?:^|\/)results\/[^/]+-result\.(?:ya?ml|json)$/u,
  /implementation[_-]result/u,
  /ImplementationResult/u,
];
/** `regression/<project>/regression_report.yaml` (regression-tester). */
const REGRESSION_REPORT = [/(?:^|\/)regression_report\.(?:ya?ml|json)$/u];
/** `vnv/<project>/validation-report.yaml` (validation-agent). */
const VALIDATION_REPORT = [/(?:^|\/)validation[-_]report\.(?:ya?ml|json)$/u];
/** `reviews/PR-XXX-review.yaml` (pr-reviewer), `reviews/review_report.json` (local-reviewer), legacy names. */
const REVIEW_RESULTS = [
  /(?:^|\/)reviews\/[^/]+\.(?:ya?ml|json)$/u,
  /review[_-]result/u,
  /PRReviewResult/u,
  /pr_review/u,
];

// =============================================================================
// Document loading
// =============================================================================

/** One located artifact and its parsed content. */
interface LoadedDocument {
  readonly path: string;
  /** Parsed object, or null when unreadable or not structured data */
  readonly data: Record<string, unknown> | unknown[] | null;
  readonly readable: boolean;
}

/**
 * Read and parse each artifact.
 * @param paths - Located artifact paths
 * @param projectDir - Project root
 * @returns Parsed documents in input order
 */
async function loadDocuments(
  paths: readonly string[],
  projectDir: string
): Promise<LoadedDocument[]> {
  const documents: LoadedDocument[] = [];
  for (const path of paths) {
    const content = await safeReadFile(path, projectDir);
    documents.push({
      path,
      readable: content !== null,
      data: content === null ? null : parseStructured(content),
    });
  }
  return documents;
}

/**
 * Report the first unreadable or unparseable document, if any.
 * @param rule - Rule identity
 * @param documents - Loaded documents
 * @param label - Artifact label used in messages
 * @returns Failing check, or undefined when every document parsed to an object
 */
function invalidDocument(
  rule: RuleIdentity,
  documents: readonly LoadedDocument[],
  label: string
): VerificationCheck | undefined {
  const unreadable = documents.find((document) => !document.readable);
  if (unreadable !== undefined)
    return failCheck(rule, `Cannot read ${label} file: ${unreadable.path}`);
  const invalid = documents.find((document) => !isRecord(document.data));
  if (invalid !== undefined)
    return failCheck(rule, `${label} is not a structured YAML or JSON object: ${invalid.path}`, {
      path: invalid.path,
    });
  return undefined;
}

/**
 * Check whether a project-relative location exists inside the project.
 * @param projectDir - Project root
 * @param location - Recorded file location
 * @returns 'present', 'absent', or 'outside' for traversal or foreign absolute paths
 */
async function projectFileState(
  projectDir: string,
  location: string
): Promise<'present' | 'absent' | 'outside'> {
  const target = resolve(projectDir, location);
  const fromRoot = relative(projectDir, target);
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) return 'outside';
  try {
    await access(target);
    return 'present';
  } catch {
    return 'absent';
  }
}

// =============================================================================
// Issue lists (issue_generation and issue_reading)
// =============================================================================

/**
 * Extract issue entries from an array or an `issues`/`items` list.
 * @param data - Parsed issue list
 * @returns Issue objects, or null when the document has no issue list
 */
function issueEntries(data: unknown): Record<string, unknown>[] | null {
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
      ? (data['issues'] ?? data['items'])
      : undefined;
  if (!Array.isArray(list)) return null;
  return list.filter(isRecord);
}

/**
 * The issue's identifier, preferring the AD-SDLC id over GitHub numbers.
 * @param issue - Issue entry
 * @returns Identifier, or undefined when the issue has none
 */
function issueId(issue: Record<string, unknown>): string | undefined {
  const id = issue['id'] ?? issue['github_number'] ?? issue['number'];
  if (typeof id === 'number') return String(id);
  return typeof id === 'string' && id.trim() !== '' ? id : undefined;
}

/**
 * A readable label for an issue in failure messages.
 * @param issue - Issue entry
 * @param index - Position in the list
 * @returns Identifier or list position
 */
function issueLabel(issue: Record<string, unknown>, index: number): string {
  return issueId(issue) ?? `entry ${String(index + 1)}`;
}

/**
 * Whether a markdown line starts a list item with content.
 * @param line - Trimmed line
 * @returns True for `- item`, `* item`, `+ item`, `1. item`, and checklist items
 */
function isListItem(line: string): boolean {
  return /^(?:[-*+]|\d+\.)\s+\S/u.test(line);
}

/**
 * Whether an issue states acceptance criteria, either as a structured list or
 * as a list under an "Acceptance Criteria" heading in its body (the format
 * IssueTransformer, LocalIssueWriter, and GitHub issue templates produce).
 * @param issue - Issue entry
 * @returns True when at least one criterion is stated
 */
export function hasAcceptanceCriteria(issue: Record<string, unknown>): boolean {
  for (const key of ['acceptance_criteria', 'acceptanceCriteria']) {
    const criteria = issue[key];
    if (Array.isArray(criteria) && criteria.length > 0) return true;
  }
  const body = issue['body'] ?? issue['description'];
  if (typeof body !== 'string') return false;
  let inSection = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    const lower = line.toLowerCase();
    const isHeading = line.startsWith('#') || (line.startsWith('**') && line.endsWith('**'));
    if (isHeading) {
      inSection = lower.includes('acceptance criteria');
      continue;
    }
    if (inSection && isListItem(line)) return true;
  }
  return false;
}

/**
 * Locate the issue list in a stage's output.
 * @param artifacts - Stage artifacts
 * @returns Issue list location
 */
function findIssueList(artifacts: readonly string[]): string | undefined {
  return (
    findArtifacts(artifacts, ISSUE_LIST)[0] ??
    findArtifact(artifacts, 'issue') ??
    findArtifact(artifacts, 'Issue')
  );
}

/**
 * Shared rule: every issue states acceptance criteria. Imported issue
 * acceptance criteria are the traceability roots in Import mode.
 * @param checkId - Check identifier within the owning check set
 * @returns Verification rule
 */
export function issueAcceptanceCriteriaRule(checkId: string): VerificationRule {
  return {
    checkId,
    name: 'Every issue states acceptance criteria',
    category: 'content',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findIssueList(artifacts);
      if (artifact === undefined)
        return failCheck(this, 'No issue list artifact to check acceptance criteria');
      const [document] = await loadDocuments([artifact], projectDir);
      if (document === undefined || !document.readable)
        return failCheck(this, `Cannot read issue list file: ${artifact}`);
      const issues = issueEntries(document.data);
      if (issues === null || issues.length === 0)
        return failCheck(this, 'Issue list contains no issues to check acceptance criteria', {
          issueCount: 0,
        });
      const missing = issues
        .map((issue, index) => ({ issue, label: issueLabel(issue, index) }))
        .filter(({ issue }) => !hasAcceptanceCriteria(issue))
        .map(({ label }) => label);
      if (missing.length > 0)
        return failCheck(
          this,
          `${String(missing.length)} of ${String(issues.length)} issue(s) state no acceptance criteria: ${missing.join(', ')}`,
          { missingAcceptanceCriteria: missing, issueCount: issues.length }
        );
      return passCheck(this, `All ${String(issues.length)} issue(s) state acceptance criteria`, {
        issueCount: issues.length,
      });
    },
  };
}

/** Import mode: `issue_reading` (issue-reader / local-issue-reader). */
export const issueReadingRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-IRD-001',
    name: 'Imported issue list artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findArtifacts(artifacts, ISSUE_LIST)[0];
      return Promise.resolve(
        artifact === undefined
          ? failCheck(this, 'No issue_list.json artifact found in stage output')
          : passCheck(this, `Imported issue list found: ${artifact}`)
      );
    },
  },
  {
    checkId: 'VR-IRD-002',
    name: 'Imported issues have unique identifiers and titles',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifacts(artifacts, ISSUE_LIST)[0];
      if (artifact === undefined) return failCheck(this, 'No issue_list.json artifact to validate');
      const documents = await loadDocuments([artifact], projectDir);
      const invalid = invalidDocument(this, documents, 'issue list');
      const issues = issueEntries(documents[0]?.data);
      if (invalid !== undefined && issues === null) return invalid;
      if (issues === null || issues.length === 0)
        return failCheck(this, 'Imported issue list contains no issues', { issueCount: 0 });
      const labelled = issues.map((issue, index) => ({ issue, label: issueLabel(issue, index) }));
      const untitled = labelled
        .filter(({ issue }) => typeof issue['title'] !== 'string' || issue['title'].trim() === '')
        .map(({ label }) => label);
      const unidentified = labelled
        .filter(({ issue }) => issueId(issue) === undefined)
        .map(({ label }) => label);
      const ids = issues.flatMap((issue) => {
        const id = issueId(issue);
        return id === undefined ? [] : [id];
      });
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (untitled.length > 0 || unidentified.length > 0 || duplicates.length > 0)
        return failCheck(
          this,
          'Imported issues lack identifiers or titles, or repeat identifiers',
          {
            untitled,
            unidentified,
            duplicates: [...new Set(duplicates)],
          }
        );
      return passCheck(this, `Imported ${String(issues.length)} identified issue(s)`, {
        issueCount: issues.length,
      });
    },
  },
  issueAcceptanceCriteriaRule('VR-IRD-003'),
  {
    checkId: 'VR-IRD-004',
    name: 'Dependency graph is acyclic and references imported issues',
    category: 'consistency',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findArtifacts(artifacts, DEPENDENCY_GRAPH)[0];
      if (artifact === undefined)
        return skipCheck(
          this,
          'No dependency_graph.json artifact; dependency check skipped',
          'dependency graph not produced'
        );
      const documents = await loadDocuments([artifact], projectDir);
      const invalid = invalidDocument(this, documents, 'dependency graph');
      if (invalid !== undefined) return invalid;
      const graph = documents[0]?.data as Record<string, unknown>;
      if (graph['has_cycles'] === true || graph['hasCycles'] === true)
        return failCheck(this, 'Dependency graph reports a cycle');
      const nodes = Array.isArray(graph['nodes']) ? graph['nodes'].filter(isRecord) : [];
      const ids = new Set(nodes.map((node) => String(node['id'])));
      const edges = Array.isArray(graph['edges']) ? graph['edges'].filter(isRecord) : [];
      const dangling = edges
        .flatMap((edge) => [edge['from'], edge['to']])
        .map(String)
        .filter((id) => !ids.has(id));
      if (dangling.length > 0)
        return failCheck(
          this,
          `Dependency edges reference unknown issues: ${dangling.join(', ')}`,
          {
            dangling: [...new Set(dangling)],
          }
        );
      return passCheck(
        this,
        `Dependency graph has ${String(nodes.length)} node(s) and no reported cycle`
      );
    },
  },
];

// =============================================================================
// Work orders (orchestration)
// =============================================================================

/** `orchestration` (controller): work orders that assign issues to workers. */
export const orchestrationRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-ORC-001',
    name: 'Work order artifacts exist',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const orders = findArtifacts(artifacts, WORK_ORDERS);
      return Promise.resolve(
        orders.length === 0
          ? failCheck(this, 'No work order artifact (work_orders/*.yaml) found in stage output')
          : passCheck(this, `Found ${String(orders.length)} work order(s)`, { workOrders: orders })
      );
    },
  },
  {
    checkId: 'VR-ORC-002',
    name: 'Every work order references an issue',
    category: 'traceability',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const orders = findArtifacts(artifacts, WORK_ORDERS);
      if (orders.length === 0) return failCheck(this, 'No work order artifact to check');
      const documents = await loadDocuments(orders, projectDir);
      const invalid = invalidDocument(this, documents, 'work order');
      if (invalid !== undefined) return invalid;
      const unlinked = documents
        .filter((document) => {
          const order = unwrapRoot(document.data, 'work_order');
          const issue =
            order === null
              ? undefined
              : readPath(order, ['issue.id', 'issue_id', 'issueId', 'issue.github_number']);
          return !((typeof issue === 'string' && issue.trim() !== '') || typeof issue === 'number');
        })
        .map((document) => document.path);
      if (unlinked.length > 0)
        return failCheck(
          this,
          `${String(unlinked.length)} work order(s) reference no issue: ${unlinked.join(', ')}`,
          { unlinked }
        );
      return passCheck(this, `All ${String(orders.length)} work order(s) reference an issue`);
    },
  },
];

// =============================================================================
// Implementation results (implementation)
// =============================================================================

/** Description of a boolean verification flag in an implementation result. */
interface ResultFlag {
  readonly checkId: string;
  readonly name: string;
  readonly severity: VerificationRule['severity'];
  readonly minRigor: VerificationRule['minRigor'];
  /** Word used in messages: tests, build, lint */
  readonly noun: string;
  /** Legacy camelCase field name, also used in messages */
  readonly field: string;
  readonly paths: readonly string[];
}

/**
 * Rule reading one boolean verification flag from every implementation result.
 * A result that does not report the flag yields a skipped check.
 * @param flag - Flag description
 * @returns Verification rule
 */
function resultFlagRule(flag: ResultFlag): VerificationRule {
  return {
    checkId: flag.checkId,
    name: flag.name,
    category: 'quality',
    minRigor: flag.minRigor,
    severity: flag.severity,
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const results = findArtifacts(artifacts, IMPLEMENTATION_RESULTS);
      if (results.length === 0)
        return failCheck(this, `No implementation result to check ${flag.noun} status`);
      const documents = await loadDocuments(results, projectDir);
      const unreadable = documents.find((document) => !document.readable);
      if (unreadable !== undefined)
        return failCheck(this, `Cannot read implementation result file: ${unreadable.path}`);
      const values: { path: string; value: unknown }[] = [];
      for (const document of documents) {
        const record = unwrapRoot(document.data, 'implementation_result');
        if (record === null)
          return failCheck(this, `Cannot parse implementation result to check ${flag.noun}`);
        values.push({ path: document.path, value: readPath(record, flag.paths) });
      }
      const failing = values.filter(({ value }) => value !== undefined && value !== true);
      if (failing.length > 0)
        return failCheck(this, `Implementation ${flag.noun} did not pass`, {
          [flag.field]: failing[0]?.value,
          failing,
        });
      if (values.some(({ value }) => value === undefined))
        return skipCheck(
          this,
          `No ${flag.field} field found; skipping check`,
          `implementation result does not report ${flag.noun} status`,
          { note: 'Field may not be present in all result formats' }
        );
      return passCheck(this, `Implementation ${flag.noun} passed`);
    },
  };
}

/** Change types that remove a file. */
const DELETION = new Set(['delete', 'deleted', 'remove', 'removed']);

/** `implementation` (worker): result files, self-verification, and changed files. */
export const implementationRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-IMP-001',
    name: 'Implementation result artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const results = findArtifacts(artifacts, IMPLEMENTATION_RESULTS);
      return Promise.resolve(
        results.length === 0
          ? failCheck(this, 'No implementation result artifact found in stage output')
          : passCheck(this, `Implementation result artifact found: ${results.join(', ')}`)
      );
    },
  },
  {
    checkId: 'VR-IMP-002',
    name: 'Implementation result is valid',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const results = findArtifacts(artifacts, IMPLEMENTATION_RESULTS);
      if (results.length === 0)
        return failCheck(this, 'No implementation result artifact to validate');
      const documents = await loadDocuments(results, projectDir);
      const unreadable = documents.find((document) => !document.readable);
      if (unreadable !== undefined)
        return failCheck(this, `Cannot read implementation result file: ${unreadable.path}`);
      const invalid = documents.find((document) => document.data === null);
      if (invalid !== undefined)
        return failCheck(this, 'Implementation result is neither valid YAML nor JSON', {
          path: invalid.path,
        });
      return passCheck(this, 'Implementation result is a valid data file');
    },
  },
  resultFlagRule({
    checkId: 'VR-IMP-003',
    name: 'Tests passed',
    severity: 'error',
    minRigor: 'standard',
    noun: 'tests',
    field: 'testsPassed',
    paths: ['testsPassed', 'tests_passed', 'verification.tests_passed', 'verification.testsPassed'],
  }),
  resultFlagRule({
    checkId: 'VR-IMP-004',
    name: 'Build passed',
    severity: 'error',
    minRigor: 'standard',
    noun: 'build',
    field: 'buildPassed',
    paths: ['buildPassed', 'build_passed', 'verification.build_passed', 'verification.buildPassed'],
  }),
  resultFlagRule({
    checkId: 'VR-IMP-005',
    name: 'Lint passed',
    severity: 'warning',
    minRigor: 'strict',
    noun: 'lint',
    field: 'lintPassed',
    paths: ['lintPassed', 'lint_passed', 'verification.lint_passed', 'verification.lintPassed'],
  }),
  {
    checkId: 'VR-IMP-006',
    name: 'Implementation result reports completion',
    category: 'content',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const results = findArtifacts(artifacts, IMPLEMENTATION_RESULTS);
      if (results.length === 0) return failCheck(this, 'No implementation result to check status');
      const documents = await loadDocuments(results, projectDir);
      const invalid = invalidDocument(this, documents, 'implementation result');
      if (invalid !== undefined) return invalid;
      const incomplete = documents
        .map((document) => ({
          path: document.path,
          status: readPath(unwrapRoot(document.data, 'implementation_result') ?? {}, ['status']),
        }))
        .filter(({ status }) => status !== 'completed');
      if (incomplete.length > 0)
        return failCheck(
          this,
          `${String(incomplete.length)} implementation result(s) do not report status completed`,
          { incomplete }
        );
      return passCheck(this, `All ${String(results.length)} implementation result(s) completed`);
    },
  },
  {
    checkId: 'VR-IMP-007',
    name: 'Recorded file changes match the project',
    category: 'consistency',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const results = findArtifacts(artifacts, IMPLEMENTATION_RESULTS);
      if (results.length === 0) return failCheck(this, 'No implementation result to check changes');
      const documents = await loadDocuments(results, projectDir);
      const invalid = invalidDocument(this, documents, 'implementation result');
      if (invalid !== undefined) return invalid;
      const missing: string[] = [];
      const stillPresent: string[] = [];
      const outside: string[] = [];
      let recorded = 0;
      for (const document of documents) {
        const record = unwrapRoot(document.data, 'implementation_result') ?? {};
        const changes = readPath(record, ['changes', 'changed_files', 'changedFiles']);
        if (!Array.isArray(changes)) continue;
        for (const change of changes as unknown[]) {
          const location = isRecord(change)
            ? (change['file_path'] ?? change['filePath'] ?? change['path'])
            : change;
          if (typeof location !== 'string' || location.trim() === '') continue;
          recorded++;
          const changeType = isRecord(change)
            ? (change['change_type'] ?? change['changeType'])
            : undefined;
          const state = await projectFileState(projectDir, location);
          if (state === 'outside') outside.push(location);
          else if (typeof changeType === 'string' && DELETION.has(changeType.toLowerCase())) {
            if (state === 'present') stillPresent.push(location);
          } else if (state === 'absent') missing.push(location);
        }
      }
      if (recorded === 0)
        return failCheck(this, 'Implementation result records no changed files', {
          results,
        });
      if (missing.length > 0 || stillPresent.length > 0 || outside.length > 0)
        return failCheck(
          this,
          `Implementation result references ${String(missing.length)} missing file(s), ${String(stillPresent.length)} deleted file(s) still present, and ${String(outside.length)} path(s) outside the project`,
          { missing, stillPresent, outside }
        );
      return passCheck(this, `All ${String(recorded)} recorded change(s) match the project`, {
        recorded,
      });
    },
  },
];

// =============================================================================
// Regression report (regression_testing)
// =============================================================================

/** Enhancement mode: `regression_testing` (regression-tester). */
export const regressionRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-REG-001',
    name: 'Regression report exists and is valid',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const report = findArtifacts(artifacts, REGRESSION_REPORT)[0];
      if (report === undefined)
        return failCheck(this, 'No regression_report artifact found in stage output');
      const invalid = invalidDocument(
        this,
        await loadDocuments([report], projectDir),
        'regression report'
      );
      return invalid ?? passCheck(this, `Regression report found: ${report}`);
    },
  },
  {
    checkId: 'VR-REG-002',
    name: 'Regression tests ran and passed',
    category: 'quality',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const report = findArtifacts(artifacts, REGRESSION_REPORT)[0];
      if (report === undefined) return failCheck(this, 'No regression report to check');
      const documents = await loadDocuments([report], projectDir);
      const invalid = invalidDocument(this, documents, 'regression report');
      if (invalid !== undefined) return invalid;
      const record = unwrapRoot(documents[0]?.data, 'regression_report') ?? {};
      const failed = readPath(record, ['test_execution.failed', 'testExecution.failed']);
      const run = readPath(record, [
        'test_execution.total_tests_run',
        'testExecution.totalTestsRun',
      ]);
      const status = readPath(record, ['summary.status']);
      if (failed === undefined && status === undefined)
        return failCheck(this, 'Regression report records no test execution result');
      if (typeof run === 'number' && run === 0)
        return failCheck(this, 'Regression report records zero executed tests');
      if ((typeof failed === 'number' && failed > 0) || status === 'failed')
        return failCheck(this, 'Regression tests failed', { failed, status });
      return passCheck(this, 'Regression tests passed', { failed, status });
    },
  },
  {
    checkId: 'VR-REG-003',
    name: 'No blocking compatibility issue',
    category: 'consistency',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const report = findArtifacts(artifacts, REGRESSION_REPORT)[0];
      if (report === undefined) return failCheck(this, 'No regression report to check');
      const documents = await loadDocuments([report], projectDir);
      const invalid = invalidDocument(this, documents, 'regression report');
      if (invalid !== undefined) return invalid;
      const record = unwrapRoot(documents[0]?.data, 'regression_report') ?? {};
      const blocking = readPath(record, ['summary.blocking_issues']);
      const issues = readPath(record, ['compatibility_issues']);
      const critical = Array.isArray(issues)
        ? issues.filter((issue) => isRecord(issue) && issue['severity'] === 'critical').length
        : 0;
      if ((typeof blocking === 'number' && blocking > 0) || critical > 0)
        return failCheck(this, 'Regression report lists blocking compatibility issues', {
          blocking,
          critical,
        });
      return passCheck(this, 'No blocking compatibility issue reported');
    },
  },
];

// =============================================================================
// Validation report (validation-agent)
// =============================================================================

/** `validation-agent`: the final requirement/acceptance validation report. */
export const validationRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-VAL-001',
    name: 'Validation report exists and is valid',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const report = findArtifacts(artifacts, VALIDATION_REPORT)[0];
      if (report === undefined)
        return failCheck(this, 'No validation-report artifact found in stage output');
      const invalid = invalidDocument(
        this,
        await loadDocuments([report], projectDir),
        'validation report'
      );
      return invalid ?? passCheck(this, `Validation report found: ${report}`);
    },
  },
  {
    checkId: 'VR-VAL-002',
    name: 'Validation result is not fail',
    category: 'quality',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const report = findArtifacts(artifacts, VALIDATION_REPORT)[0];
      if (report === undefined) return failCheck(this, 'No validation report to check');
      const documents = await loadDocuments([report], projectDir);
      const invalid = invalidDocument(this, documents, 'validation report');
      if (invalid !== undefined) return invalid;
      const record = unwrapRoot(documents[0]?.data, 'validation_report') ?? {};
      const parsed = OverallResultSchema.safeParse(
        readPath(record, ['overall_status', 'overallResult', 'overall_result', 'overallStatus'])
      );
      if (!parsed.success)
        return failCheck(
          this,
          'Validation report has no overall status of pass, pass_with_warnings, or fail'
        );
      if (parsed.data === 'fail')
        return failCheck(this, 'Validation report result is fail', { overallResult: 'fail' });
      return passCheck(this, `Validation report result is ${parsed.data}`, {
        overallResult: parsed.data,
      });
    },
  },
  {
    checkId: 'VR-VAL-003',
    name: 'Validation quality gates passed',
    category: 'quality',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const report = findArtifacts(artifacts, VALIDATION_REPORT)[0];
      if (report === undefined) return failCheck(this, 'No validation report to check');
      const documents = await loadDocuments([report], projectDir);
      const invalid = invalidDocument(this, documents, 'validation report');
      if (invalid !== undefined) return invalid;
      const record = unwrapRoot(documents[0]?.data, 'validation_report') ?? {};
      const gates = readPath(record, ['quality_gates', 'qualityGates']);
      if (!Array.isArray(gates) || gates.length === 0)
        return skipCheck(
          this,
          'Validation report lists no quality gates; check skipped',
          'validation report has no quality gate data'
        );
      const failed = gates
        .filter((gate) => isRecord(gate) && gate['status'] === 'fail')
        .map((gate) => String((gate as Record<string, unknown>)['name']));
      if (failed.length > 0)
        return failCheck(this, `Validation quality gates failed: ${failed.join(', ')}`, {
          failed,
        });
      return passCheck(this, `All ${String(gates.length)} validation quality gate(s) passed`);
    },
  },
];

// =============================================================================
// Review result (review)
// =============================================================================

/** Accepted review decision values across the PR and local review formats. */
const REVIEW_DECISIONS = [
  'approve',
  'request_changes',
  'reject',
  'merge',
  'revise',
  'approved',
  'changes_requested',
  'rejected',
];

/** Quality flags in a pull request review result. */
const PR_QUALITY_CHECKS = ['ci_passed', 'tests_passed', 'lint_passed', 'security_scan_passed'];

/**
 * Locate the review result in a stage's output.
 * @param artifacts - Stage artifacts
 * @returns First review result location
 */
function findReviewResult(artifacts: readonly string[]): string | undefined {
  return findArtifacts(artifacts, REVIEW_RESULTS)[0];
}

/** A loaded review record, or the failing check that prevented loading it. */
type LoadedReview =
  { readonly record: Record<string, unknown> } | { readonly failure: VerificationCheck };

/**
 * Load the review result as an unwrapped object.
 * @param rule - Rule identity
 * @param artifacts - Stage artifacts
 * @param projectDir - Project root
 * @param label - What the rule checks, used in messages
 * @returns Review record or a failing check
 */
async function loadReview(
  rule: RuleIdentity,
  artifacts: readonly string[],
  projectDir: string,
  label: string
): Promise<LoadedReview> {
  const artifact = findReviewResult(artifacts);
  if (artifact === undefined)
    return { failure: failCheck(rule, `No review result to check ${label}`) };
  const [document] = await loadDocuments([artifact], projectDir);
  if (document === undefined || !document.readable)
    return { failure: failCheck(rule, `Cannot read review result file: ${artifact}`) };
  const record = unwrapRoot(document.data, 'pr_review_result');
  return record === null
    ? { failure: failCheck(rule, `Cannot parse review result to check ${label}`) }
    : { record };
}

/**
 * Whether the review was produced by the local (no GitHub) reviewer.
 * @param context - Producing stage identity
 * @returns True for the local reviewer
 */
function isLocalReview(context: VerificationRuleContext | undefined): boolean {
  return context?.agentType === 'local-reviewer';
}

/** `review` (pr-reviewer / local-reviewer). */
export const reviewRules: readonly VerificationRule[] = [
  {
    checkId: 'VR-REV-001',
    name: 'Review result artifact exists',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    check(artifacts): Promise<VerificationCheck> {
      const artifact = findReviewResult(artifacts);
      return Promise.resolve(
        artifact === undefined
          ? failCheck(this, 'No review result artifact found in stage output')
          : passCheck(this, `Review result artifact found: ${artifact}`)
      );
    },
  },
  {
    checkId: 'VR-REV-002',
    name: 'Review result is valid',
    category: 'structure',
    minRigor: 'minimal',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const artifact = findReviewResult(artifacts);
      if (artifact === undefined) return failCheck(this, 'No review result artifact to validate');
      const [document] = await loadDocuments([artifact], projectDir);
      if (document === undefined || !document.readable)
        return failCheck(this, `Cannot read review result file: ${artifact}`);
      if (document.data === null)
        return failCheck(this, 'Review result is neither valid YAML nor JSON');
      return passCheck(this, 'Review result is a valid data file');
    },
  },
  {
    checkId: 'VR-REV-003',
    name: 'Review decision present',
    category: 'content',
    minRigor: 'standard',
    severity: 'warning',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const loaded = await loadReview(this, artifacts, projectDir, 'decision');
      if ('failure' in loaded) return loaded.failure;
      const { record } = loaded;
      const raw =
        record['decision'] ?? record['reviewDecision'] ?? readPath(record, ['review.status']);
      if (raw === undefined) return failCheck(this, 'No decision field found in review result');
      const decision = isRecord(raw) ? raw['action'] : raw;
      if (typeof decision !== 'string' || !REVIEW_DECISIONS.includes(decision)) {
        const decisionStr = typeof decision === 'string' ? decision : JSON.stringify(raw);
        return failCheck(this, `Invalid review decision: ${decisionStr}`, {
          decision: raw,
          validDecisions: REVIEW_DECISIONS,
        });
      }
      return passCheck(this, `Review decision: ${decision}`, { decision });
    },
  },
  {
    checkId: 'VR-REV-004',
    name: 'Review links the reviewed change',
    category: 'traceability',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir, context): Promise<VerificationCheck> {
      const loaded = await loadReview(this, artifacts, projectDir, 'links');
      if ('failure' in loaded) return loaded.failure;
      const { record } = loaded;
      if (isLocalReview(context)) {
        const workOrder = readPath(record, ['workOrderId', 'work_order_id']);
        return typeof workOrder === 'string' && workOrder.trim() !== ''
          ? passCheck(this, `Local review covers work order ${workOrder}`)
          : failCheck(this, 'Local review report does not name the reviewed work order');
      }
      const url = readPath(record, ['pull_request.url', 'pullRequest.url', 'pr_url', 'prUrl']);
      const number = readPath(record, [
        'pull_request.number',
        'pullRequest.number',
        'pr_number',
        'prNumber',
      ]);
      if ((typeof url === 'string' && url.trim() !== '') || typeof number === 'number')
        return passCheck(this, 'Review result references its pull request', { url, number });
      return failCheck(this, 'Review result does not reference a pull request (number or URL)');
    },
  },
  {
    checkId: 'VR-REV-005',
    name: 'Review quality checks did not fail',
    category: 'quality',
    minRigor: 'standard',
    severity: 'error',
    async check(artifacts, projectDir): Promise<VerificationCheck> {
      const loaded = await loadReview(this, artifacts, projectDir, 'quality checks');
      if ('failure' in loaded) return loaded.failure;
      const { record } = loaded;
      const checks = record['checks'];
      const gate = readPath(record, ['qualityGate.passed', 'quality_gate.passed']);
      if (isRecord(checks)) {
        const failed = PR_QUALITY_CHECKS.filter((name) => checks[name] === false);
        if (failed.length > 0)
          return failCheck(this, `Review quality checks failed: ${failed.join(', ')}`, { failed });
        return passCheck(this, 'Review quality checks did not fail');
      }
      if (gate === false)
        return failCheck(this, 'Review quality gate failed', {
          failures: readPath(record, ['qualityGate.failures', 'quality_gate.failures']),
        });
      if (gate === true) return passCheck(this, 'Review quality gate passed');
      return skipCheck(
        this,
        'Review result reports no quality checks; check skipped',
        'review result has no quality gate data'
      );
    },
  },
];
