# 5-Minute Quickstart

> **Version**: 1.0.0
> **Time Required**: 5 minutes

This tutorial walks you through creating your first automated feature with AD-SDLC.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Setup (1 minute)](#step-1-setup-1-minute)
3. [Step 2: Initialize Project (1 minute)](#step-2-initialize-project-1-minute)
4. [Step 3: Describe Your Feature (30 seconds)](#step-3-describe-your-feature-30-seconds)
5. [Step 4: Watch the Pipeline (2+ minutes)](#step-4-watch-the-pipeline-2-minutes)
6. [Step 5: Review Results (30 seconds)](#step-5-review-results-30-seconds)
7. [What's Next](#whats-next)

---

## Prerequisites

Before starting, ensure you have:

- ✅ AD-SDLC CLI installed (see below)
- ✅ API key configured (`export ANTHROPIC_API_KEY="..."`)
- ✅ GitHub CLI authenticated (`gh auth login`) - _optional; not required for local mode_

### Install from Source

```bash
git clone https://github.com/kcenon/claude_code_agent.git
cd claude_code_agent
npm install
npm run build
npm link  # makes 'ad-sdlc' available globally
```

Need more options? See the [Installation Guide](installation.md).

---

## Step 1: Setup (1 minute)

Verify your environment is ready:

```bash
# Check AD-SDLC is installed
ad-sdlc --version

# Check API key is set
echo $ANTHROPIC_API_KEY | head -c 10
# Should show: sk-ant-api

# Check GitHub CLI (optional)
gh auth status
```

All checks passed? Let's continue!

---

## Step 2: Initialize Project (1 minute)

Create a new project with the quick setup:

```bash
# Create and initialize a new project
ad-sdlc init my-first-project --quick

# Navigate to the project
cd my-first-project
```

This creates the following structure:

```
my-first-project/
├── .claude/agents/          # Agent definitions
├── .ad-sdlc/
│   ├── config/              # Configuration
│   ├── templates/           # Document templates
│   └── scratchpad/          # Agent state
└── docs/                    # Generated documents
```

---

## Step 3: Describe Your Feature (30 seconds)

Tell Claude what you want to build:

```bash
claude "Implement a REST API endpoint for user registration with email and password"
```

This starts the automated pipeline. Claude will:

1. Detect project mode (Greenfield, Enhancement, or Import)
2. Collect and clarify requirements
3. Generate documentation (PRD, SRS, SDP, SDS, DBS, TM, SVP, TD, UI Specs)
4. Create GitHub issues from design components
5. Implement the code in parallel
6. Validate and review the results

---

## Step 4: Watch the Pipeline (2+ minutes)

The Greenfield pipeline runs through 19 stages, grouped into logical phases.
Here is a simplified view of the key phases:

```
Phase                         Status
──────────────────────────────────────────
[Setup]
  Initialization              Done
  Mode Detection              Done
[Requirements]
  Collection                  Done
  PRD Generation              Done
  SRS Generation              Done
[Design]
  SDP Generation              Done
  SDS + DBS Generation        Done
  Parallel Analysis (TM/TD/UI) Done
[Planning]
  Issue Generation            Done
  SVP Generation              Done
[Execution]
  Implementation              In Progress (3/5 issues)
  Validation                  Pending
  Review                      Pending
  Doc Indexing                Pending
```

### What's Happening?

The pipeline coordinates specialized agents across each phase:

**Setup** -- The **Project Initializer** creates the project structure, then the
**Mode Detector** identifies whether this is a Greenfield, Enhancement, or Import project.

**Requirements** -- The **Collector** gathers requirements from text, files, and URLs.
The **PRD Writer** produces a Product Requirements Document, and the **SRS Writer**
produces a Software Requirements Specification.

**Design** -- The **SDP Writer** generates a Software Development Plan. The **SDS Writer**
generates a Software Design Specification along with a Database Specification (DBS).
Then the **TM Writer**, **TD Writer**, and **UI Writer** run in parallel to produce a
Threat Model, Tech Decisions document, and UI Specs.

**Planning** -- The **Issue Generator** creates GitHub Issues from the SDS components.
The **SVP Writer** creates a Software Verification Plan.

**Execution** -- The **Controller** distributes work to **Worker** agents that implement
code in parallel. The **Validation Agent** checks the implementation against requirements.
The **PR Reviewer** performs automated code review. Finally, the **Doc Index Generator**
creates a searchable documentation index.

---

## Step 5: Review Results (30 seconds)

When the pipeline completes, review what was created:

```bash
# View generated documents
ls docs/
# PRD-001.md  SRS-001.md  SDP-001.md  SDS-001.md  DBS-001.md
# TM-001.md   SVP-001.md  TD-001.md   UI-001.md

# View the PRD
cat docs/PRD-001.md

# Check GitHub issues (if using gh)
gh issue list

# View merged PRs
gh pr list --state merged

# See what code was generated
ls src/
```

### Example Output

**Documents Generated (up to 9 types):**

- `docs/PRD-001.md` - Product Requirements Document
- `docs/SRS-001.md` - Software Requirements Specification
- `docs/SDP-001.md` - Software Development Plan
- `docs/SDS-001.md` - Software Design Specification
- `docs/DBS-001.md` - Database Specification
- `docs/TM-001.md` - Threat Model
- `docs/SVP-001.md` - Software Verification Plan
- `docs/TD-001.md` - Tech Decisions
- `docs/UI-001.md` - UI Specs

**Issues Created:**

- #1: Setup project structure
- #2: Implement user model
- #3: Create registration endpoint
- #4: Add input validation
- #5: Write unit tests

**Code Implemented:**

- `src/models/user.ts`
- `src/routes/auth.ts`
- `src/validators/user.ts`
- `tests/auth.test.ts`

---

## Local Mode (No GitHub Required)

Run the pipeline without GitHub integration using the `--local` flag:

```bash
ad-sdlc run "Your requirements" --local
```

In local mode, the pipeline skips GitHub issue creation and PR operations. Documents and code are generated locally.

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
claude "Implement a user dashboard with profile management and activity logs"

# Integration with external services
claude "Add OAuth2 authentication with Google and GitHub providers"
```

### Customize the Pipeline

- Modify agent prompts in `.claude/agents/`
- Adjust workflow settings in `.ad-sdlc/config/workflow.yaml`
- Create custom document templates in `.ad-sdlc/templates/`

### Learn More

- **[Use Cases](use-cases.md)** - Common scenarios and patterns
- **[Headless Execution](headless-execution.md)** - CI/CD and automation guide
- **[FAQ](faq.md)** - Frequently asked questions
- **[Configuration](reference/06_configuration.md)** - Advanced configuration
- **[System Architecture](system-architecture.md)** - How it all works

---

## Troubleshooting

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
# Resume from last checkpoint
ad-sdlc resume

# Or reset and start over
ad-sdlc reset
```

See [FAQ](faq.md) for more troubleshooting tips.

---

## Quick Reference

### Essential Commands

| Command            | Description            |
| ------------------ | ---------------------- |
| `ad-sdlc init`     | Initialize new project |
| `ad-sdlc status`   | Check pipeline status  |
| `ad-sdlc validate` | Validate configuration |
| `ad-sdlc resume`   | Resume from checkpoint |
| `ad-sdlc reset`    | Reset pipeline state   |

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
| Implementation    | Controller + Workers | Distributes and implements work in parallel       |
| Validation        | Validation Agent     | Validates implementation against requirements     |
| Review            | PR Reviewer          | Automated code review and quality gates           |
| Doc Indexing      | Doc Index Generator  | Creates searchable documentation index            |

---

_Part of [AD-SDLC Documentation](../README.md)_
