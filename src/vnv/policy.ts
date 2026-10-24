/**
 * Verification policy profiles and result vocabulary.
 *
 * A profile decides what a failed check does; the applicability inventory
 * (`src/stage-verifier/applicability.ts`) decides which checks a stage has;
 * rigor decides which of those checks run. This module turns a stage
 * verifier result into a per-stage state and a pipeline-level status that
 * never reports a failed or unrun check as a verified pass.
 *
 * The vocabulary here is the contract consumed by run results, session and
 * checkpoint state, `ad-sdlc run --format json`, and later traceability and
 * acceptance work. See docs/guides/verification-policy.md.
 *
 * @module vnv/policy
 */

import { z } from 'zod';

import type { PipelineStageStatus, StageName } from '../ad-sdlc-orchestrator/types.js';
import type { StageVerificationResult } from '../stage-verifier/types.js';
import type { CheckSeverity, VerificationProfile, VnvConfig, VnvRigor } from './types.js';

/** Every profile name, in documentation order. */
export const VERIFICATION_PROFILES = ['advisory', 'delivery'] as const satisfies readonly [
  VerificationProfile,
  ...VerificationProfile[],
];

/** What a profile does with a failed required check. */
export interface VerificationProfileDefinition {
  /** A failed required check fails the stage, skips unrun stages, and fails the run. */
  readonly blocking: boolean;
  readonly description: string;
}

/** Profile semantics. Required checks are the error-severity checks of a stage's check set. */
export const VERIFICATION_PROFILE_DEFINITIONS: Readonly<
  Record<VerificationProfile, VerificationProfileDefinition>
> = {
  advisory: {
    blocking: false,
    description:
      'Checks run at the configured rigor. Failures are kept as findings on the stage and in the result, and never stop the pipeline.',
  },
  delivery: {
    blocking: true,
    description:
      'A failed required check fails its stage, skips every stage that has not run, fails the run, and exits with status 1.',
  },
};

/** Severity that makes a check required. Warning and info checks never block. */
export const REQUIRED_CHECK_SEVERITY: CheckSeverity = 'error';

/** Per-stage verification states. */
export const STAGE_VERIFICATION_STATES = [
  'verified_pass',
  'failed',
  'advisory_findings',
  'skipped',
  'not_applicable',
] as const;

/**
 * Per-stage verification state.
 *
 * - `verified_pass`: at least one check ran and every check that ran passed.
 * - `failed`: a required check failed and the profile blocks.
 * - `advisory_findings`: a check failed, but the profile (or the check's
 *   severity) does not block. Never reported as a pass.
 * - `skipped`: no check ran (rigor filter, missing input data, or the stage
 *   did not complete), with the reason.
 * - `not_applicable`: the stage's inventory disposition is not applicable.
 */
export type StageVerificationState = (typeof STAGE_VERIFICATION_STATES)[number];

/** Outcome of one check. `skipped` means the check's condition was not evaluated. */
export type VerificationCheckOutcome = 'pass' | 'fail' | 'skipped';

/**
 * Pipeline-level verification status, computed over the stages that ran.
 *
 * - `verified`: every stage that ran is `verified_pass` or `not_applicable`,
 *   and at least one is `verified_pass`.
 * - `advisory_findings`: a check failed without blocking.
 * - `unverified`: no check failed, but a stage that ran had no check run.
 * - `failed`: a required check failed under a blocking profile.
 */
export type PipelineVerificationStatus = 'verified' | 'advisory_findings' | 'unverified' | 'failed';

/** One check in a stage verification record. */
export interface VerificationCheckRecord {
  readonly checkId: string;
  readonly name: string;
  readonly severity: CheckSeverity;
  /** Error-severity checks are required; only they can block under `delivery`. */
  readonly required: boolean;
  readonly outcome: VerificationCheckOutcome;
  readonly message: string;
  /** Why a `skipped` check did not run */
  readonly skipReason?: string;
}

/** Verification outcome of one stage, persisted on `StageResult.verification`. */
export interface StageVerificationRecord {
  readonly stage: StageName;
  readonly state: StageVerificationState;
  /** Named check set from the applicability inventory */
  readonly checkSet?: string;
  /** Reason for `skipped` and `not_applicable`, or verifier errors without check records */
  readonly reason?: string;
  readonly checks: readonly VerificationCheckRecord[];
}

/** Layer that selected the effective profile. */
export type VerificationPolicySourceKind =
  'default' | 'config' | 'environment' | 'cli' | 'resume' | 'programmatic';

/** Where the effective profile came from. */
export interface VerificationPolicySource {
  readonly kind: VerificationPolicySourceKind;
  /**
   * Property that decided the profile: `global.vnv.profile`, or the legacy
   * `global.vnv.halt_on_verification_failure` mapping.
   */
  readonly path: string;
  /** Layer label from the runtime snapshot: a file path, `environment:NAME`, `CLI`, or `default`. */
  readonly origin: string;
}

/** Profile, rigor, and source in effect for a run. */
export interface EffectiveVerificationPolicy {
  readonly profile: VerificationProfile;
  readonly rigor: VnvRigor;
  readonly blocking: boolean;
  readonly source: VerificationPolicySource;
}

/** Verification summary attached to `PipelineResult.verification`. */
export interface PipelineVerificationSummary {
  readonly policy: EffectiveVerificationPolicy;
  readonly status: PipelineVerificationStatus;
  /** Stage records per state, over every stage of the run's graph */
  readonly counts: Readonly<Record<StageVerificationState, number>>;
  /** Check records per outcome, over every stage */
  readonly checkCounts: Readonly<Record<VerificationCheckOutcome, number>>;
  /** One record per stage of the run's graph, in graph order */
  readonly stages: readonly StageVerificationRecord[];
}

/**
 * Effective profile, with the back-compatibility mapping for configurations
 * that predate profiles: strict rigor plus `haltOnVerificationFailure` is
 * `delivery`; every other combination is `advisory`.
 * @param vnv - Rigor, legacy halt flag, and optional explicit profile
 * @returns Effective profile
 */
export function resolveVerificationProfile(
  vnv: Pick<VnvConfig, 'rigor' | 'haltOnVerificationFailure' | 'profile'>
): VerificationProfile {
  if (vnv.profile !== undefined) return vnv.profile;
  return vnv.rigor === 'strict' && vnv.haltOnVerificationFailure ? 'delivery' : 'advisory';
}

/**
 * Classify a runtime snapshot source label.
 * @param origin - Layer label (`default`, `CLI`, `environment:NAME`, or a file path)
 * @returns Source kind
 */
function sourceKind(origin: string): VerificationPolicySourceKind {
  if (origin === 'default') return 'default';
  if (origin === 'CLI') return 'cli';
  if (origin.startsWith('environment:')) return 'environment';
  return 'config';
}

/**
 * Describe the profile source recorded in a runtime snapshot.
 * @param entry - `sources['global.vnv.profile']` from the snapshot
 * @param resumed - Whether this run resumed a saved session (its policy is reused)
 * @returns Policy source
 */
export function verificationPolicySource(
  entry: { readonly source: string; readonly path: string } | undefined,
  resumed: boolean
): VerificationPolicySource {
  const origin = entry?.source ?? 'default';
  return {
    kind: resumed ? 'resume' : sourceKind(origin),
    path: entry?.path ?? 'global.vnv.profile',
    origin,
  };
}

/**
 * Build the effective policy.
 * @param vnv - Resolved V&V configuration
 * @param source - Where the profile came from
 * @returns Effective policy
 */
export function effectiveVerificationPolicy(
  vnv: Pick<VnvConfig, 'rigor' | 'haltOnVerificationFailure' | 'profile'>,
  source: VerificationPolicySource
): EffectiveVerificationPolicy {
  const profile = resolveVerificationProfile(vnv);
  return {
    profile,
    rigor: vnv.rigor,
    blocking: VERIFICATION_PROFILE_DEFINITIONS[profile].blocking,
    source,
  };
}

/**
 * Turn a stage verifier result into a stage verification record.
 * @param stage - Stage name
 * @param verification - Stage verifier result (real or substituted)
 * @param profile - Effective profile
 * @returns Stage record
 */
export function classifyStageVerification(
  stage: StageName,
  verification: StageVerificationResult,
  profile: VerificationProfile
): StageVerificationRecord {
  const checkSet = verification.checkSet !== undefined ? { checkSet: verification.checkSet } : {};
  if (verification.notApplicableReason !== undefined)
    return {
      stage,
      state: 'not_applicable',
      ...checkSet,
      reason: verification.notApplicableReason,
      checks: [],
    };
  const checks: VerificationCheckRecord[] = [
    ...verification.checks.map((check): VerificationCheckRecord => {
      const base = {
        checkId: check.checkId,
        name: check.name,
        severity: check.severity,
        required: check.severity === REQUIRED_CHECK_SEVERITY,
        message: check.message,
      };
      if (!check.passed) return { ...base, outcome: 'fail' };
      if (check.skipReason !== undefined)
        return { ...base, outcome: 'skipped', skipReason: check.skipReason };
      return { ...base, outcome: 'pass' };
    }),
    ...(verification.skippedRules ?? []).map((rule): VerificationCheckRecord => ({
      checkId: rule.checkId,
      name: rule.name,
      severity: rule.severity,
      required: rule.severity === REQUIRED_CHECK_SEVERITY,
      outcome: 'skipped',
      message: `Not run at ${verification.rigor} rigor`,
      skipReason: `Requires ${rule.minRigor} rigor; the run uses ${verification.rigor}`,
    })),
  ];
  // `passed` is false when a required check failed or the verifier itself failed.
  const requiredFailed = !verification.passed;
  const failedCheck = checks.some((check) => check.outcome === 'fail');
  const verifierErrors =
    requiredFailed && !checks.some((check) => check.outcome === 'fail' && check.required)
      ? { reason: verification.errors.join('; ') || 'Verification did not pass' }
      : {};
  if (requiredFailed || failedCheck)
    return {
      stage,
      state:
        requiredFailed && VERIFICATION_PROFILE_DEFINITIONS[profile].blocking
          ? 'failed'
          : 'advisory_findings',
      ...checkSet,
      ...verifierErrors,
      checks,
    };
  if (!checks.some((check) => check.outcome === 'pass'))
    return {
      stage,
      state: 'skipped',
      ...checkSet,
      reason:
        checks.length === 0
          ? 'The verifier ran no check for this stage'
          : `No check ran: ${[...new Set(checks.map((check) => check.skipReason))].join('; ')}`,
      checks,
    };
  return { stage, state: 'verified_pass', ...checkSet, checks };
}

/** Stage fields the summary reads. */
export interface VerifiedStageResult {
  readonly name: StageName;
  readonly status: PipelineStageStatus;
  readonly error: string | null;
  readonly verification?: StageVerificationRecord;
}

/**
 * Summarize verification over a run's graph.
 * @param policy - Effective policy
 * @param graph - Stage names of the run's graph, in order
 * @param results - Stage results, including pre-completed results restored on resume
 * @param notApplicableReason - Inventory lookup for stages that did not produce a record
 * @returns Pipeline verification summary
 */
export function summarizePipelineVerification(
  policy: EffectiveVerificationPolicy,
  graph: readonly StageName[],
  results: readonly VerifiedStageResult[],
  notApplicableReason: (stage: StageName) => string | undefined
): PipelineVerificationSummary {
  const ran: StageVerificationRecord[] = [];
  const stages = graph.map((stage): StageVerificationRecord => {
    const result = [...results].reverse().find((candidate) => candidate.name === stage);
    const completed = result?.status === 'completed' || result?.status === 'degraded';
    if (result?.verification !== undefined) {
      if (completed || result.verification.state === 'failed') ran.push(result.verification);
      return result.verification;
    }
    const reason = notApplicableReason(stage);
    if (reason !== undefined) return { stage, state: 'not_applicable', reason, checks: [] };
    const record: StageVerificationRecord = {
      stage,
      state: 'skipped',
      reason: completed
        ? 'Stage completed without a verification record (resumed from a session that predates verification records)'
        : `Stage did not complete (${result?.status ?? 'not reached'})${
            result?.error !== undefined && result.error !== null ? `: ${result.error}` : ''
          }`,
      checks: [],
    };
    if (completed) ran.push(record);
    return record;
  });
  const counts = Object.fromEntries(STAGE_VERIFICATION_STATES.map((state) => [state, 0])) as Record<
    StageVerificationState,
    number
  >;
  for (const record of stages) counts[record.state]++;
  const checkCounts: Record<VerificationCheckOutcome, number> = { pass: 0, fail: 0, skipped: 0 };
  for (const record of stages) for (const check of record.checks) checkCounts[check.outcome]++;
  const has = (state: StageVerificationState): boolean =>
    ran.some((record) => record.state === state);
  const status: PipelineVerificationStatus = stages.some((record) => record.state === 'failed')
    ? 'failed'
    : has('advisory_findings')
      ? 'advisory_findings'
      : has('skipped') || !has('verified_pass')
        ? 'unverified'
        : 'verified';
  return { policy, status, counts, checkCounts, stages };
}

/**
 * Process exit status for a finished run: 1 when the run failed or a
 * required check failed under a blocking profile, 0 otherwise. Advisory
 * findings and unverified stages do not change the exit status.
 * @param result - Pipeline status and verification summary
 * @param result.overallStatus - Stage execution status
 * @param result.verification - Verification summary, absent for legacy results
 * @returns Exit status
 */
export function pipelineExitCode(result: {
  readonly overallStatus: string;
  readonly verification?: Pick<PipelineVerificationSummary, 'status'>;
}): 0 | 1 {
  return result.overallStatus === 'failed' || result.verification?.status === 'failed' ? 1 : 0;
}

/** Runtime schema for a persisted stage verification record. */
export const StageVerificationRecordSchema = z.object({
  stage: z.string().min(1),
  state: z.enum(STAGE_VERIFICATION_STATES),
  checkSet: z.string().optional(),
  reason: z.string().optional(),
  checks: z.array(
    z.object({
      checkId: z.string().min(1),
      name: z.string(),
      severity: z.enum(['error', 'warning', 'info']),
      required: z.boolean(),
      outcome: z.enum(['pass', 'fail', 'skipped']),
      message: z.string(),
      skipReason: z.string().optional(),
    })
  ),
});

/**
 * Validate a persisted record. Invalid data is dropped, so the stage is
 * reported as `skipped` (no verification record) rather than trusted.
 * @param value - Persisted value
 * @returns Record, or undefined when absent or invalid
 */
export function parseStageVerificationRecord(value: unknown): StageVerificationRecord | undefined {
  const parsed = StageVerificationRecordSchema.safeParse(value);
  return parsed.success ? (parsed.data as StageVerificationRecord) : undefined;
}
