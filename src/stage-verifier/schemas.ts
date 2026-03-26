/**
 * Zod Schemas for Stage Verifier Types
 *
 * Runtime validation schemas for verification checks, stage results,
 * consistency violations, and verification rules.
 *
 * @module stage-verifier/schemas
 */

import { z } from 'zod';

// =============================================================================
// Shared Enums
// =============================================================================

/** Zod schema for VerificationCategory */
export const VerificationCategorySchema = z.enum([
  'content',
  'structure',
  'traceability',
  'quality',
  'consistency',
]);

/** Zod schema for CheckSeverity */
export const CheckSeveritySchema = z.enum(['error', 'warning', 'info']);

/** Zod schema for VnvRigor */
export const VnvRigorSchema = z.enum(['strict', 'standard', 'minimal']);

/** Zod schema for ConsistencyViolation severity */
export const ConsistencyViolationSeveritySchema = z.enum(['critical', 'high', 'medium']);

// =============================================================================
// VerificationCheck Schema
// =============================================================================

/**
 * Zod schema for {@link VerificationCheck}.
 *
 * Validates individual verification check results.
 */
export const VerificationCheckSchema = z.object({
  checkId: z.string().min(1, 'checkId is required'),
  name: z.string().min(1, 'name is required'),
  category: VerificationCategorySchema,
  passed: z.boolean(),
  severity: CheckSeveritySchema,
  message: z.string().min(1, 'message is required'),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred type from VerificationCheckSchema */
export type VerificationCheckData = z.infer<typeof VerificationCheckSchema>;

// =============================================================================
// StageVerificationResult Schema
// =============================================================================

/**
 * Zod schema for {@link StageVerificationResult}.
 *
 * Validates aggregated stage verification results.
 */
export const StageVerificationResultSchema = z.object({
  stageName: z.string().min(1, 'stageName is required'),
  passed: z.boolean(),
  rigor: VnvRigorSchema,
  checks: z.array(VerificationCheckSchema),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  timestamp: z.string().min(1, 'timestamp is required'),
  durationMs: z.number().nonnegative('durationMs must be non-negative'),
});

/** Inferred type from StageVerificationResultSchema */
export type StageVerificationResultData = z.infer<typeof StageVerificationResultSchema>;

// =============================================================================
// ConsistencyViolation Schema
// =============================================================================

/**
 * Zod schema for {@link ConsistencyViolation}.
 *
 * Validates cross-document consistency violation entries.
 */
export const ConsistencyViolationSchema = z.object({
  syncPointName: z.string().min(1, 'syncPointName is required'),
  severity: ConsistencyViolationSeveritySchema,
  sourceDoc: z.string().min(1, 'sourceDoc is required'),
  targetDoc: z.string().min(1, 'targetDoc is required'),
  description: z.string().min(1, 'description is required'),
});

/** Inferred type from ConsistencyViolationSchema */
export type ConsistencyViolationData = z.infer<typeof ConsistencyViolationSchema>;

// =============================================================================
// ConsistencyCheckResult Schema
// =============================================================================

/**
 * Zod schema for {@link ConsistencyCheckResult}.
 *
 * Validates cross-document consistency check results.
 */
export const ConsistencyCheckResultSchema = z.object({
  passed: z.boolean(),
  syncPointsChecked: z.number().nonnegative('syncPointsChecked must be non-negative'),
  violations: z.array(ConsistencyViolationSchema),
});

/** Inferred type from ConsistencyCheckResultSchema */
export type ConsistencyCheckResultData = z.infer<typeof ConsistencyCheckResultSchema>;

// =============================================================================
// VerificationRule Schema (metadata only, excludes check function)
// =============================================================================

/**
 * Zod schema for {@link VerificationRule} metadata (excludes `check` function).
 *
 * Used for serialization and validation of rule metadata.
 * The `check` function cannot be validated by Zod and is omitted.
 */
export const VerificationRuleMetadataSchema = z.object({
  checkId: z.string().min(1, 'checkId is required'),
  name: z.string().min(1, 'name is required'),
  category: VerificationCategorySchema,
  minRigor: VnvRigorSchema,
  severity: CheckSeveritySchema,
});

/** Inferred type from VerificationRuleMetadataSchema */
export type VerificationRuleMetadata = z.infer<typeof VerificationRuleMetadataSchema>;
