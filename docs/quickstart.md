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

- ✅ AD-SDLC CLI installed (`npm install -g ad-sdlc`)
- ✅ API key configured (`export ANTHROPIC_API_KEY="..."`)
- ✅ GitHub CLI authenticated (`gh auth login`) - *optional but recommended*

Need to install? See the [Installation Guide](installation.md).

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
1. Collect and clarify requirements
2. Generate documentation (PRD, SRS, SDS)
3. Create GitHub issues
4. Implement the code
5. Create and review PRs

---

## Step 4: Watch the Pipeline (2+ minutes)

The pipeline runs through these stages:

```
Stage                    Status
─────────────────────────────────
[1/7] Collecting         ✅ Complete
[2/7] Writing PRD        ✅ Complete
[3/7] Writing SRS        ✅ Complete
[4/7] Writing SDS        ✅ Complete
[5/7] Creating Issues    ✅ Complete
[6/7] Implementing       🔄 In Progress (3/5 issues)
[7/7] Reviewing PRs      ⏳ Pending
```

### What's Happening?

1. **Collector Agent** analyzes your requirements
2. **PRD Writer** creates a Product Requirements Document
3. **SRS Writer** creates a Software Requirements Specification
4. **SDS Writer** creates a Software Design Specification
5. **Issue Generator** breaks down work into GitHub issues
6. **Controller** assigns work to Worker agents
7. **Workers** implement code for each issue
8. **PR Reviewer** creates PRs and performs code review

---

## Step 5: Review Results (30 seconds)

When the pipeline completes, review what was created:

```bash
# View generated documents
ls docs/
# PRD-001.md  SRS-001.md  SDS-001.md

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

**Documents Generated:**
- `docs/PRD-001.md` - Product requirements
- `docs/SRS-001.md` - Functional requirements
- `docs/SDS-001.md` - Technical design

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

| Command | Description |
|---------|-------------|
| `ad-sdlc init` | Initialize new project |
| `ad-sdlc status` | Check pipeline status |
| `ad-sdlc validate` | Validate configuration |
| `ad-sdlc resume` | Resume from checkpoint |
| `ad-sdlc reset` | Reset pipeline state |

### Pipeline Stages

| Stage | Agent | Output |
|-------|-------|--------|
| Collection | Collector | Requirements data |
| PRD | PRD Writer | `docs/PRD-*.md` |
| SRS | SRS Writer | `docs/SRS-*.md` |
| SDS | SDS Writer | `docs/SDS-*.md` |
| Issues | Issue Generator | GitHub Issues |
| Implementation | Worker(s) | `src/*` |
| Review | PR Reviewer | Pull Requests |

---

*Part of [AD-SDLC Documentation](../README.md)*
