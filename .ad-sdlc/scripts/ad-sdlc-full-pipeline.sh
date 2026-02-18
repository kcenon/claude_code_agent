#!/usr/bin/env bash
#
# AD-SDLC Full Pipeline Script
# Runs the complete AD-SDLC pipeline in non-interactive mode.
#
# Usage: ./ad-sdlc-full-pipeline.sh [project_path] [mode] [options]
#
# Arguments:
#   project_path  Path to the project directory (default: current directory)
#   mode          Pipeline mode: auto, greenfield, enhancement, import (default: auto)
#
# Options:
#   --start-from <stage>    Start execution from a specific stage
#   --resume [session-id]   Resume from latest or specific session
#   --list-sessions         List available sessions for resume
#   -h, --help              Show this help message
#
# Modes:
#   auto        - Automatically detect project state and choose mode
#   greenfield  - New project: collect requirements, generate all docs, implement
#   enhancement - Existing project: analyze code, identify improvements, implement
#   import      - Import mode: analyze existing docs, generate issues, implement
#
# Stages (greenfield):
#   initialization, mode_detection, collection, prd_generation,
#   srs_generation, repo_detection, github_repo_setup, sds_generation,
#   issue_generation, orchestration, implementation, review
#
# Stages (enhancement):
#   document_reading, codebase_analysis, code_reading, doc_code_comparison,
#   impact_analysis, prd_update, srs_update, sds_update,
#   issue_generation, orchestration, implementation, regression_testing, review
#
# Stages (import):
#   issue_reading, orchestration, implementation, review
#
# Example:
#   ./ad-sdlc-full-pipeline.sh
#   ./ad-sdlc-full-pipeline.sh . auto
#   ./ad-sdlc-full-pipeline.sh /path/to/project greenfield
#   ./ad-sdlc-full-pipeline.sh . greenfield --start-from sds_generation
#   ./ad-sdlc-full-pipeline.sh . auto --resume
#   ./ad-sdlc-full-pipeline.sh . auto --resume a1b2c3-session-id
#   ./ad-sdlc-full-pipeline.sh . auto --list-sessions
#
# Environment:
#   ANTHROPIC_API_KEY              Required. Your Anthropic API key.
#   SKIP_CONFIRMATION              Optional. Skip confirmation prompts (default: false)
#   DANGEROUSLY_SKIP_PERMISSIONS   Optional. Skip all permission prompts (default: false)
#
# WARNING: Using DANGEROUSLY_SKIP_PERMISSIONS bypasses all safety checks.
#          Only use in trusted, isolated environments.
#

set -euo pipefail

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# =============================================================================
# Stage Definitions (must match src/ad-sdlc-orchestrator/types.ts)
# =============================================================================

GREENFIELD_STAGE_LIST="initialization mode_detection collection prd_generation srs_generation repo_detection github_repo_setup sds_generation issue_generation orchestration implementation review"
ENHANCEMENT_STAGE_LIST="document_reading codebase_analysis code_reading doc_code_comparison impact_analysis prd_update srs_update sds_update issue_generation orchestration implementation regression_testing review"
IMPORT_STAGE_LIST="issue_reading orchestration implementation review"

# =============================================================================
# Help
# =============================================================================

show_help() {
    cat <<'HELP'
Usage: ./ad-sdlc-full-pipeline.sh [project_path] [mode] [options]

Arguments:
  project_path    Path to the project directory (default: current directory)
  mode            Pipeline mode: auto, greenfield, enhancement, import (default: auto)

Options:
  --start-from <stage>    Start execution from a specific stage
  --resume [session-id]   Resume from latest or specific session
  --list-sessions         List available sessions for resume
  -h, --help              Show this help message

Stages (greenfield):
  initialization, mode_detection, collection, prd_generation,
  srs_generation, repo_detection, github_repo_setup, sds_generation,
  issue_generation, orchestration, implementation, review

Stages (enhancement):
  document_reading, codebase_analysis, code_reading, doc_code_comparison,
  impact_analysis, prd_update, srs_update, sds_update,
  issue_generation, orchestration, implementation, regression_testing, review

Stages (import):
  issue_reading, orchestration, implementation, review

Examples:
  ./ad-sdlc-full-pipeline.sh                                    # Default: current dir, auto mode
  ./ad-sdlc-full-pipeline.sh . greenfield                       # Greenfield mode
  ./ad-sdlc-full-pipeline.sh . greenfield --start-from sds_generation
  ./ad-sdlc-full-pipeline.sh . auto --resume                    # Resume latest session
  ./ad-sdlc-full-pipeline.sh . auto --resume a1b2c3-session-id  # Resume specific session
  ./ad-sdlc-full-pipeline.sh . auto --list-sessions             # List resumable sessions
HELP
}

# =============================================================================
# Stage Validation
# =============================================================================

# Get the stage list for a given mode
# Usage: get_stage_list "greenfield"
get_stage_list() {
    local mode="$1"
    case "$mode" in
        greenfield)  echo "$GREENFIELD_STAGE_LIST" ;;
        enhancement) echo "$ENHANCEMENT_STAGE_LIST" ;;
        import)      echo "$IMPORT_STAGE_LIST" ;;
        auto)
            # For auto mode, accept stages from any pipeline
            echo "$GREENFIELD_STAGE_LIST $ENHANCEMENT_STAGE_LIST $IMPORT_STAGE_LIST"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Validate a stage name against the mode's stage list
# Usage: validate_stage "sds_generation" "greenfield"
validate_stage() {
    local stage="$1"
    local mode="$2"
    local stage_list
    stage_list="$(get_stage_list "$mode")"

    for valid_stage in $stage_list; do
        if [[ "$valid_stage" == "$stage" ]]; then
            return 0
        fi
    done

    return 1
}

# Compute the stages to skip (all stages before the target stage)
# Usage: compute_skipped_stages "sds_generation" "greenfield"
compute_skipped_stages() {
    local target="$1"
    local mode="$2"
    local stage_list
    local skipped=""

    # For auto mode with --start-from, we need a specific mode
    if [[ "$mode" == "auto" ]]; then
        log_error "--start-from requires an explicit mode (greenfield, enhancement, or import)"
        echo "Cannot determine stage order with 'auto' mode." >&2
        exit 1
    fi

    stage_list="$(get_stage_list "$mode")"

    for stage in $stage_list; do
        if [[ "$stage" == "$target" ]]; then
            break
        fi
        if [[ -n "$skipped" ]]; then
            skipped="$skipped, $stage"
        else
            skipped="$stage"
        fi
    done

    echo "$skipped"
}

# =============================================================================
# Session Management
# =============================================================================

# List available pipeline sessions
# Usage: list_sessions "/path/to/project"
list_sessions() {
    local project_dir="$1"
    local pipeline_dir="$project_dir/.ad-sdlc/scratchpad/pipeline"

    if [[ ! -d "$pipeline_dir" ]]; then
        echo "No pipeline sessions found."
        echo "Directory does not exist: .ad-sdlc/scratchpad/pipeline/"
        return 0
    fi

    local yaml_files
    yaml_files=$(find "$pipeline_dir" -maxdepth 1 -name "*.yaml" -type f 2>/dev/null | sort -r)

    if [[ -z "$yaml_files" ]]; then
        echo "No pipeline sessions found in .ad-sdlc/scratchpad/pipeline/"
        return 0
    fi

    echo "Available sessions:"
    echo ""

    local index=1
    while IFS= read -r file; do
        local session_id
        local mode
        local status
        local started_at
        local total_stages
        local completed_count

        session_id=$(basename "$file" .yaml)
        mode=$(grep -m1 '^mode:' "$file" 2>/dev/null | sed 's/^mode:[[:space:]]*//' | tr -d "'\"" || echo "unknown")
        status=$(grep -m1 '^status:' "$file" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d "'\"" || echo "unknown")
        started_at=$(grep -m1 '^startedAt:' "$file" 2>/dev/null | sed 's/^startedAt:[[:space:]]*//' | tr -d "'\"" || echo "unknown")

        # Count completed stages from stageResults
        completed_count=$(grep -c "status:[[:space:]]*['\"]\\{0,1\\}completed['\"]\\{0,1\\}" "$file" 2>/dev/null || echo "0")
        total_stages=$(grep -c "^[[:space:]]*- name:" "$file" 2>/dev/null || echo "?")

        printf "  %d. [%s] %s  %-13s  %s (%s/%s stages)\n" \
            "$index" \
            "${started_at:0:16}" \
            "${session_id:0:12}..." \
            "$mode" \
            "$status" \
            "$completed_count" \
            "$total_stages"

        index=$((index + 1))
    done <<< "$yaml_files"

    echo ""
}

# Find the latest session ID
# Usage: find_latest_session "/path/to/project"
find_latest_session() {
    local project_dir="$1"
    local pipeline_dir="$project_dir/.ad-sdlc/scratchpad/pipeline"

    if [[ ! -d "$pipeline_dir" ]]; then
        return 1
    fi

    local latest_file
    latest_file=$(find "$pipeline_dir" -maxdepth 1 -name "*.yaml" -type f 2>/dev/null | sort -r | head -1)

    if [[ -z "$latest_file" ]]; then
        return 1
    fi

    basename "$latest_file" .yaml
}

# =============================================================================
# Argument Parsing
# =============================================================================

PROJECT_PATH="."
MODE="auto"
START_FROM=""
RESUME_SESSION=""
RESUME_MODE="false"
LIST_SESSIONS="false"
SKIP_CONFIRMATION="${SKIP_CONFIRMATION:-false}"
DANGEROUSLY_SKIP_PERMISSIONS="${DANGEROUSLY_SKIP_PERMISSIONS:-false}"

# Parse positional arguments first, then options
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        --start-from)
            if [[ -z "${2:-}" ]]; then
                log_error "--start-from requires a stage name"
                exit 1
            fi
            START_FROM="$2"
            shift 2
            ;;
        --resume)
            RESUME_MODE="true"
            # Check if next argument is a session ID (not another flag)
            if [[ -n "${2:-}" ]] && [[ "${2:-}" != --* ]]; then
                RESUME_SESSION="$2"
                shift 2
            else
                shift 1
            fi
            ;;
        --list-sessions)
            LIST_SESSIONS="true"
            shift 1
            ;;
        -*)
            log_error "Unknown option: $1"
            echo "Use --help for usage information." >&2
            exit 1
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift 1
            ;;
    esac
done

# Assign positional arguments
if [[ ${#POSITIONAL_ARGS[@]} -ge 1 ]]; then
    PROJECT_PATH="${POSITIONAL_ARGS[0]}"
fi
if [[ ${#POSITIONAL_ARGS[@]} -ge 2 ]]; then
    MODE="${POSITIONAL_ARGS[1]}"
fi
if [[ ${#POSITIONAL_ARGS[@]} -ge 3 ]]; then
    log_error "Too many positional arguments"
    echo "Use --help for usage information." >&2
    exit 1
fi

# Validate mode
case "$MODE" in
    auto|greenfield|enhancement|import)
        ;;
    *)
        log_error "Invalid mode '$MODE'"
        echo "Valid modes: auto, greenfield, enhancement, import" >&2
        exit 1
        ;;
esac

# Validate mutually exclusive options
if [[ -n "$START_FROM" ]] && [[ "$RESUME_MODE" == "true" ]]; then
    log_error "--start-from and --resume are mutually exclusive"
    exit 1
fi

# Resolve absolute path
PROJECT_PATH="$(resolve_path "$PROJECT_PATH")" || exit 1

# Handle --list-sessions early (before environment check)
if [[ "$LIST_SESSIONS" == "true" ]]; then
    list_sessions "$PROJECT_PATH"
    exit 0
fi

# Validate --start-from stage name
if [[ -n "$START_FROM" ]]; then
    if ! validate_stage "$START_FROM" "$MODE"; then
        log_error "Invalid stage name '$START_FROM' for mode '$MODE'"
        echo "" >&2
        echo "Valid stages for '$MODE':" >&2
        echo "  $(get_stage_list "$MODE" | tr ' ' ', ')" >&2
        exit 1
    fi
fi

# Resolve --resume session ID
if [[ "$RESUME_MODE" == "true" ]] && [[ -z "$RESUME_SESSION" ]]; then
    RESUME_SESSION=$(find_latest_session "$PROJECT_PATH") || {
        log_error "No pipeline sessions found to resume"
        echo "Run a pipeline first, or specify a session ID: --resume <session-id>" >&2
        exit 1
    }
    log_info "Resuming from latest session: $RESUME_SESSION"
fi

# Validate --resume session file exists
if [[ "$RESUME_MODE" == "true" ]] && [[ -n "$RESUME_SESSION" ]]; then
    local_session_file="$PROJECT_PATH/.ad-sdlc/scratchpad/pipeline/${RESUME_SESSION}.yaml"
    if [[ ! -f "$local_session_file" ]]; then
        log_error "Session file not found: .ad-sdlc/scratchpad/pipeline/${RESUME_SESSION}.yaml"
        echo "Use --list-sessions to see available sessions." >&2
        exit 1
    fi
fi

# =============================================================================
# Confirmation
# =============================================================================

confirm_execution() {
    if [[ "$SKIP_CONFIRMATION" == "true" ]] || [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
        return 0
    fi

    echo -e "${YELLOW}This will run the full AD-SDLC pipeline which may:${NC}"
    echo "  - Create/modify files in the project"
    echo "  - Create GitHub issues and PRs"
    echo "  - Run build and test commands"
    echo ""
    read -p "Continue? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
}

# =============================================================================
# Footer
# =============================================================================

_print_footer() {
    local exit_code=$?
    local end_time
    end_time=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  Pipeline Complete"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $end_time"
        echo ""
        echo "Summary:"
        echo "  - Documents: Check docs/ folder"
        echo "  - Issues: gh issue list"
        echo "  - PRs: gh pr list"
        echo "  - Logs: .ad-sdlc/logs/"
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Pipeline Failed"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${RED}Exit Code:${NC} $exit_code"
        echo -e "  ${RED}Finished:${NC} $end_time"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check logs: .ad-sdlc/logs/pipeline.log"
        echo "  2. Review partial progress in .ad-sdlc/scratchpad/"
        echo "  3. Resume with: $0 . auto --resume"
        echo ""
    fi
}

# =============================================================================
# Prompt Building
# =============================================================================

# Build the Claude prompt based on mode and options
build_prompt() {
    local prompt=""

    if [[ "$RESUME_MODE" == "true" ]]; then
        # Resume mode prompt
        prompt="Resume the AD-SDLC pipeline from session $RESUME_SESSION.
Load prior state from .ad-sdlc/scratchpad/pipeline/$RESUME_SESSION.yaml.
Continue from the next incomplete stage. Do NOT re-execute completed stages.

Guidelines:
- Follow existing code style and patterns
- Write clean, well-documented code
- Include appropriate tests
- Track progress in .ad-sdlc/scratchpad/progress/
- Log activities to .ad-sdlc/logs/pipeline.log

Run fully automated without confirmation prompts."

    elif [[ -n "$START_FROM" ]]; then
        # Start-from mode prompt
        local skipped_stages
        skipped_stages="$(compute_skipped_stages "$START_FROM" "$MODE")"

        prompt="Execute the AD-SDLC pipeline in $MODE mode starting from stage: $START_FROM.
Assume all prior stages are complete and their artifacts exist.
Validate artifacts before proceeding. Skip stages: $skipped_stages

Pipeline Steps (starting from $START_FROM):
1. Validate that artifacts from prior stages exist
2. Continue pipeline execution from $START_FROM
3. Execute remaining stages in order
4. Create and review PRs

Guidelines:
- Follow existing code style and patterns
- Write clean, well-documented code
- Include appropriate tests
- Track progress in .ad-sdlc/scratchpad/progress/
- Log activities to .ad-sdlc/logs/pipeline.log

Run fully automated without confirmation prompts."

    else
        # Standard mode prompt (unchanged)
        prompt="Execute the AD-SDLC pipeline in $MODE mode.

Pipeline Steps:
1. [Detection] Detect project mode (Greenfield/Enhancement/Import) if mode is 'auto'
2. [Documents] If documents exist, analyze them; otherwise collect requirements and generate PRD, SRS, SDS
3. [Issues] Generate GitHub issues from SDS with priorities and dependencies
4. [Implementation] Implement issues in dependency order (P0 first, then P1, etc.)
5. [Review] Create and review PRs

Guidelines:
- Follow existing code style and patterns
- Write clean, well-documented code
- Include appropriate tests
- Track progress in .ad-sdlc/scratchpad/progress/
- Log activities to .ad-sdlc/logs/pipeline.log

Run fully automated without confirmation prompts."
    fi

    echo "$prompt"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    check_environment

    local extra_lines=()
    extra_lines+=("${GREEN}Mode:${NC}     $MODE")
    if [[ -n "$START_FROM" ]]; then
        extra_lines+=("${GREEN}Start:${NC}    from stage '$START_FROM'")
    fi
    if [[ "$RESUME_MODE" == "true" ]]; then
        extra_lines+=("${GREEN}Resume:${NC}   session '${RESUME_SESSION:0:20}...'")
    fi
    if [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
        extra_lines+=("${RED}WARNING: Running with --dangerously-skip-permissions${NC}")
    fi

    print_header_box "AD-SDLC Full Pipeline" "$PROJECT_PATH" "${extra_lines[@]}"
    confirm_execution
    trap _print_footer EXIT

    cd "$PROJECT_PATH"

    # Build claude command
    local claude_args=()
    claude_args+=("-p")

    local prompt
    prompt="$(build_prompt)"

    claude_args+=("$prompt")
    claude_args+=("--allowedTools" "Read,Write,Edit,Glob,Grep,Bash,Task,WebFetch")
    claude_args+=("--output-format" "text")

    if [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
        claude_args+=("--dangerously-skip-permissions")
    fi

    echo -e "${YELLOW}Starting pipeline...${NC}"
    echo ""

    # Execute claude with built arguments
    claude "${claude_args[@]}"
}

main
