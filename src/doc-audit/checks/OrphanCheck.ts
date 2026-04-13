/**
 * OrphanCheck — detects SRS features that are not referenced by any
 * SDS component.
 *
 * An orphan feature is a functional capability defined in the SRS that no
 * design component claims to implement. Orphans usually indicate either
 * missing design work or stale SRS entries.
 */

import type { AuditCheck, AuditFinding, CheckResult, LoadedDocument } from '../types.js';
import { buildTraceabilityIndex } from './TraceabilityCheck.js';

/**
 * Emits one warning per orphan SRS feature.
 *
 * Severity is `warning` rather than `error` because orphans can legitimately
 * occur when the SDS is still being written.
 */
export class OrphanCheck implements AuditCheck {
  public readonly name = 'orphan';

  /**
   *
   * @param documents
   */
  public run(documents: readonly LoadedDocument[]): CheckResult {
    const findings: AuditFinding[] = [];
    const index = buildTraceabilityIndex(documents);

    if (index.definedSF.size === 0) {
      return { findings };
    }

    for (const sf of index.definedSF) {
      if (!index.referencedSFFromSDS.has(sf)) {
        findings.push({
          id: 'orphan.feature',
          severity: 'warning',
          check: this.name,
          document: 'srs.md',
          message: `SRS feature "${sf}" is not referenced by any SDS component.`,
          suggestion: `Reference "${sf}" from the SDS component that implements it, or remove the feature from the SRS if it is no longer planned.`,
        });
      }
    }

    return { findings };
  }
}
