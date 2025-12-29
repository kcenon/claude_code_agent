# Collector Agent Reference

> **Agent ID**: `collector`
> **Model**: Sonnet
> **Category**: Document Generation Pipeline

## Overview

The Collector Agent gathers requirements from multiple input sources and produces a structured requirements document. It is the first agent in both Greenfield and Enhancement pipelines.

---

## Configuration

### Agent Definition

**Location**: `.claude/agents/collector.md`

```markdown
---
name: collector
description: |
  Collects and structures requirements from various sources.
  Handles natural language, files, and URLs.
tools: Read, WebFetch, Glob, Bash
model: sonnet
---
```

### YAML Configuration

```yaml
# .ad-sdlc/config/agents.yaml
collector:
  id: "collector"
  name: "Collector Agent"
  model: sonnet
  timeout: 300000  # 5 minutes
  max_retries: 3

  capabilities:
    - natural_language_processing
    - file_parsing
    - url_fetching
    - requirement_extraction

  tools:
    - Read
    - WebFetch
    - Glob
    - Bash

  input:
    sources:
      - user_input
      - files
      - urls

  output:
    path: ".ad-sdlc/scratchpad/{project}/info/collected_info.yaml"
    format: yaml
```

---

## Input

### Source Types

| Type | Description | Example |
|------|-------------|---------|
| **User Input** | Natural language requirements | "Build a task management app" |
| **Files** | Markdown, DOCX, PDF documents | `requirements.md`, `spec.docx` |
| **URLs** | Web pages with requirements | `https://wiki.example.com/spec` |

### Input Processing

```typescript
interface CollectorInput {
  // Natural language input
  userInput?: string;

  // File paths to process
  files?: string[];

  // URLs to fetch
  urls?: string[];

  // Project context
  projectName: string;
  projectPath: string;
}
```

---

## Output

### Destination

`.ad-sdlc/scratchpad/{project}/info/collected_info.yaml`

### Schema

```yaml
# collected_info.yaml
schema_version: "1.0"
created_at: "2025-01-01T00:00:00Z"
created_by: "collector-agent"

project:
  name: "my-project"
  description: "Brief project description"

requirements:
  functional:
    - id: "REQ-001"
      description: "User can create an account"
      priority: "high"
      source: "user_input"
      rationale: "Core feature for user management"

    - id: "REQ-002"
      description: "User can log in with email/password"
      priority: "high"
      source: "requirements.md"
      rationale: "Authentication requirement"

  non_functional:
    - id: "NFR-001"
      description: "Response time under 200ms"
      category: "performance"
      source: "user_input"

    - id: "NFR-002"
      description: "Support 10,000 concurrent users"
      category: "scalability"
      source: "spec.docx"

constraints:
  - "Must integrate with existing OAuth provider"
  - "Budget limited to $10,000/month for infrastructure"

assumptions:
  - "Users have valid email addresses"
  - "Modern browser support only (Chrome, Firefox, Safari, Edge)"

out_of_scope:
  - "Mobile native apps (web only for MVP)"
  - "Multi-language support"

stakeholders:
  - role: "Product Owner"
    name: "John Doe"
  - role: "Tech Lead"
    name: "Jane Smith"

sources:
  - type: "user_input"
    processed_at: "2025-01-01T00:00:00Z"
  - type: "file"
    path: "requirements.md"
    processed_at: "2025-01-01T00:01:00Z"
```

---

## Behavior

### Processing Steps

1. **Input Collection**
   - Parse user input for natural language requirements
   - Read specified files (MD, DOCX, PDF)
   - Fetch and parse URL content

2. **Requirement Extraction**
   - Identify functional requirements (features, capabilities)
   - Identify non-functional requirements (performance, security)
   - Extract constraints and assumptions

3. **Deduplication**
   - Detect similar requirements from different sources
   - Merge duplicates, noting all sources

4. **Classification**
   - Assign priority (high, medium, low)
   - Categorize non-functional requirements
   - Identify dependencies between requirements

5. **Validation**
   - Check for completeness
   - Identify ambiguous requirements
   - Flag potential conflicts

6. **Output Generation**
   - Generate structured YAML output
   - Include source traceability

### Decision Points

| Situation | Decision |
|-----------|----------|
| Ambiguous requirement | Flag for clarification, include as-is |
| Conflicting requirements | Include both, add conflict note |
| Missing priority | Default to "medium" |
| Large file (>1MB) | Process in chunks |
| URL timeout | Retry 3 times, then skip with warning |

---

## Error Handling

### Recoverable Errors

| Error | Recovery Action |
|-------|-----------------|
| File not found | Skip file, log warning, continue |
| URL fetch timeout | Retry with exponential backoff |
| Parse error | Log error, include raw content for review |
| Rate limit | Wait and retry |

### Non-Recoverable Errors

| Error | User Action Required |
|-------|---------------------|
| No input provided | Provide at least one input source |
| All sources failed | Check input paths/URLs and retry |
| Permission denied | Check file/directory permissions |

### Error Output

```yaml
# On partial failure
errors:
  - source: "broken-link.md"
    error: "File not found"
    severity: "warning"

  - source: "https://example.com/spec"
    error: "Connection timeout after 3 retries"
    severity: "warning"

# Processing continued with available sources
status: "partial_success"
```

---

## Examples

### Basic Usage

**Input:**
```
User input: "Build a todo app with user authentication,
task CRUD operations, and due date reminders"
```

**Output:**
```yaml
requirements:
  functional:
    - id: "REQ-001"
      description: "User can create an account and log in"
      priority: "high"
      source: "user_input"

    - id: "REQ-002"
      description: "User can create, read, update, delete tasks"
      priority: "high"
      source: "user_input"

    - id: "REQ-003"
      description: "System sends due date reminder notifications"
      priority: "medium"
      source: "user_input"
```

### File-Based Collection

**Input:**
```bash
ad-sdlc collect --file requirements.md --file user-stories.docx
```

**Output:**
```yaml
sources:
  - type: "file"
    path: "requirements.md"
    format: "markdown"
    requirements_extracted: 15

  - type: "file"
    path: "user-stories.docx"
    format: "docx"
    requirements_extracted: 8
```

### URL Collection

**Input:**
```bash
ad-sdlc collect --url https://wiki.company.com/project-spec
```

**Output:**
```yaml
sources:
  - type: "url"
    url: "https://wiki.company.com/project-spec"
    fetched_at: "2025-01-01T00:00:00Z"
    requirements_extracted: 12
```

---

## Related Agents

### Upstream
- None (first agent in pipeline)

### Downstream
- **PRD Writer**: Reads `collected_info.yaml` to generate PRD

### Dependencies
- None

---

## Configuration Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeout` | number | 300000 | Max execution time (ms) |
| `max_retries` | number | 3 | Retry attempts on failure |
| `chunk_size` | number | 50000 | Max chars per file chunk |
| `url_timeout` | number | 30000 | URL fetch timeout (ms) |

---

*Part of [Agent Reference Documentation](./README.md)*
