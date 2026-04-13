# Tech Decision Writer Agent Documentation

## Overview

The Tech Decision Writer Agent is responsible for generating Technology Decision (TD) documents from an approved Software Design Specification (SDS). It is a decision-record-focused component of the AD-SDLC document pipeline that reads the SDS technology stack table, enumerates candidate alternatives for each row, scores them against weighted evaluation criteria, and records the selected technology together with rationale and consequences. One TD document is produced per technology stack row.

Unlike the existing `docs/adr/` Architecture Decision Records (which capture lightweight architectural choices post-hoc), TD documents are generated up-front during the design pipeline. Each TD explicitly enumerates alternatives, records a weighted evaluation matrix, and links back to the SDS components and any NFR references that appear inside the SDS.

## Pipeline Position

```
Collector → PRD Writer → SRS Writer → SDP Writer → SDS Writer ─┬─▶ Threat Model Writer ─┐
                                                                │                        │
                                                                └─▶ Tech Decision Writer ─┤
                                                                         ↑                │
                                                                    You are here          ▼
                                                                                  Issue Generator → SVP Writer
```

The Tech Decision Writer runs **in parallel** with the Threat Model Writer after `sds_generation`. Both consume the finalized SDS; both must complete before `issue_generation` can proceed.

## Purpose

The Tech Decision Writer Agent:

1. Reads and parses the SDS to extract the technology stack table (section 2.3), component references, and any embedded NFR references
2. Emits one Technology Decision document per row in the technology stack table
3. Assembles candidate alternatives for each decision using a fallback catalog keyed by layer name (for example, `runtime`, `database`, `queue`)
4. Builds an evaluation matrix that scores every candidate against the configured weighted criteria
5. Records the selected technology, its rationale, and the positive/negative consequences of the choice
6. Links each decision back to the SDS component IDs and NFR IDs that appear in the source document
7. Persists one structured TD document per decision to both a scratchpad location and the public `docs/decisions/` directory

## Input

- **SDS location**: `.ad-sdlc/scratchpad/documents/{projectId}/sds.md`
- **Format**: Markdown SDS document with a section 2.3 "Technology Stack" table
- **Requirements**: SDS must enumerate at least one technology stack row for meaningful decision extraction. If the technology stack table or component/NFR cross-references are missing, the session emits warnings rather than failing.

The agent does **not** read the SRS or PRD directly; NFR and component references are harvested from cross-references embedded in the SDS itself.

## Output

- **Scratchpad**: `.ad-sdlc/scratchpad/documents/{projectId}/decisions/TD-{NNN}-{topic-slug}.md`
- **Public**: `docs/decisions/TD-{NNN}-{topic-slug}.md`
- **Format**: Markdown document with structured TD sections and YAML frontmatter
- **Cardinality**: One TD document per technology stack row detected in the SDS

> **Bilingual output**: The current implementation writes an English-only document to both the scratchpad and public locations. Korean variants (`.kr.md`) are a planned follow-up to match SVP Writer and Threat Model Writer output.

## ID Conventions

| Type        | Pattern                 | Example                     |
| ----------- | ----------------------- | --------------------------- |
| TD Document | `TD-{NNN}-{topic-slug}` | `TD-001-backend-runtime`    |
| Filename    | `{documentId}.md`       | `TD-001-backend-runtime.md` |

- `{NNN}` is a zero-padded 3-digit sequence number, assigned per decision in detection order.
- `{topic-slug}` is produced by `slugifyTopic` from the SDS technology stack row label (kebab-case, ASCII).
- TDs are **not** prefixed with the project ID; the `docs/decisions/` directory is project-scoped by convention.

## TD Sections

Each generated Technology Decision document captures:

- **Context** — Product name and the SDS row that triggered the decision
- **Considered Alternatives** — Candidate options sourced from the SDS ADR section (when present) or the fallback catalog, with license and maturity metadata
- **Evaluation Criteria** — Weighted criteria used to score candidates (defaults: Performance 0.25, Ecosystem 0.20, Learning 0.15, Maintenance 0.15, Cost 0.15, Security 0.10)
- **Evaluation Matrix** — Per-candidate scores for each criterion and the weighted total
- **Decision** — Selected candidate with rationale
- **Consequences** — Positive and negative implications of the selected option
- **Traceability** — Links to SDS component IDs and NFR IDs that appear in the source SDS

## CLI Integration

```bash
# Generate Technology Decision documents for a project (after SDS is approved)
ad-sdlc generate-tech-decisions --project 001
```

The pipeline stage name is `tech_decision_generation`, and it can be targeted by `--start-from`:

```bash
./ad-sdlc-full-pipeline.sh . greenfield --start-from tech_decision_generation
```

## API Reference

### TechDecisionWriterAgent

Main orchestrator class for Technology Decision document generation. Implements `IAgent` for unified instantiation through `AgentFactory`.

#### Methods

| Method                           | Description                                              |
| -------------------------------- | -------------------------------------------------------- |
| `initialize()`                   | Initialize the agent (IAgent interface)                  |
| `dispose()`                      | Release resources and clear session (IAgent interface)   |
| `getSession()`                   | Return the current generation session, or `null` if none |
| `startSession(projectId)`        | Start a new generation session by parsing the SDS        |
| `generateFromProject(projectId)` | Run the full pipeline (start → write) in one call        |
| `finalize()`                     | Re-persist the documents cached in a completed session   |

### Helper Modules

| Module                | Responsibility                                                                |
| --------------------- | ----------------------------------------------------------------------------- |
| `DecisionDetector`    | Parses the SDS technology stack table, component list, and NFR references     |
| `ComparisonGenerator` | Builds candidate lists, validates criteria, and generates evaluation matrices |

Exported helpers include `detectDecisions`, `slugifyTopic`, `parseTechnologyStack`, `parseSDSComponents`, `parseNfrReferences`, `DEFAULT_CRITERIA`, `validateCriteria`, and `generateDecisions`.

### Agent ID

Registered as `tech-decision-writer-agent` (`TECH_DECISION_WRITER_AGENT_ID`) for `AgentFactory`. The registry mapping key is `tech-decision-writer`. A singleton accessor (`getTechDecisionWriterAgent`) and a reset helper (`resetTechDecisionWriterAgent`) mirror the other writer agents.

## Quality Criteria

The Tech Decision Writer Agent ensures:

1. **Source Traceability**: Every TD document includes frontmatter referencing the source SDS document ID; the rendered body links back to SDS component IDs and NFR IDs when present
2. **Matrix Completeness**: Every decision records at least two candidates scored against every configured criterion, with an aggregated weighted total
3. **Criteria Weighting Hygiene**: `validateCriteria` enforces that criterion weights sum to 1.0 within tolerance (±0.001); misconfigured criteria throw `InvalidCriteriaError` at construction time
4. **Decision Justification**: Every selected option has an explicit rationale stored alongside the consequences section
5. **Frontmatter Compliance**: All outputs include the standard `doc_id`, `title`, `version`, `status`, `generated_by`, `generated_at`, `source_documents`, and `change_history` frontmatter
6. **Graceful Degradation**: Missing technology stack rows, components, or NFR references emit session warnings instead of throwing — callers can inspect `session.warnings` to diagnose sparse SDS inputs

## Error Handling

| Error                  | Cause                                            | Resolution                                            |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `SDSNotFoundError`     | SDS document missing at expected scratchpad path | Generate SDS via SDS Writer first                     |
| `SessionStateError`    | Operation called in an invalid session state     | Follow session workflow (`startSession` → `finalize`) |
| `GenerationError`      | Technology decision content generation failed    | Inspect `phase` field and retry                       |
| `FileWriteError`       | Output path not writable                         | Verify permissions on `docs/decisions` and scratchpad |
| `InvalidCriteriaError` | Evaluation criteria weights do not sum to 1.0    | Supply criteria whose weights sum to 1.0 ± 0.001      |

All error classes are exported from `src/tech-decision-writer/errors.ts` and extend `TechDecisionWriterError`.

## Configuration

```yaml
# .ad-sdlc/config/tech-decision-writer.yaml
tech_decision_writer:
  scratchpad_base_path: '.ad-sdlc/scratchpad'
  public_docs_path: 'docs/decisions'
  # Custom criteria must sum to 1.0 ± 0.001
  criteria:
    - name: Performance
      weight: 0.25
      description: Throughput, latency, and resource efficiency under the expected workload
    - name: Ecosystem
      weight: 0.20
      description: Maturity of libraries, tooling, community, and third-party integrations
    - name: Learning
      weight: 0.15
      description: Learning curve, documentation quality, and team familiarity
    - name: Maintenance
      weight: 0.15
      description: Operational burden, upgrade cadence, and long-term support outlook
    - name: Cost
      weight: 0.15
      description: License fees, hosting cost, and total cost of ownership
    - name: Security
      weight: 0.10
      description: Track record of vulnerabilities, patch cadence, and built-in hardening
```

The default criteria set is exported as `DEFAULT_CRITERIA` from `ComparisonGenerator.ts`.

## Related Documentation

- [SDS Writer Agent](sds-writer.md)
- [Threat Model Writer Agent](threat-model-writer.md) — runs in parallel with this agent
- [Issue Generator](issue-generator.md)
- [Architecture Decision Records](adr/README.md) — complementary, post-hoc architectural decisions
