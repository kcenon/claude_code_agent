# Controller Agent Reference

> **Agent ID**: `controller`
> **Model**: Haiku
> **Category**: Execution Pipeline

## Overview

The Controller Agent orchestrates work distribution across Worker agents. It analyzes issue dependencies, prioritizes work, assigns tasks to workers, and tracks progress until all issues are complete.

---

## Configuration

### Agent Definition

**Location**: `.claude/agents/controller.md`

```markdown
---
name: controller
description: |
  Orchestrates work distribution.
  Manages worker assignments and tracks progress.
  Handles dependency resolution.
tools: Read, Write, Bash
model: haiku
---
```

### YAML Configuration

```yaml
# .ad-sdlc/config/agents.yaml
controller:
  id: "controller"
  name: "Controller Agent"
  model: haiku  # Fast decisions
  timeout: 600000  # 10 minutes per cycle

  capabilities:
    - dependency_analysis
    - work_prioritization
    - worker_management
    - progress_tracking

  tools:
    - Read
    - Write
    - Bash

  orchestration:
    max_parallel_workers: 5
    worker_timeout: 1800000  # 30 minutes
    poll_interval: 30000     # 30 seconds

  priority_weights:
    p0: 100
    p1: 50
    p2: 10
```

---

## Input

### Source

Issues from Issue Generator via scratchpad.

### Issues Schema

```yaml
# .ad-sdlc/scratchpad/{project}/issues/issues.json
{
  "schema_version": "1.0",
  "generated_at": "2025-01-01T00:00:00Z",
  "issues": [
    {
      "id": "ISSUE-001",
      "github_number": 42,
      "title": "Implement AuthService",
      "component": "CMP-001",
      "priority": "P0",
      "effort": "M",
      "dependencies": [],
      "labels": ["feature", "auth"]
    },
    {
      "id": "ISSUE-002",
      "github_number": 43,
      "title": "Implement SessionManager",
      "component": "CMP-002",
      "priority": "P0",
      "effort": "M",
      "dependencies": ["ISSUE-001"],
      "labels": ["feature", "auth"]
    }
  ],
  "dependency_graph": {
    "ISSUE-001": [],
    "ISSUE-002": ["ISSUE-001"],
    "ISSUE-003": ["ISSUE-001"],
    "ISSUE-004": ["ISSUE-002", "ISSUE-003"]
  }
}
```

---

## Output

### Controller State

```yaml
# .ad-sdlc/scratchpad/{project}/progress/controller_state.yaml
schema_version: "1.0"
updated_at: "2025-01-01T01:00:00Z"

orchestration:
  started_at: "2025-01-01T00:00:00Z"
  status: "in_progress"
  total_issues: 10
  completed: 4
  in_progress: 3
  pending: 3

# Dependency resolution result
execution_order:
  - level: 0  # No dependencies
    issues: ["ISSUE-001", "ISSUE-005"]

  - level: 1  # Depends on level 0
    issues: ["ISSUE-002", "ISSUE-003"]

  - level: 2  # Depends on level 1
    issues: ["ISSUE-004"]

# Current assignments
active_workers:
  - worker_id: "worker-1"
    issue: "ISSUE-002"
    started_at: "2025-01-01T00:30:00Z"
    status: "running"

  - worker_id: "worker-2"
    issue: "ISSUE-003"
    started_at: "2025-01-01T00:30:00Z"
    status: "running"

# Completed work
completed_issues:
  - issue: "ISSUE-001"
    worker_id: "worker-1"
    completed_at: "2025-01-01T00:25:00Z"
    duration_ms: 1500000
    pr_number: 101

  - issue: "ISSUE-005"
    worker_id: "worker-2"
    completed_at: "2025-01-01T00:28:00Z"
    duration_ms: 1680000
    pr_number: 102

# Issues ready for assignment
ready_queue:
  - issue: "ISSUE-006"
    priority: "P1"
    dependencies_met: true

# Blocked issues
blocked_issues:
  - issue: "ISSUE-004"
    blocked_by: ["ISSUE-002", "ISSUE-003"]
    reason: "Waiting for dependencies"
```

### Work Orders

```yaml
# .ad-sdlc/scratchpad/{project}/progress/work_orders.yaml
work_orders:
  - id: "WO-001"
    issue_number: 42
    status: "completed"
    assigned_to: "worker-1"

  - id: "WO-002"
    issue_number: 43
    status: "in_progress"
    assigned_to: "worker-1"

  - id: "WO-003"
    issue_number: 44
    status: "pending"
    assigned_to: null
```

---

## Behavior

### Processing Steps

1. **Issue Loading**
   - Read issues from scratchpad
   - Parse dependency graph
   - Validate no circular dependencies

2. **Dependency Analysis**
   - Build dependency DAG
   - Perform topological sort
   - Group issues by dependency level

3. **Priority Calculation**
   ```
   score = priority_weight + (1 / dependency_level)
   ```

4. **Work Distribution Loop**
   ```
   while (pending_issues > 0):
     1. Check completed workers
     2. Update dependency status
     3. Identify ready issues
     4. Assign to available workers
     5. Wait for poll_interval
   ```

5. **Worker Management**
   - Spawn worker agents in parallel
   - Monitor worker status
   - Handle worker failures

6. **Progress Reporting**
   - Update controller state
   - Log progress metrics
   - Notify on completion/failure

### Dependency Resolution

```
Input Graph:
  ISSUE-001: []
  ISSUE-002: [ISSUE-001]
  ISSUE-003: [ISSUE-001]
  ISSUE-004: [ISSUE-002, ISSUE-003]

Topological Sort Result:
  Level 0: [ISSUE-001]        # No dependencies
  Level 1: [ISSUE-002, ISSUE-003]  # Parallel
  Level 2: [ISSUE-004]        # After level 1
```

### Priority Ordering

Within each dependency level, issues are ordered by:

1. **Priority** (P0 > P1 > P2)
2. **Effort** (S < M < L) - smaller first
3. **Creation order** (earlier first)

### Decision Points

| Situation | Decision |
|-----------|----------|
| Worker fails | Retry issue with different worker |
| All workers busy | Wait for next available |
| Circular dependency | Fail with error message |
| Long-running worker | Log warning at 80% timeout |
| Worker timeout | Kill worker, mark issue failed |

---

## Error Handling

### Recoverable Errors

| Error | Recovery Action |
|-------|-----------------|
| Worker failure | Reassign to different worker |
| Worker timeout | Restart with fresh worker |
| Transient git error | Retry after backoff |

### Non-Recoverable Errors

| Error | User Action Required |
|-------|---------------------|
| Circular dependency | Fix issue dependencies |
| All workers exhausted | Review failed issues |
| GitHub API limit | Wait for rate limit reset |

### Error Output

```yaml
# On critical failure
orchestration:
  status: "failed"
  failed_at: "2025-01-01T02:00:00Z"
  error:
    type: "circular_dependency"
    message: "Circular dependency detected"
    cycle: ["ISSUE-002", "ISSUE-003", "ISSUE-002"]
  requires_human_intervention: true
```

---

## Examples

### Normal Operation

**Initial State:**
- 5 issues to process
- Max 3 parallel workers

**Execution:**
```
T+0:00  Load 5 issues, analyze dependencies
T+0:01  Start workers for ISSUE-001, ISSUE-005 (level 0)
T+0:02  Start worker for ISSUE-006 (level 0, lower priority)
T+0:25  ISSUE-001 complete, start ISSUE-002
T+0:28  ISSUE-005 complete, start ISSUE-003
T+0:30  ISSUE-006 complete
T+0:50  ISSUE-002 complete
T+0:52  ISSUE-003 complete, start ISSUE-004
T+1:10  ISSUE-004 complete
T+1:10  All issues complete, trigger PR Reviewer
```

**Final State:**
```yaml
orchestration:
  status: "completed"
  total_duration_ms: 4200000  # 70 minutes
  issues:
    completed: 5
    failed: 0
```

### Handling Failure

**Scenario:** Worker-1 fails on ISSUE-002

```
T+0:25  ISSUE-001 complete
T+0:26  Assign ISSUE-002 to worker-1
T+0:45  Worker-1 reports failure (tests failed)
T+0:46  Reassign ISSUE-002 to worker-2
T+1:10  Worker-2 completes ISSUE-002
```

---

## Related Agents

### Upstream
- **Issue Generator**: Provides issues to orchestrate

### Downstream
- **Worker**: Receives work assignments
- **PR Reviewer**: Triggered after all work complete

### Spawned
- Worker agents (up to `max_parallel_workers`)

---

## Configuration Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_parallel_workers` | number | 5 | Max concurrent workers |
| `worker_timeout` | number | 1800000 | Worker timeout (ms) |
| `poll_interval` | number | 30000 | Status check interval (ms) |
| `retry_failed_issues` | boolean | true | Auto-retry failed issues |
| `max_issue_retries` | number | 2 | Max retries per issue |

---

*Part of [Agent Reference Documentation](./README.md)*
