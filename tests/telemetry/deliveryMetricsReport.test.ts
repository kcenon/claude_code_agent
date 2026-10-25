/**
 * Delivery metrics report (#956) over a fixed fixture corpus, checked against
 * totals computed by hand.
 *
 * Corpus (`fixtures/delivery-metrics/`, one export file per session):
 * - s1: run R1a completes an Import run. `implementation` fails (partial usage,
 *   cache creation unknown), times out (partial usage, cache unknown, no turn
 *   count), then succeeds. The review attempt line appears twice (duplicate).
 * - s2: run R2a pauses awaiting the orchestration decision; run R2b resumes it
 *   (`issue_reading` restored) and completes. R2b's implementation attempt
 *   reported no usage (unobserved): every SDK field is missing.
 * - s3: run R3a is cancelled during its first stage and fails. One line carries
 *   a free-text `prompt` field and is rejected by the strict schema.
 * - s4: run R4a ended after one attempt: no stage or pipeline record (an
 *   unrecorded run), followed by a torn line.
 * - supplied.json: four pull requests (accepted true, true, false, null; rework
 *   0, 25, null, 40 minutes) and four requirements (evidence true, true, false, null).
 *
 * Attempts (14): R1a 7, R2a 1, R2b 4, R3a 1, R4a 1. Outcomes: succeeded 11,
 * failed 1, timed_out 1, cancelled 1; retried 2.
 *
 * | Measure        | R1a                                | R2a | R2b                 | R3a  | R4a | Total | Missing | Partial |
 * | -------------- | ---------------------------------- | --- | ------------------- | ---- | --- | ----- | ------- | ------- |
 * | duration ms    | 1000+2000+3000+5000+4000+500+700   | 900 | 1100+1500+300+600   | 2500 | 250 | 23350 | 0       | 0       |
 * | input          | 1000+2000+1500+800+4000+500+700    | 900 | 1100+?+300+600      | 400  | 250 | 14050 | 1       | 3       |
 * | output         | 100+200+150+60+400+50+70           | 90  | 110+?+30+60         | 20   | 25  | 1365  | 1       | 3       |
 * | cache read     | 500+0+300+?+1000+0+0               | 0   | 400+?+0+0           | 0    | 0   | 2200  | 2       | 2       |
 * | cache creation | 200+0+?+?+100+0+0                  | 0   | 0+?+0+0             | 0    | 0   | 300   | 3       | 1       |
 * | turns          | 2+3+2+?+5+1+1                      | 1   | 2+?+1+1             | ?    | 1   | 20    | 3       | 1       |
 * | tool uses      | 1+2+3+1+4+0+1                      | 1   | 2+?+0+1             | 0    | 1   | 17    | 1       | 3       |
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import {
  buildDeliveryMetricsReport,
  DeliveryReportInputError,
  formatDeliveryMetricsReport,
  parseDeliveryMetricsLines,
  readDeliveryMetricsFiles,
  readDeliveryReviewInput,
  type DeliveryMetricsReport,
  type ReportMetric,
} from '../../src/telemetry/deliveryMetricsReport.js';

const CORPUS = join(import.meta.dirname, 'fixtures', 'delivery-metrics');
const FILES = ['s1', 's2', 's3', 's4'].map((name) => join(CORPUS, `${name}.jsonl`));
const SUPPLIED = join(CORPUS, 'supplied.json');
const GENERATED = new Date('2026-10-26T12:00:00.000Z');

async function corpusReport(withSupplied = true): Promise<DeliveryMetricsReport> {
  const input = await readDeliveryMetricsFiles(FILES);
  return buildDeliveryMetricsReport(input, {
    ...(withSupplied
      ? { supplied: { path: SUPPLIED, data: await readDeliveryReviewInput(SUPPLIED) } }
      : {}),
    generatedAt: GENERATED,
  });
}

function metric(report: DeliveryMetricsReport, id: string): ReportMetric {
  const found = report.metrics.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`metric ${id} missing`);
  return found;
}

/** The fields a reader needs: value, numerator, denominator, sample, missing. */
function shape(entry: ReportMetric) {
  return {
    value: entry.value,
    mean: entry.mean,
    numerator: entry.numerator,
    denominator: entry.denominator.count,
    sample: entry.sample,
    missing: entry.missing,
    partial: entry.partial,
    source: entry.source,
  };
}

describe('delivery metrics report on the fixture corpus', () => {
  it('states inputs, scope, invalid and duplicate records, and outcomes', async () => {
    const report = await corpusReport();
    expect(report.inputs.files.map((file) => file.records)).toEqual([14, 17, 7, 1]);
    expect(report.inputs.invalidRecords).toEqual([
      expect.objectContaining({
        file: FILES[2],
        line: 7,
        reason: expect.stringContaining('prompt'),
      }),
      { file: FILES[3], line: 2, reason: 'Invalid JSON' },
    ]);
    expect(report.inputs.duplicateRecords).toBe(1);
    expect(report.scope).toEqual({ sessions: 4, runs: 5, stages: 20, attempts: 14 });
    expect(report.outcomes).toEqual({
      runs: {
        pending: 0,
        running: 0,
        completed: 2,
        failed: 1,
        partial: 0,
        rejected: 0,
        awaiting_decision: 1,
        unrecorded: 1,
      },
      stages: { pending: 0, running: 0, completed: 10, degraded: 0, failed: 1, skipped: 8 },
      restoredStages: 1,
      attempts: { succeeded: 11, failed: 1, timed_out: 1, cancelled: 1 },
      retriedAttempts: 2,
    });
    expect(report.models).toEqual({ 'claude-haiku-4-5': 1, 'claude-sonnet-4-5': 13 });
    expect(report.sdkVersions).toEqual(['0.3.301']);
  });

  it('rates state their numerator, denominator, sample, and missing data', async () => {
    const report = await corpusReport();
    expect(shape(metric(report, 'runs.completed_rate'))).toEqual({
      value: 0.5,
      mean: null,
      numerator: 2,
      denominator: 4,
      sample: 5,
      missing: 1,
      partial: 0,
      source: 'observed',
    });
    expect(shape(metric(report, 'runs.verified_rate'))).toMatchObject({
      value: 0.5,
      numerator: 2,
      denominator: 4,
      sample: 5,
      missing: 1,
    });
    expect(shape(metric(report, 'runs.resume_success_rate'))).toMatchObject({
      value: 1,
      numerator: 1,
      denominator: 1,
      sample: 1,
      missing: 0,
    });
    expect(shape(metric(report, 'runs.resume_after_decision_success_rate'))).toMatchObject({
      value: 1,
      sample: 1,
    });
    expect(shape(metric(report, 'approval.requested_decisions'))).toMatchObject({
      value: 3,
      mean: 0.75,
      denominator: 4,
      sample: 5,
      missing: 1,
    });
    expect(metric(report, 'approval.rejected_decisions').value).toBe(0);
  });

  it('attempt totals include failed, retried, timed-out, and cancelled attempts', async () => {
    const report = await corpusReport();
    const all = (key: string) => shape(metric(report, `attempts.all.${key}`));
    expect(all('duration_ms')).toMatchObject({
      value: 23350,
      denominator: 14,
      sample: 14,
      missing: 0,
    });
    expect(all('duration_ms').mean).toBeCloseTo(23350 / 14);
    expect(all('input_tokens')).toMatchObject({
      value: 14050,
      denominator: 13,
      missing: 1,
      partial: 3,
    });
    expect(all('output_tokens')).toMatchObject({
      value: 1365,
      denominator: 13,
      missing: 1,
      partial: 3,
    });
    expect(all('cache_read_input_tokens')).toMatchObject({
      value: 2200,
      denominator: 12,
      missing: 2,
      partial: 2,
    });
    expect(all('cache_creation_input_tokens')).toMatchObject({
      value: 300,
      denominator: 11,
      missing: 3,
      partial: 1,
    });
    expect(all('turns')).toMatchObject({ value: 20, denominator: 11, missing: 3, partial: 1 });
    expect(all('tool_uses')).toMatchObject({ value: 17, denominator: 13, missing: 1, partial: 3 });

    expect(shape(metric(report, 'attempts.failed.duration_ms'))).toMatchObject({
      value: 3000,
      sample: 1,
    });
    expect(shape(metric(report, 'attempts.failed.input_tokens'))).toMatchObject({
      value: 1500,
      partial: 1,
    });
    expect(shape(metric(report, 'attempts.timed_out.cache_read_input_tokens'))).toMatchObject({
      value: null,
      sample: 1,
      missing: 1,
    });
    expect(shape(metric(report, 'attempts.cancelled.input_tokens'))).toMatchObject({
      value: 400,
      sample: 1,
    });
    expect(shape(metric(report, 'attempts.retried.duration_ms'))).toMatchObject({
      value: 9000,
      sample: 2,
    });
    expect(shape(metric(report, 'attempts.retried.input_tokens'))).toMatchObject({ value: 4800 });
    expect(shape(metric(report, 'attempts.succeeded.duration_ms'))).toMatchObject({
      value: 12850,
      sample: 11,
    });
    expect(shape(metric(report, 'attempts.succeeded.input_tokens'))).toMatchObject({
      value: 11350,
      denominator: 10,
      missing: 1,
    });
  });

  it('human-review metrics come only from the supplied file', async () => {
    const report = await corpusReport();
    expect(shape(metric(report, 'pull_requests.accepted_rate'))).toMatchObject({
      numerator: 2,
      denominator: 3,
      sample: 4,
      missing: 1,
      source: 'supplied',
    });
    expect(metric(report, 'pull_requests.accepted_rate').value).toBeCloseTo(2 / 3);
    expect(shape(metric(report, 'pull_requests.rework_minutes'))).toMatchObject({
      value: 65,
      denominator: 3,
      sample: 4,
      missing: 1,
      source: 'supplied',
    });
    expect(metric(report, 'pull_requests.rework_minutes').mean).toBeCloseTo(65 / 3);
    expect(shape(metric(report, 'requirements.evidence_coverage'))).toMatchObject({
      numerator: 2,
      denominator: 3,
      sample: 4,
      missing: 1,
      source: 'supplied',
    });
    expect(report.inputs.supplied).toEqual({ path: SUPPLIED, collectedAt: '2026-10-26' });

    // Without a supplied file the review metrics are not measured, not inferred from runs.
    const observedOnly = await corpusReport(false);
    for (const id of [
      'pull_requests.accepted_rate',
      'pull_requests.rework_minutes',
      'requirements.evidence_coverage',
    ])
      expect(shape(metric(observedOnly, id))).toMatchObject({
        value: null,
        sample: 0,
        denominator: 0,
      });
  });

  it('every metric states source, sample, missing, and denominator', async () => {
    const report = await corpusReport();
    expect(report.metrics.length).toBeGreaterThan(40);
    for (const entry of report.metrics) {
      expect(['observed', 'supplied']).toContain(entry.source);
      expect(entry.denominator.count).toBe(entry.sample - entry.missing);
      expect(entry.denominator.description.length).toBeGreaterThan(0);
    }
  });

  it('filters one session', async () => {
    const input = await readDeliveryMetricsFiles(FILES);
    const report = buildDeliveryMetricsReport(input, {
      session: '22222222-2222-4222-8222-222222222222',
      generatedAt: GENERATED,
    });
    expect(report.scope).toEqual({ sessions: 1, runs: 2, stages: 10, attempts: 5 });
    expect(metric(report, 'runs.resume_success_rate').value).toBe(1);
    expect(metric(report, 'attempts.all.input_tokens')).toMatchObject({ value: 2900, missing: 1 });
  });

  it('formats a Markdown report with denominators and sources', async () => {
    const text = formatDeliveryMetricsReport(await corpusReport());
    expect(text).toContain('# Delivery metrics report');
    expect(text).toContain('Scope: 4 sessions, 5 runs, 20 stage records, 14 attempts.');
    expect(text).toContain(
      '| Runs | pending 0, running 0, completed 2, failed 1, partial 0, rejected 0, awaiting_decision 1, unrecorded 1 |'
    );
    expect(text).toContain(
      '| Completed runs | 50.0% | 2 | 4 runs with a pipeline record | 5 | 1 | observed |'
    );
    expect(text).toContain(
      '| Accepted pull requests | 66.7% | 2 | 3 supplied pull requests with a review outcome | 4 | 1 | supplied |'
    );
    expect(text).toContain(
      '| Input tokens (all attempts) | 14050 | 1080.8 | 13 all attempts with a known value | 14 | 1 | 3 | observed |'
    );
    expect(text).toContain('- ');
    expect(text).toContain(':2: Invalid JSON');
  });

  it('rejects an invalid supplied file and reports unreadable inputs', async () => {
    await expect(readDeliveryReviewInput(FILES[0]!)).rejects.toBeInstanceOf(
      DeliveryReportInputError
    );
    await expect(readDeliveryMetricsFiles([join(CORPUS, 'absent.jsonl')])).rejects.toBeInstanceOf(
      DeliveryReportInputError
    );
  });

  it('parses blank lines and reports schema failures by line', () => {
    const parsed = parseDeliveryMetricsLines('inline', '\n{"schemaVersion":2}\n\n');
    expect(parsed.records).toEqual([]);
    expect(parsed.invalid).toEqual([
      { file: 'inline', line: 2, reason: expect.stringContaining('kind') },
    ]);
  });
});
