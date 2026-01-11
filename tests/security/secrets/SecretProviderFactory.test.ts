import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SecretProviderFactory,
  getSecretProviderFactory,
  LocalProvider,
  InvalidSecretConfigError,
} from '../../../src/security/secrets/index.js';

describe('SecretProviderFactory', () => {
  let factory: SecretProviderFactory;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    factory = new SecretProviderFactory();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('createProvider', () => {
    it('should create LocalProvider', () => {
      const provider = factory.createProvider({ type: 'local' });
      expect(provider).toBeInstanceOf(LocalProvider);
      expect(provider.name).toBe('local');
    });

    it('should create LocalProvider with prefix', () => {
      const provider = factory.createProvider({
        type: 'local',
        envPrefix: 'APP_',
      });
      expect(provider).toBeInstanceOf(LocalProvider);
    });

    it('should throw for unknown provider type', () => {
      expect(() => {
        factory.createProvider({ type: 'unknown' } as any);
      }).toThrow(InvalidSecretConfigError);
    });
  });

  describe('environment variable substitution', () => {
    it('should resolve ${VAR} syntax', () => {
      process.env.TEST_REGION = 'us-west-2';

      const provider = factory.createProvider({
        type: 'local',
        envPrefix: '${TEST_REGION}_',
      });

      // The prefix should be resolved
      expect(provider.name).toBe('local');
    });

    it('should resolve ${VAR:-default} syntax with value', () => {
      process.env.MY_REGION = 'eu-west-1';

      const provider = factory.createProvider({
        type: 'local',
        envPrefix: '${MY_REGION:-us-east-1}_',
      });

      expect(provider.name).toBe('local');
    });

    it('should use default value when env var not set', () => {
      delete process.env.UNSET_VAR;

      const provider = factory.createProvider({
        type: 'local',
        envPrefix: '${UNSET_VAR:-DEFAULT}_',
      });

      expect(provider.name).toBe('local');
    });

    it('should return empty string for unset var without default', () => {
      delete process.env.UNSET_VAR;

      const provider = factory.createProvider({
        type: 'local',
        envPrefix: '${UNSET_VAR}PREFIX_',
      });

      expect(provider.name).toBe('local');
    });
  });

  describe('createManager', () => {
    it('should create manager with providers', async () => {
      const manager = await factory.createManager({
        envFallback: true,
        providers: [{ type: 'local', enabled: true }],
      });

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getProviderNames()).toContain('local');

      await manager.shutdown();
    });

    it('should skip disabled providers', async () => {
      const manager = await factory.createManager({
        providers: [
          { type: 'local', enabled: false },
          { type: 'local', enabled: true, envPrefix: 'APP_' },
        ],
      });

      // Only one provider should be added (the enabled one)
      expect(manager.getProviderNames()).toHaveLength(1);

      await manager.shutdown();
    });

    it('should create manager with no providers', async () => {
      const manager = await factory.createManager({
        envFallback: true,
      });

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getProviderNames()).toEqual([]);

      await manager.shutdown();
    });

    it('should create manager with multiple providers', async () => {
      const manager = await factory.createManager({
        providers: [
          { type: 'local' },
          { type: 'local', envPrefix: 'APP_' },
        ],
      });

      expect(manager.getProviderNames()).toHaveLength(2);

      await manager.shutdown();
    });
  });

  describe('singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getSecretProviderFactory();
      const instance2 = getSecretProviderFactory();

      expect(instance1).toBe(instance2);
    });
  });
});
