# API 레퍼런스

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [Messages API](#messages-api)
2. [Agent SDK API](#agent-sdk-api)
3. [도구 스키마](#도구-스키마)
4. [응답 형식](#응답-형식)
5. [오류 코드](#오류-코드)
6. [모델 정보](#모델-정보)

---

## Messages API

### 기본 요청

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-5-20251101",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude"}
    ]
)
```

### 요청 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `model` | string | Yes | 모델 ID |
| `messages` | array | Yes | 대화 메시지 배열 |
| `max_tokens` | integer | Yes | 최대 출력 토큰 |
| `system` | string | No | 시스템 프롬프트 |
| `temperature` | float | No | 0-1, 응답 다양성 |
| `top_p` | float | No | 0-1, 누적 확률 샘플링 |
| `top_k` | integer | No | 상위 k개 토큰만 고려 |
| `tools` | array | No | 사용 가능한 도구 정의 |
| `tool_choice` | object | No | 도구 선택 제어 |
| `stream` | boolean | No | 스트리밍 활성화 |

### 메시지 형식

```python
messages = [
    # 텍스트 메시지
    {"role": "user", "content": "Hello"},

    # 멀티모달 메시지
    {
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64_data
                }
            },
            {"type": "text", "text": "이 이미지를 설명하세요"}
        ]
    },

    # 도구 결과 포함
    {
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": "tool_123",
                "content": "도구 실행 결과"
            }
        ]
    }
]
```

### 응답 형식

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-5-20251101",
  "content": [
    {
      "type": "text",
      "text": "응답 텍스트"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150
  }
}
```

### 스트리밍

```python
with client.messages.stream(
    model="claude-sonnet-4-5-20251101",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

### 스트리밍 이벤트

| 이벤트 | 설명 |
|--------|------|
| `message_start` | 메시지 시작 |
| `content_block_start` | 콘텐츠 블록 시작 |
| `content_block_delta` | 콘텐츠 증분 |
| `content_block_stop` | 콘텐츠 블록 종료 |
| `message_delta` | 메시지 메타데이터 업데이트 |
| `message_stop` | 메시지 종료 |

---

## Agent SDK API

### query()

단일 턴 에이전트 쿼리를 실행합니다.

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="작업 수행",
    options=ClaudeAgentOptions(...)
):
    # 메시지 처리
    pass
```

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `prompt` | string | Yes | 에이전트에 보낼 프롬프트 |
| `options` | ClaudeAgentOptions | No | 에이전트 설정 |

### ClaudeAgentOptions

```python
@dataclass
class ClaudeAgentOptions:
    # 도구 설정
    allowed_tools: list[str] = None      # 허용 도구
    disallowed_tools: list[str] = None   # 차단 도구

    # 시스템 프롬프트
    system_prompt: str | dict = None     # 시스템 프롬프트

    # 권한
    permission_mode: str = "default"      # default|acceptEdits|bypassPermissions|plan
    can_use_tool: Callable = None        # 커스텀 권한 핸들러

    # 모델
    model: str = None                    # 모델 ID

    # 환경
    cwd: str = None                      # 작업 디렉토리
    env: dict[str, str] = None           # 환경 변수

    # 세션
    resume: str = None                   # 세션 ID로 재개
    fork_session: bool = False           # 세션 포크
    continue_conversation: bool = False  # 대화 계속
    max_turns: int = None                # 최대 턴 수

    # 체크포인팅
    enable_file_checkpointing: bool = False  # 파일 되돌리기

    # 훅
    hooks: dict = None                   # 훅 설정

    # 서브에이전트
    agents: dict[str, AgentDefinition] = None  # 서브에이전트 정의

    # MCP
    mcp_servers: dict = None             # MCP 서버 설정
```

### ClaudeSDKClient

다중 턴 대화를 위한 클라이언트입니다.

```python
from claude_agent_sdk import ClaudeSDKClient

async with ClaudeSDKClient(options=options) as client:
    await client.query("첫 번째 질문")
    async for msg in client.receive_response():
        print(msg)

    await client.query("후속 질문")
    async for msg in client.receive_response():
        print(msg)
```

**메서드:**

| 메서드 | 설명 |
|--------|------|
| `connect()` | 세션 연결 |
| `disconnect()` | 세션 종료 |
| `query(prompt)` | 프롬프트 전송 |
| `receive_response()` | 응답 수신 (AsyncIterator) |
| `rewind_files(uuid)` | 특정 시점으로 파일 되돌리기 |

### AgentDefinition

서브에이전트를 정의합니다.

```python
from claude_agent_sdk import AgentDefinition

agent = AgentDefinition(
    description="에이전트 설명 (언제 사용할지)",
    prompt="에이전트 행동 정의",
    tools=["Read", "Grep", "Glob"],  # 선택적
    model="sonnet"  # 선택적: sonnet|opus|haiku
)
```

### HookMatcher

훅 매칭 규칙을 정의합니다.

```python
from claude_agent_sdk import HookMatcher

matcher = HookMatcher(
    matcher="Bash|Edit",  # 정규식 패턴 (선택적)
    hooks=[hook_function1, hook_function2]
)
```

---

## 도구 스키마

### 도구 정의 형식

```python
tool_definition = {
    "name": "get_weather",
    "description": "특정 위치의 날씨 정보를 가져옵니다",
    "input_schema": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "도시 이름 (예: Seoul, New York)"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "온도 단위"
            }
        },
        "required": ["location"]
    }
}
```

### 내장 도구 스키마

#### Read

```json
{
  "name": "Read",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "읽을 파일의 절대 경로"},
      "offset": {"type": "number", "description": "시작 줄 번호"},
      "limit": {"type": "number", "description": "읽을 줄 수"}
    },
    "required": ["file_path"]
  }
}
```

#### Write

```json
{
  "name": "Write",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "파일의 절대 경로"},
      "content": {"type": "string", "description": "파일에 쓸 내용"}
    },
    "required": ["file_path", "content"]
  }
}
```

#### Edit

```json
{
  "name": "Edit",
  "input_schema": {
    "type": "object",
    "properties": {
      "file_path": {"type": "string", "description": "파일의 절대 경로"},
      "old_string": {"type": "string", "description": "교체할 원본 텍스트"},
      "new_string": {"type": "string", "description": "새 텍스트"},
      "replace_all": {"type": "boolean", "default": false}
    },
    "required": ["file_path", "old_string", "new_string"]
  }
}
```

#### Bash

```json
{
  "name": "Bash",
  "input_schema": {
    "type": "object",
    "properties": {
      "command": {"type": "string", "description": "실행할 명령"},
      "timeout": {"type": "number", "description": "타임아웃 (ms)"},
      "run_in_background": {"type": "boolean", "default": false},
      "description": {"type": "string", "description": "명령 설명"}
    },
    "required": ["command"]
  }
}
```

#### Grep

```json
{
  "name": "Grep",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": {"type": "string", "description": "검색할 정규식"},
      "path": {"type": "string", "description": "검색 경로"},
      "glob": {"type": "string", "description": "파일 필터 (예: *.js)"},
      "type": {"type": "string", "description": "파일 타입 (js, py 등)"},
      "output_mode": {"type": "string", "enum": ["content", "files_with_matches", "count"]},
      "-i": {"type": "boolean", "description": "대소문자 무시"},
      "-A": {"type": "number", "description": "매치 후 줄 수"},
      "-B": {"type": "number", "description": "매치 전 줄 수"},
      "-C": {"type": "number", "description": "컨텍스트 줄 수"}
    },
    "required": ["pattern"]
  }
}
```

#### Glob

```json
{
  "name": "Glob",
  "input_schema": {
    "type": "object",
    "properties": {
      "pattern": {"type": "string", "description": "Glob 패턴"},
      "path": {"type": "string", "description": "검색 시작 디렉토리"}
    },
    "required": ["pattern"]
  }
}
```

#### Task

```json
{
  "name": "Task",
  "input_schema": {
    "type": "object",
    "properties": {
      "prompt": {"type": "string", "description": "수행할 작업"},
      "description": {"type": "string", "description": "작업 설명 (3-5단어)"},
      "subagent_type": {"type": "string", "description": "에이전트 유형"},
      "model": {"type": "string", "enum": ["sonnet", "opus", "haiku"]},
      "resume": {"type": "string", "description": "재개할 에이전트 ID"},
      "run_in_background": {"type": "boolean", "default": false}
    },
    "required": ["prompt", "description", "subagent_type"]
  }
}
```

---

## 응답 형식

### 메시지 타입

```python
from claude_agent_sdk import (
    AssistantMessage,
    UserMessage,
    SystemMessage,
    ResultMessage
)
```

#### AssistantMessage

Claude의 응답을 포함합니다.

```python
@dataclass
class AssistantMessage:
    type: str = "assistant"
    content: list[ContentBlock]  # TextBlock 또는 ToolUseBlock
    model: str
    stop_reason: str
    usage: Usage
```

#### UserMessage

사용자 메시지 또는 도구 결과를 포함합니다.

```python
@dataclass
class UserMessage:
    type: str = "user"
    content: list[ContentBlock]  # TextBlock 또는 ToolResultBlock
```

#### ResultMessage

에이전트 실행 결과를 포함합니다.

```python
@dataclass
class ResultMessage:
    type: str = "result"
    subtype: str  # init, success, error, cancelled, max_turns
    session_id: str = None  # subtype == init일 때
    result: str = None      # subtype == success일 때
    error: str = None       # subtype == error일 때
    duration_ms: int = None
    total_cost_usd: float = None
```

### ContentBlock 타입

```python
@dataclass
class TextBlock:
    type: str = "text"
    text: str

@dataclass
class ToolUseBlock:
    type: str = "tool_use"
    id: str
    name: str
    input: dict

@dataclass
class ToolResultBlock:
    type: str = "tool_result"
    tool_use_id: str
    content: str | list
    is_error: bool = False
```

---

## 오류 코드

### HTTP 상태 코드

| 코드 | 의미 | 대응 |
|------|------|------|
| 400 | 잘못된 요청 | 요청 파라미터 확인 |
| 401 | 인증 실패 | API 키 확인 |
| 403 | 권한 없음 | 접근 권한 확인 |
| 404 | 리소스 없음 | 엔드포인트 확인 |
| 429 | 요청 제한 | 재시도 또는 제한 준수 |
| 500 | 서버 오류 | 잠시 후 재시도 |
| 529 | 과부하 | 잠시 후 재시도 |

### Agent SDK 예외

```python
from claude_agent_sdk import (
    CLINotFoundError,      # Claude Code CLI 미설치
    ProcessError,          # 프로세스 실행 오류
    AuthenticationError,   # 인증 실패
    RateLimitError,        # 요청 제한
    TimeoutError           # 타임아웃
)
```

### 오류 처리 패턴

```python
try:
    async for message in query(prompt=task, options=options):
        handle_message(message)

except CLINotFoundError:
    print("Claude Code CLI를 설치하세요: npm i -g @anthropic-ai/claude-code")

except AuthenticationError:
    print("API 키를 확인하세요: export ANTHROPIC_API_KEY=...")

except RateLimitError as e:
    print(f"{e.retry_after}초 후 재시도...")
    await asyncio.sleep(e.retry_after)

except TimeoutError:
    print("작업 시간 초과")

except ProcessError as e:
    print(f"프로세스 오류: {e.stderr}")

except Exception as e:
    print(f"예상치 못한 오류: {e}")
```

---

## 모델 정보

### 사용 가능한 모델

| 모델 | ID | 컨텍스트 | 특징 |
|------|-----|----------|------|
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | 200K | 최고 성능 |
| Claude Opus 4 | `claude-opus-4-1` | 200K | 고성능 |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20251101` | 200K | 균형 |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 200K | 균형 |
| Claude Haiku 4 | `claude-haiku-4` | 200K | 최고 속도 |

### 토큰 제한

| 항목 | 제한 |
|------|------|
| 표준 컨텍스트 | 200,000 토큰 |
| Enterprise 컨텍스트 | 500,000 토큰 |
| 1M Beta (자격 조직) | 1,000,000 토큰 |
| 최대 출력 토큰 | 모델별 상이 |

### 가격 정보

> 최신 가격은 https://www.anthropic.com/pricing 참조

```python
# 토큰 수 확인
token_count = client.messages.count_tokens(
    model="claude-sonnet-4-5-20251101",
    messages=[{"role": "user", "content": "Hello"}]
)
print(f"Input tokens: {token_count.input_tokens}")
```

---

## 공식 문서 링크

| 주제 | URL |
|------|-----|
| Messages API | https://docs.anthropic.com/en/api/messages |
| Agent SDK | https://platform.claude.com/docs/en/agent-sdk/overview |
| Tool Use | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| Claude Code | https://code.claude.com/docs/en/overview |
| MCP | https://modelcontextprotocol.io |

---

*이전: [아키텍처 패턴](08_patterns.md) | [목차로 돌아가기](README.md)*
