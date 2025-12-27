# Claude Code Agent 참조 문서

> **Version**: 1.0.0
> **Last Updated**: 2025-12-26
> **Based on**: Anthropic Official Documentation

## 개요

이 문서는 Claude Code를 활용한 AI Agent 개발을 위한 종합 참조 가이드입니다. Anthropic의 공식 문서를 기반으로 작성되었으며, Agent SDK, 도구, 훅, MCP 통합 등 핵심 개념을 다룹니다.

---

## 문서 목차

### 기초

| # | 문서 | 설명 |
|---|------|------|
| 00 | [개요](00_overview.md) | Claude Code Agent 소개 및 아키텍처 개요 |
| 01 | [Agent SDK](01_agent_sdk.md) | Agent SDK 설치, 설정, 핵심 API |
| 02 | [도구 레퍼런스](02_tools.md) | 내장 도구 (Read, Edit, Bash 등) 상세 |

### 확장

| # | 문서 | 설명 |
|---|------|------|
| 03 | [훅 가이드](03_hooks.md) | 훅 시스템으로 에이전트 동작 커스터마이징 |
| 04 | [MCP 통합](04_mcp.md) | 외부 시스템 연동 (데이터베이스, API 등) |
| 05 | [스킬 레퍼런스](05_skills.md) | 재사용 가능한 모듈화된 기능 정의 |

### 운영

| # | 문서 | 설명 |
|---|------|------|
| 06 | [설정 가이드](06_configuration.md) | 권한, 환경 변수, 모델 설정 |
| 07 | [보안 가이드](07_security.md) | 격리, 인증 정보 보호, 감사 |

### 고급

| # | 문서 | 설명 |
|---|------|------|
| 08 | [아키텍처 패턴](08_patterns.md) | 단일/멀티 에이전트, 워크플로우 패턴 |
| 09 | [API 레퍼런스](09_api_reference.md) | Messages API, Agent SDK API 상세 |

---

## 빠른 시작

### 1. 설치

```bash
# Claude Code CLI 설치
npm install -g @anthropic-ai/claude-code

# Agent SDK 설치 (Python)
pip install claude-agent-sdk

# Agent SDK 설치 (TypeScript)
npm install @anthropic-ai/claude-agent-sdk
```

### 2. 인증

```bash
export ANTHROPIC_API_KEY=your-api-key
```

### 3. 첫 번째 에이전트

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="src 폴더의 코드를 분석하세요",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob", "Grep"]
        )
    ):
        print(message)

asyncio.run(main())
```

---

## 학습 경로

### 입문자

1. [개요](00_overview.md) - 전체 구조 이해
2. [Agent SDK](01_agent_sdk.md) - 기본 사용법
3. [도구 레퍼런스](02_tools.md) - 내장 도구 활용

### 중급자

4. [훅 가이드](03_hooks.md) - 동작 커스터마이징
5. [설정 가이드](06_configuration.md) - 권한 및 설정
6. [MCP 통합](04_mcp.md) - 외부 시스템 연동

### 고급자

7. [보안 가이드](07_security.md) - 프로덕션 보안
8. [아키텍처 패턴](08_patterns.md) - 복잡한 시스템 설계
9. [API 레퍼런스](09_api_reference.md) - 상세 API 정보

---

## 용도별 참조

### 코드 분석 에이전트 만들기

- [도구: Read, Glob, Grep](02_tools.md#파일-도구)
- [패턴: 단일 에이전트](08_patterns.md#단일-에이전트-패턴)
- [스킬: 코드 리뷰](05_skills.md#1-코드-리뷰-스킬)

### 코드 수정 에이전트 만들기

- [도구: Read, Write, Edit, Bash](02_tools.md)
- [권한 설정](06_configuration.md#권한-시스템)
- [훅: 자동 포맷팅](03_hooks.md#2-자동-코드-포맷팅)

### 외부 시스템 연동

- [MCP 서버 설정](04_mcp.md#설정-방법)
- [SDK MCP 서버](04_mcp.md#sdk-mcp-서버)
- [통합 패턴](08_patterns.md#통합-패턴)

### 프로덕션 배포

- [보안 체크리스트](07_security.md#보안-체크리스트)
- [격리 전략](07_security.md#격리-전략)
- [프로덕션 아키텍처](08_patterns.md#프로덕션-아키텍처)

---

## 핵심 개념 요약

### 에이전트 실행 흐름

```
프롬프트 → Claude가 도구 선택 → SDK가 도구 실행 → 결과 분석 → 반복/완료
```

### 주요 구성 요소

| 구성 요소 | 역할 |
|-----------|------|
| **Agent SDK** | 에이전트 루프 및 도구 실행 |
| **도구** | 파일, 명령, 웹 작업 수행 |
| **훅** | 생명주기 이벤트 가로채기 |
| **MCP** | 외부 시스템 연동 |
| **스킬** | 재사용 가능한 기능 모듈 |
| **권한** | 도구 접근 제어 |

### 권한 모드

| 모드 | 설명 |
|------|------|
| `default` | 모든 작업 확인 |
| `acceptEdits` | 파일 편집 자동 승인 |
| `bypassPermissions` | 모든 권한 우회 (위험!) |
| `plan` | 실행 없이 계획만 |

---

## 공식 자료

| 리소스 | URL |
|--------|-----|
| Agent SDK 문서 | https://platform.claude.com/docs/en/agent-sdk/overview |
| Claude Code 문서 | https://code.claude.com/docs/en/overview |
| Tool Use 가이드 | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| MCP 프로토콜 | https://modelcontextprotocol.io |
| API 참조 | https://docs.anthropic.com/en/api |
| 커뮤니티 MCP 서버 | https://github.com/modelcontextprotocol/servers |

---

## 버전 이력

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0.0 | 2025-12-26 | 초기 문서 작성 |

---

## 기여 및 피드백

이 문서에 대한 개선 제안이나 오류 신고는 이슈로 등록해주세요.

---

*Claude Code Agent 개발을 시작하려면 [개요](00_overview.md)부터 읽어보세요.*
