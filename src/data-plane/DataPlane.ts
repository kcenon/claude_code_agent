/**
 * Data Plane Facade
 *
 * Provides a unified, high-level API for Data-Plane operations
 * including scratchpad access, schema validation, and data
 * serialization mapping (snake_case ↔ camelCase).
 *
 * This facade delegates to underlying modules (Scratchpad, validation,
 * schemas) while providing:
 * - Type-safe data access with automatic validation
 * - Centralized error handling with consistent DataPlaneError types
 * - Serialization mapping at the layer boundary
 *
 * @module data-plane/DataPlane
 */

import { AppError } from '../errors/AppError.js';
import { DataPlaneErrorCodes } from '../errors/codes.js';
import { ErrorSeverity } from '../errors/types.js';
import type { AppErrorOptions, ErrorCategory } from '../errors/types.js';
import {
  getScratchpad,
  resetScratchpad,
  validateCollectedInfo,
  validateWorkOrder,
  validateImplementationResult,
  validatePRReviewResult,
  validateControllerState,
  getSchemaVersion,
  isCompatibleVersion,
} from '../scratchpad/index.js';
import type {
  Scratchpad,
  ScratchpadOptions,
  CollectedInfo,
  WorkOrder,
  ImplementationResult,
  PRReviewResult,
  ControllerState,
  ProjectInfo,
  ReadOptions,
  AtomicWriteOptions,
  SchemaValidationResult,
} from '../scratchpad/index.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Base error for all Data-Plane operations
 */
export class DataPlaneError extends AppError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, {
      severity: options.severity ?? ErrorSeverity.HIGH,
      category: options.category ?? 'recoverable',
      ...options,
    });
    this.name = 'DataPlaneError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error for data read/write operations
 */
export class DataAccessError extends DataPlaneError {
  constructor(
    operation: 'read' | 'write' | 'not_found',
    message: string,
    options: AppErrorOptions = {}
  ) {
    const codeMap = {
      read: DataPlaneErrorCodes.DPL_READ_ERROR,
      write: DataPlaneErrorCodes.DPL_WRITE_ERROR,
      not_found: DataPlaneErrorCodes.DPL_NOT_FOUND,
    };
    super(codeMap[operation], message, {
      context: { operation, ...options.context },
      ...options,
    });
    this.name = 'DataAccessError';
  }
}

/**
 * Error for schema validation failures
 */
export class DataValidationError extends DataPlaneError {
  constructor(
    schemaName: string,
    reason: 'validation' | 'schema_mismatch',
    message: string,
    options: AppErrorOptions = {}
  ) {
    const codeMap = {
      validation: DataPlaneErrorCodes.DPL_VALIDATION_ERROR,
      schema_mismatch: DataPlaneErrorCodes.DPL_SCHEMA_MISMATCH,
    };
    super(codeMap[reason], message, {
      context: { schemaName, ...options.context },
      ...options,
    });
    this.name = 'DataValidationError';
  }
}

/**
 * Error for serialization mapping failures
 */
export class SerializationError extends DataPlaneError {
  constructor(message: string, options: AppErrorOptions = {}) {
    super(DataPlaneErrorCodes.DPL_SERIALIZATION_ERROR, message, options);
    this.name = 'SerializationError';
  }
}

// ---------------------------------------------------------------------------
// Serialization mapping utilities
// ---------------------------------------------------------------------------

/**
 * Convert a camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Convert a snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Recursively convert all keys in an object from camelCase to snake_case
 */
export function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[camelToSnake(key)] = toSnakeCase(value);
  }
  return result;
}

/**
 * Recursively convert all keys in an object from snake_case to camelCase
 */
export function toCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[snakeToCamel(key)] = toCamelCase(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// DataPlane options
// ---------------------------------------------------------------------------

/** Options for creating a DataPlane instance */
export interface DataPlaneOptions {
  scratchpad?: ScratchpadOptions;
}

// ---------------------------------------------------------------------------
// DataPlane facade
// ---------------------------------------------------------------------------

/**
 * Data-Plane facade providing unified data access, schema validation,
 * and serialization mapping.
 *
 * Follows the singleton pattern used by ControlPlane and other modules.
 *
 * @example
 * ```typescript
 * const dp = getDataPlane();
 *
 * // Type-safe data access with automatic validation
 * const info = await dp.readCollectedInfo('project-1');
 * await dp.writeWorkOrder('project-1', 'order-1', workOrder);
 *
 * // Serialization mapping
 * const snakeData = dp.serializeForSRS(camelCaseData);
 * const camelData = dp.deserializeFromSRS(snakeCaseData);
 *
 * // Schema version check
 * const compatible = dp.isSchemaCompatible('1.0.0');
 * ```
 */
export class DataPlane {
  private readonly scratchpad: Scratchpad;

  constructor(options: DataPlaneOptions = {}) {
    this.scratchpad = getScratchpad(options.scratchpad);
  }

  // -------------------------------------------------------------------------
  // Project management
  // -------------------------------------------------------------------------

  /**
   * Initialize a new project in the scratchpad
   *
   * @param projectId - Unique project identifier
   * @param name - Human-readable project name
   * @returns Project info
   */
  async initializeProject(projectId: string, name: string): Promise<ProjectInfo> {
    try {
      return await this.scratchpad.initializeProject(projectId, name);
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_INIT_ERROR,
        `Failed to initialize project: ${projectId}`,
        { projectId, name }
      );
    }
  }

  /**
   * Generate a new unique project ID
   *
   * @returns Generated project ID
   */
  async generateProjectId(): Promise<string> {
    try {
      return await this.scratchpad.generateProjectId();
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_READ_ERROR,
        'Failed to generate project ID',
        {}
      );
    }
  }

  /**
   * List all known project IDs
   *
   * @returns Array of project IDs
   */
  async listProjectIds(): Promise<string[]> {
    try {
      return await this.scratchpad.listProjectIds();
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_READ_ERROR,
        'Failed to list project IDs',
        {}
      );
    }
  }

  // -------------------------------------------------------------------------
  // Type-safe data access with validation
  // -------------------------------------------------------------------------

  /**
   * Read and validate collected info for a project
   *
   * @param projectId - Project identifier
   * @returns Validated collected info, or null if not found
   */
  async readCollectedInfo(projectId: string): Promise<CollectedInfo | null> {
    return this.readAndValidate(
      projectId,
      () => this.scratchpad.getCollectedInfoPath(projectId),
      validateCollectedInfo,
      'CollectedInfo'
    );
  }

  /**
   * Validate and write collected info for a project
   *
   * @param projectId - Project identifier
   * @param data - Collected info data
   */
  async writeCollectedInfo(projectId: string, data: CollectedInfo): Promise<void> {
    this.validateBeforeWrite(validateCollectedInfo, data, 'CollectedInfo');
    await this.writeData(this.scratchpad.getCollectedInfoPath(projectId), data, 'CollectedInfo', {
      projectId,
    });
  }

  /**
   * Read and validate a work order
   *
   * @param projectId - Project identifier
   * @param orderId - Work order identifier
   * @returns Validated work order, or null if not found
   */
  async readWorkOrder(projectId: string, orderId: string): Promise<WorkOrder | null> {
    return this.readAndValidate(
      projectId,
      () => this.scratchpad.getWorkOrderPath(projectId, orderId),
      validateWorkOrder,
      'WorkOrder'
    );
  }

  /**
   * Validate and write a work order
   *
   * @param projectId - Project identifier
   * @param orderId - Work order identifier
   * @param data - Work order data
   */
  async writeWorkOrder(projectId: string, orderId: string, data: WorkOrder): Promise<void> {
    this.validateBeforeWrite(validateWorkOrder, data, 'WorkOrder');
    await this.writeData(this.scratchpad.getWorkOrderPath(projectId, orderId), data, 'WorkOrder', {
      projectId,
      orderId,
    });
  }

  /**
   * Read and validate an implementation result
   *
   * @param projectId - Project identifier
   * @param orderId - Work order identifier
   * @returns Validated implementation result, or null if not found
   */
  async readImplementationResult(
    projectId: string,
    orderId: string
  ): Promise<ImplementationResult | null> {
    return this.readAndValidate(
      projectId,
      () => this.scratchpad.getResultPath(projectId, orderId),
      validateImplementationResult,
      'ImplementationResult'
    );
  }

  /**
   * Validate and write an implementation result
   *
   * @param projectId - Project identifier
   * @param orderId - Work order identifier
   * @param data - Implementation result data
   */
  async writeImplementationResult(
    projectId: string,
    orderId: string,
    data: ImplementationResult
  ): Promise<void> {
    this.validateBeforeWrite(validateImplementationResult, data, 'ImplementationResult');
    await this.writeData(
      this.scratchpad.getResultPath(projectId, orderId),
      data,
      'ImplementationResult',
      { projectId, orderId }
    );
  }

  /**
   * Read and validate a PR review result
   *
   * @param projectId - Project identifier
   * @param reviewId - Review identifier
   * @returns Validated PR review result, or null if not found
   */
  async readPRReviewResult(projectId: string, reviewId: string): Promise<PRReviewResult | null> {
    return this.readAndValidate(
      projectId,
      () => this.scratchpad.getReviewPath(projectId, reviewId),
      validatePRReviewResult,
      'PRReviewResult'
    );
  }

  /**
   * Validate and write a PR review result
   *
   * @param projectId - Project identifier
   * @param reviewId - Review identifier
   * @param data - PR review result data
   */
  async writePRReviewResult(
    projectId: string,
    reviewId: string,
    data: PRReviewResult
  ): Promise<void> {
    this.validateBeforeWrite(validatePRReviewResult, data, 'PRReviewResult');
    await this.writeData(
      this.scratchpad.getReviewPath(projectId, reviewId),
      data,
      'PRReviewResult',
      { projectId, reviewId }
    );
  }

  /**
   * Read and validate the controller state
   *
   * @param projectId - Project identifier
   * @returns Validated controller state, or null if not found
   */
  async readControllerState(projectId: string): Promise<ControllerState | null> {
    return this.readAndValidate(
      projectId,
      () => this.scratchpad.getControllerStatePath(projectId),
      validateControllerState,
      'ControllerState'
    );
  }

  /**
   * Validate and write the controller state
   *
   * @param projectId - Project identifier
   * @param data - Controller state data
   */
  async writeControllerState(projectId: string, data: ControllerState): Promise<void> {
    this.validateBeforeWrite(validateControllerState, data, 'ControllerState');
    await this.writeData(
      this.scratchpad.getControllerStatePath(projectId),
      data,
      'ControllerState',
      { projectId }
    );
  }

  // -------------------------------------------------------------------------
  // Low-level data access (for flexibility)
  // -------------------------------------------------------------------------

  /**
   * Read raw data from the scratchpad
   *
   * @param filePath - Path to the file
   * @param options - Read options
   * @returns Raw data or null if not found
   */
  async read(filePath: string, options?: ReadOptions): Promise<unknown> {
    try {
      return await this.scratchpad.read(filePath, options);
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_READ_ERROR,
        `Failed to read: ${filePath}`,
        { filePath }
      );
    }
  }

  /**
   * Write raw data to the scratchpad
   *
   * @param filePath - Path to the file
   * @param data - Data to write
   * @param options - Write options
   */
  async write(filePath: string, data: unknown, options?: AtomicWriteOptions): Promise<void> {
    try {
      await this.scratchpad.write(filePath, data, options);
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_WRITE_ERROR,
        `Failed to write: ${filePath}`,
        { filePath }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Serialization mapping (snake_case ↔ camelCase)
  // -------------------------------------------------------------------------

  /**
   * Serialize TypeScript camelCase data to SRS snake_case format
   *
   * @param data - camelCase data object
   * @returns snake_case data object
   */
  serializeForSRS(data: Record<string, unknown>): Record<string, unknown> {
    try {
      return toSnakeCase(data) as Record<string, unknown>;
    } catch (error) {
      throw new SerializationError(
        `Failed to serialize data to snake_case: ${error instanceof Error ? error.message : String(error)}`,
        { context: { direction: 'camelToSnake' } }
      );
    }
  }

  /**
   * Deserialize SRS snake_case data to TypeScript camelCase format
   *
   * @param data - snake_case data object
   * @returns camelCase data object
   */
  deserializeFromSRS(data: Record<string, unknown>): Record<string, unknown> {
    try {
      return toCamelCase(data) as Record<string, unknown>;
    } catch (error) {
      throw new SerializationError(
        `Failed to deserialize data from snake_case: ${error instanceof Error ? error.message : String(error)}`,
        { context: { direction: 'snakeToCamel' } }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Schema version utilities
  // -------------------------------------------------------------------------

  /**
   * Get the current schema version
   *
   * @returns Current schema version string
   */
  getSchemaVersion(): string {
    return getSchemaVersion();
  }

  /**
   * Check if data is compatible with the current schema version
   *
   * Inspects the `schemaVersion` field on the provided data object.
   * Data without a version field is assumed compatible (migration path).
   *
   * @param data - Data object that may contain a schemaVersion field
   * @returns true if compatible
   */
  isSchemaCompatible(data: unknown): boolean {
    return isCompatibleVersion(data);
  }

  // -------------------------------------------------------------------------
  // Scratchpad access (for advanced usage)
  // -------------------------------------------------------------------------

  /**
   * Get direct access to the underlying Scratchpad instance
   *
   * Use this for operations not covered by the facade API.
   *
   * @returns Scratchpad instance
   */
  getScratchpad(): Scratchpad {
    return this.scratchpad;
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Clean up all underlying resources
   */
  cleanup(): void {
    this.scratchpad.cleanupSync();
    resetScratchpad();
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async readAndValidate<T>(
    projectId: string,
    getPath: () => string,
    validate: (data: unknown) => SchemaValidationResult<T>,
    schemaName: string
  ): Promise<T | null> {
    const filePath = getPath();
    let raw: unknown;

    try {
      raw = await this.scratchpad.readYaml(filePath);
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_READ_ERROR,
        `Failed to read ${schemaName} for project: ${projectId}`,
        { projectId, schemaName, filePath }
      );
    }

    if (raw === null || raw === undefined) {
      return null;
    }

    const result = validate(raw);
    if (!result.success) {
      throw new DataValidationError(
        schemaName,
        'validation',
        `Invalid ${schemaName} data for project ${projectId}: ${result.errors?.map((e) => `${e.path}: ${e.message}`).join(', ')}`,
        {
          context: { projectId, schemaName, errors: result.errors },
          severity: ErrorSeverity.MEDIUM,
        }
      );
    }

    return result.data as T;
  }

  private validateBeforeWrite<T>(
    validate: (data: unknown) => SchemaValidationResult<T>,
    data: unknown,
    schemaName: string
  ): void {
    const result = validate(data);
    if (!result.success) {
      throw new DataValidationError(
        schemaName,
        'validation',
        `Cannot write invalid ${schemaName}: ${result.errors?.map((e) => `${e.path}: ${e.message}`).join(', ')}`,
        {
          context: { schemaName, errors: result.errors },
          severity: ErrorSeverity.MEDIUM,
        }
      );
    }
  }

  private async writeData(
    filePath: string,
    data: unknown,
    schemaName: string,
    context: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.scratchpad.writeYaml(filePath, data);
    } catch (error) {
      throw this.wrapError(
        error,
        DataPlaneErrorCodes.DPL_WRITE_ERROR,
        `Failed to write ${schemaName}`,
        { ...context, schemaName, filePath }
      );
    }
  }

  private wrapError(
    error: unknown,
    code: string,
    message: string,
    context: Record<string, unknown>,
    category: ErrorCategory = 'recoverable'
  ): DataPlaneError {
    if (error instanceof DataPlaneError) {
      return error;
    }

    const cause = error instanceof Error ? error : new Error(String(error));
    return new DataPlaneError(code, message, {
      cause,
      context,
      category,
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: DataPlane | null = null;

/**
 * Get or create the singleton DataPlane instance
 *
 * @param options - Options applied only on first creation
 * @returns DataPlane singleton
 */
export function getDataPlane(options?: DataPlaneOptions): DataPlane {
  if (instance === null) {
    instance = new DataPlane(options);
  }
  return instance;
}

/**
 * Reset the singleton for testing or reconfiguration
 */
export function resetDataPlane(): void {
  instance = null;
}
