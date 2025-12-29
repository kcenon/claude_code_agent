# Enhancement Mode Guide

## Overview

Enhancement Mode is a specialized pipeline mode designed for incrementally updating existing projects. Unlike the Greenfield mode that creates documents from scratch, Enhancement Mode analyzes existing documents and codebase to perform targeted updates while maintaining consistency and traceability.

## When to Use Enhancement Mode

Use Enhancement Mode when:

- Adding new features to an existing project
- Modifying or extending current functionality
- Fixing bugs that require documentation updates
- Refactoring code with corresponding document changes
- Upgrading or migrating existing systems

Use Greenfield Mode when:

- Starting a completely new project
- No existing PRD/SRS/SDS documents
- No existing codebase

## Mode Detection

The system automatically detects which mode to use based on:

1. **Document Presence** (35% weight): Existing PRD, SRS, or SDS documents
2. **Codebase Presence** (45% weight): Existing source code files
3. **User Keywords** (20% weight): Keywords in user request like "add feature", "improve", "modify"

### Manual Override

You can explicitly specify the mode:

```yaml
# In your project configuration or CLI
mode: enhancement  # or 'greenfield'
```

## Pipeline Stages

### Stage Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    ENHANCEMENT PIPELINE                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐     ┌─────────────────┐                 │
│  │ Document Reader │     │ Codebase        │   PARALLEL      │
│  │ (current_state) │     │ Analyzer        │                 │
│  └────────┬────────┘     └────────┬────────┘                 │
│           │                       │                           │
│           └───────────┬───────────┘                           │
│                       ▼                                       │
│           ┌─────────────────────┐                             │
│           │   Impact Analyzer   │   APPROVAL GATE             │
│           │  (risk assessment)  │                             │
│           └──────────┬──────────┘                             │
│                      ▼                                        │
│  ┌─────────────────────────────────────────┐                 │
│  │        Document Update (Sequential)     │                 │
│  │  PRD Updater → SRS Updater → SDS Updater│  APPROVAL GATES │
│  └──────────────────┬──────────────────────┘                 │
│                     ▼                                         │
│           ┌─────────────────────┐                             │
│           │   Issue Generator   │   APPROVAL GATE             │
│           └──────────┬──────────┘                             │
│                      ▼                                        │
│           ┌─────────────────────┐                             │
│           │     Controller      │                             │
│           └──────────┬──────────┘                             │
│                      ▼                                        │
│  ┌─────────────────┐     ┌─────────────────┐                 │
│  │     Worker      │     │ Regression      │   PARALLEL      │
│  │ (implementation)│     │ Tester          │                 │
│  └────────┬────────┘     └────────┬────────┘                 │
│           │                       │                           │
│           └───────────┬───────────┘                           │
│                       ▼                                       │
│           ┌─────────────────────┐                             │
│           │    PR Reviewer      │                             │
│           │ (with regression    │                             │
│           │      report)        │                             │
│           └─────────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

### Stage Details

#### 1. Analysis Parallel Stage

Two agents run in parallel to analyze the existing project:

**Document Reader Agent**
- Parses existing PRD/SRS/SDS documents
- Extracts requirements (FR-XXX, NFR-XXX)
- Extracts features (SF-XXX) and components (CMP-XXX)
- Builds traceability mappings
- Outputs: `current_state.yaml`

**Codebase Analyzer Agent**
- Analyzes directory structure
- Detects architecture patterns
- Generates dependency graph
- Identifies coding conventions
- Outputs: `architecture_overview.yaml`, `dependency_graph.json`

#### 2. Impact Analysis Stage

The Impact Analyzer assesses proposed changes:

- Analyzes change request against current state
- Identifies affected components (direct and indirect)
- Evaluates risk levels
- Predicts potential regression areas
- Outputs: `impact_report.yaml`

**Approval Gate**: Human review required before proceeding

#### 3. Document Update Stage

Sequential updates to maintain consistency:

**PRD Updater** → **SRS Updater** → **SDS Updater**

Each updater:
- Performs incremental updates (not full rewrites)
- Maintains version history
- Generates changelog
- Preserves existing content

**Approval Gates**: Each document update requires approval

#### 4. Issue Generation Stage

Generates GitHub issues based on:
- Updated SDS components
- Impact analysis report
- Regression test requirements

#### 5. Parallel Execution Stage

Two agents run in parallel:

**Worker Agent**
- Implements assigned issues
- Generates code and tests
- Up to 5 parallel workers

**Regression Tester Agent**
- Identifies affected tests
- Runs regression test suites
- Analyzes coverage impact
- Checks backward compatibility
- Outputs: `regression_report.yaml`

#### 6. Review Stage

PR Reviewer creates and reviews pull requests with:
- Implementation results
- Regression test report
- Coverage analysis

## Configuration

### workflow.yaml

```yaml
pipeline:
  default_mode: "greenfield"

  modes:
    enhancement:
      description: "Incremental update pipeline for existing projects"
      stages:
        - name: "analysis_parallel"
          parallel: true
          substages:
            - name: "document_reading"
              agent: "document-reader"
            - name: "codebase_analysis"
              agent: "codebase-analyzer"
          next: "impact_analysis"

        - name: "impact_analysis"
          agent: "impact-analyzer"
          approval_required: true
          next: "document_update"

        # ... additional stages
```

### agents.yaml

Enhancement Pipeline agents are defined in the `enhancement_pipeline` category:

```yaml
categories:
  enhancement_pipeline:
    name: "Enhancement Pipeline"
    agents:
      - document-reader
      - codebase-analyzer
      - impact-analyzer
      - prd-updater
      - srs-updater
      - sds-updater
      - regression-tester
    execution_mode: "mixed"
```

## Agent Capabilities

| Agent | Key Capabilities |
|-------|------------------|
| Document Reader | Document parsing, requirement extraction, traceability mapping |
| Codebase Analyzer | Architecture detection, dependency graphing, pattern recognition |
| Impact Analyzer | Change scope analysis, risk assessment, regression prediction |
| PRD Updater | Incremental updates, version management, conflict detection |
| SRS Updater | Feature updates, use case generation, traceability updates |
| SDS Updater | Component integration, API specification, architecture evolution |
| Regression Tester | Test mapping, coverage analysis, compatibility verification |

## Best Practices

### 1. Review Impact Analysis Carefully

The impact analysis stage provides critical information:
- Affected components and their dependencies
- Risk levels and mitigation suggestions
- Recommended regression tests

Take time to review this before approving.

### 2. Incremental Changes

Enhancement mode works best with:
- Focused, well-scoped changes
- Clear requirements
- Existing test coverage

### 3. Maintain Traceability

The pipeline automatically maintains traceability:
- PRD requirements → SRS features → SDS components
- Changes propagate through the chain
- Changelogs track all modifications

### 4. Monitor Regression Reports

After parallel execution:
- Review regression test results
- Check coverage impact
- Address compatibility issues before merge

## Troubleshooting

### Mode Not Detected Correctly

If the system chooses the wrong mode:
1. Check if documents exist in `docs/prd/`, `docs/srs/`, `docs/sds/`
2. Verify source code exists in `src/`
3. Use explicit mode override if needed

### Impact Analysis Taking Too Long

For large codebases:
1. Check if dependency graph is being cached
2. Consider breaking changes into smaller scopes
3. Review codebase-analyzer configuration for depth limits

### Regression Tests Failing

If regression tests fail unexpectedly:
1. Review the changed files list
2. Check test-to-code mapping accuracy
3. Verify test environment configuration

## Related Documentation

- [Mode Detection Configuration](../reference/mode-detection.md)
- [Document Reader Agent](../document-reader.md)
- [Codebase Analyzer Agent](../codebase-analyzer.md)
- [Impact Analyzer Agent](../reference/impact-analyzer.md)
- [Regression Tester Agent](../regression-tester.md)
