/**
 * Data Plane - Data Storage and Persistence
 *
 * This module exports components responsible for:
 * - Unified data-plane facade (DataPlane class)
 * - Scratchpad data storage and validation
 * - Schema definitions and versioning
 * - Data serialization mapping (snake_case ↔ camelCase)
 *
 * The exports that load no optional subsystem live in `./core.ts`; this
 * module adds the DataPlane facade and its serialization helpers.
 *
 * @packageDocumentation
 */

export * from './core.js';

// Data-Plane facade
export {
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
} from './DataPlane.js';

export type { DataPlaneOptions } from './DataPlane.js';
