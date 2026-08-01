# AD-SDLC Architecture Documentation

This directory holds the architectural documentation for AD-SDLC: the
high-level overview, data and communication flow, execution/definition layers, and the
Phase-2 / v0.1 working set that includes the Hybrid Pipeline RFC, its
migration guide, and the worker pilot evaluation report.

## Document Index

### Overview and design

| File                                               | Purpose                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| [`overview.md`](overview.md)                       | High-level system goals, capabilities, and component responsibilities. |
| [`agent-communication.md`](agent-communication.md) | Inter-agent messaging contracts and lifecycle.                         |
| [`data-flow.md`](data-flow.md)                     | End-to-end data flow across pipeline stages.                           |
| [`dual-layer-design.md`](dual-layer-design.md)     | Current SDK execution and declarative agent-definition boundaries.     |
| [`runtime-inventory.md`](runtime-inventory.md)     | Source-checked agent, stage, cutover, and traceability counts.         |

### v0.1 Hybrid Pipeline (Phase 2)

| File                                                         | Purpose                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [`v0.1-hybrid-pipeline-rfc.md`](v0.1-hybrid-pipeline-rfc.md) | ARCH-RFC-001: historical hybrid design and rationale for the completed SDK cutover. |
| [`v0.1-migration-guide.md`](v0.1-migration-guide.md)         | ARCH-MIG-001: contributor and user migration steps for v0.0.1 -> v0.1.0.            |
| [`v0.1-pilot-evaluation.md`](v0.1-pilot-evaluation.md)       | ARCH-EVAL-001: Phase-Gate P2 -> P3 worker-pilot evaluation report (issue #796).     |

### Architecture Decision Records

| File                 | Purpose                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| [`../adr/`](../adr/) | Canonical four-digit ADR tree for all current, superseded, and historical architecture decisions. |

## Conventions

- Each document declares a frontmatter block with `doc_id`, `doc_title`,
  `doc_version`, and `doc_status`. Stable IDs are referenced from
  traceability matrices and PR descriptions; do not rename.
- Phase-gate evaluation reports live next to their RFC and migration guide so
  reviewers can read the trio together (RFC -> migration -> evidence).
- Cross-references should use repository-relative links so they work both on
  GitHub and in local previews.
