/**
 * Tests for Scratchpad backend wiring via BackendFactory (#873)
 *
 * Verifies that:
 *  (a) When backend: 'sqlite' is configured, Scratchpad routes through SQLiteBackend.
 *  (b) When no backend (or backend: 'file') is configured, Scratchpad uses FileBackend
 *      and does not eagerly pull optional dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { Scratchpad, resetScratchpad } from '../../src/scratchpad/index.js';
import { BackendFactory } from '../../src/scratchpad/backends/BackendFactory.js';
import { FileBackend } from '../../src/scratchpad/backends/FileBackend.js';
import { SQLiteBackend } from '../../src/scratchpad/backends/SQLiteBackend.js';

describe('Scratchpad backend wiring (issue #873)', () => {
  let testBasePath: string;

  beforeEach(() => {
    resetScratchpad();
    testBasePath = path.join(os.tmpdir(), `scratchpad-wiring-test-${Date.now()}`);
  });

  afterEach(async () => {
    resetScratchpad();
    try {
      fs.rmSync(testBasePath, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('(a) SQLite backend wiring', () => {
    it('should use SQLiteBackend when backend: sqlite is configured', async () => {
      // Spy on BackendFactory.create to capture what backend type is created
      const createSpy = vi.spyOn(BackendFactory, 'create');

      const scratchpad = new Scratchpad({
        basePath: testBasePath,
        backend: 'sqlite',
        sqlite: {
          dbPath: path.join(testBasePath, 'test.db'),
        },
      });

      // Trigger lazy initialization
      const writeTarget = path.join(testBasePath, 'test.txt');
      await scratchpad.atomicWrite(writeTarget, 'hello');
      await scratchpad.cleanup();

      // BackendFactory.create must have been called with backend: 'sqlite'
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'sqlite' }));

      // The returned backend instance must be a SQLiteBackend
      const createdBackend = await createSpy.mock.results[0]?.value;
      expect(createdBackend).toBeInstanceOf(SQLiteBackend);

      createSpy.mockRestore();
    });

    it('should be able to write and read data through SQLite backend', async () => {
      const dbPath = path.join(testBasePath, 'sqlite-rw.db');
      const scratchpad = new Scratchpad({
        basePath: testBasePath,
        backend: 'sqlite',
        sqlite: { dbPath },
      });

      const filePath = path.join(testBasePath, 'data.json');
      const payload = { key: 'value', num: 42 };

      await scratchpad.writeJson(filePath, payload);
      const result = await scratchpad.readJson<typeof payload>(filePath);

      expect(result).toEqual(payload);

      await scratchpad.cleanup();
    });
  });

  describe('(b) Default file backend — no optional dep eager-load', () => {
    it('should use FileBackend when no backend option is provided', async () => {
      const createSpy = vi.spyOn(BackendFactory, 'create');

      const scratchpad = new Scratchpad({ basePath: testBasePath });

      const writeTarget = path.join(testBasePath, 'default.txt');
      await scratchpad.atomicWrite(writeTarget, 'default');
      await scratchpad.cleanup();

      // BackendFactory.create must have been called with backend: 'file'
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ backend: 'file' }));

      const createdBackend = await createSpy.mock.results[0]?.value;
      expect(createdBackend).toBeInstanceOf(FileBackend);

      createSpy.mockRestore();
    });

    it('should use FileBackend when backend: file is explicitly configured', async () => {
      const createSpy = vi.spyOn(BackendFactory, 'create');

      const scratchpad = new Scratchpad({
        basePath: testBasePath,
        backend: 'file',
      });

      const writeTarget = path.join(testBasePath, 'explicit-file.txt');
      await scratchpad.atomicWrite(writeTarget, 'explicit');
      await scratchpad.cleanup();

      const createdBackend = await createSpy.mock.results[0]?.value;
      expect(createdBackend).toBeInstanceOf(FileBackend);
      expect(createdBackend).not.toBeInstanceOf(SQLiteBackend);

      createSpy.mockRestore();
    });
  });
});
