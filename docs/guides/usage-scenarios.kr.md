# 사용 시나리오 가이드

> **버전**: 1.0.0
> **대상 독자**: 모든 사용자
> **최종 업데이트**: 2026-03-28

이 가이드는 AD-SDLC의 8가지 일반적인 배포 패턴을 설명합니다. 각 시나리오는 사전 요구사항, 설정 명령어, 예상 동작을 다룹니다. 빠른 참조 표 또는 의사결정 흐름도를 사용하여 상황에 맞는 시나리오를 찾으세요.

## 목차

1. [빠른 참조](#빠른-참조)
2. [시나리오 선택하기](#시나리오-선택하기)
3. [시나리오 A: 신규 프로젝트 (Greenfield)](#시나리오-a-신규-프로젝트-greenfield)
4. [시나리오 B: 신규 프로젝트 — 로컬 모드](#시나리오-b-신규-프로젝트--로컬-모드)
5. [시나리오 C: 기존 프로젝트 개선 (Enhancement)](#시나리오-c-기존-프로젝트-개선-enhancement)
6. [시나리오 D: 이슈에서 가져오기 (Import)](#시나리오-d-이슈에서-가져오기-import)
7. [시나리오 E: Docker 단일 인스턴스 (Tier A)](#시나리오-e-docker-단일-인스턴스-tier-a)
8. [시나리오 F: Docker 병렬 인스턴스 (Tier B)](#시나리오-f-docker-병렬-인스턴스-tier-b)
9. [시나리오 G: CI/CD 비대화형 자동화](#시나리오-g-cicd-비대화형-자동화)
10. [시나리오 H: Claude Code 세션 내부에서 실행](#시나리오-h-claude-code-세션-내부에서-실행)
11. [승인 모드 참조](#승인-모드-참조)
12. [문제 해결](#문제-해결)

---

## 빠른 참조

| 시나리오                      | 모드                | GitHub 필요 | Docker      | 적합한 상황                            |
| ----------------------------- | ------------------- | ----------- | ----------- | -------------------------------------- |
| A: 신규 프로젝트 (Greenfield) | `greenfield`        | 예          | 아니오      | GitHub 통합으로 새로 시작하는 경우     |
| B: 신규 프로젝트 — 로컬 모드  | `greenfield`        | 아니오      | 아니오      | 오프라인 또는 제한된 환경              |
| C: 기존 프로젝트 개선         | `enhancement`       | 예          | 아니오      | 기존 코드베이스에 기능 추가            |
| D: 이슈에서 가져오기          | `import`            | 선택        | 아니오      | 미리 생성된 GitHub 이슈로 작업         |
| E: Docker 단일 인스턴스       | `greenfield` / 모두 | 예          | 예 (Tier A) | 격리된, 재현 가능한 단일 에이전트 실행 |
| F: Docker 병렬 인스턴스       | `greenfield` / 모두 | 예          | 예 (Tier B) | 별도 워크트리를 편집하는 동시 에이전트 |
| G: CI/CD 비대화형 (headless)  | 모두                | 예          | 선택        | 사람의 승인 없이 자동화된 파이프라인   |
| H: Claude Code 내부           | 모두                | 선택        | 아니오      | Claude Code 세션 내에서 AD-SDLC 실행   |

---

## 시나리오 선택하기

```
시작 지점: 무엇이 필요한가요?
├── 새 프로젝트를 처음부터 시작
│   ├── GitHub 통합 사용 가능 → 시나리오 A
│   └── GitHub 없음 / 오프라인  → 시나리오 B
├── 기존 코드베이스에 기능 추가  → 시나리오 C
├── 기존 GitHub 이슈로 작업      → 시나리오 D
├── 재현 가능한 격리 컨테이너 필요
│   ├── 단일 에이전트 / 하나의 워크트리   → 시나리오 E
│   └── 여러 에이전트 / 병렬 편집         → 시나리오 F
├── 프롬프트 없이 CI/CD에서 자동화        → 시나리오 G
└── 활성화된 Claude Code 세션 내부에서 실행 → 시나리오 H
```

---

## 시나리오 A: 신규 프로젝트 (Greenfield)

Greenfield (신규 프로젝트)는 완전히 새 프로젝트를 시작하고 전체 파이프라인을 원할 때 사용합니다: 요구사항 수집, 문서 생성, GitHub 이슈 생성, 구현, PR 리뷰.

### 사전 요구사항

- 환경에 `ANTHROPIC_API_KEY` 설정
- `GITHUB_TOKEN` 또는 활성화된 `gh auth login` 세션
- Node.js 18+, Git 2.30+, GitHub CLI 2.0+

### 설정

```bash
# AD-SDLC 설치
npm install -g ad-sdlc

# 새 프로젝트 초기화
ad-sdlc init my-project
cd my-project

# 전체 greenfield 파이프라인 실행
ad-sdlc run "Implement user authentication with JWT and refresh tokens" \
  --mode greenfield
```

### 동작 방식

13단계 Greenfield 파이프라인이 순서대로 실행됩니다:

| 단계           | 에이전트                          | 출력                  |
| -------------- | --------------------------------- | --------------------- |
| 1. 모드 감지   | Mode Detector                     | 파이프라인 선택       |
| 2. 저장소 설정 | Repo Detector / GitHub Repo Setup | GitHub 저장소         |
| 3. 요구사항    | Collector                         | `collected_info.yaml` |
| 4. PRD         | PRD Writer                        | `docs/PRD-*.md`       |
| 5. SRS         | SRS Writer                        | `docs/SRS-*.md`       |
| 6. SDS         | SDS Writer                        | `docs/SDS-*.md`       |
| 7. 이슈        | Issue Generator                   | GitHub 이슈           |
| 8. 계획        | Controller                        | 작업 배분             |
| 9-12. 구현     | Worker (최대 5개 병렬)            | 소스 코드 + 테스트    |
| 13. 리뷰       | PR Reviewer                       | Pull Request          |

### 예상 출력

- 생성된 문서: `docs/PRD-001.md`, `docs/SRS-001.md`, `docs/SDS-001.md`
- SDS 컴포넌트와 연결된 GitHub 이슈
- 테스트가 포함된 `src/` 내 소스 코드
- 리뷰 준비가 완료된 오픈 Pull Request

### 팁

1. 간결하지만 구체적인 요구사항을 제공하세요 — 필요한 경우 Collector 에이전트가 추가 질문을 합니다.
2. `--stop-after <stage>` 옵션으로 수동 검토를 위해 특정 단계에서 파이프라인을 일시 중지할 수 있습니다.

---

## 시나리오 B: 신규 프로젝트 — 로컬 모드

GitHub를 사용할 수 없거나 사용하고 싶지 않을 때 사용합니다. 파이프라인이 이슈 생성 및 PR 작업을 건너뛰고 모든 문서와 코드를 로컬에 생성합니다.

### 사전 요구사항

- `ANTHROPIC_API_KEY`만 필요 — GitHub 토큰 불필요
- Node.js 18+, Git

### 설정

```bash
# 설치 및 초기화
npm install -g ad-sdlc
ad-sdlc init my-project
cd my-project

# GitHub 없이 실행
ad-sdlc run "Build a REST API for inventory management" \
  --mode greenfield \
  --local
```

플래그 대신 환경 변수를 설정할 수도 있습니다:

```bash
export AD_SDLC_LOCAL=1
ad-sdlc run "Build a REST API for inventory management" --mode greenfield
```

### 시나리오 A와의 차이점

| 단계        | 시나리오 A (GitHub) | 시나리오 B (로컬) |
| ----------- | ------------------- | ----------------- |
| 저장소 생성 | GitHub 저장소 생성  | 건너뜀            |
| 이슈 생성   | GitHub 이슈 생성    | 건너뜀            |
| PR 생성     | Pull Request 오픈   | 건너뜀            |
| 문서        | 저장소의 `docs/`    | 로컬의 `docs/`    |
| 코드        | 브랜치에 커밋       | `src/`에 작성     |

---

## 시나리오 C: 기존 프로젝트 개선 (Enhancement)

Enhancement (기존 프로젝트 개선)는 프로젝트에 이미 문서(`docs/prd/`, `docs/srs/`, `docs/sds/`)와 소스 코드가 있을 때 사용합니다. Enhancement 파이프라인은 대상화된 업데이트를 수행하기 전에 기존 상태를 분석합니다.

### 사전 요구사항

- `docs/` (PRD/SRS/SDS)와 `src/` 디렉토리가 있는 기존 프로젝트
- `ANTHROPIC_API_KEY` 및 GitHub 접근 권한 (오프라인 사용 시 `--local`)

### 설정

```bash
cd your-existing-project

# 아직 하지 않은 경우 AD-SDLC 초기화
ad-sdlc init

# enhancement 파이프라인 실행
ad-sdlc run "Add OAuth2 social login with Google and GitHub providers" \
  --mode enhancement
```

기존 문서와 코드가 감지되면 시스템이 Enhancement 모드를 자동으로 선택합니다. 확실히 하려면 `--mode enhancement`로 명시적으로 지정하세요.

### 14단계 Enhancement 파이프라인

| 단계               | 에이전트                              | 비고                         |
| ------------------ | ------------------------------------- | ---------------------------- |
| 1-2. 분석 (병렬)   | Document Reader, Codebase Analyzer    | 기존 상태 병렬 읽기          |
| 3. 영향 분석       | Impact Analyzer                       | 위험 보고서 — 승인 게이트    |
| 4-6. 문서 업데이트 | PRD Updater, SRS Updater, SDS Updater | 순차적, 문서마다 승인 게이트 |
| 7. 이슈 생성       | Issue Generator                       | 변경된 컴포넌트 기반         |
| 8-9. 실행 (병렬)   | Worker, Regression Tester             | 코드 + 회귀 검사             |
| 10. 리뷰           | PR Reviewer                           | 회귀 보고서가 포함된 PR      |

### 예시: 인증 추가

```bash
# 1단계: enhancement 파이프라인 실행
ad-sdlc run "Add JWT authentication middleware to all protected routes" \
  --mode enhancement

# 2단계: 승인 전 영향 보고서 검토
cat .ad-sdlc/scratchpad/impact_report.yaml

# 3단계: 프롬프트에 따라 각 승인 게이트에서 승인 또는 거부
```

Impact Analyzer는 코드 변경이 이루어지기 전에 영향을 받는 컴포넌트와 테스트를 식별하여 초기에 위험을 평가할 수 있게 합니다.

---

## 시나리오 D: 이슈에서 가져오기 (Import)

Import (이슈에서 가져오기)는 GitHub 이슈가 이미 존재하고 문서 생성을 완전히 건너뛰고 싶을 때 사용합니다. 파이프라인이 기존 이슈를 읽고 바로 구현으로 진행합니다.

### 사전 요구사항

- 오픈 이슈가 있는 GitHub 저장소 (GitHub 모드의 경우), 또는
- 로컬 `issue_list.json` 파일 (로컬 모드의 경우)

### GitHub 이슈 사용

```bash
# GitHub 이슈에서 가져와서 구현
ad-sdlc run "" --mode import
```

Issue Reader 에이전트가 설정된 저장소에서 오픈 이슈를 가져오고 Controller에 작업 배분을 위해 전달합니다.

### 로컬 이슈 파일 사용

`issue_list.json` 파일을 생성합니다:

```json
[
  {
    "id": 1,
    "title": "Add user registration endpoint",
    "body": "POST /auth/register — accept email, password, name",
    "labels": ["type/feature", "priority/high"]
  },
  {
    "id": 2,
    "title": "Add input validation for registration",
    "body": "Validate email format and password strength",
    "labels": ["type/feature"]
  }
]
```

그런 다음 실행합니다:

```bash
ad-sdlc run "" --mode import --local
```

`--local`이 활성화된 경우 파이프라인이 `issue_list.json`에서 읽어 GitHub 호출을 완전히 건너뜁니다.

---

## 시나리오 E: Docker 단일 인스턴스 (Tier A)

단일 Claude Code 에이전트를 위한 재현 가능한 컨테이너 환경이 필요할 때 사용합니다. 모든 컨테이너가 동일한 워크스페이스 디렉토리를 공유합니다.

### 사전 요구사항

- Docker 24.0+
- Docker Compose 2.20+
- 이 저장소의 `docker/` 디렉토리

### 설정

```bash
cd docker/

# 대화형 설치 프로그램 실행
./install.sh
```

설치 프로그램이 다음을 묻습니다:

1. 컨테이너 수 (1–10)
2. 프로젝트 디렉토리 경로 (`/workspace`로 마운트)
3. 인증 방법: OAuth (브라우저 로그인) 또는 API 키
4. 티어 선택: **A** (공유 소스)
5. 선택적 호스트 소스 디렉토리

설치 후 생성되는 파일: `.env`, `docker-compose.yml`, `docker-compose.linux.yml`.

Linux/WSL에서 UID/GID 매핑으로 컨테이너를 시작합니다:

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.linux.yml up -d
```

macOS에서:

```bash
docker compose up -d
```

### 명령어 실행

```bash
# 컨테이너 A에서 Claude Code 열기
docker compose exec claude-a claude

# 셸 열기
docker compose exec claude-a bash

# 로그 보기
docker compose logs -f claude-a

# 모든 컨테이너 중지
docker compose down
```

### Git 안전성

Tier A 컨테이너는 단일 워킹 트리를 공유합니다. 동시 `git` 작업으로 인한 인덱스 손상을 방지하기 위해, 컨테이너 내부의 모든 git 호출은 `flock` 기반 래퍼를 통해 직렬화됩니다:

```bash
# 컨테이너 내부에서 git-safe가 파일시스템 잠금으로 git을 감쌈
/usr/local/bin/git-safe commit -m "Add feature"
```

두 컨테이너가 동시에 커밋을 시도해도 한 번에 하나만 진행합니다.

---

## 시나리오 F: Docker 병렬 인스턴스 (Tier B)

여러 에이전트가 서로 간섭 없이 동시에 코드를 편집해야 할 때 사용합니다. 각 컨테이너는 별도의 브랜치에서 자체 git 워크트리 (worktree)를 받습니다.

### 사전 요구사항

- 시나리오 E와 동일, 추가로 N개 워크트리 복사본을 위한 충분한 디스크 공간
- 프로젝트가 git 저장소여야 합니다

### 워크트리 설정

```bash
cd docker/

# 2개 컨테이너용 워크트리 생성
./scripts/setup-worktrees.sh /path/to/your/project 2

# 출력:
# Created worktree: /path/to/your/project-a (branch: worktree-a)
# Created worktree: /path/to/your/project-b (branch: worktree-b)
#
# Add to .env:
#   PROJECT_DIR_A=/path/to/your/project-a
#   PROJECT_DIR_B=/path/to/your/project-b
```

출력된 `PROJECT_DIR_*` 항목을 `docker/.env`에 추가한 후 설치 프로그램을 실행합니다:

```bash
./install.sh
# 프롬프트에서 Tier B 선택
```

### 병렬 실행

두 컨테이너를 시작하고 독립적인 작업을 동시에 실행합니다:

```bash
# 모든 컨테이너 시작
docker compose -f docker-compose.yml -f docker-compose.worktree.yml up -d

# 컨테이너 A는 피처 브랜치 A에서 작업
docker compose exec claude-a claude

# 컨테이너 B는 피처 브랜치 B에서 작업 (별도 워크트리, 충돌 없음)
docker compose exec claude-b claude
```

각 컨테이너는 완전하고 독립적인 워킹 트리 복사본을 가집니다. `project-a`의 변경사항은 `project-b`에 영향을 주지 않습니다.

### Tier A vs Tier B 비교

| 기능          | Tier A (공유 소스)     | Tier B (Git 워크트리) |
| ------------- | ---------------------- | --------------------- |
| 디스크 사용량 | 낮음 (1x 소스)         | 높음 (Nx 소스)        |
| 동시 편집     | flock으로 직렬화       | 완전 병렬             |
| 브랜치 격리   | 공유 브랜치            | 컨테이너별 브랜치     |
| 설정 복잡도   | 간단                   | 워크트리 초기화 필요  |
| 적합한 상황   | 읽기 위주, 단일 작성자 | 여러 활성 작성자      |

---

## 시나리오 G: CI/CD 비대화형 자동화

대화형 승인 게이트 없이 CI/CD에서 AD-SDLC 파이프라인을 실행하려면 이 시나리오를 사용합니다. 파이프라인이 사람의 입력을 기다리지 않고 진행하도록 승인 모드를 `auto`로 설정합니다.

### 사전 요구사항

- CI 환경 (GitHub Actions, GitLab CI, Jenkins 등)
- 저장소 시크릿으로 저장된 `ANTHROPIC_API_KEY` 및 `GITHUB_TOKEN`

### GitHub Actions 예시

```yaml
name: AD-SDLC Automated Pipeline

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      requirements:
        description: 'Feature requirements text'
        required: true

jobs:
  ad-sdlc:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install AD-SDLC
        run: npm install -g ad-sdlc

      - name: Initialize project
        run: ad-sdlc init --quick

      - name: Run pipeline
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          ad-sdlc run "${{ github.event.inputs.requirements || 'Analyze and improve code quality' }}" \
            --mode greenfield \
            --yes
```

### CI를 위한 주요 플래그

| 플래그                  | 목적                                                   |
| ----------------------- | ------------------------------------------------------ |
| `--yes`                 | 첫 실행 시 개인정보 정책 프롬프트 자동 수락            |
| `--local`               | 모든 GitHub 호출 건너뜀 (빌드 전용 파이프라인에 유용)  |
| `--dry-run`             | 에이전트 실행 없이 구성 검증                           |
| `--stop-after <stage>`  | 특정 단계 후 중단 (예: `sds`로 문서 생성 후 중지)      |
| `--resume <session-id>` | 이전에 중단된 파이프라인 재개                          |
| `--mode <mode>`         | `greenfield`, `enhancement`, 또는 `import` 명시적 설정 |

### CI용 승인 모드

CI에서 실행할 때 파이프라인이 사람의 입력을 기다리며 차단되어서는 안 됩니다. `.ad-sdlc/config/workflow.yaml`에서 승인 모드를 구성합니다:

```yaml
execution:
  approval_mode: auto # 사람의 승인 없이 모든 승인 게이트 통과
  max_parallel_workers: 3
```

사용 가능한 값:

| 모드       | 동작                                  |
| ---------- | ------------------------------------- |
| `auto`     | 모든 승인 게이트가 자동으로 통과      |
| `manual`   | 모든 게이트에서 명시적 사람 승인 필요 |
| `critical` | 위험도가 높은 게이트만 승인 필요      |
| `custom`   | `workflow.yaml`에서 단계별 구성       |

CI에서는 `auto`를 사용하고, 진행하기 전에 영향 보고서를 검토하려는 로컬 개발 시에는 `manual` 또는 `critical`을 사용하세요.

---

## 시나리오 H: Claude Code 세션 내부에서 실행

AD-SDLC가 독립 프로세스가 아닌 활성화된 Claude Code 세션 내에서 하위 에이전트로 실행될 때 사용합니다. `ClaudeCodeBridge`가 스크래치패드 파일 시스템을 통해 모든 에이전트 통신을 처리합니다.

### 동작 방식

Claude Code 세션 내에서 AD-SDLC 에이전트는 직접 프로세스 호출이 아닌 스크래치패드 디렉토리를 통해 통신합니다:

1. 오케스트레이터가 `.ad-sdlc/scratchpad/input/<agent-type>.json`에 에이전트 요청을 작성
2. Claude Code의 Task 도구가 입력 파일을 읽고 하위 에이전트를 생성
3. 하위 에이전트가 결과를 `.ad-sdlc/scratchpad/output/<agent-type>.json`에 작성
4. `ClaudeCodeBridge`가 출력 파일을 폴링하고 응답을 반환

### 예시

Claude Code 대화 내에서:

```bash
# 프로젝트 초기화 (한 번만 실행)
ad-sdlc init my-project
cd my-project

# 파이프라인 실행 — Claude Code 하위 에이전트가 각 단계 처리
ad-sdlc run "Add search functionality to the product catalog" \
  --mode enhancement
```

Claude Code가 스크래치패드 브리지를 통해 각 에이전트 호출을 자동으로 라우팅합니다. 추가 구성이 필요하지 않습니다.

### 스크래치패드 I/O

스크래치패드 디렉토리 레이아웃:

```
.ad-sdlc/
└── scratchpad/
    ├── input/
    │   ├── collector.json        # 오케스트레이터가 여기에 작성
    │   └── prd-writer.json
    └── output/
        ├── collector.json        # 하위 에이전트가 결과를 여기에 작성
        └── prd-writer.json
```

`ClaudeCodeBridge`는 1초마다 출력 파일을 폴링하며, 에이전트당 기본 타임아웃은 5분입니다. 에이전트 실행 시간이 더 길 것으로 예상되는 경우 브리지 구성에서 두 값 모두 재정의할 수 있습니다.

---

## 승인 모드 참조

| 모드       | 동작                                     | 사용 사례                                 |
| ---------- | ---------------------------------------- | ----------------------------------------- |
| `auto`     | 프롬프트 없이 모든 게이트 통과           | CI/CD, 완전 자동화 실행                   |
| `manual`   | 모든 게이트에서 명시적 `y` 입력 필요     | 로컬 개발, 첫 번째 실행                   |
| `critical` | `risk: high`로 표시된 게이트만 입력 필요 | 프로덕션 인접 워크플로우에 균형 잡힌 방식 |
| `custom`   | `workflow.yaml`에서 단계별 재정의        | 특정 요구사항이 있는 혼합 환경            |

`.ad-sdlc/config/workflow.yaml`에서 구성합니다:

```yaml
execution:
  approval_mode: manual # 또는: auto, critical, custom
```

---

## 문제 해결

### 시나리오별 일반적인 문제

| 문제                                | 시나리오   | 해결책                                                      |
| ----------------------------------- | ---------- | ----------------------------------------------------------- |
| `❌ No AD-SDLC configuration found` | A, B, C, D | 먼저 `ad-sdlc init` 실행                                    |
| GitHub 속도 제한 초과               | A, C, D    | 재설정 대기 또는 `max_parallel_workers` 감소                |
| 승인 게이트에서 파이프라인 중단     | A, C, G    | CI에서는 `approval_mode: auto` 사용, 또는 `y` 입력하여 진행 |
| 워크트리가 이미 존재함              | F          | `git worktree remove <path>`로 제거 후 설정 재실행          |
| 컨테이너가 즉시 종료됨              | E, F       | 오류는 `docker compose logs claude-a`에서 확인              |
| 에이전트 타임아웃 (5분 초과)        | H          | 브리지 구성에서 `timeoutMs` 증가                            |
| `AD_SDLC_LOCAL` 무시됨              | B, D       | 변수가 내보내졌는지 확인: `export AD_SDLC_LOCAL=1`          |
| 잘못된 모드 자동 감지               | C          | `--mode enhancement` 명시적 지정                            |

자세한 오류 코드 및 복구 절차는 [문제 해결 가이드](troubleshooting.md)를 참조하세요.

---

_[Claude Code Agent 문서](../README.md)의 일부입니다._
