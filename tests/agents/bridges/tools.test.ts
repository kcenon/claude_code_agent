import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  getToolDefinitions,
  executeTool,
  ALL_TOOL_DEFINITIONS,
} from '../../../src/agents/bridges/tools.js';

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tools-test-'));
  // Create a simple project structure
  await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const x = 1;\n');
  await fs.writeFile(
    path.join(tempDir, 'src', 'util.ts'),
    'export function add(a: number, b: number) { return a + b; }\n'
  );
  await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\n');
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// getToolDefinitions
// ---------------------------------------------------------------------------

describe('getToolDefinitions', () => {
  it('should return all tools when no filter is provided', () => {
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(ALL_TOOL_DEFINITIONS.length);
    expect(tools.map((t) => t.name)).toContain('read_file');
    expect(tools.map((t) => t.name)).toContain('write_file');
    expect(tools.map((t) => t.name)).toContain('list_files');
    expect(tools.map((t) => t.name)).toContain('search_code');
  });

  it('should filter tools by allowed names', () => {
    const tools = getToolDefinitions(['read_file', 'search_code']);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(['read_file', 'search_code']);
  });

  it('should return all tools when empty array is provided', () => {
    const tools = getToolDefinitions([]);
    expect(tools).toHaveLength(ALL_TOOL_DEFINITIONS.length);
  });
});

// ---------------------------------------------------------------------------
// executeTool - read_file
// ---------------------------------------------------------------------------

describe('executeTool - read_file', () => {
  it('should read file contents', async () => {
    const result = await executeTool('read_file', { path: 'README.md' }, tempDir);
    expect(result).toBe('# Test Project\n');
  });

  it('should throw on path traversal', async () => {
    await expect(
      executeTool('read_file', { path: '../../../etc/passwd' }, tempDir)
    ).rejects.toThrow('Path traversal detected');
  });

  it('should throw on missing file', async () => {
    await expect(executeTool('read_file', { path: 'nonexistent.txt' }, tempDir)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// executeTool - write_file
// ---------------------------------------------------------------------------

describe('executeTool - write_file', () => {
  it('should write file and create parent directories', async () => {
    const result = await executeTool(
      'write_file',
      { path: 'lib/output.ts', content: 'export const y = 2;\n' },
      tempDir
    );
    expect(result).toContain('File written');

    const written = await fs.readFile(path.join(tempDir, 'lib', 'output.ts'), 'utf-8');
    expect(written).toBe('export const y = 2;\n');
  });

  it('should reject path traversal on write', async () => {
    await expect(
      executeTool('write_file', { path: '../../evil.txt', content: 'bad' }, tempDir)
    ).rejects.toThrow('Path traversal detected');
  });
});

// ---------------------------------------------------------------------------
// executeTool - list_files
// ---------------------------------------------------------------------------

describe('executeTool - list_files', () => {
  it('should list files matching glob pattern', async () => {
    const result = await executeTool('list_files', { pattern: 'src/*.ts' }, tempDir);
    expect(result).toContain('src/index.ts');
    expect(result).toContain('src/util.ts');
  });

  it('should list all files with ** pattern', async () => {
    const result = await executeTool('list_files', { pattern: '**/*.ts' }, tempDir);
    expect(result).toContain('src/index.ts');
    expect(result).toContain('src/util.ts');
  });

  it('should return no-match message for unmatched pattern', async () => {
    const result = await executeTool('list_files', { pattern: '*.py' }, tempDir);
    expect(result).toBe('No files found matching pattern.');
  });
});

// ---------------------------------------------------------------------------
// executeTool - search_code
// ---------------------------------------------------------------------------

describe('executeTool - search_code', () => {
  it('should find matching lines', async () => {
    const result = await executeTool('search_code', { pattern: 'export' }, tempDir);
    expect(result).toContain('src/index.ts:1:');
    expect(result).toContain('src/util.ts:1:');
  });

  it('should filter by file glob', async () => {
    const result = await executeTool('search_code', { pattern: 'export', glob: '*.md' }, tempDir);
    expect(result).toBe('No matches found.');
  });

  it('should return no-match for absent pattern', async () => {
    const result = await executeTool('search_code', { pattern: 'nonexistent_xyz_123' }, tempDir);
    expect(result).toBe('No matches found.');
  });
});

// ---------------------------------------------------------------------------
// executeTool - unknown tool
// ---------------------------------------------------------------------------

describe('executeTool - unknown tool', () => {
  it('should throw for unknown tool name', async () => {
    await expect(executeTool('delete_file', {}, tempDir)).rejects.toThrow(
      'Unknown tool: delete_file'
    );
  });
});
