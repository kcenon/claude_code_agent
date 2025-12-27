# Built-in Tools Reference

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Tools Overview](#tools-overview)
2. [File Tools](#file-tools)
3. [Execution Tools](#execution-tools)
4. [Web Tools](#web-tools)
5. [Agent Tools](#agent-tools)
6. [Management Tools](#management-tools)
7. [Tool Permission Settings](#tool-permission-settings)

---

## Tools Overview

### Tool Categories

| Category | Tools | Risk Level | Description |
|----------|-------|------------|-------------|
| **File** | Read, Write, Edit, Glob, Grep | Low-Medium | File system operations |
| **Execution** | Bash, NotebookEdit | High | Command execution |
| **Web** | WebSearch, WebFetch | Low | Web information retrieval |
| **Agent** | Task, AskUserQuestion | Medium | Subagents, user interaction |
| **Management** | TodoWrite, ListMcpResources, ReadMcpResource | Low | Task/resource management |

### Tool Selection Guide

```
Read-only analysis    → Read, Glob, Grep
Code modification     → Read, Write, Edit, Glob, Grep
Test execution        → Bash, Read, Grep
External info lookup  → WebSearch, WebFetch
Complex workflows     → Task (subagents)
User confirmation     → AskUserQuestion
```

---

## File Tools

### Read

Reads file contents.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Absolute path to the file |
| `offset` | number | No | Starting line number (for large files) |
| `limit` | number | No | Number of lines to read (default: 2000) |

**Features:**
- Reads up to 2000 lines from the start by default
- Lines exceeding 2000 characters are truncated
- Can visually analyze image files (PNG, JPG, etc.)
- Extracts text/visual content from PDF files page by page
- Includes Jupyter notebook (.ipynb) cells and outputs

**Example:**

```python
# Read entire file
options = ClaudeAgentOptions(allowed_tools=["Read"])
prompt = "Read and analyze src/main.py"

# Read specific portion of large file
prompt = "Read the first 50 lines of package.json"

# Analyze image
prompt = "Look at screenshots/error.png and analyze the issue"
```

---

### Write

Creates a new file or overwrites an existing file.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Absolute path to the file |
| `content` | string | Yes | Content to write |

**Considerations:**
- Overwrites if file exists
- Must read existing file with Read first when modifying
- Documentation files (*.md, README) created only when requested

**Example:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write"],
    permission_mode="acceptEdits"
)
prompt = "Create a new utils/helpers.py file"
```

---

### Edit

Performs exact string replacements in existing files.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Absolute path to the file |
| `old_string` | string | Yes | Original text to replace |
| `new_string` | string | Yes | New text |
| `replace_all` | boolean | No | Replace all matches (default: false) |

**Behavior:**
- `old_string` must be unique in the file
- Include more context if not unique
- Use `replace_all=true` to replace all matches

**Example:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Edit"],
    permission_mode="acceptEdits"
)

# Fix specific code
prompt = "Fix the bug in the calculateTotal function"

# Batch rename variable
prompt = "Rename all oldName variables to newName"
```

---

### Glob

Searches for files by pattern.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | Glob pattern |
| `path` | string | No | Starting directory for search |

**Supported Patterns:**
- `**/*.js` - JS files in all subdirectories
- `src/**/*.ts` - All TS files under src
- `*.{js,ts}` - JS or TS files
- `test_*.py` - Python files starting with test_

**Example:**

```python
options = ClaudeAgentOptions(allowed_tools=["Glob", "Read"])

# Find all TypeScript files
prompt = "Find and list all TypeScript files in the project"

# Find specific pattern files
prompt = "Find all test files"
```

---

### Grep

Searches file contents with regex.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | Regex to search for |
| `path` | string | No | Search path |
| `glob` | string | No | File filter (e.g., "*.js") |
| `type` | string | No | File type (js, py, rust, etc.) |
| `output_mode` | string | No | "content" \| "files_with_matches" \| "count" |
| `-i` | boolean | No | Case insensitive |
| `-A`, `-B`, `-C` | number | No | Context lines |
| `multiline` | boolean | No | Multiline pattern matching |

**Example:**

```python
options = ClaudeAgentOptions(allowed_tools=["Grep", "Read"])

# Find TODO comments
prompt = "Find all TODO comments in the codebase"

# Find function usage
prompt = "Find all places that call authenticateUser function"

# Search error patterns
prompt = "Find catch blocks that ignore errors"
```

---

## Execution Tools

### Bash

Executes terminal commands.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | Yes | Command to execute |
| `timeout` | number | No | Timeout (ms, max 600000) |
| `run_in_background` | boolean | No | Background execution |
| `description` | string | No | Command description (5-10 words) |

**Security Considerations:**
- Dangerous commands auto-blocked (rm -rf /, dd, etc.)
- Additional validation via hooks recommended
- Specific commands can be allowed via permission rules

**Example:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Bash", "Read"],
    permission_mode="acceptEdits",
    hooks={
        "PreToolUse": [
            HookMatcher(matcher="Bash", hooks=[validate_bash])
        ]
    }
)

# Run tests
prompt = "Run npm test and analyze failed tests"

# Build
prompt = "Build the project and fix errors"

# Git operations
prompt = "Commit current changes"
```

**Allowed Commands Example (settings.json):**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(git status:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  }
}
```

---

### NotebookEdit

Edits Jupyter notebook cells.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `notebook_path` | string | Yes | Absolute path to notebook file |
| `cell_id` | string | No | Cell ID to edit |
| `new_source` | string | Yes | New cell content |
| `cell_type` | string | No | "code" \| "markdown" |
| `edit_mode` | string | No | "replace" \| "insert" \| "delete" |

**Example:**

```python
options = ClaudeAgentOptions(allowed_tools=["Read", "NotebookEdit"])
prompt = "Improve the data visualization cell in analysis.ipynb"
```

---

## Web Tools

### WebSearch

Performs web searches.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (min 2 chars) |
| `allowed_domains` | string[] | No | Allowed domain list |
| `blocked_domains` | string[] | No | Blocked domain list |

**Features:**
- Real-time web information search
- Access to information beyond knowledge cutoff
- Results include source URLs

**Example:**

```python
options = ClaudeAgentOptions(allowed_tools=["WebSearch", "Read"])

# Search latest documentation
prompt = "Search and explain new features in React 19"

# Search specific domain
prompt = "Search for latest issues of this library on GitHub"
```

---

### WebFetch

Fetches and analyzes web page content.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to fetch |
| `prompt` | string | Yes | Content analysis prompt |

**Features:**
- Converts HTML to markdown
- Fast processing with small model
- 15-minute cache (same URL re-requests)
- Provides redirect URLs

**Example:**

```python
options = ClaudeAgentOptions(allowed_tools=["WebFetch"])

# Analyze API documentation
prompt = "Read https://docs.example.com/api and explain the authentication method"

# Analyze error page
prompt = "Find the solution from this StackOverflow link"
```

---

## Agent Tools

### Task

Delegates work to subagents.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Task to perform |
| `description` | string | Yes | Task description (3-5 words) |
| `subagent_type` | string | Yes | Agent type |
| `model` | string | No | Model to use |
| `resume` | string | No | Agent ID to resume |
| `run_in_background` | boolean | No | Background execution |

**Built-in Agent Types:**

| Type | Tools | Purpose |
|------|-------|---------|
| `general-purpose` | All | Complex multi-step tasks |
| `Explore` | All | Codebase exploration |
| `Plan` | All | Implementation planning |
| `claude-code-guide` | Glob, Grep, Read, WebFetch, WebSearch | Claude Code documentation lookup |

**Example:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Task", "Read"],
    agents={
        "security-auditor": AgentDefinition(
            description="Security vulnerability analysis expert",
            prompt="Analyze focusing on OWASP Top 10 vulnerabilities",
            tools=["Read", "Grep", "Glob"]
        )
    }
)

prompt = "Use security-auditor agent to analyze the auth module"
```

---

### AskUserQuestion

Asks questions to the user.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `questions` | array | Yes | Question list (1-4 items) |

**Question Structure:**

```python
{
    "question": "Which database would you like to use?",
    "header": "DB Choice",  # Max 12 chars
    "options": [
        {"label": "PostgreSQL (Recommended)", "description": "Relational DB, good for complex queries"},
        {"label": "MongoDB", "description": "NoSQL, flexible schema"},
        {"label": "SQLite", "description": "Lightweight, for local development"}
    ],
    "multiSelect": False
}
```

**Example:**

```python
options = ClaudeAgentOptions(allowed_tools=["AskUserQuestion", "Read", "Write"])

prompt = """Implement the authentication system.
Before implementation, confirm the OAuth provider and session storage with the user."""
```

---

## Management Tools

### TodoWrite

Manages task lists.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `todos` | array | Yes | Task list |

**Task Structure:**

```python
{
    "content": "Run tests",                  # Task to perform (imperative)
    "activeForm": "Running tests",           # In-progress display (present continuous)
    "status": "pending"                      # pending | in_progress | completed
}
```

**Rules:**
- Only one `in_progress` task at a time
- Mark as `completed` immediately upon completion
- Break complex tasks into smaller steps

---

### ListMcpResources

Lists MCP server resources.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server` | string | No | Specific server name |

---

### ReadMcpResource

Reads a resource from an MCP server.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uri` | string | Yes | Resource URI |

---

## Tool Permission Settings

### allowed_tools vs disallowed_tools

```python
# Method 1: Allowlist
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep"]  # Only these can be used
)

# Method 2: Blocklist
options = ClaudeAgentOptions(
    disallowed_tools=["Bash", "Write"]  # All except these can be used
)

# Do not use both options together!
```

### Tool Combinations by Purpose

```python
# Read-only analysis
READ_ONLY = ["Read", "Glob", "Grep"]

# Code modification
CODE_MODIFY = ["Read", "Write", "Edit", "Glob", "Grep"]

# Full development
FULL_DEV = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch"]

# Documentation
DOCS = ["Read", "Write", "Glob", "WebSearch", "WebFetch"]

# Review (with subagents)
REVIEW = ["Read", "Glob", "Grep", "Task"]
```

### settings.json Permission Rules

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Edit(src/**)",
      "Bash(npm:*)",
      "Bash(git:*)",
      "WebFetch(domain:docs.example.com)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Bash(rm:*)",
      "Bash(curl:*)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Write(package.json)"
    ]
  }
}
```

---

*Previous: [Agent SDK](01_agent_sdk.md) | Next: [Hooks Guide](03_hooks.md)*
