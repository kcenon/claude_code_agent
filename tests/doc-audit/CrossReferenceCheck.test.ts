import { describe, expect, it } from 'vitest';
import {
  CrossReferenceCheck,
  collectDefinedIds,
} from '../../src/doc-audit/checks/CrossReferenceCheck.js';
import type { DocumentKind, LoadedDocument } from '../../src/doc-audit/types.js';

function makeDoc(kind: DocumentKind, content: string): LoadedDocument {
  return {
    relativePath: `${kind.toLowerCase()}.md`,
    absolutePath: `/abs/${kind.toLowerCase()}.md`,
    kind,
    content,
    lines: content.split('\n'),
  };
}

describe('collectDefinedIds', () => {
  it('collects IDs declared as section headings', () => {
    const doc = makeDoc('SRS', '### SF-001: Login\n\n### SF-002: Logout\n');
    const defined = collectDefinedIds([doc]);
    expect(defined.has('SF-001')).toBe(true);
    expect(defined.has('SF-002')).toBe(true);
  });

  it('ignores IDs that only appear in body text', () => {
    const doc = makeDoc('SRS', '### SF-001: Login\n\nSee also SF-999 (mentioned only).\n');
    const defined = collectDefinedIds([doc]);
    expect(defined.has('SF-999')).toBe(false);
  });
});

describe('CrossReferenceCheck', () => {
  it('reports references that lack a definition', () => {
    const srs = makeDoc('SRS', '### SF-001: Login\n\nSee CMP-999 for details.\n');
    const findings = new CrossReferenceCheck().run([srs]).findings;
    expect(findings.some((f) => f.message.includes('CMP-999'))).toBe(true);
  });

  it('accepts references that resolve to another document', () => {
    const srs = makeDoc('SRS', '### SF-001: Login\n\nImplemented by CMP-001.\n');
    const sds = makeDoc('SDS', '### CMP-001: AuthService\n');
    const findings = new CrossReferenceCheck().run([srs, sds]).findings;
    const unresolved = findings.filter((f) => f.id === 'cross-reference.unresolved');
    expect(unresolved).toHaveLength(0);
  });

  it('does not report the defining heading as unresolved', () => {
    const srs = makeDoc('SRS', '### SF-001: Login\n');
    const findings = new CrossReferenceCheck().run([srs]).findings;
    expect(findings).toHaveLength(0);
  });
});
