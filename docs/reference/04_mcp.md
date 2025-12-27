# MCP (Model Context Protocol) Integration Guide

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [MCP Overview](#mcp-overview)
2. [Server Types](#server-types)
3. [Configuration Methods](#configuration-methods)
4. [SDK MCP Server](#sdk-mcp-server)
5. [Popular MCP Servers](#popular-mcp-servers)
6. [Practical Examples](#practical-examples)
7. [Troubleshooting](#troubleshooting)

---

## MCP Overview

### What is MCP?

MCP (Model Context Protocol) is a standard protocol for AI agents to communicate with external systems. It enables connecting various tools like databases, APIs, and browsers to Claude.

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Claude    │     │  MCP Server │     │ External System │
│   Agent     │────▶│   (Bridge)  │────▶│  - PostgreSQL   │
│             │◀────│             │◀────│  - GitHub       │
└─────────────┘     └─────────────┘     │  - Slack        │
                                        │  - Browser      │
                                        └─────────────────┘
```

### MCP Server Types

| Type | Connection | Use Case |
|------|------------|----------|
| **Stdio** | Local process | Local CLI tools, scripts |
| **SSE** | HTTP Server-Sent Events | Remote services, real-time streaming |
| **HTTP** | REST API | Simple remote services |
| **SDK** | In-code definition | Custom tools, programmatic control |

---

## Server Types

### 1. Stdio (Standard I/O)

MCP server running as a local process.

```json
{
  "mcp_servers": {
    "postgres": {
      "type": "stdio",
      "command": "mcp-postgres",
      "args": ["--connection-string", "postgresql://user:pass@localhost/db"],
      "env": {
        "DB_TIMEOUT": "30"
      }
    }
  }
}
```

**Advantages:**
- Fast response with local execution
- Configuration via environment variables
- Process isolation

### 2. SSE (Server-Sent Events)

MCP server running on a remote server.

```json
{
  "mcp_servers": {
    "github": {
      "type": "sse",
      "url": "https://github-mcp.example.com/sse",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

**Advantages:**
- Centralized management
- Team sharing
- Real-time streaming

### 3. HTTP

Simple REST-based MCP server.

```json
{
  "mcp_servers": {
    "slack": {
      "type": "http",
      "url": "https://slack-mcp.example.com",
      "headers": {
        "Authorization": "Bearer ${SLACK_TOKEN}"
      }
    }
  }
}
```

---

## Configuration Methods

### Configuration File Locations

| Scope | File | Description |
|-------|------|-------------|
| Project | `.mcp.json` | Project-specific MCP servers |
| User | `~/.claude.json` | Global MCP servers |
| settings.json | `mcp_servers` key | Agent SDK configuration |

### .mcp.json Format

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### Enabling MCP in settings.json

```json
{
  "enableAllProjectMcpServers": true,
  "mcp_servers": {
    "custom-server": {
      "type": "stdio",
      "command": "./my-mcp-server"
    }
  }
}
```

### Configuration in Agent SDK

```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(
    mcp_servers={
        "postgres": {
            "type": "stdio",
            "command": "mcp-postgres",
            "args": ["--connection-string", "postgresql://..."]
        },
        "github": {
            "type": "sse",
            "url": "https://github-mcp.example.com/sse",
            "headers": {"Authorization": f"Bearer {GITHUB_TOKEN}"}
        }
    },
    allowed_tools=["Task", "ListMcpResources", "ReadMcpResource"]
)
```

---

## SDK MCP Server

### Defining Custom Tools

You can define MCP tools directly in code.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions
from typing import Any

# Define tools with @tool decorator
@tool(
    name="get_weather",
    description="Get current weather information for a specific location",
    input_schema={
        "location": str,
        "units": str  # "celsius" or "fahrenheit"
    }
)
async def get_weather(args: dict[str, Any]) -> dict[str, Any]:
    """Weather API call (example)"""
    location = args["location"]
    units = args.get("units", "celsius")

    # Actual API call logic
    weather_data = await fetch_weather_api(location, units)

    return {
        "content": [{
            "type": "text",
            "text": f"{location} weather: {weather_data['temp']}°{units[0].upper()}"
        }]
    }

@tool(
    name="send_notification",
    description="Send a notification to the user",
    input_schema={
        "message": str,
        "channel": str,
        "priority": str
    }
)
async def send_notification(args: dict[str, Any]) -> dict[str, Any]:
    """Send notification"""
    message = args["message"]
    channel = args.get("channel", "default")
    priority = args.get("priority", "normal")

    # Notification sending logic
    result = await notification_service.send(message, channel, priority)

    return {
        "content": [{
            "type": "text",
            "text": f"Notification sent: {result['id']}"
        }]
    }

# Create MCP server
utility_server = create_sdk_mcp_server(
    name="utilities",
    version="1.0.0",
    tools=[get_weather, send_notification]
)

# Use in agent
async def main():
    options = ClaudeAgentOptions(
        mcp_servers={"utils": utility_server},
        allowed_tools=[
            "mcp__utils__get_weather",
            "mcp__utils__send_notification",
            "Task"
        ]
    )

    async for message in query(
        prompt="Check the weather in San Francisco and send a Slack notification",
        options=options
    ):
        print(message)
```

### Tool Schema Definition

```python
# Complex input schema
@tool(
    name="create_issue",
    description="Create a GitHub issue",
    input_schema={
        "title": str,
        "body": str,
        "labels": list[str],    # List type
        "assignees": list[str],
        "milestone": int | None  # Optional
    }
)
async def create_issue(args: dict[str, Any]) -> dict[str, Any]:
    # Issue creation logic
    pass
```

---

## Popular MCP Servers

### Official MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | File system access |
| PostgreSQL | `mcp-postgres` | PostgreSQL queries |
| Memory | `@modelcontextprotocol/server-memory` | Session-to-session memory persistence |

### Community MCP Servers

| Server | Purpose |
|--------|---------|
| Playwright | Browser automation |
| GitHub | Repository management, PRs, issues |
| Slack | Messages, channel management |
| Notion | Pages, databases |
| Linear | Issue tracking |
| AWS | AWS service integration |

More servers: https://github.com/modelcontextprotocol/servers

### Configuration Examples

**Filesystem:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-filesystem",
        "/home/user/documents",
        "/home/user/projects"
      ]
    }
  }
}
```

**PostgreSQL:**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["mcp-postgres"],
      "env": {
        "PGHOST": "localhost",
        "PGPORT": "5432",
        "PGUSER": "admin",
        "PGPASSWORD": "${PGPASSWORD}",
        "PGDATABASE": "myapp"
      }
    }
  }
}
```

**Playwright (Browser):**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-playwright"],
      "env": {
        "BROWSER": "chromium",
        "HEADLESS": "true"
      }
    }
  }
}
```

---

## Practical Examples

### 1. Database Agent

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def database_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "postgres": {
                "type": "stdio",
                "command": "mcp-postgres",
                "args": ["--connection-string", DB_URL]
            }
        },
        allowed_tools=["Task", "ListMcpResources", "ReadMcpResource"],
        system_prompt="""You are a database expert.
        Generate and execute SQL queries based on user requests.
        Always execute only safe queries."""
    )

    async for message in query(
        prompt="Query the top 10 customers by orders in the last 30 days",
        options=options
    ):
        print(message)
```

### 2. GitHub + Slack Integration

```python
async def devops_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "github": {
                "type": "sse",
                "url": GITHUB_MCP_URL,
                "headers": {"Authorization": f"Bearer {GITHUB_TOKEN}"}
            },
            "slack": {
                "type": "http",
                "url": SLACK_MCP_URL,
                "headers": {"Authorization": f"Bearer {SLACK_TOKEN}"}
            }
        },
        allowed_tools=["Task"],
        system_prompt="""DevOps agent.
        Check GitHub PRs and send notifications to Slack."""
    )

    async for message in query(
        prompt="Check today's merged PRs and summarize them in #dev channel",
        options=options
    ):
        print(message)
```

### 3. Browser Automation

```python
async def web_scraper_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "playwright": {
                "type": "stdio",
                "command": "npx",
                "args": ["@anthropic-ai/mcp-playwright"]
            }
        },
        allowed_tools=["Task", "Read", "Write"]
    )

    async for message in query(
        prompt="""Collect pricing information from example.com
        and save it to prices.json""",
        options=options
    ):
        print(message)
```

### 4. Multi MCP Server Combination

```python
async def full_stack_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            # Database
            "db": {
                "type": "stdio",
                "command": "mcp-postgres",
                "args": ["--connection-string", DB_URL]
            },
            # File system
            "fs": {
                "type": "stdio",
                "command": "npx",
                "args": ["@modelcontextprotocol/server-filesystem", "./data"]
            },
            # Memory (session-to-session state persistence)
            "memory": {
                "type": "stdio",
                "command": "npx",
                "args": ["@modelcontextprotocol/server-memory"]
            },
            # Custom tools
            "custom": custom_mcp_server
        },
        allowed_tools=["Task", "Read", "Write", "Bash"]
    )

    async for message in query(
        prompt="""1. Query analysis data from database
        2. Save results as CSV
        3. Store analysis summary in memory""",
        options=options
    ):
        print(message)
```

---

## Troubleshooting

### Common Issues

**1. MCP Server Connection Failure**

```bash
# Verify server execution
npx @modelcontextprotocol/server-filesystem /path

# Check permissions
chmod +x ./my-mcp-server
```

**2. Environment Variables Not Applied**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "mcp-postgres",
      "env": {
        "PGPASSWORD": "${PGPASSWORD}"  // Reference shell environment variable
      }
    }
  }
}
```

**3. Tools Not Visible**

```python
# Verify MCP tools included in allowed_tools
options = ClaudeAgentOptions(
    mcp_servers={"my-server": {...}},
    allowed_tools=[
        "mcp__my-server__tool_name",  # MCP tool name format
        "Task",
        "ListMcpResources"
    ]
)
```

**4. SSE Connection Timeout**

```json
{
  "mcp_servers": {
    "remote": {
      "type": "sse",
      "url": "https://...",
      "timeout": 30000,  // Increase timeout (ms)
      "retry_count": 3
    }
  }
}
```

### Debugging Tips

```python
# Check MCP resource list
async for message in query(
    prompt="Use ListMcpResources tool to show available resources",
    options=options
):
    print(message)
```

```bash
# Check logs (Claude Code CLI)
claude --verbose

# Test MCP server directly
echo '{"method":"list_tools"}' | npx @modelcontextprotocol/server-filesystem /path
```

---

## Security Considerations

### Credential Protection

```python
import os

# Load secrets from environment variables
options = ClaudeAgentOptions(
    mcp_servers={
        "github": {
            "type": "sse",
            "url": os.environ["GITHUB_MCP_URL"],
            "headers": {
                "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"
            }
        }
    }
)
```

### Permission Restriction

```python
# Allow only read-only MCP tools
options = ClaudeAgentOptions(
    mcp_servers={...},
    allowed_tools=[
        "mcp__db__query",       # Query only
        "ListMcpResources",
        "ReadMcpResource"
        # mcp__db__execute excluded (block writes)
    ]
)
```

### Network Isolation

```bash
# Run MCP server in Docker (network restricted)
docker run --network none \
  -v /data:/data:ro \
  my-mcp-server
```

---

*Previous: [Hooks Guide](03_hooks.md) | Next: [Skills Reference](05_skills.md)*
