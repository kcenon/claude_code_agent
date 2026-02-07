# Document Update Protocol

Guidelines for maintaining consistency across the PRD → SRS → SDS document hierarchy.

## Document Hierarchy

```
PRD-001 (Business Requirements)
  │
  ▼
SRS-001 (Software Requirements)
  │
  ▼
SDS-001 (Software Design)
```

Each document has:
- **English** source (`.md`)
- **Korean** translation (`.kr.md`)
- **API mirror** copy (`docs/api/_media/`)

## Cascade Update Rules

### When to Propagate Downward (PRD → SRS → SDS)

Use downward propagation when business requirements change at the PRD level.

| PRD Change | SRS Update Needed | SDS Update Needed |
|-----------|-------------------|-------------------|
| New functional requirement (FR) | Add corresponding software feature (SF) | Add component design (CMP) |
| Scope change in Section 1.2 | Update Section 1.2 scope | Update Section 1.2 scope |
| Agent count change | Update agent list in Section 1.2 | Update component overview table |
| New implementation phase | Review phase references | Review component assignments |

### When to Propagate Upward (SDS → SRS → PRD)

Use upward propagation when design-level changes affect higher-level descriptions.

| SDS Change | SRS Update Needed | PRD Update Needed |
|-----------|-------------------|-------------------|
| New component (CMP-xxx) | Add/verify source feature (SF) | Verify FR coverage |
| Component category change | Update feature groupings | Update agent summary table |
| Architecture change | Update non-functional requirements | Update system overview |

### When to Propagate Both Directions

SRS changes require review in both directions since it bridges business and design.

| SRS Change | PRD Review | SDS Review |
|-----------|-----------|-----------|
| New software feature (SF) | Verify FR source exists | Verify CMP implements it |
| Feature scope change | Verify PRD alignment | Update component designs |
| New use case (UC) | Verify business need | Verify design support |

## Sync Points

Sync points are sections that must stay aligned across documents. They are defined in `doc-sync-points.yaml` at the repository root.

### Critical Sync Points

| Sync Point | PRD Section | SRS Section | SDS Section |
|-----------|------------|------------|------------|
| Agent count | 1.2 Overview | 1.2 Scope | 1.2 Scope, 3.1 Overview |
| Pipeline modes | 6.1 Architecture | 2.x Features | 3.x Components |

### High Severity Sync Points

| Sync Point | PRD Section | SRS Section | SDS Section |
|-----------|------------|------------|------------|
| Agent categories | 6.2 Agent Summary | 1.2 Scope | 3.1 Component Table |
| Document versions | Metadata | Metadata | Metadata |
| Traceability chain | 8.x Requirements | 3.x Features | 3.x Components |

### Medium Severity Sync Points

| Sync Point | PRD Section | SRS Section | SDS Section |
|-----------|------------|------------|------------|
| Implementation phases | 13 Phases | 1.2 Scope | — |
| Feature scope | 8.x Requirements | 2.x Features | 1.2 Scope |

## Version Bump Rules

| Change Type | PRD Version | SRS Version | SDS Version |
|------------|------------|------------|------------|
| New requirement (FR) | MINOR bump | MINOR bump | MINOR bump |
| Requirement modification | PATCH bump | MINOR bump | MINOR bump |
| New component (CMP) | — | PATCH bump | MINOR bump |
| Component modification | — | — | PATCH bump |
| Typo/formatting fix | — | — | — |
| Overview/scope alignment | PATCH bump | PATCH bump | PATCH bump |

Version format: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking structural changes
- **MINOR**: New content (requirements, features, components)
- **PATCH**: Corrections, alignment fixes, clarifications

## EN/KR Pair Update Process

1. **Always edit the English document first** — it is the source of truth
2. **Update the Korean translation** in the same PR
3. **The CI check will warn** if a `.md` file is changed without its `.kr.md` counterpart

## API Mirror Update Process

Files in `docs/api/_media/` are copies of the primary documents for API documentation.

1. After updating primary documents, **copy to the mirror directory**
2. The CI check will warn if primary documents change without mirror updates

```bash
# Quick mirror sync
cp docs/PRD-001-agent-driven-sdlc.md docs/api/_media/
cp docs/PRD-001-agent-driven-sdlc.kr.md docs/api/_media/
# Repeat for SRS and SDS as needed
```

## Update Checklist

When modifying any document in the hierarchy, use this checklist:

- [ ] Updated the primary document (English)
- [ ] Updated Korean translation (`.kr.md`)
- [ ] Reviewed sync points in related documents (see `doc-sync-points.yaml`)
- [ ] Updated API mirror copies if applicable (`docs/api/_media/`)
- [ ] Bumped version numbers per version bump rules
- [ ] Updated document history section
- [ ] Verified traceability chain (FR → SF → CMP) if IDs changed

## CI Automation

Two CI checks run automatically on PRs that touch `docs/**`:

1. **Traceability Matrix Validation** (`validate-traceability.sh`)
   - Verifies FR → SF → CMP coverage
   - Checks ID continuity and cross-references
   - **Blocks merge** if traceability is broken

2. **Document Cascade Check** (`check-doc-cascade.sh`)
   - Warns when related documents are missing from the changeset
   - Checks EN/KR pairs and API mirror copies
   - **Advisory only** — posts warnings as PR comments
