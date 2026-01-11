/**
 * AWSSecretsManagerProvider - Secret provider using AWS Secrets Manager
 *
 * This provider retrieves secrets from AWS Secrets Manager service,
 * supporting IAM role and credentials-based authentication.
 *
 * @module security/secrets
 */

import type { Secret, AWSSecretsManagerConfig } from './types.js';
import { BaseSecretProvider } from './BaseSecretProvider.js';
import { SecretRetrievalError, ProviderInitializationError } from './errors.js';

// AWS SDK client type (any to avoid requiring the module at compile time)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AWSSecretsManagerClient = any;

/**
 * AWS Secrets Manager provider for retrieving secrets from AWS
 *
 * Features:
 * - IAM role and credentials authentication
 * - Secret versioning support
 * - Automatic caching with TTL
 * - Graceful handling of not found errors
 *
 * @example
 * ```typescript
 * const provider = new AWSSecretsManagerProvider({
 *   type: 'aws-secrets-manager',
 *   region: 'us-east-1',
 *   prefix: 'myapp',
 *   cacheTTL: 300000,
 * });
 *
 * await provider.initialize();
 *
 * // Retrieves 'myapp/database/password' from AWS Secrets Manager
 * const secret = await provider.getSecret('database/password');
 *
 * await provider.close();
 * ```
 */
export class AWSSecretsManagerProvider extends BaseSecretProvider {
  private client: AWSSecretsManagerClient = null;
  private readonly region: string;
  private readonly awsCredentials: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
  } | undefined;
  private readonly healthCheckSecret: string | undefined;

  /**
   * Create a new AWSSecretsManagerProvider instance
   *
   * @param config - Provider configuration
   */
  constructor(config: AWSSecretsManagerConfig) {
    super('aws-secrets-manager', config);
    this.region = config.region;
    this.awsCredentials = config.credentials;
    this.healthCheckSecret = config.healthCheckSecret;
  }

  /**
   * Initialize the AWS Secrets Manager client
   */
  protected async doInitialize(): Promise<void> {
    let SecretsManagerClient: new (config: unknown) => AWSSecretsManagerClient;
    
    try {
      // @ts-expect-error - Optional dependency, may not be installed
      const awsModule = await import('@aws-sdk/client-secrets-manager');
      SecretsManagerClient = awsModule.SecretsManagerClient;
    } catch {
      throw new ProviderInitializationError(
        this.name,
        '@aws-sdk/client-secrets-manager package is not installed. Run: npm install @aws-sdk/client-secrets-manager'
      );
    }

    const clientConfig: {
      region: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      };
    } = {
      region: this.region,
    };

    // Only set credentials if explicitly provided (otherwise use IAM role)
    if (this.awsCredentials !== undefined) {
      const creds: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      } = {
        accessKeyId: this.awsCredentials.accessKeyId,
        secretAccessKey: this.awsCredentials.secretAccessKey,
      };
      if (this.awsCredentials.sessionToken !== undefined) {
        creds.sessionToken = this.awsCredentials.sessionToken;
      }
      clientConfig.credentials = creds;
    }

    this.client = new SecretsManagerClient(clientConfig);

    // Verify connection with a health check
    const healthy = await this.doHealthCheck();
    if (!healthy) {
      throw new Error('Failed to connect to AWS Secrets Manager');
    }
  }

  /**
   * Retrieve a secret from AWS Secrets Manager
   */
  protected async doGetSecret(name: string, version?: string): Promise<Secret | null> {
    if (this.client === null) {
      throw new Error('AWS Secrets Manager client not initialized');
    }

    // @ts-expect-error - Optional dependency, may not be installed
    const { GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

    try {
      const commandInput: { SecretId: string; VersionId?: string } = {
        SecretId: name,
      };
      if (version !== undefined) {
        commandInput.VersionId = version;
      }
      const command = new GetSecretValueCommand(commandInput);

      const response = await this.client.send(command);

      // AWS Secrets Manager can return either string or binary
      const value = response.SecretString ?? '';
      if (value === '' && response.SecretBinary === undefined) {
        return null;
      }

      return {
        value: response.SecretString ?? Buffer.from(response.SecretBinary!).toString('utf-8'),
        version: response.VersionId,
        metadata: {
          arn: response.ARN ?? '',
          name: response.Name ?? '',
          createdDate: response.CreatedDate?.toISOString() ?? '',
          versionStages: (response.VersionStages ?? []).join(','),
        },
      };
    } catch (error) {
      // Handle "not found" gracefully
      if (
        error instanceof Error &&
        (error.name === 'ResourceNotFoundException' || error.name === 'DecryptionFailureException')
      ) {
        return null;
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
   * Check if AWS Secrets Manager is accessible
   */
  protected async doHealthCheck(): Promise<boolean> {
    if (this.client === null) {
      return false;
    }

    try {
      // @ts-expect-error - Optional dependency, may not be installed
      const { ListSecretsCommand, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

      // If a specific health check secret is configured, try to access it
      if (this.healthCheckSecret !== undefined) {
        const command = new GetSecretValueCommand({
          SecretId: this.healthCheckSecret,
        });
        await this.client.send(command);
        return true;
      }

      // Otherwise, just list secrets to verify connectivity
      const command = new ListSecretsCommand({
        MaxResults: 1,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close the AWS Secrets Manager client
   */
  protected async doClose(): Promise<void> {
    if (this.client !== null) {
      this.client.destroy();
      this.client = null;
    }
  }
}
