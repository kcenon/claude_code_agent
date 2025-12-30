# AD-SDLC Pipeline Orchestrator

> **Version**: 1.0.0
> **Category**: Orchestration
> **Order**: -1 (Top-level agent)

## Overview

The AD-SDLC Pipeline Orchestrator is the top-level coordination agent that manages the entire software development lifecycle. It automatically detects the appropriate pipeline mode (Greenfield or Enhancement) and orchestrates the execution of all relevant subagents in the correct sequence.

## Configuration

### Agent Definition

**Location**: `.claude/agents/ad-sdlc-orchestrator.md`

### YAML Configuration

```yaml
# .ad-sdlc/config/agents.yaml
ad-sdlc-orchestrator:
  id: "ad-sdlc-orchestrator"
  name: "AD-SDLC Pipeline Orchestrator"
  korean_name: "AD-SDLC 파이프라인 오케스트레이터"
  description: "Coordinates full AD-SDLC pipeline execution by invoking subagents in sequence"
  definition_file: ".claude/agents/ad-sdlc-orchestrator.md"
  category: "orchestration"
  order: -1

  capabilities:
    - "pipeline_coordination"
    - "subagent_invocation"
    - "progress_monitoring"
    - "approval_gate_management"
    - "error_recovery"

  io:
    inputs:
      - user_request
      - project_path
      - override_mode
    outputs:
      - pipeline_log.yaml
      - final_report.md

  token_budget:
    default_limit: 200000
    cost_limit_usd: 5.00
    model_preference: "opus"
```

## Input

### Source

- **User Request**: Natural language description of project or feature
- **Project Path**: Current working directory
- **Override Mode**: Optional explicit mode selection

### Schema

```yaml
input:
  user_request: string    # "Build a task management CLI"
  project_path: string    # "/path/to/project"
  override_mode: string   # "greenfield" | "enhancement" | null
```

## Output

### Destination

- **Pipeline Log**: `.ad-sdlc/scratchpad/orchestration/pipeline_log.yaml`
- **Final Report**: `.ad-sdlc/scratchpad/orchestration/final_report.md`

### Schema

```yaml
orchestration_result:
  pipeline_mode: "greenfield" | "enhancement"
  started_at: datetime
  completed_at: datetime
  status: "success" | "partial" | "failed"

  stages_executed:
    - stage: string
      agent: string
      status: "success" | "skipped" | "failed"
      duration_seconds: integer
      output_path: string

  approval_gates:
    - gate: string
      approved_at: datetime
      user_notes: string

  artifacts_generated:
    - type: string
      path: string

  errors:
    - stage: string
      error_type: string
      message: string
      recoverable: boolean
```

## Behavior

### Processing Steps

1. **Initialize**
   - Verify project directory exists
   - Create scratchpad directories if needed
   - Start orchestration log

2. **Detect Mode**
   - Invoke `mode-detector` subagent
   - Check for user override
   - Confirm mode with user

3. **Execute Pipeline**
   - Select Greenfield or Enhancement pipeline
   - Invoke subagents in sequence
   - Handle approval gates at checkpoints

4. **Manage Approvals**
   - Present generated artifacts to user
   - Request explicit approval
   - Handle modifications or regeneration

5. **Handle Errors**
   - Retry failed stages (up to 2 times)
   - Escalate to user if retries exhausted
   - Allow skip, retry, or abort

6. **Finalize**
   - Generate final report
   - List all artifacts
   - Provide recommendations

### Decision Points

- **Mode Selection**: Based on existing docs/code and user keywords
- **Pipeline Branch**: Greenfield vs Enhancement pipeline
- **Approval Gates**: User must approve PRD, SRS, SDS, and issues
- **Error Recovery**: Retry, skip, or abort on failure

### Pipeline Stages

#### Greenfield Pipeline

| Order | Agent | Description | Approval Gate |
|-------|-------|-------------|---------------|
| 1 | mode-detector | Confirm mode | No |
| 2 | collector | Gather requirements | No |
| 3 | prd-writer | Generate PRD | Yes |
| 4 | srs-writer | Generate SRS | Yes |
| 5 | repo-detector | Check repository | No |
| 6 | github-repo-setup | Create repo | No |
| 7 | sds-writer | Generate SDS | Yes |
| 8 | issue-generator | Create issues | Yes |
| 9 | controller | Assign work | No |
| 10 | worker | Implement | No |
| 11 | pr-reviewer | Review PRs | No |

#### Enhancement Pipeline

| Order | Agent | Description | Approval Gate |
|-------|-------|-------------|---------------|
| 1 | mode-detector | Confirm mode | No |
| 2 | document-reader | Parse existing docs | No |
| 3 | codebase-analyzer | Analyze code | No |
| 4 | code-reader | Extract structure | No |
| 5 | impact-analyzer | Assess impact | No |
| 6 | prd-updater | Update PRD | Yes |
| 7 | srs-updater | Update SRS | Yes |
| 8 | sds-updater | Update SDS | Yes |
| 9 | issue-generator | Create issues | Yes |
| 10 | controller | Assign work | No |
| 11 | worker | Implement | No |
| 12 | regression-tester | Verify stability | No |
| 13 | pr-reviewer | Review PRs | No |

## Error Handling

### Recoverable Errors

| Error | Recovery Action |
|-------|-----------------|
| Subagent Timeout | Retry up to 2 times with 30s backoff |
| Output Missing | Retry with explicit output request |
| API Error | Retry with exponential backoff |

### Non-Recoverable Errors

| Error | User Action Required |
|-------|---------------------|
| Project Not Found | Verify path and restart |
| Validation Failed | Review input and restart |
| Max Retries Exceeded | Choose: retry, skip, or abort |

## Examples

### Basic Usage: Greenfield Project

**Invocation**:
```
"Use the ad-sdlc-orchestrator to build a task management CLI application"
```

**Expected Flow**:
1. Mode detection → Greenfield
2. Collect requirements interactively
3. Generate PRD → User approval
4. Generate SRS → User approval
5. Create GitHub repository
6. Generate SDS → User approval
7. Create GitHub issues → User approval
8. Implement via worker agents
9. Review and merge PRs
10. Final report generated

### Basic Usage: Enhancement Project

**Invocation**:
```
"Use the ad-sdlc-orchestrator to add OAuth authentication to the existing app"
```

**Expected Flow**:
1. Mode detection → Enhancement (existing docs found)
2. Analyze existing documentation
3. Analyze codebase structure
4. Assess change impact
5. Update PRD → User approval
6. Update SRS → User approval
7. Update SDS → User approval
8. Create GitHub issues → User approval
9. Implement via worker agents
10. Run regression tests
11. Review and merge PRs
12. Final report generated

### With Mode Override

**Invocation**:
```
"Use the ad-sdlc-orchestrator in greenfield mode to completely rebuild the authentication system"
```

**Expected Flow**:
- Mode override accepted
- Greenfield pipeline executed regardless of existing docs/code

## Related Agents

### Dependencies (Invokes)

| Agent | Pipeline | Purpose |
|-------|----------|---------|
| mode-detector | Both | Determine pipeline mode |
| collector | Greenfield | Gather requirements |
| prd-writer | Greenfield | Generate PRD |
| srs-writer | Greenfield | Generate SRS |
| sds-writer | Greenfield | Generate SDS |
| repo-detector | Greenfield | Check for existing repo |
| github-repo-setup | Greenfield | Create repository |
| issue-generator | Both | Create GitHub issues |
| controller | Both | Orchestrate work |
| worker | Both | Implement features |
| pr-reviewer | Both | Review PRs |
| document-reader | Enhancement | Parse existing docs |
| codebase-analyzer | Enhancement | Analyze codebase |
| code-reader | Enhancement | Extract code structure |
| impact-analyzer | Enhancement | Assess change impact |
| prd-updater | Enhancement | Update PRD |
| srs-updater | Enhancement | Update SRS |
| sds-updater | Enhancement | Update SDS |
| regression-tester | Enhancement | Verify no regressions |

### Dependents

None - This is the top-level orchestration agent.

## Configuration Options

### Optional Configuration File

```yaml
# .ad-sdlc/config/orchestrator.yaml
orchestration:
  retry_limits:
    default: 2
    timeout: 3

  approval_gates:
    enabled: true
    auto_approve: false  # Set true for CI/CD mode

  parallelization:
    enabled: true
    max_concurrent: 3

  logging:
    level: info
    output: scratchpad
```

## Best Practices

1. **Start Fresh**: Let the orchestrator detect mode automatically
2. **Review Approvals**: Carefully review documents at approval gates
3. **Monitor Progress**: Check pipeline log for current status
4. **Handle Errors Gracefully**: Choose appropriate recovery actions
5. **Use Override Sparingly**: Only override mode when intentional

---

*Part of [Agent Reference Documentation](./README.md)*
