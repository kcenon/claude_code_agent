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

- `acquireLock(path, holderId)` - Acquire file lock
- `releaseLock(path, holderId)` - Release file lock
- `withLock(path, fn, holderId)` - Execute with lock

## Testing

```bash
npm test -- tests/scratchpad
```
