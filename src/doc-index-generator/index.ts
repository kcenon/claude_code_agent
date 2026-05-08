/**
 * Doc Index Generator module
 *
 * The actual indexing logic is defined in the agent prompt
 * (.claude/agents/doc-index-generator.md) and executed via the
 * runtime ExecutionAdapter backend (claude-code session or stub).
 *
 * This module provides:
 * - Zod schemas for validating generated index files
 * - TypeScript types inferred from schemas
 * - Validation utility function
 *
 * @module doc-index-generator
 */

import type { z } from 'zod';
import {
  ManifestSchema,
  BundlesSchema,
  GraphSchema,
  RouterSchema,
  DocIndexResultSchema,
} from './schemas.js';

/** Agent identifier for the doc-index-generator */
export const DOC_INDEX_GENERATOR_AGENT_ID = 'doc-index-generator';

/** Agent display name */
export const DOC_INDEX_GENERATOR_NAME = 'Documentation Index Generator';

// Re-export schemas and types
export {
  ManifestSchema,
  ManifestEntrySchema,
  ManifestSectionSchema,
  BundlesSchema,
  BundleSchema,
  BundleDocRefSchema,
  GraphSchema,
  GraphEdgeSchema,
  RouterSchema,
  RoutingRuleSchema,
  DocIndexResultSchema,
  DOC_INDEX_SCHEMA_VERSION,
} from './schemas.js';

export type {
  Manifest,
  ManifestEntry,
  ManifestSection,
  Bundles,
  Bundle,
  BundleDocRef,
  Graph,
  GraphEdge,
  Router,
  RoutingRule,
  DocIndexResult,
} from './types.js';

/**
 * Validate a doc-index-generator stage result.
 * @param data - Raw data to validate
 * @returns Parsed and validated result, or throws ZodError
 */
export function validateDocIndexResult(data: unknown): z.infer<typeof DocIndexResultSchema> {
  return DocIndexResultSchema.parse(data);
}

/**
 * Validate a manifest file.
 * @param data - Raw parsed YAML data
 * @returns Parsed and validated manifest, or throws ZodError
 */
export function validateManifest(data: unknown): z.infer<typeof ManifestSchema> {
  return ManifestSchema.parse(data);
}

/**
 * Validate a bundles file.
 * @param data - Raw parsed YAML data
 * @returns Parsed and validated bundles, or throws ZodError
 */
export function validateBundles(data: unknown): z.infer<typeof BundlesSchema> {
  return BundlesSchema.parse(data);
}

/**
 * Validate a graph file.
 * @param data - Raw parsed YAML data
 * @returns Parsed and validated graph, or throws ZodError
 */
export function validateGraph(data: unknown): z.infer<typeof GraphSchema> {
  return GraphSchema.parse(data);
}

/**
 * Validate a router file.
 * @param data - Raw parsed YAML data
 * @returns Parsed and validated router, or throws ZodError
 */
export function validateRouter(data: unknown): z.infer<typeof RouterSchema> {
  return RouterSchema.parse(data);
}
