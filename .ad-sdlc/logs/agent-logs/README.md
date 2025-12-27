# Agent Logs Directory

This directory contains individual log files for each agent in the AD-SDLC system.

## Files

Each agent writes to its own log file:

| File | Agent | Description |
|------|-------|-------------|
| `collector.log` | CMP-001 | Information collection activities |
| `prd-writer.log` | CMP-002 | PRD generation process |
| `srs-writer.log` | CMP-003 | SRS generation process |
| `sds-writer.log` | CMP-004 | SDS generation process |
| `issue-generator.log` | CMP-005 | Issue creation activities |
| `controller.log` | CMP-006 | Worker orchestration and scheduling |
| `worker-{n}.log` | CMP-007 | Code implementation (one per worker) |
| `pr-reviewer.log` | CMP-008 | PR creation and review activities |

## Usage

For debugging specific agent behavior:
```bash
# View collector agent logs
cat .ad-sdlc/logs/agent-logs/collector.log | jq

# Follow controller logs in real-time
tail -f .ad-sdlc/logs/agent-logs/controller.log
```

## Notes

Log files are created automatically when agents execute.
