/**
 * Report formatters for the doc-audit module.
 *
 * Produces two representations of an `AuditReport`:
 *   - JSON: stable machine-readable format for CI and downstream tooling.
 *   - Markdown: human-readable summary suitable for PR comments and reviews.
 */

import type { AuditFinding, AuditReport, Severity } from './types.js';

/**
 * Serialize an AuditReport to stable JSON.
 * @param report
 */
export function formatJson(report: AuditReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/**
 * Format an AuditReport as a markdown document suitable for human review.
 * @param report
 */
export function formatMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('# Document Audit Report');
  lines.push('');
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Project:** \`${report.projectDir}\``);
  lines.push(`- **Status:** ${report.pass ? 'PASS' : 'FAIL'}`);
  lines.push('');

  lines.push('## Findings Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('| --- | --- |');
  lines.push(`| Error | ${String(report.counts.error)} |`);
  lines.push(`| Warning | ${String(report.counts.warning)} |`);
  lines.push(`| Info | ${String(report.counts.info)} |`);
  lines.push(`| **Total** | **${String(report.counts.total)}** |`);
  lines.push('');

  lines.push('## Documents');
  lines.push('');
  lines.push('| Kind | Path | Present |');
  lines.push('| --- | --- | --- |');
  for (const doc of report.documents) {
    lines.push(`| ${doc.kind ?? '-'} | \`${doc.path}\` | ${doc.present ? 'yes' : 'no'} |`);
  }
  lines.push('');

  lines.push('## Traceability Coverage');
  lines.push('');
  lines.push('| Direction | Covered | Total | Percent |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(
    `| PRD → SRS | ${String(report.coverage.prdToSrs.covered)} | ${String(report.coverage.prdToSrs.total)} | ${String(report.coverage.prdToSrs.percent)}% |`
  );
  lines.push(
    `| SRS → SDS | ${String(report.coverage.srsToSds.covered)} | ${String(report.coverage.srsToSds.total)} | ${String(report.coverage.srsToSds.percent)}% |`
  );
  lines.push(
    `| SDS → SRS | ${String(report.coverage.sdsToSrs.covered)} | ${String(report.coverage.sdsToSrs.total)} | ${String(report.coverage.sdsToSrs.percent)}% |`
  );
  lines.push(`| **Overall** | | | **${String(report.coverage.overallPercent)}%** |`);
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('No findings. All checks passed.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Findings');
  lines.push('');
  for (const severity of ['error', 'warning', 'info'] as const) {
    const subset = report.findings.filter((f) => f.severity === severity);
    if (subset.length === 0) continue;
    lines.push(`### ${capitalize(severity)} (${String(subset.length)})`);
    lines.push('');
    for (const finding of subset) {
      lines.push(formatFinding(finding));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single finding as a markdown bullet.
 * @param finding
 */
function formatFinding(finding: AuditFinding): string {
  const location =
    finding.line !== undefined ? `${finding.document}:${String(finding.line)}` : finding.document;
  const base = `- [${finding.id}] \`${location}\` — ${finding.message}`;
  if (finding.suggestion !== undefined) {
    return `${base}\n  - Suggestion: ${finding.suggestion}`;
  }
  return base;
}

/**
 * Capitalize the first letter of a severity label.
 * @param value
 */
function capitalize(value: Severity): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
