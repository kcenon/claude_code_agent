# Requirements Traceability Matrix — ${project_name}

**Version**: ${version}
**Generated**: ${generated_at}

## 1. Coverage Summary

| Metric                            | Value                                |
| --------------------------------- | ------------------------------------ |
| Total requirements                | ${total_requirements}                |
| Requirements with features        | ${requirements_with_features}        |
| Requirements with components      | ${requirements_with_components}      |
| Requirements with issues          | ${requirements_with_issues}          |
| Requirements with implementations | ${requirements_with_implementations} |
| Requirements with PRs             | ${requirements_with_prs}             |
| Forward coverage                  | ${forward_coverage}                  |
| Backward coverage                 | ${backward_coverage}                 |
| Acceptance criteria total         | ${ac_total}                          |
| Acceptance criteria validated     | ${ac_validated}                      |

## 2. Traceability Matrix

| Requirement | Title | Features | Use Cases | Components | Issues | Status |
| ----------- | ----- | -------- | --------- | ---------- | ------ | ------ |

${matrix_rows}

## 3. Gaps

### Gap Summary

| Type | Severity | Affected IDs | Message |
| ---- | -------- | ------------ | ------- |

${gap_rows}

### Gap Statistics

| Gap Type                        | Count                          |
| ------------------------------- | ------------------------------ |
| Uncovered requirement           | ${uncovered_requirement_count} |
| Orphan component                | ${orphan_component_count}      |
| Missing test                    | ${missing_test_count}          |
| Unvalidated acceptance criteria | ${unvalidated_ac_count}        |
| Broken chain                    | ${broken_chain_count}          |

## 4. Acceptance Criteria Status

| Requirement | Criterion | Description | Validated | Method |
| ----------- | --------- | ----------- | --------- | ------ |

${acceptance_criteria_rows}

---

_This RTM Report was generated automatically from pipeline artifact analysis._
