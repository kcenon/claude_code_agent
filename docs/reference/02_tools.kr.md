# 내장 도구 레퍼런스

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [도구 개요](#도구-개요)
2. [파일 도구](#파일-도구)
3. [실행 도구](#실행-도구)
4. [웹 도구](#웹-도구)
5. [에이전트 도구](#에이전트-도구)
6. [관리 도구](#관리-도구)
7. [도구 권한 설정](#도구-권한-설정)

---

## 도구 개요

### 도구 분류

| 카테고리 | 도구 | 위험도 | 설명 |
|----------|------|--------|------|
| **파일** | Read, Write, Edit, Glob, Grep | 낮음-중간 | 파일 시스템 작업 |
| **실행** | Bash, NotebookEdit | 높음 | 명령 실행 |
| **웹** | WebSearch, WebFetch | 낮음 | 웹 정보 검색 |
| **에이전트** | Task, AskUserQuestion | 중간 | 서브에이전트, 사용자 상호작용 |
| **관리** | TodoWrite, ListMcpResources, ReadMcpResource | 낮음 | 작업/리소스 관리 |

### 도구 선택 가이드

```
읽기 전용 분석     → Read, Glob, Grep
코드 수정         → Read, Write, Edit, Glob, Grep
테스트 실행       → Bash, Read, Grep
외부 정보 조회    → WebSearch, WebFetch
복잡한 워크플로우  → Task (서브에이전트)
사용자 확인 필요  → AskUserQuestion
```

---

## 파일 도구

### Read

파일 내용을 읽습니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `file_path` | string | Yes | 읽을 파일의 절대 경로 |
| `offset` | number | No | 시작 줄 번호 (큰 파일용) |
| `limit` | number | No | 읽을 줄 수 (기본: 2000) |

**특징:**
- 기본적으로 시작부터 2000줄 읽음
- 2000자 이상의 줄은 잘림
- 이미지 파일 (PNG, JPG 등) 시각적 분석 가능
- PDF 파일 페이지별 텍스트/시각 콘텐츠 추출
- Jupyter 노트북 (.ipynb) 셀 및 출력 포함

**예제:**

```python
# 파일 전체 읽기
options = ClaudeAgentOptions(allowed_tools=["Read"])
prompt = "src/main.py 파일을 읽고 분석하세요"

# 큰 파일의 특정 부분 읽기
prompt = "package.json의 처음 50줄을 읽어주세요"

# 이미지 분석
prompt = "screenshots/error.png를 보고 문제를 분석하세요"
```

---

### Write

새 파일을 생성하거나 기존 파일을 덮어씁니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `file_path` | string | Yes | 파일의 절대 경로 |
| `content` | string | Yes | 파일에 쓸 내용 |

**주의사항:**
- 기존 파일이 있으면 덮어씀
- 기존 파일을 수정할 때는 먼저 Read로 읽어야 함
- 문서 파일 (*.md, README)은 요청 시에만 생성

**예제:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write"],
    permission_mode="acceptEdits"
)
prompt = "새로운 utils/helpers.py 파일을 생성하세요"
```

---

### Edit

기존 파일에서 정확한 문자열 교체를 수행합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `file_path` | string | Yes | 파일의 절대 경로 |
| `old_string` | string | Yes | 교체할 원본 텍스트 |
| `new_string` | string | Yes | 새 텍스트 |
| `replace_all` | boolean | No | 모든 일치 항목 교체 (기본: false) |

**동작 방식:**
- `old_string`이 파일에서 고유해야 함
- 고유하지 않으면 더 많은 컨텍스트 포함 필요
- `replace_all=true`로 모든 일치 항목 교체 가능

**예제:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Edit"],
    permission_mode="acceptEdits"
)

# 특정 코드 수정
prompt = "calculateTotal 함수의 버그를 수정하세요"

# 변수명 일괄 변경
prompt = "oldName 변수를 newName으로 모두 변경하세요"
```

---

### Glob

패턴으로 파일을 검색합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `pattern` | string | Yes | Glob 패턴 |
| `path` | string | No | 검색 시작 디렉토리 |

**지원 패턴:**
- `**/*.js` - 모든 하위 디렉토리의 JS 파일
- `src/**/*.ts` - src 아래 모든 TS 파일
- `*.{js,ts}` - JS 또는 TS 파일
- `test_*.py` - test_로 시작하는 Python 파일

**예제:**

```python
options = ClaudeAgentOptions(allowed_tools=["Glob", "Read"])

# 모든 TypeScript 파일 찾기
prompt = "프로젝트의 모든 TypeScript 파일을 찾아 나열하세요"

# 특정 패턴의 파일 찾기
prompt = "테스트 파일들을 모두 찾아주세요"
```

---

### Grep

정규식으로 파일 내용을 검색합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `pattern` | string | Yes | 검색할 정규식 |
| `path` | string | No | 검색 경로 |
| `glob` | string | No | 파일 필터 (예: "*.js") |
| `type` | string | No | 파일 타입 (js, py, rust 등) |
| `output_mode` | string | No | "content" \| "files_with_matches" \| "count" |
| `-i` | boolean | No | 대소문자 무시 |
| `-A`, `-B`, `-C` | number | No | 컨텍스트 줄 수 |
| `multiline` | boolean | No | 여러 줄 패턴 매칭 |

**예제:**

```python
options = ClaudeAgentOptions(allowed_tools=["Grep", "Read"])

# TODO 주석 찾기
prompt = "코드베이스에서 모든 TODO 주석을 찾아주세요"

# 특정 함수 사용 위치 찾기
prompt = "authenticateUser 함수를 호출하는 모든 곳을 찾아주세요"

# 에러 패턴 검색
prompt = "catch 블록에서 에러를 무시하는 곳을 찾아주세요"
```

---

## 실행 도구

### Bash

터미널 명령을 실행합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `command` | string | Yes | 실행할 명령 |
| `timeout` | number | No | 타임아웃 (ms, 최대 600000) |
| `run_in_background` | boolean | No | 백그라운드 실행 |
| `description` | string | No | 명령 설명 (5-10단어) |

**보안 고려사항:**
- 위험한 명령 자동 차단 (rm -rf /, dd 등)
- 훅으로 추가 검증 권장
- 권한 규칙으로 특정 명령만 허용 가능

**예제:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Bash", "Read"],
    permission_mode="acceptEdits",
    hooks={
        "PreToolUse": [
            HookMatcher(matcher="Bash", hooks=[validate_bash])
        ]
    }
)

# 테스트 실행
prompt = "npm test를 실행하고 실패한 테스트를 분석하세요"

# 빌드 실행
prompt = "프로젝트를 빌드하고 에러를 수정하세요"

# Git 작업
prompt = "현재 변경사항을 커밋하세요"
```

**허용 명령 예시 (settings.json):**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(git status:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  }
}
```

---

### NotebookEdit

Jupyter 노트북 셀을 편집합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `notebook_path` | string | Yes | 노트북 파일 절대 경로 |
| `cell_id` | string | No | 편집할 셀 ID |
| `new_source` | string | Yes | 새 셀 내용 |
| `cell_type` | string | No | "code" \| "markdown" |
| `edit_mode` | string | No | "replace" \| "insert" \| "delete" |

**예제:**

```python
options = ClaudeAgentOptions(allowed_tools=["Read", "NotebookEdit"])
prompt = "analysis.ipynb의 데이터 시각화 셀을 개선하세요"
```

---

## 웹 도구

### WebSearch

웹 검색을 수행합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `query` | string | Yes | 검색 쿼리 (최소 2자) |
| `allowed_domains` | string[] | No | 허용 도메인 목록 |
| `blocked_domains` | string[] | No | 차단 도메인 목록 |

**특징:**
- 실시간 웹 정보 검색
- 지식 컷오프 이후 정보 접근 가능
- 결과에 출처 URL 포함

**예제:**

```python
options = ClaudeAgentOptions(allowed_tools=["WebSearch", "Read"])

# 최신 문서 검색
prompt = "React 19의 새로운 기능을 검색하고 설명해주세요"

# 특정 도메인만 검색
prompt = "GitHub에서 이 라이브러리의 최신 이슈를 검색하세요"
```

---

### WebFetch

웹 페이지 내용을 가져와 분석합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `url` | string | Yes | 가져올 URL |
| `prompt` | string | Yes | 내용 분석 프롬프트 |

**특징:**
- HTML을 마크다운으로 변환
- 작은 모델로 빠른 처리
- 15분 캐시 (동일 URL 재요청 시)
- 리다이렉트 URL 제공

**예제:**

```python
options = ClaudeAgentOptions(allowed_tools=["WebFetch"])

# API 문서 분석
prompt = "https://docs.example.com/api 페이지를 읽고 인증 방법을 설명하세요"

# 에러 페이지 분석
prompt = "이 스택오버플로우 링크에서 해결책을 찾아주세요"
```

---

## 에이전트 도구

### Task

서브에이전트에 작업을 위임합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `prompt` | string | Yes | 수행할 작업 |
| `description` | string | Yes | 작업 설명 (3-5단어) |
| `subagent_type` | string | Yes | 에이전트 유형 |
| `model` | string | No | 사용할 모델 |
| `resume` | string | No | 재개할 에이전트 ID |
| `run_in_background` | boolean | No | 백그라운드 실행 |

**내장 에이전트 유형:**

| 유형 | 도구 | 용도 |
|------|------|------|
| `general-purpose` | 전체 | 복잡한 멀티스텝 작업 |
| `Explore` | 전체 | 코드베이스 탐색 |
| `Plan` | 전체 | 구현 계획 설계 |
| `claude-code-guide` | Glob, Grep, Read, WebFetch, WebSearch | Claude Code 문서 조회 |

**예제:**

```python
options = ClaudeAgentOptions(
    allowed_tools=["Task", "Read"],
    agents={
        "security-auditor": AgentDefinition(
            description="보안 취약점 분석 전문가",
            prompt="OWASP Top 10 취약점을 중심으로 분석하세요",
            tools=["Read", "Grep", "Glob"]
        )
    }
)

prompt = "security-auditor 에이전트로 auth 모듈을 분석하세요"
```

---

### AskUserQuestion

사용자에게 질문합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `questions` | array | Yes | 질문 목록 (1-4개) |

**질문 구조:**

```python
{
    "question": "어떤 데이터베이스를 사용하시겠습니까?",
    "header": "DB 선택",  # 최대 12자
    "options": [
        {"label": "PostgreSQL (권장)", "description": "관계형 DB, 복잡한 쿼리에 적합"},
        {"label": "MongoDB", "description": "NoSQL, 유연한 스키마"},
        {"label": "SQLite", "description": "경량, 로컬 개발용"}
    ],
    "multiSelect": False
}
```

**예제:**

```python
options = ClaudeAgentOptions(allowed_tools=["AskUserQuestion", "Read", "Write"])

prompt = """인증 시스템을 구현하세요.
구현 전에 사용자에게 OAuth 제공자와 세션 저장소를 확인하세요."""
```

---

## 관리 도구

### TodoWrite

작업 목록을 관리합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `todos` | array | Yes | 작업 목록 |

**작업 구조:**

```python
{
    "content": "테스트 실행",           # 수행할 작업 (명령형)
    "activeForm": "테스트 실행 중",     # 진행 중 표시 (현재진행형)
    "status": "pending"                # pending | in_progress | completed
}
```

**규칙:**
- 한 번에 하나의 `in_progress` 작업만
- 작업 완료 즉시 `completed`로 표시
- 복잡한 작업을 작은 단계로 분할

---

### ListMcpResources

MCP 서버 리소스를 나열합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `server` | string | No | 특정 서버 이름 |

---

### ReadMcpResource

MCP 서버에서 리소스를 읽습니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `uri` | string | Yes | 리소스 URI |

---

## 도구 권한 설정

### allowed_tools vs disallowed_tools

```python
# 방법 1: 허용 목록 (화이트리스트)
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep"]  # 이것만 사용 가능
)

# 방법 2: 차단 목록 (블랙리스트)
options = ClaudeAgentOptions(
    disallowed_tools=["Bash", "Write"]  # 이것 제외하고 모두 사용 가능
)

# 두 옵션을 함께 사용하면 안 됨!
```

### 용도별 도구 조합

```python
# 읽기 전용 분석
READ_ONLY = ["Read", "Glob", "Grep"]

# 코드 수정
CODE_MODIFY = ["Read", "Write", "Edit", "Glob", "Grep"]

# 전체 개발
FULL_DEV = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch"]

# 문서 작업
DOCS = ["Read", "Write", "Glob", "WebSearch", "WebFetch"]

# 리뷰 (서브에이전트 포함)
REVIEW = ["Read", "Glob", "Grep", "Task"]
```

### settings.json 권한 규칙

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Edit(src/**)",
      "Bash(npm:*)",
      "Bash(git:*)",
      "WebFetch(domain:docs.example.com)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Bash(rm:*)",
      "Bash(curl:*)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Write(package.json)"
    ]
  }
}
```

---

*이전: [Agent SDK](01_agent_sdk.md) | 다음: [훅 가이드](03_hooks.md)*
