# Agent Reference Documentation

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

## Language / 언어

- **English**: This directory (default)
- **한국어**: [Korean Documentation](./ko/README.md)

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

### Orchestration

| Agent | File | Description |
|-------|------|-------------|
| AD-SDLC Orchestrator | [ad-sdlc-orchestrator.md](./ad-sdlc-orchestrator.md) | Coordinates full pipeline execution |

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

### Infrastructure Pipeline

| Agent | File | Description |
|-------|------|-------------|
| Project Initializer | [project-initializer.md](./project-initializer.md) | Creates .ad-sdlc directory structure and config files |
| Mode Detector | [mode-detector.md](./mode-detector.md) | Detects greenfield vs enhancement mode |
| Repo Detector | [repo-detector.md](./repo-detector.md) | Detects existing vs new repository |
| GitHub Repo Setup | [github-repo-setup.md](./github-repo-setup.md) | Creates and configures GitHub repository |

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
| CI Fixer | [ci-fixer.md](./ci-fixer.md) | Automatically diagnoses and fixes CI failures |
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

### Orchestrated Execution

The AD-SDLC Orchestrator can manage the entire pipeline automatically:

```
AD-SDLC Orchestrator
└── Automatically invokes all agents in correct sequence
    ├── Greenfield Pipeline (new projects)
    ├── Enhancement Pipeline (existing projects)
    └── Import Pipeline (existing GitHub issues)
```

### Agent Execution Order (Greenfield)

```
1. Project Initializer  # Creates .ad-sdlc directory structure
2. Mode Detector
3. Collector
4. PRD Writer
5. SRS Writer
6. Repo Detector
7. GitHub Repo Setup  (conditional: skipped if existing repo)
8. SDS Writer
9. Issue Generator
10. Controller
11. Worker(s) [parallel]
12. PR Reviewer
```

### Agent Execution Order (Enhancement)

```
1. Project Initializer  # Creates .ad-sdlc directory structure (if needed)
2. Mode Detector
3. Document Reader  ┐
   Codebase Analyzer├── [parallel]
   Code Reader      ┘
4. Doc-Code Comparator
5. Impact Analyzer
6. PRD Updater
7. SRS Updater
8. SDS Updater
9. Issue Generator
10. Controller
11. Worker(s)        ┐
    Regression Tester├── [parallel]
12. PR Reviewer      ┘
13. CI Fixer         # On CI failure (delegated from PR Reviewer)
```

### Agent Execution Order (Import)

```
1. Project Initializer  # Creates .ad-sdlc directory structure (if needed)
2. Mode Detector        # Confirms import mode (auto-detect or explicit)
3. Issue Reader         # Imports existing GitHub issues (with optional filters)
4. Controller           # Orchestrates work distribution
5. Worker(s) [parallel]
6. PR Reviewer
```

**Import Mode Detection Keywords:**
- "process issues", "work on issues", "implement issues"
- "handle backlog", "process backlog"
- "existing issues", "open issues"

**Import Filtering Options:**
- Filter by labels: `labeled 'bug'`
- Filter by milestone: `milestone 'v1.0'`
- Specific issues: `issues #10, #12, #15`

### Model Assignments

> **Note**: All agents now use `model: inherit` by default, automatically inheriting the parent conversation's model. This provides flexibility for users to choose their preferred model (opus, sonnet, or haiku) at the conversation level.

| Agent | Model | Notes |
|-------|-------|-------|
| All Agents | inherit | Uses parent conversation model |

**Override**: Users can still override per-agent via the Task tool's `model` parameter when needed.

### Tool Allocations

| Agent | Tools |
|-------|-------|
| AD-SDLC Orchestrator | Read, Write, Glob, Grep, Bash, Task |
| Project Initializer | Read, Write, Bash, Glob |
| Mode Detector | Read, Glob |
| Repo Detector | Read, Bash (git, gh), Glob |
| GitHub Repo Setup | Read, Write, Edit, Bash (gh, git), Glob, Grep |
| Collector | Read, WebFetch, Glob |
| Writers | Read, Write, Glob |
| Issue Reader | Read, Write, Bash (gh), Glob, Grep |
| Issue Generator | Read, Bash (gh) |
| Controller | Read, Write, Bash (gh) |
| Worker | Read, Write, Edit, Bash, Grep, Glob |
| PR Reviewer | Read, Bash (gh, git) |
| CI Fixer | Read, Write, Edit, Bash (npm, git), Glob, Grep |
| Analyzers | Read, Glob, Grep, LSP |

---

## Configuration Files

- **Agent Definitions**: `.claude/agents/*.md`
- **Agent Registry**: `.ad-sdlc/config/agents.yaml`
- **Workflow Config**: `.ad-sdlc/config/workflow.yaml`

See [Configuration Reference](../configuration/) for details.

---

*Part of [AD-SDLC Reference Documentation](../README.md)*
