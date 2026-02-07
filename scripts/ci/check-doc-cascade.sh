#!/usr/bin/env bash
#
# check-doc-cascade.sh - Detect missing cascade updates in document PRs
#
# Analyzes changed files in a PR to identify related documents that should
# also be updated. Warns when the PRD -> SRS -> SDS hierarchy, EN/KR pairs,
# or primary/mirror copies are out of sync.
#
# Usage:
#   ./scripts/ci/check-doc-cascade.sh [--base <ref>] [--json] [--config <path>]
#
# Options:
#   --base <ref>       Base ref for diff (default: origin/main)
#   --json             Output structured JSON to stdout (errors to stderr)
#   --config <path>    Path to doc-sync-points.yaml (default: ./doc-sync-points.yaml)
#   -h, --help         Show usage help
#
# Exit codes:
#   0  No cascade warnings (or warnings only, no errors)
#   1  Missing cascade updates detected

set -euo pipefail

# Defaults
BASE_REF="origin/main"
JSON_MODE=false
CONFIG_FILE="./doc-sync-points.yaml"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --base) BASE_REF="$2"; shift 2 ;;
        --json) JSON_MODE=true; shift ;;
        --config) CONFIG_FILE="$2"; shift 2 ;;
        -h|--help)
            sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Colors (disabled in JSON mode or non-interactive)
if [[ -t 2 ]] && [[ "$JSON_MODE" == "false" ]]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    BLUE='\033[0;34m'; NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

# Logging helpers (always to stderr)
log_info()  { [[ "$JSON_MODE" == "false" ]] && echo -e "${BLUE}[INFO]${NC}  $1" >&2 || true; }
log_pass()  { [[ "$JSON_MODE" == "false" ]] && echo -e "${GREEN}[PASS]${NC}  $1" >&2 || true; }
log_warn()  { [[ "$JSON_MODE" == "false" ]] && echo -e "${YELLOW}[WARN]${NC}  $1" >&2 || true; }
log_error() { [[ "$JSON_MODE" == "false" ]] && echo -e "${RED}[FAIL]${NC}  $1" >&2 || true; }

# --- Get changed files ---
CHANGED_FILES=$(git diff --name-only "$BASE_REF"...HEAD 2>/dev/null || git diff --name-only "$BASE_REF" HEAD 2>/dev/null || echo "")

if [[ -z "$CHANGED_FILES" ]]; then
    log_info "No changed files detected"
    if [[ "$JSON_MODE" == "true" ]]; then
        echo '{"pass":true,"warnings":[],"errors":[],"changed_docs":[],"missing_updates":[]}'
    fi
    exit 0
fi

log_info "Analyzing changed files against $BASE_REF"

# --- Document file mappings ---
# Primary EN documents
declare -A DOC_FILES
DOC_FILES=(
    ["PRD"]="docs/PRD-001-agent-driven-sdlc.md"
    ["SRS"]="docs/SRS-001-agent-driven-sdlc.md"
    ["SDS"]="docs/SDS-001-agent-driven-sdlc.md"
)

# Korean counterparts
declare -A KR_FILES
KR_FILES=(
    ["PRD"]="docs/PRD-001-agent-driven-sdlc.kr.md"
    ["SRS"]="docs/SRS-001-agent-driven-sdlc.kr.md"
    ["SDS"]="docs/SDS-001-agent-driven-sdlc.kr.md"
)

# API media mirrors (EN)
declare -A MIRROR_FILES
MIRROR_FILES=(
    ["PRD"]="docs/api/_media/PRD-001-agent-driven-sdlc.md"
    ["SRS"]="docs/api/_media/SRS-001-agent-driven-sdlc.md"
    ["SDS"]="docs/api/_media/SDS-001-agent-driven-sdlc.md"
)

# API media mirrors (KR)
declare -A KR_MIRROR_FILES
KR_MIRROR_FILES=(
    ["PRD"]="docs/api/_media/PRD-001-agent-driven-sdlc.kr.md"
    ["SRS"]="docs/api/_media/SRS-001-agent-driven-sdlc.kr.md"
    ["SDS"]="docs/api/_media/SDS-001-agent-driven-sdlc.kr.md"
)

# --- Helpers ---
file_changed() {
    echo "$CHANGED_FILES" | grep -qx "$1"
}

# --- Collect warnings and errors ---
declare -a WARNINGS=()
declare -a ERRORS=()
declare -a CHANGED_DOCS=()
declare -a MISSING_UPDATES=()

add_warning() { WARNINGS+=("$1"); }
add_error()   { ERRORS+=("$1"); }

# --- Detect which primary documents changed ---
for doc in PRD SRS SDS; do
    if file_changed "${DOC_FILES[$doc]}"; then
        CHANGED_DOCS+=("$doc")
        log_info "Detected change: ${DOC_FILES[$doc]}"
    fi
done

# --- Rule 1: Cascade hierarchy check ---
# SDS changed → SRS and PRD should be reviewed
if file_changed "${DOC_FILES[SDS]}"; then
    if ! file_changed "${DOC_FILES[SRS]}"; then
        msg="SDS-001 modified but SRS-001 not updated — review SRS overview/scope sections"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("SRS-001")
    fi
    if ! file_changed "${DOC_FILES[PRD]}"; then
        msg="SDS-001 modified but PRD-001 not updated — review PRD overview/agent summary sections"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("PRD-001")
    fi
fi

# SRS changed → PRD should be reviewed, SDS may need updates
if file_changed "${DOC_FILES[SRS]}"; then
    if ! file_changed "${DOC_FILES[PRD]}"; then
        msg="SRS-001 modified but PRD-001 not updated — review PRD scope/overview alignment"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("PRD-001")
    fi
    if ! file_changed "${DOC_FILES[SDS]}"; then
        msg="SRS-001 modified but SDS-001 not updated — review SDS component designs for consistency"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("SDS-001")
    fi
fi

# PRD changed → SRS and SDS should be reviewed
if file_changed "${DOC_FILES[PRD]}"; then
    if ! file_changed "${DOC_FILES[SRS]}"; then
        msg="PRD-001 modified but SRS-001 not updated — review SRS scope and feature alignment"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("SRS-001")
    fi
    if ! file_changed "${DOC_FILES[SDS]}"; then
        msg="PRD-001 modified but SDS-001 not updated — review SDS scope and component alignment"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("SDS-001")
    fi
fi

# --- Rule 2: EN/KR pair check ---
for doc in PRD SRS SDS; do
    en_file="${DOC_FILES[$doc]}"
    kr_file="${KR_FILES[$doc]}"

    # EN changed but KR not
    if file_changed "$en_file" && ! file_changed "$kr_file"; then
        msg="$en_file modified but Korean counterpart $kr_file not updated"
        log_warn "$msg"
        add_warning "$msg"
        MISSING_UPDATES+=("$(basename "$kr_file")")
    fi

    # KR changed but EN not (unusual — flag it)
    if file_changed "$kr_file" && ! file_changed "$en_file"; then
        msg="$kr_file modified but English source $en_file not updated — verify KR changes align with EN"
        log_warn "$msg"
        add_warning "$msg"
    fi
done

# --- Rule 3: Primary -> api/_media mirror check ---
for doc in PRD SRS SDS; do
    en_file="${DOC_FILES[$doc]}"
    mirror_file="${MIRROR_FILES[$doc]}"
    kr_file="${KR_FILES[$doc]}"
    kr_mirror="${KR_MIRROR_FILES[$doc]}"

    # EN primary changed but mirror not
    if file_changed "$en_file" && ! file_changed "$mirror_file"; then
        # Only warn if mirror file exists in the repo
        if [[ -f "$mirror_file" ]]; then
            msg="$en_file modified but mirror $mirror_file not updated"
            log_warn "$msg"
            add_warning "$msg"
            MISSING_UPDATES+=("$(basename "$mirror_file") (mirror)")
        fi
    fi

    # KR primary changed but KR mirror not
    if file_changed "$kr_file" && ! file_changed "$kr_mirror"; then
        if [[ -f "$kr_mirror" ]]; then
            msg="$kr_file modified but mirror $kr_mirror not updated"
            log_warn "$msg"
            add_warning "$msg"
            MISSING_UPDATES+=("$(basename "$kr_mirror") (mirror)")
        fi
    fi
done

# --- Rule 4: Sync point configuration changed ---
if file_changed "doc-sync-points.yaml"; then
    log_info "doc-sync-points.yaml modified — cascade rules may have changed"
fi

# --- Determine pass/fail ---
# Warnings are advisory; errors cause failure
# For cascade checks, all issues are warnings (advisory, not blocking)
# The traceability check (validate-traceability.sh) handles hard failures
PASS=true
ERROR_COUNT=${#ERRORS[@]}
WARNING_COUNT=${#WARNINGS[@]}

if [[ $ERROR_COUNT -gt 0 ]]; then
    PASS=false
fi

# --- Summary ---
if [[ $WARNING_COUNT -eq 0 ]] && [[ $ERROR_COUNT -eq 0 ]]; then
    log_pass "All cascade checks passed — no missing document updates detected"
else
    log_info "Found $WARNING_COUNT warning(s) and $ERROR_COUNT error(s)"
fi

# --- Output ---
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Deduplicate missing updates
UNIQUE_MISSING=$(printf '%s\n' "${MISSING_UPDATES[@]}" 2>/dev/null | sort -u || echo "")

if [[ "$JSON_MODE" == "true" ]]; then
    # Build JSON arrays
    warnings_json="["
    first=true
    for w in "${WARNINGS[@]+"${WARNINGS[@]}"}"; do
        [[ -z "$w" ]] && continue
        $first || warnings_json+=","
        first=false
        # Escape quotes in warning messages
        escaped=$(echo "$w" | sed 's/"/\\"/g')
        warnings_json+="\"$escaped\""
    done
    warnings_json+="]"

    errors_json="["
    first=true
    for e in "${ERRORS[@]+"${ERRORS[@]}"}"; do
        [[ -z "$e" ]] && continue
        $first || errors_json+=","
        first=false
        escaped=$(echo "$e" | sed 's/"/\\"/g')
        errors_json+="\"$escaped\""
    done
    errors_json+="]"

    changed_json="["
    first=true
    for d in "${CHANGED_DOCS[@]+"${CHANGED_DOCS[@]}"}"; do
        [[ -z "$d" ]] && continue
        $first || changed_json+=","
        first=false
        changed_json+="\"$d\""
    done
    changed_json+="]"

    missing_json="["
    first=true
    if [[ -n "$UNIQUE_MISSING" ]]; then
        while IFS= read -r m; do
            [[ -z "$m" ]] && continue
            $first || missing_json+=","
            first=false
            escaped=$(echo "$m" | sed 's/"/\\"/g')
            missing_json+="\"$escaped\""
        done <<< "$UNIQUE_MISSING"
    fi
    missing_json+="]"

    cat <<ENDJSON
{
  "timestamp": "$TIMESTAMP",
  "pass": $PASS,
  "base_ref": "$BASE_REF",
  "changed_docs": $changed_json,
  "missing_updates": $missing_json,
  "warnings": $warnings_json,
  "errors": $errors_json,
  "warning_count": $WARNING_COUNT,
  "error_count": $ERROR_COUNT
}
ENDJSON
else
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Document Cascade Check Report${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "  Timestamp: $TIMESTAMP"
    echo "  Base ref:  $BASE_REF"
    echo ""

    if [[ ${#CHANGED_DOCS[@]} -gt 0 ]]; then
        echo "  Changed documents:"
        for d in "${CHANGED_DOCS[@]}"; do
            echo "    - ${DOC_FILES[$d]}"
        done
        echo ""
    else
        echo "  No primary documents changed"
        echo ""
    fi

    if [[ $WARNING_COUNT -gt 0 ]]; then
        echo -e "  ${YELLOW}Warnings ($WARNING_COUNT):${NC}"
        for w in "${WARNINGS[@]}"; do
            echo -e "    ${YELLOW}- $w${NC}"
        done
        echo ""
    fi

    if [[ $ERROR_COUNT -gt 0 ]]; then
        echo -e "  ${RED}Errors ($ERROR_COUNT):${NC}"
        for e in "${ERRORS[@]}"; do
            echo -e "    ${RED}- $e${NC}"
        done
        echo ""
    fi

    if [[ -n "$UNIQUE_MISSING" ]]; then
        echo "  Documents to review:"
        while IFS= read -r m; do
            [[ -z "$m" ]] && continue
            echo "    - $m"
        done <<< "$UNIQUE_MISSING"
        echo ""
    fi

    if $PASS; then
        echo -e "  ${GREEN}Result: PASS${NC}"
    else
        echo -e "  ${RED}Result: FAIL${NC}"
    fi
    echo ""
fi

# Exit with appropriate code
if $PASS; then
    exit 0
else
    exit 1
fi
