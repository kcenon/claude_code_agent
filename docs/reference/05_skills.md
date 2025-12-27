# Skills System Reference

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## Table of Contents

1. [Skills Overview](#skills-overview)
2. [Skill Structure](#skill-structure)
3. [Writing SKILL.md](#writing-skillmd)
4. [Skills vs Slash Commands](#skills-vs-slash-commands)
5. [Practical Examples](#practical-examples)
6. [Best Practices](#best-practices)

---

## Skills Overview

### What are Skills?

Skills are modular capability units that extend Claude's functionality. They consist of directories containing instructions, scripts, and resources.

### Skill Invocation Methods

| Invocation | Description |
|------------|-------------|
| **Model-invoked** | Claude automatically invokes when it determines appropriate for the task |
| **Explicit** | User directly invokes by skill name |

### Skill Locations

| Location | Path | Sharing |
|----------|------|---------|
| Personal | `~/.claude/skills/skill-name/` | Personal only |
| Project | `.claude/skills/skill-name/` | Shared via Git |
| Plugin | Inside plugin package | With plugin |

---

## Skill Structure

### Basic Directory Structure

```
my-skill/
├── SKILL.md              # Required: Skill definition and instructions
├── reference.md          # Optional: Reference documentation
├── examples.md           # Optional: Usage examples
├── templates/            # Optional: Template files
│   ├── component.tsx
│   └── test.ts
└── scripts/              # Optional: Helper scripts
    ├── helper.py
    └── validate.sh
```

### File Roles

| File | Required | Description |
|------|----------|-------------|
| `SKILL.md` | ✅ | Skill name, description, instructions |
| `reference.md` | ❌ | Additional reference information |
| `examples.md` | ❌ | Concrete usage examples |
| `templates/` | ❌ | Code/config templates |
| `scripts/` | ❌ | Automation scripts |

---

## Writing SKILL.md

### Basic Format

```markdown
---
name: my-awesome-skill
description: Detailed explanation of what this skill does and when to use it.
allowed-tools: Read, Grep, Glob
---

# My Awesome Skill

## Purpose
This skill is designed for [purpose].

## When to Use
- [Situation 1]
- [Situation 2]
- [Situation 3]

## Instructions

### Step 1: [Title]
[Detailed instructions]

### Step 2: [Title]
[Detailed instructions]

## Considerations
- [Consideration 1]
- [Consideration 2]

## Examples
[Concrete usage examples]
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Unique skill name |
| `description` | ✅ | Detailed description (Claude uses for invocation decisions) |
| `allowed-tools` | ❌ | Restrict allowed tools |
| `disable-model-invocation` | ❌ | Disable automatic invocation |

### Description Writing Tips

```yaml
# Good
description: |
  React component testing skill.
  Uses Jest and React Testing Library.
  Supports unit tests, integration tests, and snapshot tests.
  Responds to "component test", "React test", "Jest" keywords.

# Bad
description: Write tests  # Too vague
```

### Using allowed-tools

```yaml
---
name: code-review
description: Code review only skill (read-only operations)
allowed-tools: Read, Grep, Glob  # Excludes write tools
---
```

---

## Skills vs Slash Commands

### Comparison

| Characteristic | Skills | Slash Commands |
|----------------|--------|----------------|
| Invocation | Model decides | User types `/command` |
| Complexity | High (multi-file, scripts) | Low (single prompt) |
| Structure | Directory | Single .md file |
| Use Case | Complex workflows | Quick prompts |

### When to Use Skills?

- Complex multi-step tasks
- Need for templates or scripts
- Team standardization of workflows
- Automatic invocation is desirable

### When to Use Slash Commands?

- Simple single prompts
- Only explicit invocation needed
- Quick setup required

---

## Practical Examples

### 1. Code Review Skill

**.claude/skills/code-review/SKILL.md:**

```markdown
---
name: code-review
description: |
  Performs professional code reviews.
  Reviews code quality, security, performance, and best practices.
  Responds to "code review", "review", "PR review" keywords.
allowed-tools: Read, Grep, Glob
---

# Code Review Skill

## Purpose
Provides comprehensive review of changed code.

## Review Checklist

### 1. Code Quality
- Readability: Are variable names and function names clear?
- Structure: Do functions have single responsibility?
- Duplication: Does it follow DRY principle?
- Complexity: Is it overly complex?

### 2. Security
- Is input validation implemented?
- No SQL injection or XSS vulnerabilities?
- No hardcoded sensitive information?
- Is authentication/authorization properly implemented?

### 3. Performance
- No unnecessary operations?
- No N+1 query issues?
- No memory leak potential?

### 4. Testing
- Is test coverage sufficient?
- Are edge cases tested?

## Output Format

Organize review results in the following format:

### Summary
[Overall code quality summary]

### Major Issues (Severity: High)
1. [Issue description] - [file:line]
   - Problem: ...
   - Solution: ...

### Improvement Suggestions (Severity: Medium)
1. [Suggestion description] - [file:line]

### Commendations
1. [Good code pattern]
```

### 2. Test Writing Skill

**.claude/skills/test-writer/SKILL.md:**

```markdown
---
name: test-writer
description: |
  Writes tests for code.
  Supports major test frameworks like Jest, pytest, JUnit.
  Responds to "write tests", "add tests", "unit test" keywords.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Test Writing Skill

## Supported Frameworks
- JavaScript/TypeScript: Jest, Vitest, Mocha
- Python: pytest, unittest
- Java/Kotlin: JUnit, Kotest

## Test Writing Principles

### AAA Pattern
```
Arrange: Prepare test data
Act: Execute test target
Assert: Verify results
```

### Test Coverage
1. Happy Path (normal cases)
2. Edge Cases (boundary values)
3. Error Cases (exception scenarios)
4. Null/empty value handling

## Step-by-Step Instructions

### 1. Analyze Existing Test Structure
- Check test directory structure
- Identify test framework in use
- Analyze existing test patterns

### 2. Analyze Test Target
- Identify public APIs
- Understand dependencies
- Determine mocking needs

### 3. Write Tests
- Follow file naming conventions (*.test.ts, *_test.py, etc.)
- Group with describe/it structure
- Clear test descriptions

### 4. Verification
- Run tests and confirm passing
- Check coverage
```

### 3. API Documentation Skill

**.claude/skills/api-docs/SKILL.md:**

```markdown
---
name: api-docs
description: |
  API endpoint documentation skill.
  Generates documentation in OpenAPI/Swagger or Markdown format.
  Responds to "API docs", "documentation", "Swagger", "OpenAPI" keywords.
allowed-tools: Read, Write, Glob, Grep
---

# API Documentation Skill

## Documentation Scope

### Per Endpoint
- HTTP method and path
- Description
- Request parameters (path, query, body)
- Response format and status codes
- Authentication requirements
- Example request/response

## Output Format

### Markdown Format
```md
## GET /api/users/{id}

Retrieves user information.

### Parameters

| Name | Location | Type | Required | Description |
|------|----------|------|----------|-------------|
| id | path | string | Yes | User ID |

### Response

**200 OK**
```json
{
  "id": "user123",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**404 Not Found**
```json
{
  "error": "User not found"
}
```
```
```

### 4. Security Audit Skill

**.claude/skills/security-audit/SKILL.md:**

```markdown
---
name: security-audit
description: |
  Security vulnerability audit skill.
  Focuses on OWASP Top 10 vulnerabilities.
  Responds to "security audit", "vulnerability scan", "security review" keywords.
allowed-tools: Read, Grep, Glob
---

# Security Audit Skill

## Audit Items

### OWASP Top 10

1. **A01: Broken Access Control**
   - Missing permission checks
   - Direct object reference vulnerabilities

2. **A02: Cryptographic Failures**
   - Hardcoded secrets
   - Weak encryption algorithms

3. **A03: Injection**
   - SQL Injection
   - Command Injection
   - XSS

4. **A04: Insecure Design**
   - Missing authentication
   - Business logic vulnerabilities

5. **A05: Security Misconfiguration**
   - Debug mode enabled
   - Default credentials

6. **A06: Vulnerable Components**
   - Known vulnerable libraries

7. **A07: Authentication Failures**
   - Weak password policies
   - Session management issues

8. **A08: Data Integrity Failures**
   - Insecure deserialization

9. **A09: Logging Failures**
   - Logging sensitive information
   - Missing logging

10. **A10: SSRF**
    - Server-side request forgery

## Report Format

### Summary
- Critical: X items
- Warning: X items
- Info: X items

### Detailed Findings

#### [Severity] Vulnerability Title
- **Location**: file:line
- **Description**: Detailed vulnerability description
- **Impact**: Impact if exploited
- **Recommendation**: Remediation steps
```

---

## Best Practices

### 1. Be Specific in Description

```yaml
# Good
description: |
  React component testing skill.
  Uses Jest and React Testing Library.
  Responds to "component test", "React test", "Jest" keywords.

# Bad
description: Write tests
```

### 2. Single Purpose per Skill

```
# Good
code-review/     # Code review only
test-writer/     # Test writing only
api-docs/        # API docs only

# Bad
everything/      # Everything (too large)
```

### 3. Limit Scope with allowed-tools

```yaml
# Read-only skill
allowed-tools: Read, Grep, Glob

# Write-required skill
allowed-tools: Read, Write, Edit, Glob, Grep
```

### 4. Utilize Templates

```
my-skill/
└── templates/
    ├── component.tsx     # Component template
    ├── test.ts           # Test template
    └── README.md         # Documentation template
```

### 5. Version Management

```markdown
---
name: my-skill
version: 1.2.0
description: ...
---

## Change History
- 1.2.0: New feature added
- 1.1.0: Bug fixes
- 1.0.0: Initial release
```

### 6. Share with Team

```bash
# Commit as project skill
git add .claude/skills/my-skill/
git commit -m "feat: add my-skill"
git push
```

---

*Previous: [MCP Integration](04_mcp.md) | Next: [Configuration Guide](06_configuration.md)*
