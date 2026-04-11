# claude-config Reference Guide

This document explains how AD-SDLC agents can reference resources from [claude-config](https://github.com/kcenon/claude-config) to improve code quality.

## Overview

claude-config is a Claude Code configuration management and development guidelines system. When AD-SDLC agents reference these guidelines during code generation, review, and documentation, they can produce consistent, high-quality results.

## Key Resources

### Skills (Auto-loading Guidelines)

| Skill | Description | Path |
|-------|-------------|------|
| **coding-guidelines** | Coding standards, quality, error handling | `.claude/skills/coding-guidelines/` |
| **security-audit** | Security guidelines, OWASP Top 10 | `.claude/skills/security-audit/` |
| **performance-review** | Performance optimization, profiling | `.claude/skills/performance-review/` |
| **api-design** | API design, architecture | `.claude/skills/api-design/` |
| **project-workflow** | Git, issues, PR management | `.claude/skills/project-workflow/` |
| **documentation** | README, API docs, comments | `.claude/skills/documentation/` |

### Rules (`.claude/rules/`)

Rules are loaded automatically by Claude Code based on `alwaysApply` and `paths` frontmatter.

```
.claude/rules/
├── core/
│   ├── principles.md       # Think, Minimize, Verify (alwaysApply)
│   ├── communication.md    # English code, Korean conversation (alwaysApply)
│   └── environment.md      # KST, Korean locale (alwaysApply)
├── coding/
│   ├── standards.md        # Naming, modularity, SOLID, quality
│   ├── error-handling.md   # Error patterns, validation
│   ├── performance.md      # Profiling, caching, algorithms
│   ├── safety.md           # Safe code practices
│   ├── implementation-standards.md  # Tier implementation
│   └── cpp-specifics.md    # C++ specific rules
├── api/
│   ├── api-design.md       # REST, GraphQL design
│   ├── architecture.md     # SOLID, layered design
│   ├── observability.md    # Logging, metrics, tracing
│   └── rest-api.md         # REST conventions
├── project-management/
│   ├── build.md            # Build, dependency management
│   ├── testing.md          # Unit/integration/E2E tests
│   └── documentation.md    # API docs, README
├── security.md             # Input validation, auth, OWASP Top 10
└── workflow/
    ├── git-commit-format.md    # Conventional Commits
    ├── github-issue-5w1h.md    # Issue framework
    └── github-pr-5w1h.md       # PR framework
```

> **Note**: `coding-standards/` was renamed to `coding/`, and `api-architecture/` to `api/`.
> `quality.md` and `concurrency.md` were merged into `standards.md`.
> `logging.md` was merged into `observability.md`.

*Last reconciled: 2026-04-11*

## Recommended References by Agent

### Worker Agent

Responsible for code implementation. Requires the most guideline references.

| Reference Resource | Purpose |
|--------------------|---------|
| `coding/standards.md` | Naming rules, code structure, quality |
| `coding/error-handling.md` | Exception handling patterns |
| `project-management/testing.md` | Test writing rules (AAA pattern) |
| `coding/implementation-standards.md` | Complete tier implementation |

**Prompt Example**:
```markdown
## Implementation Guidelines

Follow these standards from claude-config:

### Naming Conventions
- Variables: camelCase (e.g., `userName`, `itemCount`)
- Classes: PascalCase (e.g., `UserService`, `OrderItem`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- Files: kebab-case (e.g., `user-service.ts`)

### Error Handling
- Use specific error types, not generic Error
- Include actionable error messages
- Distinguish recoverable vs non-recoverable errors

### Testing (AAA Pattern)
- Arrange: Set up test data and conditions
- Act: Execute the code under test
- Assert: Verify the expected outcome
- Target: 80%+ code coverage
```

### PR Reviewer Agent

Responsible for code review. Focuses on quality and security guidelines.

| Reference Resource | Purpose |
|--------------------|---------|
| `security.md` | Security vulnerability checklist |
| `coding/standards.md` | Code quality criteria |
| `coding/performance.md` | Performance issue identification |

**Prompt Example**:
```markdown
## Review Checklist

### Security (from claude-config/security.md)
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] No hardcoded secrets or credentials
- [ ] Proper authentication/authorization checks

### Code Quality (from claude-config/coding/standards.md)
- [ ] Cyclomatic complexity < 10 per function
- [ ] No code duplication (DRY principle)
- [ ] Single Responsibility Principle
- [ ] Clear and meaningful names
```

### SDS Writer Agent

Responsible for software design documentation. Focuses on API/architecture guidelines.

| Reference Resource | Purpose |
|--------------------|---------|
| `api/api-design.md` | REST/GraphQL design patterns |
| `api/architecture.md` | Architecture patterns, SOLID |
| `api/observability.md` | Monitoring, health check design |

**Prompt Example**:
```markdown
## API Design Guidelines

### REST API (from claude-config)
- Resource-oriented URLs: `/users/{id}`, `/orders/{id}/items`
- Appropriate HTTP methods: GET (read), POST (create), PUT (update), DELETE (remove)
- Consistent response format with proper status codes
- Versioning strategy: URL path (v1) or header

### Architecture Patterns
- Layered architecture: Controller → Service → Repository
- Dependency Injection for testability
- Interface segregation for loose coupling
```

### Controller Agent

Responsible for task distribution and issue management.

| Reference Resource | Purpose |
|--------------------|---------|
| `project-management/build.md` | Build priority decisions |
| `workflow/github-issue-5w1h.md` | Issue structuring |

### Document Writers (PRD/SRS/SDS)

Document writing agents.

| Reference Resource | Purpose |
|--------------------|---------|
| `project-management/documentation.md` | Documentation standards |
| `communication.md` | Language and style rules |

## Reference Methods

### Method 1: GitHub Raw URL

```bash
# View SKILL.md
curl -s https://raw.githubusercontent.com/kcenon/claude-config/main/project/.claude/skills/coding-guidelines/SKILL.md

# View specific guideline
curl -s https://raw.githubusercontent.com/kcenon/claude-config/main/project/claude-config/rules/coding/general.md
```

### Method 2: Local Clone

```bash
# Clone to same directory
git clone https://github.com/kcenon/claude-config.git ../claude-config

# Reference in agent prompt
# "Follow ../claude-config/project/.claude/rules/ when generating code"
```

### Method 3: Direct Inclusion in Agent Prompts

Include core rules directly in agent definition files (`.claude/agents/*.md`):

```markdown
---
name: worker
description: "Implements code based on assigned issues"
tools:
  - Read
  - Write
  - Edit
  - Bash
model: inherit
---

# Worker Agent

## Code Generation Standards

Follow these rules when generating code:

### From claude-config/coding
1. Naming: camelCase (variables), PascalCase (classes), UPPER_SNAKE_CASE (constants)
2. Error handling: Use specific error types, distinguish recoverability
3. Testing: AAA pattern, 80%+ coverage

### Reference Links
- [Full Coding Guidelines](https://github.com/kcenon/claude-config/blob/main/project/claude-config/rules/coding/general.md)
- [Error Handling](https://github.com/kcenon/claude-config/blob/main/project/claude-config/rules/coding/error-handling.md)
```

## Expected Benefits

| Aspect | Benefit |
|--------|---------|
| **Consistency** | All agents apply the same coding standards |
| **Quality** | Code generation based on verified best practices |
| **Security** | Proactive vulnerability prevention with systematic security review |
| **Maintenance** | Guideline updates reflect across all agents |

## Cautions

1. **Selective Application**: Choose only guidelines appropriate for your project
2. **Version Management**: Verify compatibility when claude-config is updated
3. **Prompt Size**: Including all guidelines increases token cost; include only essentials

## Related Links

- [claude-config Repository](https://github.com/kcenon/claude-config)
- [claude-config Skills](https://github.com/kcenon/claude-config/tree/main/project/.claude/skills)
- [claude-config Guidelines](https://github.com/kcenon/claude-config/tree/main/project/claude-guidelines)
- [Integration Guide (claude-config side)](https://github.com/kcenon/claude-config/blob/main/docs/ad-sdlc-integration.md)
