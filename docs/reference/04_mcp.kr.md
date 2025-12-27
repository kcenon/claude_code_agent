# MCP (Model Context Protocol) 통합 가이드

> **Version**: 1.0.0
> **Based on**: Anthropic Official Documentation

## 목차

1. [MCP 개요](#mcp-개요)
2. [서버 유형](#서버-유형)
3. [설정 방법](#설정-방법)
4. [SDK MCP 서버](#sdk-mcp-서버)
5. [인기 MCP 서버](#인기-mcp-서버)
6. [실전 예제](#실전-예제)
7. [트러블슈팅](#트러블슈팅)

---

## MCP 개요

### MCP란?

MCP(Model Context Protocol)는 AI 에이전트가 외부 시스템과 통신하기 위한 표준 프로토콜입니다. 데이터베이스, API, 브라우저 등 다양한 도구를 Claude에 연결할 수 있습니다.

### 아키텍처

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Claude    │     │  MCP 서버   │     │   외부 시스템    │
│   Agent     │────▶│  (브릿지)   │────▶│  - PostgreSQL   │
│             │◀────│             │◀────│  - GitHub       │
└─────────────┘     └─────────────┘     │  - Slack        │
                                        │  - Browser      │
                                        └─────────────────┘
```

### MCP 서버 종류

| 유형 | 연결 방식 | 사용 사례 |
|------|-----------|-----------|
| **Stdio** | 로컬 프로세스 | 로컬 CLI 도구, 스크립트 |
| **SSE** | HTTP Server-Sent Events | 원격 서비스, 실시간 스트리밍 |
| **HTTP** | REST API | 간단한 원격 서비스 |
| **SDK** | 코드 내 직접 정의 | 커스텀 도구, 프로그래매틱 제어 |

---

## 서버 유형

### 1. Stdio (표준 입출력)

로컬 프로세스로 실행되는 MCP 서버입니다.

```json
{
  "mcp_servers": {
    "postgres": {
      "type": "stdio",
      "command": "mcp-postgres",
      "args": ["--connection-string", "postgresql://user:pass@localhost/db"],
      "env": {
        "DB_TIMEOUT": "30"
      }
    }
  }
}
```

**장점:**
- 로컬 실행으로 빠른 응답
- 환경 변수로 설정 주입
- 프로세스 격리

### 2. SSE (Server-Sent Events)

원격 서버에서 실행되는 MCP 서버입니다.

```json
{
  "mcp_servers": {
    "github": {
      "type": "sse",
      "url": "https://github-mcp.example.com/sse",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

**장점:**
- 중앙 집중식 관리
- 팀 공유 가능
- 실시간 스트리밍

### 3. HTTP

단순 REST 기반 MCP 서버입니다.

```json
{
  "mcp_servers": {
    "slack": {
      "type": "http",
      "url": "https://slack-mcp.example.com",
      "headers": {
        "Authorization": "Bearer ${SLACK_TOKEN}"
      }
    }
  }
}
```

---

## 설정 방법

### 설정 파일 위치

| 범위 | 파일 | 설명 |
|------|------|------|
| 프로젝트 | `.mcp.json` | 프로젝트별 MCP 서버 |
| 사용자 | `~/.claude.json` | 전역 MCP 서버 |
| settings.json | `mcp_servers` 키 | Agent SDK 설정 |

### .mcp.json 형식

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

### settings.json에서 MCP 활성화

```json
{
  "enableAllProjectMcpServers": true,
  "mcp_servers": {
    "custom-server": {
      "type": "stdio",
      "command": "./my-mcp-server"
    }
  }
}
```

### Agent SDK에서 설정

```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(
    mcp_servers={
        "postgres": {
            "type": "stdio",
            "command": "mcp-postgres",
            "args": ["--connection-string", "postgresql://..."]
        },
        "github": {
            "type": "sse",
            "url": "https://github-mcp.example.com/sse",
            "headers": {"Authorization": f"Bearer {GITHUB_TOKEN}"}
        }
    },
    allowed_tools=["Task", "ListMcpResources", "ReadMcpResource"]
)
```

---

## SDK MCP 서버

### 커스텀 도구 정의

코드 내에서 직접 MCP 도구를 정의할 수 있습니다.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions
from typing import Any

# @tool 데코레이터로 도구 정의
@tool(
    name="get_weather",
    description="특정 위치의 현재 날씨 정보를 가져옵니다",
    input_schema={
        "location": str,
        "units": str  # "celsius" 또는 "fahrenheit"
    }
)
async def get_weather(args: dict[str, Any]) -> dict[str, Any]:
    """날씨 API 호출 (예시)"""
    location = args["location"]
    units = args.get("units", "celsius")

    # 실제 API 호출 로직
    weather_data = await fetch_weather_api(location, units)

    return {
        "content": [{
            "type": "text",
            "text": f"{location} 날씨: {weather_data['temp']}°{units[0].upper()}"
        }]
    }

@tool(
    name="send_notification",
    description="사용자에게 알림을 보냅니다",
    input_schema={
        "message": str,
        "channel": str,
        "priority": str
    }
)
async def send_notification(args: dict[str, Any]) -> dict[str, Any]:
    """알림 발송"""
    message = args["message"]
    channel = args.get("channel", "default")
    priority = args.get("priority", "normal")

    # 알림 발송 로직
    result = await notification_service.send(message, channel, priority)

    return {
        "content": [{
            "type": "text",
            "text": f"알림 발송 완료: {result['id']}"
        }]
    }

# MCP 서버 생성
utility_server = create_sdk_mcp_server(
    name="utilities",
    version="1.0.0",
    tools=[get_weather, send_notification]
)

# 에이전트에서 사용
async def main():
    options = ClaudeAgentOptions(
        mcp_servers={"utils": utility_server},
        allowed_tools=[
            "mcp__utils__get_weather",
            "mcp__utils__send_notification",
            "Task"
        ]
    )

    async for message in query(
        prompt="서울의 날씨를 확인하고 Slack으로 알림 보내주세요",
        options=options
    ):
        print(message)
```

### 도구 스키마 정의

```python
# 복잡한 입력 스키마
@tool(
    name="create_issue",
    description="GitHub 이슈를 생성합니다",
    input_schema={
        "title": str,
        "body": str,
        "labels": list[str],  # 리스트 타입
        "assignees": list[str],
        "milestone": int | None  # Optional
    }
)
async def create_issue(args: dict[str, Any]) -> dict[str, Any]:
    # 이슈 생성 로직
    pass
```

---

## 인기 MCP 서버

### 공식 MCP 서버

| 서버 | 패키지 | 용도 |
|------|--------|------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | 파일 시스템 접근 |
| PostgreSQL | `mcp-postgres` | PostgreSQL 쿼리 |
| Memory | `@modelcontextprotocol/server-memory` | 세션 간 메모리 유지 |

### 커뮤니티 MCP 서버

| 서버 | 용도 |
|------|------|
| Playwright | 브라우저 자동화 |
| GitHub | 저장소 관리, PR, 이슈 |
| Slack | 메시지, 채널 관리 |
| Notion | 페이지, 데이터베이스 |
| Linear | 이슈 트래킹 |
| AWS | AWS 서비스 연동 |

더 많은 서버: https://github.com/modelcontextprotocol/servers

### 설정 예제

**Filesystem:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-filesystem",
        "/home/user/documents",
        "/home/user/projects"
      ]
    }
  }
}
```

**PostgreSQL:**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["mcp-postgres"],
      "env": {
        "PGHOST": "localhost",
        "PGPORT": "5432",
        "PGUSER": "admin",
        "PGPASSWORD": "${PGPASSWORD}",
        "PGDATABASE": "myapp"
      }
    }
  }
}
```

**Playwright (브라우저):**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-playwright"],
      "env": {
        "BROWSER": "chromium",
        "HEADLESS": "true"
      }
    }
  }
}
```

---

## 실전 예제

### 1. 데이터베이스 에이전트

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async def database_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "postgres": {
                "type": "stdio",
                "command": "mcp-postgres",
                "args": ["--connection-string", DB_URL]
            }
        },
        allowed_tools=["Task", "ListMcpResources", "ReadMcpResource"],
        system_prompt="""당신은 데이터베이스 전문가입니다.
        사용자 요청에 따라 SQL 쿼리를 생성하고 실행합니다.
        항상 안전한 쿼리만 실행하세요."""
    )

    async for message in query(
        prompt="지난 30일간 가장 많이 주문한 고객 TOP 10을 조회하세요",
        options=options
    ):
        print(message)
```

### 2. GitHub + Slack 통합

```python
async def devops_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "github": {
                "type": "sse",
                "url": GITHUB_MCP_URL,
                "headers": {"Authorization": f"Bearer {GITHUB_TOKEN}"}
            },
            "slack": {
                "type": "http",
                "url": SLACK_MCP_URL,
                "headers": {"Authorization": f"Bearer {SLACK_TOKEN}"}
            }
        },
        allowed_tools=["Task"],
        system_prompt="""DevOps 에이전트입니다.
        GitHub PR을 확인하고 Slack으로 알림을 보냅니다."""
    )

    async for message in query(
        prompt="오늘 머지된 PR을 확인하고 #dev 채널에 요약해서 알려주세요",
        options=options
    ):
        print(message)
```

### 3. 브라우저 자동화

```python
async def web_scraper_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "playwright": {
                "type": "stdio",
                "command": "npx",
                "args": ["@anthropic-ai/mcp-playwright"]
            }
        },
        allowed_tools=["Task", "Read", "Write"]
    )

    async for message in query(
        prompt="""example.com에서 가격 정보를 수집하고
        prices.json 파일로 저장하세요""",
        options=options
    ):
        print(message)
```

### 4. 멀티 MCP 서버 조합

```python
async def full_stack_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            # 데이터베이스
            "db": {
                "type": "stdio",
                "command": "mcp-postgres",
                "args": ["--connection-string", DB_URL]
            },
            # 파일 시스템
            "fs": {
                "type": "stdio",
                "command": "npx",
                "args": ["@modelcontextprotocol/server-filesystem", "./data"]
            },
            # 메모리 (세션 간 상태 유지)
            "memory": {
                "type": "stdio",
                "command": "npx",
                "args": ["@modelcontextprotocol/server-memory"]
            },
            # 커스텀 도구
            "custom": custom_mcp_server
        },
        allowed_tools=["Task", "Read", "Write", "Bash"]
    )

    async for message in query(
        prompt="""1. 데이터베이스에서 분석 데이터 조회
        2. 결과를 CSV로 저장
        3. 메모리에 분석 결과 요약 저장""",
        options=options
    ):
        print(message)
```

---

## 트러블슈팅

### 일반적인 문제

**1. MCP 서버 연결 실패**

```bash
# 서버 실행 확인
npx @modelcontextprotocol/server-filesystem /path

# 권한 확인
chmod +x ./my-mcp-server
```

**2. 환경 변수 미적용**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "mcp-postgres",
      "env": {
        "PGPASSWORD": "${PGPASSWORD}"  // 셸 환경 변수 참조
      }
    }
  }
}
```

**3. 도구가 보이지 않음**

```python
# allowed_tools에 MCP 도구 포함 확인
options = ClaudeAgentOptions(
    mcp_servers={"my-server": {...}},
    allowed_tools=[
        "mcp__my-server__tool_name",  # MCP 도구 이름 형식
        "Task",
        "ListMcpResources"
    ]
)
```

**4. SSE 연결 타임아웃**

```json
{
  "mcp_servers": {
    "remote": {
      "type": "sse",
      "url": "https://...",
      "timeout": 30000,  // 타임아웃 증가 (ms)
      "retry_count": 3
    }
  }
}
```

### 디버깅 팁

```python
# MCP 리소스 목록 확인
async for message in query(
    prompt="ListMcpResources 도구로 사용 가능한 리소스를 보여주세요",
    options=options
):
    print(message)
```

```bash
# 로그 확인 (Claude Code CLI)
claude --verbose

# MCP 서버 직접 테스트
echo '{"method":"list_tools"}' | npx @modelcontextprotocol/server-filesystem /path
```

---

## 보안 고려사항

### 인증 정보 보호

```python
import os

# 환경 변수에서 시크릿 로드
options = ClaudeAgentOptions(
    mcp_servers={
        "github": {
            "type": "sse",
            "url": os.environ["GITHUB_MCP_URL"],
            "headers": {
                "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"
            }
        }
    }
)
```

### 권한 제한

```python
# 읽기 전용 MCP 도구만 허용
options = ClaudeAgentOptions(
    mcp_servers={...},
    allowed_tools=[
        "mcp__db__query",       # 조회만
        "ListMcpResources",
        "ReadMcpResource"
        # mcp__db__execute 제외 (쓰기 차단)
    ]
)
```

### 네트워크 격리

```bash
# Docker에서 MCP 서버 실행 (네트워크 제한)
docker run --network none \
  -v /data:/data:ro \
  my-mcp-server
```

---

*이전: [훅 가이드](03_hooks.md) | 다음: [스킬 레퍼런스](05_skills.md)*
