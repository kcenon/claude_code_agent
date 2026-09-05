---
description: Resume an interrupted AD-SDLC pipeline using its original requirements
argument-hint: '<session-id> [--project-dir <dir>]'
required-assets:
  - agent:ad-sdlc-orchestrator
---

1. Resolve the intended project directory from `--project-dir` or the current
   project root. Obtain the session ID from the earlier CLI output and the
   original requirements and mode from the user or previous conversation.
2. Use the existing `run <requirements> --resume <session-id>` interface:

   ```javascript
   execFileSync(executable, [
     'run', requirements, '--resume', sessionId, '--project-dir', projectRoot,
     '--mode', originalMode, ...runOptions,
   ], { cwd: projectRoot, stdio: 'inherit', shell: false });
   ```

   `executable` is the installed `ad-sdlc` path. Preserve applicable original
   `--local`, `--approval-mode`, and `--stop-after` options as separate arguments.
   Check `ad-sdlc run --help`; requirements are a required positional argument.
3. Keep user input as data, never shell-interpolated source. If using a shell
   tool, Write a JSON request and a Node runner that reads it and uses the argument
   array above. Do not expand `$ARGUMENTS` or `$1` into a shell command.
4. The orchestrator restores available prior outputs and continues execution.
   Relay restore errors; do not silently start a different project/session.
