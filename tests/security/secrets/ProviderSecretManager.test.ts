import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProviderSecretManager,
  getProviderSecretManager,
  resetProviderSecretManager,
  LocalProvider,
  SecretNotFoundInProvidersError,
} from '../../../src/security/secrets/index.js';
import type { ISecretProvider } from '../../../src/security/secrets/ISecretProvider.js';
import type { Secret } from '../../../src/security/secrets/types.js';

// Mock provider for testing
class MockProvider implements ISecretProvider {
  public readonly name: string;
  private readonly secrets: Map<string, Secret> = new Map();
  private _isReady = false;
  private _shouldFail = false;

  constructor(name: string) {
    this.name = name;
  }

  async initialize(): Promise<void> {
    if (this._shouldFail) {
      throw new Error('Mock initialization failure');
    }
    this._isReady = true;
  }

  async getSecret(name: string): Promise<Secret | null> {
    if (this._shouldFail) {
      throw new Error('Mock retrieval failure');
    }
    return this.secrets.get(name) ?? null;
  }

  async healthCheck(): Promise<boolean> {
    return this._isReady && !this._shouldFail;
  }

  async close(): Promise<void> {
    this._isReady = false;
  }

  isReady(): boolean {
    return this._isReady;
  }

  // Test helpers
  setSecret(name: string, value: string): void {
    this.secrets.set(name, { value });
  }

  setShouldFail(shouldFail: boolean): void {
    this._shouldFail = shouldFail;
  }
}

describe('ProviderSecretManager', () => {
  let manager: ProviderSecretManager;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    await resetProviderSecretManager();
    manager = new ProviderSecretManager({ envFallback: true });
  });

  afterEach(async () => {
    await manager.shutdown();
    process.env = { ...originalEnv };
  });

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    it('should create an instance with custom options', () => {
      const customManager = new ProviderSecretManager({ envFallback: false });
      expect(customManager.isInitialized()).toBe(false);
    });
  });

  describe('addProvider', () => {
    it('should add and initialize a provider', async () => {
      const mockProvider = new MockProvider('mock');
      await manager.addProvider(mockProvider);

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getProviderNames()).toContain('mock');
    });

    it('should add multiple providers', async () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      await manager.addProvider(provider1);
      await manager.addProvider(provider2);

      expect(manager.getProviderNames()).toEqual(['provider1', 'provider2']);
    });
  });

  describe('getSecret', () => {
    it('should get secret from first provider', async () => {
      const provider = new MockProvider('mock');
      provider.setSecret('api/key', 'secret-value');
      await manager.addProvider(provider);

      const value = await manager.getSecret('api/key');
      expect(value).toBe('secret-value');
    });

    it('should fall back to second provider', async () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');
      provider2.setSecret('api/key', 'from-provider2');

      await manager.addProvider(provider1);
      await manager.addProvider(provider2);

      const value = await manager.getSecret('api/key');
      expect(value).toBe('from-provider2');
    });

    it('should fall back to environment variable', async () => {
      const provider = new MockProvider('mock');
      await manager.addProvider(provider);

      process.env.API_KEY = 'from-env';

      const value = await manager.getSecret('api/key');
      expect(value).toBe('from-env');
    });

    it('should return null if not found anywhere', async () => {
      const provider = new MockProvider('mock');
      await manager.addProvider(provider);

      const value = await manager.getSecret('non/existent');
      expect(value).toBeNull();
    });

    it('should not fall back to env when envFallback is false', async () => {
      const noFallbackManager = new ProviderSecretManager({ envFallback: false });
      const provider = new MockProvider('mock');
      await noFallbackManager.addProvider(provider);

      process.env.API_KEY = 'from-env';

      const value = await noFallbackManager.getSecret('api/key');
      expect(value).toBeNull();

      await noFallbackManager.shutdown();
    });
  });

  describe('getSecretOrThrow', () => {
    it('should return value if found', async () => {
      const provider = new MockProvider('mock');
      provider.setSecret('api/key', 'secret-value');
      await manager.addProvider(provider);

      const value = await manager.getSecretOrThrow('api/key');
      expect(value).toBe('secret-value');
    });

    it('should throw SecretNotFoundInProvidersError if not found', async () => {
      const provider = new MockProvider('mock');
      await manager.addProvider(provider);

      await expect(manager.getSecretOrThrow('non/existent')).rejects.toThrow(
        SecretNotFoundInProvidersError
      );
    });
  });

  describe('getSecretWithMetadata', () => {
    it('should return secret with metadata', async () => {
      const provider = new MockProvider('mock');
      provider.setSecret('api/key', 'secret-value');
      await manager.addProvider(provider);

      const secret = await manager.getSecretWithMetadata('api/key');
      expect(secret).not.toBeNull();
      expect(secret?.value).toBe('secret-value');
    });

    it('should return env fallback with metadata', async () => {
      const provider = new MockProvider('mock');
      await manager.addProvider(provider);

      process.env.API_KEY = 'from-env';

      const secret = await manager.getSecretWithMetadata('api/key');
      expect(secret).not.toBeNull();
      expect(secret?.value).toBe('from-env');
      expect(secret?.metadata?.source).toBe('environment');
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after repeated failures', async () => {
      const provider = new MockProvider('failing');
      await manager.addProvider(provider);

      // Make provider fail
      provider.setShouldFail(true);

      // Trigger multiple failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await manager.getSecret('some/secret');
        } catch {
          // Expected failures
        }
      }

      // Check health - circuit should be open
      const health = await manager.getHealth();
      const failingProvider = health.providers.find((p) => p.name === 'failing');
      expect(failingProvider?.circuitBreaker.state).toBe('open');
    });

    it('should reset circuit breaker', async () => {
      const provider = new MockProvider('failing');
      await manager.addProvider(provider);

      // Trigger failures
      provider.setShouldFail(true);
      for (let i = 0; i < 5; i++) {
        try {
          await manager.getSecret('some/secret');
        } catch {
          // Expected
        }
      }

      // Reset circuit breaker
      manager.resetCircuitBreaker('failing');

      const health = await manager.getHealth();
      const failingProvider = health.providers.find((p) => p.name === 'failing');
      expect(failingProvider?.circuitBreaker.state).toBe('closed');
    });
  });

  describe('getHealth', () => {
    it('should return health status for all providers', async () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      await manager.addProvider(provider1);
      await manager.addProvider(provider2);

      const health = await manager.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.providers).toHaveLength(2);
      expect(health.providers[0].name).toBe('provider1');
      expect(health.providers[1].name).toBe('provider2');
    });

    it('should report unhealthy when all providers fail', async () => {
      const provider = new MockProvider('failing');
      await manager.addProvider(provider);
      provider.setShouldFail(true);

      const health = await manager.getHealth();
      expect(health.healthy).toBe(false);
    });
  });

  describe('mask', () => {
    it('should mask common secret patterns', () => {
      const text = 'API key: sk-1234567890abcdefghijklmnopqrstuv';
      const masked = manager.mask(text);
      expect(masked).toContain('[API_KEY_REDACTED]');
    });

    it('should mask GitHub tokens', () => {
      const text = 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = manager.mask(text);
      expect(masked).toContain('[GITHUB_TOKEN_REDACTED]');
    });
  });

  describe('shutdown', () => {
    it('should close all providers', async () => {
      const provider1 = new MockProvider('provider1');
      const provider2 = new MockProvider('provider2');

      await manager.addProvider(provider1);
      await manager.addProvider(provider2);

      await manager.shutdown();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getProviderNames()).toEqual([]);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', async () => {
      const instance1 = getProviderSecretManager();
      const instance2 = getProviderSecretManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', async () => {
      const instance1 = getProviderSecretManager();
      await resetProviderSecretManager();
      const instance2 = getProviderSecretManager();

      expect(instance1).not.toBe(instance2);
    });
  });
});
