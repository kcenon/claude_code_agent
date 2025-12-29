# workflow.yaml Reference

> **Location**: `.ad-sdlc/config/workflow.yaml`
> **Purpose**: Pipeline stages, quality gates, and global settings

## Overview

The `workflow.yaml` file defines how AD-SDLC pipelines execute, including stage order, quality gates, timeouts, and integrations.

---

## Complete Schema

```yaml
# .ad-sdlc/config/workflow.yaml

# Schema version for compatibility
schema_version: "1.0"

# ============================================
# GLOBAL SETTINGS
# ============================================
global_settings:
  # Project configuration
  project_root: "."                    # Project root directory
  output_dir: "docs"                   # Generated documents location
  scratchpad_dir: ".ad-sdlc/scratchpad" # Inter-agent state

  # Execution settings
  default_model: "sonnet"              # Default Claude model
  approval_gates: true                 # Require human approval
  parallel_workers: 5                  # Max concurrent workers

  # Retry policy
  retry:
    max_attempts: 3                    # Max retry attempts
    base_delay_ms: 5000               # Initial backoff delay
    max_delay_ms: 60000               # Maximum backoff delay
    exponential_base: 2               # Backoff multiplier

  # Timeouts (milliseconds)
  timeouts:
    document_generation: 300000       # 5 minutes
    issue_generation: 180000          # 3 minutes
    implementation: 1800000           # 30 minutes
    pr_review: 600000                 # 10 minutes

# ============================================
# PIPELINE DEFINITIONS
# ============================================
pipelines:
  # Greenfield Pipeline (New Projects)
  greenfield:
    enabled: true
    description: "Full document generation for new projects"

    stages:
      - name: "collection"
        agent: "collector"
        description: "Gather requirements"
        timeout: 300000
        requires_approval: false

      - name: "prd_generation"
        agent: "prd-writer"
        description: "Generate PRD"
        timeout: 300000
        requires_approval: true
        depends_on: ["collection"]

      - name: "srs_generation"
        agent: "srs-writer"
        description: "Generate SRS"
        timeout: 300000
        requires_approval: true
        depends_on: ["prd_generation"]

      - name: "sds_generation"
        agent: "sds-writer"
        description: "Generate SDS"
        timeout: 300000
        requires_approval: true
        depends_on: ["srs_generation"]

      - name: "issue_generation"
        agent: "issue-generator"
        description: "Create GitHub issues"
        timeout: 180000
        requires_approval: true
        depends_on: ["sds_generation"]

      - name: "orchestration"
        agent: "controller"
        description: "Distribute work"
        timeout: 600000
        requires_approval: false
        depends_on: ["issue_generation"]

      - name: "implementation"
        agent: "worker"
        description: "Implement issues"
        timeout: 1800000
        parallel: true
        max_parallel: 5
        depends_on: ["orchestration"]

      - name: "review"
        agent: "pr-reviewer"
        description: "Review and merge"
        timeout: 600000
        depends_on: ["implementation"]

  # Enhancement Pipeline (Existing Projects)
  enhancement:
    enabled: true
    description: "Incremental updates for existing projects"

    stages:
      - name: "analysis"
        description: "Analyze existing state"
        parallel: true
        agents:
          - "document-reader"
          - "codebase-analyzer"
          - "code-reader"
        timeout: 300000

      - name: "comparison"
        agent: "doc-code-comparator"
        description: "Compare docs vs code"
        timeout: 180000
        depends_on: ["analysis"]

      - name: "impact_analysis"
        agent: "impact-analyzer"
        description: "Assess change impact"
        timeout: 300000
        requires_approval: true
        depends_on: ["comparison"]

      - name: "prd_update"
        agent: "prd-updater"
        description: "Update PRD incrementally"
        timeout: 300000
        depends_on: ["impact_analysis"]

      - name: "srs_update"
        agent: "srs-updater"
        description: "Update SRS incrementally"
        timeout: 300000
        depends_on: ["prd_update"]

      - name: "sds_update"
        agent: "sds-updater"
        description: "Update SDS incrementally"
        timeout: 300000
        depends_on: ["srs_update"]

      - name: "issue_generation"
        agent: "issue-generator"
        description: "Create issues for changes"
        timeout: 180000
        depends_on: ["sds_update"]

      - name: "implementation"
        description: "Implement with regression"
        parallel: true
        agents:
          - "worker"
          - "regression-tester"
        timeout: 1800000
        depends_on: ["issue_generation"]

      - name: "review"
        agent: "pr-reviewer"
        description: "Review with regression results"
        timeout: 600000
        depends_on: ["implementation"]

# ============================================
# QUALITY GATES
# ============================================
quality_gates:
  # Document quality
  documents:
    prd:
      min_requirements: 5           # Minimum functional requirements
      require_nfr: true             # Require non-functional requirements
      require_traceability: true    # Require traceability matrix

    srs:
      require_use_cases: true       # Require use case definitions
      require_data_model: true      # Require data requirements
      min_features: 3               # Minimum features

    sds:
      require_components: true      # Require component definitions
      require_apis: true            # Require API specifications
      require_data_models: true     # Require data model definitions

  # Code quality
  code:
    coverage_threshold: 80          # Minimum test coverage %
    max_complexity: 10              # Maximum cyclomatic complexity
    require_tests: true             # Require unit tests
    require_lint_pass: true         # Require lint pass
    require_build_pass: true        # Require build pass

  # Security
  security:
    scan_dependencies: true         # Scan for vulnerable deps
    block_on_high: true            # Block on high severity
    block_on_critical: true        # Block on critical severity

# ============================================
# GITHUB INTEGRATION
# ============================================
github:
  # Issue creation
  issues:
    auto_create: true              # Auto-create issues from SDS
    labels:
      - "ad-sdlc:auto-generated"   # Default labels
    assignees: []                  # Default assignees
    milestone: null               # Default milestone

  # Pull requests
  pull_requests:
    auto_create: true             # Auto-create PRs
    draft: false                  # Create as draft
    labels:
      - "ad-sdlc:auto-generated"
    reviewers: []                 # Auto-assign reviewers

    # Merge settings
    merge_strategy: "squash"      # squash | rebase | merge
    delete_branch: true           # Delete after merge
    require_approvals: 0          # Required approvals (0 = auto-merge)

  # Branch naming
  branches:
    feature_prefix: "feature/"
    pattern: "{prefix}{issue_number}-{slug}"

# ============================================
# LOGGING & MONITORING
# ============================================
logging:
  level: "info"                   # debug | info | warn | error
  format: "json"                  # json | text

  # File logging
  file:
    enabled: true
    path: ".ad-sdlc/logs/ad-sdlc.log"
    max_size_mb: 10
    max_files: 5

  # Console logging
  console:
    enabled: true
    colors: true

monitoring:
  metrics:
    enabled: true
    path: ".ad-sdlc/metrics/"

  # Performance tracking
  track_duration: true
  track_token_usage: true
  track_cost: true

# ============================================
# NOTIFICATIONS
# ============================================
notifications:
  # Slack integration
  slack:
    enabled: false
    webhook_url: "${SLACK_WEBHOOK_URL}"
    events:
      - "pipeline_complete"
      - "pipeline_failed"
      - "approval_required"

  # Email notifications
  email:
    enabled: false
    smtp_host: "${SMTP_HOST}"
    from: "ad-sdlc@example.com"
    to: []
    events:
      - "pipeline_failed"
```

---

## Section Details

### Global Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `project_root` | string | "." | Project root directory |
| `output_dir` | string | "docs" | Where to save generated documents |
| `scratchpad_dir` | string | ".ad-sdlc/scratchpad" | Inter-agent state location |
| `default_model` | string | "sonnet" | Default Claude model |
| `approval_gates` | boolean | true | Enable human approval |
| `parallel_workers` | number | 5 | Max concurrent workers |

### Retry Policy

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `max_attempts` | number | 3 | Maximum retry attempts |
| `base_delay_ms` | number | 5000 | Initial backoff (5s) |
| `max_delay_ms` | number | 60000 | Maximum backoff (60s) |
| `exponential_base` | number | 2 | Backoff multiplier |

### Pipeline Stages

Each stage supports:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Stage identifier |
| `agent` | string | No* | Agent to execute |
| `agents` | string[] | No* | Agents for parallel |
| `description` | string | No | Human-readable description |
| `timeout` | number | No | Timeout in ms |
| `requires_approval` | boolean | No | Wait for human approval |
| `depends_on` | string[] | No | Stage dependencies |
| `parallel` | boolean | No | Run agents in parallel |
| `max_parallel` | number | No | Max parallel instances |

*Either `agent` or `agents` required

### Quality Gates

Quality gates block pipeline if not met:

```yaml
quality_gates:
  code:
    coverage_threshold: 80    # Fail if coverage < 80%
    require_tests: true       # Fail if no tests
```

---

## Examples

### Minimal Configuration

```yaml
schema_version: "1.0"

global_settings:
  project_root: "."
  approval_gates: false  # No approval for quick runs

pipelines:
  greenfield:
    enabled: true
```

### High-Quality Configuration

```yaml
schema_version: "1.0"

global_settings:
  default_model: "opus"  # Use best model
  approval_gates: true

quality_gates:
  code:
    coverage_threshold: 90
    max_complexity: 8
  security:
    block_on_high: true
    block_on_critical: true

github:
  pull_requests:
    require_approvals: 1
```

### Fast Development Configuration

```yaml
schema_version: "1.0"

global_settings:
  default_model: "haiku"  # Fastest model
  approval_gates: false
  parallel_workers: 10

quality_gates:
  code:
    coverage_threshold: 60  # Lower threshold
```

---

## Validation

The configuration is validated on load:

```bash
# Validate configuration
ad-sdlc config validate

# Show effective configuration
ad-sdlc config show
```

---

*Part of [Configuration Reference](./README.md)*
