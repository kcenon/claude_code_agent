/**
 * Secret Provider Type Definitions
 *
 * Re-exports from the canonical location at ../secret-provider-types.ts.
 * This file exists for backward compatibility so that internal modules
 * in secrets/ can continue to import from './types.js'.
 *
 * @module security/secrets/types
 */

export type {
  ProviderState,
  Secret,
  CachedSecret,
  ProviderHealth,
  BaseSecretProviderConfig,
  LocalProviderConfig,
  AWSSecretsManagerConfig,
  VaultProviderConfig,
  AzureKeyVaultConfig,
  SecretProviderConfig,
  SecretManagerConfig,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
} from '../secret-provider-types.js';
