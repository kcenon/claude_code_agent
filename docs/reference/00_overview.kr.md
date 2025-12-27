# Claude Code Agent 개요

> **Version**: 1.0.0
> **Last Updated**: 2025-12-26
> **Based on**: Anthropic Official Documentation

## 목차

1. [소개](#소개)
2. [아키텍처 개요](#아키텍처-개요)
3. [핵심 구성 요소](#핵심-구성-요소)
4. [시작하기](#시작하기)
5. [문서 구조](#문서-구조)

---

## 소개

### Claude Code Agent란?

Claude Code Agent는 Anthropic의 Claude AI를 기반으로 한 자율적인 소프트웨어 엔지니어링 에이전트입니다. 이 에이전트는 다음과 같은 작업을 수행할 수 있습니다:

- **코드 분석 및 이해**: 코드베이스 탐색, 패턴 분석, 의존성 파악
- **코드 작성 및 수정**: 버그 수정, 기능 추가, 리팩토링
- **테스트 실행**: 단위 테스트, 통합 테스트 실행 및 결과 분석
- **문서화**: API 문서, README, 기술 문서 생성
- **외부 시스템 연동**: MCP를 통한 데이터베이스, API, 브라우저 등 연동

### Claude Code vs Agent SDK

| 구분 | Claude Code CLI | Agent SDK |
|------|-----------------|-----------|
| **사용 방식** | 대화형 CLI 도구 | 프로그래매틱 라이브러리 |
| **대상 사용자** | 개발자 직접 사용 | 앱/서비스 개발자 |
| **언어 지원** | 터미널 명령 | Python, TypeScript |
| **커스터마이징** | 설정 파일, 훅 | 전체 프로그래매틱 제어 |
| **배포 환경** | 로컬 개발 환경 | 서버, CI/CD, 자동화 |

### Anthropic Client SDK vs Agent SDK

```
┌─────────────────────────────────────────────────────────────────┐
│                      Anthropic Client SDK                        │
│  - API 직접 호출                                                  │
│  - 도구 루프 수동 구현 필요                                        │
│  - 저수준 제어                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ 래핑
┌─────────────────────────────────────────────────────────────────┐
│                        Agent SDK                                 │
│  - 자율적 에이전트 루프                                           │
│  - 내장 도구 실행                                                 │
│  - 세션 관리 및 컨텍스트 유지                                      │
│  - 훅 기반 커스터마이징                                           │
│  - MCP 서버 통합                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 아키텍처 개요

### 에이전트 실행 흐름

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  사용자   │────▶│  Agent SDK  │────▶│   Claude API  │
│  프롬프트 │     │  (에이전트   │     │   (모델 추론)  │
└──────────┘     │   루프)     │     └──────────────┘
                 └─────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ 파일 도구 │ │ 실행 도구 │ │ MCP 서버 │
    │ Read/Edit│ │   Bash   │ │ 외부 연동 │
    └──────────┘ └──────────┘ └──────────┘
```

### 에이전트 루프 상세

1. **프롬프트 수신**: 사용자 작업 요청 수신
2. **도구 결정**: Claude가 필요한 도구 선택
3. **도구 실행**: SDK가 도구 호출 및 결과 수집
4. **결과 분석**: Claude가 결과 분석 및 다음 단계 결정
5. **반복 또는 완료**: 작업 완료까지 2-4 단계 반복

```python
# 에이전트 루프 개념 코드
async for message in query(prompt="버그를 찾아 수정하세요"):
    if message.type == "tool_use":
        # Claude가 도구 사용을 결정함
        result = execute_tool(message.tool_name, message.input)
        # 결과는 자동으로 Claude에게 전달됨
    elif message.type == "result":
        # 작업 완료
        print(message.result)
```

---

## 핵심 구성 요소

### 1. 내장 도구 (Built-in Tools)

| 카테고리 | 도구 | 설명 |
|----------|------|------|
| **파일** | Read, Write, Edit, Glob, Grep | 파일 읽기/쓰기/검색 |
| **실행** | Bash, NotebookEdit | 명령 실행, 노트북 편집 |
| **웹** | WebSearch, WebFetch | 웹 검색 및 페이지 가져오기 |
| **에이전트** | Task, AskUserQuestion | 서브에이전트, 사용자 질문 |
| **관리** | TodoWrite, ListMcpResources | 작업 관리, MCP 리소스 |

### 2. 훅 시스템 (Hooks)

에이전트 생명주기의 주요 지점에서 커스텀 로직 실행:

| 훅 | 시점 | 용도 |
|----|------|------|
| PreToolUse | 도구 실행 전 | 검증, 권한 확인 |
| PostToolUse | 도구 실행 후 | 로깅, 포맷팅 |
| UserPromptSubmit | 프롬프트 제출 시 | 컨텍스트 추가 |
| SessionStart/End | 세션 시작/종료 | 초기화, 정리 |

### 3. MCP (Model Context Protocol)

외부 시스템과의 표준화된 연동 프로토콜:

```
┌───────────────┐     ┌─────────────┐     ┌──────────────┐
│  Agent SDK    │────▶│  MCP 서버   │────▶│  외부 시스템  │
│               │     │             │     │  - Database  │
│               │     │  - Stdio    │     │  - GitHub    │
│               │     │  - SSE      │     │  - Slack     │
│               │     │  - HTTP     │     │  - Browser   │
└───────────────┘     └─────────────┘     └──────────────┘
```

### 4. 스킬 (Skills)

재사용 가능한 모듈화된 기능 단위:

```
my-skill/
├── SKILL.md          # 스킬 정의 및 지침
├── reference.md      # 참조 문서
├── examples.md       # 사용 예제
└── scripts/
    └── helper.py     # 보조 스크립트
```

### 5. 권한 시스템

```json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Read(src/**)"],
    "deny": ["Read(.env*)", "Bash(rm -rf:*)"],
    "ask": ["Bash(git push:*)"]
  }
}
```

---

## 시작하기

### 필수 조건

- Node.js 18+ 또는 Python 3.10+
- Anthropic API 키
- Claude Code CLI (Agent SDK 런타임)

### 설치

```bash
# 1. Claude Code CLI 설치
npm install -g @anthropic-ai/claude-code
# 또는
brew install --cask claude-code

# 2. Agent SDK 설치 (Python)
pip install claude-agent-sdk

# 2. Agent SDK 설치 (TypeScript)
npm install @anthropic-ai/claude-agent-sdk
```

### 인증

```bash
# 방법 1: 환경 변수
export ANTHROPIC_API_KEY=your-api-key

# 방법 2: Claude CLI 로그인
claude login
```

### 첫 번째 에이전트

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="src 폴더의 코드를 분석하고 개선점을 제안하세요",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep"],
            cwd="/path/to/project"
        )
    ):
        if hasattr(message, "text"):
            print(message.text)

asyncio.run(main())
```

---

## 문서 구조

이 참조 문서는 다음과 같이 구성되어 있습니다:

| 문서 | 설명 |
|------|------|
| [01_agent_sdk.md](01_agent_sdk.md) | Agent SDK 상세 가이드 |
| [02_tools.md](02_tools.md) | 내장 도구 레퍼런스 |
| [03_hooks.md](03_hooks.md) | 훅 시스템 가이드 |
| [04_mcp.md](04_mcp.md) | MCP 통합 가이드 |
| [05_skills.md](05_skills.md) | 스킬 시스템 레퍼런스 |
| [06_configuration.md](06_configuration.md) | 설정 및 권한 가이드 |
| [07_security.md](07_security.md) | 보안 고려사항 |
| [08_patterns.md](08_patterns.md) | 아키텍처 패턴 |
| [09_api_reference.md](09_api_reference.md) | API 레퍼런스 |

---

## 공식 문서 링크

| 주제 | URL |
|------|-----|
| Agent SDK Overview | https://platform.claude.com/docs/en/agent-sdk/overview |
| Claude Code Docs | https://code.claude.com/docs/en/overview |
| Tool Use Guide | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| MCP Guide | https://code.claude.com/docs/en/mcp |

---

*다음: [Agent SDK 상세 가이드](01_agent_sdk.md)*
