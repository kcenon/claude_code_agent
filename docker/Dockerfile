# SRS-5.1.1: Base MUST be node:20-slim (Debian/glibc, NOT Alpine)
FROM node:20-slim

# SRS-5.1.3: Version pinning via build arg
ARG CLAUDE_CODE_VERSION
# Why: Omitting default means "latest" when --build-arg is not passed.
# Pinning: docker build --build-arg CLAUDE_CODE_VERSION=1.2.3 .

# SRS-5.1.6: WORKDIR must NOT be / (causes full filesystem scan on install)
WORKDIR /workspace

# SRS-5.1.4: Dev tools — single layer, cache cleaned
# SRS-5.1.8: apt cache removed in same RUN to avoid layer bloat
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git \
       curl \
       jq \
       fzf \
       zsh \
       sudo \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI (gh) — separate layer for cache efficiency
# Why: gh releases change independently from apt packages
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# SRS-5.1.2: Install Claude Code globally
# SRS-5.1.8: npm cache cleaned in same RUN
RUN npm install -g @anthropic-ai/claude-code${CLAUDE_CODE_VERSION:+@$CLAUDE_CODE_VERSION} \
    && npm cache clean --force

# SRS-5.1.5: Memory heap limit
ENV NODE_OPTIONS=--max-old-space-size=4096

# SRS-5.1.7: Run as non-root user
# Why: node user (UID 1000) comes pre-created in node:20-slim
USER node

# Default command keeps container alive for docker compose exec
CMD ["sleep", "infinity"]
