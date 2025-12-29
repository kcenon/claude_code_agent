# Configuration Guide

> **Purpose**: Post-installation configuration

## Initial Setup

After installation, configure AD-SDLC for your project:

```bash
cd your-project
ad-sdlc init
```

---

## Configuration Files

### Created by `ad-sdlc init`

```
.ad-sdlc/
├── config/
│   ├── workflow.yaml     # Pipeline configuration
│   ├── agents.yaml       # Agent settings
│   └── mode-detection.yaml  # Mode selection rules
├── scratchpad/           # Inter-agent state
├── templates/            # Document templates
└── logs/                 # Execution logs
```

---

## Essential Configuration

### 1. Environment Variables

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export GITHUB_TOKEN="ghp_..."

# Optional
export AD_SDLC_MODEL="sonnet"
export AD_SDLC_DEBUG="false"
```

### 2. Workflow Settings

Edit `.ad-sdlc/config/workflow.yaml`:

```yaml
global_settings:
  # Project settings
  project_root: "."
  output_dir: "docs"

  # Execution settings
  default_model: "sonnet"
  approval_gates: true      # Set to false for automated runs
  parallel_workers: 5

  # Timeouts (ms)
  timeouts:
    document_generation: 300000   # 5 min
    implementation: 1800000       # 30 min
```

### 3. Quality Gates

```yaml
quality_gates:
  code:
    coverage_threshold: 80    # Minimum test coverage
    require_tests: true
    require_lint_pass: true

  security:
    scan_dependencies: true
    block_on_critical: true
```

---

## Common Configurations

### Development (Fast Iteration)

```yaml
# .ad-sdlc/config/workflow.yaml
global_settings:
  default_model: "haiku"      # Faster, cheaper
  approval_gates: false       # No manual approval
  parallel_workers: 10        # More parallelism

quality_gates:
  code:
    coverage_threshold: 60    # Lower threshold
```

### Production (High Quality)

```yaml
global_settings:
  default_model: "sonnet"     # Better quality
  approval_gates: true        # Require approval

quality_gates:
  code:
    coverage_threshold: 90    # Higher threshold
    max_complexity: 8

  security:
    block_on_high: true
    block_on_critical: true
```

### CI/CD (Automated)

```yaml
global_settings:
  approval_gates: false       # No manual gates
  default_model: "haiku"      # Cost-efficient

github:
  pull_requests:
    auto_create: true
    require_approvals: 0      # Auto-merge
```

---

## Project-Specific Settings

### Enable Only Greenfield

```yaml
pipelines:
  greenfield:
    enabled: true
  enhancement:
    enabled: false
```

### Custom Document Output

```yaml
global_settings:
  output_dir: "documentation"   # Custom output path

# Stage-specific paths
pipelines:
  greenfield:
    stages:
      - name: "prd_generation"
        agent: "prd-writer"
        output:
          path: "specs/prd/PRD-{project}.md"
```

### Custom Agent Models

```yaml
# In agents.yaml
agents:
  worker:
    model: "opus"           # Use opus for code generation

  controller:
    model: "haiku"          # Fast decisions
```

---

## Validation

```bash
# Validate configuration
ad-sdlc config validate

# Show effective configuration
ad-sdlc config show

# Check specific file
ad-sdlc config validate --file workflow.yaml
```

---

## Next Steps

- [Run Verification](./verification.md)
- [Configuration Reference](../reference/configuration/)

---

*Part of [Deployment Guide](./README.md)*
