/**
 * SdkExecutionAdapter execution metrics (#956) on recorded SDK sequences:
 * every outcome reports `metrics`, failures and cancellations keep the usage
 * seen so far, and the legacy `toolCallCount` / `tokenUsage` keep their meaning.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { SdkExecutionAdapter, type SdkLike } from '../../src/execution/SdkExecutionAdapter.js';
import type { StageExecutionRequest, StageExecutionResult } from '../../src/execution/types.js';
import { ControlledQuery } from './fixtures/controlledSdk.js';
import { installAgent, sdkQuery } from './fixtures/sdk.js';
import {
  CANCELLED_STREAM,
  MAX_TURNS_STREAM,
  MULTI_TOOL_STREAM,
  NO_USAGE_STREAM,
  PARTIAL_FAILURE_STREAM,
  SESSION,
  SUCCESS_STREAM,
} from './fixtures/usageStreams.js';

const projectDir = await mkdtemp(join(tmpdir(), 'sdk-adapter-metrics-'));
beforeAll(async () => {
  await installAgent(projectDir);
});
afterAll(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

const request: StageExecutionRequest = {
  projectDir,
  agentType: 'worker',
  workOrder: 'implement issue #42',
  priorOutputs: {},
};

function replay(messages: readonly SDKMessage[]): SdkLike {
  return {
    query: () =>
      sdkQuery(
        (async function* () {
          for (const message of messages) yield message;
        })()
      ),
  };
}

async function execute(messages: readonly SDKMessage[]): Promise<StageExecutionResult> {
  const adapter = new SdkExecutionAdapter({ loader: async () => replay(messages) });
  try {
    return await adapter.execute(request);
  } finally {
    await adapter.dispose();
  }
}

describe('SdkExecutionAdapter execution metrics', () => {
  it('reports result usage, turns, tool uses, model, and versions on success', async () => {
    const result = await execute(SUCCESS_STREAM);
    expect(result.status).toBe('success');
    expect(result.sessionId).toBe(SESSION);
    expect(result.metrics).toMatchObject({
      usage: {
        inputTokens: 1740,
        outputTokens: 247,
        cacheReadInputTokens: 4300,
        cacheCreationInputTokens: 800,
        source: 'result',
      },
      turnCount: 3,
      toolUseCount: 2,
      modelId: 'claude-sonnet-4-5',
      claudeCodeVersion: '2.1.0',
      sdkVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
    expect(result.toolCallCount).toBe(3);
    expect(result.tokenUsage).toEqual({ input: 1650, output: 235, cache: 5100 });
  });

  it('counts every tool_use block of a multi-tool assistant message exactly', async () => {
    const result = await execute(MULTI_TOOL_STREAM);
    expect(result.metrics?.toolUseCount).toBe(5);
    expect(result.metrics?.turnCount).toBe(3);
    expect(result.toolCallCount).toBe(3);
  });

  it('keeps partial usage when the SDK fails after consuming tokens', async () => {
    const result = await execute(PARTIAL_FAILURE_STREAM);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('EXEC-003');
    expect(result.metrics?.usage).toEqual({
      inputTokens: 1100,
      outputTokens: 105,
      cacheReadInputTokens: 1300,
      cacheCreationInputTokens: 400,
      source: 'partial',
    });
    // Previously the zeroed error result replaced the partial totals with zeros.
    expect(result.tokenUsage).toEqual({ input: 1100, output: 105, cache: 1700 });
  });

  it('keeps measured usage of a failure result', async () => {
    const result = await execute(MAX_TURNS_STREAM);
    expect(result.status).toBe('failed');
    expect(result.metrics?.usage).toMatchObject({ inputTokens: 2400, source: 'result' });
    expect(result.metrics?.turnCount).toBe(4);
  });

  it('keeps partial usage when the execution is cancelled mid-stream', async () => {
    const controller = new AbortController();
    let query: ControlledQuery | undefined;
    const adapter = new SdkExecutionAdapter({
      cleanupGraceMs: 1000,
      loader: async () => ({
        query: (input) => {
          query = new ControlledQuery(input, CANCELLED_STREAM);
          return query;
        },
      }),
    });
    const execution = adapter.execute({ ...request, signal: controller.signal });
    while (query === undefined) await new Promise((resolve) => setTimeout(resolve, 1));
    await query.reading.promise;
    controller.abort(new Error('operator cancelled'));
    query.cleanupGate.resolve();
    const result = await execution;
    await adapter.dispose();
    expect(result.status).toBe('aborted');
    expect(result.metrics).toMatchObject({
      usage: {
        inputTokens: 700,
        outputTokens: 55,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: null,
        source: 'partial',
      },
      turnCount: null,
      toolUseCount: 1,
    });
    expect(result.tokenUsage).toEqual({ input: 700, output: 55, cache: 0 });
  });

  it('reports unknown usage for a result without usage', async () => {
    const result = await execute(NO_USAGE_STREAM);
    expect(result.status).toBe('success');
    expect(result.metrics?.usage).toEqual({
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      source: 'none',
    });
    expect(result.metrics?.turnCount).toBe(1);
  });

  it('reports unknown usage when the SDK cannot be loaded', async () => {
    const adapter = new SdkExecutionAdapter({
      loader: async () => {
        throw new Error('load failed');
      },
    });
    const result = await adapter.execute(request);
    await adapter.dispose();
    expect(result.status).toBe('failed');
    expect(result.metrics).toMatchObject({
      usage: { inputTokens: null, source: 'none' },
      turnCount: null,
      toolUseCount: null,
    });
  });
});
