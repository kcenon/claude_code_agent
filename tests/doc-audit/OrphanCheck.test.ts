import { describe, expect, it } from 'vitest';
import { OrphanCheck } from '../../src/doc-audit/checks/OrphanCheck.js';
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

describe('OrphanCheck', () => {
  it('reports SRS features not referenced from SDS as warnings', () => {
    const srs = makeDoc('SRS', '### SF-001: Covered\n\n### SF-050: Orphan\n');
    const sds = makeDoc('SDS', '### CMP-001: Auth\n\nRealizes SF-001.\n');
    const findings = new OrphanCheck().run([srs, sds]).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.message).toContain('SF-050');
  });

  it('returns no findings when every SF is referenced', () => {
    const srs = makeDoc('SRS', '### SF-001: Login\n');
    const sds = makeDoc('SDS', '### CMP-001: Auth\n\nRealizes SF-001.\n');
    expect(new OrphanCheck().run([srs, sds]).findings).toHaveLength(0);
  });

  it('returns no findings when no SFs are defined', () => {
    const sds = makeDoc('SDS', '### CMP-001: Auth\n');
    expect(new OrphanCheck().run([sds]).findings).toHaveLength(0);
  });
});
