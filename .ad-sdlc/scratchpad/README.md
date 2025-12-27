# Scratchpad Directory

This directory implements the **Scratchpad Pattern** for inter-agent state sharing in the AD-SDLC system.

## Purpose

The Scratchpad pattern overcomes the unidirectional communication limitation of Claude Agent SDK by enabling file-based state sharing:

```
Producer Agent ─── Write State ───▶ Scratchpad (File System)
                                           │
Consumer Agent ◀── Read State ────────────┘
```

## Structure

```
scratchpad/
├── info/{project_id}/           # Collected information
│   ├── collected_info.yaml      # Structured requirements
│   └── clarifications.json      # Q&A history
├── documents/{project_id}/      # Generated documents
│   ├── prd.md                   # Product Requirements
│   ├── srs.md                   # Software Requirements
│   └── sds.md                   # Software Design
├── issues/{project_id}/         # Issue tracking
│   ├── issue_list.json          # Generated issues
│   └── dependency_graph.json    # Issue dependencies
└── progress/{project_id}/       # Progress tracking
    ├── controller_state.yaml    # Controller state
    ├── work_orders/             # Assigned work
    ├── results/                 # Implementation results
    └── reviews/                 # PR review results
```

## Project Isolation

Each project uses a unique `{project_id}` to isolate its data:
- Generated automatically or specified at project creation
- Format: `001`, `002`, etc. or custom identifiers

## File Formats

| Format | Usage |
|--------|-------|
| YAML | Configuration and state files |
| JSON | Structured data (issues, graphs) |
| Markdown | Documents (PRD, SRS, SDS) |

## Atomic Operations

All writes use atomic operations (write to temp, then rename) to prevent partial writes and ensure data integrity.

## Notes

- This directory may be excluded from version control
- Project-specific data can be archived after completion
- See SDS-001 Section 2.2.1 for detailed pattern specification
