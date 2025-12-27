# Progress Directory

This directory stores progress tracking data managed by the Controller Agent (CMP-006).

## Structure

```
progress/{project_id}/
├── controller_state.yaml  # Controller state and worker pool
├── work_orders/           # Assigned work orders
│   └── WO-{xxx}.yaml
├── results/               # Implementation results
│   └── WO-{xxx}-result.yaml
└── reviews/               # PR review results
    └── PR-{xxx}-review.yaml
```

## File Descriptions

### controller_state.yaml
Real-time controller state:
```yaml
session_id: "sess-123"
started_at: "2025-12-27T10:00:00Z"
status: "running"
workers:
  - id: "worker-1"
    status: "working"
    current_issue: "ISS-005"
    started_at: "2025-12-27T10:30:00Z"
queue:
  pending: ["ISS-010", "ISS-011"]
  in_progress: ["ISS-005", "ISS-006"]
  completed: ["ISS-001", "ISS-002"]
  blocked: []
progress:
  total: 15
  completed: 2
  percentage: 13.3
```

### work_orders/WO-{xxx}.yaml
Work assignment for a Worker:
```yaml
order_id: "WO-001"
issue_id: "ISS-005"
issue_url: "https://github.com/owner/repo/issues/5"
created_at: "2025-12-27T10:30:00Z"
context:
  sds_component: "CMP-001"
  related_files: []
  dependencies_status: []
acceptance_criteria: []
```

### results/WO-{xxx}-result.yaml
Implementation result from a Worker:
```yaml
order_id: "WO-001"
issue_id: "ISS-005"
status: "completed"
branch_name: "feature/ISS-005-collector-agent"
changes: []
tests_added: []
completed_at: "2025-12-27T11:00:00Z"
```

### reviews/PR-{xxx}-review.yaml
PR review result from PR Reviewer:
```yaml
pr_number: 42
review_status: "approved"
quality_gates:
  coverage: 85
  complexity: 8
  lint_errors: 0
decision: "merge"
reviewed_at: "2025-12-27T11:30:00Z"
```

## Notes

- Controller polls this directory every 30 seconds
- State is updated atomically to prevent corruption
- Historical data can be archived after project completion
