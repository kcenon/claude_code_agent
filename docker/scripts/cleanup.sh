#!/usr/bin/env bash
# Cleanup containers, worktrees, and state (SRS-5.5, FR-17)
set -euo pipefail

echo "=== Stopping containers ==="
docker compose down --remove-orphans 2>/dev/null || true

echo "=== Removing named volumes ==="
docker compose down -v 2>/dev/null || true

echo "=== Removing worktrees (if Tier B) ==="
REPO_DIR="${1:-}"
if [ -n "$REPO_DIR" ] && [ -d "$REPO_DIR/.git" ]; then
    cd "$REPO_DIR"
    for wt in $(git worktree list --porcelain | grep "^worktree " | awk '{print $2}'); do
        if [ "$wt" != "$(pwd)" ]; then
            echo "  Removing worktree: $wt"
            git worktree remove "$wt" --force 2>/dev/null || true
        fi
    done
fi

echo "=== Removing state directories ==="
read -p "Remove ~/.claude-state/*? (y/N) " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    rm -rf "${HOME}/.claude-state"
    echo "  State directories removed."
else
    echo "  Skipped."
fi

echo "=== Cleanup complete ==="
