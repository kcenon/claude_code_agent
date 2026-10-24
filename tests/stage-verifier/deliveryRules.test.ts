/**
 * Delivery-path check sets against real files in a temporary project.
 * No filesystem mocks: each rule reads the artifact it names.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  hasAcceptanceCriteria,
  implementationRules,
  issueReadingRules,
  orchestrationRules,
  regressionRules,
  reviewRules,
  validationRules,
} from '../../src/stage-verifier/deliveryRules.js';
import { VERIFICATION_CHECK_SETS } from '../../src/stage-verifier/rules.js';
import type { VerificationRule, VerificationRuleContext } from '../../src/stage-verifier/types.js';

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'delivery-rules-'));
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function file(path: string, content: string): Promise<string> {
  await mkdir(join(project, dirname(path)), { recursive: true });
  await writeFile(join(project, path), content);
  return path;
}

function rule(rules: readonly VerificationRule[], id: string): VerificationRule {
  const found = rules.find((candidate) => candidate.checkId === id);
  if (found === undefined) throw new Error(`missing rule ${id}`);
  return found;
}

async function run(
  rules: readonly VerificationRule[],
  id: string,
  artifacts: string[],
  context?: VerificationRuleContext
) {
  return rule(rules, id).check(artifacts, project, context);
}

const ISSUES = '.ad-sdlc/scratchpad/issues/demo/issue_list.json';
const GRAPH = '.ad-sdlc/scratchpad/issues/demo/dependency_graph.json';
const ORDER = '.ad-sdlc/scratchpad/progress/demo/work_orders/WO-001.yaml';
const RESULT = '.ad-sdlc/scratchpad/progress/demo/results/WO-001-result.yaml';
const REGRESSION = '.ad-sdlc/scratchpad/regression/demo/regression_report.yaml';
const VALIDATION = '.ad-sdlc/scratchpad/vnv/demo/validation-report.yaml';
const PR_REVIEW = '.ad-sdlc/scratchpad/progress/demo/reviews/PR-001-review.yaml';
const LOCAL_REVIEW = '.ad-sdlc/scratchpad/progress/demo/reviews/review_report.json';

describe('acceptance criteria detection', () => {
  it.each([
    [{ acceptance_criteria: ['Signs in'] }, true],
    [{ acceptanceCriteria: ['Signs in'] }, true],
    [{ body: '## Acceptance Criteria\n\n- [ ] Signs in' }, true],
    [{ body: '**Acceptance Criteria**\n1. Signs in' }, true],
    [{ description: '### acceptance criteria\n* signs in' }, true],
    [{ body: '## Acceptance Criteria\n\nTBD\n\n## Notes\n- not a criterion' }, false],
    [{ body: '- [ ] a checklist without the heading' }, false],
    [{ acceptance_criteria: [] }, false],
    [{}, false],
  ])('%j -> %s', (issue, expected) => {
    expect(hasAcceptanceCriteria(issue)).toBe(expected);
  });
});

describe('imported-issues (issue_reading)', () => {
  const valid = JSON.stringify({
    issues: [
      { id: 'ISS-001', title: 'Login', body: '## Acceptance Criteria\n- [ ] Signs in' },
      { id: 'ISS-002', title: 'Logout', acceptance_criteria: ['Signs out'] },
    ],
  });

  it('passes a valid imported issue list', async () => {
    const path = await file(ISSUES, valid);
    for (const id of ['VR-IRD-001', 'VR-IRD-002', 'VR-IRD-003'])
      expect((await run(issueReadingRules, id, [path])).passed).toBe(true);
  });

  it('fails when the issue list is missing from the stage output', async () => {
    const result = await run(issueReadingRules, 'VR-IRD-001', ['notes.md']);
    expect(result.passed).toBe(false);
    expect((await run(issueReadingRules, 'VR-IRD-002', ['notes.md'])).passed).toBe(false);
  });

  it('names every issue that states no acceptance criteria', async () => {
    const path = await file(
      ISSUES,
      JSON.stringify({
        issues: [
          { id: 'ISS-001', title: 'Login', body: '## Acceptance Criteria\n- [ ] Signs in' },
          { id: 'ISS-002', title: 'Logout', body: 'No criteria here.' },
        ],
      })
    );
    const result = await run(issueReadingRules, 'VR-IRD-003', [path]);
    expect(result.passed).toBe(false);
    expect(result.details?.['missingAcceptanceCriteria']).toEqual(['ISS-002']);
  });

  it('fails an empty, unreadable, or malformed issue list', async () => {
    expect((await run(issueReadingRules, 'VR-IRD-003', [ISSUES])).message).toContain('Cannot read');
    const empty = await file(ISSUES, JSON.stringify({ issues: [] }));
    expect((await run(issueReadingRules, 'VR-IRD-002', [empty])).passed).toBe(false);
    expect((await run(issueReadingRules, 'VR-IRD-003', [empty])).passed).toBe(false);
    await file(ISSUES, 'not: [valid');
    expect((await run(issueReadingRules, 'VR-IRD-002', [ISSUES])).passed).toBe(false);
  });

  it('rejects untitled, unidentified, and duplicate issues', async () => {
    const path = await file(
      ISSUES,
      JSON.stringify([
        { id: 'ISS-001', title: 'Login' },
        { id: 'ISS-001', title: 'Duplicate' },
        { title: 'No id' },
        { id: 7, title: '' },
      ])
    );
    const result = await run(issueReadingRules, 'VR-IRD-002', [path]);
    expect(result.passed).toBe(false);
    expect(result.details).toEqual({
      untitled: ['7'],
      unidentified: ['entry 3'],
      duplicates: ['ISS-001'],
    });
  });

  it('skips, passes, and fails the dependency graph check', async () => {
    const issues = await file(ISSUES, valid);
    const skipped = await run(issueReadingRules, 'VR-IRD-004', [issues]);
    expect(skipped.passed).toBe(true);
    expect(skipped.skipReason).toBe('dependency graph not produced');

    const graph = await file(
      GRAPH,
      JSON.stringify({
        nodes: [{ id: 'ISS-001' }, { id: 'ISS-002' }],
        edges: [{ from: 'ISS-002', to: 'ISS-001' }],
        has_cycles: false,
      })
    );
    expect((await run(issueReadingRules, 'VR-IRD-004', [issues, graph])).passed).toBe(true);

    await file(GRAPH, JSON.stringify({ nodes: [], edges: [], has_cycles: true }));
    expect((await run(issueReadingRules, 'VR-IRD-004', [issues, graph])).message).toContain(
      'cycle'
    );
    await file(
      GRAPH,
      JSON.stringify({ nodes: [{ id: 'ISS-001' }], edges: [{ from: 'ISS-001', to: 'ISS-9' }] })
    );
    expect((await run(issueReadingRules, 'VR-IRD-004', [issues, graph])).details).toEqual({
      dangling: ['ISS-9'],
    });
  });
});

describe('generated-issues (issue_generation) acceptance criteria', () => {
  it('applies the shared acceptance criteria rule as VR-ISS-004', async () => {
    const rules = VERIFICATION_CHECK_SETS['generated-issues'];
    const path = await file(ISSUES, JSON.stringify([{ id: 'ISS-001', title: 'No criteria' }]));
    expect((await run(rules, 'VR-ISS-004', [path])).passed).toBe(false);
    await file(
      ISSUES,
      JSON.stringify([{ id: 'ISS-001', title: 'Has criteria', acceptanceCriteria: ['Works'] }])
    );
    expect((await run(rules, 'VR-ISS-004', [path])).passed).toBe(true);
  });
});

describe('work-orders (orchestration)', () => {
  it('requires work orders that reference an issue', async () => {
    expect((await run(orchestrationRules, 'VR-ORC-001', ['notes.md'])).passed).toBe(false);
    expect((await run(orchestrationRules, 'VR-ORC-002', ['notes.md'])).passed).toBe(false);
    const order = await file(ORDER, 'work_order:\n  id: WO-001\n  issue:\n    id: ISS-001\n');
    expect((await run(orchestrationRules, 'VR-ORC-001', [order])).passed).toBe(true);
    expect((await run(orchestrationRules, 'VR-ORC-002', [order])).passed).toBe(true);
    const flat = await file(
      '.ad-sdlc/scratchpad/progress/demo/work_orders/WO-002.json',
      JSON.stringify({ id: 'WO-002', issue_id: 12 })
    );
    expect((await run(orchestrationRules, 'VR-ORC-002', [order, flat])).passed).toBe(true);
  });

  it('names work orders without an issue and rejects malformed ones', async () => {
    const order = await file(ORDER, 'work_order:\n  id: WO-001\n  issue: {}\n');
    const result = await run(orchestrationRules, 'VR-ORC-002', [order]);
    expect(result.passed).toBe(false);
    expect(result.details).toEqual({ unlinked: [ORDER] });
    await file(ORDER, '- just\n- a list\n');
    expect((await run(orchestrationRules, 'VR-ORC-002', [order])).message).toContain(
      'not a structured'
    );
  });
});

describe('implementation-results (implementation)', () => {
  const workerResult = (changes: string, status = 'completed', verification = '') =>
    [
      'implementation_result:',
      '  work_order_id: WO-001',
      `  status: ${status}`,
      '  changes:',
      changes,
      '  verification:',
      verification || '    tests_passed: true\n    build_passed: true\n    lint_passed: true',
    ].join('\n');

  it('locates worker results under results/ and reads nested verification flags', async () => {
    await file('src/login.ts', 'export {};\n');
    const path = await file(
      RESULT,
      workerResult('    - file_path: src/login.ts\n      change_type: create')
    );
    for (const id of [
      'VR-IMP-001',
      'VR-IMP-002',
      'VR-IMP-003',
      'VR-IMP-004',
      'VR-IMP-005',
      'VR-IMP-006',
      'VR-IMP-007',
    ])
      expect((await run(implementationRules, id, [path])).passed, id).toBe(true);
  });

  it('fails when a recorded change references a missing file', async () => {
    const path = await file(
      RESULT,
      workerResult('    - file_path: src/missing.ts\n      change_type: modify')
    );
    const result = await run(implementationRules, 'VR-IMP-007', [path]);
    expect(result.passed).toBe(false);
    expect(result.details).toEqual({ missing: ['src/missing.ts'], stillPresent: [], outside: [] });
  });

  it('treats a file whose name starts with two dots as inside the project', async () => {
    await file('..notes.md', 'notes\n');
    const path = await file(
      RESULT,
      workerResult('    - file_path: ..notes.md\n      change_type: create')
    );
    expect((await run(implementationRules, 'VR-IMP-007', [path])).passed).toBe(true);
  });

  it('fails a deletion that left the file, a path outside the project, and no changes', async () => {
    await file('src/old.ts', 'export {};\n');
    const path = await file(
      RESULT,
      workerResult(
        '    - file_path: src/old.ts\n      change_type: delete\n    - file_path: ../outside.ts\n      change_type: create'
      )
    );
    expect((await run(implementationRules, 'VR-IMP-007', [path])).details).toEqual({
      missing: [],
      stillPresent: ['src/old.ts'],
      outside: ['../outside.ts'],
    });
    await file(RESULT, 'implementation_result:\n  status: completed\n');
    expect((await run(implementationRules, 'VR-IMP-007', [path])).message).toContain(
      'records no changed files'
    );
  });

  it('fails tests that did not pass and an incomplete status', async () => {
    const path = await file(
      RESULT,
      workerResult('    - src/a.ts', 'failed', '    tests_passed: false\n    build_passed: true')
    );
    expect((await run(implementationRules, 'VR-IMP-003', [path])).passed).toBe(false);
    expect((await run(implementationRules, 'VR-IMP-006', [path])).details).toEqual({
      incomplete: [{ path: RESULT, status: 'failed' }],
    });
    // lint is not reported: skipped, not passed
    const lint = await run(implementationRules, 'VR-IMP-005', [path]);
    expect(lint.skipReason).toContain('does not report lint status');
  });
});

describe('regression-report (regression_testing)', () => {
  it('passes a clean report and fails failed, missing, or empty test execution', async () => {
    const path = await file(
      REGRESSION,
      'regression_report:\n  test_execution:\n    total_tests_run: 4\n    failed: 0\n  summary:\n    status: passed\n    blocking_issues: 0\n'
    );
    for (const id of ['VR-REG-001', 'VR-REG-002', 'VR-REG-003'])
      expect((await run(regressionRules, id, [path])).passed, id).toBe(true);

    await file(
      REGRESSION,
      'regression_report:\n  test_execution:\n    total_tests_run: 4\n    failed: 1\n  summary:\n    status: failed\n    blocking_issues: 1\n'
    );
    expect((await run(regressionRules, 'VR-REG-002', [path])).message).toBe(
      'Regression tests failed'
    );
    expect((await run(regressionRules, 'VR-REG-003', [path])).passed).toBe(false);

    await file(
      REGRESSION,
      'regression_report:\n  test_execution:\n    total_tests_run: 0\n    failed: 0\n'
    );
    expect((await run(regressionRules, 'VR-REG-002', [path])).message).toContain('zero');
    await file(REGRESSION, 'regression_report:\n  analysis_date: today\n');
    expect((await run(regressionRules, 'VR-REG-002', [path])).message).toContain(
      'no test execution'
    );
    expect((await run(regressionRules, 'VR-REG-001', ['notes.md'])).passed).toBe(false);
  });
});

describe('validation-report (validation-agent)', () => {
  it('reads the overall status with the validation agent schema', async () => {
    const path = await file(
      VALIDATION,
      'validation_report:\n  overall_status: pass_with_warnings\n  quality_gates:\n    - name: overall_coverage\n      status: pass\n'
    );
    for (const id of ['VR-VAL-001', 'VR-VAL-002', 'VR-VAL-003'])
      expect((await run(validationRules, id, [path])).passed, id).toBe(true);

    await file(
      VALIDATION,
      'validation_report:\n  overall_status: fail\n  quality_gates:\n    - name: critical_requirements\n      status: fail\n'
    );
    expect((await run(validationRules, 'VR-VAL-002', [path])).passed).toBe(false);
    expect((await run(validationRules, 'VR-VAL-003', [path])).details).toEqual({
      failed: ['critical_requirements'],
    });

    await file(VALIDATION, 'validation_report:\n  overall_status: maybe\n');
    expect((await run(validationRules, 'VR-VAL-002', [path])).passed).toBe(false);
    expect((await run(validationRules, 'VR-VAL-003', [path])).skipReason).toBeDefined();
    expect((await run(validationRules, 'VR-VAL-001', ['notes.md'])).passed).toBe(false);
  });
});

describe('review-result (review)', () => {
  const pr: VerificationRuleContext = {
    stageName: 'review',
    agentType: 'pr-reviewer',
    pipelineMode: 'import',
  };
  const local: VerificationRuleContext = { ...pr, agentType: 'local-reviewer' };

  it('accepts a pull request review with a PR reference and passing checks', async () => {
    const path = await file(
      PR_REVIEW,
      'pr_review_result:\n  pull_request:\n    number: 7\n    url: https://github.com/example/project/pull/7\n  checks:\n    ci_passed: true\n    tests_passed: true\n  decision:\n    action: merge\n'
    );
    for (const id of ['VR-REV-001', 'VR-REV-002', 'VR-REV-003', 'VR-REV-004', 'VR-REV-005'])
      expect((await run(reviewRules, id, [path], pr)).passed, id).toBe(true);
  });

  it('fails a PR review without a PR reference or with failed CI', async () => {
    const path = await file(
      PR_REVIEW,
      'pr_review_result:\n  checks:\n    ci_passed: false\n  decision:\n    action: revise\n'
    );
    expect((await run(reviewRules, 'VR-REV-004', [path], pr)).passed).toBe(false);
    expect((await run(reviewRules, 'VR-REV-005', [path], pr)).details).toEqual({
      failed: ['ci_passed'],
    });
  });

  it('checks the local review report format', async () => {
    const path = await file(
      LOCAL_REVIEW,
      JSON.stringify({ workOrderId: 'WO-001', decision: 'approve', qualityGate: { passed: true } })
    );
    for (const id of ['VR-REV-001', 'VR-REV-003', 'VR-REV-004', 'VR-REV-005'])
      expect((await run(reviewRules, id, [path], local)).passed, id).toBe(true);
    await file(
      LOCAL_REVIEW,
      JSON.stringify({
        decision: 'request_changes',
        qualityGate: { passed: false, failures: ['lint'] },
      })
    );
    expect((await run(reviewRules, 'VR-REV-004', [path], local)).passed).toBe(false);
    expect((await run(reviewRules, 'VR-REV-005', [path], local)).details).toEqual({
      failures: ['lint'],
    });
    await file(LOCAL_REVIEW, JSON.stringify({ workOrderId: 'WO-001', decision: 'approve' }));
    expect((await run(reviewRules, 'VR-REV-005', [path], local)).skipReason).toBeDefined();
  });

  it('reports a missing, unreadable, or unparseable review result', async () => {
    expect((await run(reviewRules, 'VR-REV-004', ['notes.md'], pr)).message).toContain(
      'No review result'
    );
    expect((await run(reviewRules, 'VR-REV-005', [PR_REVIEW], pr)).message).toContain(
      'Cannot read'
    );
    await file(PR_REVIEW, '- a\n- list\n');
    expect((await run(reviewRules, 'VR-REV-004', [PR_REVIEW], pr)).message).toContain(
      'Cannot parse'
    );
  });
});
