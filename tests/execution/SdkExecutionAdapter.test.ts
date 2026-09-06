import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installAgent, sdkResult, sdkStatus, sdkAssistant } from './fixtures/sdk.js';
import {
  renderPrompt,
  SdkExecutionAdapter,
  type SdkLike,
  type SdkMessage,
  type SdkQueryOptions,
} from '../../src/execution/SdkExecutionAdapter.js';
import type { StageExecutionRequest } from '../../src/execution/types.js';

function fakeSdk(
  messages: readonly SdkMessage[],
  opts: { onCall?: (q: SdkQueryOptions) => void } = {}
): SdkLike {
  return {
    query(q) {
      opts.onCall?.(q);
      return (async function* () {
        for (const m of messages) yield m;
      })();
    },
  };
}

const projectDir = await mkdtemp(join(tmpdir(), 'sdk-adapter-'));
beforeAll(async () => {
  await installAgent(projectDir);
});
afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

const baseRequest: StageExecutionRequest = {
  projectDir,
  agentType: 'worker',
  workOrder: 'implement issue #42',
  priorOutputs: {},
};

const successMessages: SdkMessage[] = [
  sdkStatus('s-123'),
  sdkAssistant('s-123'),
  sdkResult({
    type: 'result',
    session_id: 's-123',
    result: 'src/foo.ts: implementation file\nsrc/foo.test.ts: unit test',
    is_error: false,
    num_turns: 4,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 30 },
  }),
];

describe('SdkExecutionAdapter', () => {
  describe('renderPrompt', () => {
    it('embeds every priorOutputs entry verbatim under labeled headers', () => {
      const prompt = renderPrompt({
        projectDir,
        agentType: 'worker',
        workOrder: 'WORK',
        priorOutputs: { srs: 'SRS-CONTENT', sds: 'SDS-CONTENT' },
      });
      expect(prompt).toContain('# Stage: worker');
      expect(prompt).toContain('## Work order\n\nWORK');
      expect(prompt).toContain('### srs\n\nSRS-CONTENT');
      expect(prompt).toContain('### sds\n\nSDS-CONTENT');
    });

    it('omits the prior outputs section when none are provided', () => {
      const prompt = renderPrompt(baseRequest);
      expect(prompt).not.toContain('## Prior outputs');
    });
  });

  describe('execute - success path', () => {
    it('extracts session id, tool count, token usage and artifacts from messages', async () => {
      const adapter = new SdkExecutionAdapter({ loader: async () => fakeSdk(successMessages) });
      const result = await adapter.execute(baseRequest);
      expect(result.status).toBe('success');
      expect(result.sessionId).toBe('s-123');
      expect(result.toolCallCount).toBe(4);
      expect(result.tokenUsage).toEqual({ input: 100, output: 50, cache: 30 });
      expect(result.artifacts).toEqual([
        { path: 'src/foo.ts', description: 'implementation file' },
        { path: 'src/foo.test.ts', description: 'unit test' },
      ]);
    });

    it('forwards skills, mcpServers, maxTurns, resume and signal to the SDK options', async () => {
      let captured: SdkQueryOptions | undefined;
      const adapter = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (captured = q) }),
      });
      const controller = new AbortController();
      await adapter.execute({
        ...baseRequest,
        skills: ['foo', 'bar'],
        mcpServers: { github: { type: 'stdio', command: 'gh' } },
        maxTurns: 7,
        resume: 'prior-session',
        signal: controller.signal,
      });
      expect(captured?.options?.skills).toEqual(['foo', 'bar']);
      expect(captured?.options?.mcpServers).toEqual({ github: { type: 'stdio', command: 'gh' } });
      expect(captured?.options?.maxTurns).toBe(7);
      expect(captured?.options?.resume).toBe('prior-session');
      expect(captured?.options?.abortController).toBeInstanceOf(AbortController);
      expect(captured?.options?.abortController?.signal).not.toBe(controller.signal);
      expect(captured?.options).not.toHaveProperty('signal');
    });

    it('forwards skills only when provided and omits the option otherwise', async () => {
      let withCaptured: SdkQueryOptions | undefined;
      let withoutCaptured: SdkQueryOptions | undefined;

      const adapterWith = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withCaptured = q) }),
      });
      await adapterWith.execute({ ...baseRequest, skills: ['coding-guidelines'] });
      expect(withCaptured?.options?.skills).toEqual(['coding-guidelines']);

      const adapterWithout = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withoutCaptured = q) }),
      });
      await adapterWithout.execute(baseRequest);
      expect(withoutCaptured?.options).toBeDefined();
      expect(withoutCaptured?.options).not.toHaveProperty('skills');
    });

    it('forwards mcpServers only when provided and omits the option otherwise', async () => {
      let withCaptured: SdkQueryOptions | undefined;
      let withoutCaptured: SdkQueryOptions | undefined;

      const adapterWith = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withCaptured = q) }),
      });
      await adapterWith.execute({
        ...baseRequest,
        mcpServers: { docs: { type: 'http', url: 'https://example.com/mcp' } },
      });
      expect(withCaptured?.options?.mcpServers).toEqual({
        docs: { type: 'http', url: 'https://example.com/mcp' },
      });

      const adapterWithout = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withoutCaptured = q) }),
      });
      await adapterWithout.execute(baseRequest);
      expect(withoutCaptured?.options).not.toHaveProperty('mcpServers');
    });

    it('forwards maxTurns only when provided and omits the option otherwise', async () => {
      let withCaptured: SdkQueryOptions | undefined;
      let withoutCaptured: SdkQueryOptions | undefined;

      const adapterWith = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withCaptured = q) }),
      });
      await adapterWith.execute({ ...baseRequest, maxTurns: 12 });
      expect(withCaptured?.options?.maxTurns).toBe(12);

      const adapterWithout = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withoutCaptured = q) }),
      });
      await adapterWithout.execute(baseRequest);
      expect(withoutCaptured?.options).not.toHaveProperty('maxTurns');
    });

    it('forwards permissionMode only when provided and omits the option otherwise', async () => {
      let withCaptured: SdkQueryOptions | undefined;
      let withoutCaptured: SdkQueryOptions | undefined;

      const adapterWith = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withCaptured = q) }),
      });
      await adapterWith.execute({ ...baseRequest, permissionMode: 'acceptEdits' });
      expect(withCaptured?.options?.permissionMode).toBe('acceptEdits');

      const adapterWithout = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (withoutCaptured = q) }),
      });
      await adapterWithout.execute(baseRequest);
      expect(withoutCaptured?.options).not.toHaveProperty('permissionMode');
    });

    it('embeds priorOutputs in the prompt forwarded to the SDK (priorOutputs contract)', async () => {
      let captured: SdkQueryOptions | undefined;
      const adapter = new SdkExecutionAdapter({
        loader: async () => fakeSdk(successMessages, { onCall: (q) => (captured = q) }),
      });
      await adapter.execute({
        ...baseRequest,
        priorOutputs: { srs: 'srs body', controller: 'controller plan' },
      });
      expect(captured?.prompt).toContain('### srs\n\nsrs body');
      expect(captured?.prompt).toContain('### controller\n\ncontroller plan');
    });
  });

  describe('execute - failure paths', () => {
    it('returns failed when the result message has is_error=true', async () => {
      const adapter = new SdkExecutionAdapter({
        loader: async () =>
          fakeSdk([
            sdkResult({ session_id: 's-err', result: 'something went wrong', is_error: true }),
          ]),
      });
      const result = await adapter.execute(baseRequest);
      expect(result.status).toBe('failed');
      expect(result.sessionId).toBe('s-err');
      expect(result.error?.code).toBe('EXEC-003');
    });

    it('reduces official error-result variants with useful SDK error details', async () => {
      const { result: _result, subtype: _subtype, ...message } = sdkResult();
      const failure: import('@anthropic-ai/claude-agent-sdk').SDKResultError = {
        ...message,
        subtype: 'error_max_turns',
        is_error: true,
        errors: ['Stage exceeded its turn limit'],
      };
      const adapter = new SdkExecutionAdapter({ loader: async () => fakeSdk([failure]) });
      const result = await adapter.execute(baseRequest);
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('Stage exceeded its turn limit');
    });

    it('returns failed when no result message is emitted', async () => {
      const adapter = new SdkExecutionAdapter({
        loader: async () => fakeSdk([sdkStatus('s-empty')]),
      });
      const result = await adapter.execute(baseRequest);
      expect(result.status).toBe('failed');
      expect(result.sessionId).toBe('s-empty');
    });

    it('returns failed and serializes the thrown error', async () => {
      const adapter = new SdkExecutionAdapter({
        loader: async () => ({
          query() {
            throw new Error('boom');
          },
        }),
      });
      const result = await adapter.execute(baseRequest);
      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('boom');
    });
  });

  describe('execute - cancellation', () => {
    it('returns aborted when the signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const adapter = new SdkExecutionAdapter({ loader: async () => fakeSdk(successMessages) });
      const result = await adapter.execute({ ...baseRequest, signal: controller.signal });
      expect(result.status).toBe('aborted');
    });
  });

  describe('lifecycle', () => {
    it('throws when execute is called after dispose', async () => {
      const adapter = new SdkExecutionAdapter({ loader: async () => fakeSdk(successMessages) });
      await adapter.dispose();
      await expect(adapter.execute(baseRequest)).rejects.toThrow(/dispose/);
    });

    it('caches the resolved sdk so the loader runs once', async () => {
      let calls = 0;
      const adapter = new SdkExecutionAdapter({
        loader: async () => {
          calls += 1;
          return fakeSdk(successMessages);
        },
      });
      await adapter.execute(baseRequest);
      await adapter.execute(baseRequest);
      expect(calls).toBe(1);
    });
  });
});

describe('official SDK options and cancellation bridge', () => {
  it('copies readonly skills and MCP args while preserving other server settings', async () => {
    const skills = Object.freeze(['coding']);
    const args = Object.freeze(['--offline']);
    const stdio = {
      type: 'stdio',
      command: 'node',
      args,
      env: { MODE: 'offline' },
      timeout: 2500,
      alwaysLoad: true,
    } as const;
    const http = {
      type: 'http',
      url: 'https://example.invalid/mcp',
      headers: { Authorization: 'test' },
    } as const;
    let captured: SdkQueryOptions | undefined;
    const adapter = new SdkExecutionAdapter({
      loader: async () =>
        fakeSdk(successMessages, {
          onCall: (q) => {
            captured = q;
          },
        }),
    });
    await adapter.execute({ ...baseRequest, skills, mcpServers: { stdio, http } });
    expect(captured?.options?.skills).toEqual(skills);
    expect(captured?.options?.skills).not.toBe(skills);
    expect(captured?.options?.mcpServers).toEqual({ stdio, http });
    const server = captured?.options?.mcpServers?.stdio;
    expect(server && 'args' in server ? server.args : undefined).not.toBe(args);
    expect(captured?.options).not.toHaveProperty('resume');
    expect(captured?.options).not.toHaveProperty('abortController');
  });

  it.each(['success', 'failure', 'aborted'] as const)(
    'removes the bridge listener after %s',
    async (outcome) => {
      const controller = new AbortController();
      const add = vi.spyOn(controller.signal, 'addEventListener');
      const remove = vi.spyOn(controller.signal, 'removeEventListener');
      let sdkController: AbortController | undefined;
      const reason = new Error('cancel this stage');
      const adapter = new SdkExecutionAdapter({
        loader: async () => ({
          async *query({ options }) {
            sdkController = options?.abortController;
            expect(sdkController).toBeInstanceOf(AbortController);
            if (outcome === 'aborted') {
              controller.abort(reason);
              expect(sdkController?.signal.aborted).toBe(true);
              expect(sdkController?.signal.reason).toBe(reason);
              throw reason;
            }
            if (outcome === 'failure') throw new Error('SDK failure');
            yield sdkResult();
          },
        }),
      });
      const result = await adapter.execute({ ...baseRequest, signal: controller.signal });
      expect(result.status).toBe(outcome === 'failure' ? 'failed' : outcome);
      expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0]?.[1]);
      if (outcome !== 'aborted') {
        controller.abort();
        expect(sdkController?.signal.aborted).toBe(false);
      }
    }
  );

  it('does not load or query the SDK for pre-aborted requests', async () => {
    const controller = new AbortController();
    controller.abort('before execution');
    const loader = vi.fn(async () => fakeSdk(successMessages));
    const result = await new SdkExecutionAdapter({ loader }).execute({
      ...baseRequest,
      signal: controller.signal,
      resume: 'prior-session',
    });
    expect(result.status).toBe('aborted');
    expect(result.sessionId).toBe('prior-session');
    expect(loader).not.toHaveBeenCalled();
  });

  it('does not query when aborted during SDK loading', async () => {
    const controller = new AbortController();
    const query = vi.fn(() => fakeSdk(successMessages).query({ prompt: '' }));
    const adapter = new SdkExecutionAdapter({
      loader: async () => {
        controller.abort('loading');
        return { query };
      },
    });
    expect((await adapter.execute({ ...baseRequest, signal: controller.signal })).status).toBe(
      'aborted'
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('serializes loader errors and removes its abort listener', async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const adapter = new SdkExecutionAdapter({
      loader: async () => {
        throw new Error('load failed');
      },
    });
    const result = await adapter.execute({ ...baseRequest, signal: controller.signal });
    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('load failed');
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
