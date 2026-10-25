/**
 * Approval policy and decision record vocabulary.
 *
 * A stage has an approval boundary when it is a review point of the stage
 * graph (`approvalRequired`), when it has an externally visible effect
 * (`effects`, a delivery boundary), or when a stage it depends on failed a
 * required verification check without blocking. The approval mode decides
 * which of those boundaries request a decision and which are approved by
 * policy. Every boundary that is reached produces a decision record.
 *
 * The vocabulary mirrors the verification policy (`src/vnv/policy.ts`): an
 * effective policy with its source, per-stage records on
 * `StageResult.approval`, and a pipeline summary on `PipelineResult.approval`.
 * It is the contract consumed by run results, session and checkpoint state,
 * `ad-sdlc run --format json`, and later acceptance work. See
 * docs/guides/approval-policy.md.
 *
 * @module ad-sdlc-orchestrator/approvalPolicy
 */

import { z } from 'zod';

import { metadataHash } from '../execution/artifacts/schemas.js';
import { policySourceKind, type VerificationPolicySourceKind } from '../vnv/policy.js';
import type { ApprovalMode, PipelineMode, PipelineStageDefinition, StageName } from './types.js';

/** Every approval mode, in documentation order. */
export const APPROVAL_MODES = ['auto', 'manual', 'critical', 'custom'] as const satisfies readonly [
  ApprovalMode,
  ...ApprovalMode[],
];

/** Kinds of approval boundaries. */
export const APPROVAL_BOUNDARIES = ['review', 'delivery', 'failed_verification'] as const;

/**
 * Why a stage is a decision point.
 *
 * - `review`: the stage graph marks it as a review point (`approvalRequired`);
 *   the decision covers the planning output it consumes.
 * - `delivery`: the stage has an externally visible effect.
 * - `failed_verification`: a stage it depends on failed a required check
 *   without blocking (advisory profile).
 */
export type ApprovalBoundary = (typeof APPROVAL_BOUNDARIES)[number];

/** Meaning of each boundary kind. */
export const APPROVAL_BOUNDARY_DESCRIPTIONS: Readonly<Record<ApprovalBoundary, string>> = {
  review: 'The stage graph marks the stage as a review point for the planning output it consumes.',
  delivery: 'The stage has an externally visible effect.',
  failed_verification:
    'A stage it depends on failed a required verification check without blocking (advisory profile).',
};

/** Externally visible effects a stage can have. */
export const APPROVAL_EFFECTS = [
  'create_repository',
  'create_issues',
  'push_branch',
  'open_pull_request',
  'merge',
  'write_outside_project',
] as const;

/** One externally visible effect. */
export type ApprovalEffect = (typeof APPROVAL_EFFECTS)[number];

/** Meaning of each effect, phrased to follow "the stage". */
export const APPROVAL_EFFECT_DESCRIPTIONS: Readonly<Record<ApprovalEffect, string>> = {
  create_repository: 'creates a GitHub repository',
  create_issues: 'creates GitHub issues',
  push_branch: 'pushes a branch to the remote repository',
  open_pull_request: 'opens a pull request',
  merge: 'merges changes into the target branch (a pull request merge, or a local merge)',
  write_outside_project: 'writes outside the project directory',
};

/**
 * Externally visible effects of each stage agent, from its checked-in
 * definition (`.claude/agents/<agent>.md`). Agents that are not listed write
 * only inside the project directory. `issue-generator` keeps its GitHub tools
 * in local mode, so its effect is declared there too. No canonical agent
 * declares `write_outside_project`; a programmatic stage definition can.
 */
export const AGENT_APPROVAL_EFFECTS: Readonly<Record<string, readonly ApprovalEffect[]>> = {
  'github-repo-setup': ['create_repository', 'push_branch'],
  'issue-generator': ['create_issues'],
  'pr-reviewer': ['push_branch', 'open_pull_request', 'merge'],
  'local-reviewer': ['merge'],
};

/**
 * Declared effects of an agent.
 * @param agentType - Stage agent
 * @returns Effects, empty for agents without externally visible effects
 */
export function agentApprovalEffects(agentType: string): readonly ApprovalEffect[] {
  return Object.hasOwn(AGENT_APPROVAL_EFFECTS, agentType)
    ? (AGENT_APPROVAL_EFFECTS[agentType] ?? [])
    : [];
}

/**
 * Effects of a stage: its declared `effects`, else those of its agent.
 * @param stage - Stage definition
 * @returns Effects
 */
export function stageApprovalEffects(
  stage: Pick<PipelineStageDefinition, 'agentType' | 'effects'>
): readonly ApprovalEffect[] {
  return stage.effects ?? agentApprovalEffects(stage.agentType);
}

/**
 * Boundaries of a stage.
 * @param stage - Stage definition
 * @param failedVerificationDependencies - Direct dependencies with a failed required check
 * @returns Boundaries in {@link APPROVAL_BOUNDARIES} order; empty when the stage has no gate
 */
export function stageApprovalBoundaries(
  stage: Pick<PipelineStageDefinition, 'agentType' | 'effects' | 'approvalRequired'>,
  failedVerificationDependencies: readonly StageName[] = []
): ApprovalBoundary[] {
  const boundaries: ApprovalBoundary[] = [];
  if (stage.approvalRequired) boundaries.push('review');
  if (stageApprovalEffects(stage).length > 0) boundaries.push('delivery');
  if (failedVerificationDependencies.length > 0) boundaries.push('failed_verification');
  return boundaries;
}

/** Who answers a requested decision. */
export type ApprovalDecider = 'none' | 'person' | 'callback';

/** What a mode does at each boundary. */
export interface ApprovalModeDefinition {
  /** Boundaries at which the mode requests a decision; every other boundary is approved by policy. */
  readonly requests: readonly ApprovalBoundary[];
  readonly decider: ApprovalDecider;
  readonly description: string;
}

/** Mode semantics. */
export const APPROVAL_MODE_DEFINITIONS: Readonly<Record<ApprovalMode, ApprovalModeDefinition>> = {
  auto: {
    requests: [],
    decider: 'none',
    description:
      'Autonomous profile and the CLI default. No decision is requested: every boundary is approved by policy and recorded.',
  },
  manual: {
    requests: ['review', 'delivery', 'failed_verification'],
    decider: 'person',
    description: 'A person decides at every boundary.',
  },
  critical: {
    requests: ['delivery', 'failed_verification'],
    decider: 'person',
    description:
      'A person decides before every externally visible effect and after a failed required check. Review boundaries are approved by policy.',
  },
  custom: {
    requests: ['review', 'delivery', 'failed_verification'],
    decider: 'callback',
    description:
      'The programmatic approveStage strategy decides at every boundary; the default strategy approves. Not available in the CLI.',
  },
};

/** How a boundary is decided: by policy, or by a requested decision. */
export type ApprovalRequirement = 'policy' | 'request';

/**
 * Whether a mode requests a decision at a set of boundaries.
 * @param mode - Approval mode
 * @param boundaries - Boundaries of the stage
 * @returns `request`, `policy`, or undefined when the stage has no boundary
 */
export function approvalRequirement(
  mode: ApprovalMode,
  boundaries: readonly ApprovalBoundary[]
): ApprovalRequirement | undefined {
  if (boundaries.length === 0) return undefined;
  const requests = APPROVAL_MODE_DEFINITIONS[mode].requests;
  return boundaries.some((boundary) => requests.includes(boundary)) ? 'request' : 'policy';
}

/** Layer that selected the approval mode (same kinds as the verification policy). */
export type ApprovalPolicySourceKind = VerificationPolicySourceKind;

/** Where the effective approval mode came from. */
export interface ApprovalPolicySource {
  readonly kind: ApprovalPolicySourceKind;
  /** Property that decided the mode: `global.approval_mode`, or `approvalMode` for the API. */
  readonly path: string;
  /** Layer label: a file path, `environment:NAME`, `CLI`, `OrchestratorConfig`, or `default`. */
  readonly origin: string;
}

/**
 * Describe the approval mode source recorded in a runtime snapshot.
 * @param entry - `sources['global.approval_mode']` from the snapshot
 * @param resumed - Whether this run resumed a saved session (its policy is reused)
 * @returns Policy source
 */
export function approvalPolicySource(
  entry: { readonly source: string; readonly path: string } | undefined,
  resumed: boolean
): ApprovalPolicySource {
  const origin = entry?.source ?? 'default';
  return {
    kind: resumed ? 'resume' : policySourceKind(origin),
    path: entry?.path ?? 'global.approval_mode',
    origin,
  };
}

/** What a requested decision does when nobody can answer it: the run pauses. */
export const UNATTENDED_APPROVAL_BEHAVIOR = 'pause' as const;

/** Mode, interaction, and source in effect for a run. */
export interface EffectiveApprovalPolicy {
  readonly mode: ApprovalMode;
  readonly requests: readonly ApprovalBoundary[];
  readonly decider: ApprovalDecider;
  /** Whether a requested decision can be answered at a terminal prompt in this run. */
  readonly interactive: boolean;
  /** Behavior of a requested decision that nobody can answer. */
  readonly unattended: typeof UNATTENDED_APPROVAL_BEHAVIOR;
  readonly source: ApprovalPolicySource;
}

/**
 * Build the effective policy.
 * @param mode - Approval mode
 * @param interactive - Whether terminal prompts are possible
 * @param source - Where the mode came from
 * @returns Effective policy
 */
export function effectiveApprovalPolicy(
  mode: ApprovalMode,
  interactive: boolean,
  source: ApprovalPolicySource
): EffectiveApprovalPolicy {
  const definition = APPROVAL_MODE_DEFINITIONS[mode];
  return {
    mode,
    requests: definition.requests,
    decider: definition.decider,
    interactive,
    unattended: UNATTENDED_APPROVAL_BEHAVIOR,
    source,
  };
}

/** Outcomes of a decision record. */
export const APPROVAL_OUTCOMES = ['approved', 'rejected', 'pending'] as const;

/** Outcome; `pending` means a decision was requested and nobody could answer it. */
export type ApprovalOutcome = (typeof APPROVAL_OUTCOMES)[number];

/** How a record was decided. */
export const APPROVAL_BASES = ['policy', 'prompt', 'callback', 'unattended'] as const;

/**
 * - `policy`: the mode does not request a decision at these boundaries.
 * - `prompt`: a person answered the terminal prompt.
 * - `callback`: the custom `approveStage` strategy decided.
 * - `unattended`: a decision was requested without an interactive terminal (outcome `pending`).
 */
export type ApprovalBasis = (typeof APPROVAL_BASES)[number];

/** A completed upstream stage whose output is part of the reviewed scope. */
export interface ApprovalArtifactReference {
  readonly stage: StageName;
  /** Manifest identifier (content digest), absent for results without a manifest */
  readonly manifest?: string;
  /** Project-relative artifact paths */
  readonly paths: readonly string[];
}

/** A failed verification check of an upstream stage, shown in the decision request. */
export interface ApprovalFinding {
  readonly stage: StageName;
  readonly checkId: string;
  readonly name: string;
  readonly required: boolean;
  readonly message: string;
}

/** What a decision covers. */
export interface ApprovalScope {
  /**
   * SHA-256 over the stage identity, pipeline mode, boundaries, effects, user
   * request, upstream artifacts (manifest identifiers, or file digests for
   * results without a manifest), and findings. A resumed run reuses a
   * decision only for the same fingerprint.
   */
  readonly fingerprint: string;
  readonly artifacts: readonly ApprovalArtifactReference[];
  readonly findings: readonly ApprovalFinding[];
}

/** Content of a decision request; shown in the terminal and passed to a custom strategy. */
export interface ApprovalRequest {
  readonly sessionId: string;
  readonly mode: ApprovalMode;
  readonly pipelineMode: PipelineMode;
  readonly localMode: boolean;
  readonly stage: {
    readonly name: StageName;
    readonly agentType: string;
    readonly description: string;
    readonly dependsOn: readonly StageName[];
  };
  /** The concrete input of the run */
  readonly userRequest: string;
  readonly boundaries: readonly ApprovalBoundary[];
  readonly effects: readonly ApprovalEffect[];
  /** The next action the decision allows */
  readonly proposedAction: string;
  readonly scope: ApprovalScope;
}

/** Durable decision for one stage, persisted on `StageResult.approval`. */
export interface ApprovalDecisionRecord {
  readonly stage: StageName;
  readonly agentType: string;
  readonly sessionId: string;
  readonly mode: ApprovalMode;
  readonly boundaries: readonly ApprovalBoundary[];
  readonly effects: readonly ApprovalEffect[];
  readonly proposedAction: string;
  readonly scope: ApprovalScope;
  readonly outcome: ApprovalOutcome;
  readonly basis: ApprovalBasis;
  readonly decidedBy: 'system' | 'user';
  readonly decidedAt: string;
  /** Rejection reason, approval note, or why the run paused */
  readonly reason: string;
  /** Set when a resumed run reused this decision instead of requesting a new one */
  readonly reused?: boolean;
}

/**
 * Fingerprint of a reviewed scope.
 * @param input - Scope content
 * @param input.pipelineMode - Pipeline mode
 * @param input.stage - Stage name
 * @param input.agentType - Stage agent
 * @param input.boundaries - Boundaries
 * @param input.effects - Effects
 * @param input.userRequest - User request
 * @param input.artifacts - Upstream artifacts; `digests` are file digests for results without a manifest
 * @param input.findings - Failed checks shown in the request
 * @returns SHA-256 hex digest
 */
export function approvalScopeFingerprint(input: {
  readonly pipelineMode: PipelineMode;
  readonly stage: StageName;
  readonly agentType: string;
  readonly boundaries: readonly ApprovalBoundary[];
  readonly effects: readonly ApprovalEffect[];
  readonly userRequest: string;
  readonly artifacts: readonly (ApprovalArtifactReference & {
    readonly digests?: readonly string[];
  })[];
  readonly findings: readonly ApprovalFinding[];
}): string {
  return metadataHash({ version: 1, ...input });
}

/**
 * A prior decision a resumed run may reuse: one that a person or the custom
 * strategy made (approved or rejected) under the same mode for the same
 * scope fingerprint. Policy approvals are re-derived, and pending records are
 * not decisions.
 * @param prior - Latest record saved for the stage
 * @param mode - Current approval mode
 * @param fingerprint - Current scope fingerprint
 * @returns The reusable record, marked `reused`, or undefined
 */
export function reusableApprovalDecision(
  prior: ApprovalDecisionRecord | undefined,
  mode: ApprovalMode,
  fingerprint: string
): ApprovalDecisionRecord | undefined {
  if (
    prior === undefined ||
    prior.outcome === 'pending' ||
    (prior.basis !== 'prompt' && prior.basis !== 'callback') ||
    prior.mode !== mode ||
    prior.scope.fingerprint !== fingerprint
  )
    return undefined;
  return { ...prior, reused: true };
}

/** Pipeline-level approval statuses. */
export const PIPELINE_APPROVAL_STATUSES = [
  'not_required',
  'approved_by_policy',
  'approved',
  'rejected',
  'awaiting_decision',
] as const;

/**
 * Pipeline-level approval status over the stages of the run.
 *
 * - `not_required`: no stage that was reached has a boundary.
 * - `approved_by_policy`: every boundary reached was approved by policy; no decision was requested.
 * - `approved`: at least one decision was requested, and every decision approved.
 * - `rejected`: a decision rejected a stage.
 * - `awaiting_decision`: the run paused at a requested decision nobody could answer.
 */
export type PipelineApprovalStatus = (typeof PIPELINE_APPROVAL_STATUSES)[number];

/** Approval summary attached to `PipelineResult.approval`. */
export interface PipelineApprovalSummary {
  readonly policy: EffectiveApprovalPolicy;
  readonly status: PipelineApprovalStatus;
  readonly counts: Readonly<Record<ApprovalOutcome, number>>;
  /** Records decided by a person or the custom strategy, or requested without an answer */
  readonly requested: number;
  /** The latest record of every stage that reached a boundary, in graph order */
  readonly decisions: readonly ApprovalDecisionRecord[];
}

/**
 * Summarize approval over a run's graph.
 * @param policy - Effective policy
 * @param graph - Stage names of the run's graph, in order
 * @param results - Stage results, including pre-completed results restored on resume
 * @returns Pipeline approval summary
 */
export function summarizePipelineApproval(
  policy: EffectiveApprovalPolicy,
  graph: readonly StageName[],
  results: readonly { readonly name: StageName; readonly approval?: ApprovalDecisionRecord }[]
): PipelineApprovalSummary {
  const decisions = graph.flatMap((stage) => {
    const record = [...results]
      .reverse()
      .find((result) => result.name === stage && result.approval !== undefined)?.approval;
    return record === undefined ? [] : [record];
  });
  const counts: Record<ApprovalOutcome, number> = { approved: 0, rejected: 0, pending: 0 };
  for (const record of decisions) counts[record.outcome]++;
  const requested = decisions.filter((record) => record.basis !== 'policy').length;
  const status: PipelineApprovalStatus =
    counts.pending > 0
      ? 'awaiting_decision'
      : counts.rejected > 0
        ? 'rejected'
        : requested > 0
          ? 'approved'
          : decisions.length > 0
            ? 'approved_by_policy'
            : 'not_required';
  return { policy, status, counts, requested, decisions };
}

const digest = z.string().regex(/^[a-f0-9]{64}$/u);

/** Runtime schema for a persisted decision record. */
export const ApprovalDecisionRecordSchema = z.object({
  stage: z.string().min(1),
  agentType: z.string().min(1),
  sessionId: z.string().min(1),
  mode: z.enum(APPROVAL_MODES),
  boundaries: z.array(z.enum(APPROVAL_BOUNDARIES)).min(1),
  effects: z.array(z.enum(APPROVAL_EFFECTS)),
  proposedAction: z.string(),
  scope: z.object({
    fingerprint: digest,
    artifacts: z.array(
      z.object({
        stage: z.string().min(1),
        manifest: digest.optional(),
        paths: z.array(z.string()),
      })
    ),
    findings: z.array(
      z.object({
        stage: z.string().min(1),
        checkId: z.string().min(1),
        name: z.string(),
        required: z.boolean(),
        message: z.string(),
      })
    ),
  }),
  outcome: z.enum(APPROVAL_OUTCOMES),
  basis: z.enum(APPROVAL_BASES),
  decidedBy: z.enum(['system', 'user']),
  decidedAt: z.string().min(1),
  reason: z.string(),
  reused: z.boolean().optional(),
});

/**
 * Validate a persisted record. Session and checkpoint files are untrusted, so
 * invalid data is dropped and the stage requests a new decision.
 * @param value - Persisted value
 * @returns Record, or undefined when absent or invalid
 */
export function parseApprovalDecisionRecord(value: unknown): ApprovalDecisionRecord | undefined {
  const parsed = ApprovalDecisionRecordSchema.safeParse(value);
  return parsed.success ? (parsed.data as ApprovalDecisionRecord) : undefined;
}
