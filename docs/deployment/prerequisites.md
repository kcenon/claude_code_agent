# Prerequisites

> **Purpose**: System requirements for AD-SDLC

## System Requirements

### Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | 18.0+ | 20.0+ |
| **npm** | 9.0+ | 10.0+ |
| **Memory** | 4GB RAM | 8GB+ RAM |
| **Disk** | 1GB free | 5GB+ free |
| **Network** | Stable internet | Low latency |

### Operating Systems

| OS | Support | Notes |
|----|---------|-------|
| **macOS** | Full | 12.0+ (Monterey) |
| **Linux** | Full | Ubuntu 20.04+, Debian 11+ |
| **Windows** | Full | Windows 10+, WSL2 recommended |

---

## Required Software

### Node.js

```bash
# Check version
node --version  # Should be v18.0.0 or higher

# Install via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Or via package manager
# macOS
brew install node@20

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows
winget install OpenJS.NodeJS.LTS
```

### Git

```bash
# Check version
git --version  # Should be 2.0+

# Install
# macOS
brew install git

# Ubuntu/Debian
sudo apt-get install git

# Windows
winget install Git.Git
```

### GitHub CLI (Optional but Recommended)

```bash
# Check version
gh --version

# Install
# macOS
brew install gh

# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Windows
winget install GitHub.cli

# Authenticate
gh auth login
```

---

## Required Accounts

### Anthropic API

1. Create account at [console.anthropic.com](https://console.anthropic.com)
2. Generate API key
3. Set environment variable:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-api03-..."
   ```

### GitHub (for Issue/PR Management)

1. Create [Personal Access Token](https://github.com/settings/tokens)
2. Required scopes:
   - `repo` (Full repository access)
   - `workflow` (If using GitHub Actions)
3. Set environment variable:
   ```bash
   export GITHUB_TOKEN="ghp_..."
   ```

---

## Verification Script

```bash
#!/bin/bash
# verify-prerequisites.sh

echo "Checking AD-SDLC prerequisites..."

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "✓ Node.js: $(node --version)"
    else
        echo "✗ Node.js: $(node --version) (requires v18+)"
    fi
else
    echo "✗ Node.js: not installed"
fi

# npm
if command -v npm &> /dev/null; then
    echo "✓ npm: $(npm --version)"
else
    echo "✗ npm: not installed"
fi

# Git
if command -v git &> /dev/null; then
    echo "✓ Git: $(git --version | cut -d' ' -f3)"
else
    echo "✗ Git: not installed"
fi

# GitHub CLI
if command -v gh &> /dev/null; then
    echo "✓ GitHub CLI: $(gh --version | head -n1 | cut -d' ' -f3)"
else
    echo "○ GitHub CLI: not installed (optional)"
fi

# API Key
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "✓ ANTHROPIC_API_KEY: set"
else
    echo "✗ ANTHROPIC_API_KEY: not set"
fi

# GitHub Token
if [ -n "$GITHUB_TOKEN" ]; then
    echo "✓ GITHUB_TOKEN: set"
else
    echo "✗ GITHUB_TOKEN: not set"
fi

echo ""
echo "Prerequisites check complete."
```

Run the script:

```bash
chmod +x verify-prerequisites.sh
./verify-prerequisites.sh
```

---

## Next Steps

- [Installation Guide](./installation.md)
- [Configuration Guide](./configuration.md)

---

*Part of [Deployment Guide](./README.md)*
