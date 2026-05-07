import { describe, it, expect, vi } from 'vitest';
import {
  buildHookPipeline,
  type ArtifactCaptureEntry,
  type ArtifactSink,
  type SdkHookCallback,
  type SdkToolUseEvent,
} from '../../src/execution/hooks.js';
import {
  SdkExecutionAdapter,
  type SdkLike,
  type SdkMessage,
  type SdkQueryOptions,
} from '../../src/execution/SdkExecutionAdapter.js';
import { MockExecutionAdapter } from '../../src/execution/MockExecutionAdapter.js';
import type { StageExecutionRequest } from '../../src/execution/types.js';

/**
 * Pull the PostToolUse(Edit|Write) callback out of a built pipeline so each
 * test can drive it directly. Keeps assertions focused on capture behaviour
 * rather than SDK plumbing.
 */
function getPostToolUseCallback(
  sink: ArtifactSink,
  options?: { now?: () => Date }
): SdkHookCallback {
  const pipeline = buildHookPipeline(sink, options);
  expect(pipeline.PostToolUse).toBeDefined();
  expect(pipeline.PostToolUse).toHaveLength(1);
  const entry = pipeline.PostToolUse![0];
  expect(entry.matcher).toBe('Edit|Write');
  return entry.callback;
}

function fakeSink(): ArtifactSink & { entries: ArtifactCaptureEntry[] } {
  const entries: ArtifactCaptureEntry[] = [];
  return {
    entries,
    recordArtifact(entry) {
      entries.push(entry);
    },
  };
}

describe('buildHookPipeline', () => {
  describe('configuration shape', () => {
    it('rejects a missing sink', () => {
      // @ts-expect-error — exercising runtime guard
      expect(() => buildHookPipeline(undefined)).toThrowError(/recordArtifact/);
    });

    it('registers a single PostToolUse(Edit|Write) entry and no PreToolUse/Stop entries', () => {
      const sink = fakeSink();
      const pipeline = buildHookPipeline(sink);
      expect(pipeline.PostToolUse).toHaveLength(1);
      expect(pipeline.PostToolUse![0].matcher).toBe('Edit|Write');
      // PreToolUse / Stop are TODO stubs — deliberately omitted from the
      // pipeline so the SDK skips them entirely.
      expect(pipeline.PreToolUse).toBeUndefined();
      expect(pipeline.Stop).toBeUndefined();
    });
  });

  describe('PostToolUse capture — mock SDK scenarios', () => {
    it('scenario 1 (success): records Edit/Write file_path with deterministic timestamp', async () => {
      const sink = fakeSink();
      const fixedNow = new Date('2026-05-08T00:00:00.000Z');
      const callback = getPostToolUseCallback(sink, { now: () => fixedNow });

      await callback({
        tool_name: 'Edit',
        tool_input: { file_path: 'src/foo.ts', new_string: 'x' },
        session_id: 'sess-1',
      });
      await callback({
        tool_name: 'Write',
        tool_input: { file_path: 'src/bar.ts', content: 'y' },
        session_id: 'sess-1',
      });

      expect(sink.entries).toEqual([
        {
          filePath: 'src/foo.ts',
          toolName: 'Edit',
          capturedAt: '2026-05-08T00:00:00.000Z',
          sessionId: 'sess-1',
        },
        {
          filePath: 'src/bar.ts',
          toolName: 'Write',
          capturedAt: '2026-05-08T00:00:00.000Z',
          sessionId: 'sess-1',
        },
      ]);
    });

    it('scenario 2 (failure aborts): sink rejection propagates so the SDK stage aborts', async () => {
      const sinkError = new Error('disk full');
      const sink: ArtifactSink = {
        recordArtifact: vi.fn().mockRejectedValue(sinkError),
      };
      const callback = getPostToolUseCallback(sink);

      await expect(
        callback({
          tool_name: 'Write',
          tool_input: { file_path: 'src/baz.ts' },
        })
      ).rejects.toBe(sinkError);
      expect(sink.recordArtifact).toHaveBeenCalledTimes(1);
    });

    it('scenario 3 (async sink): awaits async recordArtifact before returning', async () => {
      const order: string[] = [];
      const sink: ArtifactSink = {
        async recordArtifact(entry) {
          order.push(`enter:${entry.filePath}`);
          await new Promise((resolve) => setTimeout(resolve, 5));
          order.push(`done:${entry.filePath}`);
        },
      };
      const callback = getPostToolUseCallback(sink);

      await callback({ tool_name: 'Edit', tool_input: { file_path: 'src/qux.ts' } });

      // The hook awaits the sink, so the "done" event must precede the
      // resolved promise — i.e. both events are present in order.
      expect(order).toEqual(['enter:src/qux.ts', 'done:src/qux.ts']);
    });

    it('throws when tool_input.file_path is missing (no silent failure)', async () => {
      const sink = fakeSink();
      const callback = getPostToolUseCallback(sink);
      await expect(callback({ tool_name: 'Edit', tool_input: {} })).rejects.toThrowError(
        /file_path/
      );
      expect(sink.entries).toHaveLength(0);
    });

    it('throws when invoked for an unsupported tool (defensive guard)', async () => {
      const sink = fakeSink();
      const callback = getPostToolUseCallback(sink);
      await expect(
        callback({
          tool_name: 'Bash' as SdkToolUseEvent['tool_name'],
          tool_input: { file_path: 'x' },
        })
      ).rejects.toThrowError(/unsupported tool/);
    });
  });
});

describe('SdkExecutionAdapter — hooks wiring', () => {
  function fakeSdkCapturing(messages: readonly SdkMessage[]): {
    sdk: SdkLike;
    captured: { value: SdkQueryOptions | undefined };
  } {
    const captured: { value: SdkQueryOptions | undefined } = { value: undefined };
    const sdk: SdkLike = {
      query(q) {
        captured.value = q;
        return (async function* () {
          for (const m of messages) yield m;
        })();
      },
    };
    return { sdk, captured };
  }

  const successMessages: SdkMessage[] = [
    { type: 'system', session_id: 'sess-A' },
    {
      type: 'result',
      session_id: 'sess-A',
      result: 'ok',
      is_error: false,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  ];

  const baseRequest: StageExecutionRequest = {
    agentType: 'worker',
    workOrder: 'do thing',
    priorOutputs: {},
  };

  it('forwards the hook pipeline to the SDK options', async () => {
    const sink = fakeSink();
    const pipeline = buildHookPipeline(sink);
    const { sdk, captured } = fakeSdkCapturing(successMessages);
    const adapter = new SdkExecutionAdapter({
      loader: async () => sdk,
      hooks: pipeline,
    });

    await adapter.execute(baseRequest);

    expect(captured.value?.options?.hooks).toBe(pipeline);
    expect(captured.value?.options?.hooks?.PostToolUse).toHaveLength(1);
  });

  it('omits the hooks key entirely when none is configured', async () => {
    const { sdk, captured } = fakeSdkCapturing(successMessages);
    const adapter = new SdkExecutionAdapter({ loader: async () => sdk });

    await adapter.execute(baseRequest);

    expect(captured.value?.options).toBeDefined();
    expect(captured.value?.options).not.toHaveProperty('hooks');
  });
});

describe('integration — MockExecutionAdapter + hook callback', () => {
  // Scenario from issue AC #4: confirm a hook callback fed real-looking
  // tool_use events records exactly what downstream stages will read out
  // of the artifact sink, and that the MockExecutionAdapter still records
  // its own request payload independently.
  it('captures Edit/Write events into the sink while MockExecutionAdapter records the stage call', async () => {
    const sink = fakeSink();
    const fixedNow = new Date('2026-05-08T01:00:00.000Z');
    const callback = getPostToolUseCallback(sink, { now: () => fixedNow });

    const adapter = new MockExecutionAdapter({
      handlers: [
        {
          match: (req) => req.agentType === 'worker',
          respond: {
            status: 'success',
            artifacts: [{ path: 'src/integration.ts', description: 'created' }],
            sessionId: 'mock-int',
            toolCallCount: 2,
            tokenUsage: { input: 5, output: 10, cache: 0 },
          },
        },
      ],
    });

    // Simulate the SDK flow: stage executes, then PostToolUse fires for each
    // tool call. We drive the hook callback ourselves to keep the test
    // independent of the real SDK.
    const result = await adapter.execute({
      agentType: 'worker',
      workOrder: 'implement integration',
      priorOutputs: { upstream: 'spec' },
    });
    await callback({
      tool_name: 'Write',
      tool_input: { file_path: 'src/integration.ts' },
      session_id: 'mock-int',
    });
    await callback({
      tool_name: 'Edit',
      tool_input: { file_path: 'src/integration.ts' },
      session_id: 'mock-int',
    });

    // MockExecutionAdapter recorded the stage call as expected.
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0].priorOutputs).toEqual({ upstream: 'spec' });
    expect(result.status).toBe('success');

    // The hook captured both tool events with the expected shape.
    expect(sink.entries).toEqual([
      {
        filePath: 'src/integration.ts',
        toolName: 'Write',
        capturedAt: '2026-05-08T01:00:00.000Z',
        sessionId: 'mock-int',
      },
      {
        filePath: 'src/integration.ts',
        toolName: 'Edit',
        capturedAt: '2026-05-08T01:00:00.000Z',
        sessionId: 'mock-int',
      },
    ]);
  });
});
