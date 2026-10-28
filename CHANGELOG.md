# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Delivery outcomes and SDK usage metrics (#956). Every run builds versioned records (`schemaVersion: 1`, `src/telemetry/deliveryMetrics.ts`) for each execution attempt, stage, and run: identifiers (session, run, stage, attempt, SDK session), timestamps and durations, retry index, resume source and prior status, outcome (attempt `succeeded`, `failed`, `timed_out`, `cancelled`; stage `PipelineStageStatus`; run `PipelineStatus` and exit status), usage `{ inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens }` where unknown is `null` and never 0, turn count, tool invocations counted from `tool_use` blocks (deduplicated by id, with per-tool counts), model, SDK version, and projections of the #951 verification and #953 approval records. Failed, retried, timed-out, and cancelled attempts keep the usage they consumed. `StageExecutionResult.metrics` reports the SDK observations on every outcome, `PipelineResult.metrics` and `run --format json` carry the records, and with telemetry consent `ad-sdlc run` appends them to `.ad-sdlc/scratchpad/metrics/<session-id>.jsonl`. The new `ad-sdlc telemetry report` reads the exports (and an optional `--supplied` review file for accepted pull requests, rework time, and requirement evidence) and states each metric's source, sample, missing count, and denominator. Records contain no prompts, requirement text, tool inputs, error messages, approval reasons, paths, or credentials. See the [delivery metrics guide](docs/guides/delivery-metrics.md)
- Explicit approval policy (#953). Each stage passes an approval gate before it runs; its boundaries are `review` (the stage graph's review points, now including Import `orchestration`), `delivery` (externally visible effects declared per agent: repository and issue creation, branch pushes, pull requests, merges), and `failed_verification` (a dependency failed a required check without blocking). `auto` (still the default) approves every boundary by policy, `manual` asks a person at every boundary, `critical` asks before every externally visible effect and after a failed required check, and `custom` calls `approveStage` with an `ApprovalRequest`. A decision request shows the inputs, the completed upstream artifacts (manifest references), failed checks, and the proposed action. Every decision is a durable record (`StageResult.approval`, `PipelineResult.approval`, session and checkpoint state, `run --format json`) with mode, boundaries, effects, a scope fingerprint, session and stage identity, `decidedBy`, `decidedAt`, outcome, and reason; `--resume` reuses a decision while its scope fingerprint is unchanged and asks again otherwise. A rejection skips the stage and its dependents and ends the run as `rejected` (exit status 2). Without an interactive terminal, or with the new `--non-interactive` option, a requested decision pauses the run as `awaiting_decision` (exit status 3) for `--resume`. `ad-sdlc run --dry-run` prints each stage's gate, and the generated matrix is in the [approval policy guide](docs/guides/approval-policy.md)
- Verification policy profiles and coverage (#951). `global.vnv.profile` / `AD_SDLC_VNV_PROFILE` / `--vnv-profile` select `advisory` (failed checks are findings; the default) or `delivery` (a failed required check fails its stage, skips the stages that have not run, fails the run, and exits 1). Every stage slot of every mode now has a named check set or an explicit not-applicable reason (`VERIFICATION_APPLICABILITY`, generated into [verification coverage](docs/architecture/verification-coverage.md) and checked by `npm run docs:check-inventory`), and new check sets cover `issue_reading`, `orchestration`, `regression_testing`, and `validation-agent`. Run results, session/checkpoint state, and `run --format json` carry the effective profile and its source and a per-stage state (`verified_pass`, `failed`, `advisory_findings`, `skipped`, `not_applicable`); see the [verification policy guide](docs/guides/verification-policy.md)
- [ADR-0006](docs/adr/ADR-0006-keep-or-kill-orphaned-public-subsystems.md) recording the accepted keep-or-kill verdict for orphaned-but-public subsystems on two axes — run-loop reachability and `src/index.ts` public-export status — with a per-subsystem disposition and SemVer impact. No subsystem source is deleted; per-disposition execution is deferred to follow-up issues (#874, part of #866)

### Changed

- Usage on failure (#956): when the SDK ends with an error result that carries zeroed usage (it does so on crash results), `StageExecutionResult.tokenUsage` and the artifact manifest's `execution.tokenUsage` now keep the partial totals of the assistant messages seen before it instead of zeros. A result without `usage` no longer fails the execution with a type error. The text output of `ad-sdlc run` ends with `Usage:` and `Metrics:` lines
- Telemetry privacy policy 1.1.0 (#956) lists the local delivery metrics export. Consent recorded under 1.0.0 does not enable the export; `ad-sdlc telemetry enable` shows the policy again until it is accepted, and `ad-sdlc telemetry status` shows whether runs export delivery metrics
- Approval semantics (#953). The default stays `auto`. `critical` no longer approves every gate unless a prior stage failed; it now asks before `github_repo_setup`, `issue_generation`, and `review`, and after a non-blocking failed required check (dependents of a failed stage are still skipped). `manual` now also gates `review`, the Import `orchestration` stage, and the parallel Greenfield stages (`ui_spec_generation`, `threat_modeling`, `tech_decisions`), which the gate skipped before. A `manual` run without a terminal pauses (exit status 3) instead of denying the gate and continuing. A run with a rejected stage reports `rejected` instead of `completed`; `PipelineStatus` gains `rejected` and `awaiting_decision`. Runtime snapshots record `stages[].effects`; snapshots saved before this change are back-filled from the agent effect table. See the migration section of the [approval policy guide](docs/guides/approval-policy.md)
- Stage verification (#951): the default stays advisory, and without a profile `strict` rigor plus `halt_on_verification_failure: true` still blocks (now reported as the `delivery` profile). Under every profile, the implementation and review check sets now read the worker (`results/WO-*-result.yaml`) and reviewer (`reviews/*`) outputs, `issue_generation` requires acceptance criteria, checks that cannot evaluate their input are reported as skipped instead of passed, not-applicable stages no longer add a `No verification rules defined` warning, and an unclassified stage fails verification. Under `advisory` these changes add findings only; under `delivery` the newly covered stages can fail a run. See the migration section of the [verification policy guide](docs/guides/verification-policy.md)
- Reconciled `package.json` `version` from `0.0.1` to `0.1.0` to match the released `[0.1.0]` CHANGELOG baseline (the cutover already shipped under `0.1.0`); fixes the stale-version disagreement so future SemVer bumps have a correct baseline (#874)
- Optional OpenTelemetry peer dependencies move to OTel JS SDK 3.x (#1011): `@opentelemetry/sdk-trace-base` (removed upstream) is replaced by `@opentelemetry/sdk-trace` `^3.0.0`, alongside `@opentelemetry/api` `^1.10.0`, `@opentelemetry/resources` `^3.0.0`, and `@opentelemetry/sdk-node` / `@opentelemetry/exporter-trace-otlp-http` `^0.300.0`. Consumers that enable tracing must install `@opentelemetry/sdk-trace` instead of `@opentelemetry/sdk-trace-base`; the `observability.yaml` schema is unchanged

### Deprecated

- `StageExecutionResult.toolCallCount` and `tokenUsage` (#956). Both keep their values: `toolCallCount` is the larger of the distinct assistant messages and the SDK turn count, so it counts turns, not tool invocations; `tokenUsage` reports unknown as 0 and merges cache reads with cache creation. Use `metrics.turnCount`, `metrics.toolUseCount`, and `metrics.usage`

### Fixed

- Performance-regression gate is now enforced instead of decorative: removed `continue-on-error` from the benchmark and regression-check steps in `performance.yml` so a regression fails the job, and pointed `perf:check` at `tsx scripts/check-regression.ts` (the previous `node dist/scripts/check-regression.js` target was never emitted — `tsconfig` `rootDir`/`include` cover `src/` only, which also mis-resolved the baseline path under `dist/`). `check-regression` now parses Vitest's benchmark JSON shape (`files[].groups[].benchmarks[]`) instead of the Jest-style `testResults` shape it never received. Reconciling the placeholder baseline operation names/metrics with the real benchmarks so an intentional regression actually fires is tracked as a follow-up (#891, #895)

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
