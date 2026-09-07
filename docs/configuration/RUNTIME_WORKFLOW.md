# Workflow settings used by the CLI

`ad-sdlc run` resolves the selected project's raw workflow into a typed
`ResolvedRuntimeConfig` and an `EffectiveExecutionPlan` before constructing an
adapter. Normal execution, `run --dry-run`, runtime validation, monitoring,
results, and persisted sessions use this boundary. The CLI does not execute a
user-defined workflow engine.

```sh
ad-sdlc run "Build the project" --project-dir ./project --dry-run --format json
ad-sdlc validate --format json
ad-sdlc status --project-dir ./project --format json
```

A dry-run validates configuration; it does not contact the SDK, validate remote
credentials, or promise that remote resources are available. Runtime findings
include severity, code, file/source, full property path, reason, and a corrective
action. Errors exit with status 1 for both run and dry-run. JSON stdout contains
one object; diagnostics from execution libraries go to stderr. Snapshots contain
only resolved supported policy and canonical SDK hints, never substituted
credentials or unrelated environment/extension values.

## Precedence and absence

Workflow runtime precedence, highest first:

1. Explicit CLI options.
2. The direct environment variables in the table below.
3. `.ad-sdlc/config/workflow.<environment>.yaml`.
4. `.ad-sdlc/config/workflow.yaml`.
5. `DEFAULT_ORCHESTRATOR_CONFIG`, shared with the programmatic orchestrator.

`AD_SDLC_ENV` selects the overlay before `NODE_ENV`. Missing overlays are allowed;
malformed active overlays are errors, even when a higher layer would overwrite
them. Environment names use letters, digits, underscores, or hyphens. There is no
implicit environment variable for other properties. An absent Commander option
or Zod field remains absent. `false` and meaningful zero values remain explicit.
Every supplied layer is audited before unknown fields/defaults can hide a request.
Conflicts between aliases in one source are errors; ordinary overrides between
sources are allowed.

Supported numeric settings accept finite integers within the documented ranges.
YAML boolean fields require booleans. Direct boolean environment overrides and
`--halt-on-verification-failure` accept `1/0`, `true/false`, `yes/no`, `on/off`,
case-insensitively. Empty or unrecognized values are errors. Numeric external
strings must contain decimal digits, without fractions, NaN, or Infinity.
`${VAR}` substitution is retained for explicitly supplied values. Substituted
runtime scalars are validated, and `${PWD}` refers to `--project-dir`, not the
calling process's directory. Unknown substitution variables remain unresolved
and fail validation if used as a runtime scalar. The selected project owns all
execution and SDK agent context.

**Compatibility exception:** `feature-flags.yaml` retains its existing resolver
and precedence: environment > CLI > YAML > default. Its existing boolean grammar
also remains unchanged. `AD_SDLC_USE_SDK_FOR_WORKER` / `--use-sdk-for-worker` is a
deprecated compatibility flag; SDK execution is already used for every stage.
It is not a concurrency control.

## Supported settings and owners

All timeout values are **total stage budgets**, including attempts and backoff.
The default values below are live defaults; parsing does not insert them.

| Workflow property                              | Unit/range                                        | Runtime default                        | Enforcement owner                                      | CLI option                                 | Direct environment override            |
| ---------------------------------------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------------------ | ------------------------------------------ | -------------------------------------- |
| `pipeline.default_mode`                        | greenfield/enhancement/import                     | greenfield                             | Canonical plan builder                                 | `--mode`                                   | `AD_SDLC_MODE`                         |
| `execution.local_mode`                         | boolean                                           | false                                  | Canonical plan builder                                 | `--local` / `--no-local`                   | `AD_SDLC_LOCAL`                        |
| `global.approval_mode`                         | auto/manual/critical                              | auto                                   | Existing `ApprovalGate` at canonical approval stages   | `--approval-mode`                          | `AD_SDLC_APPROVAL_MODE`                |
| `execution.max_parallel_stages`                | stages, 1–100                                     | 3                                      | `StageScheduler` / `maxParallelAgents`                 | `--max-parallel-stages`                    | `AD_SDLC_MAX_PARALLEL_STAGES`          |
| `global.retry_policy.max_attempts`             | total attempts, 1–100                             | **4**                                  | Scheduler / `RetryExecutor`                            | `--max-attempts`                           | `AD_SDLC_MAX_ATTEMPTS`                 |
| `global.retry_policy.backoff`                  | fixed/linear/exponential/fibonacci                | exponential                            | `RetryExecutor`                                        | `--retry-backoff`                          | `AD_SDLC_RETRY_BACKOFF`                |
| `global.retry_policy.base_delay_seconds`       | seconds, 0–2147483                                | 5                                      | `RetryExecutor`, converted to ms once                  | `--retry-base-delay-seconds`               | `AD_SDLC_RETRY_BASE_DELAY_SECONDS`     |
| `global.retry_policy.max_delay_seconds`        | seconds, 0–2147483, at least effective base delay | 60                                     | `RetryExecutor`, converted to ms once                  | `--retry-max-delay-seconds`                | `AD_SDLC_RETRY_MAX_DELAY_SECONDS`      |
| `execution.stage_timeout_ms`                   | ms, 1–2147483647                                  | 300000                                 | Scheduler deadline                                     | `--stage-timeout-ms`                       | `AD_SDLC_STAGE_TIMEOUT_MS`             |
| `execution.stage_timeouts_ms.<canonical-name>` | ms, 1–2147483647                                  | inherited budget                       | Scheduler deadline; graph unchanged                    | none                                       | none                                   |
| `global.timeouts.<phase>`                      | seconds, 1–2147483                                | inherited budget, normally 300 seconds | Phase-to-stage mapping, then scheduler deadline        | none                                       | none                                   |
| `global.vnv.rigor`                             | minimal/standard/strict                           | standard                               | Existing `StageVerifierAgent` rules                    | `--vnv-rigor`                              | `AD_SDLC_VNV_RIGOR`                    |
| `global.vnv.halt_on_verification_failure`      | boolean                                           | false                                  | Existing scheduler gate, **only when rigor is strict** | `--halt-on-verification-failure <boolean>` | `AD_SDLC_HALT_ON_VERIFICATION_FAILURE` |
| `execution.retry_attempts` (deprecated)        | retries, 0–99                                     | absent                                 | Validated alias for max attempts, **add one**          | none                                       | none                                   |
| `execution.retry_delay_ms` (deprecated)        | ms, 0–2147483647                                  | absent                                 | Validated alias for base delay                         | none                                       | none                                   |

`maxRetries: 3` in the programmatic API still permits four attempts;
`maxRetries: 0` permits one. The old schema's inserted `max_attempts: 3` was never
forwarded by the CLI. The resolved default is four to preserve actual behavior.
Explicit `max_attempts: 3` now means exactly three attempts. The resolver
translates total attempts into the retained API once; the scheduler is the only
retry loop. Exponential multiplier remains 2 and jitter remains 0. Cleanup is
awaited before backoff/replacement. Cancellation interrupts backoff and stops
queued work; cleanup failures remain non-retryable. Cleanup may finish after the
execution deadline within the existing cleanup grace; it never authorizes a new
attempt or a fresh stage budget.

The concurrency limit bounds runnable stage invocations, including the graph's
single worker stage. The CLI does **not** instantiate `WorkerPoolManager` and
does not claim to bound worker fan-out within agent behavior.

`auto` approves existing gates. `manual` prompts at those gates and denies when
there is no interactive terminal. `critical` approves unless prior results
contain failures; it does not introduce new criticality semantics. `custom` is
rejected in CLI workflows because the CLI does not supply a custom approval
strategy. Existing programmatic subclass strategies remain available. Only
`strict` plus `halt_on_verification_failure: true` blocks on failed verification;
other combinations retain advisory failures. This change adds no verification
coverage or new approval semantics (#951 and #953 remain separate).

## Timeout specificity and phase mapping

For **each concrete stage**, apply sources from lowest to highest priority.
Within one source apply blanket budget, then matching phase, then stage override.
Thus a higher-priority blanket budget wins over a lower-priority stage override.
This is deliberately different from merging three independent timeout maps and
applying specificity after source merging.

| Phase (seconds)       | Concrete canonical stages                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document_generation` | `prd_generation`, `srs_generation`, `sdp_generation`, `sds_generation`, `ui_spec_generation`, `threat_modeling`, `tech_decisions`, `svp_generation`, `prd_update`, `srs_update`, `sds_update`, `doc_indexing` |
| `issue_creation`      | `issue_generation`                                                                                                                                                                                            |
| `orchestration`       | `orchestration` (controller)                                                                                                                                                                                  |
| `implementation`      | `implementation` (worker)                                                                                                                                                                                     |
| `pr_review`           | `review` (including local reviewer)                                                                                                                                                                           |

Other stages inherit the blanket budget unless overridden by their canonical
name. Overrides for canonical stages in another preset are allowed for reuse
across modes; invented/legacy identifiers are rejected. For example, a base
`stage_timeouts_ms.prd_update: 8000` loses to an overlay `stage_timeout_ms: 1000`;
an explicit CLI `--stage-timeout-ms 20` then sets every selected stage to 20 ms.

## Canonical topology and stop behavior

`src/ad-sdlc-orchestrator/types.ts` remains the authoritative definitions of
stages, agents, dependencies, approval metadata, and SDK hints. The pure
`buildCanonicalPlan` shares these with execution and dry-run. Baseline graphs
have 19/15/5 slots. Local Greenfield removes `github_repo_setup` (18 slots) and
rewires its dependencies to `repo_detection`; local runs substitute
`local-reviewer` and, for Import, `local-issue-reader`.

`--stop-after` must name a stage in the effective graph, so removed local stages
are invalid. The scheduler executes the entire current ready parallel group
before stopping, including peers still queued under concurrency 1. Subsequent
groups are skipped. Dry-run keeps the full graph and exposes `stopAfterStage` and
`stopBehavior`; it does not falsely truncate peers that can execute.

## Unsupported settings and migration

Existing files are never silently overwritten or rewritten. Run `validate` or a
dry-run, edit the listed properties, and review the resulting plan. The broad
workflow syntax schema remains available for separate API consumers; the CLI
adds support validation without making unrelated agent schemas globally strict.
`validateAllConfigs(project, { runtime: true })` exposes the same findings to API
consumers; default schema-only library validation remains available.

| Existing property or block                                                                                                      | SDK CLI disposition and migration                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipeline.stages`, `pipeline.modes.*.stages`                                                                                    | Reject custom topology. Remove lists and select `pipeline.default_mode`. Move timeout intent to canonical `execution.stage_timeouts_ms` keys after reviewing the stage's actual role.                                                                                  |
| Legacy `implement` with `agent: controller`                                                                                     | No automatic alias. Controller maps to **orchestration**; **implementation** belongs to worker. Choose the intended budget explicitly.                                                                                                                                 |
| `execution.max_parallel_workers`, `agents.controller.scheduling.max_workers`, legacy stage `max_parallel`                       | Reject; remove. Their advertised worker-pool behavior was never enforced by the SDK CLI. `max_parallel_stages` is a different, explicitly named control, not a rename.                                                                                                 |
| Flat `quality_gates.coverage`, `complexity`, `requireTests`, `requireReview`                                                    | Reject active values; remove. No reachable coverage/complexity/test/review enforcement owner. Coverage does not map to rigor; review does not map to human approval.                                                                                                   |
| Nested `quality_gates.document_quality`, `code_quality`, `security`                                                             | Reject active policies; remove. Existing verifier rules remain as implemented; passing settings in a prompt is not enforcement. Explicit false gates, zero coverage, and empty required-section lists are reported as inactive. Empty blocks do not manufacture gates. |
| V&V `generate_vnv_plan`, `generate_vnv_report`, `generate_rtm`, `cross_document_consistency`, `acceptance_criteria_validation`  | Reject both true and false: these toggles do not govern the current canonical graph/verifier. Remove them. Only rigor and halt policy are supported here.                                                                                                              |
| `global.approval_gates` / `approval_mode: custom`                                                                               | Remove custom gate map and select an existing supported mode; custom strategy requires the programmatic API.                                                                                                                                                           |
| Workflow `agents.*` model/tools/coding/scheduling/verification/review settings                                                  | Reject active settings. SDK project definitions come from the installed, customizable `.claude/agents/<agent>.md` files (#947); separate controller/reviewer API settings do not configure this run loop.                                                              |
| Workflow `github`, `notifications`, `logging`, `monitoring`, `scratchpad`, `telemetry`, `token_budgets`, `global.investigation` | No reachable workflow-driven owner on this CLI path; remove active settings and configure the separate consuming API where applicable. Explicitly disabled notifications/monitoring/telemetry integrations receive an inactive finding.                                |
| Workflow `global.project_root`, `scratchpad_dir`, `output_docs_dir`, `log_level`                                                | Remove these workflow controls. `--project-dir` owns the project; SDK CLI sessions use `.ad-sdlc/scratchpad/pipeline`. Programmatic orchestrator configuration remains available.                                                                                      |
| `name`, `description`, `pipeline.description`, root `extensions`                                                                | Descriptive metadata; accepted, excluded from runtime policy/snapshot. Unknown runtime keys elsewhere are errors even when their values are false or empty.                                                                                                            |
| `agents.yaml` and SDK prompt frontmatter                                                                                        | Retain their existing registry/schema/SDK consumers. They are not topology or workflow policy layers; existing validation and canonical asset delivery remain intact.                                                                                                  |

Minimal, standard, and enterprise initialization now all emit:

```yaml
version: '1.0.0'
pipeline:
  default_mode: greenfield
```

The three template names remain for compatibility and now share the canonical
SDK setup, assets, and document templates. Deprecated public initializer
quality/worker/extra-feature preset types are retained for source compatibility
but are not emitted, reinterpreted, or advertised as enforced behavior. Each exact generated
workflow/agent object is validated before any scaffold write, and generated
workflow runtime support is also checked. See the supported, expanded
[example workflow](../../examples/config/workflow.yaml).

To migrate retry aliases, replace `execution.retry_attempts: 3` with
`global.retry_policy.max_attempts: 4` and `execution.retry_delay_ms: 5000` with
`global.retry_policy.base_delay_seconds: 5`. A fractional-second legacy delay
remains usable through its validated millisecond alias. Do not put an alias and
its canonical property in the same file; that is an error even if numerically
equivalent.

## Saved plans and resume

Every CLI session saves `runtimeSnapshot` in its existing pipeline YAML file at
start, after scheduler progress, and in final results. It includes the concrete
graph/budgets, supported approval/V&V policy, retry policy with total attempts,
winning sources, stop condition, and findings. `monitorPipeline()`, `getStatus()`,
and results expose that same snapshot. The real `status` command shows saved runs
under `runs` in JSON, alongside any legacy state-manager `projects` view. It never
invents a saved graph from legacy labels or today's workflow.

`--resume <id>` retains the saved graph, local mode, and runtime policy even when
current workflow YAML or direct runtime environment overrides have changed or
become malformed. Explicit runtime CLI overrides are rejected on resume except
`--stop-after`, which must belong to the saved graph and is recorded as a CLI
source. Omit it to retain the saved stop condition. To change other policy, start
a fresh run. SDK agent files are still read from the explicitly selected project,
including after moving a project, and existing checkpoint/SDK resume behavior is
preserved. A missing session is an error, not a fresh run.

Old sessions remain readable. Status explicitly reports `runtimeSnapshotStatus:
"unavailable"`. Legacy resume uses its saved mode/local flag with built-in policy,
ignores current workflow policy, reports a `legacy-session` warning, and persists
the resulting snapshot. It does not pretend the historical run used that policy.
Malformed new snapshots fail before adapter creation. This extends existing
session persistence rather than adding a second state system.

## Offline evidence

The ordinary Vitest lane includes Commander/service tests, source CLI subprocess
JSON checks, initialized template × mode × local execution, and the production
SDK lifecycle fixtures. No test needs paid SDK calls or GitHub resources.
Observed controlled behavior includes:

- Enhancement roots reach maximum simultaneous invocation counts of 1 versus 2.
- Total attempt limits 1 versus 3 produce exactly 1 versus 3 invocations.
- Four attempts with base 1 second yield fixed times `[0, 1000, 2000, 3000]`,
  linear with a 2-second cap `[0, 1000, 3000, 5000]`, and exponential with a
  3-second cap `[0, 1000, 3000, 6000]` milliseconds.
- The same 50 ms operation fails at a 20 ms budget and succeeds at 100 ms.
- A 1500 ms total budget with a 1000 ms retry delay permits attempts at 0 and
  1000 ms, never a fresh third budget.
- Controlled SDK cleanup must finish before the configured delay and replacement;
  existing cancellation/cleanup lifecycle suites also remain in the offline lane.
