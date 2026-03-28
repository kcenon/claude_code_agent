#!/usr/bin/env bash
# Setup git worktrees for Tier B (SRS-5.4.2)
set -euo pipefail

REPO_DIR="${1:?Usage: setup-worktrees.sh <repo-dir> [branch-a] [branch-b]}"
BRANCH_A="${2:-worktree-a}"
BRANCH_B="${3:-worktree-b}"
WORKTREE_A="${REPO_DIR%/}-a"
WORKTREE_B="${REPO_DIR%/}-b"

# Validate
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Error: $REPO_DIR is not a git repository" >&2
    exit 1
fi

# Create branches if they don't exist (based on current HEAD)
cd "$REPO_DIR"
git branch "$BRANCH_A" 2>/dev/null || true
git branch "$BRANCH_B" 2>/dev/null || true

# Create worktrees
git worktree add "$WORKTREE_A" "$BRANCH_A"
git worktree add "$WORKTREE_B" "$BRANCH_B"

echo "Worktrees created:"
echo "  A: $WORKTREE_A (branch: $BRANCH_A)"
echo "  B: $WORKTREE_B (branch: $BRANCH_B)"
echo ""
echo "Add to .env:"
echo "  PROJECT_DIR_A=$WORKTREE_A"
echo "  PROJECT_DIR_B=$WORKTREE_B"
