# Threat Model Writer Agent Documentation

## Overview

The Threat Model Writer Agent is responsible for generating a Threat Model (TM) document from an approved Software Design Specification (SDS). It is a security-focused component of the AD-SDLC document pipeline that identifies security threats using STRIDE categorization and scores their risk using the DREAD model, producing an actionable threat register that feeds downstream issue generation.

## Pipeline Position

```
Collector → PRD Writer → SRS Writer → SDP Writer → SDS Writer → Threat Model Writer → Issue Generator
                                                                        ↑
                                                                  You are here
```

## Purpose

The Threat Model Writer Agent:

1. Reads and parses the SDS document to extract components, data flows, and trust boundaries
2. Enumerates threats for each component using STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
3. Scores each threat with the DREAD model (Damage, Reproducibility, Exploitability, Affected Users, Discoverability)
4. Recommends mitigations linked back to SDS components
5. Outputs a structured Threat Model document in both English and Korean

## Input

- **SDS location**: `.ad-sdlc/scratchpad/documents/{project_id}/sds.md`
- **Format**: Markdown document following the SDS template
- **Requirements**: SDS must enumerate components and data flows for meaningful threat extraction

## Output

- **Scratchpad (English)**: `.ad-sdlc/scratchpad/documents/{project_id}/threat-model.md`
- **Scratchpad (Korean)**: `.ad-sdlc/scratchpad/documents/{project_id}/threat-model.kr.md`
- **Public (English)**: `docs/tm/TM-{project_id}.md`
- **Public (Korean)**: `docs/tm/TM-{project_id}.kr.md`
- **Format**: Markdown document with structured Threat Model sections and YAML frontmatter

## ID Conventions

| Type         | Pattern         | Example |
| ------------ | --------------- | ------- |
| TM Document  | TM-{project_id} | TM-001  |
| Threat Entry | T{N}            | T1, T2  |
| Component    | C{N}            | C1, C2  |

## Threat Model Sections

The generated Threat Model captures:

- **System Overview** — Summary of components and trust boundaries extracted from SDS
- **STRIDE Threat Register** — Per-component threats classified by STRIDE category
- **DREAD Risk Scoring** — Risk score per threat across the five DREAD dimensions
- **Mitigation Strategies** — Recommended controls linked to SDS components
- **Residual Risk** — Risks remaining after recommended mitigations
- **Traceability** — Links from threats to SDS component IDs

## CLI Integration

```bash
# Generate Threat Model for a project (after SDS is approved)
ad-sdlc generate-threat-model --project 001
```

## API Reference

### ThreatModelWriterAgent

Main orchestrator class for Threat Model generation. Implements `IAgent` for unified
instantiation through `AgentFactory`.

#### Methods

| Method                           | Description                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| `initialize()`                   | Initialize the agent (IAgent interface)                            |
| `dispose()`                      | Release resources and clear session (IAgent interface)             |
| `getSession()`                   | Return the current generation session, or `null` if none           |
| `startSession(projectId)`        | Start a new generation session by parsing SDS                      |
| `generateFromProject(projectId)` | Run the full pipeline (start → finalize) in one call               |
| `finalize()`                     | Persist generated Threat Model to scratchpad and public docs paths |

### Agent ID

Registered as `threat-model-writer-agent` (`THREAT_MODEL_WRITER_AGENT_ID`) for `AgentFactory`.

## Quality Criteria

The Threat Model Writer Agent ensures:

1. **Source Traceability**: Every Threat Model references its source SDS document ID and links threats to component IDs
2. **STRIDE Coverage**: Each component is evaluated against all six STRIDE categories
3. **DREAD Scoring Hygiene**: Each threat has a numeric score for all five DREAD dimensions with an aggregated risk level
4. **Mitigation Completeness**: Every enumerated threat has at least one recommended mitigation
5. **Bilingual Output**: English and Korean variants are produced for every document
6. **Frontmatter Compliance**: All outputs include the standard `doc_id`, `version`, and `status` frontmatter

## Error Handling

| Error               | Cause                                        | Resolution                                            |
| ------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `SDSNotFoundError`  | SDS document missing at expected path        | Generate SDS via SDS Writer first                     |
| `SessionStateError` | Operation called in an invalid session state | Follow session workflow (`startSession` → `finalize`) |
| `GenerationError`   | Threat Model content generation failed       | Inspect `phase` field and retry                       |
| `FileWriteError`    | Output path not writable                     | Verify permissions on `docs/tm` and scratchpad        |

## Configuration

```yaml
# .ad-sdlc/config/threat-model-writer.yaml
threat_model_writer:
  scratchpad_base_path: '.ad-sdlc/scratchpad'
  public_docs_path: 'docs/tm'
```

## Related Documentation

- [SDS Writer Agent](sds-writer.md)
- [Issue Generator](issue-generator.md)
- [SDP Writer Agent](sdp-writer.md)
