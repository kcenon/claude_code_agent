# Architecture Generator

The Architecture Generator module analyzes SRS (Software Requirements Specification) documents and generates comprehensive system architecture designs including patterns, technology recommendations, diagrams, and directory structures.

## Overview

The Architecture Generator is part of the SDS Writer Agent pipeline. It transforms SRS requirements into actionable architecture specifications by:

1. **Parsing SRS documents** to extract features, use cases, and requirements
2. **Analyzing requirements** to determine appropriate architecture patterns
3. **Generating Mermaid diagrams** for visual representation
4. **Recommending technology stacks** based on NFRs and patterns
5. **Creating directory structures** based on selected patterns

## Quick Start

```typescript
import {
  ArchitectureGenerator,
  getArchitectureGenerator,
} from 'ad-sdlc';

// Create generator instance
const generator = new ArchitectureGenerator();

// Generate from SRS content
const srsContent = `# SRS: My Product
...
`;
const design = generator.generateFromContent(srsContent);

// Or generate from file
const design = generator.generateFromFile('./docs/srs/SRS-001.md');

// Convert to markdown
const markdown = generator.designToMarkdown(design);
```

## Architecture Patterns

The analyzer supports the following architecture patterns:

| Pattern | Description | Best For |
|---------|-------------|----------|
| `hierarchical-multi-agent` | Multi-agent systems with orchestrator and workers | AI/ML pipelines, complex automation |
| `pipeline` | Sequential stage processing | Data transformation, ETL |
| `event-driven` | Publish/subscribe with message broker | Loose coupling, real-time systems |
| `microservices` | Independent, deployable services | Scalable, distributed systems |
| `layered` | Presentation, business, data layers | Traditional applications |
| `hexagonal` | Ports and adapters | Testable, domain-focused apps |
| `cqrs` | Command Query Responsibility Segregation | Read-heavy systems |
| `scratchpad` | File-based state sharing | Agent systems, workflows |

## Components

### SRSParser

Extracts structured data from SRS markdown documents:

```typescript
import { SRSParser } from 'ad-sdlc';

const parser = new SRSParser({
  strict: false,
  extractUseCases: true,
  parseNFRs: true,
});

const srs = parser.parse(srsContent);
console.log(srs.features);  // System features
console.log(srs.nfrs);      // Non-functional requirements
console.log(srs.constraints); // Constraints
```

### ArchitectureAnalyzer

Analyzes SRS and recommends architecture patterns:

```typescript
import { ArchitectureAnalyzer } from 'ad-sdlc';

const analyzer = new ArchitectureAnalyzer('layered');
const analysis = analyzer.analyze(srs);

console.log(analysis.primaryPattern);      // Recommended pattern
console.log(analysis.supportingPatterns);  // Compatible patterns
console.log(analysis.recommendations);     // Scored recommendations
console.log(analysis.concerns);            // Architectural concerns
```

### DiagramGenerator

Generates Mermaid diagrams:

```typescript
import { DiagramGenerator } from 'ad-sdlc';

const generator = new DiagramGenerator(true); // Generate all diagram types
const diagrams = generator.generate(srs, analysis);

for (const diagram of diagrams) {
  console.log(`${diagram.type}: ${diagram.title}`);
  console.log(diagram.code); // Mermaid code
}
```

Generated diagram types:
- `architecture-overview`: High-level system architecture
- `component-interaction`: Component communication flows
- `deployment`: Deployment architecture
- `data-flow`: Data flow through the system

### TechnologyStackGenerator

Recommends technology stack:

```typescript
import { TechnologyStackGenerator } from 'ad-sdlc';

const generator = new TechnologyStackGenerator(true); // Include alternatives
const stack = generator.generate(srs, analysis);

for (const layer of stack.layers) {
  console.log(`${layer.layer}: ${layer.technology} ${layer.version}`);
  console.log(`  Rationale: ${layer.rationale}`);
}
```

Technology layers:
- `runtime`: Node.js, Python, Go, Rust
- `framework`: Express, FastAPI, NestJS, etc.
- `database`: PostgreSQL, MongoDB, SQLite
- `caching`: Redis, Memcached
- `messaging`: RabbitMQ, Kafka
- `monitoring`: Prometheus, OpenTelemetry
- `testing`: Vitest, Jest, pytest
- `build`: TypeScript, Docker

### DirectoryStructureGenerator

Generates directory structure:

```typescript
import { DirectoryStructureGenerator } from 'ad-sdlc';

const generator = new DirectoryStructureGenerator();
const structure = generator.generate(srs, analysis, stack);

// Get ASCII tree representation
const tree = DirectoryStructureGenerator.toAsciiTree(structure);
console.log(tree);
```

## Output Format

The complete architecture design includes:

```typescript
interface ArchitectureDesign {
  analysis: ArchitectureAnalysis;
  technologyStack: TechnologyStack;
  diagrams: MermaidDiagram[];
  directoryStructure: DirectoryStructure;
  metadata: ArchitectureMetadata;
}
```

### Markdown Export

Use `designToMarkdown()` to export:

```typescript
const markdown = generator.designToMarkdown(design);
fs.writeFileSync('architecture.md', markdown);
```

The markdown includes:
1. Architecture Overview
2. Pattern Analysis with scores
3. Technology Stack table
4. Component Interaction diagrams
5. Directory Structure (ASCII tree)
6. Architectural Concerns

## Configuration

```typescript
interface ArchitectureGeneratorConfig {
  scratchpadDir?: string;  // Default: '.ad-sdlc/scratchpad/documents'
  outputDir?: string;      // Default: 'docs/sds'
  defaultOptions?: ArchitectureGeneratorOptions;
}

interface ArchitectureGeneratorOptions {
  defaultPattern?: ArchitecturePattern;
  includeAlternatives?: boolean;
  generateAllDiagrams?: boolean;
  directoryTemplate?: string;
  verbose?: boolean;
}
```

## Error Handling

The module provides specific error types:

```typescript
import {
  ArchitectureGeneratorError,
  SRSParseError,
  SRSNotFoundError,
  SRSValidationError,
  PatternDetectionError,
  DiagramGenerationError,
  TechnologyStackError,
  DirectoryStructureError,
} from 'ad-sdlc';

try {
  const design = generator.generateFromFile('./srs.md');
} catch (error) {
  if (error instanceof SRSNotFoundError) {
    console.error(`SRS file not found: ${error.path}`);
  } else if (error instanceof PatternDetectionError) {
    console.error(`Pattern detection failed: ${error.failedRequirements}`);
  }
}
```

## Integration with SDS Writer Agent

The Architecture Generator is designed to work with the SDS Writer Agent:

```typescript
// In SDS Writer Agent workflow
import { ArchitectureGenerator, Scratchpad } from 'ad-sdlc';

const scratchpad = getScratchpad();
const generator = getArchitectureGenerator();

// Read SRS from scratchpad
const srsPath = scratchpad.getDocumentPath(projectId, 'srs');
const design = generator.generateFromFile(srsPath);

// Save architecture design
const outputPath = generator.saveDesign(design, projectId);
```

## Best Practices

1. **SRS Quality**: Ensure SRS includes clear features, NFRs, and constraints
2. **Review Recommendations**: Pattern scores are suggestions; review rationale
3. **Technology Alternatives**: Consider alternatives for your specific context
4. **Diagram Updates**: Regenerate diagrams when requirements change
5. **Incremental Refinement**: Use as starting point, refine based on context

## Related Documentation

- [SDS Writer Agent](./agents/sds-writer.md)
- [Issue Generator](./issue-generator.md)
- [System Architecture](./system-architecture.md)
