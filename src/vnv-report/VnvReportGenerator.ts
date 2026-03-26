/**
 * V&V Report Generator
 *
 * Utility class that produces formatted markdown and YAML reports for
 * V&V Plans, consolidated V&V Reports, and per-stage verification reports.
 *
 * This is NOT an IAgent — it is a plain utility class invoked by the
 * orchestrator and validation-agent to emit documentation artifacts.
 *
 * @module vnv-report/VnvReportGenerator
 */

import yaml from 'js-yaml';
import type { VnvRigor } from '../vnv/types.js';
import type { PipelineMode } from '../ad-sdlc-orchestrator/types.js';
import type {
  QualityGatesConfig,
  StageVerificationSummary,
  ValidationReportSummary,
  RtmReportData,
  PipelineReportData,
} from './types.js';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format a duration in milliseconds as a human-readable string.
 * @param ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${String(ms)}ms`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${String(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes)}m ${String(remainingSeconds)}s`;
}

/**
 * Format a percentage value with one decimal place.
 * @param value
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Map an overall result to a display emoji/text badge.
 * @param result
 */
function resultBadge(result: string): string {
  switch (result) {
    case 'pass':
      return 'PASS';
    case 'pass_with_warnings':
      return 'PASS WITH WARNINGS';
    case 'fail':
      return 'FAIL';
    default:
      return result.toUpperCase();
  }
}

/**
 * Map a rigor level to a human-readable description.
 * @param rigor
 */
function rigorDescription(rigor: VnvRigor): string {
  switch (rigor) {
    case 'strict':
      return 'Strict — All checks enforced, pipeline halts on failure, 100% traceability required';
    case 'standard':
      return 'Standard — Content and traceability checks, warnings on failure, coverage >= 80%';
    case 'minimal':
      return 'Minimal — Schema validation and file existence only';
  }
}

/**
 * Generate a markdown table row from cell values.
 * @param cells
 */
function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

/**
 * Generate a markdown table separator row.
 * @param columnCount
 */
function tableSeparator(columnCount: number): string {
  const dashes = Array.from({ length: columnCount }, () => '---');
  return `| ${dashes.join(' | ')} |`;
}

// =============================================================================
// VnvReportGenerator
// =============================================================================

/**
 * Generates V&V documentation artifacts as formatted markdown and YAML strings.
 *
 * Three main outputs:
 * 1. **V&V Plan** — generated at pipeline start, documenting scope and strategy
 * 2. **V&V Report** — generated at pipeline end, consolidating all results
 * 3. **Stage Report** — per-stage YAML summary for scratchpad storage
 */
export class VnvReportGenerator {
  /**
   * Generate a V&V Plan document at pipeline start.
   *
   * The plan describes the verification and validation strategy for the
   * pipeline run, including quality gates, traceability requirements,
   * and the verification schedule.
   *
   * @param pipelineMode - Active pipeline mode (greenfield/enhancement/import)
   * @param stages - Pipeline stages with name and description
   * @param rigor - V&V rigor level
   * @param qualityGates - Quality gates configuration
   * @returns Formatted markdown string
   */
  generateVnvPlan(
    pipelineMode: PipelineMode,
    stages: readonly { readonly name: string; readonly description: string }[],
    rigor: VnvRigor,
    qualityGates: QualityGatesConfig
  ): string {
    const generatedAt = new Date().toISOString();
    const sections: string[] = [];

    // -- Header --
    sections.push(
      `# V&V Plan — ${pipelineMode.charAt(0).toUpperCase() + pipelineMode.slice(1)} Pipeline`
    );
    sections.push('');
    sections.push(`**Pipeline Mode**: ${pipelineMode}`);
    sections.push(`**Rigor Level**: ${rigor}`);
    sections.push(`**Generated**: ${generatedAt}`);
    sections.push('');

    // -- 1. V&V Scope --
    sections.push('## 1. V&V Scope');
    sections.push('');
    sections.push(
      `This V&V Plan defines the verification and validation strategy for a **${pipelineMode}** pipeline ` +
        `execution at **${rigor}** rigor level. ${rigorDescription(rigor)}.`
    );
    sections.push('');
    sections.push(
      `The pipeline comprises **${String(stages.length)}** stages. Each stage producing artifacts ` +
        'will pass through a verification gate before the next stage begins.'
    );
    sections.push('');

    // -- 2. Verification Strategy --
    sections.push('## 2. Verification Strategy');
    sections.push('');
    sections.push('### Stage Verification Gates');
    sections.push('');
    sections.push(tableRow(['Stage', 'Description', 'Verification Checks', 'Rigor Requirement']));
    sections.push(tableSeparator(4));

    for (const stage of stages) {
      const checks = this._getVerificationChecksForStage(stage.name, rigor);
      sections.push(tableRow([stage.name, stage.description, checks, rigor]));
    }
    sections.push('');
    sections.push('**Verification approach**:');
    sections.push('');
    sections.push('- **Structure checks**: Validate schema conformance and ID formatting');
    sections.push('- **Content checks**: Validate required sections and output completeness');
    sections.push(
      '- **Traceability checks**: Validate cross-artifact linkage (FR -> SF -> UC -> CMP)'
    );
    sections.push('- **Consistency checks**: Validate cross-document sync-point alignment');
    sections.push('- **Quality checks**: Validate test results, coverage, and lint status');
    sections.push('');

    // -- 3. Validation Strategy --
    sections.push('## 3. Validation Strategy');
    sections.push('');
    sections.push(
      'Validation confirms that the delivered system meets the stated requirements ' +
        'and acceptance criteria.'
    );
    sections.push('');
    sections.push('### Acceptance Criteria Validation');
    sections.push('');
    sections.push(
      '1. **Extraction**: Acceptance criteria are extracted from the PRD and tracked per functional requirement'
    );
    sections.push(
      '2. **Mapping**: Each criterion is mapped to implementation artifacts via the RTM'
    );
    sections.push(
      '3. **Verification**: Test results, code review outcomes, and manual checks validate each criterion'
    );
    sections.push(
      '4. **Reporting**: Pass/fail status is reported per criterion with aggregated metrics'
    );
    sections.push('');
    sections.push('### Validation Methods');
    sections.push('');
    sections.push('| Method | Description | Applicable To |');
    sections.push('| --- | --- | --- |');
    sections.push(
      '| Unit testing | Automated unit tests validate individual functions | Code components |'
    );
    sections.push('| Integration testing | Cross-module integration tests | System interactions |');
    sections.push(
      '| Build verification | Successful compilation and packaging | Implementation output |'
    );
    sections.push(
      '| Document review | Content completeness and consistency checks | PRD, SRS, SDS |'
    );
    sections.push('| Traceability analysis | End-to-end requirement coverage | RTM |');
    sections.push('');

    // -- 4. Traceability Requirements --
    sections.push('## 4. Traceability Requirements');
    sections.push('');
    sections.push(
      'The Requirements Traceability Matrix (RTM) must trace each functional requirement ' +
        'through the full artifact chain:'
    );
    sections.push('');
    sections.push('```');
    sections.push('FR (Functional Requirement)');
    sections.push('  -> SF (SRS Feature)');
    sections.push('    -> UC (Use Case)');
    sections.push('      -> CMP (SDS Component)');
    sections.push('        -> ISS (Issue)');
    sections.push('          -> WO (Work Order)');
    sections.push('            -> PR (Pull Request)');
    sections.push('```');
    sections.push('');
    sections.push(this._getTraceabilityCoverageRequirements(rigor));
    sections.push('');

    // -- 5. Quality Gates --
    sections.push('## 5. Quality Gates');
    sections.push('');
    sections.push(this._formatQualityGates(qualityGates));
    sections.push('');

    // -- 6. V&V Schedule --
    sections.push('## 6. V&V Schedule');
    sections.push('');
    sections.push(
      'Verification and validation checkpoints are integrated into the pipeline execution:'
    );
    sections.push('');
    sections.push(tableRow(['Order', 'Stage', 'V&V Checkpoint']));
    sections.push(tableSeparator(3));

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      if (stage === undefined) continue;
      const checkpoint = this._getCheckpointType(stage.name);
      sections.push(tableRow([String(i + 1), stage.name, checkpoint]));
    }
    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push(
      '*This V&V Plan was generated automatically and should be reviewed ' +
        'before pipeline execution.*'
    );

    return sections.join('\n');
  }

  /**
   * Generate a consolidated V&V Report at pipeline end.
   *
   * The report aggregates all stage verification results, the validation
   * report, RTM analysis, and produces an executive summary with
   * recommendations.
   *
   * @param stageVerifications - Verification results for each pipeline stage
   * @param validationReport - Consolidated validation report
   * @param rtm - RTM data with entries, metrics, and gaps
   * @param pipelineResult - Pipeline execution metadata
   * @returns Formatted markdown string
   */
  generateVnvReport(
    stageVerifications: readonly StageVerificationSummary[],
    validationReport: ValidationReportSummary,
    rtm: RtmReportData,
    pipelineResult: PipelineReportData
  ): string {
    const generatedAt = new Date().toISOString();
    const sections: string[] = [];

    // -- Header --
    sections.push('# V&V Report');
    sections.push('');
    sections.push(`**Pipeline ID**: ${pipelineResult.pipelineId}`);
    sections.push(`**Mode**: ${pipelineResult.mode}`);
    sections.push(`**Result**: ${resultBadge(validationReport.overallResult)}`);
    sections.push(`**Generated**: ${generatedAt}`);
    sections.push(`**Duration**: ${formatDuration(pipelineResult.durationMs)}`);
    sections.push('');

    // -- 1. Executive Summary --
    sections.push('## 1. Executive Summary');
    sections.push('');
    sections.push(
      this._generateExecutiveSummary(stageVerifications, validationReport, rtm, pipelineResult)
    );
    sections.push('');

    // -- 2. Stage Verification Results --
    sections.push('## 2. Stage Verification Results');
    sections.push('');

    if (stageVerifications.length === 0) {
      sections.push('No stage verifications were performed.');
    } else {
      sections.push(
        tableRow(['Stage', 'Status', 'Checks', 'Passed', 'Errors', 'Warnings', 'Duration'])
      );
      sections.push(tableSeparator(7));

      for (const sv of stageVerifications) {
        const totalChecks = sv.checks.length;
        const passedChecks = sv.checks.filter((c) => c.passed).length;
        sections.push(
          tableRow([
            sv.stageName,
            sv.passed ? 'PASS' : 'FAIL',
            String(totalChecks),
            String(passedChecks),
            String(sv.errors.length),
            String(sv.warnings.length),
            formatDuration(sv.durationMs),
          ])
        );
      }
      sections.push('');

      // Detail failed checks
      const failedStages = stageVerifications.filter((sv) => !sv.passed);
      if (failedStages.length > 0) {
        sections.push('### Failed Check Details');
        sections.push('');
        for (const sv of failedStages) {
          const failedChecks = sv.checks.filter((c) => !c.passed);
          if (failedChecks.length > 0) {
            sections.push(`#### ${sv.stageName}`);
            sections.push('');
            for (const check of failedChecks) {
              sections.push(`- **${check.checkId}** (${check.severity}): ${check.message}`);
            }
            sections.push('');
          }
        }
      }
    }

    // -- 3. Traceability Analysis --
    sections.push('## 3. Traceability Analysis');
    sections.push('');
    sections.push(this._formatTraceabilityAnalysis(validationReport, rtm));
    sections.push('');

    // -- 4. Acceptance Criteria Validation --
    sections.push('## 4. Acceptance Criteria Validation');
    sections.push('');
    sections.push(this._formatAcceptanceCriteria(validationReport));
    sections.push('');

    // -- 5. Quality Gate Results --
    sections.push('## 5. Quality Gate Results');
    sections.push('');
    sections.push(this._formatQualityGateResults(validationReport));
    sections.push('');

    // -- 6. Gaps & Recommendations --
    sections.push('## 6. Gaps & Recommendations');
    sections.push('');
    sections.push(this._formatGapsAndRecommendations(validationReport, rtm));
    sections.push('');

    // -- 7. Conclusion --
    sections.push('## 7. Conclusion');
    sections.push('');
    sections.push(this._generateConclusion(validationReport, stageVerifications));
    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('*This V&V Report was generated automatically from pipeline execution data.*');

    return sections.join('\n');
  }

  /**
   * Generate a per-stage verification report as a YAML string.
   *
   * Intended for storage in the scratchpad directory as an intermediate
   * artifact that feeds into the consolidated V&V Report.
   *
   * @param result - Stage verification summary
   * @returns YAML string
   */
  generateStageReport(result: StageVerificationSummary): string {
    const doc = {
      stage_verification_report: {
        stage_name: result.stageName,
        passed: result.passed,
        rigor: result.rigor,
        timestamp: result.timestamp,
        duration_ms: result.durationMs,
        summary: {
          total_checks: result.checks.length,
          passed_checks: result.checks.filter((c) => c.passed).length,
          failed_checks: result.checks.filter((c) => !c.passed).length,
          error_count: result.errors.length,
          warning_count: result.warnings.length,
        },
        checks: result.checks.map((c) => ({
          check_id: c.checkId,
          name: c.name,
          category: c.category,
          passed: c.passed,
          severity: c.severity,
          message: c.message,
        })),
        warnings: [...result.warnings],
        errors: [...result.errors],
      },
    };

    return yaml.dump(doc, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });
  }

  // ===========================================================================
  // Private helpers — V&V Plan
  // ===========================================================================

  /**
   * Determine which verification checks apply to a stage at a given rigor level.
   * @param stageName
   * @param rigor
   */
  private _getVerificationChecksForStage(stageName: string, rigor: VnvRigor): string {
    const documentStages = new Set([
      'prd_generation',
      'srs_generation',
      'sds_generation',
      'prd_update',
      'srs_update',
      'sds_update',
    ]);
    const codeStages = new Set(['implementation']);
    const issueStages = new Set(['issue_generation']);

    const checks: string[] = [];

    // Structure checks always apply
    checks.push('Structure');

    if (rigor !== 'minimal') {
      if (documentStages.has(stageName)) {
        checks.push('Content', 'Traceability', 'Consistency');
      } else if (codeStages.has(stageName)) {
        checks.push('Quality', 'Traceability');
      } else if (issueStages.has(stageName)) {
        checks.push('Content', 'Traceability');
      } else {
        checks.push('Content');
      }
    }

    return checks.join(', ');
  }

  /**
   * Get traceability coverage requirements for a given rigor level.
   * @param rigor
   */
  private _getTraceabilityCoverageRequirements(rigor: VnvRigor): string {
    switch (rigor) {
      case 'strict':
        return (
          '**Coverage Requirements (Strict)**:\n\n' +
          '- Forward coverage: 100% of requirements must trace to components\n' +
          '- Backward coverage: 100% of components must trace to requirements\n' +
          '- All acceptance criteria must be validated\n' +
          '- No broken links or orphan artifacts permitted'
        );
      case 'standard':
        return (
          '**Coverage Requirements (Standard)**:\n\n' +
          '- Forward coverage: >= 80% of requirements must trace to components\n' +
          '- Backward coverage: >= 80% of components must trace to requirements\n' +
          '- Acceptance criteria validation recommended but not mandatory\n' +
          '- Broken links reported as warnings'
        );
      case 'minimal':
        return (
          '**Coverage Requirements (Minimal)**:\n\n' +
          '- Traceability checks are not enforced at minimal rigor\n' +
          '- RTM is generated for informational purposes only'
        );
    }
  }

  /**
   * Format quality gates configuration as markdown.
   * @param qualityGates
   */
  private _formatQualityGates(qualityGates: QualityGatesConfig): string {
    const parts: string[] = [];

    // Document quality
    parts.push('### Document Quality');
    parts.push('');

    const docQuality = qualityGates.document_quality;
    if (docQuality) {
      if (docQuality.prd) {
        parts.push('**PRD**:');
        if (docQuality.prd.required_sections && docQuality.prd.required_sections.length > 0) {
          parts.push(`- Required sections: ${docQuality.prd.required_sections.join(', ')}`);
        }
        if (docQuality.prd.min_requirements !== undefined) {
          parts.push(`- Minimum requirements: ${String(docQuality.prd.min_requirements)}`);
        }
        parts.push('');
      }
      if (docQuality.srs) {
        parts.push('**SRS**:');
        if (docQuality.srs.required_sections && docQuality.srs.required_sections.length > 0) {
          parts.push(`- Required sections: ${docQuality.srs.required_sections.join(', ')}`);
        }
        parts.push('');
      }
      if (docQuality.sds) {
        parts.push('**SDS**:');
        if (docQuality.sds.required_sections && docQuality.sds.required_sections.length > 0) {
          parts.push(`- Required sections: ${docQuality.sds.required_sections.join(', ')}`);
        }
        parts.push('');
      }
    } else {
      parts.push('No document quality gates configured.');
      parts.push('');
    }

    // Code quality
    parts.push('### Code Quality');
    parts.push('');

    const codeQuality = qualityGates.code_quality;
    if (codeQuality) {
      if (codeQuality.coverage_threshold !== undefined) {
        parts.push(`- Coverage threshold: ${formatPercent(codeQuality.coverage_threshold)}`);
      }
      if (codeQuality.max_complexity !== undefined) {
        parts.push(`- Maximum cyclomatic complexity: ${String(codeQuality.max_complexity)}`);
      }
      parts.push('');
    } else {
      parts.push('No code quality gates configured.');
      parts.push('');
    }

    // Security
    parts.push('### Security');
    parts.push('');

    const security = qualityGates.security;
    if (security) {
      if (security.no_hardcoded_secrets === true) {
        parts.push('- No hardcoded secrets or credentials permitted');
      }
      if (security.require_input_validation === true) {
        parts.push('- Input validation required on all external interfaces');
      }
      parts.push('');
    } else {
      parts.push('No security gates configured.');
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Determine the V&V checkpoint type for a stage.
   * @param stageName
   */
  private _getCheckpointType(stageName: string): string {
    const verificationStages = new Set([
      'prd_generation',
      'srs_generation',
      'sds_generation',
      'prd_update',
      'srs_update',
      'sds_update',
      'issue_generation',
      'implementation',
    ]);
    const validationStages = new Set(['review', 'regression_testing']);

    if (verificationStages.has(stageName)) {
      return 'Verification gate (post-stage)';
    }
    if (validationStages.has(stageName)) {
      return 'Validation checkpoint';
    }
    return 'Monitoring only';
  }

  // ===========================================================================
  // Private helpers — V&V Report
  // ===========================================================================

  /**
   * Generate the executive summary section.
   * @param stageVerifications
   * @param validationReport
   * @param rtm
   * @param pipelineResult
   */
  private _generateExecutiveSummary(
    stageVerifications: readonly StageVerificationSummary[],
    validationReport: ValidationReportSummary,
    rtm: RtmReportData,
    pipelineResult: PipelineReportData
  ): string {
    const totalStages = stageVerifications.length;
    const passedStages = stageVerifications.filter((sv) => sv.passed).length;
    const failedStages = totalStages - passedStages;
    const totalChecks = stageVerifications.reduce((sum, sv) => sum + sv.checks.length, 0);
    const passedChecks = stageVerifications.reduce(
      (sum, sv) => sum + sv.checks.filter((c) => c.passed).length,
      0
    );

    const lines: string[] = [];

    lines.push(
      `The ${pipelineResult.mode} pipeline (**${pipelineResult.pipelineId}**) completed ` +
        `in ${formatDuration(pipelineResult.durationMs)} with an overall result of ` +
        `**${resultBadge(validationReport.overallResult)}**.`
    );
    lines.push('');
    lines.push('### Key Metrics');
    lines.push('');
    lines.push(tableRow(['Metric', 'Value']));
    lines.push(tableSeparator(2));
    lines.push(tableRow(['Pipeline status', pipelineResult.overallStatus]));
    lines.push(tableRow(['Stages verified', `${String(passedStages)}/${String(totalStages)}`]));
    lines.push(tableRow(['Stages failed', String(failedStages)]));
    lines.push(tableRow(['Total checks executed', String(totalChecks)]));
    lines.push(tableRow(['Checks passed', String(passedChecks)]));
    lines.push(
      tableRow([
        'Requirement coverage',
        formatPercent(validationReport.requirementValidation.coveragePercent),
      ])
    );
    lines.push(
      tableRow([
        'AC pass rate',
        formatPercent(validationReport.acceptanceCriteriaValidation.passRate),
      ])
    );
    lines.push(
      tableRow([
        'Forward traceability',
        formatPercent(validationReport.traceabilityValidation.forwardCoverage),
      ])
    );
    lines.push(
      tableRow([
        'Backward traceability',
        formatPercent(validationReport.traceabilityValidation.backwardCoverage),
      ])
    );
    lines.push(tableRow(['RTM gaps', String(rtm.gaps.length)]));
    lines.push(
      tableRow([
        'Quality gates',
        validationReport.qualityGateResults.allGatesPassed ? 'All passed' : 'Some failed',
      ])
    );

    return lines.join('\n');
  }

  /**
   * Format the traceability analysis section.
   * @param validationReport
   * @param rtm
   */
  private _formatTraceabilityAnalysis(
    validationReport: ValidationReportSummary,
    rtm: RtmReportData
  ): string {
    const tv = validationReport.traceabilityValidation;
    const metrics = rtm.coverageMetrics;
    const lines: string[] = [];

    lines.push('### Coverage Metrics');
    lines.push('');
    lines.push(tableRow(['Metric', 'Value']));
    lines.push(tableSeparator(2));
    lines.push(tableRow(['Total requirements', String(metrics.totalRequirements)]));
    lines.push(tableRow(['Requirements with features', String(metrics.requirementsWithFeatures)]));
    lines.push(
      tableRow(['Requirements with components', String(metrics.requirementsWithComponents)])
    );
    lines.push(tableRow(['Requirements with issues', String(metrics.requirementsWithIssues)]));
    lines.push(
      tableRow([
        'Requirements with implementations',
        String(metrics.requirementsWithImplementations),
      ])
    );
    lines.push(tableRow(['Requirements with PRs', String(metrics.requirementsWithPRs)]));
    lines.push(tableRow(['Forward coverage', formatPercent(metrics.forwardCoveragePercent)]));
    lines.push(tableRow(['Backward coverage', formatPercent(metrics.backwardCoveragePercent)]));
    lines.push(
      tableRow([
        'Acceptance criteria validated',
        `${String(metrics.acceptanceCriteriaValidated)}/${String(metrics.acceptanceCriteriaTotal)}`,
      ])
    );
    lines.push('');

    lines.push('### Traceability Chain Status');
    lines.push('');
    lines.push(`- Chain complete: **${tv.chainComplete ? 'Yes' : 'No'}**`);

    if (tv.brokenLinks.length > 0) {
      lines.push(`- Broken links (${String(tv.brokenLinks.length)}):`);
      for (const link of tv.brokenLinks) {
        lines.push(`  - ${link}`);
      }
    } else {
      lines.push('- Broken links: None');
    }

    if (tv.orphanArtifacts.length > 0) {
      lines.push(`- Orphan artifacts (${String(tv.orphanArtifacts.length)}):`);
      for (const artifact of tv.orphanArtifacts) {
        lines.push(`  - ${artifact}`);
      }
    } else {
      lines.push('- Orphan artifacts: None');
    }

    // RTM entry summary
    if (rtm.entries.length > 0) {
      lines.push('');
      lines.push('### RTM Summary');
      lines.push('');
      lines.push(
        tableRow(['Requirement', 'Features', 'Use Cases', 'Components', 'Issues', 'Status'])
      );
      lines.push(tableSeparator(6));

      for (const entry of rtm.entries) {
        lines.push(
          tableRow([
            entry.requirementId,
            entry.features.join(', ') || '-',
            entry.useCases.join(', ') || '-',
            entry.components.join(', ') || '-',
            entry.issues.join(', ') || '-',
            entry.status,
          ])
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Format the acceptance criteria validation section.
   * @param validationReport
   */
  private _formatAcceptanceCriteria(validationReport: ValidationReportSummary): string {
    const acv = validationReport.acceptanceCriteriaValidation;
    const lines: string[] = [];

    lines.push(tableRow(['Metric', 'Value']));
    lines.push(tableSeparator(2));
    lines.push(tableRow(['Total criteria', String(acv.totalCriteria)]));
    lines.push(tableRow(['Validated', String(acv.validatedCriteria)]));
    lines.push(tableRow(['Failed', String(acv.failedCriteria.length)]));
    lines.push(tableRow(['Untested', String(acv.untestedCriteria.length)]));
    lines.push(tableRow(['Pass rate', formatPercent(acv.passRate)]));
    lines.push('');

    if (acv.failedCriteria.length > 0) {
      lines.push('### Failed Criteria');
      lines.push('');
      lines.push(tableRow(['Criterion', 'Requirement', 'Description', 'Result']));
      lines.push(tableSeparator(4));

      for (const fc of acv.failedCriteria) {
        lines.push(tableRow([fc.criterionId, fc.requirementId, fc.description, fc.result]));
      }
      lines.push('');
    }

    if (acv.untestedCriteria.length > 0) {
      lines.push('### Untested Criteria');
      lines.push('');
      for (const uc of acv.untestedCriteria) {
        lines.push(`- ${uc}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format the quality gate results section.
   * @param validationReport
   */
  private _formatQualityGateResults(validationReport: ValidationReportSummary): string {
    const qg = validationReport.qualityGateResults;
    const lines: string[] = [];

    lines.push(`**Overall**: ${qg.allGatesPassed ? 'All gates passed' : 'Some gates failed'}`);
    lines.push('');

    if (qg.gateResults.length > 0) {
      lines.push(tableRow(['Gate', 'Status', 'Details']));
      lines.push(tableSeparator(3));

      for (const gr of qg.gateResults) {
        lines.push(tableRow([gr.gateName, gr.passed ? 'PASS' : 'FAIL', gr.details]));
      }
    } else {
      lines.push('No quality gates were evaluated.');
    }

    return lines.join('\n');
  }

  /**
   * Format the gaps and recommendations section.
   * @param validationReport
   * @param rtm
   */
  private _formatGapsAndRecommendations(
    validationReport: ValidationReportSummary,
    rtm: RtmReportData
  ): string {
    const lines: string[] = [];

    // RTM Gaps
    if (rtm.gaps.length > 0) {
      lines.push('### Traceability Gaps');
      lines.push('');
      lines.push(tableRow(['Type', 'Severity', 'Affected IDs', 'Message']));
      lines.push(tableSeparator(4));

      for (const gap of rtm.gaps) {
        lines.push(tableRow([gap.type, gap.severity, gap.affectedIds.join(', '), gap.message]));
      }
      lines.push('');
    } else {
      lines.push('### Traceability Gaps');
      lines.push('');
      lines.push('No traceability gaps identified.');
      lines.push('');
    }

    // Recommendations
    if (validationReport.recommendations.length > 0) {
      lines.push('### Recommendations');
      lines.push('');
      for (let i = 0; i < validationReport.recommendations.length; i++) {
        const rec = validationReport.recommendations[i];
        if (rec !== undefined) {
          lines.push(`${String(i + 1)}. ${rec}`);
        }
      }
    } else {
      lines.push('### Recommendations');
      lines.push('');
      lines.push('No recommendations at this time.');
    }

    return lines.join('\n');
  }

  /**
   * Generate the conclusion section.
   * @param validationReport
   * @param stageVerifications
   */
  private _generateConclusion(
    validationReport: ValidationReportSummary,
    stageVerifications: readonly StageVerificationSummary[]
  ): string {
    const result = validationReport.overallResult;
    const totalStages = stageVerifications.length;
    const passedStages = stageVerifications.filter((sv) => sv.passed).length;
    const reqCoverage = validationReport.requirementValidation.coveragePercent;
    const acPassRate = validationReport.acceptanceCriteriaValidation.passRate;

    const lines: string[] = [];

    switch (result) {
      case 'pass':
        lines.push(
          `The pipeline execution has **passed** all verification and validation checks. ` +
            `All ${String(totalStages)} stages passed verification, requirement coverage is at ` +
            `${formatPercent(reqCoverage)}, and acceptance criteria pass rate is ` +
            `${formatPercent(acPassRate)}. The delivered artifacts meet the defined ` +
            `quality standards.`
        );
        break;
      case 'pass_with_warnings':
        lines.push(
          `The pipeline execution has **passed with warnings**. ` +
            `${String(passedStages)}/${String(totalStages)} stages passed verification, ` +
            `requirement coverage is at ${formatPercent(reqCoverage)}, and ` +
            `acceptance criteria pass rate is ${formatPercent(acPassRate)}. ` +
            `Review the warnings and recommendations above before proceeding.`
        );
        break;
      case 'fail':
        lines.push(
          `The pipeline execution has **failed** verification and validation. ` +
            `${String(passedStages)}/${String(totalStages)} stages passed verification, ` +
            `requirement coverage is at ${formatPercent(reqCoverage)}, and ` +
            `acceptance criteria pass rate is ${formatPercent(acPassRate)}. ` +
            `The identified gaps and failures must be addressed before the ` +
            `delivered artifacts can be accepted.`
        );
        break;
    }

    return lines.join('\n');
  }
}
