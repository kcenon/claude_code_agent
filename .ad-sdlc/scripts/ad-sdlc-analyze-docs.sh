#!/usr/bin/env bash
#
# AD-SDLC Document Analysis Script
# Analyzes existing PRD/SRS/SDS documents and generates a summary in non-interactive mode.
#
# Usage: ./ad-sdlc-analyze-docs.sh [project_path]
#
# Arguments:
#   project_path  Path to the project directory (default: current directory)
#
# Example:
#   ./ad-sdlc-analyze-docs.sh
#   ./ad-sdlc-analyze-docs.sh /path/to/my-project
#
# Environment:
#   ANTHROPIC_API_KEY  Required. Your Anthropic API key.
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
    echo -e "  AD-SDLC Document Analysis"
    echo -e "======================================${NC}"
    echo ""
    echo -e "  ${GREEN}Project:${NC} $PROJECT_PATH"
    echo -e "  ${GREEN}Started:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Print footer
print_footer() {
    local exit_code=$?
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  Document Analysis Complete"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "Generated files:"
        echo "  - .ad-sdlc/scratchpad/documents/current_state.yaml"
        echo ""
        echo "Next steps:"
        echo "  1. Review the analysis summary"
        echo "  2. Run: ./ad-sdlc-generate-issues.sh"
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Document Analysis Failed (exit code: $exit_code)"
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

    echo -e "${YELLOW}Analyzing documents...${NC}"
    echo ""

    claude -p "Analyze the existing PRD, SRS, and SDS documents in this project. Look for documents in the following locations:
- docs/ folder
- docs/prd/, docs/srs/, docs/sds/ folders
- Any files matching PRD-*.md, SRS-*.md, SDS-*.md patterns

Generate a comprehensive summary in .ad-sdlc/scratchpad/documents/current_state.yaml that includes:
1. Document inventory (list of found documents with paths)
2. Document status (draft/review/approved)
3. Key requirements extracted from PRD
4. Functional specifications from SRS
5. Technical components from SDS
6. Cross-references between documents
7. Gaps or missing sections

If no documents are found, report that and suggest next steps." \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash(ls:*),Bash(find:*)" \
        --output-format text
}

main "$@"
