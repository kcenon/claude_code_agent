import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AnthropicApiBridge } from '../../../src/agents/bridges/AnthropicApiBridge.js';
import type { AgentRequest } from '../../../src/agents/AgentBridge.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    agentType: 'collector',
    input: 'Build a todo app',
    scratchpadDir: '/test/.ad-sdlc/scratchpad',
    projectDir: '/test/project',
    priorStageOutputs: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnthropicApiBridge', () => {
  describe('supports', () => {
    it('should support all agent types', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      expect(bridge.supports('collector')).toBe(true);
      expect(bridge.supports('worker')).toBe(true);
      expect(bridge.supports('unknown-type')).toBe(true);
    });
  });

  describe('agent definition loading', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-test-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should strip YAML frontmatter from agent definition', async () => {
      const agentDir = path.join(tempDir, 'agents');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'collector.md'),
        '---\nname: collector\nmodel: inherit\n---\n\n# Collector Agent\n\nYou are the collector.',
        'utf-8'
      );

      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        agentDefsDir: agentDir,
      });

      // Access private method via dynamic cast for testing
      const loadDef = (bridge as unknown as Record<string, unknown>)['loadAgentDefinition'] as (
        type: string
      ) => Promise<string>;

      const def = await loadDef.call(bridge, 'collector');
      expect(def).not.toContain('---');
      expect(def).toContain('# Collector Agent');
      expect(def).toContain('You are the collector');
    });

    it('should return fallback definition for missing agent file', async () => {
      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        agentDefsDir: path.join(tempDir, 'nonexistent'),
      });

      const loadDef = (bridge as unknown as Record<string, unknown>)['loadAgentDefinition'] as (
        type: string
      ) => Promise<string>;

      const def = await loadDef.call(bridge, 'missing-agent');
      expect(def).toContain('missing-agent');
      expect(def).toContain('agent');
    });
  });

  describe('model resolution', () => {
    it('should map model preferences to Anthropic model IDs', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const resolveModel = (bridge as unknown as Record<string, unknown>)['resolveModel'] as (
        pref?: string
      ) => string;

      expect(resolveModel.call(bridge, 'opus')).toBe('claude-opus-4-6');
      expect(resolveModel.call(bridge, 'sonnet')).toBe('claude-sonnet-4-6');
      expect(resolveModel.call(bridge, 'haiku')).toBe('claude-haiku-4-5-20251001');
      expect(resolveModel.call(bridge, undefined)).toBe('claude-sonnet-4-6');
      expect(resolveModel.call(bridge, 'unknown')).toBe('claude-sonnet-4-6');
    });
  });

  describe('message building', () => {
    it('should build user message with prior stage outputs', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const buildMsg = (bridge as unknown as Record<string, unknown>)['buildUserMessage'] as (
        req: AgentRequest
      ) => string;

      const request = createRequest({
        input: 'Generate SRS',
        priorStageOutputs: {
          prd_generation: '{"features": ["auth"]}',
        },
      });

      const message = buildMsg.call(bridge, request);
      expect(message).toContain('Generate SRS');
      expect(message).toContain('prd_generation');
      expect(message).toContain('{"features": ["auth"]}');
    });

    it('should truncate large prior outputs', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const buildMsg = (bridge as unknown as Record<string, unknown>)['buildUserMessage'] as (
        req: AgentRequest
      ) => string;

      const request = createRequest({
        priorStageOutputs: {
          large_stage: 'x'.repeat(20000),
        },
      });

      const message = buildMsg.call(bridge, request);
      expect(message).toContain('truncated');
      expect(message.length).toBeLessThan(20000);
    });
  });

  describe('execute (API error handling)', () => {
    it('should return error response when API call fails', async () => {
      // Mock the dynamic import to return a failing client
      const bridge = new AnthropicApiBridge({ apiKey: 'invalid-key' });

      // Override getClient to return a mock that throws
      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            throw new Error('Invalid API key');
          },
        },
      });

      const response = await bridge.execute(createRequest());

      expect(response.success).toBe(false);
      expect(response.error).toContain('Anthropic API error');
      expect(response.error).toContain('Invalid API key');
      expect(response.output).toBe('');
    });

    it('should handle successful API response', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => ({
            content: [{ type: 'text', text: 'Generated PRD content' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 100, output_tokens: 50 },
          }),
        },
      });

      const response = await bridge.execute(createRequest({ agentType: 'prd-writer' }));

      expect(response.success).toBe(true);
      expect(response.output).toBe('Generated PRD content');
      expect(response.tokenUsage).toEqual({ inputTokens: 100, outputTokens: 50 });
    });
  });

  describe('multi-turn tool use', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-multi-'));
      await fs.writeFile(path.join(tempDir, 'data.txt'), 'hello world\n', 'utf-8');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should execute tools and continue conversation on tool_use stop', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              // First turn: API requests a tool
              return {
                content: [
                  { type: 'text', text: 'Let me read the file.' },
                  { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'data.txt' } },
                ],
                stop_reason: 'tool_use',
                usage: { input_tokens: 50, output_tokens: 30 },
              };
            }
            // Second turn: API completes
            return {
              content: [{ type: 'text', text: 'The file contains: hello world' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 80, output_tokens: 40 },
            };
          },
        },
      });

      const response = await bridge.execute(
        createRequest({ projectDir: tempDir, enableTools: true })
      );

      expect(response.success).toBe(true);
      expect(response.output).toContain('Let me read the file.');
      expect(response.output).toContain('The file contains: hello world');
      expect(callCount).toBe(2);
      // Token usage should be accumulated across turns
      expect(response.tokenUsage).toEqual({ inputTokens: 130, outputTokens: 70 });
    });

    it('should track write_file as artifact', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                content: [
                  {
                    type: 'tool_use',
                    id: 'tu_w',
                    name: 'write_file',
                    input: { path: 'output.txt', content: 'result' },
                  },
                ],
                stop_reason: 'tool_use',
                usage: { input_tokens: 50, output_tokens: 30 },
              };
            }
            return {
              content: [{ type: 'text', text: 'Done.' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 60, output_tokens: 10 },
            };
          },
        },
      });

      const response = await bridge.execute(
        createRequest({ projectDir: tempDir, enableTools: true })
      );

      expect(response.success).toBe(true);
      expect(response.artifacts).toEqual([{ path: 'output.txt', action: 'created' }]);
      // Verify file was actually written
      const written = await fs.readFile(path.join(tempDir, 'output.txt'), 'utf-8');
      expect(written).toBe('result');
    });

    it('should respect maxTurns limit', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            // Always request tool_use — never end_turn
            return {
              content: [
                { type: 'text', text: `Turn ${callCount}` },
                {
                  type: 'tool_use',
                  id: `tu_${callCount}`,
                  name: 'read_file',
                  input: { path: 'data.txt' },
                },
              ],
              stop_reason: 'tool_use',
              usage: { input_tokens: 10, output_tokens: 10 },
            };
          },
        },
      });

      const response = await bridge.execute(createRequest({ projectDir: tempDir, maxTurns: 3 }));

      expect(callCount).toBe(3);
      expect(response.error).toContain('maximum turn limit');
      expect(response.output).toContain('Turn 1');
    });

    it('should handle tool execution errors gracefully', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              return {
                content: [
                  {
                    type: 'tool_use',
                    id: 'tu_err',
                    name: 'read_file',
                    input: { path: 'nonexistent.txt' },
                  },
                ],
                stop_reason: 'tool_use',
                usage: { input_tokens: 20, output_tokens: 20 },
              };
            }
            return {
              content: [{ type: 'text', text: 'File not found, proceeding.' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 40, output_tokens: 20 },
            };
          },
        },
      });

      const response = await bridge.execute(createRequest({ projectDir: tempDir }));

      // Should still complete successfully — tool errors are sent back to the model
      expect(response.success).toBe(true);
      expect(callCount).toBe(2);
    });

    it('should skip tools when enableTools is false', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async (params: Record<string, unknown>) => {
            // Verify no tools were sent
            expect(params['tools']).toBeUndefined();
            return {
              content: [{ type: 'text', text: 'No tools available.' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 30, output_tokens: 20 },
            };
          },
        },
      });

      const response = await bridge.execute(createRequest({ enableTools: false }));

      expect(response.success).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose without error', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      await expect(bridge.dispose()).resolves.toBeUndefined();
    });
  });

  describe('exponential backoff and retry', () => {
    // Use baseBackoffMs: 1 so retry delays are ~1-2ms instead of 1-2s
    function makeRetryBridge() {
      return new AnthropicApiBridge({
        apiKey: 'test-key',
        baseBackoffMs: 1,
        rateLimitConfig: { requestsPerMinute: 1000, minDelayMs: 0, maxConcurrent: 10 },
      });
    }

    it('should retry on 429 and succeed on the next attempt', async () => {
      const bridge = makeRetryBridge();
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              const err = new Error('Rate limit exceeded');
              (err as { status?: number }).status = 429;
              throw err;
            }
            return {
              content: [{ type: 'text', text: 'Succeeded after retry' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        },
      });

      const response = await bridge.execute(createRequest());

      expect(response.success).toBe(true);
      expect(response.output).toBe('Succeeded after retry');
      expect(callCount).toBe(2);
      const metrics = bridge.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      expect(metrics.totalRetries).toBe(1);
      expect(metrics.totalTimeouts).toBe(0);
    });

    it('should retry on 529 (overloaded) status', async () => {
      const bridge = makeRetryBridge();
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              const err = new Error('API overloaded');
              (err as { status?: number }).status = 529;
              throw err;
            }
            return {
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        },
      });

      const response = await bridge.execute(createRequest());

      expect(response.success).toBe(true);
      expect(callCount).toBe(2);
      expect(bridge.getMetrics().totalRetries).toBe(1);
    });

    it('should retry on 500 internal server error', async () => {
      const bridge = makeRetryBridge();
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              const err = new Error('Internal server error');
              (err as { status?: number }).status = 500;
              throw err;
            }
            return {
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        },
      });

      const response = await bridge.execute(createRequest());

      expect(response.success).toBe(true);
      expect(callCount).toBe(2);
    });

    it('should not retry 401 authentication errors', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            callCount++;
            const err = new Error('Unauthorized');
            (err as { status?: number }).status = 401;
            throw err;
          },
        },
      });

      const response = await bridge.execute(createRequest());

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unauthorized');
      expect(callCount).toBe(1); // No retries
      expect(bridge.getMetrics().totalRetries).toBe(0);
    });

    it('should propagate error after max retries (3)', async () => {
      const bridge = makeRetryBridge();

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => {
            const err = new Error('Rate limit exceeded');
            (err as { status?: number }).status = 429;
            throw err;
          },
        },
      });

      const response = await bridge.execute(createRequest());

      expect(response.success).toBe(false);
      expect(response.error).toContain('Anthropic API error');
      const metrics = bridge.getMetrics();
      // 4 total calls: initial + 3 retries (MAX_API_RETRIES = 3)
      expect(metrics.totalCalls).toBe(4);
      expect(metrics.totalRetries).toBe(3);
    });
  });

  describe('per-call timeout', () => {
    it('should fail when the API call exceeds timeoutMs', async () => {
      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        rateLimitConfig: { requestsPerMinute: 1000, minDelayMs: 0, maxConcurrent: 10 },
      });

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          // create never resolves
          create: () => new Promise<never>(() => undefined),
        },
      });

      const response = await bridge.execute(createRequest({ timeoutMs: 30 }));

      expect(response.success).toBe(false);
      expect(response.error).toContain('timed out');
    });

    it('should track timed-out calls in metrics without retrying', async () => {
      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        rateLimitConfig: { requestsPerMinute: 1000, minDelayMs: 0, maxConcurrent: 10 },
      });

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: () => new Promise<never>(() => undefined),
        },
      });

      await bridge.execute(createRequest({ timeoutMs: 30 }));

      const metrics = bridge.getMetrics();
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.totalTimeouts).toBe(1);
      expect(metrics.totalRetries).toBe(0); // Timeouts are not retried
    });
  });

  describe('metrics tracking', () => {
    it('should expose correct metrics via getMetrics()', async () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async () => ({
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        },
      });

      await bridge.execute(createRequest());
      const metrics = bridge.getMetrics();

      expect(metrics.totalCalls).toBe(1);
      expect(metrics.totalRetries).toBe(0);
      expect(metrics.totalTimeouts).toBe(0);
    });

    it('should return a metrics snapshot (not live reference)', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const m1 = bridge.getMetrics();
      const m2 = bridge.getMetrics();
      expect(m1).not.toBe(m2);
      expect(m1).toEqual(m2);
    });
  });

  describe('rate limit configuration', () => {
    it('should accept custom rateLimitConfig in constructor', () => {
      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        rateLimitConfig: { requestsPerMinute: 10, minDelayMs: 500, maxConcurrent: 2 },
      });
      expect(bridge.supports('any-agent')).toBe(true);
    });
  });

  describe('message history windowing', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-window-'));
      await fs.writeFile(path.join(tempDir, 'data.txt'), 'content\n', 'utf-8');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should cap messages sent to API when window size is exceeded', async () => {
      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        rateLimitConfig: { requestsPerMinute: 1000, minDelayMs: 0, maxConcurrent: 10 },
      });
      const sentMessageCounts: number[] = [];
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async (params: Record<string, unknown>) => {
            callCount++;
            sentMessageCounts.push((params['messages'] as unknown[]).length);
            if (callCount < 5) {
              return {
                content: [
                  {
                    type: 'tool_use',
                    id: `tu_${callCount}`,
                    name: 'read_file',
                    input: { path: 'data.txt' },
                  },
                ],
                stop_reason: 'tool_use',
                usage: { input_tokens: 10, output_tokens: 10 },
              };
            }
            return {
              content: [{ type: 'text', text: 'done' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        },
      });

      await bridge.execute(
        createRequest({ projectDir: tempDir, historyWindowSize: 1, maxTurns: 5 })
      );

      // Turn 1: sent [user] = 1 message (window not yet applicable)
      expect(sentMessageCounts[0]).toBe(1);
      // Turn 2+: window=1 keeps [initial_user, last_assistant, last_tool_result] = 3 messages
      for (const count of sentMessageCounts.slice(1)) {
        expect(count).toBe(3);
      }
    });

    it('should always preserve the first user message regardless of window size', async () => {
      const bridge = new AnthropicApiBridge({
        apiKey: 'test-key',
        rateLimitConfig: { requestsPerMinute: 1000, minDelayMs: 0, maxConcurrent: 10 },
      });
      const firstRolesInEachCall: string[] = [];
      let callCount = 0;

      (bridge as unknown as Record<string, unknown>)['getClient'] = async () => ({
        messages: {
          create: async (params: Record<string, unknown>) => {
            callCount++;
            const msgs = params['messages'] as Array<{ role: string }>;
            firstRolesInEachCall.push(msgs[0]?.role ?? '');
            if (callCount === 1) {
              return {
                content: [
                  { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'data.txt' } },
                ],
                stop_reason: 'tool_use',
                usage: { input_tokens: 10, output_tokens: 10 },
              };
            }
            return {
              content: [{ type: 'text', text: 'done' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          },
        },
      });

      await bridge.execute(createRequest({ projectDir: tempDir, historyWindowSize: 1 }));

      expect(callCount).toBe(2);
      for (const role of firstRolesInEachCall) {
        expect(role).toBe('user');
      }
    });
  });

  describe('prior output aggregate limit', () => {
    it('should omit stages that exceed the aggregate byte limit', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const buildMsg = (bridge as unknown as Record<string, unknown>)['buildUserMessage'] as (
        req: AgentRequest
      ) => string;

      // 5 stages × ~10KB each; aggregate limit of 30KB — only first 2 should fit
      const priorOutputs: Record<string, string> = {};
      for (let i = 1; i <= 5; i++) {
        priorOutputs[`stage_${i}`] = 'a'.repeat(15000);
      }

      const message = buildMsg.call(bridge, createRequest({ priorStageOutputs: priorOutputs, maxPriorOutputBytes: 30_000 }));

      expect(message).toContain('stage_1');
      expect(message).toContain('omitted');
      expect(message).not.toContain('stage_5');
    });

    it('should include all stages when total is within aggregate limit', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const buildMsg = (bridge as unknown as Record<string, unknown>)['buildUserMessage'] as (
        req: AgentRequest
      ) => string;

      const message = buildMsg.call(
        bridge,
        createRequest({
          priorStageOutputs: { stage_a: 'small A', stage_b: 'small B' },
          maxPriorOutputBytes: 50_000,
        })
      );

      expect(message).toContain('stage_a');
      expect(message).toContain('stage_b');
      expect(message).not.toContain('omitted');
    });

    it('should use 50KB default aggregate limit when maxPriorOutputBytes is not set', () => {
      const bridge = new AnthropicApiBridge({ apiKey: 'test-key' });
      const buildMsg = (bridge as unknown as Record<string, unknown>)['buildUserMessage'] as (
        req: AgentRequest
      ) => string;

      // 6 stages × 10KB each = ~60KB total → exceeds 50KB default
      const priorOutputs: Record<string, string> = {};
      for (let i = 1; i <= 6; i++) {
        priorOutputs[`stage_${i}`] = 'b'.repeat(10000);
      }

      const message = buildMsg.call(bridge, createRequest({ priorStageOutputs: priorOutputs }));

      expect(message).toContain('omitted');
      expect(message).not.toContain('stage_6');
    });
  });
});
