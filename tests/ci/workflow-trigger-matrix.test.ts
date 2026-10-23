/**
 * Trigger matrix guard (#954): parses every workflow under .github/workflows,
 * evaluates triggers and job-level `if:` conditions, and asserts the lane
 * invariants and the matrix documented in docs/guides/testing.md.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIVE_BUDGET_SETTINGS } from '../../scripts/live-lane.js';
import {
  ADVISORY_CHECKS,
  EVENT_LABELS,
  MATRIX_DOCUMENT,
  REQUIRED_CHECKS,
  allChecks,
  checkReport,
  computeTriggerMatrix,
  evaluateCondition,
  extractGeneratedBlock,
  filterPattern,
  findUnreachableJobs,
  loadWorkflows,
  modeledEvents,
  normalizeMarkdown,
  parseWorkflow,
  renderMatrixMarkdown,
  type MatrixRow,
  type WorkflowFile,
} from '../../scripts/ci/trigger-matrix.js';

const root = process.cwd();
const workflows = loadWorkflows(root);
const rows = computeTriggerMatrix(workflows);
const workflow = (file: string): WorkflowFile => {
  const found = workflows.find((entry) => entry.file === file);
  if (found === undefined) throw new Error(`missing workflow ${file}`);
  return found;
};
const row = (label: string, file: string): MatrixRow | undefined =>
  rows.find((entry) => entry.event.label === label && entry.workflow?.file === file);

const OFFLINE_GATES = [
  'Lint',
  'Test (ubuntu-latest)',
  'Test (windows-2022)',
  'Build',
  'Package Asset Delivery (offline)',
  'Integration Tests',
  'Pipeline E2E (offline)',
];

describe('workflow trigger matrix', () => {
  it('models every workflow file and every trigger it declares', () => {
    expect(workflows.map((entry) => entry.file)).toEqual(
      expect.arrayContaining(['ci.yml', 'live-acceptance.yml', 'docs-check.yml', 'doc-audit.yml'])
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('has no job whose if: is unreachable under its own triggers', () => {
    expect(findUnreachableJobs(workflows)).toEqual([]);
  });

  it.each([
    EVENT_LABELS.PR_DEVELOP,
    EVENT_LABELS.PUSH_DEVELOP,
    EVENT_LABELS.PR_MAIN,
    '`push` → `main`',
  ])(
    'runs lint, test, build, package-assets, and the offline lanes without a path filter on %s',
    (label) => {
      const ci = row(label, 'ci.yml');
      expect(ci?.pathFiltered).toBe(false);
      expect(ci?.runs).toEqual(expect.arrayContaining(OFFLINE_GATES));
    }
  );

  it('runs the live job only on an explicit dispatch of live-acceptance.yml', () => {
    const live = workflow('live-acceptance.yml');
    expect(Object.keys(live.on)).toEqual(['workflow_dispatch']);
    const liveRows = rows.filter((entry) => entry.workflow === live);
    expect(liveRows.map((entry) => entry.event.event)).toEqual(['workflow_dispatch']);
    expect(liveRows[0]?.runs).toEqual(['Live Acceptance']);
    // No other workflow can start the live lane.
    for (const entry of workflows.filter((candidate) => candidate !== live))
      expect(entry.source).not.toMatch(/test:live|vitest\.live\.config/);
  });

  it('keeps the live workflow least-privilege, time-boxed, and budgeted', () => {
    const live = workflow('live-acceptance.yml');
    expect(live.permissions).toEqual({ contents: 'read' });
    const job = live.jobs['live'];
    expect(job?.['timeout-minutes']).toBeGreaterThan(0);
    expect(job?.['timeout-minutes']).toBeLessThanOrEqual(60);
    const run = job?.steps?.find((step) => step.run === 'npm run test:live');
    expect(run?.env).toMatchObject({
      AD_SDLC_LIVE_MAX_TURNS: '${{ inputs.max_turns }}',
      AD_SDLC_LIVE_STAGE_TIMEOUT_MS: '${{ inputs.stage_timeout_ms }}',
    });
    const { maxTurns, stageTimeoutMs } = LIVE_BUDGET_SETTINGS;
    expect(live.dispatchDefaults['max_turns']).toBeGreaterThanOrEqual(maxTurns.min);
    expect(live.dispatchDefaults['max_turns']).toBeLessThanOrEqual(maxTurns.max);
    expect(live.dispatchDefaults['stage_timeout_ms']).toBeGreaterThanOrEqual(stageTimeoutMs.min);
    expect(live.dispatchDefaults['stage_timeout_ms']).toBeLessThanOrEqual(stageTimeoutMs.max);
    // The time budget must fit inside the job timeout with headroom for setup.
    expect(stageTimeoutMs.max + 5 * 60_000).toBeLessThanOrEqual(
      Number(job?.['timeout-minutes']) * 60_000
    );
  });

  it('passes Anthropic credentials only to the live workflow', () => {
    const credentialed = workflows
      .filter((entry) => /secrets\.(ANTHROPIC_API_KEY|CLAUDE_API_KEY)/.test(entry.source))
      .map((entry) => entry.file);
    expect(credentialed).toEqual(['live-acceptance.yml']);
  });

  it('runs the offline lanes unconditionally and without environment overrides', () => {
    const ci = workflow('ci.yml');
    for (const [jobId, script] of [
      ['integration', 'npm run test:integration'],
      ['e2e', 'npm run test:e2e'],
    ] as const) {
      const job = ci.jobs[jobId];
      expect(job?.if).toBeUndefined();
      expect(job?.env).toBeUndefined();
      const step = job?.steps?.find((entry) => entry.run === script);
      expect(step).toBeDefined();
      expect(step?.env).toBeUndefined();
    }
  });

  it('documents the generated matrix in docs/guides/testing.md', () => {
    const documented = extractGeneratedBlock(readFileSync(join(root, MATRIX_DOCUMENT), 'utf8'));
    expect(normalizeMarkdown(documented)).toEqual(
      normalizeMarkdown(renderMatrixMarkdown(workflows))
    );
  });
});

describe('required checks (#970)', () => {
  const checks = allChecks(workflows);

  it.each(REQUIRED_CHECKS)(
    '$name reports on every PR into develop and main and on every push to develop',
    (required) => {
      // Rulesets match by name: exactly one check of that name may report on pull requests.
      const matches = checks.filter(
        (check) =>
          check.name === required.name &&
          [EVENT_LABELS.PR_DEVELOP, EVENT_LABELS.PR_MAIN].some(
            (label) => checkReport(rows, check, label) !== 'not triggered'
          )
      );
      expect(matches).toHaveLength(1);
      const check = matches[0]!;
      expect(check.workflow).toBe(required.workflow);
      for (const label of [
        EVENT_LABELS.PR_DEVELOP,
        EVENT_LABELS.PR_MAIN,
        EVENT_LABELS.PUSH_DEVELOP,
      ])
        expect(checkReport(rows, check, label)).toBe('every run');
      expect(workflow(check.workflow).jobs[check.job]?.['continue-on-error']).toBeUndefined();
    }
  );

  it('classifies every unfiltered pull request check as required or advisory', () => {
    const unclassified = checks
      .filter((check) => checkReport(rows, check, EVENT_LABELS.PR_DEVELOP) === 'every run')
      .filter(
        (check) =>
          ![...REQUIRED_CHECKS, ...ADVISORY_CHECKS].some(
            (entry) => entry.workflow === check.workflow && entry.name === check.name
          )
      );
    expect(unclassified).toEqual([]);
  });

  it('never requires a path-filtered check', () => {
    for (const check of checks.filter((entry) =>
      ['docs-check.yml', 'doc-audit.yml', 'docker.yml'].includes(entry.workflow)
    )) {
      expect(REQUIRED_CHECKS.some((entry) => entry.name === check.name)).toBe(false);
      expect(['path-filtered', 'not triggered']).toContain(
        checkReport(rows, check, EVENT_LABELS.PR_DEVELOP)
      );
    }
  });
});

describe('trigger matrix model', () => {
  const develop = modeledEvents(workflows).find(
    (event) => event.label === EVENT_LABELS.PUSH_DEVELOP
  )!;
  const pullRequest = modeledEvents(workflows).find(
    (event) => event.label === EVENT_LABELS.PR_DEVELOP
  )!;
  const scope = { event: develop, workflow: workflow('ci.yml'), needsSucceeded: true };

  it('evaluates the conditions used by job-level if:', () => {
    expect(evaluateCondition("startsWith(github.ref, 'refs/heads/release/')", scope)).toBe(false);
    expect(evaluateCondition("github.event_name == 'push'", scope)).toBe(true);
    expect(
      evaluateCondition("github.ref == 'refs/heads/main' || github.event_name == 'pull_request'", {
        ...scope,
        event: pullRequest,
      })
    ).toBe(true);
    expect(evaluateCondition('${{ always() }}', { ...scope, needsSucceeded: false })).toBe(true);
    expect(
      evaluateCondition("github.event_name == 'push'", { ...scope, needsSucceeded: false })
    ).toBe(false);
  });

  it('fails closed on syntax it does not model', () => {
    expect(() => evaluateCondition("vars.LIVE == 'true'", scope)).toThrow(/not modeled/);
    expect(() => evaluateCondition('fromJSON(inputs.x)', scope)).toThrow(/not modeled/);
    expect(() => filterPattern('!main')).toThrow(/does not model/);
    expect(() =>
      parseWorkflow('target.yml', 'on: pull_request_target\njobs:\n  a:\n    runs-on: x\n')
    ).toThrow(/not modeled/);
  });

  it('reports the pre-#954 release-only E2E job as unreachable', () => {
    const legacy = parseWorkflow(
      'legacy.yml',
      [
        'on:',
        '  push:',
        '    branches: [main, develop]',
        '  pull_request:',
        '    branches: [main, develop]',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '  e2e:',
        '    runs-on: ubuntu-latest',
        '    needs: build',
        "    if: startsWith(github.ref, 'refs/heads/release/')",
      ].join('\n')
    );
    expect(findUnreachableJobs([legacy])).toEqual(['legacy.yml:e2e']);
  });
});
