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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_PATH="${1:-.}"
ISSUE_NUMBER="${2:-}"
SKIP_TESTS="${SKIP_TESTS:-false}"

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

# Print header
print_header() {
    echo ""
    echo -e "${BLUE}======================================"
    echo -e "  AD-SDLC Implementation"
    echo -e "======================================${NC}"
    echo ""
    echo -e "  ${GREEN}Project:${NC} $PROJECT_PATH"
    if [[ -n "$ISSUE_NUMBER" ]]; then
        echo -e "  ${GREEN}Issue:${NC} #$ISSUE_NUMBER"
    else
        echo -e "  ${GREEN}Mode:${NC} All pending issues (P0 first)"
    fi
    echo -e "  ${GREEN}Skip Tests:${NC} $SKIP_TESTS"
    echo -e "  ${GREEN}Started:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Print footer
print_footer() {
    local exit_code=$?
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  Implementation Complete"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "Next steps:"
        echo "  1. Review changes: git diff"
        echo "  2. Run tests: npm test (or your test command)"
        echo "  3. Create PR: gh pr create"
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Implementation Failed (exit code: $exit_code)"
        echo -e "======================================${NC}"
        echo ""
        echo "Check the output above for error details."
        echo "You may need to:"
        echo "  1. Review partial changes: git diff"
        echo "  2. Fix issues manually"
        echo "  3. Re-run the script"
        echo ""
    fi
}

# Main execution
main() {
    check_environment
    print_header
    trap print_footer EXIT

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
