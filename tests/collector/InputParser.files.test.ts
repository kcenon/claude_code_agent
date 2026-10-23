/**
 * InputParser file reading: missing, unreadable, oversized, and non-regular
 * files (kcenon/claude_code_agent#973).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InputParser } from '../../src/collector/index.js';

const cannotRemovePermissions = process.platform === 'win32' || process.getuid?.() === 0;

describe('InputParser file reading', () => {
  let dir: string;
  const parser = new InputParser({ maxFileSize: 64 });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'input-parser-files-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const readers = [
    ['parseFileContent', (file: string, using = parser) => using.parseFileContent(file)],
    [
      'parseFileSync',
      async (file: string, using = parser) => Promise.resolve(using.parseFileSync(file)),
    ],
  ] as const;

  describe.each(readers)('%s', (_name, read) => {
    it('should return the content with the size and modification time of the file', async () => {
      const file = path.join(dir, 'notes.md');
      fs.writeFileSync(file, '# Notes\n');
      const stats = fs.statSync(file);

      const result = await read(file);

      expect(result).toEqual({
        success: true,
        content: '# Notes\n',
        fileType: 'md',
        metadata: { size: 8, modified: stats.mtime.toISOString() },
      });
    });

    it('should report a missing file', async () => {
      const result = await read(path.join(dir, 'missing.md'));

      expect(result).toEqual({
        success: false,
        content: '',
        fileType: 'md',
        error: 'File not found',
      });
    });

    it('should report a file over the size limit', async () => {
      const file = path.join(dir, 'large.txt');
      fs.writeFileSync(file, 'x'.repeat(65));

      const result = await read(file);

      expect(result).toEqual({
        success: false,
        content: '',
        fileType: 'txt',
        error: 'File size (65 bytes) exceeds maximum allowed (64 bytes)',
      });
    });

    it.skipIf(cannotRemovePermissions)('should report an unreadable file', async () => {
      const file = path.join(dir, 'secret.md');
      fs.writeFileSync(file, 'hidden');
      fs.chmodSync(file, 0o000);

      const result = await read(file);

      expect(result).toEqual({
        success: false,
        content: '',
        fileType: 'md',
        error: 'Permission denied',
      });
    });

    it('should throw for a directory', async () => {
      const directory = path.join(dir, 'folder.md');
      fs.mkdirSync(directory);

      // The default size limit: a directory reports 4096 bytes on ext4
      await expect(read(directory, new InputParser())).rejects.toMatchObject({ code: 'EISDIR' });
    });

    // Windows reports a path below a regular file as missing (ENOENT), not ENOTDIR
    it.skipIf(process.platform === 'win32')(
      'should throw for a path below a regular file',
      async () => {
        const file = path.join(dir, 'plain.txt');
        fs.writeFileSync(file, 'x');

        await expect(read(path.join(file, 'child.md'))).rejects.toMatchObject({
          code: 'ENOTDIR',
        });
      }
    );
  });

  describe('binary files', () => {
    it.each(['report.pdf', 'report.docx'])(
      'should check the size of %s before parsing it',
      async (name) => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, 'x'.repeat(65));

        const result = await parser.parseFileContent(file);

        expect(result.error).toBe('File size (65 bytes) exceeds maximum allowed (64 bytes)');
      }
    );

    it.each(['missing.pdf', 'missing.docx'])('should report a missing %s', async (name) => {
      const result = await parser.parseFileContent(path.join(dir, name));

      expect(result).toMatchObject({ success: false, error: 'File not found' });
    });
  });
});
