/**
 * BaseSecretProvider - Abstract base class for secret provider implementations
 *
 * Provides common functionality for caching, health tracking, and state management
 * that can be shared across all provider implementations.
 *
 * @module security/secrets
 */

import type { ISecretProvider } from './ISecretProvider.js';
import type {
  Secret,
  CachedSecret,
  ProviderState,
  ProviderHealth,
  BaseSecretProviderConfig,
} from './types.js';
import { ProviderInitializationError } from './errors.js';

/**
 * Default configuration values
 */
const DEFAULT_CACHE_TTL_MS = 300000; // 5 minutes

/**
 * Abstract base class for secret provider implementations
 *
 * Provides common functionality including:
 * - Secret caching with TTL
 * - Health tracking and monitoring
 * - State management
 *
 * Subclasses must implement:
 * - `doInitialize()`: Provider-specific initialization
 * - `doGetSecret()`: Actual secret retrieval logic
 * - `doHealthCheck()`: Provider-specific health check
 * - `doClose()`: Provider-specific cleanup
 *
 * @example
 * ```typescript
 * class LocalProvider extends BaseSecretProvider {
 *   constructor(config: LocalProviderConfig) {
 *     super('local', config);
 *   }
 *
 *   protected async doInitialize(): Promise<void> {
 *     // Load environment variables
 *   }
 *
 *   protected async doGetSecret(name: string): Promise<Secret | null> {
 *     const value = process.env[this.toEnvName(name)];
 *     return value ? { value } : null;
 *   }
 *
 *   protected async doHealthCheck(): Promise<boolean> {
 *     return true;
 *   }
 *
 *   protected async doClose(): Promise<void> {
 *     // Nothing to close
 *   }
 * }
 * ```
 */
export abstract class BaseSecretProvider implements ISecretProvider {
  /**
   * Provider name for identification
   */
  public readonly name: string;

  /**
   * Current provider state
   */
  protected state: ProviderState = 'uninitialized';

  /**
   * Cache for retrieved secrets
   */
  protected cache: Map<string, CachedSecret> = new Map();

  /**
   * Configuration values
   */
  protected readonly cacheTTL: number;
  protected readonly prefix?: string;

  /**
   * Health tracking
   */
  protected lastAccessTime?: Date;
  protected lastErrorTime?: Date;
  protected lastError?: string;
  protected failedAttempts = 0;
  protected totalRetrieved = 0;

  /**
   * Create a new BaseSecretProvider instance
   *
   * @param name - Provider name for identification
   * @param config - Provider configuration
   */
  constructor(name: string, config: BaseSecretProviderConfig = {}) {
    this.name = name;
    this.cacheTTL = config.cacheTTL ?? DEFAULT_CACHE_TTL_MS;
    this.prefix = config.prefix;
  }

  /**
   * Initialize the provider
   *
   * Calls provider-specific initialization.
   */
  public async initialize(): Promise<void> {
    if (this.state !== 'uninitialized') {
      throw new ProviderInitializationError(
        this.name,
        `Provider is already initialized (state: ${this.state})`
      );
    }

    this.state = 'initializing';

    try {
      await this.doInitialize();
      this.state = 'ready';
    } catch (error) {
      this.state = 'error';
      this.handleError('Initialization failed', error);
      throw new ProviderInitializationError(
        this.name,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get a secret by name
   *
   * Checks cache first, then retrieves from provider if not cached or expired.
   */
  public async getSecret(name: string, version?: string): Promise<Secret | null> {
    if (this.state !== 'ready') {
      throw new Error(`Provider ${this.name} is not ready (state: ${this.state})`);
    }

    const fullName = this.prefix ? `${this.prefix}/${name}` : name;
    const cacheKey = `${fullName}:${version ?? 'latest'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.secret;
    }

    try {
      const secret = await this.doGetSecret(fullName, version);

      if (secret !== null) {
        // Cache the secret
        this.cache.set(cacheKey, {
          secret,
          cachedAt: Date.now(),
          ttl: this.cacheTTL,
        });

        this.totalRetrieved++;
        this.lastAccessTime = new Date();
      }

      return secret;
    } catch (error) {
      this.failedAttempts++;
      this.handleError(`Failed to get secret: ${name}`, error);
      throw error;
    }
  }

  /**
   * Check if the provider is healthy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const healthy = await this.doHealthCheck();
      if (healthy) {
        this.state = 'ready';
      }
      return healthy;
    } catch (error) {
      this.handleError('Health check failed', error);
      return false;
    }
  }

  /**
   * Close the provider
   *
   * Clears cache and releases resources.
   */
  public async close(): Promise<void> {
    if (this.state === 'closed') {
      return;
    }

    try {
      await this.doClose();
    } finally {
      this.cache.clear();
      this.state = 'closed';
    }
  }

  /**
   * Get provider health status
   */
  public getHealth(): ProviderHealth {
    const health: ProviderHealth = {
      state: this.state,
      healthy: this.state === 'ready',
      cachedSecrets: this.cache.size,
      failedAttempts: this.failedAttempts,
      totalRetrieved: this.totalRetrieved,
    };

    // Add optional fields only if defined
    if (this.lastAccessTime !== undefined) {
      (health as { lastAccessTime: Date }).lastAccessTime = this.lastAccessTime;
    }
    if (this.lastErrorTime !== undefined) {
      (health as { lastErrorTime: Date }).lastErrorTime = this.lastErrorTime;
    }
    if (this.lastError !== undefined) {
      (health as { lastError: string }).lastError = this.lastError;
    }

    return health;
  }

  /**
   * Check if provider is ready
   */
  public isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Clear the provider's cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a cached secret is expired
   */
  protected isExpired(cached: CachedSecret): boolean {
    return Date.now() - cached.cachedAt > cached.ttl;
  }

  /**
   * Handle an error by tracking it
   */
  protected handleError(context: string, error: unknown): void {
    this.lastErrorTime = new Date();
    this.lastError = error instanceof Error ? error.message : String(error);
  }

  /**
   * Provider-specific initialization
   *
   * Override in subclass to perform provider-specific setup.
   */
  protected abstract doInitialize(): Promise<void>;

  /**
   * Provider-specific secret retrieval
   *
   * Override in subclass to retrieve secrets from the provider.
   *
   * @param name - Secret name (with prefix applied)
   * @param version - Optional version identifier
   * @returns The secret or null if not found
   */
  protected abstract doGetSecret(name: string, version?: string): Promise<Secret | null>;

  /**
   * Provider-specific health check
   *
   * Override in subclass to perform provider-specific health checks.
   */
  protected abstract doHealthCheck(): Promise<boolean>;

  /**
   * Provider-specific cleanup
   *
   * Override in subclass to release resources.
   */
  protected abstract doClose(): Promise<void>;
}
