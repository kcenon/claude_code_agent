import { describe, it, expect } from 'vitest';
import { MockExecutionAdapter } from '../../src/execution/MockExecutionAdapter.js';
import type { StageExecutionRequest, StageExecutionResult } from '../../src/execution/types.js';

const baseRequest: StageExecutionRequest = {
  agentType: 'worker',
  workOrder: 'implement issue #1',
  priorOutputs: {},
};

describe('MockExecutionAdapter', () => {
  it('returns the default success result when no handler matches', async () => {
    const adapter = new MockExecutionAdapter();
    const result = await adapter.execute(baseRequest);
    expect(result.status).toBe('success');
    expect(result.sessionId).toBe('mock-session');
    expect(result.tokenUsage).toEqual({ input: 0, output: 0, cache: 0 });
  });

  it('records every call in invocation order', async () => {
    const adapter = new MockExecutionAdapter();
    await adapter.execute({ ...baseRequest, agentType: 'a' });
    await adapter.execute({ ...baseRequest, agentType: 'b' });
    expect(adapter.calls.map((c) => c.agentType)).toEqual(['a', 'b']);
  });

  it('uses the first matching handler in registration order', async () => {
    const winning: StageExecutionResult = {
      status: 'success',
      artifacts: [{ path: 'first.txt' }],
      sessionId: 's-first',
      toolCallCount: 1,
      tokenUsage: { input: 1, output: 1, cache: 0 },
    };
    const adapter = new MockExecutionAdapter({
      handlers: [
        { match: (r) => r.agentType === 'worker', respond: winning },
        {
          match: () => true,
          respond: { ...winning, sessionId: 's-fallback', artifacts: [] },
        },
      ],
    });
    const result = await adapter.execute(baseRequest);
    expect(result.sessionId).toBe('s-first');
    expect(result.artifacts).toEqual([{ path: 'first.txt' }]);
  });

  it('supports a function-based handler that inspects the request', async () => {
    const adapter = new MockExecutionAdapter({
      handlers: [
        {
          match: () => true,
          respond: (req) => ({
            status: 'success',
            artifacts: [{ path: `${req.agentType}.out` }],
            sessionId: `s-${req.agentType}`,
            toolCallCount: 0,
            tokenUsage: { input: 0, output: 0, cache: 0 },
          }),
        },
      ],
    });
    const result = await adapter.execute({ ...baseRequest, agentType: 'controller' });
    expect(result.artifacts).toEqual([{ path: 'controller.out' }]);
    expect(result.sessionId).toBe('s-controller');
  });

  it('addHandler registers handlers at runtime', async () => {
    const adapter = new MockExecutionAdapter();
    adapter.addHandler({
      match: () => true,
      respond: {
        status: 'failed',
        artifacts: [],
        sessionId: 's',
        toolCallCount: 0,
        tokenUsage: { input: 0, output: 0, cache: 0 },
      },
    });
    const result = await adapter.execute(baseRequest);
    expect(result.status).toBe('failed');
  });

  it('returns an aborted result when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter = new MockExecutionAdapter();
    const result = await adapter.execute({ ...baseRequest, signal: controller.signal });
    expect(result.status).toBe('aborted');
    expect(adapter.calls).toHaveLength(0);
  });

  it('aborted execute carries the resume sessionId when provided', async () => {
    const controller = new AbortController();
    controller.abort();
    const adapter = new MockExecutionAdapter();
    const result = await adapter.execute({
      ...baseRequest,
      resume: 'prior-session',
      signal: controller.signal,
    });
    expect(result.sessionId).toBe('prior-session');
  });

  it('resetCalls clears recorded calls but keeps handlers', async () => {
    const adapter = new MockExecutionAdapter({
      handlers: [
        {
          match: () => true,
          respond: {
            status: 'success',
            artifacts: [],
            sessionId: 'kept',
            toolCallCount: 0,
            tokenUsage: { input: 0, output: 0, cache: 0 },
          },
        },
      ],
    });
    await adapter.execute(baseRequest);
    expect(adapter.calls).toHaveLength(1);
    adapter.resetCalls();
    expect(adapter.calls).toHaveLength(0);
    const result = await adapter.execute(baseRequest);
    expect(result.sessionId).toBe('kept');
  });

  it('throws when execute is called after dispose', async () => {
    const adapter = new MockExecutionAdapter();
    await adapter.dispose();
    await expect(adapter.execute(baseRequest)).rejects.toThrow(/dispose/);
  });
});
