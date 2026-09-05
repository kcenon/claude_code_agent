---
description: Print tracked AD-SDLC pipeline status from the intended project root
argument-hint: '[--project <id>] [--format text|json] [--verbose]'
---

1. Execute the installed `ad-sdlc status` from the intended project root. Status
   uses the working directory; it has no `--project-dir` option.
2. Forward only the supported `--project <id>`, `--format text|json`, and
   `--verbose` options as separate, safely quoted arguments. Do not expand raw
   `$ARGUMENTS` in a shell. `--project` selects a tracked project ID, not a path.
3. Check `ad-sdlc status --help` for the installed contract and relay the formatted
   output, including empty/missing status or errors, without inventing stage data.
