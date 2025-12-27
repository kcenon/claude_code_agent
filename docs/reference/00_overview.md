# Claude Code Agent Overview

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Getting Started](#getting-started)
5. [Document Structure](#document-structure)

---

## Introduction

### What is Claude Code Agent?

Claude Code Agent is an autonomous software engineering agent powered by Anthropic's Claude AI. It can perform the following tasks:

- **Code Analysis & Understanding**: Codebase exploration, pattern analysis, dependency mapping
- **Code Writing & Modification**: Bug fixes, feature additions, refactoring
- **Test Execution**: Running unit tests, integration tests, and analyzing results
- **Documentation**: Generating API docs, README files, technical documentation
- **External System Integration**: Connecting to databases, APIs, browsers via MCP

### Claude Code vs Agent SDK

| Aspect | Claude Code CLI | Agent SDK |
|--------|-----------------|-----------|
| **Usage** | Interactive CLI tool | Programmatic library |
| **Target Users** | Developers (direct use) | App/service developers |
| **Language Support** | Terminal commands | Python, TypeScript |
| **Customization** | Config files, hooks | Full programmatic control |
| **Deployment** | Local development | Servers, CI/CD, automation |

### Anthropic Client SDK vs Agent SDK

```
┌─────────────────────────────────────────────────────────────────┐
│                      Anthropic Client SDK                        │
│  - Direct API calls                                              │
│  - Manual tool loop implementation required                      │
│  - Low-level control                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Wraps
┌─────────────────────────────────────────────────────────────────┐
│                        Agent SDK                                 │
│  - Autonomous agent loop                                         │
│  - Built-in tool execution                                       │
│  - Session management & context persistence                      │
│  - Hook-based customization                                      │
│  - MCP server integration                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

### Agent Execution Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│   User   │────▶│  Agent SDK  │────▶│  Claude API  │
│  Prompt  │     │   (Agent    │     │   (Model     │
└──────────┘     │    Loop)    │     │  Inference)  │
                 └─────────────┘     └──────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │File Tools│ │Exec Tools│ │MCP Server│
    │ Read/Edit│ │   Bash   │ │ External │
    └──────────┘ └──────────┘ └──────────┘
```

### Agent Loop Details

1. **Receive Prompt**: User submits task request
2. **Tool Decision**: Claude selects required tools
3. **Tool Execution**: SDK executes tools and collects results
4. **Result Analysis**: Claude analyzes results and determines next steps
5. **Iterate or Complete**: Repeat steps 2-4 until task completion

```python
# Agent loop conceptual code
async for message in query(prompt="Find and fix bugs"):
    if message.type == "tool_use":
        # Claude decided to use a tool
        result = execute_tool(message.tool_name, message.input)
        # Results are automatically passed back to Claude
    elif message.type == "result":
        # Task complete
        print(message.result)
```

---

## Core Components

### 1. Built-in Tools

| Category | Tools | Description |
|----------|-------|-------------|
| **File** | Read, Write, Edit, Glob, Grep | File read/write/search |
| **Execution** | Bash, NotebookEdit | Command execution, notebook editing |
| **Web** | WebSearch, WebFetch | Web search and page fetching |
| **Agent** | Task, AskUserQuestion | Subagents, user interaction |
| **Management** | TodoWrite, ListMcpResources | Task management, MCP resources |

### 2. Hook System

Execute custom logic at key points in the agent lifecycle:

| Hook | Timing | Purpose |
|------|--------|---------|
| PreToolUse | Before tool execution | Validation, permission checks |
| PostToolUse | After tool execution | Logging, formatting |
| UserPromptSubmit | On prompt submission | Context addition |
| SessionStart/End | Session start/end | Initialization, cleanup |

### 3. MCP (Model Context Protocol)

Standardized protocol for external system integration:

```
┌───────────────┐     ┌─────────────┐     ┌──────────────┐
│  Agent SDK    │────▶│  MCP Server │────▶│External System│
│               │     │             │     │  - Database  │
│               │     │  - Stdio    │     │  - GitHub    │
│               │     │  - SSE      │     │  - Slack     │
│               │     │  - HTTP     │     │  - Browser   │
└───────────────┘     └─────────────┘     └──────────────┘
```

### 4. Skills

Reusable modular capability units:

```
my-skill/
├── SKILL.md          # Skill definition and instructions
├── reference.md      # Reference documentation
├── examples.md       # Usage examples
└── scripts/
    └── helper.py     # Helper scripts
```

### 5. Permission System

```json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Read(src/**)"],
    "deny": ["Read(.env*)", "Bash(rm -rf:*)"],
    "ask": ["Bash(git push:*)"]
  }
}
```

---

## Getting Started

### Prerequisites

- Node.js 18+ or Python 3.10+
- Anthropic API key
- Claude Code CLI (Agent SDK runtime)

### Installation

```bash
# 1. Install Claude Code CLI
npm install -g @anthropic-ai/claude-code
# or
brew install --cask claude-code

# 2. Install Agent SDK (Python)
pip install claude-agent-sdk

# 2. Install Agent SDK (TypeScript)
npm install @anthropic-ai/claude-agent-sdk
```

### Authentication

```bash
# Method 1: Environment variable
export ANTHROPIC_API_KEY=your-api-key

# Method 2: Claude CLI login
claude login
```

### First Agent

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Analyze the code in src folder and suggest improvements",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep"],
            cwd="/path/to/project"
        )
    ):
        if hasattr(message, "text"):
            print(message.text)

asyncio.run(main())
```

---

## Document Structure

This reference documentation is organized as follows:

| Document | Description |
|----------|-------------|
| [01_agent_sdk.md](01_agent_sdk.md) | Agent SDK detailed guide |
| [02_tools.md](02_tools.md) | Built-in tools reference |
| [03_hooks.md](03_hooks.md) | Hook system guide |
| [04_mcp.md](04_mcp.md) | MCP integration guide |
| [05_skills.md](05_skills.md) | Skills system reference |
| [06_configuration.md](06_configuration.md) | Configuration and permissions guide |
| [07_security.md](07_security.md) | Security considerations |
| [08_patterns.md](08_patterns.md) | Architecture patterns |
| [09_api_reference.md](09_api_reference.md) | API reference |

---

## Official Documentation Links

| Topic | URL |
|-------|-----|
| Agent SDK Overview | https://platform.claude.com/docs/en/agent-sdk/overview |
| Claude Code Docs | https://code.claude.com/docs/en/overview |
| Tool Use Guide | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| MCP Guide | https://code.claude.com/docs/en/mcp |

---

*Next: [Agent SDK Detailed Guide](01_agent_sdk.md)*
