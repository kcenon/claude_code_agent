---
description: Print current AD-SDLC pipeline status
argument-hint: '[--project <id>] [--format text|json] [--verbose]'
---

Show the current AD-SDLC pipeline status for the active project.

Steps:

1. Execute `npx ad-sdlc status $ARGUMENTS` from the project root.
2. By default the command prints a text summary of stages, the active
   session, and any blocked or failed stages. Pass `--format json` for
   machine-readable output.
3. Use `--project <id>` to target a specific tracked project, and
   `--verbose` to surface per-stage timestamps and last-error context.
4. Relay the formatted output back to the user without modification.
