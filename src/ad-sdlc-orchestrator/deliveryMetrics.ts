/**
 * Delivery metrics records of one pipeline run (#956).
 *
 * The scheduler reports every execution attempt; the orchestrator pairs it
 * with the SDK observations the adapter returned for that attempt and, when
 * the run ends, adds one record per stage and one per run. Stage and pipeline
 * records project the #951 verification and #953 approval records instead of
 * deriving outcomes again. Records go to `PipelineResult.metrics` and, when
 * configured, to a sink (the local JSONL export). A sink failure is logged and
 * counted; it never changes the run. See docs/guides/delivery-metrics.md.
 */

import { AppError } from '../errors/AppError.js';
import { getLogger } from '../logging/index.js';
import type { ManifestReference } from '../execution/artifacts/schemas.js';
import type { ExecutionMetrics, UsageMetrics } from '../execution/types.js';
import { addCounts, installedSdkVersion, unobservedExecutionMetrics } from '../execution/usage.js';
import {
  ATTEMPT_OUTCOMES,
  DELIVERY_METRICS_SCHEMA_VERSION,
  DeliveryMetricsRecordSchema,
  STAGE_STATUSES,
  type AttemptExecution,
  type AttemptMetricsRecord,
  type AttemptOutcome,
  type DeliveryMetricsRecord,
  type PipelineApprovalProjection,
  type PipelineMetricsRecord,
  type PipelineVerificationProjection,
  type StageApprovalProjection,
  type StageMetricsRecord,
  type StageVerificationProjection,
} from '../telemetry/deliveryMetrics.js';
import type {
  DeliveryMetricsConsentStatus,
  DeliveryMetricsSink,
  DeliveryMetricsSummary,
} from '../telemetry/deliveryMetricsExport.js';
import { readPackageVersion } from '../utils/packageVersion.js';
import {
  pipelineExitCode,
  type PipelineVerificationSummary,
  type StageVerificationRecord,
} from '../vnv/policy.js';
import {
  APPROVAL_BASES,
  type ApprovalDecisionRecord,
  type PipelineApprovalSummary,
} from './approvalPolicy.js';
import type {
  OrchestratorSession,
  PipelineResult,
  PipelineStageDefinition,
  StageResult,
} from './types.js';

/** One attempt as the scheduler saw it. */
export interface AttemptEvent {
  readonly stage: PipelineStageDefinition;
  /** 0 for the first attempt of the stage in this run. */
  readonly retryIndex: number;
  /** Epoch milliseconds. */
  readonly startedAt: number;
  readonly endedAt: number;
  readonly outcome: AttemptOutcome;
  /** Error that ended an unsuccessful attempt. */
  readonly error?: unknown;
}

/** What the adapter path observed for one attempt. */
export interface AttemptObservation {
  /** `unobserved` when the adapter returned no execution metrics. */
  readonly execution: AttemptExecution;
  /** `ArtifactContext.attemptId` of the request. */
  readonly attemptId?: string;
  /** The request asked the SDK to resume a saved SDK session. */
  readonly sdkResume: boolean;
  /** SDK session ID reported by the adapter. */
  readonly sdkSessionId?: string;
  /** Absent when the adapter reported none; usage is then unknown. */
  readonly metrics?: ExecutionMetrics;
  readonly manifest?: ManifestReference;
}

const IDENTIFIER = /^[\w.:-]{1,256}$/u;

/**
 * Keep an identifier only when it matches the record schema.
 * @param value - Candidate
 * @returns Identifier or null
 */
function identifier(value: string | undefined | null): string | null {
  return value !== undefined && value !== null && value !== 'unknown' && IDENTIFIER.test(value)
    ? value
    : null;
}

/**
 * Error code (AppError) or class name; never the message.
 * @param error - Error that ended an attempt or run
 * @returns Error type, or null without an error
 */
export function errorType(error: unknown): string | null {
  if (error === undefined || error === null) return null;
  if (error instanceof AppError) return identifier(error.code) ?? 'AppError';
  if (error instanceof Error) return identifier(error.name) ?? 'Error';
  return 'unknown';
}

/**
 * Count occurrences of each value, with every key present.
 * @param keys - Enum values
 * @param values - Observed values
 * @returns Counts per key
 */
function countBy<K extends string>(keys: readonly K[], values: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) counts[value]++;
  return counts;
}

/**
 * Sum nullable counts: null only when every value is null (or there is none).
 * @param values - Counts
 * @returns Sum or null
 */
function sumCounts(values: readonly (number | null)[]): number | null {
  return values.reduce<number | null>((sum, value) => addCounts(sum, value), null);
}

/**
 * Merge per-name counts.
 * @param maps - Counts per tool name
 * @returns Sorted merged counts
 */
function mergeToolUses(maps: readonly Readonly<Record<string, number>>[]): Record<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps)
    for (const [name, value] of Object.entries(map))
      merged.set(name, (merged.get(name) ?? 0) + value);
  return Object.fromEntries([...merged].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Usage of several attempts. A field is null when no attempt reported it. The
 * source is `result` (or `recovered`) only when every attempt reported it;
 * `none` when no attempt reported any usage; otherwise `partial`, because the
 * sum misses part of the usage.
 * @param values - Attempt usage
 * @returns Summed usage, or null when there is no attempt
 */
export function sumUsage(values: readonly UsageMetrics[]): UsageMetrics | null {
  if (values.length === 0) return null;
  const sources = new Set(values.map((value) => value.source));
  const source =
    sources.size === 1 && sources.has('none')
      ? 'none'
      : [...sources].every((value) => value === 'recovered')
        ? 'recovered'
        : [...sources].every((value) => value === 'result' || value === 'recovered')
          ? 'result'
          : 'partial';
  return {
    inputTokens: sumCounts(values.map((value) => value.inputTokens)),
    outputTokens: sumCounts(values.map((value) => value.outputTokens)),
    cacheReadInputTokens: sumCounts(values.map((value) => value.cacheReadInputTokens)),
    cacheCreationInputTokens: sumCounts(values.map((value) => value.cacheCreationInputTokens)),
    source,
  };
}

/**
 * Project a #951 stage verification record.
 * @param record - Stage verification record
 * @returns State and check counts, without messages or reasons
 */
export function projectStageVerification(
  record: StageVerificationRecord | undefined
): StageVerificationProjection | null {
  if (record === undefined) return null;
  return {
    state: record.state,
    checkSet: identifier(record.checkSet),
    checks: countBy(
      ['pass', 'fail', 'skipped'] as const,
      record.checks.map((check) => check.outcome)
    ),
    requiredFailed: record.checks.filter((check) => check.outcome === 'fail' && check.required)
      .length,
  };
}

/**
 * Project a #953 approval decision record.
 * @param record - Approval decision record
 * @returns Outcome, basis, boundaries, and effects, without reason, proposed action, or scope
 */
export function projectStageApproval(
  record: ApprovalDecisionRecord | undefined
): StageApprovalProjection | null {
  if (record === undefined) return null;
  return {
    outcome: record.outcome,
    basis: record.basis,
    boundaries: [...record.boundaries],
    effects: [...record.effects],
    decidedBy: record.decidedBy,
    reused: record.reused === true,
  };
}

/**
 * Project a #951 pipeline verification summary.
 * @param summary - Pipeline verification summary
 * @returns Status, effective policy, and counts
 */
export function projectPipelineVerification(
  summary: PipelineVerificationSummary | undefined
): PipelineVerificationProjection | null {
  if (summary === undefined) return null;
  return {
    status: summary.status,
    profile: summary.policy.profile,
    rigor: summary.policy.rigor,
    blocking: summary.policy.blocking,
    source: summary.policy.source.kind,
    counts: { ...summary.counts },
    checkCounts: { ...summary.checkCounts },
  };
}

/**
 * Project a #953 pipeline approval summary.
 * @param summary - Pipeline approval summary
 * @returns Status, effective mode, and decision counts
 */
export function projectPipelineApproval(
  summary: PipelineApprovalSummary | undefined
): PipelineApprovalProjection | null {
  if (summary === undefined) return null;
  return {
    status: summary.status,
    mode: summary.policy.mode,
    source: summary.policy.source.kind,
    counts: { ...summary.counts },
    byBasis: countBy(
      APPROVAL_BASES,
      summary.decisions.map((decision) => decision.basis)
    ),
    requested: summary.requested,
    reused: summary.decisions.filter((decision) => decision.reused === true).length,
  };
}

let packageVersionCache: string | null | undefined;

/**
 * Installed `ad-sdlc` version.
 * @returns Version, or null when it cannot be read
 */
function packageVersion(): string | null {
  if (packageVersionCache !== undefined) return packageVersionCache;
  try {
    packageVersionCache = readPackageVersion();
  } catch {
    packageVersionCache = null;
  }
  return packageVersionCache;
}

/** Options of {@link DeliveryMetricsRecorder}. */
export interface DeliveryMetricsRecorderOptions {
  readonly sessionId: string;
  readonly runId: string;
  /** Epoch milliseconds when the run started. */
  readonly startedAt: number;
  readonly sink?: DeliveryMetricsSink;
  readonly consent?: DeliveryMetricsConsentStatus;
  /** Clock injection for deterministic tests. */
  readonly now?: () => number;
}

/** What the run's end contributes to the stage and pipeline records. */
export interface DeliveryMetricsRunEnd {
  readonly session: OrchestratorSession;
  /** Stage results of the run, restored results first. */
  readonly stages: readonly StageResult[];
  /** Results restored from an earlier run of the session (not executed in this run). */
  readonly restored: ReadonlySet<StageResult>;
  /** The run's result; absent when the run ended with an unexpected error. */
  readonly result?: PipelineResult;
  /** The unexpected error that ended the run. */
  readonly error?: unknown;
}

/** Collects the delivery metrics records of one run and writes them to a sink. */
export class DeliveryMetricsRecorder {
  private readonly records: DeliveryMetricsRecord[] = [];
  private readonly attempts: AttemptMetricsRecord[] = [];
  private readonly pending: Promise<void>[] = [];
  private readonly now: () => number;
  private written = 0;
  private failed = 0;
  private summary: DeliveryMetricsSummary | undefined;

  /**
   * @param options - Run identity, start time, and optional sink
   */
  constructor(private readonly options: DeliveryMetricsRecorderOptions) {
    this.now = options.now ?? ((): number => Date.now());
  }

  /**
   * Record one attempt. An attempt without an observation (an agent override,
   * or cancellation before the adapter returned) has unknown usage.
   * @param event - Scheduler view of the attempt
   * @param observation - Adapter observations, when the adapter path reported them
   */
  recordAttempt(event: AttemptEvent, observation: AttemptObservation | undefined): void {
    const metrics = observation?.metrics ?? unobservedExecutionMetrics('none');
    const record: AttemptMetricsRecord = {
      ...this.common(),
      kind: 'attempt',
      stage: event.stage.name,
      agentType: event.stage.agentType,
      retryIndex: event.retryIndex,
      attemptId: identifier(observation?.attemptId),
      sdkSessionId: identifier(observation?.sdkSessionId),
      sdkResume: observation?.sdkResume ?? false,
      startedAt: new Date(event.startedAt).toISOString(),
      endedAt: new Date(event.endedAt).toISOString(),
      durationMs: Math.max(0, Math.round(event.endedAt - event.startedAt)),
      outcome: event.outcome,
      errorType: event.outcome === 'succeeded' ? null : errorType(event.error),
      execution: observation?.execution ?? 'unobserved',
      usage: metrics.usage,
      turnCount: metrics.turnCount,
      toolUseCount: metrics.toolUseCount,
      toolUses: { ...metrics.toolUses },
      modelId: metrics.modelId,
      models: [...metrics.models],
      sdkVersion: metrics.sdkVersion,
      claudeCodeVersion: metrics.claudeCodeVersion,
      manifest: observation?.manifest ?? null,
    };
    if (this.emit(record)) this.attempts.push(record);
  }

  /**
   * Add the stage and pipeline records and wait for the sink. Later calls
   * return the first summary.
   * @param end - Stage results and the run's result or error
   * @returns Records of the run and the export state
   */
  async finish(end: DeliveryMetricsRunEnd): Promise<DeliveryMetricsSummary> {
    if (this.summary !== undefined) return this.summary;
    for (const stage of end.stages) this.emit(this.stageRecord(stage, end.restored.has(stage)));
    this.emit(this.pipelineRecord(end));
    await Promise.all(this.pending);
    this.summary = {
      records: [...this.records],
      export: {
        enabled: this.options.sink !== undefined,
        location: this.options.sink?.location ?? null,
        written: this.written,
        failed: this.failed,
        consent: this.options.consent ?? null,
      },
    };
    return this.summary;
  }

  /**
   * Fields shared by every record.
   * @returns Schema version, timestamp, and run identity
   */
  private common(): {
    schemaVersion: typeof DELIVERY_METRICS_SCHEMA_VERSION;
    recordedAt: string;
    sessionId: string;
    runId: string;
  } {
    return {
      schemaVersion: DELIVERY_METRICS_SCHEMA_VERSION,
      recordedAt: new Date(this.now()).toISOString(),
      sessionId: this.options.sessionId,
      runId: this.options.runId,
    };
  }

  /**
   * Validate a record, keep it, and hand it to the sink.
   * @param record - Record to emit
   * @returns Whether the record was valid
   */
  private emit(record: DeliveryMetricsRecord): boolean {
    const parsed = DeliveryMetricsRecordSchema.safeParse(record);
    if (!parsed.success) {
      this.failed++;
      getLogger().warn('Delivery metrics record rejected by its schema', {
        agent: 'AdsdlcOrchestratorAgent',
        kind: record.kind,
        fields: parsed.error.issues.map((issue) => issue.path.map(String).join('.')),
      });
      return false;
    }
    this.records.push(parsed.data);
    const sink = this.options.sink;
    if (sink !== undefined)
      this.pending.push(
        Promise.resolve()
          .then(() => sink.write(parsed.data))
          .then(
            () => {
              this.written++;
            },
            (error: unknown) => {
              this.failed++;
              getLogger().warn('Delivery metrics export failed (non-critical)', {
                agent: 'AdsdlcOrchestratorAgent',
                kind: record.kind,
                error: errorType(error),
              });
            }
          )
      );
    return true;
  }

  /**
   * Stage record from a stage result and this run's attempts of the stage.
   * @param result - Stage result
   * @param restored - Whether the result was restored from an earlier run
   * @returns Stage record
   */
  private stageRecord(result: StageResult, restored: boolean): StageMetricsRecord {
    const attempts = restored ? [] : this.attempts.filter((entry) => entry.stage === result.name);
    return {
      ...this.common(),
      kind: 'stage',
      stage: result.name,
      agentType: result.agentType,
      status: result.status,
      restored,
      durationMs: Math.max(0, Math.round(result.durationMs)),
      retryCount: Math.max(0, Math.round(result.retryCount)),
      attempts: {
        total: attempts.length,
        byOutcome: countBy(
          ATTEMPT_OUTCOMES,
          attempts.map((entry) => entry.outcome)
        ),
      },
      usage: sumUsage(attempts.map((entry) => entry.usage)),
      turnCount: sumCounts(attempts.map((entry) => entry.turnCount)),
      toolUseCount: sumCounts(attempts.map((entry) => entry.toolUseCount)),
      toolUses: mergeToolUses(attempts.map((entry) => entry.toolUses)),
      errorType: identifier(result.errorDetails?.code),
      verification: projectStageVerification(result.verification),
      approval: projectStageApproval(result.approval),
      manifest: result.manifest ?? null,
    };
  }

  /**
   * Pipeline record of the run.
   * @param end - Stage results and the run's result or error
   * @returns Pipeline record
   */
  private pipelineRecord(end: DeliveryMetricsRunEnd): PipelineMetricsRecord {
    const { session, result } = end;
    const endedAt = this.now();
    const attempts = this.attempts;
    const status = result?.overallStatus ?? 'failed';
    return {
      ...this.common(),
      kind: 'pipeline',
      mode: session.mode,
      status,
      exitCode: result === undefined ? 1 : pipelineExitCode(result),
      startedAt: new Date(this.options.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: Math.max(0, Math.round(result?.durationMs ?? endedAt - this.options.startedAt)),
      resume: {
        resumed: session.resumedFrom !== undefined,
        source: session.resumeSource ?? null,
        priorStatus: session.resumedFromStatus ?? null,
      },
      stages: {
        total: end.stages.length,
        restored: end.stages.filter((stage) => end.restored.has(stage)).length,
        byStatus: countBy(
          STAGE_STATUSES,
          end.stages.map((stage) => stage.status)
        ),
      },
      attempts: {
        total: attempts.length,
        retries: attempts.filter((entry) => entry.retryIndex > 0).length,
        byOutcome: countBy(
          ATTEMPT_OUTCOMES,
          attempts.map((entry) => entry.outcome)
        ),
      },
      usage: sumUsage(attempts.map((entry) => entry.usage)),
      turnCount: sumCounts(attempts.map((entry) => entry.turnCount)),
      toolUseCount: sumCounts(attempts.map((entry) => entry.toolUseCount)),
      toolUses: mergeToolUses(attempts.map((entry) => entry.toolUses)),
      models: [...new Set(attempts.flatMap((entry) => entry.models))].sort(),
      sdkVersion: installedSdkVersion(),
      packageVersion: packageVersion(),
      verification: projectPipelineVerification(result?.verification),
      approval: projectPipelineApproval(result?.approval),
      errorType: result === undefined ? (errorType(end.error) ?? 'unknown') : null,
    };
  }
}
