/**
 * Delivery metrics records (#956) on the production scheduler, orchestrator,
 * and SdkExecutionAdapter: every attempt (failed, retried, timed out,
 * cancelled) keeps its usage, and stage and pipeline records project the run.
 * The SDK is a controlled offline query; no paid call is made.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { DeliveryMetricsRecorder } from '../../src/ad-sdlc-orchestrator/deliveryMetrics.js';
import { PipelineFailedError } from '../../src/ad-sdlc-orchestrator/errors.js';
import { classifyAttemptOutcome } from '../../src/ad-sdlc-orchestrator/StageScheduler.js';
import { StageTimeoutError } from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  IMPORT_STAGES,
  type ApprovalDecision,
  type OrchestratorConfig,
  type PipelineResult,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { AppError } from '../../src/errors/AppError.js';
import { OperationAbortedError } from '../../src/error-handler/errors.js';
import { ExecutionCleanupError } from '../../src/execution/cleanup.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import type {
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../src/execution/types.js';
import type {
  AttemptMetricsRecord,
  DeliveryMetricsRecord,
  PipelineMetricsRecord,
  StageMetricsRecord,
} from '../../src/telemetry/deliveryMetrics.js';
import type { DeliveryMetricsSink } from '../../src/telemetry/deliveryMetricsExport.js';
import { ControlledQuery, deferred } from '../execution/fixtures/controlledSdk.js';
import { installAgent } from '../execution/fixtures/sdk.js';
import { CANCELLED_STREAM, SUCCESS_STREAM } from '../execution/fixtures/usageStreams.js';

let projectDir: string;
beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'delivery-metrics-orchestrator-'));
  for (const stage of IMPORT_STAGES) await installAgent(projectDir, stage.agentType);
});
afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

const attempts = (records: readonly DeliveryMetricsRecord[]): AttemptMetricsRecord[] =>
  records.filter((record): record is AttemptMetricsRecord => record.kind === 'attempt');
const stageRecord = (records: readonly DeliveryMetricsRecord[], name: string): StageMetricsRecord =>
  records.find(
    (record): record is StageMetricsRecord => record.kind === 'stage' && record.stage === name
  )!;
const pipelineRecord = (records: readonly DeliveryMetricsRecord[]): PipelineMetricsRecord =>
  records.find((record): record is PipelineMetricsRecord => record.kind === 'pipeline')!;

/** Records in memory, in arrival order. */
class MemorySink implements DeliveryMetricsSink {
  readonly records: DeliveryMetricsRecord[] = [];
  readonly location = 'memory';
  async write(record: DeliveryMetricsRecord): Promise<void> {
    this.records.push(record);
  }
}

describe('attempt records on the production SDK path', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  class SdkOrchestrator extends AdsdlcOrchestratorAgent {
    readonly backoffStarted = deferred<void>();
    constructor(
      private readonly adapter: ExecutionAdapter,
      config: OrchestratorConfig
    ) {
      super({ maxRetries: 2, timeouts: { default: 20000 }, ...config });
    }
    protected override sleep(ms: number, signal?: AbortSignal): Promise<void> {
      this.backoffStarted.resolve();
      return super.sleep(ms, signal);
    }
    protected override createExecutionAdapter(): ExecutionAdapter {
      return this.adapter;
    }
  }

  /** Runs `issue_reading` only; each attempt gets a controlled query. */
  async function pipeline(config: OrchestratorConfig = {}) {
    const sink = new MemorySink();
    const arrivals = [deferred<ControlledQuery>(), deferred<ControlledQuery>()];
    let count = 0;
    const adapter = new SdkExecutionAdapter({
      cleanupGraceMs: 50,
      loader: async () => ({
        query: (input) => {
          const query = new ControlledQuery(
            input,
            count === 0 ? CANCELLED_STREAM : SUCCESS_STREAM.slice(0, -1)
          );
          arrivals[count++]?.resolve(query);
          return query;
        },
      }),
    });
    const orchestrator = new SdkOrchestrator(adapter, {
      deliveryMetrics: { sink: () => sink },
      ...config,
    });
    await orchestrator.startSession({
      projectDir,
      userRequest: 'offline',
      overrideMode: 'import',
      stopAfterStage: 'issue_reading',
    });
    const execution = orchestrator.executePipeline(projectDir, 'offline').then(
      (result) => ({ result, error: undefined }),
      (error: unknown) => ({ result: undefined, error })
    );
    const first = await arrivals[0]!.promise;
    await first.reading.promise;
    return { orchestrator, execution, first, arrivals, sink };
  }

  it('keeps a failed first attempt and its partial usage next to the successful retry', async () => {
    const run = await pipeline();
    run.first.terminal.resolve(new Error('temporary SDK failure'));
    await run.first.returning.promise;
    run.first.cleanupGate.resolve();
    await run.orchestrator.backoffStarted.promise;
    await vi.advanceTimersByTimeAsync(5000);
    const retry = await run.arrivals[1]!.promise;
    retry.finish(SUCCESS_STREAM[SUCCESS_STREAM.length - 1]!);
    retry.cleanupGate.resolve();
    const { result } = await run.execution;
    await run.orchestrator.dispose();

    const records = result!.metrics!.records;
    const [failed, succeeded] = attempts(records);
    expect(failed).toMatchObject({
      stage: 'issue_reading',
      retryIndex: 0,
      outcome: 'failed',
      errorType: 'EXEC-003',
      execution: 'sdk',
      usage: {
        inputTokens: 700,
        outputTokens: 55,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: null,
        source: 'partial',
      },
      turnCount: null,
      toolUseCount: 1,
      toolUses: { Bash: 1 },
    });
    expect(failed!.attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(succeeded).toMatchObject({
      retryIndex: 1,
      outcome: 'succeeded',
      errorType: null,
      usage: { inputTokens: 1740, outputTokens: 247, source: 'result' },
      turnCount: 3,
      toolUseCount: 2,
      modelId: 'claude-sonnet-4-5',
      sdkVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
      claudeCodeVersion: '2.1.0',
    });
    expect(succeeded!.attemptId).not.toBe(failed!.attemptId);
    expect(succeeded!.manifest).toEqual(result!.stages[0]!.manifest);

    // The stage and the run include the failed attempt in their totals.
    expect(stageRecord(records, 'issue_reading')).toMatchObject({
      status: 'completed',
      retryCount: 1,
      attempts: { total: 2, byOutcome: { succeeded: 1, failed: 1, timed_out: 0, cancelled: 0 } },
      usage: {
        inputTokens: 2440,
        outputTokens: 302,
        cacheReadInputTokens: 4300,
        cacheCreationInputTokens: 800,
        source: 'partial',
      },
      turnCount: 3,
      toolUseCount: 3,
    });
    expect(stageRecord(records, 'orchestration')).toMatchObject({
      status: 'skipped',
      attempts: { total: 0 },
      usage: null,
      turnCount: null,
    });
    expect(pipelineRecord(records)).toMatchObject({
      status: 'completed',
      exitCode: 0,
      attempts: { total: 2, retries: 1 },
      usage: { inputTokens: 2440, source: 'partial' },
      resume: { resumed: false, source: null, priorStatus: null },
    });
    // Attempt records are written as attempts end; stage and pipeline records at the end.
    expect(run.sink.records.map((record) => record.kind)).toEqual([
      'attempt',
      'attempt',
      ...IMPORT_STAGES.map(() => 'stage'),
      'pipeline',
    ]);
    expect(result!.metrics!.export).toEqual({
      enabled: true,
      location: 'memory',
      written: records.length,
      failed: 0,
      consent: null,
    });
  });

  it('records a timed-out attempt with the usage it consumed', async () => {
    const run = await pipeline({ timeouts: { default: 100 } });
    await vi.advanceTimersByTimeAsync(100);
    await run.first.returning.promise;
    run.first.cleanupGate.resolve();
    const { error } = await run.execution;
    await run.orchestrator.dispose();
    expect(error).toBeInstanceOf(PipelineFailedError);

    const records = (error as PipelineFailedError).result!.metrics!.records;
    expect(attempts(records)).toEqual([
      expect.objectContaining({
        outcome: 'timed_out',
        errorType: 'StageTimeoutError',
        usage: expect.objectContaining({ inputTokens: 700, outputTokens: 55, source: 'partial' }),
        toolUseCount: 1,
      }),
    ]);
    expect(stageRecord(records, 'issue_reading')).toMatchObject({
      status: 'failed',
      errorType: 'EXEC-005',
      attempts: { total: 1, byOutcome: { timed_out: 1 } },
      usage: { inputTokens: 700, source: 'partial' },
    });
    expect(pipelineRecord(records)).toMatchObject({ status: 'failed', exitCode: 1 });
  });

  it('records an attempt cancelled by pipeline disposal', async () => {
    const run = await pipeline();
    const disposal = run.orchestrator.dispose();
    await run.first.returning.promise;
    run.first.cleanupGate.resolve();
    await disposal;
    const { error } = await run.execution;
    expect(error).toBeInstanceOf(PipelineFailedError);

    const [cancelled] = attempts((error as PipelineFailedError).result!.metrics!.records);
    expect(cancelled).toMatchObject({
      outcome: 'cancelled',
      usage: { inputTokens: 700, outputTokens: 55, source: 'partial' },
    });
  });
});

describe('attempt outcome classification', () => {
  it('distinguishes timeouts and cancellations from failures', () => {
    const timeout = new StageTimeoutError('implementation', 100);
    expect(classifyAttemptOutcome(timeout, false)).toBe('timed_out');
    expect(
      classifyAttemptOutcome(new ExecutionCleanupError('grace exceeded', timeout), false)
    ).toBe('timed_out');
    expect(classifyAttemptOutcome(new OperationAbortedError('implementation'), false)).toBe(
      'cancelled'
    );
    expect(classifyAttemptOutcome(new AppError('EXEC-005', 'aborted'), false)).toBe('cancelled');
    expect(classifyAttemptOutcome(new AppError('EXEC-003', 'failed'), true)).toBe('cancelled');
    expect(classifyAttemptOutcome(new AppError('EXEC-003', 'failed'), false)).toBe('failed');
    expect(classifyAttemptOutcome(new Error('boom'), false)).toBe('failed');
  });
});

describe('run records and the sink', () => {
  /** Succeeds immediately with fixed metrics, or without metrics. */
  class MetricsAdapter implements ExecutionAdapter {
    constructor(private readonly withMetrics = true) {}
    async execute(request: StageExecutionRequest): Promise<StageExecutionResult> {
      return {
        status: 'success',
        artifacts: [],
        sessionId: `sdk-${request.agentType}`,
        toolCallCount: 1,
        tokenUsage: { input: 10, output: 2, cache: 0 },
        ...(this.withMetrics
          ? {
              metrics: {
                usage: {
                  inputTokens: 10,
                  outputTokens: 2,
                  cacheReadInputTokens: 0,
                  cacheCreationInputTokens: 0,
                  source: 'result' as const,
                },
                turnCount: 1,
                toolUseCount: 1,
                toolUses: { Read: 1 },
                modelId: 'claude-sonnet-4-5',
                models: ['claude-sonnet-4-5'],
                sdkVersion: '0.3.301',
                claudeCodeVersion: '2.1.0',
              },
            }
          : {}),
      };
    }
    async dispose(): Promise<void> {}
  }

  class Orchestrator extends AdsdlcOrchestratorAgent {
    constructor(
      config: OrchestratorConfig,
      private readonly adapter: ExecutionAdapter = new MetricsAdapter(),
      private readonly decide?: () => Promise<ApprovalDecision>
    ) {
      super({ maxRetries: 0, ...config });
    }
    protected override createExecutionAdapter(): ExecutionAdapter {
      return this.adapter;
    }
    protected override approveStage(): Promise<ApprovalDecision> {
      return this.decide?.() ?? super.approveStage({} as never, []);
    }
  }

  async function run(agent: Orchestrator): Promise<PipelineResult> {
    try {
      await agent.startSession({
        projectDir,
        userRequest: 'offline',
        overrideMode: 'import',
        stopAfterStage: 'orchestration',
      });
      return await agent.executePipeline(projectDir, 'offline');
    } finally {
      await agent.dispose();
    }
  }

  it('a failing sink is counted and never changes the run', async () => {
    const result = await run(
      new Orchestrator({
        deliveryMetrics: {
          consent: 'granted',
          sink: () => ({
            location: '.ad-sdlc/scratchpad/metrics/x.jsonl',
            write: () => Promise.reject(new Error('disk full')),
          }),
        },
      })
    );
    expect(result.overallStatus).not.toBe('failed');
    expect(result.metrics!.export).toEqual({
      enabled: true,
      location: '.ad-sdlc/scratchpad/metrics/x.jsonl',
      written: 0,
      failed: result.metrics!.records.length,
      consent: 'granted',
    });
  });

  it('without a sink, records stay on the result only', async () => {
    const result = await run(new Orchestrator({ deliveryMetrics: { consent: 'pending' } }));
    expect(result.metrics!.export).toMatchObject({
      enabled: false,
      written: 0,
      consent: 'pending',
    });
    expect(attempts(result.metrics!.records)).toHaveLength(2);
    // A sink that cannot be created behaves the same.
    const broken = await run(
      new Orchestrator({
        deliveryMetrics: {
          sink: () => {
            throw new Error('no scratchpad');
          },
        },
      })
    );
    expect(broken.metrics!.export.enabled).toBe(false);
  });

  it('an adapter without metrics yields unobserved attempts with unknown usage', async () => {
    const result = await run(new Orchestrator({}, new MetricsAdapter(false)));
    const [first] = attempts(result.metrics!.records);
    expect(first).toMatchObject({
      execution: 'unobserved',
      sdkSessionId: 'sdk-issue-reader',
      usage: { inputTokens: null, source: 'none' },
      turnCount: null,
      toolUseCount: null,
    });
    expect(pipelineRecord(result.metrics!.records).usage).toMatchObject({ source: 'none' });
  });

  it('a run ended by an unexpected error still writes its attempts, stages, and run record', async () => {
    const sink = new MemorySink();
    const agent = new Orchestrator(
      { approvalMode: 'custom', deliveryMetrics: { sink: () => sink } },
      new MetricsAdapter(),
      () => Promise.reject(new TypeError('strategy crashed'))
    );
    await expect(run(agent)).rejects.toThrow('strategy crashed');
    expect(sink.records.map((record) => record.kind)).toEqual(['attempt', 'stage', 'pipeline']);
    expect(pipelineRecord(sink.records)).toMatchObject({
      status: 'failed',
      exitCode: 1,
      errorType: 'TypeError',
      verification: null,
      approval: null,
      attempts: { total: 1 },
    });
  });

  it('a stage result that cannot be projected is counted, never thrown', async () => {
    const recorder = new DeliveryMetricsRecorder({ sessionId: 's-1', runId: 'r-1', startedAt: 0 });
    const summary = await recorder.finish({
      session: {
        sessionId: 's-1',
        projectDir,
        userRequest: 'offline',
        mode: 'import',
        startedAt: new Date(0).toISOString(),
        status: 'running',
        stageResults: [],
        scratchpadDir: join(projectDir, '.ad-sdlc/scratchpad'),
        localMode: false,
      },
      stages: [
        {
          name: 'issue_reading',
          agentType: 'issue-reader',
          status: 'completed',
          durationMs: 1,
          output: '',
          artifacts: [],
          error: null,
          retryCount: 0,
          // A malformed record (no checks) from an untrusted source.
          verification: { stage: 'issue_reading', state: 'verified_pass' } as never,
        },
      ],
      restored: new Set(),
    });
    expect(summary.export.failed).toBe(1);
    expect(summary.records.map((record) => record.kind)).toEqual(['pipeline']);
  });
});
