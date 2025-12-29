# AD-SDLC System Architecture Overview

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01
> **Audience**: Developers, Architects, Contributors

## Table of Contents

1. [Introduction](#introduction)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Pipeline Modes](#pipeline-modes)
6. [Key Design Patterns](#key-design-patterns)
7. [Directory Structure](#directory-structure)

---

## Introduction

AD-SDLC (Agent-Driven Software Development Lifecycle) is an automated software development system that transforms requirements into production-ready code using a pipeline of specialized Claude AI agents.

### System Goals

- **Automation**: Automate the entire SDLC from requirements to code
- **Traceability**: Maintain bidirectional links between requirements, design, and implementation
- **Quality**: Enforce quality gates at each stage
- **Flexibility**: Support both new projects (Greenfield) and existing projects (Enhancement)

### Key Capabilities

| Capability | Description |
|------------|-------------|
| Document Generation | PRD, SRS, SDS automatic generation |
| Issue Management | GitHub issue creation from design documents |
| Code Implementation | Automated code generation with tests |
| PR Management | Automated PR creation, review, and merge |
| Impact Analysis | Change impact assessment for existing projects |

---

## High-Level Architecture

```
                                User Input
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       Mode Detector           │
                    │   (Greenfield / Enhancement)  │
                    └───────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              ▼                                           ▼
    ┌─────────────────────┐               ┌─────────────────────┐
    │  Greenfield Mode    │               │  Enhancement Mode   │
    │  (New Projects)     │               │  (Existing Projects)│
    └─────────────────────┘               └─────────────────────┘
              │                                           │
              ▼                                           ▼
    ┌─────────────────────┐               ┌─────────────────────┐
    │  Document Pipeline  │               │  Analysis Pipeline  │
    │  Collector → PRD →  │               │  DocReader →        │
    │  SRS → SDS          │               │  CodeAnalyzer →     │
    └─────────────────────┘               │  ImpactAnalyzer     │
              │                           └─────────────────────┘
              │                                           │
              │                                           ▼
              │                           ┌─────────────────────┐
              │                           │  Update Pipeline    │
              │                           │  PRD → SRS → SDS    │
              │                           │  (Incremental)      │
              │                           └─────────────────────┘
              │                                           │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     Issue Generator           │
                    │   (SDS → GitHub Issues)       │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │         Controller            │
                    │   (Work Distribution)         │
                    └───────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
        ┌──────────┐          ┌──────────┐          ┌──────────┐
        │ Worker 1 │          │ Worker 2 │          │ Worker N │
        └──────────┘          └──────────┘          └──────────┘
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       PR Reviewer             │
                    │   (Review → Merge)            │
                    └───────────────────────────────┘
                                    │
                                    ▼
                              Production Code
```

---

## Technology Stack

### Runtime Environment

| Component | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 18+ | Runtime environment |
| **TypeScript** | 5.3+ | Primary language |
| **ES2022** | - | Module system (ESM) |

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `commander` | ^14.0.2 | CLI framework |
| `chalk` | ^5.6.2 | Terminal output styling |
| `inquirer` | ^13.1.0 | Interactive CLI prompts |
| `js-yaml` | ^4.1.1 | YAML parsing |
| `zod` | ^4.2.1 | Schema validation |
| `ts-morph` | ^27.0.2 | TypeScript AST manipulation |
| `dotenv` | ^17.2.3 | Environment configuration |
| `mammoth` | ^1.11.0 | DOCX file parsing |
| `pdf-parse` | ^2.4.5 | PDF file parsing |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| `vitest` | ^4.0.16 | Test runner |
| `@vitest/coverage-v8` | ^4.0.16 | Code coverage |
| `eslint` | ^9.0.0 | Code linting |
| `prettier` | ^3.0.0 | Code formatting |
| `@typescript-eslint` | ^8.0.0 | TypeScript linting rules |

### External Integrations

| Service | Purpose |
|---------|---------|
| **GitHub** | Issue tracking, PR management |
| **Claude API** | AI agent backbone |
| **Codecov** | Coverage reporting |
| **CodeQL** | Security analysis |

---

## Core Components

### 1. Agent System

The system consists of 15 specialized agents organized into functional categories:

#### Document Generation Agents
- **Collector**: Gathers requirements from multiple sources
- **PRD Writer**: Generates Product Requirements Document
- **SRS Writer**: Generates Software Requirements Specification
- **SDS Writer**: Generates Software Design Specification

#### Document Update Agents
- **PRD Updater**: Incremental PRD modifications
- **SRS Updater**: Incremental SRS modifications
- **SDS Updater**: Incremental SDS modifications

#### Analysis Agents
- **Document Reader**: Parses existing documentation
- **Codebase Analyzer**: Analyzes code structure
- **Code Reader**: Extracts code inventory
- **Impact Analyzer**: Assesses change implications
- **Doc-Code Comparator**: Identifies documentation gaps

#### Execution Agents
- **Issue Generator**: Creates GitHub issues from SDS
- **Controller**: Orchestrates work distribution
- **Worker**: Implements issues with code
- **PR Reviewer**: Reviews and merges PRs
- **Regression Tester**: Validates existing functionality

### 2. Scratchpad System

File-based state management for inter-agent communication:

```
.ad-sdlc/scratchpad/
├── info/                    # Collected requirements
│   └── collected_info.yaml
├── documents/               # Generated documents
│   ├── prd.md
│   ├── srs.md
│   └── sds.md
├── issues/                  # Issue definitions
│   └── issues.json
├── progress/                # Execution state
│   └── controller_state.yaml
├── state/                   # Analysis state
│   └── current_state.yaml
├── analysis/                # Analysis results
│   ├── architecture_overview.yaml
│   ├── dependency_graph.json
│   └── comparison_result.yaml
└── impact/                  # Impact reports
    └── impact_report.yaml
```

### 3. Configuration System

YAML-based configuration for workflows and agents:

- **workflow.yaml**: Pipeline definitions, stages, quality gates
- **agents.yaml**: Agent registry with capabilities and dependencies
- **mode-detection.yaml**: Rules for pipeline mode selection

### 4. Error Handling

- **Retry Handler**: Exponential backoff with configurable attempts
- **Circuit Breaker**: Fault tolerance for external services
- **Error Categories**: Retryable vs non-retryable classification

---

## Pipeline Modes

### Greenfield Mode (New Projects)

For projects without existing documentation or codebase:

```
Stage 1: Collection
    └── Gather requirements from user input, files, URLs

Stage 2: PRD Generation
    └── Create Product Requirements Document

Stage 3: SRS Generation
    └── Create Software Requirements Specification

Stage 4: SDS Generation
    └── Create Software Design Specification

Stage 5: Issue Generation
    └── Transform SDS components into GitHub issues

Stage 6: Orchestration
    └── Prioritize and distribute work

Stage 7: Implementation
    └── Workers implement issues in parallel
    └── PR Reviewer merges completed work
```

### Enhancement Mode (Existing Projects)

For projects with existing documentation and/or codebase:

```
Stage 1: Analysis (Parallel)
    ├── Document Reader → Current state
    └── Codebase Analyzer → Architecture

Stage 2: Comparison
    └── Doc-Code Comparator → Gap analysis

Stage 3: Impact Analysis
    └── Impact Analyzer → Risk assessment

Stage 4-6: Document Updates
    ├── PRD Updater (incremental)
    ├── SRS Updater (incremental)
    └── SDS Updater (incremental)

Stage 7: Issue Generation
    └── Create issues for changes

Stage 8: Implementation (Parallel)
    ├── Workers → New code
    └── Regression Tester → Verify existing

Stage 9: Review & Merge
    └── PR Reviewer with regression results
```

---

## Key Design Patterns

### 1. Scratchpad Pattern

Agents communicate through file-based state rather than direct messaging:

**Benefits**:
- Persistence across agent invocations
- Human-readable intermediate states
- Easy debugging and inspection
- Recovery from failures

**Implementation**:
```typescript
// Write state
await scratchpad.write('collected_info', data);

// Read state
const info = await scratchpad.read('collected_info');
```

### 2. Document Traceability

All artifacts maintain bidirectional links:

```
PRD (FR-001) ←→ SRS (SF-001, SF-002) ←→ SDS (CMP-001) ←→ Issue #1
```

### 3. Pipeline Stage Pattern

Each pipeline stage:
1. Reads input from scratchpad
2. Processes with specialized agent
3. Writes output to scratchpad
4. Reports status to controller

### 4. Worker Pool Pattern

Controller manages a pool of workers:
- Maximum 5 concurrent workers
- Dependency-aware scheduling
- Priority-based ordering
- Automatic retry on failure

### 5. Quality Gate Pattern

Gates enforce standards at transitions:
- Document completeness validation
- Code coverage thresholds (80%)
- Security scanning
- Linting compliance

---

## Directory Structure

```
claude_code_agent/
├── .claude/                     # Claude Code configuration
│   └── agents/                  # Agent definitions (30 files)
│       ├── collector.md
│       ├── prd-writer.md
│       ├── worker.md
│       └── ...
│
├── .ad-sdlc/                    # AD-SDLC runtime
│   ├── config/                  # Configuration files
│   │   ├── agents.yaml
│   │   ├── workflow.yaml
│   │   └── mode-detection.yaml
│   ├── scratchpad/              # Inter-agent state
│   ├── templates/               # Document templates
│   ├── logs/                    # Audit logs
│   └── metrics/                 # Performance metrics
│
├── src/                         # Source code (31 modules)
│   ├── cli.ts                   # CLI entry point
│   ├── index.ts                 # Main exports
│   ├── config/                  # Configuration system
│   ├── error-handler/           # Error handling
│   ├── scratchpad/              # State management
│   ├── collector/               # Collector agent
│   ├── prd-writer/              # PRD Writer agent
│   ├── srs-writer/              # SRS Writer agent
│   ├── sds-writer/              # SDS Writer agent
│   ├── issue-generator/         # Issue Generator agent
│   ├── controller/              # Controller agent
│   ├── worker/                  # Worker agent
│   ├── pr-reviewer/             # PR Reviewer agent
│   └── ...                      # Other modules
│
├── tests/                       # Test suite
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # End-to-end tests
│
├── docs/                        # Documentation
│   ├── architecture/            # Architecture docs
│   ├── reference/               # API reference
│   ├── guides/                  # User guides
│   └── deployment/              # Deployment docs
│
└── .github/                     # GitHub configuration
    └── workflows/               # CI/CD pipelines
```

---

## Related Documentation

- [Agent Communication](./agent-communication.md) - Inter-agent communication patterns
- [Data Flow](./data-flow.md) - Data flow through the system
- [Architecture Decisions](./decisions/) - ADRs for key decisions
- [Configuration Guide](../reference/configuration/) - Configuration reference
- [Agent Reference](../reference/agents/) - Detailed agent documentation

---

*Part of [AD-SDLC Documentation](../README.md)*
