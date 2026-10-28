/**
 * Selecting a scratchpad backend whose optional peer dependency is not
 * installed reports the install command (#959). The import of the optional
 * module is made to fail; the installed packages are not touched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-optional-'));
  vi.resetModules();
});
afterEach(() => {
  vi.doUnmock('ioredis');
  vi.doUnmock('better-sqlite3');
  vi.resetModules();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('selecting an optional backend whose dependency is missing', () => {
  it('Redis reports the install command, even with a connection fallback configured', async () => {
    vi.doMock('ioredis', () => {
      throw new Error("Cannot find package 'ioredis'");
    });
    const { RedisBackend } = await import('../../../src/scratchpad/backends/RedisBackend.js');
    const backend = new RedisBackend({
      host: 'localhost',
      port: 6379,
      fallback: { enabled: true, fileConfig: { basePath: path.join(dir, 'fallback') } },
    });

    await expect(backend.initialize()).rejects.toThrow(
      'ioredis is required for Redis scratchpad backend. Install: npm install ioredis'
    );
    expect(backend.isUsingFallback()).toBe(false);
  });

  it('SQLite selected through Scratchpad reports the install command on first use', async () => {
    vi.doMock('better-sqlite3', () => {
      throw new Error("Cannot find package 'better-sqlite3'");
    });
    const { Scratchpad } = await import('../../../src/scratchpad/Scratchpad.js');
    const scratchpad = new Scratchpad({
      basePath: dir,
      backend: 'sqlite',
      sqlite: { dbPath: path.join(dir, 'test.db') },
    });

    await expect(scratchpad.atomicWrite(path.join(dir, 'test.txt'), 'hello')).rejects.toThrow(
      'better-sqlite3 is required for SQLite scratchpad backend. Install: npm install better-sqlite3'
    );
  });
});
