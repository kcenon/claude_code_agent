#!/usr/bin/env bash
#
# AD-SDLC Common Script Library
# Shared functions for headless execution scripts.
#
# Usage: source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
#
# Version: 1.0.0

# Prevent double-sourcing
[[ -n "${_ADSDLC_COMMON_LOADED:-}" ]] && return 0
readonly _ADSDLC_COMMON_LOADED=1

# =============================================================================
# Color Definitions
# =============================================================================
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m'  # No Color

# =============================================================================
# Logging Functions
# =============================================================================

# Log informational message
# Usage: log_info "message"
log_info() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

# Log warning message (to stderr)
# Usage: log_warn "message"
log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

# Log error message (to stderr)
# Usage: log_error "message"
log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# =============================================================================
# Utility Functions
# =============================================================================

# Check if a command exists
# Usage: require_command "cmd" ["install hint"]
# Returns: 0 if exists, 1 if not
require_command() {
    local cmd="$1"
    local install_hint="${2:-}"
    if ! command -v "$cmd" &>/dev/null; then
        log_error "'$cmd' is not installed"
        [[ -n "$install_hint" ]] && echo "$install_hint" >&2
        return 1
    fi
    return 0
}

# Resolve path to absolute path with error handling
# Usage: resolve_path "path"
# Returns: Absolute path or exits with error
resolve_path() {
    local path="$1"
    local resolved
    resolved="$(cd "$path" 2>/dev/null && pwd)" || {
        log_error "Directory does not exist: $path"
        return 1
    }
    echo "$resolved"
}

# =============================================================================
# Environment Check Functions
# =============================================================================

# Check AD-SDLC environment requirements
# Usage: check_environment
check_environment() {
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
        log_error "ANTHROPIC_API_KEY environment variable is not set"
        echo "Please set your API key: export ANTHROPIC_API_KEY=\"your-key\"" >&2
        exit 1
    fi

    require_command "claude" "Please install: npm install -g @anthropic-ai/claude-code" || exit 1
}

# =============================================================================
# Header/Footer Functions
# =============================================================================

# Print script header with standard style
# Usage: print_header "Script Title" "project_path" ["extra_line1" "extra_line2" ...]
print_header() {
    local title="$1"
    local project_path="$2"
    shift 2
    local extra_lines=("$@")

    echo ""
    echo -e "${BLUE}======================================"
    echo -e "  $title"
    echo -e "======================================${NC}"
    echo ""
    echo -e "  ${GREEN}Project:${NC} $project_path"
    for line in "${extra_lines[@]}"; do
        echo -e "  $line"
    done
    echo -e "  ${GREEN}Started:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Print script header with magenta box style (for full pipeline)
# Usage: print_header_box "Script Title" "project_path" ["extra_line1" "extra_line2" ...]
print_header_box() {
    local title="$1"
    local project_path="$2"
    shift 2
    local extra_lines=("$@")

    echo ""
    echo -e "${MAGENTA}======================================"
    echo -e "  $title"
    echo -e "======================================${NC}"
    echo ""
    echo -e "  ${GREEN}Project:${NC}  $project_path"
    for line in "${extra_lines[@]}"; do
        echo -e "  $line"
    done
    echo -e "  ${GREEN}Started:${NC}  $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# Print script footer with success message and next steps
# Usage: print_footer "Success Title" ["next_step1" "next_step2" ...]
# Note: Call from EXIT trap. Uses $? to determine success/failure
print_footer() {
    local exit_code=$?
    local success_title="${1:-Complete}"
    shift
    local next_steps=("$@")

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  $success_title"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        if [[ ${#next_steps[@]} -gt 0 ]]; then
            echo ""
            echo "Next steps:"
            for step in "${next_steps[@]}"; do
                echo "  $step"
            done
        fi
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Failed (exit code: $exit_code)"
        echo -e "======================================${NC}"
        echo ""
        echo "Check the output above for error details."
        echo ""
    fi
}

# Print script footer with generated files list
# Usage: print_footer_with_files "Success Title" "file1" "file2" ... -- "next_step1" "next_step2" ...
# Note: Use -- to separate files from next steps
print_footer_with_files() {
    local exit_code=$?
    local success_title="${1:-Complete}"
    shift

    local files=()
    local next_steps=()
    local in_files=true

    for arg in "$@"; do
        if [[ "$arg" == "--" ]]; then
            in_files=false
            continue
        fi
        if [[ "$in_files" == "true" ]]; then
            files+=("$arg")
        else
            next_steps+=("$arg")
        fi
    done

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  $success_title"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        if [[ ${#files[@]} -gt 0 ]]; then
            echo ""
            echo "Generated files:"
            for file in "${files[@]}"; do
                echo "  - $file"
            done
        fi
        if [[ ${#next_steps[@]} -gt 0 ]]; then
            echo ""
            echo "Next steps:"
            for step in "${next_steps[@]}"; do
                echo "  $step"
            done
        fi
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Failed (exit code: $exit_code)"
        echo -e "======================================${NC}"
        echo ""
        echo "Check the output above for error details."
        echo ""
    fi
}

# Print script footer with failure recovery tips
# Usage: print_footer_with_recovery "Success Title" "recovery_tip1" "recovery_tip2" ...
print_footer_with_recovery() {
    local exit_code=$?
    local success_title="${1:-Complete}"
    shift
    local recovery_tips=("$@")

    echo ""
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}======================================"
        echo -e "  $success_title"
        echo -e "======================================${NC}"
        echo ""
        echo -e "  ${GREEN}Finished:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
    else
        echo -e "${RED}======================================"
        echo -e "  Failed (exit code: $exit_code)"
        echo -e "======================================${NC}"
        echo ""
        echo "Check the output above for error details."
        if [[ ${#recovery_tips[@]} -gt 0 ]]; then
            echo "You may need to:"
            for tip in "${recovery_tips[@]}"; do
                echo "  $tip"
            done
        fi
        echo ""
    fi
}
