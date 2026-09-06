/** Offline integration lane: production scheduler, orchestrator and SDK adapter. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineFailedError, StageTimeoutError } from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  IMPORT_STAGES,
  type OrchestratorConfig,
  type OrchestratorSession,
  type PipelineStageDefinition,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { AppError } from '../../src/errors/AppError.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import type { ExecutionAdapter, StageExecutionResult } from '../../src/execution/types.js';
import { ControlledQuery, deferred } from '../execution/fixtures/controlledSdk.js';
import { installAgent, sdkAssistant, sdkResult } from '../execution/fixtures/sdk.js';

let projectDir: string;
beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'scheduler-sdk-lifecycle-'));
  for (const stage of IMPORT_STAGES) await installAgent(projectDir, stage.agentType);
});
afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

class SdkOrchestrator extends AdsdlcOrchestratorAgent {
  creations = 0;
  constructor(
    readonly adapter: ExecutionAdapter,
    config: OrchestratorConfig = {}
  ) {
    super({ maxRetries: 2, timeouts: { default: 20000 }, ...config });
  }
  protected override createExecutionAdapter(): ExecutionAdapter {
    this.creations++;
    return this.adapter;
  }
  // Probes the production admission barrier for an invocation queued before shutdown.
  invokeQueued(stage: PipelineStageDefinition, session: OrchestratorSession) {
    return this.executeViaAdapter(stage, session);
  }
  stageOutput(result: StageExecutionResult) {
    return this.toStageOutput(IMPORT_STAGES[0]!, result);
  }
}

async function pipeline(
  config: OrchestratorConfig = {},
  abortMode: 'reject' | 'end' | 'ignore' = 'reject'
) {
  const queries: ControlledQuery[] = [];
  const arrivals = [
    deferred<ControlledQuery>(),
    deferred<ControlledQuery>(),
    deferred<ControlledQuery>(),
  ];
  const adapter = new SdkExecutionAdapter({
    cleanupGraceMs: 50,
    loader: async () => ({
      query: (input) => {
        if (queries.some((query) => query.writerActive))
          throw new Error('Replacement overlaps prior cleanup');
        const query = new ControlledQuery(
          input,
          [
            sdkAssistant('partial-sdk', {
              usage: sdkResult({ usage: { input_tokens: 10, output_tokens: 3 } }).usage,
            }),
          ],
          abortMode
        );
        queries.push(query);
        arrivals[queries.length - 1]?.resolve(query);
        return query;
      },
    }),
  });
  const orchestrator = new SdkOrchestrator(adapter, config);
  const session = await orchestrator.startSession({
    projectDir,
    userRequest: 'offline',
    overrideMode: 'import',
    stopAfterStage: 'issue_reading',
  });
  let settled = false;
  const execution = orchestrator.executePipeline(projectDir, 'offline').then(
    (result) => {
      settled = true;
      return { result, error: undefined };
    },
    (error: unknown) => {
      settled = true;
      return { result: undefined, error };
    }
  );
  const query = await arrivals[0]!.promise;
  await query.reading.promise;
  return {
    orchestrator,
    adapter,
    session,
    execution,
    query,
    queries,
    arrivals,
    isSettled: () => settled,
  };
}

describe('production timeout and retry cleanup barriers', () => {
  it('times out only after outer Query cleanup, retains the timeout and does not retry an exhausted budget', async () => {
    const run = await pipeline({ timeouts: { default: 100 } });
    await run.query.writeArtifact();
    await vi.advanceTimersByTimeAsync(100);
    expect(run.query.controller.signal.reason).toBeInstanceOf(StageTimeoutError);
    await run.query.returning.promise;
    expect(run.isSettled()).toBe(false);
    expect(run.query.writerActive).toBe(true);
    run.query.cleanupGate.resolve();
    const outcome = await run.execution;
    expect(outcome.error).toBeInstanceOf(PipelineFailedError);
    expect(run.orchestrator.getStatus().stages[0]).toMatchObject({
      status: 'failed',
      retryCount: 0,
      error: expect.stringContaining('timed out'),
      errorDetails: {
        code: 'EXEC-005',
        context: {
          status: 'aborted',
          sessionId: 'partial-sdk',
          toolCallCount: 1,
          tokenUsage: { input: 10, output: 3, cache: 0 },
          timeoutMs: 100,
        },
      },
    });
    expect(run.queries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(await run.query.writeArtifact()).toBe(false);
    await run.orchestrator.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts a retryable early failure replacement strictly after cleanup and existing backoff', async () => {
    const run = await pipeline();
    run.query.terminal.resolve(new Error('temporary SDK failure'));
    await run.query.returning.promise;
    await vi.advanceTimersByTimeAsync(25);
    expect(run.queries).toHaveLength(1);
    expect(run.isSettled()).toBe(false);
    run.query.cleanupGate.resolve();
    await run.query.cleaned.promise;
    await vi.advanceTimersByTimeAsync(4999);
    expect(run.queries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const replacement = await run.arrivals[1]!.promise;
    expect(run.query.writerActive).toBe(false);
    replacement.finish();
    replacement.cleanupGate.resolve();
    expect((await run.execution).result?.stages[0]).toMatchObject({
      status: 'completed',
      retryCount: 1,
    });
    expect(run.orchestrator.creations).toBe(1);
    await run.orchestrator.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not invoke a replacement when the total budget expires during backoff', async () => {
    const run = await pipeline({ timeouts: { default: 4000 } });
    run.query.terminal.resolve(new Error('early failure'));
    await run.query.returning.promise;
    run.query.cleanupGate.resolve();
    await run.query.cleaned.promise;
    await vi.advanceTimersByTimeAsync(4000);
    expect((await run.execution).error).toBeInstanceOf(PipelineFailedError);
    expect(run.orchestrator.getStatus().stages[0]).toMatchObject({
      retryCount: 0,
      error: expect.stringContaining('budget exhausted'),
    });
    expect(run.queries).toHaveLength(1);
    await run.orchestrator.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pipeline cancellation joins cleanup and concurrent disposal without adapter recreation', async () => {
    const run = await pipeline({}, 'ignore');
    const disposal = run.orchestrator.dispose();
    expect(run.orchestrator.dispose()).toBe(disposal);
    await run.query.returning.promise;
    await vi.advanceTimersByTimeAsync(0);
    expect(run.isSettled()).toBe(false);
    await expect(
      run.orchestrator.invokeQueued(IMPORT_STAGES[0]!, run.session)
    ).rejects.toMatchObject({ code: 'EXEC-002', category: 'fatal' });
    expect(run.orchestrator.creations).toBe(1);
    run.query.finish(); // SDK reports success after cancellation
    run.query.cleanupGate.resolve();
    await disposal;
    expect((await run.execution).error).toBeInstanceOf(PipelineFailedError);
    expect(run.queries).toHaveLength(1);
    expect(run.orchestrator.dispose()).toBe(disposal);
    await vi.advanceTimersByTimeAsync(30000);
    expect(await run.query.writeArtifact()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the production backoff timer and never invokes another attempt', async () => {
    const run = await pipeline();
    run.query.terminal.resolve(new Error('early failure'));
    await run.query.returning.promise;
    run.query.cleanupGate.resolve();
    await run.query.cleaned.promise;
    await vi.advanceTimersByTimeAsync(1000);
    const disposal = run.orchestrator.dispose();
    await disposal;
    expect((await run.execution).error).toBeInstanceOf(PipelineFailedError);
    await vi.advanceTimersByTimeAsync(30000);
    expect(run.queries).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['reject', 'timeout'] as const)(
    'preserves a first-attempt fatal %s diagnostic, partial usage and secondary disposal error',
    async (failure) => {
      const run = await pipeline({ timeouts: { default: 100 } });
      if (failure === 'timeout') await vi.advanceTimersByTimeAsync(100);
      else run.query.terminal.resolve(new Error('original SDK failure'));
      await run.query.returning.promise;
      if (failure === 'timeout') await vi.advanceTimersByTimeAsync(50);
      else run.query.cleanupGate.reject(new Error('outer cleanup rejected'));
      const outcome = await run.execution;
      expect(outcome.error).toBeInstanceOf(PipelineFailedError); // primary identity retained
      expect(outcome.error).toMatchObject({
        cleanupErrors: [expect.objectContaining({ code: 'EXEC-004' })],
      });
      const result = run.orchestrator.getStatus().stages[0];
      expect(result).toMatchObject({
        status: 'failed',
        retryCount: 0,
        error: expect.stringContaining('SDK cleanup'),
        errorDetails: {
          code: 'EXEC-004',
          category: 'fatal',
          context: {
            phase: 'adapter',
            status: failure === 'timeout' ? 'aborted' : 'failed',
            sessionId: 'partial-sdk',
            toolCallCount: 1,
            tokenUsage: { input: 10, output: 3, cache: 0 },
          },
          cause: {
            message: expect.stringContaining(
              failure === 'timeout' ? 'timed out' : 'original SDK failure'
            ),
          },
        },
      });
      expect(run.queries).toHaveLength(1);
      expect(run.orchestrator.creations).toBe(1);
      await expect(
        run.orchestrator.invokeQueued(IMPORT_STAGES[0]!, run.session)
      ).rejects.toMatchObject({ category: 'fatal' });
      if (failure === 'timeout')
        run.query.cleanupGate.reject(new Error('late lifecycle rejection'));
      await vi.advanceTimersByTimeAsync(30000);
      await expect(run.orchestrator.dispose()).rejects.toThrow('Orchestrator disposal failed');
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('uses a bounded scheduler fallback for an invocation that ignores cancellation and observes late rejection', async () => {
    const invocation = deferred<StageExecutionResult>();
    const entered = deferred<void>();
    let calls = 0;
    const adapter: ExecutionAdapter = {
      cleanupGraceMs: 50,
      execute: () => {
        calls++;
        entered.resolve();
        return invocation.promise;
      },
      dispose: async () => {},
    };
    const orchestrator = new SdkOrchestrator(adapter, { timeouts: { default: 100 } });
    await orchestrator.startSession({ projectDir, userRequest: 'offline', overrideMode: 'import' });
    const outcome = orchestrator.executePipeline(projectDir, 'offline').catch((error) => error);
    await entered.promise;
    await vi.advanceTimersByTimeAsync(1150); // execution + adapter grace + propagation margin
    expect(await outcome).toBeInstanceOf(PipelineFailedError);
    expect(orchestrator.getStatus().stages[0]).toMatchObject({
      retryCount: 0,
      errorDetails: {
        code: 'EXEC-004',
        category: 'fatal',
        context: { phase: 'scheduler' },
        cause: { message: expect.stringContaining('timed out') },
      },
    });
    invocation.reject(new Error('late invocation rejection'));
    await vi.advanceTimersByTimeAsync(30000);
    expect(calls).toBe(1);
    await orchestrator.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never dispatches queued parallel stages after the shared adapter cleanup fails', async () => {
    for (const name of ['document-reader', 'codebase-analyzer', 'code-reader'])
      await installAgent(projectDir, name);
    const started = deferred<ControlledQuery>();
    let queries = 0;
    const adapter = new SdkExecutionAdapter({
      cleanupGraceMs: 50,
      loader: async () => ({
        query: (input) => {
          queries++;
          const query = new ControlledQuery(input);
          started.resolve(query);
          return query;
        },
      }),
    });
    const orchestrator = new SdkOrchestrator(adapter, { maxParallelAgents: 1 });
    await orchestrator.startSession({
      projectDir,
      userRequest: 'offline',
      overrideMode: 'enhancement',
    });
    const outcome = orchestrator.executePipeline(projectDir, 'offline').catch((error) => error);
    const query = await started.promise;
    await query.reading.promise;
    query.terminal.resolve(new Error('early SDK failure'));
    await query.returning.promise;
    query.cleanupGate.reject(new Error('cleanup failed'));
    expect(await outcome).toBeInstanceOf(PipelineFailedError);
    expect(queries).toBe(1);
    expect(orchestrator.creations).toBe(1);
    const stages = orchestrator.getStatus().stages;
    expect(stages[0]).toMatchObject({ retryCount: 0, errorDetails: { code: 'EXEC-004' } });
    expect(stages.find((stage) => stage.name === 'codebase_analysis')).toMatchObject({
      status: 'failed',
      retryCount: 0,
      error: expect.stringContaining('aborted'),
    });
    await expect(orchestrator.dispose()).rejects.toThrow('Orchestrator disposal failed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the serialized error category, code, cause and context through toStageOutput', async () => {
    const cause = new AppError('TEST-CAUSE', 'original failure', { context: { detail: 42 } });
    const serialized = new AppError('EXEC-004', 'cleanup failed', {
      category: 'fatal',
      cause,
      context: { unresolved: true },
    }).toJSON();
    const adapter = new SdkExecutionAdapter();
    const orchestrator = new SdkOrchestrator(adapter);
    expect(() =>
      orchestrator.stageOutput({
        status: 'aborted',
        artifacts: [],
        sessionId: 'partial',
        toolCallCount: 4,
        tokenUsage: { input: 100, output: 30, cache: 5 },
        error: serialized,
      })
    ).toThrow(
      expect.objectContaining({
        code: 'EXEC-004',
        category: 'fatal',
        cause: expect.objectContaining({ code: 'TEST-CAUSE', context: { detail: 42 } }),
        context: expect.objectContaining({
          unresolved: true,
          status: 'aborted',
          sessionId: 'partial',
          toolCallCount: 4,
        }),
      })
    );
    await orchestrator.dispose();
  });
});
