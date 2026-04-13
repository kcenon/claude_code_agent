import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LinkCheck } from '../../src/doc-audit/checks/LinkCheck.js';
import type { LoadedDocument } from '../../src/doc-audit/types.js';

describe('LinkCheck', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'doc-audit-link-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeDoc(name: string, content: string): LoadedDocument {
    const absolutePath = join(tmpDir, name);
    mkdirSync(join(absolutePath, '..'), { recursive: true });
    writeFileSync(absolutePath, content, 'utf-8');
    return {
      relativePath: name,
      absolutePath,
      kind: 'SDS',
      content,
      lines: content.split('\n'),
    };
  }

  it('reports broken relative links', () => {
    const doc = writeDoc('sds.md', 'See [spec](./missing.md) for details.');
    const findings = new LinkCheck().run([doc]).findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]?.id).toBe('link.broken');
  });

  it('accepts links that resolve on disk', () => {
    writeFileSync(join(tmpDir, 'target.md'), '# target');
    const doc = writeDoc('sds.md', 'See [target](./target.md).');
    expect(new LinkCheck().run([doc]).findings).toHaveLength(0);
  });

  it('ignores external links, anchors and template variables', () => {
    const doc = writeDoc(
      'sds.md',
      [
        '[external](https://example.com)',
        '[anchor](#section)',
        '[mailto](mailto:a@example.com)',
        '[templated](./{var}/file.md)',
      ].join('\n')
    );
    expect(new LinkCheck().run([doc]).findings).toHaveLength(0);
  });

  it('strips anchor fragments when resolving paths', () => {
    writeFileSync(join(tmpDir, 'target.md'), '# target');
    const doc = writeDoc('sds.md', '[t](./target.md#section)');
    expect(new LinkCheck().run([doc]).findings).toHaveLength(0);
  });
});
