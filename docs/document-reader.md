# Document Reader Agent Module

The document-reader module parses and analyzes existing PRD/SRS/SDS documents to understand the current project state for the Enhancement Pipeline.

## Overview

The module includes:

- **DocumentReaderAgent** - Main class for reading and analyzing project documents
- **Types** - Comprehensive type definitions for documents, requirements, and traceability
- **Errors** - Custom error classes for document reading operations

## Installation

The document-reader module is included in the main `ad-sdlc` package:

```typescript
import {
  DocumentReaderAgent,
  getDocumentReaderAgent,
  resetDocumentReaderAgent,
} from 'ad-sdlc';
```

## DocumentReaderAgent

Main class that orchestrates the document reading and analysis workflow.

### Basic Usage

```typescript
import { DocumentReaderAgent, getDocumentReaderAgent } from 'ad-sdlc';

// Using singleton
const reader = getDocumentReaderAgent();

// Or create new instance with custom config
const reader = new DocumentReaderAgent({
  docsBasePath: 'docs',
  strictMode: false,
  extractTraceability: true,
});

// Start a session and read documents
await reader.startSession('my-project');
const result = await reader.readDocuments();

console.log(`Processed ${result.stats.documentsProcessed} documents`);
console.log(`Found ${result.stats.requirementsExtracted} requirements`);
console.log(`Output: ${result.outputPath}`);
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scratchpadBasePath` | string | `.ad-sdlc/scratchpad` | Base path for output files |
| `docsBasePath` | string | `docs` | Base path for document files |
| `prdSubdir` | string | `prd` | Subdirectory for PRD documents |
| `srsSubdir` | string | `srs` | Subdirectory for SRS documents |
| `sdsSubdir` | string | `sds` | Subdirectory for SDS documents |
| `strictMode` | boolean | `false` | Strict parsing mode |
| `extractTraceability` | boolean | `true` | Extract traceability mappings |
| `calculateStatistics` | boolean | `true` | Calculate coverage statistics |
| `maxFileSize` | number | `10485760` | Maximum file size (10MB) |

### Session Workflow

```typescript
// 1. Start a new session
const session = await reader.startSession('project-id');
console.log(`Session started: ${session.sessionId}`);

// 2. Read and process all documents
const result = await reader.readDocuments();

// 3. Access the current state
const state = result.currentState;
console.log(`Project: ${state.project.name}`);
console.log(`Requirements: ${state.requirements.functional.length}`);
console.log(`Features: ${state.features.length}`);
console.log(`Components: ${state.components.length}`);

// 4. Check traceability
console.log(`PRD to SRS coverage: ${state.statistics.coveragePrdToSrs * 100}%`);
console.log(`SRS to SDS coverage: ${state.statistics.coverageSrsToSds * 100}%`);
```

## Extracted Information

### Functional Requirements (FR-XXX)

```typescript
interface FunctionalRequirement {
  id: string;           // e.g., "FR-001"
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'active' | 'deprecated' | 'pending';
  userStory?: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  sourceLocation: string;  // e.g., "docs/prd/prd.md:25"
}
```

### Non-Functional Requirements (NFR-XXX)

```typescript
interface NonFunctionalRequirement {
  id: string;           // e.g., "NFR-001"
  title: string;
  description: string;
  category: 'performance' | 'security' | 'scalability' | 'usability' | 'reliability' | 'maintainability';
  targetMetric?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'active' | 'deprecated' | 'pending';
  sourceLocation: string;
}
```

### System Features (SF-XXX)

```typescript
interface SystemFeature {
  id: string;           // e.g., "SF-001"
  name: string;
  description: string;
  useCases: string[];
  sourceRequirements: string[];  // Links to FR-XXX, NFR-XXX
  status: 'active' | 'deprecated' | 'pending';
  sourceLocation: string;
}
```

### System Components (CMP-XXX)

```typescript
interface SystemComponent {
  id: string;           // e.g., "CMP-001"
  name: string;
  type: 'service' | 'library' | 'module' | 'api';
  description: string;
  responsibilities: string[];
  dependencies: string[];
  sourceFeatures: string[];  // Links to SF-XXX
  sourceLocation: string;
}
```

## Traceability Mappings

The agent automatically builds traceability mappings between documents:

```typescript
// PRD to SRS traceability
interface PRDToSRSTrace {
  prdId: string;      // e.g., "FR-001"
  srsIds: string[];   // e.g., ["SF-001", "SF-002"]
}

// SRS to SDS traceability
interface SRSToSDSTrace {
  srsId: string;      // e.g., "SF-001"
  sdsIds: string[];   // e.g., ["CMP-001"]
}
```

## Output Format

The agent generates a `current_state.yaml` file with the following structure:

```yaml
current_state:
  project:
    name: "Project Name"
    version: "1.0.0"
    last_updated: "2024-12-28T00:00:00Z"

  documents:
    prd:
      path: "docs/prd/prd.md"
      version: "1.0.0"
      item_count: 10
      last_modified: "2024-12-28T00:00:00Z"
    srs:
      path: "docs/srs/srs.md"
      version: "1.0.0"
      item_count: 15
      last_modified: "2024-12-28T00:00:00Z"
    sds:
      path: "docs/sds/sds.md"
      version: "1.0.0"
      item_count: 8
      last_modified: "2024-12-28T00:00:00Z"

  requirements:
    functional:
      - id: "FR-001"
        title: "User Authentication"
        description: "Users can authenticate..."
        priority: "P0"
        status: "active"
        source_location: "docs/prd/prd.md:25"
    non_functional:
      - id: "NFR-001"
        title: "Performance"
        category: "performance"
        target_metric: "< 200ms response time"
        priority: "P1"
        status: "active"
        source_location: "docs/prd/prd.md:50"

  features:
    - id: "SF-001"
      name: "Authentication Module"
      description: "Handles user authentication"
      source_requirements: ["FR-001"]
      status: "active"

  components:
    - id: "CMP-001"
      name: "AuthService"
      type: "service"
      description: "Authentication service"
      source_features: ["SF-001"]

  traceability:
    prd_to_srs:
      - prd_id: "FR-001"
        srs_ids: ["SF-001"]
    srs_to_sds:
      - srs_id: "SF-001"
        sds_ids: ["CMP-001"]

  statistics:
    total_requirements: 10
    total_features: 15
    total_use_cases: 5
    total_components: 8
    total_apis: 0
    coverage_prd_to_srs: 0.8
    coverage_srs_to_sds: 0.9
```

## Error Handling

The module provides specific error classes:

```typescript
import {
  DocumentReaderError,
  DocumentNotFoundError,
  DocumentParseError,
  NoActiveSessionError,
} from 'ad-sdlc';

try {
  await reader.readDocuments();
} catch (error) {
  if (error instanceof NoActiveSessionError) {
    console.error('No active session. Call startSession() first.');
  } else if (error instanceof DocumentNotFoundError) {
    console.error(`Document not found: ${error.path}`);
  } else if (error instanceof DocumentParseError) {
    console.error(`Parse error at line ${error.line}: ${error.reason}`);
  }
}
```

## Integration with Enhancement Pipeline

The Document Reader Agent is the first step in the Enhancement Pipeline:

```
Document Reader → Codebase Analyzer → Impact Analyzer → Updater Agents
```

The generated `current_state.yaml` is used by downstream agents:

1. **Codebase Analyzer** - Compares current code with documented specifications
2. **Impact Analyzer** - Analyzes impact of proposed changes
3. **PRD/SRS/SDS Updaters** - Update documents based on code changes

## Related Modules

- [Collector Agent](./collector.md) - For initial information collection
- [PRD Writer](./prd-writer.md) - For generating PRD documents
- [SRS Writer](./srs-writer.md) - For generating SRS documents
- [SDS Writer](./sds-writer.md) - For generating SDS documents
