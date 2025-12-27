# Product Requirements Documents

This directory contains published Product Requirements Documents (PRDs).

## Structure

```
prd/
├── PRD-{project_id}.md      # English version
└── PRD-{project_id}.kr.md   # Korean version (if generated)
```

## Naming Convention

- Format: `PRD-{project_id}.md`
- Example: `PRD-001.md`, `PRD-002.md`

## Document Contents

Each PRD includes:
- Executive Summary
- Problem Statement
- Solution Overview
- User Personas
- Functional Requirements
- Non-functional Requirements
- Constraints and Assumptions
- Success Metrics

## Workflow

1. PRD Writer generates document in `scratchpad/documents/`
2. After approval, document is copied to this directory
3. Document is version-controlled with Git

## See Also

- [PRD Template](../../.ad-sdlc/templates/prd-template.md)
- [PRD-001: Agent-Driven SDLC](../PRD-001-agent-driven-sdlc.md)
