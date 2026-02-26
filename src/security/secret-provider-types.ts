/**
 * Secret Provider Type Definitions
 *
 * Canonical location for secret management types. These types are
 * placed outside the `secrets/` directory to avoid sandbox read
 * restrictions on paths matching `** /secrets`.
 *
 * Internal modules in `secrets/` re-export from this file for
 * backward compatibility.
 *
 * @module security/secret-provider-types
 */

// ─── Provider State ────────────────────────────────────────────────

/**
 * Provider state representing the current operational status
 */
export type ProviderState = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'closed';

// ─── Secret Value ──────────────────────────────────────────────────

/**
 * Secret value with metadata
 */
export interface Secret {
  /** The secret value */
  readonly value: string;
  /** Secret version identifier (provider-specific) */
  readonly version?: string | undefined;
  /** When the secret expires (for dynamic secrets) */
  readonly expiresAt?: Date | undefined;
  /** Additional metadata from the provider */
  readonly metadata?: Record<string, string>;
}

/**
 * Cached secret with TTL information
 */
export interface CachedSecret {
  /** The cached secret */
  readonly secret: Secret;
  /** When the secret was cached */
  readonly cachedAt: number;
  /** Time to live in milliseconds */
  readonly ttl: number;
}

// ─── Provider Health ───────────────────────────────────────────────

/**
 * Provider health information for monitoring
 */
export interface ProviderHealth {
  /** Current provider state */
  readonly state: ProviderState;
  /** Whether the provider is currently healthy */
  readonly healthy: boolean;
  /** Last successful secret retrieval time */
  readonly lastAccessTime?: Date | undefined;
  /** Last error time if any */
  readonly lastErrorTime?: Date | undefined;
  /** Last error message if any */
  readonly lastError?: string | undefined;
  /** Number of cached secrets */
  readonly cachedSecrets: number;
  /** Number of failed retrieval attempts */
  readonly failedAttempts: number;
  /** Total secrets retrieved */
  readonly totalRetrieved: number;
}

// ─── Provider Configurations ───────────────────────────────────────

/**
 * Base configuration for all secret providers
 */
export interface BaseSecretProviderConfig {
  /** Whether this provider is enabled */
  readonly enabled?: boolean;
  /** Cache TTL in milliseconds (default: 300000 = 5 minutes) */
  readonly cacheTTL?: number;
  /** Optional prefix for secret names */
  readonly prefix?: string;
}

/**
 * Local provider configuration (environment variables)
 */
export interface LocalProviderConfig extends BaseSecretProviderConfig {
  /** Provider type identifier */
  readonly type: 'local';
  /** Environment variable prefix to filter (optional) */
  readonly envPrefix?: string;
}

/**
 * AWS Secrets Manager provider configuration
 */
export interface AWSSecretsManagerConfig extends BaseSecretProviderConfig {
  /** Provider type identifier */
  readonly type: 'aws-secrets-manager';
  /** AWS region */
  readonly region: string;
  /** Optional AWS credentials (uses IAM role if not provided) */
  readonly credentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
  };
  /** Secret name for health check */
  readonly healthCheckSecret?: string;
}

/**
 * HashiCorp Vault provider configuration
 */
export interface VaultProviderConfig extends BaseSecretProviderConfig {
  /** Provider type identifier */
  readonly type: 'vault';
  /** Vault server endpoint URL */
  readonly endpoint: string;
  /** Vault namespace (optional, for enterprise) */
  readonly namespace?: string;
  /** Path to secrets in Vault (default: 'secret/data') */
  readonly secretsPath?: string;
  /** Token authentication */
  readonly token?: string;
  /** AppRole authentication */
  readonly appRole?: {
    readonly roleId: string;
    readonly secretId: string;
  };
}

/**
 * Azure Key Vault provider configuration
 */
export interface AzureKeyVaultConfig extends BaseSecretProviderConfig {
  /** Provider type identifier */
  readonly type: 'azure-keyvault';
  /** Key Vault URL (e.g., https://myvault.vault.azure.net) */
  readonly vaultUrl: string;
  /** Use managed identity authentication */
  readonly useManagedIdentity?: boolean;
  /** Tenant ID for service principal auth */
  readonly tenantId?: string;
  /** Client ID for service principal auth */
  readonly clientId?: string;
  /** Client secret for service principal auth */
  readonly clientSecret?: string;
}

/**
 * Union type of all provider configurations
 */
export type SecretProviderConfig =
  | LocalProviderConfig
  | AWSSecretsManagerConfig
  | VaultProviderConfig
  | AzureKeyVaultConfig;

/**
 * Secret manager configuration
 */
export interface SecretManagerConfig {
  /** Whether to fall back to environment variables */
  readonly envFallback?: boolean;
  /** Providers configuration in priority order */
  readonly providers?: SecretProviderConfig[];
  /** Default cache TTL for all providers */
  readonly defaultCacheTTL?: number;
}

// ─── Circuit Breaker ───────────────────────────────────────────────

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  readonly failureThreshold: number;
  /** Time in ms before attempting to close the circuit */
  readonly resetTimeout: number;
  /** Number of successful calls needed to close from half-open */
  readonly successThreshold: number;
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  /** Current circuit state */
  readonly state: CircuitBreakerState;
  /** Number of consecutive failures */
  readonly failureCount: number;
  /** Number of consecutive successes (in half-open state) */
  readonly successCount: number;
  /** When the circuit was last opened */
  readonly lastFailureTime?: Date | undefined;
  /** When to next attempt (if circuit is open) */
  readonly nextAttemptTime?: Date | undefined;
}

// ─── ISecretProvider Interface ─────────────────────────────────────

/**
 * Interface for secret provider implementations
 *
 * All provider implementations must implement this interface to enable
 * pluggable secret backends. Providers handle the retrieval of secrets
 * from their respective sources.
 */
export interface ISecretProvider {
  /** Unique name identifying this provider */
  readonly name: string;

  /** Initialize the provider connection */
  initialize(): Promise<void>;

  /** Retrieve a secret by name */
  getSecret(name: string, version?: string): Promise<Secret | null>;

  /** Check if the provider is healthy and can retrieve secrets */
  healthCheck(): Promise<boolean>;

  /** Close the provider connection */
  close(): Promise<void>;

  /** Get the current health status of the provider */
  getHealth?(): ProviderHealth;

  /** Check if the provider is ready to retrieve secrets */
  isReady?(): boolean;

  /** Clear the provider's cache */
  clearCache?(): void;
}
