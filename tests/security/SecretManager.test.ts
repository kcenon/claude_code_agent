import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SecretManager,
  getSecretManager,
  resetSecretManager,
  SecretNotFoundError,
} from '../../src/security/index.js';

describe('SecretManager', () => {
  let secretManager: SecretManager;

  beforeEach(() => {
    // Reset global instance before each test
    resetSecretManager();
    secretManager = new SecretManager({ throwOnMissing: false });
  });

  afterEach(() => {
    secretManager.clear();
    resetSecretManager();
  });

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      const manager = new SecretManager({ throwOnMissing: false });
      expect(manager).toBeInstanceOf(SecretManager);
      expect(manager.isInitialized()).toBe(false);
    });

    it('should create an instance with custom options', () => {
      const manager = new SecretManager({
        requiredSecrets: ['CUSTOM_SECRET'],
        throwOnMissing: false,
      });
      expect(manager).toBeInstanceOf(SecretManager);
    });
  });

  describe('set and get', () => {
    it('should set and get a secret', () => {
      secretManager.set('TEST_SECRET', 'test-value');
      expect(secretManager.get('TEST_SECRET')).toBe('test-value');
    });

    it('should throw SecretNotFoundError for missing secret', () => {
      expect(() => secretManager.get('NON_EXISTENT')).toThrow(SecretNotFoundError);
    });

    it('should return default value with getOrDefault', () => {
      expect(secretManager.getOrDefault('NON_EXISTENT', 'default')).toBe('default');
    });

    it('should return actual value with getOrDefault when exists', () => {
      secretManager.set('TEST_SECRET', 'actual-value');
      expect(secretManager.getOrDefault('TEST_SECRET', 'default')).toBe('actual-value');
    });
  });

  describe('has', () => {
    it('should return true for existing secret', () => {
      secretManager.set('TEST_SECRET', 'value');
      expect(secretManager.has('TEST_SECRET')).toBe(true);
    });

    it('should return false for non-existing secret', () => {
      expect(secretManager.has('NON_EXISTENT')).toBe(false);
    });
  });

  describe('mask', () => {
    it('should mask secrets in text', () => {
      secretManager.set('API_KEY', 'sk-1234567890abcdef');
      const masked = secretManager.mask('Using key: sk-1234567890abcdef');
      expect(masked).toBe('Using key: [API_KEY_REDACTED]');
    });

    it('should not mask short values', () => {
      secretManager.set('SHORT', 'abc');
      const masked = secretManager.mask('Value: abc');
      expect(masked).toBe('Value: abc');
    });

    it('should mask multiple occurrences', () => {
      secretManager.set('TOKEN', 'secret-token-12345');
      const text = 'First: secret-token-12345, Second: secret-token-12345';
      const masked = secretManager.mask(text);
      expect(masked).toBe('First: [TOKEN_REDACTED], Second: [TOKEN_REDACTED]');
    });
  });

  describe('createSafeLogger', () => {
    it('should create a logger that masks secrets', () => {
      secretManager.set('PASSWORD', 'super-secret-password');
      const logs: string[] = [];
      const logger = (msg: string): void => {
        logs.push(msg);
      };

      const safeLogger = secretManager.createSafeLogger(logger);
      safeLogger('Password is: super-secret-password');

      expect(logs[0]).toBe('Password is: [PASSWORD_REDACTED]');
    });
  });

  describe('getAvailableKeys', () => {
    it('should return list of secret keys', () => {
      secretManager.set('KEY1', 'value1');
      secretManager.set('KEY2', 'value2');

      const keys = secretManager.getAvailableKeys();
      expect(keys).toContain('KEY1');
      expect(keys).toContain('KEY2');
    });
  });

  describe('clear', () => {
    it('should clear all secrets', () => {
      secretManager.set('KEY1', 'value1');
      secretManager.clear();

      expect(secretManager.has('KEY1')).toBe(false);
      expect(secretManager.isInitialized()).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getSecretManager({ throwOnMissing: false });
      const instance2 = getSecretManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton correctly', () => {
      const instance1 = getSecretManager({ throwOnMissing: false });
      resetSecretManager();
      const instance2 = getSecretManager({ throwOnMissing: false });

      expect(instance1).not.toBe(instance2);
    });
  });
});
