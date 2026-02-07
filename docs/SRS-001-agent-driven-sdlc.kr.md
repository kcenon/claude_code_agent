# Software Requirements Specification (SRS)

## Agent-Driven Software Development Lifecycle System

| Field | Value |
|-------|-------|
| **Document ID** | SRS-001 |
| **Source PRD** | PRD-001 |
| **Version** | 1.1.0 |
| **Status** | Review |
| **Implementation** | Partial |
| **Created** | 2025-12-27 |
| **Author** | System Architect |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Traceability Matrix](#7-traceability-matrix)
8. [Appendix](#8-appendix)

---

## 1. Introduction

### 1.1 Purpose

본 소프트웨어 요구사항 명세서(SRS)는 Agent-Driven SDLC (AD-SDLC) 시스템의 상세 기능 요구사항을 정의합니다. PRD-001에서 정의된 제품 요구사항을 구현 가능한 수준의 시스템 기능과 유스케이스로 분해하여, 개발팀이 설계 및 구현에 직접 활용할 수 있도록 합니다.

**대상 독자:**
- Tech Lead 및 Software Architect
- Software Developers
- QA Engineers
- Project Managers

### 1.2 Scope

AD-SDLC 시스템은 다음 범위를 포함합니다:

**포함 범위:**
- 3가지 파이프라인 모드에 걸친 25개의 특화된 Claude 에이전트:
  - **Core (Greenfield)**: Collector, PRD Writer, SRS Writer, SDS Writer, Issue Generator, Controller, Worker, PR Reviewer
  - **Enhancement**: Document Reader, Codebase Analyzer, Impact Analyzer, PRD/SRS/SDS Updaters, Regression Tester, Code Reader, Doc-Code Comparator, CI Fixer
  - **Infrastructure**: AD-SDLC Orchestrator, Analysis Orchestrator, Mode Detector, Project Initializer, Repo Detector, GitHub Repo Setup, Issue Reader
- 문서 파이프라인 자동화 (PRD → SRS → SDS)
- GitHub Issue 자동 생성 및 관리
- 코드 자동 구현 및 PR 생성/리뷰
- Scratchpad 기반 상태 관리
- 추적성 매트릭스 유지

**제외 범위:**
- 배포 자동화 (CI/CD 파이프라인)
- 모니터링 대시보드 UI
- 다중 리포지토리 지원
- 외부 프로젝트 관리 도구 연동 (Jira, Asana 등)

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| **AD-SDLC** | Agent-Driven Software Development Lifecycle |
| **PRD** | Product Requirements Document - 제품 요구사항 문서 |
| **SRS** | Software Requirements Specification - 소프트웨어 요구사항 명세서 |
| **SDS** | Software Design Specification - 소프트웨어 설계 명세서 |
| **Scratchpad** | 에이전트 간 상태 공유를 위한 파일 기반 저장소 패턴 |
| **Traceability** | 요구사항부터 구현까지의 양방향 추적 가능성 |
| **Work Order** | Controller Agent가 Worker Agent에게 전달하는 작업 지시서 |
| **Quality Gate** | 다음 단계 진행을 위한 품질 검증 관문 |
| **Human-in-the-Loop** | 중요 결정점에서 사용자 승인을 필수로 하는 패턴 |

### 1.4 References

| Reference | Description |
|-----------|-------------|
| PRD-001 | Agent-Driven SDLC Product Requirements Document |
| Claude Agent SDK | https://platform.claude.com/docs/en/agent-sdk |
| GitHub CLI | https://cli.github.com/manual/ |
| IEEE 830-1998 | IEEE Recommended Practice for SRS |

---

## 2. Overall Description

### 2.1 Product Perspective

AD-SDLC는 Claude Agent SDK 기반의 멀티 에이전트 시스템으로, 기존의 수동 소프트웨어 개발 프로세스를 자동화합니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        System Context Diagram                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐                           ┌──────────────┐           │
│  │    User      │◀─────────────────────────▶│   AD-SDLC    │           │
│  │ (PM, TL, Dev)│   Natural Language        │    System    │           │
│  └──────────────┘   + Files + URLs          └──────┬───────┘           │
│                                                     │                   │
│         ┌───────────────────────────────────────────┼───────────────┐  │
│         │                                           │               │  │
│         ▼                                           ▼               ▼  │
│  ┌──────────────┐                           ┌──────────────┐  ┌─────┐  │
│  │  File System │                           │   GitHub     │  │ Web │  │
│  │ (Scratchpad) │                           │   (API)      │  │ URLs│  │
│  └──────────────┘                           └──────────────┘  └─────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions Summary

| Function Category | Description | Agents Involved |
|-------------------|-------------|-----------------|
| **Document Pipeline** | 요구사항 → 문서 자동 생성 | Collector, PRD/SRS/SDS Writer |
| **Issue Management** | 문서 → GitHub Issue 변환 및 관리 | Issue Generator, Controller |
| **Code Execution** | Issue → 코드 구현 및 PR | Worker, PR Reviewer |
| **State Management** | 에이전트 간 상태 공유 및 추적 | All Agents |

### 2.3 User Classes and Characteristics

| User Class | Characteristics | Primary Interactions |
|------------|-----------------|---------------------|
| **Product Manager (PM)** | 비기술적 배경, 자연어 입력 선호, 진행 상황 추적 필요 | 요구사항 입력, PRD 승인, 진행 모니터링 |
| **Tech Lead (TL)** | 기술적 배경, 설계 검토 책임, 품질 관리 | SRS/SDS 승인, 아키텍처 결정, PR 최종 승인 |
| **Developer (Dev)** | 코드 구현 담당, 상세 컨텍스트 필요 | Issue 상세 확인, 자동 생성 코드 검토, PR 피드백 |

### 2.4 Operating Environment

| Component | Requirement |
|-----------|-------------|
| **Runtime** | Claude Agent SDK (Claude Code CLI) |
| **Platform** | macOS, Linux, Windows (WSL2) |
| **Node.js** | v18+ |
| **Python** | v3.9+ (optional, for tooling) |
| **Git** | v2.30+ |
| **GitHub CLI** | v2.0+ |
| **File System** | Local or network-attached storage |

### 2.5 Design and Implementation Constraints

| Constraint ID | Constraint | Rationale |
|---------------|------------|-----------|
| **C-001** | Claude Agent SDK 단방향 통신 | 부모→자식 통신만 가능, Scratchpad 패턴으로 해결 |
| **C-002** | Context Window 제한 | 200K 토큰, 문서/코드 분할 처리 필요 |
| **C-003** | GitHub API Rate Limit | 시간당 5,000 요청, 캐싱 및 배치 처리 |
| **C-004** | 동시 Worker 제한 | 최대 5개 병렬 실행 (리소스 관리) |
| **C-005** | 영어 기반 코드 생성 | 코드, 커밋 메시지, PR은 영어로 작성 |

### 2.6 Assumptions and Dependencies

**가정 (Assumptions):**
- 사용자가 GitHub 계정 및 리포지토리에 접근 권한을 가짐
- 프로젝트는 단일 Git 리포지토리로 관리됨
- 기존 코드베이스가 있는 경우, 일관된 코딩 스타일 존재

**의존성 (Dependencies):**
- Claude API 가용성 (99.9% SLA)
- GitHub API 가용성
- 로컬 파일 시스템 접근

---

## 3. System Features

### SF-001: Multi-Source Information Collection

**Source**: FR-001, FR-016
**Priority**: P0
**Description**: 사용자로부터 다양한 형태의 입력(자연어 텍스트, 파일, URL)을 수집하고 구조화된 정보 문서로 변환합니다.

#### 3.1.1 Use Cases

##### UC-001: 자연어 요구사항 수집

- **Actor**: Product Manager
- **Preconditions**:
  1. AD-SDLC 시스템이 초기화되어 있음
  2. 사용자가 프로젝트 컨텍스트를 가지고 있음
- **Main Flow**:
  1. 사용자가 자연어로 요구사항을 입력함
  2. 시스템이 입력을 분석하여 핵심 정보를 추출함
  3. 시스템이 추가 명확화가 필요한 항목을 식별함
  4. 시스템이 최대 5개의 명확화 질문을 생성함 (필요 시)
  5. 사용자가 질문에 응답함
  6. 시스템이 최종 정보를 `collected_info.yaml`로 저장함
- **Alternative Flows**:
  - 3a. 모든 정보가 충분한 경우: 질문 없이 바로 저장
  - 5a. 사용자가 질문을 스킵: 기본값 또는 "TBD"로 표시
- **Exception Flows**:
  - E1. 입력이 너무 짧거나 불명확: 최소 요구사항 안내 메시지 표시
  - E2. Context 한계 도달: 입력 분할 처리 안내
- **Postconditions**:
  1. `collected_info.yaml` 파일이 Scratchpad에 저장됨
  2. 추출된 정보가 구조화된 형태로 유지됨

##### UC-002: 파일 기반 요구사항 수집

- **Actor**: Tech Lead, Product Manager
- **Preconditions**:
  1. 지원 형식의 파일이 준비되어 있음 (.md, .pdf, .docx, .txt)
- **Main Flow**:
  1. 사용자가 파일 경로를 제공함
  2. 시스템이 파일을 읽고 내용을 추출함
  3. 시스템이 핵심 정보(요구사항, 제약조건, 가정)를 식별함
  4. 시스템이 자연어 입력과 동일한 구조화 프로세스를 수행함
  5. 시스템이 결과를 `collected_info.yaml`에 병합함
- **Alternative Flows**:
  - 2a. PDF 파일: OCR 또는 텍스트 레이어 추출
  - 2b. 다중 파일: 순차 처리 후 병합
- **Exception Flows**:
  - E1. 지원하지 않는 파일 형식: 오류 메시지 및 지원 형식 안내
  - E2. 파일 읽기 실패: 오류 로그 및 재시도 안내
- **Postconditions**:
  1. 파일 내용이 구조화된 정보로 변환됨

##### UC-003: URL 기반 정보 수집

- **Actor**: All Users
- **Preconditions**:
  1. 유효한 HTTP/HTTPS URL이 제공됨
- **Main Flow**:
  1. 사용자가 URL을 제공함
  2. 시스템이 WebFetch 도구로 콘텐츠를 가져옴
  3. 시스템이 HTML을 파싱하여 본문 텍스트를 추출함
  4. 시스템이 관련 정보를 식별하고 구조화함
- **Alternative Flows**:
  - 3a. API 문서 URL: 구조화된 API 스펙으로 추출
- **Exception Flows**:
  - E1. URL 접근 불가: 오류 메시지 및 대체 입력 안내
  - E2. 콘텐츠 추출 실패: 수동 입력 요청
- **Postconditions**:
  1. URL 콘텐츠가 정보 문서에 통합됨

#### 3.1.2 Acceptance Criteria

- [ ] AC-001: 자연어 입력에서 요구사항, 제약조건, 가정을 95% 이상 정확도로 추출
- [ ] AC-002: .md, .pdf, .docx, .txt 파일 형식 지원
- [ ] AC-003: URL 콘텐츠 추출 및 구조화 지원
- [ ] AC-004: 명확화 질문 생성 시 최대 5개 제한
- [ ] AC-005: `collected_info.yaml` 출력 스키마 준수

#### 3.1.3 Dependencies

- **Depends on**: None (Entry Point)
- **Blocks**: SF-002 (PRD Generation)

---

### SF-002: PRD Document Auto-Generation

**Source**: FR-002
**Priority**: P0
**Description**: 수집된 정보를 분석하여 표준 PRD 템플릿 기반의 문서를 자동 생성합니다.

#### 3.2.1 Use Cases

##### UC-004: PRD 자동 생성

- **Actor**: System (PRD Writer Agent)
- **Preconditions**:
  1. `collected_info.yaml`이 존재하고 유효함
  2. PRD 템플릿이 설정되어 있음
- **Main Flow**:
  1. 시스템이 수집된 정보를 로드함
  2. 시스템이 PRD 템플릿의 각 섹션을 순차적으로 생성함
  3. 시스템이 요구사항에 우선순위(P0-P3)를 자동 할당함
  4. 시스템이 누락된 정보를 식별하여 Gap Analysis 섹션에 기록함
  5. 시스템이 요구사항 간 충돌을 검사함
  6. 시스템이 완성된 PRD를 저장함
- **Alternative Flows**:
  - 4a. 누락 정보 없음: Gap Analysis 섹션 생략
  - 5a. 충돌 발견: 충돌 목록과 해결 제안 포함
- **Exception Flows**:
  - E1. 템플릿 로드 실패: 기본 템플릿 사용
  - E2. 정보 불충분: 최소 요구사항 미달 경고
- **Postconditions**:
  1. `prd.md` 파일이 Scratchpad에 저장됨
  2. `docs/prd/PRD-{project_id}.md`에 복사됨

##### UC-005: PRD 사용자 승인

- **Actor**: Product Manager, Tech Lead
- **Preconditions**:
  1. PRD 초안이 생성되어 있음
- **Main Flow**:
  1. 시스템이 생성된 PRD를 사용자에게 제시함
  2. 사용자가 PRD 내용을 검토함
  3. 사용자가 승인(Approve) 또는 수정 요청(Request Changes)을 선택함
  4. 승인 시: 시스템이 다음 단계(SRS)로 진행함
- **Alternative Flows**:
  - 3a. 수정 요청: 사용자 피드백을 반영하여 PRD 재생성
- **Exception Flows**:
  - E1. 승인 타임아웃: 알림 발송 및 대기 상태 유지
- **Postconditions**:
  1. PRD 승인 상태가 기록됨
  2. 승인 시 SRS 생성 단계로 전환

#### 3.2.2 Acceptance Criteria

- [ ] AC-006: 모든 필수 섹션(Executive Summary, Problem Statement, FR, NFR) 포함
- [ ] AC-007: 최소 3개 이상의 기능 요구사항 포함
- [ ] AC-008: 각 요구사항에 고유 ID(FR-XXX) 및 우선순위 할당
- [ ] AC-009: 사용자 승인 게이트 동작

#### 3.2.3 Dependencies

- **Depends on**: SF-001
- **Blocks**: SF-003

---

### SF-003: SRS Document Auto-Generation

**Source**: FR-003
**Priority**: P0
**Description**: PRD를 분석하여 상세한 소프트웨어 요구사항 명세서(SRS)를 자동 생성합니다. 각 PRD 요구사항을 시스템 기능으로 분해하고, 유스케이스 시나리오를 생성합니다.

#### 3.3.1 Use Cases

##### UC-006: SRS 자동 생성

- **Actor**: System (SRS Writer Agent)
- **Preconditions**:
  1. 승인된 PRD가 존재함
- **Main Flow**:
  1. 시스템이 PRD를 로드하고 분석함
  2. 시스템이 각 FR을 세부 기능(SF-XXX)으로 분해함
  3. 시스템이 각 기능에 대한 유스케이스(UC-XXX)를 생성함
  4. 시스템이 시스템 인터페이스를 정의함
  5. 시스템이 PRD→SRS 추적성 매트릭스를 생성함
  6. 시스템이 완성된 SRS를 저장함
- **Alternative Flows**:
  - 2a. 복합 FR: 다중 SF로 분해
- **Exception Flows**:
  - E1. PRD 구조 오류: 파싱 실패 위치 보고
- **Postconditions**:
  1. `srs.md` 파일이 Scratchpad에 저장됨
  2. 모든 FR이 최소 1개 SF에 매핑됨

#### 3.3.2 Acceptance Criteria

- [ ] AC-010: 모든 PRD 요구사항이 SRS 기능에 매핑됨 (100% 커버리지)
- [ ] AC-011: 각 기능에 최소 1개의 유스케이스 포함
- [ ] AC-012: 유스케이스에 Main/Alternative/Exception 플로우 포함
- [ ] AC-013: 추적성 매트릭스 자동 생성

#### 3.3.3 Dependencies

- **Depends on**: SF-002
- **Blocks**: SF-004

---

### SF-004: SDS Document Auto-Generation

**Source**: FR-004
**Priority**: P0
**Description**: SRS를 분석하여 소프트웨어 설계 명세서(SDS)를 자동 생성합니다. 시스템 아키텍처, 컴포넌트 설계, API 명세, 데이터베이스 스키마를 포함합니다.

#### 3.4.1 Use Cases

##### UC-007: SDS 자동 생성

- **Actor**: System (SDS Writer Agent)
- **Preconditions**:
  1. 승인된 SRS가 존재함
- **Main Flow**:
  1. 시스템이 SRS를 로드하고 분석함
  2. 시스템이 시스템 아키텍처를 설계함
  3. 시스템이 컴포넌트(CMP-XXX)를 정의함
  4. 시스템이 API 엔드포인트를 설계함
  5. 시스템이 데이터 모델/스키마를 정의함
  6. 시스템이 SRS→SDS 추적성을 유지함
  7. 시스템이 완성된 SDS를 저장함
- **Alternative Flows**:
  - 3a. 기존 아키텍처 존재: 기존 패턴 분석 및 확장
- **Exception Flows**:
  - E1. 아키텍처 결정 필요: 사용자에게 옵션 제시
- **Postconditions**:
  1. `sds.md` 파일이 Scratchpad에 저장됨
  2. 모든 SF가 CMP에 매핑됨

#### 3.4.2 Acceptance Criteria

- [ ] AC-014: 시스템 아키텍처 다이어그램 포함
- [ ] AC-015: 최소 1개의 컴포넌트 정의
- [ ] AC-016: 컴포넌트별 인터페이스 명세
- [ ] AC-017: API 스펙(엔드포인트, 메서드, 요청/응답) 포함
- [ ] AC-018: 배포 아키텍처 명세

#### 3.4.3 Dependencies

- **Depends on**: SF-003
- **Blocks**: SF-005

---

### SF-005: GitHub Issue Auto-Generation

**Source**: FR-005, FR-014
**Priority**: P0
**Description**: SDS 컴포넌트를 분석하여 구현 가능한 단위의 GitHub Issue를 자동 생성합니다.

#### 3.5.1 Use Cases

##### UC-008: Issue 자동 생성

- **Actor**: System (Issue Generator Agent)
- **Preconditions**:
  1. 승인된 SDS가 존재함
  2. GitHub CLI가 인증되어 있음
- **Main Flow**:
  1. 시스템이 SDS를 분석하여 컴포넌트 목록을 추출함
  2. 시스템이 각 컴포넌트를 구현 단위로 분해함 (Work Breakdown)
  3. 시스템이 이슈 간 의존성을 분석함
  4. 시스템이 표준 템플릿으로 이슈 본문을 생성함
  5. 시스템이 라벨, 마일스톤, 예상 공수를 할당함
  6. 시스템이 `gh issue create` 명령으로 GitHub에 이슈를 생성함
  7. 시스템이 `issue_list.json`과 `dependency_graph.json`을 저장함
- **Alternative Flows**:
  - 6a. API Rate Limit: 대기 후 재시도
- **Exception Flows**:
  - E1. GitHub 인증 실패: 인증 안내 메시지
  - E2. 이슈 생성 실패: 로컬 저장 및 재시도 큐
- **Postconditions**:
  1. GitHub에 이슈가 생성됨
  2. 이슈 목록과 의존성 그래프가 저장됨

#### 3.5.2 Acceptance Criteria

- [ ] AC-019: SDS 컴포넌트당 최소 1개 이슈 생성
- [ ] AC-020: 이슈에 Source Reference (CMP, SF, FR) 포함
- [ ] AC-021: 이슈 간 `blocked_by` 의존성 설정
- [ ] AC-022: 공수 추정(XS/S/M/L/XL) 포함
- [ ] AC-023: 자동 라벨링 (`ad-sdlc:auto-generated`)

#### 3.5.3 Dependencies

- **Depends on**: SF-004
- **Blocks**: SF-006

---

### SF-006: Work Prioritization and Dependency Analysis

**Source**: FR-006
**Priority**: P0
**Description**: 생성된 이슈들의 의존성을 분석하고 실행 우선순위를 결정합니다.

#### 3.6.1 Use Cases

##### UC-009: 작업 우선순위 결정

- **Actor**: System (Controller Agent)
- **Preconditions**:
  1. 이슈 목록과 의존성 그래프가 존재함
- **Main Flow**:
  1. 시스템이 의존성 그래프를 로드함
  2. 시스템이 위상 정렬(Topological Sort)을 수행함
  3. 시스템이 우선순위 가중치를 적용함 (P0 > P1 > P2 > P3)
  4. 시스템이 의존하는 이슈 수와 크리티컬 패스를 고려함
  5. 시스템이 최종 실행 순서를 결정함
- **Alternative Flows**:
  - 2a. 순환 의존성 발견: 경고 및 수동 개입 요청
- **Exception Flows**:
  - E1. 그래프 파싱 오류: 오류 위치 보고
- **Postconditions**:
  1. 우선순위가 정렬된 이슈 큐가 생성됨

#### 3.6.2 Acceptance Criteria

- [ ] AC-024: 위상 정렬 기반 의존성 해결
- [ ] AC-025: 우선순위와 의존성 복합 스코어링
- [ ] AC-026: 순환 의존성 감지 및 경고

#### 3.6.3 Dependencies

- **Depends on**: SF-005
- **Blocks**: SF-007

---

### SF-007: Work Assignment and Monitoring

**Source**: FR-006, FR-011
**Priority**: P0
**Description**: Worker Agent에게 작업을 할당하고 진행 상황을 실시간으로 모니터링합니다.

#### 3.7.1 Use Cases

##### UC-010: 작업 할당

- **Actor**: System (Controller Agent)
- **Preconditions**:
  1. 우선순위가 정렬된 이슈 큐가 존재함
  2. 사용 가능한 Worker 슬롯이 있음 (최대 5개)
- **Main Flow**:
  1. 시스템이 다음 실행 가능한 이슈를 선택함 (의존성 해결됨)
  2. 시스템이 Work Order를 생성함
  3. 시스템이 관련 컨텍스트(파일, 의존성 상태)를 포함함
  4. 시스템이 Worker Agent를 spawn함
  5. 시스템이 할당 상태를 `controller_state.yaml`에 기록함
- **Alternative Flows**:
  - 1a. 모든 이슈 완료: 파이프라인 종료
  - 4a. Worker 슬롯 부족: 대기열에 추가
- **Exception Flows**:
  - E1. Worker spawn 실패: 재시도 후 에러 보고
- **Postconditions**:
  1. Work Order 파일이 생성됨
  2. Worker Agent가 실행됨

##### UC-011: 진행 상황 모니터링

- **Actor**: System (Controller Agent), All Users
- **Preconditions**:
  1. 하나 이상의 Worker가 실행 중임
- **Main Flow**:
  1. 시스템이 30초 간격으로 Worker 상태를 확인함
  2. 시스템이 완료된 작업을 식별함
  3. 시스템이 전체 진행률을 계산함
  4. 시스템이 병목 구간을 감지함
  5. 시스템이 `progress_report.md`를 갱신함
- **Alternative Flows**:
  - 4a. 병목 발견: 알림 발송
- **Postconditions**:
  1. 진행 보고서가 최신 상태로 유지됨

#### 3.7.2 Acceptance Criteria

- [ ] AC-027: 최대 5개 Worker 병렬 실행 지원
- [ ] AC-028: 의존성이 해결된 이슈만 할당
- [ ] AC-029: 30초 간격 상태 폴링
- [ ] AC-030: 진행률(%) 계산 및 보고

#### 3.7.3 Dependencies

- **Depends on**: SF-006
- **Blocks**: SF-008

---

### SF-008: Code Auto-Implementation

**Source**: FR-007
**Priority**: P0
**Description**: 할당된 Issue를 기반으로 코드를 자동 구현합니다.

#### 3.8.1 Use Cases

##### UC-012: 코드 자동 구현

- **Actor**: System (Worker Agent)
- **Preconditions**:
  1. Work Order가 할당됨
  2. 기존 코드베이스에 접근 가능
- **Main Flow**:
  1. 시스템이 Work Order를 읽고 이슈 상세 정보를 파악함
  2. 시스템이 관련 기존 코드를 분석함 (Glob, Grep, Read)
  3. 시스템이 피처 브랜치를 생성함 (`feature/ISS-XXX-description`)
  4. 시스템이 코드를 생성/수정함 (Write, Edit)
  5. 시스템이 단위 테스트를 작성함
  6. 시스템이 변경 사항을 커밋함
  7. 시스템이 `implementation_result.yaml`을 생성함
- **Alternative Flows**:
  - 3a. 브랜치 존재: 기존 브랜치 사용
  - 4a. 수정만 필요: Edit 도구 사용
- **Exception Flows**:
  - E1. 코드 생성 실패: 오류 로그 및 재시도
  - E2. 테스트 작성 실패: 기본 테스트 스켈레톤 생성
- **Postconditions**:
  1. 피처 브랜치에 코드 변경이 커밋됨
  2. 단위 테스트가 포함됨

#### 3.8.2 Acceptance Criteria

- [ ] AC-031: 기존 코딩 스타일/패턴 준수
- [ ] AC-032: 피처 브랜치 자동 생성
- [ ] AC-033: 변경된 코드에 대한 테스트 작성
- [ ] AC-034: 구현 결과 YAML 출력

#### 3.8.3 Dependencies

- **Depends on**: SF-007
- **Blocks**: SF-009, SF-010

---

### SF-009: Self-Verification and Testing

**Source**: FR-007, FR-012
**Priority**: P0
**Description**: 구현된 코드를 자체 검증(테스트, 린트, 빌드)하고 실패 시 자동으로 수정 및 재시도합니다.

#### 3.9.1 Use Cases

##### UC-013: 자체 검증 실행

- **Actor**: System (Worker Agent)
- **Preconditions**:
  1. 코드 구현이 완료됨
- **Main Flow**:
  1. 시스템이 `npm test` (또는 설정된 테스트 명령)를 실행함
  2. 시스템이 `npm run lint` (또는 설정된 린트 명령)를 실행함
  3. 시스템이 `npm run build` (또는 설정된 빌드 명령)를 실행함
  4. 모든 검증 통과 시: 성공 상태로 결과 보고
  5. 실패 시: 오류 분석 및 자동 수정 시도
  6. 최대 3회 재시도 후 실패 보고
- **Alternative Flows**:
  - 5a. 린트 오류: 자동 수정 적용 (`--fix`)
  - 5b. 타입 오류: 타입 정의 수정 시도
- **Exception Flows**:
  - E1. 3회 재시도 후 실패: 이슈를 blocked 상태로 표시
- **Postconditions**:
  1. 검증 결과가 `implementation_result.yaml`에 기록됨
  2. 성공 시 PR 생성 단계로 진행

#### 3.9.2 Acceptance Criteria

- [ ] AC-035: 테스트, 린트, 빌드 순차 실행
- [ ] AC-036: 실패 시 자동 수정 시도
- [ ] AC-037: 최대 3회 재시도
- [ ] AC-038: 검증 결과 로깅

#### 3.9.3 Dependencies

- **Depends on**: SF-008
- **Blocks**: SF-010

---

### SF-010: PR Auto-Creation and Review

**Source**: FR-008, FR-014
**Priority**: P0
**Description**: 구현 완료된 코드로 PR을 자동 생성하고, 코드 리뷰를 수행합니다.

#### 3.10.1 Use Cases

##### UC-014: PR 자동 생성

- **Actor**: System (PR Review Agent)
- **Preconditions**:
  1. 검증을 통과한 구현 결과가 존재함
  2. 피처 브랜치가 원격에 푸시됨
- **Main Flow**:
  1. 시스템이 `implementation_result.yaml`을 읽음
  2. 시스템이 PR 본문을 생성함 (변경 요약, 테스트 결과, 관련 이슈)
  3. 시스템이 `gh pr create` 명령을 실행함
  4. 시스템이 PR 라벨을 추가함 (`ad-sdlc:auto-generated`)
  5. 시스템이 PR URL을 기록함
- **Alternative Flows**:
  - 3a. Draft PR 옵션: `--draft` 플래그 추가
- **Exception Flows**:
  - E1. PR 생성 실패: 오류 로그 및 재시도
- **Postconditions**:
  1. GitHub에 PR이 생성됨
  2. PR 정보가 기록됨

##### UC-015: 자동 코드 리뷰

- **Actor**: System (PR Review Agent)
- **Preconditions**:
  1. PR이 생성됨
- **Main Flow**:
  1. 시스템이 변경된 파일을 분석함
  2. 시스템이 보안 취약점을 검사함
  3. 시스템이 코딩 스타일 준수를 확인함
  4. 시스템이 테스트 커버리지를 확인함 (≥80%)
  5. 시스템이 복잡도 점수를 계산함 (≤10)
  6. 시스템이 리뷰 코멘트를 생성함
  7. 시스템이 `gh pr review` 명령으로 리뷰를 제출함
- **Alternative Flows**:
  - 6a. 이슈 없음: 승인 리뷰
  - 6b. 마이너 이슈: 코멘트와 함께 승인
  - 6c. 메이저 이슈: 변경 요청
- **Exception Flows**:
  - E1. 분석 실패: 수동 리뷰 요청
- **Postconditions**:
  1. PR에 리뷰가 추가됨
  2. 리뷰 결과가 기록됨

#### 3.10.2 Acceptance Criteria

- [ ] AC-039: PR 본문에 변경 요약, 테스트 결과, 이슈 링크 포함
- [ ] AC-040: 보안 취약점 검사 실행
- [ ] AC-041: 코드 커버리지 ≥80% 검증
- [ ] AC-042: 복잡도 점수 ≤10 검증
- [ ] AC-043: Approve/Request Changes 결정

#### 3.10.3 Dependencies

- **Depends on**: SF-009
- **Blocks**: SF-011

---

### SF-011: Quality Gate and Merge Decision

**Source**: FR-008
**Priority**: P0
**Description**: 품질 게이트를 통과한 PR에 대해 최종 머지 결정을 수행합니다.

#### 3.11.1 Use Cases

##### UC-016: 머지 결정

- **Actor**: System (PR Review Agent)
- **Preconditions**:
  1. PR 리뷰가 완료됨
  2. 모든 필수 검사가 통과함
- **Main Flow**:
  1. 시스템이 품질 게이트 결과를 확인함
  2. 모든 필수 조건 충족 시:
     - 테스트 통과: true
     - 빌드 통과: true
     - 치명적 이슈 없음: true
     - 커버리지 ≥80%: true
  3. 시스템이 squash 머지를 수행함 (설정된 전략)
  4. 시스템이 피처 브랜치를 삭제함
  5. 시스템이 관련 이슈를 Close 처리함
- **Alternative Flows**:
  - 2a. 권장 조건만 미충족: 코멘트와 함께 머지
  - 2b. 필수 조건 미충족: 머지 거부 및 피드백
- **Exception Flows**:
  - E1. 머지 충돌: 충돌 해결 안내
- **Postconditions**:
  1. PR이 머지됨 또는 거부됨
  2. 이슈가 Close됨 (머지 시)

#### 3.11.2 Acceptance Criteria

- [ ] AC-044: 필수 품질 게이트 4개 모두 통과 확인
- [ ] AC-045: Squash 머지 전략 적용
- [ ] AC-046: 머지 후 브랜치 자동 삭제
- [ ] AC-047: 관련 이슈 자동 Close

#### 3.11.3 Dependencies

- **Depends on**: SF-010
- **Blocks**: None (End Point)

---

### SF-012: Traceability Matrix Management

**Source**: FR-009
**Priority**: P1
**Description**: 전체 파이프라인에 걸쳐 요구사항-설계-구현 간의 추적성을 유지합니다.

#### 3.12.1 Use Cases

##### UC-017: 추적성 매트릭스 생성

- **Actor**: System (All Document Agents)
- **Preconditions**:
  1. 최소 하나의 문서(PRD, SRS, SDS)가 존재함
- **Main Flow**:
  1. 시스템이 문서 생성 시 소스 참조를 자동 삽입함
  2. SRS 생성 시: FR → SF 매핑
  3. SDS 생성 시: SF → CMP 매핑
  4. Issue 생성 시: CMP → Issue 매핑
  5. PR 생성 시: Issue → PR 매핑
  6. 시스템이 전체 추적성 매트릭스를 갱신함
- **Postconditions**:
  1. 양방향 추적 가능한 매트릭스가 유지됨

##### UC-018: 역추적 조회

- **Actor**: Tech Lead, Developer
- **Preconditions**:
  1. 추적성 매트릭스가 존재함
- **Main Flow**:
  1. 사용자가 특정 PR/Issue/Component를 지정함
  2. 시스템이 역방향으로 원본 요구사항을 추적함
  3. 시스템이 전체 추적 경로를 표시함

#### 3.12.2 Acceptance Criteria

- [ ] AC-048: PRD → SRS 100% 커버리지
- [ ] AC-049: SRS → SDS 100% 커버리지
- [ ] AC-050: SDS → Issue 100% 커버리지
- [ ] AC-051: 역추적 조회 지원

#### 3.12.3 Dependencies

- **Depends on**: SF-001 ~ SF-011
- **Blocks**: None

---

### SF-013: Approval Gate System

**Source**: FR-010
**Priority**: P1
**Description**: 각 단계별 사용자 승인 게이트를 구현하여 Human-in-the-Loop 패턴을 적용합니다.

#### 3.13.1 Use Cases

##### UC-019: 단계별 승인 요청

- **Actor**: System, All Users
- **Preconditions**:
  1. 해당 단계의 산출물이 생성됨
  2. 승인 게이트가 활성화되어 있음 (설정)
- **Main Flow**:
  1. 시스템이 산출물 생성 완료를 감지함
  2. 시스템이 사용자에게 승인 요청을 표시함
  3. 사용자가 산출물을 검토함
  4. 사용자가 승인(Approve) 또는 거부(Reject)를 선택함
  5. 승인 시: 다음 단계로 진행
  6. 거부 시: 피드백 수집 및 재생성
- **Alternative Flows**:
  - 4a. 수정 요청: 특정 부분에 대한 피드백 제공
- **Postconditions**:
  1. 승인 상태가 기록됨

#### 3.13.2 Acceptance Criteria

- [ ] AC-052: Collection/PRD/SRS/SDS/Issue 단계별 승인 게이트
- [ ] AC-053: 승인/거부/수정요청 옵션
- [ ] AC-054: 거부 시 피드백 수집
- [ ] AC-055: 승인 게이트 ON/OFF 설정 가능

#### 3.13.3 Dependencies

- **Depends on**: SF-001 ~ SF-005
- **Blocks**: Subsequent stages

---

### SF-014: Scratchpad State Management

**Source**: FR-015
**Priority**: P0
**Description**: 파일 시스템 기반 Scratchpad 패턴으로 에이전트 간 상태를 공유합니다.

#### 3.14.1 Use Cases

##### UC-020: 상태 저장

- **Actor**: System (All Agents)
- **Preconditions**:
  1. Scratchpad 디렉토리가 초기화됨
- **Main Flow**:
  1. 에이전트가 작업 결과를 생성함
  2. 에이전트가 결과를 약속된 경로에 저장함
  3. 에이전트가 상태 변경을 로깅함
- **Postconditions**:
  1. 상태가 파일로 영속화됨

##### UC-021: 상태 읽기

- **Actor**: System (All Agents)
- **Preconditions**:
  1. 이전 에이전트의 출력이 존재함
- **Main Flow**:
  1. 에이전트가 입력 경로에서 상태를 읽음
  2. 에이전트가 상태 유효성을 검증함
  3. 에이전트가 상태를 기반으로 작업을 수행함
- **Exception Flows**:
  - E1. 파일 없음: 대기 또는 오류 보고
  - E2. 스키마 불일치: 마이그레이션 또는 오류 보고

#### 3.14.2 Acceptance Criteria

- [ ] AC-056: YAML/JSON/Markdown 형식 지원
- [ ] AC-057: 스키마 검증
- [ ] AC-058: 상태 변경 로깅
- [ ] AC-059: 동시 접근 안전성 (단일 Writer)

#### 3.14.3 Dependencies

- **Depends on**: None
- **Blocks**: All features

---

### SF-015: Activity Logging and Audit

**Source**: FR-013
**Priority**: P1
**Description**: 모든 에이전트 활동을 로깅하고 감사 추적을 지원합니다.

#### 3.15.1 Use Cases

##### UC-022: 활동 로깅

- **Actor**: System (All Agents)
- **Preconditions**:
  1. 로깅 설정이 활성화됨
- **Main Flow**:
  1. 에이전트가 작업을 시작/완료/실패할 때 로그 기록
  2. 로그에 타임스탬프, 에이전트 ID, 단계, 상태 포함
  3. 로그가 설정된 출력(파일, 콘솔)으로 전송됨
- **Postconditions**:
  1. 모든 활동이 로그로 기록됨

##### UC-023: 감사 추적 조회

- **Actor**: Tech Lead, Auditor
- **Preconditions**:
  1. 로그 파일이 존재함
- **Main Flow**:
  1. 사용자가 특정 기간/에이전트/상태로 필터링 요청
  2. 시스템이 로그를 검색하여 결과 반환
- **Postconditions**:
  1. 필터링된 로그가 표시됨

#### 3.15.2 Acceptance Criteria

- [ ] AC-060: JSON 형식 구조화 로깅
- [ ] AC-061: 로그 레벨(DEBUG/INFO/WARN/ERROR) 지원
- [ ] AC-062: 로그 파일 로테이션 (10MB, 5개)
- [ ] AC-063: 에이전트별 필터링 지원

#### 3.15.3 Dependencies

- **Depends on**: None
- **Blocks**: None

---

### SF-016: Error Handling and Retry

**Source**: FR-012
**Priority**: P1
**Description**: 에이전트 실행 중 오류 발생 시 자동 재시도 및 복구를 수행합니다.

#### 3.16.1 Use Cases

##### UC-024: 자동 재시도

- **Actor**: System (Worker, PR Review Agents)
- **Preconditions**:
  1. 작업 실행 중 오류 발생
  2. 재시도 가능한 오류 유형
- **Main Flow**:
  1. 시스템이 오류를 감지함
  2. 시스템이 재시도 정책을 확인함 (최대 3회, 지수 백오프)
  3. 시스템이 대기 시간(5s → 10s → 20s)을 적용함
  4. 시스템이 작업을 재실행함
  5. 성공 시: 정상 플로우 계속
  6. 실패 시: 다음 재시도 또는 최종 실패 보고
- **Alternative Flows**:
  - 2a. 재시도 불가 오류: 즉시 실패 보고
- **Exception Flows**:
  - E1. 최대 재시도 초과: Circuit Breaker 발동
- **Postconditions**:
  1. 작업이 완료되거나 최종 실패 상태

#### 3.16.2 Acceptance Criteria

- [ ] AC-064: 최대 3회 재시도
- [ ] AC-065: 지수 백오프 (base 5s, max 60s)
- [ ] AC-066: Circuit Breaker (5회 연속 실패 시 60s 대기)
- [ ] AC-067: 재시도 불가 오류 분류

#### 3.16.3 Dependencies

- **Depends on**: None
- **Blocks**: None

---

### 3.17 Enhancement Pipeline Features

> 아래 기능(SF-017~SF-031)은 FR-017~FR-033에서 정의된 Enhancement Pipeline,
> 인프라, 파이프라인 요구사항을 지원합니다.
> 이 기능들은 기존 프로젝트에 대한 증분 업데이트, 코드베이스 분석,
> 변경 영향 평가, 자동화된 파이프라인 오케스트레이션을 가능하게 합니다.

---

### SF-017: Document Parsing and State Extraction

**Source**: FR-017
**Priority**: P0
**Description**: 기존 PRD, SRS, SDS 문서를 파싱하여 요구사항 ID, 기능 매핑, 컴포넌트 정의, 현재 추적성 관계를 포함한 구조화된 상태를 추출합니다. 하위 Enhancement 기능에서 사용할 내부 표현을 구축합니다.

#### 3.17.1 Use Cases

##### UC-025: 기존 PRD/SRS/SDS 문서 파싱

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. 프로젝트에 기존 문서(PRD, SRS 또는 SDS)가 하나 이상 존재함
  2. 문서가 표준 AD-SDLC 템플릿 구조를 따름
- **Main Flow**:
  1. 시스템이 문서 디렉토리에서 기존 PRD, SRS, SDS 파일을 스캔함
  2. 시스템이 각 문서에서 섹션, ID, 구조화된 콘텐츠를 파싱하여 추출함
  3. 시스템이 추출된 데이터를 예상 스키마(FR-XXX, SF-XXX, CMP-XXX)에 대해 검증함
  4. 시스템이 파싱된 상태를 Scratchpad 내 `document_state.yaml`에 저장함
- **Alternative Flows**:
  - 2a. 비표준 문서 형식: 경고와 함께 최선의 추출 시도
- **Exception Flows**:
  - E1. 문서 파싱 실패: 오류 상세 정보를 로깅하고 파싱 불가 섹션을 보고
- **Postconditions**:
  1. `document_state.yaml`에 모든 파싱된 문서의 구조화된 표현이 포함됨
  2. 모든 요구사항 ID, 기능 ID, 컴포넌트 ID가 카탈로그화됨

##### UC-026: 파싱된 문서로부터 추적성 매핑 구축

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. 파싱된 문서 콘텐츠가 포함된 `document_state.yaml`이 존재함
- **Main Flow**:
  1. 시스템이 SRS 추적성 섹션에서 FR → SF 매핑을 추출함
  2. 시스템이 SDS 추적성 섹션에서 SF → CMP 매핑을 추출함
  3. 시스템이 고아(orphaned) 또는 미매핑 항목을 식별함
  4. 시스템이 완전한 매핑이 포함된 `existing_traceability.json`을 생성함
- **Alternative Flows**:
  - 3a. 고아 항목 없음: 추적성을 완전한 것으로 표시
- **Postconditions**:
  1. `existing_traceability.json`이 Scratchpad에 저장됨
  2. 커버리지 갭이 식별되어 보고됨

#### 3.17.2 Acceptance Criteria

- [ ] AC-068: PRD 문서에서 모든 FR-XXX 식별자 및 메타데이터를 파싱
- [ ] AC-069: SRS 문서에서 모든 SF-XXX 및 UC-XXX 식별자를 파싱
- [ ] AC-070: SDS 문서에서 모든 CMP-XXX 및 API-XXX 식별자를 파싱
- [ ] AC-071: 스키마에 부합하는 유효한 `document_state.yaml` 생성
- [ ] AC-072: 완전한 FR→SF→CMP 추적성 매핑 구축

#### 3.17.3 Dependencies

- **Depends on**: SF-014 (Scratchpad State Management)
- **Blocks**: SF-019, SF-020, SF-021, SF-022, SF-024

---

### SF-018: Codebase Structure Analysis

**Source**: FR-018
**Priority**: P0
**Description**: 기존 소스 코드를 분석하여 아키텍처 패턴, 모듈 구조, 의존성 관계, 코딩 컨벤션을 추출합니다. 변경 영향 분석 및 증분 문서 업데이트에 사용되는 구조화된 개요를 생성합니다.

#### 3.18.1 Use Cases

##### UC-027: 소스 코드 아키텍처 및 패턴 분석

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. 프로젝트 소스 코드 디렉토리가 존재함
  2. SF-025 (AST 분석)를 상세 추출에 활용 가능함
- **Main Flow**:
  1. 시스템이 프로젝트 디렉토리 트리를 스캔하고 언어별 소스 파일을 식별함
  2. 시스템이 프레임워크 및 빌드 도구 관례를 감지함 (예: package.json, pyproject.toml)
  3. 시스템이 아키텍처 패턴을 식별함 (레이어드, 모듈러, 마이크로서비스)
  4. 시스템이 코딩 컨벤션을 기록함 (네이밍, 구조, 사용 중인 패턴)
  5. 시스템이 `codebase_overview.yaml`을 Scratchpad에 저장함
- **Alternative Flows**:
  - 1a. 빈 코드베이스 또는 최소 코드베이스: 그린필드 호환 상태로 기록
- **Exception Flows**:
  - E1. 인식할 수 없는 프로젝트 구조: 경고를 로깅하고 부분 분석 결과를 생성
- **Postconditions**:
  1. `codebase_overview.yaml`에 프로젝트 구조 및 패턴 분석이 포함됨

##### UC-028: 아키텍처 개요 및 의존성 그래프 생성

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. UC-027의 소스 코드 분석이 완료됨
- **Main Flow**:
  1. 시스템이 모듈 간 임포트 및 의존성 관계를 매핑함
  2. 시스템이 외부 라이브러리 의존성과 버전을 식별함
  3. 시스템이 `codebase_dependencies.json`으로 의존성 그래프를 생성함
  4. 시스템이 사람이 읽을 수 있는 아키텍처 요약을 생성함
- **Alternative Flows**:
  - 1a. 순환 의존성 발견: 플래그를 지정하고 보고서에 포함
- **Postconditions**:
  1. `codebase_dependencies.json`이 Scratchpad에 저장됨
  2. 하위 기능에서 사용할 아키텍처 요약이 준비됨

#### 3.18.2 Acceptance Criteria

- [ ] AC-073: 주요 프로그래밍 언어 및 프레임워크 감지
- [ ] AC-074: 코드베이스에서 최소 1개의 아키텍처 패턴 식별
- [ ] AC-075: JSON 형식의 모듈 의존성 그래프 생성
- [ ] AC-076: 구조 및 컨벤션이 포함된 `codebase_overview.yaml` 생성

#### 3.18.3 Dependencies

- **Depends on**: SF-025 (Source Code AST Analysis)
- **Blocks**: SF-019

---

### SF-019: Change Impact Analysis

**Source**: FR-019
**Priority**: P0
**Description**: 기존 문서 및 코드베이스에 대한 제안된 변경의 범위를 분석하여 영향을 받는 컴포넌트, 위험 수준, 권장 조치를 결정합니다. 증분 업데이트 적용 전 정보에 기반한 의사결정을 가능하게 합니다.

#### 3.19.1 Use Cases

##### UC-029: 변경 범위 및 영향 받는 컴포넌트 분석

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. SF-017의 문서 상태가 사용 가능함
  2. SF-018의 코드베이스 분석이 사용 가능함
  3. 변경 요청 또는 신규 요구사항이 제공됨
- **Main Flow**:
  1. 시스템이 신규/변경된 요구사항을 기존 문서 상태와 비교함
  2. 시스템이 추적성 매핑을 통해 영향 받는 기능, 컴포넌트, 코드 모듈을 추적함
  3. 시스템이 직접 영향 항목과 전이적 영향 항목을 식별함
  4. 시스템이 변경을 추가, 수정 또는 폐기로 분류함
  5. 시스템이 `impact_analysis.yaml`을 Scratchpad에 저장함
- **Alternative Flows**:
  - 2a. 추적성 데이터 없음: 텍스트 기반 유사도 매칭 수행
- **Postconditions**:
  1. `impact_analysis.yaml`에 전체 변경 범위와 영향 항목 목록이 포함됨

##### UC-030: 위험 수준 평가 및 권장 사항 생성

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. `impact_analysis.yaml`이 존재함
- **Main Flow**:
  1. 시스템이 변경 복잡도와 의존성 수로 각 영향 컴포넌트를 점수화함
  2. 시스템이 위험 수준(Low / Medium / High / Critical)을 할당함
  3. 시스템이 업데이트 순서에 대한 우선순위화된 권장 사항을 생성함
  4. 시스템이 위험 평가를 `impact_analysis.yaml`에 추가함
- **Alternative Flows**:
  - 1a. 모든 변경이 기존 의존성 없는 추가인 경우: Low 위험 할당
- **Postconditions**:
  1. 위험 수준과 권장 사항이 `impact_analysis.yaml`에 기록됨

#### 3.19.2 Acceptance Criteria

- [ ] AC-077: 직접 영향 받는 모든 문서, 기능, 컴포넌트 식별
- [ ] AC-078: 추적성 체인을 통한 전이적 영향 추적
- [ ] AC-079: 각 영향 항목에 위험 수준(Low/Medium/High/Critical) 할당
- [ ] AC-080: 업데이트 순서에 대한 정렬된 권장 목록 생성

#### 3.19.3 Dependencies

- **Depends on**: SF-017, SF-018
- **Blocks**: SF-020, SF-021, SF-022

---

### SF-020: PRD Incremental Update

**Source**: FR-020
**Priority**: P0
**Description**: 기존 PRD에서 기능 요구사항의 추가, 수정 또는 폐기를 지원하며 문서 구조, 기존 콘텐츠, ID 연속성을 보존합니다.

#### 3.20.1 Use Cases

##### UC-031: 요구사항 추가, 수정 또는 폐기

- **Actor**: System (PRD Writer Agent), Product Manager
- **Preconditions**:
  1. 기존 PRD가 파싱됨 (SF-017)
  2. 영향 분석이 완료됨 (SF-019)
  3. 신규 또는 변경된 요구사항이 명시됨
- **Main Flow**:
  1. 시스템이 기존 PRD와 파싱된 문서 상태를 로드함
  2. 시스템이 추가를 적용함 (다음 사용 가능한 ID로 새 FR-XXX 항목)
  3. 시스템이 수정을 적용함 (기존 FR의 설명, 우선순위 또는 범위 업데이트)
  4. 시스템이 폐기된 요구사항에 `[DEPRECATED]` 태그와 사유를 표시함
  5. 시스템이 변경되지 않은 콘텐츠를 보존하면서 영향 받는 섹션을 재생성함
  6. 시스템이 업데이트된 PRD를 저장하고 사용자 승인을 요청함
- **Alternative Flows**:
  - 4a. 폐기가 하위 SRS/SDS에 영향: 연쇄 경고 포함
- **Exception Flows**:
  - E1. ID 충돌 감지: 다음 사용 가능한 ID를 사용하여 해결하고 로깅
- **Postconditions**:
  1. 신규, 수정, 폐기된 요구사항이 반영된 업데이트된 PRD가 저장됨
  2. PRD에 변경 로그 항목이 추가됨

#### 3.20.2 Acceptance Criteria

- [ ] AC-081: 순차적 FR-XXX ID로 새 요구사항 추가
- [ ] AC-082: ID를 보존하면서 기존 요구사항 수정
- [ ] AC-083: 태그와 사유로 폐기된 요구사항 표시
- [ ] AC-084: 문서의 변경되지 않은 모든 섹션 보존
- [ ] AC-085: 변경 확정 전 사용자 승인 필수

#### 3.20.3 Dependencies

- **Depends on**: SF-017, SF-019
- **Blocks**: SF-021

---

### SF-021: SRS Incremental Update

**Source**: FR-021
**Priority**: P0
**Description**: PRD 변경을 반영하여 기존 SRS의 기능과 유스케이스를 업데이트하며 PRD→SRS 추적성을 유지하고 변경에 영향받지 않는 기존 콘텐츠를 보존합니다.

#### 3.21.1 Use Cases

##### UC-032: PRD→SRS 추적성을 유지하며 기능 및 유스케이스 업데이트

- **Actor**: System (SRS Writer Agent)
- **Preconditions**:
  1. 업데이트된 PRD가 승인됨
  2. 기존 SRS가 파싱됨 (SF-017)
  3. 영향 분석에서 영향 받는 SRS 섹션이 식별됨 (SF-019)
- **Main Flow**:
  1. 시스템이 기존 SRS와 추적성 매핑을 로드함
  2. 시스템이 새로운 PRD 요구사항에 대해 새 SF-XXX 기능을 추가함
  3. 시스템이 새 기능에 대해 새 UC-XXX 유스케이스를 생성함
  4. 시스템이 수정된 요구사항에 의해 영향 받는 기존 기능/유스케이스를 업데이트함
  5. 시스템이 폐기된 요구사항에 연결된 기능/유스케이스를 표시함
  6. 시스템이 PRD→SRS 추적성 매트릭스 섹션을 재생성함
  7. 시스템이 업데이트된 SRS를 저장함
- **Alternative Flows**:
  - 5a. 폐기된 기능에 남은 참조 없음: `[DEPRECATED]`로 표시
- **Exception Flows**:
  - E1. 추적성 체인 단절: 누락된 링크를 보고하고 해결 요청
- **Postconditions**:
  1. 업데이트된 SRS가 활성 PRD 요구사항의 100% 커버리지를 유지
  2. PRD→SRS 추적성 매트릭스가 최신 상태

#### 3.21.2 Acceptance Criteria

- [ ] AC-086: 순차적 SF-XXX ID로 새 기능 추가
- [ ] AC-087: 각 새 기능에 대한 유스케이스 생성
- [ ] AC-088: 모든 변경을 반영하여 추적성 매트릭스 업데이트
- [ ] AC-089: 영향받지 않는 기능 및 유스케이스 보존
- [ ] AC-090: 활성 PRD 요구사항의 100% 커버리지 유지

#### 3.21.3 Dependencies

- **Depends on**: SF-017, SF-019, SF-020
- **Blocks**: SF-022

---

### SF-022: SDS Incremental Update

**Source**: FR-022
**Priority**: P0
**Description**: SRS 변경을 반영하여 기존 SDS의 컴포넌트와 API를 업데이트하며 SRS→SDS 추적성을 유지하고 변경되지 않은 설계 요소를 보존합니다.

#### 3.22.1 Use Cases

##### UC-033: SRS→SDS 추적성을 유지하며 컴포넌트 및 API 업데이트

- **Actor**: System (SDS Writer Agent)
- **Preconditions**:
  1. 업데이트된 SRS가 승인됨
  2. 기존 SDS가 파싱됨 (SF-017)
  3. 영향 분석에서 영향 받는 SDS 섹션이 식별됨 (SF-019)
- **Main Flow**:
  1. 시스템이 기존 SDS와 추적성 매핑을 로드함
  2. 시스템이 새로운 SRS 기능에 대해 새 CMP-XXX 컴포넌트를 추가함
  3. 시스템이 변경에 영향 받는 API 엔드포인트를 설계하거나 업데이트함
  4. 시스템이 필요에 따라 데이터 모델과 스키마를 업데이트함
  5. 시스템이 SRS→SDS 추적성 매트릭스 섹션을 재생성함
  6. 시스템이 업데이트된 SDS를 저장함
- **Alternative Flows**:
  - 2a. 새 기능이 기존 컴포넌트에 매핑되는 경우: 새 컴포넌트 생성 대신 기존 컴포넌트 확장
- **Exception Flows**:
  - E1. 아키텍처 충돌: 사용자에게 해결 옵션 제시
- **Postconditions**:
  1. 업데이트된 SDS가 활성 SRS 기능의 100% 커버리지를 유지
  2. SRS→SDS 추적성 매트릭스가 최신 상태

#### 3.22.2 Acceptance Criteria

- [ ] AC-091: 순차적 CMP-XXX ID로 새 컴포넌트 추가
- [ ] AC-092: 변경된 기능에 대한 API 명세 업데이트
- [ ] AC-093: 모든 변경을 반영하여 추적성 매트릭스 업데이트
- [ ] AC-094: 영향받지 않는 컴포넌트 및 API 보존
- [ ] AC-095: 활성 SRS 기능의 100% 커버리지 유지

#### 3.22.3 Dependencies

- **Depends on**: SF-017, SF-019, SF-021
- **Blocks**: SF-005 (Issue Auto-Generation)

---

### SF-023: Regression Testing

**Source**: FR-023
**Priority**: P1
**Description**: 변경 영향 분석을 기반으로 영향 받는 테스트를 매핑하고, 변경이 기존 기능을 손상시키지 않는지 검증하기 위해 회귀 테스트 스위트의 실행을 조율합니다.

#### 3.23.1 Use Cases

##### UC-034: 영향 받는 테스트 매핑 및 회귀 스위트 실행

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. 영향 분석이 완료됨 (SF-019)
  2. 프로젝트에 테스트 스위트가 존재함
  3. 영향 받는 컴포넌트 및 코드 모듈이 식별됨
- **Main Flow**:
  1. 시스템이 영향 받는 컴포넌트와 연관된 테스트 파일을 식별함
  2. 시스템이 최소 회귀 테스트 세트를 결정함
  3. 시스템이 회귀 테스트 스위트를 실행함
  4. 시스템이 테스트 결과 및 커버리지 데이터를 수집함
  5. 시스템이 통과/실패 요약이 포함된 `regression_report.yaml`을 생성함
- **Alternative Flows**:
  - 1a. 영향 받는 컴포넌트에 대한 테스트 없음: 커버리지 갭 보고
  - 3a. 전체 회귀 테스트 요청: 전체 테스트 스위트 실행
- **Exception Flows**:
  - E1. 테스트 실행 환경 불가: 설정 요구사항 보고
- **Postconditions**:
  1. `regression_report.yaml`이 Scratchpad에 저장됨
  2. 테스트 실패가 진행 전 해결 필요 항목으로 플래그됨

#### 3.23.2 Acceptance Criteria

- [ ] AC-096: 영향 받는 컴포넌트에 테스트 파일 매핑
- [ ] AC-097: 대상 회귀 테스트 세트 실행
- [ ] AC-098: 커버리지 메트릭과 함께 통과/실패 결과 보고
- [ ] AC-099: 회귀 발견 시 파이프라인 진행 차단 항목으로 플래그

#### 3.23.3 Dependencies

- **Depends on**: SF-019
- **Blocks**: None

---

### SF-024: Document-Code Gap Analysis

**Source**: FR-024
**Priority**: P1
**Description**: 문서 명세(PRD, SRS, SDS)와 실제 구현을 비교하여 불일치, 미구현 기능, 문서화되지 않은 코드, 명세 드리프트를 식별합니다.

#### 3.24.1 Use Cases

##### UC-035: 문서 명세와 구현 비교

- **Actor**: System (Enhancement Pipeline), Tech Lead
- **Preconditions**:
  1. 파싱된 문서 상태가 존재함 (SF-017)
  2. 코드베이스 분석이 완료됨 (SF-018)
- **Main Flow**:
  1. 시스템이 SDS 컴포넌트를 실제 소스 코드 모듈에 매핑함
  2. 시스템이 명세되었지만 미구현된 기능을 식별함
  3. 시스템이 구현되었지만 문서화되지 않은 기능을 식별함
  4. 시스템이 명세 드리프트(구현이 명세에서 벗어남)를 감지함
  5. 시스템이 분류된 발견 사항이 포함된 `gap_analysis_report.yaml`을 생성함
- **Alternative Flows**:
  - 2a. 모든 기능 구현됨: 전체 구현 커버리지 보고
  - 3a. 문서화되지 않은 코드 없음: 문서 완전성 보고
- **Postconditions**:
  1. `gap_analysis_report.yaml`이 Scratchpad에 저장됨
  2. 갭이 심각도와 유형별로 분류됨

#### 3.24.2 Acceptance Criteria

- [ ] AC-100: SDS 명세에서 미구현 기능 식별
- [ ] AC-101: 어떤 명세에도 추적되지 않는 문서화되지 않은 코드 식별
- [ ] AC-102: 문서와 코드 간 명세 드리프트 감지
- [ ] AC-103: 심각도 수준이 포함된 분류별 갭 보고서 생성

#### 3.24.3 Dependencies

- **Depends on**: SF-017, SF-018
- **Blocks**: None

---

### SF-025: Source Code AST Analysis

**Source**: FR-025
**Priority**: P0
**Description**: 소스 코드에 대한 추상 구문 트리(AST) 분석을 수행하여 클래스, 함수, 인터페이스, 타입 정의, 의존성 관계를 추출합니다. 코드베이스 분석 및 갭 분석 기능에서 사용하는 구조적 기반을 제공합니다.

#### 3.25.1 Use Cases

##### UC-036: 소스 코드에서 클래스, 함수, 인터페이스 및 의존성 추출

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. 프로젝트 소스 코드가 존재함
  2. 프로그래밍 언어가 지원됨 (TypeScript, JavaScript, Python 등)
- **Main Flow**:
  1. 시스템이 소스 파일과 해당 언어를 식별함
  2. 시스템이 각 파일을 파싱하여 AST 수준 구조(클래스, 함수, 인터페이스, 타입)를 추출함
  3. 시스템이 모듈 간 import/export 관계를 해석함
  4. 시스템이 위치 메타데이터가 포함된 구조화된 심볼 테이블을 구축함
  5. 시스템이 `ast_analysis.json`을 Scratchpad에 저장함
- **Alternative Flows**:
  - 2a. 지원하지 않는 언어: 정확도가 낮은 정규식 기반 추출로 폴백
- **Exception Flows**:
  - E1. 소스의 구문 오류: 오류를 로깅하고 파싱 가능한 파일로 계속 진행
- **Postconditions**:
  1. `ast_analysis.json`에 모든 추출된 심볼과 관계가 포함됨
  2. 각 심볼에 파일 경로, 줄 번호, 타입 정보가 포함됨

#### 3.25.2 Acceptance Criteria

- [ ] AC-104: TypeScript/JavaScript 파일에서 클래스, 함수, 인터페이스 추출
- [ ] AC-105: Python 파일에서 클래스, 함수, 타입 힌트 추출
- [ ] AC-106: import/export 의존성 관계 해석
- [ ] AC-107: 위치 메타데이터가 포함된 구조화된 `ast_analysis.json` 생성

#### 3.25.3 Dependencies

- **Depends on**: None
- **Blocks**: SF-018

---

### SF-026: CI/CD Failure Auto-fix

**Source**: FR-026
**Priority**: P1
**Description**: 오류 로그를 분석하여 CI/CD 파이프라인 실패를 진단하고 근본 원인을 식별하며 가능한 경우 자동 수정을 적용합니다. 파이프라인이 통과하거나 최대 시도 횟수에 도달할 때까지 반복적 재시도를 지원합니다.

#### 3.26.1 Use Cases

##### UC-037: CI 실패 진단 및 자동 수정 적용

- **Actor**: System (Worker Agent)
- **Preconditions**:
  1. CI/CD 파이프라인이 실패를 보고함
  2. 오류 로그에 접근 가능함
- **Main Flow**:
  1. 시스템이 CI 실패 로그와 오류 출력을 가져옴
  2. 시스템이 실패 유형을 분류함 (빌드, 테스트, 린트, 타입 검사, 의존성)
  3. 시스템이 근본 원인과 영향 받는 파일을 식별함
  4. 시스템이 수정을 생성하여 적용함 (코드 변경, 설정 업데이트, 의존성 해결)
  5. 시스템이 수정을 커밋하고 CI 파이프라인을 재트리거함
- **Alternative Flows**:
  - 4a. 수동 개입 필요: 진단 및 제안 수정을 사용자에게 보고
- **Exception Flows**:
  - E1. 최대 3회 자동 수정 시도 초과: 전체 진단과 함께 사용자에게 에스컬레이션
- **Postconditions**:
  1. CI 파이프라인이 통과하거나, 진단 상세 정보와 함께 사용자에게 통보됨

#### 3.26.2 Acceptance Criteria

- [ ] AC-108: CI 실패 로그 가져오기 및 파싱
- [ ] AC-109: 최소 90% 정확도로 실패 유형 분류
- [ ] AC-110: 일반적인 실패 패턴(린트, 타입 오류, 누락된 의존성)에 대한 자동 수정 적용
- [ ] AC-111: 에스컬레이션 전 최대 3회 자동 수정 재시도

#### 3.26.3 Dependencies

- **Depends on**: SF-009 (Self-Verification and Testing)
- **Blocks**: None

---

### SF-027: Pipeline Mode Detection

**Source**: FR-027
**Priority**: P0
**Description**: 기존 문서, 소스 코드, AD-SDLC 설정의 존재 여부를 기반으로 프로젝트가 Greenfield 모드(신규 프로젝트) 또는 Enhancement 모드(기존 프로젝트)를 사용해야 하는지 자동으로 감지합니다.

#### 3.27.1 Use Cases

##### UC-038: 프로젝트 상태로부터 Greenfield/Enhancement 모드 자동 감지

- **Actor**: System (Pipeline Orchestrator)
- **Preconditions**:
  1. 프로젝트 디렉토리에 접근 가능함
- **Main Flow**:
  1. 시스템이 `.ad-sdlc/` 디렉토리 및 설정 파일의 존재를 확인함
  2. 시스템이 기존 PRD, SRS, SDS 문서의 존재를 확인함
  3. 시스템이 기존 소스 코드의 존재를 확인함
  4. 시스템이 감지 규칙을 적용함:
     - 문서 없음 + 코드 없음 = Greenfield
     - 문서 존재 또는 코드 존재 = Enhancement
  5. 시스템이 감지된 모드를 `pipeline_config.yaml`에 기록함
- **Alternative Flows**:
  - 4a. 모호한 상태: 사용자에게 모드 선택 확인 요청
- **Postconditions**:
  1. 파이프라인 모드(Greenfield 또는 Enhancement)가 결정되어 기록됨

#### 3.27.2 Acceptance Criteria

- [ ] AC-112: 빈 프로젝트에 대한 Greenfield 모드 감지
- [ ] AC-113: 문서 또는 코드가 존재할 때 Enhancement 모드 감지
- [ ] AC-114: 감지된 모드에 대한 사용자 오버라이드 허용
- [ ] AC-115: `pipeline_config.yaml`에 모드 기록

#### 3.27.3 Dependencies

- **Depends on**: None
- **Blocks**: SF-030

---

### SF-028: Project Initialization

**Source**: FR-028
**Priority**: P0
**Description**: AD-SDLC 시스템 운영에 필요한 `.ad-sdlc/` 디렉토리 구조와 초기 설정 파일을 생성합니다. Scratchpad 디렉토리, 템플릿, 기본 설정을 초기화합니다.

#### 3.28.1 Use Cases

##### UC-039: .ad-sdlc 디렉토리 구조 및 설정 파일 생성

- **Actor**: System (Pipeline Orchestrator), User
- **Preconditions**:
  1. 프로젝트 디렉토리가 존재함
  2. `.ad-sdlc/` 디렉토리가 아직 존재하지 않음 (또는 재초기화가 요청됨)
- **Main Flow**:
  1. 시스템이 `.ad-sdlc/` 루트 디렉토리를 생성함
  2. 시스템이 하위 디렉토리를 생성함: `scratchpad/`, `templates/`, `config/`
  3. 시스템이 파이프라인 설정이 포함된 기본 `config.yaml`을 생성함
  4. 시스템이 문서 템플릿(PRD, SRS, SDS)을 `templates/`에 복사함
  5. 시스템이 Scratchpad 하위 디렉토리(info, documents, issues, progress)를 초기화함
- **Alternative Flows**:
  - 2a. 디렉토리가 이미 존재: 재초기화 확인 또는 건너뛰기 요청
- **Exception Flows**:
  - E1. 권한 거부: 파일 시스템 권한 오류 보고
- **Postconditions**:
  1. `.ad-sdlc/` 디렉토리 구조가 완전히 초기화됨
  2. 기본 설정 및 템플릿이 배치됨

#### 3.28.2 Acceptance Criteria

- [ ] AC-116: 완전한 `.ad-sdlc/` 디렉토리 계층 생성
- [ ] AC-117: 유효한 기본 `config.yaml` 생성
- [ ] AC-118: 모든 필수 문서 템플릿 포함
- [ ] AC-119: 멱등성 실행 (여러 번 실행해도 안전)

#### 3.28.3 Dependencies

- **Depends on**: None
- **Blocks**: SF-027, SF-014

---

### SF-029: GitHub Repository Management

**Source**: FR-029, FR-030
**Priority**: P1
**Description**: 새 프로젝트를 위한 GitHub 저장소를 생성 및 초기화하고, Enhancement 워크플로우를 위해 기존 저장소 존재를 감지합니다. README, .gitignore, 초기 커밋을 포함한 저장소 설정을 처리합니다.

#### 3.29.1 Use Cases

##### UC-040: GitHub 저장소 생성 및 초기화

- **Actor**: System (Pipeline Orchestrator), User
- **Preconditions**:
  1. GitHub CLI가 인증되어 있음
  2. 저장소 이름이 지정됨
  3. 동일한 이름의 기존 저장소가 없음
- **Main Flow**:
  1. 시스템이 `gh repo create`를 사용하여 새 GitHub 저장소를 생성함
  2. 시스템이 README.md와 .gitignore로 초기화함
  3. 시스템이 프로젝트 스캐폴드로 초기 커밋을 생성함
  4. 시스템이 초기 커밋을 원격에 푸시함
  5. 시스템이 저장소 URL을 `pipeline_config.yaml`에 기록함
- **Alternative Flows**:
  - 1a. 비공개 저장소 요청: `--private` 플래그 추가
- **Exception Flows**:
  - E1. 저장소 이름 충돌: 대체 이름 제안 또는 사용자에게 요청
  - E2. 인증 실패: `gh auth login` 가이드 안내
- **Postconditions**:
  1. GitHub 저장소가 생성되어 초기화됨
  2. 로컬 git이 remote origin으로 설정됨

##### UC-041: 기존 저장소 존재 감지

- **Actor**: System (Pipeline Orchestrator)
- **Preconditions**:
  1. 프로젝트 디렉토리가 존재함
- **Main Flow**:
  1. 시스템이 프로젝트 내 `.git/` 디렉토리를 확인함
  2. 시스템이 존재하는 경우 remote origin URL을 읽음
  3. 시스템이 `gh repo view`를 통해 GitHub 저장소 접근 가능성을 확인함
  4. 시스템이 저장소 상태를 `pipeline_config.yaml`에 기록함
- **Alternative Flows**:
  - 1a. `.git/` 디렉토리 없음: 저장소 없음으로 기록
  - 3a. 원격 접근 불가: 로컬 전용 저장소로 기록
- **Postconditions**:
  1. 저장소 존재 및 접근 가능성 상태가 기록됨

#### 3.29.2 Acceptance Criteria

- [ ] AC-120: 올바른 공개 설정으로 GitHub 저장소 생성
- [ ] AC-121: README 및 .gitignore로 저장소 초기화
- [ ] AC-122: 기존 저장소 감지 및 remote URL 추출
- [ ] AC-123: 인증 및 권한 오류의 정상적 처리

#### 3.29.3 Dependencies

- **Depends on**: SF-028
- **Blocks**: SF-005 (Issue Auto-Generation)

---

### SF-030: Pipeline Orchestration

**Source**: FR-031, FR-032
**Priority**: P0
**Description**: AD-SDLC 파이프라인 전체(Greenfield 또는 Enhancement 모드)의 실행을 조율하며, 전체 워크플로우에 걸쳐 단계 전환, 승인 게이트, 오류 처리를 관리합니다.

#### 3.30.1 Use Cases

##### UC-042: 전체 파이프라인 실행 조율

- **Actor**: System (Pipeline Orchestrator), User
- **Preconditions**:
  1. 프로젝트가 초기화됨 (SF-028)
  2. 파이프라인 모드가 감지됨 (SF-027)
  3. 입력 요구사항 또는 변경 요청이 제공됨
- **Main Flow**:
  1. 시스템이 파이프라인 모드를 결정하고 단계 시퀀스를 선택함
  2. Greenfield의 경우: 수집 → PRD → SRS → SDS → Issue → 구현 실행
  3. Enhancement의 경우: 분석 → 영향 → 업데이트 → Issue → 구현 실행
  4. 시스템이 단계 간 승인 게이트를 관리함
  5. 시스템이 전체 파이프라인 진행 상황을 추적하고 상태를 보고함
- **Alternative Flows**:
  - 4a. 승인 거부: 피드백을 수집하고 현재 단계를 재실행
  - 5a. 단계 실패: 파이프라인을 중단하고 실패 상세를 보고
- **Exception Flows**:
  - E1. 복구 불가능한 오류: 재개를 위한 파이프라인 상태 저장
- **Postconditions**:
  1. 파이프라인이 모든 단계를 완료하거나 정의된 체크포인트에서 일시 정지됨

##### UC-043: Enhancement 분석 서브 파이프라인 조율

- **Actor**: System (Pipeline Orchestrator)
- **Preconditions**:
  1. Enhancement 모드가 선택됨
  2. 기존 문서 및/또는 코드베이스가 존재함
- **Main Flow**:
  1. 시스템이 문서 파싱(SF-017)을 실행하여 현재 상태를 추출함
  2. 소스 코드가 존재하는 경우 시스템이 코드베이스 분석(SF-018)을 실행함
  3. 시스템이 변경 영향 분석(SF-019)을 실행함
  4. 시스템이 영향 보고서를 사용자에게 제시하여 승인을 받음
  5. 승인 시 시스템이 증분 문서 업데이트로 진행함
- **Alternative Flows**:
  - 2a. 소스 코드 없음: 코드베이스 분석 단계 건너뛰기
- **Postconditions**:
  1. Enhancement 분석이 완료됨
  2. 영향 보고서가 승인되어 증분 업데이트 진행 가능

#### 3.30.2 Acceptance Criteria

- [ ] AC-124: 모든 단계를 올바른 순서로 Greenfield 파이프라인 실행
- [ ] AC-125: 분석 우선 접근 방식으로 Enhancement 파이프라인 실행
- [ ] AC-126: 모든 단계 간 승인 게이트 관리
- [ ] AC-127: 실패 시 파이프라인 일시 정지 및 재개 지원

#### 3.30.3 Dependencies

- **Depends on**: SF-027, SF-028
- **Blocks**: All pipeline stages

---

### SF-031: Issue Import

**Source**: FR-033
**Priority**: P1
**Description**: 저장소의 기존 GitHub Issue를 임포트하여 AD-SDLC 형식으로 변환함으로써, 외부에서 생성된 이슈를 시스템의 추적 및 추적성 프레임워크에 통합할 수 있게 합니다.

#### 3.31.1 Use Cases

##### UC-044: GitHub Issue 임포트 및 AD-SDLC 형식 변환

- **Actor**: System (Pipeline Orchestrator), Tech Lead
- **Preconditions**:
  1. GitHub CLI가 인증되어 있음
  2. 대상 저장소에 기존 이슈가 존재함
- **Main Flow**:
  1. 시스템이 `gh issue list`를 사용하여 GitHub 저장소에서 열린 이슈를 가져옴
  2. 시스템이 이슈 제목, 본문, 라벨, 메타데이터를 파싱함
  3. 시스템이 이슈를 AD-SDLC 카테고리(feature, bug, enhancement, task)에 매핑함
  4. 시스템이 AD-SDLC 라벨을 할당하고 가능한 경우 기존 SDS 컴포넌트에 연결함
  5. 시스템이 임포트된 이슈를 Scratchpad의 `imported_issues.json`에 저장함
- **Alternative Flows**:
  - 4a. 매칭되는 SDS 컴포넌트 없음: 수동 매핑을 위해 미연결로 표시
  - 2a. 이미 AD-SDLC 라벨이 있는 이슈: 재임포트 건너뛰기
- **Exception Flows**:
  - E1. API Rate Limit: 백오프 및 재시도 전략 적용
- **Postconditions**:
  1. `imported_issues.json`에 AD-SDLC 형식의 모든 임포트된 이슈가 포함됨
  2. 이슈가 의존성 분석 및 작업 우선순위 결정에 사용 가능함

#### 3.31.2 Acceptance Criteria

- [ ] AC-128: 대상 저장소에서 모든 열린 이슈 가져오기 및 파싱
- [ ] AC-129: 적절한 카테고리화로 이슈를 AD-SDLC 형식으로 변환
- [ ] AC-130: 추적 가능한 경우 임포트된 이슈를 기존 SDS 컴포넌트에 연결
- [ ] AC-131: 중복 임포트의 멱등성 처리

#### 3.31.3 Dependencies

- **Depends on**: SF-017, SF-029
- **Blocks**: SF-006 (Work Prioritization)

---

## 4. External Interface Requirements

### 4.1 User Interfaces

AD-SDLC는 CLI 기반 시스템으로, 주로 Claude Code CLI를 통해 상호작용합니다.

| Interface ID | Name | Description |
|--------------|------|-------------|
| UI-001 | CLI Input | 자연어 텍스트 입력 인터페이스 |
| UI-002 | File Path Input | 파일 경로 지정 인터페이스 |
| UI-003 | URL Input | URL 입력 인터페이스 |
| UI-004 | Approval Prompt | 승인/거부 선택 프롬프트 |
| UI-005 | Progress Display | 진행 상황 텍스트 출력 |

### 4.2 API Interfaces

| Endpoint | Method | Description | Agent |
|----------|--------|-------------|-------|
| GitHub Issues API | POST | 이슈 생성 | Issue Generator |
| GitHub Issues API | PATCH | 이슈 상태 업데이트 | Controller, PR Review |
| GitHub PRs API | POST | PR 생성 | PR Review |
| GitHub PRs API | POST | 리뷰 제출 | PR Review |
| GitHub PRs API | PUT | PR 머지 | PR Review |
| Claude API | POST | 에이전트 추론 | All Agents |

### 4.3 File Interfaces

| Interface ID | Path Pattern | Format | Description |
|--------------|--------------|--------|-------------|
| FI-001 | `.ad-sdlc/scratchpad/info/{id}/collected_info.yaml` | YAML | 수집된 정보 |
| FI-002 | `.ad-sdlc/scratchpad/documents/{id}/prd.md` | Markdown | PRD 문서 |
| FI-003 | `.ad-sdlc/scratchpad/documents/{id}/srs.md` | Markdown | SRS 문서 |
| FI-004 | `.ad-sdlc/scratchpad/documents/{id}/sds.md` | Markdown | SDS 문서 |
| FI-005 | `.ad-sdlc/scratchpad/issues/{id}/issue_list.json` | JSON | 이슈 목록 |
| FI-006 | `.ad-sdlc/scratchpad/issues/{id}/dependency_graph.json` | JSON | 의존성 그래프 |
| FI-007 | `.ad-sdlc/scratchpad/progress/{id}/controller_state.yaml` | YAML | 컨트롤러 상태 |
| FI-008 | `.ad-sdlc/scratchpad/progress/{id}/work_orders/*.yaml` | YAML | 작업 지시서 |
| FI-009 | `.ad-sdlc/scratchpad/progress/{id}/results/*.yaml` | YAML | 구현 결과 |
| FI-010 | `.ad-sdlc/scratchpad/progress/{id}/reviews/*.yaml` | YAML | 리뷰 결과 |

### 4.4 External System Interfaces

| System | Protocol | Purpose |
|--------|----------|---------|
| GitHub | HTTPS + OAuth | 이슈, PR 관리 |
| Claude API | HTTPS | 에이전트 추론 |
| Web URLs | HTTP/HTTPS | 외부 문서 수집 |

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Metric | Target | Priority |
|----|-------------|--------|--------|----------|
| NFR-001 | 문서 생성 응답 시간 | 시간 | < 5분 / 문서 | P0 |
| NFR-002 | Issue 생성 처리량 | 이슈/분 | > 20 | P0 |
| NFR-003 | Worker 동시 실행 수 | 개수 | 최대 5 | P0 |
| NFR-004 | 상태 확인 주기 | 초 | 30초 | P1 |
| NFR-005 | PR 리뷰 완료 시간 | 시간 | < 5분 | P1 |

### 5.2 Reliability Requirements

| ID | Requirement | Metric | Target | Priority |
|----|-------------|--------|--------|----------|
| NFR-006 | 시스템 가용성 | 백분율 | 99.5% | P1 |
| NFR-007 | 문서 생성 성공률 | 백분율 | > 95% | P0 |
| NFR-008 | 코드 구현 성공률 | 백분율 | > 85% | P0 |
| NFR-009 | 데이터 무손실 | 백분율 | 100% | P0 |
| NFR-010 | 재시도 후 복구율 | 백분율 | > 90% | P1 |

### 5.3 Security Requirements

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| NFR-011 | API 키 보안 저장 | 환경 변수 또는 Secret Manager 사용 | P0 |
| NFR-012 | 민감 정보 마스킹 | 로그에서 토큰, 비밀번호 자동 마스킹 | P0 |
| NFR-013 | GitHub 인증 | OAuth 또는 PAT 기반 인증 | P0 |
| NFR-014 | 코드 보안 검사 | 생성 코드에 하드코딩 시크릿 금지 | P0 |
| NFR-015 | 입력 검증 | 사용자 입력 및 외부 데이터 검증 | P1 |

### 5.4 Maintainability Requirements

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| NFR-016 | 설정 외부화 | YAML 기반 설정 파일 사용 | P0 |
| NFR-017 | 템플릿 커스터마이징 | 사용자 정의 문서 템플릿 지원 | P1 |
| NFR-018 | 로그 레벨 조정 | DEBUG/INFO/WARN/ERROR 런타임 조정 | P1 |
| NFR-019 | 에이전트 정의 분리 | 각 에이전트별 독립 정의 파일 | P0 |
| NFR-020 | 워크플로우 설정 | 파이프라인 단계 및 승인 게이트 설정 | P1 |

### 5.5 Scalability Requirements

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| NFR-021 | 병렬 Worker 확장 | 설정으로 최대 Worker 수 조정 가능 | P1 |
| NFR-022 | 대규모 문서 처리 | Context 분할로 대용량 입력 처리 | P1 |

---

## 6. Data Requirements

> **네이밍 컨벤션 참고**: 본 문서의 데이터 엔티티 스키마는 YAML/문서 관례에 따라
> `snake_case` 필드명(예: `file_path`, `issue_id`, `review_status`)을 사용합니다.
> TypeScript 구현에서는 JavaScript/TypeScript 관례에 따라 `camelCase`(예: `filePath`,
> `issueId`, `reviewStatus`)를 사용합니다. 이 두 형식 간의 직렬화/역직렬화는
> 데이터 플레인 레이어에서 투명하게 처리됩니다. 본 SRS와 TypeScript 소스 코드 간
> 스키마 필드를 비교할 때는 snake_case-to-camelCase 매핑 규칙을 적용하십시오.

### 6.1 Data Entities

#### 6.1.1 Collected Information (collected_info.yaml)

```yaml
schema:
  project_name: string
  description: string
  stakeholders:
    - name: string
      role: string
      contact: string
  requirements:
    functional:
      - id: string  # FR-XXX
        title: string
        description: string
        priority: enum[P0, P1, P2, P3]
    non_functional:
      - id: string  # NFR-XXX
        category: string
        requirement: string
  constraints:
    - description: string
  assumptions:
    - description: string
  dependencies:
    - name: string
      version: string
  questions:
    - question: string
      answer: string  # User response
```

#### 6.1.2 Work Order (work_order.yaml)

```yaml
schema:
  order_id: string  # WO-XXX
  issue_id: string  # GitHub Issue Number
  issue_url: string
  created_at: datetime
  deadline: datetime  # Optional
  priority: integer
  context:
    sds_component: string  # CMP-XXX
    srs_feature: string    # SF-XXX
    prd_requirement: string  # FR-XXX
    related_files:
      - path: string
        reason: string
    dependencies_status:
      - issue_id: string
        status: enum[open, closed]
  acceptance_criteria:
    - criterion: string
```

#### 6.1.3 Implementation Result (implementation_result.yaml)

```yaml
schema:
  order_id: string
  issue_id: string
  status: enum[completed, failed, blocked]
  branch_name: string
  changes:
    - file_path: string
      change_type: enum[create, modify, delete]
      lines_added: integer
      lines_removed: integer
  tests_added:
    - file_path: string
      test_count: integer
  verification_result:
    tests_passed: boolean
    lint_passed: boolean
    build_passed: boolean
    coverage: float
  retry_count: integer
  error_log: string  # If failed
  completed_at: datetime
```

#### 6.1.4 PR Review Result (pr_review_result.yaml)

```yaml
schema:
  pr_number: integer
  pr_url: string
  order_id: string
  issue_id: string
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
  quality_gates:
    tests_pass: boolean
    build_pass: boolean
    no_critical_issues: boolean
    coverage_threshold_met: boolean
  final_decision: enum[merge, revise, reject]
  merge_commit: string  # SHA, if merged
  merged_at: datetime  # If merged
```

#### 6.1.5 Impact Report (impact_report.yaml)

```yaml
schema:
  project_id: string
  change_request: string
  change_scope: enum[minor, moderate, major, breaking]
  affected_requirements:
    - id: string       # FR-XXX
      impact: string
  affected_features:
    - id: string       # SF-XXX
      impact: string
  affected_components:
    - id: string       # CMP-XXX
      impact: string
  affected_files:
    - path: string
      reason: string
  risk_assessment:
    overall_risk: enum[low, medium, high, critical]
    factors:
      - category: string
        severity: enum[low, medium, high]
        description: string
        mitigation: string
  recommendations:
    - type: enum[add, modify, deprecate, remove]
      target_document: enum[PRD, SRS, SDS]
      target_id: string
      description: string
      priority: enum[P0, P1, P2, P3]
  created_at: datetime
```

#### 6.1.6 Code Inventory (code_inventory.yaml)

```yaml
schema:
  project_id: string
  files:
    - path: string
      language: string
      lines: integer
  classes:
    - name: string
      file_path: string
      methods: list
      implements: list
  functions:
    - name: string
      file_path: string
      parameters: list
      return_type: string
      exported: boolean
  interfaces:
    - name: string
      file_path: string
      methods: list
      properties: list
  total_lines: integer
  analyzed_at: datetime
```

#### 6.1.7 Gap Report (gap_report.yaml)

```yaml
schema:
  project_id: string
  summary:
    total_spec_items: integer
    implemented_count: integer
    missing_count: integer
    drift_count: integer
    undocumented_count: integer
  gaps:
    - type: enum[missing_implementation, spec_drift, undocumented_feature, stale_spec]
      spec_id: string
      file_path: string
      description: string
      severity: enum[low, medium, high]
  recommendations:
    - action: enum[implement, update_spec, document, remove]
      description: string
      priority: enum[P0, P1, P2, P3]
  created_at: datetime
```

#### 6.1.8 Regression Report (regression_report.yaml)

```yaml
schema:
  project_id: string
  total_tests: integer
  passed: integer
  failed: integer
  skipped: integer
  duration: float  # seconds
  failures:
    - test_file: string
      test_name: string
      error: string
      component: string
  coverage_delta: float
  compatibility:
    is_backward_compatible: boolean
    breaking_changes:
      - type: enum[api, schema, behavior, interface]
        description: string
        migration_path: string
  created_at: datetime
```

### 6.2 Data Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Data Entity Relationships                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  collected_info.yaml                                                    │
│       │                                                                 │
│       ▼                                                                 │
│  prd.md (FR-XXX)                                                        │
│       │                                                                 │
│       ▼                                                                 │
│  srs.md (SF-XXX, UC-XXX)  ◀──────────── Traceability: FR → SF          │
│       │                                                                 │
│       ▼                                                                 │
│  sds.md (CMP-XXX, API-XXX)  ◀────────── Traceability: SF → CMP         │
│       │                                                                 │
│       ▼                                                                 │
│  issue_list.json (GitHub Issues)  ◀──── Traceability: CMP → Issue      │
│       │                                                                 │
│       ├──────────────────────────────────────┐                         │
│       ▼                                      ▼                         │
│  dependency_graph.json              controller_state.yaml              │
│                                             │                          │
│                                             ▼                          │
│                                      work_order.yaml (1:1 Issue)       │
│                                             │                          │
│                                             ▼                          │
│                                  implementation_result.yaml            │
│                                             │                          │
│                                             ▼                          │
│                                    pr_review_result.yaml               │
│                                             │                          │
│                                             ▼                          │
│                                     Merged / Rejected                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Data Constraints

| Constraint | Description | Enforcement |
|------------|-------------|-------------|
| DC-001 | FR ID 유일성 | `FR-XXX` 형식, 프로젝트 내 고유 |
| DC-002 | SF ID 유일성 | `SF-XXX` 형식, SRS 내 고유 |
| DC-003 | CMP ID 유일성 | `CMP-XXX` 형식, SDS 내 고유 |
| DC-004 | 우선순위 값 | P0, P1, P2, P3 중 하나 |
| DC-005 | 이슈 상태 | open, in_progress, closed 중 하나 |
| DC-006 | Work Order와 Issue 1:1 | 하나의 이슈에 하나의 Work Order |

---

## 7. Traceability Matrix

### 7.1 PRD → SRS Traceability

| PRD Requirement | SRS Features | Use Cases |
|-----------------|--------------|-----------|
| FR-001 (정보 수집) | SF-001 | UC-001, UC-002, UC-003 |
| FR-002 (PRD 생성) | SF-002 | UC-004, UC-005 |
| FR-003 (SRS 생성) | SF-003 | UC-006 |
| FR-004 (SDS 생성) | SF-004 | UC-007 |
| FR-005 (Issue 생성) | SF-005 | UC-008 |
| FR-006 (의존성 분석) | SF-006, SF-007 | UC-009, UC-010, UC-011 |
| FR-007 (코드 구현) | SF-008, SF-009 | UC-012, UC-013 |
| FR-008 (PR 생성/리뷰) | SF-010, SF-011 | UC-014, UC-015, UC-016 |
| FR-009 (추적성) | SF-012 | UC-017, UC-018 |
| FR-010 (승인 게이트) | SF-013 | UC-019 |
| FR-011 (모니터링) | SF-007 | UC-011 |
| FR-012 (재시도) | SF-009, SF-016 | UC-013, UC-024 |
| FR-013 (로깅) | SF-015 | UC-022, UC-023 |
| FR-014 (GitHub 연동) | SF-005, SF-010, SF-011 | UC-008, UC-014, UC-015, UC-016 |
| FR-015 (Scratchpad) | SF-014 | UC-020, UC-021 |
| FR-016 (외부 소스) | SF-001 | UC-002, UC-003 |
| FR-017 (문서 파싱) | SF-017 | UC-025, UC-026 |
| FR-018 (코드베이스 분석) | SF-018 | UC-027, UC-028 |
| FR-019 (변경 영향 분석) | SF-019 | UC-029, UC-030 |
| FR-020 (PRD 증분 업데이트) | SF-020 | UC-031 |
| FR-021 (SRS 증분 업데이트) | SF-021 | UC-032 |
| FR-022 (SDS 증분 업데이트) | SF-022 | UC-033 |
| FR-023 (회귀 테스트) | SF-023 | UC-034 |
| FR-024 (문서-코드 갭 분석) | SF-024 | UC-035 |
| FR-025 (소스 코드 AST 분석) | SF-025 | UC-036 |
| FR-026 (CI/CD 실패 자동 수정) | SF-026 | UC-037 |
| FR-027 (파이프라인 모드 감지) | SF-027 | UC-038 |
| FR-028 (프로젝트 초기화) | SF-028 | UC-039 |
| FR-029 (GitHub 저장소 생성) | SF-029 | UC-040, UC-041 |
| FR-030 (GitHub 저장소 감지) | SF-029 | UC-041 |
| FR-031 (전체 파이프라인 오케스트레이션) | SF-030 | UC-042, UC-043 |
| FR-032 (Enhancement 서브 파이프라인) | SF-030 | UC-043 |
| FR-033 (이슈 임포트) | SF-031 | UC-044 |

### 7.2 Coverage Summary

| Metric | Value |
|--------|-------|
| Total PRD Requirements (FR) | 33 |
| Total SRS Features (SF) | 31 |
| Total Use Cases (UC) | 44 |
| PRD Coverage | 100% |
| Features with Use Cases | 100% |

---

## 8. Appendix

### 8.1 Glossary

| Term | Definition |
|------|------------|
| **Agent** | Claude API를 사용하는 자율 실행 단위 |
| **Circuit Breaker** | 연속 실패 시 일시 중단 패턴 |
| **Context Window** | 모델이 한 번에 처리할 수 있는 토큰 수 |
| **Feature Branch** | 특정 기능 개발을 위한 Git 브랜치 |
| **Gap Analysis** | 누락된 정보나 요구사항 식별 |
| **Quality Gate** | 다음 단계 진행을 위한 품질 검증 관문 |
| **Squash Merge** | 여러 커밋을 하나로 합쳐 머지 |
| **Topological Sort** | 의존성 그래프의 위상 정렬 |
| **Work Breakdown** | 작업을 구현 단위로 분해 |

### 8.2 Open Issues

| Issue ID | Description | Status | Owner |
|----------|-------------|--------|-------|
| OI-001 | 다중 리포지토리 지원 범위 결정 | Open | Architect |
| OI-002 | 외부 테스트 서비스 연동 옵션 | Open | Tech Lead |
| OI-003 | 비영어권 코드베이스 지원 | Open | PM |

### 8.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-27 | System Architect | Initial draft based on PRD-001 |
| 1.1.0 | 2026-02-07 | System Architect | Enhancement Pipeline 기능 추가 (SF-017~SF-031, UC-025~UC-044) FR-017~FR-033 대응 |

---

*This SRS was generated for the Agent-Driven SDLC project based on PRD-001.*
