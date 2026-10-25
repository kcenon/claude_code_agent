/**
 * Policy matrix: profile x check outcome x required/optional -> stage state,
 * pipeline verification status, and process exit status.
 */
import { describe, expect, it } from 'vitest';

import {
  classifyStageVerification,
  effectiveVerificationPolicy,
  parseStageVerificationRecord,
  pipelineExitCode,
  resolveVerificationProfile,
  summarizePipelineVerification,
  verificationPolicySource,
  type StageVerificationRecord,
  type StageVerificationState,
  type VerifiedStageResult,
} from '../../src/vnv/policy.js';
import type { VerificationProfile } from '../../src/vnv/types.js';
import type { StageVerificationResult, VerificationCheck } from '../../src/stage-verifier/types.js';

function check(severity: VerificationCheck['severity'], outcome: 'pass' | 'fail' | 'skipped') {
  return {
    checkId: `VR-T-${severity}`,
    name: `${severity} check`,
    category: 'content' as const,
    severity,
    passed: outcome !== 'fail',
    message: `${severity} ${outcome}`,
    ...(outcome === 'skipped' ? { skipReason: 'input data absent' } : {}),
  };
}

function verifierResult(overrides: Partial<StageVerificationResult>): StageVerificationResult {
  const checks = overrides.checks ?? [];
  return {
    stageName: 'implementation',
    passed: !checks.some((c) => !c.passed && c.severity === 'error'),
    rigor: 'standard',
    checks,
    warnings: [],
    errors: checks.filter((c) => !c.passed && c.severity === 'error').map((c) => c.message),
    timestamp: new Date(0).toISOString(),
    durationMs: 0,
    checkSet: 'implementation-results',
    ...overrides,
  };
}

/** Each case is one check outcome for a stage; `required` means error severity. */
const OUTCOMES: Record<string, StageVerificationResult> = {
  'pass, required': verifierResult({ checks: [check('error', 'pass')] }),
  'pass, optional': verifierResult({ checks: [check('warning', 'pass')] }),
  'fail, required': verifierResult({ checks: [check('error', 'fail')] }),
  'fail, optional': verifierResult({ checks: [check('error', 'pass'), check('warning', 'fail')] }),
  'skipped by the rule, required': verifierResult({ checks: [check('error', 'skipped')] }),
  'skipped by rigor, required': verifierResult({
    checks: [],
    skippedRules: [
      { checkId: 'VR-T', name: 'strict check', severity: 'error', minRigor: 'strict' },
    ],
  }),
  'not applicable': verifierResult({
    checks: [],
    checkSet: undefined,
    notApplicableReason: 'Routing decision only',
  }),
  'verifier failure without checks': verifierResult({
    passed: false,
    errors: ['Stage verifier failed: boom'],
  }),
};

type Expectation = [StageVerificationState, string, 0 | 1];
const MATRIX: Record<string, Record<VerificationProfile, Expectation>> = {
  'pass, required': {
    advisory: ['verified_pass', 'verified', 0],
    delivery: ['verified_pass', 'verified', 0],
  },
  'pass, optional': {
    advisory: ['verified_pass', 'verified', 0],
    delivery: ['verified_pass', 'verified', 0],
  },
  'fail, required': {
    advisory: ['advisory_findings', 'advisory_findings', 0],
    delivery: ['failed', 'failed', 1],
  },
  'fail, optional': {
    advisory: ['advisory_findings', 'advisory_findings', 0],
    delivery: ['advisory_findings', 'advisory_findings', 0],
  },
  'skipped by the rule, required': {
    advisory: ['skipped', 'unverified', 0],
    delivery: ['skipped', 'unverified', 0],
  },
  'skipped by rigor, required': {
    advisory: ['skipped', 'unverified', 0],
    delivery: ['skipped', 'unverified', 0],
  },
  'not applicable': {
    advisory: ['not_applicable', 'unverified', 0],
    delivery: ['not_applicable', 'unverified', 0],
  },
  'verifier failure without checks': {
    advisory: ['advisory_findings', 'advisory_findings', 0],
    delivery: ['failed', 'failed', 1],
  },
};

const POLICY_SOURCE = { kind: 'default', path: 'global.vnv.profile', origin: 'default' } as const;

describe('verification policy matrix', () => {
  for (const [name, verification] of Object.entries(OUTCOMES))
    for (const profile of ['advisory', 'delivery'] as const)
      it(`${name} under ${profile}`, () => {
        const [state, status, exitCode] = MATRIX[name]![profile];
        const record = classifyStageVerification('implementation', verification, profile);
        expect(record.state).toBe(state);
        // A failed check is never reported as a verified pass.
        if (record.checks.some((c) => c.outcome === 'fail'))
          expect(record.state).not.toBe('verified_pass');
        const stageStatus = state === 'failed' ? 'failed' : 'completed';
        const summary = summarizePipelineVerification(
          effectiveVerificationPolicy(
            { rigor: 'standard', haltOnVerificationFailure: false, profile },
            POLICY_SOURCE
          ),
          ['implementation'],
          [{ name: 'implementation', status: stageStatus, error: null, verification: record }],
          () => undefined
        );
        expect(summary.status).toBe(status);
        expect(summary.counts[state]).toBe(1);
        // The orchestrator fails the run exactly when a stage verification failed.
        const overallStatus = summary.status === 'failed' ? 'failed' : 'completed';
        expect(pipelineExitCode({ overallStatus, verification: summary })).toBe(exitCode);
      });

  it('records required flags, outcomes, and skip reasons per check', () => {
    const record = classifyStageVerification(
      'implementation',
      verifierResult({
        checks: [check('error', 'pass'), check('warning', 'fail'), check('error', 'skipped')],
        skippedRules: [
          { checkId: 'VR-S', name: 'strict only', severity: 'warning', minRigor: 'strict' },
        ],
      }),
      'delivery'
    );
    expect(record).toMatchObject({
      state: 'advisory_findings',
      checkSet: 'implementation-results',
    });
    expect(record.checks.map((c) => [c.required, c.outcome, c.skipReason])).toEqual([
      [true, 'pass', undefined],
      [false, 'fail', undefined],
      [true, 'skipped', 'input data absent'],
      [false, 'skipped', 'Requires strict rigor; the run uses standard'],
    ]);
  });

  it('reports a verifier error as the reason when no failing check explains it', () => {
    const record = classifyStageVerification(
      'implementation',
      OUTCOMES['verifier failure without checks']!,
      'delivery'
    );
    expect(record.reason).toBe('Stage verifier failed: boom');
  });

  it('treats a pipeline-level failed verification as a failing exit even if stages completed', () => {
    expect(
      pipelineExitCode({ overallStatus: 'completed', verification: { status: 'failed' } })
    ).toBe(1);
    expect(pipelineExitCode({ overallStatus: 'failed' })).toBe(1);
    expect(pipelineExitCode({ overallStatus: 'partial' })).toBe(0);
    expect(
      pipelineExitCode({
        overallStatus: 'completed',
        verification: { status: 'advisory_findings' },
      })
    ).toBe(0);
  });
});

describe('pipeline verification summary', () => {
  const policy = effectiveVerificationPolicy(
    { rigor: 'standard', haltOnVerificationFailure: false, profile: 'delivery' },
    POLICY_SOURCE
  );
  const pass: StageVerificationRecord = {
    stage: 'issue_reading',
    state: 'verified_pass',
    checks: [
      {
        checkId: 'X',
        name: 'x',
        severity: 'error',
        required: true,
        outcome: 'pass',
        message: 'ok',
      },
    ],
  };
  const failed: StageVerificationRecord = {
    stage: 'implementation',
    state: 'failed',
    checks: [
      {
        checkId: 'Y',
        name: 'y',
        severity: 'error',
        required: true,
        outcome: 'fail',
        message: 'no',
      },
    ],
  };

  it('lists stages that did not run as skipped or not_applicable, outside the status', () => {
    const results: VerifiedStageResult[] = [
      { name: 'issue_reading', status: 'completed', error: null, verification: pass },
      {
        name: 'implementation',
        status: 'failed',
        error: 'Verification failed',
        verification: failed,
      },
      { name: 'review', status: 'skipped', error: 'Skipped: verification gate failed' },
    ];
    const summary = summarizePipelineVerification(
      policy,
      ['issue_reading', 'implementation', 'doc_indexing', 'review'],
      results,
      (stage) => (stage === 'doc_indexing' ? 'Index built after review' : undefined)
    );
    expect(summary.status).toBe('failed');
    expect(summary.stages.map((s) => s.state)).toEqual([
      'verified_pass',
      'failed',
      'not_applicable',
      'skipped',
    ]);
    expect(summary.stages[3]?.reason).toBe(
      'Stage did not complete (skipped): Skipped: verification gate failed'
    );
    expect(summary.checkCounts).toEqual({ pass: 1, fail: 1, skipped: 0 });
  });

  it('is verified when every stage that ran passed, even if later stages were not reached', () => {
    const summary = summarizePipelineVerification(
      policy,
      ['issue_reading', 'orchestration'],
      [{ name: 'issue_reading', status: 'completed', error: null, verification: pass }],
      () => undefined
    );
    expect(summary.status).toBe('verified');
    expect(summary.stages[1]).toMatchObject({
      state: 'skipped',
      reason: 'Stage did not complete (not reached)',
    });
  });

  it('is unverified when a completed stage has no verification record', () => {
    const summary = summarizePipelineVerification(
      policy,
      ['issue_reading', 'orchestration'],
      [
        { name: 'issue_reading', status: 'completed', error: null, verification: pass },
        { name: 'orchestration', status: 'completed', error: null },
      ],
      () => undefined
    );
    expect(summary.status).toBe('unverified');
    expect(summary.stages[1]?.reason).toContain('without a verification record');
  });
});

describe('profile resolution and sources', () => {
  it.each([
    ['strict', true, undefined, 'delivery'],
    ['strict', false, undefined, 'advisory'],
    ['standard', true, undefined, 'advisory'],
    ['minimal', false, undefined, 'advisory'],
    ['strict', true, 'advisory', 'advisory'],
    ['minimal', false, 'delivery', 'delivery'],
  ] as const)('rigor %s + halt %s + profile %s -> %s', (rigor, halt, profile, expected) => {
    expect(
      resolveVerificationProfile({
        rigor,
        haltOnVerificationFailure: halt,
        ...(profile === undefined ? {} : { profile }),
      })
    ).toBe(expected);
  });

  it('classifies snapshot source labels and marks resumed runs', () => {
    expect(verificationPolicySource(undefined, false)).toEqual({
      kind: 'default',
      path: 'global.vnv.profile',
      origin: 'default',
    });
    expect(
      verificationPolicySource({ source: 'CLI', path: 'global.vnv.profile' }, false).kind
    ).toBe('cli');
    expect(
      verificationPolicySource(
        { source: 'environment:AD_SDLC_VNV_PROFILE', path: 'global.vnv.profile' },
        false
      ).kind
    ).toBe('environment');
    expect(
      verificationPolicySource(
        {
          source: '/p/.ad-sdlc/config/workflow.yaml',
          path: 'global.vnv.halt_on_verification_failure',
        },
        false
      )
    ).toEqual({
      kind: 'config',
      path: 'global.vnv.halt_on_verification_failure',
      origin: '/p/.ad-sdlc/config/workflow.yaml',
    });
    expect(verificationPolicySource({ source: 'CLI', path: 'global.vnv.profile' }, true)).toEqual({
      kind: 'resume',
      path: 'global.vnv.profile',
      origin: 'CLI',
    });
  });

  it('accepts only valid persisted stage records', () => {
    const record: StageVerificationRecord = {
      stage: 'review',
      state: 'skipped',
      reason: 'x',
      checks: [],
    };
    expect(parseStageVerificationRecord(record)).toEqual(record);
    expect(parseStageVerificationRecord({ ...record, state: 'passed' })).toBeUndefined();
    expect(parseStageVerificationRecord(undefined)).toBeUndefined();
  });
});
