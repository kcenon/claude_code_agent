/**
 * RtmBuilderAgent over real files: manifest-located sources, the formats the
 * agent definitions write, per-criterion implementation and test evidence,
 * and mode-specific roots (#952).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { PipelineMode } from '../../src/ad-sdlc-orchestrator/types.js';
import { issueAcceptanceCriteria } from '../../src/rtm-builder/issueCriteria.js';
import { RtmBuilderAgent } from '../../src/rtm-builder/RtmBuilderAgent.js';
import { RequirementsTraceabilityMatrixSchema } from '../../src/rtm-builder/schemas.js';
import type { RtmSourceLocations } from '../../src/rtm-builder/types.js';
import { uncoveredTraceIds } from '../../src/vnv/traceability.js';

const S = '.ad-sdlc/scratchpad';
const PRD = `${S}/documents/demo/prd.md`;
const SRS = `${S}/documents/demo/srs.md`;
const SDS = `${S}/documents/demo/sds.md`;
const ISSUES = `${S}/issues/demo/issue_list.json`;
const WO = `${S}/progress/demo/work_orders/WO-001.yaml`;
const RESULT = `${S}/progress/demo/results/WO-001-result.yaml`;

let project: string;
beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'rtm-sources-'));
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

/** Implementation result YAML in the worker's documented format. */
function result(options: {
  readonly status?: string;
  readonly testsPassed?: boolean;
  readonly evidence?: string[] | null;
}): string {
  const lines = [
    'implementation_result:',
    '  work_order_id: WO-001',
    '  issue_id: ISS-001',
    `  status: ${options.status ?? 'completed'}`,
    '  changes:',
    '    - file_path: src/auth.ts',
    '      change_type: create',
    '  verification:',
    `    tests_passed: ${String(options.testsPassed ?? true)}`,
    '    build_passed: true',
  ];
  if (options.evidence !== null)
    lines.push('  acceptance_criteria:', ...(options.evidence ?? []).map((line) => `    ${line}`));
  return [...lines, ''].join('\n');
}

const sources = (extra: Partial<RtmSourceLocations> = {}): RtmSourceLocations => ({
  documents: { prd: PRD, srs: SRS, sds: SDS },
  issueLists: [ISSUES],
  workOrders: [WO],
  implementationResults: [RESULT],
  reviews: [],
  ...extra,
});

async function build(mode: PipelineMode, located: RtmSourceLocations | undefined = sources()) {
  const rtm = await new RtmBuilderAgent().buildRTM({
    projectDir: project,
    projectId: 'demo',
    pipelineMode: mode,
    ...(located === undefined ? {} : { sources: located }),
  });
  expect(RequirementsTraceabilityMatrixSchema.safeParse(rtm).success).toBe(true);
  return rtm;
}

/** PRD → SRS → SDS → issue → work order → result chain with one orphan issue. */
async function writeDocumentChain(evidence: string[]): Promise<void> {
  await write({
    [PRD]: [
      '# PRD',
      '## FR-001: Login',
      'Priority: P0',
      '### Acceptance Criteria',
      '- AC-001: Users sign in',
      '## FR-002: Export',
      'Priority: P2',
      '',
    ].join('\n'),
    [SRS]: '# SRS\n## SF-001: Login\nImplements FR-001 through UC-001.\n',
    [SDS]: '# SDS\n## CMP-001: Auth service\nRealizes SF-001.\n',
    [ISSUES]: JSON.stringify({
      issues: [
        {
          id: 'ISS-001',
          title: 'Implement login',
          labels: { priority: 'P0' },
          traceability: { sds_component: 'CMP-001', prd_requirement: 'FR-001' },
          body: '## Acceptance Criteria\n- [ ] Signs in\n- [ ] Rejects a bad password',
        },
        { id: 'ISS-003', title: 'Add logging', body: '## Acceptance Criteria\n- [ ] Logs' },
      ],
    }),
    [WO]: 'work_order:\n  id: WO-001\n  issue:\n    id: ISS-001\n',
    [RESULT]: result({ evidence }),
    'src/auth.ts': 'export {};\n',
    'tests/auth.test.ts': 'export {};\n',
    'tests/password.test.ts': 'export {};\n',
  });
}

describe.each<PipelineMode>(['greenfield', 'enhancement'])('%s document chain', (mode) => {
  it('links requirements forward to issues, work orders, changed files, and tests', async () => {
    await writeDocumentChain([
      '- id: AC-001',
      '  status: met',
      '  tests: [tests/auth.test.ts]',
      '- id: AC-002',
      '  status: met',
    ]);

    const rtm = await build(mode);
    const [login, exportEntry] = rtm.entries;

    expect(login).toMatchObject({
      requirementId: 'FR-001',
      features: ['SF-001'],
      useCases: ['UC-001'],
      components: ['CMP-001'],
      issues: ['ISS-001'],
      workOrders: ['WO-001'],
      implementations: [{ workOrderId: 'WO-001', status: 'completed', testsPassed: true }],
      status: 'implemented',
    });
    expect(login?.acceptanceCriteria).toEqual([
      { id: 'AC-001', description: 'Users sign in', validated: false },
      {
        id: 'AC-001',
        description: 'Signs in',
        issueId: 'ISS-001',
        validated: true,
        validationMethod: 'automated-test',
        implemented: true,
        workOrders: ['WO-001'],
        changedFiles: ['src/auth.ts'],
        tests: ['tests/auth.test.ts'],
      },
      {
        id: 'AC-002',
        description: 'Rejects a bad password',
        issueId: 'ISS-001',
        validated: false,
        implemented: true,
        workOrders: ['WO-001'],
        changedFiles: ['src/auth.ts'],
        tests: [],
        uncoveredReason: 'No test is linked to the criterion',
      },
    ]);
    expect(exportEntry).toMatchObject({
      requirementId: 'FR-002',
      issues: [],
      status: 'not_started',
    });

    // Forward: the untested criterion and the unimplemented requirement.
    expect(uncoveredTraceIds(rtm)).toEqual(['ISS-001/AC-002', 'FR-002']);
    // Backward: the issue that traces to no requirement.
    expect(rtm.gaps).toContainEqual(
      expect.objectContaining({ type: 'orphan_issue', affectedIds: ['ISS-003'] })
    );
  });

  it('validates the PRD criteria once every criterion of the linked issues is tested', async () => {
    await writeDocumentChain([
      '- id: AC-001',
      '  status: met',
      '  tests: [tests/auth.test.ts]',
      '- id: ac-2',
      '  status: passed',
      '  tests: [tests/password.test.ts]',
    ]);

    const [login] = (await build(mode)).entries;

    expect(login?.status).toBe('verified');
    expect(login?.acceptanceCriteria[0]).toMatchObject({
      id: 'AC-001',
      validated: true,
      validationMethod: 'issue-acceptance-tests',
    });
    expect(login?.acceptanceCriteria.every((criterion) => criterion.validated)).toBe(true);
  });
});

describe('Import roots', () => {
  beforeEach(async () => {
    await write({
      // Planted documents that Import must not read or imply.
      'docs/PRD.md': '# PRD\n## FR-001: Unrelated\n',
      [PRD]: '# PRD\n## FR-009: Unrelated\n',
      [ISSUES]: JSON.stringify({
        issues: [
          { id: 'ISS-001', title: 'Login', body: '## Acceptance Criteria\n- [ ] Signs in' },
          { id: 'ISS-002', title: 'Logout', body: 'No criteria stated.' },
        ],
      }),
      [WO]: 'work_order:\n  id: WO-001\n  issue:\n    id: ISS-001\n',
      [RESULT]: result({
        evidence: ['- id: AC-001', '  status: met', '  tests: [tests/auth.test.ts]'],
      }),
      'tests/auth.test.ts': 'export {};\n',
    });
  });

  it.each([
    ['explicit sources', sources({ documents: {} })],
    ['conventional discovery', undefined],
  ])('traces imported issues without upstream documents (%s)', async (_label, located) => {
    const rtm = await build('import', located);

    expect(rtm.entries.map((entry) => entry.requirementId)).toEqual(['ISS-001', 'ISS-002']);
    expect(rtm.entries.every((entry) => entry.features.length === 0)).toBe(true);
    expect(rtm.entries[0]).toMatchObject({ status: 'verified', workOrders: ['WO-001'] });
    expect(rtm.gaps.map((gap) => gap.type)).not.toContain('uncovered_requirement');
    expect(rtm.gaps.map((gap) => gap.type)).not.toContain('orphan_issue');
    expect(uncoveredTraceIds(rtm)).toEqual(['ISS-002']);
  });
});

describe('uncovered criterion reasons', () => {
  const issue = JSON.stringify({
    issues: [{ id: 'ISS-001', title: 'Login', body: '## Acceptance Criteria\n- [ ] Signs in' }],
  });

  it.each<[string, Record<string, string>, string]>([
    ['no work order or result', {}, 'No work order or implementation result covers the issue'],
    [
      'a result that is not completed',
      {
        [WO]: 'work_order:\n  id: WO-001\n  issue_id: ISS-001\n',
        [RESULT]: result({ status: 'failed' }),
      },
      'No implementation result of the issue reports status completed',
    ],
    [
      'a result without an evidence list',
      { [RESULT]: result({ evidence: null }) },
      'The implementation result reports no acceptance criteria evidence',
    ],
    [
      'evidence for other criteria only',
      { [RESULT]: result({ evidence: ['- id: AC-009', '  status: met'] }) },
      'The implementation result does not report this criterion',
    ],
    [
      'a criterion reported as not met',
      { [RESULT]: result({ evidence: ['- id: AC-001', '  status: not_met'] }) },
      'The implementation result reports the criterion as not met',
    ],
    [
      'failing tests',
      {
        [RESULT]: result({
          testsPassed: false,
          evidence: ['- id: AC-001', '  status: met', '  tests: [tests/auth.test.ts]'],
        }),
        'tests/auth.test.ts': 'export {};\n',
      },
      'The implementation result does not report passing tests',
    ],
    [
      'a test file outside the project',
      {
        [RESULT]: result({
          evidence: ['- id: AC-001', '  status: met', '  tests: [../outside.test.ts]'],
        }),
      },
      'Linked test file not found: ../outside.test.ts',
    ],
  ])('%s', async (_label, files, reason) => {
    await write({ [ISSUES]: issue, ...files });

    const rtm = await build('import', sources({ documents: {} }));

    expect(rtm.entries[0]?.acceptanceCriteria[0]).toMatchObject({
      id: 'AC-001',
      validated: false,
      uncoveredReason: reason,
    });
    expect(uncoveredTraceIds(rtm)).toEqual(['ISS-001/AC-001']);
  });
});

describe('issueAcceptanceCriteria', () => {
  it('numbers body criteria by position and keeps explicit identifiers', () => {
    expect(
      issueAcceptanceCriteria({
        body: [
          '## Description',
          '- not a criterion',
          '## Acceptance Criteria',
          '- [x] Signs in',
          '- AC-007: Locks after five failures',
          '1. Logs the attempt',
          '## Notes',
          '- not a criterion',
        ].join('\n'),
      })
    ).toEqual([
      { id: 'AC-001', description: 'Signs in' },
      { id: 'AC-007', description: 'Locks after five failures' },
      { id: 'AC-003', description: 'Logs the attempt' },
    ]);
  });

  it('prefers a structured list of strings or objects', () => {
    expect(
      issueAcceptanceCriteria({
        acceptance_criteria: ['Signs in', { id: 'ac-2', description: 'Signs out' }, {}],
        body: '## Acceptance Criteria\n- ignored',
      })
    ).toEqual([
      { id: 'AC-001', description: 'Signs in' },
      { id: 'AC-002', description: 'Signs out' },
      { id: 'AC-003', description: 'AC-003' },
    ]);
  });

  it('finds none when the issue states none', () => {
    expect(issueAcceptanceCriteria({ body: 'Make logout work.' })).toEqual([]);
    expect(issueAcceptanceCriteria({ acceptance_criteria: [] })).toEqual([]);
  });
});
