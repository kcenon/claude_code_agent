/**
 * Delivery metrics evaluation report (#956).
 *
 * A typed aggregation over delivery metrics records (observed at runtime) and
 * an optional review file that a person supplies (accepted pull requests,
 * rework time, requirement evidence). Human-review metrics come only from the
 * supplied file; they are never inferred from CI or run outcomes. Every metric
 * states its source, sample, missing count, and denominator, and attempt
 * totals include failed, retried, timed-out, and cancelled attempts. The
 * report contains no monetary estimate: no price table is built in. See
 * docs/guides/delivery-metrics.md.
 *
 * @module telemetry/deliveryMetricsReport
 */

import { readFile } from 'node:fs/promises';
import { z } from 'zod';

import {
  ATTEMPT_OUTCOMES,
  PIPELINE_STATUSES,
  STAGE_STATUSES,
  parseDeliveryMetricsRecord,
  type AttemptMetricsRecord,
  type AttemptOutcome,
  type DeliveryMetricsRecord,
  type PipelineMetricsRecord,
  type StageMetricsRecord,
} from './deliveryMetrics.js';

/** Version of the supplied review file and of the report. */
export const DELIVERY_REVIEW_SCHEMA_VERSION = 1 as const;

const reviewIdentifier = z.string().min(1).max(256);

/** Review data a person supplies; never derived from CI. */
export const DeliveryReviewInputSchema = z
  .object({
    schemaVersion: z.literal(DELIVERY_REVIEW_SCHEMA_VERSION),
    kind: z.literal('delivery_review'),
    /** When the data was collected (ISO date or date-time). */
    collectedAt: z.union([z.iso.date(), z.iso.datetime()]),
    pullRequests: z
      .array(
        z
          .object({
            id: reviewIdentifier,
            sessionId: reviewIdentifier.optional(),
            /** Accepted as delivered (after any recorded rework); null when not decided. */
            accepted: z.boolean().nullable(),
            /** Minutes a person spent changing the delivered pull request; null when not recorded. */
            reworkMinutes: z.number().nonnegative().nullable(),
          })
          .strict()
      )
      .default([]),
    requirements: z
      .array(
        z
          .object({
            id: reviewIdentifier,
            /** Whether accepted evidence (a passing acceptance test or check) covers it; null when not assessed. */
            evidence: z.boolean().nullable(),
          })
          .strict()
      )
      .default([]),
  })
  .strict();
export type DeliveryReviewInput = z.infer<typeof DeliveryReviewInputSchema>;

/** Where a metric's data comes from. */
export type MetricSource = 'observed' | 'supplied';

/** Unit of a metric value. */
export type MetricUnit =
  'ratio' | 'milliseconds' | 'tokens' | 'turns' | 'tool_uses' | 'minutes' | 'decisions';

/** One reported metric. */
export interface ReportMetric {
  readonly id: string;
  readonly label: string;
  /** `observed` from runtime records, `supplied` from the review file. */
  readonly source: MetricSource;
  readonly kind: 'rate' | 'total';
  readonly unit: MetricUnit;
  /** Members in scope, for example attempts or supplied pull requests. */
  readonly sample: number;
  /** Members of the sample without the measured value. */
  readonly missing: number;
  /** Division base of the rate or mean: the members with a value (`sample - missing`). */
  readonly denominator: { readonly count: number; readonly description: string };
  /** Members a rate counts; null for totals. */
  readonly numerator: number | null;
  /** Rate (numerator / denominator) or total; null when the denominator is 0. */
  readonly value: number | null;
  /** Mean of a total (value / denominator); null for rates. */
  readonly mean: number | null;
  /** Values that are lower bounds (partial usage of attempts without a usable result). */
  readonly partial: number;
}

/** A line of an input file that is not a valid record. */
export interface InvalidRecord {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
}

/** Records read from export files. */
export interface DeliveryMetricsInput {
  readonly records: readonly DeliveryMetricsRecord[];
  readonly files: readonly { readonly path: string; readonly records: number }[];
  readonly invalidRecords: readonly InvalidRecord[];
  /** Records read more than once (the same file twice, or a repeated line). */
  readonly duplicateRecords: number;
}

/** Report over a corpus of records and optional supplied review data. */
export interface DeliveryMetricsReport {
  readonly schemaVersion: typeof DELIVERY_REVIEW_SCHEMA_VERSION;
  readonly kind: 'delivery_metrics_report';
  readonly generatedAt: string;
  readonly inputs: {
    readonly files: DeliveryMetricsInput['files'];
    readonly invalidRecords: readonly InvalidRecord[];
    readonly duplicateRecords: number;
    readonly supplied: { readonly path: string; readonly collectedAt: string } | null;
    /** Only records of this session were used. */
    readonly session: string | null;
  };
  readonly scope: {
    readonly sessions: number;
    readonly runs: number;
    readonly stages: number;
    readonly attempts: number;
  };
  readonly outcomes: {
    /** Runs per status; `unrecorded` runs have attempt or stage records but no pipeline record. */
    readonly runs: Readonly<Record<(typeof PIPELINE_STATUSES)[number] | 'unrecorded', number>>;
    /** Stages executed in their run, per status (restored stages excluded). */
    readonly stages: Readonly<Record<(typeof STAGE_STATUSES)[number], number>>;
    readonly restoredStages: number;
    readonly attempts: Readonly<Record<AttemptOutcome, number>>;
    readonly retriedAttempts: number;
  };
  readonly metrics: readonly ReportMetric[];
  /** Attempts per observed model. */
  readonly models: Readonly<Record<string, number>>;
  readonly sdkVersions: readonly string[];
}

/** Error for unreadable or invalid report inputs. */
export class DeliveryReportInputError extends Error {
  /**
   * @param message - What is wrong with the input
   */
  constructor(message: string) {
    super(message);
    this.name = 'DeliveryReportInputError';
  }
}

/**
 * Identity of a record, for removing duplicates.
 * @param record - Record
 * @returns Key unique per attempt, stage, or run
 */
function recordKey(record: DeliveryMetricsRecord): string {
  const run = `${record.sessionId}|${record.runId}`;
  if (record.kind === 'attempt')
    return `attempt|${run}|${record.stage}|${String(record.retryIndex)}`;
  if (record.kind === 'stage') return `stage|${run}|${record.stage}`;
  return `pipeline|${run}`;
}

/**
 * Parse JSON lines of one export.
 * @param path - Reported file path
 * @param content - File content
 * @returns Valid records and invalid lines
 */
export function parseDeliveryMetricsLines(
  path: string,
  content: string
): { records: DeliveryMetricsRecord[]; invalid: InvalidRecord[] } {
  const records: DeliveryMetricsRecord[] = [];
  const invalid: InvalidRecord[] = [];
  content.split('\n').forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      invalid.push({ file: path, line: index + 1, reason: 'Invalid JSON' });
      return;
    }
    const parsed = parseDeliveryMetricsRecord(value);
    if (parsed.ok) records.push(parsed.record);
    else invalid.push({ file: path, line: index + 1, reason: parsed.reason });
  });
  return { records, invalid };
}

/**
 * Read export files. Invalid lines are reported, not fatal; duplicates are dropped.
 * @param paths - JSONL files
 * @returns Records, per-file counts, invalid lines, and duplicates
 * @throws DeliveryReportInputError when a file cannot be read
 */
export async function readDeliveryMetricsFiles(
  paths: readonly string[]
): Promise<DeliveryMetricsInput> {
  const seen = new Set<string>();
  const records: DeliveryMetricsRecord[] = [];
  const files: { path: string; records: number }[] = [];
  const invalidRecords: InvalidRecord[] = [];
  let duplicateRecords = 0;
  for (const path of paths) {
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      throw new DeliveryReportInputError(
        `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const parsed = parseDeliveryMetricsLines(path, content);
    invalidRecords.push(...parsed.invalid);
    files.push({ path, records: parsed.records.length });
    for (const record of parsed.records) {
      const key = recordKey(record);
      if (seen.has(key)) {
        duplicateRecords++;
        continue;
      }
      seen.add(key);
      records.push(record);
    }
  }
  return { records, files, invalidRecords, duplicateRecords };
}

/**
 * Read and validate a supplied review file.
 * @param path - JSON file
 * @returns Review data
 * @throws DeliveryReportInputError when the file is unreadable or invalid
 */
export async function readDeliveryReviewInput(path: string): Promise<DeliveryReviewInput> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new DeliveryReportInputError(
      `Cannot read supplied review data ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const parsed = DeliveryReviewInputSchema.safeParse(value);
  if (!parsed.success)
    throw new DeliveryReportInputError(
      `Invalid supplied review data ${path}: ${parsed.error.issues
        .map((issue) => `${issue.path.map(String).join('.') || '(file)'}: ${issue.message}`)
        .join('; ')}`
    );
  return parsed.data;
}

/**
 * Count values with every key present.
 * @param keys - Keys
 * @param values - Observed values
 * @returns Counts per key
 */
function countBy<K extends string>(keys: readonly K[], values: readonly K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) counts[value]++;
  return counts;
}

/**
 * A rate over the members of a sample that have a value.
 * @param base - Identity and labels
 * @param base.id - Metric identifier
 * @param base.label - Metric label
 * @param base.source - Data source
 * @param base.description - What the denominator counts
 * @param values - One entry per sample member: true (counted), false, or null (missing)
 * @returns Rate metric
 */
function rate(
  base: { id: string; label: string; source: MetricSource; description: string },
  values: readonly (boolean | null)[]
): ReportMetric {
  const known = values.filter((value): value is boolean => value !== null);
  const numerator = known.filter((value) => value).length;
  return {
    id: base.id,
    label: base.label,
    source: base.source,
    kind: 'rate',
    unit: 'ratio',
    sample: values.length,
    missing: values.length - known.length,
    denominator: { count: known.length, description: base.description },
    numerator,
    value: known.length === 0 ? null : numerator / known.length,
    mean: null,
    partial: 0,
  };
}

/**
 * A total over the members of a sample that have a value.
 * @param base - Identity and labels
 * @param base.id - Metric identifier
 * @param base.label - Metric label
 * @param base.source - Data source
 * @param base.unit - Unit of the values
 * @param base.description - What the denominator counts
 * @param values - One entry per sample member: the value, or null (missing)
 * @param partial - Number of values that are lower bounds
 * @returns Total metric
 */
function total(
  base: { id: string; label: string; source: MetricSource; unit: MetricUnit; description: string },
  values: readonly (number | null)[],
  partial = 0
): ReportMetric {
  const known = values.filter((value): value is number => value !== null);
  const sum = known.reduce((acc, value) => acc + value, 0);
  return {
    id: base.id,
    label: base.label,
    source: base.source,
    kind: 'total',
    unit: base.unit,
    sample: values.length,
    missing: values.length - known.length,
    denominator: { count: known.length, description: base.description },
    numerator: null,
    value: known.length === 0 ? null : sum,
    mean: known.length === 0 ? null : sum / known.length,
    partial,
  };
}

/** Attempt measures reported per group. */
const ATTEMPT_MEASURES: readonly {
  readonly key: string;
  readonly label: string;
  readonly unit: MetricUnit;
  readonly read: (attempt: AttemptMetricsRecord) => number | null;
  /** Whether the value can be a lower bound. */
  readonly sdk: boolean;
}[] = [
  {
    key: 'duration_ms',
    label: 'Attempt duration',
    unit: 'milliseconds',
    read: (a) => a.durationMs,
    sdk: false,
  },
  {
    key: 'input_tokens',
    label: 'Input tokens',
    unit: 'tokens',
    read: (a) => a.usage.inputTokens,
    sdk: true,
  },
  {
    key: 'output_tokens',
    label: 'Output tokens',
    unit: 'tokens',
    read: (a) => a.usage.outputTokens,
    sdk: true,
  },
  {
    key: 'cache_read_input_tokens',
    label: 'Cache read input tokens',
    unit: 'tokens',
    read: (a) => a.usage.cacheReadInputTokens,
    sdk: true,
  },
  {
    key: 'cache_creation_input_tokens',
    label: 'Cache creation input tokens',
    unit: 'tokens',
    read: (a) => a.usage.cacheCreationInputTokens,
    sdk: true,
  },
  { key: 'turns', label: 'SDK turns', unit: 'turns', read: (a) => a.turnCount, sdk: true },
  {
    key: 'tool_uses',
    label: 'Tool invocations',
    unit: 'tool_uses',
    read: (a) => a.toolUseCount,
    sdk: true,
  },
];

/**
 * Attempt groups: all attempts, each outcome, and retried attempts (retry
 * index above 0, whatever their outcome).
 */
const ATTEMPT_GROUPS: readonly {
  readonly key: string;
  readonly label: string;
  readonly includes: (attempt: AttemptMetricsRecord) => boolean;
}[] = [
  { key: 'all', label: 'all attempts', includes: () => true },
  ...ATTEMPT_OUTCOMES.map((outcome) => ({
    key: outcome,
    label: `${outcome} attempts`,
    includes: (attempt: AttemptMetricsRecord): boolean => attempt.outcome === outcome,
  })),
  {
    key: 'retried',
    label: 'retried attempts',
    includes: (attempt) => attempt.retryIndex > 0,
  },
];

/** Options of {@link buildDeliveryMetricsReport}. */
export interface DeliveryMetricsReportOptions {
  /** Supplied review data and the file it came from. */
  readonly supplied?: { readonly path: string; readonly data: DeliveryReviewInput };
  /** Use only records of this session. */
  readonly session?: string;
  /** Report timestamp (defaults to now). */
  readonly generatedAt?: Date;
}

/**
 * Aggregate records and supplied review data into a report.
 * @param input - Records read from export files
 * @param options - Supplied review data, session filter, and timestamp
 * @returns Report
 */
export function buildDeliveryMetricsReport(
  input: DeliveryMetricsInput,
  options: DeliveryMetricsReportOptions = {}
): DeliveryMetricsReport {
  const records = input.records.filter(
    (record) => options.session === undefined || record.sessionId === options.session
  );
  const attempts = records.filter(
    (record): record is AttemptMetricsRecord => record.kind === 'attempt'
  );
  const stages = records.filter((record): record is StageMetricsRecord => record.kind === 'stage');
  const pipelines = new Map(
    records
      .filter((record): record is PipelineMetricsRecord => record.kind === 'pipeline')
      .map((record) => [`${record.sessionId}|${record.runId}`, record])
  );
  const runs = [...new Set(records.map((record) => `${record.sessionId}|${record.runId}`))];
  const runRecords = runs.map((run) => pipelines.get(run));
  const recorded = [...pipelines.values()];
  const executedStages = stages.filter((stage) => !stage.restored);

  const metrics: ReportMetric[] = [
    rate(
      {
        id: 'runs.completed_rate',
        label: 'Completed runs',
        source: 'observed',
        description: 'runs with a pipeline record',
      },
      runRecords.map((record) => (record === undefined ? null : record.status === 'completed'))
    ),
    rate(
      {
        id: 'runs.verified_rate',
        label: 'Verified runs (#951 status verified)',
        source: 'observed',
        description: 'runs with a verification summary',
      },
      runRecords.map((record) =>
        record?.verification == null ? null : record.verification.status === 'verified'
      )
    ),
    rate(
      {
        id: 'runs.resume_success_rate',
        label: 'Resumed runs that completed',
        source: 'observed',
        description: 'resumed runs',
      },
      recorded
        .filter((record) => record.resume.resumed)
        .map((record) => record.status === 'completed')
    ),
    rate(
      {
        id: 'runs.resume_after_decision_success_rate',
        label: 'Runs resumed after awaiting a decision that completed',
        source: 'observed',
        description: 'runs resumed from awaiting_decision',
      },
      recorded
        .filter(
          (record) => record.resume.resumed && record.resume.priorStatus === 'awaiting_decision'
        )
        .map((record) => record.status === 'completed')
    ),
    total(
      {
        id: 'approval.requested_decisions',
        label: 'Requested approval decisions (#953)',
        source: 'observed',
        unit: 'decisions',
        description: 'runs with an approval summary',
      },
      runRecords.map((record) => (record?.approval == null ? null : record.approval.requested))
    ),
    total(
      {
        id: 'approval.rejected_decisions',
        label: 'Rejected approval decisions (#953)',
        source: 'observed',
        unit: 'decisions',
        description: 'runs with an approval summary',
      },
      runRecords.map((record) =>
        record?.approval == null ? null : record.approval.counts.rejected
      )
    ),
  ];

  for (const group of ATTEMPT_GROUPS) {
    const members = attempts.filter(group.includes);
    for (const measure of ATTEMPT_MEASURES)
      metrics.push(
        total(
          {
            id: `attempts.${group.key}.${measure.key}`,
            label: `${measure.label} (${group.label})`,
            source: 'observed',
            unit: measure.unit,
            description: `${group.label} with a known value`,
          },
          members.map(measure.read),
          measure.sdk
            ? members.filter(
                (attempt) => attempt.usage.source === 'partial' && measure.read(attempt) !== null
              ).length
            : 0
        )
      );
  }

  const supplied = options.supplied?.data;
  const pullRequests = supplied?.pullRequests ?? [];
  const requirements = supplied?.requirements ?? [];
  metrics.push(
    rate(
      {
        id: 'pull_requests.accepted_rate',
        label: 'Accepted pull requests',
        source: 'supplied',
        description: 'supplied pull requests with a review outcome',
      },
      pullRequests.map((entry) => entry.accepted)
    ),
    total(
      {
        id: 'pull_requests.rework_minutes',
        label: 'Human rework time',
        source: 'supplied',
        unit: 'minutes',
        description: 'supplied pull requests with recorded rework time',
      },
      pullRequests.map((entry) => entry.reworkMinutes)
    ),
    rate(
      {
        id: 'requirements.evidence_coverage',
        label: 'Requirements covered by evidence',
        source: 'supplied',
        description: 'supplied requirements with an evidence assessment',
      },
      requirements.map((entry) => entry.evidence)
    )
  );

  const models: Record<string, number> = {};
  for (const attempt of attempts)
    for (const model of attempt.models) models[model] = (models[model] ?? 0) + 1;

  return {
    schemaVersion: DELIVERY_REVIEW_SCHEMA_VERSION,
    kind: 'delivery_metrics_report',
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    inputs: {
      files: input.files,
      invalidRecords: input.invalidRecords,
      duplicateRecords: input.duplicateRecords,
      supplied:
        options.supplied === undefined
          ? null
          : { path: options.supplied.path, collectedAt: options.supplied.data.collectedAt },
      session: options.session ?? null,
    },
    scope: {
      sessions: new Set(records.map((record) => record.sessionId)).size,
      runs: runs.length,
      stages: stages.length,
      attempts: attempts.length,
    },
    outcomes: {
      runs: {
        ...countBy(
          PIPELINE_STATUSES,
          recorded.map((record) => record.status)
        ),
        unrecorded: runRecords.filter((record) => record === undefined).length,
      },
      stages: countBy(
        STAGE_STATUSES,
        executedStages.map((stage) => stage.status)
      ),
      restoredStages: stages.length - executedStages.length,
      attempts: countBy(
        ATTEMPT_OUTCOMES,
        attempts.map((attempt) => attempt.outcome)
      ),
      retriedAttempts: attempts.filter((attempt) => attempt.retryIndex > 0).length,
    },
    metrics,
    models: Object.fromEntries(Object.entries(models).sort(([a], [b]) => a.localeCompare(b))),
    sdkVersions: [
      ...new Set(
        [...attempts, ...recorded].flatMap((record) =>
          record.sdkVersion === null ? [] : [record.sdkVersion]
        )
      ),
    ].sort(),
  };
}

/**
 * Format a number for a report table.
 * @param metric - Metric
 * @param value - Value to format
 * @returns Text
 */
function formatValue(metric: ReportMetric, value: number | null): string {
  if (value === null) return 'n/a';
  if (metric.unit === 'ratio') return `${(value * 100).toFixed(1)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Join counts of a record as `key n` pairs.
 * @param counts - Counts per key
 * @returns Text
 */
function joinCounts(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(', ');
}

/**
 * Markdown text of a report. Attempt groups without attempts are left out of
 * the text; the JSON report keeps every metric.
 * @param report - Report
 * @returns Markdown
 */
export function formatDeliveryMetricsReport(report: DeliveryMetricsReport): string {
  const { inputs, scope, outcomes } = report;
  const lines = [
    '# Delivery metrics report',
    '',
    `Generated ${report.generatedAt}${inputs.session === null ? '' : ` for session ${inputs.session}`}.`,
    `Scope: ${String(scope.sessions)} sessions, ${String(scope.runs)} runs, ${String(scope.stages)} stage records, ${String(scope.attempts)} attempts.`,
    `Inputs: ${String(inputs.files.length)} files, ${String(inputs.files.reduce((sum, file) => sum + file.records, 0))} records, ${String(inputs.invalidRecords.length)} invalid lines, ${String(inputs.duplicateRecords)} duplicates; supplied review data: ${inputs.supplied === null ? 'none (supplied metrics are n/a)' : `${inputs.supplied.path} (collected ${inputs.supplied.collectedAt})`}.`,
    `SDK versions: ${report.sdkVersions.length === 0 ? 'none observed' : report.sdkVersions.join(', ')}; models (attempts): ${Object.keys(report.models).length === 0 ? 'none observed' : joinCounts(report.models)}.`,
    '',
    '## Outcomes',
    '',
    '| Records | Counts |',
    '| --- | --- |',
    `| Runs | ${joinCounts(outcomes.runs)} |`,
    `| Stages executed in their run | ${joinCounts(outcomes.stages)}; restored ${String(outcomes.restoredStages)} |`,
    `| Attempts | ${joinCounts(outcomes.attempts)}; retried ${String(outcomes.retriedAttempts)} |`,
    '',
    '## Rates',
    '',
    '| Metric | Value | Numerator | Denominator | Sample | Missing | Source |',
    '| --- | ---: | ---: | --- | ---: | ---: | --- |',
  ];
  for (const metric of report.metrics.filter((entry) => entry.kind === 'rate'))
    lines.push(
      `| ${metric.label} | ${formatValue(metric, metric.value)} | ${String(metric.numerator ?? 0)} | ${String(metric.denominator.count)} ${metric.denominator.description} | ${String(metric.sample)} | ${String(metric.missing)} | ${metric.source} |`
    );
  lines.push(
    '',
    '## Totals',
    '',
    'Attempt totals include failed, retried, timed-out, and cancelled attempts. Partial values are lower bounds from attempts without a usable SDK result.',
    '',
    '| Metric | Total | Mean | Denominator | Sample | Missing | Partial | Source |',
    '| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |'
  );
  for (const metric of report.metrics.filter((entry) => entry.kind === 'total')) {
    if (
      metric.id.startsWith('attempts.') &&
      !metric.id.startsWith('attempts.all.') &&
      metric.sample === 0
    )
      continue;
    lines.push(
      `| ${metric.label} | ${formatValue(metric, metric.value)} | ${formatValue(metric, metric.mean)} | ${String(metric.denominator.count)} ${metric.denominator.description} | ${String(metric.sample)} | ${String(metric.missing)} | ${String(metric.partial)} | ${metric.source} |`
    );
  }
  if (inputs.invalidRecords.length > 0) {
    lines.push('', '## Invalid records', '');
    for (const invalid of inputs.invalidRecords)
      lines.push(`- ${invalid.file}:${String(invalid.line)}: ${invalid.reason}`);
  }
  return `${lines.join('\n')}\n`;
}
