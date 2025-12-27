# AD-SDLC Directory

This directory contains all configuration and runtime data for the Agent-Driven Software Development Lifecycle system.

## Structure

```
.ad-sdlc/
├── config/           # Configuration files
│   ├── agents.yaml   # Agent registry and settings
│   └── workflow.yaml # Pipeline configuration
├── logs/             # Audit logs
│   ├── ad-sdlc.log   # Main system log
│   └── agent-logs/   # Per-agent logs
├── scratchpad/       # Inter-agent state (Scratchpad pattern)
│   ├── info/         # Collected information
│   ├── documents/    # Generated documents
│   ├── issues/       # Issue tracking data
│   └── progress/     # Work orders and results
└── templates/        # Document templates
```

## Key Concepts

### Scratchpad Pattern
The Scratchpad pattern enables file-based state sharing between agents, overcoming the unidirectional communication constraint of Claude Agent SDK. Agents write their output to designated files, which subsequent agents can read.

### Project Isolation
Each project gets its own subdirectory under scratchpad sections (e.g., `scratchpad/info/{project_id}/`), ensuring clean separation between different development efforts.

## Notes

- Configuration in `config/` is version-controlled
- Runtime state in `scratchpad/` may be excluded from version control for privacy
- Logs are automatically rotated and managed by the system
