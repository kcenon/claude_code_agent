/**
 * Public entry point for the doc-audit module.
 *
 * External callers (CLI scripts, tests, other services) should import from
 * this module rather than reaching into individual files.
 */

export { DocAuditor } from './DocAuditor.js';
export {
  AuditReportWriteError,
  DocAuditError,
  NoDocumentsFoundError,
  ProjectDirNotFoundError,
} from './errors.js';
export { formatJson, formatMarkdown } from './reportFormat.js';
export type {
  AuditCheck,
  AuditFinding,
  AuditReport,
  CheckResult,
  CoverageRatio,
  CoverageStats,
  DocAuditorConfig,
  DocumentKind,
  DocumentSummary,
  FindingCounts,
  LoadedDocument,
  Severity,
} from './types.js';
