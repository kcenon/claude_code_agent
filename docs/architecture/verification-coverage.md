# Verification Coverage

> **Status**: Current (generated block checked by `npm run docs:check-inventory`)

Every stage slot of every canonical mode graph has a verification
disposition: a named check set run by `StageVerifierAgent`, or an explicit
`not_applicable` record with its reason. The disposition table is
`VERIFICATION_APPLICABILITY` in `src/stage-verifier/applicability.ts`; the
check sets are `VERIFICATION_CHECK_SETS` in `src/stage-verifier/rules.ts`.

The block below is generated from that table. `npm run docs:check-inventory`
fails when it is stale, and also when a mode graph contains a stage without a
disposition. Regenerate it with:

```sh
npm run docs:check-inventory -- --write
```

Counts are per canonical graph. Local Greenfield removes `github_repo_setup`
(a `not_applicable` slot), leaving 18 slots with the same 9 check-set slots.
How profiles, rigor, and these dispositions combine into stage and run
verification states is described in the
[verification policy guide](../guides/verification-policy.md).

<!-- generated-verification-coverage:start -->

### Coverage by mode

| Mode        | Stage slots | Named check sets | Not applicable |
| ----------- | ----------: | ---------------: | -------------: |
| greenfield  |          19 |                9 |             10 |
| enhancement |          15 |                9 |              6 |
| import      |           5 |                5 |              0 |

### Stage dispositions

| Mode        | Stage                 | Disposition    | Check set or reason                                                                                                                                                                                                                                      |
| ----------- | --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| greenfield  | `initialization`      | not_applicable | Creates the scratchpad directory, which the artifact manifest contract already requires. It makes no delivery claim.                                                                                                                                     |
| greenfield  | `mode_detection`      | not_applicable | Routing decision only. CLI runs select the mode before execution, and the stage delivers no artifact.                                                                                                                                                    |
| greenfield  | `collection`          | checks         | `collected-info`                                                                                                                                                                                                                                         |
| greenfield  | `prd_generation`      | checks         | `prd-document`                                                                                                                                                                                                                                           |
| greenfield  | `srs_generation`      | checks         | `srs-document`                                                                                                                                                                                                                                           |
| greenfield  | `sdp_generation`      | not_applicable | Planning document. It does not gate delivery, and no machine-checkable content contract is defined for it. It is listed in the decision request of later approval boundaries; whether a decision is requested there depends on the approval mode.        |
| greenfield  | `repo_detection`      | not_applicable | Detection result used only to choose repository setup. The stage delivers no artifact.                                                                                                                                                                   |
| greenfield  | `github_repo_setup`   | not_applicable | Creates an external GitHub repository. The stage verifier checks project files only; the repository is visible in GitHub. Removed in local mode.                                                                                                         |
| greenfield  | `sds_generation`      | checks         | `sds-document`                                                                                                                                                                                                                                           |
| greenfield  | `ui_spec_generation`  | not_applicable | Conditional design document (skipped for CLI, API, and library projects). It does not gate delivery. It is listed in the decision request of later approval boundaries; whether a decision is requested there depends on the approval mode.              |
| greenfield  | `threat_modeling`     | not_applicable | Planning document. It does not gate delivery, and no machine-checkable content contract is defined for it. It is listed in the decision request of later approval boundaries; whether a decision is requested there depends on the approval mode.        |
| greenfield  | `tech_decisions`      | not_applicable | Planning document. It does not gate delivery, and no machine-checkable content contract is defined for it. It is listed in the decision request of later approval boundaries; whether a decision is requested there depends on the approval mode.        |
| greenfield  | `issue_generation`    | checks         | `generated-issues`                                                                                                                                                                                                                                       |
| greenfield  | `svp_generation`      | not_applicable | Verification plan document. Test evidence is checked at implementation, validation, and review. The plan is listed in the decision request of later approval boundaries; whether a decision is requested there depends on the approval mode.             |
| greenfield  | `orchestration`       | checks         | `work-orders`                                                                                                                                                                                                                                            |
| greenfield  | `implementation`      | checks         | `implementation-results`                                                                                                                                                                                                                                 |
| greenfield  | `validation-agent`    | checks         | `validation-report`                                                                                                                                                                                                                                      |
| greenfield  | `review`              | checks         | `review-result`                                                                                                                                                                                                                                          |
| greenfield  | `doc_indexing`        | not_applicable | Documentation index built after review. Its manifest output is enforced by the artifact contract, and it does not gate delivery.                                                                                                                         |
| enhancement | `document_reading`    | not_applicable | Analysis input for later stages. Its required output file is enforced by the artifact manifest contract, and no delivery claim rests on its content.                                                                                                     |
| enhancement | `codebase_analysis`   | not_applicable | Analysis input for later stages. Its required output file is enforced by the artifact manifest contract, and no delivery claim rests on its content.                                                                                                     |
| enhancement | `code_reading`        | not_applicable | Analysis input for later stages. Its required output file is enforced by the artifact manifest contract, and no delivery claim rests on its content.                                                                                                     |
| enhancement | `doc_code_comparison` | not_applicable | Analysis input for later stages. Its required output file is enforced by the artifact manifest contract, and no delivery claim rests on its content.                                                                                                     |
| enhancement | `impact_analysis`     | not_applicable | Impact report. Its required output file is enforced by the artifact manifest contract. It is listed in the decision request of the prd_update review boundary, where manual and custom modes request a decision and auto and critical approve by policy. |
| enhancement | `prd_update`          | checks         | `prd-document`                                                                                                                                                                                                                                           |
| enhancement | `srs_update`          | checks         | `srs-document`                                                                                                                                                                                                                                           |
| enhancement | `sds_update`          | checks         | `sds-document`                                                                                                                                                                                                                                           |
| enhancement | `issue_generation`    | checks         | `generated-issues`                                                                                                                                                                                                                                       |
| enhancement | `orchestration`       | checks         | `work-orders`                                                                                                                                                                                                                                            |
| enhancement | `implementation`      | checks         | `implementation-results`                                                                                                                                                                                                                                 |
| enhancement | `regression_testing`  | checks         | `regression-report`                                                                                                                                                                                                                                      |
| enhancement | `validation-agent`    | checks         | `validation-report`                                                                                                                                                                                                                                      |
| enhancement | `review`              | checks         | `review-result`                                                                                                                                                                                                                                          |
| enhancement | `doc_indexing`        | not_applicable | Documentation index built after review. Its manifest output is enforced by the artifact contract, and it does not gate delivery.                                                                                                                         |
| import      | `issue_reading`       | checks         | `imported-issues`                                                                                                                                                                                                                                        |
| import      | `orchestration`       | checks         | `work-orders`                                                                                                                                                                                                                                            |
| import      | `implementation`      | checks         | `implementation-results`                                                                                                                                                                                                                                 |
| import      | `validation-agent`    | checks         | `validation-report`                                                                                                                                                                                                                                      |
| import      | `review`              | checks         | `review-result`                                                                                                                                                                                                                                          |

### Check sets

Required checks are the `error`-severity checks that run at the effective rigor.

| Check set                | Check          | Name                                                       | Severity | Minimum rigor |
| ------------------------ | -------------- | ---------------------------------------------------------- | -------- | ------------- |
| `collected-info`         | VR-COL-001     | Collected info artifact exists                             | error    | minimal       |
| `collected-info`         | VR-COL-002     | Collected info is valid YAML                               | error    | minimal       |
| `collected-info`         | VR-COL-003     | Functional requirements present                            | warning  | standard      |
| `collected-info`         | VR-COL-004     | Acceptance criteria exist                                  | warning  | strict        |
| `collected-info`         | VR-COL-INV-001 | Investigation completed for non-quick depth                | warning  | standard      |
| `prd-document`           | VR-PRD-001     | PRD artifact exists                                        | error    | minimal       |
| `prd-document`           | VR-PRD-002     | PRD has required sections                                  | error    | standard      |
| `prd-document`           | VR-PRD-003     | PRD has FR-XXX identifiers                                 | warning  | standard      |
| `prd-document`           | VR-XDOC-001    | Documents agree at their sync points                       | error    | standard      |
| `srs-document`           | VR-SRS-001     | SRS artifact exists                                        | error    | minimal       |
| `srs-document`           | VR-SRS-002     | SRS has required sections                                  | error    | standard      |
| `srs-document`           | VR-SRS-003     | SRS has SF-XXX identifiers                                 | warning  | standard      |
| `srs-document`           | VR-SRS-004     | SRS SF references valid FR IDs                             | warning  | strict        |
| `srs-document`           | VR-XDOC-001    | Documents agree at their sync points                       | error    | standard      |
| `sds-document`           | VR-SDS-001     | SDS artifact exists                                        | error    | minimal       |
| `sds-document`           | VR-SDS-002     | SDS has required sections                                  | error    | standard      |
| `sds-document`           | VR-SDS-003     | SDS has CMP-XXX identifiers                                | warning  | standard      |
| `sds-document`           | VR-SDS-004     | SDS CMP references valid SF IDs                            | warning  | strict        |
| `sds-document`           | VR-XDOC-001    | Documents agree at their sync points                       | error    | standard      |
| `generated-issues`       | VR-ISS-001     | Issue list artifact exists                                 | error    | minimal       |
| `generated-issues`       | VR-ISS-002     | Issue list is valid JSON or YAML                           | error    | minimal       |
| `generated-issues`       | VR-ISS-003     | Issue list contains entries                                | warning  | standard      |
| `generated-issues`       | VR-ISS-004     | Every issue states acceptance criteria                     | error    | standard      |
| `imported-issues`        | VR-IRD-001     | Imported issue list artifact exists                        | error    | minimal       |
| `imported-issues`        | VR-IRD-002     | Imported issues have unique identifiers and titles         | error    | minimal       |
| `imported-issues`        | VR-IRD-003     | Every issue states acceptance criteria                     | error    | standard      |
| `imported-issues`        | VR-IRD-004     | Dependency graph is acyclic and references imported issues | warning  | standard      |
| `work-orders`            | VR-ORC-001     | Work order artifacts exist                                 | error    | minimal       |
| `work-orders`            | VR-ORC-002     | Every work order references an issue                       | error    | standard      |
| `implementation-results` | VR-IMP-001     | Implementation result artifact exists                      | error    | minimal       |
| `implementation-results` | VR-IMP-002     | Implementation result is valid                             | error    | minimal       |
| `implementation-results` | VR-IMP-003     | Tests passed                                               | error    | standard      |
| `implementation-results` | VR-IMP-004     | Build passed                                               | error    | standard      |
| `implementation-results` | VR-IMP-005     | Lint passed                                                | warning  | strict        |
| `implementation-results` | VR-IMP-006     | Implementation result reports completion                   | error    | standard      |
| `implementation-results` | VR-IMP-007     | Recorded file changes match the project                    | error    | standard      |
| `regression-report`      | VR-REG-001     | Regression report exists and is valid                      | error    | minimal       |
| `regression-report`      | VR-REG-002     | Regression tests ran and passed                            | error    | standard      |
| `regression-report`      | VR-REG-003     | No blocking compatibility issue                            | warning  | standard      |
| `validation-report`      | VR-VAL-001     | Validation report exists and is valid                      | error    | minimal       |
| `validation-report`      | VR-VAL-002     | Validation result is not fail                              | error    | standard      |
| `validation-report`      | VR-VAL-003     | Validation quality gates passed                            | warning  | standard      |
| `validation-report`      | VR-VAL-004     | Acceptance criteria are implemented and tested             | error    | standard      |
| `validation-report`      | VR-VAL-005     | Every issue traces to a requirement                        | warning  | standard      |
| `review-result`          | VR-REV-001     | Review result artifact exists                              | error    | minimal       |
| `review-result`          | VR-REV-002     | Review result is valid                                     | error    | minimal       |
| `review-result`          | VR-REV-003     | Review decision present                                    | warning  | standard      |
| `review-result`          | VR-REV-004     | Review links the reviewed change                           | error    | standard      |
| `review-result`          | VR-REV-005     | Review quality checks did not fail                         | error    | standard      |

<!-- generated-verification-coverage:end -->
