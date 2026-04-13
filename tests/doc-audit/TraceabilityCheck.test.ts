import { describe, expect, it } from 'vitest';
import {
  TraceabilityCheck,
  buildTraceabilityIndex,
} from '../../src/doc-audit/checks/TraceabilityCheck.js';
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

describe('buildTraceabilityIndex', () => {
  it('tracks references per component', () => {
    const sds = makeDoc(
      'SDS',
      '### CMP-001: AuthService\n\nRealizes SF-001.\n\n### CMP-002: Other\n\nRealizes SF-001 and SF-002.\n'
    );
    const index = buildTraceabilityIndex([sds]);
    expect(index.referencedSFPerCMP.get('CMP-001')?.has('SF-001')).toBe(true);
    expect(index.referencedSFPerCMP.get('CMP-002')?.size).toBe(2);
  });
});

describe('TraceabilityCheck', () => {
  it('reports a PRD FR never referenced by the SRS', () => {
    const prd = makeDoc('PRD', '### FR-001: Login\n### FR-002: Logout\n');
    const srs = makeDoc('SRS', '### SF-001: Login\n\nSource: FR-001\n');
    const sds = makeDoc('SDS', '### CMP-001: Auth\n\nRealizes SF-001.\n');
    const findings = new TraceabilityCheck().run([prd, srs, sds]).findings;
    expect(findings.some((f) => f.id === 'traceability.forward.prd-srs')).toBe(true);
    expect(findings.some((f) => f.message.includes('FR-002'))).toBe(true);
  });

  it('reports a component that does not reference any feature', () => {
    const prd = makeDoc('PRD', '### FR-001: Login\n');
    const srs = makeDoc('SRS', '### SF-001: Login\n\nSource: FR-001\n');
    const sds = makeDoc('SDS', '### CMP-999: Bare\n\nNo feature references.\n');
    const findings = new TraceabilityCheck().run([prd, srs, sds]).findings;
    expect(findings.some((f) => f.id === 'traceability.backward.sds-srs')).toBe(true);
  });

  it('passes a fully traced project', () => {
    const prd = makeDoc('PRD', '### FR-001: Login\n');
    const srs = makeDoc('SRS', '### SF-001: Login\n\nSource: FR-001\n');
    const sds = makeDoc('SDS', '### CMP-001: Auth\n\nRealizes SF-001.\n');
    const findings = new TraceabilityCheck().run([prd, srs, sds]).findings;
    expect(findings).toHaveLength(0);
  });
});
