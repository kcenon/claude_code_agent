#!/usr/bin/env bash
#
# AD-SDLC Full Pipeline Script
# Runs the complete AD-SDLC pipeline in non-interactive mode.
#
# Usage: ./ad-sdlc-full-pipeline.sh [project_path] [mode]
#
# Arguments:
#   project_path  Path to the project directory (default: current directory)
#   mode          Pipeline mode: auto, greenfield, enhancement, import (default: auto)
#
# Modes:
#   auto        - Automatically detect project state and choose mode
#   greenfield  - New project: collect requirements, generate all docs, implement
#   enhancement - Existing project: analyze code, identify improvements, implement
#   import      - Import mode: analyze existing docs, generate issues, implement
#
# Example:
#   ./ad-sdlc-full-pipeline.sh
#   ./ad-sdlc-full-pipeline.sh . auto
#   ./ad-sdlc-full-pipeline.sh /path/to/project greenfield
#   ./ad-sdlc-full-pipeline.sh . enhancement
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

# Default values
PROJECT_PATH="${1:-.}"
MODE="${2:-auto}"
SKIP_CONFIRMATION="${SKIP_CONFIRMATION:-false}"
DANGEROUSLY_SKIP_PERMISSIONS="${DANGEROUSLY_SKIP_PERMISSIONS:-false}"

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

# Resolve absolute path
PROJECT_PATH="$(resolve_path "$PROJECT_PATH")" || exit 1

# Confirmation prompt
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

# Footer trap function
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
        echo "  3. Resume with: claude --continue"
        echo ""
    fi
}

# Main execution
main() {
    check_environment

    local extra_lines=()
    extra_lines+=("${GREEN}Mode:${NC}     $MODE")
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

    # Build the prompt based on mode
    local prompt="Execute the AD-SDLC pipeline in $MODE mode.

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

main "$@"
