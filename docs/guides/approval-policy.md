# Approval policy

> **Status**: Current (generated matrix checked by `npm run docs:check-inventory`)

`ad-sdlc run` passes every stage through an approval gate before the stage
runs. The gate covers three kinds of **boundaries**:

| Boundary              | When a stage has it                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review`              | The stage graph marks it as a review point (`approvalRequired`). The decision covers the planning output the stage consumes, such as the PRD before SRS generation.      |
| `delivery`            | The stage has an externally visible effect: it creates a repository or issues, pushes a branch, opens or merges a pull request, or writes outside the project directory. |
| `failed_verification` | A stage it depends on failed a required verification check without blocking (the `advisory` verification profile).                                                       |

The **approval mode** decides which boundaries request a decision. Every other
boundary is approved by policy. Either way, every boundary a run reaches
produces a durable decision record in the run result, the session file, and
checkpoints.

| Mode       | Requests a decision at                                   | Use                                                                                    |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `auto`     | nothing                                                  | The CLI default: a deliberate autonomous profile for CI and unattended automation.     |
| `manual`   | every review, delivery, and failed-verification boundary | A person reviews each planning step and every external effect.                         |
| `critical` | delivery and failed-verification boundaries              | A person decides before anything leaves the project and after a failed required check. |
| `custom`   | every boundary, decided by `approveStage`                | Programmatic API only; the default strategy approves. The CLI rejects it.              |

`critical` no longer means "approve unless a prior stage failed" (see
[Migration](#migration)). A failed stage still skips its dependents, as it
always did; `critical` adds decisions where an effect becomes visible outside
the project or where a required check failed without stopping the run.

## Configuration

| Layer                | Setting                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| Workflow YAML        | `global.approval_mode: auto \| manual \| critical`                            |
| Environment override | `AD_SDLC_APPROVAL_MODE`                                                       |
| CLI option           | `--approval-mode auto\|manual\|critical`                                      |
| Programmatic API     | `new AdsdlcOrchestratorAgent({ approvalMode: 'custom' })` plus `approveStage` |

No other approval key exists. Per-stage gate maps (`global.approval_gates`)
stay retired: the boundaries are data in source (`approvalRequired` in the
stage graphs, `AGENT_APPROVAL_EFFECTS` for effects, `APPROVAL_MODE_DEFINITIONS`
for the modes), and the matrix below is generated from that data.
`ad-sdlc run --dry-run` prints each stage's gate, and `--format json` shows the
stage effects in `stages[].effects` and the mode in `config.approvalMode` with
its source in `sources["global.approval_mode"]`.

## Policy matrix

The block below is generated from the stage graphs, the agent effect table,
and the mode definitions. `npm run docs:check-inventory` fails when it is
stale; regenerate it with `npm run docs:check-inventory -- --write`.

Import has two boundaries: `orchestration` is the review boundary (the
imported issues are the scope of the work, so they are reviewed before work
orders are planned and implemented), and `review` is the delivery boundary
(it pushes the branch, opens the pull request, and merges it).

`issue_generation` keeps its GitHub tools in local mode, so its
`create_issues` effect is declared there too. The local reviewer has a
`merge` effect because it can merge the work branch locally.

<!-- generated-approval-policy:start -->

### Modes

| Mode       | Requests a decision at                      | Decided by | Semantics                                                                                                                            |
| ---------- | ------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `auto`     | none                                        | none       | Autonomous profile and the CLI default. No decision is requested: every boundary is approved by policy and recorded.                 |
| `manual`   | `review`, `delivery`, `failed_verification` | person     | A person decides at every boundary.                                                                                                  |
| `critical` | `delivery`, `failed_verification`           | person     | A person decides before every externally visible effect and after a failed required check. Review boundaries are approved by policy. |
| `custom`   | `review`, `delivery`, `failed_verification` | callback   | The programmatic approveStage strategy decides at every boundary; the default strategy approves. Not available in the CLI.           |

### Boundaries

| Boundary              | Meaning                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `review`              | The stage graph marks the stage as a review point for the planning output it consumes.          |
| `delivery`            | The stage has an externally visible effect.                                                     |
| `failed_verification` | A stage it depends on failed a required verification check without blocking (advisory profile). |

### Effects

| Effect                  | The stage...                                                                   | Declared by agents                 |
| ----------------------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| `create_repository`     | creates a GitHub repository                                                    | `github-repo-setup`                |
| `create_issues`         | creates GitHub issues                                                          | `issue-generator`                  |
| `push_branch`           | pushes a branch to the remote repository                                       | `github-repo-setup`, `pr-reviewer` |
| `open_pull_request`     | opens a pull request                                                           | `pr-reviewer`                      |
| `merge`                 | merges changes into the target branch (a pull request merge, or a local merge) | `pr-reviewer`, `local-reviewer`    |
| `write_outside_project` | writes outside the project directory                                           | none                               |

### Stage matrix

Each cell says what the mode does before the stage runs: `decide` (a person decides),
`callback` (the custom strategy decides), `policy` (approved by policy and recorded), or
`no gate`. Any stage whose dependency failed a required check without blocking also gets
a `failed_verification` boundary: `auto` approves it by policy, `manual` and `critical`
request a decision, and `custom` calls the strategy.

| Pipeline mode | Stage                                       | Agent                                    | Boundaries           | Effects                                                      | `auto`  | `manual` | `critical` | `custom` |
| ------------- | ------------------------------------------- | ---------------------------------------- | -------------------- | ------------------------------------------------------------ | ------- | -------- | ---------- | -------- |
| greenfield    | `initialization`                            | project-initializer                      | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| greenfield    | `mode_detection`                            | mode-detector                            | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| greenfield    | `collection`                                | collector                                | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `prd_generation`                            | prd-writer                               | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `srs_generation`                            | srs-writer                               | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `sdp_generation`                            | sdp-writer                               | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `repo_detection`                            | repo-detector                            | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| greenfield    | `github_repo_setup` (removed in local mode) | github-repo-setup                        | `review`, `delivery` | `create_repository`, `push_branch`                           | policy  | decide   | decide     | callback |
| greenfield    | `sds_generation`                            | sds-writer                               | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `ui_spec_generation`                        | ui-spec-writer                           | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `threat_modeling`                           | threat-model-writer                      | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `tech_decisions`                            | tech-decision-writer                     | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `issue_generation`                          | issue-generator                          | `review`, `delivery` | `create_issues`                                              | policy  | decide   | decide     | callback |
| greenfield    | `svp_generation`                            | svp-writer                               | `review`             | none                                                         | policy  | decide   | policy     | callback |
| greenfield    | `orchestration`                             | controller                               | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| greenfield    | `implementation`                            | worker                                   | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| greenfield    | `validation-agent`                          | validation-agent                         | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| greenfield    | `review`                                    | pr-reviewer (local: local-reviewer)      | `delivery`           | `push_branch`, `open_pull_request`, `merge` (local: `merge`) | policy  | decide   | decide     | callback |
| greenfield    | `doc_indexing`                              | doc-index-generator                      | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `document_reading`                          | document-reader                          | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `codebase_analysis`                         | codebase-analyzer                        | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `code_reading`                              | code-reader                              | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `doc_code_comparison`                       | doc-code-comparator                      | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `impact_analysis`                           | impact-analyzer                          | `review`             | none                                                         | policy  | decide   | policy     | callback |
| enhancement   | `prd_update`                                | prd-updater                              | `review`             | none                                                         | policy  | decide   | policy     | callback |
| enhancement   | `srs_update`                                | srs-updater                              | `review`             | none                                                         | policy  | decide   | policy     | callback |
| enhancement   | `sds_update`                                | sds-updater                              | `review`             | none                                                         | policy  | decide   | policy     | callback |
| enhancement   | `issue_generation`                          | issue-generator                          | `review`, `delivery` | `create_issues`                                              | policy  | decide   | decide     | callback |
| enhancement   | `orchestration`                             | controller                               | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `implementation`                            | worker                                   | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `regression_testing`                        | regression-tester                        | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `validation-agent`                          | validation-agent                         | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| enhancement   | `review`                                    | pr-reviewer (local: local-reviewer)      | `delivery`           | `push_branch`, `open_pull_request`, `merge` (local: `merge`) | policy  | decide   | decide     | callback |
| enhancement   | `doc_indexing`                              | doc-index-generator                      | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| import        | `issue_reading`                             | issue-reader (local: local-issue-reader) | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| import        | `orchestration`                             | controller                               | `review`             | none                                                         | policy  | decide   | policy     | callback |
| import        | `implementation`                            | worker                                   | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| import        | `validation-agent`                          | validation-agent                         | none                 | none                                                         | no gate | no gate  | no gate    | no gate  |
| import        | `review`                                    | pr-reviewer (local: local-reviewer)      | `delivery`           | `push_branch`, `open_pull_request`, `merge` (local: `merge`) | policy  | decide   | decide     | callback |

<!-- generated-approval-policy:end -->

## Decision requests

When a mode requests a decision, the terminal shows the concrete scope of the
decision before the prompt (on stderr, so `--format json` output stays
parseable):

```text
Decision required before stage "orchestration" (controller)
  Policy: manual mode; boundaries: review, failed_verification
  Session: 4f1c...; pipeline import; local mode: no
  Request: Implement the imported login issues
  Proposed action: Run stage "orchestration" (controller): Orchestrate work distribution from imported issues
  External effects: none
  Completed artifacts:
    issue_reading: .ad-sdlc/scratchpad/issues/demo/issue_list.json
  Verification findings:
    issue_reading: [VR-IRD-003, required] 1 of 2 issue(s) state no acceptance criteria: ISS-002
  Scope fingerprint: 2a6c0f1e9b7d4c53
? Approve this stage? (y/N)
```

- **Inputs**: the session, pipeline mode, local mode, and the user request.
- **Completed artifacts**: every completed stage the gated stage depends on,
  directly or transitively, with its artifact manifest identifier and paths.
- **Verification findings**: every failed check of those stages from their
  verification records (`StageResult.verification.checks`, with `required`),
  plus verifier errors. The verifier is not run again.
- **Proposed action**: the stage, its agent and description, and its effects.

Answering no asks for a reason, which is kept in the decision record. The
prompt defaults to no. A custom strategy receives the same content as an
`ApprovalRequest` (third argument of `approveStage`).

## Decision records

Each gated stage result carries `approval` (an `ApprovalDecisionRecord`), and
`PipelineResult.approval` summarizes the run:

| Field                               | Meaning                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stage`, `agentType`, `sessionId`   | Stage and session identity                                                                                                                               |
| `mode`                              | Approval mode that decided                                                                                                                               |
| `boundaries`, `effects`             | Why the stage is a decision point                                                                                                                        |
| `proposedAction`                    | The action the decision allows                                                                                                                           |
| `scope.artifacts`, `scope.findings` | The reviewed upstream artifacts (manifest identifiers and paths) and failed checks                                                                       |
| `scope.fingerprint`                 | SHA-256 over the stage identity, pipeline mode, boundaries, effects, user request, artifacts (file digests for results without a manifest), and findings |
| `outcome`                           | `approved`, `rejected`, or `pending` (requested, nobody could answer)                                                                                    |
| `basis`                             | `policy`, `prompt` (a person), `callback` (custom strategy), or `unattended`                                                                             |
| `decidedBy`, `decidedAt`, `reason`  | Who decided and when, and the rejection reason, approval note, or why the run paused                                                                     |
| `reused`                            | `true` when a resumed run reused the decision                                                                                                            |

```json
{
  "overallStatus": "rejected",
  "approval": {
    "policy": {
      "mode": "manual",
      "requests": ["review", "delivery", "failed_verification"],
      "decider": "person",
      "interactive": true,
      "unattended": "pause",
      "source": { "kind": "cli", "path": "global.approval_mode", "origin": "CLI" }
    },
    "status": "rejected",
    "counts": { "approved": 0, "rejected": 1, "pending": 0 },
    "requested": 1,
    "decisions": [
      {
        "stage": "orchestration",
        "agentType": "controller",
        "sessionId": "4f1c...",
        "mode": "manual",
        "boundaries": ["review"],
        "effects": [],
        "proposedAction": "Run stage \"orchestration\" (controller): Orchestrate work distribution from imported issues",
        "scope": {
          "fingerprint": "2a6c0f1e9b7d4c53...",
          "artifacts": [
            {
              "stage": "issue_reading",
              "paths": [".ad-sdlc/scratchpad/issues/demo/issue_list.json"]
            }
          ],
          "findings": []
        },
        "outcome": "rejected",
        "basis": "prompt",
        "decidedBy": "user",
        "decidedAt": "2026-10-25T12:00:00.000Z",
        "reason": "ISS-002 is out of scope"
      }
    ]
  }
}
```

`PipelineResult.approval.status` is `not_required` (no boundary reached),
`approved_by_policy` (every boundary approved by policy, so nobody was asked),
`approved` (at least one decision was requested and all approved), `rejected`,
or `awaiting_decision`. Records are validated with
`ApprovalDecisionRecordSchema` when a session or checkpoint is read; an
invalid record is dropped and the stage asks again.

## Rejection

A rejected stage is not executed. Its result is `skipped` with
`Approval rejected: <reason>` and keeps the record. Every stage that depends on
it, directly or transitively, is skipped with `Skipped: '<stage>' was rejected
at its approval gate`. Stages that do not depend on it still run: a rejection
is a decision about one scope, and in the canonical graphs every delivery
stage depends on the rejected planning stages anyway.

The run finishes with `overallStatus: "rejected"` (not `completed`, and not
`failed` unless a stage also failed) and exits with status 2. The decision is
saved in the session file immediately, before later stages run.

## Unattended runs

A run is interactive when stdin and stderr are terminals, unless
`--non-interactive` is passed. When `manual` or `critical` requests a decision
in a run that is not interactive, the run **pauses**; it is never approved:

- the stage gets an `outcome: "pending"`, `basis: "unattended"` record and is
  not executed;
- every stage that has not run is skipped with `Skipped: run paused awaiting a
decision at '<stage>'` (approved members of the same parallel group keep
  their records);
- the run finishes with `overallStatus: "awaiting_decision"`, exit status 3,
  and the text output names the pending stage and the resume command.

Continue in a terminal with `ad-sdlc run "<requirements>" --resume
<session-id>`. Completed stages are not run again, and the gate asks for the
pending decision. `auto` never pauses, and `custom` asks its strategy, so
choose `auto` (or a custom strategy) for fully unattended pipelines.

## Resume

Decisions are part of the saved session. On `--resume`:

- a completed stage keeps the record that admitted it;
- a stage that did not complete (rejected, failed after approval, or skipped
  by a pause) reuses its saved decision when the decision was made by a person
  or the custom strategy, the mode is unchanged, and the scope fingerprint is
  unchanged;
- a changed fingerprint requests a new decision, and a `pending` record is
  never reused;
- policy approvals are derived again.

The fingerprint changes when an upstream stage produced a new manifest, when a
reviewed file of a result without a manifest changed, when the verification
findings changed, or when the stage's boundaries or effects changed. Editing a
file that a manifest recorded makes resume fail its integrity check instead;
start a fresh run in that case. A decision for a stage that was still running
when the process died is not saved, so the resumed run asks again.

`--resume` keeps the saved approval mode (`--approval-mode` is rejected) and
reports `policy.source.kind: "resume"`. `--non-interactive` is allowed on
resume because interaction belongs to the invocation, not to the saved
policy.

## Exit statuses

| Status | Meaning                                                                              |
| ------ | ------------------------------------------------------------------------------------ |
| 0      | Completed (including advisory findings and runs approved by policy)                  |
| 1      | Failed, including a failed required check under `delivery`, or a configuration error |
| 2      | Rejected: an approval decision rejected a stage                                      |
| 3      | Awaiting decision: the run paused at a decision nobody could answer; resume it       |

A failure wins over a pending decision, and a pending decision wins over a
rejection. `pipelineExitCode()` in `src/vnv/policy.ts` computes the status;
`PIPELINE_EXIT_CODES` names the values.

## Migration

The CLI default stays `auto`, so a project that sets no approval mode keeps
its autonomous behavior; its results now record each boundary as approved by
policy.

- `critical` now requests a decision before `github_repo_setup`,
  `issue_generation`, and `review`, and after a non-blocking failed required
  check. It no longer rejects every gate after any earlier stage failure;
  dependents of a failed stage are skipped as before.
- `manual` now also gates `review` (pull request creation and merge) and the
  Import `orchestration` stage, and it now gates the parallel Greenfield
  stages (`ui_spec_generation`, `threat_modeling`, `tech_decisions`), which
  were skipped by the gate before.
- A `manual` run without a terminal used to deny the gate and continue with
  the stage skipped; it now pauses with exit status 3 and resumes.
- A rejected run used to report `completed`; it now reports `rejected` and
  exits 2. `PipelineStatus` gains `rejected` and `awaiting_decision`.
- Sessions saved before this change resume with the stage effects of the
  current agent table (`stages[].effects` is back-filled), so a resumed
  `manual` or `critical` session requests decisions at its delivery
  boundaries.

Programmatic additions are additive: `StageResult.approval`,
`PipelineResult.approval`, `OrchestratorConfig.interactive`,
`PipelineStageDefinition.effects`, and the optional `request` argument of
`approveStage`.

## Offline evidence

```sh
npx vitest run tests/ad-sdlc-orchestrator/approvalPolicy.test.ts tests/ad-sdlc-orchestrator/approvalGate.test.ts tests/cli/approvalPolicy.test.ts
npm run docs:check-inventory
```

The tests run the real gate, scheduler, and orchestrator with inquirer
replaced by a test double (`vi.mock('inquirer')`) and an offline execution
adapter that writes files. No GitHub resource is created and no SDK call is
made.
