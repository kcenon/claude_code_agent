/**
 * Verification applicability inventory: every stage slot of every mode has a
 * disposition, and a stage added without one fails the inventory check.
 */
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_STAGE_GRAPHS,
  VERIFICATION_APPLICABILITY,
  checkVerificationInventory,
  renderVerificationCoverageBlock,
  replaceVerificationCoverageBlock,
  verificationCheckSet,
  verificationCoverage,
  verificationDisposition,
  type VerificationApplicabilityTable,
} from '../../src/stage-verifier/applicability.js';
import { VERIFICATION_CHECK_SETS, VERIFICATION_RULES } from '../../src/stage-verifier/rules.js';
import { buildCanonicalPlan } from '../../src/ad-sdlc-orchestrator/plan.js';
import type { PipelineMode } from '../../src/ad-sdlc-orchestrator/types.js';

const MODES: PipelineMode[] = ['greenfield', 'enhancement', 'import'];

describe('verification applicability inventory', () => {
  it('classifies every stage slot of every canonical and local graph', () => {
    expect(checkVerificationInventory()).toEqual([]);
    for (const mode of MODES)
      for (const local of [false, true])
        for (const stage of buildCanonicalPlan(mode, local)) {
          const disposition = verificationDisposition(mode, stage.name);
          expect(disposition, `${mode}/${stage.name}`).toBeDefined();
          if (disposition?.kind === 'checks')
            expect(verificationCheckSet(disposition.checkSet)?.length).toBeGreaterThan(0);
          else expect(disposition?.reason.length).toBeGreaterThan(20);
        }
  });

  it('fails when a stage is added to a mode graph without a disposition', () => {
    const graphs = {
      ...CANONICAL_STAGE_GRAPHS,
      import: [...CANONICAL_STAGE_GRAPHS.import, { name: 'deployment' }],
    };

    expect(checkVerificationInventory(graphs)).toEqual([
      expect.objectContaining({
        code: 'missing_disposition',
        mode: 'import',
        stage: 'deployment',
      }),
    ]);
  });

  it('reports unknown check sets, missing reasons, and stale entries', () => {
    const table = {
      ...VERIFICATION_APPLICABILITY,
      import: {
        ...VERIFICATION_APPLICABILITY.import,
        orchestration: { kind: 'checks', checkSet: 'invented' },
        review: { kind: 'not_applicable', reason: ' ' },
        retired_stage: { kind: 'not_applicable', reason: 'Removed long ago.' },
      },
    } as unknown as VerificationApplicabilityTable;

    expect(checkVerificationInventory(CANONICAL_STAGE_GRAPHS, table).map((v) => v.code)).toEqual([
      'unknown_check_set',
      'missing_reason',
      'stale_disposition',
    ]);
  });

  it('covers every Import slot and the delivery stages of Greenfield and Enhancement', () => {
    expect(verificationCoverage()).toEqual([
      { mode: 'greenfield', stageSlots: 19, checkSetSlots: 9, notApplicableSlots: 10 },
      { mode: 'enhancement', stageSlots: 15, checkSetSlots: 9, notApplicableSlots: 6 },
      { mode: 'import', stageSlots: 5, checkSetSlots: 5, notApplicableSlots: 0 },
    ]);
    for (const mode of ['greenfield', 'enhancement'] as const)
      for (const stage of ['issue_generation', 'implementation', 'validation-agent', 'review'])
        expect(verificationDisposition(mode, stage)?.kind).toBe('checks');
    expect(verificationDisposition('enhancement', 'regression_testing')?.kind).toBe('checks');
  });

  it('keeps the stage-name compatibility map identical to the inventory', () => {
    for (const mode of MODES)
      for (const stage of CANONICAL_STAGE_GRAPHS[mode]) {
        const disposition = verificationDisposition(mode, stage.name);
        expect(VERIFICATION_RULES.get(stage.name)).toBe(
          disposition?.kind === 'checks' ? VERIFICATION_CHECK_SETS[disposition.checkSet] : undefined
        );
      }
  });

  it('uses unique check identifiers within each check set', () => {
    for (const rules of Object.values(VERIFICATION_CHECK_SETS)) {
      const ids = rules.map((rule) => rule.checkId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('renders and replaces the generated coverage block', () => {
    const block = renderVerificationCoverageBlock();
    expect(block).toContain('| import | 5 | 5 | 0 |');
    expect(block).toContain('| import | `issue_reading` | checks | `imported-issues` |');
    expect(block).toContain(
      '| `imported-issues` | VR-IRD-003 | Every issue states acceptance criteria | error | standard |'
    );
    const document = replaceVerificationCoverageBlock(
      'intro\n<!-- generated-verification-coverage:start -->\nold\n<!-- generated-verification-coverage:end -->\noutro\n'
    );
    expect(document).toBe(`intro\n${block}\noutro\n`);
    expect(() => replaceVerificationCoverageBlock('no markers')).toThrow('markers');
  });
});
