# Scratchpad Storage Backends

The Scratchpad module supports multiple storage backends to optimize for different use cases:

- **File Backend** (default): YAML/JSON files on the local filesystem
- **SQLite Backend**: Local database for improved I/O performance
- **Redis Backend**: Distributed storage for multi-instance deployments

## Quick Start

```typescript
import { BackendFactory, Scratchpad } from 'ad-sdlc';

// Use default file backend
const fileBackend = BackendFactory.create();
await fileBackend.initialize();

// Use SQLite backend
const sqliteBackend = BackendFactory.create({ backend: 'sqlite' });
await sqliteBackend.initialize();

// Use Redis backend
const redisBackend = BackendFactory.create({
  backend: 'redis',
  redis: {
    host: 'localhost',
    port: 6379,
  },
});
await redisBackend.initialize();
```

## Scratchpad Integration

The `Scratchpad` class internally uses `FileBackend` with `raw` format to provide a high-level API for file operations. This allows:

- Backward-compatible file path-based API (`readYaml`, `writeJson`, etc.)
- Atomic write operations through the backend
- Future ability to swap backends while maintaining the same public API

```typescript
// Scratchpad uses FileBackend internally
const scratchpad = new Scratchpad({ basePath: '.ad-sdlc/scratchpad' });

// These methods internally use FileBackend
await scratchpad.writeYaml('/path/to/file.yaml', data);
await scratchpad.readJson('/path/to/file.json');
```

## Backend Interface

All backends implement the `IScratchpadBackend` interface:

```typescript
interface IScratchpadBackend {
  readonly name: string;
  initialize(): Promise<void>;
  read<T>(section: string, key: string): Promise<T | null>;
  write<T>(section: string, key: string, value: T): Promise<void>;
  delete(section: string, key: string): Promise<boolean>;
  list(section: string): Promise<string[]>;
  exists(section: string, key: string): Promise<boolean>;
  batch(operations: BatchOperation[]): Promise<void>;
  healthCheck(): Promise<BackendHealth>;
  close(): Promise<void>;
}
```

## File Backend

The default backend that stores data as YAML or JSON files.

### Configuration

```typescript
interface FileBackendConfig {
  basePath?: string;      // Default: '.ad-sdlc/scratchpad'
  fileMode?: number;      // Default: 0o600
  dirMode?: number;       // Default: 0o700
  format?: 'yaml' | 'json' | 'raw'; // Default: 'yaml'
}
```

### Format Options

| Format | Extension | Serialization | Use Case |
|--------|-----------|---------------|----------|
| `yaml` | `.yaml` | YAML serialization | Default, human-readable |
| `json` | `.json` | JSON serialization | Machine processing |
| `raw` | (none) | No serialization | Arbitrary file extensions, key includes filename |

The `raw` format is used internally by the `Scratchpad` class to support arbitrary file extensions while maintaining backward compatibility.

### Example

```typescript
const backend = new FileBackend({
  basePath: '.my-project/scratchpad',
  format: 'json',
});
await backend.initialize();
```

### Directory Structure

```
.ad-sdlc/scratchpad/
├── info/
│   └── project.yaml
├── documents/
│   ├── prd.yaml
│   └── srs.yaml
├── issues/
│   └── issue_list.yaml
└── progress/
    └── controller_state.yaml
```

## SQLite Backend

Uses SQLite for efficient key-value storage with transaction support.

### Configuration

```typescript
interface SQLiteBackendConfig {
  dbPath?: string;        // Default: '.ad-sdlc/scratchpad.db'
  walMode?: boolean;      // Default: true (better concurrency)
  busyTimeout?: number;   // Default: 5000ms
}
```

### Example

```typescript
const backend = new SQLiteBackend({
  dbPath: '.ad-sdlc/scratchpad.db',
  walMode: true,
});
await backend.initialize();
```

### Schema

```sql
CREATE TABLE scratchpad (
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (section, key)
);
```

### Advantages

- Faster reads/writes than file I/O
- Atomic transactions for batch operations
- Query capability if needed
- No file locking issues

## Redis Backend

Uses Redis for distributed deployments with optional TTL, distributed locking, and fallback support.

### Configuration

```typescript
interface RedisBackendConfig {
  host?: string;          // Default: 'localhost'
  port?: number;          // Default: 6379
  password?: string;      // Optional
  db?: number;            // Default: 0
  prefix?: string;        // Default: 'ad-sdlc:scratchpad:'
  ttl?: number;           // Optional (seconds)
  connectTimeout?: number; // Default: 5000ms
  maxRetries?: number;    // Default: 3
  lock?: RedisLockConfig;     // Distributed lock settings
  fallback?: RedisFallbackConfig; // Fallback to FileBackend
}

interface RedisLockConfig {
  lockTtl?: number;           // Default: 30 seconds
  lockTimeout?: number;       // Default: 10000ms
  lockRetryInterval?: number; // Default: 100ms
}

interface RedisFallbackConfig {
  enabled?: boolean;          // Default: false
  fileConfig?: FileBackendConfig; // FileBackend config for fallback
}
```

### Basic Example

```typescript
const backend = new RedisBackend({
  host: 'redis.example.com',
  port: 6379,
  password: 'secret',
  ttl: 86400, // 24 hours
});
await backend.initialize();
```

### Key Format

Keys are stored as: `{prefix}{section}:{key}`

Example: `ad-sdlc:scratchpad:documents:prd`

### Distributed Locking

Redis backend provides distributed locking for coordinating access across multiple instances:

```typescript
const backend = new RedisBackend({
  host: 'redis.example.com',
  lock: {
    lockTtl: 30,           // Lock expires after 30 seconds
    lockTimeout: 10000,    // Wait up to 10 seconds to acquire
    lockRetryInterval: 100, // Retry every 100ms
  },
});
await backend.initialize();

// Acquire and release lock manually
const lock = await backend.acquireLock('my-resource');
try {
  // Do exclusive work
} finally {
  await backend.releaseLock(lock);
}

// Or use withLock for automatic release
const result = await backend.withLock('my-resource', async () => {
  // Do exclusive work
  return 'done';
});

// Extend lock TTL if needed
const lock = await backend.acquireLock('long-task', { ttl: 10 });
// ... later, if task takes longer ...
await backend.extendLock(lock, 30); // Extend to 30 more seconds
await backend.releaseLock(lock);
```

Lock features:
- **Atomic acquisition**: Uses Redis SET NX EX for safe concurrent access
- **Safe release**: Lua script ensures only the lock holder can release
- **Timeout support**: Configurable acquisition timeout with automatic retry
- **Lock extension**: Extend TTL without releasing the lock

### Fallback Support

Configure fallback to FileBackend when Redis is unavailable:

```typescript
const backend = new RedisBackend({
  host: 'redis.example.com',
  fallback: {
    enabled: true,
    fileConfig: {
      basePath: '.ad-sdlc/scratchpad-fallback',
      format: 'yaml',
    },
  },
});

// Will not throw even if Redis is down
await backend.initialize();

// Check if using fallback
if (backend.isUsingFallback()) {
  console.log('Using file backend as fallback');
}

// Health check indicates fallback mode
const health = await backend.healthCheck();
// health.message: "Using fallback: File backend is healthy"
```

**Note**: Distributed locking is not available when using fallback mode.

### Advantages

- Distributed storage across multiple instances
- Built-in TTL for automatic expiration
- High-performance in-memory storage
- Pipeline operations for batch updates
- Distributed locking for coordination
- Graceful fallback to file storage

## Backend Factory

Use `BackendFactory` to create backends from configuration:

```typescript
import { BackendFactory } from 'ad-sdlc';

// Create from config object
const backend = BackendFactory.create({
  backend: 'sqlite',
  sqlite: { dbPath: './data/scratchpad.db' },
});

// Create and initialize in one step
const backend = await BackendFactory.createAndInitialize({
  backend: 'redis',
  redis: { host: 'localhost' },
});

// Create from workflow.yaml configuration file
const backend = await BackendFactory.createFromConfig();
const backend = await BackendFactory.createFromConfig('/path/to/project');

// Create and initialize from config file
const backend = await BackendFactory.createAndInitializeFromConfig();

// Check supported types
BackendFactory.getSupportedTypes(); // ['file', 'sqlite', 'redis']
BackendFactory.isSupported('sqlite'); // true
```

## Configuration File

You can configure the backend in `.ad-sdlc/config/workflow.yaml`:

```yaml
version: "1.0.0"
# ... other workflow configuration ...

scratchpad:
  # Backend type: file, sqlite, or redis
  backend: sqlite

  # File backend options
  file:
    base_path: .ad-sdlc/scratchpad
    format: yaml

  # SQLite backend options
  sqlite:
    db_path: .ad-sdlc/scratchpad.db
    wal_mode: true
    busy_timeout: 5000

  # Redis backend options
  redis:
    host: ${REDIS_HOST:-localhost}
    port: ${REDIS_PORT:-6379}
    password: ${REDIS_PASSWORD}
    db: 0
    prefix: "ad-sdlc:scratchpad:"
    ttl: 86400
    connect_timeout: 5000
    max_retries: 3
    lock:
      lock_ttl: 30
      lock_timeout: 10000
      lock_retry_interval: 100
    fallback:
      enabled: true
      file_config:
        base_path: .ad-sdlc/scratchpad-fallback
```

## Environment Variables

Environment variables can override configuration values. This is useful for different deployment environments.

### Supported Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SCRATCHPAD_BACKEND` | Backend type | `sqlite`, `redis`, `file` |
| `SCRATCHPAD_REDIS_HOST` | Redis server host | `redis.example.com` |
| `SCRATCHPAD_REDIS_PORT` | Redis server port | `6379` |
| `SCRATCHPAD_REDIS_PASSWORD` | Redis password | `secret` |
| `SCRATCHPAD_REDIS_DB` | Redis database number | `0` |
| `SCRATCHPAD_SQLITE_PATH` | SQLite database path | `/data/scratchpad.db` |
| `SCRATCHPAD_FILE_PATH` | File backend base path | `/data/scratchpad` |

### Configuration Priority

Configuration is resolved in the following order (highest priority first):

1. **Environment variables** (`SCRATCHPAD_*`)
2. **workflow.yaml** configuration (with `${VAR}` expansion)
3. **Default values** (file backend)

### Environment Variable Expansion in YAML

You can use `${VAR}` or `${VAR:-default}` syntax in configuration files:

```yaml
scratchpad:
  backend: redis
  redis:
    host: ${REDIS_HOST:-localhost}
    port: ${REDIS_PORT:-6379}
    password: ${REDIS_PASSWORD}  # Required, no default
```

### Usage Example

```bash
# Use SQLite in production via environment variable
export SCRATCHPAD_BACKEND=sqlite
export SCRATCHPAD_SQLITE_PATH=/data/scratchpad.db

# Or use Redis
export SCRATCHPAD_BACKEND=redis
export SCRATCHPAD_REDIS_HOST=redis.production.local
export SCRATCHPAD_REDIS_PASSWORD=secret
```

```typescript
import { BackendFactory, loadScratchpadConfig } from 'ad-sdlc';

// Load configuration with env var support
const config = await loadScratchpadConfig();

// Create backend from config
const backend = await BackendFactory.createAndInitialize(config);

// Or use convenience method
const backend = await BackendFactory.createAndInitializeFromConfig();
```

### Checking Available Environment Variables

```typescript
import { getScratchpadEnvVars } from 'ad-sdlc';

const envVars = getScratchpadEnvVars();
// Returns: { SCRATCHPAD_BACKEND: 'Backend type: file | sqlite | redis', ... }
```

## Choosing a Backend

| Use Case | Recommended Backend |
|----------|-------------------|
| Local development | File (default) |
| Large projects (>1000 issues) | SQLite |
| CI/CD pipelines | SQLite |
| Multi-instance deployment | Redis |
| Stateless containers | Redis |
| Offline operation | File or SQLite |

## Health Checks

All backends support health checks:

```typescript
const health = await backend.healthCheck();
console.log(health.healthy);   // true/false
console.log(health.message);   // Status message
console.log(health.latencyMs); // Response time
```

## Error Handling

```typescript
import {
  BackendCreationError,
  RedisConnectionError,
  RedisLockTimeoutError,
} from 'ad-sdlc';

// Backend creation error
try {
  const backend = BackendFactory.create({ backend: 'redis' });
  // Throws: Redis configuration is required
} catch (error) {
  if (error instanceof BackendCreationError) {
    console.error(`Backend: ${error.backendType}`);
    console.error(`Message: ${error.message}`);
  }
}

// Redis connection error (when fallback is not enabled)
try {
  const backend = new RedisBackend({
    host: 'unavailable-host',
  });
  await backend.initialize();
} catch (error) {
  if (error instanceof RedisConnectionError) {
    console.error(`Host: ${error.host}:${error.port}`);
    console.error(`Message: ${error.message}`);
  }
}

// Lock timeout error
try {
  const lock = await backend.acquireLock('busy-resource', {
    timeout: 1000, // 1 second timeout
  });
} catch (error) {
  if (error instanceof RedisLockTimeoutError) {
    console.error(`Lock: ${error.lockKey}`);
    console.error(`Timeout: ${error.timeoutMs}ms`);
  }
}
```

## Migration Between Backends

To migrate data between backends:

```typescript
async function migrateData(
  source: IScratchpadBackend,
  target: IScratchpadBackend
): Promise<void> {
  const sections = ['info', 'documents', 'issues', 'progress'];

  for (const section of sections) {
    const keys = await source.list(section);
    for (const key of keys) {
      const value = await source.read(section, key);
      if (value !== null) {
        await target.write(section, key, value);
      }
    }
  }
}
```

## Testing

All backends have comprehensive test coverage:

### Running Tests

```bash
# Run all backend tests
npm test tests/scratchpad/backends/

# Run specific backend tests
npm test tests/scratchpad/backends/FileBackend.test.ts
npm test tests/scratchpad/backends/SQLiteBackend.test.ts
npm test tests/scratchpad/backends/RedisBackend.test.ts
npm test tests/scratchpad/backends/BackendFactory.test.ts
npm test tests/scratchpad/backends/integration.test.ts
```

### Redis Tests

Redis tests require a running Redis server. If Redis is not available, tests are automatically skipped:

```bash
# Start Redis with Docker
docker run -d -p 6379:6379 redis:7-alpine

# Set custom Redis host/port
REDIS_HOST=localhost REDIS_PORT=6379 npm test tests/scratchpad/backends/RedisBackend.test.ts
```

### Integration Tests

Integration tests verify:
- IScratchpadBackend interface compliance across all backends
- Data migration between backends
- Concurrent operations
- Error handling consistency
- Health check functionality

## Dependencies

- **File Backend**: No additional dependencies
- **SQLite Backend**: `better-sqlite3`
- **Redis Backend**: `ioredis`

These are installed automatically with the package.
