# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `PipelineCheckpointManager` records the SDK `session_id` per stage so a mid-stage crash can resume via the SDK's `resume: sessionId` and recover its tool-loop context. Checkpoint schema is bumped from v1 to v2 with backward-compatible auto-migration (v1 fixtures load as v2 with `sdkSessionId` undefined); adapters that do not surface a session id (e.g. Bedrock/Vertex) gracefully fall back to a clean stage restart (#800)
- UI Specification Writer agent for generating screen specifications, user flow documents, and design system references from SRS use cases (#770)
- Document Audit CLI for generated output integrity verification with frontmatter, cross-reference, and traceability checks (#769)
- Technology Decision Writer agent with parallel pipeline stage for comparative analysis (#762)
- SVP Writer agent with automated test case derivation from SRS requirements (#761)
- Threat Model Writer agent for STRIDE/DREAD analysis from SDS (#759)
- SDP Writer agent for Software Development Plan generation from PRD and SRS (#758)
- YAML frontmatter metadata on all generated documents with doc_id, version, status, and change history (#756)
- Doc Index Generator as post-pipeline stage for structured documentation indexing (#742)

### Changed

- Separate Database Schema Specification (DBS) from SDS into standalone document (#760)
- Cut over the eight Doc Writers stages (PRD, SRS, SDP, SDS, UI Spec, Threat Model, Tech Decision, SVP) from `AgentDispatcher` to the SDK `ExecutionAdapter`; routing for these stages no longer consults the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag (#823, AD-13-A, part of #797)
- Cut over the four Doc Updater + Reader stages (PRD Updater, SRS Updater, SDS Updater, Document Reader) from `AgentDispatcher` to the SDK `ExecutionAdapter`; routing is independent of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag and disjoint from the AD-13-A Doc Writers cutover set (#824, AD-13-B, part of #797)
- Cut over the four Analyzer stages (Code Reader, Codebase Analyzer, Doc-Code Comparator, Impact Analyzer) from `AgentDispatcher` to the SDK `ExecutionAdapter`; routing is independent of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag and disjoint from the AD-13-A and AD-13-B cutover sets (#825, AD-13-C, part of #797)
- Cut over the six Setup + Collection stages (Project Initializer, Mode Detector, Repo Detector, GitHub Setup, Collector, Issue Reader) from `AgentDispatcher` to the SDK `ExecutionAdapter`; routing is independent of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag and disjoint from the AD-13-A, AD-13-B, and AD-13-C cutover sets (#826, AD-13-D, part of #797)
- Cut over the final nine Execution + QA + V&V stages (Controller, Issue Generator, PR Reviewer, CI Fixer, Regression Tester, Stage Verifier, RTM Builder, Validation Agent, Doc Index Generator) from `AgentDispatcher` to the SDK `ExecutionAdapter`; routing is independent of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag and disjoint from the AD-13-A, AD-13-B, AD-13-C, and AD-13-D cutover sets. With this PR, all 33 cutover-target stages route through `ExecutionAdapter` and the AD-13 cutover (#797) is complete; only the feature-flag-gated `worker` pilot retains a conditional bridge fallback (#827, AD-13-E, completes #797)
- Slim `AdsdlcOrchestratorAgent` from ~1,443 lines to <=950 by removing the dead dispatcher / bridge plumbing left over after the AD-13 cutover (`_dispatcher` / `_bridgeRegistry` fields, `getDispatcher()` / `getBridgeRegistry()` methods, `executeViaBridge()` branch, `coordinateAgents` / `executeParallel` / `executeSequential` `BridgeRegistry`-backed helpers). Stage-scheduling and approval-gate logic split out into `StageScheduler.ts` and `ApprovalGate.ts`. Public API (`startSession`, `executePipeline`, `loadPriorSession`, `findLatestSession`) signatures are unchanged; the worker stage now routes through the adapter unconditionally and the orchestrator no longer reads `AD_SDLC_USE_SDK_FOR_WORKER` (the env flag plumbing remains in `FeatureFlagsResolver` for other consumers) (#799)

## [0.0.1] - 2025-12-27

Initial pre-release with full AD-SDLC pipeline implementation.

### Added

#### Core Pipeline

- AD-SDLC Orchestrator for full pipeline lifecycle management (#436)
- Three pipeline modes: Greenfield, Enhancement, and Import (#438)
- Pipeline resume with `--resume` and `--start-from` stage selection (#500-#504)
- Mid-stage checkpoint for crash recovery (#655)
- Inter-stage artifact content validation (#697)
- Local mode for GitHub-free pipeline execution with `--local` flag (#680, #685)

#### Document Generation Agents

- Collector Agent for multi-source requirements gathering: text, files, URLs (#113, #131, #134, #146)
- Multi-round investigation engine for pre-PRD requirements elicitation (#643)
- PRD Writer Agent with user approval workflow and quality metrics (#114, #148, #154, #704)
- SRS Writer Agent with use case generation (#116, #149)
- SDS Writer Agent with deployment architecture and database schema support (#117, #155)

#### Setup and Detection Agents

- Project Initializer for `.ad-sdlc` directory structure and configuration scaffolding (#79)
- Mode Detector for automatic Greenfield vs Enhancement vs Import selection (#147)
- Repo Detector and GitHub Repo Setup agents for repository management

#### Issue and Execution Agents

- Issue Generator with SDS-to-issue transformation and dependency management (#78)
- Controller with dependency graph analysis, prioritization, and worker pool management (#83, #85, #656)
- Worker Agent with code generation, unit test generation, self-verification, and retry logic (#86, #112, #118, #157)
- PR Reviewer with automated code review, quality gates, and merge decisions (#115, #123, #129, #130)
- CI Fixer for automatic CI failure diagnosis and resolution

#### Enhancement Pipeline Agents

- Document Reader for existing PRD/SRS/SDS parsing (#119)
- Codebase Analyzer for architecture and code structure analysis (#120)
- Code Reader for source code structure and dependency extraction (#127)
- Doc-Code Comparator for documentation-implementation gap detection (#142)
- Impact Analyzer for change implication assessment (#121)
- Analysis Orchestrator for coordinating enhancement sub-pipeline (#122)
- PRD/SRS/SDS Updaters for incremental document updates (#133, #135, #143)
- Regression Tester for existing functionality validation (#145)

#### Import Pipeline

- Issue Reader for importing existing GitHub Issues (#78)
- Local Issue Writer for non-GitHub projects (#723)

#### V&V Framework

- Stage Verifier, RTM Builder, and Validation Agent (#635)

#### Infrastructure

- Scratchpad pattern with Redis and SQLite backends for inter-agent state (#77, #281, #299)
- Docker multi-instance infrastructure with health checks and security hardening (#671, #675)
- OpenTelemetry observability integration (#351-#356)
- Multi-transport logging with file output, rotation, filtering, and sensitive data masking (#289, #292, #295-#297)
- Telemetry system for pipeline metrics (#335)
- Security module with secret management (#75, #310, #311)
- Configuration validation with Zod schemas (#80, #81)
- Error handling with retry logic and circuit breaker pattern (#144, #153)
- Token usage optimization and cost management (#159)

#### CLI

- `init` command for project scaffolding
- `validate` command for configuration verification
- `status` command for pipeline status display (#125)
- `analyze` command for documentation-code gap analysis
- `completion` command for bash/zsh/fish shell autocompletion (#321)
- Headless execution support (#210)

#### CI/CD

- GitHub Actions CI/CD pipeline (#69)
- Security scanning, linting, and automated testing workflows
