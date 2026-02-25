import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentDispatcher,
  AgentDispatchError,
  AgentModuleError,
} from '../../src/agents/AgentDispatcher.js';
import type { AgentCallAdapter } from '../../src/agents/AgentDispatcher.js';
import type { IAgent } from '../../src/agents/types.js';
import type {
  PipelineStageDefinition,
  OrchestratorSession,
} from '../../src/ad-sdlc-orchestrator/types.js';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

class MockAgent implements IAgent {
  readonly agentId: string;
  readonly name: string;
  public initialized = false;
  public disposed = false;

  /** Track method calls for assertion */
  public calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(agentId: string, name: string) {
    this.agentId = agentId;
    this.name = name;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

/**
 * Create a MockAgent that also has generateFromProject for doc-writer testing
 */
function createDocWriterAgent(agentId: string, name: string): MockAgent & { generateFromProject: (id: string) => Promise<unknown> } {
  const agent = new MockAgent(agentId, name) as MockAgent & {
    generateFromProject: (id: string) => Promise<unknown>;
  };
  agent.generateFromProject = async (projectId: string) => {
    agent.calls.push({ method: 'generateFromProject', args: [projectId] });
    return { generated: true, projectId };
  };
  return agent;
}

/**
 * Create a MockAgent with collectFromText for collector testing
 */
function createCollectorAgent(): MockAgent & { collectFromText: (text: string, project?: string) => Promise<unknown> } {
  const agent = new MockAgent('collector-agent', 'Collector Agent') as MockAgent & {
    collectFromText: (text: string, project?: string) => Promise<unknown>;
  };
  agent.collectFromText = async (text: string, project?: string) => {
    agent.calls.push({ method: 'collectFromText', args: [text, project] });
    return { collected: true, text, project };
  };
  return agent;
}

/**
 * Create a MockAgent with session-based methods (startSession/detect/finalize)
 */
function createSessionAgent(agentId: string, name: string, primaryMethod: string): MockAgent {
  const agent = new MockAgent(agentId, name);
  const a = agent as Record<string, unknown>;
  a['startSession'] = async (dir: string) => {
    agent.calls.push({ method: 'startSession', args: [dir] });
  };
  a[primaryMethod] = async () => {
    agent.calls.push({ method: primaryMethod, args: [] });
    return { result: primaryMethod };
  };
  a['finalize'] = async () => {
    agent.calls.push({ method: 'finalize', args: [] });
  };
  return agent;
}

function createStage(overrides: Partial<PipelineStageDefinition> = {}): PipelineStageDefinition {
  return {
    name: 'collection',
    agentType: 'collector',
    description: 'Test stage',
    parallel: false,
    approvalRequired: false,
    dependsOn: [],
    ...overrides,
  } as PipelineStageDefinition;
}

function createSession(overrides: Partial<OrchestratorSession> = {}): OrchestratorSession {
  return {
    sessionId: 'test-session-001',
    projectDir: '/test/project',
    userRequest: 'Build a todo app',
    mode: 'greenfield',
    startedAt: '2026-01-01T00:00:00Z',
    status: 'running',
    stageResults: [],
    scratchpadDir: '/test/project/.ad-sdlc/scratchpad',
    ...overrides,
  } as OrchestratorSession;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentDispatcher', () => {
  let dispatcher: AgentDispatcher;

  beforeEach(() => {
    dispatcher = new AgentDispatcher();
  });

  afterEach(async () => {
    await dispatcher.disposeAll();
  });

  // ─── Constructor & Registration ────────────────────────────────────────

  describe('constructor', () => {
    it('should create an instance with default adapters registered', () => {
      // The constructor registers default adapters for known agent types
      expect(dispatcher.hasAdapter('collector')).toBe(true);
      expect(dispatcher.hasAdapter('prd-writer')).toBe(true);
      expect(dispatcher.hasAdapter('srs-writer')).toBe(true);
      expect(dispatcher.hasAdapter('sds-writer')).toBe(true);
      expect(dispatcher.hasAdapter('repo-detector')).toBe(true);
      expect(dispatcher.hasAdapter('github-repo-setup')).toBe(true);
      expect(dispatcher.hasAdapter('document-reader')).toBe(true);
      expect(dispatcher.hasAdapter('codebase-analyzer')).toBe(true);
      expect(dispatcher.hasAdapter('impact-analyzer')).toBe(true);
      expect(dispatcher.hasAdapter('prd-updater')).toBe(true);
      expect(dispatcher.hasAdapter('srs-updater')).toBe(true);
      expect(dispatcher.hasAdapter('sds-updater')).toBe(true);
      expect(dispatcher.hasAdapter('regression-tester')).toBe(true);
      expect(dispatcher.hasAdapter('issue-reader')).toBe(true);
    });

    it('should start with empty agent cache', () => {
      expect(dispatcher.cacheSize).toBe(0);
    });
  });

  // ─── registerAdapter ──────────────────────────────────────────────────

  describe('registerAdapter', () => {
    it('should register a custom adapter for an agent type', () => {
      const adapter: AgentCallAdapter = async () => 'custom result';
      dispatcher.registerAdapter('custom-agent', adapter);

      expect(dispatcher.hasAdapter('custom-agent')).toBe(true);
    });

    it('should override an existing adapter', () => {
      const adapter1: AgentCallAdapter = async () => 'result-1';
      const adapter2: AgentCallAdapter = async () => 'result-2';

      dispatcher.registerAdapter('test-type', adapter1);
      dispatcher.registerAdapter('test-type', adapter2);

      expect(dispatcher.hasAdapter('test-type')).toBe(true);
    });
  });

  // ─── setAgent / getCachedAgent ────────────────────────────────────────

  describe('setAgent / getCachedAgent', () => {
    it('should inject and retrieve a pre-created agent', () => {
      const agent = new MockAgent('test-agent', 'Test Agent');
      dispatcher.setAgent('test-type', agent);

      const cached = dispatcher.getCachedAgent('test-type');
      expect(cached).toBe(agent);
      expect(dispatcher.cacheSize).toBe(1);
    });

    it('should return undefined for a non-cached agent', () => {
      expect(dispatcher.getCachedAgent('nonexistent')).toBeUndefined();
    });
  });

  // ─── dispatch with pre-injected agents ────────────────────────────────

  describe('dispatch', () => {
    it('should throw AgentDispatchError for unknown agent type', async () => {
      const stage = createStage({ agentType: 'nonexistent-agent' });
      const session = createSession();

      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(
        AgentDispatchError
      );
      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(
        "Unknown agent type 'nonexistent-agent'"
      );
    });

    it('should dispatch collector agent with collectFromText', async () => {
      const agent = createCollectorAgent();
      dispatcher.setAgent('collector', agent);

      const stage = createStage({
        name: 'collection',
        agentType: 'collector',
      });
      const session = createSession({
        projectDir: '/home/user/my-project',
        userRequest: 'Build a REST API',
      });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.collected).toBe(true);
      expect(parsed.text).toBe('Build a REST API');
      expect(parsed.project).toBe('my-project');
      expect(agent.calls).toHaveLength(1);
      expect(agent.calls[0]!.method).toBe('collectFromText');
    });

    it('should dispatch doc writer agent with generateFromProject', async () => {
      const agent = createDocWriterAgent('prd-writer-agent', 'PRD Writer Agent');
      dispatcher.setAgent('prd-writer', agent);

      const stage = createStage({
        name: 'prd_generation',
        agentType: 'prd-writer',
      });
      const session = createSession({ projectDir: '/home/user/my-app' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.generated).toBe(true);
      expect(parsed.projectId).toBe('my-app');
      expect(agent.calls[0]!.method).toBe('generateFromProject');
    });

    it('should dispatch repo-detector agent with startSession/detect/finalize', async () => {
      const agent = createSessionAgent('repo-detector-agent', 'Repo Detector', 'detect');
      dispatcher.setAgent('repo-detector', agent);

      const stage = createStage({
        name: 'repo_detection',
        agentType: 'repo-detector',
      });
      const session = createSession({ projectDir: '/test/repo' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.result).toBe('detect');
      expect(agent.calls).toHaveLength(3);
      expect(agent.calls[0]!.method).toBe('startSession');
      expect(agent.calls[0]!.args[0]).toBe('/test/repo');
      expect(agent.calls[1]!.method).toBe('detect');
      expect(agent.calls[2]!.method).toBe('finalize');
    });

    it('should dispatch github-repo-setup agent with startSession/setup/finalize', async () => {
      const agent = createSessionAgent('github-repo-setup-agent', 'GitHub Repo Setup', 'setup');
      dispatcher.setAgent('github-repo-setup', agent);

      const stage = createStage({
        name: 'github_repo_setup',
        agentType: 'github-repo-setup',
      });
      const session = createSession({ projectDir: '/test/repo' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.result).toBe('setup');
      expect(agent.calls.map((c) => c.method)).toEqual([
        'startSession',
        'setup',
        'finalize',
      ]);
    });

    it('should dispatch document-reader with startSession/readAll/finalize', async () => {
      const agent = createSessionAgent('document-reader-agent', 'Document Reader', 'readAll');
      dispatcher.setAgent('document-reader', agent);

      const stage = createStage({
        name: 'document_reading',
        agentType: 'document-reader',
      });
      const session = createSession();

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.result).toBe('readAll');
      expect(agent.calls.map((c) => c.method)).toEqual([
        'startSession',
        'readAll',
        'finalize',
      ]);
    });

    it('should dispatch codebase-analyzer with startSession/analyze/finalize', async () => {
      const agent = createSessionAgent('codebase-analyzer-agent', 'Codebase Analyzer', 'analyze');
      dispatcher.setAgent('codebase-analyzer', agent);

      const stage = createStage({
        name: 'codebase_analysis',
        agentType: 'codebase-analyzer',
      });
      const session = createSession();

      const result = await dispatcher.dispatch(stage, session);
      expect(agent.calls.map((c) => c.method)).toEqual([
        'startSession',
        'analyze',
        'finalize',
      ]);
    });

    it('should dispatch updaters with updateFromProject', async () => {
      const agent = new MockAgent('prd-updater-agent', 'PRD Updater Agent');
      const a = agent as Record<string, unknown>;
      a['updateFromProject'] = async (projectId: string) => {
        agent.calls.push({ method: 'updateFromProject', args: [projectId] });
        return { updated: true, projectId };
      };
      dispatcher.setAgent('prd-updater', agent);

      const stage = createStage({
        name: 'prd_update',
        agentType: 'prd-updater',
      });
      const session = createSession({ projectDir: '/project/root' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.updated).toBe(true);
      expect(parsed.projectId).toBe('root');
    });

    it('should dispatch regression-tester with startSession/run/finalize', async () => {
      const agent = createSessionAgent('regression-tester-agent', 'Regression Tester', 'run');
      dispatcher.setAgent('regression-tester', agent);

      const stage = createStage({
        name: 'regression_testing',
        agentType: 'regression-tester',
      });
      const session = createSession();

      await dispatcher.dispatch(stage, session);

      expect(agent.calls.map((c) => c.method)).toEqual([
        'startSession',
        'run',
        'finalize',
      ]);
    });

    it('should dispatch issue-reader with startSession/read/finalize', async () => {
      const agent = createSessionAgent('issue-reader-agent', 'Issue Reader', 'read');
      dispatcher.setAgent('issue-reader', agent);

      const stage = createStage({
        name: 'issue_reading',
        agentType: 'issue-reader',
      });
      const session = createSession();

      await dispatcher.dispatch(stage, session);

      expect(agent.calls.map((c) => c.method)).toEqual([
        'startSession',
        'read',
        'finalize',
      ]);
    });

    it('should wrap dispatch errors in AgentDispatchError', async () => {
      const agent = new MockAgent('collector-agent', 'Collector Agent');
      const a = agent as Record<string, unknown>;
      a['collectFromText'] = async () => {
        throw new Error('Network timeout');
      };
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession();

      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(
        AgentDispatchError
      );
      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(
        'Agent execution failed: Network timeout'
      );
    });
  });

  // ─── Custom adapter dispatch ──────────────────────────────────────────

  describe('dispatch with custom adapter', () => {
    it('should use custom adapter when registered', async () => {
      const agent = new MockAgent('collector-agent', 'Collector Agent');
      dispatcher.setAgent('collector', agent);

      // Override the default collector adapter
      dispatcher.registerAdapter('collector', async (_agent, _stage, session) => {
        return `Custom: ${session.userRequest}`;
      });

      const stage = createStage({ agentType: 'collector' });
      const session = createSession({ userRequest: 'Hello' });

      const result = await dispatcher.dispatch(stage, session);
      expect(result).toBe('Custom: Hello');
    });
  });

  // ─── Default adapter fallback ─────────────────────────────────────────

  describe('default adapter fallback', () => {
    it('should try generateFromProject for agents with that method', async () => {
      // Use an agent type that does not have a registered adapter
      // We need to simulate this by clearing adapters and using a known type
      const agent = createDocWriterAgent('analysis-orchestrator-agent', 'Analysis Orchestrator');
      dispatcher.setAgent('analysis-orchestrator', agent);

      // analysis-orchestrator does not have a registered adapter,
      // so the default adapter should be used
      const stage = createStage({
        name: 'codebase_analysis' as PipelineStageDefinition['name'],
        agentType: 'analysis-orchestrator',
      });
      const session = createSession({ projectDir: '/test/project' });

      // The default adapter should discover generateFromProject
      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.generated).toBe(true);
      expect(parsed.projectId).toBe('project');
    });

    it('should try analyze for agents with that method', async () => {
      const agent = new MockAgent('analysis-orchestrator-agent', 'Analysis Orchestrator');
      const a = agent as Record<string, unknown>;
      a['analyze'] = async (dir: string) => {
        agent.calls.push({ method: 'analyze', args: [dir] });
        return { analyzed: true, dir };
      };
      dispatcher.setAgent('analysis-orchestrator', agent);

      const stage = createStage({
        name: 'codebase_analysis' as PipelineStageDefinition['name'],
        agentType: 'analysis-orchestrator',
      });
      const session = createSession({ projectDir: '/test/project' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.analyzed).toBe(true);
    });

    it('should try execute for agents with that method', async () => {
      const agent = new MockAgent('analysis-orchestrator-agent', 'Analysis Orchestrator');
      const a = agent as Record<string, unknown>;
      a['execute'] = async (session: OrchestratorSession) => {
        agent.calls.push({ method: 'execute', args: [session] });
        return { executed: true };
      };
      dispatcher.setAgent('analysis-orchestrator', agent);

      const stage = createStage({
        name: 'codebase_analysis' as PipelineStageDefinition['name'],
        agentType: 'analysis-orchestrator',
      });
      const session = createSession();

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.executed).toBe(true);
    });

    it('should return descriptive string for agents with no matching method', async () => {
      const agent = new MockAgent('analysis-orchestrator-agent', 'Analysis Orchestrator');
      dispatcher.setAgent('analysis-orchestrator', agent);

      const stage = createStage({
        name: 'codebase_analysis' as PipelineStageDefinition['name'],
        agentType: 'analysis-orchestrator',
      });
      const session = createSession();

      const result = await dispatcher.dispatch(stage, session);
      expect(result).toContain('analysis-orchestrator-agent');
      expect(result).toContain('codebase_analysis');
    });
  });

  // ─── Singleton caching behavior ───────────────────────────────────────

  describe('singleton caching', () => {
    it('should return the same cached agent on repeated dispatch', async () => {
      const agent = createCollectorAgent();
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession();

      // Dispatch twice
      await dispatcher.dispatch(stage, session);
      await dispatcher.dispatch(stage, session);

      // Agent should have been called twice but be the same instance
      expect(agent.calls).toHaveLength(2);
      expect(dispatcher.getCachedAgent('collector')).toBe(agent);
    });

    it('should track cache size correctly', () => {
      const agent1 = new MockAgent('agent-1', 'Agent 1');
      const agent2 = new MockAgent('agent-2', 'Agent 2');

      dispatcher.setAgent('type-1', agent1);
      dispatcher.setAgent('type-2', agent2);

      expect(dispatcher.cacheSize).toBe(2);
    });
  });

  // ─── disposeAll ───────────────────────────────────────────────────────

  describe('disposeAll', () => {
    it('should dispose all cached agents and clear the cache', async () => {
      const agent1 = new MockAgent('agent-1', 'Agent 1');
      const agent2 = new MockAgent('agent-2', 'Agent 2');

      dispatcher.setAgent('type-1', agent1);
      dispatcher.setAgent('type-2', agent2);

      await dispatcher.disposeAll();

      expect(agent1.disposed).toBe(true);
      expect(agent2.disposed).toBe(true);
      expect(dispatcher.cacheSize).toBe(0);
    });

    it('should clear adapters on disposeAll', async () => {
      dispatcher.registerAdapter('custom', async () => 'custom');
      expect(dispatcher.hasAdapter('custom')).toBe(true);

      await dispatcher.disposeAll();

      expect(dispatcher.hasAdapter('custom')).toBe(false);
    });

    it('should handle dispose errors gracefully', async () => {
      const agent = new MockAgent('agent-1', 'Agent 1');
      agent.dispose = async () => {
        throw new Error('Dispose failed');
      };

      dispatcher.setAgent('type-1', agent);

      // Should not throw
      await expect(dispatcher.disposeAll()).resolves.toBeUndefined();
      expect(dispatcher.cacheSize).toBe(0);
    });
  });

  // ─── Adapter falls back to default when method not found ──────────────

  describe('adapter fallback to defaultAdapter', () => {
    it('should fall back to default when collector has no collectFromText', async () => {
      // Agent without collectFromText but with analyze
      const agent = new MockAgent('collector-agent', 'Collector Agent');
      const a = agent as Record<string, unknown>;
      a['analyze'] = async (dir: string) => ({ analyzed: dir });
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession();

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.analyzed).toBe(session.projectDir);
    });

    it('should fall back to default when repo-detector has no startSession', async () => {
      const agent = new MockAgent('repo-detector-agent', 'Repo Detector');
      dispatcher.setAgent('repo-detector', agent);

      const stage = createStage({
        name: 'repo_detection',
        agentType: 'repo-detector',
      });
      const session = createSession();

      // Should not throw; uses default adapter's descriptive string
      const result = await dispatcher.dispatch(stage, session);
      expect(result).toContain('repo-detector-agent');
    });
  });

  // ─── SRS / SDS writer dispatches ─────────────────────────────────────

  describe('srs-writer and sds-writer dispatches', () => {
    it('should dispatch srs-writer with generateFromProject', async () => {
      const agent = createDocWriterAgent('srs-writer-agent', 'SRS Writer Agent');
      dispatcher.setAgent('srs-writer', agent);

      const stage = createStage({
        name: 'srs_generation',
        agentType: 'srs-writer',
      });
      const session = createSession({ projectDir: '/workspace/my-srs-project' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.generated).toBe(true);
      expect(parsed.projectId).toBe('my-srs-project');
    });

    it('should dispatch sds-writer with generateFromProject', async () => {
      const agent = createDocWriterAgent('sds-writer-agent', 'SDS Writer Agent');
      dispatcher.setAgent('sds-writer', agent);

      const stage = createStage({
        name: 'sds_generation',
        agentType: 'sds-writer',
      });
      const session = createSession({ projectDir: '/workspace/design-project' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.generated).toBe(true);
      expect(parsed.projectId).toBe('design-project');
    });
  });

  // ─── Impact analyzer dispatch ─────────────────────────────────────────

  describe('impact-analyzer dispatch', () => {
    it('should dispatch impact-analyzer with startSession/analyze/finalize', async () => {
      const agent = createSessionAgent('impact-analyzer-agent', 'Impact Analyzer', 'analyze');
      dispatcher.setAgent('impact-analyzer', agent);

      const stage = createStage({
        name: 'impact_analysis',
        agentType: 'impact-analyzer',
      });
      const session = createSession({ projectDir: '/test/impact-project' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      expect(parsed.result).toBe('analyze');
      expect(agent.calls[0]!.method).toBe('startSession');
      expect(agent.calls[0]!.args[0]).toBe('/test/impact-project');
      expect(agent.calls[1]!.method).toBe('analyze');
      expect(agent.calls[2]!.method).toBe('finalize');
    });
  });

  // ─── SRS/SDS updater dispatch ─────────────────────────────────────────

  describe('srs-updater and sds-updater dispatch', () => {
    it('should dispatch srs-updater with updateFromProject', async () => {
      const agent = new MockAgent('srs-updater-agent', 'SRS Updater Agent');
      const a = agent as Record<string, unknown>;
      a['updateFromProject'] = async (projectId: string) => {
        agent.calls.push({ method: 'updateFromProject', args: [projectId] });
        return { updated: true };
      };
      dispatcher.setAgent('srs-updater', agent);

      const stage = createStage({
        name: 'srs_update',
        agentType: 'srs-updater',
      });
      const session = createSession({ projectDir: '/test/update-project' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.updated).toBe(true);
      expect(agent.calls[0]!.args[0]).toBe('update-project');
    });

    it('should dispatch sds-updater with updateFromProject', async () => {
      const agent = new MockAgent('sds-updater-agent', 'SDS Updater Agent');
      const a = agent as Record<string, unknown>;
      a['updateFromProject'] = async (projectId: string) => {
        agent.calls.push({ method: 'updateFromProject', args: [projectId] });
        return { updated: true };
      };
      dispatcher.setAgent('sds-updater', agent);

      const stage = createStage({
        name: 'sds_update',
        agentType: 'sds-updater',
      });
      const session = createSession({ projectDir: '/test/sds-project' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.updated).toBe(true);
    });
  });
});
