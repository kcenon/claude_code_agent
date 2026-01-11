/**
 * TypeScript type definitions for configuration module
 *
 * @module config/types
 */

// ============================================================
// Validation Types
// ============================================================

/**
 * Individual field validation error
 */
export interface FieldError {
  /** Field path (e.g., 'pipeline.stages[0].name') */
  readonly path: string;
  /** Error message */
  readonly message: string;
  /** Suggestion for fixing the error */
  readonly suggestion?: string;
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
// Configuration Types (inferred from schemas - defined in schemas.ts)
// ============================================================

// Note: These types are re-exported from schemas.ts to avoid circular imports
// The actual type definitions come from z.infer<typeof Schema>
import type { z } from 'zod';
import type {
  WorkflowConfigSchema,
  AgentsConfigSchema,
  ScratchpadConfigSchema,
} from './schemas.js';

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;
export type ScratchpadConfig = z.infer<typeof ScratchpadConfigSchema>;

// ============================================================
// Loader Types
// ============================================================

/**
 * Configuration file type
 */
export type ConfigFileType = 'workflow' | 'agents';

/**
 * Options for loading configuration
 */
export interface LoadConfigOptions {
  /** Base directory for resolving relative paths */
  readonly baseDir?: string;
  /** Whether to validate the configuration */
  readonly validate?: boolean;
}

// ============================================================
// Watcher Types
// ============================================================

/**
 * Callback for file change events
 */
export type FileChangeCallback = (filePath: string, result: FileValidationResult) => void;

/**
 * Options for configuration watcher
 */
export interface WatchOptions {
  /** Debounce delay in milliseconds */
  readonly debounceMs?: number;
  /** Whether to validate on change */
  readonly validateOnChange?: boolean;
  /** Callback for validation errors */
  readonly onError?: (error: Error) => void;
}

// ============================================================
// CLI Types
// ============================================================

/**
 * Options for validate command
 */
export interface ValidateCommandOptions {
  /** Specific file to validate */
  readonly file?: string;
  /** Whether to watch for changes */
  readonly watch?: boolean;
  /** Output format */
  readonly format?: 'text' | 'json';
  /** Whether to suggest fixes */
  readonly suggestFixes?: boolean;
}

/**
 * Validation report for CLI output
 */
export interface ValidationReport {
  /** Overall validation status */
  readonly valid: boolean;
  /** Files validated */
  readonly files: readonly FileValidationResult[];
  /** Total errors across all files */
  readonly totalErrors: number;
  /** Timestamp of validation */
  readonly timestamp: string;
}

/**
 * Validation result for a single file
 */
export interface FileValidationResult {
  /** File path */
  readonly filePath: string;
  /** Whether the file is valid */
  readonly valid: boolean;
  /** Validation errors */
  readonly errors: readonly FieldError[];
  /** Schema version */
  readonly schemaVersion: string;
}
