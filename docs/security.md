# Security Module

The AD-SDLC security module provides essential security utilities for building secure agent-driven systems.

## Overview

The security module includes:

- **SecretManager** - Secure API key and secret management
- **InputValidator** - Input validation and sanitization
- **AuditLogger** - Security audit logging
- **SecureFileHandler** - Secure temporary file handling
- **RateLimiter** - API rate limiting
- **CommandSanitizer** - Safe shell command execution (prevents command injection)
- **SecureFileOps** - Centralized secure file operations with path validation
- **PathResolver** - Project-aware path resolution with traversal prevention

## Installation

The security module is included in the main `ad-sdlc` package:

```typescript
import {
  SecretManager,
  InputValidator,
  AuditLogger,
  SecureFileHandler,
  RateLimiter,
  CommandSanitizer,
  getCommandSanitizer,
  SecureFileOps,
  createSecureFileOps,
  PathResolver,
} from 'ad-sdlc';
```

## SecretManager

Manages secure access to API keys and secrets with automatic masking.

### Basic Usage

```typescript
import { SecretManager, getSecretManager } from 'ad-sdlc';

// Using singleton
const secrets = getSecretManager();
await secrets.load();

// Get a secret
const apiKey = secrets.get('CLAUDE_API_KEY');

// Check if secret exists
if (secrets.has('GITHUB_TOKEN')) {
  const token = secrets.get('GITHUB_TOKEN');
}

// Get with default value
const optional = secrets.getOrDefault('OPTIONAL_KEY', 'default');
```

### Secret Masking

Prevent secrets from appearing in logs:

```typescript
const secrets = getSecretManager();
await secrets.load();

// Mask secrets in text
const logMessage = `Connecting with key: ${secrets.get('API_KEY')}`;
console.log(secrets.mask(logMessage));
// Output: "Connecting with key: [API_KEY_REDACTED]"

// Create a safe logger
const safeLog = secrets.createSafeLogger(console.log);
safeLog(`Using token: ${token}`); // Automatically masked
```

### Configuration

```typescript
const secrets = new SecretManager({
  envFilePath: '.env.local',
  requiredSecrets: ['CLAUDE_API_KEY', 'GITHUB_TOKEN'],
  throwOnMissing: true, // Throw if required secrets are missing
});
```

## InputValidator

Validates and sanitizes user inputs to prevent security vulnerabilities.

### File Path Validation

Prevents path traversal attacks:

```typescript
import { InputValidator, PathTraversalError } from 'ad-sdlc';

const validator = new InputValidator({
  basePath: '/app/data',
});

// Valid path
const safePath = validator.validateFilePath('subdir/file.txt');
// Returns: '/app/data/subdir/file.txt'

// Path traversal attempt - throws error
try {
  validator.validateFilePath('../etc/passwd');
} catch (error) {
  if (error instanceof PathTraversalError) {
    console.error('Path traversal detected!');
  }
}
```

### URL Validation

```typescript
const validator = new InputValidator({
  basePath: '/app',
  allowedProtocols: ['https:'],
  blockInternalUrls: true,
});

// Valid URL
const url = validator.validateUrl('https://api.github.com/repos');

// Blocked - HTTP not allowed
validator.validateUrl('http://example.com'); // Throws InvalidUrlError

// Blocked - Internal URL
validator.validateUrl('https://localhost/api'); // Throws InvalidUrlError
```

### Input Sanitization

```typescript
// Remove control characters
const clean = validator.sanitizeUserInput('Hello\x00World');
// Returns: 'HelloWorld'

// Validate email
if (validator.isValidEmail('user@example.com')) {
  // Valid email
}

// Validate GitHub repository
const repo = validator.validateGitHubRepo('https://github.com/owner/repo');
// Returns: 'owner/repo'

// Validate semantic version
if (validator.isValidSemver('1.2.3')) {
  // Valid semver
}

// Validate branch name
if (validator.isValidBranchName('feature/add-login')) {
  // Valid branch name
}
```

## AuditLogger

Logs security-sensitive operations for compliance and debugging.

### Basic Usage

```typescript
import { AuditLogger, getAuditLogger } from 'ad-sdlc';

const audit = getAuditLogger({
  logDir: '.ad-sdlc/logs/audit',
  consoleOutput: process.env.NODE_ENV !== 'production',
});

// Log events
audit.log({
  type: 'api_key_used',
  actor: 'collector-agent',
  resource: 'CLAUDE_API_KEY',
  action: 'authenticate',
  result: 'success',
});
```

### Convenience Methods

```typescript
// GitHub operations
audit.logGitHubIssueCreated(42, 'owner/repo', 'issue-generator');
audit.logGitHubPRCreated(123, 'owner/repo', 'pr-reviewer');
audit.logGitHubPRMerged(123, 'owner/repo', 'controller');

// File operations
audit.logFileCreated('/path/to/file', 'worker-agent');
audit.logFileModified('/path/to/file', 'worker-agent');
audit.logFileDeleted('/path/to/file', 'worker-agent');

// Security events
audit.logSecurityViolation('path_traversal', 'unknown-user', {
  attemptedPath: '../etc/passwd',
});

// Validation failures
audit.logValidationFailed('email', 'user', {
  input: 'invalid-email',
  reason: 'missing @ symbol',
});
```

### Correlation IDs

Track related operations:

```typescript
const correlationId = audit.newCorrelationId();
// All subsequent logs include this correlation ID

// Or set a specific ID
audit.setCorrelationId('request-123');
```

### Reading Audit Logs

```typescript
const entries = audit.getRecentEntries(100);
for (const entry of entries) {
  console.log(`${entry.timestamp}: ${entry.type} - ${entry.result}`);
}
```

## SecureFileHandler

Handles temporary files securely with automatic cleanup.

### Basic Usage

```typescript
import { SecureFileHandler, getSecureFileHandler } from 'ad-sdlc';

const files = getSecureFileHandler({
  autoCleanup: true, // Clean up on process exit
});

// Create temporary file
const tempFile = await files.createTempFile('secret content', '.json');
// File has 0o600 permissions (owner read/write only)

// Create temporary directory
const tempDir = await files.createTempDir();
// Directory has 0o700 permissions

// Write securely
await files.writeSecure('/path/to/file', 'content');

// Read with permission check
const content = await files.readSecure('/path/to/file');
```

### Cleanup

```typescript
// Automatic cleanup on process exit (default)
const files = new SecureFileHandler({ autoCleanup: true });

// Manual cleanup
await files.cleanupAll();

// Track/untrack files
files.track('/path/to/watch');
files.untrack('/path/to/ignore');
```

### Secure Operations

```typescript
// Copy with secure permissions
await files.copySecure('/source', '/dest');

// Move with tracking update
await files.moveSecure('/source', '/dest');

// Check file security
const stats = await files.getSecureStats('/path/to/file');
if (!stats.isSecure) {
  console.warn('Security warnings:', stats.warnings);
}
```

## RateLimiter

Prevents API abuse with configurable rate limiting.

### Basic Usage

```typescript
import { RateLimiter, RateLimiters } from 'ad-sdlc';

// Custom limiter
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
});

// Check and consume
const status = limiter.check('user-key');
if (status.allowed) {
  // Proceed with request
  console.log(`Remaining: ${status.remaining}`);
} else {
  console.log(`Rate limited. Retry in ${status.resetIn}ms`);
}

// Check and throw if exceeded
try {
  limiter.checkOrThrow('user-key');
} catch (error) {
  if (error instanceof RateLimitExceededError) {
    console.log(`Retry after ${error.retryAfterMs}ms`);
  }
}
```

### Preset Limiters

```typescript
// GitHub API (5000/hour)
const github = RateLimiters.github();

// Claude API (60/minute)
const claude = RateLimiters.claude();

// Strict (10/minute)
const strict = RateLimiters.strict();

// Lenient (1000/minute)
const lenient = RateLimiters.lenient();
```

### Status Without Consuming

```typescript
// Check status without consuming a token
const status = limiter.getStatus('user-key');
console.log(`Available: ${status.remaining}/${config.maxRequests}`);

// Reset specific key
limiter.reset('user-key');

// Reset all keys
limiter.resetAll();
```

## CommandSanitizer

Provides safe shell command execution by preventing command injection attacks.

### The Problem

Using `exec()` or `execSync()` with unsanitized user input can lead to command injection:

```typescript
// DANGEROUS - Never do this!
const userInput = '; rm -rf /';
exec(`git checkout ${userInput}`); // Would execute: git checkout ; rm -rf /
```

### Solution: CommandSanitizer

CommandSanitizer uses `execFile()` instead of `exec()`, which bypasses the shell entirely:

```typescript
import { getCommandSanitizer } from 'ad-sdlc';

const sanitizer = getCommandSanitizer();

// Safe execution - uses execFile, bypasses shell
const result = await sanitizer.execGit(['checkout', 'main']);
console.log(result.stdout);
```

### Basic Usage

```typescript
import { CommandSanitizer, getCommandSanitizer } from 'ad-sdlc';

const sanitizer = getCommandSanitizer();

// Execute git commands safely
const gitStatus = await sanitizer.execGit(['status', '--porcelain']);

// Execute GitHub CLI commands safely
const prList = await sanitizer.execGh(['pr', 'list', '--json', 'number,title']);

// Synchronous versions
const branch = sanitizer.execGitSync(['rev-parse', '--abbrev-ref', 'HEAD']);
```

### Command Validation

Commands are validated against a whitelist before execution:

```typescript
// Validate and sanitize a command
const validated = sanitizer.validateCommand('git', ['status', '--porcelain']);
// Returns: { baseCommand: 'git', subCommand: 'status', args: ['status', '--porcelain'], rawCommand: 'git status --porcelain' }

// Execute the validated command
const result = await sanitizer.safeExec(validated);
```

### Argument Sanitization

Arguments are checked for shell metacharacters and dangerous patterns:

```typescript
// Safe argument
const safe = sanitizer.sanitizeArgument('feature/my-branch');
// Returns: 'feature/my-branch'

// Dangerous argument - throws CommandInjectionError
sanitizer.sanitizeArgument('; rm -rf /');
// Throws: CommandInjectionError - Shell metacharacter detected
```

### String-Based Execution (Migration)

For backward compatibility with existing code using command strings:

```typescript
// Parse and execute a command string safely
const result = await sanitizer.execFromString('gh pr view 123 --json url');

// Synchronous version
const syncResult = sanitizer.execFromStringSync('git log -1 --oneline');
```

The parser respects quoted strings:

```typescript
// Double-quoted content is preserved
await sanitizer.execFromString('git commit -m "fix: add new feature"');

// Single-quoted content is preserved
await sanitizer.execFromString("git commit -m 'fix: add new feature'");
```

### Escaping Content for Command Strings

When building command strings with user content:

```typescript
const userMessage = 'Fix the "bug" in parser';

// Escape for use in double quotes
const escaped = sanitizer.escapeForParser(userMessage);
// Returns: 'Fix the \\"bug\\" in parser'

// Use in command string
await sanitizer.execFromString(`git commit -m "${escaped}"`);
```

### Whitelisted Commands

By default, only these commands are allowed:

| Command | Subcommands |
|---------|-------------|
| git | status, add, commit, push, pull, checkout, branch, log, diff, show, fetch, merge, rebase, stash, reset, tag, init, clone, remote, rev-parse |
| gh | pr, issue, repo, auth, api, run, workflow |
| npm | install, ci, run, test, build, audit, version, pack, publish, exec, cache |
| npx | (any) |
| node | (any) |
| tsc | (any) |
| eslint | (any) |
| prettier | (any) |
| vitest | (any) |
| jest | (any) |

### Error Handling

```typescript
import {
  CommandInjectionError,
  CommandNotAllowedError
} from 'ad-sdlc';

try {
  await sanitizer.execFromString('curl http://evil.com');
} catch (error) {
  if (error instanceof CommandNotAllowedError) {
    console.error('Command not in whitelist');
  }
}

try {
  await sanitizer.execFromString('git checkout $(whoami)');
} catch (error) {
  if (error instanceof CommandInjectionError) {
    console.error('Command injection detected');
  }
}
```

### Configuration for Validated Commands

```typescript
// Validate command for hook/config usage
const result = sanitizer.validateConfigCommand('npm run build');
if (result.valid) {
  // Safe to execute in config context
} else {
  console.error('Dangerous command:', result.reason);
}
```

## SecureFileOps

Provides a centralized, secure wrapper for all file operations with automatic path validation.

### The Problem

Direct file operations with user-provided paths can lead to path traversal attacks:

```typescript
// DANGEROUS - Never do this!
const userPath = '../../../etc/passwd';
const content = fs.readFileSync(userPath);  // Path traversal vulnerability!
```

### Solution: SecureFileOps

SecureFileOps wraps all file operations with automatic path validation:

```typescript
import { createSecureFileOps, SecureFileOps } from 'ad-sdlc';

// Create instance with project root
const fileOps = createSecureFileOps({
  projectRoot: '/path/to/project',
});

// Safe file operations - validates path before executing
const content = await fileOps.readFile('src/config.json');  // Safe
const content2 = await fileOps.readFile('../../../etc/passwd');  // Throws PathTraversalError!
```

### Basic Usage

```typescript
import { createSecureFileOps, getSecureFileOps } from 'ad-sdlc';

// Using factory function with configuration
const fileOps = createSecureFileOps({
  projectRoot: process.cwd(),
  allowedExternalDirs: ['/tmp/allowed'],  // Optional: allow specific external directories
});

// Or using singleton (uses CWD as project root)
const defaultOps = getSecureFileOps();

// Read files safely
const content = await fileOps.readFile('src/index.ts');
const jsonData = await fileOps.readFile('config.json');

// Write files safely (auto-creates directories)
await fileOps.writeFile('dist/output.js', 'console.log("hello")');

// Append to files
await fileOps.appendFile('logs/app.log', 'New log entry\n');

// Create directories
await fileOps.mkdir('new-dir/nested');

// Check file existence
if (await fileOps.exists('package.json')) {
  // File exists
}

// Delete files
await fileOps.unlink('temp-file.txt');

// Rename/move files
await fileOps.rename('old-name.ts', 'new-name.ts');

// Copy files
await fileOps.copyFile('source.ts', 'backup/source.ts');
```

### Synchronous Operations

All operations have synchronous versions:

```typescript
const content = fileOps.readFileSync('config.json');
fileOps.writeFileSync('output.txt', 'content');
fileOps.mkdirSync('new-directory');
const exists = fileOps.existsSync('file.txt');
fileOps.unlinkSync('temp.txt');
fileOps.renameSync('old.ts', 'new.ts');
fileOps.copyFileSync('src.ts', 'dest.ts');
```

### Path Validation

Validate paths explicitly:

```typescript
// Get validated absolute path
const absolutePath = fileOps.validatePath('relative/path.ts');
// Returns: '/path/to/project/relative/path.ts'

// Path traversal attempts throw PathTraversalError
try {
  fileOps.validatePath('../../etc/passwd');
} catch (error) {
  if (error instanceof PathTraversalError) {
    console.error('Path traversal detected!');
  }
}
```

### Configuration Options

```typescript
const fileOps = createSecureFileOps({
  // Project root directory (all paths must resolve within this)
  projectRoot: '/path/to/project',

  // Optional: Allow access to specific external directories
  allowedExternalDirs: ['/tmp/shared', '/var/cache/app'],

  // Optional: Validate symlinks don't escape project
  validateSymlinks: true,  // Default: false
});
```

## PathResolver

Low-level path resolution with security validation.

### Basic Usage

```typescript
import { PathResolver } from 'ad-sdlc';

const resolver = new PathResolver({
  projectRoot: '/path/to/project',
});

// Resolve path safely
const resolved = resolver.resolve('src/index.ts');
console.log(resolved.absolutePath);     // '/path/to/project/src/index.ts'
console.log(resolved.relativePath);     // 'src/index.ts'
console.log(resolved.isWithinProject);  // true

// Path traversal throws error
resolver.resolve('../../../etc/passwd');  // Throws PathTraversalError
```

### Configuration

```typescript
const resolver = new PathResolver({
  projectRoot: '/project',
  allowedExternalDirs: ['/tmp'],  // Allow specific external paths
  validateSymlinks: true,          // Check symlink targets
});
```

## Error Classes

All security errors extend `SecurityError`:

```typescript
import {
  SecurityError,
  SecretNotFoundError,
  PathTraversalError,
  InvalidUrlError,
  ValidationError,
  RateLimitExceededError,
  CommandInjectionError,
  CommandNotAllowedError,
} from 'ad-sdlc';

try {
  // Security operation
} catch (error) {
  if (error instanceof SecurityError) {
    console.log(`Security error: ${error.code}`);
  }
}
```

## Best Practices

1. **Never log secrets** - Always use `SecretManager.mask()` before logging
2. **Validate all inputs** - Use `InputValidator` for paths, URLs, and user input
3. **Audit sensitive operations** - Log API key usage, file operations, and security events
4. **Use secure file handling** - Always use `SecureFileHandler` for temporary files
5. **Implement rate limiting** - Protect APIs from abuse with `RateLimiter`
6. **Prevent command injection** - Always use `CommandSanitizer` for shell command execution
7. **Never use exec() with user input** - Use `execGit()`, `execGh()`, or `execFromString()` instead
8. **Use SecureFileOps for all file operations** - Prevents path traversal attacks by validating all paths against project root
9. **Configure project root** - Always specify `projectRoot` when creating `SecureFileOps` or `PathResolver` instances

## Security Scanning

The project includes automated security scanning:

- **npm audit** - Dependency vulnerability scanning
- **CodeQL** - Static code analysis
- **Gitleaks** - Secret detection in commits
- **License checking** - License compliance verification

See `.github/workflows/security.yml` for configuration.
