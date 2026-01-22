import { describe, it, expect } from 'vitest';
import {
  FixedBackoff,
  LinearBackoff,
  ExponentialBackoff,
  FibonacciBackoff,
  getBackoffStrategy,
  registerBackoffStrategy,
  getAvailableStrategies,
  createBackoffConfig,
  calculateBackoffDelay,
  applyJitter,
  capDelay,
  DEFAULT_BACKOFF_CONFIG,
  type BackoffConfig,
  type BackoffStrategy,
} from '../../src/error-handler/BackoffStrategies.js';

describe('BackoffStrategies', () => {
  describe('DEFAULT_BACKOFF_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_BACKOFF_CONFIG.baseDelayMs).toBe(1000);
      expect(DEFAULT_BACKOFF_CONFIG.maxDelayMs).toBe(60000);
      expect(DEFAULT_BACKOFF_CONFIG.multiplier).toBe(2);
      expect(DEFAULT_BACKOFF_CONFIG.jitterRatio).toBe(0);
    });
  });

  describe('applyJitter', () => {
    it('should return original delay when jitterRatio is 0', () => {
      expect(applyJitter(1000, 0)).toBe(1000);
    });

    it('should return original delay when jitterRatio is negative', () => {
      expect(applyJitter(1000, -0.1)).toBe(1000);
    });

    it('should return original delay when jitterRatio is > 1', () => {
      expect(applyJitter(1000, 1.5)).toBe(1000);
    });

    it('should apply jitter within expected range', () => {
      const delay = 1000;
      const jitterRatio = 0.2;
      const minExpected = delay - (delay * jitterRatio) / 2;
      const maxExpected = delay + (delay * jitterRatio) / 2;

      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        const result = applyJitter(delay, jitterRatio);
        expect(result).toBeGreaterThanOrEqual(minExpected);
        expect(result).toBeLessThanOrEqual(maxExpected);
      }
    });

    it('should not return negative values', () => {
      // Even with high jitter, should not go negative
      for (let i = 0; i < 100; i++) {
        const result = applyJitter(100, 1);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('capDelay', () => {
    it('should cap delay at maxDelayMs', () => {
      expect(capDelay(10000, 5000)).toBe(5000);
    });

    it('should return original delay if under cap', () => {
      expect(capDelay(3000, 5000)).toBe(3000);
    });

    it('should return 0 for negative delay', () => {
      expect(capDelay(-100, 5000)).toBe(0);
    });

    it('should return maxDelayMs when equal to cap', () => {
      expect(capDelay(5000, 5000)).toBe(5000);
    });
  });

  describe('FixedBackoff', () => {
    const strategy = new FixedBackoff();
    const config: BackoffConfig = {
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
      jitterRatio: 0,
    };

    it('should have correct name', () => {
      expect(strategy.name).toBe('fixed');
    });

    it('should return constant delay regardless of attempt', () => {
      expect(strategy.calculateDelay(1, config)).toBe(1000);
      expect(strategy.calculateDelay(2, config)).toBe(1000);
      expect(strategy.calculateDelay(3, config)).toBe(1000);
      expect(strategy.calculateDelay(10, config)).toBe(1000);
    });

    it('should respect maxDelayMs', () => {
      const smallMaxConfig: BackoffConfig = { ...config, maxDelayMs: 500 };
      expect(strategy.calculateDelay(1, smallMaxConfig)).toBe(500);
    });

    it('should apply jitter when configured', () => {
      const jitterConfig: BackoffConfig = { ...config, jitterRatio: 0.2 };
      const results = new Set<number>();
      for (let i = 0; i < 50; i++) {
        results.add(strategy.calculateDelay(1, jitterConfig));
      }
      // With jitter, we should see some variation
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('LinearBackoff', () => {
    const strategy = new LinearBackoff();
    const config: BackoffConfig = {
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
      jitterRatio: 0,
    };

    it('should have correct name', () => {
      expect(strategy.name).toBe('linear');
    });

    it('should increase delay linearly with attempt number', () => {
      expect(strategy.calculateDelay(1, config)).toBe(1000);
      expect(strategy.calculateDelay(2, config)).toBe(2000);
      expect(strategy.calculateDelay(3, config)).toBe(3000);
      expect(strategy.calculateDelay(4, config)).toBe(4000);
    });

    it('should respect maxDelayMs', () => {
      const smallMaxConfig: BackoffConfig = { ...config, maxDelayMs: 2500 };
      expect(strategy.calculateDelay(3, smallMaxConfig)).toBe(2500);
    });
  });

  describe('ExponentialBackoff', () => {
    const strategy = new ExponentialBackoff();
    const config: BackoffConfig = {
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
      jitterRatio: 0,
    };

    it('should have correct name', () => {
      expect(strategy.name).toBe('exponential');
    });

    it('should increase delay exponentially', () => {
      // baseDelay * multiplier^(attempt-1)
      expect(strategy.calculateDelay(1, config)).toBe(1000); // 1000 * 2^0
      expect(strategy.calculateDelay(2, config)).toBe(2000); // 1000 * 2^1
      expect(strategy.calculateDelay(3, config)).toBe(4000); // 1000 * 2^2
      expect(strategy.calculateDelay(4, config)).toBe(8000); // 1000 * 2^3
    });

    it('should respect maxDelayMs', () => {
      expect(strategy.calculateDelay(10, config)).toBe(60000); // Would be 512000, capped at 60000
    });

    it('should work with different multipliers', () => {
      const mult3Config: BackoffConfig = { ...config, multiplier: 3 };
      expect(strategy.calculateDelay(1, mult3Config)).toBe(1000);
      expect(strategy.calculateDelay(2, mult3Config)).toBe(3000);
      expect(strategy.calculateDelay(3, mult3Config)).toBe(9000);
    });
  });

  describe('FibonacciBackoff', () => {
    const strategy = new FibonacciBackoff();
    const config: BackoffConfig = {
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
      jitterRatio: 0,
    };

    it('should have correct name', () => {
      expect(strategy.name).toBe('fibonacci');
    });

    it('should follow fibonacci sequence', () => {
      // Fibonacci: 1, 1, 2, 3, 5, 8, 13, 21, ...
      expect(strategy.calculateDelay(1, config)).toBe(1000); // fib(1) = 1
      expect(strategy.calculateDelay(2, config)).toBe(1000); // fib(2) = 1
      expect(strategy.calculateDelay(3, config)).toBe(2000); // fib(3) = 2
      expect(strategy.calculateDelay(4, config)).toBe(3000); // fib(4) = 3
      expect(strategy.calculateDelay(5, config)).toBe(5000); // fib(5) = 5
      expect(strategy.calculateDelay(6, config)).toBe(8000); // fib(6) = 8
      expect(strategy.calculateDelay(7, config)).toBe(13000); // fib(7) = 13
    });

    it('should respect maxDelayMs', () => {
      const smallMaxConfig: BackoffConfig = { ...config, maxDelayMs: 4000 };
      expect(strategy.calculateDelay(5, smallMaxConfig)).toBe(4000); // Would be 5000
    });
  });

  describe('getBackoffStrategy', () => {
    it('should return fixed strategy', () => {
      const strategy = getBackoffStrategy('fixed');
      expect(strategy.name).toBe('fixed');
    });

    it('should return linear strategy', () => {
      const strategy = getBackoffStrategy('linear');
      expect(strategy.name).toBe('linear');
    });

    it('should return exponential strategy', () => {
      const strategy = getBackoffStrategy('exponential');
      expect(strategy.name).toBe('exponential');
    });

    it('should return fibonacci strategy', () => {
      const strategy = getBackoffStrategy('fibonacci');
      expect(strategy.name).toBe('fibonacci');
    });

    it('should throw for unknown strategy', () => {
      expect(() => getBackoffStrategy('unknown')).toThrow('Unknown backoff strategy: unknown');
    });
  });

  describe('registerBackoffStrategy', () => {
    it('should register a custom strategy', () => {
      const customStrategy: BackoffStrategy = {
        name: 'fixed',
        calculateDelay: () => 42,
      };

      registerBackoffStrategy('custom', customStrategy);
      const retrieved = getBackoffStrategy('custom');
      expect(retrieved.calculateDelay(1, DEFAULT_BACKOFF_CONFIG)).toBe(42);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should include all default strategies', () => {
      const strategies = getAvailableStrategies();
      expect(strategies).toContain('fixed');
      expect(strategies).toContain('linear');
      expect(strategies).toContain('exponential');
      expect(strategies).toContain('fibonacci');
    });
  });

  describe('createBackoffConfig', () => {
    it('should create config with defaults when no args', () => {
      const config = createBackoffConfig();
      expect(config.baseDelayMs).toBe(DEFAULT_BACKOFF_CONFIG.baseDelayMs);
      expect(config.maxDelayMs).toBe(DEFAULT_BACKOFF_CONFIG.maxDelayMs);
      expect(config.multiplier).toBe(DEFAULT_BACKOFF_CONFIG.multiplier);
      expect(config.jitterRatio).toBe(DEFAULT_BACKOFF_CONFIG.jitterRatio);
    });

    it('should override specific values', () => {
      const config = createBackoffConfig({ baseDelayMs: 500, jitterRatio: 0.3 });
      expect(config.baseDelayMs).toBe(500);
      expect(config.maxDelayMs).toBe(DEFAULT_BACKOFF_CONFIG.maxDelayMs);
      expect(config.jitterRatio).toBe(0.3);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate delay for fixed strategy', () => {
      const delay = calculateBackoffDelay('fixed', 5, { baseDelayMs: 1000 });
      expect(delay).toBe(1000);
    });

    it('should calculate delay for linear strategy', () => {
      const delay = calculateBackoffDelay('linear', 3, { baseDelayMs: 1000 });
      expect(delay).toBe(3000);
    });

    it('should calculate delay for exponential strategy', () => {
      const delay = calculateBackoffDelay('exponential', 3, {
        baseDelayMs: 1000,
        multiplier: 2,
      });
      expect(delay).toBe(4000);
    });

    it('should calculate delay for fibonacci strategy', () => {
      const delay = calculateBackoffDelay('fibonacci', 6, { baseDelayMs: 1000 });
      expect(delay).toBe(8000);
    });

    it('should return integer values', () => {
      const delay = calculateBackoffDelay('exponential', 2, {
        baseDelayMs: 1000,
        multiplier: 1.5,
      });
      expect(Number.isInteger(delay)).toBe(true);
    });
  });
});
