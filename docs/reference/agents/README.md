# Agent Reference Documentation

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

## Overview

This directory contains detailed reference documentation for all AD-SDLC agents. Each agent document includes:

- **Purpose**: What the agent does
- **Input**: Expected input data and format
- **Output**: Generated output data and format
- **Behavior**: How the agent processes data
- **Configuration**: Configurable options
- **Error Handling**: How errors are handled

---

## Agent Categories

### Document Generation Pipeline

| Agent | File | Description |
|-------|------|-------------|
| Collector | [collector.md](./collector.md) | Gathers requirements from multiple sources |
| PRD Writer | [prd-writer.md](./prd-writer.md) | Generates Product Requirements Document |
| SRS Writer | [srs-writer.md](./srs-writer.md) | Generates Software Requirements Specification |
| SDS Writer | [sds-writer.md](./sds-writer.md) | Generates Software Design Specification |

### Document Update Pipeline

| Agent | File | Description |
|-------|------|-------------|
| PRD Updater | [prd-updater.md](./prd-updater.md) | Incremental PRD modifications |
| SRS Updater | [srs-updater.md](./srs-updater.md) | Incremental SRS modifications |
| SDS Updater | [sds-updater.md](./sds-updater.md) | Incremental SDS modifications |

### Analysis Pipeline

| Agent | File | Description |
|-------|------|-------------|
| Document Reader | [document-reader.md](./document-reader.md) | Parses existing documentation |
| Codebase Analyzer | [codebase-analyzer.md](./codebase-analyzer.md) | Analyzes code structure |
| Code Reader | [code-reader.md](./code-reader.md) | Extracts code inventory |
| Impact Analyzer | [impact-analyzer.md](./impact-analyzer.md) | Assesses change impact |
| Doc-Code Comparator | [comparator.md](./comparator.md) | Compares docs vs code |

### Execution Pipeline

| Agent | File | Description |
|-------|------|-------------|
| Issue Reader | [issue-reader.md](./issue-reader.md) | Imports existing GitHub issues |
| Issue Generator | [issue-generator.md](./issue-generator.md) | Creates GitHub issues |
| Controller | [controller.md](./controller.md) | Orchestrates work distribution |
| Worker | [worker.md](./worker.md) | Implements code for issues |
| PR Reviewer | [pr-reviewer.md](./pr-reviewer.md) | Reviews and merges PRs |
| Regression Tester | [regression-tester.md](./regression-tester.md) | Validates existing functionality |

---

## Agent Reference Template

Each agent document follows this structure:

```markdown
# {Agent Name}

## Overview
Brief description of the agent's purpose.

## Configuration

### Agent Definition
Location: `.claude/agents/{agent-name}.md`

### YAML Configuration
```yaml
# agents.yaml entry
{agent-id}:
  model: sonnet
  timeout: 300000
  # ...
```

## Input

### Source
Where the agent reads its input from.

### Schema
```yaml
# Input schema
```

## Output

### Destination
Where the agent writes its output.

### Schema
```yaml
# Output schema
```

## Behavior

### Processing Steps
1. Step 1
2. Step 2
3. ...

### Decision Points
- Decision 1
- Decision 2

## Error Handling

### Recoverable Errors
- Error type and recovery action

### Non-Recoverable Errors
- Error type and user action required

## Examples

### Basic Usage
```
Example input and output
```

## Related Agents
- Dependencies
- Dependents
```

---

## Quick Reference

### Agent Execution Order (Greenfield)

```
1. Collector
2. PRD Writer
3. SRS Writer
4. SDS Writer
5. Issue Generator
6. Controller
7. Worker(s) [parallel]
8. PR Reviewer
```

### Agent Execution Order (Enhancement)

```
1. Document Reader  ┐
   Codebase Analyzer├── [parallel]
   Code Reader      ┘
2. Doc-Code Comparator
3. Impact Analyzer
4. PRD Updater
5. SRS Updater
6. SDS Updater
7. Issue Generator
8. Controller
9. Worker(s)        ┐
   Regression Tester├── [parallel]
10. PR Reviewer     ┘
```

### Agent Execution Order (Import)

```
1. Issue Reader     # Imports existing GitHub issues
2. Controller       # Orchestrates work distribution
3. Worker(s) [parallel]
4. PR Reviewer
```

### Model Assignments

| Agent | Default Model | Rationale |
|-------|---------------|-----------|
| Collector | Sonnet | Balanced understanding |
| PRD/SRS/SDS Writer | Sonnet | Quality writing |
| Issue Reader | Sonnet | Accurate parsing |
| Issue Generator | Sonnet | Structured output |
| Controller | Haiku | Fast decisions |
| Worker | Sonnet | Code quality |
| PR Reviewer | Sonnet | Thorough review |
| Document Reader | Haiku | Fast parsing |
| Codebase Analyzer | Haiku | Fast analysis |
| Impact Analyzer | Sonnet | Complex reasoning |

### Tool Allocations

| Agent | Tools |
|-------|-------|
| Collector | Read, WebFetch, Glob |
| Writers | Read, Write, Glob |
| Issue Reader | Read, Write, Bash (gh), Glob, Grep |
| Issue Generator | Read, Bash (gh) |
| Controller | Read, Write, Bash (gh) |
| Worker | Read, Write, Edit, Bash, Grep, Glob |
| PR Reviewer | Read, Bash (gh, git) |
| Analyzers | Read, Glob, Grep, LSP |

---

## Configuration Files

- **Agent Definitions**: `.claude/agents/*.md`
- **Agent Registry**: `.ad-sdlc/config/agents.yaml`
- **Workflow Config**: `.ad-sdlc/config/workflow.yaml`

See [Configuration Reference](../configuration/) for details.

---

*Part of [AD-SDLC Reference Documentation](../README.md)*
