# 5-Minute Quickstart

> **Version**: 1.1.0
> **Time Required**: 5 minutes, plus the pipeline run

This tutorial installs AD-SDLC, checks a first project without calling the
model, and then runs the pipeline with `ad-sdlc run`.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Steps 1-3: First-Run Check (offline)](#steps-1-3-first-run-check-offline)
3. [Step 4: Run the Pipeline](#step-4-run-the-pipeline)
4. [Step 5: Review Results](#step-5-review-results)
5. [Using Claude Code Instead](#using-claude-code-instead)
6. [What's Next](#whats-next)

---

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 22.22.1 or later and Git 2.30 or later
- ✅ An `ANTHROPIC_API_KEY` or a Claude Code login, for Step 4 only
- ✅ GitHub CLI authenticated (`gh auth login`) - _optional; not required for local mode_

### Install from Source

```bash
git clone https://github.com/kcenon/claude_code_agent.git
cd claude_code_agent
npm ci
npm run build
npm install -g .  # links the ad-sdlc command to this clone, so keep the clone in place
cd ..
```

Need more options? See the [Installation Guide](installation.md).

---

## Steps 1-3: First-Run Check (offline)

These steps need no API key and make no model calls. The package smoke test
(`npm run test:package`) runs exactly the commands of this section against the
packed package, so they stay accurate.

<!-- onboarding-smoke:start -->

**Step 1: Check the installation.** `doctor` reports the prerequisites; without
an API key it warns about the missing AI bridge and still succeeds.

```bash
ad-sdlc --version
ad-sdlc doctor
```

**Step 2: Initialize a project.**

```bash
ad-sdlc init my-first-project --quick
cd my-first-project
```

**Step 3: Validate the configuration and preview the pipeline.** `--dry-run`
resolves the configuration and prints the mode, the policies, and every stage
without creating an SDK adapter.

```bash
ad-sdlc validate
ad-sdlc run "Implement a REST API endpoint for user registration with email and password" --dry-run
```

<!-- onboarding-smoke:end -->

For an existing project directory, use `ad-sdlc init . --quick` from that root.
All templates currently write the same files, including the same canonical assets and
the same default `workflow.yaml`; the historical quality/worker presets are not written
or enforced. Review later changes with `ad-sdlc assets update --project-dir . --dry-run`.
See [asset upgrades and customization](agent-assets.md).

Initialization creates the following structure:

```
my-first-project/
├── .claude/agents/          # All canonical agent prompts
├── .claude/commands/        # Four project commands
├── .ad-sdlc/
│   ├── asset-lock.json      # Asset versions and exact-byte ownership
│   ├── config/              # Configuration
│   ├── templates/           # Document templates
│   └── scratchpad/          # Agent state
└── docs/                    # Generated documents
```

---

## Step 4: Run the Pipeline

Set the API key (or run inside a Claude Code session) and start the run with
the same requirements:

```bash
export ANTHROPIC_API_KEY="your-api-key"
ad-sdlc run "Implement a REST API endpoint for user registration with email and password"
```

The CLI prints the session ID when it starts; keep it to resume an interrupted
run. The Greenfield pipeline runs 19 stages:

1. Initialize the project state and detect the mode (Greenfield, Enhancement, or Import)
2. Collect and clarify requirements
3. Generate documentation (PRD, SRS, SDP, SDS, DBS, TM, SVP, TD, UI Specs)
4. Create GitHub issues from design components
5. Implement the issues
6. Validate the implementation against the requirements and acceptance criteria
7. Open a pull request and review it (`review` stage), then index the documentation

**Where the run stops:** the supported result is a pull request with linked
requirements and verification evidence, ready for review. The `review` stage
can also merge the pull request: with the default approval mode `auto` the
merge is approved by policy, so pass `--approval-mode critical` (or `manual`)
to decide before the branch is pushed and the pull request is opened or
merged. Nothing is deployed. See the [capability matrix](architecture/capability-matrix.md).

To stop earlier, pass `--stop-after <stage>`, for example
`--stop-after sds_generation` for documents only.

---

## Step 5: Review Results

When the pipeline completes, review what was created:

```bash
# Pipeline status and the saved session
ad-sdlc status

# Generated documents, one directory per document type
ls docs/prd docs/srs docs/sdp docs/sds docs/tm docs/decisions docs/svp docs/ui

# GitHub issues and the pull request (if using gh)
gh issue list
gh pr list --state all
```

**Documents generated (up to 9 types):**

| Directory         | Documents                                                      |
| ----------------- | -------------------------------------------------------------- |
| `docs/prd/`       | Product Requirements Document (`PRD-<project-id>.md`)          |
| `docs/srs/`       | Software Requirements Specification (`SRS-<project-id>.md`)    |
| `docs/sdp/`       | Software Development Plan                                      |
| `docs/sds/`       | Software Design Specification and Database Specification (DBS) |
| `docs/tm/`        | Threat Model                                                   |
| `docs/decisions/` | Technology Decisions (`TD-<number>-<topic>.md`)                |
| `docs/svp/`       | Software Verification Plan                                     |
| `docs/ui/`        | UI Specifications (skipped for CLI, API, and library projects) |

The traceability record of the run (requirements, issues, acceptance criteria,
and evidence) is written under `.ad-sdlc/scratchpad/traceability/`.

---

## Using Claude Code Instead

`ad-sdlc init` installs four Claude Code project commands in
`.claude/commands/`. Inside the project, `claude` sessions can use them; each
runs the installed `ad-sdlc` executable, so the result is the same pipeline as
`ad-sdlc run`:

| Command                                      | Runs                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/run-greenfield <requirements> [options]`   | `ad-sdlc init . --quick` when needed, then `ad-sdlc run <requirements> --mode greenfield` |
| `/resume <session-id> [--project-dir <dir>]` | `ad-sdlc run <original requirements> --resume <session-id>`                               |
| `/status [options]`                          | `ad-sdlc status`                                                                          |
| `/audit-docs [options]`                      | `ad-sdlc audit-docs --project-dir .`                                                      |

They need the `ad-sdlc` command on `PATH` and the canonical agent prompts that
`init` installed (`ad-sdlc-orchestrator` among them). A plain prompt such as
`claude "Implement user registration"` does **not** start the pipeline: it is
an ordinary Claude Code session that may use the project's agent prompts, with
no stage graph, approval policy, verification records, or saved session.

---

## Local Mode (No GitHub Required)

Run the pipeline without GitHub integration using the `--local` flag:

```bash
ad-sdlc run "Your requirements" --local
```

In local mode, the pipeline skips GitHub repository setup, and the `review`
stage reviews and merges the work branch locally instead of opening a pull
request. Documents and code are generated locally.

You can also enable local mode via environment variable:

```bash
export AD_SDLC_LOCAL=1
ad-sdlc run "Your requirements"
```

For configuration customization, see the example files in [`examples/config/`](../examples/config/).

---

## What's Next?

Congratulations! You've completed your first AD-SDLC project. Here's what to explore next:

### Try More Complex Features

```bash
# Multi-component feature
ad-sdlc run "Implement a user dashboard with profile management and activity logs"

# Change an existing project with existing documents
ad-sdlc run "Add OAuth2 authentication with Google and GitHub providers" --mode enhancement
```

### Customize the Pipeline

- Modify agent prompts in `.claude/agents/`
- Adjust workflow settings in `.ad-sdlc/config/workflow.yaml`
- Create custom document templates in `.ad-sdlc/templates/`

### Learn More

- **[Capability Matrix](architecture/capability-matrix.md)** - What each mode delivers
- **[Use Cases](use-cases.md)** - Common scenarios and patterns
- **[Headless Execution](headless-execution.md)** - CI/CD and automation guide
- **[FAQ](faq.md)** - Frequently asked questions
- **[Configuration](reference/06_configuration.md)** - Advanced configuration
- **[System Architecture](system-architecture.md)** - How it all works

---

## Troubleshooting

### Existing agents.yaml Fails Validation for Missing id or name

Older initialized projects may report missing `agents.<key>.id` or
`agents.<key>.name` fields. Back up `.ad-sdlc/config/agents.yaml` first (for example,
copy it to `agents.yaml.bak`), then edit the original file manually. For each
affected agent, add only the missing `id` (its registry key) and/or `name` (a
readable, nonempty label).

Before:

```yaml
version: 1.0.0
agents:
  collector:
    description: Collects our team's requirements
    model: opus # Keep this customization
    definition: .claude/agents/our-collector.md
    x-team: platform
```

After:

```yaml
version: 1.0.0
agents:
  collector:
    id: collector
    name: Collector Agent
    description: Collects our team's requirements
    model: opus # Keep this customization
    definition: .claude/agents/our-collector.md
    x-team: platform
```

Keep existing IDs, names, descriptions, models, definition paths, custom agents,
extension fields, and comments unchanged. Repeat for other agents with missing
fields, then run from the project directory:

```bash
ad-sdlc validate --format json
```

Initialization rejects targets that already contain `.ad-sdlc`; do not delete that
directory or regenerate configuration to repair missing fields.
`--skip-validation` skips prerequisite checks only. Newly generated configuration
is always validated before scaffold directories or files are created.

### Pipeline Stuck?

```bash
# Check current status
ad-sdlc status

# View logs
cat .ad-sdlc/logs/pipeline.log
```

### Agent Error?

```bash
# View agent-specific logs
cat .ad-sdlc/logs/agent-logs/collector.log
```

### Need to Restart?

```bash
# List saved runs and their session IDs
ad-sdlc status --project-dir .

# Resume a saved run from its last completed stage
ad-sdlc run "Your original requirements" --resume <session-id> --project-dir .

# Or start over with a fresh run (omit --resume)
ad-sdlc run "Your requirements" --project-dir .
```

See [FAQ](faq.md) for more troubleshooting tips.

---

## Quick Reference

### Essential Commands

| Command                                      | Description                        |
| -------------------------------------------- | ---------------------------------- |
| `ad-sdlc init`                               | Initialize new project             |
| `ad-sdlc run "<requirements>"`               | Run the pipeline                   |
| `ad-sdlc run "<requirements>" --dry-run`     | Preview the pipeline offline       |
| `ad-sdlc status`                             | Check pipeline status and sessions |
| `ad-sdlc validate`                           | Validate configuration             |
| `ad-sdlc run "<requirements>" --resume <id>` | Resume a saved run                 |

### Pipeline Stages (Greenfield -- 19 stages)

| Stage             | Agent                | What it Does                                      |
| ----------------- | -------------------- | ------------------------------------------------- |
| Initialization    | Project Initializer  | Sets up project structure                         |
| Mode Detection    | Mode Detector        | Detects Greenfield/Enhancement/Import             |
| Collection        | Collector            | Gathers requirements from text, files, URLs       |
| PRD Generation    | PRD Writer           | Generates Product Requirements Document           |
| SRS Generation    | SRS Writer           | Generates Software Requirements Specification     |
| SDP Generation    | SDP Writer           | Generates Software Development Plan               |
| SDS Generation    | SDS Writer           | Generates Software Design Specification + DBS     |
| Parallel Analysis | TM/TD/UI Writers     | Threat Model, Tech Decisions, UI Specs (parallel) |
| Issue Generation  | Issue Generator      | Creates GitHub Issues from SDS components         |
| SVP Generation    | SVP Writer           | Creates Software Verification Plan                |
| Implementation    | Controller + Workers | Distributes and implements work                   |
| Validation        | Validation Agent     | Validates implementation against requirements     |
| Review            | PR Reviewer          | Opens and reviews the pull request                |
| Doc Indexing      | Doc Index Generator  | Creates searchable documentation index            |

---

_Part of [AD-SDLC Documentation](../README.md)_
