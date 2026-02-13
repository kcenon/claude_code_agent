/**
 * VaultProvider - Secret provider using HashiCorp Vault
 *
 * @module security/secrets
 */

import type { Secret, VaultProviderConfig } from './types.js';
import { BaseSecretProvider } from './BaseSecretProvider.js';
import { SecretRetrievalError, ProviderInitializationError } from './errors.js';

/**
 * Vault client interface
 */
interface VaultClient {
  read: (path: string, options?: { version?: string }) => Promise<VaultReadResponse>;
  health: () => Promise<VaultHealthResponse>;
  approleLogin: (options: { role_id: string; secret_id: string }) => Promise<VaultLoginResponse>;
  token: string;
}

/**
 * Vault read response interface
 */
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

/**
 * Vault health response interface
 */
interface VaultHealthResponse {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
}

/**
 * Vault login response interface
 */
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
 * Node-vault factory function type
 */
type NodeVaultFactory = (options: {
  endpoint: string;
  token?: string;
  namespace?: string;
}) => VaultClient;

/**
 * HashiCorp Vault provider for retrieving secrets
 *
 * Features:
 * - Token authentication
 * - AppRole authentication
 * - Namespace support
 * - Secret versioning (KV v2)
 * - Automatic caching with TTL
 *
 * @example
 * ```typescript
 * const provider = new VaultProvider({
 *   type: 'hashicorp-vault',
 *   endpoint: 'https://vault.example.com:8200',
 *   token: 'hvs.xxx',
 *   secretsPath: 'secret/data',
 * });
 *
 * await provider.initialize();
 * const secret = await provider.getSecret('myapp/database');
 * await provider.close();
 * ```
 */
export class VaultProvider extends BaseSecretProvider {
  private client: VaultClient | null = null;
  private readonly endpoint: string;
  private readonly vaultNamespace: string | undefined;
  private readonly secretsPath: string;
  private readonly vaultToken: string | undefined;
  private readonly vaultAppRole: { readonly roleId: string; readonly secretId: string } | undefined;

  /**
   * Create a new VaultProvider instance
   *
   * @param config - Provider configuration
   */
  constructor(config: VaultProviderConfig) {
    super('hashicorp-vault', config);
    this.endpoint = config.endpoint;
    this.vaultNamespace = config.namespace;
    this.secretsPath = config.secretsPath ?? 'secret/data';
    this.vaultToken = config.token;
    this.vaultAppRole = config.appRole;
  }

  /**
   * Initialize the Vault client
   */
  protected async doInitialize(): Promise<void> {
    let nodeVault: NodeVaultFactory;

    try {
      // Dynamic import for optional node-vault dependency
      // Using require for CommonJS module compatibility
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nodeVault = require('node-vault') as NodeVaultFactory;
    } catch {
      throw new ProviderInitializationError(
        this.name,
        'node-vault package is not installed. Run: npm install node-vault'
      );
    }

    const clientOptions: { endpoint: string; token?: string; namespace?: string } = {
      endpoint: this.endpoint,
    };

    if (this.vaultNamespace !== undefined) {
      clientOptions.namespace = this.vaultNamespace;
    }

    if (this.vaultToken !== undefined) {
      clientOptions.token = this.vaultToken;
    }

    this.client = nodeVault(clientOptions);

    // If using AppRole authentication, perform login
    if (this.vaultAppRole !== undefined) {
      try {
        const result = await this.client.approleLogin({
          role_id: this.vaultAppRole.roleId,
          secret_id: this.vaultAppRole.secretId,
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
   * @param name
   * @param version
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

      const secretData = response.data.data;
      if (secretData === undefined) {
        return null;
      }

      // Extract value - if there's a 'value' key use it, otherwise stringify the whole data
      const value =
        typeof secretData.value === 'string' ? secretData.value : JSON.stringify(secretData);

      const metadata = response.data.metadata ?? {};

      // Calculate expiration from lease duration if available
      const expiresAt =
        response.lease_duration !== undefined && response.lease_duration > 0
          ? new Date(Date.now() + response.lease_duration * 1000)
          : undefined;

      return {
        value,
        version: metadata.version?.toString(),
        expiresAt,
        metadata: {
          path,
          createdTime: metadata.created_time ?? '',
          destroyed: String(metadata.destroyed ?? false),
        },
      };
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
   * Check if Vault is accessible and unsealed
   */
  protected async doHealthCheck(): Promise<boolean> {
    if (this.client === null) {
      return false;
    }

    try {
      const health = await this.client.health();
      return health.initialized && !health.sealed;
    } catch {
      return false;
    }
  }

  /**
   * Close the Vault client
   */
  protected doClose(): Promise<void> {
    // node-vault client doesn't have a close method, just clear the reference
    this.client = null;
    return Promise.resolve();
  }
}
