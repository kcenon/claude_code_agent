/**
 * Configuration file loader
 *
 * Handles loading and parsing of YAML configuration files
 * with proper error handling, validation, and caching.
 *
 * Features:
 * - Caching to avoid repeated file reads
 * - Environment-specific configuration overrides (e.g., workflow.development.yaml)
 * - Deep merging of configuration objects
 *
 * @module config/loader
 */

import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import yaml from 'js-yaml';
import { ConfigParseError, ConfigNotFoundError } from './errors.js';
import { tryGetProjectRoot } from '../utils/index.js';
import {
  validateWorkflowConfig,
  validateAgentsConfig,
  assertWorkflowConfig,
  assertAgentsConfig,
} from './validation.js';
import type {
  ConfigFileType,
  LoadConfigOptions,
  WorkflowConfig,
  AgentsConfig,
  ValidationResult,
  FileValidationResult,
  ValidationReport,
} from './types.js';

// ============================================================
// Cache Types and State
// ============================================================

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  /** Cached data */
  readonly data: T;
  /** Cache timestamp */
  readonly timestamp: number;
  /** File modification time at cache time */
  readonly mtime: number;
}

/**
 * Configuration cache for avoiding repeated file reads
 */
const configCache = new Map<string, CacheEntry<unknown>>();

/**
 * Cache TTL in milliseconds (default: 5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================
// Constants
// ============================================================

/**
 * Default configuration directory
 */
const DEFAULT_CONFIG_DIR = '.ad-sdlc/config';

/**
 * Configuration file names
 */
const CONFIG_FILES: Record<ConfigFileType, string> = {
  workflow: 'workflow.yaml',
  agents: 'agents.yaml',
};

/**
 * Supported environment names for configuration overrides
 */
export type ConfigEnvironment =
  | 'development'
  | 'staging'
  | 'production'
  | 'test'
  | 'local'
  | (string & {});

// ============================================================
// Environment Detection
// ============================================================

/**
 * Get the current environment name from environment variables
 *
 * Checks the following environment variables in order:
 * 1. AD_SDLC_ENV
 * 2. NODE_ENV
 *
 * @returns Environment name or undefined if not set
 */
export function getCurrentEnvironment(): ConfigEnvironment | undefined {
  return process.env.AD_SDLC_ENV ?? process.env.NODE_ENV ?? undefined;
}

/**
 * Get the environment-specific configuration file path
 *
 * For a base file like 'workflow.yaml' and environment 'development',
 * returns 'workflow.development.yaml'
 *
 * @param basePath - Base configuration file path
 * @param env - Environment name
 * @returns Environment-specific file path
 */
export function getEnvConfigFilePath(basePath: string, env: ConfigEnvironment): string {
  const dir = dirname(basePath);
  const base = basename(basePath, '.yaml');
  return join(dir, `${base}.${env}.yaml`);
}

// ============================================================
// Deep Merge Utility
// ============================================================

/**
 * Check if a value is a plain object (not array, null, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep merge two configuration objects
 *
 * Override configuration values take precedence over base values.
 * Arrays are replaced, not merged.
 * Objects are recursively merged.
 *
 * @param base - Base configuration
 * @param override - Override configuration
 * @returns Merged configuration
 */
export function deepMergeConfig<T>(base: T, override: Partial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override as T;
  }

  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseValue = result[key];
    const overrideValue = (override as Record<string, unknown>)[key];

    if (overrideValue === undefined) {
      continue;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMergeConfig(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }

  return result as T;
}

// ============================================================
// Cache Management
// ============================================================

/**
 * Check if a cache entry is valid
 *
 * Cache is invalid if:
 * - Entry doesn't exist
 * - TTL has expired
 * - File has been modified since caching
 */
function isCacheValid(filePath: string): boolean {
  const entry = configCache.get(filePath);
  if (!entry) {
    return false;
  }

  // Check TTL
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) {
    return false;
  }

  // Check if file has been modified
  try {
    const stats = statSync(filePath);
    return stats.mtimeMs === entry.mtime;
  } catch {
    return false;
  }
}

/**
 * Get cached configuration if valid
 */
function getCachedConfig(filePath: string): unknown {
  if (!isCacheValid(filePath)) {
    return undefined;
  }
  return configCache.get(filePath)?.data;
}

/**
 * Store configuration in cache
 */
function setCachedConfig(filePath: string, data: unknown): void {
  try {
    const stats = statSync(filePath);
    configCache.set(filePath, {
      data,
      timestamp: Date.now(),
      mtime: stats.mtimeMs,
    });
  } catch {
    // If we can't stat the file, don't cache
  }
}

/**
 * Clear all cached configurations
 *
 * Call this when configuration files may have changed externally.
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Invalidate a specific configuration file from cache
 *
 * @param filePath - Path to the configuration file to invalidate
 */
export function invalidateConfigCache(filePath: string): void {
  configCache.delete(filePath);
}

/**
 * Get cache statistics for debugging
 *
 * @returns Cache statistics including size and entry details
 */
export function getConfigCacheStats(): {
  size: number;
  entries: Array<{ path: string; age: number }>;
} {
  const now = Date.now();
  const entries: Array<{ path: string; age: number }> = [];
  for (const [path, entry] of configCache) {
    entries.push({ path, age: now - entry.timestamp });
  }
  return { size: configCache.size, entries };
}

// ============================================================
// File Path Resolution
// ============================================================

/**
 * Get the configuration directory path
 */
export function getConfigDir(baseDir?: string): string {
  return resolve(baseDir ?? tryGetProjectRoot() ?? process.cwd(), DEFAULT_CONFIG_DIR);
}

/**
 * Get the full path to a configuration file
 */
export function getConfigFilePath(type: ConfigFileType, baseDir?: string): string {
  return join(getConfigDir(baseDir), CONFIG_FILES[type]);
}

/**
 * Get paths to all configuration files
 */
export function getAllConfigFilePaths(baseDir?: string): Record<ConfigFileType, string> {
  const configDir = getConfigDir(baseDir);
  return {
    workflow: join(configDir, CONFIG_FILES.workflow),
    agents: join(configDir, CONFIG_FILES.agents),
  };
}

// ============================================================
// File Loading
// ============================================================

/**
 * Read and parse a YAML file with caching support
 *
 * Uses in-memory cache to avoid repeated file reads.
 * Cache is automatically invalidated when:
 * - File modification time changes
 * - TTL (5 minutes) expires
 *
 * @param filePath - Path to the YAML file
 * @param useCache - Whether to use cache (default: true)
 */
async function parseYamlFile(filePath: string, useCache = true): Promise<unknown> {
  if (!existsSync(filePath)) {
    throw new ConfigNotFoundError(`Configuration file not found: ${filePath}`, filePath);
  }

  // Check cache first
  if (useCache) {
    const cached = getCachedConfig(filePath);
    if (cached !== undefined) {
      return cached;
    }
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = yaml.load(content);

    // Store in cache
    if (useCache) {
      setCachedConfig(filePath, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      throw error;
    }
    throw new ConfigParseError(
      `Failed to parse YAML file: ${filePath}`,
      filePath,
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================
// Configuration Loading
// ============================================================

/**
 * Determine the effective environment for configuration loading
 *
 * @param options - Loading options
 * @returns Environment name or undefined if disabled
 */
function getEffectiveEnvironment(options?: LoadConfigOptions): string | undefined {
  // Explicitly disabled
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- backward compatibility support
  if (options?.environment === false || options?.useEnvOverrides === false) {
    return undefined;
  }

  // Explicitly specified
  if (typeof options?.environment === 'string') {
    return options.environment;
  }

  // Auto-detect from environment variables
  return getCurrentEnvironment();
}

/**
 * Load configuration with optional environment-specific overrides
 *
 * @param basePath - Base configuration file path
 * @param env - Environment name (if applicable)
 * @returns Parsed and optionally merged configuration
 */
async function loadConfigWithEnvOverride(
  basePath: string,
  env?: string
): Promise<{ data: unknown; envPath?: string }> {
  // Load base configuration
  const baseData = await parseYamlFile(basePath);

  // If no environment specified, return base only
  if (env === undefined || env === '') {
    return { data: baseData };
  }

  // Check for environment-specific override
  const envPath = getEnvConfigFilePath(basePath, env);
  if (!existsSync(envPath)) {
    return { data: baseData };
  }

  // Load and merge environment-specific configuration
  try {
    const envData = await parseYamlFile(envPath);
    const mergedData = deepMergeConfig(baseData, envData as Partial<typeof baseData>);
    return { data: mergedData, envPath };
  } catch (error) {
    // If env config fails to parse, log warning and use base
    if (error instanceof ConfigParseError) {
      console.warn(
        `Warning: Failed to parse environment config ${envPath}, using base config only: ${error.message}`
      );
      return { data: baseData };
    }
    throw error;
  }
}

/**
 * Load workflow configuration
 *
 * Supports environment-specific configuration overrides. When an environment
 * is detected (from AD_SDLC_ENV, NODE_ENV, or explicitly passed), the loader
 * will look for a file named `workflow.{env}.yaml` and deep merge it with
 * the base `workflow.yaml`.
 *
 * Configuration override precedence (highest to lowest):
 * 1. Environment-specific config (e.g., workflow.development.yaml)
 * 2. Base config (workflow.yaml)
 *
 * @param options - Loading options
 * @returns Validated workflow configuration
 * @throws ConfigNotFoundError if base file not found
 * @throws ConfigParseError if YAML parsing fails
 * @throws ConfigValidationError if validation fails
 *
 * @example
 * ```typescript
 * // Auto-detect environment from NODE_ENV
 * const config = await loadWorkflowConfig();
 *
 * // Explicitly specify environment
 * const devConfig = await loadWorkflowConfig({ environment: 'development' });
 *
 * // Disable environment overrides
 * const baseConfig = await loadWorkflowConfig({ environment: false });
 * ```
 */
export async function loadWorkflowConfig(options?: LoadConfigOptions): Promise<WorkflowConfig> {
  const filePath = getConfigFilePath('workflow', options?.baseDir);
  const env = getEffectiveEnvironment(options);
  const { data } = await loadConfigWithEnvOverride(filePath, env);

  if (options?.validate === false) {
    return data as WorkflowConfig;
  }

  return assertWorkflowConfig(data, filePath);
}

/**
 * Load agents configuration
 *
 * Supports environment-specific configuration overrides. When an environment
 * is detected (from AD_SDLC_ENV, NODE_ENV, or explicitly passed), the loader
 * will look for a file named `agents.{env}.yaml` and deep merge it with
 * the base `agents.yaml`.
 *
 * @param options - Loading options
 * @returns Validated agents configuration
 * @throws ConfigNotFoundError if base file not found
 * @throws ConfigParseError if YAML parsing fails
 * @throws ConfigValidationError if validation fails
 *
 * @example
 * ```typescript
 * // Auto-detect environment
 * const config = await loadAgentsConfig();
 *
 * // Explicitly specify environment
 * const devConfig = await loadAgentsConfig({ environment: 'development' });
 * ```
 */
export async function loadAgentsConfig(options?: LoadConfigOptions): Promise<AgentsConfig> {
  const filePath = getConfigFilePath('agents', options?.baseDir);
  const env = getEffectiveEnvironment(options);
  const { data } = await loadConfigWithEnvOverride(filePath, env);

  if (options?.validate === false) {
    return data as AgentsConfig;
  }

  return assertAgentsConfig(data, filePath);
}

/**
 * Load all configuration files
 *
 * @param options - Loading options
 * @returns Both workflow and agents configurations
 */
export async function loadAllConfigs(
  options?: LoadConfigOptions
): Promise<{ workflow: WorkflowConfig; agents: AgentsConfig }> {
  const [workflow, agents] = await Promise.all([
    loadWorkflowConfig(options),
    loadAgentsConfig(options),
  ]);

  return { workflow, agents };
}

// ============================================================
// Validation Without Loading
// ============================================================

/**
 * Validate a specific configuration file
 *
 * @param filePath - Path to the configuration file
 * @returns Validation result
 */
export async function validateConfigFile(filePath: string): Promise<FileValidationResult> {
  try {
    const data = await parseYamlFile(filePath);

    // Determine file type from path
    const isWorkflow = filePath.endsWith('workflow.yaml');
    const isAgents = filePath.endsWith('agents.yaml');

    let result: ValidationResult<WorkflowConfig | AgentsConfig>;

    if (isWorkflow) {
      result = validateWorkflowConfig(data);
    } else if (isAgents) {
      result = validateAgentsConfig(data);
    } else {
      // Try both schemas
      const workflowResult = validateWorkflowConfig(data);
      const agentsResult = validateAgentsConfig(data);

      // Use the one that succeeds, or the one with fewer errors
      if (workflowResult.success) {
        result = workflowResult;
      } else if (agentsResult.success) {
        result = agentsResult;
      } else {
        const workflowErrors = workflowResult.errors?.length ?? 0;
        const agentsErrors = agentsResult.errors?.length ?? 0;
        result = workflowErrors <= agentsErrors ? workflowResult : agentsResult;
      }
    }

    return {
      filePath,
      valid: result.success,
      errors: result.errors ?? [],
      schemaVersion: result.schemaVersion,
    };
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      return {
        filePath,
        valid: false,
        errors: [{ path: '(file)', message: 'Configuration file not found' }],
        schemaVersion: '1.0.0',
      };
    }
    if (error instanceof ConfigParseError) {
      return {
        filePath,
        valid: false,
        errors: [{ path: '(file)', message: `YAML parse error: ${error.message}` }],
        schemaVersion: '1.0.0',
      };
    }
    throw error;
  }
}

/**
 * Validate all configuration files
 *
 * @param baseDir - Base directory for configuration
 * @returns Validation report for all files
 */
export async function validateAllConfigs(baseDir?: string): Promise<ValidationReport> {
  const paths = getAllConfigFilePaths(baseDir);
  const results = await Promise.all([
    validateConfigFile(paths.workflow),
    validateConfigFile(paths.agents),
  ]);

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return {
    valid: results.every((r) => r.valid),
    files: results,
    totalErrors,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if configuration files exist
 */
export function configFilesExist(baseDir?: string): { workflow: boolean; agents: boolean } {
  const paths = getAllConfigFilePaths(baseDir);
  return {
    workflow: existsSync(paths.workflow),
    agents: existsSync(paths.agents),
  };
}

/**
 * Determine configuration file type from path
 */
export function getConfigFileType(filePath: string): ConfigFileType | null {
  if (filePath.endsWith('workflow.yaml')) {
    return 'workflow';
  }
  if (filePath.endsWith('agents.yaml')) {
    return 'agents';
  }
  return null;
}
