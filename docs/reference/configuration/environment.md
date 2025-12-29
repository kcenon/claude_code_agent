# Environment Variables Reference

> **Purpose**: Runtime configuration via environment

## Overview

Environment variables provide the highest priority configuration, useful for:
- API credentials
- Runtime overrides
- CI/CD environments
- Secrets management

---

## Required Variables

### API Authentication

```bash
# Anthropic API Key (required for Claude)
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### GitHub Integration

```bash
# GitHub Personal Access Token (required for issue/PR operations)
export GITHUB_TOKEN="ghp_..."

# Or use GitHub CLI authentication
gh auth login
```

---

## Optional Variables

### Model Configuration

```bash
# Default Claude model for all agents
# Values: haiku, sonnet, opus
export AD_SDLC_MODEL="sonnet"

# Override model for specific agent
export AD_SDLC_MODEL_WORKER="opus"
export AD_SDLC_MODEL_CONTROLLER="haiku"
```

### Execution Settings

```bash
# Maximum parallel workers
export AD_SDLC_MAX_WORKERS="5"

# Enable/disable approval gates
export AD_SDLC_APPROVAL_GATES="true"

# Default timeout (milliseconds)
export AD_SDLC_TIMEOUT="300000"
```

### Logging & Debug

```bash
# Enable debug logging
export AD_SDLC_DEBUG="true"

# Log level: debug, info, warn, error
export AD_SDLC_LOG_LEVEL="info"

# Log format: json, text
export AD_SDLC_LOG_FORMAT="json"

# Log file path
export AD_SDLC_LOG_FILE=".ad-sdlc/logs/ad-sdlc.log"
```

### Paths & Directories

```bash
# Project root directory
export AD_SDLC_PROJECT_ROOT="."

# Output directory for documents
export AD_SDLC_OUTPUT_DIR="docs"

# Scratchpad directory
export AD_SDLC_SCRATCHPAD_DIR=".ad-sdlc/scratchpad"

# Configuration directory
export AD_SDLC_CONFIG_DIR=".ad-sdlc/config"
```

### Cloud Provider Authentication

```bash
# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK="1"
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX="1"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"

# Azure Foundry
export CLAUDE_CODE_USE_FOUNDRY="1"
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
```

### Notifications

```bash
# Slack webhook for notifications
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Email SMTP settings
export SMTP_HOST="smtp.example.com"
export SMTP_PORT="587"
export SMTP_USER="..."
export SMTP_PASSWORD="..."
```

---

## Variable Reference Table

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | - | Anthropic API key |
| `GITHUB_TOKEN` | Yes** | - | GitHub access token |
| `AD_SDLC_MODEL` | No | sonnet | Default Claude model |
| `AD_SDLC_MAX_WORKERS` | No | 5 | Max parallel workers |
| `AD_SDLC_APPROVAL_GATES` | No | true | Enable approval gates |
| `AD_SDLC_TIMEOUT` | No | 300000 | Default timeout (ms) |
| `AD_SDLC_DEBUG` | No | false | Enable debug mode |
| `AD_SDLC_LOG_LEVEL` | No | info | Log level |
| `AD_SDLC_LOG_FORMAT` | No | json | Log format |
| `AD_SDLC_PROJECT_ROOT` | No | . | Project root |
| `AD_SDLC_OUTPUT_DIR` | No | docs | Output directory |

*Required unless using cloud provider (Bedrock/Vertex)
**Required for GitHub operations

---

## Usage Examples

### Development Environment

```bash
# .env.development
ANTHROPIC_API_KEY="sk-ant-..."
GITHUB_TOKEN="ghp_..."
AD_SDLC_DEBUG="true"
AD_SDLC_LOG_LEVEL="debug"
AD_SDLC_APPROVAL_GATES="false"
```

### Production Environment

```bash
# .env.production
ANTHROPIC_API_KEY="${SECRETS_ANTHROPIC_KEY}"
GITHUB_TOKEN="${SECRETS_GITHUB_TOKEN}"
AD_SDLC_MODEL="sonnet"
AD_SDLC_LOG_LEVEL="info"
AD_SDLC_LOG_FORMAT="json"
AD_SDLC_APPROVAL_GATES="true"
```

### CI/CD Environment

```yaml
# GitHub Actions
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  AD_SDLC_APPROVAL_GATES: "false"  # No manual approval in CI
  AD_SDLC_MODEL: "haiku"           # Faster for CI
```

---

## Loading Order

1. System environment variables
2. `.env` file in project root
3. `.env.local` file (not committed)
4. `.env.{NODE_ENV}` file (e.g., `.env.production`)

```bash
# Load order example
$ AD_SDLC_MODEL="opus" ad-sdlc run

# Result: opus (CLI env overrides all)
```

---

## Security Best Practices

### Do

- Store API keys in secret managers
- Use `.env.local` for local development (gitignored)
- Rotate tokens regularly
- Use minimal permissions

### Don't

- Commit API keys to git
- Log sensitive values
- Share tokens between environments
- Use production keys in development

### Secure .gitignore

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Credentials
*.pem
*.key
credentials.json
```

---

## Validation

Check environment configuration:

```bash
# Validate all required variables
ad-sdlc config check-env

# Output:
# ✓ ANTHROPIC_API_KEY: set
# ✓ GITHUB_TOKEN: set
# ✓ AD_SDLC_MODEL: sonnet
# ✗ SLACK_WEBHOOK_URL: not set (optional)
```

---

*Part of [Configuration Reference](./README.md)*
