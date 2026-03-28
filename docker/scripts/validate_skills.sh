#!/bin/bash

# Claude Configuration Skills Validation Tool
# ===========================================
# SKILL.md 파일의 형식과 무결성을 검증하는 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 스크립트 디렉토리
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

# 함수 정의
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# 카운터
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 검증 결과 기록
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

# YAML frontmatter 추출
extract_frontmatter() {
    local file="$1"
    # 첫 번째 --- 와 두 번째 --- 사이의 내용 추출
    sed -n '/^---$/,/^---$/p' "$file" | sed '1d;$d'
}

# 필드 값 추출
get_field() {
    local content="$1"
    local field="$2"
    echo "$content" | grep "^${field}:" | sed "s/^${field}:[[:space:]]*//"
}

# SKILL.md 파일 검증
validate_skill() {
    local skill_file="$1"
    local relative_path="${skill_file#$BACKUP_DIR/}"
    local skill_errors=0

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    info "검증 중: $relative_path"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # 1. YAML frontmatter 존재 확인
    if ! head -1 "$skill_file" | grep -q "^---$"; then
        error "YAML frontmatter 없음 (첫 줄이 '---'가 아님)"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        success "YAML frontmatter 시작 확인"
        record_pass
    fi

    # frontmatter 종료 확인
    local frontmatter_end
    frontmatter_end=$(awk 'NR>1 && /^---$/ {print NR; exit}' "$skill_file")
    if [ -z "$frontmatter_end" ]; then
        error "YAML frontmatter 종료 마커 없음"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        success "YAML frontmatter 종료 확인 (${frontmatter_end}번째 줄)"
        record_pass
    fi

    # frontmatter 추출
    local frontmatter
    frontmatter=$(extract_frontmatter "$skill_file")

    # 2. name 필드 검증
    local name
    name=$(get_field "$frontmatter" "name")

    if [ -z "$name" ]; then
        error "name 필드 없음"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        # name 형식 검증: 소문자, 숫자, 하이픈만 허용
        if ! echo "$name" | grep -qE "^[a-z0-9-]+$"; then
            error "name 형식 오류: '$name' (소문자, 숫자, 하이픈만 허용)"
            record_fail
            skill_errors=$((skill_errors + 1))
        else
            success "name 형식 유효: '$name'"
            record_pass
        fi

        # name 길이 검증 (최대 64자)
        local name_length=${#name}
        if [ $name_length -gt 64 ]; then
            error "name 길이 초과: ${name_length}자 (최대 64자)"
            record_fail
            skill_errors=$((skill_errors + 1))
        else
            success "name 길이 유효: ${name_length}자"
            record_pass
        fi
    fi

    # 3. description 필드 검증
    local description
    description=$(get_field "$frontmatter" "description")

    if [ -z "$description" ]; then
        error "description 필드 없음"
        record_fail
        skill_errors=$((skill_errors + 1))
    else
        # description 길이 검증 (최대 1024자)
        local desc_length=${#description}
        if [ $desc_length -gt 1024 ]; then
            error "description 길이 초과: ${desc_length}자 (최대 1024자)"
            record_fail
            skill_errors=$((skill_errors + 1))
        else
            success "description 유효: ${desc_length}자"
            record_pass
        fi
    fi

    # 4. 파일 라인 수 검증 (권장: 500줄 이하)
    local line_count
    line_count=$(wc -l < "$skill_file" | tr -d ' ')
    if [ "$line_count" -gt 500 ]; then
        warning "파일 길이 경고: ${line_count}줄 (권장: 500줄 이하)"
        record_warning
    else
        success "파일 길이 적정: ${line_count}줄"
        record_pass
    fi

    # 5. reference 디렉토리 확인
    local skill_dir
    skill_dir=$(dirname "$skill_file")
    if [ -d "${skill_dir}/reference" ]; then
        local ref_count
        ref_count=$(find "${skill_dir}/reference" -name "*.md" | wc -l | tr -d ' ')
        success "reference 디렉토리 존재: ${ref_count}개 문서"
        record_pass
    else
        warning "reference 디렉토리 없음"
        record_warning
    fi

    return $skill_errors
}

# 메인 로직
echo ""
echo "======================================================"
info "Skills 디렉토리 검색"
echo "======================================================"
echo ""

# Skills 디렉토리 위치
SKILL_DIRS=(
    "$BACKUP_DIR/project/.claude/skills"
    "$BACKUP_DIR/plugin/skills"
    "$BACKUP_DIR/plugin-lite/skills"
)

SKILL_FILES=()
for dir in "${SKILL_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        info "디렉토리 발견: ${dir#$BACKUP_DIR/}"
        while IFS= read -r -d '' file; do
            SKILL_FILES+=("$file")
        done < <(find "$dir" -name "SKILL.md" -print0)
    fi
done

if [ ${#SKILL_FILES[@]} -eq 0 ]; then
    error "SKILL.md 파일을 찾을 수 없습니다"
    exit 1
fi

info "총 ${#SKILL_FILES[@]}개의 SKILL.md 파일 발견"

# 각 SKILL.md 파일 검증
TOTAL_SKILL_ERRORS=0
for skill_file in "${SKILL_FILES[@]}"; do
    validate_skill "$skill_file"
    TOTAL_SKILL_ERRORS=$((TOTAL_SKILL_ERRORS + $?))
done

# YAML 구문 검증 (Python + PyYAML 사용 가능한 경우)
echo ""
echo "======================================================"
info "YAML 구문 검증"
echo "======================================================"
echo ""

# PyYAML 사용 가능 여부 확인
if python3 -c "import yaml" 2>/dev/null; then
    for skill_file in "${SKILL_FILES[@]}"; do
        relative_path="${skill_file#$BACKUP_DIR/}"

        # 파일에서 직접 frontmatter 추출 및 YAML 검증
        if python3 -c "
import yaml
import sys

with open('$skill_file', 'r') as f:
    content = f.read()

# frontmatter 추출
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
            success "$relative_path: YAML 구문 유효"
            record_pass
        else
            error "$relative_path: YAML 구문 오류"
            record_fail
        fi
    done
else
    warning "PyYAML 모듈을 찾을 수 없어 YAML 구문 검증을 건너뜁니다"
    info "설치: pip3 install pyyaml"
fi

# 검증 결과 요약
echo ""
echo "======================================================"
info "검증 결과 요약"
echo "======================================================"
echo ""

echo "  총 검사 항목:   $TOTAL_CHECKS"
echo "  통과:          $PASSED_CHECKS"
echo "  실패:          $FAILED_CHECKS"
echo "  경고:          $WARNING_CHECKS"

echo ""
if [ $FAILED_CHECKS -eq 0 ]; then
    success "모든 검증 통과!"
    if [ $WARNING_CHECKS -gt 0 ]; then
        warning "${WARNING_CHECKS}개의 경고가 있습니다. 권장사항을 확인하세요."
    fi
    exit 0
else
    error "${FAILED_CHECKS}개의 검증 실패"
    echo ""
    info "SKILL.md 형식 요구사항:"
    echo "  - YAML frontmatter: '---' 로 시작하고 끝나야 함"
    echo "  - name: 소문자, 숫자, 하이픈만 허용 (최대 64자)"
    echo "  - description: 비어있지 않아야 함 (최대 1024자)"
    exit 1
fi
