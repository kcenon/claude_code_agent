# Agent Communication Patterns

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

## Overview

AD-SDLC agents communicate through a file-based state system called the **Scratchpad**. This document describes the communication patterns, protocols, and best practices.

---

## Communication Model

### Indirect Communication via Scratchpad

Agents do not communicate directly. Instead, they:

1. **Read** input from scratchpad files
2. **Process** using their specialized capabilities
3. **Write** output to scratchpad files
4. **Signal** completion to the orchestrator

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Agent A   │────▶│   Scratchpad    │────▶│   Agent B   │
│   (Writer)  │     │   (YAML/JSON)   │     │   (Reader)  │
└─────────────┘     └─────────────────┘     └─────────────┘
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Persistence** | State survives agent restarts |
| **Transparency** | Human-readable intermediate states |
| **Debugging** | Easy to inspect and modify state |
| **Recovery** | Resume from last successful state |
| **Traceability** | Full audit trail of changes |

---

## Scratchpad File Structure

### Directory Layout

```
.ad-sdlc/scratchpad/
├── {project-name}/              # Project-scoped data
│   ├── info/                    # Collection stage
│   │   └── collected_info.yaml
│   ├── documents/               # Document generation
│   │   ├── prd.md
│   │   ├── srs.md
│   │   └── sds.md
│   ├── issues/                  # Issue management
│   │   └── issues.json
│   ├── progress/                # Execution tracking
│   │   ├── controller_state.yaml
│   │   └── work_orders.yaml
│   ├── state/                   # Analysis state
│   │   └── current_state.yaml
│   ├── analysis/                # Analysis results
│   │   ├── architecture_overview.yaml
│   │   ├── dependency_graph.json
│   │   └── comparison_result.yaml
│   └── impact/                  # Impact analysis
│       └── impact_report.yaml
```

### File Ownership

Each agent has designated files it reads from and writes to:

| Agent | Reads | Writes |
|-------|-------|--------|
| Collector | User input, files, URLs | `info/collected_info.yaml` |
| PRD Writer | `info/collected_info.yaml` | `documents/prd.md` |
| SRS Writer | `documents/prd.md` | `documents/srs.md` |
| SDS Writer | `documents/srs.md` | `documents/sds.md` |
| Issue Generator | `documents/sds.md` | `issues/issues.json` |
| Controller | `issues/issues.json` | `progress/controller_state.yaml` |
| Worker | `progress/work_orders.yaml` | Implementation results |
| PR Reviewer | Worker results | PR status |
| Document Reader | `docs/*.md` | `state/current_state.yaml` |
| Codebase Analyzer | Source code | `analysis/architecture_overview.yaml` |
| Impact Analyzer | State + analysis | `impact/impact_report.yaml` |

---

## Communication Protocols

### 1. Sequential Pipeline Protocol

Used in document generation pipeline:

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ Collector │───▶│PRD Writer │───▶│SRS Writer │───▶│SDS Writer │
└───────────┘    └───────────┘    └───────────┘    └───────────┘
      │                │                │                │
      ▼                ▼                ▼                ▼
 collected_info    prd.md           srs.md           sds.md
```

**Protocol Steps**:
1. Agent A completes and writes output
2. Orchestrator validates output
3. Orchestrator spawns Agent B
4. Agent B reads input and processes

### 2. Parallel Analysis Protocol

Used in enhancement pipeline analysis:

```
                    ┌─────────────────┐
                    │   Orchestrator  │
                    └─────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ DocReader│  │CodeAnalyz│  │CodeReader│
        └──────────┘  └──────────┘  └──────────┘
              │             │             │
              ▼             ▼             ▼
        current_state  architecture   code_inventory
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                    ┌─────────────────┐
                    │ Impact Analyzer │
                    └─────────────────┘
```

**Protocol Steps**:
1. Orchestrator spawns multiple agents in parallel
2. Each agent writes to its designated file
3. Orchestrator waits for all completions
4. Downstream agent reads all outputs

### 3. Work Distribution Protocol

Used by Controller to distribute work:

```
┌────────────────┐
│   Controller   │
└────────────────┘
        │
        ├──▶ work_order_1 ──▶ Worker 1 ──▶ result_1
        │
        ├──▶ work_order_2 ──▶ Worker 2 ──▶ result_2
        │
        └──▶ work_order_3 ──▶ Worker 3 ──▶ result_3
                                              │
                                              ▼
                                       PR Reviewer
```

**Work Order Format**:
```yaml
work_order:
  id: "WO-001"
  issue_number: 42
  issue_title: "Implement user authentication"
  priority: P0
  dependencies: []
  assigned_worker: "worker-1"
  status: "assigned"
  created_at: "2025-01-01T00:00:00Z"
```

### 4. Result Aggregation Protocol

Used when multiple workers complete:

```yaml
# progress/controller_state.yaml
completed_work:
  - order_id: "WO-001"
    status: "success"
    pr_number: 101
    completed_at: "2025-01-01T01:00:00Z"

  - order_id: "WO-002"
    status: "success"
    pr_number: 102
    completed_at: "2025-01-01T01:30:00Z"

pending_review:
  - pr_number: 101
  - pr_number: 102
```

---

## Data Formats

### YAML Schema Examples

#### collected_info.yaml
```yaml
schema_version: "1.0"
project_name: "my-project"
collected_at: "2025-01-01T00:00:00Z"

requirements:
  functional:
    - id: "REQ-001"
      description: "User can log in with email"
      priority: "high"
      source: "user_input"

  non_functional:
    - id: "NFR-001"
      description: "Response time < 200ms"
      category: "performance"

constraints:
  - "Must use existing auth provider"

assumptions:
  - "Users have email addresses"
```

#### current_state.yaml
```yaml
schema_version: "1.0"
analysis_date: "2025-01-01T00:00:00Z"

project:
  name: "existing-project"
  version: "2.1.0"

documents:
  prd:
    path: "docs/PRD.md"
    exists: true
    requirements_count: 15
  srs:
    path: "docs/SRS.md"
    exists: true
    features_count: 23
  sds:
    path: "docs/SDS.md"
    exists: false

traceability:
  - prd_id: "FR-001"
    srs_ids: ["SF-001", "SF-002"]
    sds_ids: ["CMP-001"]
```

### JSON Schema Examples

#### issues.json
```json
{
  "schema_version": "1.0",
  "generated_at": "2025-01-01T00:00:00Z",
  "issues": [
    {
      "id": "ISSUE-001",
      "title": "Implement AuthService component",
      "sds_component": "CMP-001",
      "priority": "P0",
      "labels": ["feature", "auth"],
      "dependencies": [],
      "effort": "M",
      "body": "..."
    }
  ],
  "dependency_graph": {
    "ISSUE-001": [],
    "ISSUE-002": ["ISSUE-001"]
  }
}
```

---

## Synchronization Mechanisms

### 1. File Locking

Atomic writes prevent corruption:

```typescript
// Scratchpad uses atomic write operations
await scratchpad.write('data', content, {
  atomic: true,
  backup: true
});
```

### 2. Schema Versioning

Files include version for compatibility:

```yaml
schema_version: "1.0"
# ... rest of content
```

### 3. Validation on Read

Agents validate input before processing:

```typescript
const data = await scratchpad.read('collected_info');
const validated = collectedInfoSchema.parse(data);
```

### 4. Checkpointing

Progress is checkpointed for recovery:

```yaml
checkpoint:
  stage: "srs_generation"
  completed_stages:
    - "collection"
    - "prd_generation"
  last_updated: "2025-01-01T00:30:00Z"
```

---

## Error Handling in Communication

### Write Failures

```typescript
try {
  await scratchpad.write('output', data);
} catch (error) {
  if (error.code === 'ENOSPC') {
    // Handle disk space issue
  }
  throw new CommunicationError('Failed to write state', error);
}
```

### Read Failures

```typescript
try {
  const data = await scratchpad.read('input');
} catch (error) {
  if (error.code === 'ENOENT') {
    // Input not yet available - wait or fail
  }
  throw new CommunicationError('Failed to read state', error);
}
```

### Validation Failures

```typescript
try {
  const validated = schema.parse(data);
} catch (error) {
  // Log detailed validation error
  // Notify user of malformed state
  throw new ValidationError('Invalid state format', error);
}
```

---

## Best Practices

### For Agent Developers

1. **Always validate input** before processing
2. **Write complete state** - don't rely on partial updates
3. **Include timestamps** for debugging and auditing
4. **Use schema versions** for backward compatibility
5. **Handle missing files** gracefully

### For Pipeline Design

1. **Minimize dependencies** between parallel agents
2. **Design for idempotency** - re-running should be safe
3. **Include recovery points** at each stage
4. **Log all state transitions** for debugging

### For Error Recovery

1. **Preserve failed state** for debugging
2. **Provide clear error messages** about what failed
3. **Support partial recovery** where possible
4. **Alert users** when manual intervention needed

---

## Related Documentation

- [Data Flow](./data-flow.md) - Complete data flow diagrams
- [Scratchpad Schema Reference](../reference/schemas/scratchpad.md)
- [Agent Reference](../reference/agents/) - Individual agent documentation

---

*Part of [AD-SDLC Architecture Documentation](./overview.md)*
