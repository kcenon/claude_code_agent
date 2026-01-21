/**
 * AgentFactory integration tests
 *
 * Tests the end-to-end behavior of AgentFactory including:
 * - Lazy initialization
 * - Dependency resolution chains
 * - Concurrent access patterns
 * - Lifecycle management across multiple agents
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentFactory,
  AgentCreationError,
  AgentInitializationError,
} from '../../src/agents/AgentFactory.js';
import { AgentRegistry, AgentNotRegisteredError } from '../../src/agents/AgentRegistry.js';
import type { IAgent, AgentMetadata, AgentDependencies, LazyAgent } from '../../src/agents/types.js';

class TestAgent implements IAgent {
  readonly agentId: string;
  readonly name: string;
  public initializeCount = 0;
  public disposeCount = 0;
  public readonly dependencies: AgentDependencies;

  constructor(agentId: string, name: string, dependencies: AgentDependencies = {}) {
    this.agentId = agentId;
    this.name = name;
    this.dependencies = dependencies;
  }

  async initialize(): Promise<void> {
    this.initializeCount++;
  }

  async dispose(): Promise<void> {
    this.disposeCount++;
  }
}

class SlowInitAgent implements IAgent {
  readonly agentId: string;
  readonly name: string;
  public initializeCount = 0;
  private readonly delayMs: number;

  constructor(agentId: string, delayMs = 50) {
    this.agentId = agentId;
    this.name = `Slow Agent (${delayMs}ms)`;
    this.delayMs = delayMs;
  }

  async initialize(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.initializeCount++;
  }

  async dispose(): Promise<void> {}
}

function createTestMetadata(
  agentId: string,
  options: Partial<AgentMetadata> = {}
): AgentMetadata {
  return {
    agentId,
    name: options.name ?? `Test ${agentId}`,
    description: options.description ?? `Test agent ${agentId}`,
    lifecycle: options.lifecycle ?? 'singleton',
    dependencies: options.dependencies ?? [],
    factory: options.factory ?? ((deps) => new TestAgent(agentId, `Test ${agentId}`, deps)),
  };
}

describe('AgentFactory Integration', () => {
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

  describe('Lazy Initialization', () => {
    it('should not instantiate agent until first access', async () => {
      let factoryCallCount = 0;
      registry.register(
        createTestMetadata('lazy-test', {
          factory: (deps) => {
            factoryCallCount++;
            return new TestAgent('lazy-test', 'Lazy Test', deps);
          },
        })
      );

      const lazyAgent = factory.lazy<TestAgent>('lazy-test');

      expect(lazyAgent.isInstantiated).toBe(false);
      expect(factoryCallCount).toBe(0);

      const agent = await lazyAgent.get();

      expect(lazyAgent.isInstantiated).toBe(true);
      expect(factoryCallCount).toBe(1);
      expect(agent.agentId).toBe('lazy-test');
    });

    it('should return same instance on subsequent access', async () => {
      registry.register(createTestMetadata('lazy-singleton'));

      const lazyAgent = factory.lazy<TestAgent>('lazy-singleton');

      const first = await lazyAgent.get();
      const second = await lazyAgent.get();
      const third = await lazyAgent.get();

      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(first.initializeCount).toBe(1);
    });

    it('should handle concurrent access correctly', async () => {
      let factoryCallCount = 0;
      registry.register(
        createTestMetadata('concurrent-lazy', {
          factory: (deps) => {
            factoryCallCount++;
            return new SlowInitAgent('concurrent-lazy', 50);
          },
        })
      );

      const lazyAgent = factory.lazy<SlowInitAgent>('concurrent-lazy');

      const results = await Promise.all([
        lazyAgent.get(),
        lazyAgent.get(),
        lazyAgent.get(),
        lazyAgent.get(),
        lazyAgent.get(),
      ]);

      expect(factoryCallCount).toBe(1);
      expect(new Set(results).size).toBe(1);
      expect(results[0].initializeCount).toBe(1);
    });

    it('should skip initialization when initializeOnAccess is false', async () => {
      registry.register(createTestMetadata('no-init-lazy'));

      const lazyAgent = factory.lazy<TestAgent>('no-init-lazy', {
        initializeOnAccess: false,
      });

      const agent = await lazyAgent.get();

      expect(agent.initializeCount).toBe(0);
    });

    it('should dispose agent only if instantiated', async () => {
      registry.register(createTestMetadata('dispose-lazy'));

      const lazyAgent = factory.lazy<TestAgent>('dispose-lazy');

      await lazyAgent.dispose();
      expect(lazyAgent.isInstantiated).toBe(false);

      const agent = await lazyAgent.get();
      expect(agent.disposeCount).toBe(0);

      await lazyAgent.dispose();
      expect(agent.disposeCount).toBe(1);
      expect(lazyAgent.isInstantiated).toBe(false);
    });

    it('should throw AgentNotRegisteredError on access for unregistered agent', async () => {
      const lazyAgent = factory.lazy<TestAgent>('nonexistent-agent');

      expect(lazyAgent.isInstantiated).toBe(false);

      await expect(lazyAgent.get()).rejects.toThrow(AgentNotRegisteredError);
    });
  });

  describe('Dependency Chain Resolution', () => {
    it('should resolve multi-level dependency chain', async () => {
      registry.register(createTestMetadata('level-0'));
      registry.register(
        createTestMetadata('level-1', {
          dependencies: [{ agentId: 'level-0' }],
        })
      );
      registry.register(
        createTestMetadata('level-2', {
          dependencies: [{ agentId: 'level-1' }],
        })
      );
      registry.register(
        createTestMetadata('level-3', {
          dependencies: [{ agentId: 'level-2' }],
        })
      );

      const agent = await factory.create<TestAgent>('level-3');

      expect(agent.dependencies['level-2']).toBeDefined();
      const level2 = agent.dependencies['level-2'] as TestAgent;
      expect(level2.dependencies['level-1']).toBeDefined();
      const level1 = level2.dependencies['level-1'] as TestAgent;
      expect(level1.dependencies['level-0']).toBeDefined();
    });

    it('should share singleton dependencies across agents', async () => {
      registry.register(createTestMetadata('shared-dep'));
      registry.register(
        createTestMetadata('consumer-a', {
          dependencies: [{ agentId: 'shared-dep' }],
        })
      );
      registry.register(
        createTestMetadata('consumer-b', {
          dependencies: [{ agentId: 'shared-dep' }],
        })
      );

      const consumerA = await factory.create<TestAgent>('consumer-a');
      const consumerB = await factory.create<TestAgent>('consumer-b');

      expect(consumerA.dependencies['shared-dep']).toBe(
        consumerB.dependencies['shared-dep']
      );
    });

    it('should handle optional dependencies gracefully', async () => {
      registry.register(createTestMetadata('required-dep'));
      registry.register(
        createTestMetadata('mixed-deps', {
          dependencies: [
            { agentId: 'required-dep' },
            { agentId: 'optional-missing', optional: true },
          ],
        })
      );

      const agent = await factory.create<TestAgent>('mixed-deps');

      expect(agent.dependencies['required-dep']).toBeDefined();
      expect(agent.dependencies['optional-missing']).toBeUndefined();
    });
  });

  describe('Concurrent Creation', () => {
    it('should handle concurrent singleton creation correctly', async () => {
      let factoryCallCount = 0;
      registry.register(
        createTestMetadata('concurrent-singleton', {
          factory: (deps) => {
            factoryCallCount++;
            return new SlowInitAgent('concurrent-singleton', 30);
          },
        })
      );

      const results = await Promise.all([
        factory.create<SlowInitAgent>('concurrent-singleton'),
        factory.create<SlowInitAgent>('concurrent-singleton'),
        factory.create<SlowInitAgent>('concurrent-singleton'),
      ]);

      expect(new Set(results).size).toBeLessThanOrEqual(factoryCallCount);
      const finalCached = factory.getCached<SlowInitAgent>('concurrent-singleton');
      expect(results.every((r) => r === finalCached || r.initializeCount === 1)).toBe(true);
    });

    it('should create separate instances for concurrent transient creation', async () => {
      let factoryCallCount = 0;
      registry.register(
        createTestMetadata('concurrent-transient', {
          lifecycle: 'transient',
          factory: (deps) => {
            factoryCallCount++;
            return new TestAgent(
              'concurrent-transient',
              `Instance ${factoryCallCount}`,
              deps
            );
          },
        })
      );

      const results = await Promise.all([
        factory.create<TestAgent>('concurrent-transient'),
        factory.create<TestAgent>('concurrent-transient'),
        factory.create<TestAgent>('concurrent-transient'),
      ]);

      expect(factoryCallCount).toBe(3);
      expect(new Set(results).size).toBe(3);
    });
  });

  describe('Lifecycle Management', () => {
    it('should properly dispose all agents on reset', async () => {
      registry.register(createTestMetadata('agent-1'));
      registry.register(createTestMetadata('agent-2'));
      registry.register(createTestMetadata('agent-3'));

      const agents = await Promise.all([
        factory.create<TestAgent>('agent-1'),
        factory.create<TestAgent>('agent-2'),
        factory.create<TestAgent>('agent-3'),
      ]);

      expect(factory.getCacheSize()).toBe(3);

      await AgentFactory.reset();

      agents.forEach((agent) => {
        expect(agent.disposeCount).toBe(1);
      });
    });

    it('should reinitialize agent after individual dispose', async () => {
      registry.register(createTestMetadata('reinit-test'));

      const firstInstance = await factory.create<TestAgent>('reinit-test');
      expect(firstInstance.initializeCount).toBe(1);

      await factory.dispose('reinit-test');
      expect(firstInstance.disposeCount).toBe(1);
      expect(factory.isCached('reinit-test')).toBe(false);

      const secondInstance = await factory.create<TestAgent>('reinit-test');
      expect(secondInstance).not.toBe(firstInstance);
      expect(secondInstance.initializeCount).toBe(1);
    });

    it('should handle forceNew correctly for singleton', async () => {
      registry.register(createTestMetadata('force-new-test'));

      const first = await factory.create<TestAgent>('force-new-test');
      expect(first.initializeCount).toBe(1);

      const second = await factory.create<TestAgent>('force-new-test', {
        forceNew: true,
      });

      expect(first.disposeCount).toBe(1);
      expect(second).not.toBe(first);
      expect(second.initializeCount).toBe(1);
      expect(factory.getCached('force-new-test')).toBe(second);
    });
  });

  describe('Error Scenarios', () => {
    it('should propagate factory errors with context', async () => {
      registry.register(
        createTestMetadata('error-factory', {
          factory: () => {
            throw new Error('Factory exploded');
          },
        })
      );

      await expect(factory.create('error-factory')).rejects.toThrow(
        AgentCreationError
      );
    });

    it('should propagate initialization errors with context', async () => {
      registry.register(
        createTestMetadata('error-init', {
          factory: () => {
            const agent = new TestAgent('error-init', 'Error Init');
            agent.initialize = async () => {
              throw new Error('Init exploded');
            };
            return agent;
          },
        })
      );

      await expect(factory.create('error-init')).rejects.toThrow(
        AgentInitializationError
      );
    });

    it('should handle dispose errors gracefully during disposeAll', async () => {
      registry.register(
        createTestMetadata('error-dispose-1', {
          factory: () => {
            const agent = new TestAgent('error-dispose-1', 'Error Dispose 1');
            agent.dispose = async () => {
              throw new Error('Dispose 1 failed');
            };
            return agent;
          },
        })
      );
      registry.register(createTestMetadata('normal-agent'));
      registry.register(
        createTestMetadata('error-dispose-2', {
          factory: () => {
            const agent = new TestAgent('error-dispose-2', 'Error Dispose 2');
            agent.dispose = async () => {
              throw new Error('Dispose 2 failed');
            };
            return agent;
          },
        })
      );

      await factory.create('error-dispose-1');
      const normalAgent = await factory.create<TestAgent>('normal-agent');
      await factory.create('error-dispose-2');

      await expect(factory.disposeAll()).resolves.toBeUndefined();
      expect(normalAgent.disposeCount).toBe(1);
      expect(factory.getCacheSize()).toBe(0);
    });
  });

  describe('Multiple Lazy Agents', () => {
    it('should manage multiple lazy agents independently', async () => {
      registry.register(createTestMetadata('lazy-a'));
      registry.register(createTestMetadata('lazy-b'));
      registry.register(createTestMetadata('lazy-c'));

      const lazyA = factory.lazy<TestAgent>('lazy-a');
      const lazyB = factory.lazy<TestAgent>('lazy-b');
      const lazyC = factory.lazy<TestAgent>('lazy-c');

      expect(lazyA.isInstantiated).toBe(false);
      expect(lazyB.isInstantiated).toBe(false);
      expect(lazyC.isInstantiated).toBe(false);

      await lazyB.get();

      expect(lazyA.isInstantiated).toBe(false);
      expect(lazyB.isInstantiated).toBe(true);
      expect(lazyC.isInstantiated).toBe(false);

      await lazyA.get();
      await lazyC.get();

      expect(lazyA.isInstantiated).toBe(true);
      expect(lazyB.isInstantiated).toBe(true);
      expect(lazyC.isInstantiated).toBe(true);
    });

    it('should share singleton between lazy and direct creation', async () => {
      registry.register(createTestMetadata('shared-lazy'));

      const lazyAgent = factory.lazy<TestAgent>('shared-lazy');
      const directAgent = await factory.create<TestAgent>('shared-lazy');

      const lazyInstance = await lazyAgent.get();

      expect(lazyInstance).toBe(directAgent);
      expect(lazyAgent.isInstantiated).toBe(true);
    });
  });
});
