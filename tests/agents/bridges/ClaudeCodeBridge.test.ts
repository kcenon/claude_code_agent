import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeCodeBridge } from '../../../src/agents/bridges/ClaudeCodeBridge.js';
import type { AgentRequest, AgentResponse } from '../../../src/agents/AgentBridge.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createRequest(
  scratchpadDir: string,
  overrides: Partial<AgentRequest> = {}
): AgentRequest {
  return {
    agentType: 'collector',
    input: 'Build a todo app',
    scratchpadDir,
    projectDir: '/test/project',
    priorStageOutputs: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClaudeCodeBridge', () => {
  let tempDir: string;
  let bridge: ClaudeCodeBridge;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-bridge-test-'));
    bridge = new ClaudeCodeBridge({
      pollIntervalMs: 50, // Fast polling for tests
      timeoutMs: 2000,    // Short timeout for tests
    });
  });

  afterEach(async () => {
    await bridge.dispose();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('supports', () => {
    it('should support all agent types', () => {
      expect(bridge.supports('collector')).toBe(true);
      expect(bridge.supports('worker')).toBe(true);
      expect(bridge.supports('unknown')).toBe(true);
    });
  });

  describe('execute', () => {
    it('should write input file to scratchpad', async () => {
      const scratchpadDir = path.join(tempDir, 'scratchpad');
      const request = createRequest(scratchpadDir, {
        agentType: 'prd-writer',
        input: 'Write a PRD',
      });

      // Pre-write output so bridge doesn't timeout
      const outputDir = path.join(scratchpadDir, 'bridge', 'output');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        path.join(outputDir, 'prd-writer.json'),
        JSON.stringify({ output: 'PRD content', success: true }),
        'utf-8'
      );

      await bridge.execute(request);

      // Verify input was written
      const inputPath = path.join(scratchpadDir, 'bridge', 'input', 'prd-writer.json');
      const inputContent = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
      expect(inputContent.agentType).toBe('prd-writer');
      expect(inputContent.input).toBe('Write a PRD');
    });

    it('should read and parse JSON output', async () => {
      const scratchpadDir = path.join(tempDir, 'scratchpad');
      const outputDir = path.join(scratchpadDir, 'bridge', 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const expectedResponse: AgentResponse = {
        output: 'Generated document content',
        artifacts: [{ path: 'docs/PRD.md', action: 'created' }],
        success: true,
      };

      await fs.writeFile(
        path.join(outputDir, 'collector.json'),
        JSON.stringify(expectedResponse),
        'utf-8'
      );

      const response = await bridge.execute(createRequest(scratchpadDir));

      expect(response.success).toBe(true);
      expect(response.output).toBe('Generated document content');
      expect(response.artifacts).toHaveLength(1);
      expect(response.artifacts[0]!.path).toBe('docs/PRD.md');
    });

    it('should handle raw text output (non-JSON)', async () => {
      const scratchpadDir = path.join(tempDir, 'scratchpad');
      const outputDir = path.join(scratchpadDir, 'bridge', 'output');
      await fs.mkdir(outputDir, { recursive: true });

      await fs.writeFile(
        path.join(outputDir, 'collector.json'),
        'This is plain text output from the agent.',
        'utf-8'
      );

      const response = await bridge.execute(createRequest(scratchpadDir));

      expect(response.success).toBe(true);
      expect(response.output).toBe('This is plain text output from the agent.');
    });

    it('should timeout when output never appears', async () => {
      const shortTimeoutBridge = new ClaudeCodeBridge({
        pollIntervalMs: 50,
        timeoutMs: 200,
      });

      const scratchpadDir = path.join(tempDir, 'scratchpad-empty');
      const response = await shortTimeoutBridge.execute(
        createRequest(scratchpadDir)
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('Timeout');
      expect(response.error).toContain('200ms');

      await shortTimeoutBridge.dispose();
    });

    it('should wait for output file to appear', async () => {
      const scratchpadDir = path.join(tempDir, 'scratchpad-delayed');
      const outputDir = path.join(scratchpadDir, 'bridge', 'output');

      // Write output after a short delay
      setTimeout(async () => {
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(
          path.join(outputDir, 'collector.json'),
          JSON.stringify({ output: 'delayed result', success: true }),
          'utf-8'
        );
      }, 100);

      const response = await bridge.execute(createRequest(scratchpadDir));

      expect(response.success).toBe(true);
      expect(response.output).toBe('delayed result');
    });
  });

  describe('dispose', () => {
    it('should dispose without error', async () => {
      await expect(bridge.dispose()).resolves.toBeUndefined();
    });
  });
});
