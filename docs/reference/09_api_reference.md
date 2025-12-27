# API Reference

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Messages API](#messages-api)
2. [Agent SDK API](#agent-sdk-api)
3. [Tool Schemas](#tool-schemas)
4. [Response Formats](#response-formats)
5. [Error Codes](#error-codes)
6. [Model Information](#model-information)

---

## Messages API

### Basic Request

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-5-20251101",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude"}
    ]
)
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID |
| `messages` | array | Yes | Array of conversation messages |
| `max_tokens` | integer | Yes | Maximum output tokens |
| `system` | string | No | System prompt |
| `temperature` | float | No | 0-1, response diversity |
| `top_p` | float | No | 0-1, cumulative probability sampling |
| `top_k` | integer | No | Consider only top k tokens |
| `tools` | array | No | Available tool definitions |
| `tool_choice` | object | No | Tool selection control |
| `stream` | boolean | No | Enable streaming |

### Message Format

```python
messages = [
    # Text message
    {"role": "user", "content": "Hello"},

    # Multimodal message
    {
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64_data
                }
            },
            {"type": "text", "text": "Describe this image"}
        ]
    },

    # Including tool results
    {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": "tool_123",
                "content": "Tool execution result"
            }
        ]
    }
]
```

### Response Format

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-5-20251101",
  "content": [
    {
      "type": "text",
      "text": "Response text"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150
  }
}
```

### Streaming

```python
with client.messages.stream(
    model="claude-sonnet-4-5-20251101",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### Streaming Events

| Event | Description |
|-------|-------------|
| `message_start` | Message start |
| `content_block_start` | Content block start |
| `content_block_delta` | Content incremental update |
| `content_block_stop` | Content block end |
| `message_delta` | Message metadata update |
| `message_stop` | Message end |

---

## Agent SDK API

### query()

Executes a single-turn agent query.

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Perform task",
    options=ClaudeAgentOptions(...)
):
    # Process message
    pass
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Prompt to send to the agent |
| `options` | ClaudeAgentOptions | No | Agent configuration |

### ClaudeAgentOptions

```python
@dataclass
class ClaudeAgentOptions:
    # Tool settings
    allowed_tools: list[str] = None      # Allowed tools
    disallowed_tools: list[str] = None   # Blocked tools

    # System prompt
    system_prompt: str | dict = None     # System prompt

    # Permissions
    permission_mode: str = "default"      # default|acceptEdits|bypassPermissions|plan
    can_use_tool: Callable = None        # Custom permission handler

    # Model
    model: str = None                    # Model ID

    # Environment
    cwd: str = None                      # Working directory
    env: dict[str, str] = None           # Environment variables

    # Session
    resume: str = None                   # Resume by session ID
    fork_session: bool = False           # Fork session
    continue_conversation: bool = False  # Continue conversation
    max_turns: int = None                # Maximum turns

    # Checkpointing
    enable_file_checkpointing: bool = False  # Enable file rollback

    # Hooks
    hooks: dict = None                   # Hook configuration

    # Subagents
    agents: dict[str, AgentDefinition] = None  # Subagent definitions

    # MCP
    mcp_servers: dict = None             # MCP server configuration
```

### ClaudeSDKClient

Client for multi-turn conversations.

```python
from claude_agent_sdk import ClaudeSDKClient

async with ClaudeSDKClient(options=options) as client:
    await client.query("First question")
    async for msg in client.receive_response():
        print(msg)

    await client.query("Follow-up question")
    async for msg in client.receive_response():
        print(msg)
```

**Methods:**

| Method | Description |
|--------|-------------|
| `connect()` | Connect session |
| `disconnect()` | End session |
| `query(prompt)` | Send prompt |
| `receive_response()` | Receive response (AsyncIterator) |
| `rewind_files(uuid)` | Rewind files to specific checkpoint |

### AgentDefinition

Defines subagents.

```python
from claude_agent_sdk import AgentDefinition

agent = AgentDefinition(
    description="Agent description (when to use)",
    prompt="Agent behavior definition",
    tools=["Read", "Grep", "Glob"],  # Optional
    model="sonnet"  # Optional: sonnet|opus|haiku
)
```

### HookMatcher

Defines hook matching rules.

```python
from claude_agent_sdk import HookMatcher

matcher = HookMatcher(
    matcher="Bash|Edit",  # Regex pattern (optional)
    hooks=[hook_function1, hook_function2]
)
```

---

## Tool Schemas

### Tool Definition Format

```python
tool_definition = {
    "name": "get_weather",
    "description": "Get weather information for a specific location",
    "input_schema": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name (e.g., Seoul, New York)"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Temperature unit"
            }
        },
        "required": ["location"]
    }
}
```

### Built-in Tool Schemas

#### Read

```json
{
  "name": "Read",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "Absolute path to the file to read"},
      "offset": {"type": "number", "description": "Starting line number"},
      "limit": {"type": "number", "description": "Number of lines to read"}
    },
    "required": ["file_path"]
  }
}
```

#### Write

```json
{
  "name": "Write",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "Absolute path to the file"},
      "content": {"type": "string", "description": "Content to write to the file"}
    },
    "required": ["file_path", "content"]
  }
}
```

#### Edit

```json
{
  "name": "Edit",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "Absolute path to the file"},
      "old_string": {"type": "string", "description": "Original text to replace"},
      "new_string": {"type": "string", "description": "New text"},
      "replace_all": {"type": "boolean", "default": false}
    },
    "required": ["file_path", "old_string", "new_string"]
  }
}
```

#### Bash

```json
{
  "name": "Bash",
  "input_schema": {
    "type": "object",
    "properties": {
      "command": {"type": "string", "description": "Command to execute"},
      "timeout": {"type": "number", "description": "Timeout in milliseconds"},
      "run_in_background": {"type": "boolean", "default": false},
      "description": {"type": "string", "description": "Command description"}
    },
    "required": ["command"]
  }
}
```

#### Grep

```json
{
  "name": "Grep",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": {"type": "string", "description": "Regex pattern to search"},
      "path": {"type": "string", "description": "Search path"},
      "glob": {"type": "string", "description": "File filter (e.g., *.js)"},
      "type": {"type": "string", "description": "File type (js, py, etc.)"},
      "output_mode": {"type": "string", "enum": ["content", "files_with_matches", "count"]},
      "-i": {"type": "boolean", "description": "Case insensitive"},
      "-A": {"type": "number", "description": "Lines after match"},
      "-B": {"type": "number", "description": "Lines before match"},
      "-C": {"type": "number", "description": "Context lines"}
    },
    "required": ["pattern"]
  }
}
```

#### Glob

```json
{
  "name": "Glob",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": {"type": "string", "description": "Glob pattern"},
      "path": {"type": "string", "description": "Starting directory for search"}
    },
    "required": ["pattern"]
  }
}
```

#### Task

```json
{
  "name": "Task",
  "input_schema": {
    "type": "object",
    "properties": {
      "prompt": {"type": "string", "description": "Task to perform"},
      "description": {"type": "string", "description": "Task description (3-5 words)"},
      "subagent_type": {"type": "string", "description": "Agent type"},
      "model": {"type": "string", "enum": ["sonnet", "opus", "haiku"]},
      "resume": {"type": "string", "description": "Agent ID to resume"},
      "run_in_background": {"type": "boolean", "default": false}
    },
    "required": ["prompt", "description", "subagent_type"]
  }
}
```

---

## Response Formats

### Message Types

```python
from claude_agent_sdk import (
    AssistantMessage,
    UserMessage,
    SystemMessage,
    ResultMessage
)
```

#### AssistantMessage

Contains Claude's response.

```python
@dataclass
class AssistantMessage:
    type: str = "assistant"
    content: list[ContentBlock]  # TextBlock or ToolUseBlock
    model: str
    stop_reason: str
    usage: Usage
```

#### UserMessage

Contains user messages or tool results.

```python
@dataclass
class UserMessage:
    type: str = "user"
    content: list[ContentBlock]  # TextBlock or ToolResultBlock
```

#### ResultMessage

Contains agent execution results.

```python
@dataclass
class ResultMessage:
    type: str = "result"
    subtype: str  # init, success, error, cancelled, max_turns
    session_id: str = None  # When subtype == init
    result: str = None      # When subtype == success
    error: str = None       # When subtype == error
    duration_ms: int = None
    total_cost_usd: float = None
```

### ContentBlock Types

```python
@dataclass
class TextBlock:
    type: str = "text"
    text: str

@dataclass
class ToolUseBlock:
    type: str = "tool_use"
    id: str
    name: str
    input: dict

@dataclass
class ToolResultBlock:
    type: str = "tool_result"
    tool_use_id: str
    content: str | list
    is_error: bool = False
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Response |
|------|---------|----------|
| 400 | Bad Request | Check request parameters |
| 401 | Authentication Failed | Check API key |
| 403 | Forbidden | Check access permissions |
| 404 | Not Found | Check endpoint |
| 429 | Rate Limited | Retry or respect limits |
| 500 | Server Error | Retry later |
| 529 | Overloaded | Retry later |

### Agent SDK Exceptions

```python
from claude_agent_sdk import (
    CLINotFoundError,      # Claude Code CLI not installed
    ProcessError,          # Process execution error
    AuthenticationError,   # Authentication failed
    RateLimitError,        # Rate limited
    TimeoutError           # Timeout
)
```

### Error Handling Pattern

```python
try:
    async for message in query(prompt=task, options=options):
        handle_message(message)

except CLINotFoundError:
    print("Install Claude Code CLI: npm i -g @anthropic-ai/claude-code")

except AuthenticationError:
    print("Check your API key: export ANTHROPIC_API_KEY=...")

except RateLimitError as e:
    print(f"Retrying in {e.retry_after} seconds...")
    await asyncio.sleep(e.retry_after)

except TimeoutError:
    print("Task timed out")

except ProcessError as e:
    print(f"Process error: {e.stderr}")

except Exception as e:
    print(f"Unexpected error: {e}")
```

---

## Model Information

### Available Models

| Model | ID | Context | Features |
|-------|-----|---------|----------|
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | 200K | Highest performance |
| Claude Opus 4 | `claude-opus-4-1` | 200K | High performance |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20251101` | 200K | Balanced |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 200K | Balanced |
| Claude Haiku 4 | `claude-haiku-4` | 200K | Fastest |

### Token Limits

| Item | Limit |
|------|-------|
| Standard Context | 200,000 tokens |
| Enterprise Context | 500,000 tokens |
| 1M Beta (eligible orgs) | 1,000,000 tokens |
| Max Output Tokens | Varies by model |

### Pricing Information

> For latest pricing, see https://www.anthropic.com/pricing

```python
# Check token count
token_count = client.messages.count_tokens(
    model="claude-sonnet-4-5-20251101",
    messages=[{"role": "user", "content": "Hello"}]
)
print(f"Input tokens: {token_count.input_tokens}")
```

---

## Official Documentation Links

| Topic | URL |
|-------|-----|
| Messages API | https://docs.anthropic.com/en/api/messages |
| Agent SDK | https://platform.claude.com/docs/en/agent-sdk/overview |
| Tool Use | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| Claude Code | https://code.claude.com/docs/en/overview |
| MCP | https://modelcontextprotocol.io |

---

*Previous: [Architecture Patterns](08_patterns.md) | [Back to Table of Contents](README.md)*
