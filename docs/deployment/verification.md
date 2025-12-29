# Verification Guide

> **Purpose**: Verify AD-SDLC installation and configuration

## Quick Verification

```bash
# Check CLI is installed
ad-sdlc --version

# Run health check
ad-sdlc doctor
```

---

## Detailed Verification

### 1. CLI Verification

```bash
# Version check
$ ad-sdlc --version
ad-sdlc/1.0.0

# Help check
$ ad-sdlc --help
Usage: ad-sdlc [options] [command]

AD-SDLC - Agent-Driven Software Development Lifecycle

Options:
  -V, --version     output version number
  -h, --help        display help

Commands:
  init              Initialize AD-SDLC in project
  run               Run the pipeline
  status            Show pipeline status
  config            Manage configuration
  doctor            Check system health
```

### 2. Environment Verification

```bash
# Check API key (masked)
$ echo $ANTHROPIC_API_KEY | cut -c1-15
sk-ant-api03-...

# Check GitHub token (masked)
$ echo $GITHUB_TOKEN | cut -c1-10
ghp_xxxxxx

# Verify GitHub auth
$ gh auth status
✓ Logged in to github.com
```

### 3. Configuration Verification

```bash
# Validate configuration files
$ ad-sdlc config validate
✓ workflow.yaml: valid
✓ agents.yaml: valid
✓ mode-detection.yaml: valid

# Show effective configuration
$ ad-sdlc config show
Global Settings:
  project_root: .
  output_dir: docs
  default_model: sonnet
  parallel_workers: 5
```

### 4. API Connection Test

```bash
# Test Anthropic API
$ ad-sdlc doctor --check-api
Testing Anthropic API connection...
✓ API connection successful
✓ Model: claude-sonnet-4-5-20251101 available

# Test GitHub API
$ gh api user --jq '.login'
your-username
```

---

## Test Run

### Dry Run Mode

```bash
# Run without making changes
ad-sdlc run --dry-run

# Output:
# [DRY RUN] Would execute:
#   1. Collector Agent
#   2. PRD Writer Agent
#   3. SRS Writer Agent
#   4. SDS Writer Agent
#   5. Issue Generator Agent
#   6. Controller Agent
#   7. Worker Agents (parallel)
#   8. PR Reviewer Agent
```

### Minimal Test

```bash
# Run only collection stage
ad-sdlc run --stage collection

# Input test requirements
# Check output at .ad-sdlc/scratchpad/{project}/info/collected_info.yaml
```

---

## Health Check Output

### All Passing

```
$ ad-sdlc doctor

AD-SDLC Health Check
====================

System:
  ✓ Node.js v20.10.0 (required: v18+)
  ✓ npm v10.2.3
  ✓ Git v2.42.0
  ✓ Disk space: 15GB free

Environment:
  ✓ ANTHROPIC_API_KEY: configured
  ✓ GITHUB_TOKEN: configured

API Connectivity:
  ✓ Anthropic API: connected
  ✓ GitHub API: connected

Configuration:
  ✓ .ad-sdlc/config/workflow.yaml: valid
  ✓ .ad-sdlc/config/agents.yaml: valid
  ✓ .ad-sdlc/config/mode-detection.yaml: valid

Project:
  ✓ Git repository: initialized
  ✓ Package.json: found

Status: HEALTHY
All checks passed. Ready to run!
```

### With Warnings

```
$ ad-sdlc doctor

AD-SDLC Health Check
====================

System:
  ✓ Node.js v18.0.0 (required: v18+)
  ⚠ npm v9.0.0 (recommended: v10+)
  ✓ Git v2.30.0

Environment:
  ✓ ANTHROPIC_API_KEY: configured
  ⚠ GITHUB_TOKEN: not configured (required for GitHub operations)

Configuration:
  ✓ .ad-sdlc/config/workflow.yaml: valid
  ✓ .ad-sdlc/config/agents.yaml: valid

Status: HEALTHY (with warnings)
2 warnings found. Some features may be limited.
```

### With Errors

```
$ ad-sdlc doctor

AD-SDLC Health Check
====================

System:
  ✗ Node.js v16.0.0 (required: v18+)
  ✓ npm v8.0.0

Environment:
  ✗ ANTHROPIC_API_KEY: not configured
  ✗ GITHUB_TOKEN: not configured

Status: UNHEALTHY
2 errors found. Please fix before running.

Recommended actions:
  1. Upgrade Node.js to v18+: nvm install 18
  2. Set ANTHROPIC_API_KEY: export ANTHROPIC_API_KEY="sk-ant-..."
  3. Set GITHUB_TOKEN: export GITHUB_TOKEN="ghp_..."
```

---

## Common Issues

### Issue: API Key Invalid

```
Error: Invalid API key format
```

**Solution**: Verify key format starts with `sk-ant-api03-`

### Issue: GitHub Rate Limited

```
Error: GitHub API rate limit exceeded
```

**Solution**: Wait for reset or use authenticated requests

### Issue: Configuration Parse Error

```
Error: Invalid YAML in workflow.yaml
```

**Solution**: Validate YAML syntax:
```bash
ad-sdlc config validate --verbose
```

---

## Next Steps

After successful verification:

1. [Run your first pipeline](../guides/quickstart.md)
2. [Customize configuration](./configuration.md)
3. [Read agent documentation](../reference/agents/)

---

*Part of [Deployment Guide](./README.md)*
