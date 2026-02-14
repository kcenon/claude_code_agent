/**
 * LocalProvider - Secret provider using environment variables
 *
 * This provider reads secrets from process.env, serving as the default
 * fallback provider for local development and testing.
 *
 * @module security/secrets
 */

import type { Secret, LocalProviderConfig } from './types.js';
import { BaseSecretProvider } from './BaseSecretProvider.js';

/**
 * Local provider that reads secrets from environment variables
 *
 * Features:
 * - Converts secret names to environment variable format
 * - Supports optional prefix filtering
 * - Always healthy (reads from process.env)
 *
 * @example
 * ```typescript
 * const provider = new LocalProvider({
 *   type: 'local',
 *   envPrefix: 'APP_',
 * });
 *
 * await provider.initialize();
 *
 * // Retrieves APP_GITHUB_TOKEN from environment
 * const secret = await provider.getSecret('github/token');
 * // Returns { value: process.env.APP_GITHUB_TOKEN } if set
 *
 * await provider.close();
 * ```
 */
export class LocalProvider extends BaseSecretProvider {
  private readonly envPrefix: string | undefined;

  /**
   * Create a new LocalProvider instance
   *
   * @param config - Provider configuration
   */
  constructor(config: LocalProviderConfig = { type: 'local' }) {
    super('local', config);
    this.envPrefix = config.envPrefix;
  }

  /**
   * Initialize the provider
   *
   * No initialization needed for local provider.
   *
   * @returns A resolved promise
   */
  protected doInitialize(): Promise<void> {
    // No initialization needed
    return Promise.resolve();
  }

  /**
   * Get a secret from environment variables
   *
   * Converts the secret name to environment variable format:
   * - `github/token` -> `GITHUB_TOKEN`
   * - `api.key` -> `API_KEY`
   * - `database-password` -> `DATABASE_PASSWORD`
   *
   * If envPrefix is configured, it's prepended to the variable name.
   *
   * @param name - The secret name to look up
   * @param _version - Unused version parameter
   * @returns The secret from environment or null if not found
   */
  protected doGetSecret(name: string, _version?: string): Promise<Secret | null> {
    const envName = this.toEnvName(name);
    const value = process.env[envName];

    if (value === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      value,
      metadata: {
        source: 'environment',
        envVar: envName,
      },
    });
  }

  /**
   * Health check always returns true for local provider
   *
   * @returns Always resolves to true
   */
  protected doHealthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /**
   * Close the provider
   *
   * No cleanup needed for local provider.
   *
   * @returns A resolved promise
   */
  protected doClose(): Promise<void> {
    // No cleanup needed
    return Promise.resolve();
  }

  /**
   * Convert a secret name to environment variable format
   *
   * @param name - Secret name (e.g., 'github/token', 'api.key')
   * @returns Environment variable name (e.g., 'GITHUB_TOKEN', 'API_KEY')
   */
  private toEnvName(name: string): string {
    // Replace common separators with underscore and convert to uppercase
    const baseName = name.replace(/[/.:@-]/g, '_').toUpperCase();

    // Add prefix if configured
    return this.envPrefix !== undefined ? `${this.envPrefix}${baseName}` : baseName;
  }
}
