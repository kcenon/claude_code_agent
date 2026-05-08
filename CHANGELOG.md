# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-09

The v0.1.0 release completes the AD-13 cutover: every pipeline stage now routes through the official Claude Agent SDK via a single `ExecutionAdapter`, and the in-tree `AgentBridge` / `AgentDispatcher` / `AgentRegistry` stack has been removed. The 35-stage SDLC pipeline, V&V gates, and traceability matrix are unchanged; tool use, sub-agent delegation, and session management are now handled by the SDK itself. See [`docs/architecture/v0.1-hybrid-pipeline-rfc.md`](docs/architecture/v0.1-hybrid-pipeline-rfc.md) for the architecture rationale and [`docs/architecture/v0.1-migration-guide.md`](docs/architecture/v0.1-migration-guide.md) for migration steps.

### Added

- `ExecutionAdapter` as the single Claude Agent SDK entry point for every pipeline stage; all 35 stages route through it (#797, #798, #799)
- Hook pipeline for scratchpad auto-capture and telemetry forwarding from SDK tool calls
- `PipelineStageDefinition` extension with `skills`, `mcpServers`, `maxTurns`, and `permissionMode` fields so each stage can declare its knowledge-layer needs declaratively
- Pre-load of `claude-config` plugin skills for the `worker` and `pr-reviewer` stages, enabling shared coding-style and review guidelines across consumer projects
- `.claude/commands/` entries for ad-sdlc operator workflows (pipeline run, stage retry, session inspection)
- `.mcp.json` with the GitHub MCP server registered out of the box for issue/PR-handling stages
- `PipelineCheckpointManager` records the SDK `session_id` per stage so a mid-stage crash can resume via the SDK's `resume: sessionId` and recover its tool-loop context. Checkpoint schema is bumped from v1 to v2 with backward-compatible auto-migration; adapters that do not surface a session id (Bedrock/Vertex) gracefully fall back to a clean stage restart (#800)
- README "Built with Claude Agent SDK" badge, 3-tier architecture mermaid diagram, and Dependencies section that name the single Agent SDK runtime dependency (#801)

### Changed

- `AdsdlcOrchestratorAgent` slimmed from ~1,443 lines to <=950 by removing the dispatcher / bridge plumbing left over after the AD-13 cutover; stage-scheduling and approval-gate logic split out into `StageScheduler.ts` and `ApprovalGate.ts`. Public API (`startSession`, `executePipeline`, `loadPriorSession`, `findLatestSession`) signatures are unchanged (#799)
- `WorkerPoolManager`, `WorkerAgent`, `CollectorAgent`, `LLMExtractor`, and `InvestigationEngine` migrated off `AgentBridge`/`BridgeRegistry` to `ExecutionAdapter`; their public surfaces now accept an `ExecutionAdapter` and tests use `MockExecutionAdapter` (#835, #836, #837)
- `src/cli.ts` migrated off `createDefaultBridgeRegistry`/`isClaudeCodeSession` to `hasRealExecutionEnvironment()` and `describeExecutionEnvironment()` from `src/execution/env.ts` for `doctor`, `pipeline --dry-run`, and pipeline pre-check diagnostics (#838)
- All 33 cutover-target stages (Doc Writers, Doc Updaters, Document Reader, Analyzers, Setup, Collection, Execution, QA, V&V, Doc Index Generator) routed through `ExecutionAdapter` independent of the `AD_SDLC_USE_SDK_FOR_WORKER` feature flag (#823, #824, #825, #826, #827)
- README architecture section now matches the actual SDK dependency rather than the v0.0.1 wording that pre-dated AD-13 (#801)
- Database Schema Specification (DBS) emitted as a standalone document alongside the SDS (#760)

### Removed

- **Breaking**: Bridge / Dispatcher / Registry stack removed now that all consumers route through `ExecutionAdapter`. Removed source modules: `src/agents/AgentBridge.ts`, `src/agents/AgentDispatcher.ts`, `src/agents/AgentRegistry.ts`, `src/agents/AgentTypeMapping.ts`, `src/agents/AgentFactory.ts`, `src/agents/bootstrapAgents.ts`, `src/agents/BridgeRegistry.ts`, `src/agents/ExecutionScaffoldGenerator.ts`, and the entire `src/agents/bridges/` directory (`AnthropicApiBridge`, `ClaudeCliSubprocessBridge`, `ClaudeCodeBridge`, `StubBridge`, `agentDefinition`, `index`, `tools`). External consumers importing any of these symbols from `@ad-sdlc/agents` must migrate to the `ExecutionAdapter` API in `src/execution/`. The `IAgent` interface and per-agent module re-exports remain available (#798)
- **Breaking**: `@anthropic-ai/sdk` runtime dependency removed; replaced by `@anthropic-ai/claude-agent-sdk@^0.2.132` as the only AI runtime dependency (#798)

### Fixed

- Missing YAML frontmatter on `.claude/agents/doc-code-comparator.md` so the agent registry can resolve the doc-code-comparator stage (#AD-04)
- Naming alignment between the `validation` agent definition and `src/validation-agent/` so V&V stage routing matches the agent registry id (#AD-05)

### Breaking Changes

- Internal: `AgentBridge`, `AgentDispatcher`, `AgentRegistry`, `AgentFactory`, `BridgeRegistry`, `bootstrapAgents`, and `ExecutionScaffoldGenerator` exports are gone. Migrate to `ExecutionAdapter` in `src/execution/`.
- Pipeline checkpoint schema migrates from v1 to v2 (auto-migrated on load; v1 fixtures load with `sdkSessionId` undefined).
- Runtime dependency switch: install Claude Agent SDK >= 0.2.132 (now the only `@anthropic-ai/*` package shipped). Consumers depending on `@anthropic-ai/sdk` directly must remove that dependency.

[Migration Guide](docs/architecture/v0.1-migration-guide.md)

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
