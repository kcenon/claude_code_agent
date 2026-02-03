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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
PROJECT_PATH="$(cd "$PROJECT_PATH" 2>/dev/null && pwd)" || {
    echo -e "${RED}Error: Directory does not exist: $PROJECT_PATH${NC}" >&2
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

    if [[ "$DRY_RUN" == "false" ]] && ! command -v gh &>/dev/null; then
        echo -e "${YELLOW}Warning: 'gh' CLI is not installed${NC}" >&2
        echo "Issues will be saved locally but not created on GitHub." >&2
        echo "Install with: brew install gh" >&2
    fi
}

# Print header
print_header() {
    echo ""
    echo -e "${BLUE}======================================"
    echo -e "  AD-SDLC Issue Generation"
    echo -e "======================================${NC}"
    echo ""
    echo -e "  ${GREEN}Project:${NC} $PROJECT_PATH"
    echo -e "  ${GREEN}Mode:${NC} $(if [[ "$DRY_RUN" == "true" ]]; then echo "Dry Run (preview only)"; else echo "Live (creating issues)"; fi)"
    echo -e "  ${GREEN}Started:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Print footer
print_footer() {
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
    check_environment
    print_header
    trap print_footer EXIT

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
