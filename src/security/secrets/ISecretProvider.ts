/**
 * ISecretProvider - Interface for secret provider implementations
 *
 * This interface defines the contract for all secret provider implementations
 * including Local (env vars), AWS Secrets Manager, HashiCorp Vault, and Azure Key Vault.
 *
 * @module security/secrets
 */

import type { Secret, ProviderHealth } from './types.js';

/**
 * Interface for secret provider implementations
 *
 * All provider implementations must implement this interface to enable
 * pluggable secret backends. Providers handle the retrieval of secrets
 * from their respective sources.
 *
 * @example
 * ```typescript
 * class LocalProvider implements ISecretProvider {
 *   readonly name = 'local';
 *
 *   async initialize(): Promise<void> {
 *     // Load environment variables
 *   }
 *
 *   async getSecret(name: string): Promise<Secret | null> {
 *     const envName = this.toEnvName(name);
 *     const value = process.env[envName];
 *     return value ? { value } : null;
 *   }
 *
 *   async healthCheck(): Promise<boolean> {
 *     return true;
 *   }
 *
 *   async close(): Promise<void> {
 *     // Nothing to close for local provider
 *   }
 * }
 * ```
 */
export interface ISecretProvider {
  /**
   * Unique name identifying this provider
   *
   * Used for logging, debugging, and configuration purposes.
   * Should be a short, descriptive name like 'local', 'aws-secrets-manager', 'vault', etc.
   */
  readonly name: string;

  /**
   * Initialize the provider connection
   *
   * Called once before any secrets are retrieved. Implementations should
   * establish connections, authenticate, and validate configuration.
   *
   * @throws SecretProviderError if initialization fails
   *
   * @example
   * ```typescript
   * async initialize(): Promise<void> {
   *   this.client = new SecretsManagerClient({ region: this.config.region });
   *   await this.healthCheck();
   * }
   * ```
   */
  initialize(): Promise<void>;

  /**
   * Retrieve a secret by name
   *
   * Returns the secret value with metadata, or null if not found.
   * Implementations should handle caching internally when appropriate.
   *
   * @param name - The secret name to retrieve
   * @param version - Optional version identifier (provider-specific)
   * @returns The secret with metadata, or null if not found
   * @throws SecretProviderError if retrieval fails (not for "not found")
   *
   * @example
   * ```typescript
   * async getSecret(name: string, version?: string): Promise<Secret | null> {
   *   const cached = this.cache.get(name);
   *   if (cached && !this.isExpired(cached)) {
   *     return cached.secret;
   *   }
   *
   *   const response = await this.client.getSecretValue({ SecretId: name });
   *   return { value: response.SecretString, version: response.VersionId };
   * }
   * ```
   */
  getSecret(name: string, version?: string): Promise<Secret | null>;

  /**
   * Check if the provider is healthy and can retrieve secrets
   *
   * Used for health monitoring and circuit breaker decisions.
   * Should be a lightweight check that verifies connectivity.
   *
   * @returns true if the provider is healthy
   *
   * @example
   * ```typescript
   * async healthCheck(): Promise<boolean> {
   *   try {
   *     await this.client.listSecrets({ MaxResults: 1 });
   *     return true;
   *   } catch {
   *     return false;
   *   }
   * }
   * ```
   */
  healthCheck(): Promise<boolean>;

  /**
   * Close the provider connection
   *
   * Called when the provider is no longer needed. Implementations should
   * clear caches, close connections, and release all resources.
   *
   * After close() is called, the provider should not be used again.
   *
   * @example
   * ```typescript
   * async close(): Promise<void> {
   *   this.cache.clear();
   *   await this.client.destroy();
   * }
   * ```
   */
  close(): Promise<void>;

  /**
   * Get the current health status of the provider
   *
   * Optional method for detailed health monitoring. Returns information
   * about the provider's current state, cache status, and error history.
   *
   * @returns Current provider health information
   *
   * @example
   * ```typescript
   * getHealth(): ProviderHealth {
   *   return {
   *     state: this.state,
   *     healthy: this.state === 'ready',
   *     cachedSecrets: this.cache.size,
   *     failedAttempts: this.failureCount,
   *     totalRetrieved: this.retrievedCount,
   *   };
   * }
   * ```
   */
  getHealth?(): ProviderHealth;

  /**
   * Check if the provider is ready to retrieve secrets
   *
   * Optional method for checking provider readiness.
   *
   * @returns true if the provider is ready to retrieve secrets
   */
  isReady?(): boolean;

  /**
   * Clear the provider's cache
   *
   * Optional method to force cache invalidation.
   * Useful when secrets have been rotated externally.
   */
  clearCache?(): void;
}
