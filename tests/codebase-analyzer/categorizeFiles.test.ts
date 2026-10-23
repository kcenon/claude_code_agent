/**
 * CodebaseAnalyzerAgent file categorization: size limit and files that
 * cannot be read (kcenon/claude_code_agent#973).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CodebaseAnalyzerAgent } from '../../src/codebase-analyzer/CodebaseAnalyzerAgent.js';

type FileCategorizer = {
  categorizeFiles(filePaths: string[], rootPath: string): Promise<unknown[]>;
};

const cannotRemovePermissions = process.platform === 'win32' || process.getuid?.() === 0;

describe('CodebaseAnalyzerAgent.categorizeFiles', () => {
  let root: string;
  const agent = new CodebaseAnalyzerAgent({ maxFileSize: 32 }) as unknown as FileCategorizer;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'categorize-files-'));
    fs.mkdirSync(path.join(root, 'src'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function file(name: string, content: string): string {
    const filePath = path.join(root, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('should describe readable files within the size limit', async () => {
    const source = file('src/app.ts', 'export const a = 1;\nexport {};\n');
    const spec = file('src/app.test.ts', 'it();');

    expect(await agent.categorizeFiles([source, spec], root)).toEqual([
      {
        path: path.join('src', 'app.ts'),
        extension: '.ts',
        size: 31,
        language: 'typescript',
        isTest: false,
        lineCount: 3,
      },
      {
        path: path.join('src', 'app.test.ts'),
        extension: '.ts',
        size: 5,
        language: 'typescript',
        isTest: true,
        lineCount: 1,
      },
    ]);
  });

  it('should skip files over the size limit, missing files, and directories', async () => {
    const large = file('src/large.ts', 'x'.repeat(33));
    const missing = path.join(root, 'src', 'missing.ts');
    const directory = path.join(root, 'src', 'folder.ts');
    fs.mkdirSync(directory);
    const kept = file('src/kept.py', 'pass');

    const result = await agent.categorizeFiles([large, missing, directory, kept], root);

    expect(result).toEqual([expect.objectContaining({ path: path.join('src', 'kept.py') })]);
  });

  it.skipIf(cannotRemovePermissions)('should skip unreadable files', async () => {
    const secret = file('src/secret.ts', 'const s = 1;');
    fs.chmodSync(secret, 0o000);

    expect(await agent.categorizeFiles([secret], root)).toEqual([]);
  });
});
