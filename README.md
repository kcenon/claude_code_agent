# AD-SDLC: Agent-Driven Software Development Lifecycle

> **Automate your software development from requirements to deployment using Claude-powered agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## Quick Start

Get started in under 5 minutes:

```bash
# 1. Install AD-SDLC
npm install -g ad-sdlc

# 2. Initialize your project
ad-sdlc init my-project
cd my-project

# 3. Start with your requirements
claude "Implement user authentication with OAuth2"
```

That's it! The agents will generate documents, create issues, implement code, and open PRs.

## What is AD-SDLC?

AD-SDLC is an automated software development pipeline that uses **8 specialized Claude agents** to transform your requirements into production-ready code:

```
User Input → Collector → PRD Writer → SRS Writer → SDS Writer
                                                       ↓
                           Worker ← Controller ← Issue Generator
                              ↓
                         PR Reviewer → Merge
```

### Agent Pipeline

| Phase | Agent | Role |
|-------|-------|------|
| **Collection** | Collector | Gathers requirements from text, files, and URLs |
| **Documentation** | PRD Writer | Generates Product Requirements Document |
| | SRS Writer | Generates Software Requirements Specification |
| | SDS Writer | Generates Software Design Specification |
| **Planning** | Issue Generator | Creates GitHub Issues from SDS components |
| **Execution** | Controller | Orchestrates work distribution and monitors progress |
| | Worker | Implements code based on assigned issues |
| **Quality** | PR Reviewer | Creates PRs and performs automated code review |

## Features

- **Automatic Document Generation**: PRD, SRS, SDS documents from natural language requirements
- **GitHub Integration**: Automatic issue creation with dependencies and labels
- **Parallel Implementation**: Multiple workers implementing issues concurrently
- **Automated PR Review**: Code review and quality gate enforcement
- **Progress Tracking**: Real-time visibility into pipeline status
- **Customizable Workflows**: Configure agents, templates, and quality gates

## Installation

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Git 2.30+
- GitHub CLI 2.0+ (optional, for issue/PR management)
- Claude API Key

### Install

```bash
# Global installation (recommended)
npm install -g ad-sdlc

# Or use directly with npx
npx ad-sdlc init
```

### Configure

```bash
# Set your Claude API key
export CLAUDE_API_KEY="your-api-key"
# or
export ANTHROPIC_API_KEY="your-api-key"

# For GitHub integration
gh auth login
```

See [Installation Guide](docs/installation.md) for detailed setup instructions.

## Usage

### Initialize a New Project

```bash
# Interactive mode - guides you through configuration
ad-sdlc init

# Quick setup with defaults
ad-sdlc init my-project --quick

# With specific options
ad-sdlc init my-project \
  --tech-stack typescript \
  --template standard \
  --github-repo https://github.com/user/my-project
```

### Template Options

| Template | Workers | Coverage | Features |
|----------|---------|----------|----------|
| **minimal** | 2 | 50% | Basic structure |
| **standard** | 3 | 70% | Token tracking, dashboard |
| **enterprise** | 5 | 80% | Audit logging, security scanning |

### Run the Pipeline

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

### CLI Commands

```bash
ad-sdlc init [project-name]   # Initialize new project
ad-sdlc validate              # Validate configuration
ad-sdlc status                # Check pipeline status
```

See [Quickstart Guide](docs/quickstart.md) for a step-by-step tutorial.

## Use Cases

### New Feature Implementation

```bash
claude "Implement user dashboard with usage statistics and charts"
```

### Bug Fix Workflow

```bash
claude "Fix #42: Login fails when email contains +"
```

### Refactoring Project

```bash
claude "Refactor auth module to use dependency injection"
```

### From Requirements File

```bash
claude "Read requirements from docs/requirements.md and implement"
```

See [Use Cases Guide](docs/use-cases.md) for more examples.

## Project Structure

```
your-project/
├── .claude/
│   └── agents/              # Agent definitions
│       ├── *.md             # English versions (used by Claude)
│       └── *.kr.md          # Korean versions (for reference)
├── .ad-sdlc/
│   ├── config/              # Configuration files
│   │   ├── agents.yaml      # Agent registry
│   │   └── workflow.yaml    # Pipeline configuration
│   ├── logs/                # Audit logs
│   ├── templates/           # Document templates
│   └── scratchpad/          # Inter-agent state (Scratchpad pattern)
├── docs/                    # Generated documentation
├── src/                     # Generated source code
└── README.md
```

## Documentation

### Getting Started

- [Installation Guide](docs/installation.md) - Detailed setup instructions
- [Quickstart Guide](docs/quickstart.md) - 5-minute tutorial
- [Use Cases](docs/use-cases.md) - Common scenarios and examples
- [FAQ](docs/faq.md) - Frequently asked questions

### Reference

- [System Architecture](docs/system-architecture.md)
- [PRD-001: Agent-Driven SDLC](docs/PRD-001-agent-driven-sdlc.md)
- [SRS-001: Agent-Driven SDLC](docs/SRS-001-agent-driven-sdlc.md)
- [SDS-001: Agent-Driven SDLC](docs/SDS-001-agent-driven-sdlc.md)

### Guides

- [Agent Deployment](docs/guides/deployment.md)
- [Reference Documentation](docs/reference/README.md)

### Korean Documentation

- [PRD-001 (한글)](docs/PRD-001-agent-driven-sdlc.kr.md)
- [SRS-001 (한글)](docs/SRS-001-agent-driven-sdlc.kr.md)
- [SDS-001 (한글)](docs/SDS-001-agent-driven-sdlc.kr.md)

## Agent Definitions

Each agent is defined in `.claude/agents/` with:
- YAML frontmatter (name, description, tools, model)
- Markdown body with role, responsibilities, schemas, and workflows

English versions (`.md`) are used by Claude during execution.
Korean versions (`.kr.md`) are provided for developer reference.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using conventional commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Need help?** Check the [FAQ](docs/faq.md) or [open an issue](https://github.com/kcenon/claude_code_agent/issues).
