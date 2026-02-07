#!/usr/bin/env bash
#
# validate-traceability.sh - Validate cross-document traceability matrix
#
# Validates the requirement traceability chain across PRD, SRS, and SDS
# documents: PRD(FR) -> SRS(SF/UC) -> SDS(CMP)
#
# Usage:
#   ./scripts/ci/validate-traceability.sh [--docs-dir <path>] [--json] [--threshold <N>]
#
# Options:
#   --docs-dir <path>    Path to docs directory (default: ./docs)
#   --json               Output structured JSON to stdout (errors to stderr)
#   --threshold <N>      Minimum coverage percentage to pass (default: 100)
#   -h, --help           Show usage help
#
# Exit codes:
#   0  All validations passed
#   1  Validation failures detected

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
DOCS_DIR="./docs"
JSON_MODE=false
THRESHOLD=100

# Temp directory for working files
TMPDIR="${TMPDIR:-/tmp}/traceability-$$"
mkdir -p "$TMPDIR"
trap 'rm -rf "$TMPDIR"' EXIT

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --docs-dir) DOCS_DIR="$2"; shift 2 ;;
        --json) JSON_MODE=true; shift ;;
        --threshold) THRESHOLD="$2"; shift 2 ;;
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
log_check() { [[ "$JSON_MODE" == "false" ]] && echo -e "${BLUE}[CHECK]${NC} $1" >&2 || true; }
log_pass()  { [[ "$JSON_MODE" == "false" ]] && echo -e "${GREEN}[PASS]${NC}  $1" >&2 || true; }
log_fail()  { [[ "$JSON_MODE" == "false" ]] && echo -e "${RED}[FAIL]${NC}  $1" >&2 || true; }
log_warn()  { [[ "$JSON_MODE" == "false" ]] && echo -e "${YELLOW}[WARN]${NC}  $1" >&2 || true; }

# --- Parse document IDs using parse-doc-ids.sh ---
"$SCRIPT_DIR/parse-doc-ids.sh" --docs-dir "$DOCS_DIR" > "$TMPDIR/ids.txt"

# --- Extract data from text-mode output ---
# We use the text mode output which is simpler to parse portably

PRD_FILE="$DOCS_DIR/PRD-001-agent-driven-sdlc.md"
SRS_FILE="$DOCS_DIR/SRS-001-agent-driven-sdlc.md"
SDS_FILE="$DOCS_DIR/SDS-001-agent-driven-sdlc.md"

# Extract versions directly from documents
extract_version() {
    grep 'Version' "$1" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+'
}
PRD_VERSION=$(extract_version "$PRD_FILE")
SRS_VERSION=$(extract_version "$SRS_FILE")
SDS_VERSION=$(extract_version "$SDS_FILE")

# Extract ID lists from documents directly (more reliable than parsing JSON with bash)
grep -oE 'FR-[0-9]{3}' "$PRD_FILE" | sort -u > "$TMPDIR/prd_fr.txt"
grep -oE 'NFR-[0-9]{3}' "$PRD_FILE" | sort -u > "$TMPDIR/prd_nfr.txt"
grep -E '^#{2,4}[[:space:]]+SF-[0-9]{3}' "$SRS_FILE" | grep -oE 'SF-[0-9]{3}' | sort -u > "$TMPDIR/srs_sf.txt"
grep -E '^#{2,6}[[:space:]]+UC-[0-9]{3}' "$SRS_FILE" | grep -oE 'UC-[0-9]{3}' | sort -u > "$TMPDIR/srs_uc.txt"
grep -E '^#{2,4}[[:space:]]+.*CMP-[0-9]{3}' "$SDS_FILE" | grep -oE 'CMP-[0-9]{3}' | sort -u > "$TMPDIR/sds_cmp.txt"

# Extract SF->FR source mappings from SRS
# Produces lines: SF-001=FR-001,FR-016
{
    current_sf=""
    while IFS= read -r line; do
        if echo "$line" | grep -qE '^#{2,4}[[:space:]]+SF-[0-9]{3}'; then
            current_sf=$(echo "$line" | grep -oE 'SF-[0-9]{3}')
        fi
        if [[ -n "$current_sf" ]] && echo "$line" | grep -q '\*\*Source\*\*'; then
            frs=$(echo "$line" | grep -oE 'FR-[0-9]{3}' | tr '\n' ',' | sed 's/,$//')
            if [[ -n "$frs" ]]; then
                echo "${current_sf}=${frs}"
                current_sf=""
            fi
        fi
    done < "$SRS_FILE"
} > "$TMPDIR/sf_to_fr.txt"

# Extract CMP->SF source mappings from SDS
{
    current_cmp=""
    while IFS= read -r line; do
        if echo "$line" | grep -qE '^#{2,4}[[:space:]]+.*CMP-[0-9]{3}'; then
            current_cmp=$(echo "$line" | grep -oE 'CMP-[0-9]{3}')
        fi
        if [[ -n "$current_cmp" ]] && echo "$line" | grep -q '\*\*Source Feature'; then
            sfs=$(echo "$line" | grep -oE 'SF-[0-9]{3}' | tr '\n' ',' | sed 's/,$//')
            if [[ -n "$sfs" ]]; then
                echo "${current_cmp}=${sfs}"
                current_cmp=""
            fi
        fi
    done < "$SDS_FILE"
} > "$TMPDIR/cmp_to_sf.txt"

# --- Counts ---
FR_COUNT=$(wc -l < "$TMPDIR/prd_fr.txt" | tr -d ' ')
SF_COUNT=$(wc -l < "$TMPDIR/srs_sf.txt" | tr -d ' ')
CMP_COUNT=$(wc -l < "$TMPDIR/sds_cmp.txt" | tr -d ' ')

# --- Collect all referenced IDs ---

# All FRs referenced by any SF
cut -d= -f2 "$TMPDIR/sf_to_fr.txt" | tr ',' '\n' | sort -u > "$TMPDIR/referenced_fr.txt"

# All SFs referenced by any CMP
cut -d= -f2 "$TMPDIR/cmp_to_sf.txt" | tr ',' '\n' | sort -u > "$TMPDIR/referenced_sf.txt"

# --- Error/Warning collectors ---
> "$TMPDIR/errors.txt"
> "$TMPDIR/warnings.txt"

add_error() { echo "$1" >> "$TMPDIR/errors.txt"; }
add_warning() { echo "$1" >> "$TMPDIR/warnings.txt"; }

# --- Validation Checks ---

# Check 1: FR -> SF coverage (every PRD FR is referenced by at least one SRS SF)
log_check "FR -> SF coverage (every PRD requirement has an SRS feature)"
ORPHANED_FR=$(comm -23 "$TMPDIR/prd_fr.txt" "$TMPDIR/referenced_fr.txt")
if [[ -z "$ORPHANED_FR" ]]; then
    log_pass "All $FR_COUNT FR requirements covered by SF features"
else
    orphan_count=$(echo "$ORPHANED_FR" | wc -l | tr -d ' ')
    orphan_list=$(echo "$ORPHANED_FR" | tr '\n' ' ' | sed 's/ $//')
    log_fail "$orphan_count FR requirements not covered: $orphan_list"
    add_error "FR->SF: Orphaned FRs not referenced by any SF: $orphan_list"
fi

# Check 2: SF -> FR validity (every SF references valid FR IDs)
log_check "SF -> FR validity (every SRS feature references valid PRD requirements)"
DANGLING_SF_FR=""
while IFS='=' read -r sf frs; do
    for fr in $(echo "$frs" | tr ',' ' '); do
        if ! grep -qx "$fr" "$TMPDIR/prd_fr.txt"; then
            DANGLING_SF_FR+="${sf}->${fr} "
        fi
    done
done < "$TMPDIR/sf_to_fr.txt"
DANGLING_SF_FR=$(echo "$DANGLING_SF_FR" | sed 's/ $//')

if [[ -z "$DANGLING_SF_FR" ]]; then
    log_pass "All SF source references point to valid FR IDs"
else
    log_fail "Dangling SF->FR references: $DANGLING_SF_FR"
    add_error "SF->FR: Dangling references to non-existent FRs: $DANGLING_SF_FR"
fi

# Check 3: SF -> CMP coverage (every SRS SF is referenced by at least one SDS CMP)
log_check "SF -> CMP coverage (every SRS feature has an SDS component)"
ORPHANED_SF=$(comm -23 "$TMPDIR/srs_sf.txt" "$TMPDIR/referenced_sf.txt")
if [[ -z "$ORPHANED_SF" ]]; then
    log_pass "All $SF_COUNT SF features covered by CMP components"
else
    orphan_count=$(echo "$ORPHANED_SF" | wc -l | tr -d ' ')
    orphan_list=$(echo "$ORPHANED_SF" | tr '\n' ' ' | sed 's/ $//')
    log_fail "$orphan_count SF features not covered: $orphan_list"
    add_error "SF->CMP: Orphaned SFs not referenced by any CMP: $orphan_list"
fi

# Check 4: CMP -> SF validity (every CMP references valid SF IDs)
log_check "CMP -> SF validity (every SDS component references valid SRS features)"
DANGLING_CMP_SF=""
while IFS='=' read -r cmp sfs; do
    for sf in $(echo "$sfs" | tr ',' ' '); do
        if ! grep -qx "$sf" "$TMPDIR/srs_sf.txt"; then
            DANGLING_CMP_SF+="${cmp}->${sf} "
        fi
    done
done < "$TMPDIR/cmp_to_sf.txt"
DANGLING_CMP_SF=$(echo "$DANGLING_CMP_SF" | sed 's/ $//')

if [[ -z "$DANGLING_CMP_SF" ]]; then
    log_pass "All CMP source references point to valid SF IDs"
else
    log_fail "Dangling CMP->SF references: $DANGLING_CMP_SF"
    add_error "CMP->SF: Dangling references to non-existent SFs: $DANGLING_CMP_SF"
fi

# Check 5: ID continuity (no gaps in sequential numbering)
log_check "ID continuity (no gaps in sequential numbering)"
check_continuity() {
    local prefix="$1" file="$2" count="$3"
    local gaps=""
    local i=1
    while [[ $i -le $count ]]; do
        local id
        id=$(printf "%s-%03d" "$prefix" "$i")
        if ! grep -qx "$id" "$file"; then
            gaps+="$id "
        fi
        i=$((i + 1))
    done
    echo "$gaps" | sed 's/ $//'
}

CONTINUITY_OK=true
FR_GAPS=$(check_continuity "FR" "$TMPDIR/prd_fr.txt" "$FR_COUNT")
SF_GAPS=$(check_continuity "SF" "$TMPDIR/srs_sf.txt" "$SF_COUNT")
CMP_GAPS=$(check_continuity "CMP" "$TMPDIR/sds_cmp.txt" "$CMP_COUNT")

if [[ -n "$FR_GAPS" ]]; then
    log_warn "FR numbering gaps: $FR_GAPS"
    add_warning "FR numbering gaps: $FR_GAPS"
    CONTINUITY_OK=false
fi
if [[ -n "$SF_GAPS" ]]; then
    log_warn "SF numbering gaps: $SF_GAPS"
    add_warning "SF numbering gaps: $SF_GAPS"
    CONTINUITY_OK=false
fi
if [[ -n "$CMP_GAPS" ]]; then
    log_warn "CMP numbering gaps: $CMP_GAPS"
    add_warning "CMP numbering gaps: $CMP_GAPS"
    CONTINUITY_OK=false
fi
if $CONTINUITY_OK; then
    log_pass "All ID sequences continuous (FR: 1-$FR_COUNT, SF: 1-$SF_COUNT, CMP: 1-$CMP_COUNT)"
fi

# Check 6: EN/KR document pair existence
log_check "EN/KR document pair consistency"
KR_MISSING=""
for doc in PRD-001-agent-driven-sdlc SRS-001-agent-driven-sdlc SDS-001-agent-driven-sdlc; do
    if [[ ! -f "$DOCS_DIR/${doc}.kr.md" ]]; then
        KR_MISSING+="${doc}.kr.md "
    fi
done
KR_MISSING=$(echo "$KR_MISSING" | sed 's/ $//')

if [[ -z "$KR_MISSING" ]]; then
    log_pass "All Korean translation documents present"
else
    log_fail "Missing Korean documents: $KR_MISSING"
    add_error "Missing Korean documents: $KR_MISSING"
fi

# --- Compute Coverage ---
FR_COVERED=$(wc -l < "$TMPDIR/referenced_fr.txt" | tr -d ' ')
SF_COVERED=$(wc -l < "$TMPDIR/referenced_sf.txt" | tr -d ' ')

if [[ $FR_COUNT -gt 0 ]]; then
    FR_COVERAGE=$((FR_COVERED * 100 / FR_COUNT))
else
    FR_COVERAGE=0
fi

if [[ $SF_COUNT -gt 0 ]]; then
    SF_COVERAGE=$((SF_COVERED * 100 / SF_COUNT))
else
    SF_COVERAGE=0
fi

if [[ $((FR_COUNT + SF_COUNT)) -gt 0 ]]; then
    OVERALL_COVERAGE=$(( (FR_COVERED + SF_COVERED) * 100 / (FR_COUNT + SF_COUNT) ))
else
    OVERALL_COVERAGE=0
fi

# --- Threshold check ---
PASS=true
ERROR_COUNT=$(wc -l < "$TMPDIR/errors.txt" | tr -d ' ')

if [[ $OVERALL_COVERAGE -lt $THRESHOLD ]]; then
    PASS=false
    add_error "Overall coverage ${OVERALL_COVERAGE}% below threshold ${THRESHOLD}%"
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi
if [[ $ERROR_COUNT -gt 0 ]]; then
    PASS=false
fi

WARNING_COUNT=$(wc -l < "$TMPDIR/warnings.txt" | tr -d ' ')

# --- Output ---

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [[ "$JSON_MODE" == "true" ]]; then
    # Build JSON arrays from files
    errors_json="["
    first=true
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        $first || errors_json+=","
        first=false
        errors_json+="\"$line\""
    done < "$TMPDIR/errors.txt"
    errors_json+="]"

    warnings_json="["
    first=true
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        $first || warnings_json+=","
        first=false
        warnings_json+="\"$line\""
    done < "$TMPDIR/warnings.txt"
    warnings_json+="]"

    cat <<ENDJSON
{
  "timestamp": "$TIMESTAMP",
  "pass": $PASS,
  "threshold": $THRESHOLD,
  "counts": {
    "fr": $FR_COUNT,
    "sf": $SF_COUNT,
    "cmp": $CMP_COUNT
  },
  "coverage": {
    "fr_to_sf": {
      "total": $FR_COUNT,
      "covered": $FR_COVERED,
      "percentage": $FR_COVERAGE
    },
    "sf_to_cmp": {
      "total": $SF_COUNT,
      "covered": $SF_COVERED,
      "percentage": $SF_COVERAGE
    },
    "overall": $OVERALL_COVERAGE
  },
  "versions": {
    "prd": "$PRD_VERSION",
    "srs": "$SRS_VERSION",
    "sds": "$SDS_VERSION"
  },
  "errors": $errors_json,
  "warnings": $warnings_json
}
ENDJSON
else
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Document Traceability Report${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "  Timestamp: $TIMESTAMP"
    echo "  Threshold: ${THRESHOLD}%"
    echo ""
    echo "  Counts:"
    echo "    PRD FR:  $FR_COUNT"
    echo "    SRS SF:  $SF_COUNT"
    echo "    SDS CMP: $CMP_COUNT"
    echo ""
    echo "  Coverage:"
    echo "    FR -> SF:  ${FR_COVERED}/${FR_COUNT} (${FR_COVERAGE}%)"
    echo "    SF -> CMP: ${SF_COVERED}/${SF_COUNT} (${SF_COVERAGE}%)"
    echo "    Overall:   ${OVERALL_COVERAGE}%"
    echo ""
    echo "  Versions:"
    echo "    PRD: $PRD_VERSION"
    echo "    SRS: $SRS_VERSION"
    echo "    SDS: $SDS_VERSION"
    echo ""

    if [[ $ERROR_COUNT -gt 0 ]]; then
        echo -e "  ${RED}Errors ($ERROR_COUNT):${NC}"
        while IFS= read -r err; do
            [[ -z "$err" ]] && continue
            echo -e "    ${RED}- $err${NC}"
        done < "$TMPDIR/errors.txt"
        echo ""
    fi

    if [[ $WARNING_COUNT -gt 0 ]]; then
        echo -e "  ${YELLOW}Warnings ($WARNING_COUNT):${NC}"
        while IFS= read -r warn; do
            [[ -z "$warn" ]] && continue
            echo -e "    ${YELLOW}- $warn${NC}"
        done < "$TMPDIR/warnings.txt"
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
