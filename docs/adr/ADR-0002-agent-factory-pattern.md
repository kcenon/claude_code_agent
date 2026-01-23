# ADR-0002: Agent Factory Pattern

## Status

Accepted

## Date

2024-02-01

## Context

The AD-SDLC system contains 19+ specialized agents (Collector, PRD Writer, Worker, etc.) with varying lifecycle requirements:

- Some agents should be **singletons** (shared logging, configuration)
- Some agents need **fresh instances** per operation (workers handling concurrent tasks)
- Agents have **dependencies** on each other (Worker depends on Scratchpad)
- Testing requires **mock substitution** without changing production code
- Agent creation involves **async initialization** (file system setup, config loading)

Without centralized management:
- Agents are instantiated inconsistently across the codebase
- Dependency injection is ad-hoc and error-prone
- Testing requires complex setup to mock dependencies
- Resource cleanup is easy to forget, causing leaks

## Decision

Implement a **centralized Agent Factory pattern** with:

1. **AgentRegistry**: Singleton registry for agent metadata and factory functions
2. **AgentFactory**: Singleton factory that creates/caches agent instances
3. **IAgent interface**: Base contract for all agents (initialize, dispose)
4. **Lifecycle types**: `singleton` (cached) or `transient` (fresh instance)
5. **Lazy initialization**: Defer creation until first access

### Core Components

```typescript
// Registration
registry.register({
  agentId: 'worker-agent',
  name: 'Worker Agent',
  lifecycle: 'singleton',
  dependencies: [{ agentId: 'scratchpad' }],
  factory: (deps) => new WorkerAgent(deps.scratchpad),
});

// Creation
const worker = await factory.create<WorkerAgent>('worker-agent');

// Lazy access
const lazyWorker = factory.lazy<WorkerAgent>('worker-agent');
const worker = await lazyWorker.get(); // Created on first access
```

### IAgent Interface

```typescript
interface IAgent {
  readonly agentId: string;
  readonly name: string;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
```

## Consequences

### Positive

- **Consistent instantiation**: All agents created through single path
- **Automatic dependency injection**: Dependencies resolved automatically from registry
- **Lifecycle management**: Singleton caching prevents duplicate instances
- **Testability**: Register mock implementations for isolated testing
- **Resource cleanup**: `disposeAll()` ensures proper cleanup on shutdown
- **Lazy loading**: Defer expensive initialization until needed
- **Type safety**: Generic factory methods preserve type information

### Negative

- **Indirection**: Agent creation goes through factory instead of direct `new`
- **Registration required**: All agents must be registered before use
- **Singleton state**: Cached singletons can cause issues if state isn't reset between tests
- **Circular dependency risk**: Must carefully design dependency graph

### Neutral

- **Discovery**: `getAllMetadata()` enables runtime agent discovery
- **Startup ordering**: Dependencies determine initialization order

## Alternatives Considered

### Alternative 1: Direct Instantiation

**Description:** Create agents directly with `new AgentClass()` wherever needed.

**Pros:**
- Simple and straightforward
- No registration overhead
- Clear stack traces

**Cons:**
- No lifecycle management
- Manual dependency wiring
- Difficult to mock in tests
- Duplicate singleton instances

**Why rejected:** As the system grew to 19+ agents with complex dependencies, direct instantiation led to inconsistent behavior, resource leaks, and testing difficulties.

### Alternative 2: Dependency Injection Container (InversifyJS)

**Description:** Use a full-featured DI container like InversifyJS.

**Pros:**
- Industry-standard patterns
- Powerful decoration and scoping
- Built-in circular dependency detection
- Container hierarchies for testing

**Cons:**
- Heavy dependency (decorator-based)
- Steeper learning curve
- More complex configuration
- Overkill for agent count

**Why rejected:** InversifyJS's decorator-based approach requires significant TypeScript configuration changes. Our agent count and dependency complexity don't justify the additional machinery.

### Alternative 3: Service Locator

**Description:** Global service locator that agents query for dependencies.

**Pros:**
- Simple to implement
- No registration metadata needed
- Flexible runtime resolution

**Cons:**
- Hidden dependencies (not visible in constructor)
- Harder to test (must set up global state)
- Violates dependency inversion principle
- No compile-time type checking

**Why rejected:** Service locator pattern obscures dependencies, making code harder to understand and test. The factory pattern keeps dependencies explicit while providing similar flexibility.

## References

- Related code: `src/agents/AgentFactory.ts`
- Related code: `src/agents/AgentRegistry.ts`
- Related documentation: `src/agents/README.md`
- Related issue: #358 (AgentFactory pattern implementation)
