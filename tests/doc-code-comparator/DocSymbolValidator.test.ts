import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DocSymbolValidator,
  type DocSymbolConfig,
} from '../../src/doc-code-comparator/DocSymbolValidator.js';

const CONFIG: DocSymbolConfig = {
  liveApiDocuments: ['docs/api.md'],
  excludedDocuments: ['docs/architecture/history.md'],
  ignoredSymbols: ['Promise'],
};

describe('DocSymbolValidator', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'doc-symbol-validator-'));
    write('tsconfig.json', JSON.stringify({ compilerOptions: {}, include: ['src/**/*.ts'] }));
    write(
      'src/index.ts',
      [
        'export class CurrentService {}',
        'export interface CurrentOptions { readonly enabled: boolean }',
        'export function createCurrentService(): CurrentService { return new CurrentService(); }',
      ].join('\n')
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('accepts exported symbols used by a live API document', () => {
    write(
      'docs/api.md',
      [
        '# API',
        '```ts',
        "import { CurrentService, type CurrentOptions } from 'ad-sdlc';",
        'const options: CurrentOptions = { enabled: true };',
        'const service = new CurrentService();',
        '```',
      ].join('\n')
    );

    const result = new DocSymbolValidator(root, CONFIG).validate();

    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.symbolsChecked).toBeGreaterThan(0);
  });

  it('rejects a deleted symbol referenced by a live API document', () => {
    write(
      'docs/api.md',
      [
        '# API',
        '```typescript',
        "import { DeletedService } from 'ad-sdlc';",
        'new DeletedService();',
        '```',
      ].join('\n')
    );

    const result = new DocSymbolValidator(root, CONFIG).validate();

    expect(result.pass).toBe(false);
    expect(result.violations.map((entry) => entry.symbol)).toContain('DeletedService');
  });

  it('honors an inline historical escape for a removed symbol', () => {
    write(
      'docs/api.md',
      [
        '# Migration note',
        '<!-- historical: DeletedService -->',
        '```ts',
        'new DeletedService();',
        '```',
      ].join('\n')
    );

    expect(new DocSymbolValidator(root, CONFIG).validate().pass).toBe(true);
  });

  it('does not scan an explicitly excluded history document', () => {
    write('docs/api.md', '# Current API\n');
    write('docs/architecture/history.md', '```ts\nnew DeletedService();\n```\n');

    const result = new DocSymbolValidator(root, CONFIG).validate();

    expect(result.pass).toBe(true);
    expect(result.documentsChecked).not.toContain('docs/architecture/history.md');
  });

  it('checks Decision sections of accepted ADRs but skips superseded ADRs', () => {
    write('docs/api.md', '# Current API\n');
    write(
      'docs/adr/ADR-0001-current.md',
      '# ADR-0001\n\n## Status\n\nAccepted\n\n## Decision\n\nUse `DeletedService`.\n'
    );
    write(
      'docs/adr/ADR-0002-old.md',
      '# ADR-0002\n\n## Status\n\nSuperseded\n\n## Decision\n\nUse `OtherDeletedService`.\n'
    );

    const result = new DocSymbolValidator(root, CONFIG).validate();

    expect(result.pass).toBe(false);
    expect(result.violations.map((entry) => entry.symbol)).toEqual(['DeletedService']);
    expect(result.documentsChecked).not.toContain('docs/adr/ADR-0002-old.md');
  });

  function write(relativePath: string, content: string): void {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, 'utf8');
  }
});
