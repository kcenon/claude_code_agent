---
description: Start a new Greenfield AD-SDLC pipeline
argument-hint: '<requirements> [--project-dir <dir>] [--tech-stack <stack>]'
---

Run a Greenfield AD-SDLC pipeline against the user-supplied requirements.

Steps:

1. If `.ad-sdlc/` is missing in the target project directory, run
   `npx ad-sdlc init --quick --tech-stack ${tech-stack:-typescript}` first.
2. Execute `npx ad-sdlc run "$ARGUMENTS" --mode greenfield` using the
   remaining arguments verbatim.
3. Stream stage progress and surface any stage failures to the user.
4. On failure, suggest re-running with `/resume <session-id>` (the
   session id is printed by `ad-sdlc run` on every stage transition).
