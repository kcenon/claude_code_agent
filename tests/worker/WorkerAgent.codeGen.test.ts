import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkerAgent, CodeGenerationError } from '../../src/worker/index.js';
import type { CodeChange } from '../../src/worker/index.js';
import type { WorkOrder, CodeContext, ExecutionContext } from '../../src/worker/index.js';
import type { AgentBridge, AgentRequest, AgentResponse } from '../../src/agents/AgentBridge.js';

/**
 * Create a minimal stub bridge for testing.
 */
function createStubBridge(response: AgentResponse): AgentBridge {
  return {
    execute: vi.fn().mockResolvedValue(response),
    supports: vi.fn().mockReturnValue(true),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WorkerAgent - generateCode with bridge delegation', () => {
  let agent: WorkerAgent;
  let testDir: string;

  const createWorkOrder = (id: string = 'ISS-001', orderId: string = 'WO-001'): WorkOrder => ({
    orderId,
    issueId: id,
    createdAt: new Date().toISOString(),
    priority: 75,
    context: {
      relatedFiles: [{ path: 'src/foo.ts', reason: 'Main implementation file' }],
      dependenciesStatus: [],
    },
    acceptanceCriteria: ['Implement feature', 'Add tests'],
  });

  const createCodeContext = (workOrder: WorkOrder): CodeContext => ({
    relatedFiles: [
      {
        path: 'src/foo.ts',
        content: 'export const foo = 42;',
        reason: 'Main implementation file',
      },
    ],
    patterns: {
      indentation: 'spaces',
      indentSize: 2,
      quoteStyle: 'single',
      useSemicolons: true,
      trailingComma: 'es5',
      importStyle: 'named',
      exportStyle: 'named',
      errorHandling: 'try-catch',
      testFramework: 'vitest',
    },
    workOrder,
  });

  const createExecutionContext = (workOrder: WorkOrder): ExecutionContext => ({
    workOrder,
    codeContext: createCodeContext(workOrder),
    config: agent.getConfig(),
    options: {},
    attemptNumber: 1,
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `worker-codegen-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    agent = new WorkerAgent({
      projectRoot: testDir,
      resultsPath: '.ad-sdlc/scratchpad/progress',
    });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('setBridge', () => {
    it('should allow setting a bridge', () => {
      const bridge = createStubBridge({
        output: '[]',
        artifacts: [],
        success: true,
      });
      // Should not throw
      agent.setBridge(bridge);
    });
  });

  describe('generateCode with bridge', () => {
    it('should delegate to bridge when set', async () => {
      const bridgeResponse: AgentResponse = {
        output: JSON.stringify([
          {
            filePath: 'src/hello.ts',
            action: 'create',
            content: 'export const hello = "world";',
            description: 'Create hello module',
            linesAdded: 1,
            linesRemoved: 0,
          },
        ]),
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      expect(bridge.execute).toHaveBeenCalledOnce();
      const request = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentRequest;
      expect(request.agentType).toBe('worker');
      expect(request.projectDir).toBe(testDir);
    });

    it('should write files to disk on successful bridge response', async () => {
      const fileContent = 'export const greet = (name: string) => `Hello ${name}`;';
      const bridgeResponse: AgentResponse = {
        output: JSON.stringify([
          {
            filePath: 'src/greet.ts',
            action: 'create',
            content: fileContent,
            description: 'Create greet module',
            linesAdded: 1,
            linesRemoved: 0,
          },
        ]),
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const written = await readFile(join(testDir, 'src/greet.ts'), 'utf-8');
      expect(written).toBe(fileContent);
    });

    it('should record file changes from bridge output', async () => {
      const bridgeResponse: AgentResponse = {
        output: JSON.stringify([
          {
            filePath: 'src/new-file.ts',
            action: 'create',
            content: 'export const x = 1;',
            description: 'Create new file',
            linesAdded: 1,
            linesRemoved: 0,
          },
        ]),
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const changes = agent.getFileChanges();
      expect(changes.has('src/new-file.ts')).toBe(true);
      const change = changes.get('src/new-file.ts');
      expect(change?.changeType).toBe('create');
      expect(change?.linesAdded).toBe(1);
    });

    it('should throw CodeGenerationError when bridge returns failure', async () => {
      const bridgeResponse: AgentResponse = {
        output: '',
        artifacts: [],
        success: false,
        error: 'LLM returned an error',
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);

      await expect(agent.generateCode(ctx)).rejects.toThrow(CodeGenerationError);
    });

    it('should handle multiple file changes in one response', async () => {
      const bridgeResponse: AgentResponse = {
        output: JSON.stringify([
          {
            filePath: 'src/a.ts',
            action: 'create',
            content: 'export const a = 1;',
            description: 'Create a',
            linesAdded: 1,
            linesRemoved: 0,
          },
          {
            filePath: 'src/b.ts',
            action: 'create',
            content: 'export const b = 2;',
            description: 'Create b',
            linesAdded: 1,
            linesRemoved: 0,
          },
        ]),
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const changes = agent.getFileChanges();
      expect(changes.has('src/a.ts')).toBe(true);
      expect(changes.has('src/b.ts')).toBe(true);

      const contentA = await readFile(join(testDir, 'src/a.ts'), 'utf-8');
      expect(contentA).toBe('export const a = 1;');
      const contentB = await readFile(join(testDir, 'src/b.ts'), 'utf-8');
      expect(contentB).toBe('export const b = 2;');
    });

    it('should handle delete action', async () => {
      // Create a file first
      await mkdir(join(testDir, 'src'), { recursive: true });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(join(testDir, 'src/to-delete.ts'), 'old content');

      const bridgeResponse: AgentResponse = {
        output: JSON.stringify([
          {
            filePath: 'src/to-delete.ts',
            action: 'delete',
            description: 'Remove deprecated file',
            linesAdded: 0,
            linesRemoved: 5,
          },
        ]),
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      expect(existsSync(join(testDir, 'src/to-delete.ts'))).toBe(false);
      const changes = agent.getFileChanges();
      expect(changes.get('src/to-delete.ts')?.changeType).toBe('delete');
    });

    it('should pass work order and code context in bridge request', async () => {
      const bridgeResponse: AgentResponse = {
        output: '[]',
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder('ISS-042', 'WO-042');
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentRequest;
      expect(request.priorStageOutputs.issue).toContain('ISS-042');
      expect(request.priorStageOutputs.codeContext).toBeDefined();
    });

    it('should reject path traversal attempts', async () => {
      const bridgeResponse: AgentResponse = {
        output: JSON.stringify([
          {
            filePath: '../../../etc/passwd',
            action: 'create',
            content: 'malicious',
            description: 'Attempt path traversal',
            linesAdded: 1,
            linesRemoved: 0,
          },
        ]),
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);

      await expect(agent.generateCode(ctx)).rejects.toThrow(CodeGenerationError);
    });
  });

  describe('generateCode without bridge (fallback)', () => {
    it('should use stub behavior when no bridge is set', async () => {
      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      // Stub behavior records related files
      const changes = agent.getFileChanges();
      expect(changes.has('src/foo.ts')).toBe(true);
      expect(changes.get('src/foo.ts')?.linesAdded).toBe(0);
    });
  });

  describe('parseCodeGenOutput', () => {
    it('should parse valid JSON array', () => {
      const output = JSON.stringify([
        {
          filePath: 'src/test.ts',
          action: 'create',
          content: 'const x = 1;',
          description: 'Create test file',
          linesAdded: 1,
          linesRemoved: 0,
        },
      ]);

      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(1);
      expect(changes[0].filePath).toBe('src/test.ts');
      expect(changes[0].action).toBe('create');
      expect(changes[0].content).toBe('const x = 1;');
    });

    it('should parse JSON wrapped in markdown code fences', () => {
      const output =
        '```json\n[{"filePath":"src/x.ts","action":"create","content":"x","description":"d","linesAdded":1,"linesRemoved":0}]\n```';
      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(1);
      expect(changes[0].filePath).toBe('src/x.ts');
    });

    it('should parse JSON wrapped in plain code fences', () => {
      const output =
        '```\n[{"filePath":"src/y.ts","action":"modify","content":"y","description":"d","linesAdded":1,"linesRemoved":0}]\n```';
      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(1);
      expect(changes[0].action).toBe('modify');
    });

    it('should return empty array for invalid JSON', () => {
      const changes = agent.parseCodeGenOutput('not json at all');
      expect(changes).toHaveLength(0);
    });

    it('should return empty array for non-array JSON', () => {
      const changes = agent.parseCodeGenOutput('{"key": "value"}');
      expect(changes).toHaveLength(0);
    });

    it('should skip items with invalid action', () => {
      const output = JSON.stringify([
        { filePath: 'src/a.ts', action: 'invalid_action', content: 'x' },
        { filePath: 'src/b.ts', action: 'create', content: 'y', description: 'ok' },
      ]);
      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(1);
      expect(changes[0].filePath).toBe('src/b.ts');
    });

    it('should skip items missing filePath', () => {
      const output = JSON.stringify([{ action: 'create', content: 'x' }]);
      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(0);
    });

    it('should provide default description when missing', () => {
      const output = JSON.stringify([{ filePath: 'src/z.ts', action: 'create', content: 'z' }]);
      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(1);
      expect(changes[0].description).toBe('create src/z.ts');
    });

    it('should default linesAdded and linesRemoved to 0', () => {
      const output = JSON.stringify([{ filePath: 'src/w.ts', action: 'modify', content: 'w' }]);
      const changes = agent.parseCodeGenOutput(output);
      expect(changes[0].linesAdded).toBe(0);
      expect(changes[0].linesRemoved).toBe(0);
    });

    it('should handle empty array', () => {
      const changes = agent.parseCodeGenOutput('[]');
      expect(changes).toHaveLength(0);
    });

    it('should omit content property when not provided', () => {
      const output = JSON.stringify([
        { filePath: 'src/del.ts', action: 'delete', description: 'Delete file' },
      ]);
      const changes = agent.parseCodeGenOutput(output);
      expect(changes).toHaveLength(1);
      expect(changes[0].content).toBeUndefined();
    });
  });

  describe('buildCodeGenPrompt (via bridge request)', () => {
    it('should include issue ID and acceptance criteria in prompt', async () => {
      const bridgeResponse: AgentResponse = {
        output: '[]',
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder('ISS-099', 'WO-099');
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentRequest;
      expect(request.input).toContain('ISS-099');
      expect(request.input).toContain('Implement feature');
      expect(request.input).toContain('Add tests');
    });

    it('should include code style information in prompt', async () => {
      const bridgeResponse: AgentResponse = {
        output: '[]',
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentRequest;
      expect(request.input).toContain('single');
      expect(request.input).toContain('spaces');
    });

    it('should include related file content in prompt', async () => {
      const bridgeResponse: AgentResponse = {
        output: '[]',
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentRequest;
      expect(request.input).toContain('export const foo = 42;');
    });

    it('should include output format instructions', async () => {
      const bridgeResponse: AgentResponse = {
        output: '[]',
        artifacts: [],
        success: true,
      };
      const bridge = createStubBridge(bridgeResponse);
      agent.setBridge(bridge);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = (bridge.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentRequest;
      expect(request.input).toContain('Output Format');
      expect(request.input).toContain('JSON array');
    });
  });
});
