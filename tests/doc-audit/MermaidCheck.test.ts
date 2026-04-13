import { describe, expect, it } from 'vitest';
import {
  MermaidCheck,
  findMermaidBlocks,
  validateMermaidBody,
} from '../../src/doc-audit/checks/MermaidCheck.js';
import type { LoadedDocument } from '../../src/doc-audit/types.js';

function makeDoc(content: string): LoadedDocument {
  return {
    relativePath: 'sds.md',
    absolutePath: '/abs/sds.md',
    kind: 'SDS',
    content,
    lines: content.split('\n'),
  };
}

describe('findMermaidBlocks', () => {
  it('identifies start/end line numbers of blocks', () => {
    const lines = ['text', '```mermaid', 'graph TD', '  A --> B', '```', 'more text'];
    const blocks = findMermaidBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.startLine).toBe(2);
    expect(blocks[0]?.endLine).toBe(5);
    expect(blocks[0]?.body).toContain('graph TD');
  });

  it('returns an empty list when there are no blocks', () => {
    expect(findMermaidBlocks(['no', 'blocks', 'here'])).toHaveLength(0);
  });
});

describe('validateMermaidBody', () => {
  it('rejects empty bodies', () => {
    expect(validateMermaidBody('')).toMatch(/empty/i);
  });

  it('rejects unknown diagram keywords', () => {
    expect(validateMermaidBody('not-a-diagram ---')).toMatch(/recognized/i);
  });

  it('rejects unbalanced brackets', () => {
    expect(validateMermaidBody('graph TD\n  A[Start --> B')).toMatch(/unbalanced/i);
  });

  it('accepts a valid minimal flowchart', () => {
    expect(validateMermaidBody('flowchart TD\n  A --> B')).toBeNull();
  });
});

describe('MermaidCheck', () => {
  it('emits a warning for invalid mermaid blocks', () => {
    const doc = makeDoc('```mermaid\nnot-a-diagram [[[\n```\n');
    const findings = new MermaidCheck().run([doc]).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('warning');
    expect(findings[0]?.id).toBe('mermaid.invalid');
  });

  it('does not flag a valid mermaid block', () => {
    const doc = makeDoc('```mermaid\nflowchart TD\n  A --> B\n```\n');
    expect(new MermaidCheck().run([doc]).findings).toHaveLength(0);
  });
});
