# SVP Writer Agent Documentation

## Overview

The SVP Writer Agent is responsible for generating a Software Verification Plan (SVP) from an approved Software Requirements Specification (SRS) and the set of generated GitHub issues. It is a verification-focused component of the AD-SDLC document pipeline that derives test cases from use cases and non-functional requirements, organizes them across Unit, Integration, and System verification levels, and produces a traceability matrix that links tests back to requirements and implementation work items.

## Pipeline Position

```
Collector → PRD Writer → SRS Writer → SDP Writer → SDS Writer → Threat Model Writer → Issue Generator → SVP Writer
                                                                                                             ↑
                                                                                                       You are here
```

## Purpose

The SVP Writer Agent:

1. Reads and parses the SRS document to extract use cases (UC) and non-functional requirements (NFR)
2. Reads the generated issues to link test cases to concrete implementation work items
3. Derives positive, negative, and alternative-flow test cases from each use case
4. Generates performance, security, and reliability test cases from NFRs
5. Assigns each test case to a verification level (Unit, Integration, or System)
6. Builds a traceability matrix from requirements to test cases to issues
7. Outputs a structured SVP document in both English and Korean

## Input

- **SRS location**: `.ad-sdlc/scratchpad/documents/{project_id}/srs.md`
- **Issues location**: `.ad-sdlc/scratchpad/issues/issues.json`
- **Format**: Markdown SRS document and JSON issue definitions
- **Requirements**: SRS must enumerate use cases and NFRs; issues must be generated before SVP generation

## Output

- **Scratchpad (English)**: `.ad-sdlc/scratchpad/documents/{project_id}/svp.md`
- **Scratchpad (Korean)**: `.ad-sdlc/scratchpad/documents/{project_id}/svp.kr.md`
- **Public (English)**: `docs/svp/SVP-{project_id}.md`
- **Public (Korean)**: `docs/svp/SVP-{project_id}.kr.md`
- **Format**: Markdown document with structured SVP sections and YAML frontmatter

## ID Conventions

| Type                  | Pattern          | Example  |
| --------------------- | ---------------- | -------- |
| SVP Document          | SVP-{project_id} | SVP-001  |
| Unit Test Case        | TC-U-{NNN}       | TC-U-001 |
| Integration Test Case | TC-I-{NNN}       | TC-I-001 |
| System Test Case      | TC-S-{NNN}       | TC-S-001 |
| Traceability Entry    | TR-{NNN}         | TR-001   |

## SVP Sections

The generated SVP captures:

- **Verification Strategy** — Overall approach, entry/exit criteria, and verification levels
- **Test Environment** — Tools, frameworks, platforms, and fixture data required
- **Unit Verification** — `TC-U-XXX` cases derived primarily from UC preconditions and NFR boundaries
- **Integration Verification** — `TC-I-XXX` cases covering component interactions and data flows
- **System Verification** — `TC-S-XXX` cases covering end-to-end UC flows and NFR acceptance
- **Traceability Matrix** — Links from SRS requirements (UC/NFR) to test cases and issue numbers
- **Coverage Summary** — Aggregate counts per verification level and requirement category

## CLI Integration

```bash
# Generate SVP for a project (after issues are generated)
ad-sdlc generate-svp --project 001
```

## API Reference

### SVPWriterAgent

Main orchestrator class for SVP generation. Implements `IAgent` for unified
instantiation through `AgentFactory`.

#### Methods

| Method                           | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `initialize()`                   | Initialize the agent (IAgent interface)                   |
| `dispose()`                      | Release resources and clear session (IAgent interface)    |
| `getSession()`                   | Return the current generation session, or `null` if none  |
| `startSession(projectId)`        | Start a new generation session by parsing SRS and issues  |
| `generateFromProject(projectId)` | Run the full pipeline (start → finalize) in one call      |
| `finalize()`                     | Persist generated SVP to scratchpad and public docs paths |

### Helper Modules

| Module             | Responsibility                                                    |
| ------------------ | ----------------------------------------------------------------- |
| `TestCaseDeriver`  | Transforms SRS use cases into positive/negative/alternative cases |
| `NFRTestGenerator` | Generates performance/security/reliability cases from NFR entries |

### Agent ID

Registered as `svp-writer-agent` (`SVP_WRITER_AGENT_ID`) for `AgentFactory`.

## Quality Criteria

The SVP Writer Agent ensures:

1. **Source Traceability**: Every SVP references its source SRS document ID and links test cases to UC/NFR IDs and issue numbers
2. **Use Case Coverage**: Each use case produces at least one positive and one negative test case
3. **NFR Coverage**: Every non-functional requirement has at least one measurable test case with explicit acceptance criteria
4. **Level Balance**: Test cases are distributed across Unit, Integration, and System verification levels
5. **Bilingual Output**: English and Korean variants are produced for every document
6. **Frontmatter Compliance**: All outputs include the standard `doc_id`, `version`, and `status` frontmatter

## Error Handling

| Error                 | Cause                                        | Resolution                                            |
| --------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `SRSNotFoundError`    | SRS document missing at expected path        | Generate SRS via SRS Writer first                     |
| `IssuesNotFoundError` | Issues file missing at expected path         | Generate issues via Issue Generator first             |
| `SessionStateError`   | Operation called in an invalid session state | Follow session workflow (`startSession` → `finalize`) |
| `GenerationError`     | SVP content generation failed                | Inspect `phase` field and retry                       |
| `FileWriteError`      | Output path not writable                     | Verify permissions on `docs/svp` and scratchpad       |
| `ValidationError`     | Generated SVP failed schema validation       | Review `errors` list returned by the validator        |

## Configuration

```yaml
# .ad-sdlc/config/svp-writer.yaml
svp_writer:
  scratchpad_base_path: '.ad-sdlc/scratchpad'
  public_docs_path: 'docs/svp'
  verification_levels:
    - unit
    - integration
    - system
```

## Related Documentation

- [SRS Writer Agent](srs-writer.md)
- [Issue Generator](issue-generator.md)
- [SDP Writer Agent](sdp-writer.md)
- [Threat Model Writer Agent](threat-model-writer.md)
