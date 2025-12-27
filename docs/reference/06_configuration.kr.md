# 설정 및 권한 가이드

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [설정 계층](#설정-계층)
2. [설정 파일](#설정-파일)
3. [권한 시스템](#권한-시스템)
4. [권한 모드](#권한-모드)
5. [환경 변수](#환경-변수)
6. [모델 설정](#모델-설정)
7. [실전 설정 예제](#실전-설정-예제)

---

## 설정 계층

### 우선순위 (높음 → 낮음)

```
1. Enterprise 관리 설정     ← 조직 정책 (최고 우선순위)
2. 명령줄 인수              ← --model, --allowedTools 등
3. 로컬 프로젝트 설정       ← .claude/settings.local.json
4. 공유 프로젝트 설정       ← .claude/settings.json
5. 사용자 설정              ← ~/.claude/settings.json (최저 우선순위)
```

### 설정 범위

| 범위 | 파일 위치 | Git 공유 | 영향 범위 |
|------|-----------|----------|-----------|
| Enterprise | 시스템 관리 설정 | N/A | 조직 전체 |
| User | `~/.claude/settings.json` | ❌ | 모든 프로젝트 |
| Project | `.claude/settings.json` | ✅ | 해당 프로젝트 |
| Local | `.claude/settings.local.json` | ❌ | 나만, 해당 프로젝트 |

---

## 설정 파일

### settings.json 전체 구조

```json
{
  // 권한 설정
  "permissions": {
    "allow": [],
    "deny": [],
    "ask": []
  },

  // 훅 설정
  "hooks": {
    "PreToolUse": [],
    "PostToolUse": [],
    "UserPromptSubmit": [],
    "SessionStart": [],
    "SessionEnd": []
  },

  // 환경 변수
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true"
  },

  // 모델 설정
  "model": "claude-opus-4-5-20251101",
  "alwaysThinking": true,

  // 샌드박스 설정
  "sandbox": {
    "enabled": true,
    "excludedCommands": ["docker"]
  },

  // MCP 서버
  "enableAllProjectMcpServers": true,
  "mcp_servers": {},

  // 속성 설정
  "attribution": {
    "commit": "커스텀 커밋 메시지",
    "pr": "커스텀 PR 메시지"
  },

  // 플러그인
  "plugins": []
}
```

### 프로젝트 설정 예제

**.claude/settings.json:**

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Read(tests/**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(git status:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Read(**/*credential*)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)",
      "Bash(curl:*)",
      "Bash(wget:*)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Write(package.json)",
      "Edit(*.lock)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  },
  "env": {
    "NODE_ENV": "development"
  }
}
```

### 사용자 설정 예제

**~/.claude/settings.json:**

```json
{
  "model": "claude-opus-4-5-20251101",
  "alwaysThinking": true,
  "permissions": {
    "deny": [
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.config/gcloud/**)"
    ]
  }
}
```

---

## 권한 시스템

### 권한 규칙 형식

```
도구이름(패턴)
```

**예제:**

```json
{
  "permissions": {
    // 정확한 경로
    "allow": ["Read(src/main.ts)"],

    // 글로브 패턴
    "allow": ["Read(src/**)"],

    // 명령 패턴
    "allow": ["Bash(npm run:*)"],

    // 도메인 제한
    "allow": ["WebFetch(domain:docs.example.com)"]
  }
}
```

### 패턴 문법

| 패턴 | 의미 | 예제 |
|------|------|------|
| `*` | 단일 경로 세그먼트 | `src/*.ts` |
| `**` | 모든 하위 경로 | `src/**/*.ts` |
| `{a,b}` | OR | `*.{js,ts}` |
| `:*` | 모든 인수 | `npm run:*` |

### 도구별 권한 예제

```json
{
  "permissions": {
    "allow": [
      // 파일 읽기
      "Read(src/**)",
      "Read(tests/**)",
      "Read(package.json)",
      "Read(tsconfig.json)",

      // 파일 수정
      "Edit(src/**)",
      "Edit(tests/**)",

      // 파일 생성
      "Write(src/**)",
      "Write(tests/**)",

      // 명령 실행
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(yarn:*)",
      "Bash(git:*)",
      "Bash(node:*)",
      "Bash(python:*)",

      // 웹 접근
      "WebFetch(domain:github.com)",
      "WebFetch(domain:npmjs.com)",
      "WebSearch"
    ],
    "deny": [
      // 민감한 파일
      "Read(.env*)",
      "Read(**/.git/**)",
      "Read(**/node_modules/**)",
      "Read(**/*secret*)",
      "Read(**/*password*)",
      "Read(**/*credential*)",
      "Read(**/*.pem)",
      "Read(**/*.key)",

      // 위험한 명령
      "Bash(rm -rf:*)",
      "Bash(sudo:*)",
      "Bash(su:*)",
      "Bash(chmod 777:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(dd:*)",
      "Bash(mkfs:*)"
    ],
    "ask": [
      // 확인이 필요한 작업
      "Bash(git push:*)",
      "Bash(git rebase:*)",
      "Bash(npm publish:*)",
      "Write(package.json)",
      "Write(*.lock)",
      "Edit(*.lock)"
    ]
  }
}
```

---

## 권한 모드

### Agent SDK 권한 모드

| 모드 | 설명 | 사용 사례 |
|------|------|-----------|
| `default` | 모든 작업에 승인 필요 | 대화형 사용 |
| `acceptEdits` | 파일 편집 자동 승인 | 자동화, 스크립트 |
| `bypassPermissions` | 모든 권한 우회 | 완전 자동화 (위험!) |
| `plan` | 실행 없이 계획만 | 작업 미리보기 |

### 권한 모드 설정

```python
from claude_agent_sdk import ClaudeAgentOptions

# 기본 모드 (모든 것 확인)
options = ClaudeAgentOptions(
    permission_mode="default"
)

# 파일 편집 자동 승인
options = ClaudeAgentOptions(
    permission_mode="acceptEdits"
)

# 모든 권한 우회 (CI/CD용, 주의!)
options = ClaudeAgentOptions(
    permission_mode="bypassPermissions"
)

# 계획 모드 (실행 없음)
options = ClaudeAgentOptions(
    permission_mode="plan"
)
```

### 커스텀 권한 핸들러

```python
async def custom_permission_handler(
    tool_name: str,
    input_data: dict,
    context: dict
) -> dict:
    """커스텀 권한 로직"""

    # 시스템 디렉토리 쓰기 차단
    if tool_name == "Write":
        path = input_data.get("file_path", "")
        if path.startswith("/system/") or path.startswith("/etc/"):
            return {
                "behavior": "deny",
                "message": "시스템 디렉토리 쓰기 불가",
                "interrupt": True
            }

    # 민감한 명령 사용자 확인
    if tool_name == "Bash":
        command = input_data.get("command", "")
        if "push" in command or "deploy" in command:
            # 사용자 확인 요청
            return {
                "behavior": "ask",
                "message": f"이 명령을 실행하시겠습니까? {command}"
            }

    # 기본 허용
    return {
        "behavior": "allow",
        "updatedInput": input_data
    }

options = ClaudeAgentOptions(
    can_use_tool=custom_permission_handler
)
```

---

## 환경 변수

### 설정 방법

**1. settings.json:**

```json
{
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true",
    "API_URL": "https://api.example.com"
  }
}
```

**2. Agent SDK:**

```python
options = ClaudeAgentOptions(
    env={
        "NODE_ENV": "production",
        "API_KEY": os.environ["API_KEY"]  # 시스템 환경 변수 참조
    }
)
```

### 민감한 환경 변수 처리

```python
import os

# 시크릿은 시스템 환경 변수에서
options = ClaudeAgentOptions(
    env={
        "API_KEY": os.environ["API_KEY"],
        "DB_PASSWORD": os.environ["DB_PASSWORD"]
    }
)

# settings.json에는 절대 포함하지 않음!
```

---

## 모델 설정

### 사용 가능한 모델

| 모델 | ID | 특징 |
|------|-----|------|
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | 최고 성능, 복잡한 작업 |
| Claude Opus 4 | `claude-opus-4-1` | 고성능 |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20251101` | 균형 (속도/성능) |
| Claude Haiku 4 | `claude-haiku-4` | 최고 속도, 단순 작업 |

### 모델 설정 방법

**settings.json:**

```json
{
  "model": "claude-opus-4-5-20251101",
  "alwaysThinking": true
}
```

**Agent SDK:**

```python
options = ClaudeAgentOptions(
    model="claude-opus-4-1"
)
```

**명령줄:**

```bash
claude -p "작업" --model claude-sonnet-4-5-20251101
```

---

## 실전 설정 예제

### 1. 프론트엔드 프로젝트

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Read(public/**)",
      "Read(tests/**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm:*)",
      "Bash(yarn:*)",
      "Bash(pnpm:*)",
      "Bash(npx:*)",
      "Bash(git:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(node_modules/**)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "npx eslint --fix \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### 2. 백엔드 프로젝트 (Python)

```json
{
  "permissions": {
    "allow": [
      "Read(src/**)",
      "Read(tests/**)",
      "Read(requirements.txt)",
      "Read(pyproject.toml)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(pytest:*)",
      "Bash(poetry:*)",
      "Bash(git:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Read(venv/**)",
      "Read(.venv/**)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "black \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          },
          {
            "type": "command",
            "command": "isort \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### 3. 읽기 전용 분석 모드

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Glob",
      "Grep",
      "WebSearch",
      "WebFetch(domain:*.example.com)"
    ],
    "deny": [
      "Read(.env*)",
      "Read(**/*secret*)",
      "Write",
      "Edit",
      "Bash"
    ]
  }
}
```

### 4. CI/CD 자동화

```json
{
  "permissions": {
    "allow": [
      "Read(**)",
      "Edit(src/**)",
      "Edit(tests/**)",
      "Write(src/**)",
      "Write(tests/**)",
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(make:*)"
    ],
    "deny": [
      "Read(.env*)",
      "Bash(git push --force:*)",
      "Bash(rm -rf:*)"
    ]
  }
}
```

---

## 샌드박스 설정

### 샌드박스란?

명령 실행을 격리된 환경에서 수행하여 시스템을 보호합니다.

```json
{
  "sandbox": {
    "enabled": true,
    "excludedCommands": ["docker", "podman"]
  }
}
```

### 샌드박스 비활성화 (주의!)

```python
options = ClaudeAgentOptions(
    # 특정 명령에서만 샌드박스 비활성화
    dangerously_disable_sandbox=True  # 매우 주의!
)
```

---

*이전: [스킬 레퍼런스](05_skills.md) | 다음: [보안 가이드](07_security.md)*
