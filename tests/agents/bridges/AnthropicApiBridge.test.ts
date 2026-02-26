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
});
