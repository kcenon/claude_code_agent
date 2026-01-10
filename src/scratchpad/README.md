# Scratchpad Module

File-based state sharing infrastructure for inter-agent communication in AD-SDLC.

## Overview

The Scratchpad module implements the Scratchpad pattern, enabling agents to communicate through structured file operations. This overcomes the Claude Agent SDK's unidirectional (parent→child) communication limitation by allowing any agent to read state produced by any other agent.

## Features

- **Path Resolution**: Structured paths for all scratchpad sections
- **Project ID Management**: Auto-incrementing project identifiers
- **Atomic Writes**: Write to temp file, then rename to prevent partial writes
- **File Locking**: Concurrent access safety with auto-release timers
- **Format Helpers**: Read/write for YAML, JSON, and Markdown
- **Schema Validation**: Zod-based runtime validation for all data entities

## Usage

### Basic Setup

```typescript
import { getScratchpad, Scratchpad } from './scratchpad';

// Using singleton
const scratchpad = getScratchpad();

// Or create custom instance
const custom = new Scratchpad({
  basePath: '.custom-scratchpad',
  enableLocking: true,
  lockTimeout: 5000,
});
```

### Project Management

```typescript
// Generate new project ID (auto-increments)
const projectId = await scratchpad.generateProjectId(); // '001'

// Initialize project with all directories
const projectInfo = await scratchpad.initializeProject(projectId, 'My Project');

// List existing projects
const projectIds = await scratchpad.listProjectIds();
```

### Path Resolution

```typescript
// Get paths for various scratchpad files
const infoPath = scratchpad.getCollectedInfoPath('001');
// '.ad-sdlc/scratchpad/info/001/collected_info.yaml'

const prdPath = scratchpad.getDocumentPath('001', 'prd');
// '.ad-sdlc/scratchpad/documents/001/prd.md'

const issueListPath = scratchpad.getIssueListPath('001');
// '.ad-sdlc/scratchpad/issues/001/issue_list.json'

const workOrderPath = scratchpad.getWorkOrderPath('001', 'WO-001');
// '.ad-sdlc/scratchpad/progress/001/work_orders/WO-001.yaml'
```

### YAML Operations

```typescript
// Write YAML (atomic)
await scratchpad.writeYaml(filePath, {
  projectId: '001',
  status: 'active',
  items: ['a', 'b', 'c'],
});

// Read YAML
const data = await scratchpad.readYaml<ProjectData>(filePath);

// Handle missing files gracefully
const optional = await scratchpad.readYaml(path, { allowMissing: true });
```

### JSON Operations

```typescript
// Write JSON (atomic)
await scratchpad.writeJson(filePath, {
  issues: [{ id: 1, title: 'First issue' }],
});

// Read JSON
const issues = await scratchpad.readJson<IssueList>(filePath);
```

### Markdown Operations

```typescript
// Write Markdown (atomic)
await scratchpad.writeMarkdown(filePath, '# Project Documentation\n\nContent here.');

// Read Markdown
const content = await scratchpad.readMarkdown(filePath);
```

### File Locking

```typescript
// Acquire lock manually
const acquired = await scratchpad.acquireLock(filePath, 'worker-1');
if (acquired) {
  // Do work...
  await scratchpad.releaseLock(filePath, 'worker-1');
}

// Execute with automatic lock management
const result = await scratchpad.withLock(filePath, async () => {
  const data = await scratchpad.readYaml(filePath);
  data.counter += 1;
  await scratchpad.writeYaml(filePath, data);
  return data.counter;
});
```

### Cooperative Lock Release

When stealing expired locks, the scratchpad uses a cooperative release pattern to prevent data corruption. Before forcibly stealing a lock, a release request is sent to notify the current holder.

```typescript
// Check if another process is requesting lock release
const shouldRelease = await scratchpad.isReleaseRequested(filePath, 'current-holder');
if (shouldRelease) {
  // Gracefully complete work and release lock
  await scratchpad.releaseLock(filePath, 'current-holder');
}

// Disable cooperative release for faster acquisition (use with caution)
await scratchpad.acquireLock(filePath, 'holder', {
  cooperativeRelease: false,
});
```

### Schema Validation

```typescript
import {
  validateCollectedInfo,
  assertCollectedInfo,
  SchemaValidationError,
  getSchemaVersion,
} from './scratchpad';

// Validate with result object
const result = validateCollectedInfo(data);
if (result.success) {
  console.log('Valid data:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}

// Assert with exception on failure
try {
  const validated = assertCollectedInfo(data);
  // Use validated data
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error(error.formatErrors());
  }
}

// Check schema version compatibility
const version = getSchemaVersion(); // '1.0.0'
```

#### Available Validators

- `validateCollectedInfo(data)` - Validate collected requirements
- `validateWorkOrder(data)` - Validate work orders
- `validateImplementationResult(data)` - Validate implementation results
- `validatePRReviewResult(data)` - Validate PR review results
- `validateControllerState(data)` - Validate controller state

Each has a corresponding `assert*` function that throws on invalid data.

## Directory Structure

```
.ad-sdlc/scratchpad/
├── info/                          # Collected requirements
│   └── {project_id}/
│       ├── project.yaml           # Project metadata
│       └── collected_info.yaml    # Requirements info
├── documents/                     # Generated documents
│   └── {project_id}/
│       ├── prd.md                 # Product Requirements
│       ├── srs.md                 # Software Requirements
│       └── sds.md                 # System Design
├── issues/                        # Generated issues
│   └── {project_id}/
│       ├── issue_list.json        # All issues
│       └── dependency_graph.json  # Issue dependencies
└── progress/                      # Execution state
    └── {project_id}/
        ├── controller_state.yaml  # Controller status
        ├── work_orders/           # Work assignments
        │   └── WO-XXX.yaml
        ├── results/               # Implementation results
        │   └── WO-XXX.yaml
        └── reviews/               # Review feedback
            └── REV-XXX.yaml
```

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `basePath` | `string` | `.ad-sdlc/scratchpad` | Base directory path |
| `fileMode` | `number` | `0o600` | File permission mode |
| `dirMode` | `number` | `0o700` | Directory permission mode |
| `enableLocking` | `boolean` | `true` | Enable file locking |
| `lockTimeout` | `number` | `5000` | Lock timeout in ms |

### Path Methods

- `getBasePath()` - Base scratchpad directory
- `getSectionPath(section)` - Section directory (info/documents/issues/progress)
- `getProjectPath(section, projectId)` - Project directory within section
- `getCollectedInfoPath(projectId)` - collected_info.yaml path
- `getDocumentPath(projectId, docType)` - Document file path (prd/srs/sds)
- `getIssueListPath(projectId)` - issue_list.json path
- `getDependencyGraphPath(projectId)` - dependency_graph.json path
- `getControllerStatePath(projectId)` - controller_state.yaml path
- `getWorkOrderPath(projectId, orderId)` - Work order file path
- `getResultPath(projectId, orderId)` - Result file path
- `getReviewPath(projectId, reviewId)` - Review file path

### File Operations

- `atomicWrite(path, content, options)` - Atomic file write
- `ensureDir(path)` - Create directory if not exists
- `exists(path)` - Check file existence
- `deleteFile(path)` - Delete file

### Format Helpers

- `readYaml<T>(path, options)` - Read and parse YAML
- `writeYaml(path, data, options)` - Write YAML
- `readJson<T>(path, options)` - Read and parse JSON
- `writeJson(path, data, options)` - Write JSON
- `readMarkdown(path, options)` - Read Markdown
- `writeMarkdown(path, content, options)` - Write Markdown

### Locking

- `acquireLock(path, holderId, options)` - Acquire file lock
- `releaseLock(path, holderId)` - Release file lock
- `withLock(path, fn, options)` - Execute with lock
- `isReleaseRequested(path, holderId)` - Check if release is requested

### Lock Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `holderId` | `string` | (auto) | Lock holder identifier |
| `retryAttempts` | `number` | `10` | Number of retry attempts |
| `retryDelayMs` | `number` | `100` | Base delay between retries |
| `cooperativeRelease` | `boolean` | `true` | Enable cooperative release before stealing |
| `cooperativeReleaseTimeoutMs` | `number` | `1000` | Timeout for cooperative release |

## Testing

```bash
npm test -- tests/scratchpad
```
