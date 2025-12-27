# Logs Directory

This directory contains audit logs for the AD-SDLC system.

## Structure

```
logs/
├── ad-sdlc.log      # Main system log
└── agent-logs/      # Per-agent execution logs
    ├── collector.log
    ├── prd-writer.log
    ├── srs-writer.log
    ├── sds-writer.log
    ├── issue-generator.log
    ├── controller.log
    ├── worker-{n}.log
    └── pr-reviewer.log
```

## Log Format

Logs use JSON structured format:
```json
{
  "timestamp": "2025-12-27T10:00:00Z",
  "level": "INFO",
  "agent": "collector",
  "session_id": "sess-123",
  "event": "stage_complete",
  "details": {}
}
```

## Retention

- Logs are automatically rotated daily
- Retained for 30 days by default
- Configurable via workflow.yaml

## Notes

- This directory should be excluded from version control
- Log files are created automatically during system execution
