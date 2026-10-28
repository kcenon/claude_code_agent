# Installation Guide

> **Version**: 1.0.0
> **Estimated Time**: 10-15 minutes

This guide walks you through installing and configuring the AD-SDLC system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before installing AD-SDLC, ensure you have:

### Required Software

| Software | Minimum Version | Check Command    |
| -------- | --------------- | ---------------- |
| Node.js  | 22.22.1+        | `node --version` |
| npm      | 9+              | `npm --version`  |
| Git      | 2.30+           | `git --version`  |

### Optional Software

| Software          | Purpose             | Check Command       |
| ----------------- | ------------------- | ------------------- |
| GitHub CLI (`gh`) | Issue/PR management | `gh --version`      |
| Python            | SDK development     | `python3 --version` |

### API Access

You need one of the following:

1. **Anthropic API Key** - Get one from [console.anthropic.com](https://console.anthropic.com/)
2. **Claude Subscription** (Max/Pro) - Use `claude login`
3. **Cloud Provider** - AWS Bedrock, Google Vertex AI, or Azure Foundry

---

## System Requirements

| Component | Minimum   | Recommended       |
| --------- | --------- | ----------------- |
| CPU       | 2 cores   | 4+ cores          |
| RAM       | 4GB       | 8GB+              |
| Disk      | 1GB       | 5GB+              |
| Network   | Broadband | Stable connection |

### Supported Operating Systems

- **macOS**: 12 (Monterey) or later
- **Linux**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Fedora 36+
- **Windows**: Windows 10 (with WSL2) or Windows 11

---

## Installation

### Step 1: Install Node.js

#### macOS

```bash
# Using Homebrew (recommended)
brew install node

# Or download from nodejs.org
# https://nodejs.org/en/download/
```

#### Linux (Ubuntu/Debian)

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Windows

Download and run the installer from [nodejs.org](https://nodejs.org/).

### Step 2: Install AD-SDLC CLI

AD-SDLC is not published to the npm registry yet, so `npm install -g ad-sdlc` and
`npx ad-sdlc` do not work. Install it from source:

```bash
git clone https://github.com/kcenon/claude_code_agent.git
cd claude_code_agent
npm ci
npm run build

# Put the ad-sdlc command on your PATH (this links to the clone, so keep it in place)
npm install -g .

# Verify installation
ad-sdlc --version
```

Alternatively, run the built CLI from the clone without a global installation:

```bash
node dist/cli.js --help
```

### Step 3: Install GitHub CLI (Optional)

The GitHub CLI enables automatic issue creation and PR management.

#### macOS

```bash
brew install gh
```

#### Linux

```bash
# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

#### Windows

```bash
winget install --id GitHub.cli
```

### Dependencies

`npm ci` installs the runtime dependencies declared in `package.json`. AD-SDLC v0.1 standardizes on the official Claude Agent SDK as the only AI runtime dependency. The legacy raw `@anthropic-ai/sdk` client and the in-tree `AgentBridge`/`AgentDispatcher`/`AgentRegistry` stack were removed in v0.1.0 (#798).

| Package                          | Version    | Role                                                                        |
| -------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `@anthropic-ai/claude-agent-sdk` | `^0.3.301` | Single Agent SDK entry point used by `ExecutionAdapter` for every stage     |
| `commander`                      | `^15.0.0`  | `ad-sdlc` CLI argument parsing                                              |
| `inquirer`                       | `^14.2.3`  | Interactive prompts for `ad-sdlc init`                                      |
| `js-yaml`                        | `^5.5.0`   | Pipeline config and document frontmatter parsing                            |
| `zod`                            | `^4.6.7`   | Runtime schema validation for configs, external data, and checkpoint schema |
| `ts-morph`                       | `^28.0.0`  | TypeScript AST analysis for the Code Reader / Codebase Analyzer agents      |
| `chalk`                          | `^6.0.1`   | CLI output styling                                                          |
| `dotenv`                         | `^18.0.8`  | Environment loading                                                         |

Optional integrations (logging backends, OpenTelemetry exporters, `better-sqlite3`, `ioredis`, `mammoth`, `pdf-parse`) are declared as **optional peer dependencies** so the runtime install stays lean; consumers pull them in only when the matching scratchpad backend or document parser is enabled.

`npm run docs:check` compares this table with `package.json`.

---

## Configuration

### Step 1: Set API Key

Choose one of the following methods:

#### Option A: Environment Variable (Recommended)

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Reload your shell
source ~/.bashrc  # or source ~/.zshrc
```

#### Option B: Claude CLI Login (Subscription Users)

```bash
# Login with your Claude Max/Pro subscription
claude login

# Follow the prompts to authenticate
```

#### Option C: Cloud Provider

```bash
# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"
```

### Step 2: Configure GitHub CLI

```bash
# Authenticate with GitHub
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Login with a web browser (or paste token)

# Verify authentication
gh auth status
```

Stages that talk to GitHub (`pr-reviewer`, `issue-generator`, `ci-fixer`) also need `GITHUB_TOKEN`. Export a Personal Access Token with `repo`-level scope; the team-shared `.mcp.json` interpolates it via `${GITHUB_TOKEN}` and never stores literals. See [MCP configuration](configuration/mcp.md) for setup, scopes, and troubleshooting.

### Step 3: Initialize Your Project

```bash
# Create a new project
mkdir my-project
cd my-project

# Initialize AD-SDLC with interactive wizard
ad-sdlc init

# Or use quick setup
ad-sdlc init --quick
```

---

## Verification

Run these commands to verify your installation:

```bash
# Check AD-SDLC CLI
ad-sdlc --version
# Expected: the version from the installed package.json, such as 0.1.0

# Check Node.js
node --version
# Expected: v22.22.1 or higher

# Check API key (should not show full key)
echo $ANTHROPIC_API_KEY | head -c 10
# Expected: sk-ant-api (first 10 characters)

# Check GitHub CLI (optional)
gh auth status
# Expected: Logged in to github.com as <username>

# Validate project configuration
ad-sdlc validate
# Expected: Configuration is valid
```

### Test Run

Run a simple test to verify the system works:

```bash
# Initialize a test project
ad-sdlc init test-project --quick
cd test-project

# Resolve the pipeline without calling the model (no API key needed)
ad-sdlc run "Build a simple hello world application" --dry-run
```

A live run drops `--dry-run` and needs `ANTHROPIC_API_KEY` or a Claude Code
session; the [Quickstart](quickstart.md) walks through it.

---

## Troubleshooting

### Common Issues

#### Issue: `command not found: ad-sdlc`

**Cause**: npm global bin directory is not in PATH.

**Solution**:

```bash
# Find npm global directory
npm config get prefix

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload shell
source ~/.bashrc
```

#### Issue: `Error: ANTHROPIC_API_KEY not set`

**Cause**: API key is not configured.

**Solution**:

```bash
# Set the API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Or use Claude login
claude login
```

#### Issue: `GitHub CLI not authenticated`

**Cause**: GitHub CLI is not logged in.

**Solution**:

```bash
# Login to GitHub
gh auth login

# Follow the prompts
```

#### Issue: `Permission denied` when installing globally

**Cause**: npm requires elevated permissions for global install.

**Solution**:

```bash
# Option 1: Run the built CLI from the clone instead
node /path/to/claude_code_agent/dist/cli.js init

# Option 2: Configure npm to use a different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Add to ~/.bashrc or ~/.zshrc
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
```

#### Issue: SSL/Network errors

**Cause**: Corporate proxy or firewall.

**Solution**:

```bash
# Set proxy for npm
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Set proxy for curl
export http_proxy=http://proxy.company.com:8080
export https_proxy=http://proxy.company.com:8080
```

### Getting Help

If you encounter issues not covered here:

1. Check the [FAQ](faq.md)
2. Search [existing issues](https://github.com/kcenon/claude_code_agent/issues)
3. Open a [new issue](https://github.com/kcenon/claude_code_agent/issues/new)

---

## Next Steps

After successful installation:

1. **[Quickstart Guide](quickstart.md)** - 5-minute tutorial
2. **[Use Cases](use-cases.md)** - Common scenarios
3. **[Configuration](reference/06_configuration.md)** - Advanced configuration

---

_Part of [AD-SDLC Documentation](../README.md)_
