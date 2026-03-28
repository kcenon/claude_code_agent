# Docker Multi-Instance Infrastructure

Run multiple Claude Code instances simultaneously with isolated accounts.

## Quick Start

```bash
./install.sh
```

## Compose Overrides

| File | Purpose | When to use |
|------|---------|-------------|
| `docker-compose.yml` | Base config (Tier A) | Always |
| `docker-compose.linux.yml` | HOST_UID/HOST_GID override | Linux/WSL |
| `docker-compose.worktree.yml` | Per-container worktree paths | Tier B only |
| `docker-compose.firewall.yml` | NET_ADMIN/NET_RAW caps | Security hardening |
| `docker-compose.sources.yml` | Host sources mount | Optional |

## Scripts

| Script | Purpose |
|--------|---------|
| `install.sh` | Interactive installer |
| `scripts/cleanup.sh` | Remove containers, volumes, worktrees, state |
| `scripts/setup-worktrees.sh` | Create N git worktrees for Tier B |
| `scripts/git-safe` | flock wrapper for Tier A git serialization |
| `scripts/validate_skills.sh` | SKILL.md validation |

## Security Notes

- API keys are stored in `.env` with 600 permissions
- Containers run as non-root (`node` user, UID 1000)
- `tini` is PID 1 for proper signal handling
- `no-new-privileges` prevents privilege escalation
- Tier A: `git-safe` wrapper serializes concurrent git access via flock
- Firewall override grants NET_ADMIN/NET_RAW — use with caution

## Phase 6 Hardening

See [Epic #657](https://github.com/kcenon/claude_code_agent/issues/657) for the full production readiness audit.
