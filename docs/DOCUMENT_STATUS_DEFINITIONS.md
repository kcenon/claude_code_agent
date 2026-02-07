# Document Status Definitions

## AD-SDLC Document Lifecycle

This document defines the formal status semantics used across all AD-SDLC project documents (PRD, SRS, SDS). It distinguishes between two independent status dimensions: **Document Status** (the state of the document itself) and **Implementation Status** (the state of the system described by the document).

> **Referenced by**: PRD-001, SRS-001, SDS-001

---

## 1. Document Status

The **Status** field in a document's metadata table tracks the lifecycle of the _document itself_ — whether it has been drafted, reviewed, or approved as a baseline.

| Status | Meaning |
|--------|---------|
| **Draft** | Initial authoring in progress; not ready for review |
| **Review** | Content complete; under stakeholder review |
| **Approved** | Reviewed and accepted as a project baseline |
| **Superseded** | Replaced by a newer version of the document |

### Transition Diagram

```
Draft ──→ Review ──→ Approved ──→ Superseded
  ↑          │
  └──────────┘
  (revision needed)
```

### Rules

- A document enters **Draft** when first created or when undergoing significant revision.
- **Review** means the document content is complete and awaiting stakeholder sign-off.
- **Approved** means the document is baselined and changes require a formal change request.
- **Superseded** applies when a new version of the document replaces this one entirely.

---

## 2. Implementation Status

The **Implementation** field in a document's metadata table tracks the state of the _system or feature_ described by the document — whether the specified functionality has been built.

| Status | Meaning |
|--------|---------|
| **Not Started** | No code has been written for this specification |
| **In Progress** | Active development underway |
| **Partial** | Some specified features are implemented; others remain pending |
| **Complete** | All specified features are implemented and verified |
| **Deprecated** | Implementation exists but is being phased out |

### Transition Diagram

```
Not Started ──→ In Progress ──→ Partial ──→ Complete ──→ Deprecated
                    │                           ↑
                    └───────────────────────────┘
                    (all features done at once)
```

### Rules

- **Not Started** is the default for newly created specifications.
- **In Progress** indicates at least one feature from the specification is under active development.
- **Partial** means some features are implemented and verified, but the specification is not fully realized.
- **Complete** requires all specified features to be implemented and pass verification.
- **Deprecated** applies when the implementation is being replaced or removed.

---

## 3. Field Independence

The two status fields are **independent** and should not be confused:

| Scenario | Document Status | Implementation |
|----------|----------------|----------------|
| New design, not yet built | Review | Not Started |
| Approved design, being built | Approved | In Progress |
| Approved design, partially built | Approved | Partial |
| Approved design, fully built | Approved | Complete |
| Old design replaced by v2 | Superseded | Deprecated |

### Common Misinterpretation

> **Wrong**: "Status: Review" means the implementation is being reviewed.
>
> **Correct**: "Status: Review" means the _document_ is under stakeholder review. The implementation state is tracked separately in the "Implementation" field.

---

## 4. Per-Feature Status Tracking

For granular tracking, individual requirements or components can include their own implementation status:

```markdown
| ID | Feature | Design Status | Implementation |
|----|---------|---------------|----------------|
| FR-001 | Information Collection | Approved | Complete |
| FR-002 | PRD Generation | Approved | Complete |
| FR-010 | Document Reading | Approved | Not Started |
```

This approach provides visibility into which parts of a specification are built without conflating the overall document status.

---

## 5. Usage in Document Metadata

All AD-SDLC documents must include both fields in their metadata table:

```markdown
| Field | Value |
|-------|-------|
| **Document ID** | SDS-001 |
| **Version** | 1.1.0 |
| **Status** | Review |
| **Implementation** | Partial |
| **Created** | 2025-12-27 |
| **Author** | System Architect |
```

- **Status** always refers to the document lifecycle (see [Section 1](#1-document-status)).
- **Implementation** always refers to the described system (see [Section 2](#2-implementation-status)).

---

*Version: 1.0.0 | Created: 2026-02-08*
