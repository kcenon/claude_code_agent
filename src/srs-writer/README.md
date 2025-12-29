# SRS Writer Agent

The SRS Writer Agent generates Software Requirements Specifications (SRS) from Product Requirements Documents (PRD). It decomposes PRD requirements into detailed features, generates use cases, and creates traceability matrices.

## Overview

The SRS Writer Agent is part of the AD-SDLC document pipeline, transforming high-level PRD requirements into detailed, implementable specifications.

```
PRD → SRS Writer Agent → SRS Document
```

## Features

- **PRD Parsing**: Extracts requirements, NFRs, constraints, and personas from PRD documents
- **Feature Decomposition**: Breaks down PRD requirements into SRS features (SF-XXX)
- **Use Case Generation**: Creates detailed use cases (UC-XXX) with flows and conditions
- **Traceability Matrix**: Maps PRD requirements to SRS features and use cases
- **Template Support**: Generates markdown documents following SRS template structure

## Installation

The module is part of the AD-SDLC package:

```bash
npm install ad-sdlc
```

## Usage

### Basic Usage

```typescript
import { getSRSWriterAgent } from './srs-writer';

// Get the singleton agent instance
const agent = getSRSWriterAgent();

// Generate SRS from a project
const result = await agent.generateFromProject('my-project');
console.log(`SRS generated at: ${result.publicPath}`);
```

### Step-by-Step Generation

```typescript
import { SRSWriterAgent } from './srs-writer';

const agent = new SRSWriterAgent({
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/srs',
});

// Start session with project ID
await agent.startSession('001');

// Decompose requirements into features
const decomposition = agent.decompose();
console.log(`Generated ${decomposition.features.length} features`);

// Build traceability matrix
const traceability = agent.buildTraceability();
console.log(`Coverage: ${traceability.forwardCoverage}%`);

// Generate and save SRS
const result = await agent.finalize();
console.log(`SRS saved to: ${result.publicPath}`);
```

### Direct PRD Content Processing

```typescript
const prdContent = fs.readFileSync('docs/prd/PRD-001.md', 'utf8');
const result = await agent.generateFromPRDContent(prdContent, '001');
```

## Configuration

```typescript
interface SRSWriterAgentConfig {
  // Base path for scratchpad storage
  scratchpadBasePath?: string;       // Default: '.ad-sdlc/scratchpad'

  // Path to SRS template
  templatePath?: string;             // Default: '.ad-sdlc/templates/srs-template.md'

  // Output directory for public SRS documents
  publicDocsPath?: string;           // Default: 'docs/srs'

  // Minimum use cases per feature
  minUseCasesPerFeature?: number;    // Default: 1

  // Fail if coverage below threshold
  failOnLowCoverage?: boolean;       // Default: false

  // Minimum coverage threshold (0-100)
  coverageThreshold?: number;        // Default: 80

  // Include traceability matrix in output
  includeTraceability?: boolean;     // Default: true
}
```

## Output Format

### Generated SRS Structure

```markdown
# SRS: [Product Name]

| Field | Value |
|-------|-------|
| Document ID | SRS-XXX |
| Source PRD | PRD-XXX |
| Version | 1.0.0 |

## 1. Introduction
## 2. System Features
### SF-001: [Feature Name]
#### Use Cases
##### UC-001: [Use Case Name]
- Actor
- Preconditions
- Main Flow
- Postconditions

## 3. Non-Functional Requirements
## 4. Constraints
## 5. Assumptions
## 6. Traceability Matrix
```

### Traceability Matrix

| PRD Requirement | SRS Features | Use Cases | NFRs |
|-----------------|--------------|-----------|------|
| FR-001 | SF-001, SF-002 | UC-001, UC-002 | NFR-001 |

## Components

### PRDParser

Parses PRD markdown documents into structured data:
- Extracts metadata (document ID, version, status)
- Parses functional requirements (FR-XXX)
- Parses non-functional requirements (NFR-XXX)
- Extracts constraints and assumptions
- Parses user personas and goals

### FeatureDecomposer

Decomposes PRD requirements into SRS features:
- Creates atomic, testable specifications
- Generates use cases with complete flows
- Handles complex requirements by splitting into sub-features
- Preserves requirement priorities
- Optionally uses advanced UseCaseGenerator for detailed use case creation

### UseCaseGenerator

Generates detailed use cases with structured flows:

```typescript
import { UseCaseGenerator } from './srs-writer';

const generator = new UseCaseGenerator({
  minUseCasesPerFeature: 1,
  maxUseCasesPerFeature: 5,
  generateExceptionFlows: true,
  includeSecondaryActors: true,
});

const result = generator.generateForFeature({
  feature: srsFeature,
  requirement: prdRequirement,
  actors: ['User', 'Administrator', 'System'],
});

// Access detailed use cases
console.log(result.useCases);  // DetailedUseCase[]
console.log(result.coverage);  // Coverage metrics

// Convert to basic format for backward compatibility
const basicUseCases = generator.toBasicUseCases(result.useCases);
```

#### Use Case Structure

```typescript
interface DetailedUseCase {
  id: string;              // UC-XXX
  title: string;
  description: string;
  actor: string;           // Primary actor
  secondaryActors: string[];
  preconditions: string[];
  mainFlow: FlowStep[];    // Structured flow steps
  alternativeFlows: AlternativeFlow[];
  exceptionFlows: ExceptionFlow[];
  postconditions: string[];
  sourceFeatureId: string;
  sourceRequirementId: string;
}

interface FlowStep {
  stepNumber: number;
  description: string;
  systemResponse?: string;
}

interface AlternativeFlow {
  label: string;      // e.g., "2a"
  condition: string;
  steps: FlowStep[];
}

interface ExceptionFlow {
  label: string;      // e.g., "E1"
  exception: string;
  handling: string;
}
```

#### Enabling Advanced Use Case Generation

To use the advanced UseCaseGenerator in FeatureDecomposer:

```typescript
const decomposer = new FeatureDecomposer({
  useAdvancedUseCaseGeneration: true,
  useCaseGeneratorOptions: {
    generateExceptionFlows: true,
    includeSecondaryActors: true,
  },
});

const result = decomposer.decompose(parsedPRD);

// Access detailed use cases (only available with advanced generation)
const detailedUseCases = decomposer.getDetailedUseCases();
```

### TraceabilityBuilder

Creates and validates traceability matrices:
- Maps requirements to features and use cases
- Calculates coverage percentages
- Identifies orphan features and uncovered requirements
- Generates markdown representation

## Error Handling

The module provides specific error types:

```typescript
import {
  PRDNotFoundError,
  PRDParseError,
  FeatureDecompositionError,
  LowCoverageError,
  SessionStateError,
} from './srs-writer';

try {
  await agent.generateFromProject('001');
} catch (error) {
  if (error instanceof PRDNotFoundError) {
    console.error(`PRD not found: ${error.searchedPath}`);
  } else if (error instanceof LowCoverageError) {
    console.error(`Coverage ${error.actualCoverage}% below ${error.threshold}%`);
  }
}
```

## Testing

Run tests with:

```bash
npm run test -- tests/srs-writer
```

## Related Modules

- `prd-writer`: Generates PRD documents from collected information
- `architecture-generator`: Generates architecture from SRS
- `issue-generator`: Generates GitHub issues from SDS

## License

MIT
