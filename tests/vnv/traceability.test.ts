/**
 * Traceability record, summary, and the rules and verifier steps that use
 * them (#952).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { StageResult } from '../../src/ad-sdlc-orchestrator/types.js';
import { validationRules } from '../../src/stage-verifier/deliveryRules.js';
import { VERIFICATION_CHECK_SETS } from '../../src/stage-verifier/rules.js';
import { StageVerifierAgent } from '../../src/stage-verifier/StageVerifierAgent.js';
import type { VerificationRule, VerificationRuleContext } from '../../src/stage-verifier/types.js';
import {
  buildTraceabilityRecord,
  locateDocuments,
  parseTraceabilityRecord,
  renderTraceabilityFiles,
  summarizeTraceability,
  traceabilitySources,
  type TraceabilityRecord,
} from '../../src/vnv/traceability.js';
import type { VerificationOptions } from '../../src/vnv/types.js';

const S = '.ad-sdlc/scratchpad';
const ALL_ON: VerificationOptions = {
  generateRtm: true,
  crossDocumentConsistency: true,
  acceptanceCriteriaValidation: true,
};

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'traceability-unit-'));
});
afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function write(files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(project, path)), { recursive: true });
    await writeFile(join(project, path), content);
  }
}

/** Greenfield artifacts: one requirement implemented by one tested issue, one orphan issue. */
const GREENFIELD = {
  [`${S}/documents/demo/prd.md`]: '# PRD\n## FR-001: Login\nPriority: P1\n',
  [`${S}/issues/demo/issue_list.json`]: JSON.stringify({
    issues: [
      {
        id: 'ISS-001',
        title: 'Login',
        traceability: { prd_requirement: 'FR-001' },
        body: '## Acceptance Criteria\n- [ ] Signs in',
      },
      { id: 'ISS-002', title: 'Logging', body: '## Acceptance Criteria\n- [ ] Logs' },
    ],
  }),
  [`${S}/progress/demo/work_orders/WO-001.yaml`]:
    'work_order:\n  id: WO-001\n  issue_id: ISS-001\n',
  [`${S}/progress/demo/results/WO-001-result.yaml`]: [
    'implementation_result:',
    '  work_order_id: WO-001',
    '  status: completed',
    '  verification:',
    '    tests_passed: true',
    '  acceptance_criteria:',
    '    - id: AC-001',
    '      status: met',
    '      tests: [tests/login.test.ts]',
    '',
  ].join('\n'),
  'tests/login.test.ts': 'export {};\n',
};

async function greenfieldRecord(): Promise<TraceabilityRecord> {
  await write(GREENFIELD);
  return buildTraceabilityRecord({
    projectDir: project,
    projectId: 'demo',
    mode: 'greenfield',
    artifacts: Object.keys(GREENFIELD),
  });
}

describe('traceability sources', () => {
  it('classifies manifest artifacts and prefers the scratchpad copy of a document', () => {
    const located = traceabilitySources([
      'docs/prd/PRD-demo.md',
      `${S}/documents/demo/prd.md`,
      `${S}/documents/demo/srs.kr.md`,
      'docs/srs/SRS-demo.kr.md',
      'docs/sds/SDS-demo.md',
      `${S}/issues/demo/issue_list.json`,
      `${S}/issues/demo/issue_list.json`,
      `${S}/progress/demo/work_orders/WO-001.yaml`,
      `${S}/progress/demo/results/WO-001-result.yaml`,
      `${S}/progress/demo/reviews/PR-001-review.yaml`,
      'src/login.ts',
    ]);

    expect(located).toEqual({
      documents: { prd: `${S}/documents/demo/prd.md`, sds: 'docs/sds/SDS-demo.md' },
      issueLists: [`${S}/issues/demo/issue_list.json`],
      workOrders: [`${S}/progress/demo/work_orders/WO-001.yaml`],
      implementationResults: [`${S}/progress/demo/results/WO-001-result.yaml`],
      reviews: [`${S}/progress/demo/reviews/PR-001-review.yaml`],
    });
    expect(locateDocuments(['docs\\PRD.md'])).toEqual({ prd: 'docs\\PRD.md' });
  });
});

describe('traceability record', () => {
  it('records uncovered and untraced identifiers and the sources read', async () => {
    const record = await greenfieldRecord();

    expect(record).toMatchObject({
      schemaVersion: 1,
      roots: 'prd_requirements',
      uncovered: [],
      untraced: ['ISS-002'],
    });
    expect(record.sources).toContain(`${S}/documents/demo/prd.md`);
    expect(record.sources).not.toContain('tests/login.test.ts');
  });

  it('round-trips through persistence and rejects invalid data', async () => {
    const record = await greenfieldRecord();

    expect(parseTraceabilityRecord(JSON.parse(JSON.stringify(record)))).toEqual(record);
    expect(parseTraceabilityRecord({ ...record, schemaVersion: 2 })).toBeUndefined();
    expect(parseTraceabilityRecord({ ...record, uncovered: 'ISS-001' })).toBeUndefined();
    expect(parseTraceabilityRecord(undefined)).toBeUndefined();
  });

  it('renders the RTM files with the uncovered and untraced lists', async () => {
    const record = await greenfieldRecord();
    const files = await renderTraceabilityFiles({ ...record, uncovered: ['FR-009'] });

    expect(JSON.parse(files.json)).toMatchObject({ uncovered: ['FR-009'] });
    expect(files.markdown).toContain('# Requirements Traceability Matrix');
    expect(files.markdown).toContain('| ISS-001/AC-001 | Signs in | Yes | automated-test |');
    expect(files.markdown).toContain('## Uncovered\n\n- FR-009');
    expect(files.markdown).toContain('## Issues not traced to a requirement\n\n- ISS-002');
  });
});

describe('Enhancement traceability scope', () => {
  const issueFor = (requirement: string): Record<string, unknown> => ({
    id: 'ISS-001',
    title: 'Overdue report',
    traceability: { prd_requirement: requirement },
    body: '## Acceptance Criteria\n- [ ] Lists overdue tasks',
  });
  const prd = '# PRD\n## FR-001: Track\n## FR-002: Report\n## FR-003: Overdue\n';
  const files = (
    state: string | undefined,
    update: string | undefined,
    requirement = 'FR-003'
  ): Record<string, string> => ({
    [`${S}/documents/demo/prd.md`]: prd,
    [`${S}/issues/demo/issue_list.json`]: JSON.stringify({ issues: [issueFor(requirement)] }),
    [`${S}/progress/demo/work_orders/WO-001.yaml`]:
      'work_order:\n  id: WO-001\n  issue:\n    id: ISS-001\n',
    [`${S}/progress/demo/results/WO-001-result.yaml`]: [
      'implementation_result:',
      '  work_order_id: WO-001',
      '  issue_id: ISS-001',
      '  status: completed',
      '  changes:',
      '    - { file_path: src/overdue.ts, change_type: create }',
      '  verification: { tests_passed: true, build_passed: true }',
      '  acceptance_criteria:',
      '    - { id: AC-001, status: met, tests: [tests/overdue.test.ts] }',
      '',
    ].join('\n'),
    'tests/overdue.test.ts': 'it("lists", () => undefined);\n',
    ...(state === undefined ? {} : { [`${S}/state/demo/current_state.yaml`]: state }),
    ...(update === undefined ? {} : { [`${S}/documents/demo/prd_update_result.yaml`]: update }),
  });
  const STATE =
    'current_state:\n  requirements:\n    functional:\n      - { id: FR-001 }\n      - { id: FR-002 }\n    non_functional:\n      - { id: NFR-003 }\n';
  const update = (added: string, modified: string): string =>
    `update_result:\n  changes:\n    added: [${added}]\n    modified: [${modified}]\n`;
  const build = async (
    content: Record<string, string>,
    mode: 'enhancement' | 'greenfield' = 'enhancement'
  ): Promise<TraceabilityRecord> => {
    await write(content);
    return buildTraceabilityRecord({
      projectDir: project,
      projectId: 'demo',
      mode,
      artifacts: Object.keys(content),
    });
  };

  it('does not ask for an issue for a requirement the run left unchanged', async () => {
    const record = await build(files(STATE, update('{ id: FR-003 }', '')));
    expect(record.uncovered).toEqual([]);
  });

  it('reports a new requirement that no issue reaches, and does not read NFR-003 as FR-003', async () => {
    const record = await build(files(STATE, update('{ id: FR-003 }', ''), 'FR-001'));
    expect(record.uncovered).toEqual(['FR-003']);
  });

  it('reports a modified prior requirement that no issue reaches', async () => {
    const record = await build(files(STATE, update('{ id: FR-003 }', '{ id: FR-002 }')));
    expect(record.uncovered).toEqual(['FR-002']);
  });

  // FR-002 stands for a prior requirement the run modified, and no issue reaches it.
  // When the update result does not prove what changed, it must not be able to hide.
  it.each([
    ['absent', undefined],
    ['unparseable', 'update_result: [unclosed\n  changes: {'],
    ['not a record', '- { id: FR-003 }\n'],
    ['empty', ''],
    ['without changes', 'update_result:\n  document: PRD-001\n'],
    ['with changes that are not a record', 'update_result:\n  changes: FR-003\n'],
    ['with an added entry that has no id', update('{ title: Overdue }', '')],
    ['with a modified entry that has no id', update('{ id: FR-003 }', '{ field: priority }')],
    ['with an id that is not a string', update('{ id: 3 }', '')],
    ['with an entry that is not an object', update('FR-003', '')],
    ['with a list that is not a list', 'update_result:\n  changes:\n    added: FR-003\n'],
  ])('keeps every requirement in scope when the update result is %s', async (_name, result) => {
    const record = await build(files(STATE, result));
    expect(record.uncovered).toEqual(['FR-001', 'FR-002']);
  });

  it('keeps every requirement in scope when the update result cannot be read', async () => {
    await write(files(STATE, undefined));
    const record = await buildTraceabilityRecord({
      projectDir: project,
      projectId: 'demo',
      mode: 'enhancement',
      artifacts: [
        ...Object.keys(files(STATE, undefined)),
        `${S}/documents/demo/prd_update_result.yaml`,
      ],
    });
    expect(record.uncovered).toEqual(['FR-001', 'FR-002']);
  });

  it('accepts a well-formed update result with empty lists, and still reports a new requirement', async () => {
    expect((await build(files(STATE, update('', '')))).uncovered).toEqual([]);
    const flat = 'changes:\n  added: []\n  modified: []\n';
    expect((await build(files(STATE, flat))).uncovered).toEqual([]);
    expect((await build(files(STATE, update('', ''), 'FR-001'))).uncovered).toEqual(['FR-003']);
  });

  it('accepts changes that list only what happened', async () => {
    const onlyAdded = 'update_result:\n  changes:\n    added:\n      - { id: FR-003 }\n';
    expect((await build(files(STATE, onlyAdded))).uncovered).toEqual([]);
    const noLists = 'update_result:\n  changes: {}\n';
    expect((await build(files(STATE, noLists))).uncovered).toEqual([]);
  });

  it('keeps a deprecated requirement out of scope, whatever its entry says', async () => {
    const deprecated = [
      'update_result:',
      '  changes:',
      '    added:',
      '      - { id: FR-003 }',
      '    modified: []',
      '    deprecated:',
      '      - { id: FR-002, reason: Replaced }',
      '      - { reason: An entry without an id does not say anything was changed }',
      '',
    ].join('\n');
    expect((await build(files(STATE, deprecated))).uncovered).toEqual([]);
  });

  it('keeps every requirement in scope without the state file', async () => {
    const record = await build(files(undefined, update('{ id: FR-003 }', '')));
    expect(record.uncovered).toEqual(['FR-001', 'FR-002']);
  });

  it('does not apply the scope to Greenfield, whose requirements are all this run', async () => {
    const record = await build(files(STATE, update('{ id: FR-003 }', '')), 'greenfield');
    expect(record.uncovered).toEqual(['FR-001', 'FR-002']);
  });
});

describe('traceability summary', () => {
  const validation = (overrides: Partial<StageResult>): StageResult => ({
    name: 'validation-agent',
    agentType: 'validation-agent',
    status: 'completed',
    durationMs: 1,
    output: '',
    artifacts: [],
    error: null,
    retryCount: 0,
    ...overrides,
  });

  it('is absent when acceptance validation and RTM generation are both off', () => {
    expect(
      summarizeTraceability(
        { ...ALL_ON, generateRtm: false, acceptanceCriteriaValidation: false },
        []
      )
    ).toBeUndefined();
  });

  it('is not_evaluated when final validation did not complete or was not reached', () => {
    expect(summarizeTraceability(ALL_ON, [validation({ status: 'failed' })])).toMatchObject({
      status: 'not_evaluated',
      reason: "Stage 'validation-agent' did not complete (failed)",
      uncovered: [],
    });
    expect(summarizeTraceability(ALL_ON, [])).toMatchObject({
      status: 'not_evaluated',
      reason: expect.stringContaining('was not reached'),
    });
  });

  it('reports coverage counts, the latest record, and the RTM files', async () => {
    const record = await greenfieldRecord();
    const stale = { ...record, uncovered: ['FR-001'] };
    const rtm = { json: `${S}/traceability/s.json`, markdown: `${S}/traceability/s.md` };

    expect(
      summarizeTraceability(
        ALL_ON,
        [validation({ traceability: stale }), validation({ traceability: record })],
        rtm
      )
    ).toEqual({
      status: 'covered',
      stage: 'validation-agent',
      roots: 'prd_requirements',
      uncovered: [],
      untraced: ['ISS-002'],
      counts: { roots: 1, criteria: 1, validatedCriteria: 1 },
      rtm,
    });
  });

  it('is uncovered when the run produced nothing to trace', async () => {
    const record = await buildTraceabilityRecord({
      projectDir: project,
      projectId: 'demo',
      mode: 'import',
      artifacts: [],
    });

    expect(summarizeTraceability(ALL_ON, [validation({ traceability: record })])).toMatchObject({
      status: 'uncovered',
      reason: 'No requirement or issue was found to trace',
    });
  });
});

describe('traceability rules', () => {
  const rule = (checkId: string): VerificationRule =>
    validationRules.find((candidate) => candidate.checkId === checkId)!;
  const context = (extra: Partial<VerificationRuleContext>): VerificationRuleContext => ({
    stageName: 'validation-agent',
    agentType: 'validation-agent',
    pipelineMode: 'greenfield',
    options: ALL_ON,
    ...extra,
  });

  it('skips without V&V options and fails when the record could not be built', async () => {
    const check = rule('VR-VAL-004');

    expect(await check.check([], project, { ...context({}), options: undefined })).toMatchObject({
      passed: true,
      skipReason: 'V&V options not supplied',
    });
    expect(
      await check.check([], project, context({ traceabilityError: 'disk unreadable' }))
    ).toMatchObject({ passed: false, message: 'Traceability could not be built: disk unreadable' });
    expect(await check.check([], project, context({}))).toMatchObject({
      passed: false,
      message: 'No traceability record was built for this stage',
    });
  });

  it('fails when there is nothing to trace and lists uncovered identifiers with reasons', async () => {
    const record = await greenfieldRecord();
    const check = rule('VR-VAL-004');

    expect(
      await check.check(
        [],
        project,
        context({ traceability: { ...record, rtm: { ...record.rtm, entries: [] } } })
      )
    ).toMatchObject({ passed: false, message: 'No PRD requirement found to trace' });

    const many = Array.from({ length: 12 }, (_, index) => `FR-${String(index + 100)}`);
    const failed = await check.check(
      [],
      project,
      context({ traceability: { ...record, uncovered: many } })
    );
    expect(failed.message).toContain('FR-109, and 2 more');
    expect(failed.details?.['uncovered']).toContainEqual({
      id: 'FR-100',
      reason: 'Not implemented and tested',
    });
  });

  it('reports issues that trace to no requirement as a warning, except in Import', async () => {
    const record = await greenfieldRecord();
    const check = rule('VR-VAL-005');

    expect(await check.check([], project, context({ traceability: record }))).toMatchObject({
      passed: false,
      severity: 'warning',
      message: '1 issue(s) trace to no PRD requirement: ISS-002',
    });
    expect(
      await check.check(
        [],
        project,
        context({ traceability: { ...record, roots: 'issue_acceptance_criteria' } })
      )
    ).toMatchObject({ passed: true, skipReason: 'imported issues are the traceability roots' });
  });

  it('skips the consistency check when the project defines no sync points', async () => {
    const consistency = VERIFICATION_CHECK_SETS['srs-document'].find(
      (candidate) => candidate.checkId === 'VR-XDOC-001'
    )!;

    expect(
      await consistency.check([], project, context({ stageName: 'srs_generation' }))
    ).toMatchObject({ passed: true, skipReason: 'no doc-sync-points.yaml in the project' });
    expect(
      await consistency.check([], project, {
        ...context({ stageName: 'srs_generation' }),
        options: undefined,
      })
    ).toMatchObject({ passed: true, skipReason: 'V&V options not supplied' });
  });
});

describe('StageVerifierAgent traceability record', () => {
  const stageResult = (name: StageResult['name']): StageResult => ({
    name,
    agentType: 'validation-agent',
    status: 'completed',
    durationMs: 1,
    output: '',
    artifacts: [],
    error: null,
    retryCount: 0,
  });
  const verify = (name: StageResult['name'], options?: VerificationOptions) =>
    new StageVerifierAgent().verifyStage(name, stageResult(name), {
      projectDir: project,
      projectId: 'demo',
      pipelineMode: 'enhancement',
      rigor: 'standard',
      pipelineId: 'session',
      upstreamArtifacts: Object.keys(GREENFIELD),
      ...(options === undefined ? {} : { options }),
    });

  it('builds the record at final validation from the upstream artifacts', async () => {
    await write(GREENFIELD);

    const result = await verify('validation-agent', ALL_ON);

    expect(result.traceability).toMatchObject({ roots: 'prd_requirements', uncovered: [] });
    expect(result.traceability?.rtm.entries[0]).toMatchObject({
      requirementId: 'FR-001',
      issues: ['ISS-001'],
      workOrders: ['WO-001'],
    });
    expect(result.checks.find((check) => check.checkId === 'VR-VAL-004')?.passed).toBe(true);
  });

  it('builds the record for the RTM alone when acceptance validation is off', async () => {
    await write(GREENFIELD);

    const result = await verify('validation-agent', {
      ...ALL_ON,
      acceptanceCriteriaValidation: false,
    });

    expect(result.traceability).toBeDefined();
    expect(result.checks.find((check) => check.checkId === 'VR-VAL-004')?.skipReason).toBe(
      'disabled by global.vnv.acceptance_criteria_validation'
    );
  });

  it('builds no record without options, with both options off, or at other stages', async () => {
    await write(GREENFIELD);

    expect((await verify('validation-agent')).traceability).toBeUndefined();
    expect(
      (
        await verify('validation-agent', {
          ...ALL_ON,
          generateRtm: false,
          acceptanceCriteriaValidation: false,
        })
      ).traceability
    ).toBeUndefined();
    expect((await verify('implementation', ALL_ON)).traceability).toBeUndefined();
  });
});
