import { describe, expect, it } from 'vitest';
import { SectionCheck, extractHeadings } from '../../src/doc-audit/checks/SectionCheck.js';
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

describe('extractHeadings', () => {
  it('strips numbering and lowercases the heading text', () => {
    const h = extractHeadings(['## 1. Introduction', 'body', '### 1.2 Features']);
    expect(h).toEqual([
      { line: 1, heading: 'introduction' },
      { line: 3, heading: 'features' },
    ]);
  });
});

describe('SectionCheck', () => {
  it('flags missing required sections for a PRD', () => {
    const doc = makeDoc('PRD', '# PRD\n\n## Introduction\n');
    const findings = new SectionCheck().run([doc]).findings;
    expect(findings.some((f) => f.message.includes('Functional Requirements'))).toBe(true);
    expect(findings.some((f) => f.message.includes('Non-Functional Requirements'))).toBe(true);
  });

  it('passes when all required sections are present with numbering', () => {
    const doc = makeDoc(
      'SRS',
      '# SRS\n## 1. Introduction\n## 2. Features\n## 3. Non-Functional Requirements\n'
    );
    const findings = new SectionCheck().run([doc]).findings;
    expect(findings).toHaveLength(0);
  });

  it('covers every DocumentKind without throwing', () => {
    const kinds: DocumentKind[] = ['PRD', 'SRS', 'SDS', 'SDP', 'TM', 'SVP', 'TD', 'DBS'];
    for (const kind of kinds) {
      const doc = makeDoc(kind, '# Title\n');
      expect(() => new SectionCheck().run([doc])).not.toThrow();
    }
  });
});
