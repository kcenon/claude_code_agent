# Runtime and Documentation Inventory

> **Status**: Current
> **Last verified**: 2026-08-01

AD-SDLC previously used “agent count” for several different quantities. This
page keeps those axes separate. The table is checked against the TypeScript
stage arrays, checked-in agent definitions, release history, and canonical
PRD/SRS/SDS documents by `npm run docs:check-inventory`.

<!-- generated-runtime-inventory:start -->

| Axis                                  | Current value | Authoritative source                                         |
| ------------------------------------- | ------------: | ------------------------------------------------------------ |
| Checked-in agent definition prompts   |            36 | `.claude/agents/*.md`                                        |
| Unique agent types used by a pipeline |            29 | `PipelineStageDefinition.agentType` values                   |
| Greenfield stage slots                |            19 | `GREENFIELD_STAGES`                                          |
| Enhancement stage slots               |            15 | `ENHANCEMENT_STAGES`                                         |
| Import stage slots                    |             5 | `IMPORT_STAGES`                                              |
| Mode-specific stage slots (sum)       |            39 | All three stage-definition arrays                            |
| Support/delegated agent definitions   |             7 | Definition prompts not used as a direct pipeline `agentType` |
| v0.1 cutover targets (historical)     |            33 | `CHANGELOG.md` v0.1.0 migration record                       |
| Functional requirements               |            33 | Unique `FR-*` IDs in PRD-001                                 |
| Software features                     |            31 | Unique `SF-*` IDs in SRS-001                                 |
| Design components                     |            36 | Unique `CMP-*` IDs in SDS-001                                |

<!-- generated-runtime-inventory:end -->

“Stage slot” means one entry in a mode-specific stage array. Reused stages such
as `implementation` appear once in each applicable mode, so the sum of slots is
larger than the number of unique agent types. The 33 cutover targets describe
the historical v0.1 migration scope; they are not a current runtime count. The
verification check set or not-applicable reason of every stage slot is listed in
[verification coverage](verification-coverage.md), which the same command checks.
What each mode delivers, and the policy defaults, are in the generated
[capability matrix](capability-matrix.md).

The seven support/delegated definitions are the two orchestrators, CI fixer,
the two local-mode aliases, RTM builder, and stage verifier. They remain prompt
definitions even though they are not direct `agentType` values in the three
mode arrays.

All 36 prompts and four project commands ship in the npm asset bundle and are
installed for every template. The [asset manifest and upgrade guide](../agent-assets.md)
documents delivery validation, local/delegated closure, and customization ownership.

## Agent Definitions by Phase

The table lists every checked-in definition in `.claude/agents/`, grouped by
pipeline phase.

| Phase             | Agent                 | Role                                                                                                |
| ----------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| **Orchestration** | AD-SDLC Orchestrator  | Coordinates the full pipeline lifecycle                                                             |
|                   | Analysis Orchestrator | Coordinates the analysis sub-pipeline                                                               |
| **Setup**         | Mode Detector         | Detects Greenfield vs Enhancement vs Import mode                                                    |
|                   | Project Initializer   | Creates `.ad-sdlc` directory structure and config                                                   |
|                   | Repo Detector         | Determines if existing repo or new setup needed                                                     |
|                   | GitHub Repo Setup     | Creates and initializes GitHub repository                                                           |
| **Collection**    | Collector             | Gathers requirements from text, files, and URLs                                                     |
|                   | Issue Reader          | Imports existing GitHub Issues for Import pipeline                                                  |
|                   | Local Issue Reader    | Local-mode issue import variant without a GitHub dependency                                         |
| **Documentation** | PRD Writer            | Generates Product Requirements Document                                                             |
|                   | SRS Writer            | Generates Software Requirements Specification                                                       |
|                   | SDP Writer            | Generates Software Development Plan from PRD and SRS                                                |
|                   | SDS Writer            | Generates Software Design Specification (SDS) and a separate Database Schema Specification (DBS)    |
|                   | Threat Model Writer   | Generates STRIDE/DREAD Threat Model from SDS                                                        |
|                   | Tech Decision Writer  | Generates Technology Decision documents with alternatives analysis from the SDS technology stack    |
|                   | UI Spec Writer        | Generates UI screen specifications, user flow documents, and design system references from SRS      |
|                   | Doc Index Generator   | Generates structured documentation index (manifest, bundles, graph, router) from pipeline artifacts |
| **Planning**      | Issue Generator       | Creates GitHub Issues from SDS components                                                           |
|                   | SVP Writer            | Generates Software Verification Plan with test cases from SRS and issues                            |
| **Execution**     | Controller            | Orchestrates work distribution and monitors progress                                                |
|                   | Worker                | Implements code based on assigned issues                                                            |
|                   | Local Reviewer        | Local-mode PR review variant (no GitHub dependency)                                                 |
| **Quality**       | PR Reviewer           | Creates PRs and performs automated code review                                                      |
|                   | CI Fixer              | Automatically diagnoses and fixes CI failures                                                       |
|                   | Regression Tester     | Validates existing functionality after changes                                                      |
| **V&V**           | Stage Verifier        | Verifies every completed stage; strict mode can halt the live scheduler on failure                  |
|                   | RTM Builder           | Builds Requirements Traceability Matrix from requirements to implementation                         |
|                   | Validation Agent      | Validates final implementation against requirements and acceptance criteria                         |
| **Enhancement**   | Document Reader       | Parses existing PRD/SRS/SDS documents                                                               |
|                   | Code Reader           | Extracts source code structure and dependencies                                                     |
|                   | Codebase Analyzer     | Analyzes current architecture and code structure                                                    |
|                   | Doc-Code Comparator   | Detects gaps between documentation and code                                                         |
|                   | Impact Analyzer       | Assesses change implications and risks                                                              |
|                   | PRD Updater           | Incremental PRD updates (delta changes)                                                             |
|                   | SRS Updater           | Incremental SRS updates (delta changes)                                                             |
|                   | SDS Updater           | Incremental SDS updates (delta changes)                                                             |

Only the unique pipeline agent types counted above are direct `agentType`
values in the mode arrays. Local aliases, orchestrators, CI repair, Stage
Verifier, and RTM Builder are the support/delegated definitions.

Each definition has YAML frontmatter (name, description, tools, model) and a
Markdown body with its role, responsibilities, schemas, and workflows. The
prompt files are in English and are used by Claude during execution.
