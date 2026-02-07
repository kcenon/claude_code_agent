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

This Software Requirements Specification (SRS) defines the detailed functional requirements of the Agent-Driven SDLC (AD-SDLC) system. It decomposes the product requirements defined in PRD-001 into implementable system features and use cases, enabling the development team to directly utilize them for design and implementation.

**Target Audience:**
- Tech Lead and Software Architect
- Software Developers
- QA Engineers
- Project Managers

### 1.2 Scope

The AD-SDLC system includes the following scope:

**Included Scope:**
- 25 specialized Claude agents across three pipeline modes:
  - **Core (Greenfield)**: Collector, PRD Writer, SRS Writer, SDS Writer, Issue Generator, Controller, Worker, PR Reviewer
  - **Enhancement**: Document Reader, Codebase Analyzer, Impact Analyzer, PRD/SRS/SDS Updaters, Regression Tester, Code Reader, Doc-Code Comparator, CI Fixer
  - **Infrastructure**: AD-SDLC Orchestrator, Analysis Orchestrator, Mode Detector, Project Initializer, Repo Detector, GitHub Repo Setup, Issue Reader
- Document pipeline automation (PRD → SRS → SDS)
- GitHub Issue auto-generation and management
- Code auto-implementation and PR creation/review
- Scratchpad-based state management
- Traceability matrix maintenance

**Excluded Scope:**
- Deployment automation (CI/CD pipelines)
- Monitoring dashboard UI
- Multi-repository support
- External project management tool integration (Jira, Asana, etc.)

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| **AD-SDLC** | Agent-Driven Software Development Lifecycle |
| **PRD** | Product Requirements Document |
| **SRS** | Software Requirements Specification |
| **SDS** | Software Design Specification |
| **Scratchpad** | File-based storage pattern for inter-agent state sharing |
| **Traceability** | Bidirectional tracking capability from requirements to implementation |
| **Work Order** | Task instruction document passed from Controller Agent to Worker Agent |
| **Quality Gate** | Quality verification checkpoint for proceeding to the next stage |
| **Human-in-the-Loop** | Pattern requiring user approval at critical decision points |

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

AD-SDLC is a multi-agent system based on the Claude Agent SDK that automates the traditional manual software development process.

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
| **Document Pipeline** | Requirements → Auto-document generation | Collector, PRD/SRS/SDS Writer |
| **Issue Management** | Document → GitHub Issue conversion and management | Issue Generator, Controller |
| **Code Execution** | Issue → Code implementation and PR | Worker, PR Reviewer |
| **State Management** | Inter-agent state sharing and tracking | All Agents |

### 2.3 User Classes and Characteristics

| User Class | Characteristics | Primary Interactions |
|------------|-----------------|---------------------|
| **Product Manager (PM)** | Non-technical background, prefers natural language input, needs progress tracking | Requirements input, PRD approval, progress monitoring |
| **Tech Lead (TL)** | Technical background, responsible for design review, quality control | SRS/SDS approval, architecture decisions, final PR approval |
| **Developer (Dev)** | Responsible for code implementation, needs detailed context | Issue details review, auto-generated code review, PR feedback |

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
| **C-001** | Claude Agent SDK unidirectional communication | Only parent→child communication possible, resolved via Scratchpad pattern |
| **C-002** | Context Window limitation | 200K tokens, requires document/code splitting |
| **C-003** | GitHub API Rate Limit | 5,000 requests per hour, requires caching and batch processing |
| **C-004** | Concurrent Worker limit | Maximum 5 parallel executions (resource management) |
| **C-005** | English-based code generation | Code, commit messages, and PRs must be written in English |

### 2.6 Assumptions and Dependencies

**Assumptions:**
- User has access to GitHub account and repository
- Project is managed in a single Git repository
- If existing codebase exists, consistent coding style is present

**Dependencies:**
- Claude API availability (99.9% SLA)
- GitHub API availability
- Local file system access

---

## 3. System Features

### SF-001: Multi-Source Information Collection

**Source**: FR-001, FR-016
**Priority**: P0
**Description**: Collects various forms of input (natural language text, files, URLs) from users and transforms them into structured information documents.

#### 3.1.1 Use Cases

##### UC-001: Natural Language Requirements Collection

- **Actor**: Product Manager
- **Preconditions**:
  1. AD-SDLC system is initialized
  2. User has project context
- **Main Flow**:
  1. User inputs requirements in natural language
  2. System analyzes input and extracts key information
  3. System identifies items requiring additional clarification
  4. System generates up to 5 clarification questions (if needed)
  5. User responds to questions
  6. System saves final information to `collected_info.yaml`
- **Alternative Flows**:
  - 3a. All information is sufficient: Save directly without questions
  - 5a. User skips questions: Mark as default value or "TBD"
- **Exception Flows**:
  - E1. Input too short or unclear: Display minimum requirements guidance message
  - E2. Context limit reached: Provide input splitting guidance
- **Postconditions**:
  1. `collected_info.yaml` file is saved to Scratchpad
  2. Extracted information is maintained in structured form

##### UC-002: File-Based Requirements Collection

- **Actor**: Tech Lead, Product Manager
- **Preconditions**:
  1. Files in supported formats are prepared (.md, .pdf, .docx, .txt)
- **Main Flow**:
  1. User provides file path
  2. System reads file and extracts content
  3. System identifies key information (requirements, constraints, assumptions)
  4. System performs the same structuring process as natural language input
  5. System merges results into `collected_info.yaml`
- **Alternative Flows**:
  - 2a. PDF file: OCR or text layer extraction
  - 2b. Multiple files: Sequential processing and merging
- **Exception Flows**:
  - E1. Unsupported file format: Error message and supported format guidance
  - E2. File read failure: Error log and retry guidance
- **Postconditions**:
  1. File content is converted to structured information

##### UC-003: URL-Based Information Collection

- **Actor**: All Users
- **Preconditions**:
  1. Valid HTTP/HTTPS URL is provided
- **Main Flow**:
  1. User provides URL
  2. System fetches content using WebFetch tool
  3. System parses HTML and extracts body text
  4. System identifies and structures relevant information
- **Alternative Flows**:
  - 3a. API documentation URL: Extract as structured API spec
- **Exception Flows**:
  - E1. URL inaccessible: Error message and alternative input guidance
  - E2. Content extraction failure: Request manual input
- **Postconditions**:
  1. URL content is integrated into information document

#### 3.1.2 Acceptance Criteria

- [ ] AC-001: Extract requirements, constraints, and assumptions from natural language input with 95%+ accuracy
- [ ] AC-002: Support .md, .pdf, .docx, .txt file formats
- [ ] AC-003: Support URL content extraction and structuring
- [ ] AC-004: Limit clarification questions to maximum 5
- [ ] AC-005: Comply with `collected_info.yaml` output schema

#### 3.1.3 Dependencies

- **Depends on**: None (Entry Point)
- **Blocks**: SF-002 (PRD Generation)

---

### SF-002: PRD Document Auto-Generation

**Source**: FR-002
**Priority**: P0
**Description**: Analyzes collected information and auto-generates documents based on the standard PRD template.

#### 3.2.1 Use Cases

##### UC-004: PRD Auto-Generation

- **Actor**: System (PRD Writer Agent)
- **Preconditions**:
  1. `collected_info.yaml` exists and is valid
  2. PRD template is configured
- **Main Flow**:
  1. System loads collected information
  2. System sequentially generates each section of the PRD template
  3. System auto-assigns priorities (P0-P3) to requirements
  4. System identifies missing information and records it in Gap Analysis section
  5. System checks for conflicts between requirements
  6. System saves completed PRD
- **Alternative Flows**:
  - 4a. No missing information: Omit Gap Analysis section
  - 5a. Conflicts found: Include conflict list and resolution suggestions
- **Exception Flows**:
  - E1. Template load failure: Use default template
  - E2. Insufficient information: Minimum requirements not met warning
- **Postconditions**:
  1. `prd.md` file is saved to Scratchpad
  2. Copied to `docs/prd/PRD-{project_id}.md`

##### UC-005: PRD User Approval

- **Actor**: Product Manager, Tech Lead
- **Preconditions**:
  1. PRD draft has been generated
- **Main Flow**:
  1. System presents generated PRD to user
  2. User reviews PRD content
  3. User selects Approve or Request Changes
  4. On approval: System proceeds to next stage (SRS)
- **Alternative Flows**:
  - 3a. Request Changes: Regenerate PRD reflecting user feedback
- **Exception Flows**:
  - E1. Approval timeout: Send notification and maintain waiting state
- **Postconditions**:
  1. PRD approval status is recorded
  2. On approval, transition to SRS generation stage

#### 3.2.2 Acceptance Criteria

- [ ] AC-006: Include all required sections (Executive Summary, Problem Statement, FR, NFR)
- [ ] AC-007: Include at least 3 functional requirements
- [ ] AC-008: Assign unique ID (FR-XXX) and priority to each requirement
- [ ] AC-009: User approval gate functioning

#### 3.2.3 Dependencies

- **Depends on**: SF-001
- **Blocks**: SF-003

---

### SF-003: SRS Document Auto-Generation

**Source**: FR-003
**Priority**: P0
**Description**: Analyzes PRD to auto-generate detailed Software Requirements Specification (SRS). Decomposes each PRD requirement into system features and generates use case scenarios.

#### 3.3.1 Use Cases

##### UC-006: SRS Auto-Generation

- **Actor**: System (SRS Writer Agent)
- **Preconditions**:
  1. Approved PRD exists
- **Main Flow**:
  1. System loads and analyzes PRD
  2. System decomposes each FR into detailed features (SF-XXX)
  3. System generates use cases (UC-XXX) for each feature
  4. System defines system interfaces
  5. System generates PRD→SRS traceability matrix
  6. System saves completed SRS
- **Alternative Flows**:
  - 2a. Composite FR: Decompose into multiple SFs
- **Exception Flows**:
  - E1. PRD structure error: Report parsing failure location
- **Postconditions**:
  1. `srs.md` file is saved to Scratchpad
  2. All FRs are mapped to at least 1 SF

#### 3.3.2 Acceptance Criteria

- [ ] AC-010: All PRD requirements mapped to SRS features (100% coverage)
- [ ] AC-011: Each feature includes at least 1 use case
- [ ] AC-012: Use cases include Main/Alternative/Exception flows
- [ ] AC-013: Auto-generate traceability matrix

#### 3.3.3 Dependencies

- **Depends on**: SF-002
- **Blocks**: SF-004

---

### SF-004: SDS Document Auto-Generation

**Source**: FR-004
**Priority**: P0
**Description**: Analyzes SRS to auto-generate Software Design Specification (SDS). Includes system architecture, component design, API specifications, and database schema.

#### 3.4.1 Use Cases

##### UC-007: SDS Auto-Generation

- **Actor**: System (SDS Writer Agent)
- **Preconditions**:
  1. Approved SRS exists
- **Main Flow**:
  1. System loads and analyzes SRS
  2. System designs system architecture
  3. System defines components (CMP-XXX)
  4. System designs API endpoints
  5. System defines data models/schemas
  6. System maintains SRS→SDS traceability
  7. System saves completed SDS
- **Alternative Flows**:
  - 3a. Existing architecture exists: Analyze and extend existing patterns
- **Exception Flows**:
  - E1. Architecture decision required: Present options to user
- **Postconditions**:
  1. `sds.md` file is saved to Scratchpad
  2. All SFs are mapped to CMPs

#### 3.4.2 Acceptance Criteria

- [ ] AC-014: Include system architecture diagram
- [ ] AC-015: Define at least 1 component
- [ ] AC-016: Interface specification per component
- [ ] AC-017: Include API spec (endpoint, method, request/response)
- [ ] AC-018: Deployment architecture specification

#### 3.4.3 Dependencies

- **Depends on**: SF-003
- **Blocks**: SF-005

---

### SF-005: GitHub Issue Auto-Generation

**Source**: FR-005, FR-014
**Priority**: P0
**Description**: Analyzes SDS components to auto-generate implementable GitHub Issues.

#### 3.5.1 Use Cases

##### UC-008: Issue Auto-Generation

- **Actor**: System (Issue Generator Agent)
- **Preconditions**:
  1. Approved SDS exists
  2. GitHub CLI is authenticated
- **Main Flow**:
  1. System analyzes SDS and extracts component list
  2. System decomposes each component into implementation units (Work Breakdown)
  3. System analyzes dependencies between issues
  4. System generates issue body using standard template
  5. System assigns labels, milestone, and estimated effort
  6. System creates issues on GitHub using `gh issue create` command
  7. System saves `issue_list.json` and `dependency_graph.json`
- **Alternative Flows**:
  - 6a. API Rate Limit: Wait and retry
- **Exception Flows**:
  - E1. GitHub authentication failure: Authentication guidance message
  - E2. Issue creation failure: Local save and retry queue
- **Postconditions**:
  1. Issues are created on GitHub
  2. Issue list and dependency graph are saved

#### 3.5.2 Acceptance Criteria

- [ ] AC-019: Generate at least 1 issue per SDS component
- [ ] AC-020: Include Source Reference (CMP, SF, FR) in issues
- [ ] AC-021: Set `blocked_by` dependencies between issues
- [ ] AC-022: Include effort estimation (XS/S/M/L/XL)
- [ ] AC-023: Auto-labeling (`ad-sdlc:auto-generated`)

#### 3.5.3 Dependencies

- **Depends on**: SF-004
- **Blocks**: SF-006

---

### SF-006: Work Prioritization and Dependency Analysis

**Source**: FR-006
**Priority**: P0
**Description**: Analyzes dependencies of generated issues and determines execution priority.

#### 3.6.1 Use Cases

##### UC-009: Work Priority Determination

- **Actor**: System (Controller Agent)
- **Preconditions**:
  1. Issue list and dependency graph exist
- **Main Flow**:
  1. System loads dependency graph
  2. System performs Topological Sort
  3. System applies priority weights (P0 > P1 > P2 > P3)
  4. System considers number of dependent issues and critical path
  5. System determines final execution order
- **Alternative Flows**:
  - 2a. Circular dependency found: Warning and manual intervention request
- **Exception Flows**:
  - E1. Graph parsing error: Report error location
- **Postconditions**:
  1. Priority-sorted issue queue is created

#### 3.6.2 Acceptance Criteria

- [ ] AC-024: Topological sort-based dependency resolution
- [ ] AC-025: Combined scoring of priority and dependencies
- [ ] AC-026: Circular dependency detection and warning

#### 3.6.3 Dependencies

- **Depends on**: SF-005
- **Blocks**: SF-007

---

### SF-007: Work Assignment and Monitoring

**Source**: FR-006, FR-011
**Priority**: P0
**Description**: Assigns work to Worker Agents and monitors progress in real-time.

#### 3.7.1 Use Cases

##### UC-010: Work Assignment

- **Actor**: System (Controller Agent)
- **Preconditions**:
  1. Priority-sorted issue queue exists
  2. Available Worker slot exists (maximum 5)
- **Main Flow**:
  1. System selects next executable issue (dependencies resolved)
  2. System creates Work Order
  3. System includes relevant context (files, dependency status)
  4. System spawns Worker Agent
  5. System records assignment status in `controller_state.yaml`
- **Alternative Flows**:
  - 1a. All issues completed: Pipeline termination
  - 4a. Worker slot shortage: Add to wait queue
- **Exception Flows**:
  - E1. Worker spawn failure: Retry then error report
- **Postconditions**:
  1. Work Order file is created
  2. Worker Agent is executed

##### UC-011: Progress Monitoring

- **Actor**: System (Controller Agent), All Users
- **Preconditions**:
  1. One or more Workers are running
- **Main Flow**:
  1. System checks Worker status at 30-second intervals
  2. System identifies completed tasks
  3. System calculates overall progress
  4. System detects bottlenecks
  5. System updates `progress_report.md`
- **Alternative Flows**:
  - 4a. Bottleneck found: Send notification
- **Postconditions**:
  1. Progress report is kept up-to-date

#### 3.7.2 Acceptance Criteria

- [ ] AC-027: Support maximum 5 Workers in parallel execution
- [ ] AC-028: Assign only issues with resolved dependencies
- [ ] AC-029: 30-second interval status polling
- [ ] AC-030: Progress (%) calculation and reporting

#### 3.7.3 Dependencies

- **Depends on**: SF-006
- **Blocks**: SF-008

---

### SF-008: Code Auto-Implementation

**Source**: FR-007
**Priority**: P0
**Description**: Auto-implements code based on assigned Issues.

#### 3.8.1 Use Cases

##### UC-012: Code Auto-Implementation

- **Actor**: System (Worker Agent)
- **Preconditions**:
  1. Work Order is assigned
  2. Access to existing codebase is available
- **Main Flow**:
  1. System reads Work Order and understands issue details
  2. System analyzes relevant existing code (Glob, Grep, Read)
  3. System creates feature branch (`feature/ISS-XXX-description`)
  4. System generates/modifies code (Write, Edit)
  5. System writes unit tests
  6. System commits changes
  7. System generates `implementation_result.yaml`
- **Alternative Flows**:
  - 3a. Branch exists: Use existing branch
  - 4a. Only modification needed: Use Edit tool
- **Exception Flows**:
  - E1. Code generation failure: Error log and retry
  - E2. Test writing failure: Generate basic test skeleton
- **Postconditions**:
  1. Code changes are committed to feature branch
  2. Unit tests are included

#### 3.8.2 Acceptance Criteria

- [ ] AC-031: Adhere to existing coding style/patterns
- [ ] AC-032: Auto-create feature branch
- [ ] AC-033: Write tests for changed code
- [ ] AC-034: Output implementation result YAML

#### 3.8.3 Dependencies

- **Depends on**: SF-007
- **Blocks**: SF-009, SF-010

---

### SF-009: Self-Verification and Testing

**Source**: FR-007, FR-012
**Priority**: P0
**Description**: Self-verifies implemented code (test, lint, build) and automatically fixes and retries on failure.

#### 3.9.1 Use Cases

##### UC-013: Self-Verification Execution

- **Actor**: System (Worker Agent)
- **Preconditions**:
  1. Code implementation is complete
- **Main Flow**:
  1. System executes `npm test` (or configured test command)
  2. System executes `npm run lint` (or configured lint command)
  3. System executes `npm run build` (or configured build command)
  4. All verifications pass: Report success status
  5. On failure: Analyze error and attempt auto-fix
  6. Report failure after maximum 3 retries
- **Alternative Flows**:
  - 5a. Lint error: Apply auto-fix (`--fix`)
  - 5b. Type error: Attempt type definition fix
- **Exception Flows**:
  - E1. Failure after 3 retries: Mark issue as blocked status
- **Postconditions**:
  1. Verification results are recorded in `implementation_result.yaml`
  2. On success, proceed to PR creation stage

#### 3.9.2 Acceptance Criteria

- [ ] AC-035: Sequential execution of test, lint, build
- [ ] AC-036: Attempt auto-fix on failure
- [ ] AC-037: Maximum 3 retries
- [ ] AC-038: Verification result logging

#### 3.9.3 Dependencies

- **Depends on**: SF-008
- **Blocks**: SF-010

---

### SF-010: PR Auto-Creation and Review

**Source**: FR-008, FR-014
**Priority**: P0
**Description**: Auto-creates PRs from completed implementations and performs code review.

#### 3.10.1 Use Cases

##### UC-014: PR Auto-Creation

- **Actor**: System (PR Review Agent)
- **Preconditions**:
  1. Implementation result that passed verification exists
  2. Feature branch is pushed to remote
- **Main Flow**:
  1. System reads `implementation_result.yaml`
  2. System generates PR body (change summary, test results, related issues)
  3. System executes `gh pr create` command
  4. System adds PR label (`ad-sdlc:auto-generated`)
  5. System records PR URL
- **Alternative Flows**:
  - 3a. Draft PR option: Add `--draft` flag
- **Exception Flows**:
  - E1. PR creation failure: Error log and retry
- **Postconditions**:
  1. PR is created on GitHub
  2. PR information is recorded

##### UC-015: Automated Code Review

- **Actor**: System (PR Review Agent)
- **Preconditions**:
  1. PR is created
- **Main Flow**:
  1. System analyzes changed files
  2. System checks for security vulnerabilities
  3. System verifies coding style compliance
  4. System checks test coverage (>=80%)
  5. System calculates complexity score (<=10)
  6. System generates review comments
  7. System submits review using `gh pr review` command
- **Alternative Flows**:
  - 6a. No issues: Approval review
  - 6b. Minor issues: Approve with comments
  - 6c. Major issues: Request changes
- **Exception Flows**:
  - E1. Analysis failure: Request manual review
- **Postconditions**:
  1. Review is added to PR
  2. Review results are recorded

#### 3.10.2 Acceptance Criteria

- [ ] AC-039: Include change summary, test results, issue links in PR body
- [ ] AC-040: Execute security vulnerability scan
- [ ] AC-041: Verify code coverage >=80%
- [ ] AC-042: Verify complexity score <=10
- [ ] AC-043: Approve/Request Changes decision

#### 3.10.3 Dependencies

- **Depends on**: SF-009
- **Blocks**: SF-011

---

### SF-011: Quality Gate and Merge Decision

**Source**: FR-008
**Priority**: P0
**Description**: Performs final merge decision for PRs that pass quality gates.

#### 3.11.1 Use Cases

##### UC-016: Merge Decision

- **Actor**: System (PR Review Agent)
- **Preconditions**:
  1. PR review is complete
  2. All required checks have passed
- **Main Flow**:
  1. System checks quality gate results
  2. When all required conditions are met:
     - Tests passed: true
     - Build passed: true
     - No critical issues: true
     - Coverage >=80%: true
  3. System performs squash merge (configured strategy)
  4. System deletes feature branch
  5. System closes related issue
- **Alternative Flows**:
  - 2a. Only recommended conditions not met: Merge with comment
  - 2b. Required conditions not met: Reject merge and provide feedback
- **Exception Flows**:
  - E1. Merge conflict: Conflict resolution guidance
- **Postconditions**:
  1. PR is merged or rejected
  2. Issue is closed (on merge)

#### 3.11.2 Acceptance Criteria

- [ ] AC-044: Verify all 4 required quality gates pass
- [ ] AC-045: Apply squash merge strategy
- [ ] AC-046: Auto-delete branch after merge
- [ ] AC-047: Auto-close related issue

#### 3.11.3 Dependencies

- **Depends on**: SF-010
- **Blocks**: None (End Point)

---

### SF-012: Traceability Matrix Management

**Source**: FR-009
**Priority**: P1
**Description**: Maintains traceability between requirements-design-implementation throughout the entire pipeline.

#### 3.12.1 Use Cases

##### UC-017: Traceability Matrix Generation

- **Actor**: System (All Document Agents)
- **Preconditions**:
  1. At least one document (PRD, SRS, SDS) exists
- **Main Flow**:
  1. System auto-inserts source references during document generation
  2. During SRS generation: FR → SF mapping
  3. During SDS generation: SF → CMP mapping
  4. During Issue generation: CMP → Issue mapping
  5. During PR generation: Issue → PR mapping
  6. System updates complete traceability matrix
- **Postconditions**:
  1. Bidirectional traceable matrix is maintained

##### UC-018: Reverse Trace Query

- **Actor**: Tech Lead, Developer
- **Preconditions**:
  1. Traceability matrix exists
- **Main Flow**:
  1. User specifies a particular PR/Issue/Component
  2. System traces backward to original requirement
  3. System displays complete trace path

#### 3.12.2 Acceptance Criteria

- [ ] AC-048: PRD → SRS 100% coverage
- [ ] AC-049: SRS → SDS 100% coverage
- [ ] AC-050: SDS → Issue 100% coverage
- [ ] AC-051: Reverse trace query support

#### 3.12.3 Dependencies

- **Depends on**: SF-001 ~ SF-011
- **Blocks**: None

---

### SF-013: Approval Gate System

**Source**: FR-010
**Priority**: P1
**Description**: Implements user approval gates at each stage to apply the Human-in-the-Loop pattern.

#### 3.13.1 Use Cases

##### UC-019: Stage-wise Approval Request

- **Actor**: System, All Users
- **Preconditions**:
  1. Artifacts for the stage have been generated
  2. Approval gate is enabled (configuration)
- **Main Flow**:
  1. System detects artifact generation completion
  2. System displays approval request to user
  3. User reviews artifacts
  4. User selects Approve or Reject
  5. On approval: Proceed to next stage
  6. On rejection: Collect feedback and regenerate
- **Alternative Flows**:
  - 4a. Request changes: Provide feedback on specific parts
- **Postconditions**:
  1. Approval status is recorded

#### 3.13.2 Acceptance Criteria

- [ ] AC-052: Approval gates at Collection/PRD/SRS/SDS/Issue stages
- [ ] AC-053: Approve/Reject/Request Changes options
- [ ] AC-054: Collect feedback on rejection
- [ ] AC-055: Approval gate ON/OFF configurable

#### 3.13.3 Dependencies

- **Depends on**: SF-001 ~ SF-005
- **Blocks**: Subsequent stages

---

### SF-014: Scratchpad State Management

**Source**: FR-015
**Priority**: P0
**Description**: Shares state between agents using file system-based Scratchpad pattern.

#### 3.14.1 Use Cases

##### UC-020: State Storage

- **Actor**: System (All Agents)
- **Preconditions**:
  1. Scratchpad directory is initialized
- **Main Flow**:
  1. Agent generates work result
  2. Agent saves result to agreed-upon path
  3. Agent logs state change
- **Postconditions**:
  1. State is persisted as file

##### UC-021: State Reading

- **Actor**: System (All Agents)
- **Preconditions**:
  1. Previous agent's output exists
- **Main Flow**:
  1. Agent reads state from input path
  2. Agent validates state
  3. Agent performs work based on state
- **Exception Flows**:
  - E1. File not found: Wait or error report
  - E2. Schema mismatch: Migration or error report

#### 3.14.2 Acceptance Criteria

- [ ] AC-056: Support YAML/JSON/Markdown formats
- [ ] AC-057: Schema validation
- [ ] AC-058: State change logging
- [ ] AC-059: Concurrent access safety (single Writer)

#### 3.14.3 Dependencies

- **Depends on**: None
- **Blocks**: All features

---

### SF-015: Activity Logging and Audit

**Source**: FR-013
**Priority**: P1
**Description**: Logs all agent activities and supports audit trails.

#### 3.15.1 Use Cases

##### UC-022: Activity Logging

- **Actor**: System (All Agents)
- **Preconditions**:
  1. Logging configuration is enabled
- **Main Flow**:
  1. Agent logs when task starts/completes/fails
  2. Log includes timestamp, agent ID, stage, status
  3. Logs are sent to configured output (file, console)
- **Postconditions**:
  1. All activities are recorded in logs

##### UC-023: Audit Trail Query

- **Actor**: Tech Lead, Auditor
- **Preconditions**:
  1. Log files exist
- **Main Flow**:
  1. User requests filtering by specific period/agent/status
  2. System searches logs and returns results
- **Postconditions**:
  1. Filtered logs are displayed

#### 3.15.2 Acceptance Criteria

- [ ] AC-060: JSON format structured logging
- [ ] AC-061: Support log levels (DEBUG/INFO/WARN/ERROR)
- [ ] AC-062: Log file rotation (10MB, 5 files)
- [ ] AC-063: Agent-specific filtering support

#### 3.15.3 Dependencies

- **Depends on**: None
- **Blocks**: None

---

### SF-016: Error Handling and Retry

**Source**: FR-012
**Priority**: P1
**Description**: Performs automatic retry and recovery when errors occur during agent execution.

#### 3.16.1 Use Cases

##### UC-024: Automatic Retry

- **Actor**: System (Worker, PR Review Agents)
- **Preconditions**:
  1. Error occurred during task execution
  2. Error type is retryable
- **Main Flow**:
  1. System detects error
  2. System checks retry policy (maximum 3 times, exponential backoff)
  3. System applies wait time (5s → 10s → 20s)
  4. System re-executes task
  5. On success: Continue normal flow
  6. On failure: Next retry or final failure report
- **Alternative Flows**:
  - 2a. Non-retryable error: Immediate failure report
- **Exception Flows**:
  - E1. Maximum retries exceeded: Circuit Breaker activation
- **Postconditions**:
  1. Task is completed or in final failure state

#### 3.16.2 Acceptance Criteria

- [ ] AC-064: Maximum 3 retries
- [ ] AC-065: Exponential backoff (base 5s, max 60s)
- [ ] AC-066: Circuit Breaker (60s wait after 5 consecutive failures)
- [ ] AC-067: Non-retryable error classification

#### 3.16.3 Dependencies

- **Depends on**: None
- **Blocks**: None

---

### 3.17 Enhancement Pipeline Features

> The following features (SF-017 through SF-031) support the Enhancement Pipeline,
> Infrastructure, and Pipeline requirements defined in FR-017 through FR-033.
> These features enable incremental updates to existing projects, codebase analysis,
> change impact assessment, and automated pipeline orchestration.

---

### SF-017: Document Parsing and State Extraction

**Source**: FR-017
**Priority**: P0
**Description**: Parses existing PRD, SRS, and SDS documents to extract structured state including requirement IDs, feature mappings, component definitions, and current traceability relationships. Builds an internal representation used by downstream enhancement features.

#### 3.17.1 Use Cases

##### UC-025: Parse Existing PRD/SRS/SDS Documents

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. At least one existing document (PRD, SRS, or SDS) exists in the project
  2. Documents follow the standard AD-SDLC template structure
- **Main Flow**:
  1. System scans the document directory for existing PRD, SRS, and SDS files
  2. System parses each document extracting sections, IDs, and structured content
  3. System validates extracted data against expected schemas (FR-XXX, SF-XXX, CMP-XXX)
  4. System stores parsed state in `document_state.yaml` within the Scratchpad
- **Alternative Flows**:
  - 2a. Non-standard document format: Attempt best-effort extraction with warnings
- **Exception Flows**:
  - E1. Document parsing failure: Log error details and report unparseable sections
- **Postconditions**:
  1. `document_state.yaml` contains structured representation of all parsed documents
  2. All requirement IDs, feature IDs, and component IDs are catalogued

##### UC-026: Build Traceability Mapping from Parsed Documents

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. `document_state.yaml` exists with parsed document content
- **Main Flow**:
  1. System extracts FR → SF mappings from SRS traceability sections
  2. System extracts SF → CMP mappings from SDS traceability sections
  3. System identifies orphaned or unmapped items
  4. System generates `existing_traceability.json` with complete mapping
- **Alternative Flows**:
  - 3a. No orphaned items: Mark traceability as complete
- **Postconditions**:
  1. `existing_traceability.json` is saved to Scratchpad
  2. Coverage gaps are identified and reported

#### 3.17.2 Acceptance Criteria

- [ ] AC-068: Parse PRD documents extracting all FR-XXX identifiers and metadata
- [ ] AC-069: Parse SRS documents extracting all SF-XXX and UC-XXX identifiers
- [ ] AC-070: Parse SDS documents extracting all CMP-XXX and API-XXX identifiers
- [ ] AC-071: Generate valid `document_state.yaml` conforming to schema
- [ ] AC-072: Build complete FR→SF→CMP traceability mapping

#### 3.17.3 Dependencies

- **Depends on**: SF-014 (Scratchpad State Management)
- **Blocks**: SF-019, SF-020, SF-021, SF-022, SF-024

---

### SF-018: Codebase Structure Analysis

**Source**: FR-018
**Priority**: P0
**Description**: Analyzes the existing source code to extract architecture patterns, module structure, dependency relationships, and coding conventions. Produces a structured overview used for change impact analysis and incremental document updates.

#### 3.18.1 Use Cases

##### UC-027: Analyze Source Code Architecture and Patterns

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. Project source code directory exists
  2. SF-025 (AST Analysis) is available for detailed extraction
- **Main Flow**:
  1. System scans the project directory tree and identifies source files by language
  2. System detects framework and build tool conventions (e.g., package.json, pyproject.toml)
  3. System identifies architectural patterns (layered, modular, microservices)
  4. System records coding conventions (naming, structure, patterns in use)
  5. System saves `codebase_overview.yaml` to Scratchpad
- **Alternative Flows**:
  - 1a. Empty or minimal codebase: Record as greenfield-compatible state
- **Exception Flows**:
  - E1. Unrecognized project structure: Log warning and produce partial analysis
- **Postconditions**:
  1. `codebase_overview.yaml` contains project structure and pattern analysis

##### UC-028: Generate Architecture Overview and Dependency Graph

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. Source code analysis from UC-027 is complete
- **Main Flow**:
  1. System maps module-to-module import and dependency relationships
  2. System identifies external library dependencies and their versions
  3. System generates a dependency graph in `codebase_dependencies.json`
  4. System produces a human-readable architecture summary
- **Alternative Flows**:
  - 1a. Circular dependencies detected: Flag and include in report
- **Postconditions**:
  1. `codebase_dependencies.json` is saved to Scratchpad
  2. Architecture summary is available for downstream features

#### 3.18.2 Acceptance Criteria

- [ ] AC-073: Detect primary programming language(s) and frameworks
- [ ] AC-074: Identify at least 1 architectural pattern in the codebase
- [ ] AC-075: Generate module dependency graph in JSON format
- [ ] AC-076: Produce `codebase_overview.yaml` with structure and conventions

#### 3.18.3 Dependencies

- **Depends on**: SF-025 (Source Code AST Analysis)
- **Blocks**: SF-019

---

### SF-019: Change Impact Analysis

**Source**: FR-019
**Priority**: P0
**Description**: Analyzes the scope of proposed changes against existing documents and codebase to determine affected components, risk levels, and recommended actions. Enables informed decision-making before applying incremental updates.

#### 3.19.1 Use Cases

##### UC-029: Analyze Change Scope and Affected Components

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. Document state from SF-017 is available
  2. Codebase analysis from SF-018 is available
  3. Change request or new requirements are provided
- **Main Flow**:
  1. System compares new/changed requirements against existing document state
  2. System traces affected features, components, and code modules via traceability mappings
  3. System identifies directly affected and transitively affected items
  4. System categorizes changes as additions, modifications, or deprecations
  5. System saves `impact_analysis.yaml` to Scratchpad
- **Alternative Flows**:
  - 2a. No traceability data available: Perform text-based similarity matching
- **Postconditions**:
  1. `impact_analysis.yaml` contains full change scope and affected item list

##### UC-030: Assess Risk Levels and Generate Recommendations

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. `impact_analysis.yaml` exists
- **Main Flow**:
  1. System scores each affected component by change complexity and dependency count
  2. System assigns risk levels (Low / Medium / High / Critical)
  3. System generates prioritized recommendations for the update sequence
  4. System appends risk assessment to `impact_analysis.yaml`
- **Alternative Flows**:
  - 1a. All changes are additions with no existing dependencies: Assign Low risk
- **Postconditions**:
  1. Risk levels and recommendations are recorded in `impact_analysis.yaml`

#### 3.19.2 Acceptance Criteria

- [ ] AC-077: Identify all directly affected documents, features, and components
- [ ] AC-078: Trace transitive impact through traceability chains
- [ ] AC-079: Assign risk levels (Low/Medium/High/Critical) to each affected item
- [ ] AC-080: Generate ordered recommendation list for update sequence

#### 3.19.3 Dependencies

- **Depends on**: SF-017, SF-018
- **Blocks**: SF-020, SF-021, SF-022

---

### SF-020: PRD Incremental Update

**Source**: FR-020
**Priority**: P0
**Description**: Supports adding, modifying, or deprecating functional requirements in an existing PRD while preserving document structure, existing content, and ID continuity.

#### 3.20.1 Use Cases

##### UC-031: Add, Modify, or Deprecate Requirements

- **Actor**: System (PRD Writer Agent), Product Manager
- **Preconditions**:
  1. Existing PRD is parsed (SF-017)
  2. Impact analysis is complete (SF-019)
  3. New or changed requirements are specified
- **Main Flow**:
  1. System loads existing PRD and parsed document state
  2. System applies additions (new FR-XXX entries with next available ID)
  3. System applies modifications (update description, priority, or scope of existing FRs)
  4. System marks deprecated requirements with `[DEPRECATED]` tag and rationale
  5. System regenerates affected sections while preserving unchanged content
  6. System saves updated PRD and requests user approval
- **Alternative Flows**:
  - 4a. Deprecation affects downstream SRS/SDS: Include cascade warning
- **Exception Flows**:
  - E1. ID conflict detected: Resolve by using next available ID and logging
- **Postconditions**:
  1. Updated PRD is saved with new, modified, and deprecated requirements
  2. Change log entry is appended to the PRD

#### 3.20.2 Acceptance Criteria

- [ ] AC-081: Add new requirements with sequential FR-XXX IDs
- [ ] AC-082: Modify existing requirements while preserving their IDs
- [ ] AC-083: Mark deprecated requirements with tag and rationale
- [ ] AC-084: Preserve all unchanged sections of the document
- [ ] AC-085: Require user approval before finalizing changes

#### 3.20.3 Dependencies

- **Depends on**: SF-017, SF-019
- **Blocks**: SF-021

---

### SF-021: SRS Incremental Update

**Source**: FR-021
**Priority**: P0
**Description**: Updates features and use cases in an existing SRS to reflect PRD changes, maintaining PRD→SRS traceability and preserving existing content that is unaffected by the change.

#### 3.21.1 Use Cases

##### UC-032: Update Features and Use Cases Maintaining PRD→SRS Traceability

- **Actor**: System (SRS Writer Agent)
- **Preconditions**:
  1. Updated PRD is approved
  2. Existing SRS is parsed (SF-017)
  3. Impact analysis identifies affected SRS sections (SF-019)
- **Main Flow**:
  1. System loads existing SRS and traceability mapping
  2. System adds new SF-XXX features for new PRD requirements
  3. System generates new UC-XXX use cases for new features
  4. System updates existing features/use cases affected by modified requirements
  5. System marks features/use cases linked to deprecated requirements
  6. System regenerates the PRD→SRS traceability matrix section
  7. System saves updated SRS
- **Alternative Flows**:
  - 5a. Deprecated feature has no remaining references: Mark as `[DEPRECATED]`
- **Exception Flows**:
  - E1. Traceability chain broken: Report missing links and request resolution
- **Postconditions**:
  1. Updated SRS maintains 100% coverage of active PRD requirements
  2. PRD→SRS traceability matrix is current

#### 3.21.2 Acceptance Criteria

- [ ] AC-086: Add new features with sequential SF-XXX IDs
- [ ] AC-087: Generate use cases for each new feature
- [ ] AC-088: Update traceability matrix to reflect all changes
- [ ] AC-089: Preserve unaffected features and use cases
- [ ] AC-090: Maintain 100% coverage of active PRD requirements

#### 3.21.3 Dependencies

- **Depends on**: SF-017, SF-019, SF-020
- **Blocks**: SF-022

---

### SF-022: SDS Incremental Update

**Source**: FR-022
**Priority**: P0
**Description**: Updates components and APIs in an existing SDS to reflect SRS changes, maintaining SRS→SDS traceability and preserving unchanged design elements.

#### 3.22.1 Use Cases

##### UC-033: Update Components and APIs Maintaining SRS→SDS Traceability

- **Actor**: System (SDS Writer Agent)
- **Preconditions**:
  1. Updated SRS is approved
  2. Existing SDS is parsed (SF-017)
  3. Impact analysis identifies affected SDS sections (SF-019)
- **Main Flow**:
  1. System loads existing SDS and traceability mapping
  2. System adds new CMP-XXX components for new SRS features
  3. System designs or updates API endpoints affected by changes
  4. System updates data models and schemas as needed
  5. System regenerates the SRS→SDS traceability matrix section
  6. System saves updated SDS
- **Alternative Flows**:
  - 2a. New feature maps to existing component: Extend component rather than creating new
- **Exception Flows**:
  - E1. Architecture conflict: Present options to user for resolution
- **Postconditions**:
  1. Updated SDS maintains 100% coverage of active SRS features
  2. SRS→SDS traceability matrix is current

#### 3.22.2 Acceptance Criteria

- [ ] AC-091: Add new components with sequential CMP-XXX IDs
- [ ] AC-092: Update API specifications for changed features
- [ ] AC-093: Update traceability matrix to reflect all changes
- [ ] AC-094: Preserve unaffected components and APIs
- [ ] AC-095: Maintain 100% coverage of active SRS features

#### 3.22.3 Dependencies

- **Depends on**: SF-017, SF-019, SF-021
- **Blocks**: SF-005 (Issue Auto-Generation)

---

### SF-023: Regression Testing

**Source**: FR-023
**Priority**: P1
**Description**: Maps affected tests based on change impact analysis and coordinates execution of regression test suites to verify that changes do not break existing functionality.

#### 3.23.1 Use Cases

##### UC-034: Map Affected Tests and Run Regression Suite

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. Impact analysis is complete (SF-019)
  2. Test suite exists in the project
  3. Affected components and code modules are identified
- **Main Flow**:
  1. System identifies test files associated with affected components
  2. System determines the minimal regression test set
  3. System executes the regression test suite
  4. System collects test results and coverage data
  5. System generates `regression_report.yaml` with pass/fail summary
- **Alternative Flows**:
  - 1a. No tests exist for affected components: Report coverage gap
  - 3a. Full regression requested: Run entire test suite
- **Exception Flows**:
  - E1. Test execution environment unavailable: Report setup requirements
- **Postconditions**:
  1. `regression_report.yaml` is saved to Scratchpad
  2. Test failures are flagged for resolution before proceeding

#### 3.23.2 Acceptance Criteria

- [ ] AC-096: Map test files to affected components
- [ ] AC-097: Execute targeted regression test set
- [ ] AC-098: Report pass/fail results with coverage metrics
- [ ] AC-099: Flag regressions as blockers for pipeline continuation

#### 3.23.3 Dependencies

- **Depends on**: SF-019
- **Blocks**: None

---

### SF-024: Document-Code Gap Analysis

**Source**: FR-024
**Priority**: P1
**Description**: Compares document specifications (PRD, SRS, SDS) against the actual implementation to identify discrepancies, unimplemented features, undocumented code, and specification drift.

#### 3.24.1 Use Cases

##### UC-035: Compare Document Specifications Against Implementation

- **Actor**: System (Enhancement Pipeline), Tech Lead
- **Preconditions**:
  1. Parsed document state exists (SF-017)
  2. Codebase analysis is complete (SF-018)
- **Main Flow**:
  1. System maps SDS components to actual source code modules
  2. System identifies specified but unimplemented features
  3. System identifies implemented but undocumented functionality
  4. System detects specification drift (implementation deviates from spec)
  5. System generates `gap_analysis_report.yaml` with categorized findings
- **Alternative Flows**:
  - 2a. All features implemented: Report full implementation coverage
  - 3a. No undocumented code: Report documentation is complete
- **Postconditions**:
  1. `gap_analysis_report.yaml` is saved to Scratchpad
  2. Gaps are categorized by severity and type

#### 3.24.2 Acceptance Criteria

- [ ] AC-100: Identify unimplemented features from SDS specifications
- [ ] AC-101: Identify undocumented code not traced to any specification
- [ ] AC-102: Detect specification drift between documents and code
- [ ] AC-103: Generate categorized gap report with severity levels

#### 3.24.3 Dependencies

- **Depends on**: SF-017, SF-018
- **Blocks**: None

---

### SF-025: Source Code AST Analysis

**Source**: FR-025
**Priority**: P0
**Description**: Performs Abstract Syntax Tree (AST) analysis on source code to extract classes, functions, interfaces, type definitions, and dependency relationships. Provides the structural foundation used by codebase analysis and gap analysis features.

#### 3.25.1 Use Cases

##### UC-036: Extract Classes, Functions, Interfaces and Dependencies from Source Code

- **Actor**: System (Enhancement Pipeline)
- **Preconditions**:
  1. Project source code exists
  2. Programming language is supported (TypeScript, JavaScript, Python, etc.)
- **Main Flow**:
  1. System identifies source files and their languages
  2. System parses each file to extract AST-level constructs (classes, functions, interfaces, types)
  3. System resolves import/export relationships between modules
  4. System builds a structured symbol table with location metadata
  5. System saves `ast_analysis.json` to Scratchpad
- **Alternative Flows**:
  - 2a. Unsupported language: Fall back to regex-based extraction with reduced accuracy
- **Exception Flows**:
  - E1. Syntax errors in source: Log errors and continue with parseable files
- **Postconditions**:
  1. `ast_analysis.json` contains all extracted symbols and relationships
  2. Each symbol includes file path, line number, and type information

#### 3.25.2 Acceptance Criteria

- [ ] AC-104: Extract classes, functions, and interfaces from TypeScript/JavaScript files
- [ ] AC-105: Extract classes, functions, and type hints from Python files
- [ ] AC-106: Resolve import/export dependency relationships
- [ ] AC-107: Generate structured `ast_analysis.json` with location metadata

#### 3.25.3 Dependencies

- **Depends on**: None
- **Blocks**: SF-018

---

### SF-026: CI/CD Failure Auto-fix

**Source**: FR-026
**Priority**: P1
**Description**: Diagnoses CI/CD pipeline failures by analyzing error logs, identifies root causes, and applies automated fixes where possible. Supports iterative retry until the pipeline passes or maximum attempts are reached.

#### 3.26.1 Use Cases

##### UC-037: Diagnose CI Failures and Apply Automated Fixes

- **Actor**: System (Worker Agent)
- **Preconditions**:
  1. CI/CD pipeline has reported a failure
  2. Error logs are accessible
- **Main Flow**:
  1. System retrieves CI failure logs and error output
  2. System classifies the failure type (build, test, lint, type-check, dependency)
  3. System identifies the root cause and affected files
  4. System generates and applies a fix (code change, config update, dependency resolution)
  5. System commits the fix and re-triggers CI pipeline
- **Alternative Flows**:
  - 4a. Fix requires manual intervention: Report diagnosis and suggested fix to user
- **Exception Flows**:
  - E1. Maximum 3 auto-fix attempts exceeded: Escalate to user with full diagnosis
- **Postconditions**:
  1. CI pipeline passes, or user is notified with diagnosis details

#### 3.26.2 Acceptance Criteria

- [ ] AC-108: Retrieve and parse CI failure logs
- [ ] AC-109: Classify failure type with at least 90% accuracy
- [ ] AC-110: Apply automated fix for common failure patterns (lint, type errors, missing deps)
- [ ] AC-111: Maximum 3 auto-fix retry attempts before escalation

#### 3.26.3 Dependencies

- **Depends on**: SF-009 (Self-Verification and Testing)
- **Blocks**: None

---

### SF-027: Pipeline Mode Detection

**Source**: FR-027
**Priority**: P0
**Description**: Automatically detects whether a project should use Greenfield mode (new project) or Enhancement mode (existing project) based on the presence of existing documents, source code, and AD-SDLC configuration.

#### 3.27.1 Use Cases

##### UC-038: Auto-detect Greenfield/Enhancement Mode from Project State

- **Actor**: System (Pipeline Orchestrator)
- **Preconditions**:
  1. Project directory is accessible
- **Main Flow**:
  1. System checks for `.ad-sdlc/` directory and configuration files
  2. System checks for existing PRD, SRS, SDS documents
  3. System checks for existing source code
  4. System applies detection rules:
     - No documents + No code = Greenfield
     - Documents exist OR Code exists = Enhancement
  5. System records detected mode in `pipeline_config.yaml`
- **Alternative Flows**:
  - 4a. Ambiguous state: Prompt user to confirm mode selection
- **Postconditions**:
  1. Pipeline mode (Greenfield or Enhancement) is determined and recorded

#### 3.27.2 Acceptance Criteria

- [ ] AC-112: Detect Greenfield mode for empty projects
- [ ] AC-113: Detect Enhancement mode when documents or code exist
- [ ] AC-114: Allow user override of detected mode
- [ ] AC-115: Record mode in `pipeline_config.yaml`

#### 3.27.3 Dependencies

- **Depends on**: None
- **Blocks**: SF-030

---

### SF-028: Project Initialization

**Source**: FR-028
**Priority**: P0
**Description**: Creates the `.ad-sdlc/` directory structure and initial configuration files required for the AD-SDLC system to operate. Initializes Scratchpad directories, templates, and default settings.

#### 3.28.1 Use Cases

##### UC-039: Create .ad-sdlc Directory Structure and Config Files

- **Actor**: System (Pipeline Orchestrator), User
- **Preconditions**:
  1. Project directory exists
  2. `.ad-sdlc/` directory does not yet exist (or reinitialization is requested)
- **Main Flow**:
  1. System creates `.ad-sdlc/` root directory
  2. System creates subdirectories: `scratchpad/`, `templates/`, `config/`
  3. System generates default `config.yaml` with pipeline settings
  4. System copies document templates (PRD, SRS, SDS) to `templates/`
  5. System initializes Scratchpad subdirectories (info, documents, issues, progress)
- **Alternative Flows**:
  - 2a. Directory already exists: Prompt user to confirm reinitialization or skip
- **Exception Flows**:
  - E1. Permission denied: Report file system permission error
- **Postconditions**:
  1. `.ad-sdlc/` directory structure is fully initialized
  2. Default configuration and templates are in place

#### 3.28.2 Acceptance Criteria

- [ ] AC-116: Create complete `.ad-sdlc/` directory hierarchy
- [ ] AC-117: Generate valid default `config.yaml`
- [ ] AC-118: Include all required document templates
- [ ] AC-119: Idempotent execution (safe to run multiple times)

#### 3.28.3 Dependencies

- **Depends on**: None
- **Blocks**: SF-027, SF-014

---

### SF-029: GitHub Repository Management

**Source**: FR-029, FR-030
**Priority**: P1
**Description**: Creates and initializes GitHub repositories for new projects, and detects existing repository presence for enhancement workflows. Handles repository setup including README, .gitignore, and initial commit.

#### 3.29.1 Use Cases

##### UC-040: Create and Initialize GitHub Repository

- **Actor**: System (Pipeline Orchestrator), User
- **Preconditions**:
  1. GitHub CLI is authenticated
  2. Repository name is specified
  3. No existing repository with the same name
- **Main Flow**:
  1. System creates a new GitHub repository using `gh repo create`
  2. System initializes with README.md and .gitignore
  3. System creates initial commit with project scaffold
  4. System pushes initial commit to remote
  5. System records repository URL in `pipeline_config.yaml`
- **Alternative Flows**:
  - 1a. Private repository requested: Add `--private` flag
- **Exception Flows**:
  - E1. Repository name conflict: Suggest alternative name or prompt user
  - E2. Authentication failure: Guide user through `gh auth login`
- **Postconditions**:
  1. GitHub repository is created and initialized
  2. Local git is configured with remote origin

##### UC-041: Detect Existing Repository Presence

- **Actor**: System (Pipeline Orchestrator)
- **Preconditions**:
  1. Project directory exists
- **Main Flow**:
  1. System checks for `.git/` directory in the project
  2. System reads remote origin URL if present
  3. System verifies GitHub repository accessibility via `gh repo view`
  4. System records repository status in `pipeline_config.yaml`
- **Alternative Flows**:
  - 1a. No `.git/` directory: Record as no repository
  - 3a. Remote inaccessible: Record as local-only repository
- **Postconditions**:
  1. Repository presence and accessibility status is recorded

#### 3.29.2 Acceptance Criteria

- [ ] AC-120: Create GitHub repository with correct visibility settings
- [ ] AC-121: Initialize repository with README and .gitignore
- [ ] AC-122: Detect existing repository and extract remote URL
- [ ] AC-123: Handle authentication and permission errors gracefully

#### 3.29.3 Dependencies

- **Depends on**: SF-028
- **Blocks**: SF-005 (Issue Auto-Generation)

---

### SF-030: Pipeline Orchestration

**Source**: FR-031, FR-032
**Priority**: P0
**Description**: Coordinates the execution of the full AD-SDLC pipeline (Greenfield or Enhancement mode), managing stage transitions, approval gates, and error handling across the entire workflow.

#### 3.30.1 Use Cases

##### UC-042: Coordinate Full Pipeline Execution

- **Actor**: System (Pipeline Orchestrator), User
- **Preconditions**:
  1. Project is initialized (SF-028)
  2. Pipeline mode is detected (SF-027)
  3. Input requirements or change request is provided
- **Main Flow**:
  1. System determines pipeline mode and selects stage sequence
  2. For Greenfield: Execute Collection → PRD → SRS → SDS → Issues → Implementation
  3. For Enhancement: Execute Analysis → Impact → Update → Issues → Implementation
  4. System manages approval gates between stages
  5. System tracks overall pipeline progress and reports status
- **Alternative Flows**:
  - 4a. Approval rejected: Collect feedback and re-execute current stage
  - 5a. Stage failure: Halt pipeline and report failure details
- **Exception Flows**:
  - E1. Unrecoverable error: Save pipeline state for resume capability
- **Postconditions**:
  1. Pipeline completes all stages or is paused at a defined checkpoint

##### UC-043: Coordinate Enhancement Analysis Sub-pipeline

- **Actor**: System (Pipeline Orchestrator)
- **Preconditions**:
  1. Enhancement mode is selected
  2. Existing documents and/or codebase are present
- **Main Flow**:
  1. System executes Document Parsing (SF-017) to extract current state
  2. System executes Codebase Analysis (SF-018) if source code exists
  3. System executes Change Impact Analysis (SF-019)
  4. System presents impact report to user for approval
  5. On approval, system proceeds to incremental document updates
- **Alternative Flows**:
  - 2a. No source code: Skip codebase analysis step
- **Postconditions**:
  1. Enhancement analysis is complete
  2. Impact report is approved and incremental updates can proceed

#### 3.30.2 Acceptance Criteria

- [ ] AC-124: Execute Greenfield pipeline with all stages in correct order
- [ ] AC-125: Execute Enhancement pipeline with analysis-first approach
- [ ] AC-126: Manage approval gates between all stages
- [ ] AC-127: Support pipeline pause and resume on failure

#### 3.30.3 Dependencies

- **Depends on**: SF-027, SF-028
- **Blocks**: All pipeline stages

---

### SF-031: Issue Import

**Source**: FR-033
**Priority**: P1
**Description**: Imports existing GitHub Issues from a repository and converts them into the AD-SDLC format, enabling the system to incorporate externally created issues into its tracking and traceability framework.

#### 3.31.1 Use Cases

##### UC-044: Import GitHub Issues and Convert to AD-SDLC Format

- **Actor**: System (Pipeline Orchestrator), Tech Lead
- **Preconditions**:
  1. GitHub CLI is authenticated
  2. Target repository contains existing issues
- **Main Flow**:
  1. System fetches open issues from the GitHub repository using `gh issue list`
  2. System parses issue titles, bodies, labels, and metadata
  3. System maps issues to AD-SDLC categories (feature, bug, enhancement, task)
  4. System assigns AD-SDLC labels and links to existing SDS components where possible
  5. System saves imported issues to `imported_issues.json` in Scratchpad
- **Alternative Flows**:
  - 4a. No matching SDS component: Mark as unlinked for manual mapping
  - 2a. Issues with AD-SDLC labels already: Skip re-import
- **Exception Flows**:
  - E1. API rate limit: Apply backoff and retry strategy
- **Postconditions**:
  1. `imported_issues.json` contains all imported issues in AD-SDLC format
  2. Issues are available for dependency analysis and work prioritization

#### 3.31.2 Acceptance Criteria

- [ ] AC-128: Fetch and parse all open issues from target repository
- [ ] AC-129: Convert issues to AD-SDLC format with proper categorization
- [ ] AC-130: Link imported issues to existing SDS components where traceable
- [ ] AC-131: Handle duplicate imports idempotently

#### 3.31.3 Dependencies

- **Depends on**: SF-017, SF-029
- **Blocks**: SF-006 (Work Prioritization)

---

## 4. External Interface Requirements

### 4.1 User Interfaces

AD-SDLC is a CLI-based system, primarily interacting through Claude Code CLI.

| Interface ID | Name | Description |
|--------------|------|-------------|
| UI-001 | CLI Input | Natural language text input interface |
| UI-002 | File Path Input | File path specification interface |
| UI-003 | URL Input | URL input interface |
| UI-004 | Approval Prompt | Approve/Reject selection prompt |
| UI-005 | Progress Display | Progress status text output |

### 4.2 API Interfaces

| Endpoint | Method | Description | Agent |
|----------|--------|-------------|-------|
| GitHub Issues API | POST | Create issue | Issue Generator |
| GitHub Issues API | PATCH | Update issue status | Controller, PR Review |
| GitHub PRs API | POST | Create PR | PR Review |
| GitHub PRs API | POST | Submit review | PR Review |
| GitHub PRs API | PUT | Merge PR | PR Review |
| Claude API | POST | Agent inference | All Agents |

### 4.3 File Interfaces

| Interface ID | Path Pattern | Format | Description |
|--------------|--------------|--------|-------------|
| FI-001 | `.ad-sdlc/scratchpad/info/{id}/collected_info.yaml` | YAML | Collected information |
| FI-002 | `.ad-sdlc/scratchpad/documents/{id}/prd.md` | Markdown | PRD document |
| FI-003 | `.ad-sdlc/scratchpad/documents/{id}/srs.md` | Markdown | SRS document |
| FI-004 | `.ad-sdlc/scratchpad/documents/{id}/sds.md` | Markdown | SDS document |
| FI-005 | `.ad-sdlc/scratchpad/issues/{id}/issue_list.json` | JSON | Issue list |
| FI-006 | `.ad-sdlc/scratchpad/issues/{id}/dependency_graph.json` | JSON | Dependency graph |
| FI-007 | `.ad-sdlc/scratchpad/progress/{id}/controller_state.yaml` | YAML | Controller state |
| FI-008 | `.ad-sdlc/scratchpad/progress/{id}/work_orders/*.yaml` | YAML | Work orders |
| FI-009 | `.ad-sdlc/scratchpad/progress/{id}/results/*.yaml` | YAML | Implementation results |
| FI-010 | `.ad-sdlc/scratchpad/progress/{id}/reviews/*.yaml` | YAML | Review results |

### 4.4 External System Interfaces

| System | Protocol | Purpose |
|--------|----------|---------|
| GitHub | HTTPS + OAuth | Issue and PR management |
| Claude API | HTTPS | Agent inference |
| Web URLs | HTTP/HTTPS | External document collection |

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| ID | Requirement | Metric | Target | Priority |
|----|-------------|--------|--------|----------|
| NFR-001 | Document generation response time | Time | < 5 min / document | P0 |
| NFR-002 | Issue creation throughput | Issues/min | > 20 | P0 |
| NFR-003 | Concurrent Worker execution | Count | Maximum 5 | P0 |
| NFR-004 | Status check interval | Seconds | 30s | P1 |
| NFR-005 | PR review completion time | Time | < 5 min | P1 |

### 5.2 Reliability Requirements

| ID | Requirement | Metric | Target | Priority |
|----|-------------|--------|--------|----------|
| NFR-006 | System availability | Percentage | 99.5% | P1 |
| NFR-007 | Document generation success rate | Percentage | > 95% | P0 |
| NFR-008 | Code implementation success rate | Percentage | > 85% | P0 |
| NFR-009 | Data loss prevention | Percentage | 100% | P0 |
| NFR-010 | Recovery rate after retry | Percentage | > 90% | P1 |

### 5.3 Security Requirements

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| NFR-011 | Secure API key storage | Use environment variables or Secret Manager | P0 |
| NFR-012 | Sensitive information masking | Auto-mask tokens and passwords in logs | P0 |
| NFR-013 | GitHub authentication | OAuth or PAT-based authentication | P0 |
| NFR-014 | Code security check | Prohibit hardcoded secrets in generated code | P0 |
| NFR-015 | Input validation | Validate user input and external data | P1 |

### 5.4 Maintainability Requirements

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| NFR-016 | Configuration externalization | Use YAML-based configuration files | P0 |
| NFR-017 | Template customization | Support user-defined document templates | P1 |
| NFR-018 | Log level adjustment | DEBUG/INFO/WARN/ERROR runtime adjustment | P1 |
| NFR-019 | Agent definition separation | Independent definition file per agent | P0 |
| NFR-020 | Workflow configuration | Pipeline stage and approval gate configuration | P1 |

### 5.5 Scalability Requirements

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| NFR-021 | Parallel Worker scaling | Maximum Worker count configurable via settings | P1 |
| NFR-022 | Large document processing | Process large inputs via context splitting | P1 |

---

## 6. Data Requirements

> **Naming Convention Note**: Data entity schemas in this document use `snake_case`
> field names (e.g., `file_path`, `issue_id`, `review_status`) following YAML/document
> conventions. The TypeScript implementation uses `camelCase` (e.g., `filePath`, `issueId`,
> `reviewStatus`) following JavaScript/TypeScript conventions. Serialization/deserialization
> between these formats is handled transparently by the data-plane layer. When comparing
> schema fields between this SRS and TypeScript source code, apply the snake_case-to-camelCase
> mapping rule.

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
│       ├──────────────────────────────────────────┐                     │
│       ▼                                          ▼                     │
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
| DC-001 | FR ID uniqueness | `FR-XXX` format, unique within project |
| DC-002 | SF ID uniqueness | `SF-XXX` format, unique within SRS |
| DC-003 | CMP ID uniqueness | `CMP-XXX` format, unique within SDS |
| DC-004 | Priority values | One of P0, P1, P2, P3 |
| DC-005 | Issue status | One of open, in_progress, closed |
| DC-006 | Work Order and Issue 1:1 | One Work Order per Issue |

---

## 7. Traceability Matrix

### 7.1 PRD → SRS Traceability

| PRD Requirement | SRS Features | Use Cases |
|-----------------|--------------|-----------|
| FR-001 (Information Collection) | SF-001 | UC-001, UC-002, UC-003 |
| FR-002 (PRD Generation) | SF-002 | UC-004, UC-005 |
| FR-003 (SRS Generation) | SF-003 | UC-006 |
| FR-004 (SDS Generation) | SF-004 | UC-007 |
| FR-005 (Issue Generation) | SF-005 | UC-008 |
| FR-006 (Dependency Analysis) | SF-006, SF-007 | UC-009, UC-010, UC-011 |
| FR-007 (Code Implementation) | SF-008, SF-009 | UC-012, UC-013 |
| FR-008 (PR Creation/Review) | SF-010, SF-011 | UC-014, UC-015, UC-016 |
| FR-009 (Traceability) | SF-012 | UC-017, UC-018 |
| FR-010 (Approval Gates) | SF-013 | UC-019 |
| FR-011 (Monitoring) | SF-007 | UC-011 |
| FR-012 (Retry) | SF-009, SF-016 | UC-013, UC-024 |
| FR-013 (Logging) | SF-015 | UC-022, UC-023 |
| FR-014 (GitHub Integration) | SF-005, SF-010, SF-011 | UC-008, UC-014, UC-015, UC-016 |
| FR-015 (Scratchpad) | SF-014 | UC-020, UC-021 |
| FR-016 (External Sources) | SF-001 | UC-002, UC-003 |
| FR-017 (Document Parsing) | SF-017 | UC-025, UC-026 |
| FR-018 (Codebase Analysis) | SF-018 | UC-027, UC-028 |
| FR-019 (Change Impact Analysis) | SF-019 | UC-029, UC-030 |
| FR-020 (PRD Incremental Update) | SF-020 | UC-031 |
| FR-021 (SRS Incremental Update) | SF-021 | UC-032 |
| FR-022 (SDS Incremental Update) | SF-022 | UC-033 |
| FR-023 (Regression Testing) | SF-023 | UC-034 |
| FR-024 (Document-Code Gap Analysis) | SF-024 | UC-035 |
| FR-025 (Source Code AST Analysis) | SF-025 | UC-036 |
| FR-026 (CI/CD Failure Auto-fix) | SF-026 | UC-037 |
| FR-027 (Pipeline Mode Detection) | SF-027 | UC-038 |
| FR-028 (Project Initialization) | SF-028 | UC-039 |
| FR-029 (GitHub Repo Creation) | SF-029 | UC-040, UC-041 |
| FR-030 (GitHub Repo Detection) | SF-029 | UC-041 |
| FR-031 (Full Pipeline Orchestration) | SF-030 | UC-042, UC-043 |
| FR-032 (Enhancement Sub-pipeline) | SF-030 | UC-043 |
| FR-033 (Issue Import) | SF-031 | UC-044 |

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
| **Agent** | Autonomous execution unit using Claude API |
| **Circuit Breaker** | Pattern to temporarily halt on consecutive failures |
| **Context Window** | Number of tokens the model can process at once |
| **Feature Branch** | Git branch for developing a specific feature |
| **Gap Analysis** | Identification of missing information or requirements |
| **Quality Gate** | Quality verification checkpoint for proceeding to next stage |
| **Squash Merge** | Merging multiple commits into one |
| **Topological Sort** | Ordering of dependency graph |
| **Work Breakdown** | Decomposing work into implementation units |

### 8.2 Open Issues

| Issue ID | Description | Status | Owner |
|----------|-------------|--------|-------|
| OI-001 | Multi-repository support scope decision | Open | Architect |
| OI-002 | External test service integration options | Open | Tech Lead |
| OI-003 | Non-English codebase support | Open | PM |

### 8.3 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-27 | System Architect | Initial draft based on PRD-001 |
| 1.1.0 | 2026-02-07 | System Architect | Added Enhancement Pipeline features (SF-017~SF-031, UC-025~UC-044) for FR-017~FR-033 |

---

*This SRS was generated for the Agent-Driven SDLC project based on PRD-001.*
