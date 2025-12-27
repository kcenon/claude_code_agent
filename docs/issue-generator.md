# Issue Generator Module

The issue-generator module transforms Software Design Specification (SDS) documents into structured GitHub issues with effort estimation and dependency analysis.

## Overview

The module includes:

- **SDSParser** - Parses SDS markdown documents and extracts components
- **EffortEstimator** - Estimates implementation effort for each component
- **DependencyGraph** - Builds dependency graphs and calculates execution order
- **IssueTransformer** - Transforms SDS components into GitHub-ready issues
- **IssueGenerator** - Main orchestration class for the full workflow

## Installation

The issue-generator module is included in the main `ad-sdlc` package:

```typescript
import {
  IssueGenerator,
  SDSParser,
  EffortEstimator,
  DependencyGraph,
  IssueTransformer,
} from 'ad-sdlc';
```

## IssueGenerator

Main class that orchestrates the complete SDS-to-issue transformation workflow.

### Basic Usage

```typescript
import { IssueGenerator, getIssueGenerator } from 'ad-sdlc';

// Using singleton
const generator = getIssueGenerator();

// Or create new instance
const generator = new IssueGenerator({
  outputPath: '.ad-sdlc/scratchpad/issues',
  maxIssueSize: 'L',
  autoDecompose: true,
});

// Generate issues from SDS content
const result = generator.generate(sdsContent);

console.log(`Generated ${result.summary.totalIssues} issues`);
console.log(`Total estimated hours: ${result.summary.totalEstimatedHours}`);
```

### Generate from File

```typescript
// Generate issues from SDS file and save outputs
const result = await generator.generateFromFile(
  'docs/SDS-001.md',
  '001'  // Sprint ID
);

// Output files are created in:
// - {outputPath}/001/issue_list.json
// - {outputPath}/001/dependency_graph.json
// - {outputPath}/001/generation_summary.json
```

### Execution Order

```typescript
const result = generator.generate(sdsContent);

// Get recommended execution order (respects dependencies)
const order = generator.getExecutionOrder(result);
// ['ISS-001', 'ISS-002', 'ISS-003', ...]

// Get parallel groups for concurrent execution
const groups = generator.getParallelGroups(result);
// [
//   { phase: 1, issues: ['ISS-001', 'ISS-003'] },  // Can run in parallel
//   { phase: 2, issues: ['ISS-002'] },              // Depends on phase 1
// ]
```

### Configuration

```typescript
const generator = new IssueGenerator({
  outputPath: '.ad-sdlc/scratchpad/issues',  // Output directory
  maxIssueSize: 'L',                          // Max issue size before decomposition
  autoDecompose: true,                        // Automatically split large issues
  validateSDS: true,                          // Validate SDS before processing
});
```

## SDSParser

Parses SDS markdown documents and extracts structured component data.

### Basic Usage

```typescript
import { SDSParser } from 'ad-sdlc';

const parser = new SDSParser();
const sds = parser.parse(markdownContent);

console.log(`Document ID: ${sds.metadata.documentId}`);
console.log(`Components: ${sds.components.length}`);
console.log(`Tech Stack: ${sds.technologyStack.length} entries`);
```

### Parsed Structure

```typescript
interface ParsedSDS {
  metadata: {
    documentId: string;      // e.g., 'SDS-001'
    sourceSRS: string;       // e.g., 'SRS-001'
    sourcePRD: string;       // e.g., 'PRD-001'
    version: string;
    status: string;
  };
  components: SDSComponent[];
  technologyStack: TechnologyEntry[];
  traceabilityMatrix: TraceabilityEntry[];
}
```

### Component Structure

```typescript
interface SDSComponent {
  id: string;              // e.g., 'CMP-001'
  name: string;            // e.g., 'Authentication Service'
  responsibility: string;
  sourceFeature: string;   // e.g., 'SF-001'
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  interfaces: SDSInterface[];
  dependencies: string[];  // e.g., ['CMP-002', 'CMP-003']
  implementationNotes: string;
}
```

### Validation

```typescript
const parser = new SDSParser();
const sds = parser.parse(content);

// Validate parsed SDS
const errors = parser.validate(sds);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
}

// Strict mode (throws on errors)
const strictParser = new SDSParser({ strict: true });
strictParser.validate(sds);  // Throws SDSParseError if invalid
```

## EffortEstimator

Estimates implementation effort for SDS components.

### Basic Usage

```typescript
import { EffortEstimator } from 'ad-sdlc';

const estimator = new EffortEstimator();

// Estimate single component
const estimate = estimator.estimate(component);
console.log(`Size: ${estimate.size}`);   // XS, S, M, L, or XL
console.log(`Hours: ${estimate.hours}`);  // Estimated hours
console.log(`Factors:`, estimate.factors);
```

### Effort Sizes

| Size | Hours | Description |
|------|-------|-------------|
| XS | ~2 | Simple tasks, minor changes |
| S | 2-4 | Small features, single-file changes |
| M | 4-8 | Medium features, few files |
| L | 8-16 | Large features, multiple files |
| XL | 16+ | Complex features, requires decomposition |

### Estimation Factors

```typescript
interface EstimationFactors {
  interfaceCount: number;   // Number of interfaces
  dependencyCount: number;  // Number of dependencies
  methodCount: number;      // Total methods in interfaces
  complexity: number;       // Overall complexity score
}
```

### Decomposition

```typescript
// Check if component should be split
if (estimator.shouldDecompose(component, 'M')) {
  const suggestions = estimator.suggestDecomposition(component);
  console.log('Decomposition suggestions:', suggestions);
}
```

### Custom Thresholds

```typescript
const estimator = new EffortEstimator({
  thresholds: {
    xs: 3,   // Complexity score <= 3 is XS
    s: 6,    // <= 6 is S
    m: 10,   // <= 10 is M
    l: 15,   // <= 15 is L
    // > 15 is XL
  },
  weights: {
    complexity: 0.4,    // 40% weight on complexity
    interfaces: 0.2,    // 20% on interface count
    dependencies: 0.2,  // 20% on dependencies
    methods: 0.2,       // 20% on method count
  },
});
```

## DependencyGraph

Builds and analyzes dependency graphs for issues.

### Basic Usage

```typescript
import { DependencyGraphBuilder } from 'ad-sdlc';

const builder = new DependencyGraphBuilder();

// Build from issues
const graph = builder.build(issues);

console.log(`Nodes: ${graph.nodes.length}`);
console.log(`Has cycles: ${graph.hasCycles}`);
console.log(`Execution order: ${graph.executionOrder.join(' → ')}`);
```

### Parallel Groups

```typescript
// Get issues that can be worked on in parallel
const groups = graph.parallelGroups;

for (const group of groups) {
  console.log(`Phase ${group.phase}:`);
  console.log(`  Issues: ${group.issues.join(', ')}`);
  console.log(`  Est. hours: ${group.estimatedHours}`);
}
```

### Graph Statistics

```typescript
const stats = builder.getStatistics(graph);

console.log(`Total nodes: ${stats.totalNodes}`);
console.log(`Root nodes: ${stats.rootNodes}`);
console.log(`Leaf nodes: ${stats.leafNodes}`);
console.log(`Max depth: ${stats.maxDepth}`);
console.log(`Avg dependencies: ${stats.averageDependencies}`);
```

### Critical Path

```typescript
const criticalPath = builder.getCriticalPath(graph);
console.log('Critical path:', criticalPath.join(' → '));
console.log(`Total hours: ${builder.getCriticalPathDuration(graph)}`);
```

## IssueTransformer

Transforms SDS components into GitHub-ready issue structures.

### Basic Usage

```typescript
import { IssueTransformer } from 'ad-sdlc';

const transformer = new IssueTransformer({
  maxIssueSize: 'L',
  autoDecompose: true,
});

// Transform all components
const issues = transformer.transform(components, estimations, traceability);

for (const issue of issues) {
  console.log(`${issue.id}: ${issue.title}`);
  console.log(`  Priority: ${issue.priority}`);
  console.log(`  Size: ${issue.estimation.size}`);
  console.log(`  Labels: ${issue.labels.join(', ')}`);
}
```

### Issue Structure

```typescript
interface GeneratedIssue {
  id: string;              // e.g., 'ISS-001'
  title: string;           // e.g., '[CMP-001] Implement Authentication Service'
  body: string;            // Markdown body with details
  priority: Priority;
  estimation: {
    size: EffortSize;
    hours: number;
    factors: EstimationFactors;
  };
  labels: string[];        // e.g., ['enhancement', 'priority-p0', 'size-s']
  dependencies: {
    blockedBy: string[];   // Issue IDs this depends on
    blocks: string[];      // Issue IDs that depend on this
  };
  traceability: {
    sdsComponent: string;
    srsFeature: string;
    prdRequirement: string;
    useCases: string[];
  };
}
```

## Error Classes

All module errors extend `IssueGeneratorError`:

```typescript
import {
  IssueGeneratorError,
  SDSParseError,
  SDSNotFoundError,
  SDSValidationError,
  EstimationError,
  DependencyError,
} from 'ad-sdlc';

try {
  const result = generator.generate(content);
} catch (error) {
  if (error instanceof SDSValidationError) {
    console.log('Validation errors:', error.errors);
  } else if (error instanceof SDSParseError) {
    console.log(`Parse error at line ${error.lineNumber}`);
  }
}
```

## Integration with Agents

The issue-generator module is designed to be used by the Issue Generator agent:

```
SDS Document → SDSParser → Components → EffortEstimator → Sized Components
                                ↓
                        IssueTransformer → Issues → DependencyGraph → Ordered Issues
                                                         ↓
                                                 Scratchpad Storage
```

### Agent Workflow

```typescript
// In issue-generator agent
import { getIssueGenerator } from 'ad-sdlc';

// Read SDS from scratchpad
const sdsPath = '.ad-sdlc/scratchpad/documents/SDS-001.md';
const generator = getIssueGenerator();

// Generate issues
const result = await generator.generateFromFile(sdsPath, 'sprint-1');

// Issues are saved to scratchpad for Controller agent
// .ad-sdlc/scratchpad/issues/sprint-1/issue_list.json
// .ad-sdlc/scratchpad/issues/sprint-1/dependency_graph.json
```

## Best Practices

1. **Validate SDS First** - Always validate SDS documents before generating issues
2. **Set Appropriate Max Size** - Choose `maxIssueSize` based on team velocity
3. **Review Decomposition** - Review auto-decomposed issues for logical splits
4. **Use Parallel Groups** - Schedule work based on parallel groups for efficiency
5. **Track Traceability** - Use traceability data for change impact analysis
