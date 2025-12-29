# Configuration Reference

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

## Overview

AD-SDLC is configured through YAML files and environment variables. This section covers all configuration options.

---

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `workflow.yaml` | `.ad-sdlc/config/` | Pipeline stages, quality gates |
| `agents.yaml` | `.ad-sdlc/config/` | Agent definitions and capabilities |
| `mode-detection.yaml` | `.ad-sdlc/config/` | Greenfield vs Enhancement rules |

---

## Configuration Hierarchy

```
1. Environment Variables     (highest priority)
2. CLI Arguments
3. Project Config (.ad-sdlc/config/)
4. User Config (~/.ad-sdlc/config/)
5. Default Values           (lowest priority)
```

---

## Quick Reference

### Essential Settings

```yaml
# .ad-sdlc/config/workflow.yaml
global_settings:
  project_root: "."
  output_dir: "docs"
  approval_gates: true
  default_model: "sonnet"

pipelines:
  greenfield:
    enabled: true
  enhancement:
    enabled: true
```

### Environment Variables

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional
export AD_SDLC_MODEL="sonnet"
export AD_SDLC_DEBUG="true"
export GITHUB_TOKEN="ghp_..."
```

---

## Documents

- [workflow.yaml Reference](./workflow-yaml.md) - Pipeline configuration
- [agents.yaml Reference](./agents-yaml.md) - Agent configuration
- [Environment Variables](./environment.md) - Environment settings

---

*Part of [AD-SDLC Reference Documentation](../README.md)*
