# AD-SDLC System Architecture

## 1. High-Level Agent Flow

```mermaid
flowchart TB
    subgraph Input["User Input Layer"]
        UI[User Input]
        FILES[Files/URLs]
    end

    subgraph DocumentPipeline["Document Generation Pipeline"]
        direction LR
        COLLECT[Collector Agent]
        PRD[PRD Writer Agent]
        SRS[SRS Writer Agent]
        SDS[SDS Writer Agent]
    end

    subgraph IssuePipeline["Issue Management Pipeline"]
        direction LR
        ISSUE[Issue Generator Agent]
        CTRL[Controller Agent]
    end

    subgraph ExecutionPipeline["Execution Pipeline"]
        direction TB
        WORKER1[Worker Agent 1]
        WORKER2[Worker Agent 2]
        WORKERN[Worker Agent N]
        PR[PR Review Agent]
    end

    subgraph EnhancementPipeline["Enhancement Pipeline"]
        direction LR
        DOCREAD[Document Reader Agent]
        CODEBASE[Codebase Analyzer Agent]
        IMPACT[Impact Analyzer Agent]
    end

    subgraph Output["Output Layer"]
        DOCS[Generated Documents]
        ISSUES[GitHub Issues]
        CODE[Source Code]
        PRS[Pull Requests]
    end

    UI --> COLLECT
    FILES --> COLLECT

    COLLECT --> PRD
    PRD --> SRS
    SRS --> SDS

    SDS --> ISSUE
    ISSUE --> CTRL

    CTRL --> WORKER1
    CTRL --> WORKER2
    CTRL --> WORKERN

    WORKER1 --> PR
    WORKER2 --> PR
    WORKERN --> PR

    COLLECT -.-> DOCS
    PRD -.-> DOCS
    SRS -.-> DOCS
    SDS -.-> DOCS
    ISSUE -.-> ISSUES
    WORKER1 -.-> CODE
    WORKER2 -.-> CODE
    WORKERN -.-> CODE
    PR -.-> PRS

    %% Enhancement Pipeline connections
    DOCS --> DOCREAD
    CODE --> CODEBASE
    DOCREAD --> IMPACT
    CODEBASE --> IMPACT
    IMPACT -.-> CTRL
```

## 2. Agent Communication Pattern

```mermaid
flowchart TB
    subgraph Orchestrator["Main Orchestrator"]
        MAIN[Main Claude Agent]
    end

    subgraph Subagents["Specialized Subagents"]
        A1[Collector]
        A2[PRD Writer]
        A3[SRS Writer]
        A4[SDS Writer]
        A5[Issue Generator]
        A6[Controller]
        A7[Worker]
        A8[PR Reviewer]
        A9[Document Reader]
        A10[Codebase Analyzer]
        A11[Impact Analyzer]
    end

    subgraph Scratchpad["File-based State (Scratchpad)"]
        S1[info/*.yaml]
        S2[docs/prd/*.md]
        S3[docs/srs/*.md]
        S4[docs/sds/*.md]
        S5[issues/*.json]
        S6[progress/*.yaml]
        S7[state/current_state.yaml]
        S8[analysis/architecture_overview.yaml]
        S9[analysis/dependency_graph.json]
        S10[impact/impact_report.yaml]
    end

    MAIN -->|spawn| A1
    MAIN -->|spawn| A2
    MAIN -->|spawn| A3
    MAIN -->|spawn| A4
    MAIN -->|spawn| A5
    MAIN -->|spawn| A6
    MAIN -->|spawn| A7
    MAIN -->|spawn| A8
    MAIN -->|spawn| A9
    MAIN -->|spawn| A10
    MAIN -->|spawn| A11

    A1 -->|write| S1
    A2 -->|read| S1
    A2 -->|write| S2
    A3 -->|read| S2
    A3 -->|write| S3
    A4 -->|read| S3
    A4 -->|write| S4
    A5 -->|read| S4
    A5 -->|write| S5
    A6 -->|read| S5
    A6 -->|write| S6
    A7 -->|read| S5
    A7 -->|read| S6
    A8 -->|read| S6

    %% Enhancement Pipeline file access
    A9 -->|read| S2
    A9 -->|read| S3
    A9 -->|read| S4
    A9 -->|write| S7
    A10 -->|write| S8
    A10 -->|write| S9
    A11 -->|read| S7
    A11 -->|read| S8
    A11 -->|read| S9
    A11 -->|write| S10

    A1 -.->|result| MAIN
    A2 -.->|result| MAIN
    A3 -.->|result| MAIN
    A4 -.->|result| MAIN
    A5 -.->|result| MAIN
    A6 -.->|result| MAIN
    A7 -.->|result| MAIN
    A8 -.->|result| MAIN
    A9 -.->|result| MAIN
    A10 -.->|result| MAIN
    A11 -.->|result| MAIN
```

## 3. Document Traceability Flow

```mermaid
flowchart LR
    subgraph PRD["PRD"]
        FR001[FR-001: User Auth]
        FR002[FR-002: Dashboard]
        FR003[FR-003: Reports]
    end

    subgraph SRS["SRS"]
        SF001[SF-001: Login]
        SF002[SF-002: Session]
        SF003[SF-003: Dashboard View]
        SF004[SF-004: Report Gen]
    end

    subgraph SDS["SDS"]
        CMP001[CMP-001: AuthService]
        CMP002[CMP-002: SessionMgr]
        CMP003[CMP-003: DashboardCtrl]
        CMP004[CMP-004: ReportEngine]
    end

    subgraph Issues["GitHub Issues"]
        I001["#1: Implement AuthService"]
        I002["#2: Add SessionMgr"]
        I003["#3: Create Dashboard API"]
        I004["#4: Build ReportEngine"]
    end

    FR001 --> SF001
    FR001 --> SF002
    FR002 --> SF003
    FR003 --> SF004

    SF001 --> CMP001
    SF002 --> CMP002
    SF003 --> CMP003
    SF004 --> CMP004

    CMP001 --> I001
    CMP002 --> I002
    CMP003 --> I003
    CMP004 --> I004
```

## 4. Controller Agent Work Distribution

```mermaid
flowchart TB
    subgraph IssueQueue["Issue Queue"]
        Q1["#1 (P0, no deps)"]
        Q2["#2 (P0, blocked by #1)"]
        Q3["#3 (P1, no deps)"]
        Q4["#4 (P1, blocked by #3)"]
        Q5["#5 (P2, no deps)"]
    end

    subgraph Controller["Controller Agent"]
        PRIO[Priority Analyzer]
        DEP[Dependency Resolver]
        ASSIGN[Work Assigner]
    end

    subgraph Workers["Worker Pool"]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
    end

    subgraph Status["Status Tracking"]
        DONE[Completed]
        PROG[In Progress]
        WAIT[Waiting]
    end

    Q1 --> PRIO
    Q2 --> PRIO
    Q3 --> PRIO
    Q4 --> PRIO
    Q5 --> PRIO

    PRIO --> DEP
    DEP --> ASSIGN

    ASSIGN --> W1
    ASSIGN --> W2
    ASSIGN --> W3

    W1 --> DONE
    W2 --> PROG
    W3 --> PROG

    DONE --> DEP
```

## 5. State Machine

```mermaid
stateDiagram-v2
    [*] --> Collecting: User Input

    Collecting --> Clarifying: Need More Info
    Clarifying --> Collecting: User Response
    Collecting --> PRD_Drafting: Info Complete

    PRD_Drafting --> PRD_Review: Draft Ready
    PRD_Review --> PRD_Drafting: Revisions Needed
    PRD_Review --> SRS_Drafting: Approved

    SRS_Drafting --> SRS_Review: Draft Ready
    SRS_Review --> SRS_Drafting: Revisions Needed
    SRS_Review --> SDS_Drafting: Approved

    SDS_Drafting --> SDS_Review: Draft Ready
    SDS_Review --> SDS_Drafting: Revisions Needed
    SDS_Review --> Issues_Creating: Approved

    Issues_Creating --> Work_Assigning: Issues Created
    Work_Assigning --> Implementing: Assigned

    Implementing --> PR_Creating: Code Complete
    PR_Creating --> PR_Reviewing: PR Created
    PR_Reviewing --> Implementing: Changes Requested
    PR_Reviewing --> Merged: Approved

    Merged --> Work_Assigning: More Issues
    Merged --> [*]: All Complete
```

## 6. Error Handling & Retry Flow

```mermaid
flowchart TB
    START[Agent Task Start]
    EXEC[Execute Task]
    CHECK{Success?}
    RETRY{Attempts < 3?}
    INC[Increment Counter]
    WAIT[Exponential Backoff]
    SUCCESS[Report Success]
    FAIL[Report Failure]
    ESCALATE[Escalate to User]

    START --> EXEC
    EXEC --> CHECK
    CHECK -->|Yes| SUCCESS
    CHECK -->|No| RETRY
    RETRY -->|Yes| INC
    INC --> WAIT
    WAIT --> EXEC
    RETRY -->|No| FAIL
    FAIL --> ESCALATE
```

## 7. Parallel Execution Model

```mermaid
sequenceDiagram
    participant User
    participant Main as Main Agent
    participant Ctrl as Controller
    participant W1 as Worker 1
    participant W2 as Worker 2
    participant W3 as Worker 3
    participant PR as PR Reviewer

    User->>Main: Start Project
    Main->>Main: Run Document Pipeline
    Main->>Ctrl: Issues Ready

    par Parallel Work
        Ctrl->>W1: Issue #1
        Ctrl->>W2: Issue #3
        Ctrl->>W3: Issue #5
    end

    W1-->>Ctrl: #1 Complete
    Ctrl->>W2: Issue #2 (was blocked by #1)

    W3-->>Ctrl: #5 Complete
    W2-->>Ctrl: #3 Complete

    Ctrl->>W1: Issue #4 (was blocked by #3)
    W2-->>Ctrl: #2 Complete
    W1-->>Ctrl: #4 Complete

    Ctrl->>PR: All Issues Complete
    PR->>PR: Review & Merge
    PR-->>User: Project Complete
```

## 8. Directory Structure

```
claude_code_agent/
├── .claude/
│   └── agents/                    # Agent Definitions
│       ├── collector.md           # Information Collector Agent
│       ├── prd-writer.md          # PRD Writer Agent
│       ├── srs-writer.md          # SRS Writer Agent
│       ├── sds-writer.md          # SDS Writer Agent
│       ├── issue-generator.md     # Issue Generator Agent
│       ├── controller.md          # Controller Agent
│       ├── worker.md              # Worker Agent
│       ├── pr-reviewer.md         # PR Reviewer Agent
│       ├── document-reader.md     # Document Reader Agent
│       ├── codebase-analyzer.md   # Codebase Analyzer Agent
│       └── impact-analyzer.md     # Impact Analyzer Agent
│
├── .ad-sdlc/
│   ├── scratchpad/               # Inter-agent State
│   │   ├── info/                 # Collected information
│   │   ├── documents/            # Generated documents
│   │   ├── issues/               # Issue tracking
│   │   └── progress/             # Progress tracking
│   │
│   ├── templates/                # Document Templates
│   │   ├── prd-template.md
│   │   ├── srs-template.md
│   │   ├── sds-template.md
│   │   └── issue-template.md
│   │
│   └── config/                   # Configuration
│       ├── agents.yaml
│       └── workflow.yaml
│
├── docs/
│   ├── prd/                      # PRD Documents
│   ├── srs/                      # SRS Documents
│   ├── sds/                      # SDS Documents
│   └── architecture/             # Architecture Docs
│
└── src/                          # Generated Source Code
```
