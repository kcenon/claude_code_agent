/**
 * Configuration file loader
 *
 * Handles loading and parsing of YAML configuration files
 * with proper error handling and validation.
 *
 * TODO(P2): Add configuration caching to avoid repeated file reads
 * Currently each loadConfig call reads from disk. For frequently accessed
 * configs, consider implementing an in-memory cache with TTL.
 *
 * TODO(P3): Support environment-specific configuration overrides
 * Allow config files like workflow.development.yaml to override base config.
 *
 * @module config/loader
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
 * Read and parse a YAML file
 */
async function parseYamlFile(filePath: string): Promise<unknown> {
  if (!existsSync(filePath)) {
    throw new ConfigNotFoundError(`Configuration file not found: ${filePath}`, filePath);
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return yaml.load(content);
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
 * Load workflow configuration
 *
 * @param options - Loading options
 * @returns Validated workflow configuration
 * @throws ConfigNotFoundError if file not found
 * @throws ConfigParseError if YAML parsing fails
 * @throws ConfigValidationError if validation fails
 */
export async function loadWorkflowConfig(options?: LoadConfigOptions): Promise<WorkflowConfig> {
  const filePath = getConfigFilePath('workflow', options?.baseDir);
  const data = await parseYamlFile(filePath);

  if (options?.validate === false) {
    return data as WorkflowConfig;
  }

  return assertWorkflowConfig(data, filePath);
}

/**
 * Load agents configuration
 *
 * @param options - Loading options
 * @returns Validated agents configuration
 * @throws ConfigNotFoundError if file not found
 * @throws ConfigParseError if YAML parsing fails
 * @throws ConfigValidationError if validation fails
 */
export async function loadAgentsConfig(options?: LoadConfigOptions): Promise<AgentsConfig> {
  const filePath = getConfigFilePath('agents', options?.baseDir);
  const data = await parseYamlFile(filePath);

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
