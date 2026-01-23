# Security Module

Comprehensive security utilities for path traversal prevention, command injection protection, secret management, and audit logging.

## Overview

The Security module provides multi-layered protection against common security vulnerabilities. It includes path validation with symlink resolution, whitelist-based command execution, secure credential management, structured audit logging, rate limiting, and safe file operations.

## Features

- **Path Traversal Prevention**: Multi-layered validation with symlink resolution
- **Command Injection Prevention**: Whitelist-based execution with argument sanitization
- **Secret Management**: Environment loading, masking, and access control
- **Audit Logging**: Structured JSON logging with file rotation
- **Rate Limiting**: Token bucket algorithm for request throttling
- **Secure File Operations**: Safe temporary files and permission management
- **Input Validation**: Email, URL, branch name, semver validation

## Usage

### Path Validation

```typescript
import { InputValidator } from './security';

const validator = new InputValidator({
  basePath: process.cwd(),
  symlinkPolicy: 'resolve',
  allowedDirs: ['/tmp/allowed'],
});

// Throws PathTraversalError if invalid
const safePath = validator.validateFilePath('./src/config.ts');

// Safe method returns result object
const result = validator.validateFilePathSafe('../../../etc/passwd');
if (!result.valid) {
  console.log('Rejected:', result.error);
}

// Extended result with rejection reason
const extended = validator.validateFilePathExtended(userInput);
if (!extended.valid) {
  console.log('Reason:', extended.rejectionReason);
  // 'TRAVERSAL_ATTEMPT' | 'OUTSIDE_BOUNDARY' | 'NULL_BYTE' | etc.
}
```

### Command Execution

```typescript
import { getCommandSanitizer } from './security';

const sanitizer = getCommandSanitizer({
  strictMode: true,
  enableAuditLog: true,
});

// Validate command against whitelist
const cmd = sanitizer.validateCommand('git', ['commit', '-m', 'Fix bug']);
// { baseCommand: 'git', subCommand: 'commit', args: [...] }

// Execute safely (uses execFile, no shell)
const result = await sanitizer.executeCommand('npm', ['install']);
console.log(result.stdout);

// Sanitize individual argument
const safeArg = sanitizer.sanitizeArgument(userInput, 'git');
```

### Secure File Operations

```typescript
import { createSecureFileOps } from './security';

const fileOps = createSecureFileOps({
  projectRoot: process.cwd(),
  validateSymlinks: true,
  fileMode: 0o600,
  dirMode: 0o700,
});

// All paths validated against project root
await fileOps.write('config/settings.json', JSON.stringify(data));
const content = await fileOps.read('config/settings.json');

// Watch for changes (with symlink validation)
const watcher = fileOps.watch('src', (event) => {
  console.log(`${event.type}: ${event.path}`);
});
```

### Secret Management

```typescript
import { getSecretManager } from './security';

const secrets = getSecretManager({
  loadEnvFile: true,
  envFilePath: '.env',
});

// Get secret (throws if required and missing)
const apiKey = secrets.get('OPENAI_API_KEY', { required: true });

// Safe get with default
const optional = secrets.get('DEBUG_MODE', { defaultValue: 'false' });

// Mask secrets in text (for logging)
const masked = secrets.mask(logMessage);
// "API key: sk-abc123..." → "API key: [OPENAI_API_KEY_REDACTED]..."

// Validate required secrets
const missing = secrets.validateRequired(['API_KEY', 'DB_PASSWORD']);
if (missing.length > 0) {
  throw new Error(`Missing secrets: ${missing.join(', ')}`);
}
```

### Audit Logging

```typescript
import { getAuditLogger } from './security';

const audit = getAuditLogger({
  logDir: './audit-logs',
  maxFileSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 5,
});

// Log security events
audit.log({
  type: 'command_executed',
  actor: 'user-123',
  resource: 'git',
  action: 'commit',
  result: 'success',
  details: { branch: 'main' },
});

// Convenience methods
audit.logSecurityViolation('path_traversal', 'user-456', {
  attemptedPath: '../../../etc/passwd',
});

audit.logCommandExecution('git', ['push'], result);
audit.logFileOperation('write', '/path/to/file', 'success', 'system');

// Query recent entries
const entries = audit.getRecentEntries(10);
const todayEntries = audit.getEntriesSince(new Date('2024-01-01'));
```

### Rate Limiting

```typescript
import { RateLimiter } from './security';

const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,  // 1 minute
});

// Check rate limit
const status = limiter.check('user-123');
if (!status.allowed) {
  console.log(`Rate limited. Retry in ${status.resetIn}ms`);
}

// Throws RateLimitExceededError if exceeded
limiter.checkOrThrow('user-123');

// Reset specific key or all
limiter.reset('user-123');
limiter.reset();  // Reset all
```

### Secure Temporary Files

```typescript
import { getSecureFileHandler } from './security';

const handler = getSecureFileHandler();

// Create temp directory (auto-cleanup on exit)
const tempDir = await handler.createTempDir();

// Create temp file with content
const tempFile = await handler.createTempFile('content', '.txt');

// Write with restrictive permissions
await handler.writeSecure('/path/to/file', 'content');

// Manual cleanup
await handler.cleanup(tempFile);
await handler.cleanupAll();
```

## Architecture

```
InputValidator
├── PathSanitizer (component validation)
├── SymlinkResolver (symlink handling)
└── AuditLogger (optional logging)

SecureFileOps
├── PathResolver (boundary enforcement)
└── AuditLogger (file operation logging)

CommandSanitizer
├── CommandWhitelist (allowed commands)
└── AuditLogger (command logging)
```

## API Reference

### InputValidator Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `basePath` | `string` | Required | Base directory for validation |
| `allowedProtocols` | `string[]` | `['https:']` | Allowed URL protocols |
| `blockInternalUrls` | `boolean` | `true` | Block internal URLs |
| `maxInputLength` | `number` | `10000` | Max input length |
| `symlinkPolicy` | `string` | `'resolve'` | `'allow'` \| `'deny'` \| `'resolve'` |
| `maxPathLength` | `number` | `4096` | Max path length |

### CommandSanitizer Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strictMode` | `boolean` | `true` | Reject shell metacharacters |
| `logCommands` | `boolean` | `false` | Log all commands |
| `enableAuditLog` | `boolean` | `true` | Enable audit logging |

### SecureFileOps Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | `string` | Required | Project root directory |
| `allowedExternalDirs` | `string[]` | `[]` | Additional allowed dirs |
| `fileMode` | `number` | `0o600` | Default file permissions |
| `dirMode` | `number` | `0o700` | Default directory permissions |
| `validateSymlinks` | `boolean` | `true` | Validate symlink targets |

### AuditLogger Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logDir` | `string` | `.ad-sdlc/audit` | Log directory |
| `maxFileSize` | `number` | `10MB` | Max file size before rotation |
| `maxFiles` | `number` | `5` | Max rotated files to keep |
| `consoleOutput` | `boolean` | `false` | Also output to console |

## Whitelisted Commands

### Version Control
- **git**: status, add, commit, push, pull, checkout, branch, log, diff, fetch, merge, rebase, stash, tag, remote, config, init, clone, reset, show, rev-parse, ls-files, symbolic-ref, describe, clean, restore, switch
- **gh**: pr, issue, repo, auth, api, run, workflow

### Package Management
- **npm**: install, ci, run, test, build, audit, outdated, ls, pack, publish, version, init, cache, prune
- **npx**: (arbitrary args)
- **node**: (arbitrary args)

### Development Tools
- **tsc**: TypeScript compiler (arbitrary args)
- **eslint**: Linting (arbitrary args)
- **prettier**: Code formatting (arbitrary args)
- **vitest/jest**: Testing (arbitrary args)

## Error Handling

### Error Types

```typescript
SecurityError (base)
├── PathTraversalError     // Path escape attempt
├── InvalidUrlError        // Invalid/blocked URL
├── ValidationError        // General validation failure
├── RateLimitExceededError // Rate limit hit
├── CommandInjectionError  // Injection attempt
├── CommandNotAllowedError // Command not whitelisted
├── SecretNotFoundError    // Required secret missing
└── WhitelistUpdateError   // Whitelist update failed
```

### Error Properties

```typescript
// PathTraversalError
error.attemptedPath  // Original input path
error.basePath       // Configured base path

// CommandNotAllowedError
error.command        // Attempted command
error.reason         // Why it was blocked

// SecretNotFoundError
error.secretKey      // Missing secret name
```

### Error Handling Pattern

```typescript
try {
  const path = validator.validateFilePath(userInput);
} catch (error) {
  if (error instanceof PathTraversalError) {
    audit.logSecurityViolation('path_traversal', actor, {
      attemptedPath: error.attemptedPath,
    });
  }
  throw error;
}
```

## Security Features

### Path Traversal Prevention

1. **Null Byte Detection**: Rejects `\0` in paths
2. **Dangerous Patterns**: Blocks `..`, relative traversal
3. **Boundary Checking**: Ensures paths stay within allowed directories
4. **Symlink Resolution**: Validates symlink targets
5. **Case Handling**: Cross-platform case-sensitive/insensitive
6. **TOCTOU Safety**: Atomic operations with inode verification

### Command Injection Prevention

1. **Whitelist-Based**: Only approved commands allowed
2. **Argument Validation**: No null bytes, newlines, metacharacters
3. **execFile Usage**: Bypasses shell entirely
4. **Strict Mode**: Rejects any shell metacharacters

### Secret Protection

1. **Pattern Matching**: Identifies secrets by naming patterns
2. **Automatic Masking**: Replaces values in logs
3. **Required Validation**: Enforces critical secrets presence

## Testing Support

Reset singletons for test isolation:

```typescript
import {
  resetSecretManager,
  resetAuditLogger,
  resetSecureFileHandler,
  resetCommandSanitizer,
  resetSecureFileOps,
} from './security';

beforeEach(() => {
  resetSecretManager();
  resetAuditLogger();
  // ...
});
```

## Related Modules

- [Logging](../logging/README.md) - Structured application logging
- [Config](../config/README.md) - Configuration management
- [Worker](../worker/README.md) - Uses SecureFileOps

## Testing

```bash
npm test -- tests/security
```
