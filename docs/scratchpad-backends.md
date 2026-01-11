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

Uses Redis for distributed deployments with optional TTL.

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
}
```

### Example

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

### Advantages

- Distributed storage across multiple instances
- Built-in TTL for automatic expiration
- High-performance in-memory storage
- Pipeline operations for batch updates

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

// Check supported types
BackendFactory.getSupportedTypes(); // ['file', 'sqlite', 'redis']
BackendFactory.isSupported('sqlite'); // true
```

## Configuration File

You can configure the backend in `.ad-sdlc/config.yaml`:

```yaml
scratchpad:
  # Backend type: file, sqlite, or redis
  backend: sqlite

  # File backend options
  file:
    basePath: .ad-sdlc/scratchpad
    format: yaml

  # SQLite backend options
  sqlite:
    dbPath: .ad-sdlc/scratchpad.db
    walMode: true
    busyTimeout: 5000

  # Redis backend options
  redis:
    host: ${REDIS_HOST:-localhost}
    port: ${REDIS_PORT:-6379}
    password: ${REDIS_PASSWORD}
    db: 0
    prefix: ad-sdlc:scratchpad:
    ttl: 86400
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
import { BackendCreationError } from 'ad-sdlc';

try {
  const backend = BackendFactory.create({ backend: 'redis' });
  // Throws: Redis configuration is required
} catch (error) {
  if (error instanceof BackendCreationError) {
    console.error(`Backend: ${error.backendType}`);
    console.error(`Message: ${error.message}`);
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
