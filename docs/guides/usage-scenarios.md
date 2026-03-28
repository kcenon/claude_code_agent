# Usage Scenarios Guide

> **Version**: 1.0.0
> **Audience**: All Users
> **Last Updated**: 2026-03-28

This guide walks through eight common deployment patterns for AD-SDLC. Each scenario covers prerequisites, setup commands, and what to expect. Use the Quick Reference table or decision flowchart to find the scenario that fits your situation.

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Choosing Your Scenario](#choosing-your-scenario)
3. [Scenario A: New Project (Greenfield)](#scenario-a-new-project-greenfield)
4. [Scenario B: New Project — Local Mode](#scenario-b-new-project--local-mode)
5. [Scenario C: Enhance Existing Project](#scenario-c-enhance-existing-project)
6. [Scenario D: Import from Issues](#scenario-d-import-from-issues)
7. [Scenario E: Docker Single Instance (Tier A)](#scenario-e-docker-single-instance-tier-a)
8. [Scenario F: Docker Parallel Instances (Tier B)](#scenario-f-docker-parallel-instances-tier-b)
9. [Scenario G: CI/CD Headless Automation](#scenario-g-cicd-headless-automation)
10. [Scenario H: Inside Claude Code Session](#scenario-h-inside-claude-code-session)
11. [Approval Modes Reference](#approval-modes-reference)
12. [Troubleshooting](#troubleshooting)

---

## Quick Reference

| Scenario                     | Mode               | GitHub Required | Docker       | Best For                                          |
| ---------------------------- | ------------------ | --------------- | ------------ | ------------------------------------------------- |
| A: New Project (Greenfield)  | `greenfield`       | Yes             | No           | Starting fresh with full GitHub integration       |
| B: New Project — Local Mode  | `greenfield`       | No              | No           | Offline or restricted environments                |
| C: Enhance Existing Project  | `enhancement`      | Yes             | No           | Adding features to existing codebases             |
| D: Import from Issues        | `import`           | Optional        | No           | Working from pre-created GitHub Issues            |
| E: Docker Single Instance    | `greenfield` / any | Yes             | Yes (Tier A) | Isolated, reproducible single-agent runs          |
| F: Docker Parallel Instances | `greenfield` / any | Yes             | Yes (Tier B) | Concurrent agents editing separate worktrees      |
| G: CI/CD Headless            | any                | Yes             | Optional     | Automated pipelines without human approval gates  |
| H: Inside Claude Code        | any                | Optional        | No           | Running AD-SDLC from within a Claude Code session |

---

## Choosing Your Scenario

```
Starting point: What do you need?
├── New project from scratch
│   ├── GitHub integration available → Scenario A
│   └── No GitHub / offline          → Scenario B
├── Add features to an existing codebase → Scenario C
├── Work from existing GitHub Issues      → Scenario D
├── Need reproducible, isolated containers
│   ├── Single agent / one worktree      → Scenario E
│   └── Multiple agents / parallel edits → Scenario F
├── Automate in CI/CD without prompts     → Scenario G
└── Running inside an active Claude Code session → Scenario H
```

---

## Scenario A: New Project (Greenfield)

Use this when starting a brand-new project and you want the full pipeline: requirement collection, document generation, GitHub issue creation, implementation, and PR review.

### Prerequisites

- `ANTHROPIC_API_KEY` set in the environment
- `GITHUB_TOKEN` or an active `gh auth login` session
- Node.js 18+, Git 2.30+, GitHub CLI 2.0+

### Setup

```bash
# Install AD-SDLC
npm install -g ad-sdlc

# Initialize a new project
ad-sdlc init my-project
cd my-project

# Run the full greenfield pipeline
ad-sdlc run "Implement user authentication with JWT and refresh tokens" \
  --mode greenfield
```

### What Happens

The 13-stage Greenfield pipeline runs in order:

| Stage                | Agent                             | Output                |
| -------------------- | --------------------------------- | --------------------- |
| 1. Mode detection    | Mode Detector                     | Pipeline selection    |
| 2. Repo setup        | Repo Detector / GitHub Repo Setup | GitHub repository     |
| 3. Requirements      | Collector                         | `collected_info.yaml` |
| 4. PRD               | PRD Writer                        | `docs/PRD-*.md`       |
| 5. SRS               | SRS Writer                        | `docs/SRS-*.md`       |
| 6. SDS               | SDS Writer                        | `docs/SDS-*.md`       |
| 7. Issues            | Issue Generator                   | GitHub Issues         |
| 8. Planning          | Controller                        | Work distribution     |
| 9-12. Implementation | Worker (up to 5 parallel)         | Source code + tests   |
| 13. Review           | PR Reviewer                       | Pull Requests         |

### Expected Output

- Generated documents: `docs/PRD-001.md`, `docs/SRS-001.md`, `docs/SDS-001.md`
- GitHub Issues linked to SDS components
- Source code in `src/` with accompanying tests
- Open Pull Request(s) ready for review

### Tips

1. Provide concise but specific requirements — the Collector agent will ask clarifying questions if needed.
2. Use `--stop-after <stage>` to pause the pipeline at a specific stage for manual review.

---

## Scenario B: New Project — Local Mode

Use this when you cannot or do not want to use GitHub. The pipeline generates all documents and code locally, skipping issue creation and PR operations.

### Prerequisites

- `ANTHROPIC_API_KEY` only — no GitHub token needed
- Node.js 18+, Git

### Setup

```bash
# Install and initialize
npm install -g ad-sdlc
ad-sdlc init my-project
cd my-project

# Run without GitHub
ad-sdlc run "Build a REST API for inventory management" \
  --mode greenfield \
  --local
```

You can also set the environment variable instead of the flag:

```bash
export AD_SDLC_LOCAL=1
ad-sdlc run "Build a REST API for inventory management" --mode greenfield
```

### Differences from Scenario A

| Step           | Scenario A (GitHub)   | Scenario B (Local) |
| -------------- | --------------------- | ------------------ |
| Repo creation  | Creates GitHub repo   | Skipped            |
| Issue creation | Creates GitHub Issues | Skipped            |
| PR creation    | Opens Pull Request    | Skipped            |
| Documents      | `docs/` in repo       | `docs/` locally    |
| Code           | Committed to branch   | Written to `src/`  |

---

## Scenario C: Enhance Existing Project

Use this when your project already has documents (`docs/prd/`, `docs/srs/`, `docs/sds/`) and source code. The Enhancement pipeline analyzes existing state before making targeted updates.

### Prerequisites

- Existing project with `docs/` (PRD/SRS/SDS) and `src/` directories
- `ANTHROPIC_API_KEY` and GitHub access (or `--local` for offline use)

### Setup

```bash
cd your-existing-project

# Initialize AD-SDLC if not already done
ad-sdlc init

# Run the enhancement pipeline
ad-sdlc run "Add OAuth2 social login with Google and GitHub providers" \
  --mode enhancement
```

If the system detects existing docs and code, it will auto-select Enhancement mode. Override explicitly with `--mode enhancement` to be certain.

### The 14-Stage Enhancement Pipeline

| Stage                     | Agent                                 | Notes                             |
| ------------------------- | ------------------------------------- | --------------------------------- |
| 1-2. Analysis (parallel)  | Document Reader, Codebase Analyzer    | Parallel read of existing state   |
| 3. Impact analysis        | Impact Analyzer                       | Risk report — approval gate       |
| 4-6. Document updates     | PRD Updater, SRS Updater, SDS Updater | Sequential, approval gate per doc |
| 7. Issue generation       | Issue Generator                       | Based on changed components       |
| 8-9. Execution (parallel) | Worker, Regression Tester             | Code + regression checks          |
| 10. Review                | PR Reviewer                           | PR with regression report         |

### Example: Adding Authentication

```bash
# Step 1: Run enhancement pipeline
ad-sdlc run "Add JWT authentication middleware to all protected routes" \
  --mode enhancement

# Step 2: Review the impact report before approving
cat .ad-sdlc/scratchpad/impact_report.yaml

# Step 3: Approve or reject at each approval gate as prompted
```

The Impact Analyzer identifies which components and tests are affected before any code changes are made, allowing you to assess risk early.

---

## Scenario D: Import from Issues

Use this when GitHub Issues already exist and you want to skip document generation entirely. The pipeline reads existing issues and proceeds directly to implementation.

### Prerequisites

- GitHub repository with open issues (for GitHub mode), or
- A local `issue_list.json` file (for local mode)

### Using GitHub Issues

```bash
# Import and implement from GitHub Issues
ad-sdlc run "" --mode import
```

The Issue Reader agent fetches open issues from the configured repository and hands them to the Controller for work distribution.

### Using Local Issue Files

Create an `issue_list.json` file:

```json
[
  {
    "id": 1,
    "title": "Add user registration endpoint",
    "body": "POST /auth/register — accept email, password, name",
    "labels": ["type/feature", "priority/high"]
  },
  {
    "id": 2,
    "title": "Add input validation for registration",
    "body": "Validate email format and password strength",
    "labels": ["type/feature"]
  }
]
```

Then run:

```bash
ad-sdlc run "" --mode import --local
```

The pipeline reads from `issue_list.json` when `--local` is active and skips GitHub calls entirely.

---

## Scenario E: Docker Single Instance (Tier A)

Use this when you need a reproducible, containerized environment for a single Claude Code agent. All containers share the same workspace directory.

### Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- The `docker/` directory from this repository

### Setup

```bash
cd docker/

# Run the interactive installer
./install.sh
```

The installer prompts for:

1. Number of containers (1–10)
2. Project directory path (mounted as `/workspace`)
3. Authentication method: OAuth (browser login) or API key
4. Tier selection: **A** (shared source)
5. Optional host sources directory

After installation, files generated: `.env`, `docker-compose.yml`, `docker-compose.linux.yml`.

On Linux/WSL, start containers with UID/GID mapping:

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.linux.yml up -d
```

On macOS:

```bash
docker compose up -d
```

### Running Commands

```bash
# Open Claude Code in container A
docker compose exec claude-a claude

# Open a shell
docker compose exec claude-a bash

# View logs
docker compose logs -f claude-a

# Stop all containers
docker compose down
```

### Git Safety

Tier A containers share a single working tree. To prevent concurrent `git` operations from corrupting the index, all git calls inside containers are serialized through a `flock`-based wrapper:

```bash
# Inside the container, git-safe wraps git with a filesystem lock
/usr/local/bin/git-safe commit -m "Add feature"
```

This ensures that even if two containers attempt a commit simultaneously, only one proceeds at a time.

---

## Scenario F: Docker Parallel Instances (Tier B)

Use this when multiple agents need to edit code concurrently without interfering with each other. Each container receives its own git worktree on a separate branch.

### Prerequisites

- Same as Scenario E, plus sufficient disk space for N worktree copies
- The project must be a git repository

### Worktree Setup

```bash
cd docker/

# Create worktrees for 2 containers
./scripts/setup-worktrees.sh /path/to/your/project 2

# Output:
# Created worktree: /path/to/your/project-a (branch: worktree-a)
# Created worktree: /path/to/your/project-b (branch: worktree-b)
#
# Add to .env:
#   PROJECT_DIR_A=/path/to/your/project-a
#   PROJECT_DIR_B=/path/to/your/project-b
```

Add the printed `PROJECT_DIR_*` entries to `docker/.env`, then run the installer:

```bash
./install.sh
# Choose Tier B when prompted
```

### Parallel Execution

Start both containers and run independent tasks simultaneously:

```bash
# Start all containers
docker compose -f docker-compose.yml -f docker-compose.worktree.yml up -d

# Container A works on feature branch A
docker compose exec claude-a claude

# Container B works on feature branch B (separate worktree, no conflicts)
docker compose exec claude-b claude
```

Each container has a full, independent copy of the working tree. Changes in `project-a` do not affect `project-b`.

### Tier A vs Tier B Comparison

| Feature          | Tier A (Shared Source) | Tier B (Git Worktrees)  |
| ---------------- | ---------------------- | ----------------------- |
| Disk usage       | Low (1x source)        | Higher (Nx source)      |
| Concurrent edits | Serialized via flock   | Fully parallel          |
| Branch isolation | Shared branch          | Per-container branch    |
| Setup complexity | Simple                 | Requires worktree init  |
| Best for         | Read-heavy, one writer | Multiple active writers |

---

## Scenario G: CI/CD Headless Automation

Use this to run AD-SDLC pipelines in CI/CD without interactive approval gates. Set approval mode to `auto` so the pipeline proceeds without waiting for human input.

### Prerequisites

- CI environment (GitHub Actions, GitLab CI, Jenkins, etc.)
- `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` stored as repository secrets

### GitHub Actions Example

```yaml
name: AD-SDLC Automated Pipeline

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      requirements:
        description: 'Feature requirements text'
        required: true

jobs:
  ad-sdlc:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install AD-SDLC
        run: npm install -g ad-sdlc

      - name: Initialize project
        run: ad-sdlc init --quick

      - name: Run pipeline
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          ad-sdlc run "${{ github.event.inputs.requirements || 'Analyze and improve code quality' }}" \
            --mode greenfield \
            --yes
```

### Key Flags for CI

| Flag                    | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `--yes`                 | Auto-accept privacy policy prompt on first run                              |
| `--local`               | Skip all GitHub calls (useful for build-only pipelines)                     |
| `--dry-run`             | Validate configuration without running agents                               |
| `--stop-after <stage>`  | Halt after a specific stage (e.g., `sds` to stop after document generation) |
| `--resume <session-id>` | Resume a previously interrupted pipeline                                    |
| `--mode <mode>`         | Explicitly set `greenfield`, `enhancement`, or `import`                     |

### Approval Mode for CI

When running in CI, the pipeline must not block waiting for human input. Configure the approval mode in `.ad-sdlc/config/workflow.yaml`:

```yaml
execution:
  approval_mode: auto # Never prompt for human approval
  max_parallel_workers: 3
```

Available values:

| Mode       | Behavior                                    |
| ---------- | ------------------------------------------- |
| `auto`     | All approval gates pass automatically       |
| `manual`   | Every gate requires explicit human approval |
| `critical` | Only high-risk gates require approval       |
| `custom`   | Per-stage configuration in `workflow.yaml`  |

Use `auto` in CI and `manual` or `critical` during local development when you want to review impact reports before proceeding.

---

## Scenario H: Inside Claude Code Session

Use this when AD-SDLC is running as a sub-agent within an active Claude Code session rather than as a standalone process. The `ClaudeCodeBridge` handles all agent communication through the scratchpad file system.

### How It Works

Inside a Claude Code session, AD-SDLC agents communicate through a scratchpad directory rather than direct process calls:

1. The orchestrator writes an agent request to `.ad-sdlc/scratchpad/input/<agent-type>.json`
2. Claude Code's Task tool reads the input file and spawns the sub-agent
3. The sub-agent writes its result to `.ad-sdlc/scratchpad/output/<agent-type>.json`
4. The `ClaudeCodeBridge` polls for the output file and returns the response

### Example

Within a Claude Code conversation:

```bash
# Initialize the project (run once)
ad-sdlc init my-project
cd my-project

# Run the pipeline — Claude Code sub-agents handle each stage
ad-sdlc run "Add search functionality to the product catalog" \
  --mode enhancement
```

Claude Code automatically routes each agent invocation through the scratchpad bridge. No additional configuration is needed.

### Scratchpad I/O

The scratchpad directory layout:

```
.ad-sdlc/
└── scratchpad/
    ├── input/
    │   ├── collector.json        # Orchestrator writes here
    │   └── prd-writer.json
    └── output/
        ├── collector.json        # Sub-agent writes result here
        └── prd-writer.json
```

The `ClaudeCodeBridge` polls for output files every 1 second, with a default timeout of 5 minutes per agent. Both values can be overridden in the bridge configuration if an agent is expected to run longer.

---

## Approval Modes Reference

| Mode       | Behavior                                     | Use Case                                      |
| ---------- | -------------------------------------------- | --------------------------------------------- |
| `auto`     | All gates pass without prompting             | CI/CD, fully automated runs                   |
| `manual`   | Every gate requires explicit `y` input       | Local development, first-time runs            |
| `critical` | Only gates marked `risk: high` require input | Balanced for production-adjacent workflows    |
| `custom`   | Per-stage overrides in `workflow.yaml`       | Mixed environments with specific requirements |

Configure in `.ad-sdlc/config/workflow.yaml`:

```yaml
execution:
  approval_mode: manual # or: auto, critical, custom
```

---

## Troubleshooting

### Common Issues by Scenario

| Problem                             | Scenario   | Solution                                                  |
| ----------------------------------- | ---------- | --------------------------------------------------------- |
| `❌ No AD-SDLC configuration found` | A, B, C, D | Run `ad-sdlc init` first                                  |
| GitHub rate limit exceeded          | A, C, D    | Wait for reset or reduce `max_parallel_workers`           |
| Pipeline stuck at approval gate     | A, C, G    | Use `approval_mode: auto` in CI, or type `y` to proceed   |
| Worktree already exists             | F          | Remove with `git worktree remove <path>` and re-run setup |
| Container exits immediately         | E, F       | Check `docker compose logs claude-a` for errors           |
| Agent timeout (5 min exceeded)      | H          | Increase `timeoutMs` in the bridge configuration          |
| `AD_SDLC_LOCAL` ignored             | B, D       | Verify the variable is exported: `export AD_SDLC_LOCAL=1` |
| Wrong mode auto-detected            | C          | Pass `--mode enhancement` explicitly                      |

For detailed error codes and recovery procedures, see the [Troubleshooting Guide](troubleshooting.md).

---

_Part of [Claude Code Agent Documentation](../README.md)_
