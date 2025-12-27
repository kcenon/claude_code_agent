# Agent SDK Detailed Guide

> **Version**: 1.0.0
> **Based on**: Anthropic Agent SDK Documentation

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Core API](#core-api)
4. [Options Configuration](#options-configuration)
5. [Message Types](#message-types)
6. [Session Management](#session-management)
7. [Subagents](#subagents)
8. [Error Handling](#error-handling)

---

## Overview

### What is Agent SDK?

The Agent SDK provides the same tools, agent loop, and context management capabilities that power Claude Code as a programmatic library.

### Key Features

- **Autonomous Tool Execution**: Claude directly calls tools without manual implementation
- **Session Management**: Conversation context persistence and resumption
- **Streaming Support**: Real-time progress monitoring
- **MCP Integration**: External system connectivity
- **Hook-based Customization**: Lifecycle event interception
- **File Checkpointing**: Change rollback capability

---

## Installation & Setup

### Python Installation

```bash
# Using uv (recommended)
uv init my-agent && cd my-agent
uv add claude-agent-sdk

# Using pip
python3 -m venv .venv
source .venv/bin/activate
pip install claude-agent-sdk
```

### TypeScript Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
# or
yarn add @anthropic-ai/claude-agent-sdk
```

### Runtime Requirements

The Agent SDK uses Claude Code CLI as its runtime:

```bash
# Verify Claude Code CLI installation
claude --version

# Install if not present
npm install -g @anthropic-ai/claude-code
```

### Authentication Setup

```bash
# Method 1: Environment variable (recommended)
export ANTHROPIC_API_KEY=sk-ant-...

# Method 2: Claude CLI login
claude login
```

---

## Core API

### query() - Single-Turn Query

Use for independent tasks:

```python
# Python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find and fix bugs in utils.py",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Glob"],
            permission_mode="acceptEdits"
        )
    ):
        handle_message(message)

asyncio.run(main())
```

```typescript
// TypeScript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix bugs in utils.py",
  options: {
    allowedTools: ["Read", "Edit", "Glob"],
    permissionMode: "acceptEdits"
  }
})) {
  handleMessage(message);
}
```

### ClaudeSDKClient - Multi-Turn Conversations

Use for continuous conversations:

```python
# Python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Edit"],
        permission_mode="acceptEdits"
    )

    async with ClaudeSDKClient(options=options) as client:
        # First question
        await client.query("Read the main application file")
        async for message in client.receive_response():
            print(message)

        # Follow-up question (previous context retained!)
        await client.query("What are the main functions in that file?")
        async for message in client.receive_response():
            print(message)

        # Additional question
        await client.query("Add error handling to the main function")
        async for message in client.receive_response():
            print(message)

asyncio.run(main())
```

```typescript
// TypeScript
import { ClaudeSDKClient } from "@anthropic-ai/claude-agent-sdk";

const client = new ClaudeSDKClient({
  allowedTools: ["Read", "Write", "Edit"],
  permissionMode: "acceptEdits"
});

await client.connect();

// First question
await client.query("Read the main application file");
for await (const message of client.receiveResponse()) {
  console.log(message);
}

// Follow-up question
await client.query("What are the main functions in that file?");
for await (const message of client.receiveResponse()) {
  console.log(message);
}

await client.disconnect();
```

---

## Options Configuration

### ClaudeAgentOptions Complete Reference

```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    # ===== Tool Settings =====
    allowed_tools=["Read", "Edit", "Bash"],       # Allowed tools list
    disallowed_tools=["Bash"],                    # Blocked tools list

    # ===== System Prompt =====
    system_prompt="Act as a senior developer",    # Custom instructions
    # OR use preset:
    system_prompt={
        "type": "preset",
        "preset": "claude_code",                  # Use Claude Code default prompt
        "append": "Additional instructions..."    # Append to preset
    },

    # ===== Permission Settings =====
    permission_mode="acceptEdits",                # Auto-approve file edits
    # Options:
    #   - "default": Approval required for all actions
    #   - "acceptEdits": Auto-approve file edits
    #   - "bypassPermissions": Bypass all permissions (dangerous!)
    #   - "plan": Generate plan only, no execution

    # ===== Model Settings =====
    model="claude-opus-4-1",                      # Model to use

    # ===== Working Directory =====
    cwd="/path/to/project",                       # Set working directory

    # ===== Environment Variables =====
    env={"API_KEY": "value", "DEBUG": "true"},    # Set environment variables

    # ===== Session Management =====
    resume="session-id-123",                      # Resume previous session
    fork_session=True,                            # Fork session (preserve original)
    continue_conversation=True,                   # Continue existing conversation
    max_turns=10,                                 # Maximum conversation turns

    # ===== File Checkpointing =====
    enable_file_checkpointing=True,               # Enable file rollback

    # ===== Hook Settings =====
    hooks={
        "PreToolUse": [...],
        "PostToolUse": [...]
    },

    # ===== Subagents =====
    agents={
        "code-reviewer": AgentDefinition(...),
        "test-runner": AgentDefinition(...)
    },

    # ===== MCP Servers =====
    mcp_servers={
        "postgres": {...},
        "github": {...}
    }
)
```

### TypeScript Options (camelCase)

```typescript
const options = {
  allowedTools: ["Read", "Edit", "Bash"],
  disallowedTools: ["Bash"],
  systemPrompt: "Act as a senior developer",
  permissionMode: "acceptEdits",
  model: "claude-opus-4-1",
  cwd: "/path/to/project",
  env: { API_KEY: "value" },
  resume: "session-id-123",
  forkSession: true,
  maxTurns: 10,
  enableFileCheckpointing: true
};
```

---

## Message Types

### Message Stream Processing

```python
from claude_agent_sdk import (
    query,
    AssistantMessage,
    UserMessage,
    ResultMessage,
    SystemMessage
)

async for message in query(prompt="Perform task", options=options):
    # Process by message type
    if isinstance(message, AssistantMessage):
        # Claude's response
        for block in message.content:
            if hasattr(block, "text"):
                print(f"Text: {block.text}")
            elif hasattr(block, "name"):
                print(f"Tool call: {block.name}")
                print(f"Input: {block.input}")

    elif isinstance(message, UserMessage):
        # Tool result
        for block in message.content:
            if hasattr(block, "tool_use_id"):
                print(f"Tool result: {block.content}")

    elif isinstance(message, ResultMessage):
        # Final result
        if message.subtype == "success":
            print(f"Success! Duration: {message.duration_ms}ms")
            print(f"Cost: ${message.total_cost_usd:.4f}")
        elif message.subtype == "init":
            print(f"Session ID: {message.session_id}")
        else:
            print(f"Finished: {message.subtype}")

    elif isinstance(message, SystemMessage):
        # System message
        print(f"System: {message.content}")
```

### ResultMessage Subtypes

| Subtype | Description |
|---------|-------------|
| `init` | Session initialized (includes session_id) |
| `success` | Task completed successfully |
| `error` | Error occurred |
| `cancelled` | User cancelled |
| `max_turns` | Maximum turns reached |

---

## Session Management

### Resuming Sessions

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    session_id = None

    # First query: capture session ID
    async for message in query(
        prompt="Analyze the authentication module",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"])
    ):
        if hasattr(message, 'session_id') and message.subtype == 'init':
            session_id = message.session_id
            print(f"Session created: {session_id}")

    # Resume session (previous context retained)
    async for message in query(
        prompt="Find all call sites",
        options=ClaudeAgentOptions(
            resume=session_id  # Resume session
        )
    ):
        print(message)

asyncio.run(main())
```

### Session Forking

Fork while preserving original session:

```python
options = ClaudeAgentOptions(
    resume=session_id,
    fork_session=True  # Preserve original, create new branch
)
```

### File Checkpointing (Rollback)

```python
async with ClaudeSDKClient(options=ClaudeAgentOptions(
    enable_file_checkpointing=True,
    allowed_tools=["Read", "Write", "Edit"]
)) as client:
    # Perform changes
    await client.query("Refactor the code")

    user_message_uuid = None
    async for message in client.receive_response():
        if hasattr(message, 'uuid'):
            user_message_uuid = message.uuid

    # Rollback files to that point if needed
    if need_revert:
        await client.rewind_files(user_message_uuid)
```

---

## Subagents

### Defining Subagents

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Task"],  # Task required!
        agents={
            "code-reviewer": AgentDefinition(
                description="Expert in code quality and security analysis",
                prompt="""You are a senior code reviewer.
                Focus on the following:
                1. Code quality and readability
                2. Security vulnerabilities
                3. Performance issues
                4. Best practices compliance""",
                tools=["Read", "Grep", "Glob"],  # Read-only
                model="sonnet"  # Use fast model
            ),
            "test-runner": AgentDefinition(
                description="Expert in test execution and result analysis",
                prompt="""You are a testing specialist.
                Run tests and analyze failure causes.""",
                tools=["Bash", "Read", "Grep"],  # Execution permission
                model="haiku"  # Fastest model
            ),
            "documentation-writer": AgentDefinition(
                description="Technical documentation specialist",
                prompt="Write clear and comprehensive documentation.",
                tools=["Read", "Write", "Edit"]  # Write permission
            )
        }
    )

    async for message in query(
        prompt="""Perform the following tasks:
        1. Use code-reviewer agent to review auth.py
        2. Use test-runner agent to run tests
        3. Use documentation-writer agent to write API docs""",
        options=options
    ):
        print(message)

asyncio.run(main())
```

### AgentDefinition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | When to use (Claude uses for decision) |
| `prompt` | string | Yes | System prompt defining agent behavior |
| `tools` | string[] | No | Allowed tools (inherits all if omitted) |
| `model` | 'sonnet' \| 'opus' \| 'haiku' | No | Model to use |

### Subagent Constraints

- Subagents cannot spawn their own subagents
- Don't include `Task` in subagent's tools array
- `Task` must be in main agent's `allowed_tools`

---

## Error Handling

### Exception Types

```python
from claude_agent_sdk import (
    CLINotFoundError,
    ProcessError,
    AuthenticationError,
    RateLimitError
)

try:
    async for message in query(prompt="Perform task", options=options):
        print(message)

except CLINotFoundError:
    print("Claude Code CLI not installed.")
    print("Run: npm install -g @anthropic-ai/claude-code")

except AuthenticationError:
    print("Authentication failed. Check your API key.")
    print("Run: export ANTHROPIC_API_KEY=your-key")

except RateLimitError as e:
    print(f"Rate limit reached. Retry after {e.retry_after} seconds.")

except ProcessError as e:
    print(f"Process error: {e.stderr}")

except Exception as e:
    print(f"Unexpected error: {e}")
```

### Retry Pattern

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
async def run_agent_with_retry(prompt: str, options: ClaudeAgentOptions):
    results = []
    async for message in query(prompt=prompt, options=options):
        results.append(message)
    return results
```

---

## Streaming vs Batch Mode

### Streaming Mode (Real-time Progress)

```python
# See progress in real-time
async for message in query(prompt="Build project", options=options):
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if hasattr(block, "text"):
                print(block.text, end="", flush=True)
```

### Batch Mode (Collect Results)

```python
# Collect all messages, then process
messages = []
async for message in query(prompt="Build project", options=options):
    messages.append(message)

# Process final result only
final_result = next(
    (m for m in reversed(messages) if isinstance(m, ResultMessage)),
    None
)
if final_result and final_result.subtype == "success":
    print(f"Done! Cost: ${final_result.total_cost_usd:.4f}")
```

---

## Best Practices

### 1. Incremental Tool Expansion

```python
# Start: Read-only (safe)
safe_options = ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep"]
)

# Expand: Add write
write_options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep"]
)

# Advanced: Add execution (caution!)
exec_options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    hooks={"PreToolUse": [validate_bash_command]}  # Validation required
)
```

### 2. Clear System Prompts

```python
good_prompt = """You are a Python code review expert.

Roles:
1. Detect bugs and anti-patterns
2. Suggest readability and performance improvements
3. Check for security vulnerabilities
4. Identify refactoring opportunities

Always be constructive and explain your reasoning."""

bad_prompt = "Review code"  # Too vague
```

### 3. Cost Monitoring

```python
total_cost = 0

async for message in query(prompt="Task", options=options):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        total_cost += message.total_cost_usd
        print(f"Cumulative cost: ${total_cost:.4f}")

        if total_cost > MAX_BUDGET:
            raise Exception("Budget exceeded!")
```

---

*Previous: [Overview](00_overview.md) | Next: [Tools Reference](02_tools.md)*
