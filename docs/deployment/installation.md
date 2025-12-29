# Installation Guide

> **Purpose**: Installing AD-SDLC

## Installation Methods

### Method 1: npm Global Install (Recommended)

```bash
# Install globally
npm install -g ad-sdlc

# Verify installation
ad-sdlc --version
```

### Method 2: npx (No Install)

```bash
# Run directly without installing
npx ad-sdlc --version

# Initialize project
npx ad-sdlc init

# Run pipeline
npx ad-sdlc run
```

### Method 3: Project Dependency

```bash
# Add to project
npm install ad-sdlc --save-dev

# Add script to package.json
{
  "scripts": {
    "sdlc": "ad-sdlc"
  }
}

# Run via npm
npm run sdlc -- init
npm run sdlc -- run
```

### Method 4: From Source

```bash
# Clone repository
git clone https://github.com/kcenon/claude_code_agent.git
cd claude_code_agent

# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link

# Verify
ad-sdlc --version
```

---

## Post-Installation

### 1. Set Environment Variables

```bash
# Required: Anthropic API Key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Required: GitHub Token (for issue/PR operations)
export GITHUB_TOKEN="ghp_..."
```

Add to shell profile for persistence:

```bash
# ~/.bashrc or ~/.zshrc
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
echo 'export GITHUB_TOKEN="ghp_..."' >> ~/.zshrc
source ~/.zshrc
```

### 2. Initialize Project

```bash
cd your-project
ad-sdlc init
```

This creates:
```
.ad-sdlc/
├── config/
│   ├── workflow.yaml
│   ├── agents.yaml
│   └── mode-detection.yaml
├── scratchpad/
├── templates/
└── logs/
```

### 3. Verify Installation

```bash
ad-sdlc doctor
```

Expected output:
```
AD-SDLC Health Check
====================

Environment:
  ✓ Node.js v20.10.0
  ✓ npm 10.2.3
  ✓ Git 2.42.0

Authentication:
  ✓ ANTHROPIC_API_KEY configured
  ✓ GITHUB_TOKEN configured

Configuration:
  ✓ workflow.yaml valid
  ✓ agents.yaml valid

Ready to run!
```

---

## Troubleshooting

### Command Not Found

```bash
# Check npm global bin is in PATH
npm bin -g

# Add to PATH if needed
export PATH="$PATH:$(npm bin -g)"
```

### Permission Denied

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH="$PATH:$HOME/.npm-global/bin"
```

### Version Conflicts

```bash
# Use specific version
npm install -g ad-sdlc@1.0.0

# Or use npx for one-off
npx ad-sdlc@1.0.0 run
```

---

## Next Steps

- [Configuration Guide](./configuration.md)
- [Verification Guide](./verification.md)

---

*Part of [Deployment Guide](./README.md)*
