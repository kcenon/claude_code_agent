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

| Software | Minimum Version | Check Command |
|----------|----------------|---------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | 2.30+ | `git --version` |

### Optional Software

| Software | Purpose | Check Command |
|----------|---------|---------------|
| GitHub CLI (`gh`) | Issue/PR management | `gh --version` |
| Python | SDK development | `python3 --version` |

### API Access

You need one of the following:

1. **Anthropic API Key** - Get one from [console.anthropic.com](https://console.anthropic.com/)
2. **Claude Subscription** (Max/Pro) - Use `claude login`
3. **Cloud Provider** - AWS Bedrock, Google Vertex AI, or Azure Foundry

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4GB | 8GB+ |
| Disk | 1GB | 5GB+ |
| Network | Broadband | Stable connection |

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
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Windows

Download and run the installer from [nodejs.org](https://nodejs.org/).

### Step 2: Install AD-SDLC CLI

```bash
# Global installation (recommended)
npm install -g ad-sdlc

# Verify installation
ad-sdlc --version
```

Alternatively, use npx without global installation:

```bash
npx ad-sdlc init
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

---

## Configuration

### Step 1: Set API Key

Choose one of the following methods:

#### Option A: Environment Variable (Recommended)

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Or use CLAUDE_API_KEY
export CLAUDE_API_KEY="sk-ant-api03-..."

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
# Expected: ad-sdlc version X.X.X

# Check Node.js
node --version
# Expected: v18.x.x or higher

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

# Run a simple collection
claude "Collect requirements for a simple hello world application"
```

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
# Option 1: Use npx instead
npx ad-sdlc init

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

*Part of [AD-SDLC Documentation](../README.md)*
