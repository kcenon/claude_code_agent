---
description: Initialize the intended project root and start a Greenfield AD-SDLC pipeline
argument-hint: '<requirements> [--project-dir <dir>] [--tech-stack <stack>] [--stop-after <stage>] [--local] [--approval-mode <mode>] [--dry-run]'
required-assets:
  - agent:ad-sdlc-orchestrator
  - command:resume
---

Run a Greenfield pipeline using the installed `ad-sdlc` executable.

1. Parse requirements and options separately. Resolve the intended project root
   from `--project-dir`, defaulting to the current project directory. Keep the
   requirements as one string argument, including quotes or newlines.
2. If that root has no `.ad-sdlc/`, initialize that directory: from the root,
   `ad-sdlc init . --quick --tech-stack typescript`. Use the supplied tech stack
   when present. Pass `.` explicitly to avoid a nested `my-project`. Stop if
   initialization fails. Preserve existing configuration.
3. Invoke the installed executable with an argument array, equivalent to:

   ```javascript
   execFileSync(executable, [
     'run', requirements, '--mode', 'greenfield', '--project-dir', projectRoot,
     ...runOptions,
   ], { cwd: projectRoot, stdio: 'inherit', shell: false });
   ```

   `executable` is the installed `ad-sdlc` executable path. Forward only supported
   run options (`--stop-after`, `--local`, `--approval-mode`, `--dry-run`) as
   separate array elements. `--tech-stack` belongs only to initialization.
   Check `ad-sdlc run --help` for option values. Do not embed options in requirements.
4. Never expand `$ARGUMENTS` in a shell or interpolate requirements into shell
   source. If using a shell tool, use Write to place requirements/options in a
   JSON file and a Node runner that reads it and calls `execFileSync` with
   `shell: false`. Execute the runner with quoted paths; requirements remain data.
   No plugins or repository npm scripts are required.
5. Relay progress and failures. For an interrupted session, offer
   `/resume <session-id> --project-dir <dir>` with the original requirements and
   run options. The CLI prints the session ID when starting execution.
