# CLI Reference

This page collects the `ad-sdlc` command usage. Install the CLI from source as
described in the [Installation Guide](installation.md); run
`ad-sdlc <command> --help` for the option list of the build you installed.

## Table of Contents

1. [Command Summary](#command-summary)
2. [Initialize a Project](#initialize-a-project)
3. [Check the Environment](#check-the-environment)
4. [Run the Pipeline](#run-the-pipeline)
5. [Drive the Pipeline from Claude Code](#drive-the-pipeline-from-claude-code)
6. [Slash Commands](#slash-commands)
7. [Document Audit](#document-audit)
8. [Update Installed Agents and Commands](#update-installed-agents-and-commands)
9. [Shell Autocompletion](#shell-autocompletion)

---

## Command Summary

```bash
# Initialize new project
ad-sdlc init [project-name] [--quick] [--template minimal|standard|enterprise] [--skip-validation]

# Run the pipeline (all options: see "Run the Pipeline" below)
ad-sdlc run "<requirements>" [--mode greenfield|enhancement|import] [--project-dir <dir>] [--resume <session-id>] [--stop-after <stage>] [--local] [--dry-run] [--format text|json]

# Validate configuration files
ad-sdlc validate [--project-dir <dir>] [--file <path>] [--watch] [--format text|json]

# Check pipeline status and list saved sessions
ad-sdlc status [--project-dir <dir>] [--project <id>] [--format text|json] [--verbose]

# Check environment prerequisites (see "Check the Environment" below)
ad-sdlc doctor [--project-dir <dir>]

# Print the version of the installed package
ad-sdlc --version

# Audit generated documents (see "Document Audit" below)
ad-sdlc audit-docs --project-dir <dir> [--output <dir>] [--quiet]

# Plan or apply updates of the installed canonical agents and commands
ad-sdlc assets update --project-dir <dir> [--dry-run]

# Analyze project for documentation-code gaps
ad-sdlc analyze [--project <path>] [--scope full|documents_only|code_only|comparison]

# Manage opt-in telemetry (`telemetry enable --yes` accepts the privacy policy)
ad-sdlc telemetry <status|enable|disable|policy>

# Generate shell completion script
ad-sdlc completion --shell <bash|zsh|fish>
```

---

## Initialize a Project

```bash
# Interactive mode - guides you through configuration
ad-sdlc init

# Quick setup with defaults
ad-sdlc init my-project --quick

# With specific options
ad-sdlc init my-project --template standard --skip-validation
```

`ad-sdlc init` takes no repository URL and records none. During `ad-sdlc run`, the `repo_detection` stage reads the project's git remote `origin`; to work against an existing GitHub repository, add it as `origin` before the run.

`ad-sdlc init` also takes no technology stack: it writes the same project for every language, and no pipeline stage reads a language setting from it. `--tech-stack` is rejected as an unknown option, and the interactive wizard does not ask for a stack.

### Template Options

`--template` accepts `minimal`, `standard` (the `--quick` default), or `enterprise`. All three currently write the same files: the same canonical agents and four commands, the same `agents.yaml`, and the same `workflow.yaml` (`version: 1.0.0`, `pipeline.default_mode: greenfield`). The [runtime inventory](architecture/runtime-inventory.md) lists the current number of canonical agent prompts.

The worker-count (2/3/5), coverage (50/70/80%), and feature presets (token tracking, dashboard, audit logging, security scanning) that earlier versions of the README listed per template are historical values marked `@deprecated` in `src/project-initializer/types.ts`. They are not written to the project and are not enforced; stage concurrency, retries, timeouts, and verification are configured through the [runtime configuration contract](configuration/RUNTIME_WORKFLOW.md) instead.

### Generated Layout

`ad-sdlc init` creates the following layout. Pipeline runs then add generated documents, source code, and run state.

```
your-project/
├── .claude/
│   ├── agents/              # Canonical agent definitions (see the runtime inventory)
│   │   └── *.md             # Agent prompts (English, used by Claude)
│   └── commands/            # Project slash commands (see Slash Commands)
├── .ad-sdlc/
│   ├── asset-lock.json      # Installed asset versions and ownership baselines
│   ├── config/              # Configuration files
│   │   ├── agents.yaml      # Agent registry
│   │   └── workflow.yaml    # Pipeline configuration
│   ├── logs/                # Audit logs
│   ├── templates/           # Document templates (PRD, SRS, SDS, issue)
│   └── scratchpad/          # Inter-agent state (Scratchpad pattern)
│       ├── info/, documents/, issues/, progress/
│       └── pipeline/        # Saved run state for --resume (created by ad-sdlc run)
├── docs/                    # Generated documentation (prd/, srs/, sds/)
├── .gitignore               # AD-SDLC entries appended
└── README.md
```

---

## Check the Environment

```bash
# Check the current directory
ad-sdlc doctor

# Check another project
ad-sdlc doctor --project-dir ./my-project
```

`ad-sdlc doctor` prints one line per check: the Node.js version, Git, the GitHub CLI, the AI bridge (`ANTHROPIC_API_KEY` or a Claude Code session), local mode, the configuration files, and free disk space. A passing check prints `OK`. A failed required check (Node.js, Git, disk space) prints `FAIL`; a failed optional check (GitHub CLI, AI bridge, configuration files) prints `WARN`. The configuration check looks for `.ad-sdlc/config/workflow.yaml` and `.ad-sdlc/config/agents.yaml` in the project directory (`--project-dir`, default: the current directory); in an initialized project it prints `OK  Config files: workflow.yaml + agents.yaml found`.

The AI bridge is optional because only a live `ad-sdlc run` needs it: `init`, `validate`, `status`, `audit-docs`, `assets update`, and `run --dry-run` work without one. `doctor` ends with one of three results, and `WARN` lines never change the exit status:

- Every required check passes and an AI bridge is detected: `Ready for pipeline execution.`, exit status 0.
- Every required check passes but no AI bridge is detected: `Environment OK but no AI bridge configured. Set ANTHROPIC_API_KEY or run inside a Claude Code session before a live run.`, exit status 0.
- A required check fails: `Some required checks failed. Fix the issues above.`, exit status 1.

`ad-sdlc --version` prints the `version` field of the installed package's `package.json`.

---

## Run the Pipeline

`ad-sdlc run` runs the complete canonical pipeline end-to-end. It takes the requirements text as its only argument:

```bash
# Run in an initialized project
ad-sdlc run "Build a todo app with user accounts" --project-dir .

# Specify the mode explicitly
ad-sdlc run "<requirements>" --mode greenfield --project-dir .
ad-sdlc run "<requirements>" --mode enhancement --project-dir .
ad-sdlc run "<requirements>" --mode import --project-dir .

# Validate the configuration and print the stage graph without calling the SDK
ad-sdlc run "<requirements>" --project-dir . --dry-run

# Stop after a stage (stages that are runnable alongside it may still run)
ad-sdlc run "<requirements>" --mode greenfield --project-dir . --stop-after sds_generation

# Run without GitHub, using the local agent variants
ad-sdlc run "<requirements>" --project-dir . --local

# List saved sessions and their status
ad-sdlc status --project-dir .

# Resume a saved session
ad-sdlc run "<requirements>" --resume <session-id> --project-dir .
```

- **Mode**: without `--mode`, the mode comes from the `AD_SDLC_MODE` environment variable or from `pipeline.default_mode` in `.ad-sdlc/config/workflow.yaml` (`greenfield` in a freshly initialized project).
- **Session IDs**: a finished run prints `Pipeline <session-id>: <status> (<mode>)`, and `ad-sdlc status --project-dir .` prints one `Session <session-id>: <status>` line per saved run. Each run is saved as `.ad-sdlc/scratchpad/pipeline/<session-id>.yaml`.
- **Resume**: `--resume` reuses the saved stage graph and runtime policy and skips the stages that session already completed. It rejects `--mode`, `--local`, and policy overrides; only `--stop-after` may change on resume.
- **No start-from or session-list flag**: `ad-sdlc run` has no option to start from a later stage and no `--list-sessions`; use `ad-sdlc status` to find sessions.
- **Local mode**: `--local` (or `AD_SDLC_LOCAL=1`) skips GitHub issue creation and PR operations; see the [Quickstart](quickstart.md#local-mode-no-github-required).
- **Policy options**: `--approval-mode auto|manual|critical`, `--max-parallel-stages <count>`, `--max-attempts <count>`, `--retry-backoff fixed|linear|exponential|fibonacci`, `--retry-base-delay-seconds <seconds>`, `--retry-max-delay-seconds <seconds>`, `--stage-timeout-ms <ms>`, `--vnv-rigor minimal|standard|strict`, `--vnv-profile advisory|delivery`, and `--halt-on-verification-failure <boolean>`. See the [runtime configuration contract](configuration/RUNTIME_WORKFLOW.md) for their precedence and validation.
- **Verification**: every completed stage is verified. Under the default `advisory` profile, failed checks are kept as findings and the run continues; `--vnv-profile delivery` (or `global.vnv.profile: delivery`) fails the run with exit status 1 when a required check fails. The text output ends with a `Verification: <status> (profile <profile> from <source>, rigor <rigor>)` summary, and JSON results carry the same data under `verification`. See the [verification policy guide](guides/verification-policy.md).
- **Output and credentials**: `--format json` prints a single JSON result; a failed run prints `ready: false`, the error, and the failed run under `result`. A live run needs `ANTHROPIC_API_KEY` or a Claude Code session; `--allow-stub` allows execution without detected SDK credentials for offline testing.

Run `ad-sdlc run --help` for the full option list.

---

## Drive the Pipeline from Claude Code

Inside an initialized project, Claude Code can also run individual steps with the installed agent definitions:

```bash
# Start with requirements collection
claude "Collect requirements for [your project description]"

# Generate documents step by step
claude "Generate PRD from collected information"
claude "Generate SRS from PRD"
claude "Generate SDS from SRS"

# Create GitHub Issues
claude "Generate GitHub issues from SDS"

# Implement and review
claude "Start implementation with Controller"
```

See [Use Cases](use-cases.md) for more request examples.

---

## Slash Commands

The scaffold installs `.claude/commands/*.md` for use as project slash commands in Claude Code sessions. Each file declares its argument shape via YAML frontmatter (`description`, optional `argument-hint`) and a short markdown body that instructs the assistant which CLI subcommand to run.

| Command           | File                                 | Wraps                                                                                     |
| ----------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `/run-greenfield` | `.claude/commands/run-greenfield.md` | `ad-sdlc init . --quick` + `ad-sdlc run <requirements> --mode greenfield --project-dir .` |
| `/resume`         | `.claude/commands/resume.md`         | `ad-sdlc run <requirements> --resume <session-id> --project-dir .`                        |
| `/audit-docs`     | `.claude/commands/audit-docs.md`     | `ad-sdlc audit-docs --project-dir .`                                                      |
| `/status`         | `.claude/commands/status.md`         | `ad-sdlc status`                                                                          |

To use them, open the project inside a Claude Code session and type the command (for example `/run-greenfield "Build a todo app"`). Claude follows the matching markdown instructions, parsing requirements and supported options separately and keeping unchecked input out of shell source. New commands can be added by dropping a markdown file with valid frontmatter into `.claude/commands/`.

---

## Document Audit

Once the pipeline has generated documents, validate them with the document audit CLI:

```bash
# Audit the current project (writes reports to .ad-sdlc/audit/)
ad-sdlc audit-docs --project-dir .

# Audit a different project and pick the output directory
ad-sdlc audit-docs --project-dir ./my-project --output audit-reports

# Repository contributors may also use the compatible wrapper
npm run audit:docs -- --project-dir ./my-project
```

The auditor runs frontmatter, required-section, cross-reference, PRD→SRS→SDS
traceability, orphan, Mermaid, and relative-link checks across PRD, SRS, SDS,
SDP, TM, SVP, TD, and DBS documents. It writes both a machine-readable
`audit-report.json` and a human-readable `audit-report.md`, and exits with a
non-zero status on any error-severity finding, so it can run as a local
pre-merge check or as a CI quality gate. See the
[Document Audit CLI](doc-audit.md) guide for the full list of checks,
report format, exit codes, and CI integration. The frontmatter fields it checks
are listed in the [document frontmatter reference](reference/document-frontmatter.md).

---

## Update Installed Agents and Commands

All templates install the canonical agents and four commands from the npm package.
See [Canonical assets and upgrades](agent-assets.md) for manifest regeneration,
versioning, customization handling, and legacy migration.

```bash
ad-sdlc assets update --project-dir . --dry-run
ad-sdlc assets update --project-dir .
```

The [runtime inventory](architecture/runtime-inventory.md#agent-definitions-by-phase)
lists every definition in `.claude/agents/` by pipeline phase and describes the
definition file format.

---

## Shell Autocompletion

Enable tab completion for AD-SDLC commands in your shell. The scripts complete every command (`init`, `run`, `validate`, `status`, `doctor`, `audit-docs`, `assets update`, `analyze`, `telemetry status|enable|disable|policy`, `completion`), their options, and the values of options with a fixed choice list. The bash script needs the `bash-completion` package.

```bash
# Bash
ad-sdlc completion --shell bash >> ~/.bashrc
source ~/.bashrc

# Zsh
ad-sdlc completion --shell zsh > ~/.zsh/completions/_ad-sdlc
source ~/.zshrc

# Fish
ad-sdlc completion --shell fish > ~/.config/fish/completions/ad-sdlc.fish
```

---

_Part of [AD-SDLC Documentation](../README.md)_
