# V&V Report — ${project_name}

**Pipeline ID**: ${pipeline_id}
**Mode**: ${pipeline_mode}
**Result**: ${overall_result}
**Generated**: ${generated_at}
**Duration**: ${duration}

## 1. Executive Summary

${executive_summary}

### Key Metrics

| Metric                | Value                            |
| --------------------- | -------------------------------- |
| Pipeline status       | ${pipeline_status}               |
| Stages verified       | ${stages_passed}/${stages_total} |
| Stages failed         | ${stages_failed}                 |
| Total checks executed | ${checks_total}                  |
| Checks passed         | ${checks_passed}                 |
| Requirement coverage  | ${requirement_coverage}          |
| AC pass rate          | ${ac_pass_rate}                  |
| Forward traceability  | ${forward_traceability}          |
| Backward traceability | ${backward_traceability}         |
| RTM gaps              | ${rtm_gap_count}                 |
| Quality gates         | ${quality_gates_status}          |

## 2. Stage Verification Results

| Stage | Status | Checks | Passed | Errors | Warnings | Duration |
| ----- | ------ | ------ | ------ | ------ | -------- | -------- |

${stage_results_rows}

### Failed Check Details

${failed_check_details}

## 3. Traceability Analysis

### Coverage Metrics

| Metric | Value |
| ------ | ----- |

${traceability_coverage_rows}

### Traceability Chain Status

${traceability_chain_status}

### RTM Summary

| Requirement | Features | Use Cases | Components | Issues | Status |
| ----------- | -------- | --------- | ---------- | ------ | ------ |

${rtm_summary_rows}

## 4. Acceptance Criteria Validation

| Metric         | Value           |
| -------------- | --------------- |
| Total criteria | ${ac_total}     |
| Validated      | ${ac_validated} |
| Failed         | ${ac_failed}    |
| Untested       | ${ac_untested}  |
| Pass rate      | ${ac_pass_rate} |

### Failed Criteria

| Criterion | Requirement | Description | Result |
| --------- | ----------- | ----------- | ------ |

${failed_criteria_rows}

### Untested Criteria

${untested_criteria_list}

## 5. Quality Gate Results

**Overall**: ${quality_gates_overall}

| Gate | Status | Details |
| ---- | ------ | ------- |

${quality_gate_rows}

## 6. Gaps & Recommendations

### Traceability Gaps

| Type | Severity | Affected IDs | Message |
| ---- | -------- | ------------ | ------- |

${gap_rows}

### Recommendations

${recommendations}

## 7. Conclusion

${conclusion}

---

_This V&V Report was generated automatically from pipeline execution data._
