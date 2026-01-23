# ADR-0003: File-based Distributed Locking

## Status

Accepted

## Date

2024-02-15

## Context

The Scratchpad pattern (ADR-0001) enables multiple agents to share state through files. However, concurrent access creates race conditions:

- **Read-modify-write races**: Two agents read same file, modify, and write back (one update lost)
- **Partial reads**: Reading while another agent is mid-write yields corrupted data
- **Resource contention**: Multiple workers trying to claim the same task

The locking mechanism must handle:
- Multiple processes accessing same files
- Crashed processes leaving stale locks
- Long-running operations that shouldn't lose locks due to inactivity

## Decision

Implement **file-based distributed locking** with the following features:

### Lock File Structure

```
{original_file}.lock
```

Lock files contain JSON with holder information:
```json
{
  "holderId": "worker-001",
  "acquiredAt": "2024-02-15T10:30:00.000Z",
  "lastHeartbeat": "2024-02-15T10:30:05.000Z"
}
```

### Core Mechanisms

1. **Atomic acquisition**: Create lock file with `O_CREAT | O_EXCL` flags
2. **Heartbeat updates**: Periodic timestamp updates while holding lock
3. **Stale detection**: Locks without recent heartbeat are considered stale
4. **Cooperative release**: Request current holder to release before force-stealing
5. **Auto-release on dispose**: Locks released when Scratchpad is disposed

### API Usage

```typescript
// Manual locking
const acquired = await scratchpad.acquireLock(path, 'worker-001');
if (acquired) {
  // Critical section
  await scratchpad.releaseLock(path, 'worker-001');
}

// Automatic locking (recommended)
await scratchpad.withLock(path, async () => {
  const data = await scratchpad.readYaml(path);
  data.counter++;
  await scratchpad.writeYaml(path, data);
});
```

### Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `lockTimeout` | 5000ms | Time to wait for lock acquisition |
| `heartbeatIntervalMs` | 1000ms | How often to update heartbeat |
| `heartbeatTimeoutMs` | 3000ms | When to consider lock stale |
| `retryAttempts` | 10 | Max lock acquisition attempts |
| `retryDelayMs` | 100ms | Base delay between retries |

## Consequences

### Positive

- **No external dependencies**: Uses filesystem primitives only
- **Crash recovery**: Stale locks from crashed processes are automatically cleaned
- **Debuggable**: Lock files can be inspected manually
- **Cooperative**: Gives lock holders chance to release gracefully
- **Process-agnostic**: Works across Node.js processes and CLI invocations

### Negative

- **Not suitable for NFS**: Network file systems have unreliable locking semantics
- **Heartbeat overhead**: Periodic updates add I/O for long-held locks
- **Clock skew sensitivity**: Stale detection assumes reasonable clock synchronization
- **Single-machine limit**: File locks don't work across machines

### Neutral

- **Lock file cleanup**: Orphaned `.lock` files may need periodic cleanup
- **Blocking behavior**: Lock acquisition blocks the caller (not async queue-based)

## Alternatives Considered

### Alternative 1: Redis Distributed Locks (Redlock)

**Description:** Use Redis-based locking with the Redlock algorithm.

**Pros:**
- Works across machines
- Well-tested algorithm
- Fast lock operations
- Built-in TTL for automatic expiry

**Cons:**
- Requires Redis infrastructure
- Network latency affects lock operations
- Split-brain scenarios possible
- Additional operational complexity

**Why rejected:** AD-SDLC typically runs on a single machine. Adding Redis for locking introduces deployment complexity without proportional benefit. File-based locking is sufficient for the single-machine use case.

### Alternative 2: Database Advisory Locks (PostgreSQL)

**Description:** Use PostgreSQL's `pg_advisory_lock` for distributed locking.

**Pros:**
- ACID guarantees
- Works across machines
- No separate infrastructure if already using PostgreSQL
- Lock introspection via system views

**Cons:**
- Requires database dependency
- Connection required to hold lock
- Not suitable if DB isn't already in stack

**Why rejected:** AD-SDLC doesn't require a database for its core functionality. Adding PostgreSQL just for locking would be significant overengineering.

### Alternative 3: Operating System File Locks (flock/fcntl)

**Description:** Use OS-level file locking via `flock()` or `fcntl()`.

**Pros:**
- Kernel-level enforcement
- No lock file pollution
- Automatic release on process exit
- Standard POSIX mechanism

**Cons:**
- Node.js support varies by platform
- Windows compatibility issues
- Cannot detect stale locks from crashed processes holding file handles
- Lock semantics differ across filesystems

**Why rejected:** Cross-platform behavior is inconsistent, especially between macOS, Linux, and Windows. The lock file approach provides more predictable behavior and easier debugging.

### Alternative 4: No Locking (Last-Write-Wins)

**Description:** Accept race conditions and let the last write win.

**Pros:**
- Simplest possible implementation
- No lock overhead
- No deadlock risk

**Cons:**
- Data loss when concurrent writes occur
- Unpredictable behavior
- Hard to debug issues

**Why rejected:** Data integrity is critical for pipeline state. Lost updates could cause work to be repeated or skipped entirely, leading to incorrect outputs.

## References

- Related code: `src/scratchpad/Scratchpad.ts` (locking methods)
- Related documentation: `src/scratchpad/README.md#file-locking`
- Related ADR: [ADR-0001](ADR-0001-scratchpad-state-sharing.md) (Scratchpad Pattern)
