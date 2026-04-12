/**
 * TypeScript types for Doc Index Generator output files
 *
 * Inferred from Zod schemas for type-safe usage across the codebase.
 *
 * @module doc-index-generator/types
 */

import type { z } from 'zod';
import type {
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
} from './schemas.js';

/** A single section within a document */
export type ManifestSection = z.infer<typeof ManifestSectionSchema>;

/** A single document entry in the manifest */
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

/** The full manifest file structure */
export type Manifest = z.infer<typeof ManifestSchema>;

/** A document reference within a bundle */
export type BundleDocRef = z.infer<typeof BundleDocRefSchema>;

/** A single bundle (feature-grouped document set) */
export type Bundle = z.infer<typeof BundleSchema>;

/** The full bundles file structure */
export type Bundles = z.infer<typeof BundlesSchema>;

/** A graph edge (cross-reference between documents) */
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

/** The full cross-reference graph */
export type Graph = z.infer<typeof GraphSchema>;

/** A routing rule (keyword to bundle mapping) */
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

/** The full router file structure */
export type Router = z.infer<typeof RouterSchema>;

/** Stage result from the doc-index-generator agent */
export type DocIndexResult = z.infer<typeof DocIndexResultSchema>;
