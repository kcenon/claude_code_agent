/**
 * Validation utilities for configuration files
 *
 * Provides validation functions with detailed error messages
 * for workflow.yaml and agents.yaml configuration files.
 *
 * @module config/validation
 */

import { z, ZodError, core } from 'zod';
import { CONFIG_SCHEMA_VERSION, WorkflowConfigSchema, AgentsConfigSchema } from './schemas.js';
import { ConfigValidationError } from './errors.js';
import type { FieldError, ValidationResult, WorkflowConfig, AgentsConfig } from './types.js';

/**
 * Zod issue type from core module (Zod 4)
 */
type ZodIssue = core.$ZodIssue;

// ============================================================
// User-Friendly Error Messages
// ============================================================

/**
 * Mapping of common field names to user-friendly descriptions
 */
const FIELD_DESCRIPTIONS: Readonly<Record<string, string>> = {
  version: 'configuration version',
  name: 'name',
  pipeline: 'pipeline configuration',
  stages: 'pipeline stages',
  agent: 'agent name',
  agents: 'agents configuration',
  global: 'global settings',
  quality_gates: 'quality gates',
  notifications: 'notification settings',
  github: 'GitHub settings',
  logging: 'logging configuration',
  monitoring: 'monitoring configuration',
  scratchpad: 'scratchpad configuration',
  model: 'AI model',
  tools: 'available tools',
  inputs: 'input files',
  outputs: 'output files',
  max_attempts: 'maximum retry attempts',
  base_delay_seconds: 'base delay in seconds',
  coverage_threshold: 'code coverage threshold',
  max_complexity: 'maximum code complexity',
};

/**
 * Get user-friendly description for a field path
 * @param path - The dot-separated field path to look up
 * @returns User-friendly description string for the field
 */
function getFieldDescription(path: string): string {
  // Check for exact match
  const exactMatch = FIELD_DESCRIPTIONS[path];
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  // Check for last segment match
  const segments = path.split('.');
  const lastSegment = segments[segments.length - 1];

  // Handle array indices
  if (lastSegment !== undefined) {
    const cleanSegment = lastSegment.replace(/\[\d+\]$/, '');
    const segmentMatch = FIELD_DESCRIPTIONS[cleanSegment];
    if (segmentMatch !== undefined) {
      return segmentMatch;
    }
  }

  return path;
}

/**
 * Format field path for user-friendly display
 *
 * Converts paths like ['pipeline', 'stages', 0, 'name'] to 'pipeline.stages[0].name'
 * @param pathParts - Array of property keys representing the path segments
 * @returns Dot-notation string representation of the field path
 */
function formatFieldPath(pathParts: PropertyKey[]): string {
  if (pathParts.length === 0) {
    return '(root)';
  }

  let result = '';
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (typeof part === 'number') {
      result += `[${String(part)}]`;
    } else if (typeof part === 'symbol') {
      // Convert symbol to string representation
      result += i === 0 ? String(part) : `.${String(part)}`;
    } else if (i === 0) {
      result = String(part);
    } else {
      result += `.${String(part)}`;
    }
  }
  return result;
}

/**
 * Detect input type as a string description
 * @param input - The value whose type to detect
 * @returns Human-readable type description (e.g., 'a list', 'an object', 'a number')
 */
function detectInputType(input: unknown): string {
  if (input === undefined) return 'undefined';
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'a list';
  if (typeof input === 'object') return 'an object';
  if (typeof input === 'string') return 'a text value';
  if (typeof input === 'number') return 'a number';
  if (typeof input === 'boolean') return 'true/false';
  return typeof input;
}

/**
 * Generate user-friendly error message based on Zod issue (Zod 4 API)
 * @param issue - The Zod validation issue to convert
 * @param path - The formatted field path where the error occurred
 * @returns Human-readable error message describing the validation failure
 */
function generateUserFriendlyMessage(issue: ZodIssue, path: string): string {
  const fieldDesc = getFieldDescription(path);
  const code = issue.code;

  switch (code) {
    case 'invalid_type': {
      const typedIssue = issue as core.$ZodIssueInvalidType;
      const expected = typedIssue.expected;
      const inputType = detectInputType(typedIssue.input);
      if (inputType === 'undefined') {
        return `${fieldDesc} is required but was not provided`;
      }
      return `${fieldDesc} must be ${formatTypeDescription(expected)}, but received ${inputType}`;
    }

    case 'invalid_union': {
      return `${fieldDesc} does not match any of the allowed formats`;
    }

    case 'invalid_value': {
      const typedIssue = issue as core.$ZodIssueInvalidValue;
      const values = typedIssue.values.slice(0, 5).map(String).join(', ');
      const more =
        typedIssue.values.length > 5 ? `, ... (${String(typedIssue.values.length - 5)} more)` : '';
      return `${fieldDesc} must be one of: ${values}${more}`;
    }

    case 'too_small': {
      const typedIssue = issue as core.$ZodIssueTooSmall;
      const origin = typedIssue.origin;
      if (origin === 'array') {
        return `${fieldDesc} must have at least ${String(typedIssue.minimum)} item(s)`;
      }
      if (origin === 'string') {
        return `${fieldDesc} must be at least ${String(typedIssue.minimum)} character(s) long`;
      }
      if (origin === 'number' || origin === 'int') {
        return `${fieldDesc} must be at least ${String(typedIssue.minimum)}`;
      }
      return issue.message;
    }

    case 'too_big': {
      const typedIssue = issue as core.$ZodIssueTooBig;
      const origin = typedIssue.origin;
      if (origin === 'array') {
        return `${fieldDesc} must have at most ${String(typedIssue.maximum)} item(s)`;
      }
      if (origin === 'string') {
        return `${fieldDesc} must be at most ${String(typedIssue.maximum)} character(s) long`;
      }
      if (origin === 'number' || origin === 'int') {
        return `${fieldDesc} must be at most ${String(typedIssue.maximum)}`;
      }
      return issue.message;
    }

    case 'invalid_format': {
      const format = issue.format;
      if (format === 'regex') {
        return `${fieldDesc} has an invalid format`;
      }
      if (format === 'email') {
        return `${fieldDesc} must be a valid email address`;
      }
      if (format === 'url') {
        return `${fieldDesc} must be a valid URL`;
      }
      return `${fieldDesc} is invalid: ${issue.message}`;
    }

    case 'custom': {
      return issue.message || `${fieldDesc} is invalid`;
    }

    case 'unrecognized_keys': {
      const keys = issue.keys.slice(0, 3).join(', ');
      const more = issue.keys.length > 3 ? `, ... (${String(issue.keys.length - 3)} more)` : '';
      return `Unknown field(s) in ${fieldDesc}: ${keys}${more}`;
    }

    default:
      return issue.message;
  }
}

/**
 * Format type description for user-friendly display
 * @param type - The Zod type name to format (e.g., 'string', 'number', 'array')
 * @returns Human-readable type description (e.g., 'a text value', 'a number', 'a list')
 */
function formatTypeDescription(type: string): string {
  const typeDescriptions: Readonly<Record<string, string>> = {
    string: 'a text value',
    number: 'a number',
    int: 'a whole number',
    boolean: 'true or false',
    array: 'a list',
    object: 'an object',
    null: 'null',
    undefined: 'not provided',
    date: 'a date',
    bigint: 'a big integer',
    symbol: 'a symbol',
  };

  const description = typeDescriptions[type];
  return description !== undefined ? description : type;
}

/**
 * Generate suggestion for fixing the error (Zod 4 API)
 * @param issue - The Zod validation issue to generate a suggestion for
 * @param path - The formatted field path where the error occurred
 * @returns Actionable suggestion string, or undefined if no suggestion is available
 */
function generateSuggestion(issue: ZodIssue, path: string): string | undefined {
  const code = issue.code;

  switch (code) {
    case 'invalid_type': {
      const typedIssue = issue as core.$ZodIssueInvalidType;
      const inputType = detectInputType(typedIssue.input);
      if (inputType === 'undefined') {
        return `Add the required field '${path}' to your configuration`;
      }
      return `Change the value to ${formatTypeDescription(typedIssue.expected)}`;
    }

    case 'invalid_value': {
      const typedIssue = issue as core.$ZodIssueInvalidValue;
      if (typedIssue.values.length <= 5) {
        return `Use one of: ${typedIssue.values.map(String).join(', ')}`;
      }
      return `Check the documentation for valid values`;
    }

    case 'too_small': {
      const typedIssue = issue as core.$ZodIssueTooSmall;
      if (typedIssue.origin === 'array') {
        return `Add at least ${String(typedIssue.minimum)} item(s) to the list`;
      }
      if (typedIssue.origin === 'string' && typedIssue.minimum === 1) {
        return `Provide a non-empty value`;
      }
      return undefined;
    }

    case 'invalid_format': {
      if (issue.format === 'regex' && path.includes('version')) {
        return `Use semantic versioning format (e.g., 1.0.0)`;
      }
      return undefined;
    }

    case 'unrecognized_keys': {
      return `Remove or rename the unrecognized field(s). Check spelling and refer to documentation.`;
    }

    default:
      return undefined;
  }
}

// ============================================================
// Error Formatting
// ============================================================

/**
 * Format Zod error into field errors with user-friendly messages
 *
 * Converts Zod validation errors into human-readable messages with
 * helpful suggestions for fixing common issues.
 * @param error - The ZodError containing one or more validation issues
 * @returns Array of field errors with paths, messages, and optional suggestions
 */
function formatZodError(error: ZodError): FieldError[] {
  return error.issues.map((issue) => {
    const path = formatFieldPath(issue.path);
    const message = generateUserFriendlyMessage(issue, path);
    const suggestion = generateSuggestion(issue, path);

    return {
      path,
      message,
      ...(suggestion !== undefined ? { suggestion } : {}),
    };
  });
}

// ============================================================
// Generic Validation Function
// ============================================================

/**
 * Validate data against a Zod schema
 * @param schema - The Zod schema to validate against
 * @param data - The raw data to validate
 * @returns Validation result containing either the parsed data or field errors
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
 * @returns The semantic version string of the config schema
 */
export function getConfigSchemaVersion(): string {
  return CONFIG_SCHEMA_VERSION;
}

/**
 * Check if configuration has compatible schema version
 * @param data - The configuration data containing a version field
 * @returns True if the data's major version matches the current schema version
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
