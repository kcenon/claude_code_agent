# Product Requirements Document (PRD)

## Agent-Driven Software Development Lifecycle System

| Field | Value |
|-------|-------|
| **Document ID** | PRD-001 |
| **Version** | 1.0.0 |
| **Status** | Review |
| **Created** | 2025-12-27 |
| **Author** | System Architect |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [Goals & Success Metrics](#4-goals--success-metrics)
5. [User Personas](#5-user-personas)
6. [System Overview](#6-system-overview)
7. [Agent Specifications](#7-agent-specifications)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [System Architecture](#10-system-architecture)
11. [Data Flow & State Management](#11-data-flow--state-management)
12. [Risk Analysis](#12-risk-analysis)
13. [Implementation Phases](#13-implementation-phases)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

### 1.1 Product Name
**Agent-Driven SDLC (AD-SDLC)** - 에이전트 기반 소프트웨어 개발 생명주기 자동화 시스템

### 1.2 Overview
AD-SDLC는 Claude Agent SDK를 기반으로 구축된 멀티 에이전트 시스템으로, 소프트웨어 개발의 전체 생명주기를 자동화합니다. Greenfield, Enhancement, Import 세 가지 파이프라인 모드에 걸쳐 25개의 특화된 에이전트가 사용자의 초기 요구사항부터 PRD, SRS, SDS 작성, GitHub Issue 생성, 코드 구현, PR 검토까지 전 과정을 처리합니다.

### 1.3 Key Value Propositions
- **End-to-End 자동화**: 요구사항 수집부터 코드 배포까지 전 과정 자동화
- **문서 일관성 보장**: 계층적 문서 생성으로 추적성(Traceability) 확보
- **품질 게이트**: 각 단계별 검증을 통한 품질 보증
- **확장 가능한 아키텍처**: 새로운 에이전트 추가 및 워크플로우 커스터마이징 지원

---

## 2. Problem Statement

### 2.1 Current Challenges

| Challenge | Description | Impact |
|-----------|-------------|--------|
| **문서화 부재** | 요구사항이 구두로만 전달되어 추적 불가 | 프로젝트 실패율 증가 |
| **수동 프로세스** | PRD → SRS → SDS → Issue 수동 변환 | 시간 낭비, 인적 오류 |
| **일관성 결여** | 문서 간 불일치, 버전 관리 혼란 | 재작업, 품질 저하 |
| **작업 분배 비효율** | 수동 이슈 할당 및 추적 | 병목 현상, 지연 |
| **리뷰 지연** | PR 리뷰 대기 시간 길어짐 | 배포 주기 증가 |

### 2.2 Target Users Pain Points

```
Developer Journey (Current State):
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   요구사항   │───▶│  수동 문서화  │───▶│  수동 이슈화  │
│  (불명확)   │    │  (시간 소모)  │    │  (누락 위험)  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
   재질문 반복       문서 불일치        작업 범위 혼란
```

---

## 3. Product Vision

### 3.1 Vision Statement
> "개발자가 창의적인 문제 해결에 집중할 수 있도록, 반복적인 문서화와 프로세스 관리를 AI 에이전트가 대신 수행하는 지능형 개발 파트너"

### 3.2 Target State

```
Developer Journey (Future State with AD-SDLC):
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  사용자 입력  │───▶│ 자동 문서 생성 │───▶│ 자동 이슈 생성 │───▶│ 자동 구현/PR │
│  (자연어)    │    │ PRD→SRS→SDS │    │ GitHub Issue │    │  Review     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
   명확한 이해       완전한 추적성      명확한 작업 범위    빠른 배포 주기
```

### 3.3 Core Principles

1. **Human-in-the-Loop**: 중요 결정점에서 사용자 승인 필수
2. **Transparency**: 모든 에이전트 활동 로깅 및 추적 가능
3. **Incremental Delivery**: 각 단계 완료 후 검토 가능
4. **Fail-Safe Design**: 실패 시 안전한 롤백 및 재시도

---

## 4. Goals & Success Metrics

### 4.1 Primary Goals

| Goal ID | Goal | Measurement |
|---------|------|-------------|
| G-001 | 문서화 시간 80% 단축 | PRD 작성 시간: 8시간 → 1.5시간 |
| G-002 | 요구사항-코드 추적성 100% | 모든 코드 변경에 Issue/SRS 링크 |
| G-003 | 문서 일관성 95% 이상 | 자동화된 일관성 검사 통과율 |
| G-004 | PR 리뷰 시간 50% 단축 | 평균 리뷰 대기: 24시간 → 12시간 |

### 4.2 Key Performance Indicators (KPIs)

```yaml
Efficiency Metrics:
  - document_generation_time: < 30 min per document
  - issue_creation_accuracy: > 95%
  - auto_implementation_success_rate: > 70%

Quality Metrics:
  - document_consistency_score: > 0.95
  - requirement_coverage: 100%
  - pr_approval_rate_first_try: > 80%

User Satisfaction:
  - developer_adoption_rate: > 70%
  - nps_score: > 50
```

---

## 5. User Personas

### 5.1 Primary Persona: Product Manager (PM)

| Attribute | Description |
|-----------|-------------|
| **Name** | 김PM |
| **Role** | Product Manager |
| **Goals** | 요구사항을 명확히 전달하고 진행 상황 추적 |
| **Pain Points** | 문서 작성에 많은 시간 소요, 개발팀과의 소통 갭 |
| **Needs** | 자연어로 요구사항 입력, 자동 문서화, 실시간 진행 추적 |

### 5.2 Secondary Persona: Tech Lead

| Attribute | Description |
|-----------|-------------|
| **Name** | 박TL |
| **Role** | Tech Lead |
| **Goals** | 기술 설계 검토, 작업 분배 최적화 |
| **Pain Points** | SDS 작성 부담, 이슈 분배 시간 |
| **Needs** | 자동 SDS 생성, 지능형 작업 분배, 코드 리뷰 지원 |

### 5.3 Tertiary Persona: Developer

| Attribute | Description |
|-----------|-------------|
| **Name** | 이Dev |
| **Role** | Software Developer |
| **Goals** | 명확한 작업 범위로 효율적 구현 |
| **Pain Points** | 불명확한 요구사항, 컨텍스트 파악 시간 |
| **Needs** | 상세한 Issue 설명, 관련 코드 컨텍스트, 자동 PR 생성 |

---

## 6. System Overview

### 6.1 Agent Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AD-SDLC Agent Ecosystem                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │   USER INPUT    │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │  1. Collector   │───▶│   2. PRD Writer │───▶│   3. SRS Writer │     │
│  │     Agent       │    │      Agent      │    │      Agent      │     │
│  │ (정보 수집/문서화) │    │  (PRD 작성)    │    │   (SRS 작성)    │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                                         │               │
│                                                         ▼               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │  6. Controller  │◀───│  5. Issue Gen   │◀───│   4. SDS Writer │     │
│  │     Agent       │    │      Agent      │    │      Agent      │     │
│  │   (관제 에이전트) │    │ (이슈 생성)     │    │   (SDS 작성)    │     │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘     │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                            │
│  │  7. Worker      │───▶│  8. PR Review   │                            │
│  │     Agent       │    │      Agent      │                            │
│  │  (작업 수행)     │    │  (PR/리뷰)      │                            │
│  └─────────────────┘    └─────────────────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Agent Roles Summary

#### 6.2.1 Core Agents (Greenfield Pipeline)

| # | Agent Name | Korean Name | Primary Responsibility |
|---|------------|-------------|----------------------|
| 1 | Collector Agent | 정보 수집 에이전트 | 사용자 입력 분석, 관련 정보 취합 및 구조화 |
| 2 | PRD Writer Agent | PRD 작성 에이전트 | 수집된 정보 기반 PRD 문서 자동 생성 |
| 3 | SRS Writer Agent | SRS 작성 에이전트 | PRD 분석 후 SRS(기능 명세) 작성 |
| 4 | SDS Writer Agent | SDS 작성 에이전트 | SRS 분석 후 SDS(설계 명세) 작성 |
| 5 | Issue Generator Agent | 이슈 생성 에이전트 | SDS 기반 GitHub Issue 자동 생성 |
| 6 | Controller Agent | 관제 에이전트 | 이슈 분석 및 Worker Agent 작업 할당 |
| 7 | Worker Agent | 작업 에이전트 | 할당된 Issue 구현 작업 수행 |
| 8 | PR Review Agent | PR 리뷰 에이전트 | PR 생성, 리뷰 수행, 결과 판단 |

#### 6.2.2 Enhancement Pipeline Agents

| # | Agent Name | Korean Name | Primary Responsibility |
|---|------------|-------------|----------------------|
| 9 | Document Reader Agent | 문서 분석 에이전트 | 기존 PRD/SRS/SDS 파싱 및 구조화된 상태 추출 |
| 10 | Codebase Analyzer Agent | 코드베이스 분석 에이전트 | 아키텍처 패턴 및 의존성 분석 |
| 11 | Impact Analyzer Agent | 영향 분석 에이전트 | 변경 영향 범위 및 리스크 수준 평가 |
| 12 | PRD Updater Agent | PRD 업데이트 에이전트 | PRD 요구사항 추가/수정/폐기 증분 업데이트 |
| 13 | SRS Updater Agent | SRS 업데이트 에이전트 | PRD→SRS 추적성 유지하며 SRS 증분 업데이트 |
| 14 | SDS Updater Agent | SDS 업데이트 에이전트 | SRS→SDS 추적성 유지하며 SDS 증분 업데이트 |
| 15 | Regression Tester Agent | 회귀 테스트 에이전트 | 회귀 테스트 실행 및 호환성 보고 |
| 16 | Code Reader Agent | 코드 분석 에이전트 | AST 기반 소스 코드 분석 |
| 17 | Doc-Code Comparator Agent | 문서-코드 비교 에이전트 | 명세와 코드 구현 비교 (갭 분석) |
| 18 | CI Fixer Agent | CI 수정 에이전트 | CI/CD 실패 자동 진단 및 수정 |

#### 6.2.3 Infrastructure & Orchestration Agents

| # | Agent Name | Korean Name | Primary Responsibility |
|---|------------|-------------|----------------------|
| 19 | AD-SDLC Orchestrator Agent | 파이프라인 오케스트레이터 | 전체 파이프라인 모드별 실행 조정 |
| 20 | Analysis Orchestrator Agent | 분석 오케스트레이터 | Enhancement 분석 서브 파이프라인 조정 |
| 21 | Mode Detector Agent | 모드 감지 에이전트 | Greenfield/Enhancement 파이프라인 모드 자동 감지 |
| 22 | Project Initializer Agent | 프로젝트 초기화 에이전트 | .ad-sdlc 디렉토리 구조 및 설정 초기화 |
| 23 | Repo Detector Agent | 저장소 감지 에이전트 | 기존 GitHub 저장소 존재 여부 감지 |
| 24 | GitHub Repo Setup Agent | GitHub 저장소 설정 에이전트 | GitHub 저장소 생성 및 초기화 |
| 25 | Issue Reader Agent | 이슈 리더 에이전트 | 기존 GitHub 이슈를 AD-SDLC 형식으로 임포트 |

---

## 7. Agent Specifications

### 7.1 Agent 1: Collector Agent (정보 수집 에이전트)

#### 7.1.1 Purpose
사용자로부터 받은 다양한 형태의 입력(텍스트, 파일, URL 등)을 분석하여 구조화된 정보 문서로 변환합니다.

#### 7.1.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Multi-source Input** | 텍스트, 파일(.md, .pdf, .docx), URL 처리 |
| **Information Extraction** | 핵심 요구사항, 제약조건, 비기능 요구사항 추출 |
| **Clarification Loop** | 불명확한 부분에 대한 사용자 질의 |
| **Structured Output** | JSON/YAML 형태의 구조화된 정보 문서 |

#### 7.1.3 Input/Output Specification

```yaml
Input:
  - type: user_message
    format: natural_language
  - type: file_attachment
    formats: [md, pdf, docx, txt]
  - type: url
    format: http/https URL

Output:
  - type: information_document
    format: YAML
    schema:
      project_name: string
      description: string
      stakeholders: list
      requirements:
        functional: list
        non_functional: list
      constraints: list
      assumptions: list
      dependencies: list
      questions: list  # 추가 명확화 필요 항목
```

#### 7.1.4 Tools Required

| Tool | Purpose |
|------|---------|
| `Read` | 파일 내용 읽기 |
| `WebFetch` | URL 컨텐츠 가져오기 |
| `WebSearch` | 관련 정보 검색 |
| `Grep` | 패턴 기반 정보 추출 |
| `Write` | 정보 문서 저장 |

#### 7.1.5 State Management

```yaml
State:
  collection_id: uuid
  status: [collecting, clarifying, completed]
  collected_sources: list
  extracted_info: object
  pending_questions: list
  user_responses: list
```

---

### 7.2 Agent 2: PRD Writer Agent (PRD 작성 에이전트)

#### 7.2.1 Purpose
Collector Agent가 생성한 정보 문서를 분석하여 표준 PRD 형식의 문서를 자동 생성합니다.

#### 7.2.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Template-based Generation** | 표준 PRD 템플릿 기반 문서 생성 |
| **Gap Analysis** | 누락된 정보 식별 및 보완 요청 |
| **Consistency Check** | 요구사항 간 충돌 검사 |
| **Priority Assignment** | 요구사항 우선순위 자동 제안 |

#### 7.2.3 Input/Output Specification

```yaml
Input:
  - type: information_document
    source: collector_agent
    format: YAML

Output:
  - type: prd_document
    format: Markdown
    sections:
      - executive_summary
      - problem_statement
      - goals_and_metrics
      - user_personas
      - functional_requirements
      - non_functional_requirements
      - constraints_and_assumptions
      - timeline_and_milestones
      - risks_and_mitigations
      - appendix
```

#### 7.2.4 PRD Template Structure

```markdown
# PRD: [Product Name]

## 1. Executive Summary
## 2. Problem Statement
## 3. Goals & Success Metrics
## 4. User Personas
## 5. Functional Requirements
   ### FR-001: [Requirement Title]
   - Description:
   - Acceptance Criteria:
   - Priority: [P0/P1/P2/P3]
   - Dependencies:
## 6. Non-Functional Requirements
## 7. Constraints & Assumptions
## 8. Timeline & Milestones
## 9. Risks & Mitigations
## 10. Appendix
```

#### 7.2.5 Tools Required

| Tool | Purpose |
|------|---------|
| `Read` | 정보 문서 읽기 |
| `Write` | PRD 문서 저장 |
| `Edit` | PRD 수정/보완 |
| `Glob` | 관련 문서 탐색 |

---

### 7.3 Agent 3: SRS Writer Agent (SRS 작성 에이전트)

#### 7.3.1 Purpose
PRD를 기반으로 상세한 소프트웨어 요구사항 명세서(SRS)를 작성합니다.

#### 7.3.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Requirement Decomposition** | PRD 요구사항을 세부 기능으로 분해 |
| **Use Case Generation** | 유스케이스 시나리오 자동 생성 |
| **Interface Definition** | 시스템 인터페이스 정의 |
| **Traceability Matrix** | 요구사항 추적 매트릭스 생성 |

#### 7.3.3 Input/Output Specification

```yaml
Input:
  - type: prd_document
    source: prd_writer_agent
    format: Markdown

Output:
  - type: srs_document
    format: Markdown
    sections:
      - introduction
      - overall_description
      - system_features
      - external_interface_requirements
      - non_functional_requirements
      - use_cases
      - data_requirements
      - traceability_matrix
```

#### 7.3.4 SRS Section Details

```yaml
system_features:
  - feature_id: "SF-001"
    name: string
    description: string
    priority: enum[P0, P1, P2, P3]
    source_requirement: "FR-XXX"  # PRD 추적
    use_cases:
      - uc_id: "UC-001"
        actor: string
        preconditions: list
        main_flow: list
        alternative_flows: list
        postconditions: list
    acceptance_criteria: list
    dependencies: list
```

---

### 7.4 Agent 4: SDS Writer Agent (SDS 작성 에이전트)

#### 7.4.1 Purpose
SRS를 기반으로 소프트웨어 설계 명세서(SDS)를 작성합니다.

#### 7.4.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Architecture Design** | 시스템 아키텍처 설계 및 다이어그램 생성 |
| **Component Definition** | 컴포넌트/모듈 구조 정의 |
| **API Design** | API 엔드포인트 및 데이터 모델 설계 |
| **Database Schema** | 데이터베이스 스키마 설계 |

#### 7.4.3 Input/Output Specification

```yaml
Input:
  - type: srs_document
    source: srs_writer_agent
    format: Markdown

Output:
  - type: sds_document
    format: Markdown
    sections:
      - system_architecture
      - component_design
      - data_design
      - interface_design
      - api_specification
      - security_design
      - deployment_architecture
```

#### 7.4.4 Design Artifact Templates

```yaml
component_design:
  - component_id: "CMP-001"
    name: string
    responsibility: string
    source_feature: "SF-XXX"  # SRS 추적
    interfaces:
      - interface_id: string
        type: enum[API, Event, File]
        specification: object
    dependencies: list
    implementation_notes: string

api_specification:
  - endpoint: "/api/v1/users"
    method: "POST"
    source_use_case: "UC-XXX"  # SRS 추적
    request:
      headers: object
      body: object
    response:
      success: object
      errors: list
```

---

### 7.5 Agent 5: Issue Generator Agent (이슈 생성 에이전트)

#### 7.5.1 Purpose
SDS를 분석하여 개발 가능한 단위의 GitHub Issue를 자동 생성합니다.

#### 7.5.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Work Breakdown** | SDS 컴포넌트를 작업 단위로 분해 |
| **Issue Templating** | 표준 이슈 템플릿 적용 |
| **Dependency Mapping** | 이슈 간 의존성 설정 |
| **Label Assignment** | 자동 라벨링 (priority, type, component) |

#### 7.5.3 Input/Output Specification

```yaml
Input:
  - type: sds_document
    source: sds_writer_agent
    format: Markdown

Output:
  - type: github_issues
    format: JSON
    schema:
      issues:
        - issue_id: string
          title: string
          body: markdown
          labels: list
          assignees: list
          milestone: string
          dependencies: list  # blocked_by issue_ids
          source_component: "CMP-XXX"  # SDS 추적
          estimated_effort: enum[XS, S, M, L, XL]
```

#### 7.5.4 Issue Template

```markdown
## Description
[자동 생성된 작업 설명]

## Source References
- **SDS Component**: CMP-XXX
- **SRS Feature**: SF-XXX
- **PRD Requirement**: FR-XXX

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
[구현 관련 기술적 가이드]

## Dependencies
- Blocked by: #issue_number
- Blocks: #issue_number

## Estimated Effort
[XS/S/M/L/XL]

---
_Auto-generated by AD-SDLC Issue Generator Agent_
```

#### 7.5.5 Tools Required

| Tool | Purpose |
|------|---------|
| `Read` | SDS 문서 읽기 |
| `Bash` | `gh issue create` 명령 실행 |
| `Write` | 이슈 목록 문서 저장 |

---

### 7.6 Agent 6: Controller Agent (관제 에이전트)

#### 7.6.1 Purpose
생성된 GitHub Issue들을 분석하고, Worker Agent에게 작업을 할당하며 진행 상황을 모니터링합니다.

#### 7.6.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Issue Prioritization** | 의존성 기반 작업 순서 결정 |
| **Worker Management** | Worker Agent 할당 및 모니터링 |
| **Progress Tracking** | 전체 진행률 추적 및 보고 |
| **Bottleneck Detection** | 병목 구간 감지 및 알림 |

#### 7.6.3 Input/Output Specification

```yaml
Input:
  - type: github_issues
    source: issue_generator_agent
  - type: worker_status
    source: worker_agents

Output:
  - type: work_order
    format: JSON
    schema:
      order_id: uuid
      target_agent: worker_agent_id
      issue_id: string
      priority: integer
      deadline: datetime
      context:
        related_files: list
        dependencies_status: object
```

#### 7.6.4 Orchestration Logic

```python
# Pseudo-code for Controller Agent logic
class ControllerAgent:
    def prioritize_issues(self, issues: list) -> list:
        """
        1. Build dependency graph
        2. Topological sort for execution order
        3. Apply priority weights
        4. Return ordered list
        """

    def assign_work(self, issue: Issue, workers: list) -> WorkOrder:
        """
        1. Check worker availability
        2. Match worker skills to issue type
        3. Create work order with context
        4. Monitor assignment
        """

    def monitor_progress(self) -> ProgressReport:
        """
        1. Poll worker statuses
        2. Update issue states
        3. Detect blockers
        4. Generate report
        """
```

#### 7.6.5 State Management

```yaml
Controller State:
  active_issues: list
  assigned_work: dict  # issue_id -> worker_id
  completed_issues: list
  blocked_issues: list
  worker_pool:
    - worker_id: string
      status: enum[idle, working, error]
      current_issue: string
      performance_metrics: object
```

---

### 7.7 Agent 7: Worker Agent (작업 에이전트)

#### 7.7.1 Purpose
Controller Agent로부터 할당받은 Issue를 실제로 구현합니다.

#### 7.7.2 Capabilities

| Capability | Description |
|------------|-------------|
| **Code Generation** | Issue 기반 코드 자동 생성 |
| **Test Writing** | 단위 테스트 자동 작성 |
| **Codebase Integration** | 기존 코드베이스와 통합 |
| **Self-Verification** | 구현 완료 전 자체 검증 |

#### 7.7.3 Input/Output Specification

```yaml
Input:
  - type: work_order
    source: controller_agent
    format: JSON

Output:
  - type: implementation_result
    format: JSON
    schema:
      issue_id: string
      status: enum[completed, failed, blocked]
      changes:
        - file_path: string
          change_type: enum[create, modify, delete]
          diff: string
      tests_added: list
      verification_result:
        tests_passed: boolean
        lint_passed: boolean
        build_passed: boolean
      notes: string
```

#### 7.7.4 Implementation Workflow

```
┌─────────────────┐
│  Receive Order  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Analyze Context │ ◀── Read related files, understand codebase
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Code   │ ◀── Create/modify files based on issue
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Write Tests    │ ◀── Add unit tests for new code
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Self-Verify     │ ◀── Run tests, lint, build
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌──────┐  ┌──────┐
│ Pass │  │ Fail │──▶ Fix and retry (max 3 attempts)
└──┬───┘  └──────┘
   │
   ▼
┌─────────────────┐
│ Report Complete │
└─────────────────┘
```

#### 7.7.5 Tools Required

| Tool | Purpose |
|------|---------|
| `Read` | 기존 코드 분석 |
| `Glob` | 관련 파일 탐색 |
| `Grep` | 패턴 검색 |
| `Write` | 새 파일 생성 |
| `Edit` | 기존 파일 수정 |
| `Bash` | 테스트/빌드 실행 |

---

### 7.8 Agent 8: PR Review Agent (PR 리뷰 에이전트)

#### 7.8.1 Purpose
Worker Agent의 구현 결과를 기반으로 PR을 생성하고, 코드 리뷰를 수행하며 최종 결과를 판단합니다.

#### 7.8.2 Capabilities

| Capability | Description |
|------------|-------------|
| **PR Creation** | 구현 완료된 Issue의 PR 자동 생성 |
| **Code Review** | 자동화된 코드 리뷰 수행 |
| **Quality Gate** | 품질 기준 충족 여부 판단 |
| **Feedback Loop** | 수정 요청 및 재검토 |

#### 7.8.3 Input/Output Specification

```yaml
Input:
  - type: implementation_result
    source: worker_agent
    format: JSON

Output:
  - type: pr_review_result
    format: JSON
    schema:
      pr_number: integer
      pr_url: string
      review_status: enum[approved, changes_requested, rejected]
      review_comments:
        - file: string
          line: integer
          comment: string
          severity: enum[critical, major, minor, suggestion]
      quality_metrics:
        code_coverage: float
        complexity_score: float
        security_issues: integer
        style_violations: integer
      final_decision: enum[merge, revise, reject]
      merge_commit: string  # if merged
```

#### 7.8.4 Review Criteria

```yaml
Quality Gates:
  required:
    - tests_pass: true
    - build_pass: true
    - no_critical_issues: true
    - code_coverage: ">= 80%"

  recommended:
    - no_major_issues: true
    - complexity_score: "<= 10"
    - documentation_complete: true

Review Checklist:
  - [ ] Meets acceptance criteria from Issue
  - [ ] Follows coding standards
  - [ ] No security vulnerabilities
  - [ ] Adequate test coverage
  - [ ] No breaking changes (or documented)
  - [ ] Performance acceptable
```

#### 7.8.5 Tools Required

| Tool | Purpose |
|------|---------|
| `Bash` | `gh pr create`, `gh pr review` 실행 |
| `Read` | 변경된 파일 분석 |
| `Grep` | 코드 패턴 검사 |

---

## 8. Functional Requirements

### 8.1 Core Requirements

| Req ID | Requirement | Priority | Agent(s) |
|--------|-------------|----------|----------|
| FR-001 | 자연어 입력으로부터 구조화된 정보 추출 | P0 | Collector |
| FR-002 | 표준 템플릿 기반 PRD 자동 생성 | P0 | PRD Writer |
| FR-003 | PRD 기반 SRS 자동 생성 | P0 | SRS Writer |
| FR-004 | SRS 기반 SDS 자동 생성 | P0 | SDS Writer |
| FR-005 | SDS 기반 GitHub Issue 자동 생성 | P0 | Issue Generator |
| FR-006 | Issue 의존성 분석 및 작업 순서 결정 | P0 | Controller |
| FR-007 | Issue 기반 코드 자동 구현 | P0 | Worker |
| FR-008 | 자동 PR 생성 및 코드 리뷰 | P0 | PR Review |

### 8.2 Supporting Requirements

| Req ID | Requirement | Priority | Agent(s) |
|--------|-------------|----------|----------|
| FR-009 | 문서 간 추적성 매트릭스 유지 | P1 | Orchestrator |
| FR-010 | 각 단계별 사용자 승인 게이트 | P1 | Orchestrator |
| FR-011 | 작업 진행률 실시간 모니터링 | P1 | Controller |
| FR-012 | 실패 시 자동 재시도 (최대 3회) | P1 | Worker, PR Review |
| FR-013 | 에이전트 활동 로깅 및 감사 추적 | P1 | All |

### 8.3 Integration Requirements

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| FR-014 | GitHub API 연동 (Issues, PRs, Actions) | P0 |
| FR-015 | 파일 시스템 기반 상태 공유 (Scratchpad) | P0 |
| FR-016 | 외부 문서 소스 통합 (URL, 파일) | P1 |

### 8.4 Enhancement Pipeline Requirements

| Req ID | Requirement | Priority | Agent(s) |
|--------|-------------|----------|----------|
| FR-017 | 기존 PRD/SRS/SDS 문서 파싱 및 현재 상태 추출 | P0 | Document Reader |
| FR-018 | 기존 코드베이스 구조, 패턴, 의존성 분석 | P0 | Codebase Analyzer |
| FR-019 | 기존 시스템에 대한 변경 영향 분석 및 리스크 평가 | P0 | Impact Analyzer |
| FR-020 | 요구사항 추가/수정/폐기를 통한 PRD 점진적 갱신 | P0 | PRD Updater |
| FR-021 | PRD→SRS 추적성을 유지하며 SRS 점진적 갱신 | P0 | SRS Updater |
| FR-022 | SRS→SDS 추적성을 유지하며 SDS 점진적 갱신 | P0 | SDS Updater |
| FR-023 | 영향 받는 영역의 회귀 테스트 실행 및 호환성 보고 | P1 | Regression Tester |
| FR-024 | 문서 사양과 코드 구현 간 비교 (Gap 분석) | P1 | Doc-Code Comparator |
| FR-025 | 소스코드 AST 분석으로 클래스, 함수, 의존성 추출 | P1 | Code Reader |
| FR-026 | CI/CD 실패 자동 진단 및 수정 | P1 | CI Fixer |

### 8.5 Infrastructure & Pipeline Requirements

| Req ID | Requirement | Priority | Agent(s) |
|--------|-------------|----------|----------|
| FR-027 | Greenfield/Enhancement 파이프라인 모드 자동 감지 | P0 | Mode Detector |
| FR-028 | .ad-sdlc 디렉토리 구조 및 설정 초기화 | P0 | Project Initializer |
| FR-029 | 프로젝트 문서에서 GitHub 리포지토리 생성 및 초기화 | P1 | GitHub Repo Setup |
| FR-030 | 기존 GitHub 리포지토리 존재 여부 감지 | P1 | Repo Detector |
| FR-031 | 서브에이전트 호출을 통한 전체 파이프라인 실행 조율 | P0 | AD-SDLC Orchestrator |
| FR-032 | Enhancement 분석 파이프라인 조율 (Document→Code→Compare→Issue) | P1 | Analysis Orchestrator |
| FR-033 | 기존 GitHub Issues 가져오기 및 AD-SDLC 형식 변환 | P1 | Issue Reader |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| NFR ID | Requirement | Target | Priority |
|--------|-------------|--------|----------|
| NFR-001 | 문서 생성 응답 시간 | < 5분 / 문서 | P0 |
| NFR-002 | Issue 생성 처리량 | > 20 issues / 분 | P0 |
| NFR-003 | Worker Agent 동시 실행 | 최대 5개 병렬 | P0 |
| NFR-004 | 상태 체크 주기 | 30초 | P1 |
| NFR-005 | PR 리뷰 완료 시간 | < 5분 | P1 |

### 9.2 Reliability

| NFR ID | Requirement | Target | Priority |
|--------|-------------|--------|----------|
| NFR-006 | 시스템 가용성 | 99.5% | P1 |
| NFR-007 | 문서 생성 성공률 | > 95% | P0 |
| NFR-008 | 코드 구현 성공률 | > 85% | P0 |
| NFR-009 | 데이터 무손실 보장 | 100% | P0 |
| NFR-010 | 재시도 후 복구율 | > 90% | P1 |

### 9.3 Security

| NFR ID | Requirement | Target | Priority |
|--------|-------------|--------|----------|
| NFR-011 | API 키/토큰 보안 저장 | 환경 변수 또는 Secret Manager | P0 |
| NFR-012 | 민감 정보 마스킹 | 로그에서 자동 마스킹 | P0 |
| NFR-013 | 접근 권한 관리 | GitHub OAuth 또는 PAT 기반 인증 | P0 |
| NFR-014 | 코드 보안 검사 | 생성 코드에 하드코딩된 비밀 금지 | P0 |
| NFR-015 | 입력 검증 | 사용자 입력 및 외부 데이터 검증 | P1 |

### 9.4 Maintainability

| NFR ID | Requirement | Target | Priority |
|--------|-------------|--------|----------|
| NFR-016 | 에이전트 설정 외부화 | YAML 기반 설정 | P0 |
| NFR-017 | 템플릿 커스터마이징 | 사용자 정의 템플릿 지원 | P1 |
| NFR-018 | 로그 레벨 조정 | DEBUG/INFO/WARN/ERROR 런타임 조정 | P1 |
| NFR-019 | 에이전트 정의 분리 | 에이전트당 독립 정의 파일 | P0 |
| NFR-020 | 워크플로우 설정 | 파이프라인 스테이지 및 승인 게이트 설정 | P1 |

### 9.5 Scalability

| NFR ID | Requirement | Target | Priority |
|--------|-------------|--------|----------|
| NFR-021 | 병렬 Worker 확장 | 최대 Worker 수 설정 가능 | P1 |
| NFR-022 | 대용량 문서 처리 | 컨텍스트 분할을 통한 대규모 입력 처리 | P1 |

---

## 10. System Architecture

### 10.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AD-SDLC System                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Orchestrator Layer                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Main Claude Agent                         │   │   │
│  │  │              (Entry Point & Coordinator)                     │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Agent Layer                                  │   │
│  │                                                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │   │
│  │  │Collector │ │   PRD    │ │   SRS    │ │   SDS    │              │   │
│  │  │  Agent   │ │  Writer  │ │  Writer  │ │  Writer  │              │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │   │
│  │                                                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │   │
│  │  │  Issue   │ │Controller│ │  Worker  │ │PR Review │              │   │
│  │  │Generator │ │  Agent   │ │  Agent   │ │  Agent   │              │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       State Management Layer                        │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │   │
│  │  │   Scratchpad    │  │  Session Store  │  │  Event Log      │    │   │
│  │  │  (File-based)   │  │   (Transcripts) │  │  (Audit Trail)  │    │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       External Integration Layer                    │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │   │
│  │  │   GitHub API    │  │   File System   │  │   Web Sources   │    │   │
│  │  │ (Issues, PRs)   │  │ (Docs, Code)    │  │ (URLs, Search)  │    │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Agent Interaction Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agent Communication Flow                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Sequential Document Flow:                                                 │
│   ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐      │
│   │Collect │───▶│  PRD   │───▶│  SRS   │───▶│  SDS   │───▶│ Issues │      │
│   └────────┘    └────────┘    └────────┘    └────────┘    └────────┘      │
│       │              │              │              │              │         │
│       ▼              ▼              ▼              ▼              ▼         │
│   [info.yaml]   [prd.md]      [srs.md]      [sds.md]    [issues.json]     │
│                                                                             │
│   Parallel Execution Flow:                                                  │
│                         ┌─────────────────────────────────────┐            │
│                         │          Controller Agent           │            │
│                         └─────────────┬───────────────────────┘            │
│                                       │                                     │
│              ┌────────────────────────┼────────────────────────┐           │
│              ▼                        ▼                        ▼           │
│        ┌──────────┐            ┌──────────┐            ┌──────────┐       │
│        │ Worker 1 │            │ Worker 2 │            │ Worker N │       │
│        │ Issue #1 │            │ Issue #2 │            │ Issue #N │       │
│        └────┬─────┘            └────┬─────┘            └────┬─────┘       │
│             │                       │                       │              │
│             └───────────────────────┼───────────────────────┘              │
│                                     ▼                                       │
│                            ┌──────────────┐                                │
│                            │  PR Review   │                                │
│                            │    Agent     │                                │
│                            └──────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Directory Structure

```
project-root/
├── .claude/
│   └── agents/                    # Agent definitions
│       ├── collector.md
│       ├── prd-writer.md
│       ├── srs-writer.md
│       ├── sds-writer.md
│       ├── issue-generator.md
│       ├── controller.md
│       ├── worker.md
│       └── pr-reviewer.md
├── .ad-sdlc/
│   ├── scratchpad/               # Inter-agent state sharing
│   │   ├── info/                 # Collected information
│   │   ├── documents/            # Generated documents
│   │   ├── issues/               # Issue tracking
│   │   └── progress/             # Progress tracking
│   ├── templates/                # Document templates
│   │   ├── prd-template.md
│   │   ├── srs-template.md
│   │   ├── sds-template.md
│   │   └── issue-template.md
│   ├── config/                   # Configuration
│   │   ├── agents.yaml
│   │   └── workflow.yaml
│   └── logs/                     # Audit logs
├── docs/
│   ├── prd/
│   ├── srs/
│   └── sds/
└── src/                          # Generated source code
```

---

## 11. Data Flow & State Management

### 11.1 Scratchpad Pattern

Claude Agent 시스템의 제약(부모-자식 단방향 통신)을 극복하기 위해 파일 시스템 기반 Scratchpad 패턴을 사용합니다.

```yaml
Scratchpad Structure:
  .ad-sdlc/scratchpad/
    ├── info/
    │   └── {collection_id}/
    │       ├── raw_input.md          # 원본 사용자 입력
    │       ├── extracted_info.yaml   # 추출된 정보
    │       └── clarifications.json   # Q&A 히스토리
    ├── documents/
    │   └── {project_id}/
    │       ├── prd.md
    │       ├── srs.md
    │       └── sds.md
    ├── issues/
    │   └── {project_id}/
    │       ├── issue_list.json       # 생성된 이슈 목록
    │       ├── dependency_graph.json # 의존성 그래프
    │       └── assignments.json      # 작업 할당 상태
    └── progress/
        └── {project_id}/
            ├── overall_status.yaml   # 전체 진행률
            └── agent_logs/           # 에이전트별 로그
                ├── collector.log
                ├── prd-writer.log
                └── ...
```

### 11.2 State Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Project Lifecycle States                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │COLLECTING│───▶│  PRD     │───▶│   SRS    │───▶│   SDS    │            │
│   │          │    │ DRAFTING │    │ DRAFTING │    │ DRAFTING │            │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│        │               │               │               │                   │
│        ▼               ▼               ▼               ▼                   │
│   [User Review]   [User Review]   [User Review]   [User Review]           │
│        │               │               │               │                   │
│        ▼               ▼               ▼               ▼                   │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │CLARIFYING│    │   PRD    │    │   SRS    │    │   SDS    │            │
│   │(optional)│    │ APPROVED │    │ APPROVED │    │ APPROVED │            │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                                                                             │
│                                                        │                    │
│                                                        ▼                    │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │ MERGED   │◀───│ PR REVIEW│◀───│IMPLEMENTING◀───│ ISSUES   │            │
│   │          │    │          │    │          │    │ CREATED  │            │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Traceability Matrix

```yaml
Traceability:
  PRD_Requirement:
    - FR-001:
        SRS_Features: [SF-001, SF-002]
        SDS_Components: [CMP-001]
        GitHub_Issues: [#1, #2, #3]
        PR_Numbers: [#10, #11]

  Reverse_Trace:
    - PR-#10:
        Issue: #1
        Component: CMP-001
        Feature: SF-001
        Requirement: FR-001
```

---

## 12. Risk Analysis

### 12.1 Technical Risks

| Risk ID | Risk | Probability | Impact | Mitigation |
|---------|------|-------------|--------|------------|
| TR-001 | LLM 응답 불일치 | Medium | High | 템플릿 기반 검증, 재시도 로직 |
| TR-002 | Context 한계 도달 | Medium | Medium | Context Compaction, 단계별 처리 |
| TR-003 | GitHub API 제한 | Low | Medium | Rate limiting, 캐싱 |
| TR-004 | 코드 생성 오류 | High | High | Self-verification, 테스트 필수 |

### 12.2 Process Risks

| Risk ID | Risk | Probability | Impact | Mitigation |
|---------|------|-------------|--------|------------|
| PR-001 | 사용자 승인 지연 | Medium | Medium | 알림 시스템, SLA 설정 |
| PR-002 | 요구사항 변경 | High | High | 변경 관리 프로세스, 버전 관리 |
| PR-003 | 에이전트 실패 연쇄 | Medium | High | Circuit breaker, 격리된 재시도 |

### 12.3 Mitigation Strategies

```yaml
Retry Policy:
  max_attempts: 3
  backoff: exponential
  base_delay: 5s

Circuit Breaker:
  failure_threshold: 5
  reset_timeout: 60s

Validation Gates:
  - post_collection: schema_validation
  - post_prd: completeness_check
  - post_implementation: test_execution
```

---

## 13. Implementation Phases

### Phase 1: Foundation (4 weeks)

| Week | Deliverable |
|------|-------------|
| 1-2 | Agent 정의 파일 구조 및 기본 설정 |
| 3 | Collector Agent 구현 |
| 4 | PRD Writer Agent 구현 |

**Exit Criteria:**
- [ ] 자연어 입력 → 정보 문서 변환 동작
- [ ] 정보 문서 → PRD 생성 동작
- [ ] 기본 Scratchpad 상태 관리

### Phase 2: Document Pipeline (4 weeks)

| Week | Deliverable |
|------|-------------|
| 5-6 | SRS Writer Agent 구현 |
| 7-8 | SDS Writer Agent 구현 |

**Exit Criteria:**
- [ ] PRD → SRS → SDS 전체 파이프라인 동작
- [ ] 문서 간 추적성 매트릭스 생성

### Phase 3: Issue Management (3 weeks)

| Week | Deliverable |
|------|-------------|
| 9-10 | Issue Generator Agent 구현 |
| 11 | Controller Agent 구현 |

**Exit Criteria:**
- [ ] SDS → GitHub Issues 자동 생성
- [ ] 이슈 의존성 그래프 생성
- [ ] 작업 우선순위 결정 로직

### Phase 4: Implementation Engine (4 weeks)

| Week | Deliverable |
|------|-------------|
| 12-13 | Worker Agent 구현 |
| 14-15 | PR Review Agent 구현 |

**Exit Criteria:**
- [ ] Issue 기반 코드 자동 구현
- [ ] PR 자동 생성 및 리뷰
- [ ] Self-verification 동작

### Phase 5: Integration & Polish (2 weeks)

| Week | Deliverable |
|------|-------------|
| 16 | End-to-End 통합 테스트 |
| 17 | 문서화 및 사용자 가이드 |

**Exit Criteria:**
- [ ] 전체 워크플로우 E2E 테스트 통과
- [ ] 사용자 가이드 완성
- [ ] 성능 벤치마크 달성

### Phase 6: Enhancement Pipeline (4 weeks)

| Week | Deliverable |
|------|-------------|
| 18-19 | Document Reader, Codebase Analyzer, Code Reader 구현 |
| 20-21 | Impact Analyzer, PRD/SRS/SDS Updater 에이전트 구현 |

**Exit Criteria:**
- [ ] 기존 문서 파싱 및 추적성 추출 동작
- [ ] 변경 영향 분석 및 리스크 평가 동작
- [ ] 증분 문서 업데이트 파이프라인 (PRD→SRS→SDS) 동작

### Phase 7: Infrastructure & Advanced Features (3 weeks)

| Week | Deliverable |
|------|-------------|
| 22 | Mode Detector, Project Initializer, Repo Detector 구현 |
| 23 | AD-SDLC Orchestrator, Analysis Orchestrator, Issue Reader 구현 |
| 24 | Regression Tester, CI Fixer, Doc-Code Comparator 구현 |

**Exit Criteria:**
- [ ] Greenfield/Enhancement 모드 자동 감지 동작
- [ ] Import 파이프라인 (기존 GitHub 이슈 → 구현) 동작
- [ ] 회귀 테스트 및 CI 자동 수정 동작
- [ ] Enhancement Pipeline 전체 E2E 테스트 통과

---

## 14. Appendix

### 14.1 Glossary

| Term | Definition |
|------|------------|
| **PRD** | Product Requirements Document - 제품 요구사항 문서 |
| **SRS** | Software Requirements Specification - 소프트웨어 요구사항 명세서 |
| **SDS** | Software Design Specification - 소프트웨어 설계 명세서 |
| **Scratchpad** | 에이전트 간 상태 공유를 위한 파일 기반 저장소 |
| **Traceability** | 요구사항부터 구현까지의 추적 가능성 |

### 14.2 References

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [GitHub CLI Documentation](https://cli.github.com/manual/)

### 14.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-27 | System Architect | Initial draft |

---

_This PRD was created for the Agent-Driven SDLC project._
