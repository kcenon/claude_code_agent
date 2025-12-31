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
#   MAX_TURNS                      Optional. Maximum agent turns (default: 100)
#   SKIP_CONFIRMATION              Optional. Skip confirmation prompts (default: false)
#   DANGEROUSLY_SKIP_PERMISSIONS   Optional. Skip all permission prompts (default: false)
#
# WARNING: Using DANGEROUSLY_SKIP_PERMISSIONS bypasses all safety checks.
#          Only use in trusted, isolated environments.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default values
PROJECT_PATH="${1:-.}"
MODE="${2:-auto}"
MAX_TURNS="${MAX_TURNS:-100}"
SKIP_CONFIRMATION="${SKIP_CONFIRMATION:-false}"
DANGEROUSLY_SKIP_PERMISSIONS="${DANGEROUSLY_SKIP_PERMISSIONS:-false}"

# Validate mode
case "$MODE" in
    auto|greenfield|enhancement|import)
        ;;
    *)
        echo -e "${RED}Error: Invalid mode '$MODE'${NC}" >&2
        echo "Valid modes: auto, greenfield, enhancement, import" >&2
        exit 1
        ;;
esac

# Resolve absolute path
PROJECT_PATH="$(cd "$PROJECT_PATH" 2>/dev/null && pwd)" || {
    echo -e "${RED}Error: Directory does not exist: $1${NC}" >&2
    exit 1
}

# Check for required environment
check_environment() {
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
        echo -e "${RED}Error: ANTHROPIC_API_KEY environment variable is not set${NC}" >&2
        echo "Please set your API key: export ANTHROPIC_API_KEY=\"your-key\"" >&2
        exit 1
    fi

    if ! command -v claude &>/dev/null; then
        echo -e "${RED}Error: 'claude' CLI is not installed${NC}" >&2
        echo "Please install: npm install -g @anthropic-ai/claude-code" >&2
        exit 1
    fi
}

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

# Print header
print_header() {
    echo ""
    echo -e "${MAGENTA}╔══════════════════════════════════════╗"
    echo -e "║     AD-SDLC Full Pipeline            ║"
    echo -e "╚══════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${GREEN}Project:${NC}  $PROJECT_PATH"
    echo -e "  ${GREEN}Mode:${NC}     $MODE"
    echo -e "  ${GREEN}Turns:${NC}    $MAX_TURNS"
    echo -e "  ${GREEN}Started:${NC}  $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    if [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
        echo -e "  ${RED}WARNING: Running with --dangerously-skip-permissions${NC}"
        echo ""
    fi
}

# Print footer
print_footer() {
    local exit_code=$?
    local end_time
    end_time=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}╔══════════════════════════════════════╗"
        echo -e "║     Pipeline Complete                ║"
        echo -e "╚══════════════════════════════════════╝${NC}"
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
        echo -e "${RED}╔══════════════════════════════════════╗"
        echo -e "║     Pipeline Failed                  ║"
        echo -e "╚══════════════════════════════════════╝${NC}"
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
    print_header
    confirm_execution
    trap print_footer EXIT

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
    claude_args+=("--allowedTools" "Read,Write,Edit,Glob,Grep,Bash,Task,LSP,WebFetch")
    claude_args+=("--output-format" "text")
    claude_args+=("--max-turns" "$MAX_TURNS")

    if [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
        claude_args+=("--dangerously-skip-permissions")
    fi

    echo -e "${YELLOW}Starting pipeline...${NC}"
    echo ""

    # Execute claude with built arguments
    claude "${claude_args[@]}"
}

main "$@"
