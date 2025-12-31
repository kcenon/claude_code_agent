# AD-SDLC Convenience Scripts

This directory contains shell scripts for running AD-SDLC pipelines in non-interactive (headless) mode.

## Quick Start

```bash
# Make scripts executable (if not already)
chmod +x .ad-sdlc/scripts/*.sh

# Initialize AD-SDLC for a project
./.ad-sdlc/scripts/ad-sdlc-init.sh

# Analyze existing documents
./.ad-sdlc/scripts/ad-sdlc-analyze-docs.sh

# Generate GitHub issues from SDS
./.ad-sdlc/scripts/ad-sdlc-generate-issues.sh

# Implement issues
./.ad-sdlc/scripts/ad-sdlc-implement.sh . 42  # Specific issue
./.ad-sdlc/scripts/ad-sdlc-implement.sh       # All pending

# Run full pipeline
./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh
```

## Scripts Overview

| Script | Purpose | Typical Use |
|--------|---------|-------------|
| `ad-sdlc-init.sh` | Initialize AD-SDLC structure | New projects |
| `ad-sdlc-analyze-docs.sh` | Analyze PRD/SRS/SDS documents | Import existing docs |
| `ad-sdlc-generate-issues.sh` | Generate GitHub issues from SDS | After SDS is ready |
| `ad-sdlc-implement.sh` | Implement specific or all issues | Development phase |
| `ad-sdlc-full-pipeline.sh` | Run complete pipeline | End-to-end automation |

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_TURNS` | Varies | Maximum agent iterations |
| `SKIP_TESTS` | `false` | Skip running tests during implementation |
| `SKIP_CONFIRMATION` | `false` | Skip confirmation prompts |
| `DANGEROUSLY_SKIP_PERMISSIONS` | `false` | Bypass all permission checks (use with caution) |
| `GH_TOKEN` | - | GitHub token (falls back to `gh auth`) |

## Script Details

### ad-sdlc-init.sh

Initializes the AD-SDLC directory structure for a project.

```bash
# Usage
./ad-sdlc-init.sh [project_path]

# Examples
./ad-sdlc-init.sh                     # Current directory
./ad-sdlc-init.sh /path/to/project    # Specific path
```

**Creates:**
- `.ad-sdlc/config/` - Configuration files
- `.ad-sdlc/templates/` - Document templates
- `.ad-sdlc/scratchpad/` - Agent working directory
- `.claude/agents/` - Agent definitions

### ad-sdlc-analyze-docs.sh

Analyzes existing PRD, SRS, and SDS documents in the project.

```bash
# Usage
./ad-sdlc-analyze-docs.sh [project_path]

# Examples
./ad-sdlc-analyze-docs.sh
MAX_TURNS=20 ./ad-sdlc-analyze-docs.sh /path/to/project
```

**Output:**
- `.ad-sdlc/scratchpad/documents/current_state.yaml`

### ad-sdlc-generate-issues.sh

Generates GitHub issues from the SDS document.

```bash
# Usage
./ad-sdlc-generate-issues.sh [project_path] [--dry-run]

# Examples
./ad-sdlc-generate-issues.sh                    # Create issues
./ad-sdlc-generate-issues.sh . --dry-run        # Preview only
./ad-sdlc-generate-issues.sh /path/to/project
```

**Options:**
- `--dry-run` - Preview issues without creating them on GitHub

**Output:**
- `.ad-sdlc/scratchpad/issues/generated_issues.yaml`
- GitHub issues (unless `--dry-run`)

### ad-sdlc-implement.sh

Implements a specific issue or all pending issues.

```bash
# Usage
./ad-sdlc-implement.sh [project_path] [issue_number]

# Examples
./ad-sdlc-implement.sh                    # All pending issues
./ad-sdlc-implement.sh . 42               # Issue #42 only
./ad-sdlc-implement.sh /path/to/project 5
SKIP_TESTS=true ./ad-sdlc-implement.sh    # Skip tests
```

**Behavior:**
- Without issue number: Implements all pending issues (P0 first)
- With issue number: Implements only the specified issue

### ad-sdlc-full-pipeline.sh

Runs the complete AD-SDLC pipeline end-to-end.

```bash
# Usage
./ad-sdlc-full-pipeline.sh [project_path] [mode]

# Modes
auto        - Auto-detect project state
greenfield  - New project (full document generation)
enhancement - Improve existing project
import      - Import from existing documents

# Examples
./ad-sdlc-full-pipeline.sh                        # Auto mode
./ad-sdlc-full-pipeline.sh . greenfield           # New project
./ad-sdlc-full-pipeline.sh /path/to/proj import   # Import docs
SKIP_CONFIRMATION=true ./ad-sdlc-full-pipeline.sh # No prompts
```

**WARNING:** Using `DANGEROUSLY_SKIP_PERMISSIONS=true` bypasses all safety checks. Only use in trusted, isolated environments (CI/CD, containers).

## CI/CD Integration

### GitHub Actions Example

```yaml
name: AD-SDLC Pipeline
on:
  workflow_dispatch:
    inputs:
      mode:
        description: 'Pipeline mode'
        required: true
        default: 'auto'
        type: choice
        options:
          - auto
          - greenfield
          - enhancement
          - import

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Claude CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Run AD-SDLC Pipeline
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SKIP_CONFIRMATION: 'true'
        run: |
          chmod +x .ad-sdlc/scripts/*.sh
          ./.ad-sdlc/scripts/ad-sdlc-full-pipeline.sh . ${{ github.event.inputs.mode }}
```

## Troubleshooting

### Script won't execute

```bash
# Check permissions
ls -la .ad-sdlc/scripts/

# Fix permissions
chmod +x .ad-sdlc/scripts/*.sh
```

### API key not found

```bash
# Set API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Verify
echo $ANTHROPIC_API_KEY | head -c 10
```

### Claude CLI not found

```bash
# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Verify
claude --version
```

### Pipeline stuck or failing

1. Check logs: `.ad-sdlc/logs/pipeline.log`
2. Review progress: `.ad-sdlc/scratchpad/progress/`
3. Resume session: `claude --continue`
4. Reduce max turns and retry

## See Also

- [Headless Execution Guide](../../docs/headless-execution.md)
- [CLI Reference](../../docs/reference/06_configuration.md)
- [AD-SDLC Quickstart](../../docs/quickstart.md)
