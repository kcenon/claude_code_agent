# Delivery metrics

> **Status**: Current

Every `ad-sdlc run` builds versioned delivery metrics records: one per
execution attempt, one per stage, and one per run. They say what each attempt
cost (SDK token usage, turns, tool invocations, duration) and how the run
ended (stage and run status, verification and approval summaries, resume).
Failed, retried, timed-out, and cancelled attempts keep the usage they
consumed, and usage the SDK did not report is `null`, never a measured 0.

The records are returned on `PipelineResult.metrics` (and in
`run --format json`). With telemetry consent they are also appended to a local
JSONL file, which `ad-sdlc telemetry report` turns into an evaluation report.
Nothing is sent anywhere.

| What                     | Where                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Event schema (zod)       | `src/telemetry/deliveryMetrics.ts` (`DeliveryMetricsRecordSchema`, `schemaVersion: 1`)    |
| SDK usage observation    | `src/execution/usage.ts` (`SdkUsageObserver`), reported as `StageExecutionResult.metrics` |
| Record building          | `src/ad-sdlc-orchestrator/deliveryMetrics.ts` (`DeliveryMetricsRecorder`)                 |
| Local export and consent | `src/telemetry/deliveryMetricsExport.ts`                                                  |
| Report                   | `src/telemetry/deliveryMetricsReport.ts`, `ad-sdlc telemetry report`                      |

## Records

Every record has `schemaVersion` (1), `kind` (`attempt`, `stage`, or
`pipeline`), `recordedAt`, `sessionId` (the pipeline session,
`PipelineResult.pipelineId`), and `runId`. A resumed session keeps its
`sessionId`; each run (`executePipeline` call) has its own `runId`, so the
export of a paused and resumed session holds both runs.

Every schema is strict: a record with a field it does not define is rejected
before it is written, which keeps free text out of the export.

### Attempt

One record per execution attempt of a stage, written when the attempt ends.

| Field                                | Meaning                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `stage`, `agentType`, `retryIndex`   | Stage, its agent, and the attempt index (0 for the first attempt of the stage in this run)                                      |
| `attemptId`                          | `ArtifactContext.attemptId`, the same identity as the attempt's artifact manifest ([artifact manifests](artifact-manifests.md)) |
| `sdkSessionId`, `sdkResume`          | SDK session ID, and whether the attempt asked the SDK to resume a saved SDK session                                             |
| `startedAt`, `endedAt`, `durationMs` | Wall-clock time of the attempt, including cleanup                                                                               |
| `outcome`                            | `succeeded`, `failed`, `timed_out`, or `cancelled` (see below)                                                                  |
| `errorType`                          | Error code (`EXEC-003`, `EXEC-005`, ...) or class name (`StageTimeoutError`); never the message                                 |
| `execution`                          | `sdk` (the SDK adapter reported metrics), `recovered` (resume reused a committed manifest), or `unobserved`                     |
| `usage`                              | `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, and `source` (see below)                     |
| `turnCount`                          | SDK `num_turns` of the result message; `null` without a result                                                                  |
| `toolUseCount`, `toolUses`           | Tool invocations and their count per tool name (see below)                                                                      |
| `modelId`, `models`                  | Model of the SDK session (`system/init`), and every model observed                                                              |
| `sdkVersion`, `claudeCodeVersion`    | Installed `@anthropic-ai/claude-agent-sdk` version, and the Claude Code version from `system/init`                              |
| `manifest`                           | Manifest reference the attempt wrote, or `null`                                                                                 |

Attempt outcomes are attempt-level. A stage status says how the stage ended
after all its attempts and its verification; it has no `timed_out` or
`cancelled` value.

| `outcome`   | When                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| `succeeded` | The adapter returned success. Verification may still fail the stage afterwards.         |
| `failed`    | An SDK error result, a thrown error, an artifact contract failure, or a cleanup failure |
| `timed_out` | The attempt's stage timer fired (also when its cleanup failed afterwards)               |
| `cancelled` | The pipeline was cancelled or disposed during the attempt                               |

### Stage

One record per stage result of the run, written when the run ends.

| Field                                            | Meaning                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `status`                                         | `PipelineStageStatus`: `completed`, `degraded`, `failed`, `skipped` (`pending` and `running` are never final)       |
| `restored`                                       | Restored from an earlier run of the session on resume; not executed in this run                                     |
| `durationMs`, `retryCount`                       | As in `StageResult`                                                                                                 |
| `attempts`                                       | `total` and `byOutcome` over this run's attempts of the stage                                                       |
| `usage`, `turnCount`, `toolUseCount`, `toolUses` | Sums over those attempts; `usage` is `null` when the stage made no attempt in this run                              |
| `errorType`                                      | Error code of `StageResult.errorDetails`                                                                            |
| `verification`                                   | Projection of the #951 `StageVerificationRecord`: `state`, `checkSet`, check counts, failed required checks         |
| `approval`                                       | Projection of the #953 `ApprovalDecisionRecord`: `outcome`, `basis`, `boundaries`, `effects`, `decidedBy`, `reused` |
| `manifest`                                       | Manifest reference of the stage                                                                                     |

A stage skipped by approval has `status: skipped` and an `approval` projection
with `outcome: rejected` or `pending`. The projections carry no messages: the
decision `reason` (which a person may type), the `proposedAction`, and the
scope are left out.

### Pipeline

One record per run, written when the run ends, also when it ends with an
unexpected error.

| Field                                            | Meaning                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `mode`, `status`, `exitCode`                     | Pipeline mode, `PipelineStatus` (including `rejected` and `awaiting_decision`), and the `PIPELINE_EXIT_CODES` status (0, 1, 2, 3)          |
| `startedAt`, `endedAt`, `durationMs`             | The run                                                                                                                                    |
| `resume`                                         | `resumed`, `source` (`checkpoint` or `session`), and `priorStatus`: the status the session was saved with, for example `awaiting_decision` |
| `stages`                                         | `total`, `restored`, and counts per status                                                                                                 |
| `attempts`                                       | `total`, `retries` (attempts with a retry index above 0), and counts per outcome                                                           |
| `usage`, `turnCount`, `toolUseCount`, `toolUses` | Sums over every attempt of the run, failed, retried, timed-out, and cancelled ones included                                                |
| `models`, `sdkVersion`, `packageVersion`         | Models observed, SDK version, and `ad-sdlc` version                                                                                        |
| `verification`                                   | Projection of the #951 `PipelineVerificationSummary`: `status`, `profile`, `rigor`, `blocking`, `source` kind, `counts`, `checkCounts`     |
| `approval`                                       | Projection of the #953 `PipelineApprovalSummary`: `status`, `mode`, `source` kind, `counts`, decisions per `basis`, `requested`, `reused`  |
| `errorType`                                      | Error code or class name when the run ended with an unexpected error (`status` is then `failed`, `verification` and `approval` are `null`) |

## Unknown versus zero

Each token field is `null` when the SDK did not report it. `usage.source` says
where the numbers come from:

| `source`    | Meaning                                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`    | The SDK result message: the sum of its `modelUsage` entries (every model call, including subagents), else its `usage` (main loop only)                                                                                     |
| `partial`   | No usable result (failure, cancellation, timeout). The sum of the distinct assistant messages seen so far: a lower bound. A zeroed error result counts as no result, because the SDK writes zeroed usage on crash results. |
| `recovered` | No SDK call was made: resume reused a committed manifest, so the counts are a measured 0                                                                                                                                   |
| `none`      | Nothing was reported (an adapter without metrics, a result without usage, or a failure before the first message); every field is `null`                                                                                    |

A successful result that reports 0 is a measured 0 (`source: result`).
`turnCount` is `null` without a result message, and `toolUseCount` is `null`
when no SDK message was observed. Stage and pipeline sums treat `null` as
missing: a field of the sum is `null` only when no attempt reported it, and the
sum's `source` is `partial` when any attempt contributed partial or no usage.

## Tool invocations and turns

`toolUseCount` counts tool invocations: distinct `tool_use` content blocks
(and `server_tool_use` or `mcp_tool_use` blocks) of assistant messages,
deduplicated by block id. While a response streams, the SDK emits one
assistant message per content block and several messages share `message.id`;
a block emitted again is counted once. Blocks of subagents
(`parent_tool_use_id` set) belong to the attempt and are counted.
`stream_event` partial messages are not counted, because the complete
assistant message that follows carries the same blocks. `toolUses` counts per
tool name; a name that is not a plain identifier counts as `other`.

`turnCount` is the SDK's `num_turns` and is reported separately.

### Compatibility

`StageExecutionResult.toolCallCount` and `tokenUsage` are kept and marked
`@deprecated`:

- `toolCallCount` keeps its value: the larger of the distinct assistant
  messages and `num_turns`. It counts turns, not tool invocations; use
  `metrics.toolUseCount` and `metrics.turnCount`.
- `tokenUsage` keeps its shape (`input`, `output`, `cache`, with unknown as 0
  and cache read plus creation merged) and its source (the result's main-loop
  `usage`). One change: a failed execution whose result carries zeroed usage
  now keeps the partial totals of its assistant messages instead of zeros.
- Artifact manifests keep `execution.toolCallCount` and `execution.tokenUsage`
  unchanged (manifest schema 1).

## Export and consent

Records are appended, one JSON object per line, to:

```text
.ad-sdlc/scratchpad/metrics/<session-id>.jsonl
```

The file sits next to the session file (`.ad-sdlc/scratchpad/pipeline/`), in
the directory `ad-sdlc init` adds to `.gitignore`. Attempt records are
appended when each attempt ends, so a run that is killed keeps its attempts;
stage and pipeline records are appended when the run ends.

The export follows the [telemetry](../telemetry.md) consent record
(`~/.ad-sdlc/telemetry-consent.json`), which stays opt-in:

| Consent                                                          | `ad-sdlc run`                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Granted under privacy policy 1.1.0 or later                      | Appends the records                                            |
| Granted under an older policy (`outdated`)                       | Writes nothing; `ad-sdlc telemetry enable --yes` accepts 1.1.0 |
| Never set (`pending`) or revoked (`denied`, `telemetry disable`) | Writes nothing                                                 |

```bash
ad-sdlc telemetry enable --yes   # accept the privacy policy; runs export their records
ad-sdlc telemetry status         # shows "Delivery metrics: exported by ad-sdlc run ..."
ad-sdlc telemetry disable        # revoke; runs stop exporting
```

The records are built either way. The run's text output ends with a `Usage:`
line (attempts per outcome, token counts with `unknown` where the SDK reported
none, tool uses, turns) and a `Metrics:` line that names the export file or
the consent state. `run --format json` carries the records and the export
state under `metrics`:

```json
"metrics": {
  "records": [{ "schemaVersion": 1, "kind": "attempt", "...": "..." }],
  "export": {
    "enabled": true,
    "location": ".ad-sdlc/scratchpad/metrics/<session-id>.jsonl",
    "written": 11,
    "failed": 0,
    "consent": "granted"
  }
}
```

A write that fails is logged and counted in `failed`; it never changes the
run. Programmatic callers set `OrchestratorConfig.deliveryMetrics`: `sink`
creates the sink of a session (for example `jsonlDeliveryMetricsSink`), and
without it nothing is written. No workflow key or environment variable
controls the export.

An attempt record of a retried stage, as exported:

```json
{
  "schemaVersion": 1,
  "kind": "attempt",
  "recordedAt": "2026-10-26T09:00:06.000Z",
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "runId": "a1a1a1a1-0000-4000-8000-00000000001a",
  "stage": "implementation",
  "agentType": "worker",
  "retryIndex": 0,
  "attemptId": "f0000000-0000-4000-8000-000000000003",
  "sdkSessionId": "e0000000-0000-4000-8000-000000000003",
  "sdkResume": false,
  "startedAt": "2026-10-26T09:00:03.000Z",
  "endedAt": "2026-10-26T09:00:06.000Z",
  "durationMs": 3000,
  "outcome": "failed",
  "errorType": "EXEC-003",
  "execution": "sdk",
  "usage": {
    "inputTokens": 1500,
    "outputTokens": 150,
    "cacheReadInputTokens": 300,
    "cacheCreationInputTokens": null,
    "source": "partial"
  },
  "turnCount": 2,
  "toolUseCount": 3,
  "toolUses": { "Bash": 2, "Read": 1 },
  "modelId": "claude-sonnet-4-5",
  "models": ["claude-sonnet-4-5"],
  "sdkVersion": "0.3.301",
  "claudeCodeVersion": "2.1.0",
  "manifest": null
}
```

## Report

```bash
# Every export of the project
ad-sdlc telemetry report --project-dir .

# One session, as JSON
ad-sdlc telemetry report --project-dir . --session <session-id> --format json

# Given files, with review data a person supplied
ad-sdlc telemetry report a.jsonl b.jsonl --supplied review.json
```

The report reads the JSONL files (by default every file in
`.ad-sdlc/scratchpad/metrics/`), drops duplicate records, and lists invalid
lines with their file and line number instead of failing. It exits 1 when
there is no export, a file cannot be read, or the supplied file is invalid.

Every metric states its `source`, `sample`, `missing`, and `denominator`:

- `sample`: the members in scope (attempts, runs, supplied pull requests).
- `missing`: members of the sample without the measured value.
- `denominator`: the division base of a rate or mean, the members with a value
  (`sample - missing`), with a description.
- `source`: `observed` (from the runtime records) or `supplied` (from the
  review file).

| Metric                                                | Source   | Definition                                                                                                                   |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `runs.completed_rate`                                 | observed | Runs with `status: completed`; a run with attempt or stage records but no pipeline record is missing                         |
| `runs.verified_rate`                                  | observed | Runs whose #951 verification status is `verified`                                                                            |
| `runs.resume_success_rate`                            | observed | Resumed runs that completed                                                                                                  |
| `runs.resume_after_decision_success_rate`             | observed | Runs resumed from `awaiting_decision` that completed                                                                         |
| `approval.requested_decisions`, `.rejected_decisions` | observed | Sums over runs of the #953 summary                                                                                           |
| `attempts.<group>.<measure>`                          | observed | Totals and means of `duration_ms`, the four token fields, `turns`, and `tool_uses` per group: `all`, each outcome, `retried` |
| `pull_requests.accepted_rate`                         | supplied | Pull requests accepted as delivered                                                                                          |
| `pull_requests.rework_minutes`                        | supplied | Minutes a person spent changing delivered pull requests                                                                      |
| `requirements.evidence_coverage`                      | supplied | Requirements covered by accepted evidence (a passing acceptance test or check)                                               |

Attempt totals include failed, retried, timed-out, and cancelled attempts;
`partial` counts the values that are lower bounds. Human-review metrics come
only from the supplied file and are `n/a` without it; they are never inferred
from CI or run outcomes. The report has no monetary estimate: no price table
is built in. Token totals per run can be priced with a dated price list of the
reader's choice.

The supplied file:

```json
{
  "schemaVersion": 1,
  "kind": "delivery_review",
  "collectedAt": "2026-10-26",
  "pullRequests": [
    { "id": "owner/repo#12", "sessionId": "<session-id>", "accepted": true, "reworkMinutes": 15 },
    { "id": "owner/repo#13", "accepted": null, "reworkMinutes": null }
  ],
  "requirements": [{ "id": "FR-001", "evidence": true }]
}
```

`null` means not assessed and counts as missing.

### PRD targets

The report measures the PRD-001 delivery KPIs (section 4.2) without inferring
them:

| PRD-001 KPI                        | Report metric                                          |
| ---------------------------------- | ------------------------------------------------------ |
| `auto_implementation_success_rate` | `runs.completed_rate`, `runs.verified_rate` (observed) |
| `pr_approval_rate_first_try`       | `pull_requests.accepted_rate` (supplied)               |
| `requirement_coverage`             | `requirements.evidence_coverage` (supplied)            |

## Privacy

Records contain identifiers (UUIDs, manifest digests), stage and agent names,
timestamps, enums, counts, tool and model names, and versions. They never
contain API keys or tokens, the user request or requirement text, prompts,
tool inputs, assistant or result text, error messages, approval reasons or
proposed actions, or paths. There is no opt-in for text: the schema has no
field that could hold it.

`tests/integration/delivery-metrics.integration.test.ts` plants an API key,
a GitHub token, a requirement marker, tool inputs, a typed rejection reason,
and the project path in a scripted run and checks that neither the export nor
`PipelineResult.metrics` contains them.

## Live acceptance runs

A live lane (#955, #957) can read the records from `run --format json`
(`metrics.records`) without touching the user's consent. To get the JSONL
export as well, run the installed CLI with a temporary `HOME` and accept the
policy there first (`ad-sdlc telemetry enable --yes`), then pass the export to
`ad-sdlc telemetry report`.

## Offline evidence

| Test                                                     | Covers                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `tests/execution/usage.test.ts`                          | Recorded SDK sequences: success, multiple tool uses, partial failure, cancellation, no usage          |
| `tests/execution/SdkExecutionAdapter.metrics.test.ts`    | The adapter reports metrics on every outcome; legacy fields keep their meaning                        |
| `tests/ad-sdlc-orchestrator/deliveryMetrics.test.ts`     | Retried, timed-out, and cancelled attempts on the production scheduler; sink failures; abandoned runs |
| `tests/integration/delivery-metrics.integration.test.ts` | Pause and resume export, the report on it, and the privacy scan                                       |
| `tests/telemetry/deliveryMetricsReport.test.ts`          | The report on a fixture corpus against hand-computed totals                                           |
| `tests/telemetry/deliveryMetrics.test.ts`                | Schema, unknown versus zero, consent, and the JSONL export                                            |
| `tests/cli/deliveryMetrics.test.ts`                      | Consent-gated export through `ad-sdlc run` and `ad-sdlc telemetry report`                             |

No paid SDK run measured these records yet; the live acceptance lane attaches
measured results.
