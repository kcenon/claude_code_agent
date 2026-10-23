/**
 * DocumentReaderAgent document loading: missing, oversized, and unreadable
 * documents (kcenon/claude_code_agent#973).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DocumentReaderAgent } from '../../src/document-reader/DocumentReaderAgent.js';
import { DocumentNotFoundError, FileSizeLimitError } from '../../src/document-reader/errors.js';

type DocumentParser = {
  parseDocument(
    filePath: string,
    type: 'prd' | 'srs' | 'sds'
  ): Promise<{ path: string; rawContent: string; lastModified: string }>;
};

const cannotRemovePermissions = process.platform === 'win32' || process.getuid?.() === 0;

describe('DocumentReaderAgent.parseDocument', () => {
  let dir: string;
  const agent = new DocumentReaderAgent({ maxFileSize: 64 }) as unknown as DocumentParser;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-document-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should return the content and modification time of the document', async () => {
    const file = path.join(dir, 'prd.md');
    fs.writeFileSync(file, '# PRD\n\n## Overview\n');

    const result = await agent.parseDocument(file, 'prd');

    expect(result).toMatchObject({
      path: file,
      rawContent: '# PRD\n\n## Overview\n',
      lastModified: fs.statSync(file).mtime.toISOString(),
    });
  });

  it.each([
    ['a missing document', (base: string) => path.join(base, 'missing.md')],
    ['a document below a regular file', (base: string) => path.join(base, 'plain.txt', 'x.md')],
  ])('should report %s as not found', async (_label, target) => {
    fs.writeFileSync(path.join(dir, 'plain.txt'), 'x');

    await expect(agent.parseDocument(target(dir), 'srs')).rejects.toThrow(DocumentNotFoundError);
  });

  it('should reject a document over the size limit', async () => {
    const file = path.join(dir, 'sds.md');
    fs.writeFileSync(file, 'x'.repeat(65));

    await expect(agent.parseDocument(file, 'sds')).rejects.toThrow(FileSizeLimitError);
  });

  it('should throw the read error for a directory', async () => {
    const directory = path.join(dir, 'folder.md');
    fs.mkdirSync(directory);
    // The default size limit: a directory reports 4096 bytes on ext4
    const unlimited = new DocumentReaderAgent() as unknown as DocumentParser;

    await expect(unlimited.parseDocument(directory, 'prd')).rejects.toMatchObject({
      code: 'EISDIR',
    });
  });

  it.skipIf(cannotRemovePermissions)(
    'should throw the read error for an unreadable document',
    async () => {
      const file = path.join(dir, 'prd.md');
      fs.writeFileSync(file, '# PRD');
      fs.chmodSync(file, 0o000);

      await expect(agent.parseDocument(file, 'prd')).rejects.toMatchObject({ code: 'EACCES' });
    }
  );
});
