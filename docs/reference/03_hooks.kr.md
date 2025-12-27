# 훅 시스템 가이드

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [훅 개요](#훅-개요)
2. [훅 이벤트](#훅-이벤트)
3. [훅 설정](#훅-설정)
4. [훅 타입](#훅-타입)
5. [입출력 형식](#입출력-형식)
6. [실전 예제](#실전-예제)
7. [베스트 프랙티스](#베스트-프랙티스)

---

## 훅 개요

### 훅이란?

훅(Hooks)은 Claude Code의 생명주기 특정 시점에서 실행되는 사용자 정의 셸 명령입니다. 결정적(deterministic)이고 예측 가능한 동작 제어를 제공합니다.

### 훅을 사용하는 이유

| 사용 사례 | 설명 |
|-----------|------|
| **검증** | 위험한 명령 실행 전 차단 |
| **자동화** | 파일 저장 후 자동 포맷팅/린팅 |
| **감사** | 모든 도구 사용 로깅 |
| **컨텍스트** | 프롬프트에 자동으로 정보 추가 |
| **정리** | 세션 종료 시 임시 파일 정리 |

### 훅 vs LLM 판단

```
┌─────────────────────────────────────────────────────────┐
│                     결정적 검증                          │
│  훅: "rm -rf 포함 명령은 무조건 차단"                     │
│  → 항상 동일한 결과, 100% 예측 가능                       │
└─────────────────────────────────────────────────────────┘
                         vs
┌─────────────────────────────────────────────────────────┐
│                      LLM 판단                            │
│  시스템 프롬프트: "위험한 명령을 피하세요"                 │
│  → 상황에 따라 다른 판단, 우회 가능성                     │
└─────────────────────────────────────────────────────────┘
```

---

## 훅 이벤트

### 이벤트 목록

| 이벤트 | 시점 | 차단 가능 | 주요 용도 |
|--------|------|-----------|-----------|
| `PreToolUse` | 도구 실행 전 | ✅ | 명령 검증, 권한 확인, 입력 수정 |
| `PostToolUse` | 도구 실행 후 | ❌ | 자동 포맷팅, 로깅, 결과 처리 |
| `UserPromptSubmit` | 프롬프트 제출 시 | ✅ | 입력 검증, 컨텍스트 추가 |
| `PermissionRequest` | 권한 대화상자 표시 시 | ✅ | 자동 승인/거부 |
| `SessionStart` | 세션 시작/재개 시 | ❌ | 환경 초기화, 컨텍스트 로드 |
| `SessionEnd` | 세션 종료 시 | ❌ | 정리, 로깅, 상태 저장 |
| `Notification` | 알림 발송 시 | ❌ | 커스텀 알림 |
| `Stop` | 응답 완료 시 | ✅* | 계속 여부 결정 |
| `SubagentStop` | 서브에이전트 완료 시 | ✅* | 서브에이전트 평가 |
| `PreCompact` | 컨텍스트 압축 전 | ❌ | 압축 전 처리 |

*Stop/SubagentStop은 "계속" 신호를 보낼 수 있음

### 이벤트 흐름도

```
SessionStart
     ↓
UserPromptSubmit ─────────────────────────────────┐
     ↓                                             │
PreToolUse ─────→ [도구 실행] ─────→ PostToolUse  │
     ↓                                     ↓       │
[차단됨?]                              [반복?] ───┘
     ↓ No                                  ↓ No
[도구 실행]                              Stop
     ↓                                     ↓
PostToolUse                          [계속?] ─→ UserPromptSubmit
     ↓                                     ↓ No
   ...                                SessionEnd
```

---

## 훅 설정

### 설정 위치

| 범위 | 파일 | 공유 | 우선순위 |
|------|------|------|----------|
| 사용자 | `~/.claude/settings.json` | 개인 | 낮음 |
| 프로젝트 | `.claude/settings.json` | Git 공유 | 중간 |
| 로컬 | `.claude/settings.local.json` | 개인 | 높음 |

### 기본 설정 구조

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/validator.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\""
          }
        ]
      }
    ]
  }
}
```

### 매처(Matcher) 패턴

```json
// 특정 도구만 매칭
"matcher": "Bash"

// OR 조건 (파이프)
"matcher": "Edit|Write"

// 모든 도구 (matcher 생략)
{
  "hooks": [{ "type": "command", "command": "..." }]
}

// 정규식 패턴
"matcher": "Bash\\(npm.*\\)"
```

---

## 훅 타입

### 1. 명령 훅 (Command Hook)

셸 명령을 실행합니다.

```json
{
  "type": "command",
  "command": "/path/to/script.sh"
}
```

**특징:**
- 빠르고 결정적
- 표준 입력으로 JSON 수신
- 종료 코드로 결과 반환
- 환경 변수 접근 가능

### 2. 프롬프트 훅 (Prompt Hook)

LLM에 컨텍스트를 보내 평가합니다.

```json
{
  "type": "prompt",
  "prompt": "이 명령이 프로덕션 환경에 영향을 줄 수 있는지 평가하세요"
}
```

**지원 이벤트:**
- `Stop`, `SubagentStop`
- `UserPromptSubmit`
- `PreToolUse`
- `PermissionRequest`

**특징:**
- 컨텍스트 인식 판단
- 명령 훅보다 느림
- 복잡한 규칙 처리 가능

---

## 입출력 형식

### 입력 (stdin)

훅은 표준 입력으로 JSON을 받습니다:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.json",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm run build"
  }
}
```

### 환경 변수

| 변수 | 설명 |
|------|------|
| `CLAUDE_PROJECT_DIR` | 프로젝트 루트 디렉토리 |
| `CLAUDE_FILE_PATH` | 관련 파일 경로 (Edit/Write 시) |
| `CLAUDE_SESSION_ID` | 현재 세션 ID |

### 출력 (stdout/exit code)

**종료 코드:**

| 코드 | 의미 |
|------|------|
| 0 | 성공, 계속 진행 |
| 2 | 차단 (PreToolUse, PermissionRequest) |
| 기타 | 오류 (로깅됨, 계속 진행) |

**JSON 출력 (선택적):**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "위험한 명령 감지됨"
  }
}
```

### PreToolUse 출력 옵션

```json
// 차단
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "사유"
  }
}

// 승인 (입력 수정 가능)
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "command": "npm run build -- --safe-mode"
    }
  }
}

// 도구 교체
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "replace",
    "tool": {
      "name": "SafeBash",
      "input": { "command": "..." }
    }
  }
}
```

---

## 실전 예제

### 1. 위험한 명령 차단

**validate_bash.sh:**

```bash
#!/bin/bash

# stdin에서 JSON 읽기
input=$(cat)

# 명령 추출
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# 위험한 패턴 검사
dangerous_patterns=(
    "rm -rf /"
    "rm -rf ~"
    "dd if=/dev/zero"
    ":(){:|:&};:"
    "mkfs"
    "> /dev/sd"
)

for pattern in "${dangerous_patterns[@]}"; do
    if [[ "$command" == *"$pattern"* ]]; then
        echo "{
            \"hookSpecificOutput\": {
                \"hookEventName\": \"PreToolUse\",
                \"permissionDecision\": \"deny\",
                \"permissionDecisionReason\": \"위험한 명령 차단: $pattern\"
            }
        }"
        exit 2
    fi
done

# 허용
exit 0
```

**설정:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate_bash.sh"
          }
        ]
      }
    ]
  }
}
```

### 2. 자동 코드 포맷팅

```json
{
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
  }
}
```

### 3. 모든 도구 사용 로깅

**audit_logger.py:**

```python
#!/usr/bin/env python3
import sys
import json
from datetime import datetime

# stdin에서 JSON 읽기
input_data = json.load(sys.stdin)

# 로그 엔트리 생성
log_entry = {
    "timestamp": datetime.now().isoformat(),
    "session_id": input_data.get("session_id"),
    "event": input_data.get("hook_event_name"),
    "tool": input_data.get("tool_name"),
    "input": input_data.get("tool_input")
}

# 파일에 추가
with open("/var/log/claude-audit.jsonl", "a") as f:
    f.write(json.dumps(log_entry) + "\n")

# 계속 진행
sys.exit(0)
```

**설정:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 $CLAUDE_PROJECT_DIR/.claude/hooks/audit_logger.py"
          }
        ]
      }
    ]
  }
}
```

### 4. 민감한 파일 보호

**protect_files.sh:**

```bash
#!/bin/bash

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

# 보호할 파일/디렉토리 패턴
protected_patterns=(
    ".env"
    ".env.*"
    "**/secrets/**"
    "**/credentials/**"
    "**/*.pem"
    "**/*.key"
)

for pattern in "${protected_patterns[@]}"; do
    if [[ "$file_path" == $pattern ]]; then
        echo "{
            \"hookSpecificOutput\": {
                \"hookEventName\": \"PreToolUse\",
                \"permissionDecision\": \"deny\",
                \"permissionDecisionReason\": \"보호된 파일: $file_path\"
            }
        }"
        exit 2
    fi
done

exit 0
```

### 5. 프롬프트에 컨텍스트 추가

**add_context.sh:**

```bash
#!/bin/bash

# 현재 Git 브랜치 정보 추가
branch=$(git branch --show-current 2>/dev/null || echo "unknown")
status=$(git status --porcelain 2>/dev/null | head -5)

echo "{
    \"hookSpecificOutput\": {
        \"hookEventName\": \"UserPromptSubmit\",
        \"additionalContext\": \"현재 브랜치: $branch\\n변경된 파일:\\n$status\"
    }
}"

exit 0
```

### 6. Agent SDK에서 훅 사용

```python
from claude_agent_sdk import query, ClaudeAgentOptions, HookMatcher, HookContext
from typing import Any

async def validate_bash_command(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: HookContext
) -> dict[str, Any]:
    """Bash 명령 검증 훅"""
    if input_data.get('tool_name') == 'Bash':
        command = input_data['tool_input'].get('command', '')

        # 위험한 패턴 검사
        dangerous = ['rm -rf /', 'dd if=/dev/zero', ':(){']
        for pattern in dangerous:
            if pattern in command:
                return {
                    'hookSpecificOutput': {
                        'hookEventName': 'PreToolUse',
                        'permissionDecision': 'deny',
                        'permissionDecisionReason': f'위험한 명령: {pattern}'
                    }
                }
    return {}

async def log_tool_usage(
    input_data: dict[str, Any],
    tool_use_id: str | None,
    context: HookContext
) -> dict[str, Any]:
    """도구 사용 로깅 훅"""
    import logging
    logging.info(f"도구 사용: {input_data.get('tool_name')}")
    return {}

# 옵션에 훅 설정
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Bash"],
    hooks={
        'PreToolUse': [
            HookMatcher(matcher='Bash', hooks=[validate_bash_command])
        ],
        'PostToolUse': [
            HookMatcher(hooks=[log_tool_usage])  # 모든 도구
        ]
    }
)
```

---

## 베스트 프랙티스

### 1. 보안 우선

```bash
# 훅 스크립트 권한 제한
chmod 700 .claude/hooks/*.sh

# 민감한 정보 로깅 금지
# BAD: echo "$input" >> log.txt  (API 키 포함 가능)
# GOOD: jq로 필요한 필드만 추출
```

### 2. 빠른 실행

```bash
# 무거운 작업은 백그라운드로
heavy_task &

# 빠른 검증만 동기 실행
exit 0
```

### 3. 에러 처리

```bash
#!/bin/bash
set -e  # 에러 시 즉시 종료

# 에러 핸들러
trap 'echo "훅 실행 오류: $?" >&2' ERR

# 로직...
```

### 4. 테스트 용이성

```bash
# 단독 실행 가능하게 작성
if [[ -z "$1" ]]; then
    input=$(cat)
else
    input=$(cat "$1")  # 파일에서 입력
fi
```

### 5. 문서화

```bash
#!/bin/bash
# =============================================================================
# validate_bash.sh
#
# 목적: Bash 명령 실행 전 위험한 패턴 검사
# 이벤트: PreToolUse
# 매처: Bash
#
# 차단되는 명령:
#   - rm -rf /
#   - dd if=/dev/zero
#   - fork bomb
# =============================================================================
```

### 6. 훅 체인 순서

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "./1_validate.sh" },
          { "type": "command", "command": "./2_log.sh" },
          { "type": "command", "command": "./3_modify.sh" }
        ]
      }
    ]
  }
}
```

훅은 순서대로 실행되며, 하나라도 exit 2를 반환하면 중단됩니다.

---

*이전: [도구 레퍼런스](02_tools.md) | 다음: [MCP 통합](04_mcp.md)*
