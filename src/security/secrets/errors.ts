/**
 * Secret Provider Error Classes
 *
 * Custom error classes for the secret management system.
 *
 * @module security/secrets/errors
 */

import { SecurityError } from '../errors.js';

/**
 * Base class for secret provider errors
 */
export class SecretProviderError extends SecurityError {
  public readonly providerName: string;

  constructor(message: string, providerName: string, code: string = 'SECRET_PROVIDER_ERROR') {
    super(message, code);
    this.name = 'SecretProviderError';
    this.providerName = providerName;
    Object.setPrototypeOf(this, SecretProviderError.prototype);
  }
}

/**
 * Error thrown when a provider fails to initialize
 */
export class ProviderInitializationError extends SecretProviderError {
  public readonly cause: Error | undefined;

  constructor(providerName: string, reason: string, cause?: Error) {
    super(
      `Failed to initialize provider '${providerName}': ${reason}`,
      providerName,
      'PROVIDER_INIT_ERROR'
    );
    this.name = 'ProviderInitializationError';
    this.cause = cause;
    Object.setPrototypeOf(this, ProviderInitializationError.prototype);
  }
}

/**
 * Error thrown when a provider is not available (circuit breaker open)
 */
export class ProviderUnavailableError extends SecretProviderError {
  public readonly retryAfterMs: number | undefined;

  constructor(providerName: string, retryAfterMs?: number) {
    const hasRetryTime = retryAfterMs !== undefined && retryAfterMs > 0;
    const message = hasRetryTime
      ? `Provider '${providerName}' is unavailable. Retry after ${String(retryAfterMs)}ms`
      : `Provider '${providerName}' is unavailable`;
    super(message, providerName, 'PROVIDER_UNAVAILABLE');
    this.name = 'ProviderUnavailableError';
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, ProviderUnavailableError.prototype);
  }
}

/**
 * Error thrown when secret retrieval fails
 */
export class SecretRetrievalError extends SecretProviderError {
  public readonly secretName: string;
  public readonly cause: Error | undefined;

  constructor(providerName: string, secretName: string, reason: string, cause?: Error) {
    super(
      `Failed to retrieve secret '${secretName}' from '${providerName}': ${reason}`,
      providerName,
      'SECRET_RETRIEVAL_ERROR'
    );
    this.name = 'SecretRetrievalError';
    this.secretName = secretName;
    this.cause = cause;
    Object.setPrototypeOf(this, SecretRetrievalError.prototype);
  }
}

/**
 * Error thrown when a required secret is not found in any provider
 */
export class SecretNotFoundInProvidersError extends SecurityError {
  public readonly secretName: string;
  public readonly triedProviders: string[];

  constructor(secretName: string, triedProviders: string[]) {
    super(
      `Secret '${secretName}' not found in any provider. Tried: ${triedProviders.join(', ')}`,
      'SECRET_NOT_FOUND_IN_PROVIDERS'
    );
    this.name = 'SecretNotFoundInProvidersError';
    this.secretName = secretName;
    this.triedProviders = triedProviders;
    Object.setPrototypeOf(this, SecretNotFoundInProvidersError.prototype);
  }
}

/**
 * Error thrown when all providers fail
 */
export class AllProvidersFailedError extends SecurityError {
  public readonly secretName: string;
  public readonly errors: Array<{ provider: string; error: string }>;

  constructor(secretName: string, errors: Array<{ provider: string; error: string }>) {
    const details = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
    super(`All providers failed for secret '${secretName}': ${details}`, 'ALL_PROVIDERS_FAILED');
    this.name = 'AllProvidersFailedError';
    this.secretName = secretName;
    this.errors = errors;
    Object.setPrototypeOf(this, AllProvidersFailedError.prototype);
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class InvalidSecretConfigError extends SecurityError {
  public readonly configPath: string | undefined;

  constructor(message: string, configPath?: string) {
    super(`Invalid secret configuration: ${message}`, 'INVALID_SECRET_CONFIG');
    this.name = 'InvalidSecretConfigError';
    this.configPath = configPath;
    Object.setPrototypeOf(this, InvalidSecretConfigError.prototype);
  }
}
