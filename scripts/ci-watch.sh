#!/usr/bin/env bash
#
# ci-watch.sh — push 후 CI 결과를 즉시 진단하는 헬퍼
#
# Usage:
#   ./scripts/ci-watch.sh <branch>
#   ./scripts/ci-watch.sh fix/doc-code-comparator-frontmatter
#
# Behavior:
#   1. 해당 브랜치의 최근 워크플로 실행 ID를 찾음
#   2. status가 in_progress/queued면 30초 간격 폴링 (최대 10분)
#   3. completed가 되면 conclusion 출력
#   4. failed/cancelled면 실패 잡의 로그 발췌 자동 출력
#
# Requirements: gh CLI authenticated, jq

set -euo pipefail

REPO="${REPO:-kcenon/claude_code_agent}"
BRANCH="${1:?Usage: $0 <branch>}"
MAX_POLLS=20      # 30s * 20 = 10 minutes (per CLAUDE.md ci-resilience.md)
POLL_INTERVAL=30

echo "Repo:   $REPO"
echo "Branch: $BRANCH"
echo

# 1) Find latest run for this branch
run_id=$(gh run list --repo "$REPO" --branch "$BRANCH" --limit 1 \
  --json databaseId -q '.[0].databaseId' 2>/dev/null || true)

if [ -z "$run_id" ] || [ "$run_id" = "null" ]; then
  echo "No workflow runs found for branch '$BRANCH'."
  echo "Make sure the branch is pushed and CI is configured for the path."
  exit 1
fi
echo "Latest run: $run_id"

# 2) Poll
for i in $(seq 1 "$MAX_POLLS"); do
  read -r status conclusion < <(gh run view "$run_id" --repo "$REPO" \
    --json status,conclusion -q '"\(.status) \(.conclusion // "null")"')

  ts=$(date -u +%H:%M:%SZ)
  echo "[$ts] poll $i/$MAX_POLLS — status=$status conclusion=$conclusion"

  case "$status" in
    completed)
      echo
      echo "===================================================="
      echo "Run $run_id completed: $conclusion"
      echo "===================================================="
      if [ "$conclusion" = "success" ]; then
        echo "All checks green. Ready to merge."
        exit 0
      fi
      # 3) Failure — fetch failed job logs
      echo
      echo "Failed jobs:"
      gh run view "$run_id" --repo "$REPO" --json jobs \
        -q '.jobs[] | select(.conclusion!="success") | "  - \(.name): \(.conclusion)"'
      echo
      echo "Failed step logs (head):"
      gh run view "$run_id" --repo "$REPO" --log-failed 2>/dev/null | head -200
      exit 1
      ;;
    queued|in_progress|waiting|requested|pending)
      sleep "$POLL_INTERVAL"
      ;;
    *)
      echo "Unknown status: $status"
      exit 2
      ;;
  esac
done

echo
echo "Timeout ($((MAX_POLLS*POLL_INTERVAL))s) reached without completion."
echo "Re-run this script to continue polling, or check manually:"
echo "  gh run view $run_id --repo $REPO --web"
exit 3
