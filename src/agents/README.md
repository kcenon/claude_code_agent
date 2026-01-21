# Agents Module

Unified agent instantiation and lifecycle management for AD-SDLC.

## Overview

The agents module provides a centralized factory pattern for creating and managing agent instances across the AD-SDLC system. It standardizes agent instantiation, ensures consistent lifecycle management, and supports dependency injection.

## Core Components

### AgentFactory

Singleton factory for creating agent instances with support for:
- **Singleton caching**: Reuse instances for singleton lifecycle agents
- **Transient creation**: Fresh instances for transient lifecycle agents
- **Lazy initialization**: Defer agent creation until first access
- **Dependency injection**: Automatic resolution of agent dependencies

```typescript
import { AgentFactory } from '@ad-sdlc/agents';

const factory = AgentFactory.getInstance();

// Create a singleton agent
const collector = await factory.create<CollectorAgent>('collector-agent');

// Create with options
const worker = await factory.create<WorkerAgent>('worker-agent', {
  forceNew: true,      // Force new instance even for singleton
  skipInitialize: true // Skip automatic initialization
});
```

### AgentRegistry

Central registry for agent metadata and configuration:

```typescript
import { AgentRegistry } from '@ad-sdlc/agents';

const registry = AgentRegistry.getInstance();

// Register an agent
registry.register({
  agentId: 'my-agent',
  name: 'My Agent',
  description: 'Custom agent implementation',
  lifecycle: 'singleton',
  dependencies: [],
  factory: (deps) => new MyAgent(deps),
});

// Check registration
if (registry.has('my-agent')) {
  const metadata = registry.get('my-agent');
}
```

### IAgent Interface

Base interface that all agents must implement:

```typescript
import { IAgent } from '@ad-sdlc/agents';

class MyAgent implements IAgent {
  readonly agentId = 'my-agent';
  readonly name = 'My Agent';

  async initialize(): Promise<void> {
    // Setup resources, connections, etc.
  }

  async dispose(): Promise<void> {
    // Cleanup resources
  }
}
```

## Lazy Initialization

For optional agents that may not always be needed, use lazy initialization to improve startup performance:

```typescript
const factory = AgentFactory.getInstance();

// Create lazy proxy - no agent created yet
const lazyAgent = factory.lazy<WorkerAgent>('worker-agent');
console.log(lazyAgent.isInstantiated); // false

// Agent created on first access
const worker = await lazyAgent.get();
console.log(lazyAgent.isInstantiated); // true

// Subsequent calls return same instance
const sameWorker = await lazyAgent.get();
console.log(worker === sameWorker); // true

// Dispose when done (no-op if never instantiated)
await lazyAgent.dispose();
```

### Lazy Options

```typescript
const lazyAgent = factory.lazy<MyAgent>('my-agent', {
  initializeOnAccess: false // Skip initialization on first access
});
```

## Agent Lifecycle Types

| Lifecycle | Behavior |
|-----------|----------|
| `singleton` | Single instance cached and reused |
| `transient` | New instance created on each request |

## Dependency Injection

Agents can declare dependencies that are automatically resolved:

```typescript
registry.register({
  agentId: 'child-agent',
  name: 'Child Agent',
  description: 'Agent with dependencies',
  lifecycle: 'singleton',
  dependencies: [
    { agentId: 'parent-agent' },
    { agentId: 'optional-agent', optional: true }
  ],
  factory: (deps) => new ChildAgent(deps['parent-agent']),
});
```

## Error Handling

The module provides specific error types:

| Error | Cause |
|-------|-------|
| `AgentCreationError` | Factory function throws |
| `AgentInitializationError` | `initialize()` throws |
| `AgentNotRegisteredError` | Agent ID not in registry |
| `AgentAlreadyRegisteredError` | Duplicate registration |
| `DependencyResolutionError` | Required dependency missing |
| `CircularDependencyError` | Circular dependency chain |

```typescript
import {
  AgentCreationError,
  AgentInitializationError,
  AgentNotRegisteredError,
} from '@ad-sdlc/agents';

try {
  const agent = await factory.create('unknown-agent');
} catch (error) {
  if (error instanceof AgentNotRegisteredError) {
    console.error('Agent not found:', error.message);
  }
}
```

## Testing

For testing, use `reset()` to clear singleton state:

```typescript
import { AgentFactory, AgentRegistry } from '@ad-sdlc/agents';

beforeEach(() => {
  AgentRegistry.reset();
  // Re-register test agents
});

afterEach(async () => {
  await AgentFactory.reset();
  AgentRegistry.reset();
});
```

### Mocking Agents

Register mock implementations for testing:

```typescript
class MockCollector implements IAgent {
  readonly agentId = 'collector-agent';
  readonly name = 'Mock Collector';
  async initialize() {}
  async dispose() {}
  // Mock methods...
}

registry.register({
  agentId: 'collector-agent',
  name: 'Mock Collector',
  description: 'Mock for testing',
  lifecycle: 'singleton',
  dependencies: [],
  factory: () => new MockCollector(),
});
```

## Registered Agents

The following agents are pre-registered in the system:

| Agent ID | Name | Lifecycle |
|----------|------|-----------|
| `collector-agent` | Collector Agent | singleton |
| `prd-writer-agent` | PRD Writer Agent | singleton |
| `srs-writer-agent` | SRS Writer Agent | singleton |
| `sds-writer-agent` | SDS Writer Agent | singleton |
| `worker-agent` | Worker Agent | singleton |
| `pr-reviewer-agent` | PR Reviewer Agent | singleton |
| `document-reader-agent` | Document Reader Agent | singleton |
| `codebase-analyzer-agent` | Codebase Analyzer Agent | singleton |
| `impact-analyzer-agent` | Impact Analyzer Agent | singleton |
| `regression-tester-agent` | Regression Tester Agent | singleton |
| `architecture-generator` | Architecture Generator | singleton |
| `component-generator` | Component Generator | singleton |
| `repo-detector` | Repository Detector | singleton |
| `ci-fix-agent` | CI Fix Agent | singleton |
| `prd-updater-agent` | PRD Updater Agent | singleton |
| `srs-updater-agent` | SRS Updater Agent | singleton |
| `sds-updater-agent` | SDS Updater Agent | singleton |
| `doc-code-comparator-agent` | Doc-Code Comparator Agent | singleton |
| `analysis-orchestrator-agent` | Analysis Orchestrator Agent | singleton |

## API Reference

### AgentFactory

| Method | Description |
|--------|-------------|
| `getInstance()` | Get singleton factory instance |
| `reset()` | Reset factory and dispose all agents |
| `create<T>(agentId, options?)` | Create or retrieve agent instance |
| `lazy<T>(agentId, options?)` | Create lazy agent proxy |
| `isCached(agentId)` | Check if agent is cached |
| `getCached(agentId)` | Get cached instance or undefined |
| `dispose(agentId)` | Dispose specific agent |
| `disposeAll()` | Dispose all cached agents |
| `getCacheSize()` | Get number of cached agents |
| `getCachedAgentIds()` | Get array of cached agent IDs |

### AgentRegistry

| Method | Description |
|--------|-------------|
| `getInstance()` | Get singleton registry instance |
| `reset()` | Clear all registrations |
| `register(metadata)` | Register agent metadata |
| `get(agentId)` | Get agent metadata |
| `has(agentId)` | Check if agent is registered |
| `getAll()` | Get all registered agent IDs |
| `getAllMetadata()` | Get all agent metadata |
| `unregister(agentId)` | Remove agent registration |
| `getDependencyChain(agentId)` | Get dependency order |
| `validateDependencies(agentId)` | Check for missing deps |

### LazyAgent<T>

| Property/Method | Description |
|----------------|-------------|
| `isInstantiated` | Whether agent has been created |
| `get()` | Get agent instance (creates if needed) |
| `dispose()` | Dispose agent if instantiated |
