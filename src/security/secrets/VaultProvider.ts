/**
 * VaultProvider - Secret provider using HashiCorp Vault
 *
 * @module security/secrets
 */

import type { Secret, VaultProviderConfig } from './types.js';
import { BaseSecretProvider } from './BaseSecretProvider.js';
import { SecretRetrievalError, ProviderInitializationError } from './errors.js';

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

export class VaultProvider extends BaseSecretProvider {
  private client: VaultClient | null = null;
  private readonly endpoint: string;
  private readonly vaultNamespace: string | undefined;
  private readonly secretsPath: string;
  private readonly vaultToken: string | undefined;
  private readonly vaultAppRole: { readonly roleId: string; readonly secretId: string } | undefined;

  constructor(config: VaultProviderConfig) {
    super('hashicorp-vault', config);
    this.endpoint = config.endpoint;
    this.vaultNamespace = config.namespace;
    this.secretsPath = config.secretsPath ?? 'secret/data';
    this.vaultToken = config.token;
    this.vaultAppRole = config.appRole;
  }

  protected async doInitialize(): Promise<void> {
    let nodeVault: (options: { endpoint: string; token?: string; namespace?: string }) => VaultClient;

    try {
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

    if (this.vaultNamespace !== undefined) {
      clientOptions.namespace = this.vaultNamespace;
    }

    if (this.vaultToken !== undefined) {
      clientOptions.token = this.vaultToken;
    }

    this.client = nodeVault(clientOptions);

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

    const healthy = await this.doHealthCheck();
    if (!healthy) {
      throw new Error('Failed to connect to HashiCorp Vault');
    }
  }

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

      const value =
        typeof secretData.value === 'string' ? secretData.value : JSON.stringify(secretData);

      const metadata = response.data.metadata ?? {};

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

  protected async doClose(): Promise<void> {
    this.client = null;
  }
}
