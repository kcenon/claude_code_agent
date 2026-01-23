# ADR-0005: Layered Architecture (Control/Data/Agent)

## Status

Accepted

## Date

2024-01-10

## Context

The AD-SDLC system needs to coordinate multiple agents executing a software development lifecycle pipeline. The system has different types of concerns:

- **Orchestration**: Deciding which agent runs when, managing dependencies between tasks
- **State management**: Persisting and retrieving pipeline state, documents, and progress
- **Domain logic**: Actual document generation, code implementation, review logic

Without clear separation:
- Changes to orchestration affect document generation code
- State management logic is duplicated across agents
- Testing requires running full pipelines instead of isolated units
- New developers struggle to understand system boundaries

## Decision

Implement a **three-layer architecture** separating concerns:

### Layer 1: Control Layer

**Responsibility**: Orchestration, scheduling, and coordination

**Components**:
- `Controller`: Manages issue queue, assigns work to workers
- `Orchestrator`: Coordinates full pipeline execution
- `StateManager`: Pipeline state machine transitions

**Characteristics**:
- Knows about agent sequencing and dependencies
- Does NOT know how agents perform their work
- Manages work orders and result collection

```typescript
// Control layer orchestrates the flow
const orchestrator = new Orchestrator();
await orchestrator.runPipeline({
  startPhase: 'collecting',
  endPhase: 'merged',
});
```

### Layer 2: Data Layer

**Responsibility**: State persistence and retrieval

**Components**:
- `Scratchpad`: File-based state storage (ADR-0001)
- `Config`: Configuration loading and validation
- `Logging`: Structured logging with transports

**Characteristics**:
- Provides CRUD operations for pipeline data
- Handles serialization/deserialization
- Manages file locking (ADR-0003)
- No business logic, purely data operations

```typescript
// Data layer provides storage abstraction
const scratchpad = getScratchpad();
await scratchpad.writeYaml(path, document);
const data = await scratchpad.readYaml(path);
```

### Layer 3: Agent Layer

**Responsibility**: Domain-specific business logic

**Components**:
- `CollectorAgent`: Information gathering
- `PRDWriterAgent`: PRD document generation
- `SRSWriterAgent`: SRS document generation
- `SDSWriterAgent`: SDS document generation
- `WorkerAgent`: Code implementation
- `PRReviewerAgent`: Pull request creation and review
- Plus 13 more specialized agents

**Characteristics**:
- Contains domain expertise (how to write a PRD, how to implement code)
- Receives work orders from Control layer
- Reads/writes through Data layer
- Returns results to Control layer

```typescript
// Agent layer implements domain logic
const prdWriter = await factory.create<PRDWriterAgent>('prd-writer-agent');
const result = await prdWriter.generate(collectedInfo);
```

### Layer Interaction

```
┌─────────────────────────────────────────────────────┐
│                    Control Layer                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Orchestrator│  │ Controller  │  │StateManager │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
          │    spawns      │    reads       │ transitions
          │    agents      │    state       │ state
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────┐
│                     Data Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Scratchpad  │  │   Config    │  │   Logging   │  │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  │
└─────────┼───────────────────────────────────────────┘
          │
          │    reads/writes
          ▼
┌─────────────────────────────────────────────────────┐
│                    Agent Layer                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Collector │ │PRDWriter │ │ Worker   │ │   ...  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────────────────┘
```

### Dependency Rules

1. **Control → Data**: Control layer depends on Data layer
2. **Control → Agent**: Control layer depends on Agent layer (via factory)
3. **Agent → Data**: Agent layer depends on Data layer
4. **No reverse dependencies**: Data layer never depends on Control or Agent
5. **No agent-to-agent direct**: Agents communicate only through Data layer

## Consequences

### Positive

- **Testability**: Each layer can be tested in isolation
  - Mock Data layer to test Control logic
  - Mock Control layer to test Agent logic
- **Maintainability**: Changes to one layer don't cascade
- **Onboarding**: Clear boundaries help new developers understand system
- **Reusability**: Agents can be reused in different orchestration contexts
- **Flexibility**: Can swap Data layer implementation (e.g., Redis instead of files)

### Negative

- **Indirection**: More layers means more code to trace
- **Boilerplate**: Passing data between layers requires explicit interfaces
- **Over-engineering risk**: Simple features may touch multiple layers
- **Performance overhead**: Layer boundaries may introduce serialization costs

### Neutral

- **Module boundaries**: Source directory structure reflects layers
- **Import discipline**: Must consciously manage cross-layer imports

## Alternatives Considered

### Alternative 1: Monolithic Agent

**Description:** Each agent handles its own orchestration, state, and logic.

**Pros:**
- Simple to understand per-agent
- No cross-layer coordination needed
- Self-contained modules

**Cons:**
- Duplicated orchestration logic
- Duplicated state management
- Hard to test without running full pipeline
- No shared infrastructure

**Why rejected:** As agent count grew (19+), duplicated infrastructure became a maintenance burden. Centralized layers provide consistent behavior across all agents.

### Alternative 2: Hexagonal Architecture (Ports & Adapters)

**Description:** Domain core with adapters for external concerns.

**Pros:**
- Very flexible port/adapter boundaries
- Domain logic fully isolated
- Easy to swap external systems

**Cons:**
- More complex port definitions
- Additional adapter layer
- May be overkill for file-based system

**Why rejected:** Hexagonal architecture is powerful but adds complexity. Our file-based infrastructure doesn't require the flexibility of swappable adapters. The three-layer approach provides sufficient separation.

### Alternative 3: Event-Driven Architecture

**Description:** Agents communicate through events, no direct orchestration.

**Pros:**
- Loose coupling between components
- Easy to add new agents without changing existing ones
- Natural async patterns

**Cons:**
- Complex event flow debugging
- Event ordering challenges
- No clear execution sequence
- Harder to implement pipeline checkpoints

**Why rejected:** AD-SDLC has a well-defined sequential pipeline (PRD → SRS → SDS → Implementation). Event-driven patterns would add complexity without benefit for this ordered workflow.

### Alternative 4: Microservices

**Description:** Each agent as a separate service with API boundaries.

**Pros:**
- Independent deployment
- Language flexibility per agent
- Horizontal scaling

**Cons:**
- Network overhead
- Deployment complexity
- Service discovery needed
- Overkill for CLI tool

**Why rejected:** AD-SDLC is a CLI tool running on developer machines. Microservices architecture adds deployment and operational complexity unsuitable for this use case.

## References

- Related documentation: `docs/system-architecture.md`
- Related code: `src/controller/` (Control layer)
- Related code: `src/scratchpad/` (Data layer)
- Related code: `src/prd-writer/`, `src/worker/`, etc. (Agent layer)
- Related ADR: [ADR-0001](ADR-0001-scratchpad-state-sharing.md) (Data layer implementation)
- Related ADR: [ADR-0002](ADR-0002-agent-factory-pattern.md) (Agent instantiation)
