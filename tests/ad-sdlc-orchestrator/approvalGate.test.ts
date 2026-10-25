/**
 * Orchestrator approval gate integration: the real scheduler and gate run
 * every stage of a pipeline, including members of parallel groups. The
 * custom strategy and the unattended pause are exercised directly; agent
 * execution and verification are stubbed so only the approval logic decides.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import type { ApprovalRequest } from '../../src/ad-sdlc-orchestrator/approvalPolicy.js';
import type {
  ApprovalDecision,
  OrchestratorConfig,
  PipelineResult,
  PipelineStageDefinition,
  StageResult,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { resolveRuntimeConfig } from '../../src/config/runtime.js';
import type { EffectiveExecutionPlan } from '../../src/config/runtimeTypes.js';
import type { StageVerificationResult } from '../../src/stage-verifier/types.js';

/** Runs every stage instantly and verifies nothing, so only approval decides. */
class GateOrchestrator extends AdsdlcOrchestratorAgent {
  readonly invoked: string[] = [];
  readonly requests: ApprovalRequest[] = [];
  constructor(
    config: OrchestratorConfig,
    private readonly decide: (request: ApprovalRequest) => boolean = () => true
  ) {
    super({ maxRetries: 0, ...config });
  }
  protected override async invokeAgent(stage: PipelineStageDefinition): Promise<string> {
    this.invoked.push(stage.name);
    return `Stage "${stage.name}" executed`;
  }
  protected override async verifyStage(
    stage: PipelineStageDefinition
  ): Promise<StageVerificationResult> {
    return {
      stageName: stage.name,
      passed: true,
      rigor: 'standard',
      checks: [],
      warnings: [],
      errors: [],
      notApplicableReason: 'Approval gate test',
      timestamp: new Date(0).toISOString(),
      durationMs: 0,
    };
  }
  protected override approveStage(
    _stage: PipelineStageDefinition,
    _prior: readonly StageResult[],
    request?: ApprovalRequest
  ): Promise<ApprovalDecision> {
    if (request === undefined) throw new Error('request missing');
    this.requests.push(request);
    const approved = this.decide(request);
    return Promise.resolve({
      approved,
      reason: approved ? 'Policy bot approved' : `Policy bot rejected ${request.stage.name}`,
      decidedBy: 'system',
      decidedAt: '2026-10-25T00:00:00.000Z',
    });
  }
}

let projectDir: string;
beforeEach(async () => {
  projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-gate-'));
});
afterEach(async () => {
  await fs.rm(projectDir, { recursive: true, force: true });
});

async function execute(
  agent: GateOrchestrator,
  request: Partial<Parameters<AdsdlcOrchestratorAgent['startSession']>[0]> = {}
): Promise<PipelineResult> {
  try {
    await agent.startSession({ projectDir, userRequest: 'Build a todo app', ...request });
    return await agent.executePipeline(projectDir, 'Build a todo app');
  } finally {
    await agent.dispose();
  }
}

const byName = (result: PipelineResult, name: string): StageResult => {
  const found = result.stages.find((stage) => stage.name === name);
  if (found === undefined) throw new Error(`stage ${name} missing`);
  return found;
};

describe('custom approval strategy', () => {
  it('is asked at every boundary, including each member of a parallel group', async () => {
    const agent = new GateOrchestrator({ approvalMode: 'custom' });
    const result = await execute(agent);

    expect(result.overallStatus).toBe('completed');
    expect(agent.requests.map((request) => request.stage.name)).toEqual([
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
      'review',
    ]);
    const issues = agent.requests.find((request) => request.stage.name === 'issue_generation')!;
    expect(issues).toMatchObject({
      mode: 'custom',
      pipelineMode: 'greenfield',
      userRequest: 'Build a todo app',
      boundaries: ['review', 'delivery'],
      effects: ['create_issues'],
      stage: { agentType: 'issue-generator' },
    });
    expect(issues.proposedAction).toContain('it creates GitHub issues');
    expect(issues.scope.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.approval).toMatchObject({
      status: 'approved',
      requested: 12,
      policy: { mode: 'custom', decider: 'callback', source: { kind: 'programmatic' } },
    });
    expect(byName(result, 'threat_modeling').approval).toMatchObject({
      outcome: 'approved',
      basis: 'callback',
      decidedBy: 'system',
      reason: 'Policy bot approved',
    });
  });

  it('rejects one parallel member: siblings run, dependents are skipped, status is rejected', async () => {
    const agent = new GateOrchestrator(
      { approvalMode: 'custom' },
      (request) => request.stage.name !== 'threat_modeling'
    );
    const result = await execute(agent);

    expect(agent.invoked).toContain('ui_spec_generation');
    expect(agent.invoked).toContain('tech_decisions');
    expect(agent.invoked).not.toContain('threat_modeling');
    expect(agent.invoked).not.toContain('issue_generation');
    expect(byName(result, 'threat_modeling')).toMatchObject({
      status: 'skipped',
      error: 'Approval rejected: Policy bot rejected threat_modeling',
      approval: { outcome: 'rejected', basis: 'callback' },
    });
    for (const name of ['issue_generation', 'svp_generation', 'orchestration', 'review'])
      expect(byName(result, name).error).toBe(
        "Skipped: 'threat_modeling' was rejected at its approval gate"
      );
    expect(result.overallStatus).toBe('rejected');
    expect(result.approval?.status).toBe('rejected');
  });
});

describe('pause inside a parallel group', () => {
  it('keeps the records of admitted members so a resumed run can reuse them', async () => {
    const plan = resolveRuntimeConfig({ cli: { mode: 'enhancement', approvalMode: 'critical' } });
    // Two parallel analysis stages: one review-only (policy), one with an effect (requested).
    const stages = plan.stages.map((stage) =>
      stage.name === 'document_reading'
        ? { ...stage, approvalRequired: true }
        : stage.name === 'codebase_analysis'
          ? { ...stage, effects: ['write_outside_project' as const] }
          : stage
    );
    const snapshot: EffectiveExecutionPlan = { ...plan, stages };
    const agent = new GateOrchestrator({ interactive: false });
    const result = await execute(agent, { runtimeSnapshot: snapshot });

    expect(agent.invoked).toEqual([]);
    expect(result.overallStatus).toBe('awaiting_decision');
    expect(byName(result, 'codebase_analysis').approval).toMatchObject({
      outcome: 'pending',
      basis: 'unattended',
      boundaries: ['delivery'],
      effects: ['write_outside_project'],
    });
    expect(byName(result, 'document_reading')).toMatchObject({
      status: 'skipped',
      error: "Skipped: run paused awaiting a decision at 'codebase_analysis'",
      approval: { outcome: 'approved', basis: 'policy' },
    });
    expect(byName(result, 'code_reading').approval).toBeUndefined();
    expect(byName(result, 'doc_code_comparison').error).toBe(
      "Skipped: run paused awaiting a decision at 'codebase_analysis'"
    );
    expect(result.approval).toMatchObject({
      status: 'awaiting_decision',
      policy: { mode: 'critical', interactive: false, source: { kind: 'cli', origin: 'CLI' } },
    });
  });
});

describe('policy source without a runtime snapshot', () => {
  it('reports the orchestrator configuration or the default', async () => {
    const programmatic = await execute(
      new GateOrchestrator({ approvalMode: 'auto', interactive: false }),
      { overrideMode: 'import' }
    );
    expect(programmatic.approval?.policy).toMatchObject({
      mode: 'auto',
      interactive: false,
      source: { kind: 'programmatic', path: 'approvalMode', origin: 'OrchestratorConfig' },
    });
    expect(programmatic.approval?.status).toBe('approved_by_policy');

    const defaulted = await execute(new GateOrchestrator({ interactive: true }), {
      overrideMode: 'import',
    });
    expect(defaulted.approval?.policy.source).toEqual({
      kind: 'default',
      path: 'approvalMode',
      origin: 'default',
    });
  });

  it('pauses a programmatic manual run at the first boundary when it cannot prompt', async () => {
    const agent = new GateOrchestrator({ approvalMode: 'manual', interactive: false });
    const result = await execute(agent, { overrideMode: 'import' });
    expect(agent.invoked).toEqual(['issue_reading']);
    expect(result.overallStatus).toBe('awaiting_decision');
    expect(agent.requests).toEqual([]);
    expect(byName(result, 'orchestration').approval).toMatchObject({
      outcome: 'pending',
      mode: 'manual',
    });
  });
});
