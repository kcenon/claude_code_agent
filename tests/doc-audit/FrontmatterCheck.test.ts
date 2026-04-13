import { describe, expect, it } from 'vitest';
import {
  FrontmatterCheck,
  extractFrontmatter,
} from '../../src/doc-audit/checks/FrontmatterCheck.js';
import type { LoadedDocument } from '../../src/doc-audit/types.js';

function makeDoc(path: string, content: string): LoadedDocument {
  return {
    relativePath: path,
    absolutePath: `/abs/${path}`,
    kind: 'PRD',
    content,
    lines: content.split('\n'),
  };
}

describe('extractFrontmatter', () => {
  it('returns null when the document has no frontmatter', () => {
    expect(extractFrontmatter('# Heading\n\nBody')).toBeNull();
  });

  it('returns the YAML block when present', () => {
    const yaml = extractFrontmatter('---\ndoc_id: X\n---\nbody');
    expect(yaml).toContain('doc_id: X');
  });

  it('returns null when the closing marker is missing', () => {
    expect(extractFrontmatter('---\ndoc_id: X\nbody')).toBeNull();
  });
});

describe('FrontmatterCheck', () => {
  it('reports missing frontmatter', () => {
    const check = new FrontmatterCheck();
    const result = check.run([makeDoc('prd.md', '# PRD\n\nNo frontmatter here.')]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.id).toBe('frontmatter.missing');
    expect(result.findings[0]?.severity).toBe('error');
  });

  it('reports invalid YAML', () => {
    const bad = '---\ndoc_id: : : bad\n---\n# PRD';
    const result = new FrontmatterCheck().run([makeDoc('prd.md', bad)]);
    expect(result.findings.some((f) => f.id === 'frontmatter.invalid-yaml')).toBe(true);
  });

  it('reports schema violations', () => {
    const missingFields = '---\ndoc_id: PRD-001\n---\n# PRD';
    const result = new FrontmatterCheck().run([makeDoc('prd.md', missingFields)]);
    expect(result.findings.some((f) => f.id === 'frontmatter.schema-violation')).toBe(true);
  });

  it('passes a fully valid frontmatter', () => {
    const good = [
      '---',
      'doc_id: PRD-001',
      'title: Valid',
      'version: 1.0.0',
      'status: Approved',
      'generated_by: test',
      'generated_at: 2026-04-12T00:00:00Z',
      '---',
      '# PRD',
    ].join('\n');
    const result = new FrontmatterCheck().run([makeDoc('prd.md', good)]);
    expect(result.findings).toHaveLength(0);
  });
});
