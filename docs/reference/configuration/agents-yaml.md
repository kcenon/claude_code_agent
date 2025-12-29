# agents.yaml Reference

> **Location**: `.ad-sdlc/config/agents.yaml`
> **Purpose**: Agent registry, capabilities, and settings

## Overview

The `agents.yaml` file defines all available agents, their capabilities, model assignments, and tool allocations.

---

## Complete Schema

```yaml
# .ad-sdlc/config/agents.yaml

schema_version: "1.0"

# ============================================
# AGENT CATEGORIES
# ============================================
categories:
  document_pipeline:
    description: "Sequential document generation"
    execution: "sequential"
    agents:
      - collector
      - prd-writer
      - srs-writer
      - sds-writer

  document_update:
    description: "Incremental document updates"
    execution: "on-demand"
    agents:
      - prd-updater
      - srs-updater
      - sds-updater

  issue_management:
    description: "Issue generation and orchestration"
    execution: "sequential"
    agents:
      - issue-generator
      - controller

  execution:
    description: "Code implementation and review"
    execution: "parallel"
    agents:
      - worker
      - pr-reviewer

  analysis_pipeline:
    description: "Code and document analysis"
    execution: "parallel"
    agents:
      - document-reader
      - codebase-analyzer
      - code-reader
      - doc-code-comparator
      - impact-analyzer

  enhancement_pipeline:
    description: "Enhancement mode agents"
    execution: "mixed"
    agents:
      - regression-tester
      - mode-detector

# ============================================
# AGENT DEFINITIONS
# ============================================
agents:
  # --------------------------------------------
  # Document Generation Agents
  # --------------------------------------------
  collector:
    id: "collector"
    name: "Collector Agent"
    description: "Collects requirements from multiple sources"

    # Model configuration
    model: "sonnet"
    fallback_model: null

    # Execution settings
    timeout: 300000          # 5 minutes
    max_retries: 3

    # Capabilities
    capabilities:
      - natural_language_processing
      - file_parsing
      - url_fetching
      - requirement_extraction

    # Tool access
    tools:
      - Read
      - WebFetch
      - Glob
      - Bash

    # Input/Output
    input:
      sources:
        - user_input
        - files
        - urls
      formats:
        - markdown
        - docx
        - pdf
        - txt

    output:
      path: ".ad-sdlc/scratchpad/{project}/info/collected_info.yaml"
      format: "yaml"

    # Performance metrics (auto-updated)
    metrics:
      avg_duration_ms: 45000
      success_rate: 0.98

  prd-writer:
    id: "prd-writer"
    name: "PRD Writer Agent"
    description: "Generates Product Requirements Document"

    model: "sonnet"
    timeout: 300000
    max_retries: 3

    capabilities:
      - document_generation
      - requirement_analysis
      - traceability_creation

    tools:
      - Read
      - Write
      - Glob

    input:
      path: ".ad-sdlc/scratchpad/{project}/info/collected_info.yaml"
      format: "yaml"

    output:
      path: "docs/prd/PRD-001-{project}.md"
      format: "markdown"

    # Document template
    template: ".ad-sdlc/templates/prd-template.md"

    metrics:
      avg_duration_ms: 120000
      success_rate: 0.95

  srs-writer:
    id: "srs-writer"
    name: "SRS Writer Agent"
    description: "Generates Software Requirements Specification"

    model: "sonnet"
    timeout: 300000
    max_retries: 3

    capabilities:
      - document_generation
      - use_case_creation
      - traceability_mapping

    tools:
      - Read
      - Write
      - Glob

    input:
      path: "docs/prd/PRD-001-{project}.md"
      format: "markdown"

    output:
      path: "docs/srs/SRS-001-{project}.md"
      format: "markdown"

    template: ".ad-sdlc/templates/srs-template.md"

    metrics:
      avg_duration_ms: 150000
      success_rate: 0.94

  sds-writer:
    id: "sds-writer"
    name: "SDS Writer Agent"
    description: "Generates Software Design Specification"

    model: "sonnet"
    timeout: 300000
    max_retries: 3

    capabilities:
      - document_generation
      - architecture_design
      - api_specification
      - data_modeling

    tools:
      - Read
      - Write
      - Glob
      - Grep

    input:
      path: "docs/srs/SRS-001-{project}.md"
      format: "markdown"

    output:
      path: "docs/sds/SDS-001-{project}.md"
      format: "markdown"

    template: ".ad-sdlc/templates/sds-template.md"

    metrics:
      avg_duration_ms: 180000
      success_rate: 0.93

  # --------------------------------------------
  # Issue Management Agents
  # --------------------------------------------
  issue-generator:
    id: "issue-generator"
    name: "Issue Generator Agent"
    description: "Creates GitHub issues from SDS components"

    model: "sonnet"
    timeout: 180000
    max_retries: 3

    capabilities:
      - sds_parsing
      - issue_creation
      - dependency_mapping
      - github_integration

    tools:
      - Read
      - Write
      - Bash  # For gh CLI

    input:
      path: "docs/sds/SDS-001-{project}.md"
      format: "markdown"

    output:
      path: ".ad-sdlc/scratchpad/{project}/issues/issues.json"
      format: "json"

    github:
      labels:
        - "ad-sdlc:auto-generated"
      issue_template: ".ad-sdlc/templates/issue-template.md"

    metrics:
      avg_duration_ms: 60000
      success_rate: 0.97

  controller:
    id: "controller"
    name: "Controller Agent"
    description: "Orchestrates work distribution"

    model: "haiku"  # Fast decisions
    timeout: 600000
    max_retries: 2

    capabilities:
      - dependency_analysis
      - work_prioritization
      - worker_management
      - progress_tracking

    tools:
      - Read
      - Write
      - Bash  # For gh CLI

    input:
      path: ".ad-sdlc/scratchpad/{project}/issues/issues.json"
      format: "json"

    output:
      path: ".ad-sdlc/scratchpad/{project}/progress/controller_state.yaml"
      format: "yaml"

    orchestration:
      max_parallel_workers: 5
      worker_timeout: 1800000
      poll_interval: 30000
      priority_weights:
        p0: 100
        p1: 50
        p2: 10

    metrics:
      avg_duration_ms: 300000
      success_rate: 0.96

  # --------------------------------------------
  # Execution Agents
  # --------------------------------------------
  worker:
    id: "worker"
    name: "Worker Agent"
    description: "Implements code for issues"

    model: "sonnet"
    fallback_model: "opus"  # For complex tasks
    timeout: 1800000  # 30 minutes
    max_retries: 3

    capabilities:
      - code_generation
      - test_writing
      - self_verification
      - git_operations

    tools:
      - Read
      - Write
      - Edit
      - Bash
      - Grep
      - Glob
      - LSP

    verification:
      run_tests: true
      run_lint: true
      run_build: true
      coverage_threshold: 80

    git:
      branch_prefix: "feature/"
      commit_style: "conventional"

    metrics:
      avg_duration_ms: 900000
      success_rate: 0.88

  pr-reviewer:
    id: "pr-reviewer"
    name: "PR Reviewer Agent"
    description: "Reviews and merges pull requests"

    model: "sonnet"
    timeout: 600000
    max_retries: 2

    capabilities:
      - code_review
      - quality_assessment
      - merge_decision

    tools:
      - Read
      - Bash  # For gh, git CLI
      - Grep

    review:
      check_coverage: true
      check_complexity: true
      check_security: true
      auto_merge: false

    github:
      merge_strategy: "squash"
      delete_branch: true

    metrics:
      avg_duration_ms: 120000
      success_rate: 0.95

  # --------------------------------------------
  # Analysis Agents
  # --------------------------------------------
  document-reader:
    id: "document-reader"
    name: "Document Reader Agent"
    description: "Parses existing documentation"

    model: "haiku"  # Fast parsing
    timeout: 180000
    max_retries: 3

    capabilities:
      - document_parsing
      - version_tracking
      - requirement_extraction
      - traceability_mapping

    tools:
      - Read
      - Glob
      - Grep

    input:
      paths:
        - "docs/prd/*.md"
        - "docs/srs/*.md"
        - "docs/sds/*.md"
      formats:
        - markdown

    output:
      path: ".ad-sdlc/scratchpad/{project}/state/current_state.yaml"
      format: "yaml"

    metrics:
      avg_duration_ms: 30000
      success_rate: 0.99

  codebase-analyzer:
    id: "codebase-analyzer"
    name: "Codebase Analyzer Agent"
    description: "Analyzes code structure"

    model: "haiku"  # Fast analysis
    timeout: 300000
    max_retries: 3

    capabilities:
      - architecture_analysis
      - dependency_graphing
      - pattern_recognition
      - code_metrics

    tools:
      - Read
      - Glob
      - Grep
      - LSP
      - Bash

    input:
      paths:
        - "src/**/*.ts"
        - "src/**/*.js"
      exclude:
        - "node_modules/**"
        - "dist/**"

    output:
      paths:
        - ".ad-sdlc/scratchpad/{project}/analysis/architecture_overview.yaml"
        - ".ad-sdlc/scratchpad/{project}/analysis/dependency_graph.json"

    metrics:
      avg_duration_ms: 60000
      success_rate: 0.97

  impact-analyzer:
    id: "impact-analyzer"
    name: "Impact Analyzer Agent"
    description: "Assesses change impact"

    model: "sonnet"  # Complex reasoning
    timeout: 300000
    max_retries: 3

    capabilities:
      - change_scope_analysis
      - affected_module_detection
      - risk_assessment
      - regression_prediction

    tools:
      - Read
      - Glob
      - Grep

    input:
      paths:
        - ".ad-sdlc/scratchpad/{project}/state/current_state.yaml"
        - ".ad-sdlc/scratchpad/{project}/analysis/architecture_overview.yaml"
        - ".ad-sdlc/scratchpad/{project}/analysis/dependency_graph.json"

    output:
      path: ".ad-sdlc/scratchpad/{project}/impact/impact_report.yaml"
      format: "yaml"

    metrics:
      avg_duration_ms: 90000
      success_rate: 0.94

  regression-tester:
    id: "regression-tester"
    name: "Regression Tester Agent"
    description: "Validates existing functionality"

    model: "haiku"  # Fast execution
    timeout: 600000
    max_retries: 2

    capabilities:
      - test_identification
      - test_execution
      - regression_detection

    tools:
      - Read
      - Bash
      - Glob

    testing:
      test_command: "npm test"
      coverage_command: "npm run test:coverage"

    metrics:
      avg_duration_ms: 180000
      success_rate: 0.96
```

---

## Agent Properties Reference

### Core Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `description` | string | Yes | Purpose description |
| `model` | string | Yes | Claude model (haiku/sonnet/opus) |
| `fallback_model` | string | No | Model for complex tasks |
| `timeout` | number | Yes | Timeout in milliseconds |
| `max_retries` | number | No | Retry attempts (default: 3) |

### Capabilities

Define what an agent can do:

```yaml
capabilities:
  - code_generation
  - test_writing
  - document_parsing
  # ... etc
```

### Tools

Available tools:

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Write/create files |
| `Edit` | Modify existing files |
| `Bash` | Execute shell commands |
| `Grep` | Search file contents |
| `Glob` | Find files by pattern |
| `LSP` | Language server protocol |
| `WebFetch` | Fetch URL content |

### Input/Output

```yaml
input:
  path: "path/to/input"      # Single file
  paths:                     # Multiple files
    - "src/**/*.ts"
  format: "yaml"             # yaml | json | markdown

output:
  path: "path/to/output"
  format: "yaml"
```

---

## Examples

### Custom Agent

```yaml
agents:
  custom-reviewer:
    id: "custom-reviewer"
    name: "Custom Code Reviewer"
    description: "Custom review rules"

    model: "sonnet"
    timeout: 300000

    capabilities:
      - code_review
      - security_check

    tools:
      - Read
      - Grep
      - Glob

    # Custom configuration
    review_rules:
      - "no-console-log"
      - "require-error-handling"
```

### Override Model

```yaml
agents:
  worker:
    model: "opus"  # Override to use opus
```

---

*Part of [Configuration Reference](./README.md)*
