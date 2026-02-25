import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '../../src/agents/AgentRegistry.js';
import { bootstrapAgents } from '../../src/agents/bootstrapAgents.js';
import { AGENT_TYPE_MAP } from '../../src/agents/AgentTypeMapping.js';
import type { AgentMetadata, IAgent } from '../../src/agents/types.js';

describe('bootstrapAgents', () => {
  beforeEach(() => {
    AgentRegistry.reset();
  });

  afterEach(() => {
    AgentRegistry.reset();
  });

  it('should register all agents from AGENT_TYPE_MAP', async () => {
    const result = await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    const expectedCount = Object.keys(AGENT_TYPE_MAP).length;
    expect(result.totalEntries).toBe(expectedCount);
    expect(result.registered).toBe(expectedCount);
    expect(result.skipped).toBe(0);

    for (const [, entry] of Object.entries(AGENT_TYPE_MAP)) {
      expect(registry.has(entry.agentId)).toBe(true);
    }
  });

  it('should be idempotent on second call', async () => {
    const first = await bootstrapAgents();
    const second = await bootstrapAgents();

    expect(first.registered).toBe(first.totalEntries);
    expect(second.registered).toBe(0);
    expect(second.skipped).toBe(second.totalEntries);
  });

  it('should skip agents already registered manually', async () => {
    const registry = AgentRegistry.getInstance();

    // Pre-register one agent manually
    const collectorEntry = AGENT_TYPE_MAP['collector'];
    registry.register({
      agentId: collectorEntry!.agentId,
      name: 'Pre-registered Collector',
      description: 'Manually registered',
      lifecycle: 'singleton',
      dependencies: [],
      factory: () => ({ agentId: 'collector-agent', name: 'Mock' } as IAgent),
    });

    const result = await bootstrapAgents();

    expect(result.skipped).toBe(1);
    expect(result.registered).toBe(result.totalEntries - 1);

    // Verify the manually-registered agent was not overwritten
    const metadata = registry.get(collectorEntry!.agentId);
    expect(metadata.name).toBe('Pre-registered Collector');
  });

  it('should register metadata with correct agentId and name', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    for (const [, entry] of Object.entries(AGENT_TYPE_MAP)) {
      const metadata = registry.get(entry.agentId);
      expect(metadata.agentId).toBe(entry.agentId);
      expect(metadata.name).toBe(entry.name);
    }
  });

  it('should register metadata with correct lifecycle', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    for (const [, entry] of Object.entries(AGENT_TYPE_MAP)) {
      const metadata = registry.get(entry.agentId);
      expect(metadata.lifecycle).toBe(entry.lifecycle);
    }
  });

  it('should register metadata with empty dependencies', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    for (const [, entry] of Object.entries(AGENT_TYPE_MAP)) {
      const metadata = registry.get(entry.agentId);
      expect(metadata.dependencies).toEqual([]);
    }
  });

  it('should register factory that throws with clear error message', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    const metadata = registry.get('collector-agent');
    expect(() => metadata.factory({})).toThrow('AgentDispatcher');
    expect(() => metadata.factory({})).toThrow('collector-agent');
  });

  it('should register worker-agent as transient', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    const metadata = registry.get('worker-agent');
    expect(metadata.lifecycle).toBe('transient');
  });

  it('should register most agents as singleton', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    const singletonEntries = Object.values(AGENT_TYPE_MAP).filter(
      (e) => e.lifecycle === 'singleton'
    );

    for (const entry of singletonEntries) {
      const metadata = registry.get(entry.agentId);
      expect(metadata.lifecycle).toBe('singleton');
    }
  });

  it('should include description with agentType reference', async () => {
    await bootstrapAgents();
    const registry = AgentRegistry.getInstance();

    // Check a few known entries
    const collectorMeta = registry.get('collector-agent');
    expect(collectorMeta.description).toContain('collector');

    const workerMeta = registry.get('worker-agent');
    expect(workerMeta.description).toContain('worker');
  });

  it('should return consistent totals', async () => {
    const result = await bootstrapAgents();

    expect(result.totalEntries).toBe(result.registered + result.skipped);
  });

  it('should handle partial pre-registration correctly', async () => {
    const registry = AgentRegistry.getInstance();

    // Pre-register 3 agents
    const preRegisterTypes = ['collector', 'worker', 'pr-reviewer'] as const;
    for (const agentType of preRegisterTypes) {
      const entry = AGENT_TYPE_MAP[agentType];
      registry.register({
        agentId: entry!.agentId,
        name: `Pre-${entry!.name}`,
        description: 'Pre-registered',
        lifecycle: entry!.lifecycle,
        dependencies: [],
        factory: () => ({ agentId: entry!.agentId, name: 'Mock' } as IAgent),
      });
    }

    const result = await bootstrapAgents();

    expect(result.skipped).toBe(3);
    expect(result.registered).toBe(result.totalEntries - 3);
  });
});
