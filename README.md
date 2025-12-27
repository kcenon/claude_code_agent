# Claude Code Agent - AD-SDLC System

Agent-Driven Software Development Lifecycle (AD-SDLC) system built with Claude Agent SDK.

## Overview

This project implements an automated software development pipeline using 8 specialized Claude agents:

| Agent | Role |
|-------|------|
| **Collector** | Gathers requirements from text, files, and URLs |
| **PRD Writer** | Generates Product Requirements Document |
| **SRS Writer** | Generates Software Requirements Specification |
| **SDS Writer** | Generates Software Design Specification |
| **Issue Generator** | Creates GitHub Issues from SDS components |
| **Controller** | Orchestrates work distribution and monitors progress |
| **Worker** | Implements code based on assigned issues |
| **PR Reviewer** | Creates PRs and performs automated code review |

## Project Structure

```
claude_code_agent/
├── .claude/
│   └── agents/              # Agent definitions
│       ├── *.md             # English versions (used by Claude)
│       └── *.kr.md          # Korean versions (for reference)
├── .ad-sdlc/
│   ├── config/              # Configuration files
│   │   ├── agents.yaml      # Agent registry
│   │   └── workflow.yaml    # Pipeline configuration
│   ├── logs/                # Audit logs
│   │   └── agent-logs/      # Per-agent logs
│   ├── templates/           # Document templates
│   │   ├── prd-template.md
│   │   ├── srs-template.md
│   │   ├── sds-template.md
│   │   └── issue-template.md
│   └── scratchpad/          # Inter-agent state (Scratchpad pattern)
│       ├── info/            # Collected information
│       ├── documents/       # Generated documents (PRD, SRS, SDS)
│       ├── issues/          # Issue lists and dependency graphs
│       └── progress/        # Work orders and results
├── docs/
│   ├── prd/                 # Published PRD documents
│   ├── srs/                 # Published SRS documents
│   ├── sds/                 # Published SDS documents
│   ├── reference/           # Reference documentation
│   └── guides/              # User guides
├── scripts/
│   └── init-project.sh      # Project initialization script
├── src/                     # Generated source code
└── README.md
```

## Document Pipeline

```
User Input → Collector → PRD Writer → SRS Writer → SDS Writer
                                                       ↓
                           Worker ← Controller ← Issue Generator
                              ↓
                         PR Reviewer → Merge
```

## Getting Started

### Prerequisites

- Claude Code CLI (Claude Agent SDK)
- Git 2.30+
- GitHub CLI (`gh`) 2.0+
- Node.js 18+ (optional, for JS/TS projects)

### Usage

1. Start with requirements collection:
   ```
   claude "Collect requirements for [your project description]"
   ```

2. Generate documents:
   ```
   claude "Generate PRD from collected information"
   claude "Generate SRS from PRD"
   claude "Generate SDS from SRS"
   ```

3. Create GitHub Issues:
   ```
   claude "Generate GitHub issues from SDS"
   ```

4. Implement and review:
   ```
   claude "Start implementation with Controller"
   ```

## Security

The project includes a comprehensive security module with:

- **SecretManager** - Secure API key management with automatic masking
- **InputValidator** - Path traversal prevention, URL validation, input sanitization
- **AuditLogger** - Security audit logging with correlation tracking
- **SecureFileHandler** - Secure temporary file handling with auto-cleanup
- **RateLimiter** - API rate limiting to prevent abuse

See [Security Documentation](docs/security.md) for detailed usage.

## Documentation

- [Security Module](docs/security.md)
- [PRD-001: Agent-Driven SDLC](docs/PRD-001-agent-driven-sdlc.md)
- [SRS-001: Agent-Driven SDLC](docs/SRS-001-agent-driven-sdlc.md)
- [SDS-001: Agent-Driven SDLC](docs/SDS-001-agent-driven-sdlc.md)
- [System Architecture](docs/system-architecture.md)

### Korean Documentation

- [PRD-001 (한글)](docs/PRD-001-agent-driven-sdlc.kr.md)
- [SRS-001 (한글)](docs/SRS-001-agent-driven-sdlc.kr.md)
- [SDS-001 (한글)](docs/SDS-001-agent-driven-sdlc.kr.md)
- [System Architecture (한글)](docs/system-architecture.kr.md)

## Agent Definitions

Each agent is defined in `.claude/agents/` with:
- YAML frontmatter (name, description, tools, model)
- Markdown body with role, responsibilities, schemas, and workflows

English versions (`.md`) are used by Claude during execution.
Korean versions (`.kr.md`) are provided for developer reference.

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **CI** | Push/PR to main | Lint, test, build, and security scan |
| **Security** | Push/PR/Daily | Dependency audit, CodeQL, secret scanning |
| **Release** | Tag `v*` | Build, publish to NPM, create GitHub release |

### Status Badges

<!-- Add badges after repository setup -->
<!-- ![CI](https://github.com/kcenon/claude_code_agent/workflows/CI/badge.svg) -->
<!-- ![Release](https://github.com/kcenon/claude_code_agent/workflows/Release/badge.svg) -->

### Branch Protection

- `main` branch requires passing CI checks and code review before merge
- All PRs trigger lint, test, and security scans
- Integration tests run on main branch merges
- E2E tests run on release branches

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License
