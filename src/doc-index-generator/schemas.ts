/**
 * Zod Schemas for Doc Index Generator output files
 *
 * Runtime validation schemas for the 4 index files produced by the
 * doc-index-generator agent: manifest, bundles, graph, and router.
 *
 * @module doc-index-generator/schemas
 */

import { z } from 'zod';

// =============================================================================
// Schema Version
// =============================================================================

export const DOC_INDEX_SCHEMA_VERSION = '1.0.0';

// =============================================================================
// Manifest Schema (docs/.index/manifest.yaml)
// =============================================================================

/** Schema for a single section within a document */
export const ManifestSectionSchema = z.object({
  heading: z.string().min(1),
  level: z.number().int().min(1).max(6),
  lineStart: z.number().int().min(1),
  lineEnd: z.number().int().min(1),
});

/** Schema for a single document entry in the manifest */
export const ManifestEntrySchema = z.object({
  path: z.string().min(1, 'Document path is required'),
  title: z.string().min(1, 'Document title is required'),
  docType: z.string().optional(),
  docId: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  sections: z.array(ManifestSectionSchema).default([]),
  lastModified: z.string().optional(),
});

/** Schema for the full manifest file */
export const ManifestSchema = z.object({
  version: z.string().default(DOC_INDEX_SCHEMA_VERSION),
  generatedAt: z.string(),
  mode: z.enum(['flat', 'grouped']),
  documents: z.array(ManifestEntrySchema),
});

// =============================================================================
// Bundles Schema (docs/.index/bundles.yaml)
// =============================================================================

/** Schema for a document reference within a bundle */
export const BundleDocRefSchema = z.object({
  path: z.string().min(1),
  sections: z.array(z.string()).default([]),
  lineRanges: z
    .array(
      z.object({
        start: z.number().int().min(1),
        end: z.number().int().min(1),
      })
    )
    .default([]),
});

/** Schema for a single bundle (feature-grouped document set) */
export const BundleSchema = z.object({
  id: z.string().min(1, 'Bundle ID is required'),
  name: z.string().min(1, 'Bundle name is required'),
  description: z.string().optional(),
  documents: z.array(BundleDocRefSchema),
  custom: z.record(z.string(), z.unknown()).optional(),
});

/** Schema for the full bundles file */
export const BundlesSchema = z.object({
  version: z.string().default(DOC_INDEX_SCHEMA_VERSION),
  generatedAt: z.string(),
  bundles: z.array(BundleSchema),
});

// =============================================================================
// Graph Schema (docs/.index/graph.yaml)
// =============================================================================

/** Schema for a graph edge (cross-reference between documents) */
export const GraphEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.enum(['references', 'implements', 'extends', 'relates-to']).default('references'),
  label: z.string().optional(),
});

/** Schema for the full cross-reference graph */
export const GraphSchema = z.object({
  version: z.string().default(DOC_INDEX_SCHEMA_VERSION),
  generatedAt: z.string(),
  nodes: z.array(z.string()),
  edges: z.array(GraphEdgeSchema),
});

// =============================================================================
// Router Schema (docs/.index/router.yaml)
// =============================================================================

/** Schema for a routing rule (keyword to bundle mapping) */
export const RoutingRuleSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1),
  bundleId: z.string().min(1),
  priority: z.number().int().min(0).default(0),
});

/** Schema for the full router file */
export const RouterSchema = z.object({
  version: z.string().default(DOC_INDEX_SCHEMA_VERSION),
  generatedAt: z.string(),
  rules: z.array(RoutingRuleSchema),
});

// =============================================================================
// Agent Result Schema
// =============================================================================

/** Schema for the doc-index-generator stage result */
export const DocIndexResultSchema = z.object({
  success: z.boolean(),
  artifacts: z.array(z.string()).default([]),
  stats: z
    .object({
      documentsIndexed: z.number().int().min(0),
      bundlesCreated: z.number().int().min(0),
      crossReferences: z.number().int().min(0),
      processingTimeMs: z.number().int().min(0),
    })
    .optional(),
});
