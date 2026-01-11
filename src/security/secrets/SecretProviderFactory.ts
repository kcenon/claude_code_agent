/**
 * SecretProviderFactory - Creates secret providers from configuration
 *
 * This factory creates appropriate secret provider instances based on
 * configuration settings, with support for environment variable substitution.
 *
 * @module security/secrets
 */

import type { ISecretProvider } from './ISecretProvider.js';
import type {
  SecretProviderConfig,
  LocalProviderConfig,
  AWSSecretsManagerConfig,
  VaultProviderConfig,
  AzureKeyVaultConfig,
  SecretManagerConfig,
} from './types.js';
import { LocalProvider } from './LocalProvider.js';
import { AWSSecretsManagerProvider } from './AWSSecretsManagerProvider.js';
import { VaultProvider } from './VaultProvider.js';
import { AzureKeyVaultProvider } from './AzureKeyVaultProvider.js';
import { ProviderSecretManager } from './ProviderSecretManager.js';
import { InvalidSecretConfigError } from './errors.js';

/**
 * Environment variable substitution pattern
 * Matches ${VAR_NAME} or ${VAR_NAME:-default_value}
 */
const ENV_VAR_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}/gi;

/**
 * Factory for creating secret providers from configuration
 *
 * @example
 * ```typescript
 * const factory = new SecretProviderFactory();
 *
 * // Create a single provider
 * const provider = factory.createProvider({
 *   type: 'aws-secrets-manager',
 *   region: '${AWS_REGION:-us-east-1}',
 * });
 *
 * // Create manager with all configured providers
 * const manager = await factory.createManager({
 *   envFallback: true,
 *   providers: [
 *     { type: 'aws-secrets-manager', region: 'us-east-1' },
 *     { type: 'local' },
 *   ],
 * });
 * ```
 */
export class SecretProviderFactory {
  /**
   * Create a provider from configuration
   *
   * @param config - Provider configuration
   * @returns The created provider (not initialized)
   */
  public createProvider(config: SecretProviderConfig): ISecretProvider {
    // Resolve environment variables in config
    const resolvedConfig = this.resolveEnvVars(config);

    switch (resolvedConfig.type) {
      case 'local':
        return new LocalProvider(resolvedConfig as LocalProviderConfig);

      case 'aws-secrets-manager':
        return new AWSSecretsManagerProvider(resolvedConfig as AWSSecretsManagerConfig);

      case 'vault':
        return new VaultProvider(resolvedConfig as VaultProviderConfig);

      case 'azure-keyvault':
        return new AzureKeyVaultProvider(resolvedConfig as AzureKeyVaultConfig);

      default: {
        const unknownConfig = resolvedConfig as { type: string };
        throw new InvalidSecretConfigError(`Unknown provider type: ${unknownConfig.type}`);
      }
    }
  }

  /**
   * Create a ProviderSecretManager with configured providers
   *
   * @param config - Manager configuration
   * @returns Initialized ProviderSecretManager
   */
  public async createManager(config: SecretManagerConfig): Promise<ProviderSecretManager> {
    const manager = new ProviderSecretManager(config);

    // Add configured providers
    if (config.providers !== undefined) {
      for (const providerConfig of config.providers) {
        // Skip disabled providers
        if (providerConfig.enabled === false) {
          continue;
        }

        const provider = this.createProvider(providerConfig);
        await manager.addProvider(provider);
      }
    }

    return manager;
  }

  /**
   * Resolve environment variable placeholders in configuration
   *
   * Supports:
   * - ${VAR_NAME} - Required variable
   * - ${VAR_NAME:-default} - Variable with default value
   *
   * @param config - Configuration object with potential env var placeholders
   * @returns Configuration with resolved values
   */
  private resolveEnvVars<T extends Record<string, unknown>>(config: T): T {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveEnvVarString(value);
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        resolved[key] = this.resolveEnvVars(value as Record<string, unknown>);
      } else {
        resolved[key] = value;
      }
    }

    return resolved as T;
  }

  /**
   * Resolve environment variable placeholders in a string
   */
  private resolveEnvVarString(value: string): string {
    return value.replace(ENV_VAR_PATTERN, (_match, varName: string, defaultValue?: string) => {
      const envValue = process.env[varName];

      if (envValue !== undefined) {
        return envValue;
      }

      if (defaultValue !== undefined) {
        return defaultValue;
      }

      // Return empty string if variable not found and no default
      return '';
    });
  }
}

/**
 * Singleton factory instance
 */
let factoryInstance: SecretProviderFactory | null = null;

/**
 * Get the singleton factory instance
 */
export function getSecretProviderFactory(): SecretProviderFactory {
  if (factoryInstance === null) {
    factoryInstance = new SecretProviderFactory();
  }
  return factoryInstance;
}

/**
 * Create a ProviderSecretManager from configuration file content
 *
 * @param config - Parsed configuration object
 * @returns Initialized ProviderSecretManager
 */
export async function createManagerFromConfig(
  config: SecretManagerConfig
): Promise<ProviderSecretManager> {
  const factory = getSecretProviderFactory();
  return factory.createManager(config);
}
