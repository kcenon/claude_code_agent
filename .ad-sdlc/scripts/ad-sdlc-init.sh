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
    echo -e "  AD-SDLC Project Initialization"
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
        echo -e "  Initialization Complete"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        echo "Next steps:"
        echo "  1. Review .ad-sdlc/config/workflow.yaml"
        echo "  2. Review .ad-sdlc/config/agents.yaml"
        echo "  3. Run: ./ad-sdlc-analyze-docs.sh or ./ad-sdlc-generate-issues.sh"
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Initialization Failed (exit code: $exit_code)"
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
