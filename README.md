# AD-SDLC: Agent-Driven Software Development Lifecycle

Status: experimental · Version: [0.1.0](package.json) (unreleased; no tagged release yet)

[![CI](https://github.com/kcenon/claude_code_agent/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/kcenon/claude_code_agent/actions/workflows/ci.yml?query=branch%3Adevelop)
[![Security Scan](https://github.com/kcenon/claude_code_agent/actions/workflows/security.yml/badge.svg?branch=develop)](https://github.com/kcenon/claude_code_agent/actions/workflows/security.yml?query=branch%3Adevelop)
[![Document Checks](https://github.com/kcenon/claude_code_agent/actions/workflows/docs-check.yml/badge.svg?branch=develop)](https://github.com/kcenon/claude_code_agent/actions/workflows/docs-check.yml?query=branch%3Adevelop)

AD-SDLC is a TypeScript command-line tool (`ad-sdlc`) that turns a requirements description into project documents, GitHub issues, code, and pull requests. It runs a pipeline of specialized agents built on the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk); every AI-backed stage goes through one SDK entry point (`ExecutionAdapter`).

The project is experimental: version 0.1.0 is not tagged as a release and not published to the npm registry, so it is installed from source. The badges show the latest workflow runs on `develop`, the default branch.

<!-- Counts below come from the generated table in docs/architecture/runtime-inventory.md, which npm run docs:check-inventory checks against the source. Update both together. -->

The three pipeline modes contain 39 stage slots that reuse 29 unique pipeline agent types; with 7 support/delegated definitions, 36 agent prompt files ship with every scaffold. The [runtime inventory](docs/architecture/runtime-inventory.md) derives each count from the source and lists every agent definition.

## Contents

- [Quick Start](#quick-start)
- [Pipeline Modes](#pipeline-modes)
- [How It Works](#how-it-works)
- [Features](#features)
- [CLI Overview](#cli-overview)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

Prerequisites: Node.js 22.22.1 or later, Git 2.30 or later, and an `ANTHROPIC_API_KEY` or a Claude Code login. Stages that talk to GitHub (`pr-reviewer`, `issue-generator`, `ci-fixer`) also need GitHub CLI 2.0 or later and a `GITHUB_TOKEN`; `--local` runs without GitHub. The [Installation Guide](docs/installation.md) covers each step.

```bash
# 1. Install AD-SDLC from source (it is not published to the npm registry yet)
git clone https://github.com/kcenon/claude_code_agent.git
cd claude_code_agent
npm ci
npm run build
npm install -g .   # links the ad-sdlc command to this clone, so keep the clone in place
cd ..

# 2. Initialize your project
ad-sdlc init my-project
cd my-project

# 3. Run the pipeline with your requirements
export ANTHROPIC_API_KEY="your-api-key"
ad-sdlc run "Implement user authentication with OAuth2" --project-dir .
```

Run the pipeline with `ad-sdlc run "<requirements>"`; the agents then generate documents, create issues, implement code, and open pull requests. Add `--dry-run` to validate the configuration and print the stage graph without calling the SDK, or `--local` to run without GitHub. Inside the project you can also hand the same request to Claude Code: `claude "Implement user authentication with OAuth2"`.

The [Quickstart Guide](docs/quickstart.md) walks through a first run, and the [CLI reference](docs/cli.md) lists every command and option.

## Pipeline Modes

`ad-sdlc run` takes the mode from `--mode`, the `AD_SDLC_MODE` environment variable, or `pipeline.default_mode` in `.ad-sdlc/config/workflow.yaml` (`greenfield` in a freshly initialized project).

### Greenfield Pipeline (New Projects)

```
User Input → Mode Detection → Collector → PRD Writer → SRS Writer → SDP Writer
         → Repo Detection → GitHub Repo Setup → SDS Writer
         ─┬─▶ Threat Model Writer ─┐
          ├─▶ Tech Decision Writer ─┤
          └─▶ UI Spec Writer ──────┤
                                    ↓
   Doc Indexing ← PR Reviewer ← Validation ← Worker ← Controller ← SVP Writer ← Issue Generator
```

### Enhancement Pipeline (Existing Projects)

```
Existing Docs + Code → Document Reader → Codebase Analyzer → Code Reader
                                                                  ↓
                                                      Doc-Code Comparator
                                                                  ↓
                                                        Impact Analyzer
                                                                  ↓
                                      PRD Updater → SRS Updater → SDS Updater
                                                                  ↓
                                         Issue Generator + Regression Tester
                                                                  ↓
                            Controller → Worker → Validation → PR Reviewer
                                                                      ↓
                                                    Doc Indexing + CI Fix (on failure)
```

### Import Pipeline (Existing GitHub Issues)

```
GitHub Issues → Issue Reader → Controller → Worker → Validation → PR Reviewer
                                                                       ↓
                                                        CI Fixer (delegated on failure)
```

## How It Works

AD-SDLC is structured as three cooperating tiers. The orchestrator owns the pipeline DAG, approval flow, and active validation stage; the execution layer is a single Claude Agent SDK entry point; and the knowledge layer is consumed by the SDK rather than wired through custom bridges.

| Tier                          | Responsibility                                    | Implementation                                   |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| **T1 Pipeline Control Plane** | Stage DAG, checkpoints, V&V gates, domain writers | `src/ad-sdlc-orchestrator/`, `*-writer/`, `vnv/` |
| **T2 Agent Execution Layer**  | Single SDK entry point, hooks, telemetry bridge   | `src/execution/`                                 |
| **T3 Knowledge Layer**        | Agent definitions, skills, commands, MCP servers  | `.claude/`, `.mcp.json`, claude-config plugin    |

- **Shared state**: each agent reads and writes a shared scratchpad under `.ad-sdlc/scratchpad/`, which is how the agents communicate.
- **Concurrency**: configured stage concurrency limits independent runnable stages; it does not enforce a worker pool inside SDK agents.
- **Verification**: the Validation Agent is an active stage in all three modes and checks the implementation against acceptance criteria. The scheduler runs the stage verifier on every completed stage and records each stage's verification state in the run result. Every stage slot has a named check set or a documented not-applicable reason ([coverage](docs/architecture/verification-coverage.md)). Under the default `advisory` profile failed checks are kept as findings; under the `delivery` profile (`--vnv-profile delivery`, or the legacy strict rigor with `haltOnVerificationFailure`) the first failed required check stops the run and the CLI exits with status 1. See the [verification policy guide](docs/guides/verification-policy.md). The RTM builder and the cross-document consistency check exist as modules but are not called by the orchestrator yet; wiring them in is tracked in [#952](https://github.com/kcenon/claude_code_agent/issues/952). Workflow coverage and complexity thresholds are not enforced and are rejected when configured.
- **Resume**: `ad-sdlc run "<requirements>" --resume <session-id>` reuses the saved stage graph and runtime policy and skips the stages that session already completed. The CLI has no option to start from a later stage; `--stop-after <stage>` only ends a run early.

See the [v0.1 Hybrid Pipeline RFC](docs/architecture/v0.1-hybrid-pipeline-rfc.md) for the architecture and the [v0.1 Migration Guide](docs/architecture/v0.1-migration-guide.md) for the v0.0.1 → v0.1.0 migration steps.

## Features

- **Document generation**: PRD, SRS, SDP, SDS, DBS, TM, SVP, TD, and UI specification documents from natural-language requirements; the SDS Writer emits the database schema as a separate DBS document, and UI specifications are skipped for CLI, API, and library projects
- **Document frontmatter**: YAML frontmatter with `doc_id`, version, status, and change history on every generated document; see the [frontmatter reference](docs/reference/document-frontmatter.md)
- **Enhancement and Import pipelines**: incremental updates to existing projects without full rewrites, or processing of existing GitHub Issues without document generation
- **Local mode**: run the pipeline without GitHub using `--local` (or `AD_SDLC_LOCAL=1`)
- **Resume**: saved run state per session, resumed with `--resume <session-id>`; `ad-sdlc status` lists the sessions
- **GitHub integration**: issue creation with dependencies and labels, pull request creation, and SDK reviewer execution with the existing verification policy
- **Regression testing and gap analysis**: identifies affected tests when modifying existing code and detects discrepancies between documentation and implementation
- **Document audit**: `ad-sdlc audit-docs --project-dir .` validates generated documents for frontmatter, required sections, cross-references, and PRD→SRS→SDS traceability; see the [Document Audit CLI](docs/doc-audit.md)
- **Resolved workflow policy**: canonical presets with validated stage concurrency, retry, timeout, approval, and verification settings; see the [runtime configuration contract](docs/configuration/RUNTIME_WORKFLOW.md)

## CLI Overview

| Command                                     | Purpose                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `ad-sdlc init [project-name]`               | Scaffold the canonical agents, commands, and `.ad-sdlc/` configuration |
| `ad-sdlc run "<requirements>"`              | Run the pipeline; `--resume <session-id>` continues a saved run        |
| `ad-sdlc status`                            | Show pipeline status and list saved sessions                           |
| `ad-sdlc validate`                          | Validate configuration files                                           |
| `ad-sdlc doctor`                            | Check environment prerequisites                                        |
| `ad-sdlc audit-docs --project-dir <dir>`    | Audit generated documents                                              |
| `ad-sdlc assets update --project-dir <dir>` | Plan or apply updates of the installed canonical agents and commands   |
| `ad-sdlc analyze`                           | Analyze a project for documentation-code gaps                          |
| `ad-sdlc telemetry <subcommand>`            | Manage opt-in telemetry (`status`, `enable`, `disable`, `policy`)      |
| `ad-sdlc completion --shell <shell>`        | Generate a shell completion script (`bash`, `zsh`, `fish`)             |

The [CLI reference](docs/cli.md) documents every option, the template choices, the generated project layout, the project slash commands, and shell completion setup.

## Documentation

| Topic           | Documents                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting started | [Installation Guide](docs/installation.md), [Quickstart Guide](docs/quickstart.md), [CLI Reference](docs/cli.md), [Use Cases](docs/use-cases.md), [FAQ](docs/faq.md)                                                                                           |
| Architecture    | [System Architecture](docs/system-architecture.md), [Runtime Inventory](docs/architecture/runtime-inventory.md), [v0.1 Hybrid Pipeline RFC](docs/architecture/v0.1-hybrid-pipeline-rfc.md), [v0.1 Migration Guide](docs/architecture/v0.1-migration-guide.md)  |
| Configuration   | [Runtime Configuration Contract](docs/configuration/RUNTIME_WORKFLOW.md), [MCP Configuration](docs/configuration/mcp.md), [Canonical Assets and Upgrades](docs/agent-assets.md)                                                                                |
| Documents       | [Document Frontmatter](docs/reference/document-frontmatter.md), [Document Status Definitions](docs/DOCUMENT_STATUS_DEFINITIONS.md), [Document Audit CLI](docs/doc-audit.md)                                                                                    |
| Specifications  | [PRD-001](docs/PRD-001-agent-driven-sdlc.md), [SRS-001](docs/SRS-001-agent-driven-sdlc.md), [SDS-001](docs/SDS-001-agent-driven-sdlc.md)                                                                                                                       |
| Guides          | [Agent Deployment](docs/guides/deployment.md), [Usage Scenarios](docs/guides/usage-scenarios.md) (all execution environments and pipeline modes), [Claude Code Reference](docs/reference/README.md)                                                            |
| Korean          | [PRD-001](docs/PRD-001-agent-driven-sdlc.kr.md), [SRS-001](docs/SRS-001-agent-driven-sdlc.kr.md), [SDS-001](docs/SDS-001-agent-driven-sdlc.kr.md), [System Architecture](docs/system-architecture.kr.md), [Usage Scenarios](docs/guides/usage-scenarios.kr.md) |

## Contributing

See the [Contributing Guide](CONTRIBUTING.md) for development setup, branch naming, commit messages, and the pull request process. Pull requests target `develop`. If you change this README, run `python3 scripts/readme_lint.py README.md`; the Documentation Audit workflow runs the same check.

## Related Projects

[kcenon/claude-config](https://github.com/kcenon/claude-config) is a Claude Code configuration management and development guidelines system. Agents in this project can reference its guidelines during code generation and review; see the [claude-config reference](docs/claude-config-reference.md).

## License

BSD 3-Clause License; see [LICENSE](LICENSE).

**Need help?** Check the [FAQ](docs/faq.md) or [open an issue](https://github.com/kcenon/claude_code_agent/issues).
