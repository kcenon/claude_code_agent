# Project Initialization Module

The init module provides project scaffolding and initialization for AD-SDLC projects.

## Overview

The init module creates a complete AD-SDLC project structure with:
- Configuration files (workflow.yaml, agents.yaml)
- Document templates (PRD, SRS, SDS, Issue)
- Agent definitions for all pipeline stages
- Directory structure for scratchpad pattern

## CLI Usage

### Interactive Mode

```bash
npx ad-sdlc init
```

This launches an interactive wizard that prompts for:
- Project name
- Project description (optional)
- GitHub repository URL (optional)
- Technology stack (TypeScript, Python, Java, Go, Rust, Other)
- Project template (minimal, standard, enterprise)

### Quick Mode

```bash
npx ad-sdlc init my-project --quick
```

Skips interactive prompts and uses defaults:
- Template: standard
- Tech stack: typescript

### Full Options

```bash
npx ad-sdlc init my-project \
  --github-repo https://github.com/user/my-project \
  --tech-stack typescript \
  --template standard \
  --skip-validation
```

| Option | Description |
|--------|-------------|
| `-g, --github-repo <url>` | GitHub repository URL |
| `-t, --tech-stack <stack>` | Technology stack (typescript, python, java, go, rust, other) |
| `-T, --template <template>` | Project template (minimal, standard, enterprise) |
| `-q, --quick` | Skip interactive prompts |
| `--skip-validation` | Skip prerequisite validation |

## Templates

### Minimal

- 2 parallel workers
- 50% code coverage threshold
- Basic quality gates
- Essential structure only

### Standard (Default)

- 3 parallel workers
- 70% code coverage threshold
- Standard quality gates with PR reviews
- Token tracking enabled
- Progress dashboard enabled

### Enterprise

- 5 parallel workers
- 80% code coverage threshold
- Strict quality gates
- All standard features plus:
  - Audit logging
  - Security scanning

## Generated Structure

```
my-project/
├── .ad-sdlc/
│   ├── config/
│   │   ├── workflow.yaml     # Pipeline configuration
│   │   └── agents.yaml       # Agent registry
│   ├── scratchpad/
│   │   ├── info/             # Collected information
│   │   ├── documents/        # Generated documents
│   │   ├── issues/           # Issue lists
│   │   └── progress/         # Work orders and results
│   ├── templates/
│   │   ├── prd-template.md
│   │   ├── srs-template.md
│   │   ├── sds-template.md
│   │   └── issue-template.md
│   └── logs/                 # Audit logs
│
├── .claude/
│   └── agents/
│       ├── collector.md
│       ├── prd-writer.md
│       ├── srs-writer.md
│       ├── sds-writer.md
│       ├── issue-generator.md
│       ├── controller.md
│       ├── worker.md
│       └── pr-reviewer.md
│
├── docs/
│   ├── prd/                  # Published PRD documents
│   ├── srs/                  # Published SRS documents
│   └── sds/                  # Published SDS documents
│
├── .gitignore               # Updated with AD-SDLC entries
└── README.md                # Generated README
```

## Prerequisite Validation

The init command validates the following prerequisites:

| Check | Required | Description |
|-------|----------|-------------|
| Node.js Version | Yes | Must be 18 or higher |
| Git | Yes | Must be installed |
| Claude API Key | No | CLAUDE_API_KEY or ANTHROPIC_API_KEY |
| GitHub CLI | No | gh CLI authenticated |

Skip validation with `--skip-validation` for offline initialization.

## Programmatic Usage

```typescript
import {
  createProjectInitializer,
  getPrerequisiteValidator,
} from 'ad-sdlc';

// Validate prerequisites
const validator = getPrerequisiteValidator();
const validation = await validator.validate();

if (validation.valid) {
  // Initialize project
  const initializer = createProjectInitializer({
    projectName: 'my-project',
    techStack: 'typescript',
    template: 'standard',
    targetDir: process.cwd(),
    skipValidation: true,
  });

  const result = await initializer.initialize();

  if (result.success) {
    console.log(`Project created at: ${result.projectPath}`);
    console.log(`Created ${result.createdFiles.length} files`);
  } else {
    console.error(`Failed: ${result.error}`);
  }
}
```

## Configuration Files

### workflow.yaml

Defines the pipeline stages, quality gates, and execution parameters:

```yaml
version: 1.0.0
pipeline:
  stages:
    - name: collect
      agent: collector
      timeout_ms: 300000
    - name: prd
      agent: prd-writer
      timeout_ms: 300000
    # ... more stages

quality_gates:
  coverage: 70
  complexity: 15
  requireReview: true
  requireTests: true

execution:
  max_parallel_workers: 3
  retry_attempts: 3
  retry_delay_ms: 5000
```

### agents.yaml

Registry of all agents with their definitions:

```yaml
version: 1.0.0
agents:
  collector:
    description: Collects and organizes project requirements
    model: sonnet
    definition: .claude/agents/collector.md
  # ... more agents
```

## Error Handling

The init module provides specific error types:

| Error | Description |
|-------|-------------|
| `PrerequisiteError` | Required prerequisites not met |
| `ProjectExistsError` | Project with .ad-sdlc already exists |
| `FileSystemError` | File system operation failed |
| `ConfigurationError` | Invalid configuration |

## Next Steps

After initialization:

1. Navigate to your project: `cd my-project`
2. Set up your API key: `export CLAUDE_API_KEY="your-key"`
3. Start the pipeline: `npx ad-sdlc run "Your requirements"`
