# ADR-001: Scratchpad Pattern for Inter-Agent Communication

## Status

**Accepted** - 2024-12-15

## Context

AD-SDLC requires multiple specialized AI agents to collaborate on a complex workflow. These agents need to:

1. Share state and intermediate results
2. Operate independently without tight coupling
3. Support debugging and inspection of intermediate states
4. Enable recovery from failures
5. Allow human intervention when needed

We considered several communication patterns:

### Option 1: Direct API Communication
Agents call each other through APIs.

**Pros:**
- Real-time communication
- Type-safe interfaces

**Cons:**
- Tight coupling between agents
- Complex error handling
- No persistence of intermediate states
- Difficult to debug

### Option 2: Message Queue (Kafka/RabbitMQ)
Agents communicate through a message broker.

**Pros:**
- Decoupled communication
- Message persistence
- Scalable

**Cons:**
- Infrastructure complexity
- Overkill for single-user CLI tool
- Messages not human-readable
- Additional operational burden

### Option 3: Database State (PostgreSQL/SQLite)
Agents share state through database tables.

**Pros:**
- Structured data
- Query capabilities
- Transaction support

**Cons:**
- Schema rigidity
- Not human-readable without tooling
- Additional setup required

### Option 4: File-Based Scratchpad (YAML/JSON)
Agents share state through structured files in a dedicated directory.

**Pros:**
- Human-readable
- No infrastructure needed
- Easy debugging (just read files)
- Git-friendly for versioning
- Natural checkpoint/recovery
- Works offline

**Cons:**
- File I/O overhead (minimal for our scale)
- Manual conflict resolution needed
- No built-in query capability

## Decision

We will use the **File-Based Scratchpad Pattern** (Option 4) for inter-agent communication.

### Implementation Details

1. **Location**: `.ad-sdlc/scratchpad/` directory
2. **Format**: YAML for structured data, JSON for graphs/arrays, Markdown for documents
3. **Schema**: Each file type has a defined schema with version
4. **Ownership**: Each agent owns specific files (write), reads from others
5. **Atomicity**: Write operations use atomic file replacement

### Directory Structure

```
.ad-sdlc/scratchpad/
├── {project}/
│   ├── info/
│   │   └── collected_info.yaml
│   ├── documents/
│   │   ├── prd.md
│   │   ├── srs.md
│   │   └── sds.md
│   ├── issues/
│   │   └── issues.json
│   └── progress/
│       └── controller_state.yaml
```

### File Format Example

```yaml
# Every scratchpad file includes metadata
schema_version: "1.0"
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:10:00Z"
created_by: "collector-agent"

# Actual content follows
content:
  # ...
```

## Consequences

### Positive

1. **Transparency**: Developers can inspect any intermediate state by reading files
2. **Debuggability**: Easy to identify where things went wrong
3. **Recoverability**: Resume from last successful stage by reading checkpoint
4. **Simplicity**: No additional infrastructure or services needed
5. **Portability**: Works on any system with file access
6. **Version Control**: State can be committed to git if needed

### Negative

1. **Scale Limitations**: Not suitable for high-throughput scenarios (not our use case)
2. **Concurrent Access**: Must be careful with parallel agents writing same files
3. **Disk Usage**: Large documents consume disk space

### Mitigations

1. **Concurrent Access**: Use atomic writes and file ownership rules
2. **Disk Usage**: Clean up old scratchpad data after successful completion

## Related Decisions

- ADR-002: Agent Model Selection (affects what agents read/write)
- ADR-003: Pipeline Stage Design (determines scratchpad structure)

## References

- [Agent Communication Documentation](../agent-communication.md)
- [Scratchpad Schema Reference](../../reference/schemas/scratchpad.md)
