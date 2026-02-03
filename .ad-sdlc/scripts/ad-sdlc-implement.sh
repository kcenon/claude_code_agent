#!/usr/bin/env bash
#
# AD-SDLC Implementation Script
# Implements a specific issue or all pending issues in non-interactive mode.
#
# Usage: ./ad-sdlc-implement.sh [project_path] [issue_number]
#
# Arguments:
#   project_path    Path to the project directory (default: current directory)
#   issue_number    Specific issue number to implement (optional)
#                   If not provided, implements all pending P0 issues first
#
# Example:
#   ./ad-sdlc-implement.sh                    # Implement all pending issues
#   ./ad-sdlc-implement.sh .                  # Same as above
#   ./ad-sdlc-implement.sh . 42               # Implement issue #42
#   ./ad-sdlc-implement.sh /path/to/project 5 # Implement issue #5 in project
#
# Environment:
#   ANTHROPIC_API_KEY  Required. Your Anthropic API key.
#   SKIP_TESTS         Optional. Skip running tests (default: false)
#

set -euo pipefail

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Default values
PROJECT_PATH="${1:-.}"
ISSUE_NUMBER="${2:-}"
SKIP_TESTS="${SKIP_TESTS:-false}"

# Resolve absolute path
PROJECT_PATH="$(resolve_path "$PROJECT_PATH")" || exit 1

# Footer trap function
_print_footer() {
    print_footer_with_recovery "Implementation Complete" \
        "1. Review partial changes: git diff" \
        "2. Fix issues manually" \
        "3. Re-run the script"
}

# Main execution
main() {
    check_environment

    local extra_lines=()
    if [[ -n "$ISSUE_NUMBER" ]]; then
        extra_lines+=("${GREEN}Issue:${NC} #$ISSUE_NUMBER")
    else
        extra_lines+=("${GREEN}Mode:${NC} All pending issues (P0 first)")
    fi
    extra_lines+=("${GREEN}Skip Tests:${NC} $SKIP_TESTS")

    print_header "AD-SDLC Implementation" "$PROJECT_PATH" "${extra_lines[@]}"
    trap _print_footer EXIT

    cd "$PROJECT_PATH"

    local prompt
    local test_instruction=""

    if [[ "$SKIP_TESTS" != "true" ]]; then
        test_instruction="Run relevant tests after implementation to verify correctness."
    fi

    if [[ -z "$ISSUE_NUMBER" ]]; then
        echo -e "${YELLOW}Implementing all pending issues...${NC}"
        echo ""
        prompt="Implement all pending GitHub issues based on the SDS document.

Priority order:
1. Start with P0 (critical) issues first
2. Then P1 (high priority) issues
3. Respect dependency order - implement dependencies before dependents

For each issue:
1. Read the issue details from GitHub or .ad-sdlc/scratchpad/issues/
2. Follow the technical specifications in the SDS document
3. Write clean, well-documented code
4. Follow existing code style and patterns in the project
5. Update the issue status when complete

$test_instruction

Track progress in .ad-sdlc/scratchpad/progress/"
    else
        echo -e "${YELLOW}Implementing issue #$ISSUE_NUMBER...${NC}"
        echo ""
        prompt="Implement GitHub issue #$ISSUE_NUMBER according to the specifications in the SDS document.

Steps:
1. Read the issue details: gh issue view $ISSUE_NUMBER
2. Review relevant SDS sections for technical specifications
3. Implement the feature/fix following existing code patterns
4. Write clean, well-documented code
5. Add appropriate error handling

$test_instruction

Update .ad-sdlc/scratchpad/progress/ with implementation details."
    fi

    claude -p "$prompt" \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task" \
        --output-format text
}

main "$@"
