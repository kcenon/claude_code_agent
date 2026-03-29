import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AgentRequest } from '../../../src/agents/AgentBridge.js';

// Mock child_process before importing the bridge
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '{}'),
}));

// Mock node:fs for existsSync used in buildArgs
vi.mock('node:fs', () => ({
  default: { existsSync: vi.fn(() => false) },
  existsSync: vi.fn(() => false),
}));

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { ClaudeCliSubprocessBridge } from '../../../src/agents/bridges/ClaudeCliSubprocessBridge.js';

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(fs.existsSync);

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

describe('ClaudeCliSubprocessBridge', () => {
  let bridge: ClaudeCliSubprocessBridge;

  beforeEach(() => {
    bridge = new ClaudeCliSubprocessBridge({ claudePath: '/usr/local/bin/claude' });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await bridge.dispose();
    vi.restoreAllMocks();
  });

  describe('supports', () => {
    it('should support all agent types', () => {
      expect(bridge.supports('collector')).toBe(true);
      expect(bridge.supports('worker')).toBe(true);
      expect(bridge.supports('prd-writer')).toBe(true);
      expect(bridge.supports('unknown-type')).toBe(true);
    });
  });

  describe('buildArgs', () => {
    it('should include required CLI flags', () => {
      const request = createRequest();
      const args = bridge.buildArgs(request);

      expect(args).toContain('-p');
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('should include system-prompt-file when agent definition exists', () => {
      mockExistsSync.mockReturnValueOnce(true);

      const request = createRequest({ agentType: 'prd-writer' });
      const args = bridge.buildArgs(request);

      expect(args).toContain('--system-prompt-file');
      expect(args).toContain('/test/project/.claude/agents/prd-writer.md');
    });

    it('should not include system-prompt-file when agent definition is missing', () => {
      mockExistsSync.mockReturnValueOnce(false);

      const request = createRequest();
      const args = bridge.buildArgs(request);

      expect(args).not.toContain('--system-prompt-file');
    });
  });

  describe('buildPrompt', () => {
    it('should include agent type and project context', () => {
      const request = createRequest();
      const prompt = bridge.buildPrompt(request);

      expect(prompt).toContain('You are the collector agent.');
      expect(prompt).toContain('Project directory: /test/project');
      expect(prompt).toContain('Scratchpad directory: /test/.ad-sdlc/scratchpad');
      expect(prompt).toContain('Build a todo app');
    });

    it('should include prior stage outputs when present', () => {
      const request = createRequest({
        priorStageOutputs: { 'prd-writer': 'PRD content here' },
      });
      const prompt = bridge.buildPrompt(request);

      expect(prompt).toContain('Prior stage outputs:');
      expect(prompt).toContain('PRD content here');
    });

    it('should not include prior stage outputs section when empty', () => {
      const request = createRequest({ priorStageOutputs: {} });
      const prompt = bridge.buildPrompt(request);

      expect(prompt).not.toContain('Prior stage outputs:');
    });

    it('should request JSON output format in the prompt', () => {
      const request = createRequest();
      const prompt = bridge.buildPrompt(request);

      expect(prompt).toContain('"output"');
      expect(prompt).toContain('"success"');
    });
  });

  describe('parseResponse', () => {
    it('should parse Claude CLI JSON wrapper with nested JSON result', () => {
      const raw = JSON.stringify({
        type: 'result',
        result: JSON.stringify({ output: 'Agent completed', success: true }),
      });

      const response = bridge.parseResponse(raw);

      expect(response.output).toBe('Agent completed');
      expect(response.success).toBe(true);
      expect(response.artifacts).toEqual([]);
    });

    it('should parse Claude CLI JSON wrapper with plain text result', () => {
      const raw = JSON.stringify({
        type: 'result',
        result: 'Plain text agent output',
      });

      const response = bridge.parseResponse(raw);

      expect(response.output).toBe('Plain text agent output');
      expect(response.success).toBe(true);
    });

    it('should handle nested JSON with artifacts', () => {
      const raw = JSON.stringify({
        type: 'result',
        result: JSON.stringify({
          output: 'Done',
          success: true,
          artifacts: [{ path: '/test/file.ts', action: 'created' }],
        }),
      });

      const response = bridge.parseResponse(raw);

      expect(response.output).toBe('Done');
      expect(response.artifacts).toEqual([{ path: '/test/file.ts', action: 'created' }]);
    });

    it('should handle nested JSON with success=false', () => {
      const raw = JSON.stringify({
        type: 'result',
        result: JSON.stringify({ output: 'Failed', success: false }),
      });

      const response = bridge.parseResponse(raw);

      expect(response.output).toBe('Failed');
      expect(response.success).toBe(false);
    });

    it('should handle raw non-JSON output', () => {
      const raw = 'This is not JSON at all';

      const response = bridge.parseResponse(raw);

      expect(response.output).toBe('This is not JSON at all');
      expect(response.success).toBe(true);
      expect(response.artifacts).toEqual([]);
    });

    it('should fall back to output field when result is missing', () => {
      const raw = JSON.stringify({ output: 'Fallback output' });

      const response = bridge.parseResponse(raw);

      expect(response.output).toBe('Fallback output');
      expect(response.success).toBe(true);
    });

    it('should handle empty result string', () => {
      const raw = JSON.stringify({ type: 'result', result: '' });

      const response = bridge.parseResponse(raw);

      // Empty string falls through to raw JSON string via ?? fallback
      expect(response.success).toBe(true);
    });
  });

  describe('execute', () => {
    it('should invoke claude CLI and return parsed response', async () => {
      const cliOutput = JSON.stringify({
        type: 'result',
        result: JSON.stringify({ output: 'Collected data', success: true }),
      });
      mockExecFileSync.mockReturnValueOnce(cliOutput);

      const request = createRequest();
      const response = await bridge.execute(request);

      expect(response.output).toBe('Collected data');
      expect(response.success).toBe(true);

      // Verify execFileSync was called with correct arguments
      expect(mockExecFileSync).toHaveBeenCalledOnce();
      const [cmd, args, options] = mockExecFileSync.mock.calls[0]!;
      expect(cmd).toBe('/usr/local/bin/claude');
      expect(args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json']));
      expect(options).toMatchObject({
        encoding: 'utf-8',
        cwd: '/test/project',
      });
    });

    it('should return error response on subprocess failure', async () => {
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('Command failed with exit code 1');
      });

      const request = createRequest();
      const response = await bridge.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Command failed with exit code 1');
      expect(response.output).toBe('');
    });

    it('should return error response on timeout', async () => {
      mockExecFileSync.mockImplementationOnce(() => {
        const err = new Error('TIMEOUT');
        (err as NodeJS.ErrnoException).code = 'ETIMEDOUT';
        throw err;
      });

      const request = createRequest();
      const response = await bridge.execute(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('TIMEOUT');
    });

    it('should set cwd to project directory', async () => {
      mockExecFileSync.mockReturnValueOnce(JSON.stringify({ result: 'ok' }));

      const request = createRequest({ projectDir: '/my/project' });
      await bridge.execute(request);

      const [, , options] = mockExecFileSync.mock.calls[0]!;
      expect((options as { cwd: string }).cwd).toBe('/my/project');
    });
  });

  describe('constructor', () => {
    it('should use default claude path when not specified', async () => {
      const defaultBridge = new ClaudeCliSubprocessBridge();
      mockExecFileSync.mockReturnValueOnce(JSON.stringify({ result: 'ok' }));

      await defaultBridge.execute(createRequest());

      const [cmd] = mockExecFileSync.mock.calls[0]!;
      expect(cmd).toBe('claude');
    });

    it('should accept custom claude path', async () => {
      const customBridge = new ClaudeCliSubprocessBridge({
        claudePath: '/custom/path/claude',
      });
      mockExecFileSync.mockReturnValueOnce(JSON.stringify({ result: 'ok' }));

      await customBridge.execute(createRequest());

      const [cmd] = mockExecFileSync.mock.calls[0]!;
      expect(cmd).toBe('/custom/path/claude');
    });
  });

  describe('dispose', () => {
    it('should dispose without error', async () => {
      await expect(bridge.dispose()).resolves.toBeUndefined();
    });
  });
});
