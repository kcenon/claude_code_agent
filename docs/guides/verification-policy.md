# Verification policy

> **Status**: Current

`ad-sdlc run` verifies every completed stage with `StageVerifierAgent`. Three
settings decide what that means for a run:

| Control       | Decides                                                     | Source                                                                                  |
| ------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Applicability | Which checks a stage has, or that it has none               | `VERIFICATION_APPLICABILITY` (see [coverage](../architecture/verification-coverage.md)) |
| Rigor         | Which of those checks run (`minimal`, `standard`, `strict`) | `global.vnv.rigor`                                                                      |
| Profile       | What a failed required check does (`advisory`, `delivery`)  | `global.vnv.profile`                                                                    |

The run result records the effective profile and its source, the state of
every stage, and a pipeline-level verification status. A failed or unrun
check is never reported as a verified pass.

## Profiles

A check is **required** when its severity is `error`. Warning and info checks
are recorded but never block.

| Profile    | A failed required check                                                                                                      | Exit status                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `advisory` | Is kept as a finding on the stage (`Verification advisory: ...` warning) and in the result. The run continues.               | 0 unless the run fails for another reason |
| `delivery` | Fails its stage, skips every stage that has not run (so no dependent delivery or review stage completes), and fails the run. | 1                                         |

Rigor still applies under `delivery`: checks above the configured rigor do not
run and are reported as `skipped`, not as passed. Use `standard` (the default)
or `strict` for delivery runs.

## Default and compatibility mapping

The default is unchanged: a project without `global.vnv.profile` behaves as it
did before profiles existed.

| `global.vnv.profile` | `rigor`               | `halt_on_verification_failure` | Effective profile | Recorded source path                      |
| -------------------- | --------------------- | ------------------------------ | ----------------- | ----------------------------------------- |
| absent               | `strict`              | `true`                         | `delivery`        | `global.vnv.halt_on_verification_failure` |
| absent               | any other combination | any                            | `advisory`        | `global.vnv.profile` (default)            |
| `advisory`           | any                   | any                            | `advisory`        | `global.vnv.profile`                      |
| `delivery`           | any                   | any                            | `delivery`        | `global.vnv.profile`                      |

`halt_on_verification_failure` keeps working, but only as the legacy way to
select `delivery` when no profile is set. When a profile is set and the halt
flag disagrees with it (`true` with `advisory`, `false` with `delivery`), the
plan reports a `conflict` warning for the halt flag and the profile wins.

## Configuration

```yaml
# .ad-sdlc/config/workflow.yaml
global:
  vnv:
    rigor: standard # minimal | standard | strict
    profile: delivery # advisory | delivery; omit to keep the legacy mapping
```

| Layer                | Setting                                                         |
| -------------------- | --------------------------------------------------------------- |
| Workflow YAML        | `global.vnv.profile`                                            |
| Environment override | `AD_SDLC_VNV_PROFILE`                                           |
| CLI option           | `--vnv-profile advisory\|delivery`                              |
| Programmatic API     | `new AdsdlcOrchestratorAgent({ vnv: { profile: 'delivery' } })` |

Precedence and validation follow the
[runtime configuration contract](../configuration/RUNTIME_WORKFLOW.md): CLI
over environment over overlay YAML over base YAML over defaults. `ad-sdlc
validate` and `run --dry-run` reject any other value. The dry run shows the
effective profile in `config.vnv.profile` and its winning source in
`sources["global.vnv.profile"]`.

## Applicability

Every stage slot of every mode is either verified by a named check set or
marked `not_applicable` with a documented reason. The generated
[coverage document](../architecture/verification-coverage.md) lists every slot
and every check. `npm run docs:check-inventory` fails when a mode graph gains
a stage without a disposition, and the verifier fails closed for an
unclassified stage instead of passing it.

The delivery-path check sets read the files the checked-in agent definitions
write, located through the stage's artifact manifest
(`StageResult.artifacts`, project-relative):

| Stage                | Check set                | Real artifact                                              | Required checks (at `standard`)                                                                                                   |
| -------------------- | ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `issue_reading`      | `imported-issues`        | `issues/<project>/issue_list.json`                         | list exists, issues have unique IDs and titles, every issue states acceptance criteria                                            |
| `issue_generation`   | `generated-issues`       | the issue list                                             | list exists and parses, every issue states acceptance criteria                                                                    |
| `orchestration`      | `work-orders`            | `progress/<project>/work_orders/WO-*.yaml`                 | work orders exist and each references an issue                                                                                    |
| `implementation`     | `implementation-results` | `progress/<project>/results/WO-*-result.yaml`              | result exists and parses, tests and build passed, status completed, every recorded changed file exists (and deletions are absent) |
| `regression_testing` | `regression-report`      | `regression/<project>/regression_report.yaml`              | report exists, tests ran and none failed                                                                                          |
| `validation-agent`   | `validation-report`      | `vnv/<project>/validation-report.yaml`                     | report exists, overall status is not `fail`                                                                                       |
| `review`             | `review-result`          | `reviews/PR-*-review.yaml` or `reviews/review_report.json` | result exists, it references its pull request (or work order for the local reviewer), CI/test/quality checks did not fail         |

Acceptance criteria are either an `acceptance_criteria` list or a list under an
"Acceptance Criteria" heading in the issue body, the format the issue
generators and GitHub issue templates produce.

## Result vocabulary

### Stage states (`StageResult.verification.state`)

| State               | Meaning                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `verified_pass`     | At least one check ran and every check that ran passed.                                        |
| `failed`            | A required check failed under `delivery`. The stage status is `failed`.                        |
| `advisory_findings` | A check failed without blocking: any failed check under `advisory`, or a failed warning check. |
| `skipped`           | No check ran, with `reason`: rigor filter, missing input data, or the stage did not complete.  |
| `not_applicable`    | The stage's disposition is not applicable, with its `reason`.                                  |

Each record lists its checks with `checkId`, `severity`, `required`, `outcome`
(`pass`, `fail`, `skipped`), `message`, and `skipReason` for skipped checks.

### Pipeline status (`PipelineResult.verification.status`)

`overallStatus` still describes stage execution (`completed`, `partial`,
`failed`). `verification.status` says whether what ran was verified:

| Status              | Meaning                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- |
| `verified`          | Every stage that ran is `verified_pass` or `not_applicable`, and at least one passed. |
| `advisory_findings` | A check failed without blocking. The run is **completed with failed checks**.         |
| `unverified`        | No check failed, but a stage that ran had no check run.                               |
| `failed`            | A required check failed under `delivery`; `overallStatus` is `failed`.                |

A run is a verified delivery only when `overallStatus` is `completed` and
`verification.status` is `verified`. Stages that never ran (stop-after,
skipped dependents) appear as `skipped` or `not_applicable` records but do not
lower the status; `overallStatus` already accounts for them.

### Exit status

`ad-sdlc run` exits 1 when the run fails, including a failed required check
under `delivery`. Advisory findings and unverified stages exit 0, as before.

## Output

`--format json` prints the pipeline result. The verification fields are:

```json
{
  "overallStatus": "completed",
  "verification": {
    "policy": {
      "profile": "advisory",
      "rigor": "standard",
      "blocking": false,
      "source": { "kind": "default", "path": "global.vnv.profile", "origin": "default" }
    },
    "status": "advisory_findings",
    "counts": {
      "verified_pass": 4,
      "failed": 0,
      "advisory_findings": 1,
      "skipped": 0,
      "not_applicable": 0
    },
    "checkCounts": { "pass": 17, "fail": 1, "skipped": 2 },
    "stages": [
      {
        "stage": "issue_reading",
        "state": "advisory_findings",
        "checkSet": "imported-issues",
        "checks": [
          {
            "checkId": "VR-IRD-003",
            "name": "Every issue states acceptance criteria",
            "severity": "error",
            "required": true,
            "outcome": "fail",
            "message": "1 of 2 issue(s) state no acceptance criteria: ISS-002"
          }
        ]
      }
    ]
  },
  "stages": [
    {
      "name": "issue_reading",
      "status": "completed",
      "verification": { "state": "advisory_findings" }
    }
  ]
}
```

`policy.source.kind` is `default`, `config`, `environment`, `cli`, `resume`,
or `programmatic`; `origin` is the winning layer (a file path,
`environment:AD_SDLC_VNV_PROFILE`, `CLI`, or `default`). A failed run prints
`{ "ready": false, "error": ..., "diagnostics": [], "runtimeSnapshot": ...,
"result": ... }`, where `result` is the same pipeline result.

Text output appends the stage state to each stage line and a short summary:

```text
Pipeline 4f1c...: failed (import)
  issue_reading: failed (12 ms), verification failed — Verification failed: [VR-IRD-003] 1 of 1 issue(s) state no acceptance criteria: ISS-001
  orchestration: skipped (0 ms) — Skipped: verification gate failed after 'issue_reading'
Verification: failed (profile delivery from cli, rigor standard)
  stages: 0 verified_pass, 0 advisory_findings, 1 failed, 4 skipped, 0 not_applicable; checks: 2 passed, 1 failed, 1 skipped
  issue_reading: failed: [VR-IRD-003] 1 of 1 issue(s) state no acceptance criteria: ISS-001
```

## Resume

The effective profile is part of the saved `runtimeSnapshot`
(`config.vnv.profile`, `sources["global.vnv.profile"]`). `--resume` reuses it
even when workflow YAML or `AD_SDLC_VNV_PROFILE` changed, rejects
`--vnv-profile`, and reports `policy.source.kind: "resume"` with the original
`origin`. Each stage's verification record is saved with the stage in the
session file and in checkpoints, so pre-completed stages keep the record from
the run that verified them. A snapshot saved before profiles existed resumes
with the profile its rigor and halt flag selected; a completed stage without a
saved record is reported as `skipped`, so such a resumed run is `unverified`
rather than verified.

## Migration

No default changed. Existing configurations keep their blocking behavior:

- Without `global.vnv.profile`, `strict` + `halt_on_verification_failure: true`
  still blocks (now reported as `delivery`), and every other combination
  stays advisory and exits as before.
- Check sets now cover `issue_reading`, `orchestration`, `regression_testing`,
  and `validation-agent`, and `issue_generation` requires acceptance criteria.
  The implementation and review check sets now read the worker
  (`results/WO-*-result.yaml`, including its nested `verification` block) and
  reviewer (`reviews/*`) outputs. Under `advisory` this only adds findings and
  `Verification advisory` warnings. Under `delivery` (including the legacy
  strict + halt mapping) these stages can now fail the run.
- Checks that could not evaluate their condition (for example, a result that
  does not report lint status) are `skipped` instead of passing silently.
- `not_applicable` stages no longer add a `No verification rules defined`
  warning; their reason is in the verification record.
- To opt in, set `global.vnv.profile: delivery` or pass `--vnv-profile
delivery`. Replace `halt_on_verification_failure` with a profile when you
  touch the file.

Programmatic API additions are additive: `VnvConfig.profile`,
`StageResult.verification`, `PipelineResult.verification`, and
`PipelineFailedError.result`. `PipelineResult.verificationResults` (raw
verifier output) is unchanged.

## Offline evidence

```sh
npx vitest run tests/vnv/policy.test.ts tests/stage-verifier tests/cli/verificationPolicy.test.ts
npm run test:integration -- tests/integration/verification-policy.integration.test.ts
npm run docs:check-inventory
```

The integration test runs the real `StageVerifierAgent`, artifact validator,
scheduler, and SDK execution adapter (with a scripted SDK that writes files
and reports them through the capture hooks) against malformed artifacts: an
Import issue list without acceptance criteria, an implementation result that
references a missing file, and a Greenfield PRD missing required sections.
These tests do not establish live model behavior.
