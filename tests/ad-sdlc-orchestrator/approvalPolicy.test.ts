/**
 * Approval policy matrix and vocabulary: every approval mode against every
 * stage slot of every pipeline mode (with and without local mode), the
 * failed-verification boundary, decision record validation, reuse rules,
 * summary statuses, exit statuses, and runtime snapshot back-fill.
 */
import { describe, expect, it } from 'vitest';

import {
  APPROVAL_MODES,
  agentApprovalEffects,
  approvalPolicySource,
  approvalRequirement,
  approvalScopeFingerprint,
  effectiveApprovalPolicy,
  parseApprovalDecisionRecord,
  reusableApprovalDecision,
  stageApprovalBoundaries,
  stageApprovalEffects,
  summarizePipelineApproval,
  type ApprovalDecisionRecord,
  type ApprovalRequirement,
} from '../../src/ad-sdlc-orchestrator/approvalPolicy.js';
import { approvalPolicyMatrix } from '../../src/ad-sdlc-orchestrator/approvalMatrix.js';
import { buildCanonicalPlan } from '../../src/ad-sdlc-orchestrator/plan.js';
import type {
  ApprovalMode,
  PipelineMode,
  StageName,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { resolveRuntimeConfig } from '../../src/config/runtime.js';
import { parseRuntimeSnapshot } from '../../src/config/runtimeSnapshot.js';
import {
  PIPELINE_EXIT_CODES,
  hasFailedRequiredVerification,
  pipelineExitCode,
} from '../../src/vnv/policy.js';

/** Review boundaries (`approvalRequired`) per pipeline mode, written out independently. */
const REVIEW: Record<PipelineMode, readonly StageName[]> = {
  greenfield: [
    'collection',
    'prd_generation',
    'srs_generation',
    'sdp_generation',
    'github_repo_setup',
    'sds_generation',
    'ui_spec_generation',
    'threat_modeling',
    'tech_decisions',
    'issue_generation',
    'svp_generation',
  ],
  enhancement: ['impact_analysis', 'prd_update', 'srs_update', 'sds_update', 'issue_generation'],
  import: ['orchestration'],
};

/** Delivery boundaries (externally visible effects) per pipeline mode and local mode. */
const DELIVERY: Record<PipelineMode, Record<'github' | 'local', Record<string, string[]>>> = {
  greenfield: {
    github: {
      github_repo_setup: ['create_repository', 'push_branch'],
      issue_generation: ['create_issues'],
      review: ['push_branch', 'open_pull_request', 'merge'],
    },
    local: { issue_generation: ['create_issues'], review: ['merge'] },
  },
  enhancement: {
    github: {
      issue_generation: ['create_issues'],
      review: ['push_branch', 'open_pull_request', 'merge'],
    },
    local: { issue_generation: ['create_issues'], review: ['merge'] },
  },
  import: {
    github: { review: ['push_branch', 'open_pull_request', 'merge'] },
    local: { review: ['merge'] },
  },
};

/** What each mode does at a stage, from the stage's boundaries. */
function expectedDecision(
  mode: ApprovalMode,
  review: boolean,
  delivery: boolean
): ApprovalRequirement | undefined {
  if (!review && !delivery) return undefined;
  if (mode === 'auto') return 'policy';
  if (mode === 'critical') return delivery ? 'request' : 'policy';
  return 'request';
}

describe('approval policy matrix', () => {
  const modes: PipelineMode[] = ['greenfield', 'enhancement', 'import'];

  for (const pipelineMode of modes)
    for (const variant of ['github', 'local'] as const)
      it(`covers every ${pipelineMode} stage in ${variant} mode for every approval mode`, () => {
        const plan = buildCanonicalPlan(pipelineMode, variant === 'local');
        const rows = approvalPolicyMatrix().filter((row) => row.pipelineMode === pipelineMode);
        expect(rows.map((row) => row.stage)).toEqual(
          expect.arrayContaining(plan.map((stage) => stage.name))
        );
        for (const stage of plan) {
          const gate = rows.find((row) => row.stage === stage.name)?.[variant];
          expect(gate, stage.name).toBeDefined();
          const review = REVIEW[pipelineMode].includes(stage.name);
          const effects = DELIVERY[pipelineMode][variant][stage.name] ?? [];
          expect(gate?.effects, stage.name).toEqual(effects);
          expect(gate?.boundaries, stage.name).toEqual([
            ...(review ? ['review'] : []),
            ...(effects.length > 0 ? ['delivery'] : []),
          ]);
          for (const mode of APPROVAL_MODES)
            expect(gate?.decisions[mode], `${mode} ${stage.name}`).toBe(
              expectedDecision(mode, review, effects.length > 0)
            );
        }
      });

  it('gives Import an explicit review boundary and an explicit delivery boundary', () => {
    for (const local of [false, true]) {
      const plan = buildCanonicalPlan('import', local);
      const gated = plan
        .map((stage) => ({ stage: stage.name, boundaries: stageApprovalBoundaries(stage) }))
        .filter((entry) => entry.boundaries.length > 0);
      expect(gated).toEqual([
        { stage: 'orchestration', boundaries: ['review'] },
        { stage: 'review', boundaries: ['delivery'] },
      ]);
    }
    // critical asks only at the delivery boundary; manual at both.
    expect(approvalRequirement('critical', ['review'])).toBe('policy');
    expect(approvalRequirement('critical', ['delivery'])).toBe('request');
    expect(approvalRequirement('manual', ['review'])).toBe('request');
  });

  it('requests a decision after a failed required check in every mode except auto', () => {
    expect(approvalRequirement('auto', ['failed_verification'])).toBe('policy');
    expect(approvalRequirement('manual', ['failed_verification'])).toBe('request');
    expect(approvalRequirement('critical', ['review', 'failed_verification'])).toBe('request');
    expect(approvalRequirement('custom', ['failed_verification'])).toBe('request');
    expect(approvalRequirement('manual', [])).toBeUndefined();
    const stage = buildCanonicalPlan('import').find((entry) => entry.name === 'orchestration')!;
    expect(stageApprovalBoundaries(stage, ['issue_reading'])).toEqual([
      'review',
      'failed_verification',
    ]);
  });

  it('keeps 17 review boundaries: the 16 existing gates plus the Import review boundary', () => {
    const count = modes.flatMap((mode) =>
      buildCanonicalPlan(mode).filter((stage) => stage.approvalRequired)
    ).length;
    expect(count).toBe(17);
  });
});

describe('stage effects', () => {
  it('derives effects from the agent and lets a stage declare its own', () => {
    expect(agentApprovalEffects('pr-reviewer')).toEqual([
      'push_branch',
      'open_pull_request',
      'merge',
    ]);
    expect(agentApprovalEffects('worker')).toEqual([]);
    expect(agentApprovalEffects('constructor')).toEqual([]);
    expect(stageApprovalEffects({ agentType: 'worker' })).toEqual([]);
    expect(
      stageApprovalEffects({ agentType: 'worker', effects: ['write_outside_project'] })
    ).toEqual(['write_outside_project']);
    expect(
      stageApprovalBoundaries({
        agentType: 'custom-agent',
        effects: ['write_outside_project'],
        approvalRequired: false,
      })
    ).toEqual(['delivery']);
  });

  it('records stage effects in the runtime snapshot and back-fills snapshots saved without them', () => {
    const plan = resolveRuntimeConfig({ cli: { mode: 'import' } });
    expect(plan.stages.find((stage) => stage.name === 'review')?.effects).toEqual([
      'push_branch',
      'open_pull_request',
      'merge',
    ]);
    const legacy = {
      ...plan,
      stages: plan.stages.map(({ effects: _effects, ...stage }) => stage),
    };
    const restored = parseRuntimeSnapshot(JSON.parse(JSON.stringify(legacy)), 'legacy.yaml');
    expect(restored.stages).toEqual(plan.stages);
    // Saved effects are kept as saved.
    const custom = {
      ...plan,
      stages: plan.stages.map((stage) =>
        stage.name === 'implementation' ? { ...stage, effects: ['push_branch'] } : stage
      ),
    };
    expect(
      parseRuntimeSnapshot(custom, 'custom.yaml').stages.find(
        (stage) => stage.name === 'implementation'
      )?.effects
    ).toEqual(['push_branch']);
    expect(() =>
      parseRuntimeSnapshot(
        {
          ...plan,
          stages: plan.stages.map((stage) => ({ ...stage, effects: ['deploy'] })),
        },
        'bad.yaml'
      )
    ).toThrow('Invalid or incompatible saved runtime snapshot');
  });
});

describe('approval policy source', () => {
  it('classifies the runtime snapshot source like the verification policy', () => {
    expect(approvalPolicySource(undefined, false)).toEqual({
      kind: 'default',
      path: 'global.approval_mode',
      origin: 'default',
    });
    expect(approvalPolicySource({ source: 'CLI', path: 'global.approval_mode' }, false).kind).toBe(
      'cli'
    );
    expect(
      approvalPolicySource(
        { source: 'environment:AD_SDLC_APPROVAL_MODE', path: 'global.approval_mode' },
        false
      ).kind
    ).toBe('environment');
    expect(
      approvalPolicySource({ source: '/p/workflow.yaml', path: 'global.approval_mode' }, false).kind
    ).toBe('config');
    expect(
      approvalPolicySource({ source: '/p/workflow.yaml', path: 'global.approval_mode' }, true)
    ).toEqual({ kind: 'resume', path: 'global.approval_mode', origin: '/p/workflow.yaml' });
    expect(
      effectiveApprovalPolicy('critical', false, approvalPolicySource(undefined, false))
    ).toEqual({
      mode: 'critical',
      requests: ['delivery', 'failed_verification'],
      decider: 'person',
      interactive: false,
      unattended: 'pause',
      source: { kind: 'default', path: 'global.approval_mode', origin: 'default' },
    });
  });
});

const FINGERPRINT = 'a'.repeat(64);

function record(overrides: Partial<ApprovalDecisionRecord> = {}): ApprovalDecisionRecord {
  return {
    stage: 'orchestration',
    agentType: 'controller',
    sessionId: 'session-1',
    mode: 'manual',
    boundaries: ['review'],
    effects: [],
    proposedAction: 'Run stage "orchestration"',
    scope: {
      fingerprint: FINGERPRINT,
      artifacts: [{ stage: 'issue_reading', paths: ['issues.json'] }],
      findings: [],
    },
    outcome: 'approved',
    basis: 'prompt',
    decidedBy: 'user',
    decidedAt: '2026-10-25T00:00:00.000Z',
    reason: 'Approved by user',
    ...overrides,
  };
}

describe('decision records', () => {
  it('validates persisted records and drops invalid ones', () => {
    const valid = record();
    expect(parseApprovalDecisionRecord(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
    expect(parseApprovalDecisionRecord(undefined)).toBeUndefined();
    expect(
      parseApprovalDecisionRecord({ ...valid, scope: { ...valid.scope, fingerprint: 'x' } })
    ).toBeUndefined();
    expect(parseApprovalDecisionRecord({ ...valid, outcome: 'maybe' })).toBeUndefined();
    expect(parseApprovalDecisionRecord({ ...valid, boundaries: [] })).toBeUndefined();
    expect(parseApprovalDecisionRecord({ ...valid, mode: 'yolo' })).toBeUndefined();
  });

  it('reuses only requested decisions under the same mode and scope fingerprint', () => {
    expect(reusableApprovalDecision(record(), 'manual', FINGERPRINT)).toEqual({
      ...record(),
      reused: true,
    });
    const rejected = record({ outcome: 'rejected', reason: 'No' });
    expect(reusableApprovalDecision(rejected, 'manual', FINGERPRINT)?.outcome).toBe('rejected');
    expect(
      reusableApprovalDecision(record({ basis: 'callback' }), 'manual', FINGERPRINT)
    ).toBeDefined();
    expect(reusableApprovalDecision(record(), 'manual', 'b'.repeat(64))).toBeUndefined();
    expect(reusableApprovalDecision(record(), 'critical', FINGERPRINT)).toBeUndefined();
    expect(
      reusableApprovalDecision(
        record({ outcome: 'pending', basis: 'unattended' }),
        'manual',
        FINGERPRINT
      )
    ).toBeUndefined();
    expect(reusableApprovalDecision(record({ basis: 'policy' }), 'manual', FINGERPRINT)).toBe(
      undefined
    );
    expect(reusableApprovalDecision(undefined, 'manual', FINGERPRINT)).toBeUndefined();
  });

  it('fingerprints the reviewed scope', () => {
    const scope = {
      pipelineMode: 'import' as const,
      stage: 'orchestration' as const,
      agentType: 'controller',
      boundaries: ['review' as const],
      effects: [],
      userRequest: 'Implement login',
      artifacts: [{ stage: 'issue_reading' as const, paths: ['issues.json'], digests: ['d1'] }],
      findings: [],
    };
    const fingerprint = approvalScopeFingerprint(scope);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(approvalScopeFingerprint({ ...scope })).toBe(fingerprint);
    expect(
      approvalScopeFingerprint({
        ...scope,
        artifacts: [{ stage: 'issue_reading', paths: ['issues.json'], digests: ['d2'] }],
      })
    ).not.toBe(fingerprint);
    expect(approvalScopeFingerprint({ ...scope, userRequest: 'Implement logout' })).not.toBe(
      fingerprint
    );
    expect(
      approvalScopeFingerprint({
        ...scope,
        findings: [
          { stage: 'issue_reading', checkId: 'VR', name: 'n', required: true, message: 'm' },
        ],
      })
    ).not.toBe(fingerprint);
  });
});

describe('pipeline approval summary', () => {
  const policy = effectiveApprovalPolicy('manual', true, approvalPolicySource(undefined, false));
  const graph: StageName[] = ['issue_reading', 'orchestration', 'review'];
  const summarize = (results: readonly { name: StageName; approval?: ApprovalDecisionRecord }[]) =>
    summarizePipelineApproval(policy, graph, results);

  it('derives the status from the latest record of every gated stage', () => {
    expect(summarize([{ name: 'issue_reading' }]).status).toBe('not_required');
    expect(
      summarize([{ name: 'orchestration', approval: record({ basis: 'policy' }) }]).status
    ).toBe('approved_by_policy');
    expect(summarize([{ name: 'orchestration', approval: record() }])).toMatchObject({
      status: 'approved',
      counts: { approved: 1, rejected: 0, pending: 0 },
      requested: 1,
    });
    expect(
      summarize([
        { name: 'review', approval: record({ stage: 'review', outcome: 'rejected' }) },
        { name: 'orchestration', approval: record() },
      ])
    ).toMatchObject({ status: 'rejected', counts: { approved: 1, rejected: 1, pending: 0 } });
    const paused = summarize([
      { name: 'orchestration', approval: record({ outcome: 'pending', basis: 'unattended' }) },
      { name: 'orchestration', approval: record() },
    ]);
    // The latest record of a stage wins; decisions follow graph order.
    expect(paused.status).toBe('approved');
    expect(
      summarize([
        { name: 'review', approval: record({ stage: 'review', outcome: 'pending' }) },
        { name: 'orchestration', approval: record() },
      ]).decisions.map((entry) => entry.stage)
    ).toEqual(['orchestration', 'review']);
    expect(summarize([{ name: 'review', approval: record({ outcome: 'pending' }) }]).status).toBe(
      'awaiting_decision'
    );
  });
});

describe('verification and exit vocabulary', () => {
  it('detects a failed required verification without blocking', () => {
    const check = {
      checkId: 'VR',
      name: 'n',
      severity: 'error' as const,
      required: true,
      outcome: 'fail' as const,
      message: 'm',
    };
    expect(hasFailedRequiredVerification(undefined)).toBe(false);
    expect(
      hasFailedRequiredVerification({ stage: 'issue_reading', state: 'failed', checks: [check] })
    ).toBe(true);
    expect(
      hasFailedRequiredVerification({
        stage: 'issue_reading',
        state: 'advisory_findings',
        checks: [check],
      })
    ).toBe(true);
    expect(
      hasFailedRequiredVerification({
        stage: 'issue_reading',
        state: 'advisory_findings',
        checks: [{ ...check, severity: 'warning', required: false }],
      })
    ).toBe(false);
    expect(
      hasFailedRequiredVerification({
        stage: 'issue_reading',
        state: 'advisory_findings',
        reason: 'Stage verifier failed: boom',
        checks: [],
      })
    ).toBe(true);
    expect(
      hasFailedRequiredVerification({ stage: 'issue_reading', state: 'verified_pass', checks: [] })
    ).toBe(false);
  });

  it('maps rejected and paused runs to their own exit statuses', () => {
    expect(PIPELINE_EXIT_CODES).toEqual({
      completed: 0,
      failed: 1,
      rejected: 2,
      awaitingDecision: 3,
    });
    expect(pipelineExitCode({ overallStatus: 'rejected' })).toBe(2);
    expect(pipelineExitCode({ overallStatus: 'awaiting_decision' })).toBe(3);
    expect(
      pipelineExitCode({ overallStatus: 'partial', approval: { status: 'awaiting_decision' } })
    ).toBe(3);
    expect(pipelineExitCode({ overallStatus: 'partial', approval: { status: 'rejected' } })).toBe(
      2
    );
    expect(
      pipelineExitCode({ overallStatus: 'failed', approval: { status: 'awaiting_decision' } })
    ).toBe(1);
    expect(
      pipelineExitCode({
        overallStatus: 'completed',
        verification: { status: 'failed' },
        approval: { status: 'rejected' },
      })
    ).toBe(1);
    expect(
      pipelineExitCode({ overallStatus: 'completed', approval: { status: 'approved_by_policy' } })
    ).toBe(0);
  });
});
