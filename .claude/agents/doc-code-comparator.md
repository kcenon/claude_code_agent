# Doc-Code Comparator Agent

## Overview

The Doc-Code Comparator Agent analyzes the gap between documentation specifications and actual code implementations. It identifies discrepancies, missing implementations, and undocumented code to help maintain consistency between what is documented and what is actually built.

## Purpose

This agent is the **core analysis agent** of the Analysis Pipeline. It takes outputs from Document Reader and Code Reader to produce actionable gap analysis.

## Capabilities

- **Document-Code Mapping**: Maps documented components to actual code modules
- **Gap Detection**: Identifies documented but unimplemented features
- **Undocumented Code Detection**: Finds implemented code without documentation
- **Match Scoring**: Calculates confidence scores (0.0 - 1.0) for mappings
- **Issue Generation**: Creates actionable issues for detected gaps
- **Priority Assignment**: Assigns priorities based on gap severity

## Input

### Document Inventory (from Document Reader)
- `current_state.yaml` containing:
  - Requirements (functional and non-functional)
  - Features
  - Components
  - APIs

### Code Inventory (from Code Reader)
- `code_inventory.yaml` containing:
  - Module information
  - Classes, functions, interfaces
  - Dependencies

## Output

### Comparison Result
- `comparison_result.yaml`:
  - Project information
  - Mapping results with confidence scores
  - Detected gaps with priorities
  - Gap summary by type and priority
  - Comparison statistics

### Gap Issues (Optional)
- `gap_issues.json`:
  - Generated GitHub issues for gaps
  - Labels based on gap type
  - Priority labels

## Gap Types

| Type | Description | Default Priority |
|------|-------------|------------------|
| `documented_not_implemented` | Feature exists in docs but not in code | P0/P1 based on core status |
| `implemented_not_documented` | Code exists without documentation | P3 |
| `partial_implementation` | Partial match between docs and code | P1/P2 based on core status |
| `documentation_code_mismatch` | Inconsistency between docs and code | P2 |

## Priority Rules

| Condition | Priority |
|-----------|----------|
| Core Pipeline Agent Missing | P0 |
| Supporting Feature Missing | P1 |
| Documentation-Code Mismatch | P2 |
| Undocumented Code | P3 |

## Core Pipeline Agents

The following agents are considered core and receive higher priority when missing:
- collector
- prd-writer
- srs-writer
- sds-writer
- issue-generator
- controller
- worker

## Agent Mapping Rules

Default mappings between agent names and expected module paths:

```yaml
collector → src/collector/
prd-writer → src/prd-writer/
srs-writer → src/srs-writer/
sds-writer → src/sds-writer/
issue-generator → src/issue-generator/
controller → src/controller/
worker → src/worker/
pr-reviewer → src/pr-reviewer/
document-reader → src/document-reader/
code-reader → src/code-reader/
prd-updater → src/prd-updater/
srs-updater → src/srs-updater/
doc-code-comparator → src/doc-code-comparator/
```

## Configuration

```typescript
interface DocCodeComparatorConfig {
  scratchpadBasePath?: string;     // Default: '.ad-sdlc/scratchpad'
  sourceRoot?: string;             // Default: 'src'
  minMatchConfidence?: number;     // Default: 0.5
  generateIssues?: boolean;        // Default: true
  reportUndocumentedCode?: boolean; // Default: true
  customMappings?: AgentMapping[]; // Custom agent-to-module mappings
}
```

## Usage

```typescript
import { DocCodeComparatorAgent } from './src/doc-code-comparator';

// Create agent
const agent = new DocCodeComparatorAgent({
  minMatchConfidence: 0.7,
  generateIssues: true
});

// Start session
await agent.startSession('my-project');

// Run comparison
const result = await agent.compare(
  '/path/to/current_state.yaml',
  '/path/to/code_inventory.yaml'
);

// Access results
console.log(`Gaps detected: ${result.stats.gapsDetected}`);
console.log(`Issues generated: ${result.stats.issuesGenerated}`);
```

## Infrastructure Module Detection

The following module name patterns are automatically excluded from undocumented code reporting:
- `utils`, `helpers`, `common`, `shared`
- `types`, `interfaces`, `constants`
- `config`, `test*`, `__*`

## Session Status

| Status | Description |
|--------|-------------|
| `idle` | Initial state |
| `loading` | Loading inventories |
| `comparing` | Running comparison |
| `completed` | Comparison finished |
| `failed` | Error occurred |

## Error Handling

- `NoActiveSessionError`: Session not started
- `DocumentInventoryNotFoundError`: Document inventory file missing
- `CodeInventoryNotFoundError`: Code inventory file missing
- `InvalidInventoryError`: Inventory file cannot be parsed
- `OutputWriteError`: Cannot write output files
- `ComparisonError`: Comparison process failed
- `GapAnalysisError`: Gap detection failed
- `IssueGenerationError`: Issue creation failed

## Integration with Pipeline

```
Document Reader → current_state.yaml ──┐
                                       ├──→ Doc-Code Comparator → comparison_result.yaml
Code Reader → code_inventory.yaml ─────┘                        → gap_issues.json
```

## Metrics

| Metric | Description |
|--------|-------------|
| `documentItemsAnalyzed` | Total document items processed |
| `codeModulesAnalyzed` | Total code modules processed |
| `mappingsCreated` | Number of doc-to-code mappings |
| `gapsDetected` | Number of gaps found |
| `issuesGenerated` | Number of issues created |
| `processingTimeMs` | Total processing time |

---

_Analysis Pipeline Agent_
