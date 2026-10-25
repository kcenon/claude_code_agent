/**
 * SDK usage observation (#956): recorded message sequences reduced to usage
 * that keeps unknown apart from zero, turns apart from tool invocations, and
 * tool invocations counted from tool_use blocks.
 */
import { describe, expect, it } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { SdkUsageObserver, installedSdkVersion } from '../../src/execution/usage.js';
import {
  CANCELLED_STREAM,
  CLAUDE_CODE_VERSION,
  HELPER_MODEL,
  MAX_TURNS_STREAM,
  MODEL,
  MULTI_TOOL_STREAM,
  NO_USAGE_STREAM,
  PARTIAL_FAILURE_STREAM,
  SUCCESS_STREAM,
  assistant,
  init,
  success,
  text,
  toolUse,
  usage,
} from './fixtures/usageStreams.js';

function observe(messages: readonly SDKMessage[]): SdkUsageObserver {
  const observer = new SdkUsageObserver();
  for (const message of messages) observer.observe(message);
  return observer;
}

describe('SdkUsageObserver on recorded SDK sequences', () => {
  it('success: result modelUsage over every model, turns and tool uses apart', () => {
    const observer = observe(SUCCESS_STREAM);
    expect(observer.metrics('0.0.0-test')).toEqual({
      usage: {
        inputTokens: 1740,
        outputTokens: 247,
        cacheReadInputTokens: 4300,
        cacheCreationInputTokens: 800,
        source: 'result',
      },
      turnCount: 3,
      toolUseCount: 2,
      toolUses: { Read: 1, Write: 1 },
      modelId: MODEL,
      models: [HELPER_MODEL, MODEL],
      sdkVersion: '0.0.0-test',
      claudeCodeVersion: CLAUDE_CODE_VERSION,
    });
    // Legacy fields keep their meaning: turns (not tools) and main-loop usage.
    expect(observer.legacyToolCallCount()).toBe(3);
    expect(observer.legacyTokenUsage()).toEqual({ input: 1650, output: 235, cache: 5100 });
  });

  it('one assistant message with several tool_use blocks counts every block exactly once', () => {
    const metrics = observe(MULTI_TOOL_STREAM).metrics();
    expect(metrics.toolUseCount).toBe(5);
    expect(metrics.toolUses).toEqual({
      Bash: 1,
      Grep: 1,
      Read: 2,
      mcp__github__create_issue: 1,
    });
    expect(metrics.turnCount).toBe(3);
    // The legacy count is unchanged and stays below the real tool count.
    expect(observe(MULTI_TOOL_STREAM).legacyToolCallCount()).toBe(3);
  });

  it('partial failure: a zeroed error result keeps the usage observed before it', () => {
    const observer = observe(PARTIAL_FAILURE_STREAM);
    const metrics = observer.metrics();
    expect(metrics.usage).toEqual({
      inputTokens: 1100,
      outputTokens: 105,
      cacheReadInputTokens: 1300,
      cacheCreationInputTokens: 400,
      source: 'partial',
    });
    expect(metrics.turnCount).toBe(2);
    expect(metrics.toolUseCount).toBe(2);
    expect(observer.legacyTokenUsage()).toEqual({ input: 1100, output: 105, cache: 1700 });
  });

  it('a failure result with measured usage is authoritative', () => {
    const metrics = observe(MAX_TURNS_STREAM).metrics();
    expect(metrics.usage).toEqual({
      inputTokens: 2400,
      outputTokens: 310,
      cacheReadInputTokens: 900,
      cacheCreationInputTokens: 0,
      source: 'result',
    });
    expect(metrics.turnCount).toBe(4);
    expect(metrics.toolUseCount).toBe(1);
  });

  it('cancellation mid-stream: partial usage, unknown cache fields and turns stay null', () => {
    const metrics = observe(CANCELLED_STREAM).metrics();
    expect(metrics.usage).toEqual({
      inputTokens: 700,
      outputTokens: 55,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      source: 'partial',
    });
    expect(metrics.turnCount).toBeNull();
    expect(metrics.toolUseCount).toBe(1);
  });

  it('a result without usage reports unknown, never a measured zero', () => {
    const observer = observe(NO_USAGE_STREAM);
    expect(observer.metrics().usage).toEqual({
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      source: 'none',
    });
    expect(observer.metrics().turnCount).toBe(1);
    expect(observer.metrics().toolUseCount).toBe(0);
    // The legacy field cannot express unknown and reports 0 as before.
    expect(observer.legacyTokenUsage()).toEqual({ input: 0, output: 0, cache: 0 });
  });

  it('a measured zero from a successful result stays zero', () => {
    const metrics = observe([init(), success(1, usage(0, 0, 0, 0))]).metrics();
    expect(metrics.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      source: 'result',
    });
  });

  it('nothing observed: every count is unknown', () => {
    expect(new SdkUsageObserver().metrics(null)).toMatchObject({
      usage: { inputTokens: null, source: 'none' },
      turnCount: null,
      toolUseCount: null,
      modelId: null,
      models: [],
    });
  });

  it('counts subagent tool uses and buckets names that are not identifiers', () => {
    const metrics = observe([
      init(),
      assistant('msg_x1', [toolUse('toolu_x1', 'Task', { prompt: 'explore' })]),
      assistant('msg_x2', [toolUse('toolu_x2', 'Read')], usage(10, 1, 0, 0), {
        parentToolUseId: 'toolu_x1',
      }),
      assistant('msg_x3', [toolUse('toolu_x3', 'tool name with spaces'), text('...')]),
      // Blocks without an id cannot be deduplicated and are not counted.
      assistant('msg_x4', [{ type: 'tool_use', id: '', name: 'Read', input: {} }]),
    ]).metrics();
    expect(metrics.toolUseCount).toBe(3);
    expect(metrics.toolUses).toEqual({ Read: 1, Task: 1, other: 1 });
  });

  it('ignores partial stream events: the complete assistant message carries the blocks', () => {
    const streamEvent = {
      type: 'stream_event',
      event: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'toolu_s9', name: 'Read', input: {} },
      },
      parent_tool_use_id: null,
      uuid: '00000000-0000-4000-8000-0000000000ff',
      session_id: 'stream',
    } as unknown as SDKMessage;
    expect(observe([init(), streamEvent]).metrics().toolUseCount).toBe(0);
  });

  it('reads the installed SDK package version', () => {
    expect(installedSdkVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
