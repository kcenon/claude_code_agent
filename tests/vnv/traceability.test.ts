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
