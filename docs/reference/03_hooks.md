# Hooks System Guide

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Hooks Overview](#hooks-overview)
2. [Hook Events](#hook-events)
3. [Hook Configuration](#hook-configuration)
4. [Hook Types](#hook-types)
5. [Input/Output Formats](#inputoutput-formats)
6. [Practical Examples](#practical-examples)
7. [Best Practices](#best-practices)

---

## Hooks Overview

### What are Hooks?

Hooks are user-defined shell commands that execute at specific points in Claude Code's lifecycle. They provide deterministic and predictable behavior control.

### Why Use Hooks?

| Use Case | Description |
|----------|-------------|
| **Validation** | Block dangerous commands before execution |
| **Automation** | Auto-format/lint after file save |
| **Auditing** | Log all tool usage |
| **Context** | Automatically add information to prompts |
| **Cleanup** | Clean up temporary files on session end |

### Hooks vs LLM Judgment

```
┌─────────────────────────────────────────────────────────────┐
│                   Deterministic Validation                   │
│  Hook: "Block any command containing rm -rf"                 │
│  → Always same result, 100% predictable                      │
└─────────────────────────────────────────────────────────────┘
                         vs
┌─────────────────────────────────────────────────────────────┐
│                      LLM Judgment                            │
│  System prompt: "Avoid dangerous commands"                   │
│  → Different judgments per situation, bypass possible        │
└─────────────────────────────────────────────────────────────┘
```

---

## Hook Events

### Event List

| Event | Timing | Blockable | Primary Purpose |
|-------|--------|-----------|-----------------|
| `PreToolUse` | Before tool execution | ✅ | Command validation, permission checks, input modification |
| `PostToolUse` | After tool execution | ❌ | Auto-formatting, logging, result processing |
| `UserPromptSubmit` | On prompt submission | ✅ | Input validation, context addition |
| `PermissionRequest` | On permission dialog display | ✅ | Auto-approve/deny |
| `SessionStart` | On session start/resume | ❌ | Environment initialization, context loading |
| `SessionEnd` | On session end | ❌ | Cleanup, logging, state saving |
| `Notification` | On notification dispatch | ❌ | Custom notifications |
| `Stop` | On response completion | ✅* | Decide whether to continue |
| `SubagentStop` | On subagent completion | ✅* | Evaluate subagent |
| `PreCompact` | Before context compaction | ❌ | Pre-compact processing |

*Stop/SubagentStop can send "continue" signals

### Event Flow Diagram

```
SessionStart
     ↓
UserPromptSubmit ─────────────────────────────────┐
     ↓                                             │
PreToolUse ─────→ [Tool Execution] ─────→ PostToolUse  │
     ↓                                     ↓       │
[Blocked?]                              [Repeat?] ───┘
     ↓ No                                  ↓ No
[Tool Execution]                         Stop
     ↓                                     ↓
PostToolUse                          [Continue?] ─→ UserPromptSubmit
     ↓                                     ↓ No
   ...                                SessionEnd
```

---

## Hook Configuration

### Configuration Locations

| Scope | File | Shared | Priority |
|-------|------|--------|----------|
| User | `~/.claude/settings.json` | Personal | Low |
| Project | `.claude/settings.json` | Git shared | Medium |
| Local | `.claude/settings.local.json` | Personal | High |

### Basic Configuration Structure

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validator.sh"
          }
        ]
      }
    ],
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
  }
}
```

### Matcher Patterns

```json
// Match specific tool
"matcher": "Bash"

// OR condition (pipe)
"matcher": "Edit|Write"

// All tools (omit matcher)
{
  "hooks": [{ "type": "command", "command": "..." }]
}

// Regex pattern
"matcher": "Bash\\(npm.*\\)"
```

---

## Hook Types

### 1. Command Hook

Executes shell commands.

```json
{
  "type": "command",
  "command": "/path/to/script.sh"
}
```

**Features:**
- Fast and deterministic
- Receives JSON via stdin
- Returns result via exit code
- Access to environment variables

### 2. Prompt Hook

Sends context to LLM for evaluation.

```json
{
  "type": "prompt",
  "prompt": "Evaluate whether this command might affect the production environment"
}
```

**Supported Events:**
- `Stop`, `SubagentStop`
- `UserPromptSubmit`
- `PreToolUse`
- `PermissionRequest`

**Features:**
- Context-aware decisions
- Slower than command hooks
- Can handle complex rules

---

## Input/Output Formats

### Input (stdin)

Hooks receive JSON via stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.json",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm run build"
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_PROJECT_DIR` | Project root directory |
| `CLAUDE_FILE_PATH` | Related file path (for Edit/Write) |
| `CLAUDE_SESSION_ID` | Current session ID |

### Output (stdout/exit code)

**Exit Codes:**

| Code | Meaning |
|------|---------|
| 0 | Success, continue |
| 2 | Block (PreToolUse, PermissionRequest) |
| Other | Error (logged, continue) |

**JSON Output (optional):**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Dangerous command detected"
  }
}
```

### PreToolUse Output Options

```json
// Block
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Reason"
  }
}

// Allow (with input modification)
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "command": "npm run build -- --safe-mode"
    }
  }
}

// Tool replacement
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "replace",
    "tool": {
      "name": "SafeBash",
      "input": { "command": "..." }
    }
  }
}
```

---

## Practical Examples

### 1. Block Dangerous Commands

**validate_bash.sh:**

```bash
#!/bin/bash

# Read JSON from stdin
input=$(cat)

# Extract command
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Check dangerous patterns
dangerous_patterns=(
    "rm -rf /"
    "rm -rf ~"
    "dd if=/dev/zero"
    ":(){:|:&};:"
    "mkfs"
    "> /dev/sd"
)

for pattern in "${dangerous_patterns[@]}"; do
    if [[ "$command" == *"$pattern"* ]]; then
        echo "{
            \"hookSpecificOutput\": {
                \"hookEventName\": \"PreToolUse\",
                \"permissionDecision\": \"deny\",
                \"permissionDecisionReason\": \"Dangerous command blocked: $pattern\"
            }
        }"
        exit 2
    fi
done

# Allow
exit 0
```

**Configuration:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate_bash.sh"
          }
        ]
      }
    ]
  }
}
```

### 2. Automatic Code Formatting

```json
{
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
  }
}
```

### 3. Log All Tool Usage

**audit_logger.py:**

```python
#!/usr/bin/env python3
import sys
import json
from datetime import datetime

# Read JSON from stdin
input_data = json.load(sys.stdin)

# Create log entry
log_entry = {
    "timestamp": datetime.now().isoformat(),
    "session_id": input_data.get("session_id"),
    "event": input_data.get("hook_event_name"),
    "tool": input_data.get("tool_name"),
    "input": input_data.get("tool_input")
}

# Append to file
with open("/var/log/claude-audit.jsonl", "a") as f:
    f.write(json.dumps(log_entry) + "\n")

# Continue
sys.exit(0)
```

### 4. Protect Sensitive Files

**protect_files.sh:**

```bash
#!/bin/bash

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

# Protected file/directory patterns
protected_patterns=(
    ".env"
    ".env.*"
    "**/secrets/**"
    "**/credentials/**"
    "**/*.pem"
    "**/*.key"
)

for pattern in "${protected_patterns[@]}"; do
    if [[ "$file_path" == $pattern ]]; then
        echo "{
            \"hookSpecificOutput\": {
                \"hookEventName\": \"PreToolUse\",
                \"permissionDecision\": \"deny\",
                \"permissionDecisionReason\": \"Protected file: $file_path\"
            }
        }"
        exit 2
    fi
done

exit 0
```

### 5. Using Hooks in Agent SDK

```python
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher, HookContext
from typing import Any

async def validate_bash_command(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: HookContext
) -> dict[str, Any]:
    """Bash command validation hook"""
    if input_data.get('tool_name') == 'Bash':
        command = input_data['tool_input'].get('command', '')

        # Check dangerous patterns
        dangerous = ['rm -rf /', 'dd if=/dev/zero', ':(){']
        for pattern in dangerous:
            if pattern in command:
                return {
                    'hookSpecificOutput': {
                        'hookEventName': 'PreToolUse',
                        'permissionDecision': 'deny',
                        'permissionDecisionReason': f'Dangerous command: {pattern}'
                    }
                }
    return {}

async def log_tool_usage(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: HookContext
) -> dict[str, Any]:
    """Tool usage logging hook"""
    import logging
    logging.info(f"Tool used: {input_data.get('tool_name')}")
    return {}

# Configure hooks in options
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Bash"],
    hooks={
        'PreToolUse': [
            HookMatcher(matcher='Bash', hooks=[validate_bash_command])
        ],
        'PostToolUse': [
            HookMatcher(hooks=[log_tool_usage])  # All tools
        ]
    }
)
```

---

## Best Practices

### 1. Security First

```bash
# Restrict hook script permissions
chmod 700 .claude/hooks/*.sh

# Never log sensitive information
# BAD: echo "$input" >> log.txt  (may contain API keys)
# GOOD: Extract only needed fields with jq
```

### 2. Fast Execution

```bash
# Run heavy tasks in background
heavy_task &

# Only synchronous for fast validation
exit 0
```

### 3. Error Handling

```bash
#!/bin/bash
set -e  # Exit immediately on error

# Error handler
trap 'echo "Hook execution error: $?" >&2' ERR

# Logic...
```

### 4. Testability

```bash
# Write for standalone execution
if [[ -z "$1" ]]; then
    input=$(cat)
else
    input=$(cat "$1")  # Input from file
fi
```

### 5. Documentation

```bash
#!/bin/bash
# =============================================================================
# validate_bash.sh
#
# Purpose: Check dangerous patterns before Bash command execution
# Event: PreToolUse
# Matcher: Bash
#
# Blocked commands:
#   - rm -rf /
#   - dd if=/dev/zero
#   - fork bomb
# =============================================================================
```

### 6. Hook Chain Order

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "./1_validate.sh" },
          { "type": "command", "command": "./2_log.sh" },
          { "type": "command", "command": "./3_modify.sh" }
        ]
      }
    ]
  }
}
```

Hooks execute in order; if any returns exit 2, execution stops.

---

*Previous: [Tools Reference](02_tools.md) | Next: [MCP Integration](04_mcp.md)*
