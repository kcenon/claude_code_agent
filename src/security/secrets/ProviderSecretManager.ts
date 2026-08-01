/**
 * ProviderSecretManager - Orchestrates multiple secret providers
 *
 * This manager coordinates multiple secret providers with fallback logic,
 * circuit breaker pattern, and environment variable fallback support.
 *
 * @module security/secrets
 */

import type { ISecretProvider } from './ISecretProvider.js';
import type { Secret, SecretManagerConfig, CircuitBreakerStatus } from './types.js';
import { CircuitBreaker } from '../../error-handler/CircuitBreaker.js';
import { CircuitOpenError } from '../../error-handler/errors.js';
import { SecretNotFoundInProvidersError, AllProvidersFailedError } from './errors.js';

/**
 * Default circuit breaker configuration
 */
const PROVIDER_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  successThreshold: 3,
} as const;

/**
 * ProviderSecretManager orchestrates multiple secret providers
 *
 * Features:
 * - Multiple providers with priority ordering
 * - Fallback logic (try each provider in order)
 * - Circuit breaker for provider failures
 * - Environment variable fallback option
 * - Secret masking for logs
 *
 * @example
 * ```typescript
 * const manager = new ProviderSecretManager({ envFallback: true });
 *
 * // Add providers in priority order
 * await manager.addProvider(awsProvider);
 * await manager.addProvider(localProvider);
 *
 * // Retrieve secrets
 * const apiKey = await manager.getSecretOrThrow('api/key');
 *
 * // Check health
 * const health = await manager.getHealth();
 *
 * // Shutdown when done
 * await manager.shutdown();
 * ```
 */
export class ProviderSecretManager {
  private readonly providers: ISecretProvider[] = [];
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly envFallback: boolean;
  private initialized = false;

  /**
   * Create a new ProviderSecretManager instance
   *
   * @param config - Manager configuration
   */
  constructor(config: SecretManagerConfig = {}) {
    this.envFallback = config.envFallback ?? true;
  }

  /**
   * Add a provider to the manager
   *
   * Providers are tried in the order they are added.
   * The provider will be initialized if not already initialized.
   *
   * @param provider - The provider to add
   */
  public async addProvider(provider: ISecretProvider): Promise<void> {
    // Initialize if not ready
    if (provider.isReady === undefined || !provider.isReady()) {
      await provider.initialize();
    }

    this.providers.push(provider);

    // Initialize circuit breaker for this provider
    this.circuitBreakers.set(
      provider.name,
      new CircuitBreaker({ ...PROVIDER_CIRCUIT_BREAKER_CONFIG, name: `secret:${provider.name}` })
    );

    this.initialized = true;
  }

  /**
   * Get a secret by name
   *
   * Tries each provider in order until one succeeds.
   * If all providers fail and envFallback is enabled, tries environment variables.
   *
   * @param name - The secret name to retrieve
   * @returns The secret value, or null if not found
   */
  public async getSecret(name: string): Promise<string | null> {
    const errors: Array<{ provider: string; error: string }> = [];
    const triedProviders: string[] = [];

    // Try each provider in order
    for (const provider of this.providers) {
      const circuitBreaker = this.circuitBreakers.get(provider.name);

      // Skip if circuit breaker is open
      if (circuitBreaker !== undefined && !this.prepareCircuit(circuitBreaker)) {
        continue;
      }

      triedProviders.push(provider.name);

      try {
        const secret = await provider.getSecret(name);

        if (secret !== null) {
          this.recordSuccess(provider.name);
          return secret.value;
        }

        circuitBreaker?.releaseAttempt();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ provider: provider.name, error: errorMessage });
        this.recordFailure(
          provider.name,
          error instanceof Error ? error : new Error(String(error))
        );
        // Continue to next provider
      }
    }

    // Fallback to environment variable
    if (this.envFallback) {
      const envName = this.toEnvName(name);
      const value = process.env[envName];
      if (value !== undefined) {
        return value;
      }
    }

    // If we tried providers and all failed with errors, throw AllProvidersFailedError
    if (errors.length > 0) {
      throw new AllProvidersFailedError(name, errors);
    }

    // Secret simply wasn't found in any provider
    return null;
  }

  /**
   * Get a secret by name, throwing if not found
   *
   * @param name - The secret name to retrieve
   * @returns The secret value
   * @throws SecretNotFoundInProvidersError if not found
   */
  public async getSecretOrThrow(name: string): Promise<string> {
    const value = await this.getSecret(name);

    if (value === null) {
      const triedProviders = this.providers
        .filter((p) => this.isProviderAvailable(p.name))
        .map((p) => p.name);

      if (this.envFallback) {
        triedProviders.push('environment');
      }

      throw new SecretNotFoundInProvidersError(name, triedProviders);
    }

    return value;
  }

  /**
   * Get a secret with full metadata
   *
   * Returns the first successful result with full Secret object.
   *
   * @param name - The secret name to retrieve
   * @returns The secret with metadata, or null if not found
   */
  public async getSecretWithMetadata(name: string): Promise<Secret | null> {
    for (const provider of this.providers) {
      const circuitBreaker = this.circuitBreakers.get(provider.name);

      if (circuitBreaker !== undefined && !this.prepareCircuit(circuitBreaker)) {
        continue;
      }

      try {
        const secret = await provider.getSecret(name);

        if (secret !== null) {
          this.recordSuccess(provider.name);
          return secret;
        }

        circuitBreaker?.releaseAttempt();
      } catch (error) {
        this.recordFailure(
          provider.name,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    // Fallback to environment variable
    if (this.envFallback) {
      const envName = this.toEnvName(name);
      const value = process.env[envName];
      if (value !== undefined) {
        return {
          value,
          metadata: {
            source: 'environment',
            envVar: envName,
          },
        };
      }
    }

    return null;
  }

  /**
   * Mask all known secrets in a text string
   *
   * Note: This only works if secrets have been previously retrieved
   * and cached by the providers.
   *
   * @param text - The text to mask
   * @returns The text with secrets replaced by [REDACTED]
   */
  public mask(text: string): string {
    // This is a simplified implementation
    // In a real implementation, we would track all retrieved secrets
    // For now, just mask common secret patterns
    return text
      .replace(/sk-[a-zA-Z0-9]{32,}/g, '[API_KEY_REDACTED]')
      .replace(/ghp_[a-zA-Z0-9]{36}/g, '[GITHUB_TOKEN_REDACTED]')
      .replace(/xox[baprs]-[a-zA-Z0-9-]+/g, '[SLACK_TOKEN_REDACTED]');
  }

  /**
   * Get health status of all providers
   *
   * @returns An object containing overall health and per-provider status
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    providers: Array<{
      name: string;
      healthy: boolean;
      circuitBreaker: CircuitBreakerStatus;
    }>;
  }> {
    const providerHealth: Array<{
      name: string;
      healthy: boolean;
      circuitBreaker: CircuitBreakerStatus;
    }> = [];

    for (const provider of this.providers) {
      const healthy = await provider.healthCheck();
      const cb = this.circuitBreakers.get(provider.name);

      const circuitBreakerStatus: CircuitBreakerStatus =
        cb?.getStatus() ?? new CircuitBreaker().getStatus();

      providerHealth.push({
        name: provider.name,
        healthy,
        circuitBreaker: circuitBreakerStatus,
      });
    }

    return {
      healthy: providerHealth.some((p) => p.healthy),
      providers: providerHealth,
    };
  }

  /**
   * Get list of provider names
   *
   * @returns An array of registered provider names
   */
  public getProviderNames(): string[] {
    return this.providers.map((p) => p.name);
  }

  /**
   * Check if the manager has been initialized with at least one provider
   *
   * @returns True if at least one provider has been added
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown all providers
   */
  public async shutdown(): Promise<void> {
    await Promise.all(this.providers.map((p) => p.close()));
    this.providers.length = 0;
    this.circuitBreakers.clear();
    this.initialized = false;
  }

  /**
   * Reset circuit breaker for a specific provider
   * @param providerName - The name of the provider to reset
   */
  public resetCircuitBreaker(providerName: string): void {
    const cb = this.circuitBreakers.get(providerName);
    if (cb !== undefined) {
      cb.reset();
    }
  }

  /**
   * Convert a secret name to environment variable format
   *
   * @returns The environment variable name
   * @param name - The secret name to convert
   */
  private toEnvName(name: string): string {
    return name.replace(/[/.:@-]/g, '_').toUpperCase();
  }

  /**
   * Check if a provider is available (circuit breaker not open)
   *
   * @returns True if the provider circuit breaker allows requests
   * @param providerName - The name of the provider to check
   */
  private isProviderAvailable(providerName: string): boolean {
    const cb = this.circuitBreakers.get(providerName);
    return cb === undefined || cb.isAcceptingRequests();
  }

  /**
   * Reserve a request with the canonical circuit breaker
   *
   * @returns True if the circuit is closed or eligible for half-open retry
   * @param cb - The circuit breaker instance to prepare
   */
  private prepareCircuit(cb: CircuitBreaker): boolean {
    try {
      cb.prepareForAttempt();
      return true;
    } catch (error) {
      if (error instanceof CircuitOpenError) return false;
      throw error;
    }
  }

  /**
   * Record a successful request for circuit breaker
   * @param providerName - The name of the provider that succeeded
   */
  private recordSuccess(providerName: string): void {
    const cb = this.circuitBreakers.get(providerName);
    if (cb === undefined) return;

    cb.recordSuccess();
  }

  /**
   * Record a failed request for circuit breaker
   * @param providerName - The name of the provider that failed
   * @param error - Failure reported by the provider
   */
  private recordFailure(providerName: string, error: Error): void {
    const cb = this.circuitBreakers.get(providerName);
    if (cb === undefined) return;

    cb.recordFailure(error);
  }
}

/**
 * Singleton instance for global access
 */
let globalProviderSecretManager: ProviderSecretManager | null = null;

/**
 * Get or create the global ProviderSecretManager instance
 *
 * @param config - Options for creating new instance
 * @returns The global ProviderSecretManager instance
 */
export function getProviderSecretManager(config?: SecretManagerConfig): ProviderSecretManager {
  if (globalProviderSecretManager === null) {
    globalProviderSecretManager = new ProviderSecretManager(config);
  }
  return globalProviderSecretManager;
}

/**
 * Reset the global ProviderSecretManager instance (for testing)
 */
export async function resetProviderSecretManager(): Promise<void> {
  if (globalProviderSecretManager !== null) {
    await globalProviderSecretManager.shutdown();
    globalProviderSecretManager = null;
  }
}
