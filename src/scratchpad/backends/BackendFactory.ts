/**
 * Backend Factory for Scratchpad
 *
 * Creates backend instances based on configuration.
 * Supports file, SQLite, and Redis backends.
 *
 * Configuration can be loaded from:
 * - Direct configuration object
 * - workflow.yaml file (.ad-sdlc/config/workflow.yaml)
 * - Environment variables (SCRATCHPAD_*)
 */

import type { IScratchpadBackend } from './IScratchpadBackend.js';
import type { ScratchpadBackendConfig, BackendType } from './types.js';
import { FileBackend } from './FileBackend.js';
import { SQLiteBackend } from './SQLiteBackend.js';
import { RedisBackend } from './RedisBackend.js';
import { loadScratchpadConfig } from './configLoader.js';

/**
 * Error thrown when backend creation fails
 */
export class BackendCreationError extends Error {
  public readonly backendType: BackendType;
  public override readonly cause: Error | undefined;

  constructor(backendType: BackendType, message: string, cause?: Error) {
    super(`Failed to create ${backendType} backend: ${message}`);
    this.name = 'BackendCreationError';
    this.backendType = backendType;
    this.cause = cause;
  }
}

/**
 * Factory for creating Scratchpad backends
 *
 * @example
 * ```typescript
 * const backend = BackendFactory.create({ backend: 'sqlite' });
 * await backend.initialize();
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BackendFactory {
  /**
   * Create a backend instance based on configuration
   *
   * @param config - Backend configuration
   * @returns Uninitialized backend instance
   * @throws BackendCreationError if backend type is unknown
   */
  static create(config: ScratchpadBackendConfig = {}): IScratchpadBackend {
    const backendType = config.backend ?? 'file';

    switch (backendType) {
      case 'file':
        return new FileBackend(config.file);

      case 'sqlite':
        return new SQLiteBackend(config.sqlite);

      case 'redis':
        if (!config.redis) {
          throw new BackendCreationError(
            'redis',
            'Redis configuration is required. Provide host, port, etc.'
          );
        }
        return new RedisBackend(config.redis);

      default:
        throw new BackendCreationError(
          backendType as BackendType,
          `Unknown backend type: ${String(backendType)}. Supported types: file, sqlite, redis`
        );
    }
  }

  /**
   * Create and initialize a backend
   *
   * @param config - Backend configuration
   * @returns Initialized backend instance
   * @throws BackendCreationError if creation fails
   * @throws Error if initialization fails
   */
  static async createAndInitialize(
    config: ScratchpadBackendConfig = {}
  ): Promise<IScratchpadBackend> {
    const backend = BackendFactory.create(config);

    try {
      await backend.initialize();
      return backend;
    } catch (error) {
      throw new BackendCreationError(
        config.backend ?? 'file',
        `Initialization failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Get the default backend type
   */
  static getDefaultType(): BackendType {
    return 'file';
  }

  /**
   * Get all supported backend types
   */
  static getSupportedTypes(): readonly BackendType[] {
    return ['file', 'sqlite', 'redis'] as const;
  }

  /**
   * Check if a backend type is supported
   */
  static isSupported(type: string): type is BackendType {
    return ['file', 'sqlite', 'redis'].includes(type);
  }

  /**
   * Create a backend from configuration file
   *
   * Loads configuration from workflow.yaml with environment variable support.
   * Falls back to file backend if no configuration is found.
   *
   * @param baseDir - Base directory for configuration (default: project root)
   * @returns Uninitialized backend instance
   *
   * @example
   * ```typescript
   * const backend = await BackendFactory.createFromConfig();
   * await backend.initialize();
   * ```
   */
  static async createFromConfig(baseDir?: string): Promise<IScratchpadBackend> {
    const config = await loadScratchpadConfig(baseDir);
    return BackendFactory.create(config);
  }

  /**
   * Create and initialize a backend from configuration file
   *
   * Loads configuration from workflow.yaml with environment variable support,
   * then creates and initializes the backend.
   *
   * @param baseDir - Base directory for configuration (default: project root)
   * @returns Initialized backend instance
   * @throws BackendCreationError if creation or initialization fails
   *
   * @example
   * ```typescript
   * const backend = await BackendFactory.createAndInitializeFromConfig();
   * // Backend is ready to use
   * await backend.set('key', { data: 'value' });
   * ```
   */
  static async createAndInitializeFromConfig(baseDir?: string): Promise<IScratchpadBackend> {
    const config = await loadScratchpadConfig(baseDir);
    return BackendFactory.createAndInitialize(config);
  }
}
