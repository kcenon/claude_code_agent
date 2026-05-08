import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorkerAgent, CodeGenerationError } from '../../src/worker/index.js';
import type { WorkOrder, CodeContext, ExecutionContext } from '../../src/worker/index.js';
import { MockExecutionAdapter } from '../../src/execution/index.js';
import type {
  ArtifactRef,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../src/execution/index.js';
import { ErrorSeverity } from '../../src/errors/types.js';

/**
 * Build a successful StageExecutionResult with the given artifacts.
 */
function successResult(artifacts: ArtifactRef[]): StageExecutionResult {
  return {
    status: 'success',
    artifacts,
    sessionId: 'mock-session',
    toolCallCount: 0,
    tokenUsage: { input: 0, output: 0, cache: 0 },
  };
}

/**
 * Build a failed StageExecutionResult with the given error message.
 */
function failedResult(message: string): StageExecutionResult {
  return {
    status: 'failed',
    artifacts: [],
    sessionId: 'mock-session',
    toolCallCount: 0,
    tokenUsage: { input: 0, output: 0, cache: 0 },
    error: {
      code: 'EXEC-TEST',
      message,
      severity: ErrorSeverity.HIGH,
      context: {},
      timestamp: new Date().toISOString(),
    },
  };
}

describe('WorkerAgent - generateCode with ExecutionAdapter delegation', () => {
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

  describe('setExecutionAdapter', () => {
    it('should allow setting an execution adapter', () => {
      const adapter = new MockExecutionAdapter();
      // Should not throw
      agent.setExecutionAdapter(adapter);
    });
  });

  describe('generateCode with adapter', () => {
    it('should delegate to adapter when set', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      expect(adapter.calls).toHaveLength(1);
      const request = adapter.calls[0] as StageExecutionRequest;
      expect(request.agentType).toBe('worker');
      expect(request.workOrder).toContain('ISS-001');
    });

    it('should record file changes from adapter artifacts', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([
          { path: 'src/new-file.ts', description: 'Created new file' },
        ]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const changes = agent.getFileChanges();
      expect(changes.has('src/new-file.ts')).toBe(true);
      const change = changes.get('src/new-file.ts');
      expect(change?.changeType).toBe('modify');
    });

    it('should throw CodeGenerationError when adapter returns failure', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: failedResult('LLM returned an error'),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);

      await expect(agent.generateCode(ctx)).rejects.toThrow(CodeGenerationError);
    });

    it('should handle multiple artifacts in one response', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([
          { path: 'src/a.ts', description: 'Created a' },
          { path: 'src/b.ts', description: 'Created b' },
        ]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const changes = agent.getFileChanges();
      expect(changes.has('src/a.ts')).toBe(true);
      expect(changes.has('src/b.ts')).toBe(true);
    });

    it('should pass work order and code context in prior outputs', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder('ISS-042', 'WO-042');
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = adapter.calls[0] as StageExecutionRequest;
      expect(request.priorOutputs.issue).toContain('ISS-042');
      expect(request.priorOutputs.codeContext).toBeDefined();
    });

    it('should skip artifacts that escape project root', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([
          { path: '../../../etc/passwd', description: 'Escape attempt' },
          { path: 'src/legit.ts', description: 'Legitimate file' },
        ]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const changes = agent.getFileChanges();
      // Out-of-project artifact must be silently skipped
      expect(changes.has('../../../etc/passwd')).toBe(false);
      // Legitimate artifact is recorded
      expect(changes.has('src/legit.ts')).toBe(true);
    });

    it('should normalize absolute artifact paths to project-relative', async () => {
      const absoluteArtifact = join(testDir, 'src/abs.ts');
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([{ path: absoluteArtifact }]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const changes = agent.getFileChanges();
      // Stored as project-relative
      expect(changes.has(join('src', 'abs.ts'))).toBe(true);
    });
  });

  describe('generateCode without adapter (fallback)', () => {
    it('should use stub behavior when no adapter is set', async () => {
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

  describe('buildCodeGenPrompt (via adapter request)', () => {
    it('should include issue ID and acceptance criteria in prompt', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder('ISS-099', 'WO-099');
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = adapter.calls[0] as StageExecutionRequest;
      expect(request.workOrder).toContain('ISS-099');
      expect(request.workOrder).toContain('Implement feature');
      expect(request.workOrder).toContain('Add tests');
    });

    it('should include code style information in prompt', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = adapter.calls[0] as StageExecutionRequest;
      expect(request.workOrder).toContain('single');
      expect(request.workOrder).toContain('spaces');
    });

    it('should include related file content in prompt', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = adapter.calls[0] as StageExecutionRequest;
      expect(request.workOrder).toContain('export const foo = 42;');
    });

    it('should include output format instructions', async () => {
      const adapter = new MockExecutionAdapter({
        defaultResult: successResult([]),
      });
      agent.setExecutionAdapter(adapter);

      const workOrder = createWorkOrder();
      const ctx = createExecutionContext(workOrder);
      await agent.generateCode(ctx);

      const request = adapter.calls[0] as StageExecutionRequest;
      expect(request.workOrder).toContain('Output Format');
      expect(request.workOrder).toContain('JSON array');
    });
  });
});
