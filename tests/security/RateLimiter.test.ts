import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RateLimiter,
  RateLimiters,
  RateLimitExceededError,
} from '../../src/security/index.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000,
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  describe('check', () => {
    it('should allow requests within limit', () => {
      for (let i = 0; i < 5; i++) {
        const status = limiter.check('test-key');
        expect(status.allowed).toBe(true);
        expect(status.remaining).toBe(4 - i);
      }
    });

    it('should block requests over limit', () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        limiter.check('test-key');
      }

      const status = limiter.check('test-key');
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });

    it('should track different keys separately', () => {
      // Exhaust key1
      for (let i = 0; i < 5; i++) {
        limiter.check('key1');
      }

      // key2 should still be available
      const status = limiter.check('key2');
      expect(status.allowed).toBe(true);
    });

    it('should include resetIn time', () => {
      const status = limiter.check('test-key');
      expect(status.resetIn).toBeGreaterThan(0);
      expect(status.resetIn).toBeLessThanOrEqual(1000);
    });
  });

  describe('checkOrThrow', () => {
    it('should not throw when allowed', () => {
      expect(() => limiter.checkOrThrow('test-key')).not.toThrow();
    });

    it('should throw RateLimitExceededError when blocked', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('test-key');
      }

      expect(() => limiter.checkOrThrow('test-key')).toThrow(RateLimitExceededError);
    });

    it('should include retryAfterMs in error', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('test-key');
      }

      try {
        limiter.checkOrThrow('test-key');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededError);
        expect((error as RateLimitExceededError).retryAfterMs).toBeGreaterThan(0);
      }
    });
  });

  describe('getStatus', () => {
    it('should return status without consuming a token', () => {
      const status1 = limiter.getStatus('test-key');
      expect(status1.remaining).toBe(5);

      const status2 = limiter.getStatus('test-key');
      expect(status2.remaining).toBe(5);
    });

    it('should reflect consumed tokens', () => {
      limiter.check('test-key');
      limiter.check('test-key');

      const status = limiter.getStatus('test-key');
      expect(status.remaining).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset limit for a key', () => {
      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        limiter.check('test-key');
      }

      limiter.reset('test-key');

      const status = limiter.check('test-key');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(4);
    });
  });

  describe('resetAll', () => {
    it('should reset all limits', () => {
      // Exhaust multiple keys
      for (let i = 0; i < 5; i++) {
        limiter.check('key1');
        limiter.check('key2');
      }

      limiter.resetAll();

      expect(limiter.check('key1').allowed).toBe(true);
      expect(limiter.check('key2').allowed).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return configuration', () => {
      const config = limiter.getConfig();
      expect(config.maxRequests).toBe(5);
      expect(config.windowMs).toBe(1000);
    });
  });

  describe('getTrackedCount', () => {
    it('should return number of tracked keys', () => {
      limiter.check('key1');
      limiter.check('key2');
      limiter.check('key3');

      expect(limiter.getTrackedCount()).toBe(3);
    });
  });

  describe('window expiration', () => {
    it('should reset after window expires', async () => {
      vi.useFakeTimers();

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        limiter.check('test-key');
      }

      expect(limiter.check('test-key').allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(1001);

      const status = limiter.check('test-key');
      expect(status.allowed).toBe(true);

      vi.useRealTimers();
    });
  });
});

describe('RateLimiters presets', () => {
  it('should create github rate limiter', () => {
    const limiter = RateLimiters.github();
    const config = limiter.getConfig();

    expect(config.maxRequests).toBe(5000);
    expect(config.windowMs).toBe(60 * 60 * 1000);

    limiter.stop();
  });

  it('should create claude rate limiter', () => {
    const limiter = RateLimiters.claude();
    const config = limiter.getConfig();

    expect(config.maxRequests).toBe(60);
    expect(config.windowMs).toBe(60 * 1000);

    limiter.stop();
  });

  it('should create strict rate limiter', () => {
    const limiter = RateLimiters.strict();
    const config = limiter.getConfig();

    expect(config.maxRequests).toBe(10);

    limiter.stop();
  });

  it('should create lenient rate limiter', () => {
    const limiter = RateLimiters.lenient();
    const config = limiter.getConfig();

    expect(config.maxRequests).toBe(1000);

    limiter.stop();
  });
});
