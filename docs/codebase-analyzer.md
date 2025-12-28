# Codebase Analyzer Agent

The Codebase Analyzer Agent analyzes existing code structure, architecture patterns, and dependencies to understand the current implementation state. This is a core component of the Enhancement Pipeline.

## Overview

The Codebase Analyzer Agent is responsible for:

- **Structure Analysis**: Analyzing project directory layout and identifying source, test, and configuration directories
- **Architecture Detection**: Recognizing architecture patterns (layered, microservices, monolith, modular)
- **Dependency Graphing**: Extracting import statements and building module dependency graphs
- **Convention Detection**: Detecting naming conventions and file structure patterns
- **Code Metrics**: Calculating file counts, line counts, and language distribution

## Installation

The Codebase Analyzer Agent is included in the main package:

```bash
npm install ad-sdlc
```

## Basic Usage

```typescript
import {
  CodebaseAnalyzerAgent,
  getCodebaseAnalyzerAgent,
} from 'ad-sdlc';

// Get singleton instance
const agent = getCodebaseAnalyzerAgent();

// Start analysis session
await agent.startSession('my-project', '/path/to/project');

// Run analysis
const result = await agent.analyze();

console.log('Architecture type:', result.architectureOverview.type);
console.log('Dependencies found:', result.dependencyGraph.statistics.totalEdges);
```

## API Reference

### CodebaseAnalyzerAgent

Main class for analyzing codebases.

#### Constructor

```typescript
new CodebaseAnalyzerAgent(config?: CodebaseAnalyzerConfig)
```

#### Methods

##### startSession

Starts a new analysis session.

```typescript
async startSession(projectId: string, rootPath: string): Promise<CodebaseAnalysisSession>
```

**Parameters:**
- `projectId`: Unique identifier for the project
- `rootPath`: Root path of the project to analyze

**Returns:** `CodebaseAnalysisSession` object

##### analyze

Analyzes the codebase and generates outputs.

```typescript
async analyze(): Promise<CodebaseAnalysisResult>
```

**Returns:** `CodebaseAnalysisResult` containing architecture overview and dependency graph

##### getSession

Returns the current session or null.

```typescript
getSession(): CodebaseAnalysisSession | null
```

##### resetSession

Resets the current session.

```typescript
resetSession(): void
```

### Configuration

```typescript
interface CodebaseAnalyzerConfig {
  // Base path for scratchpad (defaults to '.ad-sdlc/scratchpad')
  scratchpadBasePath?: string;

  // Source directory patterns to scan
  sourcePatterns?: readonly string[];

  // Test directory patterns to scan
  testPatterns?: readonly string[];

  // Directories to exclude from analysis
  excludeDirs?: readonly string[];

  // File extensions to analyze
  includeExtensions?: readonly string[];

  // Maximum files to analyze (0 = unlimited)
  maxFiles?: number;

  // Maximum file size to process (in bytes)
  maxFileSize?: number;

  // Whether to analyze dependencies
  analyzeDependencies?: boolean;

  // Whether to detect patterns
  detectPatterns?: boolean;

  // Whether to calculate metrics
  calculateMetrics?: boolean;

  // Sample ratio for convention detection (0.0 - 1.0)
  conventionSampleRatio?: number;
}
```

### Output Files

The agent generates two output files:

#### architecture_overview.yaml

Contains architecture analysis including:
- Architecture type and confidence
- Detected patterns
- Directory structure
- Coding conventions
- Code metrics
- Build system information

#### dependency_graph.json

Contains dependency information including:
- Module nodes
- Dependency edges
- External dependencies
- Graph statistics
- Circular dependency detection

## Supported Languages

| Language | Import Detection | Dependency Resolution |
|----------|-----------------|----------------------|
| TypeScript | Full | Full |
| JavaScript | Full | Full |
| Python | Full | Full |
| Java | Partial | Package-level |
| Kotlin | Partial | Package-level |
| Go | Full | Full |
| Rust | Partial | Crate-level |
| C/C++ | Partial | Header-based |

## Architecture Detection

The agent can detect the following architecture types:

- **Layered**: Controllers, services, repositories, models structure
- **Microservices**: Multiple packages/services
- **Modular**: Module-based organization
- **Monolith**: Single source directory structure

## Examples

### Analyzing a TypeScript Project

```typescript
import { CodebaseAnalyzerAgent } from 'ad-sdlc';

const agent = new CodebaseAnalyzerAgent({
  includeExtensions: ['.ts', '.tsx'],
  excludeDirs: ['node_modules', 'dist', 'coverage'],
});

await agent.startSession('my-ts-project', './');
const result = await agent.analyze();

// Access architecture overview
console.log('Type:', result.architectureOverview.type);
console.log('Confidence:', result.architectureOverview.confidence);

// Access detected patterns
for (const pattern of result.architectureOverview.patterns) {
  console.log(`Pattern: ${pattern.name} (${pattern.type})`);
}

// Access dependency graph
console.log('Nodes:', result.dependencyGraph.nodes.length);
console.log('Edges:', result.dependencyGraph.edges.length);

// Check for circular dependencies
if (result.dependencyGraph.statistics.circularDependencies.length > 0) {
  console.log('Warning: Circular dependencies detected!');
  for (const cycle of result.dependencyGraph.statistics.circularDependencies) {
    console.log('  Cycle:', cycle.join(' -> '));
  }
}
```

### Analyzing with Custom Configuration

```typescript
import { CodebaseAnalyzerAgent } from 'ad-sdlc';

const agent = new CodebaseAnalyzerAgent({
  scratchpadBasePath: './output',
  maxFiles: 5000,
  maxFileSize: 2 * 1024 * 1024, // 2MB
  analyzeDependencies: true,
  detectPatterns: true,
  calculateMetrics: true,
  conventionSampleRatio: 0.2, // Sample 20% of files
});

await agent.startSession('large-project', '/path/to/project');
const result = await agent.analyze();

console.log('Files analyzed:', result.stats.filesAnalyzed);
console.log('Processing time:', result.stats.processingTimeMs, 'ms');
```

## Error Handling

The agent provides specific error classes for different failure scenarios:

```typescript
import {
  CodebaseAnalyzerAgent,
  ProjectNotFoundError,
  NoSourceFilesError,
  NoActiveSessionError,
} from 'ad-sdlc';

try {
  const agent = new CodebaseAnalyzerAgent();
  await agent.startSession('project', '/invalid/path');
} catch (error) {
  if (error instanceof ProjectNotFoundError) {
    console.error('Project path not found:', error.path);
  }
}

try {
  const agent = new CodebaseAnalyzerAgent();
  await agent.analyze(); // Without starting session
} catch (error) {
  if (error instanceof NoActiveSessionError) {
    console.error('Must start session first');
  }
}
```

## Integration with Enhancement Pipeline

The Codebase Analyzer Agent works with other agents in the Enhancement Pipeline:

1. **Document Reader Agent**: Reads existing documentation
2. **Codebase Analyzer Agent**: Analyzes code structure (this agent)
3. **Impact Analyzer Agent**: Analyzes impact of changes
4. **Doc-Code Comparator Agent**: Detects gaps between docs and code

```typescript
import {
  getDocumentReaderAgent,
  getCodebaseAnalyzerAgent,
} from 'ad-sdlc';

// Read existing documentation
const docReader = getDocumentReaderAgent();
await docReader.startSession('my-project');
const docResult = await docReader.readDocuments();

// Analyze codebase
const codeAnalyzer = getCodebaseAnalyzerAgent();
await codeAnalyzer.startSession('my-project', './');
const codeResult = await codeAnalyzer.analyze();

// Now both results can be used by downstream agents
```

## Best Practices

1. **Exclude build directories**: Always exclude `node_modules`, `dist`, `build`, etc.
2. **Set appropriate limits**: Use `maxFiles` and `maxFileSize` for large projects
3. **Check session status**: Verify session status before and after analysis
4. **Handle circular dependencies**: Check for and handle circular dependencies
5. **Use appropriate sample ratio**: Adjust `conventionSampleRatio` based on project size

## Related Documentation

- [Document Reader Agent](./document-reader.md)
- [System Architecture](./system-architecture.md)
- [Enhancement Pipeline](./guides/enhancement-pipeline.md)
