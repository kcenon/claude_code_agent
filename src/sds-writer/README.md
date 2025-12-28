# SDS Writer Agent

The SDS Writer Agent generates Software Design Specification (SDS) documents from Software Requirements Specification (SRS) documents.

## Overview

This module is part of the AD-SDLC pipeline and transforms SRS documents into detailed technical design specifications, including:

- **Component Design** - Software components with interfaces and dependencies
- **API Specification** - REST API endpoints from use cases
- **Data Models** - Database entities and relationships
- **Security Design** - Authentication, authorization, and data protection
- **Deployment Architecture** - Environment and scaling specifications
- **Traceability Matrix** - SRS to SDS mapping for requirement coverage

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SDSWriterAgent                              │
│  (Main orchestrator - coordinates all sub-components)          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   SRSParser   │    │ComponentDesigner│    │ APISpecifier  │
│               │    │               │    │               │
│ Parses SRS    │    │ Designs       │    │ Generates     │
│ markdown      │    │ components    │    │ API specs     │
└───────────────┘    └───────────────┘    └───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  DataDesigner │    │Traceability   │    │   Output      │
│               │    │   Mapper      │    │  Generator    │
│ Designs data  │    │               │    │               │
│ models        │    │ Builds matrix │    │ Writes files  │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Usage

### Basic Usage

```typescript
import { SDSWriterAgent, getSDSWriterAgent } from './sds-writer';

// Using singleton
const agent = getSDSWriterAgent();
const result = await agent.generateFromProject('my-project');

console.log(`Generated SDS: ${result.publicPath}`);
console.log(`Components: ${result.stats.componentsGenerated}`);
console.log(`Coverage: ${result.stats.traceabilityCoverage}%`);
```

### Custom Configuration

```typescript
import { SDSWriterAgent } from './sds-writer';

const agent = new SDSWriterAgent({
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  publicDocsPath: 'docs/sds',
  generateAPIs: true,
  generateDataModels: true,
  generateSecuritySpecs: true,
  failOnLowCoverage: true,
  coverageThreshold: 90,
  includeTraceability: true,
});

const result = await agent.generateFromProject('my-project');
```

### Using Individual Components

```typescript
import { SRSParser, ComponentDesigner, APISpecifier } from './sds-writer';

// Parse SRS
const parser = new SRSParser();
const srs = parser.parse(srsContent);

// Design components
const designer = new ComponentDesigner();
const { components } = designer.design(
  srs.features,
  srs.useCases,
  srs.nfrs,
  srs.constraints
);

// Generate API specs
const apiSpecifier = new APISpecifier({ basePath: '/api/v2' });
const { endpoints } = apiSpecifier.specify(components, srs.useCases, srs.nfrs);
```

## Input/Output

### Input

- **Location**: `.ad-sdlc/scratchpad/documents/{project_id}/srs.md`
- **Format**: Markdown following SRS structure

### Output

- **Scratchpad**: `.ad-sdlc/scratchpad/documents/{project_id}/sds.md`
- **Public**: `docs/sds/SDS-{project_id}.md`

## Generated SDS Structure

```markdown
# Software Design Specification: {Product Name}

## 1. Introduction
## 2. System Architecture
   - 2.1 Overview (Mermaid diagram)
   - 2.3 Technology Stack
## 3. Component Design
   - CMP-001: Component Name
     - Source Feature, Priority
     - Description
     - Interfaces (TypeScript)
     - Dependencies
     - Implementation Notes
## 4. Data Design
   - Data Models with properties and relationships
## 5. Interface Design
   - API Endpoints (REST)
## 6. Security Design
   - Authentication
   - Authorization (RBAC)
   - Data Protection
## 7. Deployment Architecture
   - Pattern, Environments, Scaling
## 8. Error Handling
## 9. Traceability Matrix
   - Component → SRS Feature → Use Cases → PRD Requirement
## 10. Appendix
```

## Component Details

### SRSParser

Parses SRS markdown documents and extracts:
- Document metadata
- Product information
- Features (SF-XXX)
- Use cases (UC-XXX)
- NFRs (NFR-XXX)
- Constraints (CON-XXX)
- Assumptions

### ComponentDesigner

Designs software components from SRS features:
- Generates component IDs (CMP-XXX)
- Creates TypeScript interfaces from acceptance criteria
- Maps use cases to methods
- Suggests technologies based on feature context
- Resolves inter-component dependencies

### APISpecifier

Generates REST API specifications from use cases:
- Determines HTTP method from action verbs
- Generates paths from component names
- Creates request/response schemas
- Determines security levels
- Generates standard error responses

### DataDesigner

Designs data models from components:
- Identifies entities needing data models
- Extracts properties from interfaces
- Creates relationships between models
- Generates database indexes

### TraceabilityMapper

Builds traceability matrices:
- Maps SRS features to SDS components
- Links use cases to components
- Traces to PRD requirements
- Calculates coverage percentages
- Identifies gaps

## Error Handling

| Error Class | Description |
|-------------|-------------|
| `SRSNotFoundError` | SRS document not found |
| `SRSParseError` | Failed to parse SRS section |
| `ComponentDesignError` | Failed to design component |
| `APISpecificationError` | Failed to specify API |
| `DataModelDesignError` | Failed to design data model |
| `LowCoverageError` | Coverage below threshold |
| `SessionStateError` | Invalid session state |
| `ValidationError` | SDS validation failed |
| `FileWriteError` | Failed to write output |

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scratchpadBasePath` | string | `.ad-sdlc/scratchpad` | Base path for inter-agent communication |
| `templatePath` | string | `.ad-sdlc/templates/sds-template.md` | SDS template path |
| `publicDocsPath` | string | `docs/sds` | Public output directory |
| `generateAPIs` | boolean | `true` | Generate API specifications |
| `generateDataModels` | boolean | `true` | Generate data models |
| `generateSecuritySpecs` | boolean | `true` | Generate security specs |
| `failOnLowCoverage` | boolean | `false` | Throw error if coverage below threshold |
| `coverageThreshold` | number | `80` | Minimum coverage percentage (0-100) |
| `includeTraceability` | boolean | `true` | Include traceability matrix |

## Testing

```bash
# Run tests
npm test -- tests/sds-writer

# Run with coverage
npm test -- tests/sds-writer --coverage
```

## Related Modules

- **srs-writer** - Generates SRS from PRD (input to this module)
- **issue-generator** - Generates issues from SDS (uses SDSParser)
- **architecture-generator** - Related architecture design logic

## Traceability

```
PRD-001 (FR-XXX)
    └── SRS-001 (SF-XXX, UC-XXX)
            └── SDS-001 (CMP-XXX, API-XXX, DM-XXX)
                    └── Issues (generated by issue-generator)
```

## Version History

- **1.0.0** - Initial implementation
  - SRSParser with full SRS structure parsing
  - ComponentDesigner with interface generation
  - APISpecifier with REST endpoint generation
  - DataDesigner with model and relationship design
  - TraceabilityMapper with coverage analysis
  - SDSWriterAgent orchestration
