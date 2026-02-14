/**
 * AzureKeyVaultProvider - Secret provider using Azure Key Vault
 *
 * This provider retrieves secrets from Azure Key Vault,
 * supporting managed identity and service principal authentication.
 *
 * @module security/secrets
 */

import type { Secret, AzureKeyVaultConfig } from './types.js';
import { BaseSecretProvider } from './BaseSecretProvider.js';
import { SecretRetrievalError, ProviderInitializationError } from './errors.js';

/**
 * Azure secret properties interface
 */
interface AzureSecretProperties {
  version?: string;
  id?: string;
  vaultUrl?: string;
  enabled?: boolean;
  createdOn?: Date;
  updatedOn?: Date;
  contentType?: string;
  expiresOn?: Date;
}

/**
 * Azure secret bundle interface
 */
interface AzureSecretBundle {
  value?: string;
  name: string;
  properties: AzureSecretProperties;
}

/**
 * Azure secret client interface
 */
interface AzureSecretClient {
  getSecret: (name: string, options?: { version?: string }) => Promise<AzureSecretBundle>;
  listPropertiesOfSecrets: () => AsyncIterableIterator<AzureSecretProperties>;
}

/**
 * Azure token credential interface
 */
interface AzureTokenCredential {
  getToken: (scopes: string | string[]) => Promise<{ token: string; expiresOnTimestamp: number }>;
}

/**
 * Azure keyvault-secrets module interface
 */
interface AzureKeyVaultSecretsModule {
  SecretClient: new (vaultUrl: string, credential: AzureTokenCredential) => AzureSecretClient;
}

/**
 * Azure identity module interface
 */
interface AzureIdentityModule {
  ManagedIdentityCredential: new () => AzureTokenCredential;
  ClientSecretCredential: new (
    tenantId: string,
    clientId: string,
    clientSecret: string
  ) => AzureTokenCredential;
  DefaultAzureCredential: new () => AzureTokenCredential;
}

/**
 * Azure Key Vault provider for retrieving secrets
 *
 * Features:
 * - Managed identity authentication
 * - Service principal authentication
 * - Secret versioning support
 * - Automatic caching with TTL
 *
 * @example
 * ```typescript
 * const provider = new AzureKeyVaultProvider({
 *   type: 'azure-keyvault',
 *   vaultUrl: 'https://myvault.vault.azure.net',
 *   useManagedIdentity: true,
 * });
 *
 * await provider.initialize();
 *
 * // Retrieves 'database-password' from Azure Key Vault
 * const secret = await provider.getSecret('database-password');
 *
 * await provider.close();
 * ```
 */
export class AzureKeyVaultProvider extends BaseSecretProvider {
  private client: AzureSecretClient | null = null;
  private readonly vaultUrl: string;
  private readonly useManagedIdentity: boolean;
  private readonly azureTenantId: string | undefined;
  private readonly azureClientId: string | undefined;
  private readonly azureClientSecret: string | undefined;

  /**
   * Create a new AzureKeyVaultProvider instance
   *
   * @param config - Provider configuration
   */
  constructor(config: AzureKeyVaultConfig) {
    super('azure-keyvault', config);
    this.vaultUrl = config.vaultUrl;
    this.useManagedIdentity = config.useManagedIdentity ?? false;
    this.azureTenantId = config.tenantId;
    this.azureClientId = config.clientId;
    this.azureClientSecret = config.clientSecret;
  }

  /**
   * Initialize the Azure Key Vault client
   */
  protected async doInitialize(): Promise<void> {
    let keyvaultModule: AzureKeyVaultSecretsModule;
    let credential: AzureTokenCredential;

    try {
      // Dynamic import for optional Azure SDK dependency
      // @ts-expect-error - Optional dependency, may not be installed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const kvModule = await import('@azure/keyvault-secrets');
      keyvaultModule = kvModule as unknown as AzureKeyVaultSecretsModule;
    } catch {
      throw new ProviderInitializationError(
        this.name,
        '@azure/keyvault-secrets package is not installed. Run: npm install @azure/keyvault-secrets'
      );
    }

    try {
      // @ts-expect-error - Optional dependency, may not be installed

      const identityModule = (await import('@azure/identity')) as unknown as AzureIdentityModule;

      if (this.useManagedIdentity) {
        // Use managed identity (works in Azure environments)
        credential = new identityModule.ManagedIdentityCredential();
      } else if (
        this.azureTenantId !== undefined &&
        this.azureClientId !== undefined &&
        this.azureClientSecret !== undefined
      ) {
        // Use service principal
        credential = new identityModule.ClientSecretCredential(
          this.azureTenantId,
          this.azureClientId,
          this.azureClientSecret
        );
      } else {
        // Use default Azure credential chain
        credential = new identityModule.DefaultAzureCredential();
      }
    } catch {
      throw new ProviderInitializationError(
        this.name,
        '@azure/identity package is not installed. Run: npm install @azure/identity'
      );
    }

    this.client = new keyvaultModule.SecretClient(this.vaultUrl, credential);

    // Verify connection with a health check
    const healthy = await this.doHealthCheck();
    if (!healthy) {
      throw new Error('Failed to connect to Azure Key Vault');
    }
  }

  /**
   * Retrieve a secret from Azure Key Vault
   *
   * @param name - The secret name to retrieve
   * @param version - Optional version identifier
   * @returns The secret with metadata or null if not found
   */
  protected async doGetSecret(name: string, version?: string): Promise<Secret | null> {
    if (this.client === null) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      // Azure Key Vault doesn't allow '/' in secret names, convert to '-'
      const azureName = name.replace(/[/]/g, '-');

      const options: { version?: string } = {};
      if (version !== undefined) {
        options.version = version;
      }

      const secretBundle = await this.client.getSecret(azureName, options);

      if (secretBundle.value === undefined) {
        return null;
      }

      return {
        value: secretBundle.value,
        version: secretBundle.properties.version,
        expiresAt: secretBundle.properties.expiresOn,
        metadata: {
          id: secretBundle.properties.id ?? '',
          name: secretBundle.name,
          vaultUrl: secretBundle.properties.vaultUrl ?? '',
          enabled: String(secretBundle.properties.enabled ?? true),
          createdOn: secretBundle.properties.createdOn?.toISOString() ?? '',
          updatedOn: secretBundle.properties.updatedOn?.toISOString() ?? '',
          contentType: secretBundle.properties.contentType ?? '',
        },
      };
    } catch (error) {
      // Handle "not found" gracefully
      if (error instanceof Error) {
        const restError = error as { code?: string; statusCode?: number };
        if (restError.code === 'SecretNotFound' || restError.statusCode === 404) {
          return null;
        }
      }

      throw new SecretRetrievalError(
        this.name,
        name,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if Azure Key Vault is accessible
   *
   * @returns True if the vault is reachable
   */
  protected async doHealthCheck(): Promise<boolean> {
    if (this.client === null) {
      return false;
    }

    try {
      // List one secret to verify connectivity
      // Using async iterator, just get the first item
      const iterator = this.client.listPropertiesOfSecrets();
      await iterator.next();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close the Azure Key Vault client
   *
   * @returns A resolved promise after cleanup
   */
  protected doClose(): Promise<void> {
    // SecretClient doesn't have a close method, just clear the reference
    this.client = null;
    return Promise.resolve();
  }
}
