# ADR-0001: Scratchpad-based State Sharing

## Status

Accepted

## Date

2024-01-15

## Context

The AD-SDLC system consists of multiple specialized agents (Collector, PRD Writer, SRS Writer, etc.) that need to share state during pipeline execution. The Claude Agent SDK's communication model is unidirectional (parent→child), meaning child agents cannot directly communicate with siblings or return complex state to parents.

The system must support:
- Multi-process execution where agents may run in separate processes
- Crash recovery without losing pipeline progress
- Debug inspection of intermediate states
- Simple deployment without external dependencies
- State persistence across agent invocations

## Decision

Implement a **file-based Scratchpad pattern** for inter-agent communication:

1. **YAML/JSON serialization** for all state data
2. **Atomic file writes** using write-to-temp-then-rename pattern
3. **File locking** with heartbeat mechanism for concurrent access safety
4. **Structured directory layout** organized by project and data type
5. **Singleton accessor** via `getScratchpad()` for consistent access

### Directory Structure

```
.ad-sdlc/scratchpad/
├── info/{project_id}/           # Collected requirements
│   ├── project.yaml
│   └── collected_info.yaml
├── documents/{project_id}/      # Generated documents
│   ├── prd.md
│   ├── srs.md
│   └── sds.md
├── issues/{project_id}/         # Generated issues
│   ├── issue_list.json
│   └── dependency_graph.json
└── progress/{project_id}/       # Execution state
    ├── controller_state.yaml
    ├── work_orders/
    └── results/
```

### Core Operations

```typescript
const scratchpad = getScratchpad();

// Atomic write with locking
await scratchpad.withLock(filePath, async () => {
  const data = await scratchpad.readYaml(filePath);
  data.status = 'completed';
  await scratchpad.writeYaml(filePath, data);
});
```

## Consequences

### Positive

- **Simple implementation**: No complex distributed systems knowledge required
- **Easy debugging**: Inspect state by viewing files directly with any text editor
- **No external dependencies**: No Redis, database, or message queue to deploy and maintain
- **Natural crash recovery**: Files persist across process crashes; pipeline can resume
- **Works across processes**: Any process with filesystem access can read/write state
- **Schema validation**: Zod-based validation ensures data integrity

### Negative

- **Limited scalability**: Not suitable for very large state objects (>100MB)
- **File system performance**: Slower than in-memory solutions for high-frequency updates
- **NFS limitations**: Distributed file systems may have locking issues
- **No real-time notifications**: Agents must poll for changes (no pub/sub)

### Neutral

- **Requires cleanup**: Old project directories accumulate and need periodic cleanup
- **Disk space usage**: State files consume disk space proportional to project count

## Alternatives Considered

### Alternative 1: Redis

**Description:** Use Redis for in-memory state storage with pub/sub for notifications.

**Pros:**
- Fast read/write performance
- Built-in pub/sub for real-time updates
- TTL support for automatic cleanup
- Atomic operations

**Cons:**
- External dependency requiring deployment and monitoring
- Memory-based storage loses data on restart without persistence config
- Additional operational complexity
- Network dependency

**Why rejected:** Adds deployment complexity that's unnecessary for the typical AD-SDLC use case of single-machine execution. The benefits of Redis (speed, pub/sub) aren't critical for document generation pipelines that run sequentially.

### Alternative 2: SQLite

**Description:** Use SQLite as an embedded database for state storage.

**Pros:**
- ACID compliance for data integrity
- SQL query capability for complex lookups
- Single-file database, easy to backup
- No external server required

**Cons:**
- Lock contention under heavy concurrent writes
- More complex API than simple file operations
- Overkill for key-value style state storage
- Requires SQL schema maintenance

**Why rejected:** The AD-SDLC state model is primarily key-value (project → state), making SQLite's relational model unnecessary overhead. The file-based approach provides sufficient integrity with simpler operations.

### Alternative 3: In-Memory Singleton

**Description:** Keep all state in memory within a singleton service.

**Pros:**
- Fastest possible read/write
- Simplest implementation
- Type-safe access

**Cons:**
- Lost on process termination
- Cannot share between processes
- No persistence or recovery
- Memory grows unbounded

**Why rejected:** AD-SDLC pipelines can run for extended periods and may involve multiple processes. Loss of state on crash would require restarting entire pipelines, which is unacceptable for user experience.

## References

- Related code: `src/scratchpad/Scratchpad.ts`
- Related documentation: `src/scratchpad/README.md`
- System architecture: `docs/system-architecture.md`
- Related ADR: [ADR-0003](ADR-0003-file-based-locking.md) (File-based Locking)
