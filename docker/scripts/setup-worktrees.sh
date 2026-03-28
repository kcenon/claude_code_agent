#!/usr/bin/env bash
# Setup git worktrees for Tier B (SRS-5.4.2)
set -euo pipefail

REPO_DIR="${1:?Usage: setup-worktrees.sh <repo-dir> [count]}"
N=${2:-2}

# Validate
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "Error: $REPO_DIR is not a git repository" >&2
    exit 1
fi

cd "$REPO_DIR"

for i in $(seq 1 "$N"); do
    letter=$(printf "\\$(printf '%03o' $((96 + i)))")
    branch="worktree-${letter}"
    worktree="${REPO_DIR%/}-${letter}"
    git branch "$branch" 2>/dev/null || true
    git worktree add "$worktree" "$branch" 2>/dev/null || true
    echo "Created worktree: $worktree (branch: $branch)"
done

echo ""
echo "Add to .env:"
for i in $(seq 1 "$N"); do
    letter=$(printf "\\$(printf '%03o' $((96 + i)))")
    upper_letter=$(echo "$letter" | tr '[:lower:]' '[:upper:]')
    echo "  PROJECT_DIR_${upper_letter}=${REPO_DIR%/}-${letter}"
done
