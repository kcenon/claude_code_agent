#!/usr/bin/env bash

# Claude Configuration Skills Validation Tool
# ===========================================
# Script to validate the format and integrity of SKILL.md files

set -euo pipefail

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}"
cat << 'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        Claude Configuration Skills Validation Tool            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Function definitions
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Record validation results
record_pass() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

record_fail() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

record_warning() {
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
}

# Extract YAML frontmatter
extract_frontmatter() {
    local file="$1"
    # Extract content between the first --- and second ---
    sed -n '/^---$/,/^---$/p' "$file" | sed '1d;$d'
}

# Extract field value
get_field() {
    local content="$1"
    local field="$2"
    echo "$content" | grep "^${field}:" | sed "s/^${field}:[[:space:]]*//"
}

# Validate SKILL.md file
validate_skill() {
    local skill_file="$1"
    local relative_path="${skill_file#$BACKUP_DIR/}"
    local skill_errors=0

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    info "Validating: $relative_path"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 1. Check YAML frontmatter exists
    if ! head -1 "$skill_file" | grep -q "^---$"; then
        error "No YAML frontmatter (first line is not '---')"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        success "YAML frontmatter start confirmed"
        record_pass
    fi

    # Check frontmatter end marker
    local frontmatter_end
    frontmatter_end=$(awk 'NR>1 && /^---$/ {print NR; exit}' "$skill_file")
    if [ -z "$frontmatter_end" ]; then
        error "No YAML frontmatter end marker"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        success "YAML frontmatter end confirmed (line ${frontmatter_end})"
        record_pass
    fi

    # Extract frontmatter
    local frontmatter
    frontmatter=$(extract_frontmatter "$skill_file")

    # 2. Validate name field
    local name
    name=$(get_field "$frontmatter" "name")

    if [ -z "$name" ]; then
        error "Missing name field"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        # Validate name format: only lowercase, digits, and hyphens allowed
        if ! echo "$name" | grep -qE "^[a-z0-9-]+$"; then
            error "Invalid name format: '$name' (only lowercase, digits, and hyphens allowed)"
            record_fail
            skill_errors=$((skill_errors + 1))
        else
            success "Valid name format: '$name'"
            record_pass
        fi

        # Validate name length (max 64 chars)
        local name_length=${#name}
        if [ $name_length -gt 64 ]; then
            error "Name too long: ${name_length} chars (max 64)"
            record_fail
            skill_errors=$((skill_errors + 1))
        else
            success "Valid name length: ${name_length} chars"
            record_pass
        fi
    fi

    # 3. Validate description field
    local description
    description=$(get_field "$frontmatter" "description")

    if [ -z "$description" ]; then
        error "Missing description field"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        # Validate description length (max 1024 chars)
        local desc_length=${#description}
        if [ $desc_length -gt 1024 ]; then
            error "Description too long: ${desc_length} chars (max 1024)"
            record_fail
            skill_errors=$((skill_errors + 1))
        else
            success "Valid description: ${desc_length} chars"
            record_pass
        fi
    fi

    # 4. Validate file line count (recommended: 500 lines or less)
    local line_count
    line_count=$(wc -l < "$skill_file" | tr -d ' ')
    if [ "$line_count" -gt 500 ]; then
        warning "File length warning: ${line_count} lines (recommended: 500 or less)"
        record_warning
    else
        success "File length OK: ${line_count} lines"
        record_pass
    fi

    # 5. Check reference directory
    local skill_dir
    skill_dir=$(dirname "$skill_file")
    if [ -d "${skill_dir}/reference" ]; then
        local ref_count
        ref_count=$(find "${skill_dir}/reference" -name "*.md" | wc -l | tr -d ' ')
        success "Reference directory found: ${ref_count} documents"
        record_pass
    else
        warning "No reference directory"
        record_warning
    fi

    return $skill_errors
}

# Main logic
echo ""
echo "======================================================"
info "Searching skills directories"
echo "======================================================"
echo ""

# Skills directory locations
SKILL_DIRS=(
    "$BACKUP_DIR/project/.claude/skills"
    "$BACKUP_DIR/plugin/skills"
    "$BACKUP_DIR/plugin-lite/skills"
)

SKILL_FILES=()
for dir in "${SKILL_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        info "Directory found: ${dir#$BACKUP_DIR/}"
        while IFS= read -r -d '' file; do
            SKILL_FILES+=("$file")
        done < <(find "$dir" -name "SKILL.md" -print0)
    fi
done

if [ ${#SKILL_FILES[@]} -eq 0 ]; then
    error "No SKILL.md files found"
    exit 1
fi

info "Found ${#SKILL_FILES[@]} SKILL.md file(s)"

# Validate each SKILL.md file
TOTAL_SKILL_ERRORS=0
for skill_file in "${SKILL_FILES[@]}"; do
    validate_skill "$skill_file"
    TOTAL_SKILL_ERRORS=$((TOTAL_SKILL_ERRORS + $?))
done

# YAML syntax validation (if Python + PyYAML available)
echo ""
echo "======================================================"
info "YAML syntax validation"
echo "======================================================"
echo ""

# Check PyYAML availability
if python3 -c "import yaml" 2>/dev/null; then
    for skill_file in "${SKILL_FILES[@]}"; do
        relative_path="${skill_file#$BACKUP_DIR/}"

        # Extract frontmatter from file and validate YAML
        if python3 -c "
import yaml
import sys

with open('$skill_file', 'r') as f:
    content = f.read()

# Extract frontmatter
lines = content.split('\n')
if lines[0] != '---':
    sys.exit(1)

end_idx = -1
for i, line in enumerate(lines[1:], 1):
    if line == '---':
        end_idx = i
        break

if end_idx == -1:
    sys.exit(1)

frontmatter = '\n'.join(lines[1:end_idx])
yaml.safe_load(frontmatter)
" 2>/dev/null; then
            success "$relative_path: Valid YAML syntax"
            record_pass
        else
            error "$relative_path: YAML syntax error"
            record_fail
        fi
    done
else
    warning "PyYAML module not found, skipping YAML syntax validation"
    info "Install: pip3 install pyyaml"
fi

# Results summary
echo ""
echo "======================================================"
info "Results Summary"
echo "======================================================"
echo ""

echo "  Total checks:   $TOTAL_CHECKS"
echo "  Passed:         $PASSED_CHECKS"
echo "  Failed:         $FAILED_CHECKS"
echo "  Warnings:       $WARNING_CHECKS"

echo ""
if [ $FAILED_CHECKS -eq 0 ]; then
    success "All validations passed!"
    if [ $WARNING_CHECKS -gt 0 ]; then
        warning "${WARNING_CHECKS} warning(s) found. Please review the recommendations."
    fi
    exit 0
else
    error "${FAILED_CHECKS} validation(s) failed"
    echo ""
    info "SKILL.md format requirements:"
    echo "  - YAML frontmatter: must start and end with '---'"
    echo "  - name: only lowercase, digits, and hyphens allowed (max 64 chars)"
    echo "  - description: must not be empty (max 1024 chars)"
    exit 1
fi
