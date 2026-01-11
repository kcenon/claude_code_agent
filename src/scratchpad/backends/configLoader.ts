/**
 * Scratchpad Configuration Loader
 *
 * Loads scratchpad backend configuration from workflow.yaml
 * with environment variable support for connection strings.
 *
 * @module scratchpad/backends/configLoader
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import type { ScratchpadBackendConfig, BackendType } from './types.js';
import { tryGetProjectRoot } from '../../utils/index.js';

// ============================================================
// Types
// ============================================================

/**
 * Raw scratchpad config from YAML (snake_case)
 */
interface RawScratchpadConfig {
  backend?: string;
  file?: {
    base_path?: string;
    file_mode?: number;
    dir_mode?: number;
    format?: string;
  };
  sqlite?: {
    db_path?: string;
    wal_mode?: boolean;
    busy_timeout?: number;
  };
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    prefix?: string;
    ttl?: number;
    connect_timeout?: number;
    max_retries?: number;
    lock?: {
      lock_ttl?: number;
      lock_timeout?: number;
      lock_retry_interval?: number;
    };
    fallback?: {
      enabled?: boolean;
      file_config?: {
        base_path?: string;
        file_mode?: number;
        dir_mode?: number;
        format?: string;
      };
    };
  };
}

/**
 * Raw workflow config structure
 */
interface RawWorkflowConfig {
  scratchpad?: RawScratchpadConfig;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_CONFIG_DIR = '.ad-sdlc/config';
const WORKFLOW_CONFIG_FILE = 'workflow.yaml';

// Environment variable mappings for connection strings
const ENV_VAR_MAPPINGS = {
  redis: {
    host: 'SCRATCHPAD_REDIS_HOST',
    port: 'SCRATCHPAD_REDIS_PORT',
    password: 'SCRATCHPAD_REDIS_PASSWORD',
    db: 'SCRATCHPAD_REDIS_DB',
  },
  sqlite: {
    dbPath: 'SCRATCHPAD_SQLITE_PATH',
  },
  file: {
    basePath: 'SCRATCHPAD_FILE_PATH',
  },
} as const;

// ============================================================
// Environment Variable Resolution
// ============================================================

/**
 * Resolve environment variables in a string value
 *
 * Supports patterns:
 * - ${VAR_NAME} - replaced with env var value
 * - ${VAR_NAME:-default} - replaced with env var or default
 *
 * @param value - String potentially containing env var patterns
 * @returns String with environment variables resolved
 */
export function resolveEnvVars(value: string): string {
  // Pattern: ${VAR_NAME} or ${VAR_NAME:-default}
  return value.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (match, name: string, defaultValue?: string) => {
    const envValue = process.env[name];
    if (envValue !== undefined) {
      return envValue;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return match; // Keep original if no env var and no default
  });
}

/**
 * Recursively resolve environment variables in an object
 *
 * @param obj - Object to process
 * @returns Object with all string values having env vars resolved
 */
function resolveEnvVarsInObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => resolveEnvVarsInObject(item)) as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Get environment variable value with type conversion
 */
function getEnvValue(key: string, type: 'string'): string | undefined;
function getEnvValue(key: string, type: 'number'): number | undefined;
function getEnvValue(key: string, type: 'string' | 'number'): string | number | undefined {
  const value = process.env[key];
  if (value === undefined) {
    return undefined;
  }
  if (type === 'number') {
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }
  return value;
}

// ============================================================
// Configuration Loading
// ============================================================

/**
 * Get the configuration file path
 */
function getConfigFilePath(baseDir?: string): string {
  const root = baseDir ?? tryGetProjectRoot() ?? process.cwd();
  return join(resolve(root), DEFAULT_CONFIG_DIR, WORKFLOW_CONFIG_FILE);
}

/**
 * Load raw scratchpad config from workflow.yaml
 */
async function loadRawConfig(baseDir?: string): Promise<RawScratchpadConfig | undefined> {
  const filePath = getConfigFilePath(baseDir);

  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const config = yaml.load(content) as RawWorkflowConfig;
    return config?.scratchpad;
  } catch {
    // Return undefined if file can't be parsed
    return undefined;
  }
}

/**
 * Remove undefined values from an object
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Convert snake_case raw config to camelCase ScratchpadBackendConfig
 */
function convertToBackendConfig(raw: RawScratchpadConfig): ScratchpadBackendConfig {
  const config: Record<string, unknown> = {};

  // Backend type
  if (raw.backend && ['file', 'sqlite', 'redis'].includes(raw.backend)) {
    config.backend = raw.backend as BackendType;
  }

  // File backend config
  if (raw.file) {
    const fileConfig = removeUndefined({
      basePath: raw.file.base_path,
      fileMode: raw.file.file_mode,
      dirMode: raw.file.dir_mode,
      format: raw.file.format as 'yaml' | 'json' | 'raw' | undefined,
    });
    if (Object.keys(fileConfig).length > 0) {
      config.file = fileConfig;
    }
  }

  // SQLite backend config
  if (raw.sqlite) {
    const sqliteConfig = removeUndefined({
      dbPath: raw.sqlite.db_path,
      walMode: raw.sqlite.wal_mode,
      busyTimeout: raw.sqlite.busy_timeout,
    });
    if (Object.keys(sqliteConfig).length > 0) {
      config.sqlite = sqliteConfig;
    }
  }

  // Redis backend config
  if (raw.redis) {
    const redisBase = removeUndefined({
      host: raw.redis.host,
      port: raw.redis.port,
      password: raw.redis.password,
      db: raw.redis.db,
      prefix: raw.redis.prefix,
      ttl: raw.redis.ttl,
      connectTimeout: raw.redis.connect_timeout,
      maxRetries: raw.redis.max_retries,
    });

    const redisConfig: Record<string, unknown> = { ...redisBase };

    if (raw.redis.lock) {
      const lockConfig = removeUndefined({
        lockTtl: raw.redis.lock.lock_ttl,
        lockTimeout: raw.redis.lock.lock_timeout,
        lockRetryInterval: raw.redis.lock.lock_retry_interval,
      });
      if (Object.keys(lockConfig).length > 0) {
        redisConfig.lock = lockConfig;
      }
    }

    if (raw.redis.fallback) {
      const fallbackConfig: Record<string, unknown> = {};
      if (raw.redis.fallback.enabled !== undefined) {
        fallbackConfig.enabled = raw.redis.fallback.enabled;
      }
      if (raw.redis.fallback.file_config) {
        const fileConfig = removeUndefined({
          basePath: raw.redis.fallback.file_config.base_path,
          fileMode: raw.redis.fallback.file_config.file_mode,
          dirMode: raw.redis.fallback.file_config.dir_mode,
          format: raw.redis.fallback.file_config.format as 'yaml' | 'json' | 'raw' | undefined,
        });
        if (Object.keys(fileConfig).length > 0) {
          fallbackConfig.fileConfig = fileConfig;
        }
      }
      if (Object.keys(fallbackConfig).length > 0) {
        redisConfig.fallback = fallbackConfig;
      }
    }

    if (Object.keys(redisConfig).length > 0) {
      config.redis = redisConfig;
    }
  }

  return config as ScratchpadBackendConfig;
}

/**
 * Apply environment variable overrides to config
 */
function applyEnvVarOverrides(config: ScratchpadBackendConfig): ScratchpadBackendConfig {
  const result: Record<string, unknown> = { ...config };

  // Check for backend type override
  const backendType = process.env['SCRATCHPAD_BACKEND'];
  if (backendType && ['file', 'sqlite', 'redis'].includes(backendType)) {
    result.backend = backendType as BackendType;
  }

  // Apply Redis env vars
  const redisHost = getEnvValue(ENV_VAR_MAPPINGS.redis.host, 'string');
  const redisPort = getEnvValue(ENV_VAR_MAPPINGS.redis.port, 'number');
  const redisPassword = getEnvValue(ENV_VAR_MAPPINGS.redis.password, 'string');
  const redisDb = getEnvValue(ENV_VAR_MAPPINGS.redis.db, 'number');

  if (redisHost || redisPort || redisPassword || redisDb !== undefined) {
    const existingRedis = (config.redis ?? {}) as Record<string, unknown>;
    const redisOverrides: Record<string, unknown> = {};
    if (redisHost) redisOverrides.host = redisHost;
    if (redisPort) redisOverrides.port = redisPort;
    if (redisPassword) redisOverrides.password = redisPassword;
    if (redisDb !== undefined) redisOverrides.db = redisDb;
    result.redis = { ...existingRedis, ...redisOverrides };
  }

  // Apply SQLite env vars
  const sqlitePath = getEnvValue(ENV_VAR_MAPPINGS.sqlite.dbPath, 'string');
  if (sqlitePath) {
    const existingSqlite = (config.sqlite ?? {}) as Record<string, unknown>;
    result.sqlite = { ...existingSqlite, dbPath: sqlitePath };
  }

  // Apply file backend env vars
  const filePath = getEnvValue(ENV_VAR_MAPPINGS.file.basePath, 'string');
  if (filePath) {
    const existingFile = (config.file ?? {}) as Record<string, unknown>;
    result.file = { ...existingFile, basePath: filePath };
  }

  return result as ScratchpadBackendConfig;
}

// ============================================================
// Public API
// ============================================================

/**
 * Load scratchpad configuration from workflow.yaml with environment variable support
 *
 * Configuration is loaded in the following priority (higher overrides lower):
 * 1. Environment variables (SCRATCHPAD_*)
 * 2. workflow.yaml scratchpad section (with ${VAR} expansion)
 * 3. Default values (file backend)
 *
 * @param baseDir - Base directory for configuration (default: project root)
 * @returns Scratchpad backend configuration
 *
 * @example
 * ```typescript
 * // Load from default location
 * const config = await loadScratchpadConfig();
 *
 * // Load from specific directory
 * const config = await loadScratchpadConfig('/path/to/project');
 *
 * // Use with BackendFactory
 * const backend = BackendFactory.create(config);
 * ```
 */
export async function loadScratchpadConfig(baseDir?: string): Promise<ScratchpadBackendConfig> {
  // Load raw config from file
  const rawConfig = await loadRawConfig(baseDir);

  // Start with default config
  let config: ScratchpadBackendConfig = {};

  // Convert and merge file config if present
  if (rawConfig) {
    // Resolve env vars in raw config first
    const resolvedRaw = resolveEnvVarsInObject(rawConfig);
    config = convertToBackendConfig(resolvedRaw);
  }

  // Apply environment variable overrides (highest priority)
  config = applyEnvVarOverrides(config);

  return config;
}

/**
 * Check if scratchpad configuration exists in workflow.yaml
 *
 * @param baseDir - Base directory for configuration
 * @returns True if scratchpad config is defined
 */
export async function hasScratchpadConfig(baseDir?: string): Promise<boolean> {
  const rawConfig = await loadRawConfig(baseDir);
  return rawConfig !== undefined;
}

/**
 * Get the list of supported environment variables for scratchpad configuration
 *
 * @returns Environment variable documentation
 */
export function getScratchpadEnvVars(): Record<string, string> {
  return {
    SCRATCHPAD_BACKEND: 'Backend type: file | sqlite | redis',
    SCRATCHPAD_REDIS_HOST: 'Redis server host',
    SCRATCHPAD_REDIS_PORT: 'Redis server port',
    SCRATCHPAD_REDIS_PASSWORD: 'Redis authentication password',
    SCRATCHPAD_REDIS_DB: 'Redis database number',
    SCRATCHPAD_SQLITE_PATH: 'SQLite database file path',
    SCRATCHPAD_FILE_PATH: 'File backend base directory path',
  };
}
