import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocAuditor } from '../../src/doc-audit/DocAuditor.js';
import { NoDocumentsFoundError, ProjectDirNotFoundError } from '../../src/doc-audit/errors.js';
import { formatJson, formatMarkdown } from '../../src/doc-audit/reportFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const VALID_PROJECT = join(FIXTURES, 'valid-project');
const BROKEN_PROJECT = join(FIXTURES, 'broken-project');

describe('DocAuditor', () => {
  it('passes on a fully valid project fixture', () => {
    const report = new DocAuditor({ projectDir: VALID_PROJECT }).run();
    expect(report.pass).toBe(true);
    expect(report.counts.error).toBe(0);
    expect(report.documents.some((d) => d.kind === 'PRD' && d.present)).toBe(true);
    expect(report.documents.some((d) => d.kind === 'SRS' && d.present)).toBe(true);
    expect(report.documents.some((d) => d.kind === 'SDS' && d.present)).toBe(true);
    expect(report.coverage.prdToSrs.percent).toBe(100);
    expect(report.coverage.srsToSds.percent).toBe(100);
    expect(report.coverage.sdsToSrs.percent).toBe(100);
  });

  it('fails on the broken fixture with multiple categories of findings', () => {
    const report = new DocAuditor({ projectDir: BROKEN_PROJECT }).run();
    expect(report.pass).toBe(false);
    expect(report.counts.error).toBeGreaterThan(0);

    const checks = new Set(report.findings.map((f) => f.check));
    expect(checks.has('frontmatter')).toBe(true);
    expect(checks.has('traceability')).toBe(true);

    const warnings = report.findings.filter((f) => f.severity === 'warning');
    expect(warnings.some((f) => f.check === 'orphan')).toBe(true);
  });

  it('throws when the project directory does not exist', () => {
    const missing = mkdtempSync(join(tmpdir(), 'doc-audit-missing-'));
    rmSync(missing, { recursive: true, force: true });
    expect(() => new DocAuditor({ projectDir: missing }).run()).toThrow(ProjectDirNotFoundError);
  });

  describe('with an empty project directory', () => {
    let empty: string;

    beforeEach(() => {
      empty = mkdtempSync(join(tmpdir(), 'doc-audit-empty-'));
    });

    afterEach(() => {
      rmSync(empty, { recursive: true, force: true });
    });

    it('throws NoDocumentsFoundError', () => {
      expect(() => new DocAuditor({ projectDir: empty }).run()).toThrow(NoDocumentsFoundError);
    });
  });

  it('serializes the report as stable JSON', () => {
    const report = new DocAuditor({ projectDir: VALID_PROJECT }).run();
    const json = formatJson(report);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.pass).toBe(true);
  });

  it('renders a markdown report with expected sections', () => {
    const report = new DocAuditor({ projectDir: VALID_PROJECT }).run();
    const md = formatMarkdown(report);
    expect(md).toContain('# Document Audit Report');
    expect(md).toContain('## Findings Summary');
    expect(md).toContain('## Traceability Coverage');
  });

  it('renders a markdown report with per-severity groups for failing projects', () => {
    const report = new DocAuditor({ projectDir: BROKEN_PROJECT }).run();
    const md = formatMarkdown(report);
    expect(md).toContain('### Error');
  });
});
