/**
 * Validation utilities for Scratchpad data entities
 *
 * Provides validation functions with detailed error messages
 * for all state entities used in the AD-SDLC system.
 *
 * @module scratchpad/validation
 */

import { z, ZodError } from 'zod';
import {
  SCHEMA_VERSION,
  CollectedInfoSchema,
  WorkOrderSchema,
  ImplementationResultSchema,
  PRReviewResultSchema,
  ControllerStateSchema,
  type CollectedInfo,
  type WorkOrder,
  type ImplementationResult,
  type PRReviewResult,
  type ControllerState,
} from './schemas.js';

// ============================================================
// Validation Error Types
// ============================================================

/**
 * Individual field validation error
 */
export interface FieldError {
  /** Field path (e.g., 'requirements.functional[0].title') */
  readonly path: string;
  /** Error message */
  readonly message: string;
}

/**
 * Validation result
 */
export interface ValidationResult<T> {
  /** Whether validation passed */
  readonly success: boolean;
  /** Validated and transformed data (if success) */
  readonly data?: T;
  /** List of validation errors (if failure) */
  readonly errors?: readonly FieldError[];
  /** Schema version used for validation */
  readonly schemaVersion: string;
}

// ============================================================
// Error Formatting
// ============================================================

/**
 * Format Zod error into field errors
 *
 * @param error - Zod validation error
 * @returns Array of formatted field errors
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
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with data or errors
 */
function validate<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  return {
    success: false,
    errors: formatZodError(result.error),
    schemaVersion: SCHEMA_VERSION,
  };
}

// ============================================================
// Entity-Specific Validation Functions
// ============================================================

/**
 * Validate CollectedInfo data
 *
 * @param data - Data to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateCollectedInfo({
 *   projectId: '001',
 *   status: 'collecting',
 *   project: { name: 'My Project', description: 'Description' },
 *   // ...
 * });
 *
 * if (result.success) {
 *   console.log('Valid:', result.data);
 * } else {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 */
export function validateCollectedInfo(data: unknown): ValidationResult<CollectedInfo> {
  return validate(CollectedInfoSchema, data);
}

/**
 * Validate WorkOrder data
 *
 * @param data - Data to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateWorkOrder({
 *   orderId: 'WO-001',
 *   issueId: '123',
 *   issueUrl: 'https://github.com/repo/issues/123',
 *   // ...
 * });
 * ```
 */
export function validateWorkOrder(data: unknown): ValidationResult<WorkOrder> {
  return validate(WorkOrderSchema, data);
}

/**
 * Validate ImplementationResult data
 *
 * @param data - Data to validate
 * @returns Validation result
 */
export function validateImplementationResult(
  data: unknown
): ValidationResult<ImplementationResult> {
  return validate(ImplementationResultSchema, data);
}

/**
 * Validate PRReviewResult data
 *
 * @param data - Data to validate
 * @returns Validation result
 */
export function validatePRReviewResult(data: unknown): ValidationResult<PRReviewResult> {
  return validate(PRReviewResultSchema, data);
}

/**
 * Validate ControllerState data
 *
 * @param data - Data to validate
 * @returns Validation result
 */
export function validateControllerState(data: unknown): ValidationResult<ControllerState> {
  return validate(ControllerStateSchema, data);
}

// ============================================================
// Assertion Functions (throw on error)
// ============================================================

/**
 * Validation error thrown when assertion fails
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: readonly FieldError[],
    public readonly schemaVersion: string
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }

  /**
   * Format errors as a readable string
   */
  public formatErrors(): string {
    return this.errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
  }
}

/**
 * Assert that data is valid CollectedInfo
 *
 * @param data - Data to validate
 * @returns Validated data
 * @throws SchemaValidationError if validation fails
 */
export function assertCollectedInfo(data: unknown): CollectedInfo {
  const result = validateCollectedInfo(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new SchemaValidationError(
    'Invalid CollectedInfo data',
    result.errors ?? [],
    result.schemaVersion
  );
}

/**
 * Assert that data is valid WorkOrder
 *
 * @param data - Data to validate
 * @returns Validated data
 * @throws SchemaValidationError if validation fails
 */
export function assertWorkOrder(data: unknown): WorkOrder {
  const result = validateWorkOrder(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new SchemaValidationError(
    'Invalid WorkOrder data',
    result.errors ?? [],
    result.schemaVersion
  );
}

/**
 * Assert that data is valid ImplementationResult
 *
 * @param data - Data to validate
 * @returns Validated data
 * @throws SchemaValidationError if validation fails
 */
export function assertImplementationResult(data: unknown): ImplementationResult {
  const result = validateImplementationResult(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new SchemaValidationError(
    'Invalid ImplementationResult data',
    result.errors ?? [],
    result.schemaVersion
  );
}

/**
 * Assert that data is valid PRReviewResult
 *
 * @param data - Data to validate
 * @returns Validated data
 * @throws SchemaValidationError if validation fails
 */
export function assertPRReviewResult(data: unknown): PRReviewResult {
  const result = validatePRReviewResult(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new SchemaValidationError(
    'Invalid PRReviewResult data',
    result.errors ?? [],
    result.schemaVersion
  );
}

/**
 * Assert that data is valid ControllerState
 *
 * @param data - Data to validate
 * @returns Validated data
 * @throws SchemaValidationError if validation fails
 */
export function assertControllerState(data: unknown): ControllerState {
  const result = validateControllerState(data);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  throw new SchemaValidationError(
    'Invalid ControllerState data',
    result.errors ?? [],
    result.schemaVersion
  );
}

// ============================================================
// Schema Version Utilities
// ============================================================

/**
 * Get current schema version
 *
 * @returns Current schema version string
 */
export function getSchemaVersion(): string {
  return SCHEMA_VERSION;
}

/**
 * Check if data has compatible schema version
 *
 * @param data - Data to check
 * @returns Whether version is compatible
 */
export function isCompatibleVersion(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const schemaVersion = (data as Record<string, unknown>).schemaVersion;
  if (typeof schemaVersion !== 'string') {
    // No version field - assume compatible (for migration)
    return true;
  }

  // Simple version check: major version must match
  const currentMajor = SCHEMA_VERSION.split('.')[0];
  const dataMajor = schemaVersion.split('.')[0];
  return currentMajor === dataMajor;
}

/**
 * Add schema version to data if missing
 *
 * @param data - Data to augment
 * @returns Data with schema version
 */
export function ensureSchemaVersion<T extends object>(data: T): T & { schemaVersion: string } {
  if ('schemaVersion' in data) {
    return data as T & { schemaVersion: string };
  }
  return { ...data, schemaVersion: SCHEMA_VERSION };
}
