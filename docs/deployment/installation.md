# Installation Guide

> **Purpose**: Installing AD-SDLC

## Prerequisites

| Dependency                  | Required | Notes                                                              |
| --------------------------- | -------- | ------------------------------------------------------------------ |
| Node.js 18+                 | Yes      | [Download](https://nodejs.org/)                                    |
| Git 2.30+                   | Yes      |                                                                    |
| `ANTHROPIC_API_KEY`         | Yes      | Required for all pipeline modes                                    |
| `GITHUB_TOKEN` / GitHub CLI | No       | Required for GitHub issue/PR operations; not needed with `--local` |

---

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

### Method 4: Build from Source

Use this method when installing from the GitHub repository directly, or when `npm install -g ad-sdlc` is not available.

```bash
# Clone repository
git clone https://github.com/kcenon/claude_code_agent.git
cd claude_code_agent

# Install dependencies
npm install

# Build
npm run build

# Link globally (makes 'ad-sdlc' available as a system command)
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

# Optional: GitHub Token (required for issue/PR operations; not needed with --local)
export GITHUB_TOKEN="ghp_..."
```

Add to shell profile for persistence:

```bash
# ~/.bashrc or ~/.zshrc
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
echo 'export GITHUB_TOKEN="ghp_..."' >> ~/.zshrc  # optional
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
  ! GITHUB_TOKEN not configured (GitHub features disabled; use --local to run without GitHub)

Configuration:
  ✓ workflow.yaml valid
  ✓ agents.yaml valid

Ready to run!
```

`GITHUB_TOKEN` is only required for GitHub issue creation and PR operations. When running with `--local`, it can be omitted.

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

_Part of [Deployment Guide](./README.md)_
