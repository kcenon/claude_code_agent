# Data Flow Documentation

> **Version**: 1.0.0
> **Last Updated**: 2025-01-01

## Overview

This document describes how data flows through the AD-SDLC system, from initial user input to final production code.

---

## Greenfield Pipeline Data Flow

### Stage 1: Collection

```
┌─────────────────────────────────────────────────────────────┐
│                        INPUT SOURCES                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ User Input  │  │   Files     │  │    URLs     │         │
│  │ (CLI/Chat)  │  │ (MD/DOCX)   │  │   (Web)     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│                  ┌───────────────┐                          │
│                  │   Collector   │                          │
│                  │     Agent     │                          │
│                  └───────┬───────┘                          │
│                          │                                  │
│                          ▼                                  │
│         ┌────────────────────────────────────┐              │
│         │  .ad-sdlc/scratchpad/info/         │              │
│         │  └── collected_info.yaml           │              │
│         │      ├── requirements (functional) │              │
│         │      ├── requirements (non-func)   │              │
│         │      ├── constraints               │              │
│         │      └── assumptions               │              │
│         └────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Stage 2-4: Document Generation

```
┌─────────────────────────────────────────────────────────────┐
│                   DOCUMENT PIPELINE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  collected_info.yaml                                        │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ PRD Writer  │──────▶ docs/prd/PRD-001.md                 │
│  └─────────────┘        ├── Vision & Goals                  │
│         │               ├── Functional Requirements (FR-*)  │
│         │               ├── Non-Functional Requirements     │
│         │               └── Traceability Matrix             │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ SRS Writer  │──────▶ docs/srs/SRS-001.md                 │
│  └─────────────┘        ├── System Features (SF-*)          │
│         │               ├── Use Cases (UC-*)                │
│         │               ├── Data Requirements               │
│         │               └── PRD Traceability                │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ SDS Writer  │──────▶ docs/sds/SDS-001.md                 │
│  └─────────────┘        ├── Components (CMP-*)              │
│                         ├── Interfaces (API-*)              │
│                         ├── Data Models                     │
│                         └── SRS Traceability                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 5: Issue Generation

```
┌─────────────────────────────────────────────────────────────┐
│                    ISSUE GENERATION                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SDS-001.md (Components)                                    │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────┐                                        │
│  │ Issue Generator │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ├──────▶ GitHub Issue #1 (CMP-001)                │
│           │        ├── Title: Implement AuthService         │
│           │        ├── Labels: [feature, P0]                │
│           │        ├── Body: SDS details + acceptance       │
│           │        └── Dependencies: []                     │
│           │                                                 │
│           ├──────▶ GitHub Issue #2 (CMP-002)                │
│           │        ├── Title: Implement SessionManager      │
│           │        └── Dependencies: [#1]                   │
│           │                                                 │
│           └──────▶ issues.json (local cache)                │
│                    ├── Issue metadata                       │
│                    └── Dependency graph                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 6-7: Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  issues.json                                                │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ Controller  │                                            │
│  └──────┬──────┘                                            │
│         │                                                   │
│         ├── Topological sort by dependencies                │
│         ├── Priority ordering (P0 > P1 > P2)                │
│         └── Work distribution                               │
│                                                             │
│    ┌────────────────┼────────────────┐                      │
│    ▼                ▼                ▼                      │
│ ┌────────┐    ┌────────┐       ┌────────┐                   │
│ │Worker 1│    │Worker 2│  ...  │Worker N│                   │
│ └────┬───┘    └────┬───┘       └────┬───┘                   │
│      │             │                │                       │
│      ├─ Read issue from GitHub      │                       │
│      ├─ Generate code               │                       │
│      ├─ Generate tests              │                       │
│      ├─ Run verification            │                       │
│      │   ├─ npm test                │                       │
│      │   ├─ npm lint                │                       │
│      │   └─ npm build               │                       │
│      └─ Create branch + commit      │                       │
│                                                             │
│    ┌────────────────┼────────────────┐                      │
│    ▼                ▼                ▼                      │
│ Branch:         Branch:          Branch:                    │
│ feature/#1      feature/#2       feature/#N                 │
│         │             │                │                    │
│         └─────────────┼────────────────┘                    │
│                       ▼                                     │
│              ┌─────────────┐                                │
│              │ PR Reviewer │                                │
│              └──────┬──────┘                                │
│                     │                                       │
│                     ├── Create PR                           │
│                     ├── Review code                         │
│                     ├── Check quality gates                 │
│                     └── Merge to main                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Enhancement Pipeline Data Flow

### Stage 1: Parallel Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                   ANALYSIS PHASE                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Existing Project                                           │
│  ├── docs/                                                  │
│  │   ├── PRD.md                                             │
│  │   ├── SRS.md                                             │
│  │   └── SDS.md                                             │
│  └── src/                                                   │
│      └── *.ts                                               │
│                                                             │
│         ┌──────────────────────────────────────┐            │
│         │       Analysis Orchestrator          │            │
│         └──────────────────┬───────────────────┘            │
│                            │                                │
│         ┌──────────────────┼──────────────────┐             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│  │  Document   │   │  Codebase   │   │    Code     │        │
│  │   Reader    │   │  Analyzer   │   │   Reader    │        │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘        │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  current_state.yaml  architecture.yaml  code_inventory.json │
│  ├── documents       ├── type           ├── files          │
│  ├── requirements    ├── patterns       ├── classes        │
│  └── traceability    ├── structure      ├── functions      │
│                      └── metrics        └── dependencies   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 2: Comparison & Gap Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                   COMPARISON PHASE                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  current_state.yaml ───┐                                    │
│                        │                                    │
│  code_inventory.json ──┼──▶ ┌─────────────────┐             │
│                        │    │   Doc-Code      │             │
│  User Change Request ──┘    │   Comparator    │             │
│                             └────────┬────────┘             │
│                                      │                      │
│                                      ▼                      │
│                          comparison_result.yaml             │
│                          ├── documented_not_implemented     │
│                          ├── implemented_not_documented     │
│                          ├── mismatches                     │
│                          └── change_scope                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 3: Impact Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                   IMPACT ANALYSIS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  current_state.yaml ─────┐                                  │
│                          │                                  │
│  architecture.yaml ──────┼──▶ ┌─────────────────┐           │
│                          │    │    Impact       │           │
│  comparison_result.yaml ─┘    │    Analyzer     │           │
│                               └────────┬────────┘           │
│                                        │                    │
│                                        ▼                    │
│                              impact_report.yaml             │
│                              ├── change_scope               │
│                              │   ├── type (add/modify/fix)  │
│                              │   └── estimated_size         │
│                              ├── affected_components        │
│                              │   └── direct/indirect        │
│                              ├── affected_files             │
│                              ├── risk_assessment            │
│                              │   ├── overall_risk           │
│                              │   └── factors                │
│                              ├── regression_risks           │
│                              └── recommendations            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 4-6: Incremental Document Updates

```
┌─────────────────────────────────────────────────────────────┐
│                   DOCUMENT UPDATES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  impact_report.yaml                                         │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ PRD Updater │──────▶ docs/prd/PRD-001.md (UPDATED)       │
│  └─────────────┘        ├── NEW: FR-016, FR-017             │
│         │               ├── MODIFIED: FR-003                │
│         │               └── (Existing content preserved)    │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ SRS Updater │──────▶ docs/srs/SRS-001.md (UPDATED)       │
│  └─────────────┘        ├── NEW: SF-024, UC-015             │
│         │               └── (Existing content preserved)    │
│         ▼                                                   │
│  ┌─────────────┐                                            │
│  │ SDS Updater │──────▶ docs/sds/SDS-001.md (UPDATED)       │
│  └─────────────┘        ├── NEW: CMP-012, API-008           │
│                         └── (Existing content preserved)    │
│                                                             │
│  NOTE: Updaters perform DELTA changes only                  │
│        - Never delete existing requirements                 │
│        - Add new sections for additions                     │
│        - Mark modifications with change tracking            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Stage 7-9: Implementation with Regression

```
┌─────────────────────────────────────────────────────────────┐
│              IMPLEMENTATION WITH REGRESSION                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Updated SDS ──▶ Issue Generator ──▶ NEW Issues only        │
│                                                             │
│  ┌─────────────┐                                            │
│  │ Controller  │                                            │
│  └──────┬──────┘                                            │
│         │                                                   │
│    ┌────┴────────────────────────────┐                      │
│    │                                 │                      │
│    ▼                                 ▼                      │
│ ┌────────────────┐         ┌─────────────────┐              │
│ │    Workers     │         │   Regression    │              │
│ │ (New Features) │         │    Tester       │              │
│ └────────┬───────┘         └────────┬────────┘              │
│          │                          │                       │
│          │                          ├── Identify affected   │
│          │                          │   test suites         │
│          │                          ├── Run regression      │
│          │                          │   tests               │
│          │                          └── Report results      │
│          │                                   │              │
│          └──────────────┬───────────────────┘               │
│                         ▼                                   │
│              ┌─────────────────┐                            │
│              │   PR Reviewer   │                            │
│              └────────┬────────┘                            │
│                       │                                     │
│                       ├── Review new code                   │
│                       ├── Check regression results          │
│                       ├── Verify no regressions             │
│                       └── Merge if all pass                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Traceability Chain

### Complete Traceability Flow

```
User Requirement
      │
      ▼
┌──────────────────┐
│ PRD: FR-001      │ ◀─────┐
│ "User can login" │       │
└────────┬─────────┘       │
         │                 │
         ▼                 │ Bidirectional
┌──────────────────┐       │ Traceability
│ SRS: SF-001      │       │
│ "Login Feature"  │───────┤
│ UC-001: Login    │       │
└────────┬─────────┘       │
         │                 │
         ▼                 │
┌──────────────────┐       │
│ SDS: CMP-001     │       │
│ "AuthService"    │───────┤
│ API-001: /login  │       │
└────────┬─────────┘       │
         │                 │
         ▼                 │
┌──────────────────┐       │
│ Issue: #42       │───────┘
│ "Implement Auth" │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ PR: #101         │
│ src/auth/*.ts    │
└──────────────────┘
```

### Traceability Matrix Example

| PRD | SRS | SDS | Issue | PR | Status |
|-----|-----|-----|-------|-----|--------|
| FR-001 | SF-001, UC-001 | CMP-001, API-001 | #42 | #101 | Merged |
| FR-002 | SF-002 | CMP-002 | #43 | #102 | In Review |
| FR-003 | SF-003, SF-004 | CMP-003, CMP-004 | #44, #45 | - | In Progress |

---

## Data Validation Points

### Quality Gates

| Stage | Validation |
|-------|------------|
| Collection | Required fields present, format valid |
| PRD | All requirements have IDs, priorities set |
| SRS | Features trace to PRD, use cases complete |
| SDS | Components trace to SRS, APIs defined |
| Issues | Dependencies valid, no cycles |
| Implementation | Tests pass, lint clean, build succeeds |
| Review | Coverage > 80%, no security issues |

### Checkpoint Data

```yaml
# checkpoint.yaml
pipeline:
  mode: "greenfield"
  started_at: "2025-01-01T00:00:00Z"
  current_stage: "srs_generation"

completed_stages:
  - name: "collection"
    completed_at: "2025-01-01T00:05:00Z"
    output: "info/collected_info.yaml"

  - name: "prd_generation"
    completed_at: "2025-01-01T00:15:00Z"
    output: "documents/prd.md"

recoverable: true
last_checkpoint: "2025-01-01T00:15:00Z"
```

---

## Related Documentation

- [Architecture Overview](./overview.md) - System architecture
- [Agent Communication](./agent-communication.md) - Communication patterns
- [Schema Reference](../reference/schemas/) - Data schemas

---

*Part of [AD-SDLC Architecture Documentation](./overview.md)*
