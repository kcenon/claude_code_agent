/**
 * TraceabilityCheck — verifies forward (PRD→SRS) and backward (SDS→SRS)
 * traceability between pipeline artifacts.
 *
 * Forward traceability ensures that each PRD requirement (FR-XXX) is
 * eventually realized by at least one SRS feature (SF-XXX), and that each
 * SRS feature is realized by at least one SDS component (CMP-XXX).
 *
 * Backward traceability ensures that each SDS component references at least
 * one SRS feature that it implements.
 */

import type {
  AuditCheck,
  AuditFinding,
  CheckResult,
  DocumentKind,
  LoadedDocument,
} from '../types.js';

const FR_ID = /FR-\d{3}/g;
const SF_ID = /SF-\d{3}/g;
const CMP_ID = /CMP-\d{3}/g;
const DEFINITION = /^#{2,5}\s+(FR|SF|CMP)-\d{3}\b/;

/**
 * Container for traceability analysis results, exposed for the orchestrator
 * to compute coverage statistics without re-scanning the documents.
 */
export interface TraceabilityIndex {
  readonly definedFR: ReadonlySet<string>;
  readonly definedSF: ReadonlySet<string>;
  readonly definedCMP: ReadonlySet<string>;
  readonly referencedFRFromSRS: ReadonlySet<string>;
  readonly referencedSFFromSDS: ReadonlySet<string>;
  readonly referencedSFPerCMP: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Build a traceability index from the loaded documents.
 * @param documents
 */
export function buildTraceabilityIndex(documents: readonly LoadedDocument[]): TraceabilityIndex {
  const definedFR = new Set<string>();
  const definedSF = new Set<string>();
  const definedCMP = new Set<string>();
  const referencedFRFromSRS = new Set<string>();
  const referencedSFFromSDS = new Set<string>();
  const referencedSFPerCMP = new Map<string, Set<string>>();

  const byKind = groupByKind(documents);

  collectDefinitions(byKind.PRD, FR_ID, definedFR);
  collectDefinitions(byKind.SRS, SF_ID, definedSF);
  collectDefinitions(byKind.SDS, CMP_ID, definedCMP);

  for (const doc of byKind.SRS) {
    for (const line of doc.lines) {
      if (DEFINITION.test(line)) continue;
      FR_ID.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = FR_ID.exec(line)) !== null) {
        referencedFRFromSRS.add(match[0]);
      }
    }
  }

  for (const doc of byKind.SDS) {
    let currentCmp: string | null = null;
    for (const line of doc.lines) {
      const cmpHeading = /^#{2,5}\s+(CMP-\d{3})\b/.exec(line);
      if (cmpHeading) {
        currentCmp = cmpHeading[1] ?? null;
        continue;
      }
      SF_ID.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SF_ID.exec(line)) !== null) {
        referencedSFFromSDS.add(match[0]);
        if (currentCmp !== null) {
          let set = referencedSFPerCMP.get(currentCmp);
          if (set === undefined) {
            set = new Set<string>();
            referencedSFPerCMP.set(currentCmp, set);
          }
          set.add(match[0]);
        }
      }
    }
  }

  return {
    definedFR,
    definedSF,
    definedCMP,
    referencedFRFromSRS,
    referencedSFFromSDS,
    referencedSFPerCMP,
  };
}

/**
 * Group documents by their kind.
 * @param documents
 */
function groupByKind(
  documents: readonly LoadedDocument[]
): Record<DocumentKind, readonly LoadedDocument[]> {
  const initial: Record<DocumentKind, LoadedDocument[]> = {
    PRD: [],
    SRS: [],
    SDS: [],
    SDP: [],
    TM: [],
    SVP: [],
    TD: [],
    DBS: [],
  };
  for (const doc of documents) {
    initial[doc.kind].push(doc);
  }
  return initial;
}

/**
 * Collect IDs that appear as heading definitions in the given documents.
 * @param documents
 * @param pattern
 * @param into
 */
function collectDefinitions(
  documents: readonly LoadedDocument[],
  pattern: RegExp,
  into: Set<string>
): void {
  for (const doc of documents) {
    for (const line of doc.lines) {
      if (!DEFINITION.test(line)) continue;
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        into.add(match[0]);
      }
    }
  }
}

/**
 * Check forward (PRD→SRS, SRS→SDS) and backward (SDS→SRS) traceability.
 */
export class TraceabilityCheck implements AuditCheck {
  public readonly name = 'traceability';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];
    const index = buildTraceabilityIndex(documents);

    for (const fr of index.definedFR) {
      if (!index.referencedFRFromSRS.has(fr)) {
        findings.push({
          id: 'traceability.forward.prd-srs',
          severity: 'warning',
          check: this.name,
          document: 'prd.md',
          message: `PRD requirement "${fr}" is not referenced by any SRS feature.`,
          suggestion: `Add "Source: ${fr}" or inline reference in the SRS feature that realizes this requirement.`,
        });
      }
    }

    for (const cmp of index.definedCMP) {
      const refs = index.referencedSFPerCMP.get(cmp);
      if (refs === undefined || refs.size === 0) {
        findings.push({
          id: 'traceability.backward.sds-srs',
          severity: 'warning',
          check: this.name,
          document: 'sds.md',
          message: `SDS component "${cmp}" does not reference any SRS feature (SF-XXX).`,
          suggestion: `Document which SRS features component "${cmp}" realizes by adding SF references to its description.`,
        });
      }
    }

    return { findings };
  }
}
