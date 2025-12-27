# Component Generator

The Component Generator module transforms SRS (Software Requirements Specification) documents into detailed component definitions with interface specifications, API endpoint designs, and traceability mapping.

## Overview

The Component Generator is part of the SDS Writer Agent pipeline. It maps SRS features to components by:

1. **Mapping features to components** (SF-XXX -> CMP-XXX)
2. **Generating interface specifications** from use cases
3. **Designing API endpoints** with request/response schemas
4. **Creating traceability matrix** for feature-to-component mapping
5. **Analyzing component dependencies**

## Quick Start

```typescript
import {
  ComponentGenerator,
  getComponentGenerator,
} from 'ad-sdlc';

// Using parsed SRS from ArchitectureGenerator
import { SRSParser } from 'ad-sdlc';

const parser = new SRSParser();
const srs = parser.parse(srsContent);

// Create component generator
const generator = new ComponentGenerator();
const design = generator.generate(srs);

// Access generated components
console.log(design.components);          // Component definitions
console.log(design.apiSpecification);    // API endpoints
console.log(design.traceabilityMatrix);  // SF -> CMP mapping
console.log(design.dependencies);        // Component dependencies
```

## Component Layers

Components are classified into layers based on their responsibilities:

| Layer | Description | Example |
|-------|-------------|---------|
| `presentation` | User interface and external API endpoints | `DashboardController` |
| `application` | Business workflows and use case execution | `OrderProcessingService` |
| `domain` | Core business logic and domain models | `PaymentValidator` |
| `infrastructure` | Persistence, messaging, caching | `DatabaseRepository` |
| `integration` | External system communication | `PaymentGatewayClient` |

## Components

### ComponentGenerator

Main orchestrator for component design generation:

```typescript
import { ComponentGenerator } from 'ad-sdlc';

const generator = new ComponentGenerator({
  outputDir: 'docs/sds',
  defaultOptions: {
    defaultLayer: 'application',
    generateAPISpecs: true,
    includeNotes: true,
    verbose: false,
  },
});

const design = generator.generate(srs, {
  verbose: true,
});

// Save to markdown file
const outputPath = generator.saveDesign(design, 'PROJECT-001');

// Or get markdown content directly
const markdown = generator.designToMarkdown(design);
```

### InterfaceGenerator

Generates interface specifications from use cases:

```typescript
import { InterfaceGenerator } from 'ad-sdlc';

const generator = new InterfaceGenerator();
const interfaces = generator.generateInterfaces(useCases);

for (const iface of interfaces) {
  console.log(iface.interfaceId);    // API-001
  console.log(iface.type);           // API, Event, File
  console.log(iface.sourceUseCase);  // UC-001
  console.log(iface.specification);  // APIEndpoint details
}
```

### APISpecificationGenerator

Generates API documentation and specifications:

```typescript
import { APISpecificationGenerator } from 'ad-sdlc';

const generator = new APISpecificationGenerator();

// Extract endpoints from components
const endpoints = generator.extractAPIEndpoints(components);

// Generate markdown table
const table = generator.generateSpecificationTable(endpoints);

// Generate detailed documentation
const docs = generator.generateDetailedDocumentation(endpoints, interfaces);

// Generate OpenAPI specification
const openapi = generator.generateOpenAPISpec(endpoints, 'My API', '1.0.0');

// Generate TypeScript interfaces
const typescript = generator.generateTypeScriptInterfaces(endpoints);
```

## Generated Structures

### ComponentDefinition

```typescript
interface ComponentDefinition {
  id: string;              // CMP-001
  name: string;            // UserManagementService
  responsibility: string;  // Component description
  sourceFeature: string;   // SF-001
  interfaces: InterfaceSpec[];
  dependencies: string[];  // Feature IDs
  implementationNotes: string;
  layer: ComponentLayer;
}
```

### APIEndpoint

```typescript
interface APIEndpoint {
  endpoint: string;        // /api/v1/users
  method: HttpMethod;      // POST, GET, PUT, DELETE
  description: string;
  request: RequestSpec;    // Headers, params, body
  response: ResponseSpec;  // Success and error responses
  authenticated: boolean;
  rateLimit?: RateLimitSpec;
}
```

### TraceabilityEntry

```typescript
interface TraceabilityEntry {
  featureId: string;       // SF-001
  featureName: string;
  componentId: string;     // CMP-001
  componentName: string;
  useCases: UseCaseMapping[];
  interfaces: string[];    // Interface IDs
}
```

## HTTP Method Detection

The generator automatically detects HTTP methods from use case names:

| Keywords | Detected Method |
|----------|-----------------|
| create, add, register, submit, upload | POST |
| get, view, list, fetch, retrieve, search | GET |
| update, edit | PUT |
| modify, patch | PATCH |
| delete, remove, cancel | DELETE |

## Resource Detection

Common resource names are automatically detected and pluralized:

| Keyword | Generated Path |
|---------|---------------|
| user | /api/v1/users |
| project | /api/v1/projects |
| document | /api/v1/documents |
| order | /api/v1/orders |
| task | /api/v1/tasks |

## Output Format

### Markdown Output

```markdown
# Component Design

| Field | Value |
|-------|-------|
| **Source SRS** | SRS-001 |
| **Generated** | 2024-01-15T10:30:00Z |
| **Version** | 1.0.0 |

## 1. Component Overview

| ID | Name | Layer | Source Feature |
|----|------|-------|----------------|
| CMP-001 | UserManagementService | application | SF-001 |

## 2. Component Definitions

### CMP-001: UserManagementService

**Layer**: application
**Source Feature**: SF-001
**Responsibility**: Handles user management operations...

## 3. API Specification

| Endpoint | Method | Description | Auth | Rate Limit |
|----------|--------|-------------|------|------------|
| `/api/v1/users` | POST | Create a new user | Yes | - |
```

## Singleton Pattern

```typescript
import { getComponentGenerator, resetComponentGenerator } from 'ad-sdlc';

// Get singleton instance
const generator = getComponentGenerator({
  outputDir: 'custom/path',
});

// Same instance returned
const sameGenerator = getComponentGenerator();

// Reset for testing
resetComponentGenerator();
```

## Error Handling

```typescript
import {
  ComponentGeneratorError,
  InvalidSRSError,
  ComponentGenerationError,
  InterfaceGenerationError,
  APISpecificationError,
} from 'ad-sdlc';

try {
  const design = generator.generate(srs);
} catch (error) {
  if (error instanceof InvalidSRSError) {
    console.error('Invalid SRS:', error.errors);
  } else if (error instanceof ComponentGenerationError) {
    console.error('Component failed:', error.componentId, error.phase);
  } else if (error instanceof InterfaceGenerationError) {
    console.error('Interface failed:', error.interfaceId, error.interfaceType);
  }
}
```

## Integration with Architecture Generator

```typescript
import { SRSParser, ArchitectureGenerator, ComponentGenerator } from 'ad-sdlc';

// Parse SRS
const parser = new SRSParser();
const srs = parser.parse(srsContent);

// Generate architecture
const archGen = new ArchitectureGenerator();
const archDesign = archGen.generateFromParsedSRS(srs);

// Generate components using same SRS
const compGen = new ComponentGenerator();
const compDesign = compGen.generate(srs);

// Both designs share the same source
console.log(archDesign.metadata.sourceSRS === compDesign.metadata.sourceSRS); // true
```

## Best Practices

1. **Use with SRSParser**: Always parse SRS documents using the SRSParser from the architecture-generator module for consistent data structures.

2. **Enable API specs**: Set `generateAPISpecs: true` to get complete API documentation.

3. **Review traceability**: Use the traceability matrix to verify all features have corresponding components.

4. **Check dependencies**: Review component dependencies to ensure proper layering and avoid circular dependencies.

5. **Generate TypeScript**: Use the TypeScript interface generator for type-safe API implementations.

## Schema Version

Current schema version: `1.0.0`

The schema version follows semantic versioning and is used to track compatibility between generated documents.
