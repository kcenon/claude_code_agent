/**
 * SecretProviderFactory - Creates secret providers from configuration
 *
 * @module security/secrets
 */

import type { ISecretProvider } from './ISecretProvider.js';
import type { SecretProviderConfig, SecretManagerConfig } from './types.js';
import { LocalProvider } from './LocalProvider.js';
import { AWSSecretsManagerProvider } from './AWSSecretsManagerProvider.js';
import { VaultProvider } from './VaultProvider.js';
import { AzureKeyVaultProvider } from './AzureKeyVaultProvider.js';
import { ProviderSecretManager } from './ProviderSecretManager.js';
import { InvalidSecretConfigError } from './errors.js';

const ENV_VAR_PATTERN = /\${([A-Z_][A-Z0-9_]*)(?::-([^}]*))?}/gi;

/**
 * Factory for creating secret providers from configuration
 */
export class SecretProviderFactory {
  /**
   * Create a secret provider instance from configuration
   *
   * @param config - The provider configuration specifying type and settings
   * @returns A configured secret provider instance
   */
  public createProvider(config: SecretProviderConfig): ISecretProvider {
    const resolvedConfig = this.resolveEnvVars(config);

    switch (resolvedConfig.type) {
      case 'local':
        return new LocalProvider(resolvedConfig);

      case 'aws-secrets-manager':
        return new AWSSecretsManagerProvider(resolvedConfig);

      case 'vault':
        return new VaultProvider(resolvedConfig);

      case 'azure-keyvault':
        return new AzureKeyVaultProvider(resolvedConfig);

      default: {
        const unknownConfig = resolvedConfig as { type: string };
        throw new InvalidSecretConfigError(`Unknown provider type: ${unknownConfig.type}`);
      }
    }
  }

  /**
   * Create a ProviderSecretManager with configured providers
   *
   * @param config - The manager configuration with provider definitions
   * @returns A configured and initialized ProviderSecretManager
   */
  public async createManager(config: SecretManagerConfig): Promise<ProviderSecretManager> {
    const manager = new ProviderSecretManager(config);

    if (config.providers !== undefined) {
      for (const providerConfig of config.providers) {
        if (providerConfig.enabled === false) {
          continue;
        }

        const provider = this.createProvider(providerConfig);
        await manager.addProvider(provider);
      }
    }

    return manager;
  }

  private resolveEnvVars<T extends SecretProviderConfig>(config: T): T {
    const resolved = {} as Record<string, unknown>;

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveEnvVarString(value);
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        resolved[key] = this.resolveEnvVarsObject(value as Record<string, unknown>);
      } else {
        resolved[key] = value;
      }
    }

    return resolved as T;
  }

  private resolveEnvVarsObject(obj: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveEnvVarString(value);
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        resolved[key] = this.resolveEnvVarsObject(value as Record<string, unknown>);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private resolveEnvVarString(value: string): string {
    return value.replace(ENV_VAR_PATTERN, (_match, varName: string, defaultValue?: string) => {
      const envValue = process.env[varName];

      if (envValue !== undefined) {
        return envValue;
      }

      if (defaultValue !== undefined) {
        return defaultValue;
      }

      return '';
    });
  }
}

let factoryInstance: SecretProviderFactory | null = null;

/**
 * Get or create the singleton SecretProviderFactory instance
 *
 * @returns The global SecretProviderFactory instance
 */
export function getSecretProviderFactory(): SecretProviderFactory {
  if (factoryInstance === null) {
    factoryInstance = new SecretProviderFactory();
  }
  return factoryInstance;
}

/**
 * Create a ProviderSecretManager from a configuration object
 *
 * @param config - The manager configuration
 * @returns A configured and initialized ProviderSecretManager
 */
export async function createManagerFromConfig(
  config: SecretManagerConfig
): Promise<ProviderSecretManager> {
  const factory = getSecretProviderFactory();
  return factory.createManager(config);
}
