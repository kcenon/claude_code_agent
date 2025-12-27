# Agent 배포 및 통합 가이드

> **버전**: 1.0.0
> **대상**: Claude Code Agent를 배포하는 개발자

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [설치 방법](#설치-방법)
3. [CLI 통합](#cli-통합)
4. [SDK 배포](#sdk-배포)
5. [컨테이너 배포](#컨테이너-배포)
6. [CI/CD 통합](#cicd-통합)
7. [프로덕션 고려사항](#프로덕션-고려사항)
8. [문제 해결](#문제-해결)

---

## 사전 요구사항

### 시스템 요구사항

| 구성요소 | 최소 | 권장 |
|---------|------|------|
| Python | 3.10+ | 3.11+ |
| Node.js | 18+ | 20+ |
| 메모리 | 4GB | 8GB+ |
| 디스크 | 1GB | 5GB+ |

### 필수 소프트웨어

```bash
# Python 버전 확인
python3 --version  # 3.10 이상

# Node.js 버전 확인
node --version     # 18 이상

# npm 버전 확인
npm --version
```

### 인증 설정

#### 옵션 1: API 키 (토큰당 과금)

```bash
# Anthropic API 키 설정
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# 확인
echo $ANTHROPIC_API_KEY
```

#### 옵션 2: Claude 구독 (Max/Pro)

```bash
# 구독 사용을 위해 API 키 제거
unset ANTHROPIC_API_KEY

# Claude Code CLI로 로그인
claude login
```

#### 옵션 3: 클라우드 제공자

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

## 설치 방법

### 방법 1: Claude Code CLI (개발에 권장)

```bash
# Claude Code CLI 전역 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version

# 프로젝트에서 초기화
cd your-project
claude init
```

### 방법 2: Agent SDK (커스텀 애플리케이션용)

```bash
# Python SDK
pip install claude-agent-sdk

# 또는 Poetry 사용
poetry add claude-agent-sdk

# 또는 pipx (격리된 환경)
pipx install claude-agent-sdk
```

```bash
# TypeScript/JavaScript SDK
npm install @anthropic-ai/claude-agent-sdk

# 또는 yarn 사용
yarn add @anthropic-ai/claude-agent-sdk
```

### 방법 3: 소스에서 설치

```bash
# 저장소 클론
git clone https://github.com/anthropics/claude-code.git
cd claude-code

# 의존성 설치
npm install

# 빌드
npm run build

# 전역으로 링크
npm link
```

---

## CLI 통합

### Claude Code CLI에 커스텀 에이전트 추가

#### 1단계: 에이전트 디렉토리 생성

```bash
# 프로젝트 수준 에이전트 (git으로 공유)
mkdir -p .claude/agents

# 사용자 수준 에이전트 (개인용, 모든 프로젝트)
mkdir -p ~/.claude/agents
```

#### 2단계: 에이전트 정의

`.claude/agents/your-agent.md` 생성:

```markdown
---
name: code-reviewer
description: |
  품질과 보안을 위한 전문 코드 리뷰어.
  코드 변경 후 선제적으로 사용.
  "리뷰", "코드 검사", "PR 리뷰" 키워드에 응답.
tools: Read, Grep, Glob, Bash
model: sonnet
---

당신은 시니어 코드 리뷰어입니다...

## 지침
1. 코드 변경 사항 분석
2. 보안 이슈 확인
3. 실행 가능한 피드백 제공
```

#### 3단계: 에이전트 등록 확인

```bash
# 사용 가능한 에이전트 목록
claude /agents

# 또는 대화형 모드에서
> /agents
```

#### 4단계: 에이전트 사용

```bash
# 명시적 호출
claude "code-reviewer로 마지막 커밋 리뷰해줘"

# 또는 Claude가 작업에 따라 자동 선택
claude "내 최근 변경사항 리뷰해줘"
```

### 에이전트 설정 옵션

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | 고유 식별자 (필수) |
| `description` | string | 이 에이전트를 사용할 시점 (필수) |
| `tools` | string | 쉼표로 구분된 도구 목록 |
| `model` | string | `sonnet`, `opus`, `haiku`, `inherit` |
| `permissionMode` | string | `default`, `acceptEdits`, `bypassPermissions` |
| `skills` | string | 자동 로드할 스킬 |

### 에이전트용 CLI 플래그

```bash
# CLI로 에이전트 지정
claude --agents '{
  "analyzer": {
    "description": "코드 분석기",
    "prompt": "코드 구조 분석...",
    "tools": ["Read", "Grep"]
  }
}'

# 비대화형 모드로 실행
claude -p "src/ 분석" --agents @agents.json

# 출력 형식 지정
claude -p "코드 리뷰" --output-format json
```

---

## SDK 배포

### 기본 SDK 설정

**Python:**

```python
# setup.py 또는 pyproject.toml
# 필요: claude-agent-sdk>=1.0.0

from claude_agent_sdk import query, ClaudeAgentOptions

async def run_agent():
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5-20251101",
        allowed_tools=["Read", "Grep", "Glob"],
        permission_mode="acceptEdits"
    )

    async for message in query(
        prompt="코드베이스 분석",
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
        prompt: "코드베이스 분석",
        options
    })) {
        console.log(message);
    }
}
```

### 에이전트를 모듈로 패키징

**프로젝트 구조:**

```
my-agent/
├── src/
│   ├── __init__.py
│   ├── agent.py          # 에이전트 구현
│   ├── tools.py          # 커스텀 MCP 도구
│   └── prompts.py        # 시스템 프롬프트
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
    "asyncpg>=0.28.0",  # 데이터베이스 사용 시
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
        return """당신은 전문화된 에이전트입니다..."""

    async def run(self, task: str) -> str:
        result = ""
        async for message in query(prompt=task, options=self.options):
            if hasattr(message, 'result') and message.result:
                result = message.result
        return result
```

### 에이전트 배포

```bash
# 패키지 빌드
python -m build

# PyPI에 게시
twine upload dist/*

# PyPI에서 설치
pip install my-custom-agent
```

---

## 컨테이너 배포

### Dockerfile

```dockerfile
# Dockerfile
FROM python:3.11-slim

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI용 Node.js 설치
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Claude Code CLI 설치
RUN npm install -g @anthropic-ai/claude-code

# 앱 디렉토리 생성
WORKDIR /app

# 요구사항 복사
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 에이전트 코드 복사
COPY src/ ./src/
COPY .claude/ ./.claude/

# 비루트 사용자 생성
RUN useradd -m -u 1000 agent
USER agent

# 환경 설정
ENV PYTHONPATH=/app

# 진입점
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
      # 분석용 코드 마운트 (읽기 전용)
      - ./workspace:/workspace:ro
      # 출력 디렉토리 마운트
      - ./outputs:/app/outputs
    # 보안 옵션
    security_opt:
      - no-new-privileges:true
    # 리소스 제한
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # 선택사항: 데이터베이스 접근이 있는 에이전트
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

### 컨테이너화된 에이전트 실행

```bash
# 빌드
docker-compose build

# 환경 변수와 함께 실행
ANTHROPIC_API_KEY=sk-ant-... docker-compose up agent

# 특정 작업 실행
docker-compose run --rm agent "/workspace/src 분석"

# 대화형 모드
docker-compose run --rm -it agent bash
```

### Kubernetes 배포

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

## CI/CD 통합

### GitHub Actions

```yaml
# .github/workflows/agent-review.yml
name: AI 코드 리뷰

on:
  pull_request:
    branches: [main, develop]

jobs:
  code-review:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # diff를 위한 전체 이력

    - name: Node.js 설정
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Python 설정
      uses: actions/setup-python@v5
      with:
        python-version: '3.11'

    - name: Claude Code 설치
      run: npm install -g @anthropic-ai/claude-code

    - name: 에이전트 의존성 설치
      run: pip install -r requirements.txt

    - name: 코드 리뷰 에이전트 실행
      env:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      run: |
        python src/review_agent.py \
          --target "${{ github.event.pull_request.base.sha }}..${{ github.sha }}" \
          --output review.md

    - name: 리뷰 코멘트 게시
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

### Jenkins 파이프라인

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
        stage('설정') {
            steps {
                sh '''
                    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                    apt-get install -y nodejs
                    npm install -g @anthropic-ai/claude-code
                    pip install -r requirements.txt
                '''
            }
        }

        stage('AI 코드 리뷰') {
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

        stage('AI 테스트 생성') {
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
                message: "AI 에이전트 실패: ${env.JOB_NAME} ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

---

## 프로덕션 고려사항

### 보안 모범 사례

```python
# config/security.py

# 1. 자격증명을 에이전트에 노출하지 않음
SAFE_ENV_VARS = {
    "NODE_ENV": "production",
    "LOG_LEVEL": "INFO",
    # API 키, 비밀번호 등을 포함하지 않음
}

# 2. 프로덕션에서 도구 제한
PRODUCTION_TOOLS = [
    "Read",
    "Grep",
    "Glob",
    # 제외: Write, Edit, Bash (필요하지 않으면)
]

# 3. 허용된 경로 정의
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

### 비용 관리

```python
# config/limits.py

class CostLimits:
    # 요청당 제한
    MAX_COST_PER_REQUEST = 1.0  # $1.00

    # 일일 제한
    MAX_DAILY_COST = 50.0  # $50.00

    # 턴 제한
    MAX_TURNS_PER_REQUEST = 30

    # 토큰 제한
    MAX_INPUT_TOKENS = 100000
    MAX_OUTPUT_TOKENS = 16000


async def cost_controlled_query(prompt: str, options: ClaudeAgentOptions):
    """비용 제어가 있는 쿼리"""
    total_cost = 0.0

    async for message in query(prompt=prompt, options=options):
        if hasattr(message, 'total_cost_usd'):
            total_cost = message.total_cost_usd

            if total_cost > CostLimits.MAX_COST_PER_REQUEST:
                raise CostLimitExceeded(
                    f"요청 비용 ${total_cost:.2f}가 제한 초과"
                )

        yield message
```

### 로깅 및 모니터링

```python
# config/logging.py
import logging
import json
from datetime import datetime

class AgentLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

        # 구조화된 로깅을 위한 JSON 포맷터
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        self.logger.addHandler(handler)

    def log_request(self, task: str, options: dict):
        self.logger.info(json.dumps({
            "event": "agent_request",
            "timestamp": datetime.utcnow().isoformat(),
            "task": task[:100],  # 잘라내기
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

### 헬스 체크

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
    """에이전트 실행 가능 여부 확인"""
    try:
        options = ClaudeAgentOptions(
            allowed_tools=[],
            max_turns=1
        )

        async for message in query(
            prompt="'OK'로 응답하세요",
            options=options
        ):
            if hasattr(message, 'subtype') and message.subtype == 'success':
                return {"status": "healthy", "agent": "operational"}

        raise HTTPException(500, "에이전트가 완료되지 않음")

    except Exception as e:
        raise HTTPException(500, f"에이전트 비정상: {str(e)}")
```

---

## 문제 해결

### 일반적인 문제

#### 1. CLI를 찾을 수 없음

```bash
# 오류: claude: command not found

# 해결책 1: 전역 설치
npm install -g @anthropic-ai/claude-code

# 해결책 2: PATH에 추가
export PATH="$PATH:$(npm config get prefix)/bin"

# 해결책 3: npx 사용
npx @anthropic-ai/claude-code --version
```

#### 2. 인증 실패

```bash
# 오류: AuthenticationError

# API 키 설정 확인
echo $ANTHROPIC_API_KEY

# 키 형식 확인 (sk-ant-로 시작해야 함)
# 구독의 경우 재로그인 시도
claude logout
claude login
```

#### 3. 권한 거부됨

```python
# 오류: Tool 'Bash' is not allowed

# 해결책: allowed_tools에 추가
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob", "Bash"],
    permission_mode="acceptEdits"
)
```

#### 4. 에이전트를 찾을 수 없음

```bash
# 오류: Agent 'my-agent' not found

# 에이전트 위치 확인
ls -la .claude/agents/
ls -la ~/.claude/agents/

# 에이전트 파일 형식 확인
cat .claude/agents/my-agent.md

# frontmatter가 유효한 YAML인지 확인
```

#### 5. 요청 제한

```python
# 오류: RateLimitError

# 해결책: 백오프와 함께 재시도 구현
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

#### 6. Docker 빌드 실패

```bash
# 오류: Docker에서 npm install 실패

# 해결책: 멀티 스테이지 빌드 사용
# 위의 Dockerfile 예시 참조

# npm 캐시 지우기
docker build --no-cache .
```

### 디버그 모드

```bash
# 상세 로깅 활성화
export CLAUDE_DEBUG=1
claude -p "작업" --verbose

# Python SDK 디버깅
import logging
logging.basicConfig(level=logging.DEBUG)
```

### 도움 받기

```bash
# CLI 도움말
claude --help
claude /help

# 이슈 보고
# https://github.com/anthropics/claude-code/issues
```

---

## 빠른 참조

### 설치 명령어

| 방법 | 명령어 |
|------|--------|
| CLI (npm) | `npm install -g @anthropic-ai/claude-code` |
| SDK (Python) | `pip install claude-agent-sdk` |
| SDK (Node) | `npm install @anthropic-ai/claude-agent-sdk` |

### 환경 변수

| 변수 | 용도 |
|------|------|
| `ANTHROPIC_API_KEY` | API 인증 |
| `CLAUDE_CODE_USE_BEDROCK` | AWS Bedrock 사용 |
| `CLAUDE_CODE_USE_VERTEX` | Google Vertex 사용 |
| `CLAUDE_DEBUG` | 디버그 로깅 활성화 |

### 파일 위치

| 경로 | 용도 |
|------|------|
| `.claude/agents/` | 프로젝트 에이전트 |
| `~/.claude/agents/` | 사용자 에이전트 |
| `.claude/settings.json` | 프로젝트 설정 |
| `~/.claude/settings.json` | 사용자 설정 |

---

*[Claude Code Agent 문서](../reference/README.kr.md)의 일부*
