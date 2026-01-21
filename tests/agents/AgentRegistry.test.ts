import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentRegistry,
  AgentNotRegisteredError,
  AgentAlreadyRegisteredError,
  CircularDependencyError,
} from '../../src/agents/AgentRegistry.js';
import type { AgentMetadata, IAgent } from '../../src/agents/types.js';

class MockAgent implements IAgent {
  readonly agentId: string;
  readonly name: string;
  public initialized = false;
  public disposed = false;

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

function createMockMetadata(
  agentId: string,
  options: Partial<AgentMetadata> = {}
): AgentMetadata {
  return {
    agentId,
    name: options.name ?? `Mock ${agentId}`,
    description: options.description ?? `Description for ${agentId}`,
    lifecycle: options.lifecycle ?? 'singleton',
    dependencies: options.dependencies ?? [],
    factory: options.factory ?? (() => new MockAgent(agentId, `Mock ${agentId}`)),
  };
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    AgentRegistry.reset();
    registry = AgentRegistry.getInstance();
  });

  afterEach(() => {
    AgentRegistry.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AgentRegistry.getInstance();
      const instance2 = AgentRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = AgentRegistry.getInstance();
      AgentRegistry.reset();
      const instance2 = AgentRegistry.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('register', () => {
    it('should register a valid agent', () => {
      const metadata = createMockMetadata('test-agent');

      const result = registry.register(metadata);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('test-agent');
      expect(result.error).toBeUndefined();
    });

    it('should throw error when registering duplicate agent', () => {
      const metadata = createMockMetadata('test-agent');
      registry.register(metadata);

      expect(() => registry.register(metadata)).toThrow(AgentAlreadyRegisteredError);
    });

    it('should fail for invalid agentId', () => {
      const metadata = createMockMetadata('');
      metadata.agentId = '';

      const result = registry.register(metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('agentId');
    });

    it('should fail for invalid lifecycle', () => {
      const metadata = createMockMetadata('test-agent');
      // @ts-expect-error - intentionally invalid
      metadata.lifecycle = 'invalid';

      const result = registry.register(metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('lifecycle');
    });

    it('should fail for invalid factory', () => {
      const metadata = createMockMetadata('test-agent');
      // @ts-expect-error - intentionally invalid
      metadata.factory = 'not a function';

      const result = registry.register(metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('factory');
    });

    it('should register agent with dependencies', () => {
      const depMetadata = createMockMetadata('dependency-agent');
      const metadata = createMockMetadata('test-agent', {
        dependencies: [{ agentId: 'dependency-agent' }],
      });

      registry.register(depMetadata);
      const result = registry.register(metadata);

      expect(result.success).toBe(true);
    });

    it('should register agent with optional dependencies', () => {
      const metadata = createMockMetadata('test-agent', {
        dependencies: [{ agentId: 'optional-dep', optional: true }],
      });

      const result = registry.register(metadata);

      expect(result.success).toBe(true);
    });
  });

  describe('get', () => {
    it('should return registered agent metadata', () => {
      const metadata = createMockMetadata('test-agent');
      registry.register(metadata);

      const retrieved = registry.get('test-agent');

      expect(retrieved.agentId).toBe('test-agent');
      expect(retrieved.name).toBe('Mock test-agent');
    });

    it('should throw error for unregistered agent', () => {
      expect(() => registry.get('nonexistent')).toThrow(AgentNotRegisteredError);
    });
  });

  describe('has', () => {
    it('should return true for registered agent', () => {
      registry.register(createMockMetadata('test-agent'));

      expect(registry.has('test-agent')).toBe(true);
    });

    it('should return false for unregistered agent', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no agents registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered agent IDs', () => {
      registry.register(createMockMetadata('agent-1'));
      registry.register(createMockMetadata('agent-2'));
      registry.register(createMockMetadata('agent-3'));

      const all = registry.getAll();

      expect(all).toHaveLength(3);
      expect(all).toContain('agent-1');
      expect(all).toContain('agent-2');
      expect(all).toContain('agent-3');
    });
  });

  describe('getAllMetadata', () => {
    it('should return all registered metadata', () => {
      registry.register(createMockMetadata('agent-1'));
      registry.register(createMockMetadata('agent-2'));

      const allMetadata = registry.getAllMetadata();

      expect(allMetadata).toHaveLength(2);
      expect(allMetadata.map((m) => m.agentId)).toContain('agent-1');
      expect(allMetadata.map((m) => m.agentId)).toContain('agent-2');
    });
  });

  describe('unregister', () => {
    it('should unregister an agent', () => {
      registry.register(createMockMetadata('test-agent'));

      const result = registry.unregister('test-agent');

      expect(result).toBe(true);
      expect(registry.has('test-agent')).toBe(false);
    });

    it('should return false for unregistered agent', () => {
      const result = registry.unregister('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('validateDependencies', () => {
    it('should return empty array when all dependencies are registered', () => {
      registry.register(createMockMetadata('dep-1'));
      registry.register(createMockMetadata('dep-2'));
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'dep-1' }, { agentId: 'dep-2' }],
        })
      );

      const missing = registry.validateDependencies('test-agent');

      expect(missing).toEqual([]);
    });

    it('should return missing dependency IDs', () => {
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'missing-dep' }],
        })
      );

      const missing = registry.validateDependencies('test-agent');

      expect(missing).toEqual(['missing-dep']);
    });

    it('should not include optional missing dependencies', () => {
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'missing-dep', optional: true }],
        })
      );

      const missing = registry.validateDependencies('test-agent');

      expect(missing).toEqual([]);
    });
  });

  describe('getDependencyChain', () => {
    it('should return agent with no dependencies', () => {
      registry.register(createMockMetadata('test-agent'));

      const chain = registry.getDependencyChain('test-agent');

      expect(chain).toEqual(['test-agent']);
    });

    it('should return dependencies in correct order', () => {
      registry.register(createMockMetadata('dep-1'));
      registry.register(
        createMockMetadata('dep-2', {
          dependencies: [{ agentId: 'dep-1' }],
        })
      );
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'dep-2' }],
        })
      );

      const chain = registry.getDependencyChain('test-agent');

      expect(chain).toEqual(['dep-1', 'dep-2', 'test-agent']);
    });

    it('should detect circular dependencies', () => {
      registry.register(
        createMockMetadata('agent-a', {
          dependencies: [{ agentId: 'agent-b' }],
        })
      );
      registry.register(
        createMockMetadata('agent-b', {
          dependencies: [{ agentId: 'agent-a' }],
        })
      );

      expect(() => registry.getDependencyChain('agent-a')).toThrow(
        CircularDependencyError
      );
    });

    it('should detect indirect circular dependencies', () => {
      registry.register(
        createMockMetadata('agent-a', {
          dependencies: [{ agentId: 'agent-b' }],
        })
      );
      registry.register(
        createMockMetadata('agent-b', {
          dependencies: [{ agentId: 'agent-c' }],
        })
      );
      registry.register(
        createMockMetadata('agent-c', {
          dependencies: [{ agentId: 'agent-a' }],
        })
      );

      expect(() => registry.getDependencyChain('agent-a')).toThrow(
        CircularDependencyError
      );
    });
  });
});
