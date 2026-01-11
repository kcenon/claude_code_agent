# Agent Deployment and Integration Guide

> **Version**: 1.0.0
> **Audience**: Developers deploying Claude Code Agents

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [CLI Integration](#cli-integration)
4. [SDK Deployment](#sdk-deployment)
5. [Container Deployment](#container-deployment)
6. [CI/CD Integration](#cicd-integration)
7. [Production Considerations](#production-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Python | 3.10+ | 3.11+ |
| Node.js | 18+ | 20+ |
| Memory | 4GB | 8GB+ |
| Disk | 1GB | 5GB+ |

### Required Software

```bash
# Check Python version
python3 --version  # Should be 3.10+

# Check Node.js version
node --version     # Should be 18+

# Check npm version
npm --version
```

### Authentication Setup

#### Option 1: API Key (Pay-per-token)

```bash
# Set Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Verify
echo $ANTHROPIC_API_KEY
```

#### Option 2: Claude Subscription (Max/Pro)

```bash
# Remove API key to use subscription
unset ANTHROPIC_API_KEY

# Login via Claude Code CLI
claude login
```

#### Option 3: Cloud Providers

```bash
# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"

# Azure Foundry
export CLAUDE_CODE_USE_FOUNDRY=1
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
```

---

## Installation Methods

### Method 1: Claude Code CLI (Recommended for Development)

```bash
# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Initialize in project
cd your-project
claude init
```

### Method 2: Agent SDK (For Custom Applications)

```bash
# Python SDK
pip install claude-agent-sdk

# Or with Poetry
poetry add claude-agent-sdk

# Or with pipx (isolated)
pipx install claude-agent-sdk
```

```bash
# TypeScript/JavaScript SDK
npm install @anthropic-ai/claude-agent-sdk

# Or with yarn
yarn add @anthropic-ai/claude-agent-sdk
```

### Method 3: From Source

```bash
# Clone repository
git clone https://github.com/anthropics/claude-code.git
cd claude-code

# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link
```

---

## CLI Integration

### Adding Custom Agents to Claude Code CLI

#### Step 1: Create Agent Directory

```bash
# Project-level agents (shared via git)
mkdir -p .claude/agents

# User-level agents (personal, all projects)
mkdir -p ~/.claude/agents
```

#### Step 2: Define Agent

Create `.claude/agents/your-agent.md`:

```markdown
---
name: code-reviewer
description: |
  Expert code reviewer for quality and security.
  Use proactively after code changes.
  Responds to "review", "check code", "PR review".
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a senior code reviewer...

## Instructions
1. Analyze code changes
2. Check for security issues
3. Provide actionable feedback
```

#### Step 3: Verify Agent Registration

```bash
# List available agents
claude /agents

# Or in interactive mode
> /agents
```

#### Step 4: Use Agent

```bash
# Explicit invocation
claude "Use code-reviewer to review the last commit"

# Or Claude auto-selects based on task
claude "Review my recent changes"
```

### Agent Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier (required) |
| `description` | string | When to use this agent (required) |
| `tools` | string | Comma-separated tool list |
| `model` | string | `sonnet`, `opus`, `haiku`, `inherit` |
| `permissionMode` | string | `default`, `acceptEdits`, `bypassPermissions` |
| `skills` | string | Auto-load specified skills |

### CLI Flags for Agents

```bash
# Specify agents via CLI
claude --agents '{
  "analyzer": {
    "description": "Code analyzer",
    "prompt": "Analyze code structure...",
    "tools": ["Read", "Grep"]
  }
}'

# Run in non-interactive mode
claude -p "Analyze src/" --agents @agents.json

# Output format
claude -p "Review code" --output-format json
```

---

## SDK Deployment

### Basic SDK Setup

**Python:**

```python
# setup.py or pyproject.toml
# Requires: claude-agent-sdk>=1.0.0

from claude_agent_sdk import query, ClaudeAgentOptions

async def run_agent():
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5-20251101",
        allowed_tools=["Read", "Grep", "Glob"],
        permission_mode="acceptEdits"
    )

    async for message in query(
        prompt="Analyze the codebase",
        options=options
    ):
        print(message)
```

**TypeScript:**

```typescript
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

async function runAgent() {
    const options: ClaudeAgentOptions = {
        model: "claude-sonnet-4-5-20251101",
        allowedTools: ["Read", "Grep", "Glob"],
        permissionMode: "acceptEdits"
    };

    for await (const message of query({
        prompt: "Analyze the codebase",
        options
    })) {
        console.log(message);
    }
}
```

### Packaging Your Agent as a Module

**Project Structure:**

```
my-agent/
├── src/
│   ├── __init__.py
│   ├── agent.py          # Agent implementation
│   ├── tools.py          # Custom MCP tools
│   └── prompts.py        # System prompts
├── tests/
│   └── test_agent.py
├── pyproject.toml
├── README.md
└── .env.example
```

**pyproject.toml:**

```toml
[project]
name = "my-custom-agent"
version = "1.0.0"
dependencies = [
    "claude-agent-sdk>=1.0.0",
    "asyncpg>=0.28.0",  # If using database
]

[project.scripts]
my-agent = "my_agent.cli:main"

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio"]
```

**src/agent.py:**

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

class MyCustomAgent:
    def __init__(self, config: dict = None):
        self.config = config or {}
        self.options = self._build_options()

    def _build_options(self) -> ClaudeAgentOptions:
        return ClaudeAgentOptions(
            model=self.config.get("model", "claude-sonnet-4-5-20251101"),
            allowed_tools=self.config.get("tools", ["Read", "Grep"]),
            system_prompt=self._get_system_prompt(),
            permission_mode="acceptEdits"
        )

    def _get_system_prompt(self) -> str:
        return """You are a specialized agent..."""

    async def run(self, task: str) -> str:
        result = ""
        async for message in query(prompt=task, options=self.options):
            if hasattr(message, 'result') and message.result:
                result = message.result
        return result
```

### Distributing Your Agent

```bash
# Build package
python -m build

# Publish to PyPI
twine upload dist/*

# Install from PyPI
pip install my-custom-agent
```

---

## Container Deployment

### Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for Claude Code CLI
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create app directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY src/ ./src/
COPY .claude/ ./.claude/

# Create non-root user
RUN useradd -m -u 1000 agent
USER agent

# Set environment
ENV PYTHONPATH=/app

# Entry point
ENTRYPOINT ["python", "-m", "src.main"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  agent:
    build: .
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - LOG_LEVEL=INFO
    volumes:
      # Mount code for analysis (read-only)
      - ./workspace:/workspace:ro
      # Mount output directory
      - ./outputs:/app/outputs
    # Security options
    security_opt:
      - no-new-privileges:true
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # Optional: Agent with database access
  db-agent:
    build:
      context: .
      dockerfile: Dockerfile.db
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - DB_HOST=postgres
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - postgres
    networks:
      - agent-network

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=analytics
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - agent-network

networks:
  agent-network:
    driver: bridge

volumes:
  pgdata:
```

### Running Containerized Agent

```bash
# Build
docker-compose build

# Run with environment variables
ANTHROPIC_API_KEY=sk-ant-... docker-compose up agent

# Run specific task
docker-compose run --rm agent "Analyze /workspace/src"

# Interactive mode
docker-compose run --rm -it agent bash
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-agent
  labels:
    app: claude-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: claude-agent
  template:
    metadata:
      labels:
        app: claude-agent
    spec:
      containers:
      - name: agent
        image: your-registry/claude-agent:latest
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: claude-secrets
              key: api-key
        resources:
          limits:
            cpu: "2"
            memory: "4Gi"
          requests:
            cpu: "500m"
            memory: "1Gi"
        volumeMounts:
        - name: workspace
          mountPath: /workspace
          readOnly: true
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-pvc
---
apiVersion: v1
kind: Secret
metadata:
  name: claude-secrets
type: Opaque
stringData:
  api-key: "sk-ant-..."
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/agent-review.yml
name: AI Code Review

on:
  pull_request:
    branches: [main, develop]

jobs:
  code-review:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for diff

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Setup Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.11'

    - name: Install Claude Code
      run: npm install -g @anthropic-ai/claude-code

    - name: Install Agent Dependencies
      run: pip install -r requirements.txt

    - name: Run Code Review Agent
      env:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      run: |
        python src/review_agent.py \
          --target "${{ github.event.pull_request.base.sha }}..${{ github.sha }}" \
          --output review.md

    - name: Post Review Comment
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const review = fs.readFileSync('review.md', 'utf8');
          await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
            body: review
          });
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - review
  - test

ai-code-review:
  stage: review
  image: python:3.11

  before_script:
    - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    - apt-get install -y nodejs
    - npm install -g @anthropic-ai/claude-code
    - pip install -r requirements.txt

  script:
    - python src/review_agent.py --target "origin/main..HEAD" --output review.md
    - cat review.md

  artifacts:
    paths:
      - review.md
    expire_in: 1 week

  only:
    - merge_requests

  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY

ai-test-generation:
  stage: test
  image: python:3.11

  script:
    - pip install claude-agent-sdk pytest
    - python src/test_agent.py --generate-tests
    - pytest tests/ -v

  only:
    - merge_requests
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'python:3.11'
            args '-v /var/run/docker.sock:/var/run/docker.sock'
        }
    }

    environment {
        ANTHROPIC_API_KEY = credentials('anthropic-api-key')
    }

    stages {
        stage('Setup') {
            steps {
                sh '''
                    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                    apt-get install -y nodejs
                    npm install -g @anthropic-ai/claude-code
                    pip install -r requirements.txt
                '''
            }
        }

        stage('AI Code Review') {
            steps {
                sh '''
                    python src/review_agent.py \
                        --target "${GIT_PREVIOUS_COMMIT}..${GIT_COMMIT}" \
                        --output review.md
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'review.md'
                }
            }
        }

        stage('AI Test Generation') {
            when {
                branch 'feature/*'
            }
            steps {
                sh 'python src/test_agent.py --generate-tests'
            }
        }
    }

    post {
        failure {
            slackSend(
                channel: '#dev-alerts',
                message: "AI Agent failed: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

---

## Production Considerations

### Security Best Practices

```python
# config/security.py

# 1. Never expose credentials to agent
SAFE_ENV_VARS = {
    "NODE_ENV": "production",
    "LOG_LEVEL": "INFO",
    # DO NOT include API keys, passwords, etc.
}

# 2. Restrict tools in production
PRODUCTION_TOOLS = [
    "Read",
    "Grep",
    "Glob",
    # Exclude: Write, Edit, Bash (unless necessary)
]

# 3. Define allowed paths
ALLOWED_PATHS = [
    "/app/src/**",
    "/app/tests/**",
]

DENIED_PATHS = [
    "**/.env*",
    "**/*secret*",
    "**/*credential*",
    "**/node_modules/**",
]
```

### Cost Management

```python
# config/limits.py

class CostLimits:
    # Per-request limits
    MAX_COST_PER_REQUEST = 1.0  # $1.00

    # Daily limits
    MAX_DAILY_COST = 50.0  # $50.00

    # Turn limits
    MAX_TURNS_PER_REQUEST = 30

    # Token limits
    MAX_INPUT_TOKENS = 100000
    MAX_OUTPUT_TOKENS = 16000


async def cost_controlled_query(prompt: str, options: ClaudeAgentOptions):
    """Query with cost controls"""
    total_cost = 0.0

    async for message in query(prompt=prompt, options=options):
        if hasattr(message, 'total_cost_usd'):
            total_cost = message.total_cost_usd

            if total_cost > CostLimits.MAX_COST_PER_REQUEST:
                raise CostLimitExceeded(
                    f"Request cost ${total_cost:.2f} exceeds limit"
                )

        yield message
```

### Logging and Monitoring

```python
# config/logging.py
import logging
import json
from datetime import datetime

class AgentLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

        # JSON formatter for structured logging
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        self.logger.addHandler(handler)

    def log_request(self, task: str, options: dict):
        self.logger.info(json.dumps({
            "event": "agent_request",
            "timestamp": datetime.utcnow().isoformat(),
            "task": task[:100],  # Truncate
            "model": options.get("model"),
            "tools": options.get("allowed_tools", [])
        }))

    def log_completion(self, duration_ms: int, cost_usd: float, status: str):
        self.logger.info(json.dumps({
            "event": "agent_completion",
            "timestamp": datetime.utcnow().isoformat(),
            "duration_ms": duration_ms,
            "cost_usd": cost_usd,
            "status": status
        }))
```

### Health Checks

```python
# healthcheck.py
from fastapi import FastAPI, HTTPException
from claude_agent_sdk import query, ClaudeAgentOptions

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/health/agent")
async def agent_health_check():
    """Verify agent can execute"""
    try:
        options = ClaudeAgentOptions(
            allowed_tools=[],
            max_turns=1
        )

        async for message in query(
            prompt="Reply with 'OK'",
            options=options
        ):
            if hasattr(message, 'subtype') and message.subtype == 'success':
                return {"status": "healthy", "agent": "operational"}

        raise HTTPException(500, "Agent did not complete")

    except Exception as e:
        raise HTTPException(500, f"Agent unhealthy: {str(e)}")
```

---

## Troubleshooting

### Common Issues

#### 1. CLI Not Found

```bash
# Error: claude: command not found

# Solution 1: Install globally
npm install -g @anthropic-ai/claude-code

# Solution 2: Add to PATH
export PATH="$PATH:$(npm config get prefix)/bin"

# Solution 3: Use npx
npx @anthropic-ai/claude-code --version
```

#### 2. Authentication Failed

```bash
# Error: AuthenticationError

# Check API key is set
echo $ANTHROPIC_API_KEY

# Verify key format (should start with sk-ant-)
# Try re-login for subscription
claude logout
claude login
```

#### 3. Permission Denied

```python
# Error: Tool 'Bash' is not allowed

# Solution: Add to allowed_tools
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob", "Bash"],
    permission_mode="acceptEdits"
)
```

#### 4. Agent Not Found

```bash
# Error: Agent 'my-agent' not found

# Check agent location
ls -la .claude/agents/
ls -la ~/.claude/agents/

# Verify agent file format
cat .claude/agents/my-agent.md

# Ensure frontmatter is valid YAML
```

#### 5. Rate Limited

```python
# Error: RateLimitError

# Solution: Implement retry with backoff
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
async def query_with_retry(prompt: str, options: ClaudeAgentOptions):
    async for message in query(prompt=prompt, options=options):
        yield message
```

#### 6. Docker Build Fails

```bash
# Error: npm install fails in Docker

# Solution: Use multi-stage build
# See Dockerfile example above

# Clear npm cache
docker build --no-cache .
```

### Debug Mode

```bash
# Enable verbose logging
export CLAUDE_DEBUG=1
claude -p "task" --verbose

# Python SDK debugging
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Getting Help

```bash
# CLI help
claude --help
claude /help

# Report issues
# https://github.com/anthropics/claude-code/issues
```

---

## Quick Reference

### Installation Commands

| Method | Command |
|--------|---------|
| CLI (npm) | `npm install -g @anthropic-ai/claude-code` |
| SDK (Python) | `pip install claude-agent-sdk` |
| SDK (Node) | `npm install @anthropic-ai/claude-agent-sdk` |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | API authentication |
| `CLAUDE_CODE_USE_BEDROCK` | Use AWS Bedrock |
| `CLAUDE_CODE_USE_VERTEX` | Use Google Vertex |
| `CLAUDE_DEBUG` | Enable debug logging |

### File Locations

| Path | Purpose |
|------|---------|
| `.claude/agents/` | Project agents |
| `~/.claude/agents/` | User agents |
| `.claude/settings.json` | Project settings |
| `~/.claude/settings.json` | User settings |

---

*Part of [Claude Code Agent Documentation](../reference/README.md)*
