import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalProvider } from '../../../src/security/secrets/LocalProvider.js';

describe('LocalProvider', () => {
  let provider: LocalProvider;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    provider = new LocalProvider({ type: 'local' });
  });

  afterEach(async () => {
    await provider.close();
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      expect(provider.name).toBe('local');
    });

    it('should create an instance with env prefix', () => {
      const prefixedProvider = new LocalProvider({
        type: 'local',
        envPrefix: 'APP_',
      });
      expect(prefixedProvider.name).toBe('local');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await provider.initialize();
      expect(provider.isReady()).toBe(true);
    });

    it('should throw if already initialized', async () => {
      await provider.initialize();
      await expect(provider.initialize()).rejects.toThrow('already initialized');
    });
  });

  describe('getSecret', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should get secret from environment variable', async () => {
      process.env.TEST_SECRET = 'test-value';

      const secret = await provider.getSecret('test/secret');
      expect(secret).not.toBeNull();
      expect(secret?.value).toBe('test-value');
      expect(secret?.metadata?.source).toBe('environment');
    });

    it('should return null for non-existent secret', async () => {
      const secret = await provider.getSecret('non/existent');
      expect(secret).toBeNull();
    });

    it('should convert secret name to env var format', async () => {
      process.env.GITHUB_TOKEN = 'ghp_test123';

      const secret = await provider.getSecret('github/token');
      expect(secret?.value).toBe('ghp_test123');
    });

    it('should handle dots in secret name', async () => {
      process.env.API_KEY = 'api-key-value';

      const secret = await provider.getSecret('api.key');
      expect(secret?.value).toBe('api-key-value');
    });

    it('should handle dashes in secret name', async () => {
      process.env.DATABASE_PASSWORD = 'db-pass';

      const secret = await provider.getSecret('database-password');
      expect(secret?.value).toBe('db-pass');
    });
  });

  describe('getSecret with prefix', () => {
    let prefixedProvider: LocalProvider;

    beforeEach(async () => {
      prefixedProvider = new LocalProvider({
        type: 'local',
        envPrefix: 'APP_',
      });
      await prefixedProvider.initialize();
    });

    afterEach(async () => {
      await prefixedProvider.close();
    });

    it('should prepend env prefix to variable name', async () => {
      process.env.APP_DATABASE_URL = 'postgres://localhost';

      const secret = await prefixedProvider.getSecret('database/url');
      expect(secret?.value).toBe('postgres://localhost');
    });
  });

  describe('healthCheck', () => {
    it('should always return true', async () => {
      await provider.initialize();
      const healthy = await provider.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      await provider.initialize();
      const health = provider.getHealth();

      expect(health.state).toBe('ready');
      expect(health.healthy).toBe(true);
      expect(health.cachedSecrets).toBe(0);
    });
  });

  describe('caching', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should cache retrieved secrets', async () => {
      process.env.CACHED_SECRET = 'cached-value';

      // First retrieval
      const secret1 = await provider.getSecret('cached/secret');
      expect(secret1?.value).toBe('cached-value');

      // Change the env var
      process.env.CACHED_SECRET = 'new-value';

      // Second retrieval should return cached value
      const secret2 = await provider.getSecret('cached/secret');
      expect(secret2?.value).toBe('cached-value');
    });

    it('should clear cache', async () => {
      process.env.CACHED_SECRET = 'cached-value';

      await provider.getSecret('cached/secret');
      provider.clearCache();

      // Change the env var
      process.env.CACHED_SECRET = 'new-value';

      // Should get new value after cache clear
      const secret = await provider.getSecret('cached/secret');
      expect(secret?.value).toBe('new-value');
    });
  });

  describe('close', () => {
    it('should close successfully', async () => {
      await provider.initialize();
      await provider.close();

      const health = provider.getHealth();
      expect(health.state).toBe('closed');
    });
  });
});
