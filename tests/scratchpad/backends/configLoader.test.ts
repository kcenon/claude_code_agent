import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadScratchpadConfig,
  hasScratchpadConfig,
  getScratchpadEnvVars,
  resolveEnvVars,
} from '../../../src/scratchpad/backends/configLoader.js';

describe('configLoader', () => {
  let testDir: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `configLoader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    configDir = join(testDir, '.ad-sdlc', 'config');
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    // Clean up environment variables
    delete process.env['SCRATCHPAD_BACKEND'];
    delete process.env['SCRATCHPAD_REDIS_HOST'];
    delete process.env['SCRATCHPAD_REDIS_PORT'];
    delete process.env['SCRATCHPAD_REDIS_PASSWORD'];
    delete process.env['SCRATCHPAD_REDIS_DB'];
    delete process.env['SCRATCHPAD_SQLITE_PATH'];
    delete process.env['SCRATCHPAD_FILE_PATH'];
  });

  describe('resolveEnvVars', () => {
    it('should resolve simple environment variable', () => {
      process.env['TEST_VAR'] = 'test-value';
      expect(resolveEnvVars('${TEST_VAR}')).toBe('test-value');
      delete process.env['TEST_VAR'];
    });

    it('should resolve environment variable with default', () => {
      expect(resolveEnvVars('${NONEXISTENT:-default}')).toBe('default');
    });

    it('should keep original if no env var and no default', () => {
      expect(resolveEnvVars('${NONEXISTENT}')).toBe('${NONEXISTENT}');
    });

    it('should resolve multiple variables', () => {
      process.env['VAR1'] = 'one';
      process.env['VAR2'] = 'two';
      expect(resolveEnvVars('${VAR1}-${VAR2}')).toBe('one-two');
      delete process.env['VAR1'];
      delete process.env['VAR2'];
    });

    it('should prefer env var over default', () => {
      process.env['TEST_VAR'] = 'actual';
      expect(resolveEnvVars('${TEST_VAR:-default}')).toBe('actual');
      delete process.env['TEST_VAR'];
    });
  });

  describe('loadScratchpadConfig', () => {
    it('should return empty config when no workflow.yaml exists', async () => {
      const config = await loadScratchpadConfig(testDir);
      expect(config).toEqual({});
    });

    it('should return empty config when workflow.yaml has no scratchpad section', async () => {
      await writeFile(
        join(configDir, 'workflow.yaml'),
        `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config).toEqual({});
    });

    it('should load file backend config', async () => {
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
    base_path: /custom/path
    format: json
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.backend).toBe('file');
      expect(config.file?.basePath).toBe('/custom/path');
      expect(config.file?.format).toBe('json');
    });

    it('should load sqlite backend config', async () => {
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
  sqlite:
    db_path: /data/scratchpad.db
    wal_mode: true
    busy_timeout: 10000
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.backend).toBe('sqlite');
      expect(config.sqlite?.dbPath).toBe('/data/scratchpad.db');
      expect(config.sqlite?.walMode).toBe(true);
      expect(config.sqlite?.busyTimeout).toBe(10000);
    });

    it('should load redis backend config', async () => {
      await writeFile(
        join(configDir, 'workflow.yaml'),
        `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: redis
  redis:
    host: redis.example.com
    port: 6380
    password: secret
    db: 1
    prefix: "myapp:"
    ttl: 3600
    connect_timeout: 10000
    max_retries: 5
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.backend).toBe('redis');
      expect(config.redis?.host).toBe('redis.example.com');
      expect(config.redis?.port).toBe(6380);
      expect(config.redis?.password).toBe('secret');
      expect(config.redis?.db).toBe(1);
      expect(config.redis?.prefix).toBe('myapp:');
      expect(config.redis?.ttl).toBe(3600);
      expect(config.redis?.connectTimeout).toBe(10000);
      expect(config.redis?.maxRetries).toBe(5);
    });

    it('should load redis lock config', async () => {
      await writeFile(
        join(configDir, 'workflow.yaml'),
        `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: redis
  redis:
    host: localhost
    lock:
      lock_ttl: 60
      lock_timeout: 20000
      lock_retry_interval: 200
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.redis?.lock?.lockTtl).toBe(60);
      expect(config.redis?.lock?.lockTimeout).toBe(20000);
      expect(config.redis?.lock?.lockRetryInterval).toBe(200);
    });

    it('should load redis fallback config', async () => {
      await writeFile(
        join(configDir, 'workflow.yaml'),
        `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: redis
  redis:
    host: localhost
    fallback:
      enabled: true
      file_config:
        base_path: /fallback/path
        format: yaml
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.redis?.fallback?.enabled).toBe(true);
      expect(config.redis?.fallback?.fileConfig?.basePath).toBe('/fallback/path');
      expect(config.redis?.fallback?.fileConfig?.format).toBe('yaml');
    });

    it('should resolve environment variables in config values', async () => {
      process.env['DB_PATH'] = '/env/db/path';
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
  sqlite:
    db_path: \${DB_PATH}
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.sqlite?.dbPath).toBe('/env/db/path');
      delete process.env['DB_PATH'];
    });

    it('should apply environment variable overrides for backend type', async () => {
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
      const config = await loadScratchpadConfig(testDir);
      expect(config.backend).toBe('sqlite');
    });

    it('should apply redis environment variable overrides', async () => {
      process.env['SCRATCHPAD_REDIS_HOST'] = 'env-redis-host';
      process.env['SCRATCHPAD_REDIS_PORT'] = '16379';
      process.env['SCRATCHPAD_REDIS_PASSWORD'] = 'env-password';
      process.env['SCRATCHPAD_REDIS_DB'] = '5';

      await writeFile(
        join(configDir, 'workflow.yaml'),
        `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
scratchpad:
  backend: redis
  redis:
    host: original-host
    port: 6379
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.redis?.host).toBe('env-redis-host');
      expect(config.redis?.port).toBe(16379);
      expect(config.redis?.password).toBe('env-password');
      expect(config.redis?.db).toBe(5);
    });

    it('should apply sqlite environment variable overrides', async () => {
      process.env['SCRATCHPAD_SQLITE_PATH'] = '/env/sqlite/path.db';

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
  sqlite:
    db_path: /original/path.db
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.sqlite?.dbPath).toBe('/env/sqlite/path.db');
    });

    it('should apply file backend environment variable overrides', async () => {
      process.env['SCRATCHPAD_FILE_PATH'] = '/env/file/path';

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
    base_path: /original/path
`
      );
      const config = await loadScratchpadConfig(testDir);
      expect(config.file?.basePath).toBe('/env/file/path');
    });

    it('should create redis config from env vars even without yaml config', async () => {
      process.env['SCRATCHPAD_BACKEND'] = 'redis';
      process.env['SCRATCHPAD_REDIS_HOST'] = 'env-only-host';
      process.env['SCRATCHPAD_REDIS_PORT'] = '6380';

      const config = await loadScratchpadConfig(testDir);
      expect(config.backend).toBe('redis');
      expect(config.redis?.host).toBe('env-only-host');
      expect(config.redis?.port).toBe(6380);
    });
  });

  describe('hasScratchpadConfig', () => {
    it('should return false when no workflow.yaml exists', async () => {
      const result = await hasScratchpadConfig(testDir);
      expect(result).toBe(false);
    });

    it('should return false when workflow.yaml has no scratchpad section', async () => {
      await writeFile(
        join(configDir, 'workflow.yaml'),
        `
version: "1.0.0"
pipeline:
  stages:
    - name: test
      agent: test
`
      );
      const result = await hasScratchpadConfig(testDir);
      expect(result).toBe(false);
    });

    it('should return true when scratchpad config exists', async () => {
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
      const result = await hasScratchpadConfig(testDir);
      expect(result).toBe(true);
    });
  });

  describe('getScratchpadEnvVars', () => {
    it('should return all supported environment variables', () => {
      const envVars = getScratchpadEnvVars();
      expect(envVars).toHaveProperty('SCRATCHPAD_BACKEND');
      expect(envVars).toHaveProperty('SCRATCHPAD_REDIS_HOST');
      expect(envVars).toHaveProperty('SCRATCHPAD_REDIS_PORT');
      expect(envVars).toHaveProperty('SCRATCHPAD_REDIS_PASSWORD');
      expect(envVars).toHaveProperty('SCRATCHPAD_REDIS_DB');
      expect(envVars).toHaveProperty('SCRATCHPAD_SQLITE_PATH');
      expect(envVars).toHaveProperty('SCRATCHPAD_FILE_PATH');
    });
  });
});
