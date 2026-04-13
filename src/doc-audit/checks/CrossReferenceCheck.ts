/**
 * CrossReferenceCheck — validates that ID references between documents resolve.
 *
 * The auditor recognizes the standard AD-SDLC ID patterns
 * (FR-001, NFR-001, SF-001, UC-001, CMP-001, TC-001, etc.).
 *
 * A cross-reference is any occurrence of one of these IDs in a document's
 * body. For every referenced ID, the check verifies that a matching
 * definition heading exists somewhere in the audited document set.
 */

import type { AuditCheck, AuditFinding, CheckResult, LoadedDocument } from '../types.js';

/**
 * Regex that matches all known AD-SDLC ID patterns.
 *
 * Kept as a single alternation so the scanner can walk the document in one pass.
 */
const ID_PATTERN = /\b(FR|NFR|CON|SF|UC|CMP|API|DAT|DEP|TC|TH|AS|RSK|TD|DBT|DBC)-\d{3}\b/g;

/**
 * Regex that matches an ID used as a heading anchor, e.g.
 * `### FR-001: Title`. Anchored definitions are considered the canonical
 * location where an ID is declared.
 */
const DEFINITION_PATTERN =
  /^#{2,5}\s+(FR|NFR|CON|SF|UC|CMP|API|DAT|DEP|TC|TH|AS|RSK|TD|DBT|DBC)-\d{3}\b/;

/**
 * Collects all IDs that are defined (declared as section headings) across the
 * provided documents.
 * @param documents
 */
export function collectDefinedIds(documents: readonly LoadedDocument[]): Set<string> {
  const defined = new Set<string>();
  for (const doc of documents) {
    for (const line of doc.lines) {
      const match = DEFINITION_PATTERN.exec(line);
      if (match) {
        const idMatch = line.match(
          /(FR|NFR|CON|SF|UC|CMP|API|DAT|DEP|TC|TH|AS|RSK|TD|DBT|DBC)-\d{3}/
        );
        if (idMatch) {
          defined.add(idMatch[0]);
        }
      }
    }
  }
  return defined;
}

/**
 * Validates that every ID referenced in any document also has a definition.
 */
export class CrossReferenceCheck implements AuditCheck {
  public readonly name = 'cross-reference';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];
    const defined = collectDefinedIds(documents);

    for (const doc of documents) {
      const seenInDoc = new Set<string>();
      for (let i = 0; i < doc.lines.length; i++) {
        const rawLine = doc.lines[i] ?? '';
        if (DEFINITION_PATTERN.test(rawLine)) {
          continue;
        }
        ID_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = ID_PATTERN.exec(rawLine)) !== null) {
          const id = match[0];
          const key = `${id}@${String(i + 1)}`;
          if (seenInDoc.has(key)) {
            continue;
          }
          seenInDoc.add(key);
          if (!defined.has(id)) {
            findings.push({
              id: 'cross-reference.unresolved',
              severity: 'error',
              check: this.name,
              document: doc.relativePath,
              line: i + 1,
              message: `Reference to "${id}" cannot be resolved — no matching definition was found in the audited documents.`,
              suggestion: `Define "${id}" in the owning document (e.g., as a "### ${id}: Title" heading) or correct the reference.`,
            });
          }
        }
      }
    }

    return { findings };
  }
}
