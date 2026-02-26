import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentDispatcher, AgentDispatchError } from '../../src/agents/AgentDispatcher.js';
import { BridgeRegistry } from '../../src/agents/BridgeRegistry.js';
import type { AgentBridge, AgentRequest, AgentResponse } from '../../src/agents/AgentBridge.js';
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
  public calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(agentId: string, name: string) {
    this.agentId = agentId;
    this.name = name;
  }

  async initialize(): Promise<void> {}
  async dispose(): Promise<void> {}
}

class TestBridge implements AgentBridge {
  private supportedTypes: Set<string>;
  public executeCalls: AgentRequest[] = [];
  public responseOverride?: Partial<AgentResponse>;

  constructor(supportedTypes: string[]) {
    this.supportedTypes = new Set(supportedTypes);
  }

  supports(agentType: string): boolean {
    return this.supportedTypes.has(agentType);
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    this.executeCalls.push(request);
    return {
      output: `Bridge output for ${request.agentType}`,
      artifacts: [],
      success: true,
      ...this.responseOverride,
    };
  }

  async dispose(): Promise<void> {}
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

describe('AgentDispatcher bridge integration', () => {
  let dispatcher: AgentDispatcher;
  let registry: BridgeRegistry;

  beforeEach(() => {
    registry = new BridgeRegistry();
    dispatcher = new AgentDispatcher(registry);
  });

  afterEach(async () => {
    await dispatcher.disposeAll();
  });

  describe('dispatch with registered bridge', () => {
    it('should use bridge when it supports the agent type', async () => {
      const bridge = new TestBridge(['collector']);
      registry.register(bridge);

      // Inject a mock agent so the type is valid
      const agent = new MockAgent('collector-agent', 'Collector Agent');
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession({ userRequest: 'Build a REST API' });

      const result = await dispatcher.dispatch(stage, session);

      expect(result).toBe('Bridge output for collector');
      expect(bridge.executeCalls).toHaveLength(1);
      expect(bridge.executeCalls[0]!.agentType).toBe('collector');
      expect(bridge.executeCalls[0]!.input).toBe('Build a REST API');
      expect(bridge.executeCalls[0]!.projectDir).toBe('/test/project');
    });

    it('should pass prior stage outputs in the request', async () => {
      const bridge = new TestBridge(['srs-writer']);
      registry.register(bridge);

      const agent = new MockAgent('srs-writer-agent', 'SRS Writer');
      dispatcher.setAgent('srs-writer', agent);

      const stage = createStage({ name: 'srs_generation', agentType: 'srs-writer' });
      const session = createSession({
        stageResults: [
          {
            name: 'prd_generation',
            status: 'completed',
            output: '{"prd": "content"}',
          },
          {
            name: 'collection',
            status: 'completed',
            output: '{"collected": true}',
          },
        ] as OrchestratorSession['stageResults'],
      });

      await dispatcher.dispatch(stage, session);

      expect(bridge.executeCalls[0]!.priorStageOutputs).toEqual({
        prd_generation: '{"prd": "content"}',
        collection: '{"collected": true}',
      });
    });

    it('should throw AgentDispatchError when bridge returns failure', async () => {
      const bridge = new TestBridge(['collector']);
      bridge.responseOverride = { success: false, error: 'API rate limited' };
      registry.register(bridge);

      const agent = new MockAgent('collector-agent', 'Collector');
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession();

      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(AgentDispatchError);
      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow('API rate limited');
    });

    it('should throw AgentDispatchError when bridge throws', async () => {
      const failingBridge: AgentBridge = {
        supports: () => true,
        execute: async () => { throw new Error('Connection refused'); },
        dispose: async () => {},
      };
      registry.register(failingBridge);

      const agent = new MockAgent('collector-agent', 'Collector');
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession();

      await expect(dispatcher.dispatch(stage, session)).rejects.toThrow(
        'Bridge execution failed: Connection refused'
      );
    });
  });

  describe('dispatch fallback to call adapters', () => {
    it('should use call adapter when no bridge supports the type', async () => {
      // Register bridge only for 'worker', not 'collector'
      const bridge = new TestBridge(['worker']);
      registry.register(bridge);

      // Inject collector agent with collectFromText
      const agent = new MockAgent('collector-agent', 'Collector Agent') as MockAgent & {
        collectFromText: (text: string, project?: string) => Promise<unknown>;
      };
      agent.collectFromText = async (text: string, project?: string) => {
        agent.calls.push({ method: 'collectFromText', args: [text, project] });
        return { collected: true, text };
      };
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession({ userRequest: 'Test request' });

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);

      // Should have used the adapter, not the bridge
      expect(parsed.collected).toBe(true);
      expect(parsed.text).toBe('Test request');
      expect(bridge.executeCalls).toHaveLength(0);
    });

    it('should use call adapter when no bridges are registered', async () => {
      const agent = new MockAgent('collector-agent', 'Collector Agent') as MockAgent & {
        collectFromText: (text: string, project?: string) => Promise<unknown>;
      };
      agent.collectFromText = async (text: string) => ({ collected: true, text });
      dispatcher.setAgent('collector', agent);

      const stage = createStage({ agentType: 'collector' });
      const session = createSession();

      const result = await dispatcher.dispatch(stage, session);
      const parsed = JSON.parse(result);
      expect(parsed.collected).toBe(true);
    });
  });

  describe('getBridgeRegistry', () => {
    it('should return the bridge registry', () => {
      expect(dispatcher.getBridgeRegistry()).toBe(registry);
    });
  });
});
