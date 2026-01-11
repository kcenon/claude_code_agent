import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  BackendFactory,
  BackendCreationError,
} from '../../../src/scratchpad/backends/BackendFactory.js';
import { FileBackend } from '../../../src/scratchpad/backends/FileBackend.js';
import { SQLiteBackend } from '../../../src/scratchpad/backends/SQLiteBackend.js';
import { RedisBackend } from '../../../src/scratchpad/backends/RedisBackend.js';

describe('BackendFactory', () => {
  describe('create', () => {
    it('should create file backend by default', () => {
      const backend = BackendFactory.create();
      expect(backend).toBeInstanceOf(FileBackend);
      expect(backend.name).toBe('file');
    });

    it('should create file backend when specified', () => {
      const backend = BackendFactory.create({ backend: 'file' });
      expect(backend).toBeInstanceOf(FileBackend);
    });

    it('should create sqlite backend when specified', () => {
      const backend = BackendFactory.create({ backend: 'sqlite' });
      expect(backend).toBeInstanceOf(SQLiteBackend);
      expect(backend.name).toBe('sqlite');
    });

    it('should create redis backend when specified with config', () => {
      const backend = BackendFactory.create({
        backend: 'redis',
        redis: {
          host: 'localhost',
          port: 6379,
        },
      });
      expect(backend).toBeInstanceOf(RedisBackend);
      expect(backend.name).toBe('redis');
    });

    it('should throw error for redis without config', () => {
      expect(() => BackendFactory.create({ backend: 'redis' })).toThrow(
        BackendCreationError
      );
    });

    it('should throw error for unknown backend type', () => {
      expect(() =>
        BackendFactory.create({ backend: 'unknown' as 'file' })
      ).toThrow(BackendCreationError);
    });

    it('should pass file config to FileBackend', () => {
      const backend = BackendFactory.create({
        backend: 'file',
        file: {
          basePath: '/custom/path',
          format: 'json',
        },
      }) as FileBackend;

      expect(backend).toBeInstanceOf(FileBackend);
    });

    it('should pass sqlite config to SQLiteBackend', () => {
      const backend = BackendFactory.create({
        backend: 'sqlite',
        sqlite: {
          dbPath: '/custom/db.sqlite',
          walMode: false,
        },
      }) as SQLiteBackend;

      expect(backend).toBeInstanceOf(SQLiteBackend);
    });
  });

  describe('getDefaultType', () => {
    it('should return file as default', () => {
      expect(BackendFactory.getDefaultType()).toBe('file');
    });
  });

  describe('getSupportedTypes', () => {
    it('should return all supported types', () => {
      const types = BackendFactory.getSupportedTypes();
      expect(types).toContain('file');
      expect(types).toContain('sqlite');
      expect(types).toContain('redis');
      expect(types).toHaveLength(3);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported types', () => {
      expect(BackendFactory.isSupported('file')).toBe(true);
      expect(BackendFactory.isSupported('sqlite')).toBe(true);
      expect(BackendFactory.isSupported('redis')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(BackendFactory.isSupported('unknown')).toBe(false);
      expect(BackendFactory.isSupported('')).toBe(false);
    });
  });
});

describe('BackendCreationError', () => {
  it('should have correct properties', () => {
    const error = new BackendCreationError('redis', 'Config required');
    expect(error.name).toBe('BackendCreationError');
    expect(error.backendType).toBe('redis');
    expect(error.message).toContain('redis');
    expect(error.message).toContain('Config required');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Original error');
    const error = new BackendCreationError('sqlite', 'Init failed', cause);
    expect(error.cause).toBe(cause);
  });
});

describe('BackendFactory.createFromConfig', () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `factory-config-test-${Date.now()}`);
    configDir = join(testDir, '.ad-sdlc', 'config');
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    delete process.env['SCRATCHPAD_BACKEND'];
  });

  it('should create file backend when no config exists', async () => {
    const backend = await BackendFactory.createFromConfig(testDir);
    expect(backend).toBeInstanceOf(FileBackend);
  });

  it('should create sqlite backend from config file', async () => {
    await writeFile(
      join(configDir, 'workflow.yaml'),
      `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: sqlite
`
    );
    const backend = await BackendFactory.createFromConfig(testDir);
    expect(backend).toBeInstanceOf(SQLiteBackend);
  });

  it('should create file backend from config file', async () => {
    await writeFile(
      join(configDir, 'workflow.yaml'),
      `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: file
  file:
    format: json
`
    );
    const backend = await BackendFactory.createFromConfig(testDir);
    expect(backend).toBeInstanceOf(FileBackend);
  });

  it('should honor environment variable override', async () => {
    process.env['SCRATCHPAD_BACKEND'] = 'sqlite';
    await writeFile(
      join(configDir, 'workflow.yaml'),
      `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: file
`
    );
    const backend = await BackendFactory.createFromConfig(testDir);
    expect(backend).toBeInstanceOf(SQLiteBackend);
  });
});
