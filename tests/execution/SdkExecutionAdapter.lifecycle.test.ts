import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SDKMessage, SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import { SdkExecutionAdapter, type SdkLike } from '../../src/execution/SdkExecutionAdapter.js';
import { resolveProjectAgent } from '../../src/execution/resolveProjectAgent.js';
import type { StageExecutionRequest } from '../../src/execution/types.js';
import { ControlledQuery, deferred } from './fixtures/controlledSdk.js';
import { installAgent, sdkAssistant, sdkResult } from './fixtures/sdk.js';

let projectDir: string;
beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'sdk-lifecycle-'));
  await installAgent(projectDir);
});
afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const request = (extra: Partial<StageExecutionRequest> = {}): StageExecutionRequest => ({
  projectDir,
  agentType: 'worker',
  workOrder: 'offline lifecycle',
  priorOutputs: {},
  ...extra,
});

function boundary(
  messages: readonly SDKMessage[] = [],
  abortMode: 'reject' | 'end' | 'ignore' = 'reject'
) {
  const started = deferred<ControlledQuery>();
  const queries: ControlledQuery[] = [];
  const sdk: SdkLike = {
    query: vi.fn((input) => {
      const query = new ControlledQuery(input, messages, abortMode);
      queries.push(query);
      started.resolve(query);
      return query;
    }),
  };
  return { sdk, started, queries };
}

async function launch(
  messages: readonly SDKMessage[] = [],
  abortMode: 'reject' | 'end' | 'ignore' = 'reject'
) {
  const sdk = boundary(messages, abortMode);
  const adapter = new SdkExecutionAdapter({ loader: async () => sdk.sdk, cleanupGraceMs: 50 });
  const caller = new AbortController();
  const execution = adapter.execute(request({ signal: caller.signal }));
  const query = await sdk.started.promise;
  await query.reading.promise;
  return { ...sdk, adapter, caller, execution, query };
}

async function expectPending(promise: Promise<unknown>) {
  const settled = vi.fn();
  void promise.then(settled, settled);
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).not.toHaveBeenCalled();
}

describe('owned execution lifecycle', () => {
  it.each([new Error('exact error'), 'text reason', { why: 'object reason' }, 0])(
    'forwards the exact reason %s into its distinct official controller',
    async (reason) => {
      const { adapter, caller, execution, query } = await launch();
      expect(query.controller).not.toBe(caller);
      caller.abort(reason);
      expect(query.controller.signal.reason).toBe(reason);
      await query.returning.promise;
      await expectPending(execution);
      query.cleanupGate.resolve();
      expect((await execution).status).toBe('aborted');
      await adapter.dispose();
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each(['reject', 'end'] as const)(
    'joins the outer Query cleanup after abort with iterator %s',
    async (abortMode) => {
      const { adapter, caller, execution, query } = await launch([], abortMode);
      expect(query[Symbol.asyncIterator]()).not.toBe(query);
      const remove = vi.spyOn(caller.signal, 'removeEventListener');
      await query.writeArtifact();
      caller.abort(new Error('cancel writer'));
      await query.returning.promise;
      expect(query.closeCalls).toBe(1);
      expect(query.returnCalls).toBe(1);
      expect(query.writerActive).toBe(true); // close alone provides no cleanup evidence
      await expectPending(execution);
      query.cleanupGate.resolve();
      const result = await execution;
      expect(result.status).toBe('aborted');
      expect(result.error?.cause?.message).toBe('cancel writer');
      expect(remove).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10000);
      expect(await query.writeArtifact()).toBe(false);
      expect(await readFile(join(projectDir, 'lifecycle-sentinel.txt'), 'utf8')).toBe('1');
      await adapter.dispose();
      expect(query.returnCalls).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('joins consumption as well as return when an iterator ignores cancellation', async () => {
    const { adapter, caller, execution, query } = await launch([], 'ignore');
    caller.abort('cancel');
    await query.returning.promise;
    query.cleanupGate.resolve();
    await expectPending(execution);
    query.terminal.resolve(undefined);
    expect((await execution).status).toBe('aborted');
    await adapter.dispose();
  });

  it('never resolves a late SDK success as success after cancellation', async () => {
    const { adapter, caller, execution, query } = await launch([], 'ignore');
    caller.abort('cancel');
    await query.returning.promise;
    query.finish(sdkResult({ num_turns: 4, usage: { input_tokens: 100, output_tokens: 30 } }));
    query.cleanupGate.resolve();
    expect(await execution).toMatchObject({
      status: 'aborted',
      toolCallCount: 4,
      tokenUsage: { input: 100, output: 30 },
    });
    await adapter.dispose();
  });

  it('cancelling one query preserves its sibling; disposal stops queries without caller signals', async () => {
    const { sdk, queries } = boundary();
    const arrivals = deferred<void>();
    const original = sdk.query;
    sdk.query = (input) => {
      const query = original(input);
      if (queries.length === 3) arrivals.resolve();
      return query;
    };
    const adapter = new SdkExecutionAdapter({ loader: async () => sdk });
    const caller = new AbortController();
    const executions = [
      adapter.execute(request({ signal: caller.signal, resume: 'first' })),
      adapter.execute(request({ resume: 'second' })),
      adapter.execute(request({ resume: 'third' })),
    ];
    await arrivals.promise;
    await Promise.all(queries.map((query) => query.reading.promise));
    const first = queries.find((query) => query.input.options?.resume === 'first');
    const second = queries.find((query) => query.input.options?.resume === 'second');
    const third = queries.find((query) => query.input.options?.resume === 'third');
    expect(first && second && third).toBeTruthy();
    expect(new Set(queries.map((query) => query.controller)).size).toBe(3);
    caller.abort('only first');
    first!.cleanupGate.resolve();
    expect((await executions[0])?.status).toBe('aborted');
    expect(second!.controller.signal.aborted).toBe(false);
    expect(third!.controller.signal.aborted).toBe(false);
    expect(await second!.writeArtifact()).toBe(true);

    const disposal = adapter.dispose();
    expect(adapter.dispose()).toBe(disposal);
    const rejected = expect(adapter.execute(request())).rejects.toMatchObject({ code: 'EXEC-002' });
    await rejected;
    await Promise.all([second!.returning.promise, third!.returning.promise]);
    expect(second!.controller.signal.aborted).toBe(true);
    expect(third!.controller.signal.aborted).toBe(true);
    second!.cleanupGate.resolve();
    await expectPending(disposal);
    third!.cleanupGate.resolve();
    await disposal;
    expect(adapter.dispose()).toBe(disposal);
    expect((await Promise.all(executions)).map((result) => result.status)).toEqual([
      'aborted',
      'aborted',
      'aborted',
    ]);
    await vi.advanceTimersByTimeAsync(10000);
    expect(await second!.writeArtifact()).toBe(false);
    expect(await third!.writeArtifact()).toBe(false);
    expect(queries.every((query) => query.closeCalls === 1 && query.returnCalls === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pre-abort skips both agent resolution and SDK loading', async () => {
    const caller = new AbortController();
    caller.abort('already cancelled');
    const loader = vi.fn(async () => boundary().sdk);
    const resolveAgent = vi.fn(resolveProjectAgent);
    const adapter = new SdkExecutionAdapter({ loader, resolveAgent });
    expect(
      await adapter.execute(request({ signal: caller.signal, resume: 'previous' }))
    ).toMatchObject({ status: 'aborted', sessionId: 'previous' });
    expect(loader).not.toHaveBeenCalled();
    expect(resolveAgent).not.toHaveBeenCalled();
    await adapter.dispose();
  });

  it.each(['resolution', 'loading'] as const)(
    'cancellation/disposal during deferred %s prevents a late query',
    async (phase) => {
      for (const action of ['cancel', 'dispose'] as const) {
        const gate = deferred<void>();
        const entered = deferred<void>();
        const sdk = boundary();
        const adapter = new SdkExecutionAdapter({
          cleanupGraceMs: 50,
          resolveAgent: async (...args) => {
            if (phase === 'resolution') {
              entered.resolve();
              await gate.promise;
            }
            return resolveProjectAgent(...args);
          },
          loader: async () => {
            if (phase === 'loading') {
              entered.resolve();
              await gate.promise;
            }
            return sdk.sdk;
          },
        });
        const caller = new AbortController();
        const execution = adapter.execute(request({ signal: caller.signal }));
        await entered.promise;
        const disposal = action === 'dispose' ? adapter.dispose() : undefined;
        if (action === 'cancel') caller.abort('setup cancelled');
        await expectPending(execution);
        gate.resolve();
        expect((await execution).status).toBe('aborted');
        await disposal;
        expect(sdk.sdk.query).not.toHaveBeenCalled();
        await adapter.dispose();
        expect(vi.getTimerCount()).toBe(0);
      }
    }
  );

  it.each(['resolve', 'reject'] as const)(
    'bounds unresolved setup and observes its late %s',
    async (settlement) => {
      const gate = deferred<SdkLike>();
      const entered = deferred<void>();
      const sdk = boundary();
      const adapter = new SdkExecutionAdapter({
        cleanupGraceMs: 50,
        loader: () => {
          entered.resolve();
          return gate.promise;
        },
      });
      const execution = adapter.execute(request());
      await entered.promise;
      const disposal = adapter.dispose();
      const disposalOutcome = disposal.catch((error) => error);
      await vi.advanceTimersByTimeAsync(50);
      expect(await execution).toMatchObject({
        status: 'aborted',
        error: { code: 'EXEC-004', category: 'fatal', context: { unresolved: true } },
      });
      expect(await disposalOutcome).toMatchObject({
        code: 'EXEC-004',
        context: { unresolvedExecutions: 1 },
      });
      if (settlement === 'resolve') gate.resolve(sdk.sdk);
      else gate.reject(new Error('late loader rejection'));
      await vi.advanceTimersByTimeAsync(0);
      expect(sdk.sdk.query).not.toHaveBeenCalled();
      expect(adapter.dispose()).toBe(disposal);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each(['reject', 'timeout'] as const)(
    'reports %s cleanup as fatal and rejects replacement work',
    async (mode) => {
      const { adapter, execution, query, sdk } = await launch();
      query.terminal.resolve(new Error('primary SDK failure'));
      await query.returning.promise;
      if (mode === 'reject') query.cleanupGate.reject(new Error('cleanup rejected'));
      else await vi.advanceTimersByTimeAsync(50);
      const result = await execution;
      expect(result).toMatchObject({
        status: 'failed',
        error: { code: 'EXEC-004', category: 'fatal', cause: { message: 'primary SDK failure' } },
      });
      expect(query.controller.signal.aborted).toBe(true); // teardown must not relabel SDK failure
      await expect(adapter.execute(request())).rejects.toMatchObject({
        code: 'EXEC-004',
        category: 'fatal',
      });
      expect(sdk.query).toHaveBeenCalledTimes(1);
      const disposal = adapter.dispose();
      await expect(disposal).rejects.toMatchObject({ code: 'EXEC-004' });
      expect(adapter.dispose()).toBe(disposal);
      if (mode === 'timeout') query.cleanupGate.reject(new Error('late cleanup rejection'));
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('observes consumption even when the outer return resolves first', async () => {
    const { adapter, caller, execution, query } = await launch([], 'ignore');
    vi.spyOn(query, 'return').mockResolvedValue({ done: true, value: undefined });
    caller.abort('stop');
    await query.closed.promise;
    await expectPending(execution);
    expect(query.return).toHaveBeenCalledOnce();
    query.terminal.resolve(new Error('late iterator rejection'));
    expect((await execution).status).toBe('aborted');
    await adapter.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps permanently unresolved cleanup explicit instead of claiming the writer stopped', async () => {
    const { adapter, caller, execution, query } = await launch();
    caller.abort('cancel unresolved query');
    await query.returning.promise;
    await vi.advanceTimersByTimeAsync(50);
    expect(await execution).toMatchObject({
      status: 'aborted',
      error: {
        code: 'EXEC-004',
        category: 'fatal',
        context: { unresolved: true },
        cause: { message: 'cancel unresolved query' },
      },
    });
    const disposal = adapter.dispose();
    await expect(disposal).rejects.toMatchObject({
      code: 'EXEC-004',
      context: { unresolvedExecutions: 1 },
    });
    await vi.advanceTimersByTimeAsync(100000);
    expect(adapter.dispose()).toBe(disposal);
    expect(query.writerActive).toBe(true);
    expect(await query.writeArtifact()).toBe(true); // failed cleanup provides no shutdown guarantee
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still invokes return after close throws and blocks admission while cleanup is pending', async () => {
    const { adapter, caller, execution, query } = await launch();
    vi.spyOn(query, 'close').mockImplementation(() => {
      throw new Error('close failed');
    });
    caller.abort('original cancellation');
    await query.returning.promise;
    await expect(adapter.execute(request())).rejects.toMatchObject({
      code: 'EXEC-004',
      category: 'fatal',
    });
    await expectPending(execution);
    query.cleanupGate.resolve();
    expect(await execution).toMatchObject({
      status: 'aborted',
      error: {
        code: 'EXEC-004',
        cause: { message: 'original cancellation' },
        context: { cleanupErrors: ['close failed'] },
      },
    });
    await expect(adapter.dispose()).rejects.toMatchObject({ code: 'EXEC-004' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reentrant disposal from an SDK abort listener joins the same operation', async () => {
    const { adapter, execution, query } = await launch();
    let reentrant: Promise<void> | undefined;
    query.controller.signal.addEventListener(
      'abort',
      () => {
        reentrant = adapter.dispose();
      },
      { once: true }
    );
    const disposal = adapter.dispose();
    expect(reentrant).toBe(disposal);
    await query.returning.promise;
    query.cleanupGate.resolve();
    await disposal;
    expect((await execution).status).toBe('aborted');
    expect(query.closeCalls).toBe(1);
    expect(query.returnCalls).toBe(1);
  });

  it('attempts every disposal cleanup even when one rejects', async () => {
    const sdk = boundary();
    const secondStarted = deferred<ControlledQuery>();
    const adapter = new SdkExecutionAdapter({
      loader: async () => ({
        query: (input) => {
          const query = sdk.sdk.query(input);
          if (sdk.queries.length === 2) secondStarted.resolve(sdk.queries[1]!);
          return query;
        },
      }),
    });
    const executions = [adapter.execute(request()), adapter.execute(request())];
    const second = await secondStarted.promise;
    const first = sdk.queries[0]!;
    const disposal = adapter.dispose();
    const outcome = disposal.catch((error) => error);
    await Promise.all(sdk.queries.map((query) => query.returning.promise));
    first.cleanupGate.reject(new Error('first cleanup failed'));
    await expectPending(disposal);
    second.cleanupGate.resolve();
    expect(await outcome).toMatchObject({
      code: 'EXEC-004',
      context: { cleanupErrors: [expect.objectContaining({ code: 'EXEC-004' })] },
    });
    expect((await Promise.all(executions)).every((result) => result.status === 'aborted')).toBe(
      true
    );
    expect(second.writerActive).toBe(false);
  });

  it('prevents an already-admitted setup from starting a query after sibling cleanup fails', async () => {
    const sdk = boundary();
    const setupEntered = deferred<void>();
    const setupGate = deferred<void>();
    let resolutions = 0;
    const adapter = new SdkExecutionAdapter({
      loader: async () => sdk.sdk,
      resolveAgent: async (...args) => {
        if (++resolutions === 2) {
          setupEntered.resolve();
          await setupGate.promise;
        }
        return resolveProjectAgent(...args);
      },
    });
    const first = adapter.execute(request());
    const query = await sdk.started.promise;
    await query.reading.promise;
    const second = adapter.execute(request());
    await setupEntered.promise;
    query.terminal.resolve(new Error('first SDK failure'));
    await query.returning.promise;
    query.cleanupGate.reject(new Error('first cleanup failed'));
    expect((await first).error?.code).toBe('EXEC-004');
    setupGate.resolve();
    expect(await second).toMatchObject({
      status: 'failed',
      error: { code: 'EXEC-004', category: 'fatal' },
    });
    expect(sdk.sdk.query).toHaveBeenCalledTimes(1);
    await expect(adapter.dispose()).rejects.toMatchObject({ code: 'EXEC-004' });
  });
});

describe('partial usage and causal outcomes', () => {
  const usage = {
    input_tokens: 100,
    output_tokens: 30,
    cache_read_input_tokens: 2,
    cache_creation_input_tokens: 3,
  };
  const result = sdkResult({
    session_id: 'latest',
    num_turns: 4,
    usage,
    result: 'src/ok.ts: artifact',
  });
  const assistant = sdkAssistant('partial', { id: 'one', usage: sdkResult({ usage }).usage });

  it('does not relabel an observed SDK error result when cancellation arrives later', async () => {
    const { adapter, caller, execution, query } = await launch([
      sdkResult({ ...result, is_error: true, result: 'SDK failed first' }),
    ]);
    caller.abort('later cancellation');
    await query.returning.promise;
    query.cleanupGate.resolve();
    expect(await execution).toMatchObject({
      status: 'failed',
      sessionId: 'latest',
      toolCallCount: 4,
      tokenUsage: { input: 100, output: 30, cache: 5 },
      error: { cause: { message: 'SDK failed first' } },
    });
    await adapter.dispose();
  });

  it.each(['success', 'throw', 'sdk-error', 'abort'] as const)(
    'retains authoritative result usage on %s',
    async (outcome) => {
      const { result: _text, subtype: _subtype, ...base } = result;
      const sdkError: SDKResultError = {
        ...base,
        subtype: 'error_max_turns',
        is_error: true,
        errors: ['limit reached'],
      };
      const { adapter, caller, execution, query } = await launch([
        assistant,
        assistant,
        outcome === 'sdk-error' ? sdkError : result,
      ]);
      if (outcome === 'abort') caller.abort('partial abort');
      else query.terminal.resolve(outcome === 'throw' ? new Error('after result') : undefined);
      await query.returning.promise;
      await expectPending(execution);
      query.cleanupGate.resolve();
      expect(await execution).toMatchObject({
        status: outcome === 'success' ? 'success' : outcome === 'abort' ? 'aborted' : 'failed',
        sessionId: 'latest',
        toolCallCount: 4,
        tokenUsage: { input: 100, output: 30, cache: 5 },
      });
      if (outcome === 'success')
        expect((await execution).artifacts).toEqual([
          { path: 'src/ok.ts', description: 'artifact' },
        ]);
      if (outcome === 'sdk-error')
        expect((await execution).error?.cause?.message).toBe('limit reached');
      await adapter.dispose();
    }
  );

  it.each(['throw', 'abort'] as const)(
    'deduplicates assistant IDs and retains fallback usage on %s',
    async (outcome) => {
      const second = sdkAssistant('latest-assistant', {
        id: 'two',
        usage: sdkResult({
          usage: { input_tokens: 5, output_tokens: 2, cache_creation_input_tokens: 1 },
        }).usage,
      });
      const { adapter, caller, execution, query } = await launch([assistant, assistant, second]);
      if (outcome === 'abort') caller.abort('partial');
      else query.terminal.resolve(new Error('before result'));
      await query.returning.promise;
      query.cleanupGate.resolve();
      expect(await execution).toMatchObject({
        status: outcome === 'abort' ? 'aborted' : 'failed',
        sessionId: 'latest-assistant',
        toolCallCount: 2,
        tokenUsage: { input: 105, output: 32, cache: 6 },
      });
      await adapter.dispose();
    }
  );

  it('uses the latest usage per repeated assistant ID without inflating turns', async () => {
    const updated = sdkAssistant('latest-repeat', {
      id: 'one',
      usage: sdkResult({ usage: { ...usage, output_tokens: 40 } }).usage,
    });
    const { adapter, caller, execution, query } = await launch([assistant, updated]);
    caller.abort('partial');
    await query.returning.promise;
    query.cleanupGate.resolve();
    expect(await execution).toMatchObject({
      status: 'aborted',
      sessionId: 'latest-repeat',
      toolCallCount: 1,
      tokenUsage: { input: 100, output: 40, cache: 5 },
    });
    await adapter.dispose();
  });
});
