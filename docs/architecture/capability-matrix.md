# Capability Matrix

> **Status**: Current

What `ad-sdlc run` delivers in each pipeline mode, and the policies that
control it. The tables between the generated markers are rendered from the
stage graphs (`buildCanonicalPlan`), the approval and verification policy
definitions, the CLI definitions, and the canonical asset files;
`npm run docs:check-inventory` fails when they drift, and
`npm run docs:check-inventory -- --write` regenerates them. The completion
boundary and the evidence status below are reviewed statements, not generated.

## Completion Boundary

A run delivers, at most, **a pull request with linked requirements and
verification evidence, ready for review**:

- the pull request opened by the `review` stage for the implemented issues;
- the requirements traceability record of the run (`traceability/<session-id>.json`
  and `.md` under the scratchpad), which links requirements, issues, acceptance
  criteria, and evidence;
- the verification record of every completed stage in the run result.

The `review` stage can also merge the pull request (its effects are listed in
the table). Under the default approval mode `auto` that merge is approved by
policy; select `manual` or `critical` to decide before the branch is pushed and
the pull request is opened or merged. See the
[approval policy](../guides/approval-policy.md).

**Deployment is out of scope.** No stage deploys or releases anything; a
future deployment capability would be a separate stage, listed here when it
exists.

## Generated Matrix

<!-- generated-capability-matrix:start -->

### Pipeline modes

| Capability                   | greenfield                                                          | enhancement                                                         | import                                                              |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Stage slots                  | 19 (local: 18)                                                      | 15                                                                  | 5                                                                   |
| Run ends after               | `doc_indexing`                                                      | `doc_indexing`                                                      | `review`                                                            |
| Verification stage           | `validation-agent`                                                  | `validation-agent`                                                  | `validation-agent`                                                  |
| Pull request                 | `review` (pr-reviewer: `push_branch`, `open_pull_request`, `merge`) | `review` (pr-reviewer: `push_branch`, `open_pull_request`, `merge`) | `review` (pr-reviewer: `push_branch`, `open_pull_request`, `merge`) |
| Pull request in local mode   | `review` (local-reviewer: `merge`)                                  | `review` (local-reviewer: `merge`)                                  | `review` (local-reviewer: `merge`)                                  |
| Stages removed in local mode | `github_repo_setup`                                                 | none                                                                | none                                                                |
| Deployment stage             | none                                                                | none                                                                | none                                                                |

### Policies and operation

| Capability                  | Values                                                         | Default                        | Set with                                             |
| --------------------------- | -------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- |
| Approval mode               | `auto`, `manual`, `critical`, `custom` (programmatic API only) | `auto`                         | `--approval-mode`, `global.approval_mode`            |
| Verification profile        | `advisory`, `delivery`                                         | `advisory`                     | `--vnv-profile`, `global.vnv.profile`                |
| Resume a saved session      | `--resume`                                                     | every run is saved per session | `ad-sdlc run "<requirements>" --resume <session-id>` |
| Stop after a stage          | `--stop-after`                                                 | run to the end                 | `--stop-after <stage>`                               |
| Local operation (no GitHub) | `--local`                                                      | `false`                        | `--local`, `execution.local_mode`, `AD_SDLC_LOCAL`   |
| Installed assets            | 36 agent prompts, 4 project commands                           | same for every template        | `ad-sdlc init`, `ad-sdlc assets update`              |

<!-- generated-capability-matrix:end -->

## Evidence Status

Offline evidence runs on every CI run without SDK calls. Live-run evidence
means a measured end-to-end run of the installed package against a real
repository.

| Mode        | Offline evidence                                                                                    | Live-run evidence                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Greenfield  | Package smoke: the installed CLI resolves the plan (`--dry-run`); unit, integration, and e2e suites | Unmeasured: no published evaluation                                                              |
| Enhancement | Unit, integration, and e2e suites                                                                   | Unmeasured: evaluation planned in [#957](https://github.com/kcenon/claude_code_agent/issues/957) |
| Import      | Unit, integration, and e2e suites                                                                   | Unmeasured: evaluation planned in [#955](https://github.com/kcenon/claude_code_agent/issues/955) |

Link the evaluation reports here when they are published.
