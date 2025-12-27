# Software Requirements Specifications

This directory contains published Software Requirements Specifications (SRS).

## Structure

```
srs/
├── SRS-{project_id}.md      # English version
└── SRS-{project_id}.kr.md   # Korean version (if generated)
```

## Naming Convention

- Format: `SRS-{project_id}.md`
- Example: `SRS-001.md`, `SRS-002.md`

## Document Contents

Each SRS includes:
- Introduction and Scope
- System Overview
- Feature Specifications (SF-XXX)
- Use Cases (UC-XXX)
- Acceptance Criteria (AC-XXX)
- System Requirements
- Interface Requirements
- Traceability Matrix

## Traceability

SRS documents maintain traceability to PRD:
- Each Feature (SF-XXX) links to PRD requirements
- Use Cases reference Features
- Acceptance Criteria are testable

## Workflow

1. SRS Writer generates document from PRD
2. After approval, document is copied to this directory
3. Document is version-controlled with Git

## See Also

- [SRS Template](../../.ad-sdlc/templates/srs-template.md)
- [SRS-001: Agent-Driven SDLC](../SRS-001-agent-driven-sdlc.md)
