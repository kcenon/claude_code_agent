# Running AD-SDLC in Headless Mode

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

This guide explains how to run AD-SDLC pipelines in non-interactive (headless) mode for automation, CI/CD integration, and scripting.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [CLI Flags Reference](#cli-flags-reference)
4. [Convenience Scripts](#convenience-scripts)
5. [Environment Variables](#environment-variables)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

By default, the Claude CLI runs in interactive mode, waiting for user input and confirmation. For automated pipelines, you need headless mode which:

- Exits automatically after task completion
- Pre-approves specific tool permissions
- Limits execution turns
- Provides structured output for parsing

### Interactive vs Headless

| Aspect | Interactive | Headless |
|--------|-------------|----------|
| User Input | Required | None |
| Tool Permissions | Prompted | Pre-approved |
| Exit Behavior | Stays open | Auto-exits |
| Output | Rich console | Text/JSON |
| Use Case | Development | Automation |

---

## Quick Start

### Basic Headless Command

```bash
# Use -p flag for non-interactive execution
claude -p "Initialize AD-SDLC" \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash(mkdir:*)" \
  --output-format text
```

### Using Convenience Scripts

```bash
# Initialize project
./.ad-sdlc/scripts/ad-sdlc-init.sh

# Generate issues from SDS
./.ad-sdlc/scripts/ad-sdlc-generate-issues.sh

# Run full pipeline
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh
```

---

## CLI Flags Reference

### Essential Flags

| Flag | Alias | Purpose | Example |
|------|-------|---------|---------|
| `--print` | `-p` | Non-interactive mode (auto-exit) | `claude -p "task"` |
| `--allowedTools` | | Pre-approve specific tools | `--allowedTools "Read,Write"` |
| `--output-format` | | Output format (text/json) | `--output-format json` |

### Additional Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--continue` / `-c` | Continue previous session | `claude -p -c "continue"` |
| `--dangerously-skip-permissions` | Approve all permissions | Use in trusted environments only |
| `--model` | Specify Claude model | `--model claude-sonnet-4-20250514` |
| `--resume` | Resume specific session | `--resume session-id` |

### Tool Permission Patterns

The `--allowedTools` flag supports patterns:

```bash
# Specific tools
--allowedTools "Read,Write,Edit"

# Bash with wildcards
--allowedTools "Bash(git:*)"           # All git commands
--allowedTools "Bash(npm:*)"           # All npm commands
--allowedTools "Bash(mkdir:*),Bash(cp:*)"  # Multiple bash patterns

# All tools (dangerous)
--allowedTools "*"
```

---

## Convenience Scripts

AD-SDLC provides ready-to-use scripts in `.ad-sdlc/scripts/`:

### Script Overview

| Script | Purpose |
|--------|---------|
| `ad-sdlc-init.sh` | Initialize AD-SDLC for a project |
| `ad-sdlc-analyze-docs.sh` | Analyze existing documents |
| `ad-sdlc-generate-issues.sh` | Generate GitHub issues from SDS |
| `ad-sdlc-implement.sh` | Implement specific or all issues |
| `ad-sdlc-full-pipeline.sh` | Run complete pipeline |

### Usage Examples

#### Initialize a Project

```bash
# Current directory
./.ad-sdlc/scripts/ad-sdlc-init.sh

# Specific path
./.ad-sdlc/scripts/ad-sdlc-init.sh /path/to/project
```

#### Analyze Documents

```bash
./.ad-sdlc/scripts/ad-sdlc-analyze-docs.sh

# Output: .ad-sdlc/scratchpad/documents/current_state.yaml
```

#### Generate Issues

```bash
# Preview (dry run)
./.ad-sdlc/scripts/ad-sdlc-generate-issues.sh . --dry-run

# Create issues on GitHub
./.ad-sdlc/scripts/ad-sdlc-generate-issues.sh
```

#### Implement Issues

```bash
# Single issue
./.ad-sdlc/scripts/ad-sdlc-implement.sh . 42

# All pending issues (P0 first)
./.ad-sdlc/scripts/ad-sdlc-implement.sh
```

#### Full Pipeline

```bash
# Auto-detect mode
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh

# Specific mode
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . greenfield
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . enhancement
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . import
```

---

## Environment Variables

### Required

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### Optional

```bash
# Skip test execution during implementation
export SKIP_TESTS=true

# Skip confirmation prompts
export SKIP_CONFIRMATION=true

# Bypass all permission checks (DANGEROUS)
export DANGEROUSLY_SKIP_PERMISSIONS=true

# GitHub token (if not using gh auth)
export GH_TOKEN="ghp_..."
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: AD-SDLC Pipeline

on:
  workflow_dispatch:
    inputs:
      task:
        description: 'Task to execute'
        required: true
        type: string
      mode:
        description: 'Pipeline mode'
        required: false
        default: 'auto'
        type: choice
        options:
          - auto
          - greenfield
          - enhancement
          - import

jobs:
  execute:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Claude CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Run AD-SDLC
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          chmod +x .ad-sdlc/scripts/*.sh
          ./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . ${{ github.event.inputs.mode }}

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ad-sdlc-output
          path: |
            docs/*.md
            .ad-sdlc/logs/
            .ad-sdlc/scratchpad/
```

### GitLab CI

```yaml
ad-sdlc-pipeline:
  image: node:20
  stage: build
  script:
    - npm install -g @anthropic-ai/claude-code
    - chmod +x .ad-sdlc/scripts/*.sh
    - ./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . auto
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
    SKIP_CONFIRMATION: "true"
  artifacts:
    paths:
      - docs/
      - .ad-sdlc/logs/
    expire_in: 1 week
  when: manual
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        ANTHROPIC_API_KEY = credentials('anthropic-api-key')
        SKIP_CONFIRMATION = 'true'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g @anthropic-ai/claude-code'
                sh 'chmod +x .ad-sdlc/scripts/*.sh'
            }
        }

        stage('Run Pipeline') {
            steps {
                sh './.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . auto'
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'docs/*.md, .ad-sdlc/logs/**/*'
        }
    }
}
```

---

## Best Practices

### 1. Start with Dry Runs

Always preview before creating resources:

```bash
# Preview issues
./.ad-sdlc/scripts/ad-sdlc-generate-issues.sh . --dry-run

# Review output
cat .ad-sdlc/scratchpad/issues/generated_issues.yaml
```

### 2. Limit Tool Permissions

Only allow necessary tools:

```bash
# Read-only analysis
--allowedTools "Read,Glob,Grep"

# Document generation
--allowedTools "Read,Write,Edit,Glob,Grep"

# Full development
--allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task"
```

### 3. Capture Output for Debugging

```bash
# Save output to file
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh 2>&1 | tee pipeline.log

# JSON output for parsing
claude -p "task" --output-format json > result.json
```

### 4. Handle Interruptions

```bash
# Resume interrupted session
claude --continue

# Or resume specific session
claude --resume "session-id"
```

---

## Troubleshooting

### Script Not Executing

```bash
# Check permissions
ls -la .ad-sdlc/scripts/

# Fix permissions
chmod +x .ad-sdlc/scripts/*.sh
```

### API Key Issues

```bash
# Verify key is set
echo $ANTHROPIC_API_KEY | head -c 15

# Should show: sk-ant-api03-...
```

### Claude CLI Not Found

```bash
# Install globally
npm install -g @anthropic-ai/claude-code

# Or use npx
npx @anthropic-ai/claude-code -p "task"
```

### Pipeline Timeout

Break into smaller tasks if timeout occurs:

```bash
# Run stages separately
./.ad-sdlc/scripts/ad-sdlc-analyze-docs.sh
./.ad-sdlc/scripts/ad-sdlc-generate-issues.sh
./.ad-sdlc/scripts/ad-sdlc-implement.sh
```

### Permission Denied Errors

```bash
# Check which tool needs permission
# Add to --allowedTools or use pattern

# For git operations
--allowedTools "Bash(git:*)"

# For npm/yarn
--allowedTools "Bash(npm:*),Bash(yarn:*)"
```

### Session State Issues

```bash
# Clear session and restart
rm -rf .ad-sdlc/scratchpad/progress/*

# Or use fresh session
claude -p "task" --no-resume
```

---

## Security Considerations

### Production Environments

1. **Never commit API keys** - Use environment variables or secrets management
2. **Limit tool permissions** - Only allow what's necessary
3. **Review before merge** - Generated code should be reviewed
4. **Use isolated environments** - Run in containers or VMs
5. **Audit logs** - Keep `.ad-sdlc/logs/` for audit trails

### CI/CD Security

```yaml
# GitHub Actions - use secrets
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

# Never print secrets
run: |
  echo "Key length: ${#ANTHROPIC_API_KEY}"  # OK
  # echo $ANTHROPIC_API_KEY                 # NEVER do this
```

---

## See Also

- [Quickstart Guide](quickstart.md)
- [Configuration Reference](reference/06_configuration.md)
- [Scripts README](.ad-sdlc/scripts/README.md)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)

---

*Part of [AD-SDLC Documentation](../README.md)*
