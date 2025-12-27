# Agent SDK 상세 가이드

> **Version**: 1.0.0
> **Based on**: Anthropic Agent SDK Documentation

## 목차

1. [개요](#개요)
2. [설치 및 설정](#설치-및-설정)
3. [핵심 API](#핵심-api)
4. [옵션 설정](#옵션-설정)
5. [메시지 타입](#메시지-타입)
6. [세션 관리](#세션-관리)
7. [서브에이전트](#서브에이전트)
8. [에러 처리](#에러-처리)

---

## 개요

### Agent SDK란?

Agent SDK는 Claude Code를 구동하는 동일한 도구, 에이전트 루프, 컨텍스트 관리 기능을 프로그래매틱 라이브러리로 제공합니다.

### 주요 특징

- **자율적 도구 실행**: 수동 구현 없이 Claude가 직접 도구 호출
- **세션 관리**: 대화 컨텍스트 유지 및 재개
- **스트리밍 지원**: 실시간 진행 상황 확인
- **MCP 통합**: 외부 시스템 연동
- **훅 기반 커스터마이징**: 생명주기 이벤트 가로채기
- **파일 체크포인팅**: 변경사항 되돌리기

---

## 설치 및 설정

### Python 설치

```bash
# uv 사용 (권장)
uv init my-agent && cd my-agent
uv add claude-agent-sdk

# pip 사용
python3 -m venv .venv
source .venv/bin/activate
pip install claude-agent-sdk
```

### TypeScript 설치

```bash
npm install @anthropic-ai/claude-agent-sdk
# 또는
yarn add @anthropic-ai/claude-agent-sdk
```

### 런타임 요구사항

Agent SDK는 Claude Code CLI를 런타임으로 사용합니다:

```bash
# Claude Code CLI 설치 확인
claude --version

# 설치되지 않은 경우
npm install -g @anthropic-ai/claude-code
```

### 인증 설정

```bash
# 방법 1: 환경 변수 (권장)
export ANTHROPIC_API_KEY=sk-ant-...

# 방법 2: Claude CLI 로그인
claude login
```

---

## 핵심 API

### query() - 단일 턴 쿼리

독립적인 작업에 사용:

```python
# Python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="utils.py에서 버그를 찾아 수정하세요",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Glob"],
            permission_mode="acceptEdits"
        )
    ):
        handle_message(message)

asyncio.run(main())
```

```typescript
// TypeScript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "utils.py에서 버그를 찾아 수정하세요",
  options: {
    allowedTools: ["Read", "Edit", "Glob"],
    permissionMode: "acceptEdits"
  }
})) {
  handleMessage(message);
}
```

### ClaudeSDKClient - 다중 턴 대화

연속적인 대화에 사용:

```python
# Python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Edit"],
        permission_mode="acceptEdits"
    )

    async with ClaudeSDKClient(options=options) as client:
        # 첫 번째 질문
        await client.query("메인 애플리케이션 파일을 읽어주세요")
        async for message in client.receive_response():
            print(message)

        # 후속 질문 (이전 컨텍스트 유지!)
        await client.query("그 파일의 주요 함수는 무엇인가요?")
        async for message in client.receive_response():
            print(message)

        # 추가 질문
        await client.query("main 함수에 에러 핸들링을 추가해주세요")
        async for message in client.receive_response():
            print(message)

asyncio.run(main())
```

```typescript
// TypeScript
import { ClaudeSDKClient } from "@anthropic-ai/claude-agent-sdk";

const client = new ClaudeSDKClient({
  allowedTools: ["Read", "Write", "Edit"],
  permissionMode: "acceptEdits"
});

await client.connect();

// 첫 번째 질문
await client.query("메인 애플리케이션 파일을 읽어주세요");
for await (const message of client.receiveResponse()) {
  console.log(message);
}

// 후속 질문
await client.query("그 파일의 주요 함수는 무엇인가요?");
for await (const message of client.receiveResponse()) {
  console.log(message);
}

await client.disconnect();
```

---

## 옵션 설정

### ClaudeAgentOptions 전체 레퍼런스

```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    # ===== 도구 설정 =====
    allowed_tools=["Read", "Edit", "Bash"],       # 허용할 도구 목록
    disallowed_tools=["Bash"],                    # 차단할 도구 목록

    # ===== 시스템 프롬프트 =====
    system_prompt="시니어 개발자로서 행동하세요",   # 커스텀 지침
    # 또는 프리셋 사용:
    system_prompt={
        "type": "preset",
        "preset": "claude_code",                  # Claude Code 기본 프롬프트 사용
        "append": "추가 지침..."                   # 프리셋에 추가
    },

    # ===== 권한 설정 =====
    permission_mode="acceptEdits",                # 파일 편집 자동 승인
    # 옵션:
    #   - "default": 모든 작업에 승인 필요
    #   - "acceptEdits": 파일 편집 자동 승인
    #   - "bypassPermissions": 모든 권한 우회 (위험!)
    #   - "plan": 실행 없이 계획만 생성

    # ===== 모델 설정 =====
    model="claude-opus-4-1",                      # 사용할 모델
    # 옵션: claude-opus-4-1, claude-sonnet-4-5, claude-haiku-4

    # ===== 작업 디렉토리 =====
    cwd="/path/to/project",                       # 작업 디렉토리 설정

    # ===== 환경 변수 =====
    env={"API_KEY": "value", "DEBUG": "true"},    # 환경 변수 설정

    # ===== 세션 관리 =====
    resume="session-id-123",                      # 이전 세션 재개
    fork_session=True,                            # 세션 포크 (원본 유지)
    continue_conversation=True,                   # 기존 대화 계속
    max_turns=10,                                 # 최대 대화 턴 수

    # ===== 파일 체크포인팅 =====
    enable_file_checkpointing=True,               # 파일 되돌리기 활성화

    # ===== 훅 설정 =====
    hooks={
        "PreToolUse": [...],
        "PostToolUse": [...]
    },

    # ===== 서브에이전트 =====
    agents={
        "code-reviewer": AgentDefinition(...),
        "test-runner": AgentDefinition(...)
    },

    # ===== MCP 서버 =====
    mcp_servers={
        "postgres": {...},
        "github": {...}
    }
)
```

### TypeScript 옵션 (camelCase)

```typescript
const options = {
  allowedTools: ["Read", "Edit", "Bash"],
  disallowedTools: ["Bash"],
  systemPrompt: "시니어 개발자로서 행동하세요",
  permissionMode: "acceptEdits",
  model: "claude-opus-4-1",
  cwd: "/path/to/project",
  env: { API_KEY: "value" },
  resume: "session-id-123",
  forkSession: true,
  maxTurns: 10,
  enableFileCheckpointing: true
};
```

---

## 메시지 타입

### 메시지 스트림 처리

```python
from claude_agent_sdk import (
    query,
    AssistantMessage,
    UserMessage,
    ResultMessage,
    SystemMessage
)

async for message in query(prompt="작업 수행", options=options):
    # 메시지 타입별 처리
    if isinstance(message, AssistantMessage):
        # Claude의 응답
        for block in message.content:
            if hasattr(block, "text"):
                print(f"텍스트: {block.text}")
            elif hasattr(block, "name"):
                print(f"도구 호출: {block.name}")
                print(f"입력: {block.input}")

    elif isinstance(message, UserMessage):
        # 도구 결과
        for block in message.content:
            if hasattr(block, "tool_use_id"):
                print(f"도구 결과: {block.content}")

    elif isinstance(message, ResultMessage):
        # 최종 결과
        if message.subtype == "success":
            print(f"성공! 소요시간: {message.duration_ms}ms")
            print(f"비용: ${message.total_cost_usd:.4f}")
        elif message.subtype == "init":
            print(f"세션 ID: {message.session_id}")
        else:
            print(f"종료: {message.subtype}")

    elif isinstance(message, SystemMessage):
        # 시스템 메시지
        print(f"시스템: {message.content}")
```

### ResultMessage 서브타입

| 서브타입 | 설명 |
|----------|------|
| `init` | 세션 초기화 (session_id 포함) |
| `success` | 작업 성공 완료 |
| `error` | 오류 발생 |
| `cancelled` | 사용자 취소 |
| `max_turns` | 최대 턴 수 도달 |

---

## 세션 관리

### 세션 재개

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    session_id = None

    # 첫 번째 쿼리: 세션 ID 캡처
    async for message in query(
        prompt="인증 모듈을 분석하세요",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"])
    ):
        if hasattr(message, 'session_id') and message.subtype == 'init':
            session_id = message.session_id
            print(f"세션 생성: {session_id}")

    # 세션 재개 (이전 컨텍스트 유지)
    async for message in query(
        prompt="호출하는 곳을 모두 찾아주세요",
        options=ClaudeAgentOptions(
            resume=session_id  # 세션 재개
        )
    ):
        print(message)

asyncio.run(main())
```

### 세션 포크

원본 세션을 유지하면서 분기:

```python
options = ClaudeAgentOptions(
    resume=session_id,
    fork_session=True  # 원본 세션 유지, 새 분기 생성
)
```

### 파일 체크포인팅 (되돌리기)

```python
async with ClaudeSDKClient(options=ClaudeAgentOptions(
    enable_file_checkpointing=True,
    allowed_tools=["Read", "Write", "Edit"]
)) as client:
    # 변경 작업 수행
    await client.query("코드를 리팩토링하세요")

    user_message_uuid = None
    async for message in client.receive_response():
        if hasattr(message, 'uuid'):
            user_message_uuid = message.uuid

    # 필요시 해당 시점으로 파일 되돌리기
    if need_revert:
        await client.rewind_files(user_message_uuid)
```

---

## 서브에이전트

### 서브에이전트 정의

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Task"],  # Task 필수!
        agents={
            "code-reviewer": AgentDefinition(
                description="코드 품질과 보안을 분석하는 전문가",
                prompt="""당신은 시니어 코드 리뷰어입니다.
                다음 사항을 중점적으로 검토하세요:
                1. 코드 품질 및 가독성
                2. 보안 취약점
                3. 성능 이슈
                4. 베스트 프랙티스 준수""",
                tools=["Read", "Grep", "Glob"],  # 읽기 전용
                model="sonnet"  # 빠른 모델 사용
            ),
            "test-runner": AgentDefinition(
                description="테스트 실행 및 결과 분석 전문가",
                prompt="""당신은 테스트 전문가입니다.
                테스트를 실행하고 실패 원인을 분석하세요.""",
                tools=["Bash", "Read", "Grep"],  # 실행 권한
                model="haiku"  # 가장 빠른 모델
            ),
            "documentation-writer": AgentDefinition(
                description="기술 문서 작성 전문가",
                prompt="명확하고 포괄적인 문서를 작성하세요.",
                tools=["Read", "Write", "Edit"]  # 쓰기 권한
            )
        }
    )

    async for message in query(
        prompt="""다음 작업을 수행하세요:
        1. code-reviewer 에이전트로 auth.py 리뷰
        2. test-runner 에이전트로 테스트 실행
        3. documentation-writer 에이전트로 API 문서 작성""",
        options=options
    ):
        print(message)

asyncio.run(main())
```

### AgentDefinition 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `description` | string | Yes | 언제 사용할지 (Claude가 판단에 사용) |
| `prompt` | string | Yes | 에이전트 행동 정의 시스템 프롬프트 |
| `tools` | string[] | No | 허용 도구 (미지정시 전체 상속) |
| `model` | 'sonnet' \| 'opus' \| 'haiku' | No | 사용할 모델 |

### 서브에이전트 제약사항

- 서브에이전트는 자신의 서브에이전트를 생성할 수 없음
- `Task` 도구를 서브에이전트의 tools에 포함하지 말 것
- 메인 에이전트의 `allowed_tools`에 `Task`가 있어야 함

---

## 에러 처리

### 예외 타입

```python
from claude_agent_sdk import (
    CLINotFoundError,
    ProcessError,
    AuthenticationError,
    RateLimitError
)

try:
    async for message in query(prompt="작업 수행", options=options):
        print(message)

except CLINotFoundError:
    print("Claude Code CLI가 설치되지 않았습니다.")
    print("실행: npm install -g @anthropic-ai/claude-code")

except AuthenticationError:
    print("인증 실패. API 키를 확인하세요.")
    print("실행: export ANTHROPIC_API_KEY=your-key")

except RateLimitError as e:
    print(f"요청 제한 도달. {e.retry_after}초 후 재시도하세요.")

except ProcessError as e:
    print(f"프로세스 오류: {e.stderr}")

except Exception as e:
    print(f"예상치 못한 오류: {e}")
```

### 재시도 패턴

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
async def run_agent_with_retry(prompt: str, options: ClaudeAgentOptions):
    results = []
    async for message in query(prompt=prompt, options=options):
        results.append(message)
    return results
```

---

## 스트리밍 vs 배치 모드

### 스트리밍 모드 (실시간 진행)

```python
# 진행 상황을 실시간으로 확인
async for message in query(prompt="프로젝트 빌드", options=options):
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if hasattr(block, "text"):
                print(block.text, end="", flush=True)
```

### 배치 모드 (결과 수집)

```python
# 모든 메시지 수집 후 처리
messages = []
async for message in query(prompt="프로젝트 빌드", options=options):
    messages.append(message)

# 최종 결과만 처리
final_result = next(
    (m for m in reversed(messages) if isinstance(m, ResultMessage)),
    None
)
if final_result and final_result.subtype == "success":
    print(f"완료! 비용: ${final_result.total_cost_usd:.4f}")
```

---

## 베스트 프랙티스

### 1. 점진적 도구 확장

```python
# 시작: 읽기 전용 (안전)
safe_options = ClaudeAgentOptions(
    allowed_tools=["Read", "Glob", "Grep"]
)

# 확장: 쓰기 추가
write_options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep"]
)

# 고급: 실행 추가 (주의!)
exec_options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    hooks={"PreToolUse": [validate_bash_command]}  # 검증 필수
)
```

### 2. 명확한 시스템 프롬프트

```python
good_prompt = """당신은 Python 코드 리뷰 전문가입니다.

역할:
1. 버그와 안티패턴 탐지
2. 가독성 및 성능 개선 제안
3. 보안 취약점 확인
4. 리팩토링 기회 식별

항상 건설적이고 이유를 설명하세요."""

bad_prompt = "코드 리뷰해"  # 너무 모호함
```

### 3. 비용 모니터링

```python
total_cost = 0

async for message in query(prompt="작업", options=options):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        total_cost += message.total_cost_usd
        print(f"누적 비용: ${total_cost:.4f}")

        if total_cost > MAX_BUDGET:
            raise Exception("예산 초과!")
```

---

*이전: [개요](00_overview.md) | 다음: [도구 레퍼런스](02_tools.md)*
