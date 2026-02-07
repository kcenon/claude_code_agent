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

# --- Document file mappings (bash 3 compatible, no associative arrays) ---
# Lookup functions return file paths by document key (PRD, SRS, SDS)
doc_file() {
    case "$1" in
        PRD) echo "docs/PRD-001-agent-driven-sdlc.md" ;;
        SRS) echo "docs/SRS-001-agent-driven-sdlc.md" ;;
        SDS) echo "docs/SDS-001-agent-driven-sdlc.md" ;;
    esac
}

kr_file() {
    case "$1" in
        PRD) echo "docs/PRD-001-agent-driven-sdlc.kr.md" ;;
        SRS) echo "docs/SRS-001-agent-driven-sdlc.kr.md" ;;
        SDS) echo "docs/SDS-001-agent-driven-sdlc.kr.md" ;;
    esac
}

mirror_file() {
    case "$1" in
        PRD) echo "docs/api/_media/PRD-001-agent-driven-sdlc.md" ;;
        SRS) echo "docs/api/_media/SRS-001-agent-driven-sdlc.md" ;;
        SDS) echo "docs/api/_media/SDS-001-agent-driven-sdlc.md" ;;
    esac
}

kr_mirror_file() {
    case "$1" in
        PRD) echo "docs/api/_media/PRD-001-agent-driven-sdlc.kr.md" ;;
        SRS) echo "docs/api/_media/SRS-001-agent-driven-sdlc.kr.md" ;;
        SDS) echo "docs/api/_media/SDS-001-agent-driven-sdlc.kr.md" ;;
    esac
}

# --- Helpers ---
file_changed() {
    echo "$CHANGED_FILES" | grep -qx "$1"
}

# --- Collect warnings and errors using temp files (bash 3 compatible) ---
TMPDIR="${TMPDIR:-/tmp}/cascade-$$"
mkdir -p "$TMPDIR"
trap 'rm -rf "$TMPDIR"' EXIT

> "$TMPDIR/warnings.txt"
> "$TMPDIR/errors.txt"
> "$TMPDIR/changed_docs.txt"
> "$TMPDIR/missing_updates.txt"

add_warning() { echo "$1" >> "$TMPDIR/warnings.txt"; }
add_error()   { echo "$1" >> "$TMPDIR/errors.txt"; }

# --- Detect which primary documents changed ---
for doc in PRD SRS SDS; do
    en=$(doc_file "$doc")
    if file_changed "$en"; then
        echo "$doc" >> "$TMPDIR/changed_docs.txt"
        log_info "Detected change: $en"
    fi
done

# --- Rule 1: Cascade hierarchy check ---
PRD_EN=$(doc_file "PRD")
SRS_EN=$(doc_file "SRS")
SDS_EN=$(doc_file "SDS")

# SDS changed → SRS and PRD should be reviewed
if file_changed "$SDS_EN"; then
    if ! file_changed "$SRS_EN"; then
        msg="SDS-001 modified but SRS-001 not updated — review SRS overview/scope sections"
        log_warn "$msg"
        add_warning "$msg"
        echo "SRS-001" >> "$TMPDIR/missing_updates.txt"
    fi
    if ! file_changed "$PRD_EN"; then
        msg="SDS-001 modified but PRD-001 not updated — review PRD overview/agent summary sections"
        log_warn "$msg"
        add_warning "$msg"
        echo "PRD-001" >> "$TMPDIR/missing_updates.txt"
    fi
fi

# SRS changed → PRD should be reviewed, SDS may need updates
if file_changed "$SRS_EN"; then
    if ! file_changed "$PRD_EN"; then
        msg="SRS-001 modified but PRD-001 not updated — review PRD scope/overview alignment"
        log_warn "$msg"
        add_warning "$msg"
        echo "PRD-001" >> "$TMPDIR/missing_updates.txt"
    fi
    if ! file_changed "$SDS_EN"; then
        msg="SRS-001 modified but SDS-001 not updated — review SDS component designs for consistency"
        log_warn "$msg"
        add_warning "$msg"
        echo "SDS-001" >> "$TMPDIR/missing_updates.txt"
    fi
fi

# PRD changed → SRS and SDS should be reviewed
if file_changed "$PRD_EN"; then
    if ! file_changed "$SRS_EN"; then
        msg="PRD-001 modified but SRS-001 not updated — review SRS scope and feature alignment"
        log_warn "$msg"
        add_warning "$msg"
        echo "SRS-001" >> "$TMPDIR/missing_updates.txt"
    fi
    if ! file_changed "$SDS_EN"; then
        msg="PRD-001 modified but SDS-001 not updated — review SDS scope and component alignment"
        log_warn "$msg"
        add_warning "$msg"
        echo "SDS-001" >> "$TMPDIR/missing_updates.txt"
    fi
fi

# --- Rule 2: EN/KR pair check ---
for doc in PRD SRS SDS; do
    en=$(doc_file "$doc")
    kr=$(kr_file "$doc")

    # EN changed but KR not
    if file_changed "$en" && ! file_changed "$kr"; then
        msg="$en modified but Korean counterpart $kr not updated"
        log_warn "$msg"
        add_warning "$msg"
        echo "$(basename "$kr")" >> "$TMPDIR/missing_updates.txt"
    fi

    # KR changed but EN not (unusual — flag it)
    if file_changed "$kr" && ! file_changed "$en"; then
        msg="$kr modified but English source $en not updated — verify KR changes align with EN"
        log_warn "$msg"
        add_warning "$msg"
    fi
done

# --- Rule 3: Primary -> api/_media mirror check ---
for doc in PRD SRS SDS; do
    en=$(doc_file "$doc")
    mirror=$(mirror_file "$doc")
    kr=$(kr_file "$doc")
    kr_mirror=$(kr_mirror_file "$doc")

    # EN primary changed but mirror not
    if file_changed "$en" && ! file_changed "$mirror"; then
        if [[ -f "$mirror" ]]; then
            msg="$en modified but mirror $mirror not updated"
            log_warn "$msg"
            add_warning "$msg"
            echo "$(basename "$mirror") (mirror)" >> "$TMPDIR/missing_updates.txt"
        fi
    fi

    # KR primary changed but KR mirror not
    if file_changed "$kr" && ! file_changed "$kr_mirror"; then
        if [[ -f "$kr_mirror" ]]; then
            msg="$kr modified but mirror $kr_mirror not updated"
            log_warn "$msg"
            add_warning "$msg"
            echo "$(basename "$kr_mirror") (mirror)" >> "$TMPDIR/missing_updates.txt"
        fi
    fi
done

# --- Rule 4: Sync point configuration changed ---
if file_changed "doc-sync-points.yaml"; then
    log_info "doc-sync-points.yaml modified — cascade rules may have changed"
fi

# --- Determine pass/fail ---
PASS=true
WARNING_COUNT=$(wc -l < "$TMPDIR/warnings.txt" | tr -d ' ')
ERROR_COUNT=$(wc -l < "$TMPDIR/errors.txt" | tr -d ' ')

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
UNIQUE_MISSING=$(sort -u "$TMPDIR/missing_updates.txt" 2>/dev/null || echo "")

if [[ "$JSON_MODE" == "true" ]]; then
    # Helper: convert file lines to JSON array
    file_to_json_array() {
        local file="$1"
        local result="["
        local first=true
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            $first || result+=","
            first=false
            local escaped
            escaped=$(echo "$line" | sed 's/"/\\"/g')
            result+="\"$escaped\""
        done < "$file"
        result+="]"
        echo "$result"
    }

    warnings_json=$(file_to_json_array "$TMPDIR/warnings.txt")
    errors_json=$(file_to_json_array "$TMPDIR/errors.txt")
    changed_json=$(file_to_json_array "$TMPDIR/changed_docs.txt")

    # Build missing_updates JSON from deduplicated list
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

    CHANGED_DOC_COUNT=$(wc -l < "$TMPDIR/changed_docs.txt" | tr -d ' ')
    if [[ $CHANGED_DOC_COUNT -gt 0 ]]; then
        echo "  Changed documents:"
        while IFS= read -r d; do
            [[ -z "$d" ]] && continue
            echo "    - $(doc_file "$d")"
        done < "$TMPDIR/changed_docs.txt"
        echo ""
    else
        echo "  No primary documents changed"
        echo ""
    fi

    if [[ $WARNING_COUNT -gt 0 ]]; then
        echo -e "  ${YELLOW}Warnings ($WARNING_COUNT):${NC}"
        while IFS= read -r w; do
            [[ -z "$w" ]] && continue
            echo -e "    ${YELLOW}- $w${NC}"
        done < "$TMPDIR/warnings.txt"
        echo ""
    fi

    if [[ $ERROR_COUNT -gt 0 ]]; then
        echo -e "  ${RED}Errors ($ERROR_COUNT):${NC}"
        while IFS= read -r e; do
            [[ -z "$e" ]] && continue
            echo -e "    ${RED}- $e${NC}"
        done < "$TMPDIR/errors.txt"
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
