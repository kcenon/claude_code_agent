#!/usr/bin/env bash
#
# AD-SDLC Project Initialization Script
# This script creates the complete directory structure for an AD-SDLC project.
#
# Usage: ./scripts/init-project.sh [target_path] [project_id]
#
# Arguments:
#   target_path   Path to target project (default: current directory)
#   project_id    Project identifier (default: 001)
#
# Example:
#   ./scripts/init-project.sh                     # Current dir, ID 001
#   ./scripts/init-project.sh /path/to/project    # Specific path, ID 001
#   ./scripts/init-project.sh . my-project        # Current dir, ID my-project
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
TARGET_PATH="${1:-.}"
PROJECT_ID="${2:-001}"

# Resolve absolute path for project root
PROJECT_ROOT="$(cd "$TARGET_PATH" 2>/dev/null && pwd)" || {
    echo -e "${RED}Error: Directory does not exist: $TARGET_PATH${NC}" >&2
    exit 1
}

echo -e "${GREEN}AD-SDLC Project Initialization${NC}"
echo "================================"
echo "Project Root: $PROJECT_ROOT"
echo "Project ID: $PROJECT_ID"
echo ""

# Function to create directory with message
create_dir() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        echo -e "  ${GREEN}✓${NC} Created: $dir"
    else
        echo -e "  ${YELLOW}○${NC} Exists:  $dir"
    fi
}

# Function to create placeholder file
create_placeholder() {
    local file="$1"
    local content="${2:-# Placeholder file}"
    if [[ ! -f "$file" ]]; then
        echo "$content" > "$file"
        echo -e "  ${GREEN}✓${NC} Created: $file"
    else
        echo -e "  ${YELLOW}○${NC} Exists:  $file"
    fi
}

echo "Creating directory structure..."
echo ""

# .claude directory
echo "📁 .claude/"
create_dir "$PROJECT_ROOT/.claude/agents"

# .ad-sdlc directory
echo "📁 .ad-sdlc/"
create_dir "$PROJECT_ROOT/.ad-sdlc/config"
create_dir "$PROJECT_ROOT/.ad-sdlc/logs/agent-logs"
create_dir "$PROJECT_ROOT/.ad-sdlc/templates"

# Scratchpad directories
echo "📁 .ad-sdlc/scratchpad/"
create_dir "$PROJECT_ROOT/.ad-sdlc/scratchpad/info/$PROJECT_ID"
create_dir "$PROJECT_ROOT/.ad-sdlc/scratchpad/documents/$PROJECT_ID"
create_dir "$PROJECT_ROOT/.ad-sdlc/scratchpad/issues/$PROJECT_ID"
create_dir "$PROJECT_ROOT/.ad-sdlc/scratchpad/progress/$PROJECT_ID/work_orders"
create_dir "$PROJECT_ROOT/.ad-sdlc/scratchpad/progress/$PROJECT_ID/results"
create_dir "$PROJECT_ROOT/.ad-sdlc/scratchpad/progress/$PROJECT_ID/reviews"

# docs directory
echo "📁 docs/"
create_dir "$PROJECT_ROOT/docs/prd"
create_dir "$PROJECT_ROOT/docs/srs"
create_dir "$PROJECT_ROOT/docs/sds"
create_dir "$PROJECT_ROOT/docs/guides"
create_dir "$PROJECT_ROOT/docs/reference"

# src directory
echo "📁 src/"
create_dir "$PROJECT_ROOT/src"

# scripts directory
echo "📁 scripts/"
create_dir "$PROJECT_ROOT/scripts"

echo ""
echo "Creating placeholder files..."
echo ""

# Create .gitkeep files for empty directories
create_placeholder "$PROJECT_ROOT/.ad-sdlc/logs/.gitkeep" "# Log files will be created here"
create_placeholder "$PROJECT_ROOT/.ad-sdlc/logs/agent-logs/.gitkeep" "# Agent log files will be created here"
create_placeholder "$PROJECT_ROOT/.ad-sdlc/scratchpad/info/$PROJECT_ID/.gitkeep" "# Collected information files"
create_placeholder "$PROJECT_ROOT/.ad-sdlc/scratchpad/documents/$PROJECT_ID/.gitkeep" "# Generated documents"
create_placeholder "$PROJECT_ROOT/.ad-sdlc/scratchpad/issues/$PROJECT_ID/.gitkeep" "# Issue tracking files"
create_placeholder "$PROJECT_ROOT/.ad-sdlc/scratchpad/progress/$PROJECT_ID/.gitkeep" "# Progress tracking files"
create_placeholder "$PROJECT_ROOT/src/.gitkeep" "# Generated source code"

echo ""
echo -e "${GREEN}Initialization complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review .ad-sdlc/config/workflow.yaml for pipeline settings"
echo "  2. Review .ad-sdlc/config/agents.yaml for agent configuration"
echo "  3. Start with: claude \"Collect requirements for [your project]\""
echo ""
echo "Directory structure created for project: $PROJECT_ID"
