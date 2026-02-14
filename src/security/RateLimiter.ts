/**
 * RateLimiter - API rate limiting
 *
 * Features:
 * - Token bucket algorithm
 * - Configurable limits per key
 * - Automatic cleanup of expired entries
 */

import type { RateLimitConfig, RateLimitStatus } from './types.js';
import { RateLimitExceededError } from './errors.js';

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

/**
 * Rate limit entry for a key
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Simple rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? DEFAULT_CONFIG.maxRequests,
      windowMs: config.windowMs ?? DEFAULT_CONFIG.windowMs,
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Clean up every window duration
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.config.windowMs);

    // Don't prevent process exit
    this.cleanupInterval.unref();
  }

  /**
   * Stop the cleanup interval
   */
  public stop(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expireThreshold = now - this.config.windowMs;

    for (const [key, entry] of this.entries) {
      if (entry.windowStart < expireThreshold) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Check if a request is allowed and consume a token
   *
   * @param key - The rate limit key (e.g., API key, IP address)
   * @returns Rate limit status
   */
  public check(key: string): RateLimitStatus {
    const now = Date.now();
    let entry = this.entries.get(key);

    // Create new entry if none exists or window has expired
    if (entry === undefined || now - entry.windowStart >= this.config.windowMs) {
      entry = { count: 0, windowStart: now };
      this.entries.set(key, entry);
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetIn = this.config.windowMs - (now - entry.windowStart);

    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn,
      };
    }

    // Consume a token
    entry.count++;

    return {
      allowed: true,
      remaining: remaining - 1,
      resetIn,
    };
  }

  /**
   * Check rate limit and throw if exceeded
   *
   * @param key - The rate limit key
   * @returns The rate limit status if within limits
   * @throws RateLimitExceededError if limit exceeded
   */
  public checkOrThrow(key: string): RateLimitStatus {
    const status = this.check(key);

    if (!status.allowed) {
      throw new RateLimitExceededError(status.resetIn);
    }

    return status;
  }

  /**
   * Get current status without consuming a token
   *
   * @param key - The rate limit key
   * @returns Current rate limit status
   */
  public getStatus(key: string): RateLimitStatus {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (entry === undefined || now - entry.windowStart >= this.config.windowMs) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetIn: 0,
      };
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetIn = this.config.windowMs - (now - entry.windowStart);

    return {
      allowed: remaining > 0,
      remaining,
      resetIn,
    };
  }

  /**
   * Reset the rate limit for a key
   *
   * @param key - The rate limit key to reset
   */
  public reset(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Reset all rate limits
   */
  public resetAll(): void {
    this.entries.clear();
  }

  /**
   * Get the configuration
   * @returns A copy of the current rate limit configuration
   */
  public getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Get the number of tracked keys
   * @returns The count of currently tracked rate limit keys
   */
  public getTrackedCount(): number {
    return this.entries.size;
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimiters = {
  /**
   * GitHub API rate limiter (5000 requests per hour for authenticated)
   * @returns A RateLimiter configured for GitHub API limits
   */
  github: (): RateLimiter =>
    new RateLimiter({
      maxRequests: 5000,
      windowMs: 60 * 60 * 1000, // 1 hour
    }),

  /**
   * Claude API rate limiter (moderate limit)
   * @returns A RateLimiter configured for Claude API limits
   */
  claude: (): RateLimiter =>
    new RateLimiter({
      maxRequests: 60,
      windowMs: 60 * 1000, // 1 minute
    }),

  /**
   * Strict rate limiter for sensitive operations
   * @returns A RateLimiter with low request limits
   */
  strict: (): RateLimiter =>
    new RateLimiter({
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
    }),

  /**
   * Lenient rate limiter for less sensitive operations
   * @returns A RateLimiter with high request limits
   */
  lenient: (): RateLimiter =>
    new RateLimiter({
      maxRequests: 1000,
      windowMs: 60 * 1000, // 1 minute
    }),
};
