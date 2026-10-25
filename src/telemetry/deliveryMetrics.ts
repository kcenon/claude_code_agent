/**
 * Delivery metrics event schema (#956).
 *
 * Versioned records of one execution attempt, one stage, and one pipeline run.
 * Outcomes reuse the run vocabulary: stage records carry `PipelineStageStatus`,
 * pipeline records carry `PipelineStatus` and the `PIPELINE_EXIT_CODES` exit
 * status, and the verification and approval summaries are projections of the
 * #951 and #953 records, not re-derivations. Attempt records add the
 * attempt-level outcomes `timed_out` and `cancelled`, which are not stage
 * statuses.
 *
 * Token fields are `null` when the SDK did not report them: unknown is never
 * written as a measured 0. Records carry identifiers, timestamps, enums,
 * counts, and tool and model names only. They never contain prompts,
 * requirement text, error messages, approval reasons, proposed actions,
 * paths, or credentials; every schema is strict, so a record with any other
 * field is rejected before it is written. See docs/guides/delivery-metrics.md.
 *
 * @module telemetry/deliveryMetrics
 */

import { z } from 'zod';

import type { UsageMetrics } from '../execution/types.js';
import { ManifestReferenceSchema } from '../execution/artifacts/schemas.js';
import {
  APPROVAL_BASES,
  APPROVAL_BOUNDARIES,
  APPROVAL_EFFECTS,
  APPROVAL_MODES,
  APPROVAL_OUTCOMES,
} from '../ad-sdlc-orchestrator/approvalPolicy.js';
import { STAGE_VERIFICATION_STATES } from '../vnv/policy.js';

/** Version of every record kind in this module. */
export const DELIVERY_METRICS_SCHEMA_VERSION = 1 as const;

/** Usage sources, in documentation order (see `UsageSource`). */
export const USAGE_SOURCES = ['result', 'partial', 'recovered', 'none'] as const;

/**
 * Outcome of one execution attempt.
 *
 * - `succeeded`: the adapter returned success (the stage can still fail
 *   verification afterwards; see the stage record).
 * - `failed`: the execution failed (SDK error result, thrown error, artifact
 *   contract failure, cleanup failure).
 * - `timed_out`: the attempt's stage timer fired.
 * - `cancelled`: the pipeline was cancelled or disposed during the attempt.
 */
export const ATTEMPT_OUTCOMES = ['succeeded', 'failed', 'timed_out', 'cancelled'] as const;

/** One of {@link ATTEMPT_OUTCOMES}. */
export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number];

/**
 * How an attempt reached its result.
 *
 * - `sdk`: the SDK adapter ran and reported execution metrics.
 * - `recovered`: resume reused a committed manifest; no SDK call was made.
 * - `unobserved`: no execution metrics were reported (an adapter or agent
 *   override without metrics, or cancellation before the adapter returned).
 */
export const ATTEMPT_EXECUTIONS = ['sdk', 'recovered', 'unobserved'] as const;

/** One of {@link ATTEMPT_EXECUTIONS}. */
export type AttemptExecution = (typeof ATTEMPT_EXECUTIONS)[number];

/** `PipelineStageStatus` values. */
export const STAGE_STATUSES = [
  'pending',
  'running',
  'completed',
  'degraded',
  'failed',
  'skipped',
] as const;

/** `PipelineStatus` values. */
export const PIPELINE_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'partial',
  'rejected',
  'awaiting_decision',
] as const;

/** How a resumed run restored its session. */
export const RESUME_SOURCES = ['checkpoint', 'session'] as const;

/** One of {@link RESUME_SOURCES}. */
export type ResumeSource = (typeof RESUME_SOURCES)[number];

/** Verification and approval policy source kinds (`VerificationPolicySourceKind`). */
const POLICY_SOURCE_KINDS = [
  'default',
  'config',
  'environment',
  'cli',
  'resume',
  'programmatic',
] as const;

const count = z.number().int().nonnegative();
const tokens = count.nullable();
const timestamp = z.iso.datetime();
const identifier = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[\w.:-]+$/u);
/** Model identifiers keep provider prefixes and context suffixes such as `[1m]`. */
const modelIdentifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[\w.:@/[\]-]+$/u);
const version = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[0-9A-Za-z.+-]+$/u);

/**
 * Exhaustive counts keyed by an enum: every key is required, no other key is allowed.
 * @param values - Enum values
 * @returns Record schema
 */
function countsOf<const T extends readonly [string, ...string[]]>(
  values: T
): z.ZodRecord<z.ZodEnum<{ [K in T[number]]: K }>, z.ZodNumber> {
  return z.record(z.enum(values), count);
}

/** Token usage; every field is `null` when unknown. */
export const UsageMetricsSchema = z
  .object({
    inputTokens: tokens,
    outputTokens: tokens,
    cacheReadInputTokens: tokens,
    cacheCreationInputTokens: tokens,
    source: z.enum(USAGE_SOURCES),
  })
  .strict() satisfies z.ZodType<UsageMetrics>;

/** Invocations per tool name. */
const toolUses = z.record(identifier, count);

/** Projection of a #951 `StageVerificationRecord`: state and check counts, no messages. */
export const StageVerificationProjectionSchema = z
  .object({
    state: z.enum(STAGE_VERIFICATION_STATES),
    checkSet: identifier.nullable(),
    checks: countsOf(['pass', 'fail', 'skipped']),
    /** Failed checks of error severity (the checks a `delivery` profile blocks on). */
    requiredFailed: count,
  })
  .strict();
export type StageVerificationProjection = z.infer<typeof StageVerificationProjectionSchema>;

/** Projection of a #953 `ApprovalDecisionRecord`: no reason, proposed action, or scope. */
export const StageApprovalProjectionSchema = z
  .object({
    outcome: z.enum(APPROVAL_OUTCOMES),
    basis: z.enum(APPROVAL_BASES),
    boundaries: z.array(z.enum(APPROVAL_BOUNDARIES)),
    effects: z.array(z.enum(APPROVAL_EFFECTS)),
    decidedBy: z.enum(['system', 'user']),
    reused: z.boolean(),
  })
  .strict();
export type StageApprovalProjection = z.infer<typeof StageApprovalProjectionSchema>;

/** Projection of a #951 `PipelineVerificationSummary`. */
export const PipelineVerificationProjectionSchema = z
  .object({
    status: z.enum(['verified', 'advisory_findings', 'unverified', 'failed']),
    profile: z.enum(['advisory', 'delivery']),
    rigor: z.enum(['minimal', 'standard', 'strict']),
    blocking: z.boolean(),
    source: z.enum(POLICY_SOURCE_KINDS),
    counts: countsOf(STAGE_VERIFICATION_STATES),
    checkCounts: countsOf(['pass', 'fail', 'skipped']),
  })
  .strict();
export type PipelineVerificationProjection = z.infer<typeof PipelineVerificationProjectionSchema>;

/** Projection of a #953 `PipelineApprovalSummary`. */
export const PipelineApprovalProjectionSchema = z
  .object({
    status: z.enum([
      'not_required',
      'approved_by_policy',
      'approved',
      'rejected',
      'awaiting_decision',
    ]),
    mode: z.enum(APPROVAL_MODES),
    source: z.enum(POLICY_SOURCE_KINDS),
    counts: countsOf(APPROVAL_OUTCOMES),
    byBasis: countsOf(APPROVAL_BASES),
    requested: count,
    /** Decisions a resumed run reused instead of requesting again. */
    reused: count,
  })
  .strict();
export type PipelineApprovalProjection = z.infer<typeof PipelineApprovalProjectionSchema>;

const common = {
  schemaVersion: z.literal(DELIVERY_METRICS_SCHEMA_VERSION),
  recordedAt: timestamp,
  /** Pipeline session (`PipelineResult.pipelineId`); a resumed session keeps it. */
  sessionId: identifier,
  /** One `executePipeline` call; every run of a resumed session has its own. */
  runId: identifier,
};

/** One execution attempt of a stage. */
export const AttemptMetricsRecordSchema = z
  .object({
    ...common,
    kind: z.literal('attempt'),
    stage: identifier,
    agentType: identifier,
    /** 0 for the first attempt of the stage in this run. */
    retryIndex: count,
    /** `ArtifactContext.attemptId`, the same identity as the attempt's artifact manifest. */
    attemptId: identifier.nullable(),
    sdkSessionId: identifier.nullable(),
    /** The attempt asked the SDK to resume a saved SDK session. */
    sdkResume: z.boolean(),
    startedAt: timestamp,
    endedAt: timestamp,
    durationMs: count,
    outcome: z.enum(ATTEMPT_OUTCOMES),
    /** Error code or class name; never the message. */
    errorType: identifier.nullable(),
    execution: z.enum(ATTEMPT_EXECUTIONS),
    usage: UsageMetricsSchema,
    turnCount: count.nullable(),
    toolUseCount: count.nullable(),
    toolUses,
    modelId: modelIdentifier.nullable(),
    models: z.array(modelIdentifier),
    sdkVersion: version.nullable(),
    claudeCodeVersion: version.nullable(),
    manifest: ManifestReferenceSchema.nullable(),
  })
  .strict();
export type AttemptMetricsRecord = z.infer<typeof AttemptMetricsRecordSchema>;

/** One stage of one run. */
export const StageMetricsRecordSchema = z
  .object({
    ...common,
    kind: z.literal('stage'),
    stage: identifier,
    agentType: identifier,
    status: z.enum(STAGE_STATUSES),
    /** Restored from an earlier run of the session on resume; not executed in this run. */
    restored: z.boolean(),
    durationMs: count,
    retryCount: count,
    attempts: z.object({ total: count, byOutcome: countsOf(ATTEMPT_OUTCOMES) }).strict(),
    /** Sum over this run's attempts of the stage; null when the stage made no attempt. */
    usage: UsageMetricsSchema.nullable(),
    turnCount: count.nullable(),
    toolUseCount: count.nullable(),
    toolUses,
    errorType: identifier.nullable(),
    verification: StageVerificationProjectionSchema.nullable(),
    approval: StageApprovalProjectionSchema.nullable(),
    manifest: ManifestReferenceSchema.nullable(),
  })
  .strict();
export type StageMetricsRecord = z.infer<typeof StageMetricsRecordSchema>;

/** One pipeline run. */
export const PipelineMetricsRecordSchema = z
  .object({
    ...common,
    kind: z.literal('pipeline'),
    mode: z.enum(['greenfield', 'enhancement', 'import']),
    status: z.enum(PIPELINE_STATUSES),
    /** `PIPELINE_EXIT_CODES`: 0 completed, 1 failed, 2 rejected, 3 awaiting decision. */
    exitCode: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    startedAt: timestamp,
    endedAt: timestamp,
    durationMs: count,
    resume: z
      .object({
        resumed: z.boolean(),
        source: z.enum(RESUME_SOURCES).nullable(),
        /** Status the session was saved with before this run resumed it. */
        priorStatus: z.enum(PIPELINE_STATUSES).nullable(),
      })
      .strict(),
    stages: z
      .object({ total: count, restored: count, byStatus: countsOf(STAGE_STATUSES) })
      .strict(),
    attempts: z
      .object({ total: count, retries: count, byOutcome: countsOf(ATTEMPT_OUTCOMES) })
      .strict(),
    /** Sum over this run's attempts, including failed, retried, and cancelled ones; null without attempts. */
    usage: UsageMetricsSchema.nullable(),
    turnCount: count.nullable(),
    toolUseCount: count.nullable(),
    toolUses,
    models: z.array(modelIdentifier),
    sdkVersion: version.nullable(),
    /** Installed `ad-sdlc` package version. */
    packageVersion: version.nullable(),
    verification: PipelineVerificationProjectionSchema.nullable(),
    approval: PipelineApprovalProjectionSchema.nullable(),
    /** Error code or class name when the run ended with an unexpected error. */
    errorType: identifier.nullable(),
  })
  .strict();
export type PipelineMetricsRecord = z.infer<typeof PipelineMetricsRecordSchema>;

/** Any delivery metrics record, discriminated by `kind`. */
export const DeliveryMetricsRecordSchema = z.discriminatedUnion('kind', [
  AttemptMetricsRecordSchema,
  StageMetricsRecordSchema,
  PipelineMetricsRecordSchema,
]);
export type DeliveryMetricsRecord = z.infer<typeof DeliveryMetricsRecordSchema>;

/**
 * Validate a record read from an export.
 * @param value - Parsed JSON value
 * @returns The record, or the first validation failure
 */
export function parseDeliveryMetricsRecord(
  value: unknown
):
  | { readonly ok: true; readonly record: DeliveryMetricsRecord }
  | { readonly ok: false; readonly reason: string } {
  const parsed = DeliveryMetricsRecordSchema.safeParse(value);
  if (parsed.success) return { ok: true, record: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    reason:
      issue === undefined
        ? 'Invalid delivery metrics record'
        : `${issue.path.map(String).join('.') || '(record)'}: ${issue.message}`,
  };
}
