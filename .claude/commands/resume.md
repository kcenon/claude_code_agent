---
description: Resume an interrupted AD-SDLC pipeline session
argument-hint: '<session-id> [--project-dir <dir>]'
---

Resume a previously interrupted AD-SDLC pipeline session.

The CLI does not yet expose a dedicated `ad-sdlc resume` subcommand. Resume
is implemented as a flag on `ad-sdlc run`:

1. Locate the session id from `.ad-sdlc/sessions/` (most recent directory)
   or from earlier `ad-sdlc run` console output.
2. Re-issue the original requirements text and pass `--resume <session-id>`:
   `npx ad-sdlc run "<original requirements>" --resume "$1"`.
3. The orchestrator restores prior stage outputs via `loadPriorSession` and
   continues from the first incomplete stage.
4. If the requirements text is unknown, inspect
   `.ad-sdlc/sessions/<session-id>/manifest.json` for the original request.
