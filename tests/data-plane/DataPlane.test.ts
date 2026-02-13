/**
 * DataPlane facade tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  DataPlane,
  getDataPlane,
  resetDataPlane,
  DataPlaneError,
  DataAccessError,
  DataValidationError,
  SerializationError,
  camelToSnake,
  snakeToCamel,
  toSnakeCase,
  toCamelCase,
} from '../../src/data-plane/DataPlane.js';
import { DataPlaneErrorCodes } from '../../src/errors/codes.js';

describe('DataPlane', () => {
  beforeEach(() => {
    resetDataPlane();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const a = getDataPlane();
      const b = getDataPlane();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', () => {
      const a = getDataPlane();
      resetDataPlane();
      const b = getDataPlane();
      expect(a).not.toBe(b);
    });

    it('should accept options on first creation', () => {
      const dp = getDataPlane({ scratchpad: { basePath: '/tmp/claude/test-dp' } });
      expect(dp).toBeInstanceOf(DataPlane);
    });
  });

  // -----------------------------------------------------------------------
  // Serialization mapping utilities
  // -----------------------------------------------------------------------

  describe('camelToSnake', () => {
    it('should convert simple camelCase to snake_case', () => {
      expect(camelToSnake('projectId')).toBe('project_id');
      expect(camelToSnake('createdAt')).toBe('created_at');
      expect(camelToSnake('schemaVersion')).toBe('schema_version');
    });

    it('should handle already snake_case strings', () => {
      expect(camelToSnake('project_id')).toBe('project_id');
    });

    it('should handle single word strings', () => {
      expect(camelToSnake('name')).toBe('name');
    });

    it('should handle multiple capitals', () => {
      expect(camelToSnake('prReviewResult')).toBe('pr_review_result');
    });
  });

  describe('snakeToCamel', () => {
    it('should convert simple snake_case to camelCase', () => {
      expect(snakeToCamel('project_id')).toBe('projectId');
      expect(snakeToCamel('created_at')).toBe('createdAt');
      expect(snakeToCamel('schema_version')).toBe('schemaVersion');
    });

    it('should handle already camelCase strings', () => {
      expect(snakeToCamel('projectId')).toBe('projectId');
    });

    it('should handle single word strings', () => {
      expect(snakeToCamel('name')).toBe('name');
    });
  });

  describe('toSnakeCase', () => {
    it('should recursively convert object keys', () => {
      const input = {
        projectId: 'p-1',
        createdAt: '2026-01-01',
        nestedData: {
          schemaVersion: '1.0.0',
          fieldErrors: [],
        },
      };
      const result = toSnakeCase(input) as Record<string, unknown>;
      expect(result).toEqual({
        project_id: 'p-1',
        created_at: '2026-01-01',
        nested_data: {
          schema_version: '1.0.0',
          field_errors: [],
        },
      });
    });

    it('should handle arrays', () => {
      const input = [{ projectId: 'a' }, { projectId: 'b' }];
      const result = toSnakeCase(input);
      expect(result).toEqual([{ project_id: 'a' }, { project_id: 'b' }]);
    });

    it('should handle null and undefined', () => {
      expect(toSnakeCase(null)).toBeNull();
      expect(toSnakeCase(undefined)).toBeUndefined();
    });

    it('should pass through primitives', () => {
      expect(toSnakeCase('hello')).toBe('hello');
      expect(toSnakeCase(42)).toBe(42);
      expect(toSnakeCase(true)).toBe(true);
    });

    it('should preserve Date objects', () => {
      const date = new Date('2026-01-01');
      expect(toSnakeCase(date)).toBe(date);
    });
  });

  describe('toCamelCase', () => {
    it('should recursively convert object keys', () => {
      const input = {
        project_id: 'p-1',
        created_at: '2026-01-01',
        nested_data: {
          schema_version: '1.0.0',
          field_errors: [],
        },
      };
      const result = toCamelCase(input) as Record<string, unknown>;
      expect(result).toEqual({
        projectId: 'p-1',
        createdAt: '2026-01-01',
        nestedData: {
          schemaVersion: '1.0.0',
          fieldErrors: [],
        },
      });
    });

    it('should handle arrays', () => {
      const input = [{ project_id: 'a' }, { project_id: 'b' }];
      const result = toCamelCase(input);
      expect(result).toEqual([{ projectId: 'a' }, { projectId: 'b' }]);
    });

    it('should handle null and undefined', () => {
      expect(toCamelCase(null)).toBeNull();
      expect(toCamelCase(undefined)).toBeUndefined();
    });

    it('should pass through primitives', () => {
      expect(toCamelCase('hello')).toBe('hello');
      expect(toCamelCase(42)).toBe(42);
      expect(toCamelCase(true)).toBe(true);
    });
  });

  describe('round-trip serialization', () => {
    it('should be identity when round-tripped camel→snake→camel', () => {
      const original = {
        projectId: 'p-1',
        workOrder: {
          orderId: 'wo-1',
          createdAt: '2026-01-01',
        },
      };
      const snake = toSnakeCase(original);
      const camel = toCamelCase(snake);
      expect(camel).toEqual(original);
    });

    it('should be identity when round-tripped snake→camel→snake', () => {
      const original = {
        project_id: 'p-1',
        work_order: {
          order_id: 'wo-1',
          created_at: '2026-01-01',
        },
      };
      const camel = toCamelCase(original);
      const snake = toSnakeCase(camel);
      expect(snake).toEqual(original);
    });
  });

  // -----------------------------------------------------------------------
  // DataPlane facade - serializeForSRS / deserializeFromSRS
  // -----------------------------------------------------------------------

  describe('serialization facade methods', () => {
    let dp: DataPlane;

    beforeEach(() => {
      dp = new DataPlane();
    });

    it('serializeForSRS should convert keys to snake_case', () => {
      const result = dp.serializeForSRS({ projectId: 'p-1', createdAt: '2026-01-01' });
      expect(result).toEqual({ project_id: 'p-1', created_at: '2026-01-01' });
    });

    it('deserializeFromSRS should convert keys to camelCase', () => {
      const result = dp.deserializeFromSRS({ project_id: 'p-1', created_at: '2026-01-01' });
      expect(result).toEqual({ projectId: 'p-1', createdAt: '2026-01-01' });
    });
  });

  // -----------------------------------------------------------------------
  // Schema version utilities
  // -----------------------------------------------------------------------

  describe('schema version', () => {
    let dp: DataPlane;

    beforeEach(() => {
      dp = new DataPlane();
    });

    it('should return current schema version', () => {
      const version = dp.getSchemaVersion();
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should check schema compatibility for data with matching version', () => {
      const currentVersion = dp.getSchemaVersion();
      expect(dp.isSchemaCompatible({ schemaVersion: currentVersion })).toBe(true);
    });

    it('should treat data without version field as compatible', () => {
      expect(dp.isSchemaCompatible({ name: 'test' })).toBe(true);
    });

    it('should return false for non-object data', () => {
      expect(dp.isSchemaCompatible('not-an-object')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Scratchpad access
  // -----------------------------------------------------------------------

  describe('getScratchpad', () => {
    it('should provide access to the underlying scratchpad', () => {
      const dp = new DataPlane();
      const scratchpad = dp.getScratchpad();
      expect(scratchpad).toBeDefined();
      expect(typeof scratchpad.getBasePath).toBe('function');
    });
  });

  // -----------------------------------------------------------------------
  // Error classes
  // -----------------------------------------------------------------------

  describe('error classes', () => {
    it('DataPlaneError should extend AppError', () => {
      const error = new DataPlaneError(DataPlaneErrorCodes.DPL_INIT_ERROR, 'Init failed');
      expect(error.name).toBe('DataPlaneError');
      expect(error.code).toBe('DPL-030');
      expect(error.message).toBe('Init failed');
      expect(error.isRetryable()).toBe(true); // recoverable category
    });

    it('DataAccessError should map operations to codes', () => {
      const readErr = new DataAccessError('read', 'Cannot read');
      expect(readErr.code).toBe(DataPlaneErrorCodes.DPL_READ_ERROR);
      expect(readErr.name).toBe('DataAccessError');

      const writeErr = new DataAccessError('write', 'Cannot write');
      expect(writeErr.code).toBe(DataPlaneErrorCodes.DPL_WRITE_ERROR);

      const notFoundErr = new DataAccessError('not_found', 'Not found');
      expect(notFoundErr.code).toBe(DataPlaneErrorCodes.DPL_NOT_FOUND);
    });

    it('DataAccessError should include operation in context', () => {
      const error = new DataAccessError('read', 'test');
      expect(error.context).toEqual(expect.objectContaining({ operation: 'read' }));
    });

    it('DataValidationError should map reasons to codes', () => {
      const validationErr = new DataValidationError('CollectedInfo', 'validation', 'Invalid');
      expect(validationErr.code).toBe(DataPlaneErrorCodes.DPL_VALIDATION_ERROR);

      const mismatchErr = new DataValidationError('CollectedInfo', 'schema_mismatch', 'Mismatch');
      expect(mismatchErr.code).toBe(DataPlaneErrorCodes.DPL_SCHEMA_MISMATCH);
    });

    it('DataValidationError should include schemaName in context', () => {
      const error = new DataValidationError('WorkOrder', 'validation', 'test');
      expect(error.context).toEqual(expect.objectContaining({ schemaName: 'WorkOrder' }));
    });

    it('SerializationError should use DPL_SERIALIZATION_ERROR code', () => {
      const error = new SerializationError('Conversion failed');
      expect(error.code).toBe(DataPlaneErrorCodes.DPL_SERIALIZATION_ERROR);
      expect(error.name).toBe('SerializationError');
    });

    it('DataPlaneError should serialize to JSON', () => {
      const error = new DataPlaneError(DataPlaneErrorCodes.DPL_INIT_ERROR, 'Init failed', {
        context: { projectId: 'proj-1' },
      });
      const json = error.toJSON();
      expect(json.code).toBe('DPL-030');
      expect(json.message).toBe('Init failed');
      expect(json.context).toEqual({ projectId: 'proj-1' });
    });

    it('error wrapping should preserve cause chain', () => {
      const original = new Error('underlying issue');
      const wrapped = new DataPlaneError(DataPlaneErrorCodes.DPL_READ_ERROR, 'Read failed', {
        cause: original,
      });
      expect(wrapped.cause).toBe(original);
    });
  });

  // -----------------------------------------------------------------------
  // Error codes integration
  // -----------------------------------------------------------------------

  describe('error codes', () => {
    it('should have all DPL codes defined', () => {
      expect(DataPlaneErrorCodes.DPL_READ_ERROR).toBe('DPL-001');
      expect(DataPlaneErrorCodes.DPL_WRITE_ERROR).toBe('DPL-002');
      expect(DataPlaneErrorCodes.DPL_NOT_FOUND).toBe('DPL-003');
      expect(DataPlaneErrorCodes.DPL_VALIDATION_ERROR).toBe('DPL-010');
      expect(DataPlaneErrorCodes.DPL_SCHEMA_MISMATCH).toBe('DPL-011');
      expect(DataPlaneErrorCodes.DPL_SERIALIZATION_ERROR).toBe('DPL-020');
      expect(DataPlaneErrorCodes.DPL_INIT_ERROR).toBe('DPL-030');
    });
  });
});
