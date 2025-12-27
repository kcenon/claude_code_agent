# Claude Code Agent Reference Documentation

> **Version**: 1.0.0
> **Last Updated**: 2025-12-26
> **Based on**: Anthropic Official Documentation

## Overview

This documentation provides a comprehensive reference guide for developing AI Agents using Claude Code. Based on Anthropic's official documentation, it covers core concepts including Agent SDK, tools, hooks, MCP integration, and more.

---

## Table of Contents

### Fundamentals

| # | Document | Description |
|---|----------|-------------|
| 00 | [Overview](00_overview.md) | Claude Code Agent introduction and architecture |
| 01 | [Agent SDK](01_agent_sdk.md) | Agent SDK installation, setup, and core APIs |
| 02 | [Tools Reference](02_tools.md) | Built-in tools (Read, Edit, Bash, etc.) details |

### Extensions

| # | Document | Description |
|---|----------|-------------|
| 03 | [Hooks Guide](03_hooks.md) | Customizing agent behavior with hooks |
| 04 | [MCP Integration](04_mcp.md) | External system integration (databases, APIs) |
| 05 | [Skills Reference](05_skills.md) | Defining reusable modular capabilities |

### Operations

| # | Document | Description |
|---|----------|-------------|
| 06 | [Configuration Guide](06_configuration.md) | Permissions, environment variables, model settings |
| 07 | [Security Guide](07_security.md) | Isolation, credential protection, auditing |

### Advanced

| # | Document | Description |
|---|----------|-------------|
| 08 | [Architecture Patterns](08_patterns.md) | Single/multi-agent, workflow patterns |
| 09 | [API Reference](09_api_reference.md) | Messages API, Agent SDK API details |

---

## Quick Start

### 1. Installation

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Install Agent SDK (Python)
pip install claude-agent-sdk

# Install Agent SDK (TypeScript)
npm install @anthropic-ai/claude-agent-sdk
```

### 2. Authentication

```bash
export ANTHROPIC_API_KEY=your-api-key
```

### 3. Your First Agent

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Analyze the code in the src folder",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep"]
        )
    ):
        print(message)

asyncio.run(main())
```

---

## Learning Path

### Beginners

1. [Overview](00_overview.md) - Understand the overall structure
2. [Agent SDK](01_agent_sdk.md) - Basic usage
3. [Tools Reference](02_tools.md) - Working with built-in tools

### Intermediate

4. [Hooks Guide](03_hooks.md) - Customizing behavior
5. [Configuration Guide](06_configuration.md) - Permissions and settings
6. [MCP Integration](04_mcp.md) - External system integration

### Advanced

7. [Security Guide](07_security.md) - Production security
8. [Architecture Patterns](08_patterns.md) - Complex system design
9. [API Reference](09_api_reference.md) - Detailed API information

---

## Use Case References

### Building a Code Analysis Agent

- [Tools: Read, Glob, Grep](02_tools.md#file-tools)
- [Pattern: Single Agent](08_patterns.md#single-agent-patterns)
- [Skill: Code Review](05_skills.md#1-code-review-skill)

### Building a Code Modification Agent

- [Tools: Read, Write, Edit, Bash](02_tools.md)
- [Permission Settings](06_configuration.md#permission-system)
- [Hook: Auto Formatting](03_hooks.md#2-automatic-code-formatting)

### External System Integration

- [MCP Server Setup](04_mcp.md#configuration-methods)
- [SDK MCP Server](04_mcp.md#sdk-mcp-server)
- [Integration Patterns](08_patterns.md#integration-patterns)

### Production Deployment

- [Security Checklist](07_security.md#security-checklist)
- [Isolation Strategies](07_security.md#isolation-strategies)
- [Production Architecture](08_patterns.md#production-architecture)

---

## Key Concepts Summary

### Agent Execution Flow

```
Prompt → Claude selects tools → SDK executes tools → Analyze results → Repeat/Complete
```

### Main Components

| Component | Role |
|-----------|------|
| **Agent SDK** | Agent loop and tool execution |
| **Tools** | File, command, web operations |
| **Hooks** | Lifecycle event interception |
| **MCP** | External system integration |
| **Skills** | Reusable capability modules |
| **Permissions** | Tool access control |

### Permission Modes

| Mode | Description |
|------|-------------|
| `default` | Confirm all actions |
| `acceptEdits` | Auto-approve file edits |
| `bypassPermissions` | Bypass all permissions (dangerous!) |
| `plan` | Plan only, no execution |

---

## Official Resources

| Resource | URL |
|----------|-----|
| Agent SDK Docs | https://platform.claude.com/docs/en/agent-sdk/overview |
| Claude Code Docs | https://code.claude.com/docs/en/overview |
| Tool Use Guide | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| MCP Protocol | https://modelcontextprotocol.io |
| API Reference | https://docs.anthropic.com/en/api |
| Community MCP Servers | https://github.com/modelcontextprotocol/servers |

---

## Language Versions

- **English**: Current document (*.md)
- **Korean**: [Korean version](README.kr.md) (*.kr.md)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-26 | Initial documentation |

---

## Contributing & Feedback

Please file an issue for improvement suggestions or bug reports.

---

*To get started with Claude Code Agent development, begin with the [Overview](00_overview.md).*
