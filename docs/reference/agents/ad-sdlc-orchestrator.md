# AD-SDLC Pipeline Orchestrator

> **Version**: 1.2.0
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
  id: 'ad-sdlc-orchestrator'
  name: 'AD-SDLC Pipeline Orchestrator'
  korean_name: 'AD-SDLC 파이프라인 오케스트레이터'
  description: 'Coordinates full AD-SDLC pipeline execution by invoking subagents in sequence'
  definition_file: '.claude/agents/ad-sdlc-orchestrator.md'
  category: 'orchestration'
  order: -1

  capabilities:
    - 'pipeline_coordination'
    - 'subagent_invocation'
    - 'progress_monitoring'
    - 'approval_gate_management'
    - 'error_recovery'
    - 'import_mode_support'
    - 'issue_filtering'
    - 'session_resume'
    - 'start_from_stage'

  io:
    inputs:
      - user_request
      - project_path
      - override_mode
      - import_options
    outputs:
      - pipeline_log.yaml
      - final_report.md
      - imported_issues.json

  token_budget:
    default_limit: 200000
    cost_limit_usd: 5.00
    model_preference: 'opus'
```

## Input

### Source

- **User Request**: Natural language description of project or feature
- **Project Path**: Current working directory
- **Override Mode**: Optional explicit mode selection

### Schema

```yaml
input:
  user_request: string # "Build a task management CLI"
  project_path: string # "/path/to/project"
  override_mode: string # "greenfield" | "enhancement" | "import" | null
  import_options: # Only for import mode
    filter:
      labels: [string] # ["bug", "feature"]
      milestone: string # "v1.0"
      issues: [integer] # [1, 2, 3]
      state: string # "open" (default)
    batch_size: integer # Max concurrent workers (default: 5)
```

## Output

### Destination

- **Pipeline Log**: `.ad-sdlc/scratchpad/orchestration/pipeline_log.yaml`
- **Final Report**: `.ad-sdlc/scratchpad/orchestration/final_report.md`

### Schema

```yaml
orchestration_result:
  pipeline_mode: "greenfield" | "enhancement" | "import"
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

1. **Check Prior State**
   - Scan `.ad-sdlc/scratchpad/pipeline/*.yaml` for prior sessions
   - If a session with `overallStatus: partial` or `failed` exists:
     - Present completed stages to the user
     - Offer: Resume / Start Over / Jump To a specific stage
   - If resuming: load pre-completed stages and skip to next incomplete stage

2. **Initialize**
   - Verify project directory exists
   - Create scratchpad directories if needed
   - Start orchestration log

3. **Detect Mode**
   - Invoke `mode-detector` subagent
   - Check for user override
   - Confirm mode with user

4. **Execute Pipeline**
   - Select Greenfield or Enhancement pipeline
   - Skip pre-completed stages (from resume or start-from)
   - Invoke subagents in sequence
   - Handle approval gates at checkpoints
   - Validate artifacts exist for skipped stages

5. **Manage Approvals**
   - Present generated artifacts to user
   - Request explicit approval
   - Handle modifications or regeneration
   - Already-approved gates from prior sessions are automatically skipped

6. **Handle Errors**
   - Retry failed stages (up to 2 times)
   - Escalate to user if retries exhausted
   - Allow skip, retry, or abort
   - On failure, persist session state for future resume

7. **Finalize**
   - Generate final report
   - List all artifacts
   - Provide recommendations

### Decision Points

- **Resume Detection**: Check for prior sessions before starting fresh
- **Mode Selection**: Based on existing docs/code and user keywords
- **Pipeline Branch**: Greenfield vs Enhancement vs Import pipeline
- **Import Detection**: Triggered by keywords like "process issues", "work on issues", "existing issues"
- **Approval Gates**: User must approve PRD, SRS, SDS, and issues (not applicable for Import mode)
- **Error Recovery**: Retry, skip, or abort on failure

### Pipeline Stages

#### Greenfield Pipeline

| Order | Agent             | Description         | Approval Gate |
| ----- | ----------------- | ------------------- | ------------- |
| 1     | mode-detector     | Confirm mode        | No            |
| 2     | collector         | Gather requirements | No            |
| 3     | prd-writer        | Generate PRD        | Yes           |
| 4     | srs-writer        | Generate SRS        | Yes           |
| 5     | repo-detector     | Check repository    | No            |
| 6     | github-repo-setup | Create repo         | No            |
| 7     | sds-writer        | Generate SDS        | Yes           |
| 8     | issue-generator   | Create issues       | Yes           |
| 9     | controller        | Assign work         | No            |
| 10    | worker            | Implement           | No            |
| 11    | pr-reviewer       | Review PRs          | No            |

#### Enhancement Pipeline

| Order | Agent             | Description         | Approval Gate |
| ----- | ----------------- | ------------------- | ------------- |
| 1     | mode-detector     | Confirm mode        | No            |
| 2     | document-reader   | Parse existing docs | No            |
| 3     | codebase-analyzer | Analyze code        | No            |
| 4     | code-reader       | Extract structure   | No            |
| 5     | impact-analyzer   | Assess impact       | No            |
| 6     | prd-updater       | Update PRD          | Yes           |
| 7     | srs-updater       | Update SRS          | Yes           |
| 8     | sds-updater       | Update SDS          | Yes           |
| 9     | issue-generator   | Create issues       | Yes           |
| 10    | controller        | Assign work         | No            |
| 11    | worker            | Implement           | No            |
| 12    | regression-tester | Verify stability    | No            |
| 13    | pr-reviewer       | Review PRs          | No            |

#### Import Pipeline

| Order | Agent         | Description           | Approval Gate |
| ----- | ------------- | --------------------- | ------------- |
| 1     | mode-detector | Confirm import mode   | No            |
| 2     | issue-reader  | Import GitHub issues  | No            |
| 3     | controller    | Prioritize and assign | No            |
| 4     | worker        | Implement issues      | No            |
| 5     | pr-reviewer   | Review PRs            | No            |

**Import Mode Keywords** (auto-detection):

- "process issues", "work on issues", "implement issues"
- "handle backlog", "process backlog"
- "existing issues", "open issues"
- "issue #", "issues #"

## Resume Capability

The orchestrator supports resuming interrupted or failed pipelines. Session state is automatically persisted to `.ad-sdlc/scratchpad/pipeline/<session-id>.yaml` after each pipeline execution.

### Session State Format

```yaml
pipelineId: 'a1b2c3d4-...'
mode: 'greenfield'
startedAt: '2026-02-18T10:00:00Z'
overallStatus: 'partial' # "success" | "partial" | "failed"
totalStages: 12
completedStages: 7
stages:
  - name: 'initialization'
    status: 'completed'
  - name: 'sds_generation'
    status: 'failed'
    error: 'Subagent timeout'
```

### Resume Modes

| Mode             | Description                                                          | CLI Flag                |
| ---------------- | -------------------------------------------------------------------- | ----------------------- |
| Resume Latest    | Load the most recent session and continue from next incomplete stage | `--resume`              |
| Resume Specific  | Load a specific session by ID                                        | `--resume <session-id>` |
| Start From Stage | Skip to a named stage, marking all prior stages as pre-completed     | `--start-from <stage>`  |

### Artifact Validation

When resuming, the orchestrator validates that expected artifacts exist for pre-completed stages. If an artifact is missing (e.g., PRD file deleted), that stage is removed from the pre-completed list and re-executed.

### State Persistence Flow

```
Pipeline Execution
  ├─ Stage completes → update in-memory state
  ├─ Pipeline ends (success/partial/failed)
  │   └─ Persist state to .ad-sdlc/scratchpad/pipeline/{session-id}.yaml
  └─ Next run
      ├─ Scan pipeline directory for prior sessions
      ├─ Load session state → rebuild pre-completed stages
      └─ Continue from next incomplete stage
```

## Error Handling

### Recoverable Errors

| Error            | Recovery Action                      |
| ---------------- | ------------------------------------ |
| Subagent Timeout | Retry up to 2 times with 30s backoff |
| Output Missing   | Retry with explicit output request   |
| API Error        | Retry with exponential backoff       |

### Non-Recoverable Errors

| Error                | User Action Required          |
| -------------------- | ----------------------------- |
| Project Not Found    | Verify path and restart       |
| Validation Failed    | Review input and restart      |
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

### Basic Usage: Import Mode

**Invocation**:

```
"Use the ad-sdlc-orchestrator to process the open issues labeled 'bug'"
```

**Expected Flow**:

1. Import mode detected from keywords ("process", "issues")
2. Import GitHub issues with label filter: ["bug"]
3. Prioritize and assign work orders
4. Implement fixes via worker agents
5. Review and merge PRs
6. Final report generated

### Import Mode with Specific Issues

**Invocation**:

```
"Use the ad-sdlc-orchestrator to work on issues #10, #12, #15"
```

**Expected Flow**:

1. Import mode detected from keywords ("work on issues", "#")
2. Parse and import issues: [10, 12, 15]
3. Analyze dependencies between issues
4. Execute in dependency order
5. Review each implementation
6. Final report generated

### Resume After Failed Pipeline

**Invocation**:

```
"Resume the pipeline"
```

**Prior State**: Pipeline failed at `sds_generation` (7 of 12 greenfield stages completed)

**Expected Flow**:

1. Detect prior session in `.ad-sdlc/scratchpad/pipeline/`
2. Present: "Pipeline paused at sds_generation. 7 stages complete."
3. User chooses: Resume
4. Validate artifacts: PRD exists, SRS exists
5. Skip stages 1-7, execute from `sds_generation`
6. Continue: issue_generation → controller → worker → pr-reviewer
7. Generate final report (noting resumed execution)

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

| Agent             | Pipeline               | Purpose                       |
| ----------------- | ---------------------- | ----------------------------- |
| mode-detector     | All                    | Determine pipeline mode       |
| collector         | Greenfield             | Gather requirements           |
| prd-writer        | Greenfield             | Generate PRD                  |
| srs-writer        | Greenfield             | Generate SRS                  |
| sds-writer        | Greenfield             | Generate SDS                  |
| repo-detector     | Greenfield             | Check for existing repo       |
| github-repo-setup | Greenfield             | Create repository             |
| issue-generator   | Greenfield/Enhancement | Create GitHub issues          |
| issue-reader      | Import                 | Import existing GitHub issues |
| controller        | All                    | Orchestrate work              |
| worker            | All                    | Implement features            |
| pr-reviewer       | All                    | Review PRs                    |
| document-reader   | Enhancement            | Parse existing docs           |
| codebase-analyzer | Enhancement            | Analyze codebase              |
| code-reader       | Enhancement            | Extract code structure        |
| impact-analyzer   | Enhancement            | Assess change impact          |
| prd-updater       | Enhancement            | Update PRD                    |
| srs-updater       | Enhancement            | Update SRS                    |
| sds-updater       | Enhancement            | Update SDS                    |
| regression-tester | Enhancement            | Verify no regressions         |

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
    auto_approve: false # Set true for CI/CD mode

  parallelization:
    enabled: true
    max_concurrent: 3

  logging:
    level: info
    output: scratchpad
```

## CLI Usage

The pipeline can be executed via the shell script with support for resume and start-from-middle capabilities.

### Basic Usage

```bash
./ad-sdlc-full-pipeline.sh [project_path] [mode] [options]
```

### Options

| Option                  | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `--start-from <stage>`  | Start execution from a specific stage, skipping prior stages |
| `--resume [session-id]` | Resume from the latest session or a specific session ID      |
| `--list-sessions`       | List available pipeline sessions for resume                  |
| `-h, --help`            | Show help message with stage names and examples              |

### Resume Pipeline

```bash
# Resume from the latest session
./ad-sdlc-full-pipeline.sh . auto --resume

# Resume from a specific session
./ad-sdlc-full-pipeline.sh . auto --resume a1b2c3-session-id

# List available sessions first
./ad-sdlc-full-pipeline.sh . auto --list-sessions
```

Session state is stored in `.ad-sdlc/scratchpad/pipeline/<session-id>.yaml`. When resuming, the orchestrator loads prior state and continues from the next incomplete stage. Completed stages are not re-executed.

### Start From Stage

```bash
# Skip to SDS generation (assumes PRD and SRS already exist)
./ad-sdlc-full-pipeline.sh . greenfield --start-from sds_generation

# Skip to issue generation in enhancement mode
./ad-sdlc-full-pipeline.sh . enhancement --start-from issue_generation
```

The `--start-from` option requires an explicit mode (`greenfield`, `enhancement`, or `import`) — it cannot be used with `auto` mode. Artifacts from skipped stages are validated before proceeding.

### Available Stage Names

**Greenfield**: `initialization`, `mode_detection`, `collection`, `prd_generation`, `srs_generation`, `repo_detection`, `github_repo_setup`, `sds_generation`, `issue_generation`, `orchestration`, `implementation`, `review`

**Enhancement**: `document_reading`, `codebase_analysis`, `code_reading`, `doc_code_comparison`, `impact_analysis`, `prd_update`, `srs_update`, `sds_update`, `issue_generation`, `orchestration`, `implementation`, `regression_testing`, `review`

**Import**: `issue_reading`, `orchestration`, `implementation`, `review`

## Best Practices

1. **Start Fresh**: Let the orchestrator detect mode automatically
2. **Review Approvals**: Carefully review documents at approval gates
3. **Monitor Progress**: Check pipeline log for current status
4. **Handle Errors Gracefully**: Choose appropriate recovery actions
5. **Use Override Sparingly**: Only override mode when intentional
6. **Resume on Failure**: Use `--resume` to continue after a failed pipeline run
7. **Skip Completed Work**: Use `--start-from` to avoid re-executing expensive stages

---

_Part of [Agent Reference Documentation](./README.md)_
