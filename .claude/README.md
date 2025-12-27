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

## Notes

- Agent definitions follow the Claude Agent SDK specification
- Tools are explicitly listed to control agent capabilities
- Model selection (sonnet/opus) affects cost and capability
