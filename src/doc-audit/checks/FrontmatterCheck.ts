/**
 * FrontmatterCheck — validates YAML frontmatter against DocumentFrontmatterSchema.
 *
 * Each document is expected to start with a YAML frontmatter block delimited
 * by `---` markers. The frontmatter must satisfy the shared
 * {@link DocumentFrontmatterSchema} used by all writer agents.
 */

import { z } from 'zod';
import yaml from 'js-yaml';
import { DocumentFrontmatterSchema } from '../../schemas/document-frontmatter.js';
import type { AuditCheck, AuditFinding, CheckResult, LoadedDocument } from '../types.js';

/**
 * Extracts the raw frontmatter text (between the opening and closing `---`).
 *
 * @param content - Full markdown content.
 * @returns Frontmatter text if present, or `null` when missing or malformed.
 */
export function extractFrontmatter(content: string): string | null {
  if (!content.startsWith('---')) {
    return null;
  }
  const end = content.indexOf('\n---', 3);
  if (end === -1) {
    return null;
  }
  return content.slice(3, end).replace(/^\n/, '');
}

/**
 * Validates the YAML frontmatter of every loaded document.
 */
export class FrontmatterCheck implements AuditCheck {
  public readonly name = 'frontmatter';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];

    for (const doc of documents) {
      const raw = extractFrontmatter(doc.content);
      if (raw === null) {
        findings.push({
          id: 'frontmatter.missing',
          severity: 'error',
          check: this.name,
          document: doc.relativePath,
          line: 1,
          message: 'Document is missing a YAML frontmatter block.',
          suggestion: 'Add a `---`-delimited YAML frontmatter header at the top of the file.',
        });
        continue;
      }

      let parsed: unknown;
      try {
        parsed = normalizeYamlDates(yaml.load(raw));
      } catch (error) {
        findings.push({
          id: 'frontmatter.invalid-yaml',
          severity: 'error',
          check: this.name,
          document: doc.relativePath,
          line: 1,
          message: `Frontmatter is not valid YAML: ${(error as Error).message}`,
          suggestion: 'Fix YAML syntax errors in the frontmatter block.',
        });
        continue;
      }

      const result = DocumentFrontmatterSchema.safeParse(parsed);
      if (!result.success) {
        for (const issue of result.error.issues) {
          findings.push({
            id: 'frontmatter.schema-violation',
            severity: 'error',
            check: this.name,
            document: doc.relativePath,
            line: 1,
            message: `Frontmatter schema violation at ${formatPath(issue)}: ${issue.message}`,
            suggestion: `Update the frontmatter so that "${formatPath(issue)}" matches the schema.`,
          });
        }
      }
    }

    return { findings };
  }
}

/**
 * Format a Zod issue path for display.
 * @param issue
 */
function formatPath(issue: z.core.$ZodIssue): string {
  return issue.path.length === 0 ? '(root)' : issue.path.join('.');
}

/**
 * Convert any `Date` values nested in the parsed YAML to ISO 8601 strings.
 *
 * YAML 1.1 promotes unquoted ISO timestamps to native dates, but the
 * DocumentFrontmatterSchema expects a string for fields like `generated_at`.
 * Normalizing here accepts both quoted and unquoted timestamps.
 * @param value
 */
function normalizeYamlDates(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeYamlDates(item));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeYamlDates(v);
    }
    return out;
  }
  return value;
}
