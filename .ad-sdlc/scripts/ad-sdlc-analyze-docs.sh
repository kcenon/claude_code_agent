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

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Default values
PROJECT_PATH="${1:-.}"

# Resolve absolute path
PROJECT_PATH="$(resolve_path "$PROJECT_PATH")" || exit 1

# Footer trap function
_print_footer() {
    print_footer_with_files "Document Analysis Complete" \
        ".ad-sdlc/scratchpad/documents/current_state.yaml" \
        -- \
        "1. Review the analysis summary" \
        "2. Run: ./ad-sdlc-generate-issues.sh"
}

# Main execution
main() {
    check_environment
    print_header "AD-SDLC Document Analysis" "$PROJECT_PATH"
    trap _print_footer EXIT

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
