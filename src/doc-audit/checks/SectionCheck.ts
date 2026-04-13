/**
 * SectionCheck — verifies that each document contains the required sections
 * for its document type.
 *
 * The required sections are a conservative subset that all writer agents are
 * expected to emit. Matching is case-insensitive and tolerant of leading
 * numbering like "## 1. Introduction".
 */

import type {
  AuditCheck,
  AuditFinding,
  CheckResult,
  DocumentKind,
  LoadedDocument,
} from '../types.js';

/**
 * Required section headings per document kind.
 *
 * Each entry is matched against the document's H1/H2/H3 headings using a
 * case-insensitive substring comparison (after stripping leading digits and
 * punctuation), so the auditor tolerates variations such as
 * "## 3. System Features" and "## System Features".
 */
const REQUIRED_SECTIONS: Record<DocumentKind, readonly string[]> = {
  PRD: ['Introduction', 'Functional Requirements', 'Non-Functional Requirements'],
  SRS: ['Introduction', 'Features', 'Non-Functional Requirements'],
  SDS: ['Introduction', 'Architecture', 'Components'],
  SDP: ['Introduction', 'Schedule', 'Resources'],
  TM: ['Introduction', 'Assets', 'Threats'],
  SVP: ['Introduction', 'Test Cases'],
  TD: ['Decisions'],
  DBS: ['Schema'],
};

/**
 * Normalize a heading line to its canonical name.
 * @param line
 */
function normalizeHeading(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^\d+(\.\d+)*\.?\s*/, '')
    .trim()
    .toLowerCase();
}

/**
 * Extract all markdown headings (H1-H3) with their 1-based line numbers.
 * @param lines
 */
export function extractHeadings(
  lines: readonly string[]
): ReadonlyArray<{ readonly line: number; readonly heading: string }> {
  const headings: Array<{ line: number; heading: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    if (/^#{1,4}\s+/.test(raw)) {
      headings.push({ line: i + 1, heading: normalizeHeading(raw) });
    }
  }
  return headings;
}

/**
 * Check each document for its required sections.
 */
export class SectionCheck implements AuditCheck {
  public readonly name = 'section';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];

    for (const doc of documents) {
      const required = REQUIRED_SECTIONS[doc.kind];
      if (required.length === 0) {
        continue;
      }
      const headings = extractHeadings(doc.lines).map((h) => h.heading);

      for (const section of required) {
        const needle = section.toLowerCase();
        const present = headings.some((h) => h.includes(needle));
        if (!present) {
          findings.push({
            id: 'section.missing',
            severity: 'error',
            check: this.name,
            document: doc.relativePath,
            message: `Missing required section "${section}" in ${doc.kind} document.`,
            suggestion: `Add a "## ${section}" heading to the document.`,
          });
        }
      }
    }

    return { findings };
  }
}
