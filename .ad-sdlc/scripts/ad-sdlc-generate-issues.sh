#!/usr/bin/env bash
#
# AD-SDLC Issue Generation Script
# Generates GitHub issues from SDS document in non-interactive mode.
#
# Usage: ./ad-sdlc-generate-issues.sh [project_path] [--dry-run]
#
# Arguments:
#   project_path  Path to the project directory (default: current directory)
#   --dry-run     Preview issues without creating them on GitHub
#
# Example:
#   ./ad-sdlc-generate-issues.sh
#   ./ad-sdlc-generate-issues.sh /path/to/my-project
#   ./ad-sdlc-generate-issues.sh . --dry-run
#
# Environment:
#   ANTHROPIC_API_KEY  Required. Your Anthropic API key.
#   GH_TOKEN           Optional. GitHub token (falls back to gh auth)
#

set -euo pipefail

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Default values
PROJECT_PATH="."
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            PROJECT_PATH="$1"
            shift
            ;;
    esac
done

# Resolve absolute path
PROJECT_PATH="$(resolve_path "$PROJECT_PATH")" || exit 1

# Extended environment check for this script
_check_environment() {
    check_environment

    if [[ "$DRY_RUN" == "false" ]] && ! command -v gh &>/dev/null; then
        log_warn "'gh' CLI is not installed"
        echo "Issues will be saved locally but not created on GitHub." >&2
        echo "Install with: brew install gh" >&2
    fi
}

# Footer trap function
_print_footer() {
    local exit_code=$?
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  Issue Generation Complete"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "Generated files:"
        echo "  - .ad-sdlc/scratchpad/issues/generated_issues.yaml"
        echo ""
        if [[ "$DRY_RUN" == "true" ]]; then
            echo "This was a dry run. To create issues on GitHub, run without --dry-run"
        else
            echo "Next steps:"
            echo "  1. Review created issues: gh issue list"
            echo "  2. Run: ./ad-sdlc-implement.sh"
        fi
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Issue Generation Failed (exit code: $exit_code)"
        echo -e "======================================${NC}"
        echo ""
        echo "Check the output above for error details."
        echo ""
    fi
}

# Main execution
main() {
    _check_environment

    local mode_text
    if [[ "$DRY_RUN" == "true" ]]; then
        mode_text="Dry Run (preview only)"
    else
        mode_text="Live (creating issues)"
    fi

    print_header "AD-SDLC Issue Generation" "$PROJECT_PATH" \
        "${GREEN}Mode:${NC} $mode_text"
    trap _print_footer EXIT

    cd "$PROJECT_PATH"

    echo -e "${YELLOW}Generating issues from SDS...${NC}"
    echo ""

    local prompt
    if [[ "$DRY_RUN" == "true" ]]; then
        prompt="Analyze the SDS document and generate GitHub issues for each component/module.
DO NOT create actual GitHub issues - this is a dry run.

Instead, save the issue specifications to .ad-sdlc/scratchpad/issues/generated_issues.yaml with the following format:
- title: Issue title
  body: Issue description
  labels: [label1, label2]
  priority: P0/P1/P2
  effort: S/M/L/XL
  dependencies: [issue_ids]

Include:
1. Clear issue titles following conventional commits format
2. Detailed descriptions with acceptance criteria
3. Priority labels (P0-critical, P1-high, P2-medium, P3-low)
4. Effort estimates (S=<4h, M=4-8h, L=1-2d, XL=>2d)
5. Dependencies between issues"
    else
        prompt="Analyze the SDS document and generate GitHub issues for each component/module.

For each issue:
1. Create a clear title following conventional commits format (e.g., 'feat(auth): implement user registration')
2. Write detailed descriptions with acceptance criteria
3. Add priority labels (P0-critical, P1-high, P2-medium, P3-low)
4. Add effort labels (effort-S, effort-M, effort-L, effort-XL)
5. Track dependencies between issues

Use 'gh issue create' to create issues on GitHub.
Also save the issue list to .ad-sdlc/scratchpad/issues/generated_issues.yaml for reference."
    fi

    claude -p "$prompt" \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash(gh:*),Bash(ls:*),Bash(find:*)" \
        --output-format text
}

main "$@"
