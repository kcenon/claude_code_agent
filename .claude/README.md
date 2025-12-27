# Claude Code Configuration

This directory contains Claude Code and Agent SDK configuration for the AD-SDLC system.

## Structure

```
.claude/
├── agents/            # Agent definition files
│   ├── *.md           # English versions (used by Claude)
│   └── *.kr.md        # Korean versions (for reference)
└── settings.json      # Claude Code settings (optional)
```

## Agent Definitions

Each agent is defined with:
- YAML frontmatter (name, description, tools, model)
- Markdown body with role, responsibilities, and workflows

### Available Agents

| Agent | File | Component | Role |
|-------|------|-----------|------|
| Collector | `collector.md` | CMP-001 | Gathers requirements |
| PRD Writer | `prd-writer.md` | CMP-002 | Generates PRD |
| SRS Writer | `srs-writer.md` | CMP-003 | Generates SRS |
| SDS Writer | `sds-writer.md` | CMP-004 | Generates SDS |
| Issue Generator | `issue-generator.md` | CMP-005 | Creates GitHub Issues |
| Controller | `controller.md` | CMP-006 | Orchestrates Workers |
| Worker | `worker.md` | CMP-007 | Implements code |
| PR Reviewer | `pr-reviewer.md` | CMP-008 | Reviews and merges PRs |

## Language Versions

- English (`.md`): Used by Claude during execution
- Korean (`.kr.md`): Provided for developer reference

## Agent Definition Format

```markdown
---
name: agent-name
description: Brief description
tools:
  - Read
  - Write
  - Bash
model: sonnet
---

# Agent Name

## Role
Description of the agent's role...

## Responsibilities
- Task 1
- Task 2

## Workflow
Step-by-step workflow...
```

## Creating New Agents

Use the template at `.ad-sdlc/templates/agent-template.md` as a starting point for new agents.

### Required Frontmatter Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Lowercase with hyphens | `my-agent` |
| `description` | string | Agent purpose (min 10 chars) | `Processes user input...` |
| `tools` | array | List of allowed tools | `[Read, Write, Bash]` |
| `model` | string | Model to use | `sonnet` or `opus` |

### Valid Tools

- `Read` - Read file contents
- `Write` - Write files
- `Edit` - Edit existing files
- `Bash` - Execute shell commands
- `Glob` - Find files by pattern
- `Grep` - Search file contents
- `WebFetch` - Fetch URL content
- `WebSearch` - Search the web
- `LSP` - Language Server Protocol
- `Task` - Spawn sub-agents
- `TodoWrite` - Manage todo lists
- `NotebookEdit` - Edit Jupyter notebooks

### Recommended Sections

For complete agent definitions, include:

1. `## Role` - Agent's primary purpose
2. `## Primary Responsibilities` - List of duties
3. `## Workflow` - Step-by-step process
4. `## File Locations` - Input/output paths

## Validation

Validate agent definitions using the built-in validator:

```typescript
import { validateAllAgents, formatValidationReport } from 'ad-sdlc';

const report = validateAllAgents();
console.log(formatValidationReport(report));
```

Or validate a single file:

```typescript
import { validateAgentFile } from 'ad-sdlc';

const result = validateAgentFile('.claude/agents/my-agent.md');
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Agent Registry

All agents are registered in `.ad-sdlc/config/agents.yaml`. This file contains:

- Agent metadata and capabilities
- Input/output specifications
- Dependencies between agents
- Execution pipelines

## Notes

- Agent definitions follow the Claude Agent SDK specification
- Tools are explicitly listed to control agent capabilities
- Model selection (sonnet/opus) affects cost and capability
- Run validation before committing new agent definitions
