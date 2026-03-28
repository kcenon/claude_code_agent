#!/usr/bin/env bash
# Interactive installer for Claude Docker multi-instance environment
# Generates docker-compose files for N containers based on user input
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

info()   { printf "${BLUE}ℹ${NC}  %s\n" "$*"; }
ok()     { printf "${GREEN}✔${NC}  %s\n" "$*"; }
warn()   { printf "${YELLOW}⚠${NC}  %s\n" "$*"; }
err()    { printf "${RED}✖${NC}  %s\n" "$*" >&2; }
header() { printf "\n${BOLD}${CYAN}── %s ──${NC}\n\n" "$*"; }

# Convert 0-based index to lowercase letter (0→a, 1→b, ...)
idx_letter() { printf "\\$(printf '%03o' $((97 + $1)))"; }
# Convert 0-based index to uppercase letter (0→A, 1→B, ...)
idx_upper()  { printf "\\$(printf '%03o' $((65 + $1)))"; }

# Back up a file if it exists
backup_if_exists() {
    local f="$1"
    if [[ -f "$f" ]]; then
        cp "$f" "${f}.bak"
        info "Backed up: ${f##*/} → ${f##*/}.bak"
    fi
}

# ── Platform detection ───────────────────────────────────────────────
detect_platform() {
    case "$(uname -s)" in
        Linux*)
            if grep -qi microsoft /proc/version 2>/dev/null; then
                PLATFORM="wsl"
            else
                PLATFORM="linux"
            fi
            ;;
        Darwin*) PLATFORM="macos" ;;
        *)       PLATFORM="unknown" ;;
    esac
}

# ── Prerequisites ────────────────────────────────────────────────────
check_prerequisites() {
    header "Prerequisites"

    local missing=0

    if command -v docker &>/dev/null; then
        ok "Docker: $(docker --version | head -c 60)"
    else
        err "Docker is not installed"; missing=1
    fi

    if docker compose version &>/dev/null 2>&1; then
        ok "Docker Compose: $(docker compose version --short 2>/dev/null)"
    else
        err "Docker Compose is not installed"; missing=1
    fi

    if command -v git &>/dev/null; then
        ok "Git: $(git --version)"
    else
        err "Git is not installed"; missing=1
    fi

    (( missing )) && { err "Install missing prerequisites and try again."; exit 1; }

    ok "Platform: $PLATFORM"
}

# ── Interactive prompts ──────────────────────────────────────────────

ask_container_count() {
    header "Container Count"

    printf "  How many Claude Code containers do you want?\n"
    printf "  Each container runs an isolated instance with its own account.\n"
    printf "  ${DIM}(Recommended: 2 for parallel development)${NC}\n\n"

    while true; do
        read -rp "  Number of containers (1–10) [2]: " count
        count="${count:-2}"
        if [[ "$count" =~ ^[0-9]+$ ]] && (( count >= 1 && count <= 10 )); then
            CONTAINER_COUNT=$count
            break
        fi
        warn "Enter a number between 1 and 10"
    done

    printf "\n"
    ok "$CONTAINER_COUNT container(s): $(
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            printf "claude-%s " "$(idx_letter $i)"
        done
    )"
}

ask_project_dir() {
    header "Project Directory"

    printf "  Enter the absolute path to the project to mount as /workspace.\n\n"

    while true; do
        read -rp "  Path: " project_dir
        project_dir="${project_dir/#\~/$HOME}"

        if [[ -z "$project_dir" ]]; then
            warn "Path cannot be empty"
        elif [[ "$project_dir" != /* ]]; then
            warn "Use an absolute path (starting with /)"
        elif [[ ! -d "$project_dir" ]]; then
            read -rp "  Directory does not exist. Create it? (y/N): " yn
            if [[ "$yn" =~ ^[Yy]$ ]]; then
                mkdir -p "$project_dir"
                ok "Created: $project_dir"
                PROJECT_DIR="$project_dir"; break
            fi
        else
            PROJECT_DIR="$project_dir"
            ok "Project directory: $PROJECT_DIR"; break
        fi
    done
}

ask_auth_method() {
    header "Authentication"

    printf "  ${BOLD}[A]${NC} OAuth  — Pro / Max / Team subscription (browser login on host)\n"
    printf "  ${BOLD}[B]${NC} API key — Console usage-based (paste key directly)\n\n"

    while true; do
        read -rp "  Auth method (A/B) [A]: " auth
        auth="${auth:-A}"
        case "$auth" in
            [Aa]) AUTH_METHOD="oauth";  ok "OAuth authentication"; break ;;
            [Bb]) AUTH_METHOD="apikey"; ok "API key authentication"; break ;;
            *)    warn "Enter A or B" ;;
        esac
    done

    if [[ "$AUTH_METHOD" == "apikey" ]]; then
        printf "\n"
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            local ltr
            ltr=$(idx_letter $i)
            read -rsp "  API key for container $ltr (Enter to skip): " key
            echo  # Print newline after silent input
            API_KEYS[$i]="${key:-}"
        done
    fi
}

ask_tier() {
    header "Source Sharing Tier"

    if (( CONTAINER_COUNT < 2 )); then
        TIER="a"
        info "Single container — tier selection not applicable."
        return
    fi

    printf "  ${BOLD}[A]${NC} Shared source  — all containers mount the same directory\n"
    printf "      ${DIM}Simple. Best when one writes, others read.${NC}\n"
    printf "  ${BOLD}[B]${NC} Git worktrees  — each container gets its own worktree\n"
    printf "      ${DIM}Full isolation. Both can edit concurrently.${NC}\n\n"

    while true; do
        read -rp "  Tier (A/B) [A]: " tier
        tier="${tier:-A}"
        case "$tier" in
            [Aa]) TIER="a"; ok "Tier A — shared source"; break ;;
            [Bb]) TIER="b"; ok "Tier B — git worktrees"; break ;;
            *)    warn "Enter A or B" ;;
        esac
    done
}

ask_sources_dir() {
    header "Host Sources Directory"

    printf "  Mount a host directory as /sources inside all containers?\n"
    printf "  ${DIM}(Useful for accessing shared source repos from the host)${NC}\n\n"

    read -rp "  Enable host sources mount? (y/N): " yn
    if [[ ! "$yn" =~ ^[Yy]$ ]]; then
        SOURCES_DIR=""
        info "Skipped host sources mount."
        return
    fi

    while true; do
        read -rp "  Host directory path: " sources_dir
        sources_dir="${sources_dir/#\~/$HOME}"

        if [[ -z "$sources_dir" ]]; then
            warn "Path cannot be empty"
        elif [[ "$sources_dir" != /* ]]; then
            warn "Use an absolute path (starting with /)"
        elif [[ ! -d "$sources_dir" ]]; then
            warn "Directory does not exist: $sources_dir"
        else
            SOURCES_DIR="$sources_dir"
            ok "Host sources: $SOURCES_DIR → /sources"
            break
        fi
    done
}

ask_version() {
    printf "\n"
    read -rp "  Claude Code version (Enter for latest): " ver
    CLAUDE_VERSION="${ver:-}"
    if [[ -n "$CLAUDE_VERSION" ]]; then
        ok "Version: $CLAUDE_VERSION"
    else
        ok "Version: latest"
    fi
}

# ── File generation ──────────────────────────────────────────────────

generate_env() {
    header "Generating .env"
    backup_if_exists "$SCRIPT_DIR/.env"

    {
        echo "# Generated by install.sh — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "# Containers: $CONTAINER_COUNT"
        echo ""
        echo "# Project source directory (bind-mounted to /workspace)"
        echo "PROJECT_DIR=$PROJECT_DIR"
        echo ""
        echo "# Claude Code version (empty = latest)"
        echo "CLAUDE_CODE_VERSION=${CLAUDE_VERSION}"
        echo ""

        if [[ "$AUTH_METHOD" == "apikey" ]]; then
            echo "# API keys (Path B authentication)"
            for ((i=0; i<CONTAINER_COUNT; i++)); do
                local up
                up=$(idx_upper $i)
                echo "CLAUDE_API_KEY_${up}=${API_KEYS[$i]:-}"
            done
            echo ""
        fi

        if [[ "$TIER" == "b" ]]; then
            echo "# Worktree directories (Tier B)"
            for ((i=0; i<CONTAINER_COUNT; i++)); do
                local up
                up=$(idx_upper $i)
                echo "PROJECT_DIR_${up}=${PROJECT_DIR}-$(idx_letter $i)"
            done
            echo ""
        fi

        if [[ -n "$SOURCES_DIR" ]]; then
            echo "# Host sources directory (bind-mounted to /sources)"
            echo "SOURCES_DIR=$SOURCES_DIR"
            echo ""
        fi
    } > "$SCRIPT_DIR/.env"
    chmod 600 .env

    ok ".env"
}

generate_compose() {
    header "Generating docker-compose.yml"
    backup_if_exists "$SCRIPT_DIR/docker-compose.yml"

    {
        cat <<'HDR'
# docker-compose.yml
# SRS-5.2.1~11: Container orchestration specifications
# Generated by install.sh

HDR
        echo "services:"

        for ((i=0; i<CONTAINER_COUNT; i++)); do
            local ltr up svc
            ltr=$(idx_letter $i)
            up=$(idx_upper $i)
            svc="claude-${ltr}"

            # First service includes the build context
            if (( i == 0 )); then
                cat <<EOF
  ${svc}:
    build:
      context: .
      args:
        CLAUDE_CODE_VERSION: \${CLAUDE_CODE_VERSION:-}
    image: claude-code-base:latest                          # SRS-5.2.1
    working_dir: /workspace                                 # SRS-5.2.2
    stdin_open: true                                        # SRS-5.2.3
    tty: true                                               # SRS-5.2.3
    volumes:
      - \${PROJECT_DIR}:/workspace                           # SRS-5.2.4
      - \${HOME}/.claude-state/account-${ltr}:/home/node/.claude  # SRS-5.2.5
      - node_modules_${ltr}:/workspace/node_modules              # SRS-5.2.6
    environment:
      - CLAUDE_CONFIG_DIR=/home/node/.claude                # SRS-5.2.7
      - NODE_OPTIONS=--max-old-space-size=4096              # SRS-5.2.8
      - ANTHROPIC_API_KEY=\${CLAUDE_API_KEY_${up}:-}             # SRS-5.2.9
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4G
        reservations:
          cpus: "1"
          memory: 2G
    command: ["sleep", "infinity"]

EOF
            else
                cat <<EOF
  ${svc}:
    image: claude-code-base:latest
    depends_on:
      - claude-$(idx_letter 0)
    working_dir: /workspace
    stdin_open: true
    tty: true
    volumes:
      - \${PROJECT_DIR}:/workspace
      - \${HOME}/.claude-state/account-${ltr}:/home/node/.claude
      - node_modules_${ltr}:/workspace/node_modules
    environment:
      - CLAUDE_CONFIG_DIR=/home/node/.claude
      - NODE_OPTIONS=--max-old-space-size=4096
      - ANTHROPIC_API_KEY=\${CLAUDE_API_KEY_${up}:-}
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4G
        reservations:
          cpus: "1"
          memory: 2G
    command: ["sleep", "infinity"]

EOF
            fi
        done

        echo "volumes:                                                    # SRS-5.2.10"
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            echo "  node_modules_$(idx_letter $i):"
        done
        echo ""
        echo "# SRS-5.2.11: No cap_add by default (firewall is Phase 4 opt-in)"
    } > "$SCRIPT_DIR/docker-compose.yml"

    ok "docker-compose.yml ($CONTAINER_COUNT services)"
}

generate_linux_override() {
    backup_if_exists "$SCRIPT_DIR/docker-compose.linux.yml"

    {
        cat <<'HDR'
# docker-compose.linux.yml
# Linux-specific UID/GID mapping — Generated by install.sh

services:
HDR
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            cat <<EOF
  claude-$(idx_letter $i):
    user: "\${HOST_UID}:\${HOST_GID}"
    environment:
      - HOME=/home/node

EOF
        done
    } > "$SCRIPT_DIR/docker-compose.linux.yml"

    ok "docker-compose.linux.yml"
}

generate_worktree_override() {
    backup_if_exists "$SCRIPT_DIR/docker-compose.worktree.yml"

    {
        cat <<'HDR'
# docker-compose.worktree.yml
# Tier B: Per-container git worktree mounts — Generated by install.sh

services:
HDR
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            local ltr up
            ltr=$(idx_letter $i)
            up=$(idx_upper $i)
            cat <<EOF
  claude-${ltr}:
    volumes:
      - \${PROJECT_DIR_${up}}:/workspace
      - \${HOME}/.claude-state/account-${ltr}:/home/node/.claude
      - node_modules_${ltr}:/workspace/node_modules

EOF
        done
    } > "$SCRIPT_DIR/docker-compose.worktree.yml"

    ok "docker-compose.worktree.yml"
}

generate_firewall_override() {
    backup_if_exists "$SCRIPT_DIR/docker-compose.firewall.yml"

    {
        cat <<'HDR'
# docker-compose.firewall.yml
# Phase 4: Firewall override with NET_ADMIN and NET_RAW — Generated by install.sh

services:
HDR
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            cat <<EOF
  claude-$(idx_letter $i):
    cap_add:
      - NET_ADMIN
      - NET_RAW

EOF
        done
    } > "$SCRIPT_DIR/docker-compose.firewall.yml"

    ok "docker-compose.firewall.yml"
}

generate_sources_override() {
    [[ -z "$SOURCES_DIR" ]] && return

    backup_if_exists "$SCRIPT_DIR/docker-compose.sources.yml"

    {
        cat <<'HDR'
# docker-compose.sources.yml
# Host sources directory mount — Generated by install.sh

services:
HDR
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            cat <<EOF
  claude-$(idx_letter $i):
    volumes:
      - "\${SOURCES_DIR}:/sources"

EOF
        done
    } > "$SCRIPT_DIR/docker-compose.sources.yml"

    ok "docker-compose.sources.yml"
}

# ── OAuth account setup ──────────────────────────────────────────────
setup_oauth() {
    [[ "$AUTH_METHOD" != "oauth" ]] && return

    header "OAuth Setup"

    printf "  Authenticate each account on the ${BOLD}host${NC} (not in a container).\n"
    printf "  Run these commands in your host terminal:\n\n"

    for ((i=0; i<CONTAINER_COUNT; i++)); do
        local ltr
        ltr=$(idx_letter $i)
        printf "  ${BOLD}Account %s:${NC}\n" "$ltr"
        printf "    mkdir -p ~/.claude-state/account-%s\n" "$ltr"
        printf "    CLAUDE_CONFIG_DIR=~/.claude-state/account-%s claude auth login\n\n" "$ltr"
    done

    read -rp "  Press Enter when done (or 's' to skip): " skip
    if [[ "$skip" == "s" ]]; then
        warn "Skipped. Authenticate before starting Claude Code in containers."
    fi
}

# ── Worktree setup ───────────────────────────────────────────────────
setup_worktrees() {
    [[ "$TIER" != "b" ]] && return

    header "Git Worktree Setup"

    if [[ ! -d "$PROJECT_DIR/.git" ]]; then
        err "$PROJECT_DIR is not a git repository."
        warn "Falling back to Tier A (shared source)."
        TIER="a"
        return
    fi

    for ((i=0; i<CONTAINER_COUNT; i++)); do
        local ltr wt_dir branch
        ltr=$(idx_letter $i)
        wt_dir="${PROJECT_DIR}-${ltr}"
        branch="worktree-${ltr}"

        if [[ -d "$wt_dir" ]]; then
            warn "Already exists: $wt_dir"
            continue
        fi

        git -C "$PROJECT_DIR" branch "$branch" HEAD 2>/dev/null || true
        git -C "$PROJECT_DIR" worktree add "$wt_dir" "$branch"
        ok "Worktree: $wt_dir (branch: $branch)"
    done
}

# ── Build & start ────────────────────────────────────────────────────
build_and_start() {
    header "Build & Start"

    read -rp "  Build image and start containers now? (Y/n): " yn
    if [[ "$yn" =~ ^[Nn]$ ]]; then
        info "Skipped. Run manually:"
        printf "    docker compose build\n"
        printf "    docker compose up -d\n"
        return
    fi

    info "Building Docker image..."
    docker compose build

    info "Starting containers..."
    local -a compose_args=("-f" "docker-compose.yml")

    if [[ "$PLATFORM" == "linux" || "$PLATFORM" == "wsl" ]]; then
        export HOST_UID HOST_GID
        HOST_UID=$(id -u)
        HOST_GID=$(id -g)
        compose_args+=("-f" "docker-compose.linux.yml")
    fi

    [[ "$TIER" == "b" ]] && compose_args+=("-f" "docker-compose.worktree.yml")
    [[ -n "${SOURCES_DIR:-}" ]] && compose_args+=("-f" "docker-compose.sources.yml")
    [[ "$ENABLE_FIREWALL" == "y" ]] && compose_args+=("-f" "docker-compose.firewall.yml")

    docker compose "${compose_args[@]}" up -d
    ok "All containers started"
}

# ── Summary ──────────────────────────────────────────────────────────
print_summary() {
    header "Setup Complete"

    printf "  ${GREEN}${BOLD}Your Claude Docker environment is ready.${NC}\n\n"

    printf "  ${BOLD}Containers:${NC}\n"
    for ((i=0; i<CONTAINER_COUNT; i++)); do
        local ltr
        ltr=$(idx_letter $i)
        printf "    claude-%-4s docker compose exec claude-%s claude\n" "$ltr" "$ltr"
    done

    printf "\n  ${BOLD}Quick reference:${NC}\n"
    printf "    Start Claude:    docker compose exec claude-a claude\n"
    printf "    Enter shell:     docker compose exec claude-a bash\n"
    printf "    View logs:       docker compose logs -f claude-a\n"
    printf "    Stop all:        docker compose down\n"
    printf "    Full cleanup:    ./scripts/cleanup.sh\n"

    if [[ "$AUTH_METHOD" == "oauth" ]]; then
        printf "\n  ${YELLOW}Reminder:${NC} Authenticate each account if you haven't already:\n"
        for ((i=0; i<CONTAINER_COUNT; i++)); do
            local ltr
            ltr=$(idx_letter $i)
            printf "    CLAUDE_CONFIG_DIR=~/.claude-state/account-%s claude auth login\n" "$ltr"
        done
    fi

    printf "\n"
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
    printf "\n${BOLD}${CYAN}"
    printf "╔══════════════════════════════════════════════╗\n"
    printf "║      Claude Docker — Interactive Setup       ║\n"
    printf "╚══════════════════════════════════════════════╝${NC}\n"

    # Globals
    declare -a API_KEYS=()
    CONTAINER_COUNT=2
    PROJECT_DIR=""
    AUTH_METHOD="oauth"
    TIER="a"
    SOURCES_DIR=""
    ENABLE_FIREWALL="n"
    CLAUDE_VERSION=""
    PLATFORM="unknown"

    detect_platform
    check_prerequisites
    ask_container_count
    ask_project_dir
    ask_auth_method
    ask_tier
    ask_sources_dir
    ask_version

    # Generate all configuration files
    generate_env
    generate_compose
    generate_linux_override
    [[ "$TIER" == "b" ]] && generate_worktree_override
    [[ "$ENABLE_FIREWALL" == "y" ]] && generate_firewall_override
    [[ -n "${SOURCES_DIR:-}" ]] && generate_sources_override

    # Optional setup steps
    setup_oauth
    setup_worktrees

    # Build & launch
    build_and_start

    # Print usage summary
    print_summary
}

main "$@"
