#!/usr/bin/env bash
#
# AD-SDLC Project Initialization Script
# Initializes AD-SDLC configuration for a project in non-interactive (headless) mode.
#
# Usage: ./ad-sdlc-init.sh [project_path]
#
# Arguments:
#   project_path  Path to the project directory (default: current directory)
#
# Example:
#   ./ad-sdlc-init.sh
#   ./ad-sdlc-init.sh /path/to/my-project
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
    print_footer_with_files "Initialization Complete" \
        ".ad-sdlc/config/workflow.yaml" \
        ".ad-sdlc/config/agents.yaml" \
        -- \
        "1. Review .ad-sdlc/config/workflow.yaml" \
        "2. Review .ad-sdlc/config/agents.yaml" \
        "3. Run: ./ad-sdlc-analyze-docs.sh or ./ad-sdlc-generate-issues.sh"
}

# Main execution
main() {
    check_environment
    print_header "AD-SDLC Project Initialization" "$PROJECT_PATH"
    trap _print_footer EXIT

    cd "$PROJECT_PATH"

    echo -e "${YELLOW}Initializing AD-SDLC...${NC}"
    echo ""

    claude -p "Initialize AD-SDLC for this project. Create .ad-sdlc directory structure and copy necessary configuration files from the templates. Ensure the following are created:
1. .ad-sdlc/config/ directory with workflow.yaml and agents.yaml
2. .ad-sdlc/templates/ directory with document templates
3. .ad-sdlc/scratchpad/ directory structure
4. .claude/agents/ directory with agent definitions

Use the standard AD-SDLC structure and best practices." \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash(mkdir:*),Bash(cp:*),Bash(ln:*),Bash(ls:*),Bash(chmod:*)" \
        --output-format text
}

main "$@"
