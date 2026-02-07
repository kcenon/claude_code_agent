# Software Design Specification (SDS)

## Agent-Driven Software Development Lifecycle System

| Field | Value |
|-------|-------|
| **Document ID** | SDS-001 |
| **Source SRS** | SRS-001 |
| **Source PRD** | PRD-001 |
| **Version** | 1.1.0 |
| **Status** | Review |
| **Created** | 2025-12-27 |
| **Author** | System Architect |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Component Design](#3-component-design)
4. [Data Design](#4-data-design)
5. [Interface Design](#5-interface-design)
6. [Security Design](#6-security-design)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Error Handling & Recovery](#8-error-handling--recovery)
9. [Traceability Matrix](#9-traceability-matrix)
10. [Appendix](#10-appendix)

---

## 1. Introduction

### 1.1 Purpose

본 소프트웨어 설계 명세서(SDS)는 Agent-Driven SDLC (AD-SDLC) 시스템의 상세 설계를 정의합니다. SRS-001에서 정의된 시스템 기능을 구현하기 위한 아키텍처, 컴포넌트, 인터페이스, 데이터 설계를 명시하여 개발팀이 직접 구현에 활용할 수 있도록 합니다.

**대상 독자:**
- Software Developers
- System Architects
- DevOps Engineers
- QA Engineers

### 1.2 Scope

본 SDS는 다음 범위의 설계를 포함합니다:

| Category | Scope |
|----------|-------|
| **Architecture** | 멀티 에이전트 오케스트레이션 아키텍처, Scratchpad 패턴 |
| **Components** | 28개 컴포넌트 설계 (25개 특화 에이전트 + 3개 인프라 서비스) |
| **Data** | 파일 기반 상태 스키마, 데이터 엔티티 정의 |
| **Interfaces** | 에이전트 간 통신, GitHub API 연동, CLI 인터페이스 |
| **Security** | 인증, 권한 관리, 민감 정보 보호 |
| **Deployment** | 로컬 실행 환경, 설정 관리 |

### 1.3 Design Goals

| Goal ID | Goal | Description |
|---------|------|-------------|
| DG-001 | **Modularity** | 각 에이전트가 독립적으로 개발/테스트/배포 가능 |
| DG-002 | **Extensibility** | 새로운 에이전트 추가 및 워크플로우 커스터마이징 용이 |
| DG-003 | **Resilience** | 실패 시 자동 복구, 재시도 메커니즘 |
| DG-004 | **Traceability** | 요구사항-설계-구현 간 완전한 추적성 |
| DG-005 | **Transparency** | 모든 에이전트 활동 로깅 및 감사 가능 |

### 1.4 Design Constraints

| Constraint ID | Constraint | Design Decision |
|---------------|------------|-----------------|
| DC-001 | Claude Agent SDK 단방향 통신 | Scratchpad 패턴 (파일 기반 상태 공유) 도입 |
| DC-002 | Context Window 200K 토큰 | Context Compaction 전략, 문서 분할 처리 |
| DC-003 | GitHub API Rate Limit | 배치 처리, 캐싱, 지수 백오프 |
| DC-004 | 동시 Worker 최대 5개 | Worker Pool 관리, 큐 기반 스케줄링 |

### 1.5 References

| Reference | Description |
|-----------|-------------|
| PRD-001 | Product Requirements Document |
| SRS-001 | Software Requirements Specification |
| Claude Agent SDK | https://platform.claude.com/docs/en/agent-sdk |
| Claude Code Subagents | https://code.claude.com/docs/en/sub-agents |

---

## 2. System Architecture

### 2.1 Architecture Overview

AD-SDLC는 **계층형 멀티 에이전트 아키텍처**를 채택합니다. Main Orchestrator가 특화된 서브 에이전트들을 조율하며, Scratchpad 패턴을 통해 에이전트 간 상태를 공유합니다.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AD-SDLC System Architecture                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRESENTATION LAYER                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │ │
│  │  │   CLI Input     │  │  File Input     │  │   URL Input     │           │ │
│  │  │  (Natural Lang) │  │ (.md/.pdf/.docx)│  │  (HTTP/HTTPS)   │           │ │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │ │
│  └───────────┼────────────────────┼────────────────────┼─────────────────────┘ │
│              │                    │                    │                        │
│              └────────────────────┼────────────────────┘                        │
│                                   ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                       ORCHESTRATION LAYER                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                      Main Claude Agent                               │ │ │
│  │  │                   (Entry Point & Coordinator)                        │ │ │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │ │ │
│  │  │  │  Workflow   │ │   State     │ │  Approval   │ │   Error     │   │ │ │
│  │  │  │  Manager    │ │  Manager    │ │   Gate      │ │  Handler    │   │ │ │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                             │
│                    ┌──────────────┼──────────────┐                             │
│                    ▼              ▼              ▼                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                         AGENT LAYER                                        │ │
│  │                                                                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    DOCUMENT PIPELINE (Sequential)                    │ │ │
│  │  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │ │ │
│  │  │  │CMP-001   │──▶│CMP-002   │──▶│CMP-003   │──▶│CMP-004   │         │ │ │
│  │  │  │Collector │   │PRD Writer│   │SRS Writer│   │SDS Writer│         │ │ │
│  │  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘         │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                   ISSUE MANAGEMENT (Sequential)                      │ │ │
│  │  │  ┌──────────┐   ┌──────────┐                                        │ │ │
│  │  │  │CMP-005   │──▶│CMP-006   │                                        │ │ │
│  │  │  │Issue Gen │   │Controller│                                        │ │ │
│  │  │  └──────────┘   └──────────┘                                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                      EXECUTION (Parallel)                            │ │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         ┌──────────┐       │ │ │
│  │  │  │CMP-007   │ │CMP-007   │ │CMP-007   │   ──▶   │CMP-008   │       │ │ │
│  │  │  │Worker #1 │ │Worker #2 │ │Worker #N │         │PR Review │       │ │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘         └──────────┘       │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                             │
│                                   ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                     STATE MANAGEMENT LAYER                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │ │
│  │  │   Scratchpad    │  │  Session Store  │  │   Audit Log     │           │ │
│  │  │  (File-based    │  │  (Transcripts)  │  │  (Event Trail)  │           │ │
│  │  │   YAML/JSON/MD) │  │                 │  │                 │           │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                   │                                             │
│                                   ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                    EXTERNAL INTEGRATION LAYER                              │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │ │
│  │  │   GitHub API    │  │   File System   │  │   Web Sources   │           │ │
│  │  │ (Issues, PRs,   │  │ (Code, Docs,    │  │ (URLs, Search)  │           │ │
│  │  │  Actions)       │  │  Config)        │  │                 │           │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Patterns

#### 2.2.1 Scratchpad Pattern

Claude Agent SDK의 단방향 통신(부모→자식) 제약을 극복하기 위한 파일 기반 상태 공유 패턴입니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Scratchpad Pattern                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐    │
│   │   Agent A     │         │  Scratchpad   │         │   Agent B     │    │
│   │ (Producer)    │         │ (File System) │         │ (Consumer)    │    │
│   └───────┬───────┘         └───────────────┘         └───────┬───────┘    │
│           │                         │                         │            │
│           │    1. Write State       │                         │            │
│           │─────────────────────────▶                         │            │
│           │                         │                         │            │
│           │                         │    2. Read State        │            │
│           │                         ◀─────────────────────────│            │
│           │                         │                         │            │
│           │                         │    3. Write Result      │            │
│           │                         ◀─────────────────────────│            │
│           │                         │                         │            │
│                                                                             │
│   File Structure:                                                           │
│   .ad-sdlc/scratchpad/                                                      │
│   ├── info/{project_id}/                                                    │
│   │   ├── collected_info.yaml      ◀── Collector writes                    │
│   │   └── clarifications.json      ◀── Q&A history                         │
│   ├── documents/{project_id}/                                               │
│   │   ├── prd.md                   ◀── PRD Writer writes, SRS Reader reads │
│   │   ├── srs.md                   ◀── SRS Writer writes, SDS Reader reads │
│   │   └── sds.md                   ◀── SDS Writer writes                   │
│   ├── issues/{project_id}/                                                  │
│   │   ├── issue_list.json          ◀── Issue Generator writes              │
│   │   └── dependency_graph.json    ◀── Dependency mapping                  │
│   └── progress/{project_id}/                                                │
│       ├── controller_state.yaml    ◀── Controller state                    │
│       ├── work_orders/*.yaml       ◀── Work assignments                    │
│       └── results/*.yaml           ◀── Implementation results              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Pipeline Pattern

에이전트들은 두 가지 실행 패턴을 따릅니다:

**Sequential Pipeline (문서 생성):**
```
Collector → PRD Writer → SRS Writer → SDS Writer → Issue Generator → Controller
```

**Parallel Execution (코드 구현):**
```
Controller ──┬── Worker #1 ──┐
             ├── Worker #2 ──┼──▶ PR Review
             └── Worker #N ──┘
```

#### 2.2.3 Event-Driven Coordination

```yaml
Events:
  stage_complete:
    payload:
      stage: string
      project_id: string
      output_files: list
      success: boolean
    triggers:
      - next_stage_start
      - approval_gate (if configured)
      - notification

  approval_granted:
    payload:
      stage: string
      approver: string
      timestamp: datetime
    triggers:
      - next_stage_start

  worker_complete:
    payload:
      worker_id: string
      issue_id: string
      status: success|failure|blocked
    triggers:
      - controller_schedule_next
      - pr_review (if all workers done)
```

### 2.3 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Runtime** | Claude Agent SDK | Latest | 공식 에이전트 SDK |
| **CLI** | Claude Code CLI | Latest | 개발자 친화적 인터페이스 |
| **Model** | Claude Sonnet 4 | claude-sonnet-4-* | 비용/성능 균형 |
| **Model (Critical)** | Claude Opus 4.5 | claude-opus-4-5-* | 복잡한 추론 필요 시 |
| **VCS** | Git | 2.30+ | 버전 관리 |
| **Issue Tracking** | GitHub CLI | 2.0+ | GitHub 연동 |
| **Config Format** | YAML | 1.2 | 설정 파일 |
| **Data Format** | JSON, YAML, Markdown | - | 상태 및 문서 저장 |
| **Logging** | JSON Structured Logs | - | 구조화된 로깅 |

### 2.4 Directory Structure

```
project-root/
├── .claude/
│   ├── agents/                          # Agent Definition Files
│   │   ├── collector.md                 # CMP-001
│   │   ├── prd-writer.md                # CMP-002
│   │   ├── srs-writer.md                # CMP-003
│   │   ├── sds-writer.md                # CMP-004
│   │   ├── issue-generator.md           # CMP-005
│   │   ├── controller.md                # CMP-006
│   │   ├── worker.md                    # CMP-007
│   │   └── pr-reviewer.md               # CMP-008
│   └── settings.json                    # Claude Code settings
│
├── .ad-sdlc/
│   ├── scratchpad/                      # Inter-agent State (Scratchpad)
│   │   ├── info/{project_id}/           # Collected information
│   │   │   ├── collected_info.yaml
│   │   │   └── clarifications.json
│   │   ├── documents/{project_id}/      # Generated documents
│   │   │   ├── prd.md
│   │   │   ├── srs.md
│   │   │   └── sds.md
│   │   ├── issues/{project_id}/         # Issue tracking
│   │   │   ├── issue_list.json
│   │   │   └── dependency_graph.json
│   │   └── progress/{project_id}/       # Progress tracking
│   │       ├── controller_state.yaml
│   │       ├── work_orders/
│   │       │   └── WO-{xxx}.yaml
│   │       ├── results/
│   │       │   └── WO-{xxx}-result.yaml
│   │       └── reviews/
│   │           └── PR-{xxx}-review.yaml
│   │
│   ├── templates/                       # Document Templates
│   │   ├── prd-template.md
│   │   ├── srs-template.md
│   │   ├── sds-template.md
│   │   └── issue-template.md
│   │
│   ├── config/                          # Configuration
│   │   ├── agents.yaml                  # Agent registry
│   │   └── workflow.yaml                # Pipeline config
│   │
│   └── logs/                            # Audit Logs
│       ├── ad-sdlc.log
│       └── agent-logs/
│           ├── collector.log
│           └── ...
│
├── docs/                                # Published Documents
│   ├── prd/
│   │   └── PRD-{project_id}.md
│   ├── srs/
│   │   └── SRS-{project_id}.md
│   └── sds/
│       └── SDS-{project_id}.md
│
└── src/                                 # Generated Source Code
    └── ...
```

---

## 3. Component Design

### 3.1 Component Overview

| CMP ID | Component Name | Korean Name | Source Features | Responsibility |
|--------|----------------|-------------|-----------------|----------------|
| CMP-001 | Collector Agent | 정보 수집 에이전트 | SF-001 | 다중 소스 정보 수집 및 구조화 |
| CMP-002 | PRD Writer Agent | PRD 작성 에이전트 | SF-002 | PRD 문서 자동 생성 |
| CMP-003 | SRS Writer Agent | SRS 작성 에이전트 | SF-003 | SRS 문서 자동 생성 |
| CMP-004 | SDS Writer Agent | SDS 작성 에이전트 | SF-004 | SDS 문서 자동 생성 |
| CMP-005 | Issue Generator | 이슈 생성 에이전트 | SF-005 | GitHub Issue 자동 생성 |
| CMP-006 | Controller Agent | 관제 에이전트 | SF-006, SF-007 | 작업 우선순위 및 할당 관리 |
| CMP-007 | Worker Agent | 작업 에이전트 | SF-008, SF-009 | 코드 구현 및 자체 검증 |
| CMP-008 | PR Review Agent | PR 리뷰 에이전트 | SF-010, SF-011 | PR 생성 및 코드 리뷰 |
| CMP-009 | State Manager | 상태 관리자 | SF-014 | Scratchpad 상태 관리 |
| CMP-010 | Logger | 로깅 서비스 | SF-015 | 활동 로깅 및 감사 |
| CMP-011 | Error Handler | 오류 처리기 | SF-016 | 재시도 및 복구 관리 |
| CMP-012 | Document Reader Agent | 문서 분석 에이전트 | SF-017 | 기존 명세 문서 파싱 및 추적성 맵 구축 |
| CMP-013 | Codebase Analyzer Agent | 코드베이스 분석 에이전트 | SF-018 | 기존 코드 구조 및 아키텍처 분석 |
| CMP-014 | Impact Analyzer Agent | 영향 분석 에이전트 | SF-019 | 변경 영향 범위 및 리스크 평가 |
| CMP-015 | PRD Updater Agent | PRD 갱신 에이전트 | SF-020 | PRD 점진적 갱신 |
| CMP-016 | SRS Updater Agent | SRS 갱신 에이전트 | SF-021 | SRS 점진적 갱신 |
| CMP-017 | SDS Updater Agent | SDS 갱신 에이전트 | SF-022 | SDS 점진적 갱신 |
| CMP-018 | Regression Tester Agent | 회귀 테스트 에이전트 | SF-023 | 영향받는 테스트 매핑 및 회귀 테스트 |
| CMP-019 | Doc-Code Comparator Agent | 문서-코드 비교 에이전트 | SF-024 | 명세와 코드 갭 분석 |
| CMP-020 | Code Reader Agent | 코드 리더 에이전트 | SF-025 | AST 기반 소스코드 분석 |
| CMP-021 | CI Fixer Agent | CI 수정 에이전트 | SF-026 | CI/CD 실패 진단 및 자동 수정 |
| CMP-022 | Mode Detector Agent | 모드 감지 에이전트 | SF-027 | Greenfield/Enhancement 파이프라인 모드 감지 |
| CMP-023 | Project Initializer Agent | 프로젝트 초기화 에이전트 | SF-028 | .ad-sdlc 작업 공간 초기화 |
| CMP-024 | Repo Detector Agent | 저장소 감지 에이전트 | SF-029 | 기존 GitHub 저장소 감지 |
| CMP-025 | AD-SDLC Orchestrator Agent | 파이프라인 오케스트레이터 | SF-030 | 전체 파이프라인 조율 |
| CMP-026 | Analysis Orchestrator Agent | 분석 오케스트레이터 | SF-030 | Enhancement 분석 서브 파이프라인 |
| CMP-027 | GitHub Repo Setup Agent | GitHub 저장소 설정 에이전트 | SF-029 | GitHub 저장소 생성 및 초기화 |
| CMP-028 | Issue Reader Agent | 이슈 리더 에이전트 | SF-031 | 기존 GitHub 이슈 가져오기 |

### 3.2 CMP-001: Collector Agent

**Source Features**: SF-001 (UC-001, UC-002, UC-003)

**Responsibility**: 사용자로부터 다양한 형태의 입력(자연어, 파일, URL)을 수집하고 구조화된 정보 문서로 변환

#### 3.2.1 Interface Definition

```typescript
interface ICollectorAgent {
  /**
   * 자연어 입력을 분석하여 구조화된 정보를 추출
   * @param input 사용자의 자연어 입력
   * @returns 추출된 정보와 명확화 질문
   */
  collectFromText(input: string): Promise<CollectionResult>;

  /**
   * 파일 내용을 읽고 정보를 추출
   * @param filePaths 입력 파일 경로들
   * @returns 추출된 정보
   */
  collectFromFiles(filePaths: string[]): Promise<CollectionResult>;

  /**
   * URL에서 콘텐츠를 가져와 정보를 추출
   * @param urls URL 목록
   * @returns 추출된 정보
   */
  collectFromUrls(urls: string[]): Promise<CollectionResult>;

  /**
   * 명확화 질문에 대한 사용자 응답을 처리
   * @param questionId 질문 ID
   * @param answer 사용자 응답
   */
  processAnswer(questionId: string, answer: string): Promise<void>;

  /**
   * 수집된 정보를 최종 YAML로 저장
   * @param projectId 프로젝트 ID
   */
  finalize(projectId: string): Promise<string>;
}

interface CollectionResult {
  projectName: string;
  description: string;
  requirements: {
    functional: FunctionalRequirement[];
    nonFunctional: NonFunctionalRequirement[];
  };
  constraints: string[];
  assumptions: string[];
  dependencies: Dependency[];
  questions: ClarifyingQuestion[];  // 추가 명확화 필요 항목
  confidence: number;  // 0.0 - 1.0
}

interface ClarifyingQuestion {
  id: string;
  category: 'requirement' | 'constraint' | 'assumption' | 'priority';
  question: string;
  context: string;
  required: boolean;
}
```

#### 3.2.2 State Schema

```yaml
# .ad-sdlc/scratchpad/info/{project_id}/collected_info.yaml
schema:
  version: "1.0"
  project_id: string
  created_at: datetime
  updated_at: datetime
  status: collecting | clarifying | completed

  project:
    name: string
    description: string

  stakeholders:
    - name: string
      role: string
      contact: string  # Optional

  requirements:
    functional:
      - id: "FR-XXX"
        title: string
        description: string
        priority: P0 | P1 | P2 | P3
        source: string  # 입력 소스 (user_input, file:path, url:uri)
        acceptance_criteria:
          - criterion: string

    non_functional:
      - id: "NFR-XXX"
        category: performance | security | reliability | usability | maintainability
        requirement: string
        metric: string  # Optional
        target: string  # Optional

  constraints:
    - id: "CON-XXX"
      description: string
      rationale: string

  assumptions:
    - id: "ASM-XXX"
      description: string
      risk_if_wrong: string

  dependencies:
    - name: string
      version: string  # Optional
      type: library | service | system
      purpose: string

  clarifications:
    - question_id: string
      question: string
      answer: string
      answered_at: datetime

  sources:
    - type: text | file | url
      reference: string
      extracted_at: datetime
```

#### 3.2.3 Tools Required

| Tool | Purpose | Usage |
|------|---------|-------|
| `Read` | 파일 내용 읽기 | .md, .pdf, .docx, .txt 파일 처리 |
| `WebFetch` | URL 콘텐츠 가져오기 | HTTP/HTTPS URL 처리 |
| `WebSearch` | 관련 정보 검색 | 추가 컨텍스트 수집 |
| `Grep` | 패턴 기반 정보 추출 | 기존 코드베이스 분석 |
| `Write` | 정보 문서 저장 | YAML 형식으로 저장 |

#### 3.2.4 Processing Logic

```python
# Pseudo-code for Collector Agent logic
class CollectorAgent:
    MAX_QUESTIONS = 5
    MIN_CONFIDENCE = 0.8

    def collect(self, inputs: List[Input]) -> CollectionResult:
        """
        1. 입력 타입별 처리
        2. 정보 추출 및 구조화
        3. 신뢰도 평가
        4. 명확화 질문 생성 (필요 시)
        """
        extracted_info = []

        for input in inputs:
            if input.type == "text":
                info = self._extract_from_text(input.content)
            elif input.type == "file":
                info = self._extract_from_file(input.path)
            elif input.type == "url":
                info = self._extract_from_url(input.url)
            extracted_info.append(info)

        # 정보 통합 및 중복 제거
        merged = self._merge_information(extracted_info)

        # 신뢰도 평가
        confidence = self._evaluate_confidence(merged)

        # 명확화 질문 생성
        questions = []
        if confidence < self.MIN_CONFIDENCE:
            questions = self._generate_questions(merged)[:self.MAX_QUESTIONS]

        return CollectionResult(
            **merged,
            questions=questions,
            confidence=confidence
        )

    def _evaluate_confidence(self, info: dict) -> float:
        """
        정보 완전성 및 명확성 평가
        - 필수 필드 존재 여부
        - 요구사항 상세도
        - 충돌 또는 모호성 존재 여부
        """
        score = 0.0

        # 필수 필드 체크 (각 20%)
        if info.get('project', {}).get('name'):
            score += 0.2
        if len(info.get('requirements', {}).get('functional', [])) >= 3:
            score += 0.2
        if info.get('constraints'):
            score += 0.2

        # 상세도 체크 (40%)
        for fr in info.get('requirements', {}).get('functional', []):
            if fr.get('acceptance_criteria'):
                score += 0.1

        return min(score, 1.0)
```

#### 3.2.5 Error Handling

| Error Code | Condition | Handling |
|------------|-----------|----------|
| COL-001 | 입력이 너무 짧음 (< 50자) | 최소 요구사항 안내 메시지 반환 |
| COL-002 | 파일 읽기 실패 | 오류 로그, 대체 입력 요청 |
| COL-003 | URL 접근 불가 | 오류 로그, 수동 입력 요청 |
| COL-004 | 지원하지 않는 파일 형식 | 지원 형식 목록 안내 |
| COL-005 | Context 한계 도달 | 입력 분할 처리 안내 |

---

### 3.3 CMP-002: PRD Writer Agent

**Source Features**: SF-002 (UC-004, UC-005)

**Responsibility**: 수집된 정보를 분석하여 표준 PRD 템플릿 기반의 문서를 자동 생성

#### 3.3.1 Interface Definition

```typescript
interface IPRDWriterAgent {
  /**
   * 수집된 정보로부터 PRD 초안 생성
   * @param projectId 프로젝트 ID
   * @returns PRD 문서 경로
   */
  generatePRD(projectId: string): Promise<PRDGenerationResult>;

  /**
   * PRD Gap Analysis 수행
   * @param prdContent PRD 내용
   * @returns 누락된 정보 목록
   */
  analyzeGaps(prdContent: string): Promise<GapAnalysisResult>;

  /**
   * 요구사항 간 충돌 검사
   * @param requirements 요구사항 목록
   * @returns 충돌 목록
   */
  checkConsistency(requirements: Requirement[]): Promise<ConsistencyResult>;

  /**
   * 사용자 피드백 반영하여 PRD 수정
   * @param projectId 프로젝트 ID
   * @param feedback 수정 요청 내용
   */
  revisePRD(projectId: string, feedback: string): Promise<string>;
}

interface PRDGenerationResult {
  prdPath: string;
  sections: PRDSection[];
  gaps: string[];
  conflicts: ConflictItem[];
  quality: QualityMetrics;
}

interface QualityMetrics {
  completeness: number;  // 0.0 - 1.0
  consistency: number;
  clarity: number;
  overall: number;
}
```

#### 3.3.2 PRD Template Structure

```markdown
# PRD: {Product Name}

| Field | Value |
|-------|-------|
| Document ID | PRD-{project_id} |
| Version | {version} |
| Status | Draft | Review | Approved |
| Created | {date} |

## 1. Executive Summary
[자동 생성: 프로젝트 개요 1-2 문단]

## 2. Problem Statement
### 2.1 Current Challenges
[수집된 정보 기반 현재 문제점]

### 2.2 Target Users
[식별된 사용자 그룹]

## 3. Goals & Success Metrics
| Goal ID | Goal | Metric | Target |
|---------|------|--------|--------|
| G-001 | {goal} | {metric} | {target} |

## 4. User Personas
### 4.1 Primary Persona
[자동 생성된 페르소나]

## 5. Functional Requirements
### FR-001: {Requirement Title}
- **Description**: {description}
- **Priority**: P0 | P1 | P2 | P3
- **Acceptance Criteria**:
  - [ ] {criterion 1}
  - [ ] {criterion 2}
- **Dependencies**: {dependencies}
- **Source**: {source reference}

## 6. Non-Functional Requirements
| NFR ID | Category | Requirement | Metric |
|--------|----------|-------------|--------|

## 7. Constraints & Assumptions
### 7.1 Constraints
### 7.2 Assumptions

## 8. Timeline & Milestones
[자동 생성 또는 TBD]

## 9. Risks & Mitigations
| Risk ID | Risk | Probability | Impact | Mitigation |
|---------|------|-------------|--------|------------|

## 10. Appendix
### 10.1 Gap Analysis
[자동 식별된 누락 정보]

### 10.2 Traceability
[collected_info.yaml 항목과의 매핑]
```

#### 3.3.3 Quality Gates

```yaml
prd_quality_gates:
  required_sections:
    - executive_summary
    - problem_statement
    - goals_and_metrics
    - functional_requirements
    - non_functional_requirements

  validation_rules:
    - rule: "min_functional_requirements"
      value: 3
      message: "최소 3개의 기능 요구사항이 필요합니다"

    - rule: "all_fr_have_priority"
      message: "모든 기능 요구사항에 우선순위가 지정되어야 합니다"

    - rule: "all_fr_have_acceptance_criteria"
      min_criteria: 1
      message: "각 요구사항에 최소 1개의 인수 기준이 필요합니다"

    - rule: "unique_requirement_ids"
      message: "요구사항 ID는 고유해야 합니다"
```

---

### 3.4 CMP-003: SRS Writer Agent

**Source Features**: SF-003 (UC-006)

**Responsibility**: PRD를 분석하여 상세한 소프트웨어 요구사항 명세서(SRS)를 자동 생성

#### 3.4.1 Interface Definition

```typescript
interface ISRSWriterAgent {
  /**
   * PRD로부터 SRS 생성
   * @param projectId 프로젝트 ID
   * @returns SRS 생성 결과
   */
  generateSRS(projectId: string): Promise<SRSGenerationResult>;

  /**
   * PRD 요구사항을 시스템 기능으로 분해
   * @param requirement PRD 요구사항
   * @returns 분해된 시스템 기능 목록
   */
  decomposeRequirement(requirement: FunctionalRequirement): Promise<SystemFeature[]>;

  /**
   * 유스케이스 시나리오 생성
   * @param feature 시스템 기능
   * @returns 유스케이스 목록
   */
  generateUseCases(feature: SystemFeature): Promise<UseCase[]>;

  /**
   * 추적성 매트릭스 생성
   * @param projectId 프로젝트 ID
   * @returns PRD → SRS 추적성 매트릭스
   */
  buildTraceabilityMatrix(projectId: string): Promise<TraceabilityMatrix>;
}

interface SystemFeature {
  id: string;        // SF-XXX
  name: string;
  description: string;
  sourceRequirement: string;  // FR-XXX
  priority: Priority;
  useCases: UseCase[];
  acceptanceCriteria: string[];
  dependencies: string[];
}

interface UseCase {
  id: string;        // UC-XXX
  title: string;
  actor: string;
  preconditions: string[];
  mainFlow: FlowStep[];
  alternativeFlows: AlternativeFlow[];
  exceptionFlows: ExceptionFlow[];
  postconditions: string[];
}
```

#### 3.4.2 SRS Structure

```yaml
srs_structure:
  sections:
    - section: "1. Introduction"
      subsections:
        - "1.1 Purpose"
        - "1.2 Scope"
        - "1.3 Definitions & Acronyms"
        - "1.4 References"

    - section: "2. Overall Description"
      subsections:
        - "2.1 Product Perspective"
        - "2.2 Product Functions Summary"
        - "2.3 User Classes and Characteristics"
        - "2.4 Operating Environment"
        - "2.5 Design and Implementation Constraints"
        - "2.6 Assumptions and Dependencies"

    - section: "3. System Features"
      # 각 SF-XXX 별 서브섹션
      per_feature:
        - "Description"
        - "Use Cases"
        - "Acceptance Criteria"
        - "Dependencies"

    - section: "4. External Interface Requirements"
      subsections:
        - "4.1 User Interfaces"
        - "4.2 API Interfaces"
        - "4.3 File Interfaces"
        - "4.4 External System Interfaces"

    - section: "5. Non-Functional Requirements"
      subsections:
        - "5.1 Performance"
        - "5.2 Reliability"
        - "5.3 Security"
        - "5.4 Maintainability"

    - section: "6. Data Requirements"
      subsections:
        - "6.1 Data Entities"
        - "6.2 Data Relationships"
        - "6.3 Data Constraints"

    - section: "7. Traceability Matrix"
      # PRD → SRS 매핑
```

---

### 3.5 CMP-004: SDS Writer Agent

**Source Features**: SF-004 (UC-007)

**Responsibility**: SRS를 분석하여 소프트웨어 설계 명세서(SDS)를 자동 생성

#### 3.5.1 Interface Definition

```typescript
interface ISDSWriterAgent {
  /**
   * SRS로부터 SDS 생성
   * @param projectId 프로젝트 ID
   * @returns SDS 생성 결과
   */
  generateSDS(projectId: string): Promise<SDSGenerationResult>;

  /**
   * 시스템 아키텍처 설계
   * @param features 시스템 기능 목록
   * @returns 아키텍처 설계
   */
  designArchitecture(features: SystemFeature[]): Promise<ArchitectureDesign>;

  /**
   * 컴포넌트 설계
   * @param feature 시스템 기능
   * @returns 컴포넌트 명세
   */
  designComponent(feature: SystemFeature): Promise<ComponentSpec>;

  /**
   * API 설계
   * @param useCases 유스케이스 목록
   * @returns API 명세
   */
  designAPIs(useCases: UseCase[]): Promise<APISpec[]>;

  /**
   * 데이터베이스 스키마 설계
   * @param dataRequirements 데이터 요구사항
   * @returns 스키마 설계
   */
  designSchema(dataRequirements: DataRequirement[]): Promise<SchemaDesign>;
}

interface ComponentSpec {
  id: string;           // CMP-XXX
  name: string;
  sourceFeatures: string[];  // SF-XXX
  responsibility: string;
  type: 'service' | 'controller' | 'repository' | 'utility' | 'agent';

  interfaces: {
    provided: InterfaceSpec[];
    required: InterfaceSpec[];
  };

  dependencies: {
    internal: InternalDep[];
    external: ExternalDep[];
  };

  dataAccess: DataAccessSpec[];
  errorHandling: ErrorHandlingSpec[];
  implementationNotes: string;
}

interface APISpec {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  sourceUseCase: string;  // UC-XXX
  component: string;      // CMP-XXX
  request: {
    headers: Record<string, string>;
    params: ParameterSpec[];
    body: SchemaSpec;
  };
  response: {
    success: ResponseSpec;
    errors: ErrorResponseSpec[];
  };
  security: SecuritySpec;
}
```

#### 3.5.2 Component Types

```yaml
component_types:
  agent:
    description: "Claude Agent 기반 자율 실행 컴포넌트"
    characteristics:
      - "Claude API 호출"
      - "특정 도구 세트 사용"
      - "독립적 실행 컨텍스트"
    examples:
      - "Collector Agent"
      - "PRD Writer Agent"

  service:
    description: "비즈니스 로직을 캡슐화한 서비스"
    characteristics:
      - "상태 비저장 (Stateless)"
      - "단일 책임 원칙"
    examples:
      - "Validation Service"
      - "Notification Service"

  controller:
    description: "요청 라우팅 및 조율"
    characteristics:
      - "입력 검증"
      - "서비스 호출 조율"
    examples:
      - "Controller Agent (orchestration)"

  repository:
    description: "데이터 접근 레이어"
    characteristics:
      - "CRUD 연산"
      - "파일 시스템 추상화"
    examples:
      - "Scratchpad Repository"

  utility:
    description: "공통 유틸리티 함수"
    characteristics:
      - "순수 함수"
      - "재사용 가능"
    examples:
      - "ID Generator"
      - "Date Formatter"
```

---

### 3.6 CMP-005: Issue Generator Agent

**Source Features**: SF-005 (UC-008)

**Responsibility**: SDS 컴포넌트를 분석하여 구현 가능한 단위의 GitHub Issue를 자동 생성

#### 3.6.1 Interface Definition

```typescript
interface IIssueGeneratorAgent {
  /**
   * SDS로부터 GitHub Issue 생성
   * @param projectId 프로젝트 ID
   * @returns 생성된 이슈 목록
   */
  generateIssues(projectId: string): Promise<IssueGenerationResult>;

  /**
   * 컴포넌트를 구현 단위로 분해
   * @param component 컴포넌트 명세
   * @returns 작업 단위 목록
   */
  breakdownComponent(component: ComponentSpec): Promise<WorkItem[]>;

  /**
   * 이슈 간 의존성 분석
   * @param workItems 작업 단위 목록
   * @returns 의존성 그래프
   */
  analyzeDependencies(workItems: WorkItem[]): Promise<DependencyGraph>;

  /**
   * GitHub에 이슈 생성
   * @param issue 이슈 정보
   * @returns 생성된 이슈 번호
   */
  createGitHubIssue(issue: IssueSpec): Promise<number>;
}

interface IssueSpec {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone: string;
  sourceComponent: string;  // CMP-XXX
  sourceFeature: string;    // SF-XXX
  sourceRequirement: string; // FR-XXX
  estimatedEffort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  dependencies: number[];    // Blocked by issue numbers
  acceptanceCriteria: string[];
}

interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  criticalPath: string[];  // Issue IDs on critical path
}
```

#### 3.6.2 Issue Template

```markdown
## Description
{자동 생성된 작업 설명}

## Source References
- **SDS Component**: CMP-XXX
- **SRS Feature**: SF-XXX
- **PRD Requirement**: FR-XXX

## Context
{관련 아키텍처 및 설계 컨텍스트}

## Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}
- [ ] {criterion 3}

## Technical Notes
{구현 관련 기술적 가이드}

### Suggested Approach
1. {step 1}
2. {step 2}
3. {step 3}

### Related Files
- `path/to/related/file.ts`

## Dependencies
- **Blocked by**: #{issue_number}
- **Blocks**: #{issue_number}

## Estimated Effort
**{XS | S | M | L | XL}**

| Effort | Description | Typical Duration |
|--------|-------------|------------------|
| XS | < 1 hour | Trivial change |
| S | 1-4 hours | Small feature |
| M | 4-8 hours | Medium feature |
| L | 1-3 days | Large feature |
| XL | 3+ days | Complex feature |

---
_Auto-generated by AD-SDLC Issue Generator Agent_
_Labels: `ad-sdlc:auto-generated`, `priority:{P0-P3}`, `type:{feature|fix|docs}`_
```

#### 3.6.3 Work Breakdown Strategy

```yaml
breakdown_rules:
  max_issue_size: "L"  # XL은 분할 필요
  decomposition_criteria:
    - name: "single_responsibility"
      description: "하나의 이슈는 하나의 책임만"

    - name: "testable_unit"
      description: "독립적으로 테스트 가능한 단위"

    - name: "estimatable"
      description: "명확하게 공수 추정 가능"

  breakdown_patterns:
    service:
      - "Interface definition"
      - "Core implementation"
      - "Unit tests"
      - "Integration"

    api_endpoint:
      - "Route definition"
      - "Request validation"
      - "Business logic"
      - "Response formatting"
      - "Error handling"
      - "Tests"

    data_model:
      - "Schema definition"
      - "Validation rules"
      - "Migration scripts"
      - "Tests"
```

---

### 3.7 CMP-006: Controller Agent

**Source Features**: SF-006, SF-007 (UC-009, UC-010, UC-011)

**Responsibility**: 생성된 Issue들을 분석하고, Worker Agent에게 작업을 할당하며 진행 상황을 모니터링

#### 3.7.1 Interface Definition

```typescript
interface IControllerAgent {
  /**
   * 이슈 우선순위 결정
   * @param issues 이슈 목록
   * @param graph 의존성 그래프
   * @returns 우선순위 정렬된 실행 큐
   */
  prioritize(issues: Issue[], graph: DependencyGraph): Promise<ExecutionQueue>;

  /**
   * 작업 할당
   * @param issue 할당할 이슈
   * @param workerId Worker ID
   * @returns Work Order
   */
  assignWork(issue: Issue, workerId: string): Promise<WorkOrder>;

  /**
   * 진행 상황 모니터링
   * @returns 진행 보고서
   */
  monitorProgress(): Promise<ProgressReport>;

  /**
   * Worker 상태 확인
   * @param workerId Worker ID
   * @returns Worker 상태
   */
  checkWorkerStatus(workerId: string): Promise<WorkerStatus>;

  /**
   * 작업 재할당 (실패 시)
   * @param workOrderId Work Order ID
   * @returns 새 Work Order
   */
  reassignWork(workOrderId: string): Promise<WorkOrder>;
}

interface WorkOrder {
  id: string;           // WO-XXX
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  createdAt: Date;
  deadline?: Date;
  priority: number;     // 1 = highest

  assignment: {
    workerId: string;
    assignedAt: Date;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  };

  context: {
    sdsComponent: string;
    srsFeature: string;
    prdRequirement: string;
    relatedFiles: string[];
    dependenciesStatus: DependencyStatus[];
    implementationHints: string;
    acceptanceCriteria: string[];
  };
}

interface ExecutionQueue {
  ready: QueueItem[];      // 의존성 해결됨, 실행 가능
  blocked: QueueItem[];    // 의존성 대기 중
  inProgress: QueueItem[]; // 현재 실행 중
  completed: QueueItem[];  // 완료됨
}
```

#### 3.7.2 Prioritization Algorithm

```python
class PriorityCalculator:
    """
    우선순위 계산 알고리즘
    Score = (Priority_Weight × Priority_Value) +
            (Dependency_Weight × Dependent_Count) +
            (Critical_Path_Weight × Is_Critical)

    낮은 점수 = 높은 우선순위
    """
    PRIORITY_WEIGHT = 10
    DEPENDENCY_WEIGHT = 5
    CRITICAL_PATH_WEIGHT = 20

    PRIORITY_VALUES = {
        'P0': 1,
        'P1': 2,
        'P2': 3,
        'P3': 4
    }

    def calculate(self, issue: Issue, graph: DependencyGraph) -> int:
        base_priority = self.PRIORITY_VALUES[issue.priority] * self.PRIORITY_WEIGHT

        # 이 이슈에 의존하는 이슈 수 (많을수록 우선)
        dependent_count = self._count_dependents(issue.id, graph)
        dependency_score = dependent_count * self.DEPENDENCY_WEIGHT

        # 크리티컬 패스 여부
        is_critical = issue.id in graph.critical_path
        critical_score = self.CRITICAL_PATH_WEIGHT if is_critical else 0

        return base_priority - dependency_score - critical_score

    def _count_dependents(self, issue_id: str, graph: DependencyGraph) -> int:
        """이 이슈에 의존하는(blocked by) 다른 이슈 수"""
        return len([e for e in graph.edges if e.blocked_by == issue_id])
```

#### 3.7.3 Controller State Schema

```yaml
# .ad-sdlc/scratchpad/progress/{project_id}/controller_state.yaml
schema:
  version: "1.0"
  project_id: string
  phase: planning | executing | reviewing | completed
  updated_at: datetime

  summary:
    total_issues: integer
    pending: integer
    in_progress: integer
    completed: integer
    blocked: integer
    failed: integer

  workers:
    max_parallel: 5
    active:
      - worker_id: string
        status: idle | working | error
        current_issue: string
        started_at: datetime
        performance:
          completed_count: integer
          avg_completion_time: duration
          success_rate: float

  execution_queue:
    ready:
      - issue_id: string
        priority_score: integer
        reason: string

    blocked:
      - issue_id: string
        blocked_by: list
        blocked_since: datetime

  progress:
    started_at: datetime
    estimated_completion: datetime
    current_percentage: float
    velocity: float  # issues per hour

  bottlenecks:
    - issue_id: string
      type: dependency_chain | long_running | repeated_failure
      detected_at: datetime
      resolution_suggestion: string
```

---

### 3.8 CMP-007: Worker Agent

**Source Features**: SF-008, SF-009 (UC-012, UC-013)

**Responsibility**: Controller Agent로부터 할당받은 Issue를 실제로 구현

#### 3.8.1 Interface Definition

```typescript
interface IWorkerAgent {
  /**
   * Work Order 수신 및 처리
   * @param workOrder 작업 지시서
   * @returns 구현 결과
   */
  executeWork(workOrder: WorkOrder): Promise<ImplementationResult>;

  /**
   * 코드 구현
   * @param context 구현 컨텍스트
   * @returns 변경 사항
   */
  implementCode(context: ImplementationContext): Promise<CodeChange[]>;

  /**
   * 테스트 작성
   * @param codeChanges 코드 변경 사항
   * @returns 테스트 파일
   */
  writeTests(codeChanges: CodeChange[]): Promise<TestFile[]>;

  /**
   * 자체 검증 실행
   * @returns 검증 결과
   */
  selfVerify(): Promise<VerificationResult>;

  /**
   * 오류 수정 및 재시도
   * @param error 발생한 오류
   * @param attempt 현재 시도 횟수
   * @returns 수정 결과
   */
  fixAndRetry(error: VerificationError, attempt: number): Promise<ImplementationResult>;
}

interface ImplementationResult {
  workOrderId: string;
  issueId: string;
  githubIssue: number;

  status: 'completed' | 'failed' | 'blocked';
  startedAt: Date;
  completedAt: Date;

  changes: CodeChange[];
  tests: TestResult;
  verification: VerificationResult;

  branch: {
    name: string;
    commits: Commit[];
  };

  notes: string;
  blockers?: string[];
}

interface VerificationResult {
  testsPassed: boolean;
  testsOutput: string;
  lintPassed: boolean;
  lintOutput: string;
  buildPassed: boolean;
  buildOutput: string;
  coverage: number;
}
```

#### 3.8.2 Implementation Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Worker Agent Implementation Flow                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. RECEIVE WORK ORDER                                                │   │
│  │    └─ Read WO-XXX.yaml from scratchpad                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2. UNDERSTAND CONTEXT                                                │   │
│  │    ├─ Read issue description and acceptance criteria                │   │
│  │    ├─ Analyze related files (Glob, Grep, Read)                      │   │
│  │    ├─ Review dependency completion status                           │   │
│  │    └─ Understand existing codebase patterns                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3. CREATE BRANCH                                                     │   │
│  │    └─ git checkout -b feature/ISS-{number}-{description}            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4. IMPLEMENT CODE                                                    │   │
│  │    ├─ Create new files (Write)                                      │   │
│  │    ├─ Modify existing files (Edit)                                  │   │
│  │    ├─ Follow coding standards                                       │   │
│  │    └─ Add inline documentation                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5. WRITE TESTS                                                       │   │
│  │    ├─ Create test file (*.test.ts / *.spec.ts)                      │   │
│  │    ├─ Write unit tests (min 80% coverage)                           │   │
│  │    └─ Include edge cases and error scenarios                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 6. SELF-VERIFY                                                       │   │
│  │    ├─ Run tests: npm test -- --coverage                             │   │
│  │    ├─ Run lint: npm run lint                                        │   │
│  │    └─ Run build: npm run build                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                    ┌──────────────┴──────────────┐                         │
│                    ▼                              ▼                         │
│            ┌─────────────┐                ┌─────────────┐                  │
│            │    PASS     │                │    FAIL     │                  │
│            └──────┬──────┘                └──────┬──────┘                  │
│                   │                              │                          │
│                   │                              ▼                          │
│                   │               ┌─────────────────────────┐              │
│                   │               │  RETRY (max 3 attempts) │              │
│                   │               │  ├─ Analyze error        │              │
│                   │               │  ├─ Apply fix            │              │
│                   │               │  └─ Re-run verification  │              │
│                   │               └────────────┬────────────┘              │
│                   │                            │                            │
│                   │               ┌────────────┴────────────┐              │
│                   │               ▼                          ▼              │
│                   │        ┌─────────────┐          ┌─────────────┐        │
│                   │        │    FIXED    │          │ MAX RETRIES │        │
│                   │        └──────┬──────┘          └──────┬──────┘        │
│                   │               │                        │                │
│                   └───────────────┤                        │                │
│                                   ▼                        ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 7. COMMIT CHANGES                                                    │   │
│  │    └─ git commit -m "feat(scope): description\n\nRefs: #{issue}"    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 8. REPORT RESULT                                                     │   │
│  │    └─ Write WO-XXX-result.yaml to scratchpad                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3.8.3 Retry Policy

```yaml
retry_policy:
  max_attempts: 3
  backoff: exponential
  base_delay_seconds: 5
  max_delay_seconds: 60

  retryable_errors:
    - test_failure:
        action: "Analyze test output, fix code, re-run"
    - lint_error:
        action: "Apply auto-fix (--fix), manual fix if needed"
    - build_error:
        action: "Check dependencies, fix type errors"
    - type_error:
        action: "Fix type definitions, add type guards"

  non_retryable_errors:
    - missing_dependency:
        action: "Report blocked, request dependency resolution"
    - permission_denied:
        action: "Report error, escalate"
    - context_limit:
        action: "Split task, report partial completion"
```

---

### 3.9 CMP-008: PR Review Agent

**Source Features**: SF-010, SF-011 (UC-014, UC-015, UC-016)

**Responsibility**: Worker Agent의 구현 결과를 기반으로 PR을 생성하고, 코드 리뷰를 수행

#### 3.9.1 Interface Definition

```typescript
interface IPRReviewAgent {
  /**
   * PR 자동 생성
   * @param result 구현 결과
   * @returns PR 정보
   */
  createPR(result: ImplementationResult): Promise<PRInfo>;

  /**
   * 자동 코드 리뷰 수행
   * @param prNumber PR 번호
   * @returns 리뷰 결과
   */
  reviewPR(prNumber: number): Promise<ReviewResult>;

  /**
   * 품질 게이트 확인
   * @param prNumber PR 번호
   * @returns 품질 게이트 결과
   */
  checkQualityGates(prNumber: number): Promise<QualityGateResult>;

  /**
   * 머지 결정
   * @param prNumber PR 번호
   * @param gateResult 품질 게이트 결과
   * @returns 머지 결과
   */
  decideMerge(prNumber: number, gateResult: QualityGateResult): Promise<MergeResult>;
}

interface ReviewResult {
  prNumber: number;
  prUrl: string;
  reviewStatus: 'approved' | 'changes_requested' | 'rejected';

  comments: ReviewComment[];

  qualityMetrics: {
    codeCoverage: number;
    complexityScore: number;
    securityIssues: number;
    styleViolations: number;
  };

  decision: 'merge' | 'revise' | 'reject';
}

interface ReviewComment {
  file: string;
  line: number;
  comment: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: 'security' | 'performance' | 'style' | 'logic' | 'test';
}

interface QualityGateResult {
  passed: boolean;

  required: {
    testsPassed: boolean;
    buildPassed: boolean;
    noCriticalIssues: boolean;
    coverageThresholdMet: boolean;
  };

  recommended: {
    noMajorIssues: boolean;
    complexityThresholdMet: boolean;
    documentationComplete: boolean;
  };
}
```

#### 3.9.2 Review Criteria

```yaml
review_criteria:
  security:
    - check: "no_hardcoded_secrets"
      severity: critical
      pattern: "(password|secret|api_key|token)\\s*[:=]\\s*['\"][^'\"]+['\"]"

    - check: "no_sql_injection"
      severity: critical
      pattern: "query.*\\+.*user_input"

    - check: "input_validation"
      severity: major
      description: "User input should be validated before use"

  performance:
    - check: "no_n_plus_one"
      severity: major
      description: "Avoid N+1 query patterns"

    - check: "proper_async"
      severity: minor
      description: "Use async/await properly"

  style:
    - check: "naming_conventions"
      severity: minor
      description: "Follow project naming conventions"

    - check: "max_function_length"
      severity: minor
      threshold: 50  # lines

  testing:
    - check: "coverage_threshold"
      severity: major
      threshold: 80  # percent

    - check: "edge_cases_covered"
      severity: minor

quality_gates:
  required:
    - tests_pass: true
    - build_pass: true
    - no_critical_issues: true
    - coverage: ">= 80%"

  recommended:
    - no_major_issues: true
    - complexity_score: "<= 10"
    - documentation_complete: true
```

#### 3.9.3 PR Template

```markdown
## Summary
{자동 생성된 변경 요약}

## Related Issue
Closes #{issue_number}

## Changes
{변경 사항 목록}

### Files Changed
- `path/to/file1.ts` - {변경 설명}
- `path/to/file2.ts` - {변경 설명}

## Test Results
✅ All tests passed
- Coverage: {coverage}%
- New tests: {test_count}

## Quality Checks
| Check | Status |
|-------|--------|
| Tests | ✅ Passed |
| Lint | ✅ Passed |
| Build | ✅ Passed |
| Coverage | ✅ {coverage}% (≥ 80%) |

## Source Traceability
- **PRD**: FR-{xxx}
- **SRS**: SF-{xxx}, UC-{xxx}
- **SDS**: CMP-{xxx}

## Acceptance Criteria Verification
- [x] Criterion 1
- [x] Criterion 2
- [x] Criterion 3

---
_Auto-generated by AD-SDLC PR Review Agent_
```

---

### 3.10 Supporting Components

#### 3.10.1 CMP-009: State Manager

**Source Features**: SF-014 (UC-020, UC-021)

```typescript
interface IStateManager {
  /**
   * 상태 읽기
   * @param path Scratchpad 경로
   * @returns 상태 객체
   */
  readState<T>(path: string): Promise<T>;

  /**
   * 상태 쓰기
   * @param path Scratchpad 경로
   * @param state 상태 객체
   */
  writeState<T>(path: string, state: T): Promise<void>;

  /**
   * 상태 존재 확인
   * @param path Scratchpad 경로
   * @returns 존재 여부
   */
  exists(path: string): Promise<boolean>;

  /**
   * 상태 스키마 검증
   * @param state 상태 객체
   * @param schema 스키마 정의
   * @returns 검증 결과
   */
  validate<T>(state: T, schema: Schema): ValidationResult;

  /**
   * 상태 마이그레이션
   * @param path Scratchpad 경로
   * @param fromVersion 현재 버전
   * @param toVersion 목표 버전
   */
  migrate(path: string, fromVersion: string, toVersion: string): Promise<void>;
}
```

#### 3.10.2 CMP-010: Logger

**Source Features**: SF-015 (UC-022, UC-023)

```typescript
interface ILogger {
  /**
   * 로그 기록
   * @param level 로그 레벨
   * @param message 메시지
   * @param context 추가 컨텍스트
   */
  log(level: LogLevel, message: string, context?: LogContext): void;

  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * 에이전트 활동 로깅
   * @param agentId 에이전트 ID
   * @param action 수행한 작업
   * @param details 상세 정보
   */
  logAgentActivity(agentId: string, action: string, details: object): void;
}

interface LogContext {
  projectId?: string;
  agentId?: string;
  stage?: string;
  issueId?: string;
  duration?: number;
  [key: string]: unknown;
}

// Log Format (JSON)
interface LogEntry {
  timestamp: string;    // ISO 8601
  level: string;        // DEBUG, INFO, WARN, ERROR
  agent: string;
  stage: string;
  message: string;
  context: object;
  duration_ms?: number;
}
```

#### 3.10.3 CMP-011: Error Handler

**Source Features**: SF-016 (UC-024)

```typescript
interface IErrorHandler {
  /**
   * 오류 처리
   * @param error 발생한 오류
   * @param context 오류 컨텍스트
   * @returns 처리 결과
   */
  handle(error: Error, context: ErrorContext): Promise<ErrorHandlingResult>;

  /**
   * 재시도 가능 여부 확인
   * @param error 발생한 오류
   * @returns 재시도 가능 여부
   */
  isRetryable(error: Error): boolean;

  /**
   * 재시도 지연 계산
   * @param attempt 현재 시도 횟수
   * @returns 대기 시간 (ms)
   */
  calculateBackoff(attempt: number): number;

  /**
   * Circuit Breaker 상태 확인
   * @param serviceId 서비스 ID
   * @returns Circuit 상태
   */
  checkCircuit(serviceId: string): CircuitState;
}

interface ErrorHandlingResult {
  handled: boolean;
  action: 'retry' | 'escalate' | 'ignore' | 'circuit_open';
  delay?: number;
  message?: string;
}

type CircuitState = 'closed' | 'open' | 'half_open';
```

### 3.11 Enhancement 파이프라인 컴포넌트

#### 3.11.1 CMP-012: Document Reader Agent

**Source Features**: SF-017 (UC-025, UC-026)

**Responsibility**: 기존 PRD/SRS/SDS 마크다운 파일을 파싱하고 모든 요구사항, 기능, 컴포넌트 및 그 관계의 통합 추적성 맵을 구축합니다.

```typescript
interface IDocumentReaderAgent {
  /**
   * Parse a specification document and extract structured data
   * @param filePath Path to the markdown document (PRD, SRS, or SDS)
   * @returns Parsed document structure with requirements, features, or components
   */
  parseDocument(filePath: string): Promise<ParsedDocument>;

  /**
   * Build a complete traceability map across all specification documents
   * @param projectDir Project root directory containing docs/
   * @returns Traceability mappings between PRD requirements, SRS features, and SDS components
   */
  buildTraceabilityMap(projectDir: string): Promise<TraceabilityMap>;
}

interface ParsedDocument {
  type: 'PRD' | 'SRS' | 'SDS';
  version: string;
  items: DocumentItem[];
  metadata: Record<string, string>;
}

interface DocumentItem {
  id: string;           // e.g., "FR-001", "SF-001", "CMP-001"
  title: string;
  description: string;
  references: string[]; // IDs of linked items in other documents
}

interface TraceabilityMap {
  requirements: DocumentItem[];   // PRD items
  features: DocumentItem[];       // SRS items
  components: DocumentItem[];     // SDS items
  mappings: TraceabilityLink[];
}

interface TraceabilityLink {
  sourceId: string;
  targetId: string;
  linkType: 'implements' | 'traces_to' | 'depends_on';
}
```

**Output**: `.ad-sdlc/scratchpad/analysis/{project_id}/current_state.yaml`

#### 3.11.2 CMP-013: Codebase Analyzer Agent

**Source Features**: SF-018 (UC-027, UC-028)

**Responsibility**: 기존 코드베이스를 분석하여 아키텍처 패턴, 빌드 시스템, 코딩 컨벤션을 감지하고 의존성 그래프를 생성합니다.

```typescript
interface ICodebaseAnalyzerAgent {
  /**
   * Analyze codebase architecture and detect patterns
   * @param projectDir Project root directory
   * @returns Architecture overview including patterns, conventions, and structure
   */
  analyzeArchitecture(projectDir: string): Promise<ArchitectureOverview>;

  /**
   * Generate a dependency graph of modules and packages
   * @param projectDir Project root directory
   * @returns Dependency graph with nodes (modules) and edges (dependencies)
   */
  generateDependencyGraph(projectDir: string): Promise<DependencyGraph>;
}

interface ArchitectureOverview {
  projectType: string;          // e.g., "monorepo", "single-package"
  language: string;             // e.g., "TypeScript", "Python"
  buildSystem: string;          // e.g., "npm", "gradle", "cmake"
  patterns: ArchitecturePattern[];
  conventions: CodingConvention[];
  structure: DirectoryStructure;
}

interface ArchitecturePattern {
  name: string;                 // e.g., "MVC", "Clean Architecture", "Monolith"
  confidence: number;           // 0.0 - 1.0
  evidence: string[];           // File paths or patterns supporting detection
}

interface CodingConvention {
  category: string;             // e.g., "naming", "formatting", "testing"
  rule: string;
  examples: string[];
}

interface DirectoryStructure {
  root: string;
  sourceDirectories: string[];
  testDirectories: string[];
  configFiles: string[];
}
```

**Output**: `.ad-sdlc/scratchpad/analysis/{project_id}/architecture_overview.yaml`, `.ad-sdlc/scratchpad/analysis/{project_id}/dependency_graph.json`

#### 3.11.3 CMP-014: Impact Analyzer Agent

**Source Features**: SF-019 (UC-029, UC-030)

**Responsibility**: 사용자 변경 요청에 대해 기존 요구사항, 기능, 컴포넌트에 미치는 영향을 분석합니다. 리스크를 평가하고 업데이트 전략을 권고합니다.

```typescript
interface IImpactAnalyzerAgent {
  /**
   * Analyze the impact of a proposed change across the system
   * @param changeRequest User's change description
   * @param currentState Current state from Document Reader
   * @param architecture Architecture overview from Codebase Analyzer
   * @returns Impact report with scope, affected components, and risk assessment
   */
  analyzeImpact(
    changeRequest: string,
    currentState: TraceabilityMap,
    architecture: ArchitectureOverview
  ): Promise<ImpactReport>;

  /**
   * Assess risk level and recommend mitigation strategies
   * @param impactReport Previously generated impact report
   * @returns Risk assessment with severity, likelihood, and recommendations
   */
  assessRisk(impactReport: ImpactReport): Promise<RiskAssessment>;
}

interface ImpactReport {
  changeRequest: string;
  changeScope: 'minor' | 'moderate' | 'major' | 'breaking';
  affectedRequirements: string[];   // FR-xxx IDs
  affectedFeatures: string[];       // SF-xxx IDs
  affectedComponents: string[];     // CMP-xxx IDs
  affectedFiles: string[];
  riskAssessment: RiskAssessment;
  recommendations: Recommendation[];
}

interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
}

interface RiskFactor {
  category: string;           // e.g., "breaking_change", "data_migration", "api_compatibility"
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

interface Recommendation {
  type: 'add' | 'modify' | 'deprecate' | 'remove';
  targetDocument: 'PRD' | 'SRS' | 'SDS';
  targetId: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}
```

**Output**: `.ad-sdlc/scratchpad/analysis/{project_id}/impact_report.yaml`

#### 3.11.4 CMP-015: PRD Updater Agent

**Source Features**: SF-020 (UC-031)

**Responsibility**: 버전 이력 및 변경 로그를 유지하면서 요구사항을 추가, 수정 또는 폐기하여 PRD 문서를 업데이트합니다.

```typescript
interface IPRDUpdaterAgent {
  /**
   * Add a new functional or non-functional requirement to the PRD
   * @param requirement New requirement definition
   * @returns Updated requirement ID and document version
   */
  addRequirement(requirement: NewRequirement): Promise<UpdateResult>;

  /**
   * Modify an existing requirement
   * @param requirementId ID of the requirement to modify (e.g., "FR-017")
   * @param changes Fields to update
   * @returns Updated document version
   */
  modifyRequirement(requirementId: string, changes: RequirementChanges): Promise<UpdateResult>;

  /**
   * Mark a requirement as deprecated with rationale
   * @param requirementId ID of the requirement to deprecate
   * @param reason Deprecation reason
   * @returns Updated document version
   */
  deprecateRequirement(requirementId: string, reason: string): Promise<UpdateResult>;
}

interface NewRequirement {
  type: 'FR' | 'NFR';
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  acceptanceCriteria: string[];
}

interface RequirementChanges {
  title?: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  acceptanceCriteria?: string[];
}

interface UpdateResult {
  documentPath: string;
  itemId: string;
  newVersion: string;
  changelogEntry: string;
}
```

#### 3.11.5 CMP-016: SRS Updater Agent

**Source Features**: SF-021 (UC-032)

**Responsibility**: 기능 및 유즈케이스를 추가하고 PRD-SRS 추적성 매트릭스를 유지하여 SRS 문서를 업데이트합니다.

```typescript
interface ISRSUpdaterAgent {
  /**
   * Add a new software feature to the SRS
   * @param feature New feature definition with linked PRD requirements
   * @returns Updated feature ID and document version
   */
  addFeature(feature: NewFeature): Promise<UpdateResult>;

  /**
   * Add a new use case under an existing feature
   * @param featureId Parent feature ID (e.g., "SF-017")
   * @param useCase Use case definition
   * @returns Updated use case ID and document version
   */
  addUseCase(featureId: string, useCase: NewUseCase): Promise<UpdateResult>;

  /**
   * Update the PRD-to-SRS traceability matrix
   * @param links Array of requirement-to-feature mappings
   */
  updateTraceability(links: TraceabilityLink[]): Promise<void>;
}

interface NewFeature {
  title: string;
  description: string;
  sourceRequirements: string[];   // FR-xxx IDs from PRD
  useCases: NewUseCase[];
}

interface NewUseCase {
  title: string;
  actor: string;
  preconditions: string[];
  mainFlow: string[];
  postconditions: string[];
  alternativeFlows?: string[];
}
```

#### 3.11.6 CMP-017: SDS Updater Agent

**Source Features**: SF-022 (UC-033)

**Responsibility**: SRS-SDS 추적성 매트릭스를 유지하면서 컴포넌트, API 정의, 아키텍처 변경사항을 추가하여 SDS 문서를 업데이트합니다.

```typescript
interface ISDSUpdaterAgent {
  /**
   * Add a new component definition to the SDS
   * @param component New component with interface definition
   * @returns Updated component ID and document version
   */
  addComponent(component: NewComponent): Promise<UpdateResult>;

  /**
   * Add or update an API definition for an existing component
   * @param componentId Component ID (e.g., "CMP-012")
   * @param api API definition
   * @returns Updated document version
   */
  addAPI(componentId: string, api: APIDefinition): Promise<UpdateResult>;

  /**
   * Update architecture diagrams and descriptions
   * @param section Architecture section identifier
   * @param content Updated architecture content
   */
  updateArchitecture(section: string, content: string): Promise<UpdateResult>;
}

interface NewComponent {
  name: string;
  sourceFeatures: string[];       // SF-xxx IDs from SRS
  responsibility: string;
  interfaceDefinition: string;    // TypeScript interface as string
}

interface APIDefinition {
  name: string;
  signature: string;
  description: string;
  parameters: ParameterDef[];
  returnType: string;
}

interface ParameterDef {
  name: string;
  type: string;
  description: string;
  required: boolean;
}
```

#### 3.11.7 CMP-018: Regression Tester Agent

**Source Features**: SF-023 (UC-034)

**Responsibility**: 영향 분석에 기반하여 영향받는 테스트를 매핑하고, 회귀 테스트 스위트를 실행하며, 하위 호환성을 분석합니다.

```typescript
interface IRegressionTesterAgent {
  /**
   * Identify tests affected by a set of changes
   * @param affectedComponents Component IDs from impact analysis
   * @param affectedFiles File paths from impact analysis
   * @returns Mapping of affected test files and test cases
   */
  mapAffectedTests(
    affectedComponents: string[],
    affectedFiles: string[]
  ): Promise<AffectedTestMap>;

  /**
   * Execute the regression test suite for affected areas
   * @param testMap Affected test mapping
   * @returns Regression test results
   */
  runRegressionSuite(testMap: AffectedTestMap): Promise<RegressionReport>;

  /**
   * Analyze backward compatibility of proposed changes
   * @param changes Proposed code changes
   * @returns Compatibility analysis with breaking change detection
   */
  analyzeCompatibility(changes: CodeChange[]): Promise<CompatibilityAnalysis>;
}

interface AffectedTestMap {
  testFiles: string[];
  testCases: TestCaseRef[];
  estimatedDuration: number;      // seconds
}

interface TestCaseRef {
  file: string;
  name: string;
  component: string;
}

interface RegressionReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;               // seconds
  failures: TestFailure[];
  coverageDelta: number;          // percentage change
}

interface TestFailure {
  testFile: string;
  testName: string;
  error: string;
  component: string;
}

interface CompatibilityAnalysis {
  isBackwardCompatible: boolean;
  breakingChanges: BreakingChange[];
}

interface BreakingChange {
  type: 'api' | 'schema' | 'behavior' | 'interface';
  description: string;
  affectedConsumers: string[];
  migrationPath: string;
}
```

**Output**: `.ad-sdlc/scratchpad/analysis/{project_id}/regression_report.yaml`

#### 3.11.8 CMP-019: Doc-Code Comparator Agent

**Source Features**: SF-024 (UC-035)

**Responsibility**: 명세 문서를 실제 코드베이스와 비교하여 드리프트, 누락된 구현, 문서화되지 않은 기능을 감지합니다.

```typescript
interface IDocCodeComparatorAgent {
  /**
   * Compare specification documents against codebase implementation
   * @param currentState Traceability map from Document Reader
   * @param codeInventory Code inventory from Code Reader
   * @returns Gap report with discrepancies and recommendations
   */
  compareSpecs(
    currentState: TraceabilityMap,
    codeInventory: CodeInventory
  ): Promise<GapReport>;

  /**
   * Generate a detailed gap report with prioritized action items
   * @param comparison Raw comparison results
   * @returns Structured gap report
   */
  generateGapReport(comparison: ComparisonResult[]): Promise<GapReport>;
}

interface GapReport {
  timestamp: string;
  summary: GapSummary;
  gaps: Gap[];
  recommendations: GapRecommendation[];
}

interface GapSummary {
  totalSpecItems: number;
  implementedCount: number;
  missingCount: number;
  driftCount: number;
  undocumentedCount: number;
}

interface Gap {
  type: 'missing_implementation' | 'spec_drift' | 'undocumented_feature' | 'stale_spec';
  specId?: string;              // Document item ID if applicable
  filePath?: string;            // Source file if applicable
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface GapRecommendation {
  gapType: string;
  action: 'implement' | 'update_spec' | 'document' | 'remove';
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

interface ComparisonResult {
  specItem: DocumentItem;
  implementationStatus: 'implemented' | 'partial' | 'missing' | 'drifted';
  evidence: string[];
}
```

**Output**: `.ad-sdlc/scratchpad/analysis/{project_id}/gap_report.yaml`

#### 3.11.9 CMP-020: Code Reader Agent

**Source Features**: SF-025 (UC-036)

**Responsibility**: AST 파싱(TypeScript의 경우 ts-morph)을 사용하여 심층 코드 분석을 수행하고, 클래스, 함수, 의존성을 추출하여 코드 인벤토리를 구축합니다.

```typescript
interface ICodeReaderAgent {
  /**
   * Analyze AST of source files to extract structural information
   * @param projectDir Project root directory
   * @param filePatterns Glob patterns for files to analyze (e.g., ["src/**/*.ts"])
   * @returns Structured code inventory
   */
  analyzeAST(projectDir: string, filePatterns: string[]): Promise<CodeInventory>;

  /**
   * Extract import/export dependencies between modules
   * @param projectDir Project root directory
   * @returns Module dependency map
   */
  extractDependencies(projectDir: string): Promise<ModuleDependencyMap>;
}

interface CodeInventory {
  files: SourceFile[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  interfaces: InterfaceInfo[];
  exports: ExportInfo[];
  totalLines: number;
}

interface SourceFile {
  path: string;
  language: string;
  lines: number;
  imports: string[];
  exports: string[];
}

interface ClassInfo {
  name: string;
  filePath: string;
  methods: string[];
  properties: string[];
  implements: string[];
  extends?: string;
}

interface FunctionInfo {
  name: string;
  filePath: string;
  parameters: string[];
  returnType: string;
  exported: boolean;
}

interface InterfaceInfo {
  name: string;
  filePath: string;
  methods: string[];
  properties: string[];
  extends: string[];
}

interface ExportInfo {
  name: string;
  filePath: string;
  type: 'class' | 'function' | 'interface' | 'constant' | 'type';
}

interface ModuleDependencyMap {
  modules: ModuleNode[];
  edges: ModuleEdge[];
}

interface ModuleNode {
  path: string;
  exportCount: number;
  importCount: number;
}

interface ModuleEdge {
  from: string;
  to: string;
  imports: string[];
}
```

**Output**: `.ad-sdlc/scratchpad/analysis/{project_id}/code_inventory.yaml`

#### 3.11.10 CMP-021: CI Fixer Agent

**Source Features**: SF-026 (UC-037)

**Responsibility**: CI/CD 파이프라인 실패(lint, 타입 체크, 테스트, 빌드)를 진단하고 자동화된 수정을 적용합니다.

```typescript
interface ICIFixerAgent {
  /**
   * Diagnose a CI failure from log output
   * @param ciLog CI pipeline log output
   * @param failureType Type of CI failure
   * @returns Diagnosis with root cause and suggested fixes
   */
  diagnoseCIFailure(
    ciLog: string,
    failureType: CIFailureType
  ): Promise<CIDiagnosis>;

  /**
   * Apply an automated fix for a diagnosed CI failure
   * @param diagnosis CI failure diagnosis
   * @returns Fix result with modified files and verification status
   */
  applyFix(diagnosis: CIDiagnosis): Promise<CIFixResult>;
}

type CIFailureType = 'lint' | 'type_check' | 'test' | 'build' | 'unknown';

interface CIDiagnosis {
  failureType: CIFailureType;
  rootCause: string;
  affectedFiles: string[];
  suggestedFixes: SuggestedFix[];
  confidence: number;             // 0.0 - 1.0
}

interface SuggestedFix {
  description: string;
  filePath: string;
  changeType: 'edit' | 'add' | 'delete';
  preview: string;                // Diff or code snippet
}

interface CIFixResult {
  applied: boolean;
  modifiedFiles: string[];
  verificationPassed: boolean;
  verificationOutput: string;
  retryRecommended: boolean;
}
```

---

### 3.12 인프라 컴포넌트

#### 3.12.1 CMP-022: Mode Detector Agent

**Source Features**: SF-027 (UC-038)

**Responsibility**: 프로젝트가 그린필드(신규) 프로젝트인지 Enhancement(기존) 프로젝트인지 감지하여 적절한 파이프라인을 선택합니다.

```typescript
interface IModeDetectorAgent {
  /**
   * Detect project mode based on directory contents and existing artifacts
   * @param projectDir Project root directory
   * @returns Detected mode with confidence score and evidence
   */
  detectMode(projectDir: string): Promise<ModeDetectionResult>;
}

interface ModeDetectionResult {
  mode: 'greenfield' | 'enhancement';
  confidence: number;             // 0.0 - 1.0
  evidence: ModeEvidence[];
}

interface ModeEvidence {
  factor: string;                 // e.g., "existing_source_code", "ad_sdlc_directory", "git_history"
  detected: boolean;
  weight: number;
  details: string;
}
```

#### 3.12.2 CMP-023: Project Initializer Agent

**Source Features**: SF-028 (UC-039)

**Responsibility**: `.ad-sdlc` 디렉토리 구조, 설정 파일, gitignore 항목을 생성하여 AD-SDLC 작업 공간을 초기화합니다.

```typescript
interface IProjectInitializerAgent {
  /**
   * Initialize the AD-SDLC project workspace
   * @param projectDir Project root directory
   * @param options Initialization options
   * @returns Initialization result with created paths
   */
  initialize(projectDir: string, options: InitOptions): Promise<InitResult>;
}

interface InitOptions {
  mode: 'greenfield' | 'enhancement';
  projectName: string;
  description?: string;
  createGitIgnore: boolean;
}

interface InitResult {
  success: boolean;
  createdDirectories: string[];
  createdFiles: string[];
  configPath: string;
}
```

#### 3.12.3 CMP-024: Repo Detector Agent

**Source Features**: SF-029 (UC-041)

**Responsibility**: 로컬 git 저장소 구성 및 원격 GitHub 저장소 가용성을 감지합니다.

```typescript
interface IRepoDetectorAgent {
  /**
   * Detect repository configuration for the project
   * @param projectDir Project root directory
   * @returns Repository detection result with local and remote info
   */
  detectRepository(projectDir: string): Promise<RepoDetectionResult>;
}

interface RepoDetectionResult {
  hasLocalGit: boolean;
  hasRemote: boolean;
  remoteUrl?: string;
  defaultBranch?: string;
  owner?: string;
  repoName?: string;
  isGitHubRepo: boolean;
}
```

#### 3.12.4 CMP-025: AD-SDLC Orchestrator Agent

**Source Features**: SF-030 (UC-042, UC-043)

**Responsibility**: 감지된 프로젝트 모드에 기반하여 전문 에이전트에 위임하면서 전체 AD-SDLC 워크플로우를 조율하는 최상위 파이프라인 오케스트레이터입니다.

```typescript
interface IADSDLCOrchestrator {
  /**
   * Execute the full AD-SDLC pipeline
   * @param projectDir Project root directory
   * @param userRequest User's project description or change request
   * @returns Pipeline execution result
   */
  executePipeline(projectDir: string, userRequest: string): Promise<PipelineResult>;

  /**
   * Coordinate multiple agents in sequence or parallel
   * @param agents Agent invocations to coordinate
   * @param strategy Execution strategy (sequential or parallel)
   * @returns Coordinated execution results
   */
  coordinateAgents(
    agents: AgentInvocation[],
    strategy: 'sequential' | 'parallel'
  ): Promise<AgentResult[]>;
}

interface PipelineResult {
  projectId: string;
  mode: 'greenfield' | 'enhancement';
  stages: StageResult[];
  overallStatus: 'completed' | 'failed' | 'partial';
  duration: number;               // seconds
  artifacts: string[];            // Generated file paths
}

interface StageResult {
  name: string;
  agentType: string;
  status: 'completed' | 'failed' | 'skipped';
  duration: number;
  output: string;
  artifacts: string[];
}
```

#### 3.12.5 CMP-026: Analysis Orchestrator Agent

**Source Features**: SF-030 (UC-043)

**Responsibility**: Enhancement 모드를 위한 분석 서브 파이프라인을 오케스트레이션합니다: DocumentReader -> CodeReader -> Comparator -> IssueGenerator.

```typescript
interface IAnalysisOrchestrator {
  /**
   * Execute the analysis pipeline for enhancement mode
   * @param projectDir Project root directory
   * @param changeRequest User's change request description
   * @returns Analysis pipeline results including gap report and impact analysis
   */
  executeAnalysisPipeline(
    projectDir: string,
    changeRequest: string
  ): Promise<AnalysisPipelineResult>;
}

interface AnalysisPipelineResult {
  currentState: TraceabilityMap;
  codeInventory: CodeInventory;
  gapReport: GapReport;
  impactReport: ImpactReport;
  generatedIssues: number[];      // GitHub issue numbers
  recommendedActions: Recommendation[];
}
```

#### 3.12.6 CMP-027: GitHub Repo Setup Agent

**Source Features**: SF-029 (UC-040)

**Responsibility**: PRD 및 SRS에서 추출한 프로젝트 메타데이터를 기반으로 새 공개 GitHub 저장소를 생성하고 초기화합니다. README 생성, 라이선스 선택, .gitignore 생성, `gh` CLI를 사용한 초기 커밋을 수행합니다.

```typescript
interface IGitHubRepoSetupAgent {
  /**
   * GitHub 저장소 생성 및 초기화
   * @param projectName PRD에서 추출한 프로젝트 이름
   * @param description 프로젝트 설명
   * @param options 저장소 생성 옵션
   * @returns 저장소 URL 및 메타데이터
   */
  createRepository(
    projectName: string,
    description: string,
    options: RepoSetupOptions
  ): Promise<RepoSetupResult>;
}

interface RepoSetupOptions {
  /** 라이선스 유형 (MIT, Apache-2.0 등) */
  readonly license: string;
  /** .gitignore 템플릿용 프로그래밍 언어 */
  readonly language: string;
  /** PRD에서 초기 README 생성 여부 */
  readonly generateReadme: boolean;
  /** GitHub 가시성 (public/private) */
  readonly visibility: 'public' | 'private';
}

interface RepoSetupResult {
  /** 전체 저장소 URL */
  readonly repoUrl: string;
  /** Owner/repo 형식 */
  readonly repoFullName: string;
  /** 기본 브랜치 이름 */
  readonly defaultBranch: string;
  /** 초기 커밋 SHA */
  readonly initialCommitSha: string;
}
```

**Output**: GitHub 저장소 생성 및 초기화 완료
**Tools Required**: Bash (gh CLI, git)

#### 3.12.7 CMP-028: Issue Reader Agent

**Source Features**: SF-031 (UC-044)

**Responsibility**: 저장소에서 기존 GitHub 이슈를 가져와 AD-SDLC 내부 형식으로 변환합니다. 이슈 메타데이터(레이블, 담당자, 마일스톤)를 파싱하고, 이슈 본문 참조에서 이슈 간 의존성을 추출하며, 의존성 그래프를 구축하고, Controller Agent와 호환되는 구조화된 이슈 목록을 생성합니다.

```typescript
interface IIssueReaderAgent {
  /**
   * GitHub 저장소에서 이슈 가져오기
   * @param repoUrl GitHub 저장소 URL 또는 owner/repo
   * @param options 가져오기 필터 옵션
   * @returns 가져온 이슈 목록 및 의존성 그래프
   */
  importIssues(
    repoUrl: string,
    options: IssueImportOptions
  ): Promise<IssueImportResult>;
}

interface IssueImportOptions {
  /** 이슈 상태로 필터링 */
  readonly state?: 'open' | 'closed' | 'all';
  /** 레이블로 필터링 */
  readonly labels?: readonly string[];
  /** 마일스톤으로 필터링 */
  readonly milestone?: string;
  /** 최대 가져오기 이슈 수 */
  readonly limit?: number;
}

interface IssueImportResult {
  /** AD-SDLC 내부 형식의 가져온 이슈 */
  readonly issues: readonly ImportedIssue[];
  /** 이슈 간 의존성 그래프 */
  readonly dependencyGraph: DependencyGraph;
  /** 가져오기 통계 */
  readonly stats: {
    readonly total: number;
    readonly imported: number;
    readonly skipped: number;
    readonly withDependencies: number;
  };
}

interface ImportedIssue {
  /** GitHub 이슈 번호 */
  readonly number: number;
  /** 이슈 제목 */
  readonly title: string;
  /** 파싱된 이슈 본문 */
  readonly body: string;
  /** GitHub 레이블 */
  readonly labels: readonly string[];
  /** 할당된 사용자 */
  readonly assignees: readonly string[];
  /** 감지된 의존성 (이슈 번호) */
  readonly dependsOn: readonly number[];
  /** 예상 복잡도 */
  readonly complexity: 'small' | 'medium' | 'large';
}
```

**Output**: `.ad-sdlc/scratchpad/issues/{project_id}/issue_list.json`, `.ad-sdlc/scratchpad/issues/{project_id}/dependency_graph.json`
**Tools Required**: Bash (gh CLI)

### 3.13 인프라 모듈

이 교차 관심사(cross-cutting) 인프라 모듈들은 모든 에이전트 및 파이프라인 컴포넌트에
공유 기능을 제공합니다. 에이전트 자체가 아닌 보안, 관측성, 자원 거버넌스를 시행하는
기반 라이브러리입니다.

#### 3.13.1 Security 모듈 (`src/security/`)

**Purpose**: 파일 작업, 명령 실행, 입력 검증, 감사 로깅을 위한 심층 방어 보안 유틸리티를 제공합니다.

| Component | Responsibility | Singleton Access |
|-----------|---------------|------------------|
| `CommandSanitizer` | 셸 명령 검증, 인젝션 공격 방지 | `getCommandSanitizer()` |
| `CommandWhitelist` | 허용 명령 목록과 인자 패턴 유지 | `DEFAULT_COMMAND_WHITELIST` |
| `InputValidator` | 사용자 입력 검증 (URL, 파일 경로, 텍스트) | `new InputValidator()` |
| `PathSanitizer` | 경로 순회 공격 방지 (예: `../../etc/passwd`) | `new PathSanitizer()` |
| `PathResolver` | 보안 검증이 포함된 프로젝트 인식 경로 해석 | `new PathResolver()` |
| `SymlinkResolver` | 정책 기반 안전한 심볼릭 링크 처리 | `new SymlinkResolver()` |
| `SecureFileOps` | 중앙 집중식 보안 파일 읽기/쓰기/mkdir 작업 | `getSecureFileOps()` |
| `SecureFileHandler` | 무결성 검증이 포함된 파일 감시 | `getSecureFileHandler()` |
| `AuditLogger` | 보안 관련 작업의 불변 감사 추적 | `getAuditLogger()` |
| `RateLimiter` | API 호출을 위한 토큰 버킷 속도 제한 | `new RateLimiter()` |
| `SecretManager` | 플러그인 백엔드 기반 보안 비밀 관리 | `getSecretManager()` |

**핵심 설계 결정**:
- 모든 파일 작업은 경로 검증을 위해 `SecureFileOps`를 통해 라우팅
- 명령은 실행 전 `CommandWhitelist`로 검증
- `AuditLogger`는 변조 방지 로깅으로 모든 보안 관련 이벤트를 기록
- `RateLimiter`는 작업별 설정 가능한 토큰 버킷 알고리즘 사용

#### 3.13.2 Monitoring 모듈 (`src/monitoring/`)

**Purpose**: 전체 파이프라인에 걸쳐 관측성, 토큰 예산 관리, 성능 튜닝,
알림 기능을 제공합니다.

| Component | Responsibility | Singleton Access |
|-----------|---------------|------------------|
| `MetricsCollector` | 에이전트/스테이지별 카운터, 게이지, 히스토그램 메트릭 수집 | `getMetricsCollector()` |
| `AlertManager` | 알림 조건 평가, 핸들러 트리거, 에스컬레이션 지원 | `getAlertManager()` |
| `TokenBudgetManager` | 에이전트별 및 파이프라인별 토큰 예산 시행 | `getTokenBudgetManager()` |
| `AgentBudgetRegistry` | 에이전트 예산 설정 등록, 에이전트 간 예산 이전 지원 | `getAgentBudgetRegistry()` |
| `BudgetAggregator` | 에이전트/카테고리별 사용량 집계, 최적화 제안 생성 | `getBudgetAggregator()` |
| `ContextPruner` | 토큰 제한에 맞게 대화 컨텍스트 정리 | `createContextPruner()` |
| `ModelSelector` | 태스크 복잡도 기반 최적 모델 (Opus/Sonnet/Haiku) 선택 | `getModelSelector()` |
| `QueryCache` | TTL 만료 기반 반복 LLM 쿼리용 LRU 캐시 | `getQueryCache()` |
| `TokenUsageReport` | 추세 분석 및 추천이 포함된 사용량 보고서 생성 | `createTokenUsageReport()` |
| `ParallelExecutionTuner` | 시스템 자원 기반 워커 풀 크기 동적 조정 | `getParallelExecutionTuner()` |
| `LatencyOptimizer` | 에이전트 응답 지연 추적 및 워밍업 최적화 | `getLatencyOptimizer()` |
| `ResponseTimeBenchmarks` | 파이프라인 스테이지별 성능 벤치마크 정의 및 검증 | `getResponseTimeBenchmarks()` |
| `DashboardDataProvider` | 모니터링 대시보드용 집계 데이터 제공 | `getDashboardDataProvider()` |
| `OpenTelemetryProvider` | 분산 추적을 위한 OpenTelemetry SDK 통합 | `getOpenTelemetryProvider()` |

**핵심 설계 결정**:
- `ModelSelector`는 태스크 복잡도 분석을 통해 Opus(복잡), Sonnet(표준), Haiku(단순) 모델 선택
- `ParallelExecutionTuner`는 workflow.yaml의 `max_parallel: 5` 제약을 준수하면서 처리량 최적화
- `TokenBudgetManager`는 계층형 예산 지원 (전역 → 파이프라인 → 카테고리 → 에이전트)
- OpenTelemetry 스팬은 `propagateToSubagent()`를 통해 에이전트 간 전파

**Tracing 유틸리티** (`tracing.ts`):

```typescript
// 일관된 계측을 위한 스팬 생성 헬퍼
startAgentSpan(name: string, options: AgentSpanOptions): SpanWrapper
startToolSpan(name: string, options: ToolSpanOptions): SpanWrapper
startLLMSpan(name: string, options: LLMSpanOptions): SpanWrapper

// 자동 스팬 생명주기 관리를 위한 고차 래퍼
withAgentSpan<T>(name: string, fn: () => T, options?: AgentSpanOptions): T
withToolSpan<T>(name: string, fn: () => T, options?: ToolSpanOptions): T
withTracedAgent<T>(name: string, fn: () => T): T
```

#### 3.13.3 Telemetry 모듈 (`src/telemetry/`)

**Purpose**: 엄격한 프라이버시 제어와 함께 선택적(opt-in) 익명 사용 분석을 제공합니다.

| Component | Responsibility | Singleton Access |
|-----------|---------------|------------------|
| `Telemetry` | 동의 관리 및 이벤트 배칭 기능의 핵심 텔레메트리 엔진 | `getTelemetry()` |

**프라이버시 우선 설계**:
- **명시적 옵트인**: 사용자 동의 없이 데이터 수집 불가
- **동의 기록**: 동의 상태, 타임스탬프, 정책 버전 저장
- **이벤트 유형**: `command_executed`, `pipeline_completed`, `agent_invoked`, `feature_used`
- **수집하지 않는 데이터**: 소스 코드, 파일 내용, 사용자 신원, API 키

**이벤트 스키마**:

```typescript
interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;          // ISO 8601
  sessionId: string;          // 익명 세션 ID
  properties: Record<string, unknown>;
}
```

#### 3.13.4 모듈 상호작용 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Layer                               │
│  (Collector, PRD Writer, Worker, PR Reviewer 등)                │
├──────────┬──────────────┬──────────────┬────────────────────────┤
│          │              │              │                        │
│  ┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐ ┌──────────────┐│
│  │   Security    │ │Monitoring│ │ Telemetry  │ │   Logging    ││
│  │              │ │          │ │            │ │              ││
│  │ PathSanitizer│ │ Metrics  │ │  Consent   │ │   Logger     ││
│  │ CmdSanitizer│ │ Alerts   │ │  Events    │ │   Rotation   ││
│  │ SecureFileOps│ │ Budgets  │ │  Privacy   │ │   Query      ││
│  │ AuditLogger │ │ ModelSel │ │            │ │              ││
│  │ RateLimiter │ │ Tracing  │ │            │ │              ││
│  └──────────────┘ └──────────┘ └────────────┘ └──────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Design

### 4.1 Entity-Relationship Diagram

```mermaid
erDiagram
    PROJECT ||--o{ COLLECTED_INFO : has
    PROJECT ||--o{ DOCUMENT : has
    PROJECT ||--o{ ISSUE : has
    PROJECT ||--o{ WORK_ORDER : has

    COLLECTED_INFO ||--o{ REQUIREMENT : contains
    COLLECTED_INFO ||--o{ CONSTRAINT : contains
    COLLECTED_INFO ||--o{ ASSUMPTION : contains

    DOCUMENT {
        string id PK
        string type "PRD, SRS, SDS"
        string project_id FK
        string version
        string status
        datetime created_at
        datetime updated_at
    }

    REQUIREMENT {
        string id PK
        string type "FR, NFR"
        string title
        string description
        string priority
    }

    ISSUE {
        string id PK
        int github_number
        string project_id FK
        string source_component
        string status
        list dependencies
    }

    WORK_ORDER {
        string id PK
        string issue_id FK
        string worker_id
        string status
        datetime assigned_at
    }

    WORK_ORDER ||--|| IMPLEMENTATION_RESULT : produces
    IMPLEMENTATION_RESULT ||--|| PR_REVIEW : reviewed_by

    IMPLEMENTATION_RESULT {
        string id PK
        string work_order_id FK
        string status
        list changes
        object verification
    }

    PR_REVIEW {
        int pr_number PK
        string result_id FK
        string status
        list comments
        object quality_metrics
    }

    REQUIREMENT ||--o{ SYSTEM_FEATURE : decomposes_to
    SYSTEM_FEATURE ||--o{ USE_CASE : has
    SYSTEM_FEATURE ||--o{ COMPONENT : implemented_by
    COMPONENT ||--o{ ISSUE : generates
```

### 4.2 Data Models

#### 4.2.1 Project Entity

```yaml
entity: Project
storage: .ad-sdlc/scratchpad/projects/{project_id}/project.yaml
fields:
  - name: id
    type: string
    format: "PRJ-XXXXXX"
    primary_key: true
    auto_generate: true

  - name: name
    type: string
    constraints:
      - not_null
      - max_length: 100

  - name: description
    type: string
    constraints:
      - max_length: 2000

  - name: status
    type: enum
    values: [collecting, prd_drafting, srs_drafting, sds_drafting, issue_creating, executing, completed, failed]

  - name: created_at
    type: datetime
    auto_generate: true

  - name: updated_at
    type: datetime
    auto_update: true

  - name: documents
    type: object
    schema:
      prd: string  # File path
      srs: string
      sds: string

  - name: github
    type: object
    schema:
      repo: string
      milestone: string
      issue_count: integer
      pr_count: integer

indexes:
  - fields: [status]
    name: idx_project_status
```

#### 4.2.2 Work Order Entity

```yaml
entity: WorkOrder
storage: .ad-sdlc/scratchpad/progress/{project_id}/work_orders/WO-{id}.yaml
fields:
  - name: id
    type: string
    format: "WO-XXXXXX"
    primary_key: true

  - name: project_id
    type: string
    foreign_key: Project.id

  - name: issue_id
    type: string

  - name: github_issue_number
    type: integer

  - name: status
    type: enum
    values: [pending, assigned, in_progress, completed, failed, blocked]

  - name: priority
    type: integer
    constraints:
      - min: 1
      - max: 100

  - name: assignment
    type: object
    schema:
      worker_id: string
      assigned_at: datetime
      deadline: datetime  # Optional

  - name: context
    type: object
    schema:
      sds_component: string
      srs_feature: string
      prd_requirement: string
      related_files: list
      acceptance_criteria: list
      implementation_hints: string

  - name: result
    type: object
    nullable: true
    schema:
      status: enum[success, failure, blocked]
      completed_at: datetime
      notes: string

indexes:
  - fields: [project_id, status]
    name: idx_wo_project_status
  - fields: [assignment.worker_id]
    name: idx_wo_worker
```

### 4.3 Data Access Patterns

| Operation | Frequency | Path Pattern | Format |
|-----------|-----------|--------------|--------|
| Read collected info | Per PRD generation | `scratchpad/info/{id}/collected_info.yaml` | YAML |
| Write document | Per agent stage | `scratchpad/documents/{id}/*.md` | Markdown |
| Read previous document | Per agent stage | `scratchpad/documents/{id}/*.md` | Markdown |
| Write issue list | Once per project | `scratchpad/issues/{id}/issue_list.json` | JSON |
| Read/Write controller state | Every 30s | `scratchpad/progress/{id}/controller_state.yaml` | YAML |
| Write work order | Per assignment | `scratchpad/progress/{id}/work_orders/WO-*.yaml` | YAML |
| Write implementation result | Per completion | `scratchpad/progress/{id}/results/WO-*-result.yaml` | YAML |

### 4.4 Data Validation Rules

```yaml
validation_rules:
  requirement_id:
    pattern: "^(FR|NFR)-\\d{3}$"
    message: "ID must follow FR-XXX or NFR-XXX format"

  feature_id:
    pattern: "^SF-\\d{3}$"
    message: "ID must follow SF-XXX format"

  component_id:
    pattern: "^CMP-\\d{3}$"
    message: "ID must follow CMP-XXX format"

  priority:
    enum: [P0, P1, P2, P3]
    message: "Priority must be P0, P1, P2, or P3"

  effort:
    enum: [XS, S, M, L, XL]
    message: "Effort must be XS, S, M, L, or XL"

  coverage:
    type: number
    min: 0
    max: 100
    message: "Coverage must be between 0 and 100"
```

---

## 5. Interface Design

### 5.1 Agent Communication Interfaces

#### 5.1.1 File-Based Communication (Scratchpad)

```yaml
communication_patterns:
  document_pipeline:
    producer: collector
    consumer: prd-writer
    channel: ".ad-sdlc/scratchpad/info/{project_id}/collected_info.yaml"
    format: YAML
    schema: CollectedInfo

  prd_to_srs:
    producer: prd-writer
    consumer: srs-writer
    channel: ".ad-sdlc/scratchpad/documents/{project_id}/prd.md"
    format: Markdown

  work_assignment:
    producer: controller
    consumer: worker
    channel: ".ad-sdlc/scratchpad/progress/{project_id}/work_orders/WO-{id}.yaml"
    format: YAML
    schema: WorkOrder

  result_reporting:
    producer: worker
    consumer: controller, pr-reviewer
    channel: ".ad-sdlc/scratchpad/progress/{project_id}/results/WO-{id}-result.yaml"
    format: YAML
    schema: ImplementationResult
```

#### 5.1.2 Main Agent → Sub-Agent Interface

```typescript
// Claude Code Task Tool 기반 에이전트 호출
interface AgentInvocation {
  /**
   * 에이전트 실행
   * @param agentType 에이전트 타입 (agent definitions에 정의된 이름)
   * @param prompt 에이전트에게 전달할 프롬프트
   * @param model 사용할 모델 (optional, default: sonnet)
   */
  invoke(agentType: string, prompt: string, model?: ModelType): Promise<AgentResult>;
}

type AgentType =
  // Greenfield Pipeline Agents
  | 'collector'
  | 'prd-writer'
  | 'srs-writer'
  | 'sds-writer'
  | 'issue-generator'
  | 'controller'
  | 'worker'
  | 'pr-reviewer'
  // Enhancement Pipeline Agents
  | 'document-reader'
  | 'codebase-analyzer'
  | 'impact-analyzer'
  | 'prd-updater'
  | 'srs-updater'
  | 'sds-updater'
  | 'regression-tester'
  | 'doc-code-comparator'
  | 'code-reader'
  | 'ci-fixer'
  // Infrastructure Agents
  | 'mode-detector'
  | 'project-initializer'
  | 'repo-detector'
  | 'ad-sdlc-orchestrator'
  | 'analysis-orchestrator';

type ModelType = 'sonnet' | 'opus' | 'haiku';

interface AgentResult {
  success: boolean;
  output: string;
  artifacts: string[];  // 생성된 파일 경로
  error?: string;
}
```

### 5.2 GitHub API Interfaces

#### 5.2.1 Issue Creation

```typescript
interface GitHubIssueAPI {
  /**
   * Issue 생성 (gh issue create)
   */
  create(issue: CreateIssueParams): Promise<number>;

  /**
   * Issue 조회
   */
  get(issueNumber: number): Promise<GitHubIssue>;

  /**
   * Issue 업데이트
   */
  update(issueNumber: number, params: UpdateIssueParams): Promise<void>;

  /**
   * Issue Close
   */
  close(issueNumber: number): Promise<void>;
}

interface CreateIssueParams {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  milestone?: string;
}
```

#### 5.2.2 Pull Request

```typescript
interface GitHubPRAPI {
  /**
   * PR 생성 (gh pr create)
   */
  create(params: CreatePRParams): Promise<PRInfo>;

  /**
   * PR 리뷰 제출 (gh pr review)
   */
  review(prNumber: number, review: ReviewParams): Promise<void>;

  /**
   * PR 머지 (gh pr merge)
   */
  merge(prNumber: number, strategy: MergeStrategy): Promise<MergeResult>;

  /**
   * 브랜치 삭제
   */
  deleteBranch(branchName: string): Promise<void>;
}

interface CreatePRParams {
  title: string;
  body: string;
  base: string;     // 기본: main
  head: string;     // 피처 브랜치
  draft?: boolean;
  labels?: string[];
}

type MergeStrategy = 'merge' | 'squash' | 'rebase';
```

### 5.3 CLI Interface

```yaml
cli_commands:
  init:
    description: "AD-SDLC 프로젝트 초기화"
    usage: "claude ad-sdlc init [project-name]"
    creates:
      - ".ad-sdlc/scratchpad/"
      - ".ad-sdlc/config/"
      - ".claude/agents/"

  start:
    description: "새 요구사항으로 파이프라인 시작"
    usage: "claude ad-sdlc start [--file <path>] [--url <url>]"
    options:
      - "--file: 입력 파일 경로"
      - "--url: 입력 URL"
      - "--skip-approval: 승인 게이트 스킵"

  status:
    description: "현재 진행 상황 확인"
    usage: "claude ad-sdlc status [project-id]"
    output: "Progress report"

  resume:
    description: "중단된 프로젝트 재개"
    usage: "claude ad-sdlc resume <project-id>"

  logs:
    description: "에이전트 로그 조회"
    usage: "claude ad-sdlc logs [--agent <agent-id>] [--level <level>]"
```

---

## 6. Security Design

### 6.1 Authentication

#### 6.1.1 GitHub Authentication

```yaml
github_auth:
  methods:
    - type: "oauth"
      description: "GitHub OAuth 토큰"
      storage: "환경 변수 (GITHUB_TOKEN)"
      scope: ["repo", "read:org"]

    - type: "gh_cli"
      description: "GitHub CLI 인증"
      command: "gh auth login"
      storage: "~/.config/gh/hosts.yml"

  token_handling:
    - rule: "never_log_token"
      description: "토큰은 로그에 기록하지 않음"

    - rule: "environment_only"
      description: "토큰은 환경 변수에만 저장"

    - rule: "mask_in_output"
      pattern: "ghp_[a-zA-Z0-9]{36}"
      replacement: "ghp_****"
```

#### 6.1.2 Claude API Authentication

```yaml
claude_auth:
  method: "api_key"
  storage: "환경 변수 (ANTHROPIC_API_KEY)"

  validation:
    - check: "key_format"
      pattern: "^sk-ant-[a-zA-Z0-9-]+$"

  masking:
    pattern: "sk-ant-[a-zA-Z0-9-]+"
    replacement: "sk-ant-****"
```

### 6.2 Authorization

```yaml
authorization:
  github_operations:
    issue_create:
      required_permissions: ["repo"]
      check: "can_push_to_repo"

    pr_create:
      required_permissions: ["repo"]
      check: "can_create_pr"

    pr_merge:
      required_permissions: ["repo"]
      check: "can_merge_pr"

  file_operations:
    read:
      scope: "project_directory"
      allow_patterns:
        - "src/**"
        - "tests/**"
        - ".ad-sdlc/**"
        - "docs/**"

    write:
      scope: "project_directory"
      allow_patterns:
        - "src/**"
        - "tests/**"
        - ".ad-sdlc/scratchpad/**"
        - "docs/**"
      deny_patterns:
        - "**/.env*"
        - "**/secrets*"
        - "**/*.key"
        - "**/*.pem"
```

### 6.3 Data Protection

```yaml
data_protection:
  sensitive_patterns:
    - name: "api_key"
      pattern: "(api[_-]?key|apikey)\\s*[:=]\\s*['\"][^'\"]+['\"]"
      action: "mask"

    - name: "password"
      pattern: "(password|passwd|pwd)\\s*[:=]\\s*['\"][^'\"]+['\"]"
      action: "mask"

    - name: "token"
      pattern: "(token|bearer|auth)\\s*[:=]\\s*['\"][^'\"]+['\"]"
      action: "mask"

    - name: "connection_string"
      pattern: "(mongodb|postgres|mysql|redis)://[^\\s]+"
      action: "mask"

  code_generation_rules:
    - rule: "no_hardcoded_secrets"
      description: "생성된 코드에 하드코딩된 시크릿 금지"
      enforcement: "PR review check"

    - rule: "use_environment_variables"
      description: "민감한 값은 환경 변수 사용"
      template: "process.env.{SECRET_NAME}"

  logging_rules:
    - rule: "mask_sensitive_data"
      description: "로그에서 민감 데이터 마스킹"

    - rule: "no_full_request_body"
      description: "전체 요청 본문 로깅 금지"
```

### 6.4 Input Validation

```yaml
input_validation:
  user_input:
    - type: "natural_language"
      max_length: 50000  # characters
      sanitize: true

    - type: "file_path"
      validate:
        - "path_traversal_check"
        - "allowed_extensions"
      allowed_extensions: [".md", ".pdf", ".docx", ".txt", ".yaml", ".json"]

    - type: "url"
      validate:
        - "url_format"
        - "allowed_protocols"
      allowed_protocols: ["http", "https"]

  code_injection_prevention:
    bash_commands:
      - sanitize: "shell_escape"
      - deny_patterns:
          - "rm -rf"
          - "; rm"
          - "| rm"
          - "`rm"
```

---

## 7. Deployment Architecture

### 7.1 Deployment Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Local Development Machine                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Claude Code CLI                              │   │
│  │                                                                      │   │
│  │   $ claude ad-sdlc start "Build a todo app with..."                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       AD-SDLC Agent System                           │   │
│  │                                                                      │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │   │
│  │   │   Agents    │  │ Scratchpad  │  │   Logs      │                │   │
│  │   │ (.claude/)  │  │ (.ad-sdlc/) │  │ (.ad-sdlc/) │                │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                    ┌──────────────┴──────────────┐                         │
│                    ▼                              ▼                         │
│           ┌─────────────┐                ┌─────────────┐                   │
│           │  File System │                │  Git Repo   │                   │
│           │  (Local)     │                │  (Local)    │                   │
│           └─────────────┘                └──────┬──────┘                   │
│                                                  │                          │
└──────────────────────────────────────────────────┼──────────────────────────┘
                                                   │
                                                   ▼
                              ┌─────────────────────────────────┐
                              │          External Services       │
                              ├─────────────────────────────────┤
                              │                                 │
                              │  ┌─────────────────────────┐   │
                              │  │      GitHub API         │   │
                              │  │  - Issues               │   │
                              │  │  - Pull Requests        │   │
                              │  │  - Actions              │   │
                              │  └─────────────────────────┘   │
                              │                                 │
                              │  ┌─────────────────────────┐   │
                              │  │      Claude API         │   │
                              │  │  - Model Inference      │   │
                              │  │  - Agent Execution      │   │
                              │  └─────────────────────────┘   │
                              │                                 │
                              └─────────────────────────────────┘
```

### 7.2 Environment Configuration

```yaml
environments:
  development:
    description: "로컬 개발 환경"
    configuration:
      log_level: "DEBUG"
      approval_gates: true
      max_workers: 2
      retry_attempts: 3
      mock_github: false

  testing:
    description: "테스트 환경"
    configuration:
      log_level: "INFO"
      approval_gates: false  # 자동 승인
      max_workers: 1
      retry_attempts: 1
      mock_github: true

  production:
    description: "실제 사용 환경"
    configuration:
      log_level: "INFO"
      approval_gates: true
      max_workers: 5
      retry_attempts: 3
      mock_github: false
```

### 7.3 Configuration Management

```yaml
# .ad-sdlc/config/workflow.yaml
configuration_hierarchy:
  1_defaults:
    source: "Built-in defaults"
    priority: lowest

  2_global:
    source: "~/.config/claude-code/ad-sdlc.yaml"
    priority: medium

  3_project:
    source: ".ad-sdlc/config/workflow.yaml"
    priority: high

  4_environment:
    source: "Environment variables (AD_SDLC_*)"
    priority: highest

environment_variables:
  AD_SDLC_LOG_LEVEL:
    type: string
    values: [DEBUG, INFO, WARN, ERROR]
    default: INFO

  AD_SDLC_MAX_WORKERS:
    type: integer
    min: 1
    max: 10
    default: 5

  AD_SDLC_SKIP_APPROVAL:
    type: boolean
    default: false

  GITHUB_TOKEN:
    type: string
    required: true

  ANTHROPIC_API_KEY:
    type: string
    required: true
```

---

## 8. Error Handling & Recovery

### 8.1 Error Classification

```yaml
error_categories:
  transient:
    description: "일시적 오류, 재시도로 복구 가능"
    examples:
      - "Network timeout"
      - "Rate limit exceeded"
      - "Service temporarily unavailable"
    handling: "Retry with exponential backoff"

  permanent:
    description: "영구 오류, 재시도 불가"
    examples:
      - "Invalid input"
      - "Authentication failed"
      - "Resource not found"
    handling: "Report error, require user action"

  partial:
    description: "부분 완료, 일부만 성공"
    examples:
      - "Some issues created, others failed"
      - "Code generated, tests failed"
    handling: "Save progress, allow resume"

  critical:
    description: "시스템 오류, 즉시 중단 필요"
    examples:
      - "Disk full"
      - "Out of memory"
      - "Corrupted state"
    handling: "Stop pipeline, alert user, preserve state"
```

### 8.2 Retry Strategy

```yaml
retry_strategy:
  default:
    max_attempts: 3
    backoff_type: exponential
    base_delay_ms: 5000
    max_delay_ms: 60000
    jitter: true

  per_operation:
    github_api:
      max_attempts: 5
      base_delay_ms: 1000
      rate_limit_handling:
        wait_for_reset: true
        max_wait_ms: 300000  # 5 minutes

    claude_api:
      max_attempts: 3
      base_delay_ms: 5000

    file_operations:
      max_attempts: 2
      base_delay_ms: 1000

  circuit_breaker:
    failure_threshold: 5
    success_threshold: 2
    timeout_ms: 60000
    half_open_requests: 1
```

### 8.3 Recovery Procedures

```yaml
recovery_procedures:
  pipeline_failure:
    steps:
      - "1. Identify failure stage from logs"
      - "2. Check scratchpad for last successful state"
      - "3. Resolve the issue (fix input, retry, etc.)"
      - "4. Resume from last checkpoint: claude ad-sdlc resume <project-id>"

  state_corruption:
    steps:
      - "1. Backup current scratchpad"
      - "2. Identify corrupted files from logs"
      - "3. Restore from previous version if available"
      - "4. Re-run affected stage"

  worker_stuck:
    steps:
      - "1. Check controller_state.yaml for stuck workers"
      - "2. Review work order and implementation result"
      - "3. Manually mark as failed or blocked"
      - "4. Controller will reassign automatically"

  github_sync_failure:
    steps:
      - "1. Verify GitHub authentication: gh auth status"
      - "2. Check network connectivity"
      - "3. Verify repository access permissions"
      - "4. Retry GitHub operations"
```

### 8.4 Checkpointing

```yaml
checkpoints:
  enabled: true
  storage: ".ad-sdlc/scratchpad/checkpoints/"

  checkpoint_events:
    - event: "stage_complete"
      saves: ["scratchpad state", "logs"]

    - event: "issue_batch_created"
      saves: ["issue_list.json", "dependency_graph.json"]

    - event: "worker_complete"
      saves: ["work_order result", "code changes"]

  recovery:
    strategy: "resume_from_last_checkpoint"
    command: "claude ad-sdlc resume <project-id> [--from-checkpoint <id>]"
```

---

## 9. Traceability Matrix

### 9.1 SRS → SDS Component Mapping

| SRS Feature | SDS Component(s) | Description |
|-------------|------------------|-------------|
| SF-001 (Multi-Source Collection) | CMP-001 (Collector Agent) | 다중 소스 정보 수집 |
| SF-002 (PRD Generation) | CMP-002 (PRD Writer Agent) | PRD 자동 생성 |
| SF-003 (SRS Generation) | CMP-003 (SRS Writer Agent) | SRS 자동 생성 |
| SF-004 (SDS Generation) | CMP-004 (SDS Writer Agent) | SDS 자동 생성 |
| SF-005 (Issue Generation) | CMP-005 (Issue Generator) | GitHub Issue 생성 |
| SF-006 (Work Prioritization) | CMP-006 (Controller Agent) | 작업 우선순위 결정 |
| SF-007 (Work Assignment) | CMP-006 (Controller Agent) | 작업 할당 및 모니터링 |
| SF-008 (Code Implementation) | CMP-007 (Worker Agent) | 코드 자동 구현 |
| SF-009 (Self-Verification) | CMP-007 (Worker Agent) | 자체 검증 |
| SF-010 (PR Creation & Review) | CMP-008 (PR Review Agent) | PR 생성 및 리뷰 |
| SF-011 (Quality Gate & Merge) | CMP-008 (PR Review Agent) | 품질 게이트 및 머지 |
| SF-012 (Traceability Matrix) | All Components | 추적성 유지 |
| SF-013 (Approval Gate) | Orchestration Layer | 승인 게이트 시스템 |
| SF-014 (Scratchpad State) | CMP-009 (State Manager) | 상태 관리 |
| SF-015 (Activity Logging) | CMP-010 (Logger) | 활동 로깅 |
| SF-016 (Error Handling) | CMP-011 (Error Handler) | 오류 처리 및 재시도 |
| SF-017 (Document Reading) | CMP-012 (Document Reader Agent) | 기존 명세 문서 파싱 및 추적성 맵 구축 |
| SF-018 (Codebase Analysis) | CMP-013 (Codebase Analyzer Agent) | 아키텍처 패턴 및 의존성 그래프 분석 |
| SF-019 (Impact Analysis) | CMP-014 (Impact Analyzer Agent) | 변경 영향 분석 및 리스크 평가 |
| SF-020 (PRD Update) | CMP-015 (PRD Updater Agent) | PRD 요구사항 추가, 수정, 폐기 |
| SF-021 (SRS Update) | CMP-016 (SRS Updater Agent) | 기능, 유즈케이스 추가 및 추적성 업데이트 |
| SF-022 (SDS Update) | CMP-017 (SDS Updater Agent) | 컴포넌트, API 추가 및 아키텍처 업데이트 |
| SF-023 (Regression Testing) | CMP-018 (Regression Tester Agent) | 영향받는 테스트 매핑 및 회귀 테스트 실행 |
| SF-024 (Doc-Code Comparison) | CMP-019 (Doc-Code Comparator Agent) | 명세와 코드베이스 비교 및 갭 리포트 생성 |
| SF-025 (Code Reading) | CMP-020 (Code Reader Agent) | AST 분석 및 의존성 추출 |
| SF-026 (CI Fixing) | CMP-021 (CI Fixer Agent) | CI 실패 진단 및 자동 수정 적용 |
| SF-027 (Mode Detection) | CMP-022 (Mode Detector Agent) | 그린필드 vs Enhancement 모드 감지 |
| SF-028 (Project Initialization) | CMP-023 (Project Initializer Agent) | .ad-sdlc 작업 공간 초기화 |
| SF-029 (GitHub Repo Management) | CMP-024 (Repo Detector Agent), CMP-027 (GitHub Repo Setup Agent) | 기존 저장소 감지 및 새 저장소 생성 |
| SF-030 (Pipeline Orchestration) | CMP-025 (AD-SDLC Orchestrator), CMP-026 (Analysis Orchestrator) | 최상위 및 분석 파이프라인 조율 |
| SF-031 (Issue Import) | CMP-028 (Issue Reader Agent) | 기존 GitHub 이슈를 AD-SDLC 형식으로 가져오기 |

### 9.2 Component → API Mapping

| Component | APIs / Interfaces | External Dependencies |
|-----------|-------------------|----------------------|
| CMP-001 | collectFromText, collectFromFiles, collectFromUrls | Read, WebFetch, Write |
| CMP-002 | generatePRD, analyzeGaps, checkConsistency | Read, Write, Edit |
| CMP-003 | generateSRS, decomposeRequirement, generateUseCases | Read, Write, Edit |
| CMP-004 | generateSDS, designArchitecture, designAPIs | Read, Write, Edit |
| CMP-005 | generateIssues, breakdownComponent, createGitHubIssue | Read, Write, Bash (gh) |
| CMP-006 | prioritize, assignWork, monitorProgress | Read, Write, Edit |
| CMP-007 | executeWork, implementCode, writeTests, selfVerify | Read, Write, Edit, Bash |
| CMP-008 | createPR, reviewPR, checkQualityGates, decideMerge | Read, Bash (gh) |
| CMP-012 | parseDocument, buildTraceabilityMap | Read |
| CMP-013 | analyzeArchitecture, generateDependencyGraph | Read, Bash |
| CMP-014 | analyzeImpact, assessRisk | Read |
| CMP-015 | addRequirement, modifyRequirement, deprecateRequirement | Read, Write, Edit |
| CMP-016 | addFeature, addUseCase, updateTraceability | Read, Write, Edit |
| CMP-017 | addComponent, addAPI, updateArchitecture | Read, Write, Edit |
| CMP-018 | mapAffectedTests, runRegressionSuite, analyzeCompatibility | Read, Bash |
| CMP-019 | compareSpecs, generateGapReport | Read |
| CMP-020 | analyzeAST, extractDependencies | Read, Bash (ts-morph) |
| CMP-021 | diagnoseCIFailure, applyFix | Read, Write, Edit, Bash |
| CMP-022 | detectMode | Read, Bash (git) |
| CMP-023 | initialize | Write, Bash (git) |
| CMP-024 | detectRepository | Bash (git, gh) |
| CMP-025 | executePipeline, coordinateAgents | All Agent Interfaces |
| CMP-026 | executeAnalysisPipeline | CMP-012, CMP-020, CMP-019, CMP-005 |
| CMP-027 | createRepository | Bash (gh, git) |
| CMP-028 | importIssues | Bash (gh) |

### 9.3 Full Traceability Chain

```yaml
traceability_chain:
  # Example: User Authentication Feature
  example_feature:
    prd:
      requirement: "FR-001: User Authentication"
      priority: P0

    srs:
      features:
        - id: "SF-001"
          name: "Login"
          use_cases: ["UC-001", "UC-002"]
        - id: "SF-002"
          name: "Session Management"
          use_cases: ["UC-003"]

    sds:
      components:
        - id: "CMP-AUTH-001"
          name: "AuthService"
          source_features: ["SF-001"]
          apis: ["POST /api/v1/auth/login"]

        - id: "CMP-AUTH-002"
          name: "SessionManager"
          source_features: ["SF-002"]
          apis: ["GET /api/v1/auth/session"]

    issues:
      - number: 1
        title: "Implement AuthService.login()"
        component: "CMP-AUTH-001"

      - number: 2
        title: "Implement SessionManager"
        component: "CMP-AUTH-002"
        blocked_by: [1]

    implementation:
      - work_order: "WO-001"
        issue: 1
        branch: "feature/ISS-1-auth-service"

      - work_order: "WO-002"
        issue: 2
        branch: "feature/ISS-2-session-manager"

    prs:
      - number: 10
        issue: 1
        merge_commit: "abc123"

      - number: 11
        issue: 2
        merge_commit: "def456"
```

---

## 10. Appendix

### 10.1 Design Decisions (ADR)

#### ADR-001: Scratchpad Pattern for Inter-Agent Communication

**Status**: Accepted

**Context**: Claude Agent SDK는 부모→자식 단방향 통신만 지원하며, 형제 에이전트 간 직접 통신이 불가능합니다.

**Decision**: 파일 시스템 기반 Scratchpad 패턴을 도입하여 에이전트 간 상태를 공유합니다.

**Consequences**:
- (+) 에이전트 간 느슨한 결합
- (+) 상태 영속성 및 재개 가능
- (+) 디버깅 용이 (파일 직접 확인 가능)
- (-) 파일 I/O 오버헤드
- (-) 동시성 제어 필요 (단일 Writer 정책)

#### ADR-002: Sequential Document Pipeline

**Status**: Accepted

**Context**: 문서 생성(PRD→SRS→SDS)은 순차적 의존성이 있습니다.

**Decision**: Document Pipeline은 Sequential 실행, Execution Pipeline은 Parallel 실행으로 분리합니다.

**Consequences**:
- (+) 문서 간 일관성 보장
- (+) 추적성 유지 용이
- (-) 문서 생성 시간 증가

#### ADR-003: Worker Pool with Fixed Size

**Status**: Accepted

**Context**: 무제한 Worker 생성은 리소스 고갈을 초래할 수 있습니다.

**Decision**: 최대 5개의 Worker Pool을 유지하고, Controller가 큐 기반으로 작업을 할당합니다.

**Consequences**:
- (+) 리소스 사용 예측 가능
- (+) 시스템 안정성 확보
- (-) 대규모 프로젝트에서 병목 가능

### 10.2 Open Questions

| Question ID | Question | Status | Resolution |
|-------------|----------|--------|------------|
| OQ-001 | 다중 리포지토리 지원 필요성? | Open | Phase 2에서 검토 |
| OQ-002 | 외부 테스트 서비스 (SonarQube 등) 연동? | Open | 플러그인 아키텍처 고려 |
| OQ-003 | 비영어권 코드베이스 지원 범위? | Open | 코드는 영어, 주석은 다국어 허용 |
| OQ-004 | Context Window 초과 시 문서 분할 전략? | Resolved | Hierarchical Summarization 적용 |

### 10.3 Glossary

| Term | Definition |
|------|------------|
| **ADR** | Architecture Decision Record - 아키텍처 결정 기록 |
| **Circuit Breaker** | 연속 실패 시 일시 중단하는 안정성 패턴 |
| **Critical Path** | 프로젝트 완료를 결정하는 가장 긴 의존성 경로 |
| **Scratchpad** | 에이전트 간 상태 공유를 위한 파일 기반 저장소 |
| **Topological Sort** | 의존성 그래프의 실행 순서 결정 알고리즘 |
| **Work Order** | Controller가 Worker에게 전달하는 작업 지시서 |

### 10.4 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-27 | System Architect | Initial draft based on SRS-001 |
| 1.1.0 | 2026-02-07 | System Architect | Enhancement Pipeline (CMP-012~CMP-028), 인프라 모듈 (Security/Monitoring/Telemetry), 추적 매트릭스 갱신, Component→API 매핑 갱신 |

---

*This SDS was generated for the Agent-Driven SDLC project based on SRS-001 and PRD-001.*
