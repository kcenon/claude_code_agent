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

// Azure SDK types - dynamically imported
type SecretClient = import('@azure/keyvault-secrets').SecretClient;
type TokenCredential = import('@azure/identity').TokenCredential;

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
  private client: SecretClient | null = null;
  private readonly vaultUrl: string;
  private readonly useManagedIdentity: boolean;
  private readonly tenantId?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;

  /**
   * Create a new AzureKeyVaultProvider instance
   *
   * @param config - Provider configuration
   */
  constructor(config: AzureKeyVaultConfig) {
    super('azure-keyvault', config);
    this.vaultUrl = config.vaultUrl;
    this.useManagedIdentity = config.useManagedIdentity ?? false;
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  /**
   * Initialize the Azure Key Vault client
   */
  protected async doInitialize(): Promise<void> {
    let SecretClient: typeof import('@azure/keyvault-secrets').SecretClient;
    let credential: TokenCredential;

    try {
      const keyvaultModule = await import('@azure/keyvault-secrets');
      SecretClient = keyvaultModule.SecretClient;
    } catch {
      throw new ProviderInitializationError(
        this.name,
        '@azure/keyvault-secrets package is not installed. Run: npm install @azure/keyvault-secrets'
      );
    }

    try {
      if (this.useManagedIdentity) {
        // Use managed identity (works in Azure environments)
        const { ManagedIdentityCredential } = await import('@azure/identity');
        credential = new ManagedIdentityCredential();
      } else if (
        this.tenantId !== undefined &&
        this.clientId !== undefined &&
        this.clientSecret !== undefined
      ) {
        // Use service principal
        const { ClientSecretCredential } = await import('@azure/identity');
        credential = new ClientSecretCredential(this.tenantId, this.clientId, this.clientSecret);
      } else {
        // Use default Azure credential chain
        const { DefaultAzureCredential } = await import('@azure/identity');
        credential = new DefaultAzureCredential();
      }
    } catch {
      throw new ProviderInitializationError(
        this.name,
        '@azure/identity package is not installed. Run: npm install @azure/identity'
      );
    }

    this.client = new SecretClient(this.vaultUrl, credential);

    // Verify connection with a health check
    const healthy = await this.doHealthCheck();
    if (!healthy) {
      throw new Error('Failed to connect to Azure Key Vault');
    }
  }

  /**
   * Retrieve a secret from Azure Key Vault
   */
  protected async doGetSecret(name: string, version?: string): Promise<Secret | null> {
    if (this.client === null) {
      throw new Error('Azure Key Vault client not initialized');
    }

    try {
      // Azure Key Vault doesn't allow '/' in secret names, convert to '-'
      const azureName = name.replace(/\//g, '-');

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
          vaultUrl: secretBundle.properties.vaultUrl,
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
   */
  protected async doClose(): Promise<void> {
    // SecretClient doesn't have a close method, just clear the reference
    this.client = null;
  }
}
