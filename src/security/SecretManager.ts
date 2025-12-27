/**
 * SecretManager - Secure management of API keys and secrets
 *
 * Features:
 * - Environment variable based configuration
 * - Optional .env file loading
 * - Secret masking in logs
 * - Validation of required secrets
 */

import { config as dotenvConfig } from 'dotenv';
import type { SecretManagerOptions } from './types.js';
import { SecretNotFoundError } from './errors.js';

/**
 * Default required secrets for the AD-SDLC system
 */
const DEFAULT_REQUIRED_SECRETS = ['CLAUDE_API_KEY', 'GITHUB_TOKEN'] as const;

/**
 * Manages secure access to secrets and API keys
 */
export class SecretManager {
  private readonly secrets: Map<string, string> = new Map();
  private readonly requiredSecrets: readonly string[];
  private readonly throwOnMissing: boolean;
  private initialized = false;

  constructor(options: SecretManagerOptions = {}) {
    this.requiredSecrets = options.requiredSecrets ?? DEFAULT_REQUIRED_SECRETS;
    this.throwOnMissing = options.throwOnMissing ?? true;

    // Load from .env file if specified
    if (options.envFilePath !== undefined) {
      dotenvConfig({ path: options.envFilePath });
    } else {
      dotenvConfig();
    }
  }

  /**
   * Initialize the secret manager by loading secrets from environment
   */
  public load(): void {
    if (this.initialized) {
      return;
    }

    this.loadFromEnvironment();
    this.validateRequiredSecrets();
    this.initialized = true;
  }

  /**
   * Load secrets from environment variables
   */
  private loadFromEnvironment(): void {
    // Load all secret-related environment variables
    const secretPatterns = [
      /^CLAUDE_/,
      /^GITHUB_/,
      /^API_KEY$/,
      /_API_KEY$/,
      /_TOKEN$/,
      /_SECRET$/,
      /^SECRET_/,
    ];

    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;

      const isSecret = secretPatterns.some((pattern) => pattern.test(key));
      if (isSecret) {
        this.secrets.set(key, value);
      }
    }
  }

  /**
   * Validate that all required secrets are present
   */
  private validateRequiredSecrets(): void {
    const missing: string[] = [];

    for (const key of this.requiredSecrets) {
      if (!this.secrets.has(key)) {
        missing.push(key);
      }
    }

    if (missing.length > 0 && this.throwOnMissing) {
      throw new SecretNotFoundError(missing.join(', '));
    }
  }

  /**
   * Get a secret value by key
   *
   * @param key - The secret key to retrieve
   * @returns The secret value
   * @throws SecretNotFoundError if the secret is not found
   */
  public get(key: string): string {
    const value = this.secrets.get(key);
    if (value === undefined) {
      throw new SecretNotFoundError(key);
    }
    return value;
  }

  /**
   * Get a secret value or return a default
   *
   * @param key - The secret key to retrieve
   * @param defaultValue - The default value if not found
   * @returns The secret value or default
   */
  public getOrDefault(key: string, defaultValue: string): string {
    return this.secrets.get(key) ?? defaultValue;
  }

  /**
   * Check if a secret exists
   *
   * @param key - The secret key to check
   * @returns True if the secret exists
   */
  public has(key: string): boolean {
    return this.secrets.has(key);
  }

  /**
   * Mask all known secrets in a text string
   * Use this to sanitize logs and error messages
   *
   * @param text - The text to mask
   * @returns The text with secrets replaced by [REDACTED]
   */
  public mask(text: string): string {
    let masked = text;

    for (const [key, value] of this.secrets) {
      // Skip empty or very short values to avoid false positives
      if (value.length < 8) continue;

      // Escape special regex characters in the value
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(escapedValue, 'g');
      masked = masked.replace(pattern, `[${key}_REDACTED]`);
    }

    return masked;
  }

  /**
   * Create a safe logger wrapper that automatically masks secrets
   *
   * @param logger - The logger function to wrap
   * @returns A wrapped logger that masks secrets
   */
  public createSafeLogger(
    logger: (message: string) => void
  ): (message: string) => void {
    return (message: string): void => {
      logger(this.mask(message));
    };
  }

  /**
   * Get list of available secret keys (not values)
   *
   * @returns Array of secret key names
   */
  public getAvailableKeys(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Check if the secret manager has been initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Manually set a secret (useful for testing)
   * Warning: Use with caution in production
   *
   * @param key - The secret key
   * @param value - The secret value
   */
  public set(key: string, value: string): void {
    this.secrets.set(key, value);
  }

  /**
   * Clear all secrets (useful for testing cleanup)
   */
  public clear(): void {
    this.secrets.clear();
    this.initialized = false;
  }
}

/**
 * Singleton instance for global access
 */
let globalSecretManager: SecretManager | null = null;

/**
 * Get or create the global SecretManager instance
 *
 * @param options - Options for creating new instance
 * @returns The global SecretManager instance
 */
export function getSecretManager(options?: SecretManagerOptions): SecretManager {
  if (globalSecretManager === null) {
    globalSecretManager = new SecretManager(options);
  }
  return globalSecretManager;
}

/**
 * Reset the global SecretManager instance (for testing)
 */
export function resetSecretManager(): void {
  if (globalSecretManager !== null) {
    globalSecretManager.clear();
    globalSecretManager = null;
  }
}
