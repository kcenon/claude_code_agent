/**
 * Safe JSON parsing utilities with Zod schema validation
 *
 * Provides runtime validation for JSON.parse() calls throughout the codebase.
 * Replaces unsafe `JSON.parse(x) as T` patterns with schema-validated parsing.
 *
 * @module utils/SafeJsonParser
 */

import { z, ZodError } from 'zod';
import * as fs from 'fs';

// ============================================================
// Types
// ============================================================

/**
 * Options for safe JSON parsing
 */
export interface SafeJsonParseOptions<T> {
  /**
   * Context information for error messages (e.g., file path, operation)
   */
  context?: string;

  /**
   * Fallback value if validation fails
   * When provided, validation errors return fallback instead of throwing
   */
  fallback?: T;

  /**
   * Log validation errors when using fallback
   */
  logError?: boolean;
}

/**
 * Field error information
 */
export interface JsonFieldError {
  /**
   * Path to the invalid field (dot-separated)
   */
  path: string;

  /**
   * Error message
   */
  message: string;
}

// ============================================================
// Error Classes
// ============================================================

/**
 * Error thrown when JSON parsing or validation fails
 */
export class JsonValidationError extends Error {
  /**
   * Raw JSON string (truncated for safety)
   */
  public readonly rawJson: string;

  /**
   * Schema name for identification
   */
  public readonly schemaName: string;

  /**
   * Zod validation error
   */
  public readonly zodError: ZodError;

  /**
   * Context information (e.g., file path)
   */
  public readonly context: string | undefined;

  /**
   * Structured field errors
   */
  public readonly fieldErrors: readonly JsonFieldError[];

  constructor(
    rawJson: string,
    schemaName: string,
    zodError: ZodError,
    context?: string
  ) {
    const fieldErrors = zodError.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));

    const formattedErrors = fieldErrors
      .map((e) => `  - ${e.path}: ${e.message}`)
      .join('\n');

    const contextInfo = context !== undefined && context !== '' ? ` (${context})` : '';
    super(`JSON validation failed for ${schemaName}${contextInfo}:\n${formattedErrors}`);

    this.name = 'JsonValidationError';
    this.rawJson = rawJson.slice(0, 200);
    this.schemaName = schemaName;
    this.zodError = zodError;
    this.context = context;
    this.fieldErrors = fieldErrors;

    Object.setPrototypeOf(this, JsonValidationError.prototype);
  }

  /**
   * Format errors as a readable string
   */
  public formatErrors(): string {
    if (this.fieldErrors.length === 0) {
      return '  No detailed errors available';
    }
    return this.fieldErrors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
  }
}

/**
 * Error thrown when JSON syntax is invalid
 */
export class JsonSyntaxError extends Error {
  /**
   * Raw JSON string (truncated for safety)
   */
  public readonly rawJson: string;

  /**
   * Context information
   */
  public readonly context: string | undefined;

  /**
   * Original parse error
   */
  public readonly parseError: Error;

  constructor(rawJson: string, parseError: Error, context?: string) {
    const contextInfo = context !== undefined && context !== '' ? ` (${context})` : '';
    super(`Invalid JSON syntax${contextInfo}: ${parseError.message}`);

    this.name = 'JsonSyntaxError';
    this.rawJson = rawJson.slice(0, 200);
    this.context = context;
    this.parseError = parseError;

    Object.setPrototypeOf(this, JsonSyntaxError.prototype);
  }
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Get schema name from Zod schema
 */
function getSchemaName(schema: z.ZodType): string {
  // Try to get description first
  if ('description' in schema && typeof schema.description === 'string') {
    return schema.description;
  }
  return 'unknown';
}

/**
 * Safely parse JSON with Zod schema validation
 *
 * @param jsonString - JSON string to parse
 * @param schema - Zod schema for validation
 * @param options - Parsing options
 * @returns Validated and typed data
 * @throws JsonSyntaxError if JSON syntax is invalid
 * @throws JsonValidationError if validation fails (unless fallback provided)
 *
 * @example
 * ```typescript
 * import { safeJsonParse } from '../utils/SafeJsonParser.js';
 * import { GitHubPRDataSchema } from '../schemas/github.js';
 *
 * const prData = safeJsonParse(result.stdout, GitHubPRDataSchema, {
 *   context: 'gh pr view output'
 * });
 * ```
 */
export function safeJsonParse<T>(
  jsonString: string,
  schema: z.ZodType<T>,
  options?: SafeJsonParseOptions<T>
): T {
  const schemaName = getSchemaName(schema);
  let parsed: unknown;

  // Step 1: Parse JSON
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    throw new JsonSyntaxError(jsonString, error, options?.context);
  }

  // Step 2: Validate against schema
  const result = schema.safeParse(parsed);

  if (result.success) {
    return result.data;
  }

  // Step 3: Handle validation failure
  if (options?.fallback !== undefined) {
    if (options.logError === true) {
      console.warn(
        `[SafeJsonParser] Validation failed for ${schemaName}, using fallback:`,
        result.error.issues
      );
    }
    return options.fallback;
  }

  throw new JsonValidationError(jsonString, schemaName, result.error, options?.context);
}

/**
 * Try to parse JSON with schema validation, returning undefined on failure
 *
 * @param jsonString - JSON string to parse
 * @param schema - Zod schema for validation
 * @param options - Parsing options (only context is used)
 * @returns Validated data or undefined
 *
 * @example
 * ```typescript
 * const data = tryJsonParse(content, MySchema);
 * if (data !== undefined) {
 *   // Use validated data
 * }
 * ```
 */
export function tryJsonParse<T>(
  jsonString: string,
  schema: z.ZodType<T>,
  options?: Pick<SafeJsonParseOptions<T>, 'context'>
): T | undefined {
  try {
    return safeJsonParse(jsonString, schema, options);
  } catch {
    return undefined;
  }
}

/**
 * Asynchronously read and parse a JSON file with schema validation
 *
 * @param filePath - Path to the JSON file
 * @param schema - Zod schema for validation
 * @param options - Parsing options
 * @returns Promise resolving to validated data
 * @throws Error if file cannot be read
 * @throws JsonSyntaxError if JSON syntax is invalid
 * @throws JsonValidationError if validation fails
 *
 * @example
 * ```typescript
 * const config = await safeJsonParseFile(
 *   '/path/to/config.json',
 *   ConfigSchema
 * );
 * ```
 */
export async function safeJsonParseFile<T>(
  filePath: string,
  schema: z.ZodType<T>,
  options?: Omit<SafeJsonParseOptions<T>, 'context'>
): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return safeJsonParse(content, schema, { ...options, context: filePath });
}

/**
 * Synchronously read and parse a JSON file with schema validation
 *
 * @param filePath - Path to the JSON file
 * @param schema - Zod schema for validation
 * @param options - Parsing options
 * @returns Validated data
 *
 * @example
 * ```typescript
 * const config = safeJsonParseFileSync('/path/to/config.json', ConfigSchema);
 * ```
 */
export function safeJsonParseFileSync<T>(
  filePath: string,
  schema: z.ZodType<T>,
  options?: Omit<SafeJsonParseOptions<T>, 'context'>
): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return safeJsonParse(content, schema, { ...options, context: filePath });
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Create a lenient parser that allows additional unknown fields
 *
 * Useful for external API responses where we only care about specific fields
 *
 * @param schema - Base Zod object schema
 * @returns Schema with loose mode enabled
 *
 * @example
 * ```typescript
 * const LenientPRSchema = lenientSchema(z.object({
 *   number: z.number(),
 *   title: z.string()
 * }));
 * // Will accept { number: 1, title: "PR", unknownField: true }
 * ```
 */
export function lenientSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): ReturnType<typeof schema.loose> {
  return schema.loose();
}

/**
 * Create a partial parser that makes all fields optional
 *
 * Useful for parsing configuration files with optional overrides
 *
 * @param schema - Base Zod object schema
 * @returns Schema with all fields optional
 */
export function partialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}
