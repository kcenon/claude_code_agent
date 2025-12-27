# Software Design Specifications

This directory contains published Software Design Specifications (SDS).

## Structure

```
sds/
├── SDS-{project_id}.md      # English version
└── SDS-{project_id}.kr.md   # Korean version (if generated)
```

## Naming Convention

- Format: `SDS-{project_id}.md`
- Example: `SDS-001.md`, `SDS-002.md`

## Document Contents

Each SDS includes:
- Introduction and Scope
- System Architecture
- Component Design (CMP-XXX)
- Data Design
- Interface Design
- Security Design
- Deployment Architecture
- Error Handling & Recovery
- Traceability Matrix

## Traceability

SDS documents maintain traceability to SRS:
- Each Component (CMP-XXX) links to Features (SF-XXX)
- Interface designs reference Use Cases
- Implementation decisions are documented

## Component Mapping

Components defined in SDS become GitHub Issues:
```
SDS Component (CMP-001) → GitHub Issue → Implementation → PR
```

## Workflow

1. SDS Writer generates document from SRS
2. After approval, document is copied to this directory
3. Issue Generator creates issues from components
4. Document is version-controlled with Git

## See Also

- [SDS Template](../../.ad-sdlc/templates/sds-template.md)
- [SDS-001: Agent-Driven SDLC](../SDS-001-agent-driven-sdlc.md)
