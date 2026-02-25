import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BridgeRegistry } from '../../src/agents/BridgeRegistry.js';
import { StubBridge } from '../../src/agents/bridges/StubBridge.js';
import type { AgentBridge, AgentRequest, AgentResponse } from '../../src/agents/AgentBridge.js';

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

class MockBridge implements AgentBridge {
  private supportedTypes: Set<string>;
  disposed = false;

  constructor(supportedTypes: string[]) {
    this.supportedTypes = new Set(supportedTypes);
  }

  supports(agentType: string): boolean {
    return this.supportedTypes.has(agentType);
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    return {
      output: `MockBridge executed ${request.agentType}`,
      artifacts: [],
      success: true,
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BridgeRegistry', () => {
  let registry: BridgeRegistry;

  beforeEach(() => {
    registry = new BridgeRegistry();
  });

  describe('resolve', () => {
    it('should return StubBridge when no bridges are registered', () => {
      const bridge = registry.resolve('collector');
      expect(bridge).toBeInstanceOf(StubBridge);
    });

    it('should return registered bridge when it supports the agent type', () => {
      const mockBridge = new MockBridge(['collector', 'prd-writer']);
      registry.register(mockBridge);

      const bridge = registry.resolve('collector');
      expect(bridge).toBe(mockBridge);
    });

    it('should fall back to StubBridge when no registered bridge supports the type', () => {
      const mockBridge = new MockBridge(['collector']);
      registry.register(mockBridge);

      const bridge = registry.resolve('srs-writer');
      expect(bridge).toBeInstanceOf(StubBridge);
    });

    it('should return first matching bridge in registration order', () => {
      const bridge1 = new MockBridge(['collector']);
      const bridge2 = new MockBridge(['collector', 'worker']);
      registry.register(bridge1);
      registry.register(bridge2);

      const resolved = registry.resolve('collector');
      expect(resolved).toBe(bridge1);
    });
  });

  describe('hasBridge', () => {
    it('should return false when no bridges are registered', () => {
      expect(registry.hasBridge('collector')).toBe(false);
    });

    it('should return true when a registered bridge supports the type', () => {
      registry.register(new MockBridge(['collector']));
      expect(registry.hasBridge('collector')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      registry.register(new MockBridge(['collector']));
      expect(registry.hasBridge('worker')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 when no bridges are registered', () => {
      expect(registry.size).toBe(0);
    });

    it('should return the number of registered bridges', () => {
      registry.register(new MockBridge(['collector']));
      registry.register(new MockBridge(['worker']));
      expect(registry.size).toBe(2);
    });
  });

  describe('disposeAll', () => {
    it('should dispose all registered bridges', async () => {
      const bridge1 = new MockBridge(['collector']);
      const bridge2 = new MockBridge(['worker']);
      registry.register(bridge1);
      registry.register(bridge2);

      await registry.disposeAll();

      expect(bridge1.disposed).toBe(true);
      expect(bridge2.disposed).toBe(true);
      expect(registry.size).toBe(0);
    });

    it('should handle dispose errors gracefully', async () => {
      const failingBridge: AgentBridge = {
        supports: () => true,
        execute: async () => ({ output: '', artifacts: [], success: true }),
        dispose: async () => { throw new Error('Dispose failed'); },
      };
      registry.register(failingBridge);

      await expect(registry.disposeAll()).resolves.toBeUndefined();
    });
  });
});

describe('StubBridge', () => {
  let stub: StubBridge;

  beforeEach(() => {
    stub = new StubBridge();
  });

  it('should support all agent types', () => {
    expect(stub.supports('collector')).toBe(true);
    expect(stub.supports('worker')).toBe(true);
    expect(stub.supports('unknown-type')).toBe(true);
  });

  it('should return success response with agent type in output', async () => {
    const request = createRequest({ agentType: 'prd-writer' });
    const response = await stub.execute(request);

    expect(response.success).toBe(true);
    expect(response.output).toContain('prd-writer');
    expect(response.artifacts).toEqual([]);
  });

  it('should dispose without error', async () => {
    await expect(stub.dispose()).resolves.toBeUndefined();
  });
});
