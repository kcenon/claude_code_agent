/**
 * VaultProvider - Secret provider using HashiCorp Vault
 *
 * This provider retrieves secrets from HashiCorp Vault,
 * supporting token and AppRole authentication methods.
 *
 * @module security/secrets
 */

import type { Secret, VaultProviderConfig } from './types.js';
import { BaseSecretProvider } from './BaseSecretProvider.js';
import { SecretRetrievalError, ProviderInitializationError } from './errors.js';

// Vault client type
interface VaultClient {
  read: (path: string, options?: { version?: string }) => Promise<VaultReadResponse>;
  health: () => Promise<VaultHealthResponse>;
  approleLogin: (options: { role_id: string; secret_id: string }) => Promise<VaultLoginResponse>;
  token: string;
}

interface VaultReadResponse {
  data: {
    data?: Record<string, unknown>;
    metadata?: {
      version?: number;
      created_time?: string;
      destroyed?: boolean;
      [key: string]: unknown;
    };
  };
  lease_duration?: number;
  lease_id?: string;
}

interface VaultHealthResponse {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
}

interface VaultLoginResponse {
  auth: {
    client_token: string;
    accessor: string;
    policies: string[];
    token_policies: string[];
    lease_duration: number;
    renewable: boolean;
  };
}

/**
 * HashiCorp Vault provider for retrieving secrets
 *
 * Features:
 * - Token and AppRole authentication
 * - KV v2 secrets engine support
 * - Lease management for dynamic secrets
 * - Automatic caching with TTL respecting lease duration
 *
 * @example
 * ```typescript
 * const provider = new VaultProvider({
 *   type: 'vault',
 *   endpoint: 'https://vault.example.com:8200',
 *   token: process.env.VAULT_TOKEN,
 *   secretsPath: 'secret/data/myapp',
 * });
 *
 * await provider.initialize();
 *
 * // Retrieves 'secret/data/myapp/database' from Vault
 * const secret = await provider.getSecret('database');
 *
 * await provider.close();
 * ```
 */
export class VaultProvider extends BaseSecretProvider {
  private client: VaultClient | null = null;
  private readonly endpoint: string;
  private readonly namespace?: string;
  private readonly secretsPath: string;
  private readonly token?: string;
  private readonly appRole?: {
    readonly roleId: string;
    readonly secretId: string;
  };

  /**
   * Create a new VaultProvider instance
   *
   * @param config - Provider configuration
   */
  constructor(config: VaultProviderConfig) {
    super('hashicorp-vault', config);
    this.endpoint = config.endpoint;
    this.namespace = config.namespace;
    this.secretsPath = config.secretsPath ?? 'secret/data';
    this.token = config.token;
    this.appRole = config.appRole;
  }

  /**
   * Initialize the Vault client
   */
  protected async doInitialize(): Promise<void> {
    // Dynamic import for node-vault
    let nodeVault: (options: { endpoint: string; token?: string; namespace?: string }) => VaultClient;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nodeVault = require('node-vault') as typeof nodeVault;
    } catch {
      throw new ProviderInitializationError(
        this.name,
        'node-vault package is not installed. Run: npm install node-vault'
      );
    }

    const clientOptions: { endpoint: string; token?: string; namespace?: string } = {
      endpoint: this.endpoint,
    };

    if (this.namespace !== undefined) {
      clientOptions.namespace = this.namespace;
    }

    if (this.token !== undefined) {
      clientOptions.token = this.token;
    }

    this.client = nodeVault(clientOptions);

    // If using AppRole, authenticate
    if (this.appRole !== undefined) {
      try {
        const result = await this.client.approleLogin({
          role_id: this.appRole.roleId,
          secret_id: this.appRole.secretId,
        });
        this.client.token = result.auth.client_token;
      } catch (error) {
        throw new ProviderInitializationError(
          this.name,
          `AppRole authentication failed: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    // Verify connection with a health check
    const healthy = await this.doHealthCheck();
    if (!healthy) {
      throw new Error('Failed to connect to HashiCorp Vault');
    }
  }

  /**
   * Retrieve a secret from Vault
   */
  protected async doGetSecret(name: string, version?: string): Promise<Secret | null> {
    if (this.client === null) {
      throw new Error('Vault client not initialized');
    }

    const path = `${this.secretsPath}/${name}`;

    try {
      const options: { version?: string } = {};
      if (version !== undefined) {
        options.version = version;
      }

      const response = await this.client.read(path, options);

      // KV v2 stores data in response.data.data
      const secretData = response.data.data;
      if (secretData === undefined) {
        return null;
      }

      // If the secret has a 'value' key, use that; otherwise, JSON stringify the data
      const value =
        typeof secretData.value === 'string' ? secretData.value : JSON.stringify(secretData);

      const metadata = response.data.metadata ?? {};

      const secret: Secret = {
        value,
        version: metadata.version?.toString(),
        metadata: {
          path,
          createdTime: metadata.created_time ?? '',
          destroyed: String(metadata.destroyed ?? false),
        },
      };

      // Handle lease for dynamic secrets
      if (response.lease_duration !== undefined && response.lease_duration > 0) {
        secret.expiresAt = new Date(Date.now() + response.lease_duration * 1000);
      }

      return secret;
    } catch (error) {
      // Handle "not found" gracefully
      if (error instanceof Error) {
        const errorResponse = (error as { response?: { statusCode?: number } }).response;
        if (errorResponse?.statusCode === 404) {
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
   * Check if Vault is healthy
   */
  protected async doHealthCheck(): Promise<boolean> {
    if (this.client === null) {
      return false;
    }

    try {
      const health = await this.client.health();
      // Vault is healthy if initialized, not sealed, and not in standby
      return health.initialized && !health.sealed;
    } catch {
      return false;
    }
  }

  /**
   * Close the Vault client
   */
  protected async doClose(): Promise<void> {
    // node-vault doesn't have a close method, just clear the reference
    this.client = null;
  }
}
