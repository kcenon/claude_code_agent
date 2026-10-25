/**
 * Builders of valid delivery metrics records (#956) for schema and report tests.
 * `tests/telemetry/fixtures/delivery-metrics/*.jsonl` is a corpus written with
 * them; `tests/telemetry/deliveryMetricsReport.test.ts` describes its scenario
 * and checks the report against hand-computed totals.
 */
import type {
  AttemptMetricsRecord,
  PipelineMetricsRecord,
  StageMetricsRecord,
} from '../../../src/telemetry/deliveryMetrics.js';
import type { UsageMetrics } from '../../../src/execution/types.js';

export const SDK_VERSION = '0.3.301';
export const MODEL = 'claude-sonnet-4-5';

/** Token usage with a source. */
export function usage(
  source: UsageMetrics['source'],
  input: number | null,
  output: number | null,
  cacheRead: number | null,
  cacheCreation: number | null
): UsageMetrics {
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadInputTokens: cacheRead,
    cacheCreationInputTokens: cacheCreation,
    source,
  };
}

const at = (ms: number): string => new Date(Date.UTC(2026, 9, 26, 9, 0, 0) + ms).toISOString();

/** A valid attempt record; `startMs` positions it on a common clock. */
export function attemptRecord(
  overrides: Partial<AttemptMetricsRecord> & { startMs?: number } = {}
): AttemptMetricsRecord {
  const { startMs = 0, ...fields } = overrides;
  const durationMs = fields.durationMs ?? 1000;
  return {
    schemaVersion: 1,
    kind: 'attempt',
    recordedAt: at(startMs + durationMs),
    sessionId: '11111111-1111-4111-8111-111111111111',
    runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    stage: 'issue_reading',
    agentType: 'issue-reader',
    retryIndex: 0,
    attemptId: 'f0000000-0000-4000-8000-000000000001',
    sdkSessionId: 'e0000000-0000-4000-8000-000000000001',
    sdkResume: false,
    startedAt: at(startMs),
    endedAt: at(startMs + durationMs),
    durationMs,
    outcome: 'succeeded',
    errorType: null,
    execution: 'sdk',
    usage: usage('result', 1000, 100, 0, 0),
    turnCount: 1,
    toolUseCount: 1,
    toolUses: { Read: 1 },
    modelId: MODEL,
    models: [MODEL],
    sdkVersion: SDK_VERSION,
    claudeCodeVersion: '2.1.0',
    manifest: null,
    ...fields,
  };
}

/** A valid stage record. */
export function stageRecord(overrides: Partial<StageMetricsRecord> = {}): StageMetricsRecord {
  return {
    schemaVersion: 1,
    kind: 'stage',
    recordedAt: at(60000),
    sessionId: '11111111-1111-4111-8111-111111111111',
    runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    stage: 'issue_reading',
    agentType: 'issue-reader',
    status: 'completed',
    restored: false,
    durationMs: 1000,
    retryCount: 0,
    attempts: { total: 1, byOutcome: { succeeded: 1, failed: 0, timed_out: 0, cancelled: 0 } },
    usage: usage('result', 1000, 100, 0, 0),
    turnCount: 1,
    toolUseCount: 1,
    toolUses: { Read: 1 },
    errorType: null,
    verification: {
      state: 'verified_pass',
      checkSet: 'issue_reading',
      checks: { pass: 2, fail: 0, skipped: 0 },
      requiredFailed: 0,
    },
    approval: null,
    manifest: null,
    ...overrides,
  };
}

/** A valid pipeline record. */
export function pipelineRecord(
  overrides: Partial<PipelineMetricsRecord> = {}
): PipelineMetricsRecord {
  return {
    schemaVersion: 1,
    kind: 'pipeline',
    recordedAt: at(60000),
    sessionId: '11111111-1111-4111-8111-111111111111',
    runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    mode: 'import',
    status: 'completed',
    exitCode: 0,
    startedAt: at(0),
    endedAt: at(60000),
    durationMs: 60000,
    resume: { resumed: false, source: null, priorStatus: null },
    stages: {
      total: 5,
      restored: 0,
      byStatus: { pending: 0, running: 0, completed: 5, degraded: 0, failed: 0, skipped: 0 },
    },
    attempts: {
      total: 5,
      retries: 0,
      byOutcome: { succeeded: 5, failed: 0, timed_out: 0, cancelled: 0 },
    },
    usage: usage('result', 5000, 500, 0, 0),
    turnCount: 5,
    toolUseCount: 5,
    toolUses: { Read: 5 },
    models: [MODEL],
    sdkVersion: SDK_VERSION,
    packageVersion: '0.1.0',
    verification: {
      status: 'verified',
      profile: 'advisory',
      rigor: 'standard',
      blocking: false,
      source: 'default',
      counts: {
        verified_pass: 5,
        failed: 0,
        advisory_findings: 0,
        skipped: 0,
        not_applicable: 0,
      },
      checkCounts: { pass: 10, fail: 0, skipped: 0 },
    },
    approval: {
      status: 'approved_by_policy',
      mode: 'auto',
      source: 'default',
      counts: { approved: 2, rejected: 0, pending: 0 },
      byBasis: { policy: 2, prompt: 0, callback: 0, unattended: 0 },
      requested: 0,
      reused: 0,
    },
    errorType: null,
    ...overrides,
  };
}
