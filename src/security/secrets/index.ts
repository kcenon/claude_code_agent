/**
 * Secret Management Module
 *
 * This module provides a pluggable secret management system with support
 * for multiple backend providers including environment variables,
 * AWS Secrets Manager, HashiCorp Vault, and Azure Key Vault.
 *
 * @module security/secrets
 *
 * @example
 * ```typescript
 * import {
 *   SecretManager,
 *   LocalProvider,
 *   AWSSecretsManagerProvider,
 * } from './security/secrets';
 *
 * // Create a secret manager with multiple providers
 * const manager = new SecretManager({ envFallback: true });
 *
 * // Add providers in priority order
 * await manager.addProvider(new AWSSecretsManagerProvider({
 *   type: 'aws-secrets-manager',
 *   region: 'us-east-1',
 * }));
 * await manager.addProvider(new LocalProvider({ type: 'local' }));
 *
 * // Retrieve secrets
 * const apiKey = await manager.getSecretOrThrow('api/key');
 *
 * // Shutdown when done
 * await manager.shutdown();
 * ```
 */

// Core interface
export type { ISecretProvider } from './ISecretProvider.js';

// Types
export type {
  Secret,
  CachedSecret,
  ProviderState,
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
} from './types.js';

// Errors
export {
  SecretProviderError,
  ProviderInitializationError,
  ProviderUnavailableError,
  SecretRetrievalError,
  SecretNotFoundInProvidersError,
  AllProvidersFailedError,
  InvalidSecretConfigError,
} from './errors.js';

// Base implementation
export { BaseSecretProvider } from './BaseSecretProvider.js';

// Provider implementations
export { LocalProvider } from './LocalProvider.js';
export { AWSSecretsManagerProvider } from './AWSSecretsManagerProvider.js';
export { VaultProvider } from './VaultProvider.js';
export { AzureKeyVaultProvider } from './AzureKeyVaultProvider.js';
