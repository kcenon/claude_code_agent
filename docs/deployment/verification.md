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
$ ad-sdlc validate

# Show the effective runtime policy
$ ad-sdlc run "<requirements>" --dry-run
Mode: greenfield; local: false
...
Configuration valid. Pipeline is ready to execute.
```

### 4. Credential Check

```bash
# Check that an ANTHROPIC_API_KEY or Claude Code session is detected
# (presence only; doctor does not call the API)
$ ad-sdlc doctor

# Test GitHub API
$ gh api user --jq '.login'
your-username
```

---

## Test Run

### Dry Run Mode

```bash
# Resolve the configuration and print the stage graph without calling the SDK
ad-sdlc run "<requirements>" --dry-run
```

The output lists the mode, stage concurrency, verification profile, approval
mode, and every stage with its dependencies and time budget.

### Minimal Test

```bash
# Stop after requirements collection (runs initialization, mode detection,
# and collection)
ad-sdlc run "<requirements>" --stop-after collection
```

---

## Health Check Output

### All Passing

```
$ ad-sdlc doctor

AD-SDLC Health Check
====================

System:
  ✓ Node.js v22.22.1 (required: v22.22.1+)
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
  ✓ Node.js v22.22.1 (required: v22.22.1+)
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
  ✗ Node.js v20.20.2 (required: v22.22.1+)
  ✓ npm v10.8.2

Environment:
  ✗ ANTHROPIC_API_KEY: not configured
  ✗ GITHUB_TOKEN: not configured

Status: UNHEALTHY
2 errors found. Please fix before running.

Recommended actions:
  1. Upgrade Node.js to v22.22.1+: nvm install 22
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
ad-sdlc validate
```

---

## Next Steps

After successful verification:

1. [Run your first pipeline](../guides/quickstart.md)
2. [Customize configuration](./configuration.md)
3. [Read agent documentation](../reference/agents/)

---

_Part of [Deployment Guide](./README.md)_
