/**
 * Validation utilities for configuration files
 *
 * Provides validation functions with detailed error messages
 * for workflow.yaml and agents.yaml configuration files.
 *
 * FIXME(P3): Zod error messages are sometimes not user-friendly
 * Custom error messages should be added for common validation failures
 * to provide better guidance on how to fix configuration issues.
 *
 * @module config/validation
 */

import { z, ZodError } from 'zod';
import { CONFIG_SCHEMA_VERSION, WorkflowConfigSchema, AgentsConfigSchema } from './schemas.js';
import { ConfigValidationError } from './errors.js';
import type { FieldError, ValidationResult, WorkflowConfig, AgentsConfig } from './types.js';

// ============================================================
// Error Formatting
// ============================================================

/**
 * Format Zod error into field errors
 * Uses same pattern as scratchpad/validation.ts for consistency
 */
function formatZodError(error: ZodError): FieldError[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');

    return {
      path: path || '(root)',
      message: issue.message,
    };
  });
}

// ============================================================
// Generic Validation Function
// ============================================================

/**
 * Validate data against a Zod schema
 */
function validate<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      schemaVersion: CONFIG_SCHEMA_VERSION,
    };
  }

  return {
    success: false,
    errors: formatZodError(result.error),
    schemaVersion: CONFIG_SCHEMA_VERSION,
  };
}

// ============================================================
// Configuration Validation Functions
// ============================================================

/**
 * Validate workflow configuration data
 *
 * @param data - Parsed YAML data to validate
 * @returns Validation result with data or errors
 *
 * @example
 * ```typescript
 * const result = validateWorkflowConfig(parsedYaml);
 * if (result.success) {
 *   console.log('Valid workflow config:', result.data);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateWorkflowConfig(data: unknown): ValidationResult<WorkflowConfig> {
  return validate(WorkflowConfigSchema, data);
}

/**
 * Validate agents configuration data
 *
 * @param data - Parsed YAML data to validate
 * @returns Validation result with data or errors
 *
 * @example
 * ```typescript
 * const result = validateAgentsConfig(parsedYaml);
 * if (result.success) {
 *   console.log('Valid agents config:', result.data);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateAgentsConfig(data: unknown): ValidationResult<AgentsConfig> {
  return validate(AgentsConfigSchema, data);
}

// ============================================================
// Assertion Functions (throw on error)
// ============================================================

/**
 * Assert that data is valid workflow configuration
 *
 * @param data - Data to validate
 * @param filePath - File path for error messages
 * @returns Validated configuration
 * @throws ConfigValidationError if validation fails
 */
export function assertWorkflowConfig(data: unknown, filePath: string): WorkflowConfig {
  const result = validateWorkflowConfig(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new ConfigValidationError(
    'Invalid workflow configuration',
    filePath,
    result.errors ?? [],
    result.schemaVersion
  );
}

/**
 * Assert that data is valid agents configuration
 *
 * @param data - Data to validate
 * @param filePath - File path for error messages
 * @returns Validated configuration
 * @throws ConfigValidationError if validation fails
 */
export function assertAgentsConfig(data: unknown, filePath: string): AgentsConfig {
  const result = validateAgentsConfig(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new ConfigValidationError(
    'Invalid agents configuration',
    filePath,
    result.errors ?? [],
    result.schemaVersion
  );
}

// ============================================================
// Version Utilities
// ============================================================

/**
 * Get current configuration schema version
 */
export function getConfigSchemaVersion(): string {
  return CONFIG_SCHEMA_VERSION;
}

/**
 * Check if configuration has compatible schema version
 */
export function isCompatibleConfigVersion(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const version = (data as Record<string, unknown>).version;
  if (typeof version !== 'string') {
    return false;
  }

  // Simple version check: major version must match
  const currentMajor = CONFIG_SCHEMA_VERSION.split('.')[0];
  const dataMajor = version.split('.')[0];
  return currentMajor === dataMajor;
}
