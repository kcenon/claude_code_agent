# SRS Writer Agent Documentation

## Overview

The SRS Writer Agent is responsible for generating Software Requirements Specifications (SRS) from Product Requirements Documents (PRD). It is a key component of the AD-SDLC document pipeline.

## Pipeline Position

```
Collector → PRD Writer → SRS Writer → SDS Writer → Issue Generator
                              ↑
                         You are here
```

## Purpose

The SRS Writer Agent:
1. Reads and parses PRD documents
2. Decomposes high-level requirements into detailed features
3. Generates use cases with complete flows
4. Creates traceability matrices for requirement coverage
5. Outputs structured SRS documents

## Input

- **Location**: `.ad-sdlc/scratchpad/documents/{project_id}/prd.md`
- **Format**: Markdown document following PRD template
- **Requirements**: Functional requirements with FR-XXX identifiers

## Output

- **Scratchpad**: `.ad-sdlc/scratchpad/documents/{project_id}/srs.md`
- **Public**: `docs/srs/SRS-{project_id}.md`
- **Format**: Markdown document following SRS template

## ID Conventions

| Type | Pattern | Example |
|------|---------|---------|
| SRS Document | SRS-{project_id} | SRS-001 |
| Feature | SF-XXX | SF-001, SF-002 |
| Use Case | UC-XXX | UC-001, UC-002 |
| NFR | NFR-XXX | NFR-001 |
| Constraint | CON-XXX | CON-001 |

## Traceability

The agent creates bidirectional traceability:

```
PRD Requirements (FR-XXX)
    ↓
SRS Features (SF-XXX)
    ↓
Use Cases (UC-XXX)
```

### Coverage Metrics

- **Forward Coverage**: Percentage of PRD requirements traced to SRS features
- **Orphan Features**: Features not traced to any requirement
- **Uncovered Requirements**: Requirements without corresponding features

## CLI Integration

```bash
# Generate SRS for a project
ad-sdlc generate-srs --project 001

# Generate with custom options
ad-sdlc generate-srs --project 001 --coverage-threshold 90
```

## API Reference

### SRSWriterAgent

Main orchestrator class for SRS generation.

#### Methods

| Method | Description |
|--------|-------------|
| `startSession(projectId)` | Start new generation session |
| `decompose()` | Decompose requirements into features |
| `buildTraceability()` | Build traceability matrix |
| `generate()` | Generate SRS content |
| `finalize()` | Save to files |
| `generateFromProject(projectId)` | Complete generation in one call |
| `reset()` | Clear current session |

### PRDParser

Parses PRD markdown documents.

#### Extracted Elements

- Document metadata (ID, version, status)
- Functional requirements with priorities
- Non-functional requirements
- Constraints and assumptions
- User personas
- Goals and metrics

### FeatureDecomposer

Decomposes requirements into features.

#### Features

- Atomic specification generation
- Use case creation with flows
- Complexity analysis
- Sub-feature generation for complex requirements

### TraceabilityBuilder

Creates and validates traceability.

#### Capabilities

- Requirement-to-feature mapping
- Coverage calculation
- Orphan detection
- Markdown generation

## Quality Criteria

The SRS Writer Agent ensures:

1. **Complete Coverage**: Every PRD requirement maps to at least one SRS feature
2. **Use Case Quality**: Each feature has at least one use case with complete flows
3. **Traceability**: All features trace back to PRD requirements
4. **Consistency**: IDs follow sequential patterns

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| PRDNotFoundError | PRD document missing | Ensure PRD exists at expected path |
| PRDParseError | Invalid PRD format | Fix PRD structure |
| LowCoverageError | Coverage below threshold | Map unmapped requirements |
| SessionStateError | Invalid operation sequence | Follow session workflow |

## Configuration

```yaml
# .ad-sdlc/config/srs-writer.yaml
srs_writer:
  scratchpad_base_path: ".ad-sdlc/scratchpad"
  public_docs_path: "docs/srs"
  coverage_threshold: 80
  fail_on_low_coverage: false
  include_traceability: true
  min_use_cases_per_feature: 1
```

## Related Documentation

- [PRD Writer Agent](prd-writer.md)
- [Architecture Generator](architecture-generator.md)
- [Issue Generator](issue-generator.md)
- [Analysis Pipeline](analysis-pipeline.md)
