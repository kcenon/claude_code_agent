#!/usr/bin/env bash
#
# parse-doc-ids.sh - Extract requirement IDs from AD-SDLC markdown documents
#
# Parses PRD, SRS, and SDS documents to extract defined IDs and their
# cross-document references for traceability validation.
#
# Usage:
#   ./scripts/ci/parse-doc-ids.sh [--docs-dir <path>] [--json]
#
# Options:
#   --docs-dir <path>  Path to docs directory (default: ./docs)
#   --json             Output structured JSON to stdout
#   -h, --help         Show usage help
#
# Output (JSON mode):
#   {
#     "prd": { "fr": [...], "nfr": [...], "version": "..." },
#     "srs": { "sf": [...], "uc": [...], "sf_sources": {...}, "version": "..." },
#     "sds": { "cmp": [...], "cmp_sources": {...}, "version": "..." }
#   }

set -euo pipefail

# Defaults
DOCS_DIR="./docs"
JSON_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --docs-dir) DOCS_DIR="$2"; shift 2 ;;
        --json) JSON_MODE=true; shift ;;
        -h|--help)
            sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Document paths (English versions are the source of truth)
PRD_FILE="$DOCS_DIR/PRD-001-agent-driven-sdlc.md"
SRS_FILE="$DOCS_DIR/SRS-001-agent-driven-sdlc.md"
SDS_FILE="$DOCS_DIR/SDS-001-agent-driven-sdlc.md"

# Verify documents exist
for f in "$PRD_FILE" "$SRS_FILE" "$SDS_FILE"; do
    if [[ ! -f "$f" ]]; then
        echo "ERROR: Document not found: $f" >&2
        exit 1
    fi
done

# --- Extraction Functions ---

# Extract version from document metadata table
# Pattern: | **Version** | X.Y.Z |
extract_version() {
    local file="$1"
    grep -oE '[0-9]+\.[0-9]+\.[0-9]+' <<< "$(grep 'Version' "$file" | head -1)"
}

# Extract FR IDs defined in PRD (table rows: | FR-XXX | ... |)
extract_prd_fr() {
    grep -oE 'FR-[0-9]{3}' "$PRD_FILE" | sort -u
}

# Extract NFR IDs defined in PRD (table rows: | NFR-XXX | ... |)
extract_prd_nfr() {
    grep -oE 'NFR-[0-9]{3}' "$PRD_FILE" | sort -u
}

# Extract SF IDs defined in SRS (section headers: ### SF-XXX:)
extract_srs_sf() {
    grep -E '^#{2,4}[[:space:]]+SF-[0-9]{3}' "$SRS_FILE" | grep -oE 'SF-[0-9]{3}' | sort -u
}

# Extract UC IDs defined in SRS (subsection headers: ##### UC-XXX:)
extract_srs_uc() {
    grep -E '^#{2,6}[[:space:]]+UC-[0-9]{3}' "$SRS_FILE" | grep -oE 'UC-[0-9]{3}' | sort -u
}

# Extract SF->FR source mappings from SRS
# Pattern: **Source**: FR-001, FR-002
extract_srs_sf_sources() {
    local current_sf=""
    while IFS= read -r line; do
        # Detect SF header
        if [[ "$line" =~ ^#{2,4}[[:space:]]+(SF-[0-9]{3}) ]]; then
            current_sf="${BASH_REMATCH[1]}"
        fi
        # Detect Source line with FR references
        if [[ -n "$current_sf" && "$line" =~ \*\*Source\*\* ]]; then
            local frs
            frs=$(echo "$line" | grep -oE 'FR-[0-9]{3}' | tr '\n' ',' | sed 's/,$//')
            if [[ -n "$frs" ]]; then
                echo "${current_sf}=${frs}"
                current_sf=""
            fi
        fi
    done < "$SRS_FILE"
}

# Extract CMP IDs defined in SDS (section headers with CMP-XXX)
extract_sds_cmp() {
    grep -E '^#{2,4}[[:space:]]+.*CMP-[0-9]{3}' "$SDS_FILE" | grep -oE 'CMP-[0-9]{3}' | sort -u
}

# Extract CMP->SF source mappings from SDS
# Pattern: **Source Features**: SF-001 (UC-001, UC-002, UC-003)
extract_sds_cmp_sources() {
    local current_cmp=""
    while IFS= read -r line; do
        # Detect CMP header
        if [[ "$line" =~ ^#{2,4}[[:space:]]+.*CMP-[0-9]{3} ]]; then
            current_cmp=$(echo "$line" | grep -oE 'CMP-[0-9]{3}')
        fi
        # Detect Source Features line with SF references
        if [[ -n "$current_cmp" && "$line" =~ \*\*Source\ Feature ]]; then
            local sfs
            sfs=$(echo "$line" | grep -oE 'SF-[0-9]{3}' | tr '\n' ',' | sed 's/,$//')
            if [[ -n "$sfs" ]]; then
                echo "${current_cmp}=${sfs}"
                current_cmp=""
            fi
        fi
    done < "$SDS_FILE"
}

# --- Main Extraction ---

PRD_VERSION=$(extract_version "$PRD_FILE")
SRS_VERSION=$(extract_version "$SRS_FILE")
SDS_VERSION=$(extract_version "$SDS_FILE")

PRD_FR=$(extract_prd_fr)
PRD_NFR=$(extract_prd_nfr)
SRS_SF=$(extract_srs_sf)
SRS_UC=$(extract_srs_uc)
SDS_CMP=$(extract_sds_cmp)

# Source mappings (key=value pairs)
SRS_SF_SOURCES=$(extract_srs_sf_sources)
SDS_CMP_SOURCES=$(extract_sds_cmp_sources)

# --- Output ---

# Helper: convert newline-separated list to JSON array
to_json_array() {
    local input="$1"
    if [[ -z "$input" ]]; then
        echo "[]"
        return
    fi
    echo "$input" | awk 'BEGIN{printf "["} NR>1{printf ","} {printf "\"%s\"", $0} END{printf "]"}'
}

# Helper: convert key=value pairs to JSON object of arrays
to_json_map() {
    local input="$1"
    if [[ -z "$input" ]]; then
        echo "{}"
        return
    fi
    echo "$input" | awk -F= '
        BEGIN { printf "{" }
        NR > 1 { printf "," }
        {
            printf "\"%s\":[", $1
            n = split($2, arr, ",")
            for (i = 1; i <= n; i++) {
                if (i > 1) printf ","
                printf "\"%s\"", arr[i]
            }
            printf "]"
        }
        END { printf "}" }
    '
}

if $JSON_MODE; then
    cat <<ENDJSON
{
  "prd": {
    "fr": $(to_json_array "$PRD_FR"),
    "nfr": $(to_json_array "$PRD_NFR"),
    "version": "${PRD_VERSION:-unknown}"
  },
  "srs": {
    "sf": $(to_json_array "$SRS_SF"),
    "uc": $(to_json_array "$SRS_UC"),
    "sf_sources": $(to_json_map "$SRS_SF_SOURCES"),
    "version": "${SRS_VERSION:-unknown}"
  },
  "sds": {
    "cmp": $(to_json_array "$SDS_CMP"),
    "cmp_sources": $(to_json_map "$SDS_CMP_SOURCES"),
    "version": "${SDS_VERSION:-unknown}"
  }
}
ENDJSON
else
    echo "=== PRD-001 (v${PRD_VERSION:-?}) ==="
    echo "FR IDs: $(echo "$PRD_FR" | wc -l | tr -d ' ') defined"
    echo "$PRD_FR" | sed 's/^/  /'
    echo ""
    echo "NFR IDs: $(echo "$PRD_NFR" | wc -l | tr -d ' ') defined"
    echo "$PRD_NFR" | sed 's/^/  /'
    echo ""

    echo "=== SRS-001 (v${SRS_VERSION:-?}) ==="
    echo "SF IDs: $(echo "$SRS_SF" | wc -l | tr -d ' ') defined"
    echo "$SRS_SF" | sed 's/^/  /'
    echo ""
    echo "UC IDs: $(echo "$SRS_UC" | wc -l | tr -d ' ') defined"
    echo "$SRS_UC" | sed 's/^/  /'
    echo ""
    echo "SF->FR Source Mappings:"
    echo "$SRS_SF_SOURCES" | sed 's/^/  /'
    echo ""

    echo "=== SDS-001 (v${SDS_VERSION:-?}) ==="
    echo "CMP IDs: $(echo "$SDS_CMP" | wc -l | tr -d ' ') defined"
    echo "$SDS_CMP" | sed 's/^/  /'
    echo ""
    echo "CMP->SF Source Mappings:"
    echo "$SDS_CMP_SOURCES" | sed 's/^/  /'
fi
