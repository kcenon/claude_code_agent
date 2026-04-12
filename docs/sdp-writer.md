# SDP Writer Agent Documentation

## Overview

The SDP Writer Agent is responsible for generating a Software Development Plan (SDP) from approved Product Requirements (PRD) and Software Requirements Specification (SRS) inputs. It is a key component of the AD-SDLC document pipeline and bridges requirements (what to build) with design (how to build it) by capturing the lifecycle model, tools, team responsibilities, V&V strategy, risk management, and delivery milestones.

## Pipeline Position

```
Collector → PRD Writer → SRS Writer → SDP Writer → SDS Writer → Issue Generator
                                          ↑
                                     You are here
```

## Purpose

The SDP Writer Agent:

1. Reads and parses PRD and SRS documents
2. Selects a lifecycle model and documents phases, gates, and review checkpoints
3. Captures development environment, tools, and team responsibilities
4. Defines QA, V&V, and configuration management strategies
5. Generates a milestone schedule sized from the SRS feature/NFR counts
6. Outputs a structured SDP document in both English and Korean

## Input

- **PRD location**: `.ad-sdlc/scratchpad/documents/{project_id}/prd.md`
- **SRS location**: `.ad-sdlc/scratchpad/documents/{project_id}/srs.md`
- **Format**: Markdown documents following PRD and SRS templates
- **Requirements**: SRS must reference its source PRD; PRD timeline section is optional

## Output

- **Scratchpad (English)**: `.ad-sdlc/scratchpad/documents/{project_id}/sdp.md`
- **Scratchpad (Korean)**: `.ad-sdlc/scratchpad/documents/{project_id}/sdp.kr.md`
- **Public (English)**: `docs/sdp/SDP-{project_id}.md`
- **Public (Korean)**: `docs/sdp/SDP-{project_id}.kr.md`
- **Format**: Markdown document with structured SDP sections and YAML frontmatter

## ID Conventions

| Type         | Pattern          | Example |
| ------------ | ---------------- | ------- |
| SDP Document | SDP-{project_id} | SDP-001 |
| Milestone    | M{N}             | M1, M2  |
| Risk         | R{N}             | R1, R2  |

## SDP Sections

The generated SDP captures:

- **Lifecycle Model** — Default `Iterative / Agile`, configurable via `lifecycleModel`
- **Development Environment** — Tools, languages, frameworks
- **Team Responsibilities** — Roles and ownership
- **QA & V&V Strategy** — Verification and validation approach
- **Risk Management** — Likelihood/Impact/Mitigation entries
- **Schedule & Milestones** — Phase-grouped milestones sized from SRS scope
- **Configuration Management** — Branching, versioning, release strategy

## CLI Integration

```bash
# Generate SDP for a project (after SRS is approved)
ad-sdlc generate-sdp --project 001
```

## API Reference

### SDPWriterAgent

Main orchestrator class for SDP generation. Implements `IAgent` for unified
instantiation through `AgentFactory`.

#### Methods

| Method                           | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `initialize()`                   | Initialize the agent (IAgent interface)                   |
| `dispose()`                      | Release resources and clear session (IAgent interface)    |
| `getSession()`                   | Return the current generation session, or `null` if none  |
| `startSession(projectId)`        | Start a new generation session by parsing PRD and SRS     |
| `generateFromProject(projectId)` | Run the full pipeline (start → finalize) in one call      |
| `finalize()`                     | Persist generated SDP to scratchpad and public docs paths |

### Agent ID

Registered as `sdp-writer-agent` (`SDP_WRITER_AGENT_ID`) for `AgentFactory`.

## Quality Criteria

The SDP Writer Agent ensures:

1. **Source Traceability**: Every SDP references its source PRD and SRS document IDs
2. **Schedule Coverage**: Milestones are generated proportionally to SRS feature/NFR counts
3. **Risk Hygiene**: Each risk entry has likelihood, impact, and a mitigation strategy
4. **Bilingual Output**: English and Korean variants are produced for every document
5. **Frontmatter Compliance**: All outputs include the standard `doc_id`, `version`, and `status` frontmatter

## Error Handling

| Error               | Cause                                        | Resolution                                            |
| ------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `PRDNotFoundError`  | PRD document missing at expected path        | Generate PRD via PRD Writer first                     |
| `SRSNotFoundError`  | SRS document missing at expected path        | Generate SRS via SRS Writer first                     |
| `SessionStateError` | Operation called in an invalid session state | Follow session workflow (`startSession` → `finalize`) |
| `GenerationError`   | SDP content generation failed                | Inspect `phase` field and retry                       |
| `FileWriteError`    | Output path not writable                     | Verify permissions on `docs/sdp` and scratchpad       |
| `ValidationError`   | Generated SDP failed schema validation       | Review `errors` list returned by the validator        |

## Configuration

```yaml
# .ad-sdlc/config/sdp-writer.yaml
sdp_writer:
  scratchpad_base_path: '.ad-sdlc/scratchpad'
  template_path: '.ad-sdlc/templates/sdp-template.md'
  public_docs_path: 'docs/sdp'
  lifecycle_model: 'Iterative / Agile'
```

## Related Documentation

- [PRD Writer Agent](prd-writer.md)
- [SRS Writer Agent](srs-writer.md)
- [SDS Writer Agent](sds-writer.md)
- [Issue Generator](issue-generator.md)
