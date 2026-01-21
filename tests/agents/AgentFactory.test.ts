import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentFactory,
  AgentCreationError,
  AgentInitializationError,
  DependencyResolutionError,
} from '../../src/agents/AgentFactory.js';
import { AgentRegistry } from '../../src/agents/AgentRegistry.js';
import { AgentNotRegisteredError } from '../../src/agents/AgentRegistry.js';
import type { AgentMetadata, IAgent, AgentDependencies } from '../../src/agents/types.js';

class MockAgent implements IAgent {
  readonly agentId: string;
  readonly name: string;
  public initialized = false;
  public disposed = false;
  public readonly dependencies: AgentDependencies;

  constructor(agentId: string, name: string, dependencies: AgentDependencies = {}) {
    this.agentId = agentId;
    this.name = name;
    this.dependencies = dependencies;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

class FailingInitAgent implements IAgent {
  readonly agentId = 'failing-init';
  readonly name = 'Failing Init Agent';

  async initialize(): Promise<void> {
    throw new Error('Initialization failed');
  }

  async dispose(): Promise<void> {
    // noop
  }
}

class FailingFactoryAgent implements IAgent {
  readonly agentId = 'failing-factory';
  readonly name = 'Failing Factory Agent';

  constructor() {
    throw new Error('Factory failed');
  }

  async initialize(): Promise<void> {
    // noop
  }

  async dispose(): Promise<void> {
    // noop
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
    factory:
      options.factory ??
      ((deps) => new MockAgent(agentId, `Mock ${agentId}`, deps)),
  };
}

describe('AgentFactory', () => {
  let factory: AgentFactory;
  let registry: AgentRegistry;

  beforeEach(() => {
    AgentRegistry.reset();
    registry = AgentRegistry.getInstance();
    factory = AgentFactory.getInstance();
  });

  afterEach(async () => {
    await AgentFactory.reset();
    AgentRegistry.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AgentFactory.getInstance();
      const instance2 = AgentFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', async () => {
      const instance1 = AgentFactory.getInstance();
      await AgentFactory.reset();
      const instance2 = AgentFactory.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('create', () => {
    it('should create a singleton agent', async () => {
      registry.register(createMockMetadata('test-agent'));

      const agent = await factory.create<MockAgent>('test-agent');

      expect(agent).toBeInstanceOf(MockAgent);
      expect(agent.agentId).toBe('test-agent');
      expect(agent.initialized).toBe(true);
    });

    it('should return same instance for singleton', async () => {
      registry.register(createMockMetadata('test-agent'));

      const agent1 = await factory.create<MockAgent>('test-agent');
      const agent2 = await factory.create<MockAgent>('test-agent');

      expect(agent1).toBe(agent2);
    });

    it('should create new instances for transient agents', async () => {
      registry.register(
        createMockMetadata('test-agent', { lifecycle: 'transient' })
      );

      const agent1 = await factory.create<MockAgent>('test-agent');
      const agent2 = await factory.create<MockAgent>('test-agent');

      expect(agent1).not.toBe(agent2);
    });

    it('should force new instance with forceNew option', async () => {
      registry.register(createMockMetadata('test-agent'));

      const agent1 = await factory.create<MockAgent>('test-agent');
      const agent2 = await factory.create<MockAgent>('test-agent', {
        forceNew: true,
      });

      expect(agent1).not.toBe(agent2);
      expect(agent1.disposed).toBe(true); // Old instance should be disposed
    });

    it('should skip initialization with skipInitialize option', async () => {
      registry.register(createMockMetadata('test-agent'));

      const agent = await factory.create<MockAgent>('test-agent', {
        skipInitialize: true,
      });

      expect(agent.initialized).toBe(false);
    });

    it('should throw error for unregistered agent', async () => {
      await expect(factory.create('nonexistent')).rejects.toThrow(
        AgentNotRegisteredError
      );
    });

    it('should throw error when factory fails', async () => {
      registry.register(
        createMockMetadata('failing-factory', {
          factory: () => new FailingFactoryAgent(),
        })
      );

      await expect(factory.create('failing-factory')).rejects.toThrow(
        AgentCreationError
      );
    });

    it('should throw error when initialization fails', async () => {
      registry.register(
        createMockMetadata('failing-init', {
          factory: () => new FailingInitAgent(),
        })
      );

      await expect(factory.create('failing-init')).rejects.toThrow(
        AgentInitializationError
      );
    });

    it('should resolve dependencies', async () => {
      registry.register(createMockMetadata('dep-agent'));
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'dep-agent' }],
        })
      );

      const agent = await factory.create<MockAgent>('test-agent');

      expect(agent.dependencies['dep-agent']).toBeDefined();
      expect(agent.dependencies['dep-agent'].agentId).toBe('dep-agent');
    });

    it('should throw error for missing required dependency', async () => {
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'missing-dep' }],
        })
      );

      await expect(factory.create('test-agent')).rejects.toThrow(
        DependencyResolutionError
      );
    });

    it('should allow missing optional dependency', async () => {
      registry.register(
        createMockMetadata('test-agent', {
          dependencies: [{ agentId: 'missing-dep', optional: true }],
        })
      );

      const agent = await factory.create<MockAgent>('test-agent');

      expect(agent).toBeDefined();
      expect(agent.dependencies['missing-dep']).toBeUndefined();
    });
  });

  describe('isCached', () => {
    it('should return true for cached agent', async () => {
      registry.register(createMockMetadata('test-agent'));
      await factory.create('test-agent');

      expect(factory.isCached('test-agent')).toBe(true);
    });

    it('should return false for uncached agent', () => {
      expect(factory.isCached('test-agent')).toBe(false);
    });

    it('should return false for transient agent', async () => {
      registry.register(
        createMockMetadata('test-agent', { lifecycle: 'transient' })
      );
      await factory.create('test-agent');

      expect(factory.isCached('test-agent')).toBe(false);
    });
  });

  describe('getCached', () => {
    it('should return cached agent', async () => {
      registry.register(createMockMetadata('test-agent'));
      const created = await factory.create<MockAgent>('test-agent');

      const cached = factory.getCached<MockAgent>('test-agent');

      expect(cached).toBe(created);
    });

    it('should return undefined for uncached agent', () => {
      const cached = factory.getCached('test-agent');

      expect(cached).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should dispose a cached agent', async () => {
      registry.register(createMockMetadata('test-agent'));
      const agent = await factory.create<MockAgent>('test-agent');

      const result = await factory.dispose('test-agent');

      expect(result).toBe(true);
      expect(agent.disposed).toBe(true);
      expect(factory.isCached('test-agent')).toBe(false);
    });

    it('should return false for uncached agent', async () => {
      const result = await factory.dispose('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('disposeAll', () => {
    it('should dispose all cached agents', async () => {
      registry.register(createMockMetadata('agent-1'));
      registry.register(createMockMetadata('agent-2'));
      const agent1 = await factory.create<MockAgent>('agent-1');
      const agent2 = await factory.create<MockAgent>('agent-2');

      await factory.disposeAll();

      expect(agent1.disposed).toBe(true);
      expect(agent2.disposed).toBe(true);
      expect(factory.getCacheSize()).toBe(0);
    });

    it('should handle dispose errors gracefully', async () => {
      registry.register(
        createMockMetadata('error-agent', {
          factory: () => {
            const agent = new MockAgent('error-agent', 'Error Agent');
            agent.dispose = async () => {
              throw new Error('Dispose failed');
            };
            return agent;
          },
        })
      );
      await factory.create('error-agent');

      // Should not throw
      await expect(factory.disposeAll()).resolves.toBeUndefined();
    });
  });

  describe('getCacheSize', () => {
    it('should return 0 when no agents cached', () => {
      expect(factory.getCacheSize()).toBe(0);
    });

    it('should return correct count', async () => {
      registry.register(createMockMetadata('agent-1'));
      registry.register(createMockMetadata('agent-2'));
      await factory.create('agent-1');
      await factory.create('agent-2');

      expect(factory.getCacheSize()).toBe(2);
    });
  });

  describe('getCachedAgentIds', () => {
    it('should return empty array when no agents cached', () => {
      expect(factory.getCachedAgentIds()).toEqual([]);
    });

    it('should return all cached agent IDs', async () => {
      registry.register(createMockMetadata('agent-1'));
      registry.register(createMockMetadata('agent-2'));
      await factory.create('agent-1');
      await factory.create('agent-2');

      const ids = factory.getCachedAgentIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('agent-1');
      expect(ids).toContain('agent-2');
    });
  });
});
