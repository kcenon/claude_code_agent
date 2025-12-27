# Configuration and Permissions Guide

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Configuration Hierarchy](#configuration-hierarchy)
2. [Configuration Files](#configuration-files)
3. [Permission System](#permission-system)
4. [Permission Modes](#permission-modes)
5. [Environment Variables](#environment-variables)
6. [Model Settings](#model-settings)
7. [Practical Configuration Examples](#practical-configuration-examples)

---

## Configuration Hierarchy

### Priority (High → Low)

```
1. Enterprise managed settings    ← Organization policy (highest priority)
2. Command-line arguments         ← --model, --allowedTools, etc.
3. Local project settings         ← .claude/settings.local.json
4. Shared project settings        ← .claude/settings.json
5. User settings                  ← ~/.claude/settings.json (lowest priority)
```

### Configuration Scopes

| Scope | File Location | Git Shared | Affects |
|-------|---------------|------------|---------|
| Enterprise | System-managed settings | N/A | Entire organization |
| User | `~/.claude/settings.json` | ❌ | All projects |
| Project | `.claude/settings.json` | ✅ | This project |
| Local | `.claude/settings.local.json` | ❌ | You only, this project |

---

## Configuration Files

### Full settings.json Structure

```json
{
  // Permission settings
  "permissions": {
    "allow": [],
    "deny": [],
    "ask": []
  },

  // Hook settings
  "hooks": {
    "PreToolUse": [],
    "PostToolUse": [],
    "UserPromptSubmit": [],
    "SessionStart": [],
    "SessionEnd": []
  },

  // Environment variables
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true"
  },

  // Model settings
  "model": "claude-opus-4-5-20251101",
  "alwaysThinking": true,

  // Sandbox settings
  "sandbox": {
    "enabled": true,
    "excludedCommands": ["docker"]
  },

  // MCP servers
  "enableAllProjectMcpServers": true,
  "mcp_servers": {},

  // Attribution settings
  "attribution": {
    "commit": "Custom commit message",
    "pr": "Custom PR message"
  },

  // Plugins
  "plugins": []
}
```

### Project Settings Example

**.claude/settings.json:**

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Read(tests/**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(git status:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Read(**/*credential*)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)",
      "Bash(curl:*)",
      "Bash(wget:*)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Write(package.json)",
      "Edit(*.lock)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

### User Settings Example

**~/.claude/settings.json:**

```json
{
  "model": "claude-opus-4-5-20251101",
  "alwaysThinking": true,
  "permissions": {
    "deny": [
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.config/gcloud/**)"
    ]
  }
}
```

---

## Permission System

### Permission Rule Format

```
ToolName(pattern)
```

**Examples:**

```json
{
  "permissions": {
    // Exact path
    "allow": ["Read(src/main.ts)"],

    // Glob pattern
    "allow": ["Read(src/**)"],

    // Command pattern
    "allow": ["Bash(npm run:*)"],

    // Domain restriction
    "allow": ["WebFetch(domain:docs.example.com)"]
  }
}
```

### Pattern Syntax

| Pattern | Meaning | Example |
|---------|---------|---------|
| `*` | Single path segment | `src/*.ts` |
| `**` | All subdirectories | `src/**/*.ts` |
| `{a,b}` | OR | `*.{js,ts}` |
| `:*` | All arguments | `npm run:*` |

### Permission Examples by Tool

```json
{
  "permissions": {
    "allow": [
      // File reading
      "Read(src/**)",
      "Read(tests/**)",
      "Read(package.json)",
      "Read(tsconfig.json)",

      // File modification
      "Edit(src/**)",
      "Edit(tests/**)",

      // File creation
      "Write(src/**)",
      "Write(tests/**)",

      // Command execution
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(yarn:*)",
      "Bash(git:*)",
      "Bash(node:*)",
      "Bash(python:*)",

      // Web access
      "WebFetch(domain:github.com)",
      "WebFetch(domain:npmjs.com)",
      "WebSearch"
    ],
    "deny": [
      // Sensitive files
      "Read(.env*)",
      "Read(**/.git/**)",
      "Read(**/node_modules/**)",
      "Read(**/*secret*)",
      "Read(**/*password*)",
      "Read(**/*credential*)",
      "Read(**/*.pem)",
      "Read(**/*.key)",

      // Dangerous commands
      "Bash(rm -rf:*)",
      "Bash(sudo:*)",
      "Bash(su:*)",
      "Bash(chmod 777:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(dd:*)",
      "Bash(mkfs:*)"
    ],
    "ask": [
      // Actions requiring confirmation
      "Bash(git push:*)",
      "Bash(git rebase:*)",
      "Bash(npm publish:*)",
      "Write(package.json)",
      "Write(*.lock)",
      "Edit(*.lock)"
    ]
  }
}
```

---

## Permission Modes

### Agent SDK Permission Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `default` | Approval required for all actions | Interactive use |
| `acceptEdits` | Auto-approve file edits | Automation, scripts |
| `bypassPermissions` | Bypass all permissions | Full automation (dangerous!) |
| `plan` | Plan only, no execution | Task preview |

### Setting Permission Modes

```python
from claude_agent_sdk import ClaudeAgentOptions

# Default mode (confirm everything)
options = ClaudeAgentOptions(
    permission_mode="default"
)

# Auto-approve file edits
options = ClaudeAgentOptions(
    permission_mode="acceptEdits"
)

# Bypass all permissions (for CI/CD, use with caution!)
options = ClaudeAgentOptions(
    permission_mode="bypassPermissions"
)

# Plan mode (no execution)
options = ClaudeAgentOptions(
    permission_mode="plan"
)
```

### Custom Permission Handler

```python
async def custom_permission_handler(
    tool_name: str,
    input_data: dict,
    context: dict
) -> dict:
    """Custom permission logic"""

    # Block writes to system directories
    if tool_name == "Write":
        path = input_data.get("file_path", "")
        if path.startswith("/system/") or path.startswith("/etc/"):
            return {
                "behavior": "deny",
                "message": "Cannot write to system directories",
                "interrupt": True
            }

    # User confirmation for sensitive commands
    if tool_name == "Bash":
        command = input_data.get("command", "")
        if "push" in command or "deploy" in command:
            # Request user confirmation
            return {
                "behavior": "ask",
                "message": f"Do you want to execute this command? {command}"
            }

    # Allow by default
    return {
        "behavior": "allow",
        "updatedInput": input_data
    }

options = ClaudeAgentOptions(
    can_use_tool=custom_permission_handler
)
```

---

## Environment Variables

### Configuration Methods

**1. settings.json:**

```json
{
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true",
    "API_URL": "https://api.example.com"
  }
}
```

**2. Agent SDK:**

```python
options = ClaudeAgentOptions(
    env={
        "NODE_ENV": "production",
        "API_KEY": os.environ["API_KEY"]  # Reference system env var
    }
)
```

### Handling Sensitive Environment Variables

```python
import os

# Secrets from system environment variables
options = ClaudeAgentOptions(
    env={
        "API_KEY": os.environ["API_KEY"],
        "DB_PASSWORD": os.environ["DB_PASSWORD"]
    }
)

# Never include in settings.json!
```

---

## Model Settings

### Available Models

| Model | ID | Features |
|-------|-----|----------|
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | Highest performance |
| Claude Opus 4 | `claude-opus-4-1` | High performance |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20251101` | Balanced (speed/performance) |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | Balanced |
| Claude Haiku 4 | `claude-haiku-4` | Fastest, simple tasks |

### Model Configuration Methods

**settings.json:**

```json
{
  "model": "claude-opus-4-5-20251101",
  "alwaysThinking": true
}
```

**Agent SDK:**

```python
options = ClaudeAgentOptions(
    model="claude-opus-4-1"
)
```

**Command line:**

```bash
claude -p "Task" --model claude-sonnet-4-5-20251101
```

---

## Practical Configuration Examples

### 1. Frontend Project

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Read(public/**)",
      "Read(tests/**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm:*)",
      "Bash(yarn:*)",
      "Bash(pnpm:*)",
      "Bash(npx:*)",
      "Bash(git:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(node_modules/**)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "npx eslint --fix \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### 2. Backend Project (Python)

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Read(tests/**)",
      "Read(requirements.txt)",
      "Read(pyproject.toml)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(pytest:*)",
      "Bash(poetry:*)",
      "Bash(git:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Read(venv/**)",
      "Read(.venv/**)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "black \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "isort \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### 3. Read-Only Analysis Mode

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch(domain:*.example.com)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Write",
      "Edit",
      "Bash"
    ]
  }
}
```

### 4. CI/CD Automation

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(make:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Bash(git push --force:*)",
      "Bash(rm -rf:*)"
    ]
  }
}
```

---

## Sandbox Settings

### What is Sandbox?

Executes commands in an isolated environment to protect the system.

```json
{
  "sandbox": {
    "enabled": true,
    "excludedCommands": ["docker", "podman"]
  }
}
```

### Disabling Sandbox (Caution!)

```python
options = ClaudeAgentOptions(
    # Disable sandbox for specific commands only
    dangerously_disable_sandbox=True  # Use with extreme caution!
)
```

---

*Previous: [Skills Reference](05_skills.md) | Next: [Security Guide](07_security.md)*
