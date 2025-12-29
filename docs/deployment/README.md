# Deployment Guide

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

## Overview

This section covers deploying and running AD-SDLC in various environments.

---

## Quick Start

```bash
# 1. Install
npm install -g ad-sdlc

# 2. Configure
export ANTHROPIC_API_KEY="sk-ant-..."
export GITHUB_TOKEN="ghp_..."

# 3. Initialize project
cd your-project
ad-sdlc init

# 4. Run
ad-sdlc run
```

---

## Deployment Options

| Method | Use Case | Guide |
|--------|----------|-------|
| **CLI (Global)** | Local development | [Installation](./installation.md) |
| **npx** | One-off usage | [Installation](./installation.md) |
| **Docker** | Isolated/CI | [Docker Guide](../guides/deployment.md) |
| **CI/CD** | Automated pipelines | [CI/CD Guide](../guides/deployment.md) |

---

## Documentation

- [Prerequisites](./prerequisites.md) - System requirements
- [Installation](./installation.md) - Installation methods
- [Configuration](./configuration.md) - Post-install setup
- [Verification](./verification.md) - Testing your installation

---

*Part of [AD-SDLC Documentation](../README.md)*
